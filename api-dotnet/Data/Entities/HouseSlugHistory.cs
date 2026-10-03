using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// An address a house used to have, in one locale (ROADMAP #37).
//
// A gallery URL is the product's title, slugified per locale, so retitling a house in
// Галерия moves its address. The old one is in Google's index, in emails and in shares, and
// without this it shows visitors "Model not found" and answers crawlers 404. Until #37 a
// developer kept those addresses alive by hand, in GallerySlugs.RetiredSlugs, and published.
// Now GalleryAdminService writes a row here in the same save that changes the title, and
// GallerySeoService 301s the old address to wherever the house lives NOW.
//
// KEYED BY HOUSE, NOT BY TARGET SLUG. A redirect therefore always lands on the house's
// current address: renaming twice cannot leave a chain, and a house that is unpublished or
// deleted stops matching, so its old addresses answer 404 rather than pointing somewhere
// wrong. Deleting the house cascades its rows away.
//
// ONE ROW PER (Locale, Slug). If another house later gives up the same slug, that row moves
// to it: the address goes to whoever held it last.
//
// Not audited — see AuditedEntities. It is derived from the House edit that wrote it, and
// that edit is audited with its old and new titles.
public class HouseSlugHistory
{
    public int Id { get; set; }

    public int HouseId { get; set; }
    public House? House { get; set; }

    /// <summary>"en", "bg" or "el" — a key of GallerySlugs.Locales.</summary>
    [MaxLength(8)] public string Locale { get; set; } = "";

    /// <summary>
    /// The retired slug, in the current algorithm's form (GallerySlugs.Slugify), decoded.
    /// Its pre-2026-08-17 form is matched too, by re-running LegacySlugify over it.
    /// </summary>
    [MaxLength(MaxSlugLength)] public string Slug { get; set; } = "";

    public DateTimeOffset RetiredAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Who retitled the house, as an Entra UPN. Null when the system did it (the seeder).</summary>
    [MaxLength(320)] public string? RetiredByUpn { get; set; }

    // 450 characters is 900 bytes, inside SQL Server's index key limit with the locale beside
    // it. A title is at most 300 characters and NFKC folding barely lengthens one, so a slug
    // that does not fit is not a real title; the writer skips it rather than failing the save.
    public const int MaxSlugLength = 450;
}
