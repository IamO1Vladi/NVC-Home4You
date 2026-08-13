using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Controllers;
using Data.Entities;
using Microsoft.AspNetCore.Http;
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

    private static List<string> ValidateAttachments(params IFormFile[] files) =>
        (List<string>)typeof(AdminPipelineController)
            .GetMethod("ValidateAttachments", BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, new object[] { files })!;

    // Only the name and the length are read, so there is no need to hold real bytes —
    // and a test that allocated 3 MB per case to prove a size rule would be its own
    // small problem.
    private static IFormFile File(string fileName, long bytes) =>
        new FormFile(System.IO.Stream.Null, 0, bytes, "files", fileName);

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

    // --- Files sent out with a reply --------------------------------------------------
    //
    // Checked before the send rather than after, because a rejection from Graph mid-send
    // takes the reply someone typed with it — there is no draft left to go back to.

    [Fact]
    public void A_quote_pdf_attaches_without_complaint()
    {
        Assert.Empty(ValidateAttachments(File("oferta.pdf", 400 * 1024)));
    }

    [Fact]
    public void An_executable_is_refused_however_it_is_labelled()
    {
        // Allow-list, not a block-list, and the browser's content type is never consulted.
        var errors = ValidateAttachments(File("invoice.pdf.exe", 1024));

        Assert.Contains(errors, e => e.Contains(".exe", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void A_file_too_big_to_email_is_refused_with_somewhere_else_to_put_it()
    {
        var errors = ValidateAttachments(File("plans.dwg", LeadFileStore.MaxEmailBytes + 1));

        Assert.Contains(errors, e => e.Contains("MB", StringComparison.Ordinal));
        // The answer has to say what to do instead, or it is just a wall.
        Assert.Contains(errors, e => e.Contains("note", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Several_legal_files_that_together_are_not_are_refused()
    {
        // Each of these passes on its own, and the message they would ride on bounces.
        var half = LeadFileStore.MaxEmailBytes / 2;
        var errors = ValidateAttachments(
            File("a.pdf", half), File("b.pdf", half), File("c.pdf", half));

        Assert.Contains(errors, e => e.Contains("MB", StringComparison.Ordinal));
    }

    [Fact]
    public void A_reply_with_no_files_at_all_is_fine()
    {
        // The common case: most replies are words.
        Assert.Empty(ValidateAttachments());
    }
}
