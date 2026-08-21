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

    // storedEmail defaults to "nothing there yet", which is the plain case: every rule but
    // one reads only what arrived. The exception has its own tests below.
    private static List<string> ValidateContact(
        AdminPipelineController.FieldsChange body, string? storedEmail = null) =>
        (List<string>)typeof(AdminPipelineController)
            .GetMethod("ValidateContact", BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, new object?[] { body, storedEmail })!;

    // Only the three customer fields matter to that rule, and a positional record cannot be
    // half-constructed — so the ten fields this is not about are named once, here, rather
    // than as ten nulls in front of every case.
    private static AdminPipelineController.FieldsChange Contact(
        string? name = null, string? email = null, string? phone = null) =>
        new(null, null, null, null, null, null, null, null, null, null, name, email, phone);

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

    // --- Correcting who a lead is -------------------------------------------------------
    //
    // The name, the address and the phone number were not editable at all until now, so a
    // customer whose name was mistyped on the enquiry form stayed mistyped in every list
    // forever — the offer behind the lead is an immutable event and cannot be rewritten to
    // fix it. What these pin is the pair of rules that made adding them safe.

    [Fact]
    public void A_lead_may_not_be_left_without_a_name()
    {
        // Refused rather than ignored. The column is NOT NULL and the board is a column of
        // names, so a blank one is a lead nobody can find again — and a save that answers 200
        // while keeping the old name is how somebody walks away believing they renamed it.
        foreach (var blank in new[] { "", "   " })
        {
            Assert.Contains(ValidateContact(Contact(name: blank)), e => e.Contains("keep a name"));
        }
    }

    [Fact]
    public void A_save_that_never_mentions_the_name_is_not_a_blank_one()
    {
        // Absent and empty are different on this endpoint, and this is the difference: null
        // means "this save is not about that box". Collapsing the two would make every note
        // saved from a form without a name field fail on a name nobody touched.
        Assert.Empty(ValidateContact(Contact()));
        Assert.Empty(ValidateContact(Contact(name: "Иван Петров")));
    }

    [Fact]
    public void An_address_that_will_not_send_is_refused_rather_than_stored()
    {
        // A malformed address fails days later, in a reply that never arrived and nobody is
        // waiting to notice. The display-name case is the one a hand-written regex lets
        // through — see EmailService.IsValidAddress for why this is a parser instead.
        foreach (var bad in new[] { "ivan@", "ivan example.com", "Ivan <ivan@example.com>" })
        {
            Assert.Contains(
                ValidateContact(Contact(email: bad)), e => e.Contains("email address"));
        }

        Assert.Empty(ValidateContact(Contact(email: "ivan@example.com")));
    }

    [Fact]
    public void Clearing_an_email_or_a_phone_is_a_legitimate_edit()
    {
        // Plenty of leads arrive by phone with nothing but a number, and plenty the other way
        // round. An empty box means "we do not have one", not "here is a broken one".
        Assert.Empty(ValidateContact(Contact(email: "", phone: "")));
        Assert.Empty(ValidateContact(Contact(email: "   ", phone: "   ")));
    }

    [Fact]
    public void Anything_longer_than_its_column_is_caught_before_the_database_sees_it()
    {
        // The three MaxLengths off the entity. Reaching SQL Server with an overlong string is
        // a 500 with nothing an editor can act on, which is the failure this whole file exists
        // to convert into a sentence.
        Assert.Contains(
            ValidateContact(Contact(name: new string('и', 201))), e => e.Contains("too long"));

        var longLocal = new string('a', 320);
        Assert.Contains(
            ValidateContact(Contact(email: $"{longLocal}@example.com")), e => e.Contains("too long"));

        Assert.Contains(
            ValidateContact(Contact(phone: new string('9', 65))), e => e.Contains("too long"));
    }

    [Fact]
    public void An_address_already_in_the_column_does_not_block_the_rest_of_the_sheet()
    {
        // The rule is about an EDIT to the email box, not about the box being present in the
        // request — and the panel puts it in every request, whether or not anyone opened it.
        //
        // Lead.Email has never been validated on the way in. CrmLeadImportService copies it
        // off the Quickbase field with nothing but a truncation, so the imported book really
        // holds these. Without the comparison, the lead most likely to need a note or a
        // follow-up date is the one lead on which NOTHING can be saved — not the next step,
        // not the notes, not the date — over a field the person never touched, refused by a
        // message that names no field.
        foreach (var stored in new[]
                 {
                     "ivan@abv.bg, maria@abv.bg", "Ivan Petrov <ivan@abv.bg>",
                     "n/a", "няма", "0888123456", "ivan@abv.bg / 0888123456",
                 })
        {
            // Resent untouched, alongside a real edit to another box: no complaint.
            Assert.Empty(ValidateContact(
                Contact(email: stored, phone: "0888 123 456"), storedEmail: stored));

            // And it is genuinely the parser refusing them, not a lenient rule agreeing.
            Assert.Contains(
                ValidateContact(Contact(email: stored), storedEmail: "ivan@example.com"),
                e => e.Contains("email address"));
        }
    }

    [Fact]
    public void Changing_a_bad_address_to_another_bad_one_is_still_refused()
    {
        // The whole rule, not a hole in it: what is grandfathered is the exact value already
        // stored, and only while nobody is trying to change it. Anything else typed into that
        // box is a new address and meets the parser.
        Assert.Contains(
            ValidateContact(Contact(email: "still-not@"), storedEmail: "n/a"),
            e => e.Contains("email address"));

        // Correcting one to a real address is the edit this endpoint exists for.
        Assert.Empty(ValidateContact(Contact(email: "ivan@example.com"), storedEmail: "n/a"));

        // And clearing one always works, which is the other way out of a bad row.
        Assert.Empty(ValidateContact(Contact(email: ""), storedEmail: "n/a"));
    }
}
