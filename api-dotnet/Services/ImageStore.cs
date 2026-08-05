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

    // Takes the interface rather than the concrete sources so the chain can be exercised
    // without a storage account or an HTTP client standing behind it.
    public ImageStore(ImageCache cache, IImageSource quickbase, IImageSource? blob = null)
    {
        _cache = cache;
        _quickbase = quickbase;
        _blob = blob;
    }

    public async Task<ServedImage?> TryGetAsync(string key, CancellationToken ct)
    {
        if (!ImageKey.IsValid(key)) return null;

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
