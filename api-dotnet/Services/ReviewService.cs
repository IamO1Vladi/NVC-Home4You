using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services;

public class ReviewService
{
    private readonly QuickbaseApi _qb;
    private readonly EnvConfig _env;

    public ReviewService(QuickbaseApi qb, EnvConfig env)
    {
        _qb = qb;
        _env = env;
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

        if (result.metadata?.firstRecordId is int ridFromMetadata)
        {
            return ridFromMetadata;
        }

        var ridText = result.data?.FirstOrDefault()?.Get(3);
        return long.TryParse(ridText, out var rid) ? rid : 0;
    }

    private static void TryAdd(Dictionary<int, object?> fields, int fid, string? value)
    {
        if (fid <= 0) return;
        if (string.IsNullOrWhiteSpace(value)) return;
        fields[fid] = value.Trim();
    }
}
