using System;
using System.Linq;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using SkiaSharp;
using Xunit;

namespace ApiDotnet.Tests;

// WebP conversion on upload and import. The measured saving on the real library was 73.8 MB
// across 63 gallery images, which is bandwidth paid on every cache miss once images come from
// our own origin rather than Quickbase's.
public class ImageProcessorTests
{
    private static ImageProcessor NewProcessor() => new(NullLogger<ImageProcessor>.Instance);

    // A photographic-ish bitmap: a smooth gradient with noise, which is what WebP is good at
    // and what a flat colour block would not exercise honestly.
    private static byte[] Photo(int width, int height)
    {
        using var bitmap = new SKBitmap(width, height);
        var rng = new Random(42);

        for (var y = 0; y < height; y++)
        for (var x = 0; x < width; x++)
        {
            var r = (byte)Math.Clamp(x * 255 / Math.Max(1, width) + rng.Next(-12, 12), 0, 255);
            var g = (byte)Math.Clamp(y * 255 / Math.Max(1, height) + rng.Next(-12, 12), 0, 255);
            var b = (byte)Math.Clamp((x + y) * 255 / Math.Max(1, width + height) + rng.Next(-12, 12), 0, 255);
            bitmap.SetPixel(x, y, new SKColor(r, g, b));
        }

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    [Fact]
    public void A_photo_is_converted_to_webp_and_gets_smaller()
    {
        var input = Photo(1200, 800);

        var result = NewProcessor().TryProcess(input);

        Assert.NotNull(result);
        Assert.Equal("image/webp", result!.ContentType);
        Assert.Equal(".webp", result.Extension);
        Assert.True(result.Bytes.Length < input.Length,
            $"expected smaller than {input.Length}, got {result.Bytes.Length}");
    }

    [Fact]
    public void An_oversized_image_is_downscaled_preserving_aspect_ratio()
    {
        // 4000x2000 -> longest side clamped to MaxDimension, ratio kept.
        var result = NewProcessor().TryProcess(Photo(4000, 2000));

        Assert.NotNull(result);
        Assert.Equal(ImageProcessor.MaxDimension, result!.Width);
        Assert.Equal(ImageProcessor.MaxDimension / 2, result.Height);
    }

    [Fact]
    public void An_image_within_bounds_keeps_its_dimensions()
    {
        // Downscaling a small image would throw away detail for nothing.
        var result = NewProcessor().TryProcess(Photo(800, 600));

        Assert.NotNull(result);
        Assert.Equal(800, result!.Width);
        Assert.Equal(600, result.Height);
    }

    [Fact]
    public void The_result_is_a_decodable_webp()
    {
        // Guards against writing bytes that are smaller but unusable — which would look like
        // a successful migration right up until a visitor opened the page.
        var result = NewProcessor().TryProcess(Photo(900, 600));

        Assert.NotNull(result);
        using var decoded = SKBitmap.Decode(result!.Bytes);
        Assert.NotNull(decoded);
        Assert.Equal(900, decoded!.Width);
    }

    [Theory]
    [InlineData(new byte[0])]
    [InlineData(new byte[] { 1, 2, 3, 4 })]
    public void Undecodable_bytes_are_refused_rather_than_mangled(byte[] input)
    {
        // Null means "keep the original" for the importer and "reject" for an upload. Either
        // way, never a corrupted file written under a .webp name.
        Assert.Null(NewProcessor().TryProcess(input));
    }

    [Fact]
    public void Null_input_is_handled()
    {
        Assert.Null(NewProcessor().TryProcess(null!));
    }

    [Fact]
    public void Conversion_is_skipped_when_it_would_not_save_anything()
    {
        // A tiny flat graphic: PNG's lossless compression already beats WebP here, so
        // converting would cost bytes AND quality. Five of the 63 real gallery images hit
        // this path.
        using var bitmap = new SKBitmap(8, 8);
        bitmap.Erase(SKColors.White);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);

        var result = NewProcessor().TryProcess(data.ToArray());

        Assert.Null(result);
    }

    // --- EXIF orientation (2026-10-16) ----------------------------------------------------

    private static readonly SKColor Red = new(220, 30, 30);
    private static readonly SKColor Green = new(30, 200, 30);
    private static readonly SKColor Blue = new(30, 30, 220);
    private static readonly SKColor Yellow = new(230, 220, 30);

