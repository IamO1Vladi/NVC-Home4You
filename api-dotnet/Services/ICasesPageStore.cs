using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services;

// The cases page read path, implemented over Quickbase (CasesPageService) and SQL
// (SqlCasesPageService) and chosen per request by DATA_SOURCE_CASES.
//
// Read-only: the cases page has no public write path. Reviews embedded in the payload come
// from IReviewStore either way, so DATA_SOURCE_CASES and DATA_SOURCE_REVIEWS move
// independently — the cases page can serve from SQL while reviews still come from Quickbase,
// or the reverse.
public interface ICasesPageStore
{
    Task<CasesPageResponse> GetAsync(CancellationToken ct);
}
