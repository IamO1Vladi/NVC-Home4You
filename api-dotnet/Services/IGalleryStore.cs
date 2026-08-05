using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services;

// The gallery read path, implemented over Quickbase (GalleryService) and SQL
// (SqlGalleryService) and chosen per request by DATA_SOURCE_GALLERY.
//
// Read-only, unlike IReviewStore. The gallery has no public write path — visitors never
// create a house — so there is no risk of reading one store and writing to another. Writes
// arrive through the authenticated admin endpoints, which target SQL directly because that
// is the only store they can write to.
public interface IGalleryStore
{
    Task<IReadOnlyList<GalleryItem>> GetAsync(CancellationToken ct = default);
}
