using System.Linq;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Per-product SEO tags, and the slug rules underneath them.
//
// The bug these exist to prevent was silent and total: every gallery product page served
// the default shell, whose canonical is the HOMEPAGE. Forty-two URLs submitted in
// sitemap-gallery.xml were each telling Google "I am a duplicate of /" — while looking
// completely healthy in a browser, because the SPA renders the right page for a human.
public class GallerySeoTests
{
    private static GalleryItem Item(
        long id = 3,
        string title = "Container House – 6000mm*3000mm",
        string? titleBg = "Жилищен фургон - 6000мм*3000мм",
        string? titleEl = "Σπίτι Container 6000 mm 3000 mm",
        string description = "<p>A <b>compact</b> container house.</p>",
        string? cover = "/api/img/houses/3.webp") => new()
        {
            Id = id,
            Title = title,
            TitleBg = titleBg,
            TitleEl = titleEl,
            Description = description,
            CoverUrl = cover,
        };

    // --- Path parsing -------------------------------------------------------------------

    [Theory]
    [InlineData("/en/gallery/container-house-6000mm-3000mm", "en", "container-house-6000mm-3000mm")]
    [InlineData("/bg/galeriq/nqkakyv-slug", "bg", "nqkakyv-slug")]
    [InlineData("/el/gkaleri/kati", "el", "kati")]
    [InlineData("/en/gallery/trailing-slash/", "en", "trailing-slash")]
    public void A_product_path_yields_its_locale_and_slug(string path, string locale, string slug)
    {
        Assert.True(GallerySlugs.TryParsePath(path, out var gotLocale, out var gotSlug));
        Assert.Equal(locale, gotLocale);
        Assert.Equal(slug, gotSlug);
    }

    [Theory]
    [InlineData("/en/gallery")]          // the index, not a product
    [InlineData("/en/gallery/")]         // index with a slash
    [InlineData("/bg/modulni-kysthi")]   // an ordinary page
    [InlineData("/en/gallery/a/b")]      // deeper than we serve
    [InlineData("/")]
    [InlineData("")]
    public void Anything_else_is_not_a_product_path(string path)
    {
        Assert.False(GallerySlugs.TryParsePath(path, out _, out _));
    }

    [Fact]
    public void A_cyrillic_slug_survives_the_round_trip()
    {
        // Bulgarian titles slugify to Cyrillic, so the request arrives percent-encoded.
        // Comparing the encoded form against a freshly-slugified title never matches, which
        // would 404 every Bulgarian product page.
        var item = Item();
        var url = GallerySlugs.UrlFor(item, "bg");
        var path = url.Replace(GallerySlugs.SiteUrl, "");

        Assert.True(GallerySlugs.TryParsePath(path, out var locale, out var slug));
        Assert.Equal("bg", locale);
        Assert.Equal(GallerySlugs.SlugFor(item, "bg"), slug);
    }

    // --- Slug parity --------------------------------------------------------------------

    [Theory]
    [InlineData("Container House – 6000mm*3000mm", "container-house-6000mm-3000mm")]
    [InlineData("  Spaced   Out  ", "spaced-out")]
    [InlineData("Nova 60", "nova-60")]
    [InlineData("", "model")]
    [InlineData("!!!", "model")]
    public void Slugify_matches_the_javascript_rule(string input, string expected)
    {
        // Mirrors slugify() in src/gallery/galleryUtils.js. If these drift, the sitemap
        // advertises URLs the router will not accept.
        Assert.Equal(expected, GallerySlugs.Slugify(input));
    }

    [Fact]
    public void Quotes_are_stripped_rather_than_becoming_separators()
    {
        Assert.Equal("johns-cabin", GallerySlugs.Slugify("John’s Cabin"));
    }

    // --- NFKC: accented letters stay letters --------------------------------------------
    //
    // The bug this replaced: NFKD decomposed an accented character into a base letter plus a
    // combining mark, and the non-alphanumeric pass turned that mark into a hyphen — so the
    // keyword was split down the middle in every Bulgarian and Greek slug.

    [Theory]
    // Bulgarian "й" is a letter in its own right, not an accent to be folded away.
    [InlineData("Контейнерна къща", "контейнерна-къща")]
    [InlineData("Панорамен офис контейнер", "панорамен-офис-контейнер")]
    // Greek accents, which hit 12 of the 14 Greek product URLs.
    [InlineData("Σπίτι τύπου Container", "σπίτι-τύπου-container")]
    [InlineData("Αναπτυσσόμενη κατοικία", "αναπτυσσόμενη-κατοικία")]
    [InlineData("Διώροφη κατοικία", "διώροφη-κατοικία")]
    public void An_accented_letter_does_not_become_a_hyphen(string input, string expected)
    {
        Assert.Equal(expected, GallerySlugs.Slugify(input));
    }

