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
        if (!_env.ImagesViaApp) return quickbaseUrl;

        var key = ImageKey.TryNormalize(quickbaseUrl, _env.Realm);
        return key is null ? quickbaseUrl : ImageKey.ToPublicPath(key);
    }
}
