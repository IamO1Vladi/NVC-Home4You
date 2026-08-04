using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services;

// Reviews storage, implemented over Quickbase (ReviewService) and SQL (SqlReviewService)
// and selected per request by DATA_SOURCE_REVIEWS.
//
// Reads and writes are one interface on purpose. Splitting them would allow reading from
// SQL while writing to Quickbase, and a newly submitted review would then be invisible
// until the next import — the store a visitor writes to must be the store the site reads.
public interface IReviewStore
{
    Task<List<PublicReviewDto>> GetApprovedReviewsAsync(CancellationToken ct);

    Task<FeaturedReviewsResponse> GetFeaturedAsync(int take, CancellationToken ct);

    // Creates a review in the pending state, awaiting moderation. Returns its id.
    Task<long> CreatePendingReviewAsync(ReviewDto dto, CancellationToken ct);
}
