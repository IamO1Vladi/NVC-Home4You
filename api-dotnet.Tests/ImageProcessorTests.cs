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
