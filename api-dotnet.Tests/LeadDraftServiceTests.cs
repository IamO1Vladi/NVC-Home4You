using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The parts of drafting that are deterministic: what the prompt says, and what happens
// when the feature is switched off or pointed at a lead that isn't there.
//
// The model's answer is not testable and isn't tested. What IS testable is that we never
// reach the API in a state where the answer would be wrong or wasted — and that the
// safety rules a salesperson relies on are actually in the prompt rather than assumed.
public class LeadDraftServiceTests
{
    private const string Conn = "Server=(localdb)\\MSSQLLocalDB;Database=X;Trusted_Connection=True";

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"draftsvc-{Guid.NewGuid()}")
            .Options);

    private static LeadDraftService Service(AppDbContext db, EnvConfig env) =>
        new(new LeadDraftContextBuilder(db), env, NullLogger<LeadDraftService>.Instance);

    private static LeadDraftContext SampleContext(
        string? locale = "bg", string? model = "Nova 60 — 26500 EUR", string transcript = "2026-08-01 Customer (email):\nHow much?") =>
        new("Ivan Petrov", locale, LeadStatuses.Contacted, model, transcript, new[] { "Country: Bulgaria" });

    // --- Configuration gating ---------------------------------------------------------

    [Fact]
    public void Without_an_api_key_drafting_is_off()
    {
        // Fail-closed, like every other optional service here: the button is absent
        // rather than present-and-broken.
        Assert.False(Config(("SQL_CONNECTION_STRING", Conn)).DraftsConfigured);
    }

    [Fact]
    public void Without_a_database_drafting_is_off_even_with_a_key()
    {
        // There would be no lead to draft from.
        Assert.False(Config(("ANTHROPIC_API_KEY", "sk-ant-test")).DraftsConfigured);
    }

    [Fact]
    public void With_both_drafting_is_on()
    {
        Assert.True(Config(("ANTHROPIC_API_KEY", "sk-ant-test"), ("SQL_CONNECTION_STRING", Conn)).DraftsConfigured);
    }

    [Fact]
    public async Task An_unconfigured_service_reports_it_rather_than_calling_out()
    {
        // No key means no request — this must not become an auth error from the API.
        using var db = NewDb();
        var svc = Service(db, Config(("SQL_CONNECTION_STRING", Conn)));

        var result = await svc.DraftReplyAsync(1, null);

        Assert.Equal(LeadDraftService.DraftOutcome.NotConfigured, result.Outcome);
        Assert.False(result.Ok);
        Assert.Null(result.Text);
    }

    [Fact]
    public async Task A_missing_lead_is_caught_before_any_api_call()
    {
        // Paying for a request that cannot produce a useful answer is the failure here.
        using var db = NewDb();
        var svc = Service(db, Config(("ANTHROPIC_API_KEY", "sk-ant-test"), ("SQL_CONNECTION_STRING", Conn)));

        var result = await svc.DraftReplyAsync(999, null);

        Assert.Equal(LeadDraftService.DraftOutcome.LeadNotFound, result.Outcome);
    }

    // --- Effort, the cost dial --------------------------------------------------------

    [Fact]
    public void Effort_defaults_to_medium_and_is_overridable()
    {
        Assert.Equal("medium", Config().DraftEffort);
        Assert.Equal("low", Config(("DRAFT_EFFORT", "LOW")).DraftEffort);
    }

    // --- The system prompt ------------------------------------------------------------

    [Fact]
    public void The_prompt_forbids_inventing_figures()
    {
        // The single most expensive thing a draft could do: a price it made up becomes a
        // promise the company has to keep.
        Assert.Contains("Never state a price", LeadDraftService.SystemPrompt);
        Assert.Contains("becomes", LeadDraftService.SystemPrompt);
    }

    [Fact]
    public void The_prompt_says_draft_only_and_body_only()
    {
        Assert.Contains("never sent automatically", LeadDraftService.SystemPrompt);
        Assert.Contains("no subject", LeadDraftService.SystemPrompt);
    }

    [Fact]
    public void The_prompt_maps_every_locale_the_site_serves()
    {
        // bg/el/en are the three the site actually runs in; a locale the prompt doesn't
        // name would get answered in the wrong language.
        Assert.Contains("bg = Bulgarian", LeadDraftService.SystemPrompt);
        Assert.Contains("el = Greek", LeadDraftService.SystemPrompt);
        Assert.Contains("en = English", LeadDraftService.SystemPrompt);
    }

    [Fact]
    public void The_prompt_signs_off_as_the_company()
    {
        // Matches the welcome email, and avoids a draft signing a name that isn't the
        // person about to send it.
        Assert.Contains("as the company", LeadDraftService.SystemPrompt);
    }

    // --- The user turn ----------------------------------------------------------------

    [Fact]
    public void The_user_turn_carries_the_customer_locale_stage_and_model()
    {
        var turn = LeadDraftService.BuildUserTurn(SampleContext(), null);

        Assert.Contains("Ivan Petrov", turn);
        Assert.Contains("bg", turn);
        Assert.Contains(LeadStatuses.Contacted, turn);
        Assert.Contains("Nova 60", turn);
        Assert.Contains("26500", turn);
    }

    [Fact]
    public void The_model_figures_are_labelled_as_the_ones_to_use()
    {
        // Restates the system rule right beside the numbers, where it applies.
        var turn = LeadDraftService.BuildUserTurn(SampleContext(), null);

        Assert.Contains("do not invent others", turn);
    }

    [Fact]
    public void A_salespersons_instruction_goes_last_so_the_thread_cannot_bury_it()
    {
        var turn = LeadDraftService.BuildUserTurn(SampleContext(), "Push for a site visit next week");

        Assert.Contains("Push for a site visit next week", turn);
        Assert.EndsWith("Push for a site visit next week", turn.TrimEnd(), StringComparison.Ordinal);
    }

    [Fact]
    public void Without_an_instruction_the_turn_still_ends_with_a_clear_ask()
    {
        var turn = LeadDraftService.BuildUserTurn(SampleContext(), null);

        Assert.EndsWith("Draft the reply.", turn.TrimEnd(), StringComparison.Ordinal);
    }

    [Fact]
    public void A_whitespace_only_instruction_is_treated_as_none()
    {
        var turn = LeadDraftService.BuildUserTurn(SampleContext(), "   ");

        Assert.EndsWith("Draft the reply.", turn.TrimEnd(), StringComparison.Ordinal);
        Assert.DoesNotContain("asks specifically", turn);
    }

    [Fact]
    public void An_empty_thread_says_first_contact_rather_than_going_blank()
    {
        // A blank "conversation so far" invites a reply to a message that was never sent.
        var turn = LeadDraftService.BuildUserTurn(SampleContext(transcript: ""), null);

        Assert.Contains("first contact", turn);
    }

    [Fact]
    public void A_missing_locale_is_stated_rather_than_left_empty()
    {
        var turn = LeadDraftService.BuildUserTurn(SampleContext(locale: null), null);

        Assert.Contains("(unknown)", turn);
    }

    [Fact]
    public void A_lead_with_no_model_gets_no_figures_heading_to_fill_in()
    {
        var turn = LeadDraftService.BuildUserTurn(SampleContext(model: null), null);

        Assert.DoesNotContain("do not invent others", turn);
    }
}
