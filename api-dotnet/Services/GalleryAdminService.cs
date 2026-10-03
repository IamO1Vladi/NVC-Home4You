using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Models;

namespace Services;

/// <summary>What the admin panel sends when creating or updating a house.</summary>
public sealed class HouseInput
{
    public string Title { get; set; } = "";
    public string? TitleBg { get; set; }
    public string? TitleEl { get; set; }
    public string? Description { get; set; }
    public string? DescriptionBg { get; set; }
    public string? DescriptionEl { get; set; }
    public decimal? Price { get; set; }
    public string? Currency { get; set; }
    public string CategoryKey { get; set; } = "";
    public string? CatalogId { get; set; }
    public bool IsPublished { get; set; } = true;
    public int? SortOrder { get; set; }
}

/// <summary>A house as the admin panel sees it — including unpublished ones and image keys.</summary>
public sealed record AdminHouseDto(
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
    bool IsPublished,
    int SortOrder,
    DateTimeOffset? UpdatedAt,
    string? LastModifiedBy,
    List<AdminImageDto> Images);

public sealed record AdminImageDto(int Id, string ImageKey, string Url, int SortOrder, string? AltText);

/// <summary>An old address that 301s to a house (#37): its locale, its decoded path, when and by whom.</summary>
public sealed record RetiredAddressDto(string Locale, string Path, DateTimeOffset RetiredAt, string? RetiredByUpn);

// Create/update/delete for the gallery, behind the admin panel's auth.
//
// Writes only ever go to SQL. Quickbase is the store being retired, and dual-writing to it
// would mean every admin edit could half-succeed; the read flag decides what visitors see,
// so an edit made before the cutover simply becomes visible when it flips.
public sealed class GalleryAdminService
{
    private readonly AppDbContext _db;
    private readonly BlobImageSource _blob;
    private readonly ImageProcessor _processor;
    private readonly ImageUrls _imageUrls;
    private readonly IMemoryCache _cache;

    public GalleryAdminService(
        AppDbContext db,
        BlobImageSource blob,
        ImageProcessor processor,
        ImageUrls imageUrls,
        IMemoryCache cache)
    {
        _db = db;
        _blob = blob;
        _processor = processor;
        _imageUrls = imageUrls;
        _cache = cache;
    }

    public async Task<List<AdminHouseDto>> ListAsync(CancellationToken ct)
    {
        // Unpublished included: the panel is where they get finished.
        var houses = await _db.Houses
            .AsNoTracking()
            .Include(h => h.Images)
            .OrderBy(h => h.SortOrder).ThenBy(h => h.Id)
            .ToListAsync(ct);

        return houses.Select(ToDto).ToList();
    }

    public async Task<AdminHouseDto?> GetAsync(int id, CancellationToken ct)
    {
        var house = await _db.Houses.AsNoTracking().Include(h => h.Images)
            .FirstOrDefaultAsync(h => h.Id == id, ct);

        return house is null ? null : ToDto(house);
    }

    public async Task<AdminHouseDto> CreateAsync(HouseInput input, string? actor, CancellationToken ct)
    {
        var house = new House { CreatedAt = DateTimeOffset.UtcNow };

        Apply(house, input, actor);

        // Appended to the end unless told otherwise, so a new house never silently displaces
        // the existing running order.
        house.SortOrder = input.SortOrder ?? await NextSortOrderAsync(ct);

        _db.Houses.Add(house);

        // A house created published serves its addresses from now on, so another house's
        // old-address row for one of them is released (see RecordAddressChangesAsync).
        if (house.IsPublished) await ReleaseAddressesAsync(PublicSlugs(house), onlyHouseId: null, ct);

        await _db.SaveChangesAsync(ct);
        Evict();

        return ToDto(house);
    }

