using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Models;

namespace Services;

public class ReviewService : IReviewReader
{
    private readonly QuickbaseApi _qb;
    private readonly EnvConfig _env;
    private readonly IMemoryCache _cache;

    private const string ApprovedCacheKey = "reviews:approved:v1";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

    public ReviewService(QuickbaseApi qb, EnvConfig env, IMemoryCache cache)
    {
        _qb = qb;
        _env = env;
        _cache = cache;
    }

    public async Task<long> CreatePendingReviewAsync(ReviewDto dto, CancellationToken ct)
    {
        if (!_qb.IsConfigured)
        {
            throw new InvalidOperationException("QUICKBASE_REALM and QUICKBASE_TOKEN must be configured before reviews can be submitted.");
        }

        if (string.IsNullOrWhiteSpace(_env.TableReviews))
        {
            throw new InvalidOperationException("QB_TABLE_REVIEWS is missing.");
        }

        var fields = new Dictionary<int, object?>
        {
            [_env.F_REVIEW_STATUS] = _env.ReviewPendingValue,
            [_env.F_REVIEW_NAME] = dto.Name.Trim(),
            [_env.F_REVIEW_EMAIL] = dto.Email.Trim(),
            [_env.F_REVIEW_RATING] = dto.Rating,
            [_env.F_REVIEW_COMMENT] = dto.Comment.Trim(),
        };

        TryAdd(fields, _env.F_REVIEW_COMPANY, dto.Company);
        TryAdd(fields, _env.F_REVIEW_LOCATION, dto.Location);
        TryAdd(fields, _env.F_REVIEW_PRODUCT, dto.Product);

        var result = await _qb.CreateAsync(_env.TableReviews, fields, ct);

        // A freshly submitted review is pending, so any cached approved list is still valid;
        // we deliberately do not invalidate it here.

        if (result.metadata?.firstRecordId is int ridFromMetadata)
        {
            return ridFromMetadata;
        }

        var ridText = result.data?.FirstOrDefault()?.Get(3);
        return long.TryParse(ridText, out var rid) ? rid : 0;
    }

    /// <summary>
    /// Returns every approved review, newest first. Cached for a short window so the cases
    /// page and the homepage testimonials strip share a single Quickbase round-trip.
    /// </summary>
    public async Task<List<PublicReviewDto>> GetApprovedReviewsAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(ApprovedCacheKey, out List<PublicReviewDto>? cached) && cached is not null)
            return cached;

        var reviews = await LoadApprovedReviewsAsync(ct);

        _cache.Set(ApprovedCacheKey, reviews, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = CacheTtl
        });

        return reviews;
    }

    /// <summary>
    /// The top <paramref name="take"/> approved reviews plus an aggregate (average rating and
    /// total approved count) computed across the full approved set — used for social proof
    /// near the homepage CTAs.
    /// </summary>
    public async Task<FeaturedReviewsResponse> GetFeaturedAsync(int take, CancellationToken ct)
    {
        var approved = await GetApprovedReviewsAsync(ct);
        return BuildFeatured(approved, take);
    }

    /// <summary>
    /// Pure projection of the approved set into the homepage feed: the aggregate average
    /// (rounded to one decimal, ignoring unrated entries), the total approved count, and the
    /// top <paramref name="take"/> items. Kept side-effect free so it can be unit tested
    /// without Quickbase.
    /// </summary>
    public static FeaturedReviewsResponse BuildFeatured(IReadOnlyList<PublicReviewDto> approved, int take)
    {
        if (approved is null) approved = Array.Empty<PublicReviewDto>();
        if (take <= 0) take = 3;

        var rated = approved
            .Where(r => r.Rating > 0)
            .Select(r => r.Rating)
            .ToList();

        return new FeaturedReviewsResponse
        {
            TotalCount = approved.Count,
            AverageRating = rated.Count > 0 ? Math.Round(rated.Average(), 1) : 0,
            Items = approved.Take(take).ToList()
        };
    }

    private async Task<List<PublicReviewDto>> LoadApprovedReviewsAsync(CancellationToken ct)
    {
        if (!_qb.IsConfigured || string.IsNullOrWhiteSpace(_env.TableReviews))
            return new List<PublicReviewDto>();

        var fields = new HashSet<int>
        {
            _env.F_REVIEW_RID,
            _env.F_REVIEW_NAME,
            _env.F_REVIEW_COMPANY,
            _env.F_REVIEW_PRODUCT,
            _env.F_REVIEW_LOCATION,
            _env.F_REVIEW_RATING,
            _env.F_REVIEW_COMMENT,
            _env.F_REVIEW_STATUS,
        };

        if (_env.F_REVIEW_CREATED.HasValue)
            fields.Add(_env.F_REVIEW_CREATED.Value);

        var sortField = _env.F_REVIEW_CREATED ?? _env.F_REVIEW_RID;
        var rows = await _qb.QueryAsync(_env.TableReviews, fields, "", sortField, "DESC", ct);

        var list = new List<PublicReviewDto>();
        var approved = string.IsNullOrWhiteSpace(_env.ReviewApprovedValue)
            ? "approved"
            : _env.ReviewApprovedValue;

        foreach (var row in rows.data ?? new List<QbRec>())
        {
            var status = (Get(row, _env.F_REVIEW_STATUS) ?? string.Empty).Trim();
            if (!status.Equals(approved, StringComparison.OrdinalIgnoreCase))
                continue;

            var item = new PublicReviewDto
            {
                Id = Get(row, _env.F_REVIEW_RID) ?? Guid.NewGuid().ToString("N"),
                Status = status,
                Name = Get(row, _env.F_REVIEW_NAME) ?? string.Empty,
                Company = Get(row, _env.F_REVIEW_COMPANY),
                Product = Get(row, _env.F_REVIEW_PRODUCT),
                Location = Get(row, _env.F_REVIEW_LOCATION),
                Comment = Get(row, _env.F_REVIEW_COMMENT),
                Rating = ToDouble(Get(row, _env.F_REVIEW_RATING)),
                CreatedAt = NormalizeDate(Get(row, _env.F_REVIEW_CREATED))
            };

            if (string.IsNullOrWhiteSpace(item.Name) && string.IsNullOrWhiteSpace(item.Comment))
                continue;

            list.Add(item);
        }

        return list;
    }

    private static void TryAdd(Dictionary<int, object?> fields, int fid, string? value)
    {
        if (fid <= 0) return;
        if (string.IsNullOrWhiteSpace(value)) return;
        fields[fid] = value.Trim();
    }

    private static string? Get(QbRec row, int? fid)
    {
        if (!fid.HasValue || fid.Value <= 0)
            return null;

        return row.Get(fid.Value);
    }

    private static double ToDouble(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return 0;

        if (double.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var num))
            return num;

        if (double.TryParse(value, NumberStyles.Any, CultureInfo.CurrentCulture, out num))
            return num;

        return 0;
    }

    private static string? NormalizeDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        if (long.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var epoch) &&
            epoch > 100000000000)
        {
            try
            {
                return DateTimeOffset
                    .FromUnixTimeMilliseconds(epoch)
                    .UtcDateTime
                    .ToString("O", CultureInfo.InvariantCulture);
            }
            catch
            {
            }
        }

        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
        {
            return dto.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
        }

        return value;
    }
}
