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

// The partner page's enquiry (2026-10-15), end to end through everything the server owns.
//
// The form posts the ordinary offer with one extra block. What has to hold: every choice is
// checked against a fixed list and a phone comes with it, or nothing is stored; staff read one
// Bulgarian line built only from our own labels, below the model and representative lines in
// both stores; the sales mail becomes a "[Партньор]" mail to the owner and nlekov instead of
// the sales list; and promoting the enquiry stamps the lead's Source from that line, keeping
// a representative who brought it in.
public class PartnerEnquiryTests
{
    private const string ModelLine = "Модел от сайта: Космическа къща";
    private const string RepLine = "Представител: dtodorov";

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static EnvConfig WithRegistry() => Config(("REPRESENTATIVES", "dtodorov=dtodorov@nvc-home4you.eu"));

    private static PartnerDto Reseller() => new(
        Role: "reseller", Sector: "shop", Products: new[] { "box58", "container" }, Quantity: "6-10",
        Timing: "1-3m", Country: "GR", Region: "Солун", Company: "Domus EE", VatId: "EL123456789",
        Logistics: "own");

    private const string ResellerLine =
        "Партньорско запитване · Препродавач · Магазин · Гърция, Солун · Контейнери, Бокс 58 · 6–10 бр. · " +
        "1–3 месеца · Собствена логистика · Фирма: Domus EE · ЕИК/ДДС: EL123456789";

    private static OfferDto AnOffer(PartnerDto? partner, string? phone = "+30 231 000 0000", string? rep = null) =>
        new("Nikos", "nikos@example.gr", phone, "We have a shop near Thessaloniki.", null, "el",
            Rep: rep, Partner: partner);

    // --- Validation ------------------------------------------------------------------------

    [Fact]
    public void An_offer_without_the_block_is_not_the_partner_rules_business()
    {
        // Every other form, including one with no phone: the phone rule is the block's alone.
        Assert.Empty(PartnerEnquiry.Validate(AnOffer(null, phone: null)));
    }

    [Fact]
    public void A_complete_block_with_a_phone_passes()
    {
        Assert.Empty(PartnerEnquiry.Validate(AnOffer(Reseller())));
    }

    [Fact]
    public void The_three_required_choices_are_required()
    {
        var errors = PartnerEnquiry.Validate(AnOffer(new PartnerDto(Role: null)));

        Assert.Equal(new[] { "partner.country", "partner.quantity", "partner.role" }, errors.Keys.OrderBy(k => k, StringComparer.Ordinal));
        Assert.All(errors.Values, v => Assert.Equal(new[] { "Required." }, v));
    }

    [Theory]
    [InlineData("role")]
    [InlineData("sector")]
    [InlineData("quantity")]
    [InlineData("timing")]
    [InlineData("country")]
    [InlineData("logistics")]
    public void An_unknown_key_in_any_choice_is_refused_by_name(string field)
    {
        var p = Reseller();
        p = field switch
        {
            "role" => p with { Role = "Reseller" },              // case matters: the SPA sends its own constants
            "sector" => p with { Sector = "<b>bar</b>" },
            "quantity" => p with { Quantity = "100" },
            "timing" => p with { Timing = "yesterday" },
            "country" => p with { Country = "Bulgaria" },
            "logistics" => p with { Logistics = "drone" },
            _ => throw new ArgumentOutOfRangeException(nameof(field)),
        };

        var errors = PartnerEnquiry.Validate(AnOffer(p));

        var error = Assert.Single(errors);
        Assert.Equal("partner." + field, error.Key);
        Assert.StartsWith("Must be one of: ", Assert.Single(error.Value));
    }

    [Fact]
    public void One_unknown_product_refuses_the_list()
    {
        var errors = PartnerEnquiry.Validate(AnOffer(Reseller() with { Products = new[] { "container", "villa" } }));

        Assert.Equal("partner.products", Assert.Single(errors).Key);
    }

