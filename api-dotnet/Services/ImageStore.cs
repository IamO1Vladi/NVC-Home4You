using System.Threading;
using System.Threading.Tasks;

namespace Services;

/// <summary>Where a served image actually came from. Surfaced for diagnostics, not for callers to branch on.</summary>
public enum ImageOrigin
{
    Memory,
    Blob,
    Quickbase,
}

public sealed record ServedImage(byte[] Bytes, string ContentType, ImageOrigin Origin);

// The read path for /api/img/{key}: memory cache, then Blob, then Quickbase.
//
// The fallback to Quickbase is what makes the migration safe to roll out incrementally —
// a key that has not been uploaded yet still resolves, so the URL switch and the data copy
// do not have to happen atomically, and a partial import cannot produce a broken image.
//
// It also means a completed migration and a Blob container that is quietly unreachable look
// identical from the outside. `verify-images` is how you tell them apart; ImageOrigin is
// what it reads.
public sealed class ImageStore
{
    private readonly ImageCache _cache;
    private readonly IImageSource? _blob;
    private readonly IImageSource _quickbase;
    private readonly ImageProcessor? _processor;

    // Takes the interface rather than the concrete sources so the chain can be exercised
    // without a storage account or an HTTP client standing behind it. The processor is
    // optional the same way blob is: without one, ?w= quietly serves originals — degraded,
    // never broken.
    public ImageStore(ImageCache cache, IImageSource quickbase, IImageSource? blob = null,
        ImageProcessor? processor = null)
    {
        _cache = cache;
        _quickbase = quickbase;
        _blob = blob;
        _processor = processor;
    }

    public Task<ServedImage?> TryGetAsync(string key, CancellationToken ct) =>
        TryGetAsync(key, null, ct);

    /// <summary>
    /// The srcset read path (ROADMAP #9): the image no wider than <paramref name="width"/>,
    /// resized once and cached beside the original. The width is snapped to
    /// <see cref="ImageWidths.Ladder"/> FIRST, so the cache can only ever hold ladder
    /// variants no matter what the query string says.
    /// </summary>
    public async Task<ServedImage?> TryGetAsync(string key, int? width, CancellationToken ct)
    {
        if (!ImageKey.IsValid(key)) return null;

        var snapped = ImageWidths.Snap(width);

        // A GIF can be animated, and SKBitmap.Decode reads one frame — a "resized" copy
        // would be a still. The only honest variant of a GIF is the GIF.
        if (snapped is null || _processor is null ||
            key.EndsWith(".gif", StringComparison.OrdinalIgnoreCase))
            return await OriginalAsync(key, ct);

        // ':' cannot appear in a valid key (ImageKey refuses it), which is what makes this
        // prefix collision-proof against every original the same cache holds.
        var variantKey = $"w{snapped}:{key}";
        if (_cache.TryGet(variantKey, out var variantBytes, out var variantType))
            return new ServedImage(variantBytes, variantType, ImageOrigin.Memory);

        var original = await OriginalAsync(key, ct);
        if (original is null) return null;

        // Null means "already narrow enough" or "would not decode" — either way the
        // original IS the answer, and it is not re-cached under the variant key because
        // the original's own cache entry already holds those bytes once.
        var resized = _processor.TryResizeToWidth(original.Bytes, snapped.Value);
        if (resized is null) return original;

        _cache.Set(variantKey, resized.Bytes, resized.ContentType);
        return new ServedImage(resized.Bytes, resized.ContentType, original.Origin);
    }

    private async Task<ServedImage?> OriginalAsync(string key, CancellationToken ct)
    {
        if (_cache.TryGet(key, out var cachedBytes, out var cachedType))
            return new ServedImage(cachedBytes, cachedType, ImageOrigin.Memory);

        if (_blob is not null)
        {
            var fromBlob = await _blob.TryGetAsync(key, ct);
            if (fromBlob is not null)
            {
                _cache.Set(key, fromBlob.Bytes, fromBlob.ContentType);
                return new ServedImage(fromBlob.Bytes, fromBlob.ContentType, ImageOrigin.Blob);
            }
        }

        var fromQuickbase = await _quickbase.TryGetAsync(key, ct);
        if (fromQuickbase is null) return null;

        _cache.Set(key, fromQuickbase.Bytes, fromQuickbase.ContentType);
        return new ServedImage(fromQuickbase.Bytes, fromQuickbase.ContentType, ImageOrigin.Quickbase);
    }
}
