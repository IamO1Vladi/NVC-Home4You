using System;
using System.IO;
using Microsoft.Extensions.Logging;
using SkiaSharp;

namespace Services;

/// <summary>An image after conversion, ready to store.</summary>
public sealed record ProcessedImage(
    byte[] Bytes,
    string ContentType,
    string Extension,
    int Width,
    int Height,
    int OriginalBytes)
{
    public double SavedFraction => OriginalBytes <= 0 ? 0 : 1.0 - ((double)Bytes.Length / OriginalBytes);
}

// Converts uploaded and imported images to WebP, downscaling anything larger than the site
// ever displays.
//
// Worth doing because the current library is heavy: a single case carries 8.4 MB across five
// photos, one of them a 2.7 MB PNG, none of them WebP. That cost was Quickbase's while it
// served the bytes; once images come from our own origin it is App Service bandwidth on every
// cache miss, and it is the visitor's data allowance on every first view.
//
// SkiaSharp rather than ImageSharp deliberately: ImageSharp v3+ ships under the Six Labors
// Split License, which is free only below a revenue threshold, and that is a commercial
// judgement rather than a technical one. SkiaSharp is MIT, so the question does not arise.
// The trade-off is native assets — SkiaSharp.NativeAssets.Win32 matches the Windows App
// Service this deploys to, and would need swapping if it ever moved to Linux.
public sealed class ImageProcessor
{
    // Nothing on the site displays an image wider than a full-bleed hero on a large screen.
    // 2560 leaves headroom for high-DPI without storing camera-sized originals.
    public const int MaxDimension = 2560;

    // WebP at 82 is visually indistinguishable from the source for photographs at these sizes
    // while typically landing well under half the bytes of an equivalent JPEG.
    public const int Quality = 82;

    // What an upload of a HEIC/HEIF file is told, in the panel's language. iPhones save photos
    // as HEIC by default, and the SkiaSharp build this site runs on (NativeAssets.Win32) has no
    // HEIF decoder, so such a file can never become a photo here; "could not be read as an
    // image" would leave the owner guessing why a photo his phone shows fine is refused.
    public const string HeifRefusal =
        "Снимката е във формат HEIC/HEIF (така iPhone пази снимките) и сайтът не може да я прочете. " +
        "Запазете я като JPEG, PNG или WebP и я качете отново. " +
        "Или я качете направо от телефона — тогава iPhone сам я превръща в JPEG.";

    private readonly ILogger<ImageProcessor> _log;

    public ImageProcessor(ILogger<ImageProcessor> log)
    {
        _log = log;
    }

    /// <summary>
    /// Converts to WebP, downscaling if needed. Returns null when the bytes are not a decodable
    /// image — callers decide whether that is a rejection (uploads) or a reason to keep the
    /// original (imports).
    ///
    /// The pixels are turned upright first (since 2026-10-16). A phone that holds the camera
    /// sideways saves the pixels as the sensor saw them and records the turn in the EXIF
    /// Orientation tag; browsers apply that tag when they show the original, but the WebP
    /// written here carries no EXIF, so without applying the turn here a portrait taken on such
    /// a phone is stored lying on its side. This is the one conversion every upload goes
    /// through, so the gallery and case uploads and the imports get upright photos from it too,
    /// not only the site-photo slots it was added for.
    /// </summary>
    public ProcessedImage? TryProcess(byte[] input)
    {
        if (input is null || input.Length == 0) return null;

        try
        {
            // Through SKCodec rather than SKBitmap.Decode(bytes), which decodes the same pixels
            // but throws the Orientation tag away.
            using var data = SKData.CreateCopy(input);
            using var codec = SKCodec.Create(data);
            if (codec is null) return null;
            var origin = codec.EncodedOrigin;

            using var original = SKBitmap.Decode(codec);
            if (original is null || original.Width <= 0 || original.Height <= 0)
                return null;

            // Scaled first, turned second: the cap is on the longest side, which a quarter
            // turn does not change, and turning the smaller bitmap is the cheaper copy.
            using var scaled = Downscale(original);
            var sized = scaled ?? original;
            using var upright = Upright(sized, origin);
            var source = upright ?? sized;

            using var image = SKImage.FromBitmap(source);
            using var encoded = image.Encode(SKEncodedImageFormat.Webp, Quality);

            if (encoded is null) return null;

            var bytes = encoded.ToArray();

            // A conversion that makes the file BIGGER is not worth doing. Rare, but it happens
            // with flat graphics and small PNGs, where PNG's lossless compression already wins
            // and WebP would cost bytes AND quality. Only meaningful when nothing was resized or
            // turned upright, since either is worth keeping regardless: the original would come
            // back sideways from everything that ignores EXIF, the srcset resizer included.
            if (scaled is null && upright is null && bytes.Length >= input.Length)
            {
                _log.LogDebug(
                    "WebP conversion skipped: {New} bytes is not smaller than the original {Old}.",
                    bytes.Length, input.Length);
                return null;
            }

            return new ProcessedImage(
                bytes, "image/webp", ".webp", source.Width, source.Height, input.Length);
        }
        catch (Exception ex)
        {
            // Never fatal. An image we cannot decode is stored as-is rather than lost, and an
            // upload of something that is not an image is rejected by the caller.
            _log.LogWarning(ex, "Image conversion failed; the original will be used.");
            return null;
        }
    }

