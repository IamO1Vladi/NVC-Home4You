using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The home page's photo slots (2026-10 redesign). Two things carry the design and both live
// here: the eight slot names are an allow-list the write paths enforce, and the public read
// of the busiest page on the site must keep answering — an empty answer — when the table
// behind it is not there yet, because migrations are applied by hand before a publish and
// nothing stops the order being reversed once.
public class HomeSlotTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"home-slots-{Guid.NewGuid()}")
            .Options);

    private static ImageUrls NewUrls()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
        }).Build();
        return new ImageUrls(new EnvConfig(cfg));
    }

    private static HomePhotoService Svc(AppDbContext db, IMemoryCache? cache = null) =>
        new(db, NewUrls(), cache ?? new MemoryCache(new MemoryCacheOptions()));

    private const string GalleryKey = "gallery/8/7cfec3bd1c0e4d0f9a1b2c3d4e5f6a7b.webp";
    private const string CaseKey = "cases/3/0123456789abcdef0123456789abcdef.webp";
    private const string ContentKey = "content/bukcsfwf9-rdg-eg-vb.webp";

    // --- The allow-list -----------------------------------------------------------------

    [Fact]
    public void The_eight_slots_are_the_five_hero_slides_then_the_three_models_in_page_order()
    {
        Assert.Equal(
            new[] { "hero-1", "hero-2", "hero-3", "hero-4", "hero-5", "model-37", "model-58", "model-73" },
            HomeSlotNames.All);
    }

    [Fact]
    public void Indexes_are_one_based_positions_in_that_order_and_zero_for_strangers()
    {
        // The index is the owner id the upload path mints keys under (home/{index}/…), so
        // it has to be stable and it has to be positive — NewOwnedKey refuses 0.
        Assert.Equal(1, HomeSlotNames.IndexOf("hero-1"));
        Assert.Equal(5, HomeSlotNames.IndexOf("hero-5"));
        Assert.Equal(6, HomeSlotNames.IndexOf("model-37"));
        Assert.Equal(8, HomeSlotNames.IndexOf("model-73"));
        Assert.Equal(0, HomeSlotNames.IndexOf("hero-6"));
        Assert.Equal(0, HomeSlotNames.IndexOf(null));
    }

    [Fact]
    public void Kinds_and_model_keys_follow_from_the_name()
    {
        Assert.Equal("hero", HomeSlotNames.KindOf("hero-3"));
        Assert.Equal("model", HomeSlotNames.KindOf("model-58"));
        Assert.Null(HomeSlotNames.KindOf("tile-interiors"));

        Assert.Equal("58", HomeSlotNames.ModelKeyOf("model-58"));
        Assert.Null(HomeSlotNames.ModelKeyOf("hero-1"));
        Assert.Equal(new[] { "37", "58", "73" }, HomeSlotNames.ModelKeys);
    }

    [Fact]
    public void Names_outside_the_list_are_not_valid_whatever_they_look_like()
    {
        Assert.True(HomeSlotNames.IsValid("hero-1"));
        Assert.True(HomeSlotNames.IsValid("model-73"));

        Assert.False(HomeSlotNames.IsValid("Hero-1"));
        Assert.False(HomeSlotNames.IsValid("hero-0"));
        Assert.False(HomeSlotNames.IsValid("hero-6"));
        Assert.False(HomeSlotNames.IsValid("model-box37"));
        Assert.False(HomeSlotNames.IsValid(""));
        Assert.False(HomeSlotNames.IsValid(null));
    }

    // --- The image key scope --------------------------------------------------------------

    [Fact]
    public void A_home_key_is_a_valid_owned_key_and_is_served_from_our_own_route()
    {
        var key = "home/3/0123456789abcdef0123456789abcdef.webp";

        Assert.True(ImageKey.IsValid(key));
        Assert.True(ImageKey.IsOwned(key));
        Assert.False(ImageKey.HasQuickbaseOrigin(key));
        Assert.Equal("/api/img/" + key, NewUrls().ForKey(key));

        // A bare root is still nothing.
        Assert.False(ImageKey.IsValid("home/"));
    }

    [Fact]
    public void An_uploaded_home_photo_is_minted_under_the_slot_index()
    {
        var key = ImageKey.NewOwnedKey(ImageKey.HomeScope, 3, "IMG_2041.JPG", ".webp");

        Assert.StartsWith("home/3/", key);
        Assert.EndsWith(".webp", key);
        Assert.Matches("^home/3/[0-9a-f]{32}\\.webp$", key);
        Assert.True(ImageKey.IsValid(key));
    }

    [Fact]
    public void Adding_the_home_scope_did_not_open_the_door_to_any_other()
    {
        // The guard is widened by one name, not removed.
        Assert.Throws<ArgumentException>(() => ImageKey.NewOwnedKey("uploads", 3, "photo.jpg"));
        Assert.Throws<ArgumentException>(() => ImageKey.NewOwnedKey("../etc", 3, "photo.jpg"));
        Assert.Throws<ArgumentException>(() => ImageKey.NewOwnedKey("homes", 3, "photo.jpg"));
        Assert.Throws<ArgumentOutOfRangeException>(() => ImageKey.NewOwnedKey(ImageKey.HomeScope, 0, "photo.jpg"));
    }

    // --- The panel's list -------------------------------------------------------------

    [Fact]
    public async Task The_list_has_one_entry_per_slot_whether_or_not_a_row_exists()
    {
        using var db = NewDb();
        db.HomeSlots.Add(new HomeSlot { Name = "hero-2", ImageKey = GalleryKey, Alt = "Cabin" });
        await db.SaveChangesAsync();

        var slots = await Svc(db).ListAdminAsync(CancellationToken.None);

        Assert.Equal(HomeSlotNames.All, slots.Select(s => s.Name));

        var filled = slots.Single(s => s.Name == "hero-2");
        Assert.Equal("hero", filled.Kind);
        Assert.Equal("2", filled.Index);
        Assert.Equal(GalleryKey, filled.ImageKey);
        Assert.Equal("/api/img/" + GalleryKey, filled.Url);
        Assert.Equal("Cabin", filled.Alt);

        var empty = slots.Single(s => s.Name == "model-58");
        Assert.Equal("model", empty.Kind);
        Assert.Equal("58", empty.Index);
        Assert.Null(empty.ImageKey);
        Assert.Null(empty.Url);
        Assert.Null(empty.UpdatedAt);
    }

    // --- Pick: only photos the site already serves ------------------------------------

    [Fact]
    public async Task Picking_a_gallery_photo_copies_its_key_into_the_slot()
    {
        using var db = NewDb();
        db.Houses.Add(new House
        {
            Id = 8, Title = "Box 37", CategoryKey = HouseCategories.Prefab, IsPublished = true,
            Images = { new HouseImage { ImageKey = GalleryKey } },
        });
        await db.SaveChangesAsync();

        var result = await Svc(db).PickAsync("model-37", GalleryKey, "owner@nvc.eu", CancellationToken.None);

        Assert.True(result.Ok);
        var row = await db.HomeSlots.SingleAsync();
        Assert.Equal("model-37", row.Name);
        Assert.Equal(GalleryKey, row.ImageKey);
        Assert.Equal("owner@nvc.eu", row.UpdatedByUpn);
        Assert.Equal("/api/img/" + GalleryKey, result.Slot!.Url);
    }

    [Fact]
    public async Task A_picked_gallery_photo_survives_the_gallery_row_being_deleted()
    {
        // The key is a copy, not a foreign key: a gallery clean-up must not empty the hero.
        using var db = NewDb();
        var house = new House
        {
            Id = 8, Title = "Box 37", CategoryKey = HouseCategories.Prefab, IsPublished = true,
            Images = { new HouseImage { ImageKey = GalleryKey } },
        };
        db.Houses.Add(house);
        await db.SaveChangesAsync();
        Assert.True((await Svc(db).PickAsync("hero-1", GalleryKey, null, CancellationToken.None)).Ok);

        db.Houses.Remove(house);
        await db.SaveChangesAsync();

        Assert.Equal(GalleryKey, (await db.HomeSlots.SingleAsync()).ImageKey);
    }

    [Fact]
    public async Task Picking_a_case_photo_or_a_content_key_is_accepted_too()
    {
        using var db = NewDb();
        db.Cases.Add(new Case
        {
            Id = 3, CompanyName = "Family house",
            Images = { new CaseImage { ImageKey = CaseKey } },
        });
        await db.SaveChangesAsync();
        var svc = Svc(db);

        Assert.True((await svc.PickAsync("hero-2", CaseKey, null, CancellationToken.None)).Ok);
        Assert.True((await svc.PickAsync("hero-3", ContentKey, null, CancellationToken.None)).Ok);

        var rows = await db.HomeSlots.OrderBy(s => s.Name).ToListAsync();
        Assert.Equal(new[] { CaseKey, ContentKey }, rows.Select(r => r.ImageKey));
    }

    [Fact]
    public async Task Picking_a_key_the_site_does_not_serve_is_refused_and_writes_nothing()
    {
        using var db = NewDb();
        var svc = Svc(db);

        // A well-formed gallery key nothing stores, a malformed key, a home/ key (those
        // arrive by upload, never by pick), and nothing at all.
        foreach (var key in new[] { GalleryKey, "gallery/../leads/1/x.webp", "home/1/abc.webp", "", null })
        {
            var result = await svc.PickAsync("hero-1", key, null, CancellationToken.None);
            Assert.Equal(HomePhotoService.Outcome.Refused, result.Outcome);
            Assert.Equal("That image is not in the gallery.", result.Error);
        }

        Assert.Empty(await db.HomeSlots.ToListAsync());
    }

    [Fact]
    public async Task An_unknown_slot_name_is_not_found_on_every_verb()
    {
        using var db = NewDb();
        var svc = Svc(db);

        Assert.Equal(HomePhotoService.Outcome.NotFound, (await svc.PickAsync("hero-9", ContentKey, null, default)).Outcome);
        Assert.Equal(HomePhotoService.Outcome.NotFound, (await svc.RecordImageAsync("tile-1", "home/1/a.webp", null, null, default)).Outcome);
        Assert.Equal(HomePhotoService.Outcome.NotFound, (await svc.SetAltAsync("model-box37", "x", null, default)).Outcome);
        Assert.Equal(HomePhotoService.Outcome.NotFound, await svc.ClearAsync("hero-0", null, default));
        Assert.Equal(HomePhotoService.Outcome.NotFound, (await svc.SwapAsync("hero-1", "hero-6", null, default)).Outcome);
        Assert.Empty(await db.HomeSlots.ToListAsync());
    }

    // --- Upload's row half ------------------------------------------------------------

    [Fact]
    public async Task Recording_an_upload_repoints_the_slot_and_keeps_its_caption()
    {
        using var db = NewDb();
        var svc = Svc(db);
        await svc.PickAsync("hero-1", ContentKey, null, CancellationToken.None);
        await svc.SetAltAsync("hero-1", "The first house", null, CancellationToken.None);

        var key = ImageKey.NewOwnedKey(ImageKey.HomeScope, HomeSlotNames.IndexOf("hero-1"), "x.jpg", ".webp");
        var result = await svc.RecordImageAsync("hero-1", key, alt: null, "owner@nvc.eu", CancellationToken.None);

        Assert.True(result.Ok);
        var row = await db.HomeSlots.SingleAsync();
        Assert.Equal(key, row.ImageKey);
        Assert.Equal("The first house", row.Alt);
        Assert.Equal("owner@nvc.eu", row.UpdatedByUpn);
    }

    // --- Swap: same kind only -----------------------------------------------------------

    [Fact]
    public async Task Swapping_two_hero_slots_exchanges_photo_and_caption()
    {
        using var db = NewDb();
        db.HomeSlots.Add(new HomeSlot { Name = "hero-2", ImageKey = ContentKey, Alt = "two" });
        await db.SaveChangesAsync();

        var result = await Svc(db).SwapAsync("hero-2", "hero-3", "owner@nvc.eu", CancellationToken.None);

        Assert.True(result.Ok);
        var two = await db.HomeSlots.SingleAsync(s => s.Name == "hero-2");
        var three = await db.HomeSlots.SingleAsync(s => s.Name == "hero-3");
        Assert.Null(two.ImageKey);
        Assert.Null(two.Alt);
        Assert.Equal(ContentKey, three.ImageKey);
        Assert.Equal("two", three.Alt);
        Assert.Equal("owner@nvc.eu", three.UpdatedByUpn);
    }

    [Fact]
    public async Task Swapping_a_hero_slide_with_a_model_card_is_refused()
    {
        using var db = NewDb();
        db.HomeSlots.Add(new HomeSlot { Name = "hero-1", ImageKey = ContentKey });
        await db.SaveChangesAsync();

        var result = await Svc(db).SwapAsync("hero-1", "model-37", null, CancellationToken.None);

        Assert.Equal(HomePhotoService.Outcome.Refused, result.Outcome);
        Assert.Equal(ContentKey, (await db.HomeSlots.SingleAsync()).ImageKey);
    }

    [Fact]
    public async Task Swapping_a_slot_with_itself_is_refused()
    {
        using var db = NewDb();
        var result = await Svc(db).SwapAsync("hero-1", "hero-1", null, CancellationToken.None);
        Assert.Equal(HomePhotoService.Outcome.Refused, result.Outcome);
    }

    // --- Clear and alt ------------------------------------------------------------------

    [Fact]
    public async Task Clearing_empties_the_slot_but_keeps_the_row()
    {
        using var db = NewDb();
        db.HomeSlots.Add(new HomeSlot { Name = "model-73", ImageKey = GalleryKey, Alt = "x" });
        await db.SaveChangesAsync();

        Assert.Equal(HomePhotoService.Outcome.Ok, await Svc(db).ClearAsync("model-73", "owner@nvc.eu", CancellationToken.None));

        var row = await db.HomeSlots.SingleAsync();
        Assert.Null(row.ImageKey);
        Assert.Null(row.Alt);
        Assert.Equal("owner@nvc.eu", row.UpdatedByUpn);
    }

    [Fact]
    public async Task Clearing_a_slot_nobody_touched_is_fine_and_creates_nothing()
    {
        using var db = NewDb();
        Assert.Equal(HomePhotoService.Outcome.Ok, await Svc(db).ClearAsync("hero-4", null, CancellationToken.None));
        Assert.Empty(await db.HomeSlots.ToListAsync());
    }

    [Fact]
    public async Task Alt_text_is_trimmed_and_capped_at_four_hundred_characters()
    {
        using var db = NewDb();
        var svc = Svc(db);

        Assert.True((await svc.SetAltAsync("hero-1", "  Our first house  ", null, default)).Ok);
        Assert.Equal("Our first house", (await db.HomeSlots.SingleAsync()).Alt);

        Assert.True((await svc.SetAltAsync("hero-1", "   ", null, default)).Ok);
        Assert.Null((await db.HomeSlots.SingleAsync()).Alt);

        var tooLong = await svc.SetAltAsync("hero-1", new string('a', 401), null, default);
        Assert.Equal(HomePhotoService.Outcome.Refused, tooLong.Outcome);
    }

    // --- The public read --------------------------------------------------------------

    [Fact]
    public async Task The_public_read_lists_filled_hero_slots_in_order_and_models_by_key()
    {
        using var db = NewDb();
        db.HomeSlots.AddRange(
            new HomeSlot { Name = "hero-4", ImageKey = ContentKey, Alt = "four" },
            new HomeSlot { Name = "hero-1", ImageKey = "home/1/abc.webp" },
            new HomeSlot { Name = "hero-2", ImageKey = null, Alt = "cleared" },
            new HomeSlot { Name = "model-58", ImageKey = GalleryKey, Alt = "Box 58" });
        await db.SaveChangesAsync();

        var dto = await Svc(db).ReadPublicAsync(CancellationToken.None);

        // Slot order, empties skipped — not insertion order, not alphabetical.
        Assert.Equal(new[] { "hero-1", "hero-4" }, dto.Hero.Select(h => h.Slot));
        Assert.Equal("/api/img/home/1/abc.webp", dto.Hero[0].Url);
        Assert.Equal("", dto.Hero[0].Alt);
        Assert.Equal("four", dto.Hero[1].Alt);

        Assert.Equal(new[] { "37", "58", "73" }, dto.Models.Keys);
        Assert.Null(dto.Models["37"]);
        Assert.Null(dto.Models["73"]);
        Assert.Equal("/api/img/" + GalleryKey, dto.Models["58"]!.Url);
        Assert.Equal("Box 58", dto.Models["58"]!.Alt);
    }

    [Fact]
    public async Task With_no_rows_the_public_read_is_the_empty_shape_not_an_error()
    {
        using var db = NewDb();
        var dto = await Svc(db).ReadPublicAsync(CancellationToken.None);

        Assert.Empty(dto.Hero);
        Assert.Equal(new[] { "37", "58", "73" }, dto.Models.Keys);
        Assert.All(dto.Models.Values, v => Assert.Null(v));
    }

    [Fact]
    public async Task The_public_read_is_cached_and_every_write_evicts_it()
    {
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var svc = Svc(db, cache);

        Assert.Empty((await svc.ReadPublicAsync(default)).Hero);
        Assert.True(cache.TryGetValue(HomePhotoService.CacheKey, out _));

        await svc.PickAsync("hero-1", ContentKey, null, default);
        Assert.False(cache.TryGetValue(HomePhotoService.CacheKey, out _));
        Assert.Single((await svc.ReadPublicAsync(default)).Hero);

        await svc.ClearAsync("hero-1", null, default);
        Assert.Empty((await svc.ReadPublicAsync(default)).Hero);
    }

    // The migration is applied before the publish (DEPLOY §5b). If that order is ever
    // reversed, the missing table must cost the admin photos, not the home page.
    private sealed class NoHomeSlotsTableDb : AppDbContext
    {
        public NoHomeSlotsTableDb(DbContextOptions<AppDbContext> o) : base(o) { }

        public override DbSet<TEntity> Set<TEntity>()
        {
            if (typeof(TEntity) == typeof(HomeSlot))
                throw new InvalidOperationException("Invalid object name 'HomeSlots'.");
            return base.Set<TEntity>();
        }
    }

    [Fact]
    public async Task Without_the_table_the_public_read_degrades_to_empty_and_retries_sooner()
    {
        using var db = new NoHomeSlotsTableDb(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"home-slots-missing-{Guid.NewGuid()}").Options);
        var cache = new MemoryCache(new MemoryCacheOptions());

        var dto = await Svc(db, cache).ReadPublicAsync(CancellationToken.None);

        Assert.Empty(dto.Hero);
        Assert.Equal(new[] { "37", "58", "73" }, dto.Models.Keys);
        Assert.All(dto.Models.Values, v => Assert.Null(v));

        // Cached — the database is not asked again per request — but for the short TTL,
        // which is the part a test can only see as "an entry exists".
        Assert.True(cache.TryGetValue(HomePhotoService.CacheKey, out HomePhotosDto? cached));
        Assert.Same(dto, cached);
    }

    // --- The paper trail ----------------------------------------------------------------

    [Fact]
    public void Changing_a_home_page_photo_is_an_audited_act()
    {
        // "Which photo was the hero in July?" is the audit log's question to answer.
        Assert.True(AuditedEntities.IsAudited(nameof(HomeSlot)));
    }
}
