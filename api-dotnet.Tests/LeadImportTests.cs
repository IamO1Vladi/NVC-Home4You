using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Serves canned Quickbase responses so the importer can be tested without a realm, a
// token, or touching the live lead tables.
internal sealed class StubHandler : HttpMessageHandler
{
    private readonly Queue<string> _bodies;
    public int Calls { get; private set; }

    public StubHandler(params string[] bodies) => _bodies = new Queue<string>(bodies);

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Calls++;
        var body = _bodies.Count > 0 ? _bodies.Dequeue() : """{ "data": [] }""";
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json"),
        });
    }
}

public class LeadImportTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"import-{Guid.NewGuid()}")
            .Options);

    private static (LeadImportService Importer, StubHandler Handler) Importer(AppDbContext db, params string[] bodies)
    {
        var handler = new StubHandler(bodies);
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.quickbase.com/") };
        var env = new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "example.quickbase.com",
            ["QUICKBASE_TOKEN"] = "token",
            ["QB_TABLE_OFFER"] = "offers",
            ["QB_TABLE_QUESTION"] = "questions",
        }).Build());

        return (new LeadImportService(new QuickbaseApi(http, env), env, db), handler);
    }

    private const string NoRows = """{ "data": [] }""";

    [Fact]
    public async Task An_offer_is_imported_with_its_workflow_checkboxes()
    {
        // Offers keep the sales checkboxes at 13/14 — verified against the live table.
        var offers = """
        { "data": [ {
            "3":  { "value": 41 },
            "7":  { "value": "Ivan" },
            "6":  { "value": "ivan@example.com" },
            "9":  { "value": "+359 88 000 0000" },
            "10": { "value": "Two-bedroom box house" },
            "13": { "value": true },
            "14": { "value": false }
        } ] }
        """;

        using var db = NewDb();
        var (importer, _) = Importer(db, offers, NoRows);

        var result = await importer.ImportOffersAsync(dryRun: false, CancellationToken.None);

        Assert.Equal(1, result.Inserted);
        var saved = db.Offers.Single();
        Assert.Equal(41, saved.QuickbaseRecordId);
        Assert.Equal("Ivan", saved.Name);
        Assert.Equal("+359 88 000 0000", saved.Phone);
        Assert.True(saved.ReachedOut);
        Assert.False(saved.LeadCreated);
    }

    [Fact]
    public async Task A_question_reads_its_checkboxes_from_9_and_10_not_13_and_14()
    {
        // The whole reason the field ids are per-table: questions put the same two
        // checkboxes at 9/10. Reading 13/14 here would silently import every question as
        // "not contacted" and reset the queue at cutover.
        var questions = """
        { "data": [ {
            "3":  { "value": 7 },
            "6":  { "value": "Maria" },
            "7":  { "value": "maria@example.com" },
            "8":  { "value": "Do you deliver to Greece?" },
            "9":  { "value": true },
            "10": { "value": true }
        } ] }
        """;

        using var db = NewDb();
        var (importer, _) = Importer(db, questions, NoRows);

        await importer.ImportQuestionsAsync(dryRun: false, CancellationToken.None);

        var saved = db.Questions.Single();
        Assert.Equal("Maria", saved.Name);
        Assert.Equal("Do you deliver to Greece?", saved.Message);
        Assert.True(saved.ReachedOut);
        Assert.True(saved.LeadCreated);
    }

    [Fact]
    public async Task Re_running_the_import_updates_rather_than_duplicating()
    {
        var first = """{ "data": [ { "3": {"value": 41}, "7": {"value": "Ivan"}, "13": {"value": false} } ] }""";
        var second = """{ "data": [ { "3": {"value": 41}, "7": {"value": "Ivan Petrov"}, "13": {"value": true} } ] }""";

        using var db = NewDb();

        var (one, _) = Importer(db, first, NoRows);
        await one.ImportOffersAsync(dryRun: false, CancellationToken.None);

        var (two, _) = Importer(db, second, NoRows);
        var result = await two.ImportOffersAsync(dryRun: false, CancellationToken.None);

        Assert.Equal(0, result.Inserted);
        Assert.Equal(1, result.Updated);
        var saved = db.Offers.Single();          // still one row
        Assert.Equal("Ivan Petrov", saved.Name); // and it picked up the change
        Assert.True(saved.ReachedOut);           // including a checkbox ticked since
    }

    [Fact]
    public async Task A_dry_run_writes_nothing_but_still_reports_what_it_would_do()
    {
        var offers = """{ "data": [ { "3": {"value": 41}, "7": {"value": "Ivan"} } ] }""";

        using var db = NewDb();
        var (importer, _) = Importer(db, offers, NoRows);

        var result = await importer.ImportOffersAsync(dryRun: true, CancellationToken.None);

        Assert.Equal(1, result.Inserted);
        Assert.Empty(db.Offers);
    }

    [Fact]
    public async Task A_row_with_no_record_id_is_skipped_rather_than_imported_unkeyed()
    {
        // Without a record id there is nothing stable to match on, so a re-import would
        // duplicate it every time.
        var offers = """{ "data": [ { "7": {"value": "No id"} } ] }""";

        using var db = NewDb();
        var (importer, _) = Importer(db, offers, NoRows);

        var result = await importer.ImportOffersAsync(dryRun: false, CancellationToken.None);

        Assert.Equal(0, result.Inserted);
        Assert.Equal(1, result.Skipped);
        Assert.Empty(db.Offers);
    }

    [Fact]
    public async Task The_import_pages_past_the_500_row_query_cap()
    {
        // Quickbase's query caps at 500 and says nothing about it, so a lead table with
        // more than that would import as "the first 500" and look complete.
        var full = "{ \"data\": [" + string.Join(",",
            Enumerable.Range(1, 500).Select(i => $"{{ \"3\": {{\"value\": {i}}}, \"7\": {{\"value\": \"Lead {i}\"}} }}")) + "] }";
        var remainder = """{ "data": [ { "3": {"value": 501}, "7": {"value": "Lead 501"} } ] }""";

        using var db = NewDb();
        var (importer, handler) = Importer(db, full, remainder);

        var result = await importer.ImportOffersAsync(dryRun: false, CancellationToken.None);

        Assert.Equal(501, result.Fetched);
        Assert.Equal(501, db.Offers.Count());
        Assert.Equal(2, handler.Calls);   // it asked for a second page
    }

    [Theory]
    [InlineData("true", true)]
    [InlineData("True", true)]
    [InlineData("1", true)]
    [InlineData("false", false)]
    [InlineData("0", false)]
    [InlineData("", false)]
    public async Task Checkbox_values_are_read_the_way_quickbase_sends_them(string raw, bool expected)
    {
        var offers = $$"""{ "data": [ { "3": {"value": 41}, "13": {"value": "{{raw}}"} } ] }""";

        using var db = NewDb();
        var (importer, _) = Importer(db, offers, NoRows);

        await importer.ImportOffersAsync(dryRun: false, CancellationToken.None);

        Assert.Equal(expected, db.Offers.Single().ReachedOut);
    }

    [Fact]
    public async Task Comparison_flags_a_checkbox_that_sql_has_not_learned_about()
    {
        // The acceptance gate before cutover: if sales ticks "reached out to?" in
        // Quickbase and SQL never hears, flipping the flag resets the work queue.
        var offers = """{ "data": [ { "3": {"value": 41}, "7": {"value": "Ivan"}, "13": {"value": true} } ] }""";

        using var db = NewDb();
        db.Offers.Add(new Data.Entities.Offer { QuickbaseRecordId = 41, Name = "Ivan", ReachedOut = false });
        await db.SaveChangesAsync();

        var (importer, _) = Importer(db, offers, NoRows, NoRows, NoRows);
        var (compared, diffs) = await importer.CompareAsync(CancellationToken.None);

        Assert.Equal(1, compared);
        var diff = Assert.Single(diffs);
        Assert.Equal("ReachedOut", diff.Field);
        Assert.Equal("True", diff.Quickbase);
        Assert.Equal("False", diff.Sql);
    }
}