    // A 128x64 JPEG whose STORED pixels have four quadrants — red top-left, green top-right,
    // blue bottom-left, yellow bottom-right — and, when orientation is not null, an EXIF APP1
    // segment carrying that Orientation value, written by hand right after the JPEG's
    // start-of-image marker, which is where a camera puts it. SkiaSharp cannot write EXIF, so
    // the fixture is built here rather than kept as a binary file nobody can read.
    //
    // Noisy by default, like a photograph, so its WebP is smaller and the "not worth
    // converting" rule never decides the outcome; flat when a test wants that rule in play.
    private static byte[] JpegWithOrientation(int? orientation, bool noisy = true)
    {
        using var bitmap = new SKBitmap(128, 64);
        var rng = new Random(7);
        for (var y = 0; y < 64; y++)
        for (var x = 0; x < 128; x++)
        {
            var c = y < 32 ? (x < 64 ? Red : Green) : (x < 64 ? Blue : Yellow);
            var n = noisy ? rng.Next(-12, 12) : 0;
            bitmap.SetPixel(x, y, new SKColor(
                (byte)Math.Clamp(c.Red + n, 0, 255),
                (byte)Math.Clamp(c.Green + n, 0, 255),
                (byte)Math.Clamp(c.Blue + n, 0, 255)));
        }
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 95);
        var jpeg = data.ToArray();
        return orientation is null ? jpeg : Tagged(jpeg, orientation.Value);
    }

    // The JPEG with a minimal EXIF block holding one tag, Orientation, inserted after SOI.
    private static byte[] Tagged(byte[] jpeg, int orientation)
    {
        var app1 = new byte[]
        {
            0xFF, 0xE1, 0x00, 0x22,                         // APP1, length 34 (counts itself)
            (byte)'E', (byte)'x', (byte)'i', (byte)'f', 0, 0,
            (byte)'M', (byte)'M', 0x00, 0x2A, 0, 0, 0, 0x08,  // big-endian TIFF, IFD0 at 8
            0x00, 0x01,                                     // one entry
            0x01, 0x12, 0x00, 0x03, 0, 0, 0, 1,             // Orientation, SHORT, count 1
            0x00, (byte)orientation, 0x00, 0x00,            // its value
            0, 0, 0, 0,                                     // no next IFD
        };
        return jpeg.Take(2).Concat(app1).Concat(jpeg.Skip(2)).ToArray();
    }

    private static string Nearest(SKColor c)
    {
        var named = new[] { ("red", Red), ("green", Green), ("blue", Blue), ("yellow", Yellow) };
        return named
            .OrderBy(n => Math.Pow(n.Item2.Red - c.Red, 2) + Math.Pow(n.Item2.Green - c.Green, 2) + Math.Pow(n.Item2.Blue - c.Blue, 2))
            .First().Item1;
    }

    [Fact]
    public void The_fixture_really_carries_the_orientation_tag()
    {
        // Otherwise the tests below would pass by turning nothing.
        using var codec = SKCodec.Create(new System.IO.MemoryStream(JpegWithOrientation(6)));
        Assert.Equal(SKEncodedOrigin.RightTop, codec.EncodedOrigin);

        using var plain = SKCodec.Create(new System.IO.MemoryStream(JpegWithOrientation(null)));
        Assert.Equal(SKEncodedOrigin.TopLeft, plain.EncodedOrigin);
    }

    // The expected corners come from the EXIF definition of each value (which stored edge
    // becomes the visual top and left), worked out by hand rather than from the code under test.
    [Theory]
    [InlineData(null, 128, 64, "red", "green", "blue", "yellow")]
    [InlineData(1, 128, 64, "red", "green", "blue", "yellow")]
    [InlineData(2, 128, 64, "green", "red", "yellow", "blue")]   // mirrored left-right
    [InlineData(3, 128, 64, "yellow", "blue", "green", "red")]   // upside down
    [InlineData(4, 128, 64, "blue", "yellow", "red", "green")]   // mirrored top-bottom
    [InlineData(5, 64, 128, "red", "blue", "green", "yellow")]   // transposed
    [InlineData(6, 64, 128, "blue", "red", "yellow", "green")]   // a phone held upright: quarter turn clockwise
    [InlineData(7, 64, 128, "yellow", "green", "blue", "red")]   // transversed
    [InlineData(8, 64, 128, "green", "yellow", "red", "blue")]   // quarter turn anticlockwise
    public void A_photo_is_stored_the_way_up_its_exif_orientation_says(
        int? orientation, int width, int height,
        string topLeft, string topRight, string bottomLeft, string bottomRight)
    {
        var result = NewProcessor().TryProcess(JpegWithOrientation(orientation));

        Assert.NotNull(result);
        Assert.Equal(width, result!.Width);
        Assert.Equal(height, result.Height);

        using var decoded = SKBitmap.Decode(result.Bytes);
        Assert.Equal(width, decoded.Width);
        Assert.Equal(height, decoded.Height);

        // The centre of each quadrant, well clear of the edges the codecs blur.
        int qx = width / 4, qy = height / 4;
        Assert.Equal(topLeft, Nearest(decoded.GetPixel(qx, qy)));
        Assert.Equal(topRight, Nearest(decoded.GetPixel(width - qx, qy)));
        Assert.Equal(bottomLeft, Nearest(decoded.GetPixel(qx, height - qy)));
        Assert.Equal(bottomRight, Nearest(decoded.GetPixel(width - qx, height - qy)));
    }

    [Fact]
    public void A_turned_photo_is_kept_even_when_its_webp_is_not_smaller()
    {
        // Flat colours: JPEG already beats WebP on these bytes, so an upright copy is refused
        // by the "not worth converting" rule exactly as before — but a sideways one is not,
        // because keeping its original would mean keeping it sideways for everything that
        // ignores EXIF (the srcset resizer among them), and an upload would be refused.
        Assert.Null(NewProcessor().TryProcess(JpegWithOrientation(null, noisy: false)));

        var turned = NewProcessor().TryProcess(JpegWithOrientation(6, noisy: false));
        Assert.NotNull(turned);
        Assert.Equal(64, turned!.Width);
        Assert.Equal(128, turned.Height);
    }

    [Fact]
    public void A_sideways_photo_that_is_also_too_big_is_turned_and_downscaled()
    {
        // A camera-sized portrait stored landscape: 3000x2000 pixels, Orientation 6.
        using var bitmap = new SKBitmap(3000, 2000);
        bitmap.Erase(SKColors.Gray);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 80);

        var result = NewProcessor().TryProcess(Tagged(data.ToArray(), 6));

        Assert.NotNull(result);
        Assert.Equal(ImageProcessor.MaxDimension, result!.Height);
        Assert.Equal(1707, result.Width);   // 2000 * 2560 / 3000, rounded
    }

    // --- Colour profile (2026-10-16) -----------------------------------------------------

    // A JPEG in Display P3, the profile an iPhone writes, optionally tagged with an orientation.
    private static byte[] P3Jpeg(int width, int height, int? orientation)
    {
        var p3 = SKColorSpace.CreateRgb(SKColorSpaceTransferFn.Srgb, SKColorSpaceXyz.DisplayP3);
        using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Opaque, p3));
        bitmap.Erase(new SKColor(200, 40, 40));
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 90);
        var jpeg = data.ToArray();
        return orientation is null ? jpeg : Tagged(jpeg, orientation.Value);
    }

    private static void AssertKeepsP3(byte[] bytes)
    {
        using var codec = SKCodec.Create(new System.IO.MemoryStream(bytes));
        Assert.NotNull(codec.Info.ColorSpace);
        Assert.False(codec.Info.ColorSpace.IsSrgb);
    }

    [Fact]
    public void The_p3_fixture_really_carries_its_profile()
    {
        AssertKeepsP3(P3Jpeg(60, 40, null));
    }

    // Without its profile the WebP's P3 pixel values would be read as sRGB and the photo would
    // show duller colours: every turn, downscale and srcset copy keeps the source's profile.
    [Theory]
    [InlineData(600, 400, 6)]      // turned upright, no resize
    [InlineData(3000, 2000, null)] // downscaled only: any full-size phone original
    [InlineData(3000, 2000, 6)]    // both
    public void A_photo_keeps_its_colour_profile_through_turning_and_downscaling(int width, int height, int? orientation)
    {
        var result = NewProcessor().TryProcess(P3Jpeg(width, height, orientation));

        Assert.NotNull(result);
        AssertKeepsP3(result!.Bytes);

        var copy = NewProcessor().TryResizeToWidth(result.Bytes, 200);
        Assert.NotNull(copy);
        AssertKeepsP3(copy!.Bytes);
    }

    // --- HEIC/HEIF, which this build cannot decode (2026-10-16) ---------------------------

    // The first bytes of an ISO media file: a box size, "ftyp", the major brand, a minor
    // version, then the compatible brands — exactly how an iPhone's .HEIC begins.
    private static byte[] Ftyp(string major, params string[] compatible)
    {
        var size = 16 + (4 * compatible.Length);
        var bytes = new System.Collections.Generic.List<byte> { 0, 0, 0, (byte)size };
        bytes.AddRange(System.Text.Encoding.ASCII.GetBytes("ftyp" + major));
        bytes.AddRange(new byte[] { 0, 0, 0, 0 });
        foreach (var brand in compatible) bytes.AddRange(System.Text.Encoding.ASCII.GetBytes(brand));
        // Then the start of the next box, as in a real file.
        bytes.AddRange(new byte[] { 0, 0, 0, 0x22 });
        bytes.AddRange(System.Text.Encoding.ASCII.GetBytes("meta"));
        return bytes.ToArray();
    }

    [Theory]
    [InlineData("heic", new[] { "mif1", "heic" }, true)]    // an iPhone photo
    [InlineData("heix", new[] { "mif1", "heix" }, true)]
    [InlineData("hevc", new[] { "msf1", "hevc" }, true)]    // an HEVC image sequence
    [InlineData("mif1", new[] { "mif1", "heic" }, true)]    // generic HEIF brand, HEIC inside (some Android phones)
    [InlineData("mif1", new[] { "mif1", "avif" }, false)]   // generic brand, but AVIF
    [InlineData("avif", new[] { "avif", "mif1", "miaf" }, false)]
    [InlineData("isom", new[] { "isom", "mp41" }, false)]   // an MP4 video
    public void A_heif_file_is_recognised_by_its_header(string major, string[] compatible, bool heif)
    {
        Assert.Equal(heif, ImageProcessor.IsHeif(Ftyp(major, compatible)));
    }

    [Fact]
    public void Ordinary_images_and_scraps_are_not_heif()
    {
        Assert.False(ImageProcessor.IsHeif(JpegWithOrientation(null)));
        Assert.False(ImageProcessor.IsHeif(Photo(16, 16)));
        Assert.False(ImageProcessor.IsHeif(new byte[] { 1, 2, 3, 4 }));
        Assert.False(ImageProcessor.IsHeif(Array.Empty<byte>()));
        Assert.False(ImageProcessor.IsHeif(null));
    }

    [Fact]
    public void A_heic_file_does_not_decode_here_which_is_why_it_is_refused_in_words()
    {
        // The reason the upload names the format instead of "could not be read": this build
        // has no HEIF decoder, so the processor can only ever say null to it.
        Assert.Null(NewProcessor().TryProcess(Ftyp("heic", "mif1", "heic")));

        Assert.True(ImageProcessor.HasHeifName("IMG_2041.HEIC"));
        Assert.True(ImageProcessor.HasHeifName("photo.heif"));
        Assert.False(ImageProcessor.HasHeifName("IMG_2041.JPG"));
        Assert.False(ImageProcessor.HasHeifName("heic.png"));
        Assert.False(ImageProcessor.HasHeifName(null));

        // In Bulgarian, the panel's language, naming the format and the way out.
        Assert.Contains("HEIC", ImageProcessor.HeifRefusal);
        Assert.Contains("JPEG", ImageProcessor.HeifRefusal);
        Assert.Matches("[А-Яа-я]", ImageProcessor.HeifRefusal);
    }

    [Fact]
    public void A_converted_key_carries_the_webp_extension()
    {
        // The blob name must not contradict its content type: a JPEG re-encoded to WebP but
        // stored as ".jpg" leaves every consumer having to distrust one of the two.
        var key = ImageKey.NewOwnedKey(ImageKey.GalleryScope, 13, "photo.jpg", ".webp");

        Assert.EndsWith(".webp", key);
        Assert.True(ImageKey.IsValid(key));
    }
}
