using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The product SEO tags and sitemap-gallery.xml must read the SAME gallery store as
// /api/gallery — IGalleryStore, which DATA_SOURCE_GALLERY points at SQL in production.
//
// THE BUG (found live 2026-10-02): GallerySeoService and SitemapController took the concrete
// Quickbase GalleryService. Production served the SPA from SQL, so:
//   - /en/gallery/space-house (a house that exists only in SQL) answered 404 + noindex;
//   - /en/gallery/panoramic-box-house-37-m2, the corrected title the SPA links to, 404'd
//     while the old 'panaromic' misspelling Quickbase still holds answered 200;
//   - the sitemap submitted Quickbase's 14 items, not SQL's 15.
// A human never saw any of it — the SPA rendered the right page under the 404 — which is
// why it took a crawler's-eye probe to find.
//
// The consumers are built here the way the app builds them: from a container. It holds
// ONLY IGalleryStore, so a consumer that names a concrete store cannot be constructed, and
// the failure says which one.
public class GalleryStoreWiringTests
{
    // Titles verbatim from the live SQL catalogue (/api/gallery, 2026-10-02).
    private static readonly GalleryItem SpaceHouse = new()
    {
        Id = 15,
        Title = "Space house",
        TitleBg = "Космическа къща - капсула",
        TitleEl = "Φουτουριστική κατοικία-κάψουλα",
        Description = "<p>A capsule house.</p>",
        CoverUrl = "/api/img/houses/space.webp",
    };

    private static readonly GalleryItem PanoramicBox = new()
    {
        Id = 16,
        Title = "Panoramic Box House – 37 m²",
        TitleBg = "Панорамна Бокс къща – 37 м²",
        TitleEl = "Πανοραμικό Box House – 37 m²",
    };

    private static readonly GalleryItem Expandable58 = new()
    {
        Id = 4,
        // A plain Latin "a" here; Quickbase still holds a Cyrillic "а" in "and а double".
        Title = "Expandable house - 58m² with balcony and a double roof",
        TitleBg = "Разгъваема Къща - 58m² с веранда и двоен покрив",
        TitleEl = "Αναπτυσσόμενη κατοικία – 58 m² με μπαλκόνι και διπλή στέγη",
    };

    private sealed class FakeStore : IGalleryStore
    {
        private readonly IReadOnlyList<GalleryItem> _items;
        public FakeStore(params GalleryItem[] items) => _items = items;

        public Task<IReadOnlyList<GalleryItem>> GetAsync(CancellationToken ct = default) =>
            Task.FromResult(_items);
    }

