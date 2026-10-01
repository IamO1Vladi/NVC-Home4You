using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// 301s for products that were RETITLED (GallerySlugs.RetiredSlugs).
//
// Three English titles were corrected in August 2026 — 'Panaromic', and a Cyrillic "а" in
// "and а double roof" on the 58 m² and 73 m² houses. Their old addresses were in
// sitemap-gallery.xml until 2026-10-02, so they are in Google's index and in shares, and
// the SPA cannot match them to anything: a visitor following one gets "Model not found".
// These pin that each old address now lands on its product instead — and that the list
// can only ever redirect to a page that exists.
public class GalleryRetiredSlugTests
{
    private const char CyrillicA = 'а';

    // Current titles verbatim from the live SQL catalogue (/api/gallery, 2026-10-02).
    private static readonly GalleryItem Panoramic = new()
    {
        Id = 16,
        Title = "Panoramic Box House – 37 m²",
        TitleBg = "Панорамна Бокс къща – 37 м²",
        TitleEl = "Πανοραμικό Box House – 37 m²",
    };

    private static readonly GalleryItem Expandable58 = new()
    {
        Id = 4,
        Title = "Expandable house - 58m² with balcony and a double roof",
        TitleBg = "Разгъваема Къща - 58m² с веранда и двоен покрив",
        TitleEl = "Αναπτυσσόμενη κατοικία – 58 m² με μπαλκόνι και διπλή στέγη",
    };

    private static readonly GalleryItem Expandable73 = new()
    {
        Id = 15,
        Title = "Expandable house - 73m² with balcony and a double roof",
        TitleBg = "Разгъваема Къща - 73m² с веранда и двоен покрив",
        TitleEl = "Αναπτυσσόμενη κατοικία – 73 m² με μπαλκόνι και διπλή στέγη",
    };

    private sealed class FakeStore : IGalleryStore
    {
        private readonly IReadOnlyList<GalleryItem> _items;
        public FakeStore(params GalleryItem[] items) => _items = items;

        public Task<IReadOnlyList<GalleryItem>> GetAsync(CancellationToken ct = default) =>
            Task.FromResult(_items);
    }

    private static GallerySeoService Seo(params GalleryItem[] items) => new(new FakeStore(items));

    private static GallerySeoService Catalogue() => Seo(Panoramic, Expandable58, Expandable73);

    // --- The redirects ------------------------------------------------------------------

    // The old addresses exactly as the sitemap advertised them: percent-encoded.
    public static TheoryData<string, string> Retired => new()
    {
        {
            "/en/gallery/panaromic-box-house-37-m2",
            "/en/gallery/panoramic-box-house-37-m2"
        },
        {
            "/en/gallery/expandable-house-58m2-with-balcony-and-%D0%B0-double-roof",
            "/en/gallery/expandable-house-58m2-with-balcony-and-a-double-roof"
        },
        {
            "/en/gallery/expandable-house-73m2-with-balcony-and-%D0%B0-double-roof",
            "/en/gallery/expandable-house-73m2-with-balcony-and-a-double-roof"
        },
    };

    [Theory]
    [MemberData(nameof(Retired))]
    public async Task A_retired_address_redirects_to_its_corrected_page(string from, string to)
    {
        var seo = Catalogue();

        // Precondition: not a page in its own right — the fallback only asks for a redirect
        // after the live lookup has missed.
        var (outcome, _) = await seo.TryBuildAsync(from, CancellationToken.None);
        Assert.Equal(GallerySeoService.Outcome.ProductNotFound, outcome);

        Assert.Equal(to, await seo.TryResolveLegacyAsync(from, CancellationToken.None));
    }

    [Fact]
    public async Task The_cyrillic_address_also_matches_when_it_arrives_decoded()
    {
        // Request.Path reaches the fallback decoded; the sitemap and shares carry it encoded.
        var decoded = "/en/gallery/expandable-house-58m2-with-balcony-and-" + CyrillicA + "-double-roof";

        Assert.Equal(
            "/en/gallery/expandable-house-58m2-with-balcony-and-a-double-roof",
            await Catalogue().TryResolveLegacyAsync(decoded, CancellationToken.None));
    }

