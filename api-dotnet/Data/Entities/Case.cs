using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// SQL counterpart of the Quickbase "Cases" table — the case studies on the cases page.
//
// Quickbase fields deliberately not carried over:
//   Record Owner (4)                — not needed.
//   Public Location Label (15)      — FORMULA over Country + City.
//   Public Visibility Status (28)   — FORMULA.
//   Is Public (29)                  — FORMULA.
//   Public Buyer Label (30)         — FORMULA over Buyer Name + Role.
//   Image records (31) / Add Image  — Quickbase relationship plumbing, replaced by CaseImage.
//
// The four formulas are computed in the read path, not stored. Quickbase recalculated them
// on every read; a stored copy in SQL would go stale the moment someone edited City or
// Publish through the admin panel, and would then disagree with the row it came from.
//
// Their Quickbase definitions, recovered from CasesPageService so the SQL read path can
// reproduce them exactly:
//   Is Public              = Publish OR Is Public OR Visibility in (public|published|visible|show)
//                            — in SQL this collapses to IsPublished, because the other two
//                              inputs were themselves formulas. The IMPORTER still applies the
//                              full chain, so a row that was public only via Visibility does
//                              not silently disappear on migration.
//   Public Location Label  = PublicLocation, else "City, Country"
//   Public Buyer Label     = BuyerName, else PublicBuyerLabel, else CompanyName
//   (and CompanySector, BuyerRole and the logo are suppressed entirely when there is no
//    company name — such a case is a private individual.)
public class Case
{
    public int Id { get; set; }

    // Quickbase Record ID# (3).
    public long? QuickbaseRecordId { get; set; }

    public bool IsPublished { get; set; }                              // Publish (6)
    public bool Featured { get; set; }                                 // Featured (7)
    public int SortOrder { get; set; }                                 // Sort Order (8)

    [MaxLength(300)] public string CompanyName { get; set; } = "";     // Company Name (9)
    [MaxLength(200)] public string? CompanySector { get; set; }        // Company Sector (10)

    [MaxLength(200)] public string? BuyerName { get; set; }            // Buyer Name (11)
    [MaxLength(200)] public string? BuyerRole { get; set; }            // Buyer Role (12)

    [MaxLength(120)] public string? Country { get; set; }              // Country (13)
    [MaxLength(120)] public string? City { get; set; }                 // City (14)

    // Category Key (16). Stored as given — unlike the gallery's category this is already a
    // key-ish value and the cases page groups rather than hard-filters on it, so an unknown
    // value degrades to "ungrouped" rather than making the row unreachable.
    // See CaseCategories for the known set and the one legacy value.
    [MaxLength(60)] public string? CategoryKey { get; set; }

    [MaxLength(300)] public string? ProductName { get; set; }          // Product Name (17)
    [MaxLength(300)] public string? ProductVariant { get; set; }       // Product Variant (18)

    public int? UnitsQty { get; set; }                                 // Units / Qty (19)
    public int? Year { get; set; }                                     // Year (20)
    public DateTimeOffset? DeliveredAt { get; set; }                   // Delivered At (21)

    public string? Scope { get; set; }                                 // Scope (22)
    public string? Result { get; set; }                                // Result (23)
    public string? PublicQuote { get; set; }                           // Public Quote (24)

    public double? RatingSnapshot { get; set; }                        // Rating Snapshot (25)

    // Company Logo URL (26) and Case Image URL (27) were File Attachments. They are now
    // ImageKeys like every other image, so the same upload, serving and cache path applies.
    [MaxLength(1024)] public string? CompanyLogoImageKey { get; set; }
    [MaxLength(1024)] public string? CoverImageKey { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;   // Date Created (1)
    public DateTimeOffset? UpdatedAt { get; set; }                            // Date Modified (2)

    [MaxLength(320)] public string? LastModifiedBy { get; set; }              // Last Modified By (5)

    public List<CaseImage> Images { get; set; } = new();
}
