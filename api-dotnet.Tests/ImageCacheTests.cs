using System.Text;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// ImageCache is the size-bounded store behind ImageStore and the /api/img route. Its job is
// to hold hot image bytes without letting one large asset blow the memory budget.
public class ImageCacheTests
{
    private static byte[] Bytes(int size) => Encoding.UTF8.GetBytes(new string('x', size));

    [Fact]
    public void Round_trips_bytes_and_content_type()
    {
        using var cache = new ImageCache();
        var payload = Bytes(1024);

        cache.Set("k1", payload, "image/webp");

        Assert.True(cache.TryGet("k1", out var got, out var type));
        Assert.Equal(payload, got);
        Assert.Equal("image/webp", type);
    }

    [Fact]
    public void Miss_reports_false_without_throwing()
    {
        using var cache = new ImageCache();

        Assert.False(cache.TryGet("never-stored", out var got, out var type));
        Assert.Empty(got);
        Assert.Equal("", type);
    }

    [Fact]
    public void Oversized_images_are_not_cached()
    {
        using var cache = new ImageCache();
        var tooBig = Bytes((int)ImageCache.MaxCacheableBytes + 1);

        cache.Set("huge", tooBig, "image/png");

        // Served through, never stored — so one big asset can't evict the working set.
        Assert.False(cache.TryGet("huge", out _, out _));
    }

    [Fact]
    public void Empty_payloads_are_not_cached()
    {
        using var cache = new ImageCache();

        cache.Set("empty", System.Array.Empty<byte>(), "image/png");

        Assert.False(cache.TryGet("empty", out _, out _));
    }

    [Fact]
    public void Entries_are_keyed_independently()
    {
        using var cache = new ImageCache();
        cache.Set("a", Bytes(10), "image/png");
        cache.Set("b", Bytes(20), "image/jpeg");

        Assert.True(cache.TryGet("a", out var a, out var aType));
        Assert.True(cache.TryGet("b", out var b, out var bType));
        Assert.Equal(10, a.Length);
        Assert.Equal(20, b.Length);
        Assert.Equal("image/png", aType);
        Assert.Equal("image/jpeg", bType);
    }
}
