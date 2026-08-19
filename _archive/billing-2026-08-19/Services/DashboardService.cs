using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>One metric against its target: what was planned, what happened.</summary>
public sealed record TargetCompareDto(
    string MetricKey,
    decimal TargetValue,
    decimal? ActualValue);

/// <summary>One model's period: what sold and what it earned.</summary>
public sealed record DashboardModelRow(
    string ProductModelName,
    int QtySold,
    decimal RevenueEur,
    decimal? CogsEur,
    decimal? GrossProfitEur);

/// <summary>One month of a longer period, for the series table.</summary>
public sealed record DashboardMonthRow(
    string Key,
    decimal RevenueEur,
    decimal OpexEur);

/// <summary>
/// What the yard holds right now. Units always count; VALUE only sums the lots whose
/// container has an FX rate, and UnpricedUnits says how many units the value had to leave
/// out — "€40,000 of stock (3 units unpriced)" and "€40,000 of stock" are different claims.
/// </summary>
public sealed record DashboardStockDto(
    int UnitsOnHand,
    decimal ValueEur,
    int UnpricedUnits);

/// <summary>Procurement totals for a cycle view, EUR at each shipment's own rate.</summary>
public sealed record DashboardCycleCostsDto(
    decimal LandedBaseEur,
    decimal TrueCostEur,
    decimal? SuggestedRevenueEur,
    int ShipmentsWithoutRate);

public sealed record DashboardDto(
    string Period,
    string PeriodLabel,
    decimal RevenueEur,
    decimal? CogsEur,
    decimal? GrossProfitEur,
    decimal SaleExpensesEur,
    decimal OpexEur,
    decimal? NetResultEur,
    int UnitsSold,
    IReadOnlyList<TargetCompareDto> Targets,
    IReadOnlyList<DashboardModelRow> ByModel,
    IReadOnlyList<ExpenseRollupRow> OpexByCategory,
    IReadOnlyList<DashboardMonthRow> ByMonth,
    DashboardStockDto Stock,
    DashboardCycleCostsDto? CycleCosts);

// The reporting screen ROADMAP #21 was building towards. Every figure is EUR, every figure
// is DERIVED — the same no-stored-totals rule as the tables underneath — and every business
// ruling from 2026-08-19 is arithmetic here:
//
//   - COGS is the sold lot's landed unit cost, by-value allocation, at ITS container's own
//     rate. A sale whose container has no rate poisons COGS to null for the whole period,
//     because "profit except for the goods we couldn't price" is not a number.
//   - The cycle view answers for the cycle's GOODS, whenever they sold: months are how the
//     business watches a cycle from inside, but the cycle's own P&L is bought-here,
//     sold-whenever — exactly how Quickbase's cycle summaries rolled up.
//   - Cycle opex uses the explicit BuyCycleId link (QB cycles had no end date, so the link
//     is the only attribution that exists); month and year opex use SpentAt.
//   - True procurement cost includes only the VAT that never comes back (customs × rate).
public sealed class DashboardService
{
    private readonly AppDbContext _db;

    public DashboardService(AppDbContext db) => _db = db;

    public async Task<DashboardDto> MonthAsync(int year, int month, CancellationToken ct)
    {
        var from = new DateTimeOffset(year, month, 1, 0, 0, 0, TimeSpan.Zero);
        var to = from.AddMonths(1);

        var sales = await LoadSalesAsync(s => s.SoldAt >= from && s.SoldAt < to, ct);
        var opex = await _db.OperatingExpenses.AsNoTracking()
            .Where(x => x.SpentAt >= from && x.SpentAt < to).ToListAsync(ct);
        var targets = await TargetsAsync(t =>
            t.PeriodType == PeriodTypes.Month && t.Year == year && t.Month == month, ct);

        return Build("month", $"{year:D4}-{month:D2}", sales, opex, targets,
            byMonth: Array.Empty<DashboardMonthRow>(), cycle: null, await StockAsync(ct));
    }

