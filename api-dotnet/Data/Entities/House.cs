using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// SQL counterpart of the Quickbase houses table — the catalogue behind /api/gallery and the
// configurator's model list. Field names mirror GalleryItem so the mapping stays obvious.
//
// "Gallery" and "houses" are the same rows: GalleryService reads QB_TABLE_HOUSES and joins
// QB_TABLE_IMAGES. Keeping the entity named after the table rather than the endpoint avoids
// implying there is a separate gallery table somewhere.
public class House
{
    public int Id { get; set; }

    // Quickbase record id this row was imported from. Makes the import idempotent and lets
    // shadow comparison line the two systems up. Null for rows created in the admin panel.
    public long? QuickbaseRecordId { get; set; }

    [MaxLength(300)] public string Title { get; set; } = "";
    [MaxLength(300)] public string? TitleBg { get; set; }
    [MaxLength(300)] public string? TitleEl { get; set; }

    // Descriptions hold HTML built in Quickbase's rich-text editor and run long, so these
    // are the one place NVARCHAR(MAX) is warranted — they are never indexed or filtered on.
    public string Description { get; set; } = "";
    public string? DescriptionBg { get; set; }
    public string? DescriptionEl { get; set; }

    // decimal(18,2) rather than double: this is money and it is shown to customers.
    public decimal? Price { get; set; }
    [MaxLength(8)] public string Currency { get; set; } = "EUR";

    [MaxLength(120)] public string? Category { get; set; }

    // The id the frontend catalogue keys off. Distinct from the Quickbase record id, and the
    // only one of the two that may reach analytics (see App.jsx).
    [MaxLength(120)] public string? CatalogId { get; set; }

    // Controls gallery ordering and whether the row is served at all, so the admin panel can
    // stage a house before publishing it. Quickbase had no such flag; imported rows are
    // published, preserving today's behaviour exactly.
    public bool IsPublished { get; set; } = true;
    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    public List<HouseImage> Images { get; set; } = new();
}
