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

// The billing services against a real DbContext (ROADMAP #21).
//
// The InMemory provider does not enforce unique indexes, so nothing here is a test of the
// database constraint on Target — it tests that the SERVICE finds the existing row and
// updates it, which is the behaviour that keeps the constraint from ever being hit. Both
// halves matter: the index is the backstop, this is the path.
public class BillingStoreTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"billing-{Guid.NewGuid()}")
            .Options);

    private const string Actor = "vladi@nvc-home4you.eu";
    private static CancellationToken Ct => CancellationToken.None;

    private static async Task<int> SeedCycleAsync(
        AppDbContext db, decimal? markup = 2.7m, decimal? vat = 0.20m, string label = "2026 C1")
    {
        var cycle = new BuyCycle { Label = label, MarkupCoefficient = markup, BorderVatRate = vat };
        db.BuyCycles.Add(cycle);
        await db.SaveChangesAsync();
        return cycle.Id;
    }

    // --- Cycles --------------------------------------------------------------------------

    [Fact]
    public async Task A_new_cycle_inherits_the_previous_coefficients()
    {
        using var db = NewDb();
        await SeedCycleAsync(db, markup: 2.7m, vat: 0.20m);

        var svc = new BuyCycleAdminService(db);
        var created = await svc.CreateAsync(new BuyCycleInput { Label = "2026 C2" }, Actor, Ct);

        // Prefilled rather than blank: a cycle with no markup prices nothing at all, and the
        // person who created it is not the one who notices the dashes.
        Assert.Equal(2.7m, created.MarkupCoefficient);
        Assert.Equal(0.20m, created.BorderVatRate);
    }

    [Fact]
    public async Task An_explicit_markup_is_not_overwritten_by_the_default()
    {
        using var db = NewDb();
        await SeedCycleAsync(db, markup: 2.7m, vat: 0.20m);

        var svc = new BuyCycleAdminService(db);
        var created = await svc.CreateAsync(
            new BuyCycleInput { Label = "2026 C2", MarkupCoefficient = 3.1m }, Actor, Ct);

        Assert.Equal(3.1m, created.MarkupCoefficient);

        // And the VAT is NOT carried across on its own — a cycle priced with this year's
        // markup and last year's VAT is a combination nobody chose.
        Assert.Null(created.BorderVatRate);
    }

    [Fact]
    public async Task A_cycle_with_shipments_against_it_refuses_to_be_deleted()
    {
        using var db = NewDb();
        var cycleId = await SeedCycleAsync(db);
        db.Shipments.Add(new Shipment { BuyCycleId = cycleId, Reference = "MSKU-1" });
        await db.SaveChangesAsync();

        var (outcome, shipments, _) = await new BuyCycleAdminService(db).DeleteAsync(cycleId, Ct);

        // Refused with a count rather than cascaded — the rows that would go are containers.
        Assert.Equal(BuyCycleAdminService.DeleteOutcome.InUse, outcome);
        Assert.Equal(1, shipments);
        Assert.NotNull(await db.BuyCycles.FindAsync(cycleId));
    }

    [Fact]
    public async Task An_empty_cycle_can_be_deleted()
    {
        using var db = NewDb();
        var cycleId = await SeedCycleAsync(db);

        var (outcome, _, _) = await new BuyCycleAdminService(db).DeleteAsync(cycleId, Ct);

        Assert.Equal(BuyCycleAdminService.DeleteOutcome.Deleted, outcome);
    }

    // --- Lots ----------------------------------------------------------------------------

    [Fact]
    public async Task A_lot_snapshots_the_factory_price_and_keeps_it()
    {
        using var db = NewDb();
        var cycleId = await SeedCycleAsync(db);

        var model = new ProductModel { Name = "Expandable 58", FactoryPrice = 9_000m };
        db.ProductModels.Add(model);
        var shipment = new Shipment { BuyCycleId = cycleId };
        db.Shipments.Add(shipment);
        await db.SaveChangesAsync();

        var shipments = new ShipmentAdminService(db);
        await shipments.AddLotAsync(
            shipment.Id, new PurchaseLotInput { ProductModelId = model.Id, Quantity = 2 }, Actor, Ct);

        // The factory raises its price a year later.
        model.FactoryPrice = 11_000m;
        await db.SaveChangesAsync();

        var after = await shipments.GetAsync(shipment.Id, Ct);

        // THE point of PurchaseLot.UnitCost. Reading the price live from the model instead
        // would silently reprice every container ever bought, and last year's margin report
        // would change with nobody editing last year's data.
        Assert.Equal(9_000m, after!.Lots.Single().UnitCost);
        Assert.Equal(18_000m, after.Lots.Single().LineTotalUsd);
    }

    [Fact]
    public async Task Editing_a_line_re_costs_every_other_line_on_the_container()
    {
        using var db = NewDb();
        var cycleId = await SeedCycleAsync(db);

        var house = new ProductModel { Name = "House", FactoryPrice = 10_000m };
        var fittings = new ProductModel { Name = "Fittings", FactoryPrice = 100m };
        db.ProductModels.AddRange(house, fittings);
        var shipment = new Shipment { BuyCycleId = cycleId, FreightCost = 1_100m };
        db.Shipments.Add(shipment);
        await db.SaveChangesAsync();

        var svc = new ShipmentAdminService(db);
        await svc.AddLotAsync(shipment.Id,
            new PurchaseLotInput { ProductModelId = house.Id, Quantity = 1, UnitCost = 10_000m }, Actor, Ct);
        var withBoth = await svc.AddLotAsync(shipment.Id,
            new PurchaseLotInput { ProductModelId = fittings.Id, Quantity = 10, UnitCost = 100m }, Actor, Ct);

        var houseLot = withBoth!.Lots.Single(l => l.ProductModelId == house.Id);
        Assert.Equal(11_000m, houseLot.UnitLandedCostUsd);

        // Remove the fittings and the house now carries ALL the freight. This is why every
        // write returns the whole shipment rather than the edited row.
        var fittingsLotId = withBoth.Lots.Single(l => l.ProductModelId == fittings.Id).Id;
        var afterDelete = await svc.DeleteLotAsync(fittingsLotId, Ct);

        Assert.Equal(11_100m, afterDelete!.Lots.Single().UnitLandedCostUsd);
    }

    [Fact]
    public async Task Deleting_a_container_takes_its_lines_with_it()
    {
        using var db = NewDb();
        var cycleId = await SeedCycleAsync(db);

        var model = new ProductModel { Name = "House" };
        db.ProductModels.Add(model);
        var shipment = new Shipment { BuyCycleId = cycleId };
        db.Shipments.Add(shipment);
        await db.SaveChangesAsync();

        var svc = new ShipmentAdminService(db);
        await svc.AddLotAsync(shipment.Id,
            new PurchaseLotInput { ProductModelId = model.Id, Quantity = 1, UnitCost = 1m }, Actor, Ct);

        Assert.True(await svc.DeleteAsync(shipment.Id, Ct));

        // The only Cascade in these tables, and it is safe because a lot has no meaning
        // apart from the container it rode in. The model itself survives.
        Assert.Empty(db.PurchaseLots.ToList());
        Assert.NotNull(await db.ProductModels.FindAsync(model.Id));
    }

    [Fact]
    public async Task A_model_named_by_a_lot_refuses_to_be_deleted()
    {
        using var db = NewDb();
        var cycleId = await SeedCycleAsync(db);

        var model = new ProductModel { Name = "House" };
        db.ProductModels.Add(model);
        var shipment = new Shipment { BuyCycleId = cycleId };
        db.Shipments.Add(shipment);
        await db.SaveChangesAsync();

        await new ShipmentAdminService(db).AddLotAsync(
            shipment.Id, new PurchaseLotInput { ProductModelId = model.Id, Quantity = 1, UnitCost = 1m }, Actor, Ct);

        var (outcome, lots) = await new ProductModelAdminService(db).DeleteAsync(model.Id, Ct);

        Assert.Equal(ProductModelAdminService.DeleteOutcome.InUse, outcome);
        Assert.Equal(1, lots);
    }

    // --- Models and the gallery link -----------------------------------------------------

    [Fact]
    public async Task A_model_reads_retail_through_the_gallery_rather_than_storing_it()
    {
        using var db = NewDb();

        var house = new House { Title = "Expandable 58", Price = 24_900m, Currency = "EUR", CategoryKey = "prefab" };
        db.Houses.Add(house);
        await db.SaveChangesAsync();

        var svc = new ProductModelAdminService(db);
        var model = await svc.CreateAsync(
            new ProductModelInput { Name = "Expandable 58", HouseId = house.Id, FactoryPrice = 9_000m },
            Actor, Ct);

        // Cost here, retail on the gallery row, one place each. Two free-standing price
        // lists is the 73 m² incident.
        Assert.Equal(9_000m, model.FactoryPrice);
        Assert.Equal(24_900m, model.RetailPrice);
        Assert.Equal("Expandable 58", model.HouseTitle);

        // And correcting the gallery price moves the model's retail with it, because there
        // is nothing here to go stale.
        house.Price = 25_900m;
        await db.SaveChangesAsync();

        Assert.Equal(25_900m, (await svc.GetAsync(model.Id, Ct))!.RetailPrice);
    }

    [Fact]
    public async Task A_second_model_on_one_house_is_flagged_but_allowed()
    {
        using var db = NewDb();

        var house = new House { Title = "Expandable 58", CategoryKey = "prefab" };
        db.Houses.Add(house);
        await db.SaveChangesAsync();

        var svc = new ProductModelAdminService(db);
        var first = await svc.CreateAsync(
            new ProductModelInput { Name = "From factory A", HouseId = house.Id }, Actor, Ct);
        var second = await svc.CreateAsync(
            new ProductModelInput { Name = "From factory B", HouseId = house.Id }, Actor, Ct);

        // Legitimate — the same model from two factories at two prices is what this table is
        // for — so it is a warning, not a unique index. What it prevents is making the
        // second one by accident and then wondering which cost the margin report used.
        Assert.True(await svc.HouseLinkExistsAsync(house.Id, second.Id, Ct));
        Assert.NotEqual(first.Id, second.Id);
    }

    // --- Targets -------------------------------------------------------------------------

    [Fact]
    public async Task Setting_the_same_target_twice_updates_it_in_place()
    {
        using var db = NewDb();
        var svc = new TargetAdminService(db);

        var input = new TargetInput
        {
            PeriodType = PeriodTypes.Month,
            Year = 2026, Month = 8,
            MetricKey = TargetMetrics.Revenue,
            TargetValue = 250_000m,
        };

        var (firstOutcome, _) = await svc.SetAsync(input, Actor, Ct);
        Assert.Equal(TargetAdminService.SaveOutcome.Created, firstOutcome);

        input.TargetValue = 275_000m;
        var (secondOutcome, updated) = await svc.SetAsync(input, Actor, Ct);

        // One target per metric per period. Two rows would leave the dashboard choosing, and
        // there is no correct way to choose.
        Assert.Equal(TargetAdminService.SaveOutcome.Updated, secondOutcome);
        Assert.Equal(275_000m, updated.TargetValue);
        Assert.Single(db.Targets.ToList());
    }

    [Fact]
    public async Task Different_metrics_in_one_month_are_different_targets()
    {
        using var db = NewDb();
        var svc = new TargetAdminService(db);

        foreach (var metric in new[] { TargetMetrics.Revenue, TargetMetrics.GrossMargin })
        {
            await svc.SetAsync(new TargetInput
            {
                PeriodType = PeriodTypes.Month,
                Year = 2026, Month = 8,
                MetricKey = metric,
                TargetValue = 100_000m,
            }, Actor, Ct);
        }

        Assert.Equal(2, db.Targets.Count());
    }

    [Fact]
    public async Task A_stray_period_column_is_blanked_rather_than_stored()
    {
        using var db = NewDb();
        var svc = new TargetAdminService(db);

        // A month left over from the form the person was previously on. Stored, it would put
        // the target in a slot no cycle lookup ever matches.
        var (_, target) = await svc.SetAsync(new TargetInput
        {
            PeriodType = PeriodTypes.Cycle,
            BuyCycleId = await SeedCycleAsync(db),
            Month = 8,
            Year = 2026,
            MetricKey = TargetMetrics.GrossMargin,
            TargetValue = 90_000m,
        }, Actor, Ct);

        Assert.Null(target.Month);
        Assert.Null(target.Year);
        Assert.NotNull(target.BuyCycleId);
    }

    // --- Expenses ------------------------------------------------------------------------

    [Fact]
    public async Task The_expense_window_includes_its_closing_day()
    {
        using var db = NewDb();
        var svc = new OperatingExpenseAdminService(db);

        foreach (var day in new[] { "2026-08-01", "2026-08-31", "2026-09-01" })
        {
            await svc.CreateAsync(
                new OperatingExpenseInput { SpentAt = day, Amount = 100m, CategoryKey = ExpenseCategories.Rent },
                Actor, Ct);
        }

        var august = await svc.ListAsync(
            new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero),
            null, Ct);

        // The off-by-one that would quietly drop the last day of every month — and the last
        // day of a month is exactly when rent and salaries get dated.
        Assert.Equal(2, august.Count);
        Assert.Contains(august, e => e.SpentAt == "2026-08-31");
    }

    [Fact]
    public async Task Uncategorised_expenses_still_appear_in_the_breakdown()
    {
        using var db = NewDb();
        var svc = new OperatingExpenseAdminService(db);

        await svc.CreateAsync(
            new OperatingExpenseInput { SpentAt = "2026-08-01", Amount = 500m, CategoryKey = ExpenseCategories.Rent },
            Actor, Ct);
        await svc.CreateAsync(
            new OperatingExpenseInput { SpentAt = "2026-08-02", Amount = 120m },
            Actor, Ct);

        var byCategory = await svc.ByCategoryAsync(null, null, Ct);

        // The parts must add up to the whole. A breakdown that silently omits a category is
        // how a month's costs come out lower than they were.
        Assert.Equal(620m, byCategory.Sum(r => r.Total));
        Assert.Contains(byCategory, r => r.Key == "uncategorised" && r.Total == 120m);
    }

    [Fact]
    public async Task Submitted_by_is_stamped_once_and_survives_someone_elses_edit()
    {
        using var db = NewDb();
        var svc = new OperatingExpenseAdminService(db);

        var created = await svc.CreateAsync(
            new OperatingExpenseInput { SpentAt = "2026-08-01", Amount = 100m }, "nlekov@nvc-home4you.eu", Ct);

        var edited = await svc.UpdateAsync(
            created.Id, new OperatingExpenseInput { SpentAt = "2026-08-01", Amount = 110m }, Actor, Ct);

        // "Who submitted this" and "who last touched it" are different questions, and the
        // column the field-builder app will write must not be rewritten by an office edit.
        Assert.Equal("nlekov@nvc-home4you.eu", edited!.SubmittedByUpn);
        Assert.Equal(Actor, edited.UpdatedByUpn);
    }

    [Fact]
    public async Task Monthly_totals_come_back_oldest_first()
    {
        using var db = NewDb();
        var svc = new OperatingExpenseAdminService(db);

        foreach (var day in new[] { "2026-09-03", "2026-07-11", "2026-08-20" })
        {
            await svc.CreateAsync(new OperatingExpenseInput { SpentAt = day, Amount = 100m }, Actor, Ct);
        }

        var byMonth = await svc.ByMonthAsync(null, null, Ct);

        Assert.Equal(new[] { "2026-07", "2026-08", "2026-09" }, byMonth.Select(r => r.Key).ToArray());
    }
}
