using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services;

// The read side of reviews, so the site can be served from either Quickbase or SQL and
// switched per environment via DATA_SOURCE_REVIEWS.
//
// Writes are deliberately NOT part of this interface. Submitting a review still goes to
// Quickbase (ReviewService.CreatePendingReviewAsync) because moderation lives there —
// moving writes before the admin panel exists would strand the approve/reject workflow
// with no interface to perform it in.
public interface IReviewReader
{
    Task<List<PublicReviewDto>> GetApprovedReviewsAsync(CancellationToken ct);

    Task<FeaturedReviewsResponse> GetFeaturedAsync(int take, CancellationToken ct);
}
