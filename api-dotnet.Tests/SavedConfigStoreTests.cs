using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Saved configurator links on SQL — the last table off Quickbase.
//
// This one is different from every other migration in the project, and the tests reflect it:
// the codes are ALREADY IN CUSTOMERS' INBOXES, sent by the autoresponder. Everywhere else a
// bad cutover showed up as a wrong page someone noticed. Here it is a customer clicking a
// link we sent them and getting nothing, with no signal back to us at all.
public class SavedConfigStoreTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"savedcfg-{Guid.NewGuid()}")
            .Options);

    // --- Codes --------------------------------------------------------------------------

    [Theory]
    [InlineData("abc123XY", "abc123XY")]
    [InlineData("  abc123  ", "abc123")]
    [InlineData("ab'c1{2}3", "abc123")]      // query-injection attempt via the path segment
    [InlineData("../../etc", "etc")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void A_code_is_reduced_to_its_alphanumerics(string? input, string expected)
    {
        // Codes are minted from a fixed alphanumeric alphabet, so a legitimate one can never
        // contain anything else. Both implementations must answer identically for junk.
        Assert.Equal(expected, SqlSavedConfigService.Sanitize(input));
    }

    [Fact]
    public void The_code_alphabet_excludes_visually_ambiguous_characters()
    {
        // Customers read these aloud and type them. 0/O and 1/l/I are the pairs that get
        // transcribed wrongly, and a mistyped code is a link that does not resolve.
        var minted = string.Concat(Enumerable.Range(0, 400).Select(_ => MintViaReflection()));

        foreach (var banned in new[] { '0', 'O', '1', 'l', 'I' })
            Assert.DoesNotContain(banned, minted);
    }

    private static string MintViaReflection()
    {
        var method = typeof(SqlSavedConfigService)
            .GetMethod("GenerateCode", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        return (string)method!.Invoke(null, new object[] { 8 })!;
    }

    // --- Storage ------------------------------------------------------------------------

    private static SaveConfigRequest Request(string json = """{"model":"58"}""") => new(
        JsonSerializer.Deserialize<JsonElement>(json),
        ModelLabel: "58 m² with veranda",
        Locale: "bg",
        ReturnPath: "/bg/konfigurator-box-kyshti",
        Email: null);

    [Fact]
    public async Task A_saved_config_round_trips_by_its_code()
    {
        using var db = NewDb();
        var svc = Store(db);

        var code = await svc.SaveAsync(Request());
        var back = await svc.GetAsync(code);

        Assert.NotNull(back);
        Assert.Equal("58", back!.Config.GetProperty("model").GetString());
        Assert.Equal("58 m² with veranda", back.ModelLabel);
        Assert.Equal("bg", back.Locale);
    }

    [Fact]
    public async Task The_configuration_is_stored_exactly_as_it_arrived()
    {
        // The server has no business parsing the configurator's schema. An unknown key must
        // survive, or a schema change strands every link saved before it.
        using var db = NewDb();
        var svc = Store(db);

        var code = await svc.SaveAsync(Request("""{"model":"73","somethingNew":{"a":[1,2]}}"""));
        var back = await svc.GetAsync(code);

        Assert.Equal(2, back!.Config.GetProperty("somethingNew").GetProperty("a").GetArrayLength());
    }

    [Fact]
    public async Task The_return_path_resolves_for_the_redirect()
    {
        using var db = NewDb();
        var svc = Store(db);

        var code = await svc.SaveAsync(Request());
        Assert.Equal("/bg/konfigurator-box-kyshti", await svc.GetReturnPathAsync(code));
    }

    [Fact]
    public async Task An_unknown_code_is_a_miss_rather_than_an_error()
    {
        using var db = NewDb();
        var svc = Store(db);

        Assert.Null(await svc.GetAsync("neverminted"));
        Assert.Null(await svc.GetReturnPathAsync("neverminted"));
    }

    [Fact]
    public async Task A_row_whose_json_is_broken_is_a_miss_rather_than_a_blank_configurator()
    {
        using var db = NewDb();
        db.SavedConfigs.Add(new SavedConfig { Code = "broken12", ConfigJson = "{not json" });
        await db.SaveChangesAsync();

        Assert.Null(await Store(db).GetAsync("broken12"));
    }

    [Fact]
    public void Two_configs_can_never_share_a_code()
    {
        // The constraint the whole table exists for: a shared code means one customer's link
        // opens another customer's house.
        using var db = NewDb();
        db.SavedConfigs.Add(new SavedConfig { Code = "dupe1234", ConfigJson = "{}" });
        db.SavedConfigs.Add(new SavedConfig { Code = "dupe1234", ConfigJson = "{}" });

        // The in-memory provider does not enforce indexes, so assert the model declares it —
        // which is what the real database enforces.
        var index = db.Model.FindEntityType(typeof(SavedConfig))!
            .GetIndexes()
            .FirstOrDefault(i => i.Properties.Any(p => p.Name == nameof(SavedConfig.Code)));

        Assert.NotNull(index);
        Assert.True(index!.IsUnique, "SavedConfig.Code must be uniquely indexed");
    }

    [Fact]
    public async Task Saving_twice_mints_two_different_codes()
    {
        using var db = NewDb();
        var svc = Store(db);

        var a = await svc.SaveAsync(Request());
        var b = await svc.SaveAsync(Request());

        Assert.NotEqual(a, b);
        Assert.Equal(2, await db.SavedConfigs.CountAsync());
    }

    [Fact]
    public async Task A_code_with_no_return_path_is_answered_rather_than_re_queried()
    {
        // "Code exists, has no path" and "no such code" are different. Only the second may
        // fall through to Quickbase; conflating them keeps hitting the store being retired.
        using var db = NewDb();
        db.SavedConfigs.Add(new SavedConfig { Code = "nopath12", ConfigJson = "{}", ReturnPath = null });
        await db.SaveChangesAsync();

        Assert.Null(await Store(db).GetReturnPathAsync("nopath12"));
    }

    /// <summary>
    /// The store with a Quickbase fallback that is switched off, which is the state on any
    /// machine without QB_TABLE_SAVED_CONFIGS — and the state these tests want, since they
    /// are about the SQL half.
    /// </summary>
    private static SqlSavedConfigService Store(AppDbContext db)
    {
        var env = new EnvConfig(new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build());
        var cache = new Microsoft.Extensions.Caching.Memory.MemoryCache(
            new Microsoft.Extensions.Caching.Memory.MemoryCacheOptions());

        var quickbase = new SavedConfigService(null!, env, cache);

        return new SqlSavedConfigService(
            db, cache, quickbase,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<SqlSavedConfigService>.Instance);
    }
}
