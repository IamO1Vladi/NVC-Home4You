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

    // In page order: the hero slides as the carousel plays them, the model cards as the
    // strip lists them, then the product pages in menu order. The 1-based position in this
    // array is also the "owner id" the upload path mints image keys under
    // (home/{index}/{guid}.webp), so the order is part of the storage layout: new slots are
    // APPENDED, never inserted, and nothing here is shuffled once anything has been uploaded.
    // That is why the product pages sit after the models rather than in a block of their own.
    private static readonly string[] AllArray =
    {
        "hero-1", "hero-2", "hero-3", "hero-4", "hero-5",
        "model-37", "model-58", "model-73",
        "page-modular-builds", "page-modular-houses", "page-steel-houses",
        "page-delivery",
        "page-partner",
    };

    public static readonly IReadOnlyList<string> All = AllArray;

    // The configurator's real model keys, which the SPA uses for its deep links (?model=37).
    // Kept beside the slot names so the public read can key its "models" object the same way.
    public static readonly IReadOnlyList<string> ModelKeys = new[] { "37", "58", "73" };

    // Each product-page slot and the SPA's route key for that page (paths.modularBuilds and
    // so on), which is how the public read keys its "pages" object: the page asks for its
    // own photo by the name it already routes under, and never has to know the slot's.
    private static readonly (string Slot, string Key)[] PageArray =
    {
        ("page-modular-builds", "modularBuilds"),
        ("page-modular-houses", "modularHouses"),
        ("page-steel-houses", "steelHouses"),
        ("page-delivery", "delivery"),
        ("page-partner", "partner"),
    };

    public static readonly IReadOnlyList<string> PageKeys = PageArray.Select(p => p.Key).ToArray();

    public static bool IsValid(string? name) => name is not null && Array.IndexOf(AllArray, name) >= 0;

    /// <summary>1-based position in the allow-list; 0 for a name that is not in it.</summary>
    public static int IndexOf(string? name) =>
        name is null ? 0 : Array.IndexOf(AllArray, name) + 1;

    /// <summary>"hero", "model" or "page"; null for a name that is not in the list.</summary>
    public static string? KindOf(string? name)
    {
        if (!IsValid(name)) return null;
        if (name!.StartsWith("hero-", StringComparison.Ordinal)) return HeroKind;
        if (name.StartsWith("page-", StringComparison.Ordinal)) return PageKind;
        return ModelKind;
    }

    /// <summary>The configurator model key ("37") behind a model slot; null for anything else.</summary>
    public static string? ModelKeyOf(string? name) =>
        KindOf(name) == ModelKind ? name!["model-".Length..] : null;

    /// <summary>The SPA route key ("modularHouses") behind a page slot; null for anything else.</summary>
    public static string? PageKeyOf(string? name) =>
        KindOf(name) == PageKind ? PageArray.First(p => p.Slot == name).Key : null;

    /// <summary>The page slot ("page-modular-houses") for an SPA route key; null for an unknown key.</summary>
    public static string? SlotOfPage(string? pageKey) =>
        PageArray.FirstOrDefault(p => p.Key == pageKey).Slot;

    /// <summary>The hero slide number (1..5) behind a hero slot; 0 for anything else.</summary>
    public static int HeroNumberOf(string? name) =>
        KindOf(name) == HeroKind ? IndexOf(name) : 0;

    public static IEnumerable<string> OfKind(string kind) => AllArray.Where(n => KindOf(n) == kind);
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
