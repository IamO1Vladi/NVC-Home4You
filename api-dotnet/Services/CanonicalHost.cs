using System;

namespace Services;

/// <summary>
/// One hostname serves the site: <c>www.*</c> is redirected to the bare domain.
///
/// THIS IS INERT UNTIL www IS BOUND IN APP SERVICE, and that ordering is the whole trap.
/// A redirect cannot fix a TLS failure: today `www.nvc-home4you.eu` CNAMEs to the apex and
/// reaches App Service, which has no such hostname bound, so :443 falls back to the
/// `*.azurewebsites.net` certificate and the handshake fails *before* any HTTP response
/// exists to redirect with. The certificate has to come first — custom domain, then managed
/// certificate, then this. Shipping this alone changes nothing a visitor can see.
///
/// It is still the half that belongs in the repo, because binding www without it just moves
/// the problem: two hostnames serving identical content is the duplicate-content issue the
/// August SEO work removed everywhere else.
///
/// The redirect target is always the requested host minus a leading "www.", never a
/// configured domain. That looks like an open redirect and is not one: the only way to reach
/// this code with someone else's hostname is to point that hostname at our IP yourself, and
/// the victim's browser sets Host from the URL it was given — so a link to our domain can
/// never bounce anyone off it. Deriving the target also means this keeps working if the
/// domain changes, rather than silently pinning traffic to a stale hostname.
/// </summary>
public static class CanonicalHost
{
    private const string WwwPrefix = "www.";

    /// <summary>
    /// The absolute URL this request belongs on, or <c>null</c> when it is already canonical.
    /// </summary>
    /// <param name="scheme">
    /// Request scheme. Must be read *after* UseForwardedHeaders — App Service's inbound hop
    /// is plain http, so a scheme read before it sends every visitor to http:// and buys an
    /// extra redirect straight back to https.
    /// </param>
    /// <param name="host">Host header, port included if the client sent one.</param>
    /// <param name="pathAndQuery">Path and query string, passed through untouched.</param>
    public static string? RedirectTarget(string scheme, string? host, string pathAndQuery)
    {
        if (string.IsNullOrWhiteSpace(scheme) || string.IsNullOrWhiteSpace(host)) return null;
        if (!host.StartsWith(WwwPrefix, StringComparison.OrdinalIgnoreCase)) return null;

        var bare = host[WwwPrefix.Length..];

        // "www." alone, or "www.:8080" — stripping the prefix leaves no host to send anyone
        // to, and a Location of "https://:8080/" is worse than not redirecting at all.
        if (bare.Length == 0 || bare[0] == ':') return null;

        return $"{scheme}://{bare}{pathAndQuery}";
    }
}
