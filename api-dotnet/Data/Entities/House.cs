using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// SQL counterpart of the Quickbase "Houses/Wagons" table — the catalogue behind /api/gallery
// and the configurator's model list.
//
// "Gallery" and "houses" are the same rows: GalleryService reads QB_TABLE_HOUSES and joins
// the images table. Naming the entity after the table rather than the endpoint avoids
// implying there is a separate gallery table somewhere.
//
// Quickbase fields deliberately not carried over:
//   Record Owner (4)             — not needed.
//   Image records (8) /
//   Add Image (9)                — Quickbase relationship plumbing, replaced by HouseImage.
//   Offers/Quote records (11),
//   Add Offers/Quote (12),
//   Number of Offers (15)        — leads, which stay on Quickbase for now. When leads migrate
//                                  they become a relationship from the offers table to here,
//                                  not columns on this one.
public class House
{
    public int Id { get; set; }

    // Quickbase Record ID# (3). Makes the import idempotent and lets shadow comparison line
    // the two systems up. Null for rows created in the admin panel, and for every row once
    // Quickbase is gone.
    public long? QuickbaseRecordId { get; set; }

    [MaxLength(300)] public string Title { get; set; } = "";          // Title (6)
    [MaxLength(300)] public string? TitleBg { get; set; }             // Title-Bg (13)
    [MaxLength(300)] public string? TitleEl { get; set; }             // Title Greek (25)

    // Rich Text in Quickbase — HTML, frequently long, never indexed or filtered on, so this
    // is the one place NVARCHAR(MAX) is warranted.
    public string Description { get; set; } = "";                      // Description (7)
    public string? DescriptionBg { get; set; }                         // Descripcion-Bg (14)
    public string? DescriptionEl { get; set; }                         // Description Greek (26)

    // Currency (10). decimal(18,2) rather than double: this is money shown to customers.
    public decimal? Price { get; set; }
    [MaxLength(8)] public string Currency { get; set; } = "EUR";

    // Category (16). Stored as a STABLE KEY — "prefab" / "wagon" / "modular" / "garage" —
    // not as the Bulgarian display label Quickbase held.
    //
    // The gallery filter resolves a house's category by matching the raw string against the
    // BG label, then the EN label (galleryUtils.js). That makes a typo in a translated label
    // silently drop a house out of every filter, with nothing to catch it. The frontend
    // already prefers a stable id when it sees one (`byId.has(n)` before the label lookups),
    // so storing the key works today with no frontend change, and the labels become
    // presentation only. See HouseCategories for the allowed values.
    [MaxLength(40)] public string? CategoryKey { get; set; }

    // Facebook catalogue id (27). Distinct from the Quickbase record id, and the only one of
    // the two that may reach analytics (see App.jsx).
    [MaxLength(120)] public string? CatalogId { get; set; }

    // No Quickbase counterpart — the Houses/Wagons table has neither. Imported rows are
    // published and keep their existing order, so behaviour is unchanged; both exist so the
    // admin panel can stage a house before it is public and control gallery ordering.
    public bool IsPublished { get; set; } = true;
    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;   // Date Created (1)
    public DateTimeOffset? UpdatedAt { get; set; }                            // Date Modified (2)

    // Last Modified By (5). Free text rather than a foreign key: Quickbase stores a Quickbase
    // user, the admin panel will store an Entra UPN, and there is no user table to point at.
    [MaxLength(320)] public string? LastModifiedBy { get; set; }

    public List<HouseImage> Images { get; set; } = new();
}
