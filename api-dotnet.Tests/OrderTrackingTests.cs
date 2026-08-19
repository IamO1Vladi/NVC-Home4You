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

// Order tracking (ROADMAP #27) and the Sale→Purchase merge that had to happen first.
//
// The rules with teeth are all about what the CUSTOMER can reach: the code in the URL is
// the only credential, so the public payload must carry a status and dates and nothing
// else, a revoked link must die, and an unknown code must be indistinguishable from a
// revoked one.
public class OrderTrackingTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"orders-{Guid.NewGuid()}")
            .Options);

    private static CancellationToken Ct => CancellationToken.None;

    private static async Task<Purchase> SeedAsync(AppDbContext db, string status = OrderStatuses.Fabricating)
    {
        var customer = new Customer { Name = "Иван Петров", PersonalId = "7501011000" };
        var factory = new Factory { Name = "Bursa Prefab" };
        var house = new House { Title = "Разгъваема къща 58м²", CategoryKey = "prefab" };
        db.AddRange(customer, factory, house);
        await db.SaveChangesAsync();

        var purchase = new Purchase
        {
            CustomerId = customer.Id, FactoryId = factory.Id, HouseId = house.Id,
            CategoryKey = "prefab", Quantity = 1,
            DepositPaid = 5_000m, FinalPrice = 24_900m, Currency = "EUR",
            PurchasedAt = new DateTimeOffset(2026, 6, 1, 0, 0, 0, TimeSpan.Zero),
            Status = status,
        };
        db.Purchases.Add(purchase);
        await db.SaveChangesAsync();
        return purchase;
    }

    // --- The merge --------------------------------------------------------------------

    [Fact]
    public void Unit_price_is_derived_from_the_total_never_stored_beside_it()
    {
        // Sale brought a quantity across; FinalPrice stays the TOTAL, so the unit price is
        // arithmetic. Two stored price columns is the drift this schema refuses everywhere.
        Assert.Equal(12_450m, CustomerAdminService.UnitPrice(24_900m, 2));
        Assert.Equal(24_900m, CustomerAdminService.UnitPrice(24_900m, 1));

        // No agreed price is not a price of zero — the same reasoning as LeftToPay.
        Assert.Null(CustomerAdminService.UnitPrice(null, 2));
        // And a nonsense quantity refuses rather than dividing by zero.
        Assert.Null(CustomerAdminService.UnitPrice(24_900m, 0));
    }

    [Fact]
    public void Sale_expenses_sum_the_four_columns_inherited_from_Sale()
    {
        var p = new Purchase { PaymentFees = 120m, TransportCost = 250m, InstallationCost = 800m };

        // A null column is "not recorded", and contributes nothing rather than breaking
        // the sum.
        Assert.Equal(1_170m, CustomerAdminService.SaleExpenses(p));
        Assert.Equal(0m, CustomerAdminService.SaleExpenses(new Purchase()));
    }

    // --- The staff board / the owner's report -----------------------------------------

    [Fact]
    public async Task The_board_row_is_the_report_the_owner_asked_for()
    {
        using var db = NewDb();
        await SeedAsync(db);

        var row = (await new OrderTrackingService(db).ListAsync(null, Ct)).Single();

        // Customer, model, deposit, final price, left to pay, factory — in one row.
        Assert.Equal("Иван Петров", row.CustomerName);
        Assert.Equal("Разгъваема къща 58м²", row.Model);
        Assert.Equal(5_000m, row.DepositPaid);
        Assert.Equal(24_900m, row.FinalPrice);
        Assert.Equal(19_900m, row.LeftToPay);
        Assert.Equal("Bursa Prefab", row.FactoryName);
    }

    [Fact]
    public async Task The_board_can_be_filtered_but_never_silently_drops_finished_business()
    {
        using var db = NewDb();
        await SeedAsync(db, OrderStatuses.Delivered);
        await SeedAsync(db, OrderStatuses.Travelling);
        var svc = new OrderTrackingService(db);

        // Unfiltered includes delivered: this doubles as the report, and a report that
        // hides finished orders answers "what did we sell?" wrongly.
        Assert.Equal(2, (await svc.ListAsync(null, Ct)).Count);
        Assert.Single(await svc.ListAsync(OrderStatuses.Travelling, Ct));

        // An unrecognised filter is ignored rather than returning nothing — a typo in a
        // query string should not look like an empty business.
        Assert.Equal(2, (await svc.ListAsync("nonsense", Ct)).Count);
    }

    // --- The customer's link ------------------------------------------------------------

    [Fact]
    public async Task Minting_a_reference_is_idempotent_so_one_order_has_one_link()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db);
        var svc = new OrderTrackingService(db);

        var first = await svc.EnsureReferenceAsync(purchase.Id, Ct);
        var second = await svc.EnsureReferenceAsync(purchase.Id, Ct);

        Assert.False(string.IsNullOrWhiteSpace(first));
        Assert.Equal(first, second);
        // Long enough not to be guessed, and from an alphabet with no l/I/1/0/O in it —
        // these get read down a phone.
        Assert.Equal(10, first!.Length);
        Assert.DoesNotContain(first, c => "lI10O".Contains(c));
    }

    [Fact]
    public async Task A_revoked_link_stops_resolving_and_looks_exactly_like_a_wrong_one()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db);
        var svc = new OrderTrackingService(db);

        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);
        Assert.NotNull(await svc.PublicAsync(code, Ct));

        Assert.True(await svc.RevokeReferenceAsync(purchase.Id, Ct));

        // Revoked and never-existed are the same answer — telling them apart would tell a
        // stranger which codes once existed.
        Assert.Null(await svc.PublicAsync(code, Ct));
        Assert.Null(await svc.PublicAsync("neverexisted", Ct));

        // The order itself is untouched; only the URL died.
        Assert.NotNull(await db.Purchases.FindAsync(purchase.Id));
    }

    [Fact]
    public async Task A_short_or_absurd_code_is_refused_without_touching_the_database()
    {
        using var db = NewDb();
        var svc = new OrderTrackingService(db);

        Assert.Null(await svc.PublicAsync("", Ct));
        Assert.Null(await svc.PublicAsync("abc", Ct));
        Assert.Null(await svc.PublicAsync(new string('x', 64), Ct));
        Assert.Null(await svc.PublicAsync(null, Ct));
    }

    // --- What the customer can and cannot see -------------------------------------------

    [Fact]
    public async Task The_public_payload_carries_no_money_and_no_identity()
    {
        // THE test for this feature. The DTO is a different type from the board's row on
        // purpose, so this is a check that the type stayed honest rather than that someone
        // remembered to blank a field.
        using var db = NewDb();
        var purchase = await SeedAsync(db);
        var svc = new OrderTrackingService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);

        var view = await svc.PublicAsync(code, Ct);

        Assert.NotNull(view);
        Assert.Equal("Разгъваема къща 58м²", view!.Model);
        Assert.Equal(OrderStatuses.Fabricating, view.Status);

        var fields = view.GetType().GetProperties().Select(p => p.Name).ToList();
        foreach (var forbidden in new[]
                 {
                     "FinalPrice", "DepositPaid", "LeftToPay", "Currency", "PaymentFees",
                     "CustomerName", "CustomerId", "PersonalId", "Notes", "TrackingReference",
                 })
        {
            Assert.DoesNotContain(forbidden, fields);
        }
    }

    [Fact]
    public async Task The_carrier_block_appears_only_while_the_goods_are_in_transit()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.Travelling);
        purchase.CarrierName = "Maersk";
        purchase.CarrierNote = "Left Singapore";
        purchase.CarrierCheckedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        var svc = new OrderTrackingService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);

        var travelling = await svc.PublicAsync(code, Ct);
        Assert.Equal("Maersk", travelling!.CarrierName);
        Assert.Equal("Left Singapore", travelling.CarrierNote);

        // Delivered: the same stored words, withheld. A carrier note lingering on a
        // delivered order is a wrong answer, not just clutter.
        purchase.Status = OrderStatuses.Delivered;
        await db.SaveChangesAsync();

        var delivered = await svc.PublicAsync(code, Ct);
        Assert.Null(delivered!.CarrierName);
        Assert.Null(delivered.CarrierNote);
        Assert.Null(delivered.CarrierCheckedAt);
    }

    [Fact]
    public async Task The_timeline_places_the_order_and_keeps_cancelled_off_it()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.Travelling);
        var svc = new OrderTrackingService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);

        var view = await svc.PublicAsync(code, Ct);
        Assert.Equal(OrderStatuses.Timeline.ToList().IndexOf(OrderStatuses.Travelling), view!.Step);
        Assert.DoesNotContain(OrderStatuses.Cancelled, view.Timeline);

        // Cancelled is off the timeline entirely: -1 rather than a plausible 0, so the page
        // has to handle "not a step" instead of drawing it as step one.
        purchase.Status = OrderStatuses.Cancelled;
        await db.SaveChangesAsync();
        Assert.Equal(-1, (await svc.PublicAsync(code, Ct))!.Step);
    }

    // --- Writing the order along --------------------------------------------------------

    [Fact]
    public async Task An_unknown_status_is_ignored_rather_than_stored()
    {
        // The public timeline draws from this key; a typo stored here would render as no
        // step at all on the customer's page.
        using var db = NewDb();
        var purchase = await SeedAsync(db);
        var svc = new OrderTrackingService(db);

        await svc.UpdateOrderAsync(purchase.Id, new OrderUpdateInput { Status = "somewhere-else" }, null, Ct);

        var after = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchase.Id);
        Assert.Equal(OrderStatuses.Fabricating, after.Status);
    }

    [Fact]
    public async Task Changing_the_carrier_note_stamps_when_it_was_true()
    {
        // The stale-information guard: "as of" is never something a person has to remember
        // to update, because it moves with the text.
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.Travelling);
        var svc = new OrderTrackingService(db);

        await svc.UpdateOrderAsync(purchase.Id,
            new OrderUpdateInput { Status = OrderStatuses.Travelling, CarrierNote = "Left Singapore" }, null, Ct);

        var stamped = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchase.Id);
        Assert.NotNull(stamped.CarrierCheckedAt);

        // Clearing the note clears the stamp — an "as of" with nothing to date is worse
        // than none.
        await svc.UpdateOrderAsync(purchase.Id,
            new OrderUpdateInput { Status = OrderStatuses.Travelling, CarrierNote = null }, null, Ct);

        var cleared = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchase.Id);
        Assert.Null(cleared.CarrierCheckedAt);
    }
}