    [Theory]
    [InlineData("Контейнерна къща", "контеи-нерна-къща")]
    [InlineData("Σπίτι τύπου Container", "σπι-τι-τυ-που-container")]
    public void The_legacy_algorithm_still_reproduces_the_old_broken_slug(string input, string expected)
    {
        // Not nostalgia: this is what a stale URL is matched against so it can be redirected
        // instead of 404ing. If this drifts, every gallery link ever shared breaks.
        Assert.Equal(expected, GallerySlugs.LegacySlugify(input));
    }

    [Theory]
    // The compatibility folding NFKD did is the part NFKC KEEPS, and every "…-37-m2" slug
    // depends on it. If these changed, 26 correct URLs would have needed redirects too.
    [InlineData("Expandable House – 37 m²", "expandable-house-37-m2")]
    [InlineData("Container House – 6000mm*3000mm", "container-house-6000mm-3000mm")]
    [InlineData("Two-storey expandable house - 74m²", "two-storey-expandable-house-74m2")]
    [InlineData("Жилищен фургон 6000мм 3000мм", "жилищен-фургон-6000мм-3000мм")]
    public void Slugs_with_no_accents_are_unchanged_by_the_switch(string input, string expected)
    {
        Assert.Equal(expected, GallerySlugs.Slugify(input));
        // The whole point: identical under both, so these URLs did not move.
        Assert.Equal(GallerySlugs.LegacySlugify(input), GallerySlugs.Slugify(input));
    }

    [Fact]
    public void A_corrected_slug_differs_from_its_legacy_form()
    {
        // Guards the assumption the redirect rests on. If these ever matched, the lookup
        // would resolve on the current algorithm and the redirect would never be reached.
        Assert.NotEqual(
            GallerySlugs.LegacySlugify("Контейнерна къща"),
            GallerySlugs.Slugify("Контейнерна къща"));
    }

    [Fact]
    public void PathFor_is_relative_and_locale_prefixed()
    {
        var item = new GalleryItem { Id = 5, Title = "Expandable House – 37 m²" };

        // Relative, not absolute: a redirect has to work on localhost and on the live host,
        // and hard-coding the site URL would send a developer to production mid-test.
        Assert.Equal("/en/gallery/expandable-house-37-m2", GallerySlugs.PathFor(item, "en"));
        Assert.StartsWith("/bg/galeriq/", GallerySlugs.PathFor(item, "bg"));
    }

    [Fact]
    public void An_item_with_no_title_falls_back_to_its_id()
    {
        var item = Item(id: 77, title: "", titleBg: null, titleEl: null);
        Assert.Equal("77", GallerySlugs.TitleFor(item, "en"));
    }

    [Fact]
    public void A_missing_translation_falls_back_to_english()
    {
        var item = Item(titleBg: null, titleEl: null);
        Assert.Equal(item.Title, GallerySlugs.TitleFor(item, "bg"));
        Assert.Equal(item.Title, GallerySlugs.TitleFor(item, "el"));
    }

    // --- URLs ---------------------------------------------------------------------------

    [Fact]
    public void Each_locale_addresses_the_item_by_its_own_title()
    {
        var item = Item();

        Assert.Equal(
            "https://nvc-home4you.eu/en/gallery/container-house-6000mm-3000mm",
            GallerySlugs.UrlFor(item, "en"));

        // Different slug per locale — which is exactly why hreflang has to be emitted
        // per item rather than by swapping a path prefix.
        Assert.Contains("/bg/galeriq/", GallerySlugs.UrlFor(item, "bg"));
        Assert.NotEqual(GallerySlugs.UrlFor(item, "en"), GallerySlugs.UrlFor(item, "bg"));
    }

    // --- Description snippets -----------------------------------------------------------

    [Fact]
    public void A_description_snippet_carries_no_markup()
    {
        // Descriptions are rich text. A meta description full of <p> renders as literal
        // angle brackets in a search result.
        var text = GallerySeoService.Snippet("<p>A <b>compact</b> container house.</p>", 155);
        Assert.Equal("A compact container house.", text);
    }

    [Fact]
    public void Html_entities_are_decoded()
    {
        Assert.Equal("Steel & timber", GallerySeoService.Snippet("Steel &amp; timber", 155));
    }

    [Fact]
    public void A_long_description_is_cut_on_a_word_boundary()
    {
        var long_ = string.Join(" ", Enumerable.Repeat("word", 100));
        var text = GallerySeoService.Snippet(long_, 60);

        Assert.True(text.Length <= 61, $"got {text.Length}: {text}");
        Assert.EndsWith("…", text);
        Assert.DoesNotContain("wor…", text);   // never mid-word
    }

    [Fact]
    public void An_empty_description_is_empty_rather_than_an_ellipsis()
    {
        Assert.Equal("", GallerySeoService.Snippet(null, 155));
        Assert.Equal("", GallerySeoService.Snippet("   ", 155));
    }
}