    public async Task<AdminHouseDto?> UpdateAsync(int id, HouseInput input, string? actor, CancellationToken ct)
    {
        var house = await _db.Houses.Include(h => h.Images).FirstOrDefaultAsync(h => h.Id == id, ct);
        if (house is null) return null;

        var addressesBefore = PublicSlugs(house);
        var wasPublished = house.IsPublished;

        Apply(house, input, actor);
        if (input.SortOrder.HasValue) house.SortOrder = input.SortOrder.Value;

        // In the SAME save as the retitle, so a title can never move without its old address
        // being kept: either both land or neither does.
        await RecordAddressChangesAsync(house, addressesBefore, wasPublished, actor, ct);

        await _db.SaveChangesAsync(ct);
        Evict();

        return ToDto(house);
    }

    /// <summary>
    /// The address a house has in each locale, exactly as /api/gallery and the sitemap build
    /// it: GallerySlugs over the public id and the localized titles with their fallbacks. So
    /// a Bulgarian address moves when the ENGLISH title changes and TitleBg is empty, because
    /// that is when the Bulgarian page's address actually moves.
    /// </summary>
    public static Dictionary<string, string> PublicSlugs(House house)
    {
        var item = new GalleryItem
        {
            Id = HousePublicIds.For(house.QuickbaseRecordId, house.Id),
            Title = house.Title,
            TitleBg = house.TitleBg,
            TitleEl = house.TitleEl,
        };

        return GallerySlugs.Locales.ToDictionary(l => l.Locale, l => GallerySlugs.SlugFor(item, l.Locale));
    }

    /// <summary>
    /// ROADMAP #37, the one place HouseSlugHistory is written on save. Two rules:
    ///
    /// 1. AN ADDRESS GOES TO WHOEVER HELD IT LAST. A published house serves its addresses,
    ///    so a row for one of them — whichever house gave it up before — is released.
    ///    Otherwise, if this house were later unpublished or deleted, its own address would
    ///    301 to the earlier holder, a different product, where it should 404. A draft
    ///    releases only its own rows (renamed back to an old title): its page is not public,
    ///    and another house's redirect from that address is still the useful one.
    /// 2. AN ADDRESS THIS EDIT GAVE UP becomes a row pointing at the house, unless another
    ///    PUBLISHED house serves it today (two houses sharing a title): that page is the other
    ///    house's, not an old address of this one. And a draft never takes over a row another
    ///    house holds. The seeder applies the same rules.
    ///
    /// An edit that neither moves an address nor publishes the house — price, description,
    /// category, order — does not read the table at all.
    ///
    /// Two people retiring the same address in the same instant: the second save fails on
    /// the unique index and nothing of it is written, title included. With three staff and a
    /// handful of retitles a year, that is a retry, not a design problem.
    /// </summary>
    private async Task RecordAddressChangesAsync(
        House house, IReadOnlyDictionary<string, string> before, bool wasPublished, string? actor, CancellationToken ct)
    {
        var after = PublicSlugs(house);
        var moved = GallerySlugs.Locales
            .Select(l => l.Locale)
            .Where(l => !string.Equals(before[l], after[l], StringComparison.Ordinal))
            .ToList();
        var publishedNow = house.IsPublished && !wasPublished;

        if (moved.Count == 0 && !publishedNow) return;

        await ReleaseAddressesAsync(after, onlyHouseId: house.IsPublished ? null : house.Id, ct);

        if (moved.Count == 0) return;

        var servedByOthers = await AddressesOfOtherPublishedHousesAsync(house.Id, ct);
        var now = DateTimeOffset.UtcNow;

        foreach (var locale in moved)
        {
            var oldSlug = before[locale];
            if (oldSlug.Length > HouseSlugHistory.MaxSlugLength) continue;
            if (servedByOthers.Contains((locale, oldSlug))) continue;

            // One house per address. A row another house already holds passes to this one
            // only if this one was PUBLIC at that address. A draft that briefly carried an
            // old title never served it; taking the row would 404 the published house's
            // redirect now and point it at an unrelated product once the draft goes live.
            var row = await _db.HouseSlugHistory.FirstOrDefaultAsync(x => x.Locale == locale && x.Slug == oldSlug, ct);
            if (row is not null && row.HouseId != house.Id && !wasPublished) continue;
            if (row is null)
            {
                _db.HouseSlugHistory.Add(new HouseSlugHistory
                {
                    HouseId = house.Id,
                    Locale = locale,
                    Slug = oldSlug,
                    RetiredAt = now,
                    RetiredByUpn = actor,
                });
            }
            else
            {
                row.HouseId = house.Id;
                row.RetiredAt = now;
                row.RetiredByUpn = actor;
            }
        }
    }

