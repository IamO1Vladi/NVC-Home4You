using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Models;

namespace Services;

// The SQL gallery read path, served when DATA_SOURCE_GALLERY=sql.
//
// Produces the same GalleryItem shape as the Quickbase path so the cutover is invisible to
// the frontend — same fields, same ordering, same image URL forms. The one deliberate
// difference is that unpublished houses are excluded, which Quickbase had no way to express.
public sealed class SqlGalleryService : IGalleryStore
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly ImageUrls _imageUrls;
    private readonly ILogger<SqlGalleryService> _log;

    // Matches the Quickbase path's TTL. Cheaper here — this is one indexed query rather than
    // fifteen HTTP round trips — but the cases page caches its payload for the same window,
    // and having the two agree keeps "why is this stale" a single answer.
    //
    // v2 since #37: the entry holds the rows AND the retired addresses, so a redirect and the
    // page it lands on always come from the same snapshot. GalleryAdminService evicts it by
    // this name after every edit.
    public const string CacheKey = "gallery:sql:v2";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

    public SqlGalleryService(
        AppDbContext db, IMemoryCache cache, ImageUrls imageUrls, ILogger<SqlGalleryService>? log = null)
    {
        _db = db;
        _cache = cache;
        _imageUrls = imageUrls;
        _log = log ?? NullLogger<SqlGalleryService>.Instance;
    }

    public async Task<IReadOnlyList<GalleryItem>> GetAsync(CancellationToken ct = default)
    {
        // Rows are cached, URLs are not: what gets cached is independent of IMAGES_VIA_APP,
        // so flipping that flag takes effect on the next request rather than trailing the TTL.
        // Same reasoning as the Quickbase path.
        var snapshot = await SnapshotAsync(ct);
        return snapshot.Rows.Select(ToItem).ToList();
    }

    public async Task<IReadOnlyList<RetiredSlug>> GetRetiredSlugsAsync(CancellationToken ct = default) =>
        (await SnapshotAsync(ct)).Retired;

    private async Task<Snapshot> SnapshotAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out Snapshot? snapshot) && snapshot is not null)
            return snapshot;

        var rows = await LoadAsync(ct);
        var (retired, historyRead) = await LoadRetiredAsync(ct);
        snapshot = new Snapshot(rows, retired);

        // A snapshot whose history could not be read is kept for a minute, not ten: long
        // enough to spare the database a query per request, short enough that a migration
        // applied after the publish, or a passing failure, heals by itself.
        _cache.Set(CacheKey, snapshot, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = historyRead ? CacheTtl : DegradedTtl,
        });
        return snapshot;
    }

    private static readonly TimeSpan DegradedTtl = TimeSpan.FromMinutes(1);

    /// <summary>
    /// The old addresses of PUBLISHED houses only. An unpublished house's page is a 404, so
    /// its old addresses must not 301 to it.
    ///
    /// A failure here never takes the gallery down. The table arrives by migration, applied
    /// BEFORE the publish (DEPLOY §5b), but if the order is ever reversed, every product page,
    /// the sitemap and /api/gallery would fail with "Invalid object name" while the history
    /// cannot even be written. Old addresses 404 in that window, as they did before #37, and
    /// the log says why.
    /// </summary>
    private async Task<(IReadOnlyList<RetiredSlug> Retired, bool Read)> LoadRetiredAsync(CancellationToken ct)
    {
        try
        {
            var rows = await _db.HouseSlugHistory
                .AsNoTracking()
                .Where(x => x.House!.IsPublished)
                .Select(x => new { x.Locale, x.Slug, x.HouseId, x.House!.QuickbaseRecordId })
                .ToListAsync(ct);

            return (rows
                .Select(r => new RetiredSlug(r.Locale, r.Slug, HousePublicIds.For(r.QuickbaseRecordId, r.HouseId)))
                .ToList(), true);
        }
        // Keyed on the token, not the exception type: SqlClient reports a request the client
        // abandoned mid-query as a SqlException, and that must not be logged as a fault or
        // cached as "no history" for everyone else.
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _log.LogError(ex,
                "Gallery: could not read HouseSlugHistory, so renamed products' old addresses will 404 " +
                "until it can. Is the AddHouseSlugHistory migration applied?");
            return (Array.Empty<RetiredSlug>(), false);
        }
    }

    private sealed record Snapshot(List<Row> Rows, IReadOnlyList<RetiredSlug> Retired);

    private async Task<List<Row>> LoadAsync(CancellationToken ct) =>
        await _db.Houses
            .AsNoTracking()
            .Where(h => h.IsPublished)
            .OrderBy(h => h.SortOrder).ThenBy(h => h.Id)
            .Select(h => new Row(
                h.Id,
                h.QuickbaseRecordId,
                h.Title,
                h.TitleBg,
                h.TitleEl,
                h.Description,
                h.DescriptionBg,
                h.DescriptionEl,
                h.Price,
                h.Currency,
                h.CategoryKey,
                h.CatalogId,
                h.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.ImageKey).ToList()))
            .ToListAsync(ct);

    private GalleryItem ToItem(Row r)
    {
        var urls = r.ImageKeys
            .Select(_imageUrls.ForKey)
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u!)
            .ToList();

        return new GalleryItem
        {
            // Imported houses keep their Quickbase record id, which stored enquiries and the
            // prices page's assembly table already hold; admin-created houses are offset
            // clear of that range. Their bare SQL id used to be served here and collided on
            // live — see HousePublicIds.
            Id = HousePublicIds.For(r.QuickbaseRecordId, r.Id),
            Title = r.Title,
            TitleBg = r.TitleBg,
            TitleEl = r.TitleEl,
            Description = r.Description,
            DescriptionBg = r.DescriptionBg,
            DescriptionEl = r.DescriptionEl,
            Price = r.Price,
            Currency = r.Currency,
            Category = r.CategoryKey,
            CatalogId = r.CatalogId,
            Images = urls,
            CoverUrl = urls.FirstOrDefault(),
        };
    }

    // Projected in the query so EF fetches only these columns, and so what sits in the cache
    // is a plain immutable record rather than tracked entities.
    private sealed record Row(
        int Id,
        long? QuickbaseRecordId,
        string Title,
        string? TitleBg,
        string? TitleEl,
        string Description,
        string? DescriptionBg,
        string? DescriptionEl,
        decimal? Price,
        string Currency,
        string CategoryKey,
        string? CatalogId,
        List<string> ImageKeys);
}
