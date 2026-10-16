using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace Data.Entities;

// The photo slots on the home page and the product pages, and the rows that fill them.
//
// The redesigned home page (2026-10) has exactly eight places an owner may want to change a
// photo without a developer: five hero slides and the three model cards in the prices strip.
// The three product pages (containers, modular houses, houses built to a project) followed
// a day later with one main photo each, because the owner asked for "the same as the home
// page" there (2026-10-12) — eleven slots in all. The delivery page got the twelfth when it
// became "Delivery and assembly" (2026-10-15), so the crane photo can be swapped for one of
// NVC's own deliveries without a developer. The partner page got the thirteenth the same day
// (2026-10-15), so a photo of the yard full of units can replace the crane until there is one.
//
// The owner then asked (2026-10-16) to change "most photos" from the admin panel, and sixteen
// more slots followed: the About page's main photo, its six team portraits and its factory floor;
// the Interiors page's main photo, kitchen tile and works photo; the Internal doors page's
// main photo; and the four service tiles on the home page — twenty-nine slots in all. They
// are their own kind, "photo": each one belongs to one place on one page, so, like a product
// page's photo, it is never swapped with anything.
//
// They are fixed slots rather than a list the panel can grow, for the same reason the
// brochures are six wired slugs: each page is laid out around its count, the SPA carries a
// content default for every slot (or, for the steel page, a deliberate "no photo"), and an
// "add a sixth slide" button would need a design, not a row. So the names are an allow-list
// HERE, in the API, and every write path refuses a name outside it. Adding a slot is a code
// change on both sides, which is the honest size of that job.
public static class HomeSlotNames
{
    public const string HeroKind = "hero";
    public const string ModelKind = "model";
    public const string PageKind = "page";
    public const string PhotoKind = "photo";

    // One slot: its name, its kind, and for a model card the configurator model key, for a
    // product page the SPA's route key. The kind is WRITTEN DOWN here, not guessed from the
    // name: until 2026-10-16 it was guessed from the prefix, so any name that was neither
    // "hero-" nor "page-" silently became a model card (swappable with model-37, and counted
    // as a fourth model), and a "page-" name missing from the route-key list made the panel's
    // list throw. A table cannot do either.
    private sealed record Def(string Name, string Kind, string? Key = null);

    // In page order within each block: the hero slides as the carousel plays them, the model
    // cards as the strip lists them, the product pages in menu order, then the page photos
    // of 2026-10-16. The 1-based position in this table is also the "owner id" the upload
    // path mints image keys under (home/{index}/{guid}.webp), and a hero slot's position is
    // its slide number (HeroNumberOf), so new slots are APPENDED, never inserted, and nothing
    // here is shuffled. A reorder would not corrupt a stored photo — each row stores its full
    // key and finds its row by Name — but it would renumber the hero slides (HeroNumberOf)
    // and make every home/{index}/ folder already in Blob name the wrong slot. That is why
    // each block sits after the last rather than beside the slots it resembles.
    //
    // Names are kept forever, even when a place on a page goes away (a team member who
    // leaves): the SPA's registry hides a retired slot from the panel, and the name stays
    // here so the positions after it never move.
    private static readonly Def[] Defs =
    {
        // 1-5: the home hero slides.
        new("hero-1", HeroKind), new("hero-2", HeroKind), new("hero-3", HeroKind),
        new("hero-4", HeroKind), new("hero-5", HeroKind),
        // 6-8: the model cards in the home prices strip.
        new("model-37", ModelKind, "37"), new("model-58", ModelKind, "58"), new("model-73", ModelKind, "73"),
        // 9-11: the product pages' main photos (2026-10-12).
        new("page-modular-builds", PageKind, "modularBuilds"),
        new("page-modular-houses", PageKind, "modularHouses"),
        new("page-steel-houses", PageKind, "steelHouses"),
        // 12-13: the delivery page's, then the partner page's (both 2026-10-15).
        new("page-delivery", PageKind, "delivery"),
        new("page-partner", PageKind, "partner"),
        // 14-29: the page photos (2026-10-16).
        new("about-hero", PhotoKind),
        new("about-team-vladimir-vladimirov", PhotoKind),
        new("about-team-tsvetelin-bonin", PhotoKind),
        new("about-team-nikolay-lekov", PhotoKind),
        new("about-team-radina-ivanova", PhotoKind),
        new("about-team-vasil-vasilev", PhotoKind),
        new("about-team-ivan-vasilev", PhotoKind),
        new("factory-floor", PhotoKind),
        new("interiors-kitchen", PhotoKind),
        new("interiors-hero", PhotoKind),
        new("interiors-works", PhotoKind),
        new("doors-hero", PhotoKind),
        new("home-tile-modular-builds", PhotoKind),
        new("home-tile-modular-houses", PhotoKind),
        new("home-tile-steel-houses", PhotoKind),
        new("home-tile-interiors", PhotoKind),
    };

