using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>
/// The rows behind the public brochures (ROADMAP #16): what the panel lists, what the
/// public route resolves, and the write rules that keep the panel from 404ing a live
/// marketing page. Blob bytes are the controller's business, through PublicDocumentStore —
/// this class never touches storage, which is what keeps every rule here testable against
/// an in-memory database.
/// </summary>
public class PublicDocumentService
{
    private readonly AppDbContext _db;

    public PublicDocumentService(AppDbContext db) => _db = db;

    public enum Outcome { Ok, NotFound, Refused }

    public record Result(Outcome Outcome, PublicDocument? Row, string? Error)
    {
        public bool Ok => Outcome == Outcome.Ok;

        public static Result Success(PublicDocument row) => new(Outcome.Ok, row, null);
        public static Result NotFound() => new(Outcome.NotFound, null, "No such document.");
        public static Result Refuse(string error) => new(Outcome.Refused, null, error);
    }

    /// <summary>
    /// Everything, active or not — the panel's list. Grouping into six rows of three
    /// language slots is the page's job; the API hands over flat facts.
    /// </summary>
    public async Task<List<PublicDocumentAdminDto>> ListAsync(CancellationToken ct)
    {
        var rows = await _db.PublicDocuments.AsNoTracking()
            .OrderBy(d => d.SortOrder).ThenBy(d => d.Slug).ThenBy(d => d.Lang)
            .ToListAsync(ct);

        return rows.Select(d => new PublicDocumentAdminDto
        {
            Id = d.Id,
            Slug = d.Slug,
            Lang = d.Lang,
            Title = d.Title,
            FileName = d.FileName,
            SizeBytes = d.SizeBytes,
            IsActive = d.IsActive,
            Wired = PublicDocumentSlugs.IsWired(d.Slug),
            SortOrder = d.SortOrder,
            CreatedAt = d.CreatedAt.ToString("o"),
            UpdatedAt = d.UpdatedAt?.ToString("o"),
            UpdatedByUpn = d.UpdatedByUpn,
        }).ToList();
    }

    /// <summary>
    /// The edition the public route serves: the requested language if it exists, the
    /// Bulgarian one if not, and failing that whatever edition does — so a Greek visitor
    /// gets a real catalogue from day one, in Bulgarian, and starts getting the Greek
    /// edition the moment it is uploaded, with no code change and no page edit.
    /// </summary>
    public async Task<PublicDocument?> ResolveAsync(string slug, string? lang, CancellationToken ct)
    {
        if (!PublicDocumentSlugs.IsValidSlug(slug)) return null;

        var editions = await _db.PublicDocuments.AsNoTracking()
            .Where(d => d.Slug == slug && d.IsActive)
            .ToListAsync(ct);
        if (editions.Count == 0) return null;

        // "Whatever exists" is still deterministic: the site's own language order, so two
        // requests never disagree about which file an address serves.
        return editions.FirstOrDefault(d => d.Lang == lang)
            ?? editions.FirstOrDefault(d => d.Lang == "bg")
            ?? editions.OrderBy(d => PublicDocumentSlugs.LangOrder(d.Lang)).First();
    }