    [Fact]
    public async Task Every_redirect_lands_on_a_page_that_resolves()
    {
        // No redirect to a 404, and no loop. Adding an entry means adding its product's
        // current title to the fixtures above — which is the point: it makes the author
        // check the target against the real catalogue.
        var seo = Catalogue();

        foreach (var (locale, oldSlug, _) in GallerySlugs.RetiredSlugs)
        {
            var prefix = GallerySlugs.Locales.Single(l => l.Locale == locale).Prefix;
            var target = await seo.TryResolveLegacyAsync(
                prefix + Uri.EscapeDataString(oldSlug), CancellationToken.None);

            Assert.NotNull(target);
            var (outcome, _) = await seo.TryBuildAsync(target!, CancellationToken.None);
            Assert.Equal(GallerySeoService.Outcome.Resolved, outcome);
        }
    }

    [Fact]
    public async Task A_retired_address_whose_product_is_gone_is_a_404_not_a_wrong_redirect()
    {
        // The panoramic house unpublished, or retitled again: the entry's target no longer
        // matches anything, so the fallback answers 404 rather than sending the visitor
        // somewhere they did not ask for.
        var seo = Seo(Expandable58, Expandable73);

        Assert.Null(await seo.TryResolveLegacyAsync(
            "/en/gallery/panaromic-box-house-37-m2", CancellationToken.None));
    }

    [Fact]
    public async Task A_product_that_holds_a_retired_slug_again_is_served_not_redirected()
    {
        // Retired entries are only consulted after the live lookup misses, so a title that
        // comes back is a page again rather than being redirected away from.
        var back = new GalleryItem { Id = 99, Title = "Panaromic Box House – 37 m²" };

        var (outcome, _) = await Seo(Panoramic, back).TryBuildAsync(
            "/en/gallery/panaromic-box-house-37-m2", CancellationToken.None);

        Assert.Equal(GallerySeoService.Outcome.Resolved, outcome);
    }

    [Theory]
    [InlineData("/en/gallery/panoramik-box-house-37-m2")]                         // a typo nobody minted
    [InlineData("/en/gallery/expandable-house-58m2-with-balcony-and-double-roof")]
    [InlineData("/en/gallery/expandable-house-37-m2-with-balcony-and-a-double-roof")]
    [InlineData("/bg/galeriq/panaromic-box-house-37-m2")]                         // entries are per locale
    public async Task Nothing_else_is_redirected(string path)
    {
        Assert.Null(await Catalogue().TryResolveLegacyAsync(path, CancellationToken.None));
    }

    // --- The table itself ---------------------------------------------------------------

    [Fact]
    public void The_cyrillic_entries_really_hold_the_cyrillic_letter()
    {
        // Invisible in a diff. An editor "tidying" the а escape into a Latin a would
        // turn both entries into self-redirects that never match, silently.
        Assert.Equal(2, GallerySlugs.RetiredSlugs.Count(r => r.OldSlug.Contains(CyrillicA)));
        Assert.All(GallerySlugs.RetiredSlugs, r => Assert.DoesNotContain(CyrillicA, r.CurrentSlug));
    }

    [Fact]
    public void The_table_has_no_self_redirects_chains_or_duplicates()
    {
        var table = GallerySlugs.RetiredSlugs;

        Assert.All(table, r => Assert.NotEqual(r.OldSlug, r.CurrentSlug, StringComparer.OrdinalIgnoreCase));

        // The lookup follows ONE hop. A target that is itself a retired slug would 404 —
        // retitling again means repointing the older entry, not appending to a chain.
        Assert.All(table, r => Assert.DoesNotContain(table, o =>
            o.Locale == r.Locale && string.Equals(o.OldSlug, r.CurrentSlug, StringComparison.OrdinalIgnoreCase)));

        Assert.Equal(
            table.Length,
            table.Select(r => (r.Locale, r.OldSlug.ToLowerInvariant())).Distinct().Count());
    }

    [Fact]
    public void Every_entry_is_in_a_served_locale_and_targets_a_current_algorithm_slug()
    {
        foreach (var (locale, oldSlug, currentSlug) in GallerySlugs.RetiredSlugs)
        {
            Assert.Contains(GallerySlugs.Locales, l => l.Locale == locale);

            // A target in any other shape can never equal SlugFor(item) and would 404.
            Assert.Equal(currentSlug, GallerySlugs.Slugify(currentSlug));

            // TryParsePath refuses a slug with a slash, so such an entry could never match.
            Assert.DoesNotContain('/', oldSlug);
        }
    }
}
