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

// The home page's photo slots (2026-10 redesign), and the product pages' main photos that
// joined them on 2026-10-12 (the delivery and partner pages on 2026-10-15), and the sixteen page
// photos of 2026-10-16 (About, Interiors, Internal doors, the home service tiles). Two things carry the
// design and both live here: the twenty-nine slot names are an allow-list the write paths enforce, and the
// public read of the busiest page on the site must keep answering — an empty answer — when the table
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
    public void The_slots_are_the_hero_slides_then_the_models_then_the_product_pages_then_the_page_photos_appended()
    {
        // The product pages come LAST, not grouped elsewhere: the position is the upload
        // key's owner id, so the eight home slots that may already hold uploads keep theirs.
        Assert.Equal(
            new[]
            {
                "hero-1", "hero-2", "hero-3", "hero-4", "hero-5", "model-37", "model-58", "model-73",
                "page-modular-builds", "page-modular-houses", "page-steel-houses",
                // Appended 2026-10-15 for the delivery page, after every slot that may hold uploads.
                "page-delivery",
                // And the partner page's, the same day, after the delivery page's.
                "page-partner",
                // The page photos of 2026-10-16, after all thirteen, in the decided order:
                // About (main photo, the six team portraits, the factory floor), Interiors,
                // Internal doors, then the four home service tiles.
                "about-hero",
                "about-team-vladimir-vladimirov", "about-team-tsvetelin-bonin", "about-team-nikolay-lekov",
                "about-team-radina-ivanova", "about-team-vasil-vasilev", "about-team-ivan-vasilev",
                "factory-floor",
                "interiors-kitchen", "interiors-hero", "interiors-works",
                "doors-hero",
                "home-tile-modular-builds", "home-tile-modular-houses", "home-tile-steel-houses", "home-tile-interiors",
            },
            HomeSlotNames.All);
    }

    [Fact]
    public void The_first_thirteen_slots_never_move()
    {
        // Separate from the full list above so that a future edit to the tail can never pass
        // by "updating the expected list" over the head. Not because a move would corrupt a
        // stored photo — every row stores its full key and is found by Name, and keys are
        // home/{index}/{guid}, so nothing can collide — but because two things read the
        // position itself: a hero slot's slide number IS its position (HeroNumberOf, the Index
        // the panel's list reports for it), and every home/{index}/ folder already in Blob
        // names the slot it was uploaded for, which a reorder would turn into a lie.
        var expected = new[]
        {
            "hero-1", "hero-2", "hero-3", "hero-4", "hero-5",
            "model-37", "model-58", "model-73",
            "page-modular-builds", "page-modular-houses", "page-steel-houses", "page-delivery", "page-partner",
        };

        for (var i = 0; i < expected.Length; i++)
        {
            Assert.Equal(expected[i], HomeSlotNames.All[i]);
            Assert.Equal(i + 1, HomeSlotNames.IndexOf(expected[i]));
        }
        for (var n = 1; n <= 5; n++)
            Assert.Equal(n, HomeSlotNames.HeroNumberOf($"hero-{n}"));
    }

    [Fact]
    public void Every_slot_name_fits_the_name_column()
    {
        // HomeSlot.Name is MaxLength(40); a longer name would need a migration, not a row.
        Assert.All(HomeSlotNames.All, n => Assert.True(n.Length <= 40, n));
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
        Assert.Equal(9, HomeSlotNames.IndexOf("page-modular-builds"));
        Assert.Equal(10, HomeSlotNames.IndexOf("page-modular-houses"));
        Assert.Equal(11, HomeSlotNames.IndexOf("page-steel-houses"));
        Assert.Equal(12, HomeSlotNames.IndexOf("page-delivery"));
        Assert.Equal(13, HomeSlotNames.IndexOf("page-partner"));
        // The page photos of 2026-10-16: 14-29.
        Assert.Equal(14, HomeSlotNames.IndexOf("about-hero"));
        Assert.Equal(15, HomeSlotNames.IndexOf("about-team-vladimir-vladimirov"));
        Assert.Equal(16, HomeSlotNames.IndexOf("about-team-tsvetelin-bonin"));
        Assert.Equal(17, HomeSlotNames.IndexOf("about-team-nikolay-lekov"));
        Assert.Equal(18, HomeSlotNames.IndexOf("about-team-radina-ivanova"));
        Assert.Equal(19, HomeSlotNames.IndexOf("about-team-vasil-vasilev"));
        Assert.Equal(20, HomeSlotNames.IndexOf("about-team-ivan-vasilev"));
        Assert.Equal(21, HomeSlotNames.IndexOf("factory-floor"));
        Assert.Equal(22, HomeSlotNames.IndexOf("interiors-kitchen"));
        Assert.Equal(23, HomeSlotNames.IndexOf("interiors-hero"));
        Assert.Equal(24, HomeSlotNames.IndexOf("interiors-works"));
        Assert.Equal(25, HomeSlotNames.IndexOf("doors-hero"));
        Assert.Equal(26, HomeSlotNames.IndexOf("home-tile-modular-builds"));
        Assert.Equal(27, HomeSlotNames.IndexOf("home-tile-modular-houses"));
        Assert.Equal(28, HomeSlotNames.IndexOf("home-tile-steel-houses"));
        Assert.Equal(29, HomeSlotNames.IndexOf("home-tile-interiors"));
        Assert.Equal(0, HomeSlotNames.IndexOf("hero-6"));
        Assert.Equal(0, HomeSlotNames.IndexOf(null));
    }

    private static readonly string[] PagePhotoNames =
    {
        "about-hero",
        "about-team-vladimir-vladimirov", "about-team-tsvetelin-bonin", "about-team-nikolay-lekov",
        "about-team-radina-ivanova", "about-team-vasil-vasilev", "about-team-ivan-vasilev",
        "factory-floor",
        "interiors-kitchen", "interiors-hero", "interiors-works",
        "doors-hero",
        "home-tile-modular-builds", "home-tile-modular-houses", "home-tile-steel-houses", "home-tile-interiors",
    };

    [Fact]
    public void The_page_photos_are_their_own_kind_and_no_other_kind_grew()
    {
        Assert.Equal("photo", HomeSlotNames.PhotoKind);
        Assert.Equal(PagePhotoNames, HomeSlotNames.OfKind(HomeSlotNames.PhotoKind));
        Assert.All(PagePhotoNames, n => Assert.Equal("photo", HomeSlotNames.KindOf(n)));

        // Under the old prefix rule every one of these would have been a model card.
        Assert.Equal(5, HomeSlotNames.OfKind(HomeSlotNames.HeroKind).Count());
        Assert.Equal(3, HomeSlotNames.OfKind(HomeSlotNames.ModelKind).Count());
        Assert.Equal(5, HomeSlotNames.OfKind(HomeSlotNames.PageKind).Count());
        Assert.Equal(new[] { "modularBuilds", "modularHouses", "steelHouses", "delivery", "partner" }, HomeSlotNames.PageKeys);

        // Every name has exactly one kind, and the kinds cover the whole list.
        Assert.All(HomeSlotNames.All, n => Assert.NotNull(HomeSlotNames.KindOf(n)));
        Assert.Equal(
            HomeSlotNames.All.Count,
            new[] { HomeSlotNames.HeroKind, HomeSlotNames.ModelKind, HomeSlotNames.PageKind, HomeSlotNames.PhotoKind }
                .Sum(k => HomeSlotNames.OfKind(k).Count()));
    }

    [Fact]
    public void No_slot_name_makes_a_helper_throw_and_a_page_photo_has_no_key_of_another_kind()
    {
        // PageKeyOf used .First() over the page list, so a page-* name that list lacked threw
        // inside the panel's list and turned it into a 500. Every helper over every name:
        foreach (var name in HomeSlotNames.All)
        {
            var model = HomeSlotNames.ModelKeyOf(name);
            var page = HomeSlotNames.PageKeyOf(name);
            var hero = HomeSlotNames.HeroNumberOf(name);

            switch (HomeSlotNames.KindOf(name))
            {
                case HomeSlotNames.HeroKind:
                    Assert.Null(model); Assert.Null(page); Assert.InRange(hero, 1, 5); break;
                case HomeSlotNames.ModelKind:
                    Assert.NotNull(model); Assert.Null(page); Assert.Equal(0, hero); break;
                case HomeSlotNames.PageKind:
                    Assert.Null(model); Assert.NotNull(page); Assert.Equal(0, hero); break;
                case HomeSlotNames.PhotoKind:
                    Assert.Null(model); Assert.Null(page); Assert.Equal(0, hero); break;
                default:
                    Assert.Fail($"{name} has no kind");
                    break;
            }
        }

        // A name that only LOOKS like a page photo is still nobody's.
        Assert.False(HomeSlotNames.IsValid("about-team-someone-new"));
        Assert.False(HomeSlotNames.IsValid("About-hero"));
        Assert.Null(HomeSlotNames.KindOf("partner-step-yard"));   // phase 2, not in this release
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
    public void A_product_page_slot_is_its_own_kind_and_maps_to_the_spa_route_key()
    {
        Assert.Equal("page", HomeSlotNames.KindOf("page-modular-builds"));
        Assert.Equal("page", HomeSlotNames.KindOf("page-steel-houses"));
        // Not a model, whatever the old "not a hero means a model" rule would have said.
        Assert.Null(HomeSlotNames.ModelKeyOf("page-modular-houses"));
        Assert.Equal(0, HomeSlotNames.HeroNumberOf("page-modular-houses"));

        Assert.Equal(new[] { "modularBuilds", "modularHouses", "steelHouses", "delivery", "partner" }, HomeSlotNames.PageKeys);
        Assert.Equal("modularBuilds", HomeSlotNames.PageKeyOf("page-modular-builds"));
        Assert.Equal("modularHouses", HomeSlotNames.PageKeyOf("page-modular-houses"));
        Assert.Equal("steelHouses", HomeSlotNames.PageKeyOf("page-steel-houses"));
        Assert.Equal("delivery", HomeSlotNames.PageKeyOf("page-delivery"));
        Assert.Equal("partner", HomeSlotNames.PageKeyOf("page-partner"));
        Assert.Null(HomeSlotNames.PageKeyOf("hero-1"));
        Assert.Null(HomeSlotNames.PageKeyOf("page-gallery"));

        Assert.Equal("page-steel-houses", HomeSlotNames.SlotOfPage("steelHouses"));
        Assert.Equal("page-delivery", HomeSlotNames.SlotOfPage("delivery"));
        Assert.Equal("page-partner", HomeSlotNames.SlotOfPage("partner"));
        Assert.Null(HomeSlotNames.SlotOfPage("gallery"));
        Assert.Null(HomeSlotNames.SlotOfPage(null));

        Assert.Equal(
            new[] { "page-modular-builds", "page-modular-houses", "page-steel-houses", "page-delivery", "page-partner" },
            HomeSlotNames.OfKind(HomeSlotNames.PageKind));
        // The other kinds did not grow by accident.
        Assert.Equal(5, HomeSlotNames.OfKind(HomeSlotNames.HeroKind).Count());
        Assert.Equal(3, HomeSlotNames.OfKind(HomeSlotNames.ModelKind).Count());
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
        Assert.False(HomeSlotNames.IsValid("page-gallery"));
        Assert.False(HomeSlotNames.IsValid("page-modularHouses"));
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
    public void An_uploaded_product_page_photo_is_minted_after_the_home_slots()
    {
        var key = ImageKey.NewOwnedKey(ImageKey.HomeScope, HomeSlotNames.IndexOf("page-modular-houses"), "porch.jpg", ".webp");
        Assert.Matches("^home/10/[0-9a-f]{32}\\.webp$", key);
    }

    [Fact]
    public void An_uploaded_page_photo_is_minted_under_its_own_position_after_the_first_thirteen()
    {
        var key = ImageKey.NewOwnedKey(ImageKey.HomeScope, HomeSlotNames.IndexOf("about-team-radina-ivanova"), "radina.jpg", ".webp");
        Assert.Matches("^home/18/[0-9a-f]{32}\\.webp$", key);
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

        // The product pages are listed too, untouched, indexed by the SPA's route key.
        var steel = slots.Single(s => s.Name == "page-steel-houses");
        Assert.Equal("page", steel.Kind);
        Assert.Equal("steelHouses", steel.Index);
        Assert.Null(steel.Url);
    }

    [Fact]
    public async Task The_list_carries_every_page_photo_indexed_by_its_own_name()
    {
        using var db = NewDb();
        db.HomeSlots.Add(new HomeSlot { Name = "factory-floor", ImageKey = "home/21/abc.webp", Alt = "Цехът" });
        await db.SaveChangesAsync();

        var slots = await Svc(db).ListAdminAsync(CancellationToken.None);

        Assert.Equal(29, slots.Count);
        Assert.Equal(PagePhotoNames, slots.Where(s => s.Kind == "photo").Select(s => s.Name));

        // Index is the name, not the "0" a hero number would have printed for it.
        var filled = slots.Single(s => s.Name == "factory-floor");
        Assert.Equal("photo", filled.Kind);
        Assert.Equal("factory-floor", filled.Index);
        Assert.Equal("/api/img/home/21/abc.webp", filled.Url);
        Assert.Equal("Цехът", filled.Alt);

        var empty = slots.Single(s => s.Name == "about-team-radina-ivanova");
        Assert.Equal("photo", empty.Kind);
        Assert.Equal("about-team-radina-ivanova", empty.Index);
        Assert.Null(empty.Url);
    }

    [Fact]
    public async Task A_page_photo_takes_an_upload_a_pick_an_alt_and_a_clear_like_any_other_slot()
    {
        using var db = NewDb();
        db.Houses.Add(new House
        {
            Id = 8, Title = "Box 37", CategoryKey = HouseCategories.Prefab, IsPublished = true,
            Images = { new HouseImage { ImageKey = GalleryKey } },
        });
        db.Cases.Add(new Case { Id = 3, CompanyName = "Family house", Images = { new CaseImage { ImageKey = CaseKey } } });
        await db.SaveChangesAsync();
        var svc = Svc(db);

        var key = ImageKey.NewOwnedKey(ImageKey.HomeScope, HomeSlotNames.IndexOf("about-hero"), "team.jpg", ".webp");
        Assert.True((await svc.RecordImageAsync("about-hero", key, alt: null, "owner@nvc.eu", default)).Ok);
        Assert.True((await svc.SetAltAsync("about-hero", "Екипът пред склада", null, default)).Ok);

        // The pick rule is the same for every kind: gallery, case and content keys only.
        Assert.True((await svc.PickAsync("home-tile-modular-builds", GalleryKey, null, default)).Ok);
        Assert.True((await svc.PickAsync("interiors-works", CaseKey, null, default)).Ok);
        Assert.True((await svc.PickAsync("doors-hero", ContentKey, null, default)).Ok);
        var refused = await svc.PickAsync("factory-floor", "home/1/abc.webp", null, default);
        Assert.Equal(HomePhotoService.Outcome.Refused, refused.Outcome);
        Assert.Equal("That image is not in the gallery.", refused.Error);

        var about = await db.HomeSlots.SingleAsync(s => s.Name == "about-hero");
        Assert.Equal(key, about.ImageKey);
        Assert.Equal("Екипът пред склада", about.Alt);
        Assert.Null(await db.HomeSlots.SingleOrDefaultAsync(s => s.Name == "factory-floor"));

        Assert.Equal(HomePhotoService.Outcome.Ok, await svc.ClearAsync("about-hero", null, default));
        about = await db.HomeSlots.SingleAsync(s => s.Name == "about-hero");
        Assert.Null(about.ImageKey);
        Assert.Null(about.Alt);
    }

    [Fact]
    public async Task A_product_page_slot_takes_a_case_photo_like_any_other_slot()
    {
        // The houses page's default is the Paralia Kariani case photo; the owner may pin it,
        // or another case photo, explicitly.
        using var db = NewDb();
        db.Cases.Add(new Case
        {
            Id = 3, CompanyName = "Paralia Kariani",
            Images = { new CaseImage { ImageKey = CaseKey } },
        });
        await db.SaveChangesAsync();

        var result = await Svc(db).PickAsync("page-modular-houses", CaseKey, "owner@nvc.eu", CancellationToken.None);

        Assert.True(result.Ok);
        Assert.Equal("page", result.Slot!.Kind);
        Assert.Equal("modularHouses", result.Slot.Index);
        Assert.Equal("/api/img/" + CaseKey, result.Slot.Url);
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
    public async Task A_product_page_photo_is_never_swapped_not_even_with_another_page()
    {
        using var db = NewDb();
        db.HomeSlots.AddRange(
            new HomeSlot { Name = "page-modular-builds", ImageKey = ContentKey, Alt = "containers" },
            new HomeSlot { Name = "hero-1", ImageKey = GalleryKey });
        await db.SaveChangesAsync();
        var svc = Svc(db);

        foreach (var (a, b) in new[]
        {
            ("page-modular-builds", "page-modular-houses"),
            ("page-modular-builds", "hero-1"),
            ("model-37", "page-steel-houses"),
        })
        {
            var result = await svc.SwapAsync(a, b, null, CancellationToken.None);
            Assert.Equal(HomePhotoService.Outcome.Refused, result.Outcome);
        }

        Assert.Equal(ContentKey, (await db.HomeSlots.SingleAsync(s => s.Name == "page-modular-builds")).ImageKey);
        Assert.Equal(GalleryKey, (await db.HomeSlots.SingleAsync(s => s.Name == "hero-1")).ImageKey);
        Assert.Equal(2, await db.HomeSlots.CountAsync());
    }

    [Fact]
    public async Task A_page_photo_is_never_swapped_with_anything()
    {
        // A team portrait in a home tile, or the kitchen in the doors hero, is a mistake, not
        // an order: each page photo belongs to one place. Swap stays what it was — hero with
        // hero, model with model — and the photo kind joins the page kind in refusing it.
        using var db = NewDb();
        db.HomeSlots.AddRange(
            new HomeSlot { Name = "about-team-radina-ivanova", ImageKey = "home/18/a.webp", Alt = "Радина" },
            new HomeSlot { Name = "about-team-ivan-vasilev", ImageKey = "home/20/b.webp", Alt = "Иван" },
            new HomeSlot { Name = "hero-1", ImageKey = GalleryKey });
        await db.SaveChangesAsync();
        var svc = Svc(db);

        foreach (var (a, b) in new[]
        {
            ("about-team-radina-ivanova", "about-team-ivan-vasilev"),   // photo with photo
            ("about-team-radina-ivanova", "hero-1"),                    // photo with hero
            ("hero-1", "home-tile-interiors"),                          // hero with photo
            ("model-37", "factory-floor"),                              // model with photo
            ("doors-hero", "page-partner"),                             // photo with page
        })
        {
            var result = await svc.SwapAsync(a, b, null, CancellationToken.None);
            Assert.Equal(HomePhotoService.Outcome.Refused, result.Outcome);
        }

        var both = await svc.SwapAsync("about-team-radina-ivanova", "about-team-ivan-vasilev", null, default);
        Assert.Equal("This photo belongs to its place and cannot be swapped.", both.Error);

        // Nothing moved and nothing was created.
        Assert.Equal("home/18/a.webp", (await db.HomeSlots.SingleAsync(s => s.Name == "about-team-radina-ivanova")).ImageKey);
        Assert.Equal("home/20/b.webp", (await db.HomeSlots.SingleAsync(s => s.Name == "about-team-ivan-vasilev")).ImageKey);
        Assert.Equal(GalleryKey, (await db.HomeSlots.SingleAsync(s => s.Name == "hero-1")).ImageKey);
        Assert.Equal(3, await db.HomeSlots.CountAsync());

        // And the hero still reorders exactly as before.
        Assert.True((await svc.SwapAsync("hero-1", "hero-2", null, default)).Ok);
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

        // No page slot was touched: all five keys, all null.
        Assert.Equal(new[] { "modularBuilds", "modularHouses", "steelHouses", "delivery", "partner" }, dto.Pages.Keys);
        Assert.All(dto.Pages.Values, v => Assert.Null(v));
    }

    [Fact]
    public async Task The_public_read_keys_the_product_page_photos_by_route_key()
    {
        using var db = NewDb();
        db.HomeSlots.AddRange(
            new HomeSlot { Name = "page-modular-houses", ImageKey = CaseKey, Alt = "Paralia Kariani, 58 m²" },
            new HomeSlot { Name = "page-steel-houses", ImageKey = "home/11/abc.webp" },
            new HomeSlot { Name = "page-modular-builds", ImageKey = null, Alt = "cleared" },
            new HomeSlot { Name = "page-delivery", ImageKey = "home/12/crane.webp", Alt = "Crane lifting a container" },
            new HomeSlot { Name = "page-partner", ImageKey = "home/13/yard.webp", Alt = "Units waiting in the yard" });
        await db.SaveChangesAsync();

        var dto = await Svc(db).ReadPublicAsync(CancellationToken.None);

        Assert.Equal(new[] { "modularBuilds", "modularHouses", "steelHouses", "delivery", "partner" }, dto.Pages.Keys);
        Assert.Null(dto.Pages["modularBuilds"]);
        Assert.Equal("/api/img/" + CaseKey, dto.Pages["modularHouses"]!.Url);
        Assert.Equal("Paralia Kariani, 58 m²", dto.Pages["modularHouses"]!.Alt);
        Assert.Equal("/api/img/home/11/abc.webp", dto.Pages["steelHouses"]!.Url);
        Assert.Equal("", dto.Pages["steelHouses"]!.Alt);
        Assert.Equal("/api/img/home/12/crane.webp", dto.Pages["delivery"]!.Url);
        Assert.Equal("Crane lifting a container", dto.Pages["delivery"]!.Alt);
        Assert.Equal("/api/img/home/13/yard.webp", dto.Pages["partner"]!.Url);
        Assert.Equal("Units waiting in the yard", dto.Pages["partner"]!.Alt);

        // A page photo is not a hero slide and not a model card.
        Assert.Empty(dto.Hero);
        Assert.All(dto.Models.Values, v => Assert.Null(v));
    }

    [Fact]
    public async Task The_public_read_lists_the_filled_page_photos_by_slot_name_and_nothing_else_in_slots()
    {
        using var db = NewDb();
        db.HomeSlots.AddRange(
            new HomeSlot { Name = "about-hero", ImageKey = "home/14/team.webp", Alt = "Екипът" },
            new HomeSlot { Name = "about-team-radina-ivanova", ImageKey = "home/18/radina.webp" },
            new HomeSlot { Name = "home-tile-interiors", ImageKey = CaseKey, Alt = "Кухня" },
            new HomeSlot { Name = "interiors-kitchen", ImageKey = null, Alt = "cleared" },
            // The legacy kinds, filled, to prove they stay in their own fields only.
            new HomeSlot { Name = "hero-2", ImageKey = ContentKey, Alt = "two" },
            new HomeSlot { Name = "model-37", ImageKey = GalleryKey, Alt = "Box 37" },
            new HomeSlot { Name = "page-delivery", ImageKey = "home/12/crane.webp", Alt = "Кран" });
        await db.SaveChangesAsync();

        var dto = await Svc(db).ReadPublicAsync(CancellationToken.None);

        // Filled page photos only, in slot order; the cleared one and the untouched ones are
        // absent rather than null, and no hero, model or page slot is repeated here.
        Assert.Equal(new[] { "about-hero", "about-team-radina-ivanova", "home-tile-interiors" }, dto.Slots.Keys);
        Assert.Equal("/api/img/home/14/team.webp", dto.Slots["about-hero"].Url);
        Assert.Equal("Екипът", dto.Slots["about-hero"].Alt);
        Assert.Equal("/api/img/home/18/radina.webp", dto.Slots["about-team-radina-ivanova"].Url);
        Assert.Equal("", dto.Slots["about-team-radina-ivanova"].Alt);
        Assert.Equal("/api/img/" + CaseKey, dto.Slots["home-tile-interiors"].Url);
        Assert.Equal("Кухня", dto.Slots["home-tile-interiors"].Alt);

        // The old fields read exactly as they did before "slots" existed.
        Assert.Equal(new[] { "hero-2" }, dto.Hero.Select(h => h.Slot));
        Assert.Equal("two", dto.Hero[0].Alt);
        Assert.Equal(new[] { "37", "58", "73" }, dto.Models.Keys);
        Assert.Equal("/api/img/" + GalleryKey, dto.Models["37"]!.Url);
        Assert.Null(dto.Models["58"]);
        Assert.Equal(new[] { "modularBuilds", "modularHouses", "steelHouses", "delivery", "partner" }, dto.Pages.Keys);
        Assert.Equal("/api/img/home/12/crane.webp", dto.Pages["delivery"]!.Url);
        Assert.Null(dto.Pages["partner"]);
    }

    [Fact]
    public async Task With_no_rows_the_public_read_is_the_empty_shape_not_an_error()
    {
        using var db = NewDb();
        var dto = await Svc(db).ReadPublicAsync(CancellationToken.None);

        Assert.Empty(dto.Hero);
        Assert.Equal(new[] { "37", "58", "73" }, dto.Models.Keys);
        Assert.All(dto.Models.Values, v => Assert.Null(v));
        Assert.Equal(new[] { "modularBuilds", "modularHouses", "steelHouses", "delivery", "partner" }, dto.Pages.Keys);
        Assert.All(dto.Pages.Values, v => Assert.Null(v));
        Assert.NotNull(dto.Slots);
        Assert.Empty(dto.Slots);
    }

    [Fact]
    public void The_empty_shape_carries_every_page_key_too()
    {
        // What the public route answers on a machine with no database at all.
        var dto = HomePhotosDto.Empty();
        Assert.Equal(new[] { "modularBuilds", "modularHouses", "steelHouses", "delivery", "partner" }, dto.Pages.Keys);
        Assert.All(dto.Pages.Values, v => Assert.Null(v));
        // And an empty slots map, never a missing one: absent means "an API older than slots".
        Assert.NotNull(dto.Slots);
        Assert.Empty(dto.Slots);
        Assert.NotSame(dto.Slots, HomePhotosDto.Empty().Slots);
    }

    [Fact]
    public void The_cache_key_names_the_shape_with_slots()
    {
        // v5 entries have no "slots"; a v5 entry read back as v6 would serve a body without it.
        Assert.Equal("home:photos:v6", HomePhotoService.CacheKey);
    }

    [Fact]
    public async Task The_public_body_serialises_to_the_shape_the_spa_reads()
    {
        // ASP.NET's defaults (Program.cs sets no JSON options): camelCase members, dictionary
        // keys exactly as stored — so "about-team-radina-ivanova", not a renamed key.
        using var db = NewDb();
        db.HomeSlots.AddRange(
            new HomeSlot { Name = "about-team-radina-ivanova", ImageKey = "home/18/r.webp", Alt = "Радина" },
            new HomeSlot { Name = "page-partner", ImageKey = "home/13/y.webp", Alt = "Двор" });
        await db.SaveChangesAsync();

        var dto = await Svc(db).ReadPublicAsync(CancellationToken.None);
        var json = System.Text.Json.JsonSerializer.Serialize(
            dto, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(
            new[] { "hero", "models", "pages", "from", "slots" },
            root.EnumerateObject().Select(p => p.Name));
        Assert.Equal("/api/img/home/13/y.webp", root.GetProperty("pages").GetProperty("partner").GetProperty("url").GetString());

        var slots = root.GetProperty("slots");
        Assert.Equal(new[] { "about-team-radina-ivanova" }, slots.EnumerateObject().Select(p => p.Name));
        var radina = slots.GetProperty("about-team-radina-ivanova");
        Assert.Equal("/api/img/home/18/r.webp", radina.GetProperty("url").GetString());
        Assert.Equal("Радина", radina.GetProperty("alt").GetString());
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

        // A product page's photo goes through the same eviction.
        await svc.PickAsync("page-modular-builds", ContentKey, null, default);
        Assert.NotNull((await svc.ReadPublicAsync(default)).Pages["modularBuilds"]);

        // And so does a page photo, on every verb.
        await svc.PickAsync("doors-hero", ContentKey, null, default);
        Assert.Equal("/api/img/" + ContentKey, (await svc.ReadPublicAsync(default)).Slots["doors-hero"].Url);
        await svc.SetAltAsync("doors-hero", "Врата", null, default);
        Assert.Equal("Врата", (await svc.ReadPublicAsync(default)).Slots["doors-hero"].Alt);
        await svc.RecordImageAsync("doors-hero", "home/25/abc.webp", null, null, default);
        Assert.Equal("/api/img/home/25/abc.webp", (await svc.ReadPublicAsync(default)).Slots["doors-hero"].Url);
        await svc.ClearAsync("doors-hero", null, default);
        Assert.False((await svc.ReadPublicAsync(default)).Slots.ContainsKey("doors-hero"));
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
        Assert.All(dto.Pages.Values, v => Assert.Null(v));
        Assert.Empty(dto.Slots);

        // Cached — the database is not asked again per request — but for the short TTL,
        // which is the part a test can only see as "an entry exists".
        Assert.True(cache.TryGetValue(HomePhotoService.CacheKey, out HomePhotosDto? cached));
        Assert.Same(dto, cached);
    }

    // --- Upload refusals that need no storage -------------------------------------------

    // The controller as the site builds it. The blob client points nowhere real and is never
    // reached: every upload below is refused before the blob write.
    private static Controllers.AdminHomePhotosController UploadController(AppDbContext db) => new(
        Svc(db),
        new ImageProcessor(Microsoft.Extensions.Logging.Abstractions.NullLogger<ImageProcessor>.Instance),
        new BlobImageSource(
            new Azure.Storage.Blobs.BlobContainerClient(new Uri("https://example.blob.core.windows.net/images")),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<BlobImageSource>.Instance))
    {
        ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext(),
        },
    };

    private static Microsoft.AspNetCore.Http.IFormFile FileOf(byte[] bytes, string fileName) =>
        new Microsoft.AspNetCore.Http.FormFile(new System.IO.MemoryStream(bytes), 0, bytes.Length, "file", fileName);

    // How an iPhone's .HEIC begins: a 24-byte ftyp box naming the heic brand, then the meta box.
    private static readonly byte[] HeicBytes =
        new byte[] { 0, 0, 0, 24 }
            .Concat(System.Text.Encoding.ASCII.GetBytes("ftypheic"))
            .Concat(new byte[] { 0, 0, 0, 0 })
            .Concat(System.Text.Encoding.ASCII.GetBytes("mif1heic"))
            .Concat(new byte[] { 0, 0, 0, 0x22 })
            .Concat(System.Text.Encoding.ASCII.GetBytes("meta"))
            .Concat(new byte[64])
            .ToArray();

    // The sentences a refusal carries, as the panel shows them ({ errors: [...] }).
    private static string[] ErrorsOf(Microsoft.AspNetCore.Mvc.IActionResult result)
    {
        var bad = Assert.IsType<Microsoft.AspNetCore.Mvc.BadRequestObjectResult>(result);
        var errors = bad.Value!.GetType().GetProperty("errors")!.GetValue(bad.Value);
        return Assert.IsType<string[]>(errors);
    }

    [Theory]
    [InlineData("IMG_2041.HEIC")]
    [InlineData("photo.jpg")]   // the bytes decide, not the name
    public async Task A_heic_upload_is_refused_in_words_the_owner_can_act_on(string fileName)
    {
        using var db = NewDb();

        var result = await UploadController(db).Upload("about-team-radina-ivanova", FileOf(HeicBytes, fileName), default);

        Assert.Equal(new[] { ImageProcessor.HeifRefusal }, ErrorsOf(result));
        Assert.Empty(await db.HomeSlots.ToListAsync());
    }

    [Fact]
    public async Task An_undecodable_file_is_called_heic_only_when_its_name_says_so()
    {
        using var db = NewDb();
        var junk = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 };

        var named = await UploadController(db).Upload("doors-hero", FileOf(junk, "IMG_0007.heif"), default);
        Assert.Equal(new[] { ImageProcessor.HeifRefusal }, ErrorsOf(named));

        var plain = await UploadController(db).Upload("doors-hero", FileOf(junk, "notes.txt"), default);
        Assert.Equal(new[] { "That file could not be read as an image." }, ErrorsOf(plain));

        Assert.Empty(await db.HomeSlots.ToListAsync());
    }

    [Fact]
    public async Task An_upload_to_a_name_outside_the_list_is_not_found_before_anything_is_read()
    {
        using var db = NewDb();
        var result = await UploadController(db).Upload("partner-step-yard", FileOf(HeicBytes, "x.heic"), default);
        Assert.IsType<Microsoft.AspNetCore.Mvc.NotFoundResult>(result);
    }

    // --- The paper trail ----------------------------------------------------------------

    [Fact]
    public void Changing_a_home_page_photo_is_an_audited_act()
    {
        // "Which photo was the hero in July?" is the audit log's question to answer.
        Assert.True(AuditedEntities.IsAudited(nameof(HomeSlot)));
    }
}
