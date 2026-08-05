using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Services;

// Fetches image bytes from Quickbase — the path every image takes today, and the fallback
// for any key not yet copied to Blob.
//
// Requests go to https://{realm}/{key}, the same host the browser currently hits directly.
// The realm comes from configuration and the key has been through ImageKey validation, so
// the composed URL cannot be steered at another host.
public sealed class QuickbaseImageSource : IImageSource
{
    private readonly HttpClient _http;
    private readonly EnvConfig _env;
    private readonly ILogger<QuickbaseImageSource> _log;

    public QuickbaseImageSource(HttpClient http, EnvConfig env, ILogger<QuickbaseImageSource> log)
    {
        _http = http;
        _env = env;
        _log = log;
    }

    public async Task<ImageBytes?> TryGetAsync(string key, CancellationToken ct) =>
        (await TryGetDetailedAsync(key, ct)).Image;

    /// <summary>
    /// As TryGetAsync, but says whether the miss was a 404.
    ///
    /// The migration needs the distinction. Quickbase mints an attachment URL even for an
    /// EMPTY file field — version "v0" — so a 404 usually means "this case has no logo",
    /// which is ordinary data, while a timeout or a 500 means an image we were supposed to
    /// migrate did not arrive. Reporting both as failures buries the second in the first.
    /// </summary>
    public async Task<(ImageBytes? Image, bool NotFound)> TryGetDetailedAsync(string key, CancellationToken ct)
    {
        // Keys are held decoded, so the URL is rebuilt through Uri rather than by string
        // concatenation — that restores the percent-encoding Quickbase expects for the
        // spaces and Cyrillic that real attachment filenames are full of.
        var url = ImageKey.ToQuickbaseUrl(key, _env.Realm);
        if (url is null) return (null, false);

        try
        {
            using var resp = await _http.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var notFound = resp.StatusCode == System.Net.HttpStatusCode.NotFound;

                // A 404 is routine here — an empty file field still produces a URL — so it is
                // logged at a lower level than a real failure to keep the migration's output
                // readable.
                if (notFound)
                    _log.LogDebug("Quickbase has no attachment at {Key} (404).", key);
                else
                    _log.LogWarning("Quickbase image fetch returned {Status} for {Key}.", (int)resp.StatusCode, key);

                return (null, notFound);
            }

            var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
            var contentType = resp.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";

            return (new ImageBytes(bytes, contentType), false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log.LogWarning(ex, "Quickbase image fetch failed for {Key}.", key);
            return (null, false);
        }
    }
}
