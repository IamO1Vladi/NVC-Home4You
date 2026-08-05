using Data.Entities;
using Xunit;

namespace ApiDotnet.Tests;

// Categories are the one field where a wrong value is invisible. The gallery filter matches
// on the category string, so a house with an unrecognised one disappears from every filter
// on the page and nothing reports it. Quickbase enforced the set with a multiple-choice
// field; SQL does not, so these pin the mapping the importer and admin panel rely on.
public class CategoryMappingTests
{
    [Theory]
    [InlineData("Сглобяема къща", "prefab")]
    [InlineData("Фургон", "wagon")]
    [InlineData("Модулна къща", "modular")]
    [InlineData("Гараж", "garage")]
    public void The_bulgarian_labels_quickbase_stores_map_to_stable_keys(string label, string expected)
    {
        Assert.Equal(expected, HouseCategories.FromQuickbaseLabel(label));
    }

    [Theory]
    [InlineData("Prefab house", "prefab")]
    [InlineData("Wagon / site cabin", "wagon")]
    public void The_english_labels_map_too(string label, string expected)
    {
        // galleryUtils.js accepts either language, so the live data may hold either.
        Assert.Equal(expected, HouseCategories.FromQuickbaseLabel(label));
    }

    [Fact]
    public void A_value_that_is_already_a_key_passes_through()
    {
        // Makes the import idempotent: re-running it over already-migrated rows is a no-op.
        Assert.Equal("prefab", HouseCategories.FromQuickbaseLabel("prefab"));
    }

    [Fact]
    public void Whitespace_and_casing_do_not_break_the_mapping()
    {
        Assert.Equal("garage", HouseCategories.FromQuickbaseLabel("  Гараж  "));
        Assert.Equal("prefab", HouseCategories.FromQuickbaseLabel("prefab house"));
    }

    [Theory]
    [InlineData("Something else")]
    [InlineData("")]
    [InlineData(null)]
    public void An_unrecognised_category_returns_null_rather_than_a_guess(string? raw)
    {
        // Deliberately not defaulting to a plausible category: filing a house under the wrong
        // one looks exactly like filing it under the right one until a customer cannot find it.
        Assert.Null(HouseCategories.FromQuickbaseLabel(raw));
    }

    [Fact]
    public void Only_the_four_filter_ids_are_valid()
    {
        Assert.Equal(new[] { "prefab", "wagon", "modular", "garage" }, HouseCategories.All);
        Assert.False(HouseCategories.IsValid("house"));
    }

    [Fact]
    public void The_legacy_camelcase_case_category_is_normalised()
    {
        // "modularBuilds" exists in the live table alongside "Modular builds" and the two
        // group separately on the page today.
        Assert.Equal(CaseCategories.ModularBuilds, CaseCategories.Normalize("modularBuilds"));
        Assert.Equal(CaseCategories.ModularBuilds, CaseCategories.Normalize("Modular builds"));
    }

    [Fact]
    public void An_unknown_case_category_is_kept_not_dropped()
    {
        // Unlike the gallery, an odd case category degrades to "ungrouped" rather than making
        // the row unreachable — so keeping it beats losing it.
        Assert.Equal("Bespoke", CaseCategories.Normalize("  Bespoke  "));
        Assert.Null(CaseCategories.Normalize("   "));
    }

    [Fact]
    public void Known_case_categories_are_returned_in_canonical_casing()
    {
        Assert.Equal(CaseCategories.SteelHouses, CaseCategories.Normalize("steel houses"));
        Assert.True(CaseCategories.IsKnown("Interiors"));
    }
}
