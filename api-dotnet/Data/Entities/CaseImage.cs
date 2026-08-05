using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One gallery image belonging to a case.
//
// In Quickbase these lived in the SAME table as house images — QB_TABLE_IMAGES and
// QB_TABLE_CASE_IMAGES are both `bvguw9s2h`, one attachment field (9) with two different
// parent relationship fields (6 for a house, 12 for a case). Splitting them here is the
// point: a row can only belong to one thing, so "which parent field is filled in" stops
// being how ownership is decided.
public class CaseImage
{
    public int Id { get; set; }

    public int CaseId { get; set; }
    public Case? Case { get; set; }

    // Quickbase Record ID# of the image row, so the import is idempotent per image.
    public long? QuickbaseRecordId { get; set; }

    // See HouseImage: the row stores an ImageKey rather than a URL, so who serves the bytes
    // can change without rewriting every row.
    [MaxLength(1024)] public string ImageKey { get; set; } = "";

    // Quickbase attachment path this was imported from; null for admin uploads. Carries the
    // import's idempotency, since ImageKey holds a freshly minted GUID. See HouseImage.
    [MaxLength(1024)] public string? SourceKey { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(400)] public string? AltText { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
