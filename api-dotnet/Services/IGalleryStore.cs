using System;
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

    /// <summary>
    /// Old addresses of published houses that were retitled (#37), each with the public id
    /// of the house it now belongs to. Empty by default: only the SQL store keeps a history,
    /// and Quickbase never will.
    /// </summary>
    Task<IReadOnlyList<RetiredSlug>> GetRetiredSlugsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<RetiredSlug>>(Array.Empty<RetiredSlug>());
}

/// <summary>One retired address: a slug a house had in one locale, and that house's public id.</summary>
public sealed record RetiredSlug(string Locale, string Slug, long PublicId);
