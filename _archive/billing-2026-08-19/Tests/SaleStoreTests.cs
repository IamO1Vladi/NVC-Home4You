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

// Sales to customers, after the buy side was archived (2026-08-19).
//
// What survives from the procurement version of these tests is the part that was never
// about procurement: a sale is money, so its arithmetic is computed rather than stored, and
// what it cannot know it does not claim. COGS, stock and margin left with the container
// lines — see _archive/billing-2026-08-19/.
public class SaleStoreTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"sales-{Guid.NewGuid()}")
            .Options);

    private const string Actor = "vladi@nvc-home4you.eu";
    private static CancellationToken Ct => CancellationToken.None;

    private static async Task<int> SeedCustomerAsync(AppDbContext db, string name = "Иван Петров")
    {
        var customer = new Customer { Name = name };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        return customer.Id;
    }

    private static SaleInput Sale(int customerId, int qty = 1, decimal price = 24_900m) => new()
    {
        CustomerId = customerId, SoldAt = "2026-08-10", Quantity = qty, UnitSalePrice = price,
        Description = "Разгъваема къща 58м²",
    };

    [Fact]
    public async Task A_sale_computes_its_amount_and_its_own_costs()
    {
        using var db = NewDb();
        var customerId = await SeedCustomerAsync(db);
        var svc = new SaleAdminService(db);

        var created = await svc.CreateAsync(new SaleInput
        {
            CustomerId = customerId, SoldAt = "2026-08-10", Quantity = 2, UnitSalePrice = 4_000m,
            PaymentFees = 100m, TransportCost = 200m,
        }, Actor, Ct);

        // Nothing here is stored — amount is qty × price, expenses are their own sum, and
        // net is the difference. Same rule as Purchase.LeftToPay.
        Assert.Equal(8_000m, created.SaleAmountEur);
        Assert.Equal(300m, created.SaleExpensesEur);
        Assert.Equal(7_700m, created.NetEur);
        Assert.Equal("Иван Петров", created.CustomerName);
    }

    [Fact]
    public async Task The_customer_is_required_for_anything_typed_from_here_on()
    {
        // The column stays nullable for the 30 rows imported from Quickbase, which point at
        // a customer table ours was never imported from. New sales must name one.
        using var db = NewDb();
        var customerId = await SeedCustomerAsync(db);

        Assert.Contains(
            SaleAdminService.Validate(new SaleInput { SoldAt = "2026-08-10", Quantity = 1, UnitSalePrice = 100m }),
            e => e.Contains("customer"));

        Assert.Empty(SaleAdminService.Validate(Sale(customerId)));
    }

    [Fact]
    public async Task An_imported_sale_keeps_its_history_without_a_customer_link()
    {
        // What the archive left behind: a real revenue row whose customer is a NAME in the
        // notes. It must list, and it must not pretend to a link it does not have.
        using var db = NewDb();
        db.Sales.Add(new Sale
        {
            QuickbaseRecordId = 3,
            SoldAt = new DateTimeOffset(2026, 7, 2, 0, 0, 0, TimeSpan.Zero),
            Quantity = 2, UnitSalePrice = 4_000m,
            Notes = "Импортирана от Quickbase (rid 3). Клиент по Quickbase: Мария Иванова.",
        });
        await db.SaveChangesAsync();

        var row = (await new SaleAdminService(db).ListAsync(null, Ct)).Single();

        Assert.Null(row.CustomerId);
        Assert.Null(row.CustomerName);
        Assert.Equal(8_000m, row.SaleAmountEur);
        Assert.Contains("Мария Иванова", row.Notes);
    }

    [Fact]
    public async Task Sales_can_be_read_for_one_customer()
    {
        using var db = NewDb();
        var mine = await SeedCustomerAsync(db, "Иван Петров");
        var theirs = await SeedCustomerAsync(db, "Мария Иванова");
        var svc = new SaleAdminService(db);

        await svc.CreateAsync(Sale(mine), Actor, Ct);
        await svc.CreateAsync(Sale(theirs, qty: 3), Actor, Ct);

        var forMine = await svc.ListAsync(mine, Ct);

        Assert.Single(forMine);
        Assert.Equal("Иван Петров", forMine[0].CustomerName);
        Assert.Equal(2, (await svc.ListAsync(null, Ct)).Count);
    }

    [Fact]
    public async Task Zero_price_is_a_warranty_replacement_not_an_error()
    {
        using var db = NewDb();
        var customerId = await SeedCustomerAsync(db);

        Assert.Empty(SaleAdminService.Validate(Sale(customerId, qty: 1, price: 0m)));

        var created = await new SaleAdminService(db)
            .CreateAsync(new SaleInput
            {
                CustomerId = customerId, SoldAt = "2026-08-10", Quantity = 1,
                UnitSalePrice = 0m, TransportCost = 250m,
            }, Actor, Ct);

        // It leaves without earning, and costs something to deliver — which is exactly
        // what its numbers say.
        Assert.Equal(0m, created.SaleAmountEur);
        Assert.Equal(-250m, created.NetEur);
    }

    [Fact]
    public async Task A_sale_of_nothing_or_at_a_negative_price_is_refused()
    {
        using var db = NewDb();
        var customerId = await SeedCustomerAsync(db);

        Assert.NotEmpty(SaleAdminService.Validate(Sale(customerId, qty: 0)));
        Assert.NotEmpty(SaleAdminService.Validate(Sale(customerId, price: -1m)));
        Assert.NotEmpty(SaleAdminService.Validate(null));
    }

    [Fact]
    public async Task Deleting_a_sale_removes_it_and_nothing_else()
    {
        // Nothing points at a sale now that stock is gone, so the delete is plain — no
        // count to refuse on, and the customer survives it.
        using var db = NewDb();
        var customerId = await SeedCustomerAsync(db);
        var svc = new SaleAdminService(db);
        var created = await svc.CreateAsync(Sale(customerId), Actor, Ct);

        Assert.True(await svc.DeleteAsync(created.Id, Ct));

        Assert.Empty(db.Sales.ToList());
        Assert.NotNull(await db.Customers.FindAsync(customerId));
    }
}
