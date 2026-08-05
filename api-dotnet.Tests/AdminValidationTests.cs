using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Controllers;
using Data.Entities;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Mandatory-field rules for the admin panel.
//
// The schema already refuses bad data, but a constraint violation surfaces as a 500 with
// nothing an editor can act on. These turn it into a message. The category rule is the one
// that matters most: an unrecognised value makes a house vanish from every gallery filter
// with no error anywhere, so it is refused before it can be stored.
public class AdminValidationTests
{
    private static List<string> ValidateHouse(HouseInput input) =>
        (List<string>)typeof(AdminGalleryController)
            .GetMethod("Validate", BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, new object[] { input })!;

    private static List<string> ValidateCase(CaseInput input) =>
        (List<string>)typeof(AdminCasesController)
            .GetMethod("Validate", BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, new object[] { input })!;

    private static HouseInput ValidHouse() => new()
    {
        Title = "Box House",
        CategoryKey = HouseCategories.Modular,
        Price = 24990m,
    };

    [Fact]
    public void A_complete_house_passes()
    {
        Assert.Empty(ValidateHouse(ValidHouse()));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Title_is_required(string? title)
    {
        var input = ValidHouse();
        input.Title = title!;

        Assert.Contains(ValidateHouse(input), e => e.Contains("Title", StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Category_is_required(string? category)
    {
        var input = ValidHouse();
        input.CategoryKey = category!;

        Assert.Contains(ValidateHouse(input), e => e.Contains("Category", StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData("house")]
    [InlineData("Сглобяема къща")]   // the display label, not the key
    [InlineData("PREFAB")]
    public void An_unrecognised_category_is_refused(string category)
    {
        // Including the Bulgarian label: it is what Quickbase stored, so it is the mistake
        // most likely to be made, and it would silently unfilter the house.
        var input = ValidHouse();
        input.CategoryKey = category;

        var errors = ValidateHouse(input);
        Assert.NotEmpty(errors);
        Assert.Contains(errors, e => e.Contains("Category", StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData("prefab")]
    [InlineData("wagon")]
    [InlineData("modular")]
    [InlineData("garage")]
    public void Each_real_category_is_accepted(string category)
    {
        var input = ValidHouse();
        input.CategoryKey = category;

        Assert.Empty(ValidateHouse(input));
    }

    [Fact]
    public void A_negative_price_is_refused()
    {
        var input = ValidHouse();
        input.Price = -1m;

        Assert.Contains(ValidateHouse(input), e => e.Contains("Price", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void A_house_with_no_price_is_allowed()
    {
        // "Price on request" is a real state for a bespoke build.
        var input = ValidHouse();
        input.Price = null;

        Assert.Empty(ValidateHouse(input));
    }

    [Fact]
    public void A_case_needs_someone_to_attribute_it_to()
    {
        // Both empty would publish an anonymous testimonial, which reads as filler.
        var errors = ValidateCase(new CaseInput { CompanyName = "", BuyerName = "" });

        Assert.NotEmpty(errors);
    }

    [Fact]
    public void A_case_with_only_a_buyer_is_valid()
    {
        // Private individuals are a normal case: no company, and the page suppresses the
        // sector, role and logo accordingly.
        Assert.Empty(ValidateCase(new CaseInput { CompanyName = "", BuyerName = "Вангелис" }));
    }

    [Theory]
    [InlineData(-1d)]
    [InlineData(5.5d)]
    public void An_out_of_range_rating_is_refused(double rating)
    {
        var errors = ValidateCase(new CaseInput { CompanyName = "Acme", RatingSnapshot = rating });

        Assert.Contains(errors, e => e.Contains("Rating", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void An_unknown_case_category_is_allowed_through()
    {
        // Unlike the gallery, the cases page groups rather than filters, so an odd value
        // degrades to "ungrouped" instead of hiding the case. Not worth blocking a save over.
        Assert.Empty(ValidateCase(new CaseInput { CompanyName = "Acme", CategoryKey = "Bespoke" }));
    }
}
