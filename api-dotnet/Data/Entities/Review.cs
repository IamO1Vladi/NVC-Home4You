using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// SQL counterpart of the Quickbase reviews table. Field names mirror PublicReviewDto so
// the mapping stays obvious; lengths are set explicitly rather than left as NVARCHAR(MAX)
// so the columns can be indexed and the table stays cheap on Azure SQL.
public class Review
{
    public int Id { get; set; }

    // Quickbase record id this row was imported from. Kept for the whole dual-run period:
    // it makes the import idempotent (re-import updates rather than duplicates) and lets
    // shadow-read comparison line SQL rows up against Quickbase rows.
    public int? QuickbaseRecordId { get; set; }

    [MaxLength(200)] public string Name { get; set; } = "";
    [MaxLength(200)] public string? Company { get; set; }
    [MaxLength(320)] public string? Email { get; set; }   // 320 = max practical email length
    [MaxLength(200)] public string? Location { get; set; }
    [MaxLength(200)] public string? Product { get; set; }
    [MaxLength(4000)] public string? Comment { get; set; }

    public double Rating { get; set; }

    // "approved" / "pending" — mirrors the Quickbase status values so the moderation
    // flow (and the admin panel that will replace it) keeps the same vocabulary.
    [MaxLength(32)] public string Status { get; set; } = "pending";

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Mirrors Quickbase's "Date Modified". Phase 2's re-import uses it to pull only rows
    // that changed since the last sync instead of re-reading the whole table each night.
    public DateTimeOffset? UpdatedAt { get; set; }
}
