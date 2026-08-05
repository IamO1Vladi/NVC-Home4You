using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Services;

// Copies every image the site references from Quickbase into the Blob container, and
// verifies the result. Driven by `dotnet run -- import-images` / `-- verify-images`.
//
// Kept off HTTP for the same reason as the review importer: it rewrites storage and hammers
// Quickbase, and there is no authentication in front of the public API.
public sealed class ImageImportService
{
    // Quickbase is the bottleneck being migrated away from, so pulling harder than this is
    // counterproductive — and this runs against the live table the site is serving from.
    private const int Concurrency = 4;

    private readonly GalleryService _gallery;
    private readonly CasesPageService _cases;
    private readonly QuickbaseImageSource _source;
    private readonly BlobImageSource _blob;
    private readonly EnvConfig _env;

    public ImageImportService(
        GalleryService gallery,
        CasesPageService cases,
        QuickbaseImageSource source,
        BlobImageSource blob,
        EnvConfig env)
    {
        _gallery = gallery;
        _cases = cases;
        _source = source;
        _blob = blob;
        _env = env;
    }

    public record ImportResult(int Found, int Uploaded, int AlreadyPresent, int Failed, List<string> Failures);

    public async Task<ImportResult> ImportAsync(bool force, CancellationToken ct)
    {
        var keys = await CollectKeysAsync(ct);

        var uploaded = 0;
        var present = 0;
        var failed = 0;
        var failures = new List<string>();
        var guard = new object();

        using var gate = new SemaphoreSlim(Concurrency);

        async Task OneAsync(string key)
        {
            await gate.WaitAsync(ct);
            try
            {
                if (!force && await _blob.ExistsAsync(key, ct))
                {
                    lock (guard) present++;
                    return;
                }

                var bytes = await _source.TryGetAsync(key, ct);
                if (bytes is null)
                {
                    lock (guard) { failed++; failures.Add(key); }
                    return;
                }

                await _blob.UploadAsync(key, bytes.Bytes, bytes.ContentType, ct);
                lock (guard) uploaded++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                lock (guard) { failed++; failures.Add($"{key} ({ex.GetType().Name}: {ex.Message})"); }
            }
            finally
            {
                gate.Release();
            }
        }

        await Task.WhenAll(keys.Select(OneAsync));

        return new ImportResult(keys.Count, uploaded, present, failed, failures);
    }

    public record VerifyResult(int Checked, int InBlob, List<string> Missing);

    /// <summary>
    /// Confirms every referenced image is actually in Blob. Worth running before flipping
    /// IMAGES_VIA_APP: because the read path falls back to Quickbase, a container that is
    /// empty, misnamed or unreachable serves perfectly good images and looks like success.
    /// </summary>
    public async Task<VerifyResult> VerifyAsync(CancellationToken ct)
    {
        var keys = await CollectKeysAsync(ct);
        var missing = new List<string>();
        var guard = new object();

        using var gate = new SemaphoreSlim(Concurrency);

        async Task OneAsync(string key)
        {
            await gate.WaitAsync(ct);
            try
            {
                if (!await _blob.ExistsAsync(key, ct))
                    lock (guard) missing.Add(key);
            }
            finally
            {
                gate.Release();
            }
        }

        await Task.WhenAll(keys.Select(OneAsync));

        return new VerifyResult(keys.Count, keys.Count - missing.Count, missing);
    }

    /// <summary>
    /// Every image key the API currently serves, from the same code paths the site uses —
    /// so whatever the gallery and cases pages show is exactly what gets migrated.
    ///
    /// This does NOT cover the image URLs hard-coded in the frontend content files, which
    /// the API never sees. Those are a separate pass.
    /// </summary>
    public async Task<List<string>> CollectKeysAsync(CancellationToken ct)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);

        void Add(string? url)
        {
            var key = ImageKey.TryNormalize(url, _env.Realm);
            if (key is not null) keys.Add(key);
        }

        foreach (var item in await _gallery.GetAsync(ct))
        {
            Add(item.CoverUrl);
            foreach (var url in item.Images) Add(url);
        }

        var cases = await _cases.GetAsync(ct);

        foreach (var client in cases.Clients)
            Add(client.LogoUrl);

        foreach (var c in cases.Cases)
        {
            Add(c.CompanyLogoUrl);
            Add(c.ImageUrl);
            foreach (var url in c.Images) Add(url);
        }

        return keys.ToList();
    }
}
