using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The two public forms in front of the stores (#38): the honeypot, and what the controller
// does with the representative slug before anything is written.
//
// The honeypot rule is the one worth a test on the controller rather than on a helper: a
// filled field means a bot, the bot must get the same thank-you a person gets — a 4xx would
// tell its operator which field gave them away — and NOTHING may happen behind that answer.
// "Nothing" is only provable by counting what the store and the intake saw.
public class PublicFormHoneypotTests
{
    // Copied from LeadStoreTests, which keeps its own file-scoped, plus a memory of the last
    // DTO: what the controller hands the store is half of what is being checked here.
    private sealed class FakeLeadStore : ILeadStore
    {
        public int OfferCalls { get; private set; }
        public int QuestionCalls { get; private set; }
        public OfferDto? LastOffer { get; private set; }
        public QuestionDto? LastQuestion { get; private set; }

        public Task<LeadWriteResult> CreateOfferAsync(OfferDto dto, CancellationToken ct = default)
        {
            OfferCalls++;
            LastOffer = dto;
            return Task.FromResult(LeadWriteResult.Succeeded(1));
        }

        public Task<LeadWriteResult> CreateQuestionAsync(QuestionDto dto, CancellationToken ct = default)
        {
            QuestionCalls++;
            LastQuestion = dto;
            return Task.FromResult(LeadWriteResult.Succeeded(2));
        }
    }

    // Counts calls so a test can prove the intake was, or was not, reached.
    private sealed class CountingIntake : IRepresentativeIntake
    {
        public int Calls { get; private set; }
        public EnvConfig.Representative? LastRep { get; private set; }

        public Task<IntakeOutcome> TryPromoteAsync(
            string kind, long? recordId, EnvConfig.Representative rep, string? email, string? phone, CancellationToken ct)
        {
            Calls++;
            LastRep = rep;
            return Task.FromResult(IntakeOutcome.Skipped("sql-not-configured"));
        }
    }

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new System.Collections.Generic.Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static EnvConfig WithRegistry() => Config(("REPRESENTATIVES", "dtodorov=dtodorov@nvc-home4you.eu"));

    // Unconfigured, so both mails return false at once and no transport is touched.
    private static EmailService NoEmail(EnvConfig env) =>
        new(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance);

    private static OfferController Offer(ILeadStore store, EnvConfig? env = null, IRepresentativeIntake? intake = null)
    {
        env ??= Config();
        return new OfferController(store, NoEmail(env), env, intake ?? new NullRepresentativeIntake(), NullLogger<OfferController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
    }

    private static QuestionController Question(ILeadStore store, EnvConfig? env = null, IRepresentativeIntake? intake = null)
    {
        env ??= Config();
        return new QuestionController(store, NoEmail(env), env, intake ?? new NullRepresentativeIntake(), NullLogger<QuestionController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
    }

    private static OfferDto AnOffer(string? website, string? rep = null) =>
        new("Ivan", "ivan@example.com", "+359 88 000 0000", "Two-bedroom box house", null, "bg", Rep: rep, Website: website);

    private static QuestionDto AQuestion(string? website, string? rep = null) =>
        new("Maria", "maria@example.com", "Do you deliver to Greece?", "el", Rep: rep, Website: website);

    // The success answer is an anonymous object; the frontend reads only the status, and
    // the one field that distinguishes the decoy from a real write is recordId.
    private static (bool Stored, long? RecordId) Read(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        var value = ok.Value!;
        var stored = (bool)value.GetType().GetProperty("stored")!.GetValue(value)!;
        var recordId = (long?)value.GetType().GetProperty("recordId")!.GetValue(value);
        return (stored, recordId);
    }

    // --- The honeypot ----------------------------------------------------------------------

    [Theory]
    [InlineData("http://spam.example")]
    [InlineData("x")]
    public async Task A_filled_honeypot_on_the_offer_form_stores_nothing_and_says_thank_you(string website)
    {
        var store = new FakeLeadStore();

        var (stored, recordId) = Read(await Offer(store).Post(AnOffer(website), CancellationToken.None));

        Assert.Equal(0, store.OfferCalls);
        Assert.True(stored);        // the decoy: a 200 with stored:true, like the real thing
        Assert.True(recordId > 0);  // and a plausible id — null would give the decoy away
    }

    [Fact]
    public async Task A_filled_honeypot_on_the_question_form_stores_nothing_and_says_thank_you()
    {
        var store = new FakeLeadStore();

        var (stored, _) = Read(await Question(store).Post(AQuestion("http://spam.example"), CancellationToken.None));

        Assert.Equal(0, store.QuestionCalls);
        Assert.True(stored);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task An_empty_honeypot_is_a_human_and_the_offer_is_stored(string? website)
    {
        // Null is every page from before the field existed; empty is every human since.
        var store = new FakeLeadStore();

        var (stored, recordId) = Read(await Offer(store).Post(AnOffer(website), CancellationToken.None));

        Assert.Equal(1, store.OfferCalls);
        Assert.True(stored);
        Assert.Equal(1L, recordId);
    }

    [Fact]
    public async Task An_empty_honeypot_on_the_question_form_stores_the_question()
    {
        var store = new FakeLeadStore();

        var (stored, recordId) = Read(await Question(store).Post(AQuestion(""), CancellationToken.None));

        Assert.Equal(1, store.QuestionCalls);
        Assert.True(stored);
        Assert.Equal(2L, recordId);
    }

    [Fact]
    public async Task A_bot_carrying_a_real_representatives_slug_reaches_neither_the_store_nor_the_intake()
    {
        // The honeypot is checked before the slug is even looked at, or a bot posting a
        // known slug could manufacture leads for a representative.
        var store = new FakeLeadStore();
        var intake = new CountingIntake();

        await Offer(store, WithRegistry(), intake).Post(AnOffer("x", rep: "dtodorov"), CancellationToken.None);
        await Question(store, WithRegistry(), intake).Post(AQuestion("x", rep: "dtodorov"), CancellationToken.None);

        Assert.Equal(0, store.OfferCalls + store.QuestionCalls);
        Assert.Equal(0, intake.Calls);
    }

    // --- The slug, resolved before anything is written ------------------------------------

    [Fact]
    public async Task A_known_slug_reaches_the_store_in_the_registrys_spelling_and_then_the_intake()
    {
        var store = new FakeLeadStore();
        var intake = new CountingIntake();

        await Offer(store, WithRegistry(), intake).Post(AnOffer("", rep: "  DTodorov "), CancellationToken.None);

        Assert.Equal("dtodorov", store.LastOffer!.Rep);
        Assert.Equal(1, intake.Calls);
        Assert.Equal("dtodorov@nvc-home4you.eu", intake.LastRep!.Upn);
    }

    [Fact]
    public async Task An_unknown_slug_is_dropped_before_the_store_and_never_reaches_the_intake()
    {
        // A stale link or a stranger typing: the enquiry is stored as an ordinary one, and
        // nothing the browser said about a representative survives past the controller.
        var store = new FakeLeadStore();
        var intake = new CountingIntake();

        await Offer(store, WithRegistry(), intake).Post(AnOffer("", rep: "nobody"), CancellationToken.None);
        await Question(store, WithRegistry(), intake).Post(AQuestion("", rep: "nobody"), CancellationToken.None);

        Assert.Equal(1, store.OfferCalls);
        Assert.Equal(1, store.QuestionCalls);
        Assert.Null(store.LastOffer!.Rep);
        Assert.Null(store.LastQuestion!.Rep);
        Assert.Equal(0, intake.Calls);
    }

    [Fact]
    public async Task A_question_through_a_link_reaches_the_intake_with_no_phone()
    {
        var store = new FakeLeadStore();
        var intake = new CountingIntake();

        await Question(store, WithRegistry(), intake).Post(AQuestion("", rep: "dtodorov"), CancellationToken.None);

        Assert.Equal("dtodorov", store.LastQuestion!.Rep);
        Assert.Equal(1, intake.Calls);
    }

    // --- The payload ------------------------------------------------------------------------
    //
    // Both fields are trailing and optional so that every page open before #38 shipped —
    // and the doors page, which posts its own payload — keeps posting the old shape. Read
    // with the options MVC itself uses, as the OfferModelTests precedent does.

    [Fact]
    public void An_old_offer_payload_without_rep_or_website_still_binds()
    {
        var options = new JsonOptions().JsonSerializerOptions;
        const string json = """{"name":"Ivan","email":"ivan@example.com","phone":"","project":"Hi","modelId":"","locale":"en"}""";

        var dto = JsonSerializer.Deserialize<OfferDto>(json, options)!;

        Assert.Equal("Hi", dto.Project);
        Assert.Null(dto.Rep);
        Assert.Null(dto.Website);
    }

    [Fact]
    public void An_old_question_payload_without_rep_or_website_still_binds()
    {
        var options = new JsonOptions().JsonSerializerOptions;
        const string json = """{"name":"Maria","email":"maria@example.com","question":"Hi","locale":"el"}""";

        var dto = JsonSerializer.Deserialize<QuestionDto>(json, options)!;

        Assert.Equal("Hi", dto.Question);
        Assert.Null(dto.Rep);
        Assert.Null(dto.Website);
    }

    [Fact]
    public void The_two_new_fields_bind_from_camel_case_json_on_both_forms()
    {
        var options = new JsonOptions().JsonSerializerOptions;

        var offer = JsonSerializer.Deserialize<OfferDto>(
            """{"name":"Ivan","email":"ivan@example.com","phone":"","project":"Hi","modelId":"","locale":"en","rep":"dtodorov","website":""}""",
            options)!;
        var question = JsonSerializer.Deserialize<QuestionDto>(
            """{"name":"Maria","email":"maria@example.com","question":"Hi","locale":"el","rep":"dtodorov","website":"http://spam.example"}""",
            options)!;

        Assert.Equal("dtodorov", offer.Rep);
        Assert.Equal("", offer.Website);
        Assert.Equal("dtodorov", question.Rep);
        Assert.Equal("http://spam.example", question.Website);
    }
}