    private static ServiceProvider Container(IGalleryStore store)
    {
        var services = new ServiceCollection();
        services.AddSingleton(store);
        services.AddScoped<GallerySeoService>();
        services.AddTransient<SitemapController>();

        // ValidateOnBuild: a consumer asking for GalleryService fails right here, with
        // "Unable to resolve service for type 'Services.GalleryService' while attempting to
        // activate …" — the clearest statement of the bug there is.
        return services.BuildServiceProvider(
            new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
    }

    private static GallerySeoService Seo(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<GallerySeoService>();

    private static string Bg(string slug) => "/bg/galeriq/" + Uri.EscapeDataString(slug);

    // --- The guard against a third consumer -------------------------------------------

    [Fact]
    public void Only_the_importer_names_a_concrete_gallery_store()
    {
        // GalleryImportService copies Quickbase INTO SQL, so reading Quickbase by name is
        // its job. Anything else that serves the public site must take IGalleryStore, or
        // it silently answers from a different catalogue than /api/gallery does.
        var concrete = new[] { typeof(GalleryService), typeof(SqlGalleryService) };

        var naming = typeof(GallerySeoService).Assembly.GetTypes()
            .Where(t => t.GetConstructors().Any(
                c => c.GetParameters().Any(p => concrete.Contains(p.ParameterType))))
            .Select(t => t.FullName)
            .OrderBy(n => n)
            .ToList();

        Assert.Equal(new[] { typeof(GalleryImportService).FullName }, naming);
    }

    [Fact]
    public void Both_consumers_can_be_built_from_IGalleryStore_alone()
    {
        using var sp = Container(new FakeStore());
        using var scope = sp.CreateScope();

        Assert.NotNull(scope.ServiceProvider.GetRequiredService<GallerySeoService>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<SitemapController>());
    }

    // --- Product pages ------------------------------------------------------------------

    [Theory]
    [InlineData("/en/gallery/space-house")]
    [InlineData("/en/gallery/panoramic-box-house-37-m2")]
    [InlineData("/en/gallery/expandable-house-58m2-with-balcony-and-a-double-roof")]
    [InlineData("/el/gkaleri/φουτουριστική-κατοικία-κάψουλα")]
    public async Task A_product_the_store_holds_resolves(string path)
    {
        using var sp = Container(new FakeStore(SpaceHouse, PanoramicBox, Expandable58));
        using var scope = sp.CreateScope();

        var (outcome, tags) = await Seo(scope).TryBuildAsync(path, CancellationToken.None);

        Assert.Equal(GallerySeoService.Outcome.Resolved, outcome);
        Assert.Contains("index,follow", tags);
    }

    [Fact]
    public async Task The_bulgarian_space_house_url_resolves_as_it_arrives_percent_encoded()
    {
        // One of the two URLs found 404ing live.
        using var sp = Container(new FakeStore(SpaceHouse));
        using var scope = sp.CreateScope();

        var (outcome, _) = await Seo(scope).TryBuildAsync(
            Bg("космическа-къща-капсула"), CancellationToken.None);

        Assert.Equal(GallerySeoService.Outcome.Resolved, outcome);
    }

    [Fact]
    public async Task A_resolved_page_canonicals_to_itself()
    {
        using var sp = Container(new FakeStore(SpaceHouse));
        using var scope = sp.CreateScope();

        var (_, tags) = await Seo(scope).TryBuildAsync("/en/gallery/space-house", CancellationToken.None);

        Assert.Contains(
            "<link rel=\"canonical\" href=\"https://nvc-home4you.eu/en/gallery/space-house\" />", tags);
    }

    [Fact]
    public async Task A_title_the_store_no_longer_holds_is_not_served_as_a_page()
    {
        // The store is the authority: 'panaromic' survives only in Quickbase, so once these
        // read the same store as the SPA it is not a product page. It answered 200 live
        // until this fix while the SPA under it said "Model not found". It now 301s to the
        // corrected page instead (GallerySlugs.RetiredSlugs — GalleryRetiredSlugTests).
        using var sp = Container(new FakeStore(SpaceHouse, PanoramicBox, Expandable58));
        using var scope = sp.CreateScope();
        var seo = Seo(scope);

        const string stale = "/en/gallery/panaromic-box-house-37-m2";
        var (outcome, _) = await seo.TryBuildAsync(stale, CancellationToken.None);

        Assert.Equal(GallerySeoService.Outcome.ProductNotFound, outcome);
        Assert.Equal(
            "/en/gallery/panoramic-box-house-37-m2",
            await seo.TryResolveLegacyAsync(stale, CancellationToken.None));
    }

    // --- Sitemap ------------------------------------------------------------------------

    private static async Task<(string Xml, HttpResponse Response)> Sitemap(params GalleryItem[] items)
    {
        using var sp = Container(new FakeStore(items));
        using var scope = sp.CreateScope();

        var controller = scope.ServiceProvider.GetRequiredService<SitemapController>();
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = Assert.IsType<ContentResult>(await controller.GallerySitemap(CancellationToken.None));
        return (result.Content!, controller.Response);
    }

    [Fact]
    public async Task The_sitemap_lists_every_item_the_store_holds_in_every_locale()
    {
        var (xml, _) = await Sitemap(SpaceHouse, PanoramicBox, Expandable58);

        Assert.Equal(3 * GallerySlugs.Locales.Length, Regex.Matches(xml, "<loc>").Count);

        Assert.Contains("<loc>https://nvc-home4you.eu/en/gallery/space-house</loc>", xml);
        Assert.Contains($"<loc>https://nvc-home4you.eu{Bg("космическа-къща-капсула")}</loc>", xml);
        Assert.Contains("<loc>https://nvc-home4you.eu/en/gallery/panoramic-box-house-37-m2</loc>", xml);
        Assert.Contains(
            "<loc>https://nvc-home4you.eu/en/gallery/expandable-house-58m2-with-balcony-and-a-double-roof</loc>", xml);
        Assert.DoesNotContain("panaromic", xml);
    }

    [Fact]
    public async Task The_sitemap_keeps_its_shared_cache_window()
    {
        var (_, response) = await Sitemap(SpaceHouse);

        Assert.Equal("public, max-age=600", response.Headers.CacheControl.ToString());
    }
}
