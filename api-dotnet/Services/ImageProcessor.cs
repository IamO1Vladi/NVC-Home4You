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

    private readonly ILogger<ImageProcessor> _log;

    public ImageProcessor(ILogger<ImageProcessor> log)
    {
        _log = log;
    }

    /// <summary>
    /// Converts to WebP, downscaling if needed. Returns null when the bytes are not a decodable
    /// image — callers decide whether that is a rejection (uploads) or a reason to keep the
    /// original (imports).
    /// </summary>
    public ProcessedImage? TryProcess(byte[] input)
    {
        if (input is null || input.Length == 0) return null;

        try
        {
            using var original = SKBitmap.Decode(input);
            if (original is null || original.Width <= 0 || original.Height <= 0)
                return null;

            using var scaled = Downscale(original);
            var source = scaled ?? original;

            using var image = SKImage.FromBitmap(source);
            using var encoded = image.Encode(SKEncodedImageFormat.Webp, Quality);

            if (encoded is null) return null;

            var bytes = encoded.ToArray();

            // A conversion that makes the file BIGGER is not worth doing. Rare, but it happens
            // with flat graphics and small PNGs, where PNG's lossless compression already wins
            // and WebP would cost bytes AND quality. Only meaningful when nothing was resized,
            // since a downscale is worth keeping regardless.
            if (scaled is null && bytes.Length >= input.Length)
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

            var info = new SKImageInfo(maxWidth, height, original.ColorType, original.AlphaType);
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

    // Returns null when the image is already within bounds, so the caller can tell "no resize
    // happened" from "resized".
    private static SKBitmap? Downscale(SKBitmap original)
    {
        var longest = Math.Max(original.Width, original.Height);
        if (longest <= MaxDimension) return null;

        var scale = (double)MaxDimension / longest;
        var width = Math.Max(1, (int)Math.Round(original.Width * scale));
        var height = Math.Max(1, (int)Math.Round(original.Height * scale));

        var info = new SKImageInfo(width, height, original.ColorType, original.AlphaType);
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
