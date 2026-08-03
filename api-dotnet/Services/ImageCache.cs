using System;
using Microsoft.Extensions.Caching.Memory;

namespace Services;

// Dedicated, size-bounded cache for proxied image bytes.
//
// This deliberately does NOT use the shared IMemoryCache: image payloads are large and
// need a hard memory ceiling, but setting SizeLimit on the shared cache would make every
// existing caller (Gallery/Cases/Reviews) throw, because entries there don't declare a
// Size. A separate instance keeps the ceiling local to images.
public sealed class ImageCache : IDisposable
{
    // Total bytes held across all cached images before eviction kicks in.
    private const long TotalBudgetBytes = 64L * 1024 * 1024;

    // Individual images larger than this are served straight through rather than cached,
    // so one oversized asset can't evict most of the working set.
    public const long MaxCacheableBytes = 4L * 1024 * 1024;

    private static readonly TimeSpan Ttl = TimeSpan.FromHours(12);

    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = TotalBudgetBytes });

    public bool TryGet(string key, out byte[] bytes, out string contentType)
    {
        if (_cache.TryGetValue(key, out CachedImage? hit) && hit is not null)
        {
            bytes = hit.Bytes;
            contentType = hit.ContentType;
            return true;
        }
        bytes = Array.Empty<byte>();
        contentType = "";
        return false;
    }

    public void Set(string key, byte[] bytes, string contentType)
    {
        if (bytes.Length == 0 || bytes.Length > MaxCacheableBytes) return;

        _cache.Set(key, new CachedImage(bytes, contentType), new MemoryCacheEntryOptions
        {
            Size = bytes.Length,
            AbsoluteExpirationRelativeToNow = Ttl,
        });
    }

    public void Dispose() => _cache.Dispose();

    private sealed record CachedImage(byte[] Bytes, string ContentType);
}
