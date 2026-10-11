using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace Data.Entities;

// The photo slots on the home page, and the rows that fill them.
//
// The redesigned home page (2026-10) has exactly eight places an owner may want to change a
// photo without a developer: five hero slides and the three model cards in the prices strip.
// They are fixed slots rather than a list the panel can grow, for the same reason the
// brochures are six wired slugs: the page is laid out around that count, the SPA carries a
// content default for every slot, and an "add a sixth slide" button would need a design, not
// a row. So the names are an allow-list HERE, in the API, and every write path refuses a
// name outside it. Adding a slot is a code change on both sides, which is the honest size of
// that job.
public static class HomeSlotNames
{
    public const string HeroKind = "hero";
    public const string ModelKind = "model";

    // In page order: the hero slides as the carousel plays them, then the model cards as
    // the strip lists them. The 1-based position in this array is also the "owner id" the
    // upload path mints image keys under (home/{index}/{guid}.webp), so the order is part
    // of the storage layout and must not be shuffled once anything has been uploaded.
    private static readonly string[] AllArray =
    {
        "hero-1", "hero-2", "hero-3", "hero-4", "hero-5",
        "model-37", "model-58", "model-73",
    };

    public static readonly IReadOnlyList<string> All = AllArray;

    // The configurator's real model keys, which the SPA uses for its deep links (?model=37).
    // Kept beside the slot names so the public read can key its "models" object the same way.
    public static readonly IReadOnlyList<string> ModelKeys = new[] { "37", "58", "73" };

    public static bool IsValid(string? name) => name is not null && Array.IndexOf(AllArray, name) >= 0;

    /// <summary>1-based position in the allow-list; 0 for a name that is not in it.</summary>
    public static int IndexOf(string? name) =>
        name is null ? 0 : Array.IndexOf(AllArray, name) + 1;

    /// <summary>"hero" or "model"; null for a name that is not in the list.</summary>
    public static string? KindOf(string? name)
    {
        if (!IsValid(name)) return null;
        return name!.StartsWith("hero-", StringComparison.Ordinal) ? HeroKind : ModelKind;
    }

    /// <summary>The configurator model key ("37") behind a model slot; null for anything else.</summary>
    public static string? ModelKeyOf(string? name) =>
        KindOf(name) == ModelKind ? name!["model-".Length..] : null;

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