    /// <summary>Removes the history rows for these addresses — every house's, or one house's.</summary>
    private async Task ReleaseAddressesAsync(
        IReadOnlyDictionary<string, string> addresses, int? onlyHouseId, CancellationToken ct)
    {
        foreach (var (locale, slug) in addresses)
        {
            var rows = _db.HouseSlugHistory.Where(x => x.Locale == locale && x.Slug == slug);
            if (onlyHouseId is int id) rows = rows.Where(x => x.HouseId == id);
            _db.HouseSlugHistory.RemoveRange(await rows.ToListAsync(ct));
        }
    }

    /// <summary>Every (locale, slug) another published house serves today. The gallery is a few dozen rows.</summary>
    private async Task<HashSet<(string Locale, string Slug)>> AddressesOfOtherPublishedHousesAsync(int houseId, CancellationToken ct)
    {
        var others = await _db.Houses.AsNoTracking()
            .Where(h => h.Id != houseId && h.IsPublished)
            .Select(h => new House { Id = h.Id, QuickbaseRecordId = h.QuickbaseRecordId, Title = h.Title, TitleBg = h.TitleBg, TitleEl = h.TitleEl })
            .ToListAsync(ct);

        return others.SelectMany(h => PublicSlugs(h).Select(s => (s.Key, s.Value))).ToHashSet();
    }

    /// <summary>The old addresses that redirect to this house, newest first, for the panel.</summary>
    public async Task<List<RetiredAddressDto>> RetiredAddressesAsync(int houseId, CancellationToken ct)
    {
        var rows = await _db.HouseSlugHistory.AsNoTracking()
            .Where(x => x.HouseId == houseId)
            .OrderByDescending(x => x.RetiredAt).ThenBy(x => x.Locale)
            .ToListAsync(ct);

        return rows.Select(x => new RetiredAddressDto(
            x.Locale,
            GallerySlugs.Locales.Single(l => l.Locale == x.Locale).Prefix + x.Slug,
            x.RetiredAt,
            x.RetiredByUpn)).ToList();
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var house = await _db.Houses.Include(h => h.Images).FirstOrDefaultAsync(h => h.Id == id, ct);
        if (house is null) return false;

        // The image ROWS cascade; the blobs are deliberately left behind. Deleting bytes is
        // irreversible and a deleted house is usually a mistake being noticed a minute later,
        // so the cheap thing (a few KB of orphaned storage) is preferred over the expensive
        // one (an unrecoverable photo). A container lifecycle rule can sweep them later.
        _db.Houses.Remove(house);
        await _db.SaveChangesAsync(ct);
        Evict();

        return true;
    }

    public async Task<AdminImageDto?> AddImageAsync(
        int houseId, byte[] bytes, string? fileName, string? altText, CancellationToken ct)
    {
        var house = await _db.Houses.Include(h => h.Images).FirstOrDefaultAsync(h => h.Id == houseId, ct);
        if (house is null) return null;

        // Rejected rather than stored as-is: an upload that will not decode is not an image,
        // and storing it would put a broken picture on the public page.
        var processed = _processor.TryProcess(bytes);
        if (processed is null) return null;

        var key = ImageKey.NewOwnedKey(ImageKey.GalleryScope, house.Id, fileName, processed.Extension);
        await _blob.UploadAsync(key, processed.Bytes, processed.ContentType, ct);

        var image = new HouseImage
        {
            ImageKey = key,
            SortOrder = house.Images.Count == 0 ? 0 : house.Images.Max(i => i.SortOrder) + 1,
            AltText = string.IsNullOrWhiteSpace(altText) ? null : altText.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };

        house.Images.Add(image);
        await _db.SaveChangesAsync(ct);
        Evict();

        return ToImageDto(image);
    }

