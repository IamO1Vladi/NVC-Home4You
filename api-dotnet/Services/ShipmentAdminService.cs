using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>What the panel sends when creating or updating a container.</summary>
public sealed class ShipmentInput
{
    public int BuyCycleId { get; set; }
    public string? Reference { get; set; }
    public int? FactoryId { get; set; }

    // All USD, as paid. See Shipment for why nothing is converted on the way in.
    public decimal? FreightCost { get; set; }
    public decimal? CustomsDuty { get; set; }
    public decimal? ImportVatPaid { get; set; }
    public decimal? OtherCosts { get; set; }
    public string? OtherCostsNote { get; set; }

    public string? OrderedAt { get; set; }
    public string? DepartedAt { get; set; }
    public string? ArrivedAt { get; set; }

    public decimal? UsdToEurRate { get; set; }
    public string? RateSource { get; set; }
    public string? RateAt { get; set; }

    public string? Notes { get; set; }
}

/// <summary>What the panel sends for one line on a container.</summary>
public sealed class PurchaseLotInput
{
    public int ProductModelId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// One line of a container, with its share of the crossing worked out.
///
/// LineTotal and the two unit landed costs are COMPUTED here and stored nowhere — see
/// PurchaseLot, which deliberately has no LineTotal column.
/// </summary>
public sealed record PurchaseLotDto(
    int Id,
    int ProductModelId,
    string ProductModelName,
    int? HouseId,
    int Quantity,
    decimal UnitCost,
    decimal LineTotalUsd,
    decimal? UnitLandedCostUsd,
    decimal? UnitLandedCostEur,
    string? Notes);

/// <summary>
/// A container as the panel sees it: what was paid, what it landed at, and what it suggests
/// selling for.
///
/// Every money field ending Usd is stored; every one ending Eur is computed at the
/// shipment's own rate and is null when no rate has been recorded. Nothing here is written
/// back to the database.
/// </summary>
public sealed record ShipmentDto(
    int Id,
    int BuyCycleId,
    string BuyCycleLabel,
    string? Reference,
    int? FactoryId,
    string? FactoryName,
    decimal? FreightCost,
    decimal? CustomsDuty,
    decimal? ImportVatPaid,
    decimal? OtherCosts,
    string? OtherCostsNote,
    string? OrderedAt,
    string? DepartedAt,
    string? ArrivedAt,
    string Status,
    decimal? UsdToEurRate,
    string? RateSource,
    string? RateAt,
    decimal GoodsCostUsd,
    decimal CrossingCostUsd,
    decimal LandedBaseUsd,
    decimal? SuggestedPriceUsd,
    decimal? LandedBaseEur,
    decimal? SuggestedPriceEur,
    int LotCount,
    int UnitCount,
    IReadOnlyList<string> MissingForCosting,
    IReadOnlyList<PurchaseLotDto> Lots,
    string? Notes,
    string? UpdatedAt,
    string? UpdatedByUpn);

// Containers and their contents — the buy side of the business.
public sealed class ShipmentAdminService
{
    private readonly AppDbContext _db;

    public ShipmentAdminService(AppDbContext db) => _db = db;

    /// <summary>
    /// Containers, newest arrival first, optionally for one cycle.
    ///
    /// Loads the lots because every figure on the row depends on them — a shipment list that
    /// did not know its own contents could show freight but not landed cost, which is the
    /// column people came to read.
    /// </summary>
    public async Task<List<ShipmentDto>> ListAsync(
        int? buyCycleId, CancellationToken ct, LandedCost.Allocation allocation = LandedCost.Allocation.ByValue)
    {
        var query = _db.Shipments
            .AsNoTracking()
            .Include(s => s.BuyCycle)
            .Include(s => s.Factory)
            .Include(s => s.Lots).ThenInclude(l => l.ProductModel)
            .AsQueryable();

        if (buyCycleId is int cycleId) query = query.Where(s => s.BuyCycleId == cycleId);

        var shipments = await query
            .OrderByDescending(s => s.ArrivedAt ?? s.DepartedAt ?? s.OrderedAt ?? s.CreatedAt)
            .ToListAsync(ct);

        return shipments.Select(s => ToDto(s, allocation)).ToList();
    }

    public async Task<ShipmentDto?> GetAsync(
        int id, CancellationToken ct, LandedCost.Allocation allocation = LandedCost.Allocation.ByValue)
    {
        var shipment = await _db.Shipments
            .AsNoTracking()
            .Include(s => s.BuyCycle)
            .Include(s => s.Factory)
            .Include(s => s.Lots).ThenInclude(l => l.ProductModel)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        return shipment is null ? null : ToDto(shipment, allocation);
    }

    public async Task<ShipmentDto> CreateAsync(ShipmentInput input, string? actor, CancellationToken ct)
    {
        var shipment = new Shipment { CreatedAt = DateTimeOffset.UtcNow };
        Apply(shipment, input, actor);

        _db.Shipments.Add(shipment);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(shipment.Id, ct))!;
    }

