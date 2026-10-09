using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The representative line in the Quickbase copy of an enquiry (#38).
//
// LeadStoreTests pins it for the SQL store; this is the same promise for FormService, which
// writes the enquiry wherever leads still come from Quickbase, dual-write included — and
// there the message field is the ONLY place the rep can be seen, because no promotion
// happens on that side at all. The record is read off the wire rather than out of a store:
// what FormService posts is the contract, and a stub that answers a clean create is all
// Quickbase has to be for that.
public class QuickbaseLeadStoreTests
{
    private const string RepLine = "Представител: dtodorov";

    // Keeps every body FormService posts and answers each with a clean create — the shape
    // LeadWriteFailureTests reads — so the write succeeds and the record can be inspected.
    private sealed class RecordingHandler : HttpMessageHandler
    {
        public List<string> Bodies { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Bodies.Add(await request.Content!.ReadAsStringAsync(ct));
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{ "metadata": { "createdRecordIds": [4231], "totalNumberOfRecordsProcessed": 1 } }""",
                    System.Text.Encoding.UTF8, "application/json"),
            };
        }
    }

    private sealed record Setup(FormService Store, RecordingHandler Wire, EnvConfig Env);

    // No registry unless a test hands one in, as in LeadStoreTests: with REPRESENTATIVES
    // unset every record is written exactly as before #38.
    private static Setup Store(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
            ["QUICKBASE_TOKEN"] = "token",
            ["QB_TABLE_OFFER"] = "bqoffers",
            ["QB_TABLE_QUESTION"] = "bqquestions",
        };
        foreach (var (k, v) in settings) dict[k] = v;
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        var env = new EnvConfig(cfg);

        var wire = new RecordingHandler();
        var http = new HttpClient(wire) { BaseAddress = new Uri("https://api.quickbase.com/") };
        return new Setup(
            new FormService(new QuickbaseClient(http, env, cfg), env, NullLogger<FormService>.Instance), wire, env);
    }

    private static Setup WithRegistry() =>
        Store(("REPRESENTATIVES", "dtodorov=dtodorov@nvc-home4you.eu"));

    // One field of the one record in the one write, by its Quickbase field id.
    private static string? Field(Setup s, int fid)
    {
        using var body = JsonDocument.Parse(Assert.Single(s.Wire.Bodies));
        var record = Assert.Single(body.RootElement.GetProperty("data").EnumerateArray());
        return record.GetProperty(fid.ToString()).GetProperty("value").GetString();
    }

    private static OfferDto Offer(string project, string? rep) =>
        new("Ivan", "ivan@example.com", "+359 88 000 0000", project, null, "bg", Rep: rep);

    private static QuestionDto Question(string question, string? rep) =>
        new("Maria", "maria@example.com", question, "el", Rep: rep);

    [Fact]
    public async Task A_representatives_offer_opens_with_the_line_in_quickbase_too()
    {
        var s = WithRegistry();

        var write = await s.Store.CreateOfferAsync(Offer("Two-bedroom box house", "dtodorov"), CancellationToken.None);

        Assert.True(write.Ok);
        Assert.Equal(RepLine + "\n\nTwo-bedroom box house", Field(s, s.Env.F_OFFER_MESSAGE));
        // Only the message carries it; the customer's own fields are his.
        Assert.Equal("Ivan", Field(s, s.Env.F_OFFER_NAME));
        Assert.Equal("ivan@example.com", Field(s, s.Env.F_OFFER_EMAIL));
    }

    [Fact]
    public async Task A_representatives_question_opens_with_the_line()
    {
        var s = WithRegistry();

        var write = await s.Store.CreateQuestionAsync(Question("Do you deliver to Greece?", "dtodorov"), CancellationToken.None);

        Assert.True(write.Ok);
        Assert.Equal(RepLine + "\n\nDo you deliver to Greece?", Field(s, s.Env.F_Q_MESSAGE));
    }

    [Fact]
    public async Task The_line_uses_the_registrys_spelling_not_the_browsers()
    {
        // The SQL store's rule, kept here too: whatever localStorage held, the record carries
        // the registered spelling, so a Quickbase search for one representative finds all.
        var s = WithRegistry();

        await s.Store.CreateQuestionAsync(Question("Hi", "  DTodorov "), CancellationToken.None);

        Assert.Equal(RepLine + "\n\nHi", Field(s, s.Env.F_Q_MESSAGE));
    }

    [Fact]
    public async Task A_slug_the_registry_does_not_know_leaves_the_message_alone()
    {
        // A stale link, or a stranger typing into the field: an ordinary enquiry.
        var offer = WithRegistry();
        await offer.Store.CreateOfferAsync(Offer("Hi", "nobody"), CancellationToken.None);
        Assert.Equal("Hi", Field(offer, offer.Env.F_OFFER_MESSAGE));

        var question = WithRegistry();
        await question.Store.CreateQuestionAsync(Question("Hi", "nobody"), CancellationToken.None);
        Assert.Equal("Hi", Field(question, question.Env.F_Q_MESSAGE));
    }

    [Fact]
    public async Task With_no_registry_at_all_a_slug_changes_nothing()
    {
        // REPRESENTATIVES unset is every installation before #38, and the slug the browser
        // sends must not be able to write itself into a record there.
        var offer = Store();
        await offer.Store.CreateOfferAsync(Offer("Hi", "dtodorov"), CancellationToken.None);
        Assert.Equal("Hi", Field(offer, offer.Env.F_OFFER_MESSAGE));

        var question = Store();
        await question.Store.CreateQuestionAsync(Question("Hi", "dtodorov"), CancellationToken.None);
        Assert.Equal("Hi", Field(question, question.Env.F_Q_MESSAGE));
    }

    [Fact]
    public async Task Without_a_slug_the_message_is_the_customers_text_as_before()
    {
        var s = WithRegistry();

        await s.Store.CreateOfferAsync(Offer("Hi", null), CancellationToken.None);

        Assert.Equal("Hi", Field(s, s.Env.F_OFFER_MESSAGE));
    }
}
