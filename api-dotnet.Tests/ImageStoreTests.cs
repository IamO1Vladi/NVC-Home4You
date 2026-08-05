using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The Blob -> Quickbase fallback is what lets the image migration roll out in pieces: URLs
// can be switched before every byte has been copied, and a partial import degrades to
// today's behaviour instead of showing a broken image.
//
// The same property is a trap, though — a container that is empty or unreachable serves
// perfectly good images. ImageOrigin is the only signal that says which happened, so these
// tests pin it as carefully as the bytes.
public class ImageStoreTests
{
    private const string Key = "up/bvk4n834b/g/rcy/eg/vb";

    private sealed class FakeSource : IImageSource
    {
        private readonly ImageBytes? _result;
        public int Calls { get; private set; }

        public FakeSource(ImageBytes? result) => _result = result;

        public Task<ImageBytes?> TryGetAsync(string key, CancellationToken ct)
        {
            Calls++;
            return Task.FromResult(_result);
        }
    }

    private static ImageBytes Png(byte marker) =>
        new(new byte[] { marker, 2, 3 }, "image/png");

    [Fact]
    public async Task Blob_is_preferred_when_it_has_the_image()
    {
        var blob = new FakeSource(Png(1));
        var quickbase = new FakeSource(Png(9));
        var store = new ImageStore(new ImageCache(), quickbase, blob);

        var served = await store.TryGetAsync(Key, CancellationToken.None);

        Assert.NotNull(served);
        Assert.Equal(ImageOrigin.Blob, served!.Origin);
        Assert.Equal(new byte[] { 1, 2, 3 }, served.Bytes);
        // The point of the migration: Quickbase is not touched at all.
        Assert.Equal(0, quickbase.Calls);
    }

    [Fact]
    public async Task A_key_missing_from_blob_falls_back_to_quickbase()
    {
        var blob = new FakeSource(null);
        var quickbase = new FakeSource(Png(9));
        var store = new ImageStore(new ImageCache(), quickbase, blob);

        var served = await store.TryGetAsync(Key, CancellationToken.None);

        Assert.NotNull(served);
        Assert.Equal(ImageOrigin.Quickbase, served!.Origin);
        Assert.Equal(1, blob.Calls);
        Assert.Equal(1, quickbase.Calls);
    }

    [Fact]
    public async Task With_no_blob_configured_it_behaves_exactly_as_today()
    {
        var quickbase = new FakeSource(Png(9));
        var store = new ImageStore(new ImageCache(), quickbase, blob: null);

        var served = await store.TryGetAsync(Key, CancellationToken.None);

        Assert.NotNull(served);
        Assert.Equal(ImageOrigin.Quickbase, served!.Origin);
    }

    [Fact]
    public async Task A_second_request_is_served_from_memory()
    {
        var blob = new FakeSource(Png(1));
        var store = new ImageStore(new ImageCache(), new FakeSource(Png(9)), blob);

        await store.TryGetAsync(Key, CancellationToken.None);
        var second = await store.TryGetAsync(Key, CancellationToken.None);

        Assert.Equal(ImageOrigin.Memory, second!.Origin);
        Assert.Equal(1, blob.Calls);
    }

    [Fact]
    public async Task A_quickbase_fallback_result_is_cached_too()
    {
        // Otherwise every not-yet-migrated image pays the ~300ms Quickbase round trip on
        // every single request, which is the cost the migration exists to remove.
        var quickbase = new FakeSource(Png(9));
        var store = new ImageStore(new ImageCache(), quickbase, new FakeSource(null));

        await store.TryGetAsync(Key, CancellationToken.None);
        var second = await store.TryGetAsync(Key, CancellationToken.None);

        Assert.Equal(ImageOrigin.Memory, second!.Origin);
        Assert.Equal(1, quickbase.Calls);
    }

    [Fact]
    public async Task When_neither_source_has_it_the_result_is_a_miss()
    {
        var store = new ImageStore(new ImageCache(), new FakeSource(null), new FakeSource(null));

        Assert.Null(await store.TryGetAsync(Key, CancellationToken.None));
    }

    [Theory]
    [InlineData("up/../../etc/passwd")]
    [InlineData("admin/secrets")]
    [InlineData("")]
    public async Task An_invalid_key_never_reaches_a_source(string key)
    {
        var blob = new FakeSource(Png(1));
        var quickbase = new FakeSource(Png(9));
        var store = new ImageStore(new ImageCache(), quickbase, blob);

        Assert.Null(await store.TryGetAsync(key, CancellationToken.None));
        Assert.Equal(0, blob.Calls);
        Assert.Equal(0, quickbase.Calls);
    }
}