    private static readonly string[] AllArray = Defs.Select(d => d.Name).ToArray();

    private static readonly Dictionary<string, Def> ByName =
        Defs.ToDictionary(d => d.Name, StringComparer.Ordinal);

    public static readonly IReadOnlyList<string> All = AllArray;

    // The configurator's real model keys, which the SPA uses for its deep links (?model=37).
    // Kept beside the slot names so the public read can key its "models" object the same way.
    public static readonly IReadOnlyList<string> ModelKeys = new[] { "37", "58", "73" };

    // Each product-page slot and the SPA's route key for that page (paths.modularBuilds and
    // so on), which is how the public read keys its "pages" object: the page asks for its
    // own photo by the name it already routes under, and never has to know the slot's.
    private static readonly (string Slot, string Key)[] PageArray =
        Defs.Where(d => d.Kind == PageKind).Select(d => (d.Name, d.Key!)).ToArray();

    public static readonly IReadOnlyList<string> PageKeys = PageArray.Select(p => p.Key).ToArray();

    public static bool IsValid(string? name) => name is not null && ByName.ContainsKey(name);

    /// <summary>1-based position in the allow-list; 0 for a name that is not in it.</summary>
    public static int IndexOf(string? name) =>
        name is null ? 0 : Array.IndexOf(AllArray, name) + 1;

    /// <summary>"hero", "model", "page" or "photo"; null for a name that is not in the list.</summary>
    public static string? KindOf(string? name) =>
        name is not null && ByName.TryGetValue(name, out var def) ? def.Kind : null;

    /// <summary>The configurator model key ("37") behind a model slot; null for anything else.</summary>
    public static string? ModelKeyOf(string? name) =>
        name is not null && ByName.TryGetValue(name, out var def) && def.Kind == ModelKind ? def.Key : null;

    /// <summary>The SPA route key ("modularHouses") behind a page slot; null for anything else.</summary>
    public static string? PageKeyOf(string? name) =>
        name is not null && ByName.TryGetValue(name, out var def) && def.Kind == PageKind ? def.Key : null;

    /// <summary>The page slot ("page-modular-houses") for an SPA route key; null for an unknown key.</summary>
    public static string? SlotOfPage(string? pageKey) =>
        PageArray.FirstOrDefault(p => p.Key == pageKey).Slot;

    /// <summary>The hero slide number (1..5) behind a hero slot; 0 for anything else.</summary>
    public static int HeroNumberOf(string? name) =>
        KindOf(name) == HeroKind ? IndexOf(name) : 0;

    public static IEnumerable<string> OfKind(string kind) => Defs.Where(d => d.Kind == kind).Select(d => d.Name);
}

// One home-page slot and the photo in it. A row exists once somebody has touched the slot;
// an untouched slot has no row, and the public read treats "no row" and "ImageKey null" the
// same way — the SPA shows its content default.
//
// ImageKey is a COPY of a key string, never a foreign key. A model card usually shows a
// gallery photo, picked from the gallery rather than uploaded again; if that were an FK to
// HouseImage, deleting the gallery row (cascade from House) would empty the home page with
// no warning. Copying the key means the hero survives a gallery clean-up, at the cost that
// the two can drift — a trade the brochures make too, and the one the panel can see.
//
// Blobs under home/ are never deleted: clearing or replacing a slot leaves the old object in
// the container, exactly as the gallery and the brochures do (GalleryAdminService, 2026-08).
// A hero that is replaced every season accumulates a few orphaned files a year; that is the
// accepted cost of never having a row point at bytes that are gone.
public class HomeSlot
{
    public int Id { get; set; }

    // One of HomeSlotNames.All, unique. Named "Name" so the audit log's Summarise labels
    // the row with it ("hero-2 updated by …") without a special case.
    [Required]
    [MaxLength(40)] public string Name { get; set; } = "";

    // A key under gallery/, cases/, content/ or home/ — never a URL (see HouseImage). Null
    // means the slot is cleared and the SPA's default shows.
    [MaxLength(1024)] public string? ImageKey { get; set; }

    // Alt text for the photo. One string, not three languages: the page's own captions
    // carry the localised copy, and alt on a decorative hero is short enough to be neutral.
    [MaxLength(400)] public string? Alt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    [MaxLength(320)] public string? UpdatedByUpn { get; set; }
}
