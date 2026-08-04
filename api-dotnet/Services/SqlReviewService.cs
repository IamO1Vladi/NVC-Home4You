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

// SQL-backed reviews reader. Selected when DATA_SOURCE_REVIEWS=sql; otherwise the
// Quickbase-backed ReviewService serves the same interface.
//
// The projection mirrors ReviewService's exactly — same approved filter, same ordering,
// same ISO-8601 CreatedAt, same "skip rows with neither name nor comment" rule — so
// swapping the flag cannot change what visitors see.
public class SqlReviewService : IReviewStore
{
    private readonly AppDbContext _db;
    private readonly EnvConfig _env;

    public SqlReviewService(AppDbContext db, EnvConfig env)
    {
        _db = db;
        _env = env;
    }

    // Deliberately uncached, unlike the Quickbase reader. That cache exists to avoid a slow
    // third-party round trip; a same-region indexed query doesn't need it, and skipping it
    // means an admin approving a review sees it live instead of up to 10 minutes later.
    public async Task<List<PublicReviewDto>> GetApprovedReviewsAsync(CancellationToken ct)
    {
        var approved = string.IsNullOrWhiteSpace(_env.ReviewApprovedValue)
            ? "approved"
            : _env.ReviewApprovedValue;

        var rows = await _db.Reviews
            .AsNoTracking()
            .Where(r => r.Status == approved)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        return rows
            // Same guard as the Quickbase path: a row with neither a name nor a comment
            // has nothing to display.
            .Where(r => !string.IsNullOrWhiteSpace(r.Name) || !string.IsNullOrWhiteSpace(r.Comment))
            .Select(r => new PublicReviewDto
            {
                // The Quickbase reader exposes the record id, and share/analytics data may
                // already reference it, so keep it stable rather than switching to the SQL key.
                Id = r.QuickbaseRecordId?.ToString(CultureInfo.InvariantCulture)
                     ?? r.Id.ToString(CultureInfo.InvariantCulture),
                Status = r.Status,
                Name = r.Name ?? string.Empty,
                // Quickbase returns "" for an unset text field where SQL stores NULL.
                // Emit "" so the JSON payload is byte-identical across the two sources and
                // flipping DATA_SOURCE_REVIEWS can't change what any consumer receives.
                // The column stays nullable — this is a presentation concern only.
                Company = r.Company ?? string.Empty,
                Product = r.Product ?? string.Empty,
                Location = r.Location ?? string.Empty,
                Comment = r.Comment ?? string.Empty,
                Rating = r.Rating,
                CreatedAt = r.CreatedAt.UtcDateTime.ToString("O", CultureInfo.InvariantCulture),
            })
            .ToList();
    }

    public async Task<FeaturedReviewsResponse> GetFeaturedAsync(int take, CancellationToken ct)
    {
        var approved = await GetApprovedReviewsAsync(ct);
        // Reuse the Quickbase reader's aggregation so both paths round and count identically.
        return ReviewService.BuildFeatured(approved, take);
    }

    public async Task<long> CreatePendingReviewAsync(ReviewDto dto, CancellationToken ct)
    {
        var review = new Data.Entities.Review
        {
            // Null: this row originated in SQL rather than being imported, which is exactly
            // what the import's filtered unique index allows for.
            QuickbaseRecordId = null,
            Status = string.IsNullOrWhiteSpace(_env.ReviewPendingValue) ? "pending" : _env.ReviewPendingValue,
            Name = Clip(dto.Name, 200) ?? "",
            Email = Clip(dto.Email, 320),
            Company = Clip(dto.Company, 200),
            Location = Clip(dto.Location, 200),
            Product = Clip(dto.Product, 200),
            Comment = Clip(dto.Comment, 4000),
            Rating = dto.Rating,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        _db.Reviews.Add(review);
        await _db.SaveChangesAsync(ct);
        return review.Id;
    }

    // Column lengths are generous (longest existing comment is ~180 of 4000 chars), but a
    // hand-crafted request could exceed them; truncating beats a 500 on submit.
    private static string? Clip(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        return v.Length <= max ? v : v[..max];
    }
}
