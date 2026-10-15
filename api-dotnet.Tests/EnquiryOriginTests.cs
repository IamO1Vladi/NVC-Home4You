using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Controllers;
using Data;
using Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The page an enquiry that is not about a house came from (2026-10-15): the doors page, the
// interiors/renovation page and the About page post the ordinary offer with one optional key,
// "origin". What has to hold: only the three keys pass, anything else is a 400 naming
// "origin"; staff read one Bulgarian line below the model and representative lines in both
// stores; the sales mail is tagged but still goes to the sales list; promotion stamps Source;
// a partner block wins over an origin; and a body without the key is treated exactly as before.
public class EnquiryOriginTests
{
    private const string ModelLine = "Модел от сайта: Космическа къща";
    private const string RepLine = "Представител: dtodorov";
    private const string DoorsLine = "Запитване за врати";
    private const string Words = "Трябват ни 12 врати за обект в Банско.";

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static EnvConfig WithRegistry() => Config(("REPRESENTATIVES", "dtodorov=dtodorov@nvc-home4you.eu"));

    private static OfferDto AnOffer(string? origin, string? rep = null, PartnerDto? partner = null, string? phone = null) =>
        new("Иван", "ivan@example.com", phone, Words, null, "bg", Rep: rep, Partner: partner, Origin: origin);

    private static PartnerDto Reseller() => new("reseller", Quantity: "6-10", Country: "BG");

