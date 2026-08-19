using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>What the panel sends when creating or updating a cost-side model.</summary>
public sealed class ProductModelInput
{
    public string Name { get; set; } = "";
    public string? CategoryKey { get; set; }
    public int? HouseId { get; set; }
    public decimal? FactoryPrice { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

/// <summary>
/// A model as the panel sees it, with BOTH sides of its price where there are both.
///
/// RetailPrice is read THROUGH the gallery link and is not stored here — that is the whole
/// point of the HouseId column. A model that carried its own retail figure would be a second
/// price list, which is the 73 m² incident: two stores disagreeing about one house for weeks.
/// </summary>
public sealed record ProductModelDto(
    int Id,
    string Name,
    string? CategoryKey,
    int? HouseId,
    string? HouseTitle,
    decimal? FactoryPrice,
    decimal? RetailPrice,
    string? RetailCurrency,
    bool IsActive,
    string? Notes,
    int LotCount,
    int PurchasedQty,
    int SoldQty,
    int OnHandQty,
    string? UpdatedAt,
    string? UpdatedByUpn);

// The catalogue at factory cost. See ProductModel.
public sealed class ProductModelAdminService
{
    private readonly AppDbContext _db;

    public ProductModelAdminService(AppDbContext db) => _db = db;

    /// <summary>Every model, active first, then alphabetical. Mirrors FactoryAdminService.</summary>
    public async Task<List<ProductModelDto>> ListAsync(CancellationToken ct) =>
        await _db.ProductModels
            .AsNoTracking()
            .OrderByDescending(m => m.IsActive)
            .ThenBy(m => m.Name)
            .Select(m => new ProductModelDto(
                m.Id, m.Name, m.CategoryKey, m.HouseId,
                m.House == null ? null : m.House.Title,
                m.FactoryPrice,
                m.House == null ? null : m.House.Price,
                m.House == null ? null : m.House.Currency,
                m.IsActive, m.Notes,
                m.Lots.Count,
                m.Lots.Sum(l => l.Quantity),
                m.Lots.SelectMany(l => l.Sales).Sum(sale => sale.Quantity),
                m.Lots.Sum(l => l.Quantity) - m.Lots.SelectMany(l => l.Sales).Sum(sale => sale.Quantity),
                m.UpdatedAt == null ? null : m.UpdatedAt!.Value.ToString("o"),
                m.UpdatedByUpn))
            .ToListAsync(ct);

    public async Task<ProductModelDto?> GetAsync(int id, CancellationToken ct) =>
        (await ListAsync(ct)).FirstOrDefault(m => m.Id == id);

    public async Task<ProductModelDto> CreateAsync(ProductModelInput input, string? actor, CancellationToken ct)
    {
        var model = new ProductModel { CreatedAt = DateTimeOffset.UtcNow };
        Apply(model, input, actor);

        _db.ProductModels.Add(model);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(model.Id, ct))!;
    }

    public async Task<ProductModelDto?> UpdateAsync(
        int id, ProductModelInput input, string? actor, CancellationToken ct)
    {
        var model = await _db.ProductModels.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (model is null) return null;

        Apply(model, input, actor);
        await _db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public enum DeleteOutcome { Deleted, NotFound, InUse }

    /// <summary>
    /// Removes a model no lot names.
    ///
    /// Refused with a count, same as a supplier in use: deleting it would either orphan the
    /// lines that name it or be refused by the FK with an error the panel can only render as
    /// "something went wrong". A model we have stopped buying is deactivated.
    /// </summary>
    public async Task<(DeleteOutcome Outcome, int LotCount)> DeleteAsync(int id, CancellationToken ct)
    {
        var model = await _db.ProductModels.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (model is null) return (DeleteOutcome.NotFound, 0);

        var used = await _db.PurchaseLots.CountAsync(l => l.ProductModelId == id, ct);
        if (used > 0) return (DeleteOutcome.InUse, used);

        _db.ProductModels.Remove(model);
        await _db.SaveChangesAsync(ct);
        return (DeleteOutcome.Deleted, 0);
    }

    public static List<string> Validate(ProductModelInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (string.IsNullOrWhiteSpace(input.Name)) errors.Add("A name is required.");
        else if (input.Name.Trim().Length > 200) errors.Add("That name is too long.");

        // Shared with the sales side on purpose — see PurchaseCategories. Null is allowed:
        // plenty of what we buy (fittings, fixings) belongs to no category anyone filters on.
        if (input.CategoryKey is not null && !PurchaseCategories.IsValid(input.CategoryKey))
            errors.Add("That is not a category we buy in.");

        if (input.FactoryPrice is decimal price && price < 0m)
            errors.Add("The factory price cannot be negative.");

        return errors;
    }

    /// <summary>
    /// Other models already linked to the same gallery house, so the panel can ask "did you
    /// mean the existing one?".
    ///
    /// A warning rather than a unique index, because two cost rows for one house are
    /// legitimate — the same model bought from two factories at two prices is exactly what
    /// this table is for. What is NOT legitimate is creating the second one by accident and
    /// then wondering which cost the margin report used.
    /// </summary>
    public async Task<bool> HouseLinkExistsAsync(int? houseId, int? exceptId, CancellationToken ct)
    {
        if (houseId is not int id) return false;

        return await _db.ProductModels.AnyAsync(
            m => m.Id != (exceptId ?? 0) && m.HouseId == id, ct);
    }

    private static void Apply(ProductModel model, ProductModelInput input, string? actor)
    {
        model.Name = input.Name.Trim();
        model.CategoryKey = FactoryAdminService.Clean(input.CategoryKey);
        model.HouseId = input.HouseId;
        model.FactoryPrice = input.FactoryPrice;
        model.IsActive = input.IsActive;
        model.Notes = FactoryAdminService.Clean(input.Notes);
        model.UpdatedAt = DateTimeOffset.UtcNow;
        model.UpdatedByUpn = actor;
    }
}
