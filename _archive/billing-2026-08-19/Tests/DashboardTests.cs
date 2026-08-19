using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The reporting arithmetic (ROADMAP #21, the last piece).
//
// Everything pinned here is a business ruling from 2026-08-19 turned into a number: COGS
// poisons to null rather than omitting unpriceable sales, the cycle answers for its GOODS
// whenever they sold, cycle opex follows the explicit link, true cost carries only the
// unrecoverable VAT, and the opex-cap target is a ceiling where every other target is a
// floor.
public class DashboardTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"dash-{Guid.NewGuid()}")
            .Options);

    private static CancellationToken Ct => CancellationToken.None;

    private static DateTimeOffset Day(int y, int m, int d) => new(y, m, d, 0, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// The fixture: one cycle, one container ($10,000 goods + $2,500 crossing, rate 0.9),
    /// one lot of 5, one August sale of 2 at €15,000 with €300 of sale expenses, €1,000 of
    /// August opex linked to the cycle. Unit landed = $12,500/5 = $2,500 → €2,250.
    /// </summary>
    private static async Task<(BuyCycle Cycle, PurchaseLot Lot)> SeedAsync(AppDbContext db)
    {
        var cycle = new BuyCycle { Label = "2024-2026", MarkupCoefficient = 2.7m, BorderVatRate = 0.20m };
        var model = new ProductModel { Name = "Expandable 58" };
        var shipment = new Shipment
        {
            BuyCycle = cycle, Reference = "MSKU-1",
            FreightCost = 2_000m, CustomsDuty = 500m, UsdToEurRate = 0.9m,
        };
        var lot = new PurchaseLot { Shipment = shipment, ProductModel = model, Quantity = 5, UnitCost = 2_000m };
        var sale = new Sale
        {
            PurchaseLot = lot, SoldAt = Day(2026, 8, 10), Quantity = 2, UnitSalePrice = 7_500m,
            PaymentFees = 100m, TransportCost = 200m,
        };
        var opex = new OperatingExpense
        {
            SpentAt = Day(2026, 8, 14), Amount = 1_000m,
            CategoryKey = ExpenseCategories.Warehouse, BuyCycle = cycle,
        };
        db.AddRange(cycle, model, shipment, lot, sale, opex);
        await db.SaveChangesAsync();
        return (cycle, lot);
    }

    [Fact]
    public async Task The_month_adds_up_and_every_figure_is_derived()
    {
        using var db = NewDb();
        await SeedAsync(db);

        var d = await new DashboardService(db).MonthAsync(2026, 8, Ct);

        Assert.Equal(15_000m, d.RevenueEur);
        // 2 units × ((10,000 + 2,500)/5 = $2,500 landed) × 0.9 = €4,500.
        Assert.Equal(4_500m, d.CogsEur);
        Assert.Equal(10_500m, d.GrossProfitEur);
        Assert.Equal(300m, d.SaleExpensesEur);
        Assert.Equal(1_000m, d.OpexEur);
        Assert.Equal(9_200m, d.NetResultEur);
        Assert.Equal(2, d.UnitsSold);
    }

    [Fact]
    public async Task A_sale_outside_the_month_stays_outside_it()
    {
        using var db = NewDb();
        await SeedAsync(db);

        var july = await new DashboardService(db).MonthAsync(2026, 7, Ct);

        Assert.Equal(0m, july.RevenueEur);
        Assert.Equal(0, july.UnitsSold);
    }

    [Fact]
    public async Task One_unpriceable_sale_poisons_cogs_for_the_whole_period()
    {
        using var db = NewDb();
        var (cycle, _) = await SeedAsync(db);

        // A second container with NO rate, and a sale off it in the same month.
        var model = new ProductModel { Name = "Container 6m" };
        var shipment = new Shipment { BuyCycle = cycle, Reference = "NO-RATE" };
        var lot = new PurchaseLot { Shipment = shipment, ProductModel = model, Quantity = 3, UnitCost = 1_000m };
        db.AddRange(model, shipment, lot,
            new Sale { PurchaseLot = lot, SoldAt = Day(2026, 8, 12), Quantity = 1, UnitSalePrice = 4_000m });
        await db.SaveChangesAsync();

        var d = await new DashboardService(db).MonthAsync(2026, 8, Ct);

        // Revenue still counts — prices are known. COGS and the profits are NULL, not
        // "the sum of what we could price": that number would read as profit and be wrong.
        Assert.Equal(19_000m, d.RevenueEur);
        Assert.Null(d.CogsEur);
        Assert.Null(d.GrossProfitEur);
        Assert.Null(d.NetResultEur);

        // And the per-model table says WHICH row is broken: the priced model keeps its
        // margin, the unpriced one shows the dash.
        Assert.Equal(10_500m, d.ByModel.Single(r => r.ProductModelName == "Expandable 58").GrossProfitEur);
        Assert.Null(d.ByModel.Single(r => r.ProductModelName == "Container 6m").CogsEur);
    }

    [Fact]
    public async Task The_cycle_answers_for_its_goods_whenever_they_sold()
    {
        using var db = NewDb();
        var (cycle, lot) = await SeedAsync(db);

        // A sale in a DIFFERENT year, same cycle's goods.
        db.Sales.Add(new Sale
        {
            PurchaseLot = lot, SoldAt = Day(2027, 2, 1), Quantity = 1, UnitSalePrice = 8_000m,
        });
        await db.SaveChangesAsync();

        var d = (await new DashboardService(db).CycleAsync(cycle.Id, Ct))!;

        // Both sales count: bought-here, sold-whenever. The month view would split them;
        // the cycle view is the whole story of the cycle's goods.
        Assert.Equal(23_000m, d.RevenueEur);
        Assert.Equal(3, d.UnitsSold);

        // And the by-month series shows them landing in their own months.
        Assert.Equal(2, d.ByMonth.Count);
        Assert.Contains(d.ByMonth, m => m.Key == "2026-08" && m.RevenueEur == 15_000m);
        Assert.Contains(d.ByMonth, m => m.Key == "2027-02" && m.RevenueEur == 8_000m);
    }

    [Fact]
    public async Task Cycle_opex_follows_the_explicit_link_not_the_dates()
    {
        using var db = NewDb();
        var (cycle, _) = await SeedAsync(db);

        // An expense inside the cycle's date range but NOT linked to it — rent, say.
        db.OperatingExpenses.Add(new OperatingExpense
        {
            SpentAt = Day(2026, 8, 20), Amount = 900m, CategoryKey = ExpenseCategories.Warehouse,
        });
        await db.SaveChangesAsync();

        var d = (await new DashboardService(db).CycleAsync(cycle.Id, Ct))!;

        // Only the linked €1,000 counts. QB cycles have no end date, so the link is the
        // only attribution that exists — dates cannot reconstruct it.
        Assert.Equal(1_000m, d.OpexEur);
    }

    [Fact]
    public async Task Cycle_costs_carry_only_the_vat_that_never_comes_back()
    {
        using var db = NewDb();
        var (cycle, _) = await SeedAsync(db);

        var d = (await new DashboardService(db).CycleAsync(cycle.Id, Ct))!;

        // Landed base $12,500 × 0.9 = €11,250. True cost adds ONLY customs × rate:
        // (12,500 + 500 × 0.2) × 0.9 = €11,340 — not the full VAT, which mostly comes back.
        Assert.Equal(11_250m, d.CycleCosts!.LandedBaseEur);
        Assert.Equal(11_340m, d.CycleCosts.TrueCostEur);

        // Suggested: 12,500 × (2.7 + 0.2) = $36,250 × 0.9 = €32,625.
        Assert.Equal(32_625m, d.CycleCosts.SuggestedRevenueEur);
        Assert.Equal(0, d.CycleCosts.ShipmentsWithoutRate);
    }

    [Fact]
    public async Task Targets_meet_their_actuals_metric_by_metric()
    {
        using var db = NewDb();
        await SeedAsync(db);
        db.Targets.AddRange(
            new Target { PeriodType = PeriodTypes.Month, Year = 2026, Month = 8, MetricKey = TargetMetrics.Revenue, TargetValue = 20_000m },
            new Target { PeriodType = PeriodTypes.Month, Year = 2026, Month = 8, MetricKey = TargetMetrics.OpexCap, TargetValue = 1_500m },
            new Target { PeriodType = PeriodTypes.Month, Year = 2026, Month = 8, MetricKey = TargetMetrics.UnitsSold, TargetValue = 2m });
        await db.SaveChangesAsync();

        var d = await new DashboardService(db).MonthAsync(2026, 8, Ct);

        Assert.Equal(15_000m, d.Targets.Single(t => t.MetricKey == TargetMetrics.Revenue).ActualValue);
        Assert.Equal(1_000m, d.Targets.Single(t => t.MetricKey == TargetMetrics.OpexCap).ActualValue);
        Assert.Equal(2m, d.Targets.Single(t => t.MetricKey == TargetMetrics.UnitsSold).ActualValue);
    }

    [Fact]
    public async Task Stock_counts_everything_but_only_values_what_it_can_price()
    {
        using var db = NewDb();
        var (cycle, _) = await SeedAsync(db);

        // A rateless container holding 2 unsold units.
        var model = new ProductModel { Name = "Unpriced" };
        var shipment = new Shipment { BuyCycle = cycle };
        db.AddRange(model, shipment,
            new PurchaseLot { Shipment = shipment, ProductModel = model, Quantity = 2, UnitCost = 500m });
        await db.SaveChangesAsync();

        var d = await new DashboardService(db).MonthAsync(2026, 8, Ct);

        // 3 left of the priced lot + 2 unpriced = 5 units; value covers only the 3
        // (3 × €2,250), and the 2 left out are SAID, not silently absorbed.
        Assert.Equal(5, d.Stock.UnitsOnHand);
        Assert.Equal(6_750m, d.Stock.ValueEur);
        Assert.Equal(2, d.Stock.UnpricedUnits);
    }
}
