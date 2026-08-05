using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Services;

/// <summary>What the admin panel sends when creating or updating a case.</summary>
public sealed class CaseInput
{
    public bool IsPublished { get; set; }
    public bool Featured { get; set; }
    public int? SortOrder { get; set; }
    public string CompanyName { get; set; } = "";
    public string? CompanySector { get; set; }
    public string? BuyerName { get; set; }
    public string? BuyerRole { get; set; }
    public string? Country { get; set; }
    public string? City { get; set; }
    public string? CategoryKey { get; set; }
    public string? ProductName { get; set; }
    public string? ProductVariant { get; set; }
    public int? UnitsQty { get; set; }
    public int? Year { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
    public string? Scope { get; set; }
    public string? Result { get; set; }
    public string? PublicQuote { get; set; }
    public double? RatingSnapshot { get; set; }
}

public sealed record AdminCaseDto(
    int Id,
    long? QuickbaseRecordId,
    bool IsPublished,
    bool Featured,
    int SortOrder,
    string CompanyName,
    string? CompanySector,
    string? BuyerName,
    string? BuyerRole,
    string? Country,
    string? City,
    string? CategoryKey,
    string? ProductName,
    string? ProductVariant,
    int? UnitsQty,
    int? Year,
    DateTimeOffset? DeliveredAt,
    string? Scope,
    string? Result,
    string? PublicQuote,
    double? RatingSnapshot,
    string? CompanyLogoUrl,
    string? CoverImageUrl,
    DateTimeOffset? UpdatedAt,
    string? LastModifiedBy,
    List<AdminImageDto> Images,
    // The derived values, sent so the editor can see what the page will actually show rather
    // than having to reason about the rules. Read-only.
    string? PreviewLocation,
    string? PreviewBuyerLabel,
    string? PreviewProduct);

public sealed class CasesAdminService
{
    private readonly AppDbContext _db;
    private readonly BlobImageSource _blob;
    private readonly ImageProcessor _processor;
    private readonly ImageUrls _imageUrls;
    private readonly IMemoryCache _cache;