    /// <summary>
    /// A width-bounded WebP variant for the srcset ladder (ROADMAP #9). Null when the
    /// original is already no wider than the target — serving it unchanged beats an
    /// upscale-shaped copy — and null when the bytes will not decode, where the caller
    /// serves the original too. Unlike <see cref="TryProcess"/> there is no is-it-smaller
    /// check: the input here is the stored 2560-capped original, so a narrower re-encode
    /// is worth keeping by construction.
    /// </summary>
    public ProcessedImage? TryResizeToWidth(byte[] input, int maxWidth)
    {
        if (input is null || input.Length == 0 || maxWidth <= 0) return null;

        try
        {
            using var original = SKBitmap.Decode(input);
            if (original is null || original.Width <= maxWidth || original.Height <= 0)
                return null;

            var scale = (double)maxWidth / original.Width;
            var height = Math.Max(1, (int)Math.Round(original.Height * scale));

            // The source's colour space travels with the pixels (see Downscale).
            var info = new SKImageInfo(maxWidth, height, original.ColorType, original.AlphaType, original.ColorSpace);
            using var resized = new SKBitmap(info);
            if (!original.ScalePixels(resized, new SKSamplingOptions(SKCubicResampler.Mitchell)))
                return null;

            using var image = SKImage.FromBitmap(resized);
            using var encoded = image.Encode(SKEncodedImageFormat.Webp, Quality);
            if (encoded is null) return null;

            return new ProcessedImage(
                encoded.ToArray(), "image/webp", ".webp", resized.Width, resized.Height, input.Length);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Width-variant resize failed; the original will be served.");
            return null;
        }
    }

    /// <summary>
    /// True when the bytes are a HEIF container — HEIC is HEIF with HEVC inside, the format an
    /// iPhone saves by default. Read from the file's own header, never its name: an ISO media
    /// file starts with a box size, "ftyp", then a major brand. AVIF shares the container (and
    /// the generic "mif1" brand) but is a different codec, so a file that names "avif" among
    /// its brands is not counted.
    /// </summary>
    public static bool IsHeif(byte[]? input)
    {
        if (input is null || input.Length < 12) return false;
        if (input[4] != (byte)'f' || input[5] != (byte)'t' || input[6] != (byte)'y' || input[7] != (byte)'p')
            return false;

        var major = System.Text.Encoding.ASCII.GetString(input, 8, 4);
        if (Array.IndexOf(HevcBrands, major) >= 0) return true;
        if (major != "mif1" && major != "msf1") return false;

        // A generic HEIF brand: HEIC unless the compatible brands (after the 4-byte minor
        // version, up to the end of the ftyp box) say AVIF.
        var boxSize = (input[0] << 24) | (input[1] << 16) | (input[2] << 8) | input[3];
        var end = Math.Min(input.Length, boxSize < 16 ? 16 : boxSize);
        for (var i = 16; i + 4 <= end; i += 4)
        {
            var brand = System.Text.Encoding.ASCII.GetString(input, i, 4);
            if (brand is "avif" or "avis") return false;
        }
        return true;
    }