    /// <summary>
    /// The row behind an upload — created if this edition never existed, repointed if it
    /// did. The caller uploads the blob FIRST and hands over the new key; a failure here
    /// costs an orphaned blob, never a row pointing at bytes that failed to arrive.
    /// </summary>
    /// <remarks>
    /// A new SLUG is only accepted from the wired list. That rule is the panel's missing
    /// "add" button, enforced where it cannot be worked around: there is nowhere to put a
    /// document the public site does not reference, so there is nowhere to put a contract.
    /// A new EDITION of an existing slug is the normal case this exists for — the owner
    /// uploading the Greek translation into an empty slot.
    /// </remarks>
    public async Task<Result> RecordUploadAsync(
        string slug, string lang, string blobKey, string fileName, long sizeBytes,
        string? actorUpn, CancellationToken ct)
    {
        if (!PublicDocumentSlugs.IsValidSlug(slug))
            return Result.Refuse("That is not a valid document address.");
        if (!PublicDocumentSlugs.IsValidLang(lang))
            return Result.Refuse("That is not a language this site speaks.");

        var now = DateTimeOffset.UtcNow;
        var row = await _db.PublicDocuments
            .FirstOrDefaultAsync(d => d.Slug == slug && d.Lang == lang, ct);

        if (row is null)
        {
            var slugExists = await _db.PublicDocuments.AnyAsync(d => d.Slug == slug, ct);
            if (!slugExists && !PublicDocumentSlugs.IsWired(slug))
                return Result.Refuse("No page on the site references that document.");

            row = new PublicDocument
            {
                Slug = slug,
                Lang = lang,
                // The importer names the six properly; a row born from an upload starts
                // with the slug as its label until somebody gives it a better one.
                Title = slug,
                // Wired slugs keep the order of the wired list, so the panel reads the way
                // the site does; anything else sorts after them.
                SortOrder = PublicDocumentSlugs.WiredOrder(slug),
                CreatedAt = now,
            };
            _db.PublicDocuments.Add(row);
        }

        row.BlobKey = blobKey;
        row.FileName = fileName;
        row.SizeBytes = sizeBytes;
        row.ContentType = "application/pdf";
        // An upload into a retired slot revives it: nobody replaces a catalogue they mean
        // to keep hidden, and making them find a second switch would teach the panel's one
        // button to half-work.
        row.IsActive = true;
        row.UpdatedAt = now;
        row.UpdatedByUpn = actorUpn;

        await _db.SaveChangesAsync(ct);
        return Result.Success(row);
    }

    /// <summary>
    /// Retire or revive one edition. Refused when it would leave a wired slug with no
    /// active edition — that is the exact click that turns a live marketing page's button
    /// into a 404 that no test, no freshness guard and no publish would notice. Retiring a
    /// translation while another edition stands is fine: the public route falls back.
    /// </summary>
    public async Task<Result> SetActiveAsync(string slug, string lang, bool active, string? actorUpn, CancellationToken ct)
    {
        var row = await _db.PublicDocuments
            .FirstOrDefaultAsync(d => d.Slug == slug && d.Lang == lang, ct);
        if (row is null) return Result.NotFound();

        if (!active && PublicDocumentSlugs.IsWired(slug))
        {
            var otherActive = await _db.PublicDocuments
                .AnyAsync(d => d.Slug == slug && d.Lang != lang && d.IsActive, ct);
            if (!otherActive)
                return Result.Refuse(
                    "The site links this document, and this is its last working edition. " +
                    "Replace it instead of removing it.");
        }

        row.IsActive = active;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        row.UpdatedByUpn = actorUpn;

        await _db.SaveChangesAsync(ct);
        return Result.Success(row);
    }

    /// <summary>
    /// Deletes the ROW. Never offered for a wired slug at all — retiring is the reversible
    /// act and even that is guarded; this exists only so a mistaken future non-wired
    /// document can be taken back out. The bytes stay in Azure either way (owner,
    /// 2026-08-20: no hard delete, no blob cleanup).
    /// </summary>
    public async Task<Result> DeleteAsync(string slug, string lang, CancellationToken ct)
    {
        if (PublicDocumentSlugs.IsWired(slug))
            return Result.Refuse("The site links this document; it cannot be deleted.");

        var row = await _db.PublicDocuments
            .FirstOrDefaultAsync(d => d.Slug == slug && d.Lang == lang, ct);
        if (row is null) return Result.NotFound();

        _db.PublicDocuments.Remove(row);
        await _db.SaveChangesAsync(ct);
        return Result.Success(row);
    }
}

// Admin-only projection. SizeBytes ships so the panel can say "16.5 MB" next to the slot —
// the number that reminds someone the compression step exists before they wait out an
// upload that was always going to be refused.
public class PublicDocumentAdminDto
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Lang { get; set; } = "";
    public string Title { get; set; } = "";
    public string FileName { get; set; } = "";
    public long SizeBytes { get; set; }
    public bool IsActive { get; set; }
    public bool Wired { get; set; }
    public int SortOrder { get; set; }
    public string CreatedAt { get; set; } = "";
    public string? UpdatedAt { get; set; }
    public string? UpdatedByUpn { get; set; }
}
