using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>What the panel sends when recording a sale.</summary>
public sealed class SaleInput
{
    public int PurchaseLotId { get; set; }
    public int? CustomerId { get; set; }
    public string? SoldAt { get; set; }
    public int Quantity { get; set; }
    public decimal UnitSalePrice { get; set; }
    public decimal? PaymentFees { get; set; }
    public decimal? TransportCost { get; set; }
    public decimal? InstallationCost { get; set; }
    public decimal? OtherCosts { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// A sale as the panel sees it: what was sold, what it brought in, what it truly earned.
///
/// Every figure from SaleAmount down is COMPUTED — amount from qty × price, COGS from the
/// lot's landed unit cost (LandedCost, converted at the shipment's own rate), profit from
/// the difference. CogsEur and both profits are null when the container has no exchange
/// rate: "we don't know yet" must not render as "it cost nothing".
/// </summary>
public sealed record SaleDto(
    int Id,
    int PurchaseLotId,
    string ProductModelName,
    string? ShipmentReference,
    int? CustomerId,
    string? CustomerName,
    string SoldAt,
    int Quantity,
    decimal UnitSalePrice,
    decimal? PaymentFees,
    decimal? TransportCost,
    decimal? InstallationCost,
    decimal? OtherCosts,
    decimal SaleAmountEur,
    decimal SaleExpensesEur,
    decimal? CogsEur,
    decimal? GrossProfitEur,
    decimal? NetProfitEur,
    string? Notes,
    string? UpdatedAt,
    string? UpdatedByUpn);

/// <summary>A container line the sale form can pick: what it is, and how many are left.</summary>
public sealed record SaleLotOption(
    int PurchaseLotId,
    string ProductModelName,
    string? ShipmentReference,
    string? BuyCycleLabel,
    int QtyPurchased,
    int QtySold,
    int QtyOnHand);

// Sales out of containers — the sell side of the procurement ledger, and the table stock
// on hand falls out of.
public sealed class SaleAdminService
{
    private readonly AppDbContext _db;

    public SaleAdminService(AppDbContext db) => _db = db;

    /// <summary>Sales, newest first. Loads each lot's container context because COGS needs it.</summary>
    public async Task<List<SaleDto>> ListAsync(CancellationToken ct)
    {
        var sales = await _db.Sales
            // WithIdentityResolution, because the include path is deliberately circular:
            // sale → lot → shipment → ALL the shipment's lots, which is what by-value
            // allocation needs to cost this sale. Plain AsNoTracking refuses the cycle.
            .AsNoTrackingWithIdentityResolution()
            .Include(s => s.Customer)
            .Include(s => s.PurchaseLot!).ThenInclude(l => l.ProductModel)
            .Include(s => s.PurchaseLot!).ThenInclude(l => l.Shipment!).ThenInclude(sh => sh.BuyCycle)
            .Include(s => s.PurchaseLot!).ThenInclude(l => l.Shipment!).ThenInclude(sh => sh.Lots)
            .OrderByDescending(s => s.SoldAt)
            .ThenByDescending(s => s.Id)
            .ToListAsync(ct);

        return sales.Select(ToDto).ToList();
    }

    public async Task<SaleDto?> GetAsync(int id, CancellationToken ct) =>
        (await ListAsync(ct)).FirstOrDefault(s => s.Id == id);

    /// <summary>
    /// The lines the sale form can offer: every lot that still has stock, plus — so an edit
    /// can re-select the line it already uses — any lot named by an existing sale.
    /// </summary>
    public async Task<List<SaleLotOption>> LotOptionsAsync(CancellationToken ct)
    {
        var lots = await _db.PurchaseLots
            .AsNoTracking()
            .Include(l => l.ProductModel)
            .Include(l => l.Shipment!).ThenInclude(sh => sh.BuyCycle)
            .Include(l => l.Sales)
            .ToListAsync(ct);

        return lots
            .Select(l =>
            {
                var sold = l.Sales.Sum(s => s.Quantity);
                return new SaleLotOption(
                    l.Id,
                    l.ProductModel?.Name ?? "",
                    l.Shipment?.Reference,
                    l.Shipment?.BuyCycle?.Label,
                    l.Quantity,
                    sold,
                    l.Quantity - sold);
            })
            .Where(o => o.QtyOnHand > 0 || o.QtySold > 0)
            .OrderBy(o => o.ProductModelName).ThenBy(o => o.PurchaseLotId)
            .ToList();
    }

    public enum SaveOutcome { Saved, NotFound, Oversold }

    /// <summary>
    /// Records a sale, refusing to sell more than the lot still holds.
    ///
    /// The oversell check is HERE, not a database constraint, because the answer a person
    /// needs is "that line has 3 left" — a constraint could only refuse. History imported
    /// from Quickbase is exempt by construction: the importer writes rows directly.
    /// </summary>
    public async Task<(SaveOutcome Outcome, int Available, SaleDto? Sale)> CreateAsync(
        SaleInput input, string? actor, CancellationToken ct)
    {
        var available = await AvailableAsync(input.PurchaseLotId, exceptSaleId: null, ct);
        if (available is null) return (SaveOutcome.NotFound, 0, null);
        if (input.Quantity > available) return (SaveOutcome.Oversold, available.Value, null);

        var sale = new Sale { CreatedAt = DateTimeOffset.UtcNow };
        Apply(sale, input, actor);

        _db.Sales.Add(sale);
        await _db.SaveChangesAsync(ct);

        return (SaveOutcome.Saved, available.Value, await GetAsync(sale.Id, ct));
    }

    public async Task<(SaveOutcome Outcome, int Available, SaleDto? Sale)> UpdateAsync(
        int id, SaleInput input, string? actor, CancellationToken ct)
    {
        var sale = await _db.Sales.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sale is null) return (SaveOutcome.NotFound, 0, null);

        // The sale's own current draw does not count against it: editing 5 → 6 on a lot
        // with one left is legitimate, because the five are already this sale's.
        var exceptSelf = sale.PurchaseLotId == input.PurchaseLotId ? id : (int?)null;
        var available = await AvailableAsync(input.PurchaseLotId, exceptSelf, ct);
        if (available is null) return (SaveOutcome.NotFound, 0, null);
        if (input.Quantity > available) return (SaveOutcome.Oversold, available.Value, null);

        Apply(sale, input, actor);
        await _db.SaveChangesAsync(ct);

        return (SaveOutcome.Saved, available.Value, await GetAsync(id, ct));
    }

    /// <summary>
    /// Deletes a sale outright — the units go BACK into stock, which is the point: a
    /// mis-entered sale corrected by deletion must not leave phantom missing goods. The
    /// audit log keeps what it was.
    /// </summary>
    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var sale = await _db.Sales.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sale is null) return false;