    // --- Validation ----------------------------------------------------------------------------

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("doors")]
    [InlineData("interiors")]
    [InlineData("about")]
    [InlineData(" doors ")]
    public void The_three_keys_or_none_pass(string? origin)
    {
        Assert.Empty(EnquiryOrigin.Validate(AnOffer(origin)));
    }

    [Theory]
    [InlineData("Doors")]        // case matters: the SPA sends its own constants
    [InlineData("partner")]
    [InlineData("gallery")]
    [InlineData("<b>doors</b>")]
    public void Any_other_key_is_refused_by_name(string origin)
    {
        var error = Assert.Single(EnquiryOrigin.Validate(AnOffer(origin)));

        Assert.Equal("origin", error.Key);
        Assert.Equal("Must be one of: doors, interiors, about.", Assert.Single(error.Value));
    }

    private static string SpaFixture()
    {
        var dir = new System.IO.DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !System.IO.Directory.Exists(System.IO.Path.Combine(dir.FullName, "NVC Claude version")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return System.IO.File.ReadAllText(System.IO.Path.Combine(
            dir!.FullName, "NVC Claude version", "src", "lib", "__fixtures__", "enquiry-origins.json"));
    }

    [Fact]
    public void The_keys_and_lines_are_the_ones_the_spa_contract_names()
    {
        // src/lib/sendOffer.test.js checks the helper's keys, and AdminInquiriesPage.test.jsx
        // the badge's lines, against this same file.
        using var doc = JsonDocument.Parse(SpaFixture());
        var root = doc.RootElement;

        Assert.Equal(root.GetProperty("origins").EnumerateArray().Select(x => x.GetString()!), EnquiryOrigin.Keys);
        foreach (var p in root.GetProperty("lines").EnumerateObject())
            Assert.Equal(p.Value.GetString(), EnquiryOrigin.Lines[p.Name]);
        Assert.Equal(EnquiryOrigin.Keys.Count, root.GetProperty("lines").EnumerateObject().Count());
    }

    // --- The line ------------------------------------------------------------------------------

    [Theory]
    [InlineData("doors", "Запитване за врати")]
    [InlineData("interiors", "Запитване за ремонт")]
    [InlineData("about", "Запитване от страницата „За нас“")]
    public void Each_key_writes_its_line_in_front_of_the_words(string origin, string line)
    {
        Assert.Equal(line + "\n\n" + Words, EnquiryOrigin.Prepend(Words, AnOffer(origin)));
        Assert.Equal(line, EnquiryOrigin.Prepend("  ", AnOffer(origin)));
    }

    [Fact]
    public void No_key_or_an_unknown_one_writes_nothing()
    {
        Assert.Equal(Words, EnquiryOrigin.Prepend(Words, AnOffer(null)));
        Assert.Equal(Words, EnquiryOrigin.Prepend(Words, AnOffer("villa")));   // a caller that skipped Validate
    }

    [Fact]
    public void A_partner_block_wins_and_the_origin_is_ignored()
    {
        var dto = AnOffer("doors", partner: Reseller());

        Assert.Null(EnquiryOrigin.Effective(dto));
        Assert.Null(EnquiryOrigin.Line(dto));
        Assert.Equal(Words, EnquiryOrigin.Prepend(Words, dto));
    }

    // --- The stores ----------------------------------------------------------------------------

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase($"origin-{Guid.NewGuid()}").Options);

    private static SqlLeadService Sql(AppDbContext db, EnvConfig? env = null) =>
        new(db, env ?? Config(), NullLogger<SqlLeadService>.Instance);

    [Fact]
    public async Task Sql_stores_the_line_above_the_words()
    {
        using var db = NewDb();

        await Sql(db).CreateOfferAsync(AnOffer("doors"), CancellationToken.None);

        Assert.Equal(DoorsLine + "\n\n" + Words, db.Offers.Single().Message);
    }

    [Fact]
    public async Task Sql_keeps_the_model_line_first_and_the_representative_second()
    {
        using var db = NewDb();
        var dto = AnOffer("doors", rep: "dtodorov") with { ModelId = "15", ModelTitle = "Космическа къща" };

        await Sql(db, WithRegistry()).CreateOfferAsync(dto, CancellationToken.None);

        var message = db.Offers.Single().Message!;
        Assert.Equal(ModelLine + "\n\n" + RepLine + "\n\n" + DoorsLine + "\n\n" + Words, message);
        Assert.True(OfferModel.HasModelLine(message));
        Assert.Equal("doors", EnquiryOrigin.KeyIn(message));
    }

    [Fact]
    public async Task Sql_stores_only_the_partner_line_when_both_arrive()
    {
        using var db = NewDb();

        await Sql(db).CreateOfferAsync(AnOffer("interiors", partner: Reseller(), phone: "+359 88 000 0000"), CancellationToken.None);

        var message = db.Offers.Single().Message!;
        Assert.Equal(PartnerEnquiry.Line(Reseller()) + "\n\n" + Words, message);
        Assert.Null(EnquiryOrigin.KeyIn(message));
    }

    [Fact]
    public async Task An_offer_without_an_origin_is_stored_exactly_as_before()
    {
        using var db = NewDb();

        await Sql(db).CreateOfferAsync(AnOffer(null), CancellationToken.None);

        Assert.Equal(Words, db.Offers.Single().Message);
    }

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

    [Fact]
    public async Task The_quickbase_copy_carries_the_same_line_below_the_representative()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
            ["QUICKBASE_TOKEN"] = "token",
            ["QB_TABLE_OFFER"] = "bqoffers",
            ["REPRESENTATIVES"] = "dtodorov=dtodorov@nvc-home4you.eu",
        }).Build();
        var env = new EnvConfig(cfg);
        var wire = new RecordingHandler();
        var http = new HttpClient(wire) { BaseAddress = new Uri("https://api.quickbase.com/") };
        var store = new FormService(new QuickbaseClient(http, env, cfg), env, NullLogger<FormService>.Instance);

        Assert.True((await store.CreateOfferAsync(AnOffer("doors", rep: "dtodorov"), CancellationToken.None)).Ok);

        using var body = JsonDocument.Parse(Assert.Single(wire.Bodies));
        var record = Assert.Single(body.RootElement.GetProperty("data").EnumerateArray());
        Assert.Equal(RepLine + "\n\n" + DoorsLine + "\n\n" + Words,
            record.GetProperty(env.F_OFFER_MESSAGE.ToString()).GetProperty("value").GetString());
    }

    // --- The controller ------------------------------------------------------------------------

    private sealed class FakeLeadStore : ILeadStore
    {
        public OfferDto? LastOffer { get; private set; }
        public int OfferCalls { get; private set; }

        public Task<LeadWriteResult> CreateOfferAsync(OfferDto dto, CancellationToken ct = default)
        {
            OfferCalls++;
            LastOffer = dto;
            return Task.FromResult(LeadWriteResult.Succeeded(1));
        }

        public Task<LeadWriteResult> CreateQuestionAsync(QuestionDto dto, CancellationToken ct = default) =>
            Task.FromResult(LeadWriteResult.Succeeded(2));
    }

    private static OfferController Controller(ILeadStore store)
    {
        var env = Config();
        return new OfferController(store, new EmailService(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance),
            env, new NullRepresentativeIntake(), NullLogger<OfferController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
    }

    [Fact]
    public async Task An_unknown_origin_is_a_400_naming_the_field_and_nothing_is_stored()
    {
        var store = new FakeLeadStore();

        var result = await Controller(store).Post(AnOffer("windows"), CancellationToken.None);

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsType<BadRequestObjectResult>(result).Value);
        Assert.Equal("origin", Assert.Single(problem.Errors).Key);
        Assert.Equal(0, store.OfferCalls);
    }

    [Fact]
    public async Task A_broken_partner_block_and_a_broken_origin_are_named_together()
    {
        var store = new FakeLeadStore();

        var result = await Controller(store).Post(
            AnOffer("windows", partner: Reseller() with { Quantity = "lots" }, phone: "+359 88 000 0000"), CancellationToken.None);

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsType<BadRequestObjectResult>(result).Value);
        Assert.Equal(new[] { "origin", "partner.quantity" }, problem.Errors.Keys.OrderBy(k => k, StringComparer.Ordinal));
        Assert.Equal(0, store.OfferCalls);
    }

    [Fact]
    public async Task A_known_origin_reaches_the_store_with_no_phone_needed()
    {
        var store = new FakeLeadStore();

        Assert.IsType<OkObjectResult>(await Controller(store).Post(AnOffer("interiors"), CancellationToken.None));
        Assert.Equal("interiors", store.LastOffer!.Origin);
    }

    [Fact]
    public async Task A_bot_with_a_broken_origin_still_gets_the_decoy()
    {
        var store = new FakeLeadStore();

        var result = await Controller(store).Post(AnOffer("bot") with { Website = "http://spam.example" }, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(0, store.OfferCalls);
    }

    [Fact]
    public void The_key_binds_from_the_json_the_spa_sends()
    {
        var options = new Microsoft.AspNetCore.Mvc.JsonOptions().JsonSerializerOptions;
        var dto = JsonSerializer.Deserialize<OfferDto>(
            """{"name":"Иван","email":"ivan@example.com","phone":"","project":"Hi","modelId":"","locale":"bg","rep":"","website":"","origin":"doors"}""",
            options)!;

        Assert.Equal("doors", dto.Origin);
        Assert.Empty(EnquiryOrigin.Validate(dto));
    }

    [Fact]
    public void An_older_payload_binds_with_no_origin_and_writes_no_line()
    {
        var options = new Microsoft.AspNetCore.Mvc.JsonOptions().JsonSerializerOptions;
        var dto = JsonSerializer.Deserialize<OfferDto>(
            """{"name":"Ivan","email":"ivan@example.com","phone":"","project":"Hi","modelId":"","locale":"bg"}""", options)!;

        Assert.Null(dto.Origin);
        Assert.Empty(EnquiryOrigin.Validate(dto));
        Assert.Equal("Hi", EnquiryOrigin.Prepend(dto.Project, dto));
    }

    // --- The mail ------------------------------------------------------------------------------

    private static (string Subject, string Html) Render(string? origin, string? partnerLine = null)
    {
        var service = new EmailService(Config(), new StubHttpClientFactory(), NullLogger<EmailService>.Instance);
        var method = typeof(EmailService).GetMethod("BuildLeadNotification", BindingFlags.Instance | BindingFlags.NonPublic)!;
        var result = method.Invoke(service,
            new object?[] { true, "Иван", "ivan@example.com", null, Words, null, null, partnerLine, origin })!;

        var type = result.GetType();
        return ((string)type.GetField("Item1")!.GetValue(result)!, (string)type.GetField("Item2")!.GetValue(result)!);
    }

    [Theory]
    [InlineData("doors", "[Врати] Ново запитване за оферта: Иван")]
    [InlineData("interiors", "[Ремонт] Ново запитване за оферта: Иван")]
    [InlineData("about", "[За нас] Ново запитване за оферта: Иван")]
    [InlineData(null, "Ново запитване за оферта: Иван")]
    public void The_subject_is_tagged_and_keeps_the_rest(string? origin, string expected)
    {
        Assert.Equal(expected, Render(origin).Subject);
    }

    [Fact]
    public void The_line_opens_the_body()
    {
        var (_, html) = Render("doors");

        var line = html.IndexOf(DoorsLine, StringComparison.Ordinal);
        Assert.True(line >= 0);
        Assert.True(line < html.IndexOf("Име:", StringComparison.Ordinal));
    }

    [Fact]
    public void Next_to_a_partner_line_the_partner_mail_is_unchanged()
    {
        var partnerLine = PartnerEnquiry.Line(Reseller())!;

        var (subject, html) = Render("doors", partnerLine);

        Assert.Equal("[Партньор] Ново запитване за оферта: Иван", subject);
        Assert.DoesNotContain(DoorsLine, html);
    }

    private sealed class HandlerFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;
        public HandlerFactory(HttpMessageHandler handler) => _handler = handler;
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }

    [Fact]
    public async Task On_the_wire_a_doors_enquiry_still_goes_to_the_sales_list()
    {
        var env = Config(
            ("GRAPH_TENANT_ID", "tenant"), ("GRAPH_CLIENT_ID", "client"), ("GRAPH_CLIENT_SECRET", "secret"),
            ("GRAPH_SENDER", "contact@nvc-home4you.eu"), ("LEAD_NOTIFY_EMAIL", "sales@nvc-home4you.eu"),
            ("PARTNER_NOTIFY_EMAIL", "owner@nvc-home4you.eu"));
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, """{ "access_token": "tok", "expires_in": 3600 }""");
        var factory = new HandlerFactory(graph);
        var service = new EmailService(env, factory, NullLogger<EmailService>.Instance, new GraphTokens(env, factory));

        Assert.True(await service.TrySendLeadNotificationAsync(
            isOffer: true, "Иван", "ivan@example.com", null, Words, CancellationToken.None, origin: "doors"));

        Assert.Equal(2, graph.Calls.Count);
        var message = JsonDocument.Parse(graph.Calls[1].Body).RootElement.GetProperty("message");
        var to = message.GetProperty("toRecipients").EnumerateArray()
            .Select(r => r.GetProperty("emailAddress").GetProperty("address").GetString()!).ToArray();
        Assert.Equal(new[] { "sales@nvc-home4you.eu" }, to);
        Assert.Equal("[Врати] Ново запитване за оферта: Иван", message.GetProperty("subject").GetString());
    }

    // --- Source on promotion -------------------------------------------------------------------

    private static async Task<Lead> Promote(string message, string? source = null)
    {
        using var db = NewDb();
        db.Offers.Add(new Offer
        {
            Id = 7, Name = "Иван", Email = "ivan@example.com", Message = message, Locale = "bg",
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();

        return (await new LeadService(db).PromoteAsync("offer", 7, "sales@nvc-home4you.eu", source)).Lead!;
    }

    [Theory]
    [InlineData("doors", "Страница за врати")]
    [InlineData("interiors", "Страница за ремонти")]
    [InlineData("about", "Страница „За нас“")]
    public async Task The_panels_promote_stamps_the_page(string origin, string expected)
    {
        var lead = await Promote(EnquiryOrigin.Prepend(Words, AnOffer(origin))!);

        Assert.Equal(expected, lead.Source);
        Assert.True(lead.Source!.Length <= PartnerEnquiry.MaxSourceLength);
    }

    [Fact]
    public async Task Below_a_model_line_the_line_is_still_found()
    {
        Assert.Equal("Страница за врати", (await Promote(ModelLine + "\n\n" + DoorsLine + "\n\n" + Words)).Source);
    }

    [Fact]
    public async Task A_representatives_lead_stays_his_and_says_where_it_came_from()
    {
        var lead = await Promote(RepLine + "\n\n" + DoorsLine + "\n\n" + Words, source: "Представител: dtodorov");

        Assert.Equal("Представител: dtodorov · врати", lead.Source);
    }

    [Fact]
    public async Task A_stamp_too_long_for_the_column_keeps_the_representatives()
    {
        var slug = new string('a', 40);

        var lead = await Promote($"Представител: {slug}\n\nЗапитване от страницата „За нас“", source: $"Представител: {slug}");

        Assert.Equal($"Представител: {slug}", lead.Source);
    }

    [Fact]
    public async Task A_partner_enquiry_keeps_the_partner_stamp()
    {
        var lead = await Promote(PartnerEnquiry.Line(Reseller()) + "\n\n" + Words);

        Assert.Equal("Партньорска страница · Препродавач", lead.Source);
    }

    [Theory]
    [InlineData("Здравейте\n\nЗапитване за врати")]          // below the visitor's words
    [InlineData("Запитване за врати и прозорци")]            // not the whole paragraph
    [InlineData("Hi")]
    public void Only_a_line_in_the_place_the_server_writes_it_counts(string message)
    {
        Assert.Null(EnquiryOrigin.KeyIn(message));
        Assert.Null(EnquiryOrigin.SourceFor(message, null));
        Assert.Equal("Представител: x", EnquiryOrigin.SourceFor(message, "Представител: x"));
    }
}