    /// <summary>True when an upload's file name says HEIC/HEIF, for when its bytes would not decode at all.</summary>
    public static bool HasHeifName(string? fileName)
    {
        var ext = Path.GetExtension(fileName ?? "");
        return ext.Equals(".heic", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".heif", StringComparison.OrdinalIgnoreCase);
    }

    private static readonly string[] HevcBrands =
        { "heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs" };

    // The bitmap turned so it shows the way the EXIF Orientation tag says it should; null when
    // it already does (TopLeft, or no tag at all). The eight cases are the tag's eight values:
    // a matrix maps each stored pixel (x, y) to where it belongs, x' = sx·x + kx·y + tx and
    // y' = ky·x + sy·y + ty, for a W×H source. Every one is a flip or a quarter turn landing on
    // whole pixels, so nothing is resampled.
    private static SKBitmap? Upright(SKBitmap source, SKEncodedOrigin origin)
    {
        float w = source.Width, h = source.Height;
        SKMatrix matrix;
        bool quarterTurn;
        switch (origin)
        {
            case SKEncodedOrigin.TopRight:      // 2: mirrored left to right
                matrix = new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1); quarterTurn = false; break;
            case SKEncodedOrigin.BottomRight:   // 3: upside down
                matrix = new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1); quarterTurn = false; break;
            case SKEncodedOrigin.BottomLeft:    // 4: mirrored top to bottom
                matrix = new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1); quarterTurn = false; break;
            case SKEncodedOrigin.LeftTop:       // 5: mirrored along the main diagonal
                matrix = new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1); quarterTurn = true; break;
            case SKEncodedOrigin.RightTop:      // 6: needs a quarter turn clockwise (phone held upright)
                matrix = new SKMatrix(0, -1, h, 1, 0, 0, 0, 0, 1); quarterTurn = true; break;
            case SKEncodedOrigin.RightBottom:   // 7: mirrored along the other diagonal
                matrix = new SKMatrix(0, -1, h, -1, 0, w, 0, 0, 1); quarterTurn = true; break;
            case SKEncodedOrigin.LeftBottom:    // 8: needs a quarter turn anticlockwise
                matrix = new SKMatrix(0, 1, 0, -1, 0, w, 0, 0, 1); quarterTurn = true; break;
            default:
                return null;
        }

        // The platform colour type rather than the source's, because a canvas cannot draw into
        // every colour type a decoder may hand back (a greyscale JPEG can arrive as Gray8). The
        // source's colour space, though, because the pixels are still in it: without it the
        // WebP carries no ICC profile and an iPhone's Display P3 photo shows washed out.
        var info = new SKImageInfo(
            quarterTurn ? source.Height : source.Width,
            quarterTurn ? source.Width : source.Height,
            SKImageInfo.PlatformColorType,
            source.AlphaType == SKAlphaType.Opaque ? SKAlphaType.Opaque : SKAlphaType.Premul,
            source.ColorSpace);
        var turned = new SKBitmap(info);
        using (var canvas = new SKCanvas(turned))
        {
            canvas.Clear(SKColors.Transparent);
            canvas.SetMatrix(matrix);
            canvas.DrawBitmap(source, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest), null);
        }
        return turned;
    }

    // Returns null when the image is already within bounds, so the caller can tell "no resize
    // happened" from "resized".
    private static SKBitmap? Downscale(SKBitmap original)
    {
        var longest = Math.Max(original.Width, original.Height);
        if (longest <= MaxDimension) return null;

        var scale = (double)MaxDimension / longest;
        var width = Math.Max(1, (int)Math.Round(original.Width * scale));
        var height = Math.Max(1, (int)Math.Round(original.Height * scale));

        // With the source's colour space: the pixels are still in it, and a bitmap without one
        // is encoded with no ICC profile, so a Display P3 phone photo (every full-size iPhone
        // original lands here) would be read as sRGB and show duller colours.
        var info = new SKImageInfo(width, height, original.ColorType, original.AlphaType, original.ColorSpace);
        var resized = new SKBitmap(info);

        // Mitchell resampling: noticeably better than bilinear on photographic downscales,
        // which is all this handles.
        if (!original.ScalePixels(resized, new SKSamplingOptions(SKCubicResampler.Mitchell)))
        {
            resized.Dispose();
            return null;
        }

        return resized;
    }
}
