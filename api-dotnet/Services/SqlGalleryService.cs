using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
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

    // Matches the Quickbase path's TTL. Cheaper here — this is one indexed query rather than
    // fifteen HTTP round trips — but the cases page caches its payload for the same window,
    // and having the two agree keeps "why is this stale" a single answer.
    private const string CacheKey = "gallery:sql:v1";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

    public SqlGalleryService(AppDbContext db, IMemoryCache cache, ImageUrls imageUrls)
    {
        _db = db;
        _cache = cache;
        _imageUrls = imageUrls;
    }

    public async Task<IReadOnlyList<GalleryItem>> GetAsync(CancellationToken ct = default)
    {
        // Rows are cached, URLs are not: what gets cached is independent of IMAGES_VIA_APP,
        // so flipping that flag takes effect on the next request rather than trailing the TTL.
        // Same reasoning as the Quickbase path.
        if (!_cache.TryGetValue(CacheKey, out List<Row>? rows) || rows is null)
        {
            rows = await LoadAsync(ct);
            _cache.Set(CacheKey, rows, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = CacheTtl,
            });
        }

        return rows.Select(ToItem).ToList();
    }

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
            // The frontend keys models by this id and it appears in shared configurator links,
            // so it stays the Quickbase record id for rows that have one. Changing it would
            // break links already sitting in customers' inboxes. Houses created in the admin
            // panel have no Quickbase id and fall back to their SQL id — safe, because the two
            // id spaces only ever coexist during the migration and SQL ids start above nothing
            // Quickbase issued.
            Id = r.QuickbaseRecordId ?? r.Id,
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
