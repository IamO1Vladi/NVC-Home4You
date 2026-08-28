using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace Data.Entities;

// The slugs the public site's content files hard-code, and therefore the rows the panel
// must never be able to break (ROADMAP #16).
//
// The panel as first designed could 404 a live marketing page in one click: retire, delete
// and slug-edit were each unguarded against a slug that four pages and twelve prerendered
// snapshots carry as literal text. IsActive = false does not remove the button on those
// pages — it turns it into a 404, and nothing notices: not a test, not the freshness guard,
// not the publish. So the six wired slugs are named HERE, in the API, and the write paths
// refuse anything that would leave one of them without a working edition.
//
// This list is also what stands in for an "add" button. A brochure may only be uploaded
// against a slug that is wired or already exists, so there is nowhere in the panel to put
// a contract or a stray scan — the same reasoning as the ImagesController key check. The
// day a seventh catalogue gets its page (a development job in any case: copy in three
// languages, a route, a layout), adding its slug here is the minutes-long part.
public static class PublicDocumentSlugs
{
    // In the order a visitor meets them: the general catalogue, then the models.
    public const string ModularBuilds = "modular-builds";
    public const string StandardContainers = "standard-containers";
    public const string VillaOffice = "villa-office";
    public const string SlopedRoof = "sloped-roof";
    public const string SpaceCapsules = "space-capsules";
    public const string BoxHouse = "box-house";

    private static readonly string[] WiredArray =
    {
        ModularBuilds, StandardContainers, VillaOffice, SlopedRoof, SpaceCapsules, BoxHouse,
    };

    public static readonly IReadOnlyList<string> Wired = WiredArray;

    public static bool IsWired(string? slug) => slug is not null && Wired.Contains(slug);

    // ASCII, lower-case, hyphen-separated, and it starts and ends with a letter or digit.
    // The slug is the public URL — /api/brochures/{slug}.pdf — so the Cyrillic file names
    // with their spaces and typographic quotes are exactly what it exists to replace, and
    // letting one in would put the old problem at a new address.
    public static bool IsValidSlug(string? slug) =>
        !string.IsNullOrWhiteSpace(slug)
        && slug.Length <= 80
        && slug == slug.Trim()
        && !slug.StartsWith('-') && !slug.EndsWith('-')
        && !slug.Contains("--")
        && slug.All(c => c is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '-');

    // The site's three languages, matching the locale keys everywhere else. A brochure is
    // a slug with up to three files behind it; bg is the fallback edition, so a Greek
    // visitor gets a real catalogue from day one and the Greek one the moment it exists.
    private static readonly string[] LangsArray = { "bg", "en", "el" };

    public static readonly IReadOnlyList<string> Langs = LangsArray;

    public static bool IsValidLang(string? lang) => lang is not null && Langs.Contains(lang);

    /// <summary>Position in the wired list, for the panel's sort; past the end when not wired.</summary>
    public static int WiredOrder(string slug)
    {
        var i = Array.IndexOf(WiredArray, slug);
        return i < 0 ? WiredArray.Length : i;
    }

    /// <summary>Position in the site's language order, so ties resolve the same way twice.</summary>
    public static int LangOrder(string lang)
    {
        var i = Array.IndexOf(LangsArray, lang);
        return i < 0 ? LangsArray.Length : i;
    }
}

// One edition of one public brochure — the Bulgarian Вила-Офис catalogue, the Greek box
// house catalogue. The bytes live in Azure Blob under a key nothing outside mints; this
// row is the metadata and the pointer. Same split as PurchaseFile, DIFFERENT container
// rules: these are marketing documents meant for anyone, served inline by an
// unauthenticated route, so they live under a brochures/ prefix in the images container
// and must never share a container with lead files (see the startup guard in Program.cs).
//
// THE SLUG IS THE ADDRESS, AND IT NEVER CHANGES. Replacing a brochure writes a NEW blob
// under a NEW GUID key and repoints this row; the public URL is untouched. Twelve
// prerendered snapshots carry these URLs as literal text, and the freshness guard only
// checks /assets/ files — a moving document URL would stale them all silently.
public class PublicDocument
{
    public int Id { get; set; }

    // Write-once. There is deliberately no endpoint that edits it.
    [Required]
    [MaxLength(80)] public string Slug { get; set; } = "";

    // Which edition this row is. Unique together with Slug.
    [Required]
    [MaxLength(10)] public string Lang { get; set; } = "bg";

    // What the panel calls it. Display only — never part of any path.
    [Required]
    [MaxLength(200)] public string Title { get; set; } = "";

    // What the customer's browser suggests when saving. A label, never a key — the same
    // reasoning as PurchaseFile.FileName.
    [Required]
    [MaxLength(400)] public string FileName { get; set; } = "";

    // Minted by PublicDocumentStore, GUID-based, under the brochures/ prefix. Changes on
    // every replacement and never otherwise — which is what makes it a correct strong
    // ETag for the public route.
    [Required]
    [MaxLength(400)] public string BlobKey { get; set; } = "";

    public long SizeBytes { get; set; }

    // Always application/pdf today; a column rather than a constant so the row describes
    // the object it points at rather than an assumption about it.
    [MaxLength(200)] public string? ContentType { get; set; }

    // The panel lists brochures in this order. No page reads it.
    public int SortOrder { get; set; }

    // False stops the public URL resolving; the bytes stay in Azure (owner, 2026-08-20:
    // "gone from the website" is enough — no hard delete, no blob cleanup). The write
    // paths refuse to retire the last active edition of a wired slug.
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    [MaxLength(320)] public string? UpdatedByUpn { get; set; }
}
