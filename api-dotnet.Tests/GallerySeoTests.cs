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
