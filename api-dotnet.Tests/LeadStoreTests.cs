using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

public class SqlLeadServiceTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"leads-{Guid.NewGuid()}")
            .Options);

    // No registry unless a test hands one in: with REPRESENTATIVES unset every enquiry is
    // stored exactly as before #38, which is what the tests above this comment pin.
    private static SqlLeadService Store(AppDbContext db, EnvConfig? env = null) =>
        new(db, env ?? Config(), NullLogger<SqlLeadService>.Instance);

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    [Fact]
    public async Task An_offer_lands_with_every_field_the_modal_collects()
    {
        using var db = NewDb();
        var dto = new OfferDto("Ivan", "ivan@example.com", "+359 88 000 0000", "Two-bedroom box house", "box-2b", "bg");

        var result = await Store(db).CreateOfferAsync(dto, CancellationToken.None);

        Assert.True(result.Ok);
        var saved = db.Offers.Single();
        Assert.Equal("Ivan", saved.Name);
        Assert.Equal("ivan@example.com", saved.Email);
        Assert.Equal("+359 88 000 0000", saved.Phone);
        Assert.Equal("Two-bedroom box house", saved.Message);
        Assert.Equal("box-2b", saved.ModelId);
        Assert.Equal("bg", saved.Locale);
        Assert.Equal(saved.Id, result.RecordId);
    }

    [Fact]
    public async Task A_question_lands_with_the_three_fields_it_collects()
    {
        using var db = NewDb();
        var dto = new QuestionDto("Maria", "maria@example.com", "Do you deliver to Greece?", "el");

        var result = await Store(db).CreateQuestionAsync(dto, CancellationToken.None);

        Assert.True(result.Ok);
        var saved = db.Questions.Single();
        Assert.Equal("Maria", saved.Name);
        Assert.Equal("Do you deliver to Greece?", saved.Message);
        Assert.Equal("el", saved.Locale);
    }

    [Fact]
    public async Task Both_workflow_checkboxes_start_unticked()
    {
        // A new lead has not been contacted and is not yet a "Lead"; sales ticks these.
        using var db = NewDb();

        await Store(db).CreateOfferAsync(new OfferDto("A", "a@example.com", null, "hi", null), CancellationToken.None);

        var saved = db.Offers.Single();
        Assert.False(saved.ReachedOut);
        Assert.False(saved.LeadCreated);
    }

    [Fact]
    public async Task A_lead_with_no_phone_or_model_is_still_accepted()
    {
        // Nothing beyond what the form collects may be required: rejecting a lead over a
        // missing optional field is the failure this table is meant to stop happening.
        using var db = NewDb();

        var result = await Store(db).CreateOfferAsync(
            new OfferDto("Nikolay", "n@example.com", null, "", null), CancellationToken.None);

        Assert.True(result.Ok);
        Assert.Null(db.Offers.Single().Phone);
    }

    [Fact]
    public async Task An_overlong_message_is_truncated_rather_than_losing_the_lead()
    {
        // Configurator enquiries paste a whole summary into the message. Better a clipped
        // message than a row the database refuses.
        using var db = NewDb();
        var huge = new string('x', 6000);

        var result = await Store(db).CreateOfferAsync(
            new OfferDto("A", "a@example.com", null, huge, null), CancellationToken.None);

        Assert.True(result.Ok);
        Assert.Equal(4000, db.Offers.Single().Message!.Length);
    }

    // --- The gallery model, carried in the message ------------------------------------
    //
    // The id alone told sales nothing and is not unique on live, so a gallery enquiry's
    // model is written into the message itself, where every staff screen already looks.

    private static OfferDto GalleryOffer(string project, string? path = "/bg/galeriq/космическа-къща") =>
        new("Ivan", "ivan@example.com", null, project, "15", "bg", "Космическа къща", path);

    private static readonly string ModelLine =
        "Модел от сайта: Космическа къща — https://nvc-home4you.eu/bg/galeriq/космическа-къща";

    [Fact]
    public async Task A_gallery_offer_opens_its_message_with_the_model()
    {
        using var db = NewDb();

        var result = await Store(db).CreateOfferAsync(GalleryOffer("Delivery to Varna?"), CancellationToken.None);

        Assert.True(result.Ok);
        var saved = db.Offers.Single();
        Assert.Equal(ModelLine + "\n\nDelivery to Varna?", saved.Message);
        // The id is still stored where it always was.
        Assert.Equal("15", saved.ModelId);
    }

    [Fact]
    public async Task A_gallery_offer_with_no_text_still_records_the_model()
    {
        using var db = NewDb();

        await Store(db).CreateOfferAsync(GalleryOffer(""), CancellationToken.None);

        Assert.Equal(ModelLine, db.Offers.Single().Message);
    }

    [Fact]
    public async Task A_path_that_is_not_our_product_page_is_stored_without_a_link()
    {
        using var db = NewDb();

        await Store(db).CreateOfferAsync(GalleryOffer("Hi", path: "https://evil.example/bg/galeriq/x"), CancellationToken.None);

        var message = db.Offers.Single().Message!;
        Assert.Equal("Модел от сайта: Космическа къща\n\nHi", message);
        Assert.DoesNotContain("evil.example", message);
    }

    [Fact]
    public async Task An_offer_without_a_model_title_keeps_the_customers_text_as_it_was()
    {
        // The configurator, the plain form, and any page still open from before: no title,
        // so nothing is prepended — not even for a bare id, which already has its column.
        using var db = NewDb();

        await Store(db).CreateOfferAsync(
            new OfferDto("Ivan", "ivan@example.com", null, "Two-bedroom box house", "15", "bg"), CancellationToken.None);

        Assert.Equal("Two-bedroom box house", db.Offers.Single().Message);
    }

    [Fact]
    public async Task Truncation_eats_the_end_of_the_customers_text_never_the_model_line()
    {
        // A configurator-sized paste close to the limit: the model line is in front, so
        // only the tail of the customer's text is lost.
        using var db = NewDb();
        var nearLimit = new string('x', 3990);

        var result = await Store(db).CreateOfferAsync(GalleryOffer(nearLimit), CancellationToken.None);

        Assert.True(result.Ok);
        var message = db.Offers.Single().Message!;
        Assert.Equal(4000, message.Length);
        Assert.StartsWith(ModelLine + "\n\nxxx", message);
    }

    // --- The representative, carried in the message (#38) -------------------------------
    //
    // The same device as the model line, for the same reason: no column, no migration, and
    // every staff screen already reads the message. It is the provenance that survives when
    // the automatic promotion is skipped or fails, which is exactly when it is needed.

    private const string RepLine = "Представител: dtodorov";

    private static EnvConfig WithRegistry() =>
        Config(("REPRESENTATIVES", "dtodorov=dtodorov@nvc-home4you.eu"));

    [Fact]
    public async Task A_representatives_offer_names_them_under_the_model_line()
    {
        // The model line stays FIRST: LeadService resolves the house off the first line, and
        // a representative line above it would unlink every gallery enquiry from a link.
        using var db = NewDb();

        await Store(db, WithRegistry()).CreateOfferAsync(
            GalleryOffer("Delivery to Varna?") with { Rep = "dtodorov" }, CancellationToken.None);

        var message = db.Offers.Single().Message!;
        Assert.Equal(ModelLine + "\n\n" + RepLine + "\n\nDelivery to Varna?", message);
        Assert.True(OfferModel.HasModelLine(message));
    }

    [Fact]
    public async Task Without_a_model_the_representative_line_opens_the_message()
    {
        using var db = NewDb();

        await Store(db, WithRegistry()).CreateOfferAsync(
            new OfferDto("Ivan", "ivan@example.com", null, "Two-bedroom box house", null, "bg", Rep: "dtodorov"),
            CancellationToken.None);

        Assert.Equal(RepLine + "\n\nTwo-bedroom box house", db.Offers.Single().Message);
    }

    [Fact]
    public async Task A_representatives_question_opens_with_the_line()
    {
        // The question form has no model, so the line is simply first.
        using var db = NewDb();

        await Store(db, WithRegistry()).CreateQuestionAsync(
            new QuestionDto("Maria", "maria@example.com", "Do you deliver to Greece?", "el", Rep: "dtodorov"),
            CancellationToken.None);

        Assert.Equal(RepLine + "\n\nDo you deliver to Greece?", db.Questions.Single().Message);
    }

    [Fact]
    public async Task The_line_uses_the_registrys_spelling_not_the_browsers()
    {
        // The slug is whatever localStorage held; only the registered spelling may reach a
        // row, so the queue's search finds every enquiry for one representative the same way.
        using var db = NewDb();

        await Store(db, WithRegistry()).CreateQuestionAsync(
            new QuestionDto("Maria", "maria@example.com", "Hi", "en", Rep: "  DTodorov "), CancellationToken.None);

        Assert.Equal(RepLine + "\n\nHi", db.Questions.Single().Message);
    }

    [Fact]
    public async Task A_slug_the_registry_does_not_know_leaves_the_message_alone()
    {
        // A stale link, or a stranger typing into the field: an ordinary enquiry.
        using var db = NewDb();

        await Store(db, WithRegistry()).CreateOfferAsync(
            new OfferDto("Ivan", "ivan@example.com", null, "Hi", null, "bg", Rep: "nobody"), CancellationToken.None);
        await Store(db, WithRegistry()).CreateQuestionAsync(
            new QuestionDto("Maria", "maria@example.com", "Hi", "en", Rep: "nobody"), CancellationToken.None);

        Assert.Equal("Hi", db.Offers.Single().Message);
        Assert.Equal("Hi", db.Questions.Single().Message);
    }

    [Fact]
    public async Task With_no_registry_at_all_a_slug_changes_nothing()
    {
        // REPRESENTATIVES unset is every installation before #38, and the slug the browser
        // sends must not be able to write itself into a row there.
        using var db = NewDb();

        await Store(db).CreateOfferAsync(
            new OfferDto("Ivan", "ivan@example.com", null, "Hi", null, "bg", Rep: "dtodorov"), CancellationToken.None);
        await Store(db).CreateQuestionAsync(
            new QuestionDto("Maria", "maria@example.com", "Hi", "en", Rep: "dtodorov"), CancellationToken.None);

        Assert.Equal("Hi", db.Offers.Single().Message);
        Assert.Equal("Hi", db.Questions.Single().Message);
    }
}

