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

    // The featured feed is the same projection of the approved list whichever store holds
    // it, so it is written once here rather than in each store, where the two copies could
    // drift. A null or empty product is the home page's feed over every approved review.
    async Task<FeaturedReviewsResponse> GetFeaturedAsync(int take, string? product, CancellationToken ct)
        => ReviewService.BuildFeatured(await GetApprovedReviewsAsync(ct), take, product);

    // Creates a review in the pending state, awaiting moderation. Returns its id.
    Task<long> CreatePendingReviewAsync(ReviewDto dto, CancellationToken ct);
}