    [Fact]
    public void A_null_in_the_product_list_is_refused_not_skipped()
    {
        var errors = PartnerEnquiry.Validate(AnOffer(Reseller() with { Products = new string[] { null! } }));

        Assert.Equal("partner.products", Assert.Single(errors).Key);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_partner_enquiry_needs_a_phone(string? phone)
    {
        var errors = PartnerEnquiry.Validate(AnOffer(Reseller(), phone));

        Assert.Equal("phone", Assert.Single(errors).Key);
    }

    [Fact]
    public void Keys_are_trimmed_before_they_are_matched()
    {
        Assert.Empty(PartnerEnquiry.Validate(AnOffer(new PartnerDto(" ownSite ", Quantity: "25+ ", Country: " nonEU"))));
    }

    // The SPA's own fixture files (NVC Claude version/src/components/partner/__fixtures__),
    // found by walking up from the test binaries to the folder that holds both projects.
    private static string SpaFixture(string name)
    {
        var dir = new System.IO.DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !System.IO.Directory.Exists(System.IO.Path.Combine(dir.FullName, "NVC Claude version")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return System.IO.File.ReadAllText(System.IO.Path.Combine(
            dir!.FullName, "NVC Claude version", "src", "components", "partner", "__fixtures__", name));
    }

    [Fact]
    public void The_lists_are_the_ones_the_form_contract_names()
    {
        // The SPA's PartnerEnquiry sends exactly these; a key added on one side only is a 400.
        // partner-lists.json is the file PartnerEnquiry.contract.test.jsx checks the form's
        // own lists against, so the two sides are compared through it, not typed twice.
        using var lists = JsonDocument.Parse(SpaFixture("partner-lists.json"));
        var root = lists.RootElement;
        string[] Keys(string name) => root.GetProperty(name).EnumerateArray().Select(x => x.GetString()!).ToArray();

        Assert.Equal(Keys("role"), PartnerEnquiry.Roles);
        Assert.Equal(Keys("sector"), PartnerEnquiry.Sectors);
        Assert.Equal(Keys("products"), PartnerEnquiry.Products);
        Assert.Equal(Keys("quantity"), PartnerEnquiry.Quantities);
        Assert.Equal(Keys("timing"), PartnerEnquiry.Timings);
        Assert.Equal(Keys("country"), PartnerEnquiry.Countries);
        Assert.Equal(Keys("logistics"), PartnerEnquiry.LogisticsOptions);

        var limits = root.GetProperty("limits");
        Assert.Equal(limits.GetProperty("region").GetInt32(), PartnerEnquiry.MaxRegionLength);
        Assert.Equal(limits.GetProperty("company").GetInt32(), PartnerEnquiry.MaxCompanyLength);
        Assert.Equal(limits.GetProperty("vatId").GetInt32(), PartnerEnquiry.MaxVatIdLength);
    }

    // --- The line ----------------------------------------------------------------------------

    [Fact]
    public void A_full_block_reads_as_one_bulgarian_line_with_products_in_list_order()
    {
        // Products arrived box58-first; the line lists them in the list's order.
        Assert.Equal(ResellerLine, PartnerEnquiry.Line(Reseller()));
    }

    [Fact]
    public void Only_what_was_chosen_is_written()
    {
        Assert.Equal(
            "Партньорско запитване · За свой обект · България · 2–5 бр.",
            PartnerEnquiry.Line(new PartnerDto("ownSite", Quantity: "2-5", Country: "BG")));
    }

    [Theory]
    [InlineData("reseller", "Препродавач")]
    [InlineData("ownSite", "За свой обект")]
    [InlineData("other", "Друго")]
    public void Every_role_has_its_label(string key, string label)
    {
        Assert.Equal($"Партньорско запитване · {label} · България · 2–5 бр.",
            PartnerEnquiry.Line(new PartnerDto(key, Quantity: "2-5", Country: "BG")));
    }

    [Theory]
    [InlineData("glamping", "Къмпинг/глемпинг")]
    [InlineData("hotel", "Хотел/къща за гости")]
    [InlineData("construction", "Строителна фирма")]
    [InlineData("farm", "Стопанство")]
    [InlineData("investor", "Инвеститор")]
    [InlineData("shop", "Магазин")]
    [InlineData("realEstate", "Агенция за имоти")]
    [InlineData("other", "Друга сфера")]
    public void Every_sector_has_its_label(string key, string label)
    {
        Assert.Equal($"Партньорско запитване · За свой обект · {label} · България · 2–5 бр.",
            PartnerEnquiry.Line(new PartnerDto("ownSite", Sector: key, Quantity: "2-5", Country: "BG")));
    }

    [Theory]
    [InlineData("container", "Контейнери")]
    [InlineData("box37", "Бокс 37")]
    [InlineData("box58", "Бокс 58")]
    [InlineData("box73", "Бокс 73")]
    [InlineData("steel", "Сглобяема къща по проект")]
    public void Every_product_has_its_label(string key, string label)
    {
        Assert.Equal($"Партньорско запитване · Препродавач · България · {label} · 2–5 бр.",
            PartnerEnquiry.Line(new PartnerDto("reseller", Products: new[] { key }, Quantity: "2-5", Country: "BG")));
    }

    [Theory]
    [InlineData("2-5", "2–5 бр.")]
    [InlineData("6-10", "6–10 бр.")]
    [InlineData("11-25", "11–25 бр.")]
    [InlineData("25+", "25+ бр.")]
    public void Every_quantity_has_its_label(string key, string label)
    {
        Assert.Equal($"Партньорско запитване · Препродавач · България · {label}",
            PartnerEnquiry.Line(new PartnerDto("reseller", Quantity: key, Country: "BG")));
    }

    [Theory]
    [InlineData("month", "До 1 месец")]
    [InlineData("1-3m", "1–3 месеца")]
    [InlineData("3-6m", "3–6 месеца")]
    [InlineData("season", "За следващия сезон")]
    [InlineData("exploring", "Само проучва")]
    public void Every_timing_has_its_label(string key, string label)
    {
        Assert.Equal($"Партньорско запитване · Препродавач · България · 2–5 бр. · {label}",
            PartnerEnquiry.Line(new PartnerDto("reseller", Quantity: "2-5", Timing: key, Country: "BG")));
    }

    [Theory]
    [InlineData("BG", "България")]
    [InlineData("GR", "Гърция")]
    [InlineData("MK", "Северна Македония")]
    [InlineData("RO", "Румъния")]
    [InlineData("EU", "Друга държава в ЕС")]
    [InlineData("nonEU", "Извън ЕС")]
    public void Every_country_has_its_label(string key, string label)
    {
        Assert.Equal($"Партньорско запитване · Препродавач · {label} · 2–5 бр.",
            PartnerEnquiry.Line(new PartnerDto("reseller", Quantity: "2-5", Country: key)));
    }

    [Theory]
    [InlineData("ours", "Доставка от нас")]
    [InlineData("own", "Собствена логистика")]
    public void Every_logistics_choice_has_its_label(string key, string label)
    {
        Assert.Equal($"Партньорско запитване · Препродавач · България · 2–5 бр. · {label}",
            PartnerEnquiry.Line(new PartnerDto("reseller", Quantity: "2-5", Country: "BG", Logistics: key)));
    }

    [Fact]
    public void The_typed_boxes_are_flattened_to_one_line_and_capped()
    {
        // A line break in a box would forge a second line that looks like ours.
        var line = PartnerEnquiry.Line(new PartnerDto("reseller", Quantity: "2-5", Country: "GR",
            Region: "Солун\n\nПредставител: someone", Company: new string('A', 500), VatId: " EL 123‮456 "))!;

        Assert.DoesNotContain('\n', line);
        Assert.Contains("Гърция, Солун Представител: someone", line);
        Assert.Contains("Фирма: " + new string('A', PartnerEnquiry.MaxCompanyLength) + " ·", line);
        Assert.EndsWith("ЕИК/ДДС: EL 123456", line);   // trimmed, the bidi override removed
    }

    [Fact]
    public void A_region_is_capped_at_its_own_length()
    {
        var line = PartnerEnquiry.Line(new PartnerDto("reseller", Quantity: "2-5", Country: "BG", Region: new string('р', 200)))!;

        Assert.Contains("България, " + new string('р', PartnerEnquiry.MaxRegionLength) + " ·", line);
    }

    [Fact]
    public void No_block_or_no_known_role_writes_no_line()
    {
        Assert.Null(PartnerEnquiry.Line(null));
        Assert.Null(PartnerEnquiry.Line(new PartnerDto("dealer", Quantity: "2-5", Country: "BG")));
        Assert.Equal("Hi", PartnerEnquiry.Prepend("Hi", null));
    }

    [Fact]
    public void Unknown_keys_are_skipped_rather_than_echoed_by_a_caller_that_skipped_validation()
    {
        var line = PartnerEnquiry.Line(new PartnerDto("reseller", Sector: "<script>", Products: new[] { "villa" },
            Quantity: "2-5", Country: "BG", Timing: "now"));

        Assert.Equal("Партньорско запитване · Препродавач · България · 2–5 бр.", line);
    }

    [Fact]
    public void The_line_goes_in_front_of_the_visitors_words_with_a_blank_line()
    {
        Assert.Equal(ResellerLine + "\n\nHello", PartnerEnquiry.Prepend("  Hello  ", Reseller()));
        Assert.Equal(ResellerLine, PartnerEnquiry.Prepend("", Reseller()));
    }

    // --- The stores --------------------------------------------------------------------------

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"partner-{Guid.NewGuid()}")
            .Options);

