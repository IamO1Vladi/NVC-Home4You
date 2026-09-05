using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using SkiaSharp;
using Xunit;

namespace ApiDotnet.Tests;

// The server half of ROADMAP #9: /api/img/{key}?w= — the ladder that makes it safe, and
// the variant path through the store. The srcset markup shipped months before the server
// could answer it, so what these pin is the contract the frontend has been assuming.
public class ImageWidthsTests
{
    // --- The ladder --------------------------------------------------------------------

    [Fact]
    public void Widths_snap_up_to_the_next_rung()
    {
        // THE SAME CASES are pinned in src/lib/img.test.js. The helper writes the snapped
        // width into the srcset descriptor, so the two ladders drifting means the browser's
        // layout math is quietly lied to — this pair of tests is what stops that.
        Assert.Equal(640, ImageWidths.Snap(640));
        Assert.Equal(640, ImageWidths.Snap(600));
        Assert.Equal(120, ImageWidths.Snap(90));
    }

    [Fact]
    public void Past_the_top_rung_the_original_is_the_answer()
    {
        // The stored original is capped at 2560; a "2400 variant" of it would be a
        // re-encode that saves nothing and costs a cache entry.
        Assert.Null(ImageWidths.Snap(2400));
    }

    [Fact]
    public void Nonsense_widths_mean_the_original_not_an_error()
    {
        // ?w= is attacker-typeable. Nonsense degrades to the plain image — the response a
        // request without ?w= gets — rather than a 400 that turns image URLs brittle.
        Assert.Null(ImageWidths.Snap(null));
        Assert.Null(ImageWidths.Snap(0));
        Assert.Null(ImageWidths.Snap(-320));
    }

    // --- The variant path through the store ---------------------------------------------

    private const string Key = "gallery/12/0af3b2c1d4e5f60718293a4b5c6d7e8f.webp";

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

    private static byte[] Photo(int width, int height)
    {
        using var bitmap = new SKBitmap(width, height);
        var rng = new Random(42);

        for (var y = 0; y < height; y++)
        for (var x = 0; x < width; x++)
        {
            var r = (byte)Math.Clamp(x * 255 / Math.Max(1, width) + rng.Next(-12, 12), 0, 255);
            var g = (byte)Math.Clamp(y * 255 / Math.Max(1, height) + rng.Next(-12, 12), 0, 255);
            bitmap.SetPixel(x, y, new SKColor(r, g, 128));
        }

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    private static ImageStore StoreWith(byte[] bytes) => new(
        new ImageCache(),
        new FakeSource(new ImageBytes(bytes, "image/png")),
        blob: null,
        processor: new ImageProcessor(NullLogger<ImageProcessor>.Instance));

    [Fact]
    public async Task A_width_request_serves_a_narrower_webp()
    {
        var store = StoreWith(Photo(1600, 1000));

        var served = await store.TryGetAsync(Key, 640, CancellationToken.None);

        Assert.NotNull(served);
        Assert.Equal("image/webp", served!.ContentType);
        using var decoded = SKBitmap.Decode(served.Bytes);
        Assert.Equal(640, decoded.Width);
        // Aspect ratio survives the resize.
        Assert.Equal(400, decoded.Height);
    }

    [Fact]
    public async Task The_variant_is_cached_so_the_resize_happens_once()
    {
        var source = new FakeSource(new ImageBytes(Photo(1600, 1000), "image/png"));
        var store = new ImageStore(new ImageCache(), source, blob: null,
            processor: new ImageProcessor(NullLogger<ImageProcessor>.Instance));

        await store.TryGetAsync(Key, 640, CancellationToken.None);
        var second = await store.TryGetAsync(Key, 640, CancellationToken.None);

        Assert.Equal(ImageOrigin.Memory, second!.Origin);
        // One fetch of the original serves every later request for this width.
        Assert.Equal(1, source.Calls);
    }

    [Fact]
    public async Task A_width_the_image_cannot_fill_serves_the_original_unresized()
    {
        // Never upscale: a 500px photo asked for at 640 is served as the 500px photo. The
        // browser scales it the same either way; the bytes and the honesty differ.
        var store = StoreWith(Photo(500, 400));

        var served = await store.TryGetAsync(Key, 640, CancellationToken.None);

        Assert.Equal("image/png", served!.ContentType);
        using var decoded = SKBitmap.Decode(served.Bytes);
        Assert.Equal(500, decoded.Width);
    }

    [Fact]
    public async Task A_gif_is_never_resized_because_one_frame_is_not_the_image()
    {
        var store = StoreWith(Photo(1600, 1000));

        var served = await store.TryGetAsync("files/db/1/2/3/anim.gif", 320, CancellationToken.None);

        // Served as-is: SKBitmap.Decode reads one frame of an animation, and a still
        // masquerading as the GIF would be a quiet content change, not an optimisation.
        Assert.Equal("image/png", served!.ContentType);
    }

    [Fact]
    public async Task Without_a_processor_a_width_request_degrades_to_the_original()
    {
        // The store is constructed without a processor in older tests and, if wiring ever
        // regresses, in production. Degraded must mean "full-size image", never "no image".
        var store = new ImageStore(new ImageCache(),
            new FakeSource(new ImageBytes(Photo(800, 500), "image/png")));

        var served = await store.TryGetAsync(Key, 320, CancellationToken.None);

        Assert.NotNull(served);
        using var decoded = SKBitmap.Decode(served!.Bytes);
        Assert.Equal(800, decoded.Width);
    }
}