// The helper itself, apart from any store. Mirrors the WithModelLine tests in
// OfferModelTests, because it mirrors WithModelLine.
public class RepresentativeLineTests
{
    [Fact]
    public void The_line_goes_first_with_a_blank_line_before_the_customers_text()
    {
        Assert.Equal("Представител: dtodorov\n\nDelivery to Varna?", RepresentativeLine.Prepend("  Delivery to Varna?  ", "dtodorov"));
    }

    [Fact]
    public void With_no_text_the_line_stands_alone()
    {
        Assert.Equal("Представител: dtodorov", RepresentativeLine.Prepend("   ", "dtodorov"));
        Assert.Equal("Представител: dtodorov", RepresentativeLine.Prepend(null, "dtodorov"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Without_a_slug_the_message_is_left_exactly_as_sent(string? slug)
    {
        Assert.Equal("  hi  ", RepresentativeLine.Prepend("  hi  ", slug));
        Assert.Null(RepresentativeLine.Prepend(null, slug));
    }

    [Fact]
    public void Applied_before_the_model_line_it_keeps_the_model_line_first()
    {
        // The order SqlLeadService uses, and the reason: the house is read off line one.
        var model = OfferModel.From("15", "Космическа къща", "/en/gallery/space-house");

        var stored = OfferModel.WithModelLine(model, RepresentativeLine.Prepend("Hi", "dtodorov"));

        Assert.Equal(
            "Модел от сайта: Космическа къща — https://nvc-home4you.eu/en/gallery/space-house\n\nПредставител: dtodorov\n\nHi",
            stored);
        Assert.True(OfferModel.HasModelLine(stored));
    }
}

// Fake store so dual-write can be tested without a database or Quickbase.
file sealed class FakeLeadStore : ILeadStore
{
    private readonly bool _ok;
    public int OfferCalls { get; private set; }
    public int QuestionCalls { get; private set; }

    public FakeLeadStore(bool ok) => _ok = ok;

    public Task<LeadWriteResult> CreateOfferAsync(OfferDto dto, CancellationToken ct = default)
    {
        OfferCalls++;
        return Task.FromResult(_ok ? LeadWriteResult.Succeeded(1) : LeadWriteResult.Failed("nope"));
    }

    public Task<LeadWriteResult> CreateQuestionAsync(QuestionDto dto, CancellationToken ct = default)
    {
        QuestionCalls++;
        return Task.FromResult(_ok ? LeadWriteResult.Succeeded(2) : LeadWriteResult.Failed("nope"));
    }
}

public class DualWriteLeadStoreTests
{
    private static readonly OfferDto Offer = new("A", "a@example.com", null, "hi", null);
    private static readonly QuestionDto Question = new("A", "a@example.com", "hi");

    private static DualWriteLeadStore Store(ILeadStore primary, ILeadStore secondary) =>
        new(primary, secondary, NullLogger<DualWriteLeadStore>.Instance);

    [Fact]
    public async Task Both_stores_receive_the_lead()
    {
        var primary = new FakeLeadStore(ok: true);
        var secondary = new FakeLeadStore(ok: true);

        await Store(primary, secondary).CreateOfferAsync(Offer, CancellationToken.None);
        await Store(primary, secondary).CreateQuestionAsync(Question, CancellationToken.None);

        Assert.Equal(1, primary.OfferCalls);
        Assert.Equal(1, secondary.OfferCalls);
        Assert.Equal(1, primary.QuestionCalls);
        Assert.Equal(1, secondary.QuestionCalls);
    }

    [Fact]
    public async Task A_failing_secondary_store_cannot_cost_a_lead()
    {
        // The whole point of the soak: SQL can be broken for weeks without the customer
        // ever seeing anything other than the authoritative store's answer.
        var result = await Store(new FakeLeadStore(ok: true), new FakeLeadStore(ok: false))
            .CreateOfferAsync(Offer, CancellationToken.None);

        Assert.True(result.Ok);
        Assert.Equal(1, result.RecordId);
    }

    [Fact]
    public async Task A_failing_primary_store_still_fails_even_if_the_secondary_worked()
    {
        // The secondary is not a fallback. Reporting success because the shadow store
        // accepted it would hide exactly the breakage the soak is meant to surface.
        var result = await Store(new FakeLeadStore(ok: false), new FakeLeadStore(ok: true))
            .CreateOfferAsync(Offer, CancellationToken.None);

        Assert.False(result.Ok);
        Assert.Equal("nope", result.Error);
    }
}

public class LeadsDualWriteFlagTests
{
    private const string Conn = "Server=(localdb)\\MSSQLLocalDB;Database=X;Trusted_Connection=True";

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    [Fact]
    public void Leads_default_to_quickbase_so_this_change_ships_inert()
    {
        Assert.Equal(DataSource.Quickbase, Config().DataSourceFor("leads"));
        Assert.False(Config().LeadsDualWrite);
    }

    [Fact]
    public void Dual_write_is_inert_without_a_connection_string()
    {
        // Same fail-safe rule as every other flag: no database means no second write,
        // however loudly the variable is set.
        Assert.False(Config(("LEADS_DUAL_WRITE", "true")).LeadsDualWrite);
    }

    [Fact]
    public void Dual_write_turns_on_only_for_an_explicit_true()
    {
        Assert.True(Config(("SQL_CONNECTION_STRING", Conn), ("LEADS_DUAL_WRITE", "true")).LeadsDualWrite);
        Assert.True(Config(("SQL_CONNECTION_STRING", Conn), ("LEADS_DUAL_WRITE", "TRUE")).LeadsDualWrite);
        Assert.False(Config(("SQL_CONNECTION_STRING", Conn), ("LEADS_DUAL_WRITE", "1")).LeadsDualWrite);
        Assert.False(Config(("SQL_CONNECTION_STRING", Conn), ("LEADS_DUAL_WRITE", "yes")).LeadsDualWrite);
    }

    [Fact]
    public void Dual_write_is_independent_of_which_store_is_authoritative()
    {
        var cfg = Config(("SQL_CONNECTION_STRING", Conn), ("LEADS_DUAL_WRITE", "true"));

        Assert.Equal(DataSource.Quickbase, cfg.DataSourceFor("leads"));
        Assert.True(cfg.LeadsDualWrite);
    }
}
