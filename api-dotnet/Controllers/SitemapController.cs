using System;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

/// <summary>
/// Emits a sitemap of the dynamic gallery product pages (one entry per locale, with
/// reciprocal hreflang alternates). The static pages live in /sitemap.xml; this
/// covers the long-tail product URLs that are generated client-side from Quickbase.
/// </summary>
[ApiController]
public class SitemapController : ControllerBase
{
    private const string SiteUrl = "https://nvc-home4you.eu";

    // Locale -> gallery base path. Must match the routes registered in src/App.jsx.
    private static readonly (string Locale, string Prefix)[] Locales =
    {
        ("en", "/en/gallery/"),
        ("bg", "/bg/galeriq/"),
        ("el", "/el/gkaleri/"),
    };

    private readonly GalleryService _svc;
    public SitemapController(GalleryService svc) { _svc = svc; }

    [HttpGet("/sitemap-gallery.xml")]
    public async Task<IActionResult> GallerySitemap(CancellationToken ct)
    {
        var items = await _svc.GetAsync(ct);

        var sb = new StringBuilder();
        sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.Append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" ");
        sb.Append("xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">");

        foreach (var item in items)
        {
            // Per-locale absolute URL for this item.
            var urls = Locales.ToDictionary(
                l => l.Locale,
                l => SiteUrl + l.Prefix + Uri.EscapeDataString(SlugFor(item, l.Locale)));

            foreach (var (locale, _) in Locales)
            {
                sb.Append("<url>");
                sb.Append("<loc>").Append(urls[locale]).Append("</loc>");
                foreach (var (alt, _) in Locales)
                {
                    sb.Append("<xhtml:link rel=\"alternate\" hreflang=\"").Append(alt)
                      .Append("\" href=\"").Append(urls[alt]).Append("\"/>");
                }
                sb.Append("<xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"")
                  .Append(urls["en"]).Append("\"/>");
                sb.Append("</url>");
            }
        }

        sb.Append("</urlset>");

        Response.Headers["Cache-Control"] = "public, max-age=600";
        return Content(sb.ToString(), "application/xml", Encoding.UTF8);
    }

    private static string SlugFor(GalleryItem item, string locale)
    {
        var title = locale switch
        {
            "bg" => !string.IsNullOrWhiteSpace(item.TitleBg) ? item.TitleBg : item.Title,
            "el" => !string.IsNullOrWhiteSpace(item.TitleEl) ? item.TitleEl : item.Title,
            _ => item.Title,
        };
        if (string.IsNullOrWhiteSpace(title))
            title = item.Id.ToString(CultureInfo.InvariantCulture);
        return Slugify(title);
    }

    // Mirrors slugify() / getItemSlug() in src/gallery/galleryUtils.js — keep the two in sync.
    private static string Slugify(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "model";
        var s = value.Normalize(NormalizationForm.FormKD).ToLowerInvariant();
        s = Regex.Replace(s, "[’'\"“”]", "");
        s = Regex.Replace(s, @"[^\p{L}\p{N}]+", "-");
        s = s.Trim('-');
        return string.IsNullOrEmpty(s) ? "model" : s;
    }
}
