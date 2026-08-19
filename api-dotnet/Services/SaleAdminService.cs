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
    public int? CustomerId { get; set; }
    public string? Description { get; set; }
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
/// A sale as the panel sees it.
///
/// SaleAmountEur and SaleExpensesEur are COMPUTED — qty × price, and the four cost columns
/// summed. Nothing here is stored, same rule as Purchase.LeftToPay.
///
/// There is no COGS and no margin: those came from the landed cost of the container line
/// this used to name, and the buy side was archived on 2026-08-19. See Sale.
/// </summary>
public sealed record SaleDto(
    int Id,
    int? CustomerId,
    string? CustomerName,
    string? Description,
    string SoldAt,
    int Quantity,
    decimal UnitSalePrice,
    decimal? PaymentFees,
    decimal? TransportCost,
    decimal? InstallationCost,
    decimal? OtherCosts,
    decimal SaleAmountEur,
    decimal SaleExpensesEur,
    decimal NetEur,
    string? Notes,
    string? UpdatedAt,
    string? UpdatedByUpn);

// Sales to customers. See Sale for what this table was, what it is, and the open question
// about its overlap with Purchase.
public sealed class SaleAdminService
{
    private readonly AppDbContext _db;

    public SaleAdminService(AppDbContext db) => _db = db;

    /// <summary>Sales, newest first, optionally for one customer.</summary>
    public async Task<List<SaleDto>> ListAsync(int? customerId, CancellationToken ct)
    {
        var query = _db.Sales.AsNoTracking().Include(s => s.Customer).AsQueryable();
        if (customerId is int id) query = query.Where(s => s.CustomerId == id);

        var sales = await query
            .OrderByDescending(s => s.SoldAt)
            .ThenByDescending(s => s.Id)
            .ToListAsync(ct);

        return sales.Select(ToDto).ToList();
    }

    public async Task<SaleDto?> GetAsync(int id, CancellationToken ct)
    {
        var sale = await _db.Sales
            .AsNoTracking()
            .Include(s => s.Customer)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        return sale is null ? null : ToDto(sale);
    }

    public async Task<SaleDto> CreateAsync(SaleInput input, string? actor, CancellationToken ct)
    {
        var sale = new Sale { CreatedAt = DateTimeOffset.UtcNow };
        Apply(sale, input, actor);

        _db.Sales.Add(sale);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(sale.Id, ct))!;
    }

    public async Task<SaleDto?> UpdateAsync(int id, SaleInput input, string? actor, CancellationToken ct)
    {
        var sale = await _db.Sales.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sale is null) return null;

        Apply(sale, input, actor);
        await _db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Deletes a sale outright.
    ///
    /// Nothing points at a sale now that stock is gone, so there is no history to orphan —
    /// the plain delete a mistyped row deserves. The audit log keeps what it was.
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

        // Required for anything typed from here on, even though the column is nullable —
        // the nullability exists only for the 30 rows imported from Quickbase, which point
        // at a customer table ours was never imported from. See Sale.CustomerId.
        if (input.CustomerId is not int id || id <= 0) errors.Add("Pick the customer.");

        if (string.IsNullOrWhiteSpace(input.SoldAt))
            errors.Add("A date is required.");
        else if (!CustomerAdminService.TryParsePurchaseDate(input.SoldAt, out _))
            errors.Add("That date is not a date.");

        if (input.Quantity <= 0) errors.Add("The quantity must be at least one.");

        // Zero is a warranty replacement; negative is not a sale.
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

        if (!string.IsNullOrWhiteSpace(input.Description) && input.Description.Trim().Length > 400)
            errors.Add("That description is too long.");

        return errors;
    }

    private static void Apply(Sale sale, SaleInput input, string? actor)
    {
        sale.CustomerId = input.CustomerId;
        sale.Description = FactoryAdminService.Clean(input.Description);

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

    public static SaleDto ToDto(Sale s)
    {
        var amount = s.Quantity * s.UnitSalePrice;
        var expenses = (s.PaymentFees ?? 0m) + (s.TransportCost ?? 0m)
                     + (s.InstallationCost ?? 0m) + (s.OtherCosts ?? 0m);

        return new SaleDto(
            s.Id,
            s.CustomerId,
            s.Customer?.Name,
            s.Description,
            s.SoldAt.ToString("yyyy-MM-dd"),
            s.Quantity,
            s.UnitSalePrice,
            s.PaymentFees, s.TransportCost, s.InstallationCost, s.OtherCosts,
            amount,
            expenses,
            // What the sale actually brought in once its own costs are counted. NOT profit —
            // the cost of the goods is unknown here by design; calling this "profit" would
            // be the guess-wearing-a-number's-clothes that Sale's header warns about.
            amount - expenses,
            s.Notes,
            s.UpdatedAt?.ToString("o"),
            s.UpdatedByUpn);
    }
}