    public async Task<bool> DeleteImageAsync(int houseId, int imageId, CancellationToken ct)
    {
        var image = await _db.HouseImages.FirstOrDefaultAsync(i => i.Id == imageId && i.HouseId == houseId, ct);
        if (image is null) return false;

        // Row only; see DeleteAsync for why the blob stays.
        _db.HouseImages.Remove(image);
        await _db.SaveChangesAsync(ct);
        Evict();

        return true;
    }

    /// <summary>Reorders a house's images. Ids not listed keep their relative order after the listed ones.</summary>
    public async Task<bool> ReorderImagesAsync(int houseId, IReadOnlyList<int> orderedIds, CancellationToken ct)
    {
        var house = await _db.Houses.Include(h => h.Images).FirstOrDefaultAsync(h => h.Id == houseId, ct);
        if (house is null) return false;

        var position = 0;
        foreach (var id in orderedIds)
        {
            var image = house.Images.FirstOrDefault(i => i.Id == id);
            if (image is not null) image.SortOrder = position++;
        }

        // Anything the client did not mention keeps a stable position at the end rather than
        // colliding on 0 — a partial list must not scramble the rest.
        foreach (var image in house.Images.Where(i => !orderedIds.Contains(i.Id)).OrderBy(i => i.SortOrder))
            image.SortOrder = position++;

        await _db.SaveChangesAsync(ct);
        Evict();

        return true;
    }

    private void Apply(House house, HouseInput input, string? actor)
    {
        house.Title = (input.Title ?? "").Trim();
        house.TitleBg = Clean(input.TitleBg);
        house.TitleEl = Clean(input.TitleEl);
        house.Description = input.Description ?? "";
        house.DescriptionBg = input.DescriptionBg;
        house.DescriptionEl = input.DescriptionEl;
        house.Price = input.Price;
        house.Currency = string.IsNullOrWhiteSpace(input.Currency) ? "EUR" : input.Currency.Trim();
        house.CategoryKey = (input.CategoryKey ?? "").Trim();
        house.CatalogId = Clean(input.CatalogId);
        house.IsPublished = input.IsPublished;
        house.UpdatedAt = DateTimeOffset.UtcNow;
        house.LastModifiedBy = actor;
    }

    private async Task<int> NextSortOrderAsync(CancellationToken ct) =>
        await _db.Houses.AnyAsync(ct) ? await _db.Houses.MaxAsync(h => h.SortOrder, ct) + 1 : 0;

    // The public gallery caches its rows for ten minutes. Without this an admin edit appears
    // to do nothing for up to ten minutes, which reads as a broken save and invites the editor
    // to save again.
    private void Evict()
    {
        _cache.Remove(SqlGalleryService.CacheKey);
        _cache.Remove("gallery:list:v2");
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private AdminHouseDto ToDto(House h) => new(
        h.Id, h.QuickbaseRecordId, h.Title, h.TitleBg, h.TitleEl,
        h.Description, h.DescriptionBg, h.DescriptionEl,
        h.Price, h.Currency, h.CategoryKey, h.CatalogId,
        h.IsPublished, h.SortOrder, h.UpdatedAt, h.LastModifiedBy,
        h.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(ToImageDto).ToList());

    private AdminImageDto ToImageDto(HouseImage i) =>
        new(i.Id, i.ImageKey, _imageUrls.ForKey(i.ImageKey) ?? "", i.SortOrder, i.AltText);
}
