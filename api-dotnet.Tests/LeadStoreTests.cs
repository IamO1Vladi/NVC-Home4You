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

    private static SqlLeadService Store(AppDbContext db) =>
        new(db, NullLogger<SqlLeadService>.Instance);

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
