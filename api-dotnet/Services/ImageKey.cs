using System;
using System.Linq;

namespace Services;

// Canonical identity for one image, shared by the blob name, the memory cache entry and the
// public /api/img/{key} route.
//
// Quickbase hands us attachment URLs in two shapes and we do not get to choose which:
//
//   /files/{dbid}/{rid}/{fid}/{version}              decimal ids, from the API's attachment JSON
//   /up/{dbid}/g/r{rid}/e{fid}/v{version}[/{name}]   base-36 ids, what the browser is given
//
// The obvious key would be the parsed (dbid, rid, fid, version) tuple, but that forces a
// base-36 decode for the /up/ shape, and the encoding is only implied by the /a/ vs /g/
// segment — a guess we would be betting every image URL on. Keying by the *normalised source
// path* sidesteps the question entirely: whatever path Quickbase gave us is the key, so both
// shapes round-trip exactly and the hard-coded /up/ URLs in the frontend need no decoding.
//
// The key is held DECODED ("…/Copy of Оферта.jpg", not "…/Copy%20of%20%D0%9E…"). Real
// attachment names are percent-encoded Cyrillic, and ASP.NET decodes route values before the
// controller sees them — so an encoded key would never match the key a request arrives with.
// Blob names accept spaces and Unicode, so the decoded form is storable as-is, and
// QuickbaseImageSource re-encodes when it builds the fallback URL.
//
// That fallback makes the key attacker-reachable via /api/img/{key}, so it is validated
// against traversal and against pointing anywhere but an attachment path.
public static class ImageKey
{
    // Quickbase-originated images. These have a fallback: if the key is not in Blob yet, the
    // bytes can still be fetched from the realm host.
    private static readonly string[] AttachmentRoots = { "files/", "up/" };

    // Images uploaded through the admin panel. Blob is the only copy — there is nothing to
    // fall back to, and asking Quickbase for one would be a pointless round trip ending in
    // a 404. ToQuickbaseUrl returns null for these, which is what stops that.
    public const string UploadRoot = "uploads/";

    private static readonly string[] AllRoots = { "files/", "up/", UploadRoot };

    /// <summary>
    /// Normalises a Quickbase image URL — absolute, host-relative, or already a bare key —
    /// into a storage key, or returns null if it is not one we will serve.
    /// </summary>
    public static string? TryNormalize(string? raw, string? realm = null)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var value = raw.Trim();

