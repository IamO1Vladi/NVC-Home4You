using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

/// <summary>
/// Emits a sitemap of the dynamic gallery product pages (one entry per locale, with
/// reciprocal hreflang alternates). The static pages live in /sitemap.xml; this
/// covers the long-tail product URLs that are generated client-side from the gallery.
/// </summary>
[ApiController]
public class SitemapController : ControllerBase
{
    // Locales, slugs and item URLs all come from GallerySlugs, which is also what the
    // request-time SEO tags use. They were separate copies until the second consumer
    // appeared; a sitemap that slugifies differently from the page it points at advertises
    // URLs the site answers with a 404.
    private static readonly (string Locale, string Prefix)[] Locales = GallerySlugs.Locales;

    // IGalleryStore, not GalleryService — for the same reason as GalleryController: which
    // store answers is decided per request by DATA_SOURCE_GALLERY. Naming the Quickbase
    // class submitted Quickbase's catalogue while production served SQL's, so the sitemap
    // missed SQL-only houses and kept advertising titles already corrected in SQL.
    private readonly IGalleryStore _svc;
    public SitemapController(IGalleryStore svc) { _svc = svc; }

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
            var urls = Locales.ToDictionary(l => l.Locale, l => GallerySlugs.UrlFor(item, l.Locale));

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

}
