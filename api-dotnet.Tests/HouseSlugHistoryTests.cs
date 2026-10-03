using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// ROADMAP #37: a renamed product keeps its old address.
//
// A gallery URL is the title, slugified per locale, so retitling a house in Галерия moves
// it. Before #37 the old URL showed visitors "Model not found" and answered crawlers 404
// until a developer added a GallerySlugs.RetiredSlugs row and published. Now the save that
// changes a title writes the old address into HouseSlugHistory, and GallerySeoService 301s
// it to wherever the house lives now. The owner's seven Greek retitles (#11 Group 3) are the
// first real use, so several of these use one of those titles.
public class HouseSlugHistoryTests
{
    // One of the seven Greek titles with English words in them (HANDOFF, "Next up").
    private const string GreekBefore = "Σπίτι τύπου Container 6000 mm × 3000 mm";
    private const string GreekAfter = "Σπίτι τύπου κοντέινερ 6000 mm × 3000 mm";

    private static AppDbContext NewDb(string? name = null) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name ?? $"slug-history-{Guid.NewGuid()}")
            .Options);

    private static ImageUrls NewUrls()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
        }).Build();
        return new ImageUrls(new EnvConfig(cfg));
    }

    private static GalleryAdminService Admin(AppDbContext db, IMemoryCache cache) =>
        new(db, blob: null!, new ImageProcessor(NullLogger<ImageProcessor>.Instance), NewUrls(), cache);

    private static HouseInput Input(string title, string? bg = null, string? el = null, bool published = true) => new()
    {
        Title = title,
        TitleBg = bg,
        TitleEl = el,
        CategoryKey = HouseCategories.Prefab,
        Price = 9900m,
        IsPublished = published,
    };

    private static string Path(string locale, string title) =>
        GallerySlugs.Locales.Single(l => l.Locale == locale).Prefix + Uri.EscapeDataString(GallerySlugs.Slugify(title));

    private static async Task<string?> Resolve(AppDbContext db, IMemoryCache cache, string path)
    {
        var seo = new GallerySeoService(new SqlGalleryService(db, cache, NewUrls()));
        return await seo.TryResolveLegacyAsync(path, CancellationToken.None);
    }

    // --- The write path ------------------------------------------------------------------

    [Fact]
    public async Task Retitling_records_the_old_address_in_each_locale_it_moved_and_no_other()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var house = await admin.CreateAsync(Input("Box House 20", bg: "Бокс къща 20", el: GreekBefore), null, default);

        await admin.UpdateAsync(house.Id, Input("Box House 20", bg: "Бокс къща 20", el: GreekAfter), "owner@nvc.eu", default);

        var rows = await db.HouseSlugHistory.ToListAsync();
        var row = Assert.Single(rows);
        Assert.Equal("el", row.Locale);
        Assert.Equal(GallerySlugs.Slugify(GreekBefore), row.Slug);
        Assert.Equal(house.Id, row.HouseId);
        Assert.Equal("owner@nvc.eu", row.RetiredByUpn);
    }

    [Fact]
    public async Task An_English_retitle_also_moves_a_locale_that_falls_back_to_the_English_title()
    {
        // No TitleBg: the Bulgarian page is addressed by the English title, so it moved too.
        using var db = NewDb();
        var admin = Admin(db, new MemoryCache(new MemoryCacheOptions()));
        var house = await admin.CreateAsync(Input("Panaromic Cabin", el: "Πανοραμική καμπίνα"), null, default);

        await admin.UpdateAsync(house.Id, Input("Panoramic Cabin", el: "Πανοραμική καμπίνα"), null, default);

        var rows = (await db.HouseSlugHistory.ToListAsync()).OrderBy(r => r.Locale).ToList();
        Assert.Equal(new[] { "bg", "en" }, rows.Select(r => r.Locale));
        Assert.All(rows, r => Assert.Equal("panaromic-cabin", r.Slug));
    }

    [Fact]
    public async Task A_save_that_does_not_move_an_address_writes_nothing()
    {
        using var db = NewDb();
        var admin = Admin(db, new MemoryCache(new MemoryCacheOptions()));
        var house = await admin.CreateAsync(Input("Box House 20", bg: "Бокс къща 20"), null, default);

        // A price change, and a title change that slugifies the same ("20" vs "20 ").
        var edit = Input("Box House 20 ", bg: "Бокс къща 20");
        edit.Price = 12000m;
        await admin.UpdateAsync(house.Id, edit, null, default);

        Assert.Empty(await db.HouseSlugHistory.ToListAsync());
    }

    [Fact]
    public async Task The_old_address_301s_to_the_new_one_straight_after_the_save()
    {
        // The public gallery caches for ten minutes. A redirect that only started working ten
        // minutes later would read as "it did not keep my address" to whoever just saved.
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var house = await admin.CreateAsync(Input("Box House 20", el: GreekBefore), null, default);

        // Warm the cache BEFORE the retitle, as a live site would have it.
        Assert.Null(await Resolve(db, cache, Path("el", GreekBefore)));

        await admin.UpdateAsync(house.Id, Input("Box House 20", el: GreekAfter), null, default);

        Assert.Equal(GallerySlugs.Locales.Single(l => l.Locale == "el").Prefix + Uri.EscapeDataString(GallerySlugs.Slugify(GreekAfter)),
            await Resolve(db, cache, Path("el", GreekBefore)));
    }

    [Fact]
    public async Task Renamed_twice_both_old_addresses_land_on_the_current_one_with_no_chain()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var house = await admin.CreateAsync(Input("Cabin A", bg: "Кабина", el: "Καμπίνα"), null, default);

        await admin.UpdateAsync(house.Id, Input("Cabin B", bg: "Кабина", el: "Καμπίνα"), null, default);
        await admin.UpdateAsync(house.Id, Input("Cabin C", bg: "Кабина", el: "Καμπίνα"), null, default);

        Assert.Equal("/en/gallery/cabin-c", await Resolve(db, cache, "/en/gallery/cabin-a"));
        Assert.Equal("/en/gallery/cabin-c", await Resolve(db, cache, "/en/gallery/cabin-b"));
    }

    [Fact]
    public async Task Renamed_back_the_retaken_address_leaves_the_history()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var house = await admin.CreateAsync(Input("Cabin A", bg: "Кабина", el: "Καμπίνα"), null, default);

        await admin.UpdateAsync(house.Id, Input("Cabin B", bg: "Кабина", el: "Καμπίνα"), null, default);
        await admin.UpdateAsync(house.Id, Input("Cabin A", bg: "Кабина", el: "Καμπίνα"), null, default);

        // "cabin-a" is live again and was dropped; "cabin-b" is the one now retired.
        var row = Assert.Single(await db.HouseSlugHistory.ToListAsync());
        Assert.Equal("cabin-b", row.Slug);
        Assert.Null(await Resolve(db, cache, "/en/gallery/cabin-a"));          // live, not a redirect
        Assert.Equal("/en/gallery/cabin-a", await Resolve(db, cache, "/en/gallery/cabin-b"));
    }

    [Fact]
    public async Task An_address_given_up_by_a_second_house_moves_to_it()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var first = await admin.CreateAsync(Input("Cabin", bg: "Кабина 1", el: "Καμπίνα 1"), null, default);
        await admin.UpdateAsync(first.Id, Input("Cabin One", bg: "Кабина 1", el: "Καμπίνα 1"), null, default);

        // A second house takes the freed title, then gives it up as well.
        var second = await admin.CreateAsync(Input("Cabin", bg: "Кабина 2", el: "Καμπίνα 2"), null, default);
        await admin.UpdateAsync(second.Id, Input("Cabin Two", bg: "Кабина 2", el: "Καμπίνα 2"), null, default);

        var row = Assert.Single(await db.HouseSlugHistory.Where(r => r.Slug == "cabin").ToListAsync());
        Assert.Equal(second.Id, row.HouseId);
        Assert.Equal("/en/gallery/cabin-two", await Resolve(db, cache, "/en/gallery/cabin"));
    }

    // --- The read path -------------------------------------------------------------------

    [Fact]
    public async Task An_unpublished_house_takes_its_old_addresses_down_with_it()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var house = await admin.CreateAsync(Input("Cabin A", bg: "Кабина", el: "Καμπίνα"), null, default);
        await admin.UpdateAsync(house.Id, Input("Cabin B", bg: "Кабина", el: "Καμπίνα"), null, default);
        await admin.UpdateAsync(house.Id, Input("Cabin B", bg: "Кабина", el: "Καμπίνα", published: false), null, default);

        // Its page is a 404 now, so its old address must not 301 to it.
        Assert.Null(await Resolve(db, cache, "/en/gallery/cabin-a"));
        Assert.Empty(await new SqlGalleryService(db, cache, NewUrls()).GetRetiredSlugsAsync());
    }

    [Fact]
    public async Task History_carries_the_public_id_imported_and_panel_houses_are_served_under()
    {
        using var db = NewDb();
        db.Houses.Add(new House { Id = 1, QuickbaseRecordId = 13, Title = "Imported", CategoryKey = "wagon", IsPublished = true });
        db.Houses.Add(new House { Id = 15, Title = "Panel made", CategoryKey = "prefab", IsPublished = true });
        db.HouseSlugHistory.Add(new HouseSlugHistory { HouseId = 1, Locale = "en", Slug = "old-imported" });
        db.HouseSlugHistory.Add(new HouseSlugHistory { HouseId = 15, Locale = "en", Slug = "old-panel" });
        await db.SaveChangesAsync();

        var retired = await new SqlGalleryService(db, new MemoryCache(new MemoryCacheOptions()), NewUrls())
            .GetRetiredSlugsAsync();

        Assert.Equal(13, retired.Single(r => r.Slug == "old-imported").PublicId);
        Assert.Equal(HousePublicIds.AdminOffset + 15, retired.Single(r => r.Slug == "old-panel").PublicId);
    }

    // The migration is applied before the publish (DEPLOY §5b). If that order is ever
    // reversed, the missing table must cost the redirects, not the gallery.
    private sealed class NoHistoryTableDb : AppDbContext
    {
        public NoHistoryTableDb(DbContextOptions<AppDbContext> o) : base(o) { }

        public override DbSet<TEntity> Set<TEntity>()
        {
            if (typeof(TEntity) == typeof(HouseSlugHistory))
                throw new InvalidOperationException("Invalid object name 'HouseSlugHistory'.");
            return base.Set<TEntity>();
        }
    }

    [Fact]
    public async Task Without_the_table_the_gallery_still_serves_and_the_history_is_empty()
    {
        using var db = new NoHistoryTableDb(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"slug-history-missing-{Guid.NewGuid()}").Options);
        db.Houses.Add(new House { Id = 1, QuickbaseRecordId = 4, Title = "Cabin", CategoryKey = "wagon", IsPublished = true });
        await db.SaveChangesAsync();

        var store = new SqlGalleryService(db, new MemoryCache(new MemoryCacheOptions()), NewUrls());

        Assert.Single(await store.GetAsync());
        Assert.Empty(await store.GetRetiredSlugsAsync());
    }

    private sealed class ThrowingHistoryStore : IGalleryStore
    {
        private readonly GalleryItem[] _items;
        public ThrowingHistoryStore(params GalleryItem[] items) => _items = items;
        public Task<IReadOnlyList<GalleryItem>> GetAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<GalleryItem>>(_items);
        public Task<IReadOnlyList<RetiredSlug>> GetRetiredSlugsAsync(CancellationToken ct = default) =>
            throw new InvalidOperationException("history unavailable");
    }

    [Fact]
    public async Task A_failing_history_read_still_leaves_the_older_redirects_working()
    {
        var panoramic = new GalleryItem { Id = 16, Title = "Panoramic Box House – 37 m²", TitleBg = "Панорамна Бокс къща – 37 м²" };
        var seo = new GallerySeoService(new ThrowingHistoryStore(panoramic));

        // GallerySlugs.RetiredSlugs, the hand-kept list, does not depend on the table.
        Assert.Equal("/en/gallery/panoramic-box-house-37-m2",
            await seo.TryResolveLegacyAsync("/en/gallery/panaromic-box-house-37-m2", default));
    }

    // --- The redirect rules ----------------------------------------------------------------

    private static readonly GalleryItem Cabin = new() { Id = 100_020, Title = "Cabin New", TitleBg = "Кабина", TitleEl = GreekAfter };

    [Fact]
    public void A_history_entry_lands_on_the_house_by_id_whatever_it_is_called_now()
    {
        var history = new[] { new RetiredSlug("el", GallerySlugs.Slugify(GreekBefore), 100_020) };

        Assert.Equal(GallerySlugs.PathFor(Cabin, "el"),
            GallerySeoService.StalePath(new[] { Cabin }, "el", GallerySlugs.Slugify(GreekBefore), GallerySlugs.RetiredSlugs, history));
    }

    [Fact]
    public void The_old_greek_address_in_its_pre_2026_08_17_form_redirects_too()
    {
        // Greek links minted before the NFKC change carry the old algorithm's form.
        var history = new[] { new RetiredSlug("el", GallerySlugs.Slugify(GreekBefore), 100_020) };
        var legacy = GallerySlugs.LegacySlugify(GreekBefore);
        Assert.NotEqual(GallerySlugs.Slugify(GreekBefore), legacy);

        Assert.Equal(GallerySlugs.PathFor(Cabin, "el"),
            GallerySeoService.StalePath(new[] { Cabin }, "el", legacy, GallerySlugs.RetiredSlugs, history));
    }

    [Fact]
    public void A_history_entry_for_a_house_that_is_not_served_redirects_nowhere()
    {
        var history = new[] { new RetiredSlug("en", "gone-cabin", 999) };

        Assert.Null(GallerySeoService.StalePath(new[] { Cabin }, "en", "gone-cabin", GallerySlugs.RetiredSlugs, history));
    }

    [Fact]
    public void A_live_address_is_never_redirected_even_if_the_history_names_it()
    {
        // Another house took the old title: its page is served, the history is ignored.
        var other = new GalleryItem { Id = 7, Title = "Cabin Old" };
        var history = new[] { new RetiredSlug("en", "cabin-old", 100_020) };

        Assert.Null(GallerySeoService.StalePath(new[] { Cabin, other }, "en", "cabin-old", GallerySlugs.RetiredSlugs, history));
    }

    [Fact]
    public void A_history_entry_in_another_locale_does_not_match()
    {
        var history = new[] { new RetiredSlug("bg", "cabin-old", 100_020) };

        Assert.Null(GallerySeoService.StalePath(new[] { Cabin }, "en", "cabin-old", GallerySlugs.RetiredSlugs, history));
    }

    // --- The panel's list ----------------------------------------------------------------

    [Fact]
    public async Task The_panel_lists_the_old_addresses_as_readable_paths_newest_first()
    {
        using var db = NewDb();
        var admin = Admin(db, new MemoryCache(new MemoryCacheOptions()));
        var house = await admin.CreateAsync(Input("Cabin A", bg: "Кабина", el: GreekBefore), null, default);
        await admin.UpdateAsync(house.Id, Input("Cabin A", bg: "Кабина", el: GreekAfter), "owner@nvc.eu", default);
        await Task.Delay(5);
        await admin.UpdateAsync(house.Id, Input("Cabin B", bg: "Кабина", el: GreekAfter), "owner@nvc.eu", default);

        var list = await admin.RetiredAddressesAsync(house.Id, default);

        Assert.Equal(new[] { "/en/gallery/cabin-a", "/el/gkaleri/" + GallerySlugs.Slugify(GreekBefore) },
            list.Select(a => a.Path));
        Assert.All(list, a => Assert.Equal("owner@nvc.eu", a.RetiredByUpn));
    }

    // --- The seeder ----------------------------------------------------------------------

    private static string Changes(params (string Field, string? From, string? To)[] changes) =>
        JsonSerializer.Serialize(changes.Select(c => new { c.Field, c.From, c.To }));

    private static SlugHistorySeeder.AuditedEdit Edit(int id, int houseId, string when, params (string, string?, string?)[] changes) =>
        new(id, houseId.ToString(), DateTimeOffset.Parse(when), "maria@nvc.eu", Changes(changes));

    [Fact]
    public void The_seeder_replays_a_retitle_from_the_log_into_the_addresses_it_moved()
    {
        var houses = new[] { new SlugHistorySeeder.HouseTitles(3, 13, "Cabin New", null, GreekAfter) };
        var edits = new[]
        {
            Edit(1, 3, "2026-08-25T10:00:00Z", ("TitleEl", GreekBefore, GreekAfter)),
            Edit(2, 3, "2026-09-01T10:00:00Z", ("Title", "Cabin Old", "Cabin New"), ("Price", "1", "2")),
        };

        var (found, warnings) = SlugHistorySeeder.Replay(houses, edits);

        Assert.Empty(warnings);
        // The English retitle moved en AND bg (no TitleBg); the Greek one moved el.
        Assert.Equal(
            new[] { ("el", GallerySlugs.Slugify(GreekBefore)), ("bg", "cabin-old"), ("en", "cabin-old") },
            found.Select(c => (c.Locale, c.Slug)));
        Assert.Equal(DateTimeOffset.Parse("2026-08-25T10:00:00Z"), found.Single(c => c.Locale == "el").RetiredAt);
    }

    [Fact]
    public void The_seeder_stops_at_a_title_that_changed_outside_the_log()
    {
        // The log says the title became "Cabin Mid", but the house was next "Cabin New"
        // without a record: everything before that point would be a guess.
        var houses = new[] { new SlugHistorySeeder.HouseTitles(3, null, "Cabin New", "Кабина", "Καμπίνα") };
        var edits = new[]
        {
            Edit(1, 3, "2026-08-25T10:00:00Z", ("Title", "Cabin Old", "Cabin Mid")),
        };

        var (found, warnings) = SlugHistorySeeder.Replay(houses, edits);

        Assert.Empty(found);
        Assert.Contains("house #3", Assert.Single(warnings));
    }

    [Fact]
    public void The_seeder_does_not_guess_a_title_the_log_cut_short()
    {
        var cut = new string('x', AuditRedaction.MaxValueChars) + "…";
        var houses = new[] { new SlugHistorySeeder.HouseTitles(3, null, "Cabin New", "Кабина", "Καμπίνα") };
        var edits = new[] { Edit(1, 3, "2026-08-25T10:00:00Z", ("Title", cut, "Cabin New")) };

        var (found, warnings) = SlugHistorySeeder.Replay(houses, edits);

        Assert.Empty(found);
        Assert.Single(warnings);
    }

    [Fact]
    public async Task The_seeder_writes_once_and_a_second_run_adds_nothing()
    {
        using var db = NewDb();
        db.Houses.Add(new House { Id = 3, Title = "Cabin New", TitleBg = "Кабина", TitleEl = "Καμπίνα", CategoryKey = "prefab" });
        db.Houses.Add(new House { Id = 4, Title = "Cabin Old Twin", TitleBg = "Кабина 2", TitleEl = "Καμπίνα 2", CategoryKey = "prefab" });
        db.AuditEntries.Add(new AuditEntry
        {
            EntityType = nameof(House), EntityId = "3", Action = AuditActions.Updated,
            OccurredAt = DateTimeOffset.Parse("2026-08-25T10:00:00Z"),
            ChangesJson = Changes(("Title", "Cabin Old", "Cabin New")),
        });
        // An address that is live on another house today must be left alone.
        db.AuditEntries.Add(new AuditEntry
        {
            EntityType = nameof(House), EntityId = "3", Action = AuditActions.Updated,
            OccurredAt = DateTimeOffset.Parse("2026-08-20T10:00:00Z"),
            ChangesJson = Changes(("Title", "Cabin Old Twin", "Cabin Old")),
        });
        await db.SaveChangesAsync();

        var dry = await new SlugHistorySeeder(db).RunAsync(dryRun: true, default);
        Assert.Equal(new[] { "cabin-old" }, dry.Added.Select(c => c.Slug));
        Assert.Equal(new[] { "cabin-old-twin" }, dry.ServedToday.Select(c => c.Slug));
        Assert.Empty(await db.HouseSlugHistory.ToListAsync());

        var real = await new SlugHistorySeeder(db).RunAsync(dryRun: false, default);
        Assert.Single(real.Added);
        Assert.Equal(3, Assert.Single(await db.HouseSlugHistory.ToListAsync()).HouseId);

        var again = await new SlugHistorySeeder(db).RunAsync(dryRun: false, default);
        Assert.Empty(again.Added);
        Assert.Single(again.AlreadyKnown);
        Assert.Single(await db.HouseSlugHistory.ToListAsync());
    }

    // --- From the second review: whose address it is ---------------------------------------

    [Fact]
    public async Task A_house_that_takes_an_old_address_live_releases_it_and_404s_it_when_it_goes()
    {
        // H gives up "cabin"; K is then created as "Cabin" and published. The address is K's
        // now. When K is unpublished, /cabin must 404, not 301 to H — a different product.
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var h = await admin.CreateAsync(Input("Cabin", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);
        await admin.UpdateAsync(h.Id, Input("Cabin One", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);
        Assert.Equal("/en/gallery/cabin-one", await Resolve(db, cache, "/en/gallery/cabin"));

        var k = await admin.CreateAsync(Input("Cabin", bg: "Кабина К", el: "Καμπίνα Κ"), null, default);
        Assert.Empty(await db.HouseSlugHistory.Where(r => r.Slug == "cabin").ToListAsync());
        Assert.Empty(await admin.RetiredAddressesAsync(h.Id, default));

        await admin.UpdateAsync(k.Id, Input("Cabin", bg: "Кабина К", el: "Καμπίνα Κ", published: false), null, default);
        Assert.Null(await Resolve(db, cache, "/en/gallery/cabin"));
    }

    [Fact]
    public async Task A_house_retitled_onto_an_old_address_releases_it_too()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var h = await admin.CreateAsync(Input("Cabin", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);
        await admin.UpdateAsync(h.Id, Input("Cabin One", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);
        var k = await admin.CreateAsync(Input("Lodge", bg: "Хижа", el: "Καταφύγιο"), null, default);

        await admin.UpdateAsync(k.Id, Input("Cabin", bg: "Хижа", el: "Καταφύγιο"), null, default);

        Assert.DoesNotContain(await db.HouseSlugHistory.ToListAsync(), r => r.Locale == "en" && r.Slug == "cabin");
        await admin.DeleteAsync(k.Id, default);
        Assert.Null(await Resolve(db, cache, "/en/gallery/cabin"));
    }

    [Fact]
    public async Task A_draft_with_an_old_title_leaves_the_redirect_in_place_until_it_is_published()
    {
        // The draft's page is not public; the old house's visitors still need the redirect.
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var h = await admin.CreateAsync(Input("Cabin", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);
        await admin.UpdateAsync(h.Id, Input("Cabin One", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);

        var k = await admin.CreateAsync(Input("Cabin", bg: "Кабина К", el: "Καμπίνα Κ", published: false), null, default);
        Assert.Equal("/en/gallery/cabin-one", await Resolve(db, cache, "/en/gallery/cabin"));

        // Publishing it, with no title change, is when the address becomes K's.
        await admin.UpdateAsync(k.Id, Input("Cabin", bg: "Кабина К", el: "Καμπίνα Κ"), null, default);
        Assert.Empty(await db.HouseSlugHistory.Where(r => r.Slug == "cabin").ToListAsync());
    }

    [Fact]
    public async Task Giving_up_a_title_another_published_house_shares_records_nothing()
    {
        // Two houses called "Model X": /model-x is B's page, not an old address of A.
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        await admin.CreateAsync(Input("Model X", bg: "Модел Х", el: "Μοντέλο Χ"), null, default);
        var a = await admin.CreateAsync(Input("Model X", bg: "Модел Х", el: "Μοντέλο Χ"), null, default);

        await admin.UpdateAsync(a.Id, Input("Model X Deluxe", bg: "Модел Х Делукс", el: "Μοντέλο Χ Ντελούξ"), null, default);

        Assert.Empty(await db.HouseSlugHistory.ToListAsync());
    }

    [Fact]
    public async Task An_edit_that_moves_no_address_never_touches_the_table()
    {
        // So that code published ahead of its migration can still save prices and photos.
        using var db = new NoHistoryTableDb(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"slug-history-untouched-{Guid.NewGuid()}").Options);
        db.Houses.Add(new House { Id = 1, Title = "Cabin", TitleBg = "Кабина", TitleEl = "Καμπίνα", CategoryKey = "prefab", IsPublished = true });
        await db.SaveChangesAsync();
        var admin = Admin(db, new MemoryCache(new MemoryCacheOptions()));

        var edit = Input("Cabin", bg: "Кабина", el: "Καμπίνα");
        edit.Price = 12345m;
        var saved = await admin.UpdateAsync(1, edit, null, default);

        Assert.Equal(12345m, saved!.Price);
        // A retitle does need the table, and says so rather than saving half of itself.
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            admin.UpdateAsync(1, Input("Cabin Two", bg: "Кабина", el: "Καμπίνα"), null, default));
    }

    [Fact]
    public void A_quickbase_era_address_follows_its_house_through_a_later_panel_rename()
    {
        // 'panaromic…' (RetiredSlugs) targets the 37 m² house's 2026 title. Retitle that house
        // in the panel and the history row it writes carries the old target on to the new one.
        var renamed = new GalleryItem { Id = 16, Title = "Panoramic Box House – 38 m²", TitleBg = "Панорамна Бокс къща – 37 м²" };
        var history = new[] { new RetiredSlug("en", "panoramic-box-house-37-m2", 16) };

        Assert.Equal("/en/gallery/panoramic-box-house-38-m2",
            GallerySeoService.StalePath(new[] { renamed }, "en", "panaromic-box-house-37-m2", GallerySlugs.RetiredSlugs, history));
    }

    // A context whose history read can be made to fail, or to fail BECAUSE its request was
    // abandoned (SqlClient reports that as a SqlException, not as a cancellation), and that
    // counts how often the history is read.
    private sealed class FlakyHistoryDb : AppDbContext
    {
        public FlakyHistoryDb(DbContextOptions<AppDbContext> o) : base(o) { }
        public bool Missing { get; set; }
        public CancellationTokenSource? AbandonOnRead { get; set; }
        public int HistoryReads { get; set; }

        public override DbSet<TEntity> Set<TEntity>()
        {
            if (typeof(TEntity) == typeof(HouseSlugHistory))
            {
                HistoryReads++;
                if (AbandonOnRead is not null)
                {
                    AbandonOnRead.Cancel();
                    throw new InvalidOperationException("A severe error occurred on the current command. Operation cancelled by user.");
                }
                if (Missing) throw new InvalidOperationException("Invalid object name 'HouseSlugHistory'.");
            }
            return base.Set<TEntity>();
        }
    }

    private static async Task<FlakyHistoryDb> FlakyDbWithOneOldAddress()
    {
        var db = new FlakyHistoryDb(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"slug-history-flaky-{Guid.NewGuid()}").Options);
        db.Houses.Add(new House { Id = 1, QuickbaseRecordId = 4, Title = "Cabin", CategoryKey = "wagon", IsPublished = true });
        db.HouseSlugHistory.Add(new HouseSlugHistory { HouseId = 1, Locale = "en", Slug = "old-cabin" });
        await db.SaveChangesAsync();
        db.HistoryReads = 0; // the setup's own write is not a read
        return db;
    }

    [Fact]
    public async Task A_history_read_abandoned_by_its_request_is_not_cached_as_empty()
    {
        using var db = await FlakyDbWithOneOldAddress();
        var store = new SqlGalleryService(db, new MemoryCache(new MemoryCacheOptions()), NewUrls());

        using var leaving = new CancellationTokenSource();
        db.AbandonOnRead = leaving;
        await Assert.ThrowsAsync<InvalidOperationException>(() => store.GetRetiredSlugsAsync(leaving.Token));

        db.AbandonOnRead = null;
        Assert.Single(await store.GetRetiredSlugsAsync());
    }

    private sealed class FakeClock : Microsoft.Extensions.Internal.ISystemClock
    {
        public DateTimeOffset UtcNow { get; set; } = DateTimeOffset.Parse("2026-10-04T09:00:00Z");
    }

    [Fact]
    public async Task A_snapshot_without_its_history_lives_a_minute_and_a_whole_one_ten()
    {
        using var db = await FlakyDbWithOneOldAddress();
        var clock = new FakeClock();
        var store = new SqlGalleryService(db, new MemoryCache(new MemoryCacheOptions { Clock = clock }), NewUrls());

        db.Missing = true;                                   // the migration not applied yet
        Assert.Empty(await store.GetRetiredSlugsAsync());
        db.Missing = false;                                  // ... and now it is

        clock.UtcNow = clock.UtcNow.AddSeconds(30);
        Assert.Empty(await store.GetRetiredSlugsAsync());    // still the degraded snapshot
        clock.UtcNow = clock.UtcNow.AddSeconds(31);
        Assert.Single(await store.GetRetiredSlugsAsync());   // healed within the minute
        Assert.Equal(2, db.HistoryReads);

        clock.UtcNow = clock.UtcNow.AddMinutes(9);
        Assert.Single(await store.GetRetiredSlugsAsync());
        Assert.Equal(2, db.HistoryReads);                    // a whole snapshot keeps its ten
    }

    [Fact]
    public async Task A_draft_that_briefly_carried_an_old_title_does_not_take_the_redirect()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var h = await admin.CreateAsync(Input("Cabin", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);
        await admin.UpdateAsync(h.Id, Input("Cabin One", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);

        var d = await admin.CreateAsync(Input("Cabin", bg: "Кабина Д", el: "Καμπίνα Δ", published: false), null, default);
        await admin.UpdateAsync(d.Id, Input("Lodge", bg: "Кабина Д", el: "Καμπίνα Δ", published: false), null, default);

        Assert.Equal("/en/gallery/cabin-one", await Resolve(db, cache, "/en/gallery/cabin"));
        Assert.Contains(await admin.RetiredAddressesAsync(h.Id, default), a => a.Path == "/en/gallery/cabin");

        // Published later: still H's old address, not a redirect to an unrelated "Lodge".
        await admin.UpdateAsync(d.Id, Input("Lodge", bg: "Кабина Д", el: "Καμπίνα Δ"), null, default);
        Assert.Equal("/en/gallery/cabin-one", await Resolve(db, cache, "/en/gallery/cabin"));
    }

    [Fact]
    public async Task A_draft_published_and_renamed_in_one_save_does_not_take_the_redirect_either()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var admin = Admin(db, cache);
        var h = await admin.CreateAsync(Input("Cabin", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);
        await admin.UpdateAsync(h.Id, Input("Cabin One", bg: "Кабина Х", el: "Καμπίνα Χ"), null, default);
        var d = await admin.CreateAsync(Input("Cabin", bg: "Кабина Д", el: "Καμπίνα Δ", published: false), null, default);

        await admin.UpdateAsync(d.Id, Input("Lodge", bg: "Кабина Д", el: "Καμπίνα Δ"), null, default);

        Assert.Equal("/en/gallery/cabin-one", await Resolve(db, cache, "/en/gallery/cabin"));
    }

    [Fact]
    public void The_seeder_prefers_a_published_house_to_a_draft_that_lost_the_same_address_later()
    {
        var houses = new[]
        {
            new SlugHistorySeeder.HouseTitles(1, null, "Cabin One", "Кабина 1", "Καμπίνα 1", IsPublished: true),
            new SlugHistorySeeder.HouseTitles(2, null, "Lodge", "Хижа", "Καταφύγιο", IsPublished: false),
        };
        var edits = new[]
        {
            Edit(1, 1, "2026-08-20T10:00:00Z", ("Title", "Cabin", "Cabin One")),
            Edit(2, 2, "2026-09-01T10:00:00Z", ("Title", "Cabin", "Lodge")),
        };

        var (found, _) = SlugHistorySeeder.Replay(houses, edits);

        Assert.Equal(1, found.Single(c => c.Locale == "en" && c.Slug == "cabin").HouseId);
    }

    [Fact]
    public async Task The_seeder_does_not_revive_an_address_another_house_held_since_even_one_now_deleted()
    {
        using var db = NewDb();
        db.Houses.Add(new House { Id = 1, Title = "Cabin One", TitleBg = "Кабина 1", TitleEl = "Καμπίνα 1", CategoryKey = "prefab" });
        db.AuditEntries.Add(new AuditEntry
        {
            EntityType = nameof(House), EntityId = "1", Action = AuditActions.Updated,
            OccurredAt = DateTimeOffset.Parse("2026-08-20T10:00:00Z"),
            ChangesJson = Changes(("Title", "Cabin", "Cabin One")),
        });
        // House 2 was created as "Cabin" after that (taking the address), then deleted.
        db.AuditEntries.Add(new AuditEntry
        {
            EntityType = nameof(House), EntityId = "2", Action = AuditActions.Created,
            OccurredAt = DateTimeOffset.Parse("2026-08-25T10:00:00Z"),
            ChangesJson = Changes(("Title", null, "Cabin")),
        });
        db.AuditEntries.Add(new AuditEntry
        {
            EntityType = nameof(House), EntityId = "2", Action = "deleted",
            OccurredAt = DateTimeOffset.Parse("2026-09-01T10:00:00Z"),
            ChangesJson = Changes(("Title", "Cabin", null)),
        });
        await db.SaveChangesAsync();

        var dry = await new SlugHistorySeeder(db).RunAsync(dryRun: true, default);

        Assert.DoesNotContain(dry.Added, c => c.Locale == "en" && c.Slug == "cabin");
        Assert.Contains(dry.Warnings, w => w.Contains("house #2"));
    }

    [Fact]
    public void The_seeder_treats_a_blank_title_as_no_title_against_the_creation_record()
    {
        // The log leaves blank values out of a creation record; a whitespace-only TitleBg is
        // the same "no title" and must not read as a change made outside the log.
        var houses = new[] { new SlugHistorySeeder.HouseTitles(9, null, "Cabin New", "  ", "Καμπίνα") };
        var edits = new[]
        {
            Edit(2, 9, "2026-09-01T10:00:00Z", ("Title", "Cabin Old", "Cabin New")),
            new SlugHistorySeeder.AuditedEdit(1, "9", DateTimeOffset.Parse("2026-08-25T10:00:00Z"), null,
                Changes(("Title", null, "Cabin Old"), ("TitleEl", null, "Καμπίνα")), AuditActions.Created),
        };

        var (found, warnings) = SlugHistorySeeder.Replay(houses, edits);

        Assert.Empty(warnings);
        Assert.NotEmpty(found);
    }

    [Fact]
    public void The_seeder_treats_a_blank_logged_value_as_no_title_too()
    {
        // An edit that blanked TitleBg logged "   "; the house holds no TitleBg now. Same thing.
        var houses = new[] { new SlugHistorySeeder.HouseTitles(9, null, "Cabin", null, "Καμπίνα") };
        var edits = new[] { Edit(1, 9, "2026-09-01T10:00:00Z", ("TitleBg", "Кабина", "   ")) };

        var (found, warnings) = SlugHistorySeeder.Replay(houses, edits);

        Assert.Empty(warnings);
        Assert.Equal(("bg", "кабина"), (Assert.Single(found).Locale, found[0].Slug));
    }

    [Fact]
    public async Task The_seeder_leaves_an_address_a_draft_shares_but_not_one_a_published_house_serves()
    {
        using var db = NewDb();
        db.Houses.Add(new House { Id = 3, Title = "Cabin New", TitleBg = "Кабина", TitleEl = "Καμπίνα", CategoryKey = "prefab" });
        db.Houses.Add(new House { Id = 5, Title = "Cabin Draft", TitleBg = "Кабина 5", TitleEl = "Καμπίνα 5", CategoryKey = "prefab", IsPublished = false });
        db.Houses.Add(new House { Id = 6, Title = "Cabin Live", TitleBg = "Кабина 6", TitleEl = "Καμπίνα 6", CategoryKey = "prefab", IsPublished = true });
        db.AuditEntries.Add(new AuditEntry
        {
            EntityType = nameof(House), EntityId = "3", Action = AuditActions.Updated,
            OccurredAt = DateTimeOffset.Parse("2026-09-02T10:00:00Z"),
            ChangesJson = Changes(("Title", "Cabin Draft", "Cabin New")),
        });
        db.AuditEntries.Add(new AuditEntry
        {
            EntityType = nameof(House), EntityId = "3", Action = AuditActions.Updated,
            OccurredAt = DateTimeOffset.Parse("2026-09-01T10:00:00Z"),
            ChangesJson = Changes(("Title", "Cabin Live", "Cabin Draft")),
        });
        await db.SaveChangesAsync();

        var dry = await new SlugHistorySeeder(db).RunAsync(dryRun: true, default);

        Assert.Contains(dry.Added, c => c.Slug == "cabin-draft");       // only a draft shares it
        Assert.Contains(dry.ServedToday, c => c.Slug == "cabin-live");  // a published house's page
    }

    [Fact]
    public void The_seeder_checks_its_replay_against_the_creation_record()
    {
        // The log never saw TitleBg change, but the house was created with another one: the
        // Bulgarian addresses the replay would compute are guesses, so none are used.
        var houses = new[] { new SlugHistorySeeder.HouseTitles(9, null, "Cabin New", "Кабина нова", "Καμπίνα") };
        var edits = new[]
        {
            Edit(2, 9, "2026-09-01T10:00:00Z", ("Title", "Cabin Old", "Cabin New")),
            new SlugHistorySeeder.AuditedEdit(1, "9", DateTimeOffset.Parse("2026-08-25T10:00:00Z"), "maria@nvc.eu",
                Changes(("Title", null, "Cabin Old"), ("TitleBg", null, "Кабина"), ("TitleEl", null, "Καμπίνα")),
                AuditActions.Created),
        };

        var (found, warnings) = SlugHistorySeeder.Replay(houses, edits);

        Assert.Empty(found);
        Assert.Contains("created", Assert.Single(warnings));
    }

    [Fact]
    public void The_seeder_accepts_a_replay_that_lands_on_the_creation_record()
    {
        var houses = new[] { new SlugHistorySeeder.HouseTitles(9, null, "Cabin New", null, "Καμπίνα") };
        var edits = new[]
        {
            Edit(2, 9, "2026-09-01T10:00:00Z", ("Title", "Cabin Old", "Cabin New")),
            new SlugHistorySeeder.AuditedEdit(1, "9", DateTimeOffset.Parse("2026-08-25T10:00:00Z"), null,
                Changes(("Title", null, "Cabin Old"), ("TitleEl", null, "Καμπίνα")), AuditActions.Created),
        };

        var (found, warnings) = SlugHistorySeeder.Replay(houses, edits);

        Assert.Empty(warnings);
        Assert.Equal(new[] { "bg", "en" }, found.Select(c => c.Locale).OrderBy(l => l));
    }

    [Fact]
    public void The_seeder_turns_the_hand_kept_list_into_rows_keyed_by_house()
    {
        var houses = new[]
        {
            new SlugHistorySeeder.HouseTitles(14, 16, "Panoramic Box House – 37 m²", "Панорамна Бокс къща – 37 м²", "Πανοραμικό Box House – 37 m²"),
            new SlugHistorySeeder.HouseTitles(3, 4, "Expandable house - 58m² with balcony and a double roof", null, null),
        };

        var (found, warnings) = SlugHistorySeeder.FromRetiredSlugs(houses);

        Assert.Contains(found, c => c.HouseId == 14 && c.Slug == "panaromic-box-house-37-m2" && c.RetiredAt == SlugHistorySeeder.RetiredSlugsDate);
        Assert.Contains(found, c => c.HouseId == 3 && c.Slug == "expandable-house-58m2-with-balcony-and-а-double-roof");
        // The 73 m² house is not in this catalogue: reported, left to the list.
        Assert.Contains("no house serves", Assert.Single(warnings));
    }
}