        if (value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)) return null;

            // Only Quickbase-hosted images are ours to migrate. Without this check any
            // absolute URL in the data would become a key, and /api/img/{key} would proxy
            // arbitrary hosts on request — a server-side request forgery.
            if (!IsQuickbaseHost(uri.Host, realm)) return null;

            // AbsolutePath is percent-encoded; decode to the canonical form.
            value = Uri.UnescapeDataString(uri.AbsolutePath);
        }
        else
        {
            // Strip the query/fragment of a relative input; the ids in the path fully identify
            // the bytes, and a token in the query would otherwise fork the key for one image.
            var cut = value.IndexOfAny(new[] { '?', '#' });
            if (cut >= 0) value = value[..cut];

            // A relative value may arrive either encoded (copied from a URL) or already
            // decoded (a route value). Decoding an already-decoded string is a no-op unless it
            // contains a literal '%', which Quickbase attachment names do not.
            value = Uri.UnescapeDataString(value);
        }

        value = value.TrimStart('/');

        // Unwrap our own URL so normalisation is idempotent. The import command collects keys
        // by reading the gallery and cases payloads, and once IMAGES_VIA_APP is on those
        // payloads contain /api/img/{key} rather than Quickbase URLs — without this, running
        // the import after flipping the flag would quietly find nothing to migrate.
        const string ownPrefix = "api/img/";
        if (value.StartsWith(ownPrefix, StringComparison.OrdinalIgnoreCase))
            value = value[ownPrefix.Length..];

        return IsValid(value) ? value : null;
    }

    /// <summary>True when the key is one this app will serve. Route-level guard.</summary>
    public static bool IsValid(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;

        // Checked on the decoded form, which is the point: "%2e%2e/" only becomes traversal
        // after decoding, so validating the raw string would miss it.
        if (key.Contains("..", StringComparison.Ordinal)) return false;
        if (key.Contains("//", StringComparison.Ordinal)) return false;
        if (key.StartsWith("/", StringComparison.Ordinal)) return false;

        // Backslash is a path separator on Windows and a traversal vector; ':' would let a
        // key masquerade as a scheme or an alternate data stream. Control characters have no
        // business in a filename and can smuggle a newline into a request line.
        if (key.Any(c => c == '\\' || c == ':' || char.IsControl(c))) return false;

        // Only known roots. Without this the fallback could be aimed at any path on the realm
        // host, carrying our credentials.
        var root = AllRoots.FirstOrDefault(r => key.StartsWith(r, StringComparison.Ordinal));
        return root is not null && key.Length > root.Length;
    }

    /// <summary>
    /// True when the key came from Quickbase and so can be fetched from the realm host.
    /// False for admin uploads, which exist only in Blob.
    /// </summary>
    public static bool HasQuickbaseOrigin(string? key) =>
        IsValid(key) && AttachmentRoots.Any(r => key!.StartsWith(r, StringComparison.Ordinal));

    /// <summary>
    /// Mints a key for a newly uploaded image: uploads/{scope}/{guid}{ext}.
    ///
    /// The name is generated rather than taken from the upload, because an attacker-supplied
    /// filename is the classic path-traversal and content-sniffing vector, and because two
    /// people uploading "photo.jpg" must not collide. Only the extension is carried over,
    /// and only from a known-safe set.
    /// </summary>
    public static string NewUploadKey(string scope, string? originalFileName)
    {
        var safeScope = new string((scope ?? "").Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        if (safeScope.Length == 0) safeScope = "misc";

        var ext = System.IO.Path.GetExtension(originalFileName ?? "").ToLowerInvariant();
        if (!AllowedUploadExtensions.Contains(ext)) ext = ".bin";

        return $"{UploadRoot}{safeScope}/{Guid.NewGuid():N}{ext}";
    }

    private static readonly string[] AllowedUploadExtensions =
        { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif" };

    /// <summary>
    /// The public /api/img/... path for a key, percent-encoded per segment.
    /// The key is stored decoded, so it cannot go into a URL as-is: attachment names contain
    /// spaces and Cyrillic. ASP.NET decodes route values on the way back in, which returns
    /// exactly this key.
    /// </summary>
    public static string ToPublicPath(string key) =>
        "/api/img/" + string.Join('/', key.Split('/').Select(Uri.EscapeDataString));

    /// <summary>
    /// Rebuilds the absolute Quickbase URL for a key. Uri does the percent-encoding, so the
    /// decoded key round-trips back to the exact URL it came from.
    /// </summary>
    public static Uri? ToQuickbaseUrl(string key, string? realm)
    {
        if (!HasQuickbaseOrigin(key) || string.IsNullOrWhiteSpace(realm)) return null;
        return Uri.TryCreate($"https://{realm.Trim()}/{key}", UriKind.Absolute, out var uri) ? uri : null;
    }

    // A realm is "company.quickbase.com". Accept that exact host, and any *.quickbase.com so
    // attachment URLs served from a sibling host still resolve. Matching on the suffix with a
    // leading dot is what stops "quickbase.com.evil.test" from qualifying.
    private static bool IsQuickbaseHost(string host, string? realm)
    {
        if (string.IsNullOrWhiteSpace(host)) return false;

        if (!string.IsNullOrWhiteSpace(realm) &&
            host.Equals(realm.Trim(), StringComparison.OrdinalIgnoreCase))
            return true;

        return host.EndsWith(".quickbase.com", StringComparison.OrdinalIgnoreCase);
    }
}
