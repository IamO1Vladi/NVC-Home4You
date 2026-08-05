using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One image belonging to a house. Replaces the Quickbase images table, and is where the
// Blob migration and the SQL migration meet.
//
// The row stores an ImageKey, not a URL. A URL would bake in today's answer to "who serves
// this image" — Quickbase, Blob, or our own /api/img route — and every row would need
// rewriting each time that changed. The key is stable across all three, and ImageUrls turns
// it into whatever URL the current configuration calls for at response time.
public class HouseImage
{
    public int Id { get; set; }

    public int HouseId { get; set; }
    public House? House { get; set; }

    // Normalised ImageKey: "up/…" or "files/…" for images imported from Quickbase,
    // "uploads/…" for ones added through the admin panel. 1024 because Quickbase attachment
    // keys embed the original filename, which is frequently long Cyrillic.
    [MaxLength(1024)] public string ImageKey { get; set; } = "";

    // Shown as the cover when it sorts first. Explicit ordering because the admin panel needs
    // to reorder images, which the Quickbase import could only approximate by row order.
    public int SortOrder { get; set; }

    [MaxLength(400)] public string? AltText { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
