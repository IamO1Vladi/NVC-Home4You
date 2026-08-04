using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Services;

// Admin-side review moderation: the approve/reject queue that currently lives in
// Quickbase's own UI. SQL-only by design — this exists precisely so Quickbase can stop
// being the staff interface, so there is no Quickbase implementation to fall back to.
public class ReviewModerationService
{
    private readonly AppDbContext _db;
    private readonly EnvConfig _env;

    public ReviewModerationService(AppDbContext db, EnvConfig env)
    {
        _db = db;
        _env = env;
    }

    private string ApprovedValue =>
        string.IsNullOrWhiteSpace(_env.ReviewApprovedValue) ? "approved" : _env.ReviewApprovedValue;

    private string PendingValue =>
        string.IsNullOrWhiteSpace(_env.ReviewPendingValue) ? "pending" : _env.ReviewPendingValue;

    public const string RejectedValue = "rejected";

    // Admin listing, so unlike the public feed it exposes every status and the submitter's
    // email — moderators need to see who wrote a review before publishing it.
    public async Task<List<AdminReviewDto>> ListAsync(string? status, CancellationToken ct)
    {
        var query = _db.Reviews.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
            query = query.Where(r => r.Status == status);

        var rows = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(500)
            .ToListAsync(ct);

        return rows.Select(r => new AdminReviewDto
        {
            Id = r.Id,
            QuickbaseRecordId = r.QuickbaseRecordId,
            Status = r.Status,
            Name = r.Name ?? "",
            Company = r.Company ?? "",
            Email = r.Email ?? "",
            Location = r.Location ?? "",
            Product = r.Product ?? "",
            Comment = r.Comment ?? "",
            Rating = r.Rating,
            CreatedAt = r.CreatedAt.UtcDateTime.ToString("O", CultureInfo.InvariantCulture),
            UpdatedAt = r.UpdatedAt?.UtcDateTime.ToString("O", CultureInfo.InvariantCulture),
        }).ToList();
    }

    public async Task<Dictionary<string, int>> CountsByStatusAsync(CancellationToken ct) =>
        await _db.Reviews.AsNoTracking()
            .GroupBy(r => r.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public Task<bool> ApproveAsync(int id, CancellationToken ct) => SetStatusAsync(id, ApprovedValue, ct);

    public Task<bool> RejectAsync(int id, CancellationToken ct) => SetStatusAsync(id, RejectedValue, ct);

    // Returning a review to the queue after a mistaken decision.
    public Task<bool> ResetToPendingAsync(int id, CancellationToken ct) => SetStatusAsync(id, PendingValue, ct);

    // False means "no such review", which the controller turns into a 404 rather than
    // silently reporting success for an id that never existed.
    private async Task<bool> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (review is null) return false;

        review.Status = status;
        // Mirrors Quickbase's "Date Modified" so the import's change detection and the
        // admin list agree on when a row last changed.
        review.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
