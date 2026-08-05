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
        await _db.SaveChangesAsync(ct);
        Evict();

        return ToDto(house);
    }

    public async Task<AdminHouseDto?> UpdateAsync(int id, HouseInput input, string? actor, CancellationToken ct)
    {
        var house = await _db.Houses.Include(h => h.Images).FirstOrDefaultAsync(h => h.Id == id, ct);
        if (house is null) return null;

        Apply(house, input, actor);
        if (input.SortOrder.HasValue) house.SortOrder = input.SortOrder.Value;

        await _db.SaveChangesAsync(ct);
        Evict();

        return ToDto(house);
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
        _cache.Remove("gallery:sql:v1");
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
