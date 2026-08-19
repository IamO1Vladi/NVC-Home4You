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

// The sell side of the procurement ledger (ROADMAP #21 phase 2).
//
// What is pinned here is the stock arithmetic and the money chain: a sale draws a lot
// down, an oversell is refused with the number the person needs, COGS comes from the
// landed cost of the exact container line the goods rode in — and every delete that would
// orphan a sale's cost basis is refused.
public class SaleStoreTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"sales-{Guid.NewGuid()}")
            .Options);

    private const string Actor = "vladi@nvc-home4you.eu";
    private static CancellationToken Ct => CancellationToken.None;

    /// <summary>One cycle, one container with a rate, one lot of 5 at $10,000 — the fixture.</summary>
    private static async Task<(int LotId, int ShipmentId)> SeedAsync(AppDbContext db)
    {
        var cycle = new BuyCycle { Label = "2024-2026", MarkupCoefficient = 2.7m, BorderVatRate = 0.20m };
        var model = new ProductModel { Name = "Expandable 58", FactoryPrice = 10_000m };
        var shipment = new Shipment
        {
            BuyCycle = cycle, Reference = "MSKU-1",
            FreightCost = 2_000m, CustomsDuty = 500m, UsdToEurRate = 0.9m,
        };
        var lot = new PurchaseLot { Shipment = shipment, ProductModel = model, Quantity = 5, UnitCost = 10_000m };
        db.AddRange(cycle, model, shipment, lot);
        await db.SaveChangesAsync();
        return (lot.Id, shipment.Id);
    }

    private static SaleInput Sale(int lotId, int qty = 1, decimal price = 15_000m) => new()
    {
        PurchaseLotId = lotId, SoldAt = "2026-08-10", Quantity = qty, UnitSalePrice = price,
    };

    [Fact]
    public async Task A_sale_computes_its_money_from_the_container_it_came_off()
    {
        using var db = NewDb();
        var (lotId, _) = await SeedAsync(db);
        var svc = new SaleAdminService(db);

        var (outcome, _, sale) = await svc.CreateAsync(new SaleInput
        {
            PurchaseLotId = lotId, SoldAt = "2026-08-10", Quantity = 1, UnitSalePrice = 15_000m,
            PaymentFees = 100m, TransportCost = 200m,
        }, Actor, Ct);

        Assert.Equal(SaleAdminService.SaveOutcome.Saved, outcome);

        // One lot carries the whole shipment: landed = (5×10,000 + 2,500)/5 = $10,500/unit,
        // ×0.9 = €9,450. Amount €15,000; expenses €300; gross €5,550; net €5,250.
        Assert.Equal(15_000m, sale!.SaleAmountEur);
        Assert.Equal(300m, sale.SaleExpensesEur);
        Assert.Equal(9_450m, sale.CogsEur);
        Assert.Equal(5_550m, sale.GrossProfitEur);
        Assert.Equal(5_250m, sale.NetProfitEur);
    }

    [Fact]
    public async Task No_container_rate_means_no_cogs_and_no_profit_claims()
    {
        using var db = NewDb();
        var (lotId, shipmentId) = await SeedAsync(db);
        var shipment = await db.Shipments.FirstAsync(s => s.Id == shipmentId);
        shipment.UsdToEurRate = null;
        await db.SaveChangesAsync();

        var svc = new SaleAdminService(db);
        var (_, _, sale) = await svc.CreateAsync(Sale(lotId), Actor, Ct);

        // Revenue is known — the sale is EUR-native. Cost is not, so profit stays silent
        // rather than pretending the goods were free.
        Assert.Equal(15_000m, sale!.SaleAmountEur);
        Assert.Null(sale.CogsEur);
        Assert.Null(sale.GrossProfitEur);
        Assert.Null(sale.NetProfitEur);
    }

    [Fact]
    public async Task Selling_more_than_the_lot_holds_is_refused_with_the_number_left()
    {
        using var db = NewDb();
        var (lotId, _) = await SeedAsync(db);
        var svc = new SaleAdminService(db);

        await svc.CreateAsync(Sale(lotId, qty: 3), Actor, Ct);

        var (outcome, available, _) = await svc.CreateAsync(Sale(lotId, qty: 3), Actor, Ct);

        Assert.Equal(SaleAdminService.SaveOutcome.Oversold, outcome);
        Assert.Equal(2, available);
        Assert.Single(db.Sales.ToList());
    }

    [Fact]
    public async Task An_edit_does_not_count_its_own_units_against_itself()
    {
        using var db = NewDb();
        var (lotId, _) = await SeedAsync(db);
        var svc = new SaleAdminService(db);

        var (_, _, first) = await svc.CreateAsync(Sale(lotId, qty: 4), Actor, Ct);

        // 4 of 5 are this sale's own; raising it to 5 is legitimate.
        var (outcome, _, updated) = await svc.UpdateAsync(first!.Id, Sale(lotId, qty: 5), Actor, Ct);

        Assert.Equal(SaleAdminService.SaveOutcome.Saved, outcome);
        Assert.Equal(5, updated!.Quantity);

        // But 6 is not.
        var (refused, available, _) = await svc.UpdateAsync(first.Id, Sale(lotId, qty: 6), Actor, Ct);
        Assert.Equal(SaleAdminService.SaveOutcome.Oversold, refused);
        Assert.Equal(5, available);
    }

    [Fact]
    public async Task Deleting_a_sale_puts_the_units_back()
    {
        using var db = NewDb();
        var (lotId, _) = await SeedAsync(db);
        var svc = new SaleAdminService(db);

        var (_, _, sale) = await svc.CreateAsync(Sale(lotId, qty: 5), Actor, Ct);

        // Sold out — nothing more fits.
        var (refused, _, _) = await svc.CreateAsync(Sale(lotId, qty: 1), Actor, Ct);
        Assert.Equal(SaleAdminService.SaveOutcome.Oversold, refused);

        Assert.True(await svc.DeleteAsync(sale!.Id, Ct));

        // The mis-entry is gone and the yard is full again.
        var (again, _, _) = await svc.CreateAsync(Sale(lotId, qty: 5), Actor, Ct);
        Assert.Equal(SaleAdminService.SaveOutcome.Saved, again);
    }

    [Fact]
    public async Task Stock_shows_on_the_container_line_and_on_the_model()
    {
        using var db = NewDb();
        var (lotId, shipmentId) = await SeedAsync(db);
        await new SaleAdminService(db).CreateAsync(Sale(lotId, qty: 2), Actor, Ct);

        var line = (await new ShipmentAdminService(db).GetAsync(shipmentId, Ct))!.Lots.Single();
        Assert.Equal(2, line.QtySold);
        Assert.Equal(3, line.QtyOnHand);

        var model = (await new ProductModelAdminService(db).ListAsync(Ct)).Single();
        Assert.Equal(5, model.PurchasedQty);
        Assert.Equal(2, model.SoldQty);
        Assert.Equal(3, model.OnHandQty);
    }

    [Fact]
    public async Task A_lot_with_sales_refuses_deletion_and_so_does_its_container()
    {
        using var db = NewDb();
        var (lotId, shipmentId) = await SeedAsync(db);
        await new SaleAdminService(db).CreateAsync(Sale(lotId), Actor, Ct);

        var shipments = new ShipmentAdminService(db);

        // The line: its sales' COGS is computed FROM it.
        var (_, lotSales) = await shipments.DeleteLotAsync(lotId, Ct);
        Assert.Equal(1, lotSales);
        Assert.NotNull(await db.PurchaseLots.FindAsync(lotId));

        // The whole container: same money, one level up.
        var (deleted, shipSales) = await shipments.DeleteAsync(shipmentId, Ct);
        Assert.False(deleted);
        Assert.Equal(1, shipSales);
    }

    [Fact]
    public async Task The_lot_options_say_how_many_each_line_still_holds()
    {
        using var db = NewDb();
        var (lotId, _) = await SeedAsync(db);
        var svc = new SaleAdminService(db);
        await svc.CreateAsync(Sale(lotId, qty: 2), Actor, Ct);

        var option = (await svc.LotOptionsAsync(Ct)).Single();

        Assert.Equal(5, option.QtyPurchased);
        Assert.Equal(2, option.QtySold);
        Assert.Equal(3, option.QtyOnHand);
        Assert.Equal("Expandable 58", option.ProductModelName);
    }

    [Fact]
    public async Task Zero_price_is_a_warranty_replacement_not_an_error()
    {
        using var db = NewDb();
        var (lotId, _) = await SeedAsync(db);

        Assert.Empty(SaleAdminService.Validate(Sale(lotId, qty: 1, price: 0m)));

        var (outcome, _, sale) = await new SaleAdminService(db)
            .CreateAsync(Sale(lotId, qty: 1, price: 0m), Actor, Ct);

        // It leaves stock without earning — which is exactly what its numbers say.
        Assert.Equal(SaleAdminService.SaveOutcome.Saved, outcome);
        Assert.Equal(0m, sale!.SaleAmountEur);
        Assert.True(sale.NetProfitEur < 0m);
    }
}