    public async Task<ShipmentDto?> UpdateAsync(int id, ShipmentInput input, string? actor, CancellationToken ct)
    {
        var shipment = await _db.Shipments.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (shipment is null) return null;

        Apply(shipment, input, actor);
        await _db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Removes a container AND its lines.
    ///
    /// The one delete in these tables that is allowed to cascade, and it is safe for the
    /// reason the FK says: a lot has no meaning apart from the container it rode in, so
    /// there is nothing to orphan. Contrast BuyCycleAdminService.DeleteAsync, which refuses.
    /// </summary>
    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var shipment = await _db.Shipments.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (shipment is null) return false;

        _db.Shipments.Remove(shipment);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // --- Lines --------------------------------------------------------------------------

    /// <summary>
    /// Adds a line, defaulting the unit cost from the model's current factory price when the
    /// form did not carry one.
    ///
    /// The default is taken ONCE, here, and then belongs to the lot — see PurchaseLot.UnitCost.
    /// Reading it live from the model instead would reprice every historical container the
    /// next time a factory raised its prices.
    /// </summary>
    public async Task<ShipmentDto?> AddLotAsync(
        int shipmentId, PurchaseLotInput input, string? actor, CancellationToken ct)
    {
        var shipment = await _db.Shipments.FirstOrDefaultAsync(s => s.Id == shipmentId, ct);
        if (shipment is null) return null;

        var unitCost = input.UnitCost;
        if (unitCost <= 0m)
        {
            var model = await _db.ProductModels
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == input.ProductModelId, ct);
            unitCost = model?.FactoryPrice ?? 0m;
        }

        _db.PurchaseLots.Add(new PurchaseLot
        {
            ShipmentId = shipmentId,
            ProductModelId = input.ProductModelId,
            Quantity = input.Quantity,
            UnitCost = unitCost,
            Notes = FactoryAdminService.Clean(input.Notes),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            UpdatedByUpn = actor,
        });

        await _db.SaveChangesAsync(ct);
        return await GetAsync(shipmentId, ct);
    }

    public async Task<ShipmentDto?> UpdateLotAsync(
        int lotId, PurchaseLotInput input, string? actor, CancellationToken ct)
    {
        var lot = await _db.PurchaseLots.FirstOrDefaultAsync(l => l.Id == lotId, ct);
        if (lot is null) return null;

        lot.ProductModelId = input.ProductModelId;
        lot.Quantity = input.Quantity;
        lot.UnitCost = input.UnitCost;
        lot.Notes = FactoryAdminService.Clean(input.Notes);
        lot.UpdatedAt = DateTimeOffset.UtcNow;
        lot.UpdatedByUpn = actor;

        await _db.SaveChangesAsync(ct);
        return await GetAsync(lot.ShipmentId, ct);
    }

    public async Task<ShipmentDto?> DeleteLotAsync(int lotId, CancellationToken ct)
    {
        var lot = await _db.PurchaseLots.FirstOrDefaultAsync(l => l.Id == lotId, ct);
        if (lot is null) return null;

        var shipmentId = lot.ShipmentId;
        _db.PurchaseLots.Remove(lot);
        await _db.SaveChangesAsync(ct);

        return await GetAsync(shipmentId, ct);
    }

    // --- Validation ---------------------------------------------------------------------

    public static List<string> Validate(ShipmentInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (input.BuyCycleId <= 0) errors.Add("A buying cycle is required.");

        foreach (var (raw, name) in new[]
                 {
                     (input.OrderedAt, "ordered"), (input.DepartedAt, "departed"),
                     (input.ArrivedAt, "arrived"), (input.RateAt, "rate"),
                 })
        {
            if (!CustomerAdminService.TryParsePurchaseDate(raw, out _))
                errors.Add($"That {name} date is not a date.");
        }

        // Out-of-order dates are refused rather than warned about, because Status is derived
        // from them (see Shipment): a container that departed before it was ordered would
        // report a negative lead time and sit in the wrong column of the cycle page.
        CustomerAdminService.TryParsePurchaseDate(input.OrderedAt, out var ordered);
        CustomerAdminService.TryParsePurchaseDate(input.DepartedAt, out var departed);
        CustomerAdminService.TryParsePurchaseDate(input.ArrivedAt, out var arrived);

        if (ordered is not null && departed is not null && departed < ordered)
            errors.Add("It departed before it was ordered.");
        if (departed is not null && arrived is not null && arrived < departed)
            errors.Add("It arrived before it departed.");
        if (ordered is not null && arrived is not null && arrived < ordered)
            errors.Add("It arrived before it was ordered.");

        foreach (var (value, name) in new[]
                 {
                     (input.FreightCost, "freight"), (input.CustomsDuty, "customs duty"),
                     (input.ImportVatPaid, "import VAT"), (input.OtherCosts, "other costs"),
                 })
        {
            if (value is decimal amount && amount < 0m)
                errors.Add($"The {name} cannot be negative.");
        }

        if (input.UsdToEurRate is decimal rate && rate <= 0m)
            errors.Add("The exchange rate must be greater than zero.");

        return errors;
    }