        _db.Sales.Remove(sale);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public static List<string> Validate(SaleInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (input.PurchaseLotId <= 0) errors.Add("Pick which container line it came from.");

        if (string.IsNullOrWhiteSpace(input.SoldAt))
            errors.Add("A date is required.");
        else if (!CustomerAdminService.TryParsePurchaseDate(input.SoldAt, out _))
            errors.Add("That date is not a date.");

        if (input.Quantity <= 0) errors.Add("The quantity must be at least one.");

        // Zero is a warranty replacement leaving the yard; negative is not a sale.
        if (input.UnitSalePrice < 0m) errors.Add("The price cannot be negative.");

        foreach (var (value, name) in new[]
                 {
                     (input.PaymentFees, "payment fees"), (input.TransportCost, "transport"),
                     (input.InstallationCost, "installation"), (input.OtherCosts, "other costs"),
                 })
        {
            if (value is decimal amount && amount < 0m)
                errors.Add($"The {name} cannot be negative.");
        }

        return errors;
    }

    /// <summary>What the lot can still supply, or null when the lot does not exist.</summary>
    private async Task<int?> AvailableAsync(int purchaseLotId, int? exceptSaleId, CancellationToken ct)
    {
        var lot = await _db.PurchaseLots
            .AsNoTracking()
            .Include(l => l.Sales)
            .FirstOrDefaultAsync(l => l.Id == purchaseLotId, ct);
        if (lot is null) return null;

        return lot.Quantity - lot.Sales.Where(s => s.Id != exceptSaleId).Sum(s => s.Quantity);
    }

    private static void Apply(Sale sale, SaleInput input, string? actor)
    {
        sale.PurchaseLotId = input.PurchaseLotId;
        sale.CustomerId = input.CustomerId;

        if (CustomerAdminService.TryParsePurchaseDate(input.SoldAt, out var soldAt) && soldAt is not null)
            sale.SoldAt = soldAt.Value;

        sale.Quantity = input.Quantity;
        sale.UnitSalePrice = input.UnitSalePrice;
        sale.PaymentFees = input.PaymentFees;
        sale.TransportCost = input.TransportCost;
        sale.InstallationCost = input.InstallationCost;
        sale.OtherCosts = input.OtherCosts;
        sale.Notes = FactoryAdminService.Clean(input.Notes);
        sale.UpdatedAt = DateTimeOffset.UtcNow;
        sale.UpdatedByUpn = actor;
    }

    /// <summary>
    /// The money, computed the one way it can be: COGS from the lot's landed unit cost in
    /// the container it actually rode in, by-value allocation — the settled default.
    /// </summary>
    public static SaleDto ToDto(Sale s)
    {
        var lot = s.PurchaseLot;
        var shipment = lot?.Shipment;

        decimal? cogs = null;
        if (lot is not null && shipment is not null)
        {
            var unitUsd = LandedCost.UnitLandedCost(lot, shipment, shipment.Lots, LandedCost.Allocation.ByValue);
            var unitEur = LandedCost.ToEur(unitUsd, shipment);
            if (unitEur is decimal eur) cogs = eur * s.Quantity;
        }

        var amount = s.Quantity * s.UnitSalePrice;
        var expenses = (s.PaymentFees ?? 0m) + (s.TransportCost ?? 0m)
                     + (s.InstallationCost ?? 0m) + (s.OtherCosts ?? 0m);

        return new SaleDto(
            s.Id,
            s.PurchaseLotId,
            lot?.ProductModel?.Name ?? "",
            shipment?.Reference,
            s.CustomerId,
            s.Customer?.Name,
            s.SoldAt.ToString("yyyy-MM-dd"),
            s.Quantity,
            s.UnitSalePrice,
            s.PaymentFees, s.TransportCost, s.InstallationCost, s.OtherCosts,
            amount,
            expenses,
            cogs,
            cogs is decimal c ? amount - c : null,
            cogs is decimal c2 ? amount - c2 - expenses : null,
            s.Notes,
            s.UpdatedAt?.ToString("o"),
            s.UpdatedByUpn);
    }
}