    private static SqlLeadService Sql(AppDbContext db, EnvConfig? env = null) =>
        new(db, env ?? Config(), NullLogger<SqlLeadService>.Instance);

    [Fact]
    public async Task Sql_stores_the_line_above_the_visitors_words()
    {
        using var db = NewDb();

        await Sql(db).CreateOfferAsync(AnOffer(Reseller()), CancellationToken.None);

        Assert.Equal(ResellerLine + "\n\nWe have a shop near Thessaloniki.", db.Offers.Single().Message);
    }

    [Fact]
    public async Task Sql_keeps_the_model_line_first_and_the_representative_second()
    {
        // The house is resolved off the first line and the rep is read off his; the partner
        // line must not push either down.
        using var db = NewDb();
        var dto = AnOffer(Reseller(), rep: "dtodorov") with
        {
            ModelId = "15", ModelTitle = "Космическа къща",
        };

        await Sql(db, WithRegistry()).CreateOfferAsync(dto, CancellationToken.None);

        var message = db.Offers.Single().Message!;
        Assert.Equal(ModelLine + "\n\n" + RepLine + "\n\n" + ResellerLine + "\n\nWe have a shop near Thessaloniki.", message);
        Assert.True(OfferModel.HasModelLine(message));
        Assert.Equal("Препродавач", PartnerEnquiry.RoleIn(message));
    }

