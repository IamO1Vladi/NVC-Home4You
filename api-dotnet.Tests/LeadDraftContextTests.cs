using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// What a drafted reply gets to read.
//
// This is the half of the AI feature worth testing: the model call is not deterministic,
// but what we hand it is, and every failure here is silent — a draft quoting a price we
// never offered, a reply answering the wrong model, or a thread the drafter only sees
// the beginning of.
public class LeadDraftContextTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"draftctx-{Guid.NewGuid()}")
            .Options);

    private static async Task<Lead> SeedLead(AppDbContext db, Action<Lead>? tweak = null)
    {
        var lead = new Lead { Name = "Ivan Petrov", Email = "ivan@x.com", Locale = "bg" };
        tweak?.Invoke(lead);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();
        return lead;
    }

    [Fact]
    public async Task The_catalogue_slice_carries_the_linked_model_and_its_real_price()
    {
        // A draft that invents a price is worse than one that omits it — the customer
        // holds us to what we wrote, so the figure comes from the House row.
        using var db = NewDb();
        db.Houses.Add(new House
        {
            Id = 3, Title = "Nova 60", Price = 26500m, Currency = "EUR",
            CategoryKey = HouseCategories.Modular,
        });
        await db.SaveChangesAsync();
        var lead = await SeedLead(db, l => l.HouseId = 3);

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Contains("Nova 60", ctx!.ModelSummary);
        Assert.Contains("26500", ctx.ModelSummary);
        Assert.Contains("EUR", ctx.ModelSummary);
    }

    [Fact]
    public async Task A_price_renders_the_same_regardless_of_server_culture()
    {
        // Under a comma-decimal culture, a culture-sensitive format turns 26500.00 into
        // "26 500,00" — the same lead would read differently depending on which machine
        // drafted the reply.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 3, Title = "Nova 60", Price = 26500.5m, Currency = "EUR", CategoryKey = HouseCategories.Modular });
        await db.SaveChangesAsync();
        var lead = await SeedLead(db, l => l.HouseId = 3);

        var original = System.Globalization.CultureInfo.CurrentCulture;
        try
        {
            System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("bg-BG");
            var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);
            Assert.Contains("26500.5", ctx!.ModelSummary);
        }
        finally
        {
            System.Globalization.CultureInfo.CurrentCulture = original;
        }
    }

    [Fact]
    public async Task A_catalogue_model_and_a_custom_one_both_survive()
    {
        // "The Nova 60, but 2m longer" — dropping the second half because the first
        // resolved would lose the thing that makes the enquiry interesting.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 3, Title = "Nova 60", CategoryKey = HouseCategories.Modular });
        await db.SaveChangesAsync();
        var lead = await SeedLead(db, l => { l.HouseId = 3; l.CustomModel = "stretched by 2m"; });

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Contains("Nova 60", ctx!.ModelSummary);
        Assert.Contains("stretched by 2m", ctx.ModelSummary);
    }

    [Fact]
    public async Task A_lead_with_no_model_at_all_carries_no_model_summary()
    {
        // Rather than an empty heading the drafter would try to fill in.
        using var db = NewDb();
        var lead = await SeedLead(db);

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Null(ctx!.ModelSummary);
    }

    [Fact]
    public async Task The_thread_window_keeps_the_RECENT_end_of_a_long_conversation()
    {
        // Taking the first N would hand the drafter the opening of a conversation whose
        // last six months it never sees — and it would answer the wrong question.
        using var db = NewDb();
        var lead = await SeedLead(db);
        for (var i = 0; i < LeadDraftContextBuilder.MaxThreadEntries + 15; i++)
        {
            db.LeadActivities.Add(new LeadActivity
            {
                LeadId = lead.Id,
                Type = LeadActivityTypes.Note,
                Body = $"message {i}",
                OccurredAt = DateTimeOffset.UtcNow.AddDays(-200 + i),
            });
        }
        await db.SaveChangesAsync();

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.DoesNotContain("message 0\n", ctx!.ThreadTranscript);
        Assert.Contains($"message {LeadDraftContextBuilder.MaxThreadEntries + 14}", ctx.ThreadTranscript);
    }

    [Fact]
    public async Task The_thread_still_reads_forwards_within_the_window()
    {
        using var db = NewDb();
        var lead = await SeedLead(db);
        db.LeadActivities.AddRange(
            new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.Note, Body = "FIRST", OccurredAt = DateTimeOffset.UtcNow.AddDays(-5) },
            new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.Note, Body = "SECOND", OccurredAt = DateTimeOffset.UtcNow.AddDays(-1) });
        await db.SaveChangesAsync();

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.True(ctx!.ThreadTranscript.IndexOf("FIRST", StringComparison.Ordinal)
                  < ctx.ThreadTranscript.IndexOf("SECOND", StringComparison.Ordinal));
    }

    [Fact]
    public async Task The_two_sides_of_the_conversation_are_told_apart()
    {
        // A null actor is the customer. Getting this backwards produces a reply that
        // answers our own last message.
        using var db = NewDb();
        var lead = await SeedLead(db);
        db.LeadActivities.AddRange(
            new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.EmailIn, Body = "Do you deliver to Greece?", ActorUpn = null, OccurredAt = DateTimeOffset.UtcNow.AddDays(-2) },
            new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.EmailOut, Body = "Yes, we do.", ActorUpn = "sales@nvc-home4you.eu", OccurredAt = DateTimeOffset.UtcNow.AddDays(-1) });
        await db.SaveChangesAsync();

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Contains("Customer (email)", ctx!.ThreadTranscript);
        Assert.Contains("Us (email)", ctx.ThreadTranscript);
        // Staff names invite a reply addressed to a colleague rather than the customer.
        Assert.DoesNotContain("sales@nvc-home4you.eu", ctx.ThreadTranscript);
    }

    [Fact]
    public async Task A_long_message_is_trimmed_in_the_middle_so_the_question_survives()
    {
        // A configurator paste leads with the model and ends with the customer's actual
        // question. Tail-truncation drops the question — the one thing a reply must answer.
        using var db = NewDb();
        var lead = await SeedLead(db);
        var body = "MODEL DETAILS " + new string('x', LeadDraftContextBuilder.MaxBodyChars * 2) + " WHEN CAN YOU DELIVER?";
        db.LeadActivities.Add(new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.EmailIn, Body = body });
        await db.SaveChangesAsync();

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Contains("MODEL DETAILS", ctx!.ThreadTranscript);
        Assert.Contains("WHEN CAN YOU DELIVER?", ctx.ThreadTranscript);
        Assert.Contains("[trimmed]", ctx.ThreadTranscript);
    }

    [Fact]
    public async Task Status_moves_stay_in_the_thread()
    {
        // "They went quiet after we quoted" is exactly the context that changes what a
        // good reply says.
        using var db = NewDb();
        var lead = await SeedLead(db);
        db.LeadActivities.Add(new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.StatusChange, Body = "contacted → quoted" });
        await db.SaveChangesAsync();

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Contains("[status]", ctx!.ThreadTranscript);
        Assert.Contains("contacted → quoted", ctx.ThreadTranscript);
    }

    [Fact]
    public async Task The_locale_travels_so_the_draft_comes_back_in_the_right_language()
    {
        using var db = NewDb();
        var lead = await SeedLead(db, l => l.Locale = "el");

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Equal("el", ctx!.Locale);
    }

    [Fact]
    public async Task Standing_facts_travel_alongside_the_thread()
    {
        using var db = NewDb();
        var lead = await SeedLead(db, l =>
        {
            l.ProjectName = "Mountain cabin";
            l.BuildLocation = "Borovets";
            l.NextStep = "Send revised quote by Friday";
        });

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Contains(ctx!.Notes, n => n.Contains("Mountain cabin"));
        Assert.Contains(ctx.Notes, n => n.Contains("Borovets"));
        Assert.Contains(ctx.Notes, n => n.Contains("revised quote"));
    }

    [Fact]
    public async Task Empty_standing_fields_do_not_become_empty_headings()
    {
        using var db = NewDb();
        var lead = await SeedLead(db, l => { l.ProjectName = ""; l.Country = null; });

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.Empty(ctx!.Notes);
    }

    [Fact]
    public async Task A_realistic_context_stays_far_below_the_whole_catalogue()
    {
        // The point of the whole design: the generated catalogue data is ~20k tokens.
        // A real lead's slice should be a rounding error next to that.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 3, Title = "Nova 60", Price = 26500m, Currency = "EUR", CategoryKey = HouseCategories.Modular });
        await db.SaveChangesAsync();
        var lead = await SeedLead(db, l => l.HouseId = 3);
        for (var i = 0; i < 8; i++)
        {
            db.LeadActivities.Add(new LeadActivity
            {
                LeadId = lead.Id,
                Type = i % 2 == 0 ? LeadActivityTypes.EmailIn : LeadActivityTypes.EmailOut,
                ActorUpn = i % 2 == 0 ? null : "sales@nvc-home4you.eu",
                Body = new string('x', 300),
                OccurredAt = DateTimeOffset.UtcNow.AddDays(-10 + i),
            });
        }
        await db.SaveChangesAsync();

        var ctx = await new LeadDraftContextBuilder(db).BuildAsync(lead.Id);

        Assert.InRange(ctx!.ApproximateTokens, 1, 2000);
    }

    [Fact]
    public async Task A_missing_lead_yields_nothing_rather_than_an_empty_context()
    {
        // An empty context would draft a confident reply to a customer who doesn't exist.
        using var db = NewDb();

        Assert.Null(await new LeadDraftContextBuilder(db).BuildAsync(999));
    }
}