    public async Task<DashboardDto> YearAsync(int year, CancellationToken ct)
    {
        var from = new DateTimeOffset(year, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var to = from.AddYears(1);

        var sales = await LoadSalesAsync(s => s.SoldAt >= from && s.SoldAt < to, ct);
        var opex = await _db.OperatingExpenses.AsNoTracking()
            .Where(x => x.SpentAt >= from && x.SpentAt < to).ToListAsync(ct);
        var targets = await TargetsAsync(t =>
            t.PeriodType == PeriodTypes.Year && t.Year == year, ct);

        return Build("year", year.ToString(CultureInfo.InvariantCulture), sales, opex, targets,
            MonthSeries(sales, opex), cycle: null, await StockAsync(ct));
    }

    public async Task<DashboardDto?> CycleAsync(int cycleId, CancellationToken ct)
    {
        var cycle = await _db.BuyCycles.AsNoTracking()
            .Include(c => c.Shipments).ThenInclude(sh => sh.Lots)
            .FirstOrDefaultAsync(c => c.Id == cycleId, ct);
        if (cycle is null) return null;

        // The cycle's goods, whenever they sold — see the class comment.
        var sales = await LoadSalesAsync(s => s.PurchaseLot!.Shipment!.BuyCycleId == cycleId, ct);
        var opex = await _db.OperatingExpenses.AsNoTracking()
            .Where(x => x.BuyCycleId == cycleId).ToListAsync(ct);
        var targets = await TargetsAsync(t =>
            t.PeriodType == PeriodTypes.Cycle && t.BuyCycleId == cycleId, ct);

        // Procurement totals for the same goods, at each shipment's own rate.
        decimal landed = 0m, trueCost = 0m, suggested = 0m;
        var withoutRate = 0;
        var anySuggestedMissing = false;
        foreach (var shipment in cycle.Shipments)
        {
            var baseUsd = LandedCost.Base(shipment, shipment.Lots);
            if (LandedCost.ToEur(baseUsd, shipment) is not decimal baseEur) { withoutRate++; continue; }

            landed += baseEur;
            trueCost += LandedCost.ToEur(LandedCost.TrueCost(baseUsd, shipment.CustomsDuty, cycle), shipment) ?? baseEur;

            var s = LandedCost.SuggestedPrice(baseUsd, cycle);
            if (LandedCost.ToEur(s, shipment) is decimal sEur) suggested += sEur;
            else anySuggestedMissing = true;
        }

        var cycleCosts = new DashboardCycleCostsDto(
            landed, trueCost,
            anySuggestedMissing ? null : suggested,
            withoutRate);

        return Build("cycle", cycle.Label, sales, opex, targets,
            MonthSeries(sales, opex), cycleCosts, await StockAsync(ct));
    }

    // --- The assembly ------------------------------------------------------------------

    private static DashboardDto Build(
        string period, string label,
        List<Sale> sales, List<OperatingExpense> opex, List<Target> targets,
        IReadOnlyList<DashboardMonthRow> byMonth, DashboardCycleCostsDto? cycle,
        DashboardStockDto stock)
    {
        var revenue = sales.Sum(s => s.Quantity * s.UnitSalePrice);
        var saleExpenses = sales.Sum(SaleExpenses);
        var unitsSold = sales.Sum(s => s.Quantity);

        // COGS: null POISONS, never disappears — one unpriceable sale makes the period's
        // COGS (and both profits) unknown, because a total that quietly omits it would
        // read as profit nobody computed. The per-model table shows which rows are whole.
        decimal? cogs = 0m;
        foreach (var s in sales)
        {
            var c = CogsOf(s);
            if (c is null) { cogs = null; break; }
            cogs += c;
        }

        var gross = cogs is decimal cg ? revenue - cg : (decimal?)null;
        var opexTotal = opex.Sum(x => x.Amount);
        var net = gross is decimal g ? g - saleExpenses - opexTotal : (decimal?)null;

        var byModel = sales
            .GroupBy(s => s.PurchaseLot?.ProductModel?.Name ?? "—")
            .Select(g =>
            {
                var rowRevenue = g.Sum(s => s.Quantity * s.UnitSalePrice);
                decimal? rowCogs = 0m;
                foreach (var s in g)
                {
                    var c = CogsOf(s);
                    if (c is null) { rowCogs = null; break; }
                    rowCogs += c;
                }
                return new DashboardModelRow(
                    g.Key, g.Sum(s => s.Quantity), rowRevenue, rowCogs,
                    rowCogs is decimal rc ? rowRevenue - rc : null);
            })
            .OrderByDescending(r => r.RevenueEur)
            .ToList();

        var opexByCategory = opex
            .GroupBy(x => x.CategoryKey ?? "uncategorised")
            .Select(g => new ExpenseRollupRow(g.Key, g.Sum(x => x.Amount), g.Count()))
            .OrderByDescending(r => r.Total)
            .ToList();

        // Each set target meets its actual. Actuals can be null (unpriced COGS) — the
        // screen says "unknown" rather than 0% of plan.
        var compares = targets.Select(t => new TargetCompareDto(
            t.MetricKey,
            t.TargetValue,
            t.MetricKey switch
            {
                TargetMetrics.Revenue => revenue,
                TargetMetrics.GrossMargin => gross,
                TargetMetrics.NetResult => net,
                TargetMetrics.OpexCap => opexTotal,
                TargetMetrics.UnitsSold => unitsSold,
                _ => null,
            })).ToList();

        return new DashboardDto(
            period, label, revenue, cogs, gross, saleExpenses, opexTotal, net, unitsSold,
            compares, byModel, opexByCategory, byMonth, stock, cycle);
    }

    private static IReadOnlyList<DashboardMonthRow> MonthSeries(
        List<Sale> sales, List<OperatingExpense> opex)
    {
        var keys = sales.Select(s => (s.SoldAt.Year, s.SoldAt.Month))
            .Concat(opex.Select(x => (x.SpentAt.Year, x.SpentAt.Month)))
            .Distinct()
            .OrderBy(k => k)
            .ToList();

        return keys.Select(k => new DashboardMonthRow(
            $"{k.Item1:D4}-{k.Item2:D2}",
            sales.Where(s => s.SoldAt.Year == k.Item1 && s.SoldAt.Month == k.Item2)
                 .Sum(s => s.Quantity * s.UnitSalePrice),
            opex.Where(x => x.SpentAt.Year == k.Item1 && x.SpentAt.Month == k.Item2)
                .Sum(x => x.Amount))).ToList();
    }

    /// <summary>
    /// The yard right now: every lot's remainder, valued at its own landed unit cost where
    /// the container has a rate, counted-but-unvalued where it does not.
    /// </summary>
    private async Task<DashboardStockDto> StockAsync(CancellationToken ct)
    {
        var lots = await _db.PurchaseLots
            .AsNoTrackingWithIdentityResolution()
            .Include(l => l.Sales)
            .Include(l => l.Shipment!).ThenInclude(sh => sh.Lots)
            .ToListAsync(ct);

        int units = 0, unpriced = 0;
        decimal value = 0m;

        foreach (var lot in lots)
        {
            var onHand = lot.Quantity - lot.Sales.Sum(s => s.Quantity);
            if (onHand <= 0) continue;
            units += onHand;

            var unitUsd = LandedCost.UnitLandedCost(lot, lot.Shipment!, lot.Shipment!.Lots);
            if (LandedCost.ToEur(unitUsd, lot.Shipment) is decimal unitEur) value += unitEur * onHand;
            else unpriced += onHand;
        }

        return new DashboardStockDto(units, value, unpriced);
    }

    private async Task<List<Sale>> LoadSalesAsync(
        System.Linq.Expressions.Expression<Func<Sale, bool>> where, CancellationToken ct) =>
        await _db.Sales
            // The same deliberately-circular include as SaleAdminService: COGS needs the
            // WHOLE container a sale's lot rode in, for by-value allocation.
            .AsNoTrackingWithIdentityResolution()
            .Include(s => s.PurchaseLot!).ThenInclude(l => l.ProductModel)
            .Include(s => s.PurchaseLot!).ThenInclude(l => l.Shipment!).ThenInclude(sh => sh.Lots)
            .Where(where)
            .ToListAsync(ct);

    private async Task<List<Target>> TargetsAsync(
        System.Linq.Expressions.Expression<Func<Target, bool>> where, CancellationToken ct) =>
        await _db.Targets.AsNoTracking().Where(where).ToListAsync(ct);

    private static decimal SaleExpenses(Sale s) =>
        (s.PaymentFees ?? 0m) + (s.TransportCost ?? 0m)
        + (s.InstallationCost ?? 0m) + (s.OtherCosts ?? 0m);

    private static decimal? CogsOf(Sale s)
    {
        var lot = s.PurchaseLot;
        var shipment = lot?.Shipment;
        if (lot is null || shipment is null) return null;

        var unitUsd = LandedCost.UnitLandedCost(lot, shipment, shipment.Lots);
        return LandedCost.ToEur(unitUsd, shipment) is decimal eur ? eur * s.Quantity : null;
    }
}