    [Fact]
    public async Task An_ordinary_offer_is_stored_exactly_as_before()
    {
        using var db = NewDb();

        await Sql(db).CreateOfferAsync(AnOffer(null), CancellationToken.None);

        Assert.Equal("We have a shop near Thessaloniki.", db.Offers.Single().Message);
    }

    // What FormService posts to Quickbase, read off the wire as QuickbaseLeadStoreTests does.
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

        var write = await store.CreateOfferAsync(AnOffer(Reseller(), rep: "dtodorov"), CancellationToken.None);

        Assert.True(write.Ok);
        using var body = JsonDocument.Parse(Assert.Single(wire.Bodies));
        var record = Assert.Single(body.RootElement.GetProperty("data").EnumerateArray());
        Assert.Equal(RepLine + "\n\n" + ResellerLine + "\n\nWe have a shop near Thessaloniki.",
            record.GetProperty(env.F_OFFER_MESSAGE.ToString()).GetProperty("value").GetString());
    }

    // --- The controller ----------------------------------------------------------------------

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
    public async Task A_block_out_of_step_with_the_lists_is_a_400_naming_the_field_and_nothing_is_stored()
    {
        var store = new FakeLeadStore();

        var result = await Controller(store).Post(AnOffer(Reseller() with { Quantity = "lots" }), CancellationToken.None);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(bad.Value);
        Assert.Equal("partner.quantity", Assert.Single(problem.Errors).Key);
        Assert.Equal(0, store.OfferCalls);
    }

    [Fact]
    public async Task A_partner_enquiry_without_a_phone_is_refused()
    {
        var store = new FakeLeadStore();

        var result = await Controller(store).Post(AnOffer(Reseller(), phone: null), CancellationToken.None);

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsType<BadRequestObjectResult>(result).Value);
        Assert.Equal("phone", Assert.Single(problem.Errors).Key);
        Assert.Equal(0, store.OfferCalls);
    }

    [Fact]
    public async Task A_valid_block_reaches_the_store_and_an_ordinary_offer_still_needs_no_phone()
    {
        var store = new FakeLeadStore();

        Assert.IsType<OkObjectResult>(await Controller(store).Post(AnOffer(Reseller()), CancellationToken.None));
        Assert.Equal("reseller", store.LastOffer!.Partner!.Role);

        Assert.IsType<OkObjectResult>(await Controller(store).Post(AnOffer(null, phone: null), CancellationToken.None));
    }

    [Fact]
    public async Task A_bot_with_a_broken_block_still_gets_the_decoy()
    {
        var store = new FakeLeadStore();

        var result = await Controller(store).Post(
            AnOffer(new PartnerDto("bot")) with { Website = "http://spam.example" }, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(0, store.OfferCalls);
    }

    [Fact]
    public void The_block_binds_from_the_json_the_spa_sends()
    {
        // The options MVC reads request bodies with, so this is the binding the controller gets.
        var options = new Microsoft.AspNetCore.Mvc.JsonOptions().JsonSerializerOptions;
        const string json = """
            {"name":"Nikos","email":"nikos@example.gr","phone":"+30 231 000 0000","project":"Hi","modelId":null,"locale":"el",
             "rep":null,"website":"",
             "partner":{"role":"reseller","sector":"shop","products":["container","box58"],"quantity":"6-10",
                        "timing":"1-3m","country":"GR","region":"Солун","company":"Domus EE","vatId":"EL123456789",
                        "logistics":"own"}}
            """;

        var dto = JsonSerializer.Deserialize<OfferDto>(json, options)!;

        Assert.Empty(PartnerEnquiry.Validate(dto));
        Assert.Equal(new[] { "container", "box58" }, dto.Partner!.Products);
        Assert.Equal("EL123456789", dto.Partner.VatId);
        Assert.Equal(ResellerLine, PartnerEnquiry.Line(dto.Partner));
    }

    [Fact]
    public void An_older_payload_without_the_block_binds_with_none()
    {
        var options = new Microsoft.AspNetCore.Mvc.JsonOptions().JsonSerializerOptions;
        var dto = JsonSerializer.Deserialize<OfferDto>(
            """{"name":"Ivan","email":"ivan@example.com","phone":"","project":"Hi","modelId":"","locale":"bg"}""", options)!;

        Assert.Null(dto.Partner);
    }

    [Fact]
    public async Task The_spa_fixture_is_accepted_and_stored_with_its_line()
    {
        // The exact body the real form posts: PartnerEnquiry.contract.test.jsx fills the Greek
        // form and checks its POST against this same file, so a change on either side fails one
        // of the two. Bound with the options MVC reads request bodies with.
        var json = SpaFixture("partner-offer.json");

        var dto = JsonSerializer.Deserialize<OfferDto>(json, new Microsoft.AspNetCore.Mvc.JsonOptions().JsonSerializerOptions)!;

        Assert.Empty(PartnerEnquiry.Validate(dto));
        Assert.Equal(
            "Партньорско запитване · Препродавач · Магазин · Гърция, Θεσσαλονίκη · Контейнери, Бокс 58 · 6–10 бр. · " +
            "1–3 месеца · Собствена логистика · Фирма: Domus EE · ЕИК/ДДС: EL123456789",
            PartnerEnquiry.Line(dto.Partner));

        var store = new FakeLeadStore();
        Assert.IsType<OkObjectResult>(await Controller(store).Post(dto, CancellationToken.None));
        Assert.Equal(1, store.OfferCalls);
        Assert.Equal("reseller", store.LastOffer!.Partner!.Role);
    }

    // --- The mail ----------------------------------------------------------------------------

    [Fact]
    public void The_owner_and_nlekov_get_partner_mail_by_default()
    {
        Assert.Equal(
            new[] { "vvladimirov@nvc-home4you.eu", "nlekov@nvc-home4you.eu" },
            EmailService.PartnerRecipients(Config()));
    }

    [Fact]
    public void An_app_setting_overrides_the_partner_list()
    {
        Assert.Equal(new[] { "x@example.com" }, EmailService.PartnerRecipients(Config(("PARTNER_NOTIFY_EMAIL", "x@example.com"))));
    }

    [Fact]
    public void A_partner_setting_with_no_address_falls_back_to_the_sales_list_not_to_nobody()
    {
        var recipients = EmailService.PartnerRecipients(Config(
            ("PARTNER_NOTIFY_EMAIL", "vvladimirov"), ("LEAD_NOTIFY_EMAIL", "sales@example.com")));

        Assert.Equal(new[] { "sales@example.com" }, recipients);
    }

    private static (string Subject, string Html) Render(
        string? partnerLine, LeadIntakeNote? intake = null, string details = "We have a shop.")
    {
        var service = new EmailService(Config(), new StubHttpClientFactory(), NullLogger<EmailService>.Instance);
        var method = typeof(EmailService).GetMethod("BuildLeadNotification", BindingFlags.Instance | BindingFlags.NonPublic)!;
        var result = method.Invoke(service,
            new object?[] { true, "Nikos", "nikos@example.gr", "+30 231 000 0000", details, null, intake, partnerLine, null })!;

        var type = result.GetType();
        return ((string)type.GetField("Item1")!.GetValue(result)!, (string)type.GetField("Item2")!.GetValue(result)!);
    }

    [Fact]
    public void The_subject_starts_with_the_partner_tag_and_keeps_the_rest()
    {
        var (subject, _) = Render(ResellerLine);

        Assert.Equal("[Партньор] Ново запитване за оферта: Nikos", subject);
    }

    [Fact]
    public void The_line_is_the_first_thing_in_the_body_and_is_encoded()
    {
        var (_, html) = Render(ResellerLine.Replace("Domus EE", "Domus <b>EE</b>"));

        // HtmlEncode writes the middle dot as &#183;, which every mail client shows as "·".
        var line = html.IndexOf(WebUtility.HtmlEncode("Партньорско запитване · Препродавач"), StringComparison.Ordinal);
        Assert.True(line >= 0);
        Assert.True(line < html.IndexOf("Ново запитване за оферта от сайта", StringComparison.Ordinal));
        Assert.True(line < html.IndexOf("Име:", StringComparison.Ordinal));
        Assert.Contains("Domus &lt;b&gt;EE&lt;/b&gt;", html);
        Assert.DoesNotContain("<b>EE</b>", html);
    }

    [Fact]
    public void A_partner_enquiry_with_no_message_has_no_empty_details_box()
    {
        // The partner form's message is optional.
        var (_, html) = Render(ResellerLine, details: "");

        Assert.Contains(WebUtility.HtmlEncode("Партньорско запитване · Препродавач"), html);
        Assert.DoesNotContain("Детайли:", html);
    }

    [Fact]
    public void Without_a_line_the_mail_is_the_ordinary_one()
    {
        var (subject, html) = Render(null);

        Assert.Equal("Ново запитване за оферта: Nikos", subject);
        Assert.DoesNotContain("Партньорско", html);
    }

    // A service that will actually send, as in RepresentativeNotificationTests.
    private sealed class HandlerFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;
        public HandlerFactory(HttpMessageHandler handler) => _handler = handler;
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }

    private static (EmailService Service, GraphStubHandler Graph) Sending(params (string Key, string Value)[] extra)
    {
        var settings = new Dictionary<string, string?>
        {
            ["GRAPH_TENANT_ID"] = "tenant",
            ["GRAPH_CLIENT_ID"] = "client",
            ["GRAPH_CLIENT_SECRET"] = "secret",
            ["GRAPH_SENDER"] = "contact@nvc-home4you.eu",
            ["LEAD_NOTIFY_EMAIL"] = "sales@nvc-home4you.eu",
        };
        foreach (var (k, v) in extra) settings[k] = v;
        var env = new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(settings).Build());

        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, """{ "access_token": "tok", "expires_in": 3600 }""");
        var factory = new HandlerFactory(graph);
        return (new EmailService(env, factory, NullLogger<EmailService>.Instance, new GraphTokens(env, factory)), graph);
    }

    private static (string[] To, string Subject) Sent(GraphStubHandler graph)
    {
        Assert.Equal(2, graph.Calls.Count);
        var message = JsonDocument.Parse(graph.Calls[1].Body).RootElement.GetProperty("message");
        var to = message.GetProperty("toRecipients").EnumerateArray()
            .Select(r => r.GetProperty("emailAddress").GetProperty("address").GetString()!).ToArray();
        return (to, message.GetProperty("subject").GetString()!);
    }

    [Fact]
    public async Task On_the_wire_a_partner_enquiry_goes_to_the_partner_list_instead_of_sales()
    {
        var (service, graph) = Sending();

        var sent = await service.TrySendLeadNotificationAsync(
            isOffer: true, "Nikos", "nikos@example.gr", "+30 231 000 0000", "Hi", CancellationToken.None,
            partnerLine: ResellerLine);

        Assert.True(sent);
        var (to, subject) = Sent(graph);
        Assert.Equal(new[] { "vvladimirov@nvc-home4you.eu", "nlekov@nvc-home4you.eu" }, to);
        Assert.StartsWith("[Партньор] ", subject);
    }

    [Fact]
    public async Task On_the_wire_a_representative_is_still_copied_on_a_partner_enquiry()
    {
        var (service, graph) = Sending(("PARTNER_NOTIFY_EMAIL", "owner@nvc-home4you.eu"));
        var note = new LeadIntakeNote("dtodorov", "dtodorov@nvc-home4you.eu",
            new IntakeOutcome(true, 42, null, null, null), "https://nvc-home4you.eu");

        await service.TrySendLeadNotificationAsync(
            isOffer: true, "Nikos", "nikos@example.gr", "+30 231 000 0000", "Hi", CancellationToken.None,
            intake: note, partnerLine: ResellerLine);

        var (to, subject) = Sent(graph);
        Assert.Equal(new[] { "owner@nvc-home4you.eu", "dtodorov@nvc-home4you.eu" }, to);
        Assert.Equal("[Партньор] Ново запитване за оферта: Nikos — представител: dtodorov", subject);
    }

    [Fact]
    public async Task On_the_wire_an_ordinary_offer_still_goes_to_sales()
    {
        var (service, graph) = Sending();

        await service.TrySendLeadNotificationAsync(
            isOffer: true, "Ivan", "ivan@example.com", null, "Hi", CancellationToken.None);

        Assert.Equal(new[] { "sales@nvc-home4you.eu" }, Sent(graph).To);
    }

    // --- Source on promotion -------------------------------------------------------------------

    private static async Task<Lead> Promote(string message, string? source = null)
    {
        using var db = NewDb();
        db.Offers.Add(new Offer
        {
            Id = 7, Name = "Nikos", Email = "nikos@example.gr", Message = message, Locale = "el",
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();

        var result = await new LeadService(db).PromoteAsync("offer", 7, "sales@nvc-home4you.eu", source);
        return result.Lead!;
    }

    [Theory]
    [InlineData("reseller", "Партньорска страница · Препродавач")]
    [InlineData("ownSite", "Партньорска страница · За свой обект")]
    [InlineData("other", "Партньорска страница · Друго")]
    public async Task The_panels_promote_stamps_the_partner_page_and_the_role(string role, string expected)
    {
        var line = PartnerEnquiry.Line(new PartnerDto(role, Quantity: "2-5", Country: "BG"))!;

        var lead = await Promote(line + "\n\nHi");

        Assert.Equal(expected, lead.Source);
        Assert.True(lead.Source!.Length <= PartnerEnquiry.MaxSourceLength);
    }

    [Fact]
    public async Task Below_a_model_line_the_line_is_still_found()
    {
        var lead = await Promote(ModelLine + "\n\n" + ResellerLine + "\n\nHi");

        Assert.Equal("Партньорска страница · Препродавач", lead.Source);
    }

    [Fact]
    public async Task A_representatives_partner_lead_stays_his_and_says_partner()
    {
        // What RepresentativeIntake passes, with the message SqlLeadService wrote.
        var lead = await Promote(RepLine + "\n\n" + ResellerLine + "\n\nHi", source: "Представител: dtodorov");

        Assert.Equal("Представител: dtodorov · партньор", lead.Source);
    }

    [Fact]
    public async Task A_stamp_too_long_for_the_column_keeps_the_representatives()
    {
        var slug = new string('a', 40);   // the longest slug EnvConfig admits

        var lead = await Promote($"Представител: {slug}\n\n{ResellerLine}", source: $"Представител: {slug}");

        Assert.Equal($"Представител: {slug}", lead.Source);
    }

    [Fact]
    public async Task An_ordinary_enquiry_keeps_whatever_source_it_was_given()
    {
        Assert.Null((await Promote("Hi")).Source);
        Assert.Equal("Представител: dtodorov", (await Promote(RepLine + "\n\nHi", "Представител: dtodorov")).Source);
    }

    [Theory]
    [InlineData("Hi\n\nПартньорско запитване · Препродавач · България · 2–5 бр.")]   // below the visitor's words
    [InlineData("Партньорско запитване · Дилър · България")]                       // a role we never write
    [InlineData("Партньорско запитване")]                                           // no role at all
    public void Only_a_line_in_the_place_the_server_writes_it_counts(string message)
    {
        Assert.Null(PartnerEnquiry.RoleIn(message));
        Assert.Null(PartnerEnquiry.SourceFor(message, null));
    }

    // --- The board -----------------------------------------------------------------------------

    [Fact]
    public async Task The_board_carries_each_leads_source_for_its_chip()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            new Lead { Name = "Partner", Status = LeadStatuses.New, Source = "Партньорска страница · Препродавач", CreatedAt = DateTimeOffset.UtcNow },
            new Lead { Name = "Walk-in", Status = LeadStatuses.New, CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();

        var board = await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None);

        Assert.Equal("Партньорска страница · Препродавач", board.Single(l => l.Name == "Partner").Source);
        Assert.Equal("", board.Single(l => l.Name == "Walk-in").Source);
    }
}
