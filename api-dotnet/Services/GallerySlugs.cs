using System;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Models;

namespace Services;

/// <summary>
/// How a gallery item becomes a URL, and how a URL becomes a gallery item again.
///
/// ONE COPY, deliberately. This logic used to live privately inside SitemapController, and
/// the moment a second consumer needed it (the per-product SEO tags) the obvious move was
/// to copy it — which is exactly how the sitemap starts advertising URLs the site does not
/// serve. There is already one unavoidable copy of this rule in JavaScript
/// (`slugify()` / `getItemSlug()` in src/gallery/galleryUtils.js) because the SPA routes on
/// it client-side; a third copy inside the server would be the one nobody remembers.
///
/// SLUG-PARITY COUPLING: the C# and JS implementations must stay byte-identical. Both do
/// NFKC → lower-case → strip quotes → replace runs of non-alphanumerics with "-" → trim "-".
/// If they drift, sitemap URLs stop matching what the router accepts and every product page
/// 404s. Covered by GallerySlugTests.
///
/// NFKC, NOT NFKD — changed 2026-08-17, and the difference is not cosmetic. NFKD DECOMPOSES
/// an accented character into a base letter plus a combining mark, and a combining mark is
/// not \p{L} or \p{N}, so the next step turned it into a HYPHEN. Bulgarian "й" became "и-"
/// and every Greek accent became "-", splitting words down the middle:
///
///     Контейнерна къща     ->  контеи-нерна-къща         (keyword broken)
///     Σπίτι τύπου Container ->  σπι-τι-τυ-που-container   (every word split)
///
/// NFKC composes instead, so those stay single letters. It still applies the same
/// COMPATIBILITY folding NFKD did — "m²" becomes "m2" — which is load-bearing: every
/// "…-37-m2" slug depends on it and none of them changed.
///
/// The old algorithm is kept as <see cref="LegacySlugify"/> so URLs minted under it still
/// resolve, with a 301 to the corrected form. See GallerySeoService.TryResolveLegacyAsync.
/// </summary>
public static class GallerySlugs
{
    public const string SiteUrl = "https://nvc-home4you.eu";

    /// <summary>
    /// Locale → gallery base path. Must match the routes registered in src/App.jsx and the
    /// galleryPrefixes list in Program.cs.
    /// </summary>
    public static readonly (string Locale, string Prefix)[] Locales =
    {
        ("en", "/en/gallery/"),
        ("bg", "/bg/galeriq/"),
        ("el", "/el/gkaleri/"),
    };

    /// <summary>The absolute URL of one item in one locale.</summary>
    public static string UrlFor(GalleryItem item, string locale)
    {
        var prefix = Array.Find(Locales, l => l.Locale == locale).Prefix ?? "/en/gallery/";
        return SiteUrl + prefix + Uri.EscapeDataString(SlugFor(item, locale));
    }

    /// <summary>
    /// Splits a request path into its locale and slug, or returns false if it is not a
    /// gallery detail path at all.
    ///
    /// The slug is URL-DECODED here. Bulgarian and Greek titles slugify to Cyrillic and
    /// Greek text, which arrives percent-encoded; comparing the encoded form against a
    /// freshly-slugified title would never match.
    /// </summary>
    public static bool TryParsePath(string? path, out string locale, out string slug)
    {
        locale = "";
        slug = "";
        if (string.IsNullOrWhiteSpace(path)) return false;

        foreach (var (loc, prefix) in Locales)
        {
            if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;

            var raw = path[prefix.Length..].Trim('/');
            if (raw.Length == 0) return false;

            // A slash after the slug means a deeper path we do not serve; treat it as no
            // match rather than silently ignoring the tail.
            if (raw.Contains('/')) return false;

            locale = loc;
            slug = Uri.UnescapeDataString(raw);
            return true;
        }

        return false;
    }

    /// <summary>The localized title an item is addressed by, falling back to English.</summary>
    public static string TitleFor(GalleryItem item, string locale)
    {
        var title = locale switch
        {
            "bg" => !string.IsNullOrWhiteSpace(item.TitleBg) ? item.TitleBg : item.Title,
            "el" => !string.IsNullOrWhiteSpace(item.TitleEl) ? item.TitleEl : item.Title,
            _ => item.Title,
        };

        return string.IsNullOrWhiteSpace(title)
            ? item.Id.ToString(CultureInfo.InvariantCulture)
            : title;
    }

    /// <summary>The localized description, falling back to English.</summary>
    public static string DescriptionFor(GalleryItem item, string locale) => locale switch
    {
        "bg" => !string.IsNullOrWhiteSpace(item.DescriptionBg) ? item.DescriptionBg! : item.Description,
        "el" => !string.IsNullOrWhiteSpace(item.DescriptionEl) ? item.DescriptionEl! : item.Description,
        _ => item.Description,
    };

    public static string SlugFor(GalleryItem item, string locale) => Slugify(TitleFor(item, locale));

    /// <summary>The slug this item had under the pre-2026-08-17 algorithm.</summary>
    public static string LegacySlugFor(GalleryItem item, string locale) =>
        LegacySlugify(TitleFor(item, locale));

    /// <summary>The site-relative path of one item in one locale.</summary>
    public static string PathFor(GalleryItem item, string locale)
    {
        var prefix = Array.Find(Locales, l => l.Locale == locale).Prefix ?? "/en/gallery/";
        return prefix + Uri.EscapeDataString(SlugFor(item, locale));
    }

    /// <summary>
    /// Mirrors slugify() in src/gallery/galleryUtils.js — keep the two in sync.
    /// </summary>
    public static string Slugify(string? value) => Build(value, NormalizationForm.FormKC);

    /// <summary>
    /// The algorithm as it stood before 2026-08-17, kept ONLY so URLs already in the wild
    /// still resolve — see the NFKC note on this class. Nothing should mint slugs with it.
    ///
    /// It has no JS counterpart on purpose. Redirecting a stale URL happens server-side,
    /// before the SPA boots, and the SPA only ever builds links from current slugs — so a
    /// second copy in the browser would be dead code that still had to be kept in parity.
    /// </summary>
    public static string LegacySlugify(string? value) => Build(value, NormalizationForm.FormKD);

    private static string Build(string? value, NormalizationForm form)
    {
        if (string.IsNullOrWhiteSpace(value)) return "model";

        var s = value.Normalize(form).ToLowerInvariant();
        s = Regex.Replace(s, "[’'\"“”]", "");
        s = Regex.Replace(s, @"[^\p{L}\p{N}]+", "-");
        s = s.Trim('-');

        return string.IsNullOrEmpty(s) ? "model" : s;
    }
}