    public static List<string> ValidateLot(PurchaseLotInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (input.ProductModelId <= 0) errors.Add("Pick a model.");

        // Enforced here rather than by a check constraint, so the panel can say "how many?"
        // where the database could only refuse the save.
        if (input.Quantity <= 0) errors.Add("The quantity must be at least one.");

        if (input.UnitCost < 0m) errors.Add("The unit cost cannot be negative.");

        return errors;
    }

    // --- Mapping ------------------------------------------------------------------------

    /// <summary>
    /// Where a container is, from which dates are filled in.
    ///
    /// Derived rather than stored — see Shipment, which deliberately has no Status column.
    /// </summary>
    public static string StatusOf(Shipment s) =>
        s.ArrivedAt is not null ? "arrived"
        : s.DepartedAt is not null ? "in-transit"
        : s.OrderedAt is not null ? "ordered"
        : "draft";

    private static ShipmentDto ToDto(Shipment s, LandedCost.Allocation allocation)
    {
        var lots = s.Lots.OrderBy(l => l.Id).ToList();

        var goods = LandedCost.GoodsCost(lots);
        var crossing = LandedCost.CrossingCost(s);
        var landedBase = goods + crossing;
        var suggested = LandedCost.SuggestedPrice(landedBase, s.BuyCycle);

        return new ShipmentDto(
            s.Id,
            s.BuyCycleId,
            s.BuyCycle?.Label ?? "",
            s.Reference,
            s.FactoryId,
            s.Factory?.Name,
            s.FreightCost, s.CustomsDuty, s.ImportVatPaid, s.OtherCosts, s.OtherCostsNote,
            s.OrderedAt?.ToString("yyyy-MM-dd"),
            s.DepartedAt?.ToString("yyyy-MM-dd"),
            s.ArrivedAt?.ToString("yyyy-MM-dd"),
            StatusOf(s),
            s.UsdToEurRate,
            s.RateSource,
            s.RateAt?.ToString("yyyy-MM-dd"),
            goods,
            crossing,
            landedBase,
            suggested,
            LandedCost.ToEur(landedBase, s),
            LandedCost.ToEur(suggested, s),
            lots.Count,
            lots.Sum(l => l.Quantity),
            LandedCost.MissingForCosting(s, s.BuyCycle),
            lots.Select(l =>
            {
                var unitUsd = LandedCost.UnitLandedCost(l, s, lots, allocation);
                return new PurchaseLotDto(
                    l.Id,
                    l.ProductModelId,
                    l.ProductModel?.Name ?? "",
                    l.ProductModel?.HouseId,
                    l.Quantity,
                    l.UnitCost,
                    l.Quantity * l.UnitCost,
                    unitUsd,
                    LandedCost.ToEur(unitUsd, s),
                    l.Notes);
            }).ToList(),
            s.Notes,
            s.UpdatedAt?.ToString("o"),
            s.UpdatedByUpn);
    }

    private static void Apply(Shipment shipment, ShipmentInput input, string? actor)
    {
        shipment.BuyCycleId = input.BuyCycleId;
        shipment.Reference = FactoryAdminService.Clean(input.Reference);
        shipment.FactoryId = input.FactoryId;

        shipment.FreightCost = input.FreightCost;
        shipment.CustomsDuty = input.CustomsDuty;
        shipment.ImportVatPaid = input.ImportVatPaid;
        shipment.OtherCosts = input.OtherCosts;
        shipment.OtherCostsNote = FactoryAdminService.Clean(input.OtherCostsNote);

        if (CustomerAdminService.TryParsePurchaseDate(input.OrderedAt, out var ordered))
            shipment.OrderedAt = ordered;
        if (CustomerAdminService.TryParsePurchaseDate(input.DepartedAt, out var departed))
            shipment.DepartedAt = departed;
        if (CustomerAdminService.TryParsePurchaseDate(input.ArrivedAt, out var arrived))
            shipment.ArrivedAt = arrived;

        shipment.UsdToEurRate = input.UsdToEurRate;
        shipment.RateSource = FactoryAdminService.Clean(input.RateSource);
        if (CustomerAdminService.TryParsePurchaseDate(input.RateAt, out var rateAt))
            shipment.RateAt = rateAt;

        shipment.Notes = FactoryAdminService.Clean(input.Notes);
        shipment.UpdatedAt = DateTimeOffset.UtcNow;
        shipment.UpdatedByUpn = actor;
    }
}
