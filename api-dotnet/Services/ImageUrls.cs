using System;

namespace Services;

// Decides what image URL the API hands to the browser.
//
// With IMAGES_VIA_APP off (the default) this returns the Quickbase URL untouched, so the
// payloads are identical to today's. With it on, any URL that normalises to an ImageKey is
// rewritten to our own /api/img/{key}; anything that doesn't — an absolute URL on some other
// host, a field holding something unexpected — is passed through rather than dropped, so a
// stray value can never turn into a missing image.
public sealed class ImageUrls
{
    private readonly EnvConfig _env;

    public ImageUrls(EnvConfig env)
    {
        _env = env;
    }

    public bool ViaApp => _env.ImagesViaApp;

    /// <summary>Rewrites one image URL for the response, or returns it unchanged.</summary>
    public string? ForResponse(string? quickbaseUrl)
    {
        if (string.IsNullOrWhiteSpace(quickbaseUrl)) return quickbaseUrl;

        var key = ImageKey.TryNormalize(quickbaseUrl, _env.Realm);
        if (key is null) return quickbaseUrl;

        // An image we own exists only in Blob, so /api/img is the only URL that can reach it.
        // IMAGES_VIA_APP decides whether we proxy QUICKBASE images; it cannot decide whether
        // our own are reachable. Without this, serving the gallery from SQL with the flag off
        // would emit raw storage keys as image URLs and every picture on the page would break.
        if (ImageKey.IsOwned(key)) return ImageKey.ToPublicPath(key);

        return _env.ImagesViaApp ? ImageKey.ToPublicPath(key) : quickbaseUrl;
    }

    /// <summary>
    /// The URL for an image identified by a stored key — the SQL read paths' entry point,
    /// where there is no original URL to fall back to.
    /// </summary>
    public string? ForKey(string? imageKey)
    {
        if (string.IsNullOrWhiteSpace(imageKey)) return null;
        if (!ImageKey.IsValid(imageKey)) return null;

        // Rows imported before the Blob move can still hold a Quickbase path. Those honour
        // the flag, so turning it off really does put every Quickbase-backed image back on
        // Quickbase's own host.
        if (!ImageKey.IsOwned(imageKey) && !_env.ImagesViaApp)
            return ImageKey.ToQuickbaseUrl(imageKey, _env.Realm)?.AbsoluteUri;

        return ImageKey.ToPublicPath(imageKey);
    }
}