    public CasesAdminService(
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

    public async Task<List<AdminCaseDto>> ListAsync(CancellationToken ct)
    {
        var cases = await _db.Cases
            .AsNoTracking()
            .Include(c => c.Images)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
            .ToListAsync(ct);

        return cases.Select(ToDto).ToList();
    }

    public async Task<AdminCaseDto?> GetAsync(int id, CancellationToken ct)
    {
        var c = await _db.Cases.AsNoTracking().Include(x => x.Images).FirstOrDefaultAsync(x => x.Id == id, ct);
        return c is null ? null : ToDto(c);
    }

    public async Task<AdminCaseDto> CreateAsync(CaseInput input, string? actor, CancellationToken ct)
    {
        var entity = new Case { CreatedAt = DateTimeOffset.UtcNow };
        Apply(entity, input, actor);
        entity.SortOrder = input.SortOrder ?? await NextSortOrderAsync(ct);

        _db.Cases.Add(entity);
        await _db.SaveChangesAsync(ct);
        Evict();

        return ToDto(entity);
    }

    public async Task<AdminCaseDto?> UpdateAsync(int id, CaseInput input, string? actor, CancellationToken ct)
    {
        var entity = await _db.Cases.Include(c => c.Images).FirstOrDefaultAsync(c => c.Id == id, ct);
        if (entity is null) return null;

        Apply(entity, input, actor);
        if (input.SortOrder.HasValue) entity.SortOrder = input.SortOrder.Value;

        await _db.SaveChangesAsync(ct);
        Evict();

        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var entity = await _db.Cases.Include(c => c.Images).FirstOrDefaultAsync(c => c.Id == id, ct);
        if (entity is null) return false;

        // Rows only; blobs are left behind deliberately. See GalleryAdminService.DeleteAsync.
        _db.Cases.Remove(entity);
        await _db.SaveChangesAsync(ct);
        Evict();

        return true;
    }

    /// <summary>slot: "gallery" adds to the carousel; "logo" and "cover" replace that single image.</summary>
    public async Task<AdminImageDto?> AddImageAsync(
        int caseId, string slot, byte[] bytes, string? fileName, string? altText, CancellationToken ct)
    {
        var entity = await _db.Cases.Include(c => c.Images).FirstOrDefaultAsync(c => c.Id == caseId, ct);
        if (entity is null) return null;

        var processed = _processor.TryProcess(bytes);
        if (processed is null) return null;

        var key = ImageKey.NewOwnedKey(ImageKey.CasesScope, entity.Id, fileName, processed.Extension);
        await _blob.UploadAsync(key, processed.Bytes, processed.ContentType, ct);

        switch (slot)
        {
            case "logo":
                entity.CompanyLogoImageKey = key;
                break;
            case "cover":
                entity.CoverImageKey = key;
                break;
            default:
                entity.Images.Add(new CaseImage
                {
                    ImageKey = key,
                    SortOrder = entity.Images.Count == 0 ? 0 : entity.Images.Max(i => i.SortOrder) + 1,
                    AltText = string.IsNullOrWhiteSpace(altText) ? null : altText.Trim(),
                    CreatedAt = DateTimeOffset.UtcNow,
                });
                break;
        }

        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        Evict();

        var added = slot is "logo" or "cover"
            ? new AdminImageDto(0, key, _imageUrls.ForKey(key) ?? "", 0, null)
            : ToImageDto(entity.Images.Last());

        return added;
    }

    public async Task<bool> DeleteImageAsync(int caseId, int imageId, CancellationToken ct)
    {
        var image = await _db.CaseImages.FirstOrDefaultAsync(i => i.Id == imageId && i.CaseId == caseId, ct);
        if (image is null) return false;

        _db.CaseImages.Remove(image);
        await _db.SaveChangesAsync(ct);
        Evict();

        return true;
    }

    /// <summary>Clears the logo or cover. The blob is left in place, as everywhere else.</summary>
    public async Task<bool> ClearSlotAsync(int caseId, string slot, CancellationToken ct)
    {
        var entity = await _db.Cases.FirstOrDefaultAsync(c => c.Id == caseId, ct);
        if (entity is null) return false;

        if (slot == "logo") entity.CompanyLogoImageKey = null;
        else if (slot == "cover") entity.CoverImageKey = null;
        else return false;

        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        Evict();

        return true;
    }

    public async Task<bool> ReorderImagesAsync(int caseId, IReadOnlyList<int> orderedIds, CancellationToken ct)
    {
        var entity = await _db.Cases.Include(c => c.Images).FirstOrDefaultAsync(c => c.Id == caseId, ct);
        if (entity is null) return false;

        var position = 0;
        foreach (var id in orderedIds)
        {
            var image = entity.Images.FirstOrDefault(i => i.Id == id);
            if (image is not null) image.SortOrder = position++;
        }

        foreach (var image in entity.Images.Where(i => !orderedIds.Contains(i.Id)).OrderBy(i => i.SortOrder))
            image.SortOrder = position++;

        await _db.SaveChangesAsync(ct);
        Evict();

        return true;
    }

    private static void Apply(Case c, CaseInput input, string? actor)
    {
        c.IsPublished = input.IsPublished;
        c.Featured = input.Featured;
        c.CompanyName = (input.CompanyName ?? "").Trim();
        c.CompanySector = Clean(input.CompanySector);
        c.BuyerName = Clean(input.BuyerName);
        c.BuyerRole = Clean(input.BuyerRole);
        c.Country = Clean(input.Country);
        c.City = Clean(input.City);
        c.CategoryKey = CaseCategories.Normalize(input.CategoryKey);
        c.ProductName = Clean(input.ProductName);
        c.ProductVariant = Clean(input.ProductVariant);
        c.UnitsQty = input.UnitsQty;
        c.Year = input.Year;
        c.DeliveredAt = input.DeliveredAt;
        c.Scope = input.Scope;
        c.Result = input.Result;
        c.PublicQuote = input.PublicQuote;
        c.RatingSnapshot = input.RatingSnapshot;
        c.UpdatedAt = DateTimeOffset.UtcNow;
        c.LastModifiedBy = actor;
    }

    private async Task<int> NextSortOrderAsync(CancellationToken ct) =>
        await _db.Cases.AnyAsync(ct) ? await _db.Cases.MaxAsync(c => c.SortOrder, ct) + 1 : 0;

    // The cases payload is cached for ten minutes on both read paths, and review moderation
    // already evicts the Quickbase key. Both are cleared so an edit shows up immediately
    // whichever store is currently serving.
    private void Evict()
    {
        _cache.Remove(CasesPageService.CacheKey);
        _cache.Remove(CasesPageService.CacheKey + ":sql");
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private AdminCaseDto ToDto(Case c) => new(
        c.Id, c.QuickbaseRecordId, c.IsPublished, c.Featured, c.SortOrder,
        c.CompanyName, c.CompanySector, c.BuyerName, c.BuyerRole,
        c.Country, c.City, c.CategoryKey,
        c.ProductName, c.ProductVariant, c.UnitsQty, c.Year, c.DeliveredAt,
        c.Scope, c.Result, c.PublicQuote, c.RatingSnapshot,
        _imageUrls.ForKey(c.CompanyLogoImageKey),
        _imageUrls.ForKey(c.CoverImageKey),
        c.UpdatedAt, c.LastModifiedBy,
        c.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(ToImageDto).ToList(),
        CaseFormulas.PublicLocationLabel(c),
        CaseFormulas.PublicBuyerLabel(c),
        CaseFormulas.ProductLabel(c));

    private AdminImageDto ToImageDto(CaseImage i) =>
        new(i.Id, i.ImageKey, _imageUrls.ForKey(i.ImageKey) ?? "", i.SortOrder, i.AltText);
}
