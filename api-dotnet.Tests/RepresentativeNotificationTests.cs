using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// What the internal new-enquiry mail says, and who gets it, when the enquiry came through a
// representative's link (#38).
//
// The mail is the one place the outcome of the automatic promotion is reported to a person:
// the lead it made, linked into the panel; or why it made none and where the enquiry is
// waiting; and the older open lead that looks like the same customer. Sales and the
// representative read the same message, so the rep has to be on it — once, even when he is
// also on the sales list — and every value in it is HTML-encoded whatever its source.
public class RepresentativeNotificationTests
{
    private const string Site = "https://nvc-home4you.eu";
    private const string Slug = "dtodorov";
    private const string Upn = "dtodorov@nvc-home4you.eu";

    private static EmailService Service()
    {
        var env = new EnvConfig(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>()).Build());
        return new EmailService(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance);
    }

    // BuildLeadNotification is private and has no seam; the same reflection as
    // OfferNotificationModelTests, whose trailing null this is the other half of.
    private static (string Subject, string Html) Render(LeadIntakeNote? intake, OfferModel? model = null, bool isOffer = true)
    {
        var method = typeof(EmailService).GetMethod("BuildLeadNotification",
            BindingFlags.Instance | BindingFlags.NonPublic)!;
        var result = method.Invoke(Service(),
            new object?[] { isOffer, "Ivan", "ivan@example.com", "+359 88 000 0000", "Delivery to Varna?", model, intake })!;

        var type = result.GetType();
        return (
            (string)type.GetField("Item1")!.GetValue(result)!,
            (string)type.GetField("Item2")!.GetValue(result)!);
    }

    private static LeadIntakeNote Note(IntakeOutcome outcome, string slug = Slug, string upn = Upn) =>
        new(slug, upn, outcome, Site);

    private static IntakeOutcome Created(int leadId, int? duplicateOf = null, string? duplicateOwner = null) =>
        new(true, leadId, duplicateOf, duplicateOwner, null);

    // --- Who gets it ----------------------------------------------------------------------

    [Fact]
    public void The_representative_is_added_to_the_sales_list()
    {
        var recipients = EmailService.WithRecipient(new[] { "a@nvc-home4you.eu", "b@nvc-home4you.eu" }, Upn);

        Assert.Equal(new[] { "a@nvc-home4you.eu", "b@nvc-home4you.eu", Upn }, recipients);
    }

    [Fact]
    public void A_salesperson_who_is_also_the_representative_is_not_mailed_twice()
    {
        // Case-insensitively: the two lists are two settings typed by hand, and
        // Arch@ and arch@ are one inbox.
        var recipients = EmailService.WithRecipient(new[] { "a@nvc-home4you.eu", Upn }, "DTodorov@NVC-Home4You.eu");

        Assert.Equal(2, recipients.Count);
        Assert.Contains(Upn, recipients);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-an-address")]
    public void Nobody_to_add_leaves_the_list_as_configured(string? extra)
    {
        var configured = new[] { "a@nvc-home4you.eu" };

        Assert.Same(configured, EmailService.WithRecipient(configured, extra));
    }

    [Fact]
    public void The_merge_reads_the_configured_list_the_way_the_notification_does()
    {
        // End to end through the lax parser the sales list is read with, so the two cannot
        // disagree about what the list contains.
        var recipients = EmailService.WithRecipient(EmailService.ParseRecipients("a@x.com; b@x.com"), " rep@x.com ");

        Assert.Equal(new[] { "a@x.com", "b@x.com", "rep@x.com" }, recipients);
    }

    // --- What it says ---------------------------------------------------------------------

    [Fact]
    public void The_subject_keeps_its_prefix_and_names_the_representative_last()
    {
        // Mail rules in the sales inbox key on the prefix, and the rep's own rule can key on
        // the slug; both have to stay where they are, model or no model.
        var (plain, _) = Render(Note(Created(42)));
        var (withModel, _) = Render(Note(Created(42)), OfferModel.From("15", "Космическа къща", "/bg/galeriq/kashta"));
        var (question, _) = Render(Note(Created(42)), isOffer: false);

        Assert.Equal("Ново запитване за оферта: Ivan — представител: dtodorov", plain);
        Assert.Equal("Ново запитване за оферта: Ivan — Космическа къща — представител: dtodorov", withModel);
        Assert.Equal("Ново въпрос: Ivan — представител: dtodorov", question);
    }

    [Fact]
    public void The_representative_row_sits_under_the_model_and_above_the_details()
    {
        var (_, html) = Render(Note(Created(42)), OfferModel.From("15", "Космическа къща", "/bg/galeriq/kashta"));

        Assert.Contains("<strong>Представител:</strong> dtodorov</p>", html);
        var model = html.IndexOf("Модел:", StringComparison.Ordinal);
        var rep = html.IndexOf("Представител:", StringComparison.Ordinal);
        var details = html.IndexOf("Детайли:", StringComparison.Ordinal);
        Assert.True(model < rep && rep < details, "the representative row has moved");
    }

    [Fact]
    public void A_created_lead_is_linked_into_the_panel_the_way_the_due_report_links_one()
    {
        var (_, html) = Render(Note(Created(42)));

        var href = LeadFollowUpService.LeadUrl(Site, 42);
        Assert.Equal("https://nvc-home4you.eu/admin/pipeline?lead=42", href);
        var repHref = LeadFollowUpService.RepLeadUrl(Site, 42);
        Assert.Equal("https://nvc-home4you.eu/rep/leads?lead=42", repHref);
        Assert.Contains($@"Лийд <a href=""{href}"">#42</a> е създаден и възложен на {Upn} (<a href=""{repHref}"">в панела на представителя</a>).", html);
        Assert.DoesNotContain("не е създаден", html);
    }

    [Fact]
    public void The_lead_url_tolerates_a_trailing_slash_on_the_origin()
    {
        // Request.Host never carries one, but a setting might; the report trims it too.
        Assert.Equal("https://nvc-home4you.eu/admin/pipeline?lead=7", LeadFollowUpService.LeadUrl("https://nvc-home4you.eu/", 7));
    }

    [Fact]
    public void A_skipped_promotion_says_why_and_where_the_enquiry_is_waiting()
    {
        // The reason goes in verbatim, so "why is there no lead?" is answered by the mail
        // rather than by a log search; "вижте Запитвания" says where to promote it by hand.
        var (_, html) = Render(Note(IntakeOutcome.Skipped("invalid-email")));

        Assert.Contains("Лийд не е създаден (invalid-email) — вижте Запитвания.", html);
        Assert.DoesNotContain("възложен", html);
        Assert.DoesNotContain("/admin/pipeline?lead=", html);
        Assert.DoesNotContain("/rep/leads?lead=", html);
    }

    [Fact]
    public void A_possible_duplicate_is_named_with_its_owner()
    {
        var (_, html) = Render(Note(Created(42, duplicateOf: 7, duplicateOwner: "maria@nvc-home4you.eu")));

        Assert.Contains("Възможен дубликат на лийд #7 (отговорник: maria@nvc-home4you.eu).", html);
        // Both lines: the new lead is still created and still linked.
        Assert.Contains("#42</a> е създаден", html);
    }

    [Fact]
    public void An_unowned_duplicate_says_so_in_words()
    {
        var (_, html) = Render(Note(Created(42, duplicateOf: 7, duplicateOwner: null)));

        Assert.Contains("(отговорник: никой)", html);
    }

    [Fact]
    public void Without_a_duplicate_there_is_no_duplicate_line()
    {
        var (_, html) = Render(Note(Created(42)));

        Assert.DoesNotContain("дубликат", html);
    }

    [Fact]
    public void Everything_interpolated_is_html_encoded()
    {
        // The slug and UPN come from configuration and the reason from our own code, but the
        // duplicate's owner is a database column, and the rule is "encode everything" rather
        // than "encode what we distrust today".
        var (_, html) = Render(Note(
            Created(42, duplicateOf: 7, duplicateOwner: "<script>x</script>@x.bg"),
            slug: "<b>slug</b>", upn: "<i>upn</i>@x.bg"));

        Assert.DoesNotContain("<script>", html);
        Assert.DoesNotContain("<b>slug</b>", html);
        Assert.DoesNotContain("<i>upn</i>", html);
        Assert.Contains("&lt;script&gt;x&lt;/script&gt;@x.bg", html);
        Assert.Contains("&lt;b&gt;slug&lt;/b&gt;", html);
        Assert.Contains("&lt;i&gt;upn&lt;/i&gt;@x.bg", html);

        var (_, skipped) = Render(Note(IntakeOutcome.Skipped("<x>")));
        Assert.Contains("(&lt;x&gt;)", skipped);
        Assert.DoesNotContain("(<x>)", skipped);
    }

    [Fact]
    public void Without_a_note_the_mail_is_exactly_as_it_was()
    {
        // Every enquiry that did not come through a link: nothing about representatives
        // anywhere, and the subject OfferNotificationModelTests pins.
        var (subject, html) = Render(intake: null);

        Assert.Equal("Ново запитване за оферта: Ivan", subject);
        Assert.DoesNotContain("Представител", html);
        Assert.DoesNotContain("Лийд", html);
    }
}
