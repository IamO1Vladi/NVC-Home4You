using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Controllers;
using Data;
using Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
    private static AppDbContext NewDb(string? name = null) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name ?? $"orders-{Guid.NewGuid()}")
            .Options);

    private static CancellationToken Ct => CancellationToken.None;

    // The same door the gallery resolves its images through — the point of the customer's
    // photo is that it is not a second image path invented for this page.
    private static OrderTrackingService NewService(AppDbContext db)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
        }).Build();
        return new OrderTrackingService(db, new ImageUrls(new EnvConfig(cfg)));
    }

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

        var row = (await NewService(db).ListAsync(null, Ct)).Single();

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
        var svc = NewService(db);

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
        var svc = NewService(db);

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
        var svc = NewService(db);

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
        var svc = NewService(db);

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
        var svc = NewService(db);
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
                     // Added with the dated timeline: the history says WHEN a step happened
                     // and never WHO moved it. Which member of staff pressed save is an
                     // office fact, and this code is not a credential for office facts.
                     "ChangedByUpn", "LastMovedBy", "Actor", "ActorUpn",
                 })
        {
            Assert.DoesNotContain(forbidden, fields);
        }

        // And the same rule one level down, because History is where a name would most
        // plausibly be added by someone who thought the customer would like to know.
        var stepFields = typeof(PublicOrderStepDto).GetProperties().Select(p => p.Name).ToList();
        Assert.Equal(new[] { "Status", "At" }.OrderBy(x => x), stepFields.OrderBy(x => x));
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

        var svc = NewService(db);
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
        var svc = NewService(db);
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
        var svc = NewService(db);

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
        var svc = NewService(db);

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

    // --- The history of the move ---------------------------------------------------------
    //
    // There is no carrier account: a person walks every order down the timeline by hand, so
    // the only record of WHEN anything happened is the one written at the moment they press
    // save. These pin that it gets written once, that it does not get written for nothing,
    // and that the customer is shown the dates without the names.

    [Fact]
    public async Task Moving_an_order_records_one_dated_event_and_the_person_who_moved_it()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.Placed);
        var svc = NewService(db);

        await svc.UpdateOrderAsync(purchase.Id,
            new OrderUpdateInput { Status = OrderStatuses.Fabricating }, "anna@nvc.bg", Ct);

        var events = await db.OrderStatusEvents.AsNoTracking()
            .Where(e => e.PurchaseId == purchase.Id).ToListAsync();

        var moved = Assert.Single(events);
        Assert.Equal(OrderStatuses.Fabricating, moved.Status);
        Assert.Equal("anna@nvc.bg", moved.ChangedByUpn);
        Assert.NotEqual(default, moved.ChangedAt);
    }

    [Fact]
    public async Task Re_saving_the_same_status_records_nothing()
    {
        // The board saves the whole panel, so a carrier note typed on an order that is
        // still travelling re-submits the status it already had. Logging that would fill
        // the timeline with steps that never happened, and a log of no-ops is one people
        // learn to skim — which costs exactly the question this table exists to answer.
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.Travelling);
        var svc = NewService(db);

        await svc.UpdateOrderAsync(purchase.Id,
            new OrderUpdateInput { Status = OrderStatuses.Travelling, CarrierNote = "Left Singapore" },
            "anna@nvc.bg", Ct);
        await svc.UpdateOrderAsync(purchase.Id,
            new OrderUpdateInput { Status = OrderStatuses.Travelling, CarrierNote = "Passing Suez" },
            "anna@nvc.bg", Ct);

        Assert.Empty(await db.OrderStatusEvents.Where(e => e.PurchaseId == purchase.Id).ToListAsync());

        // The note still moved — only the history stayed quiet.
        var after = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchase.Id);
        Assert.Equal("Passing Suez", after.CarrierNote);
    }

    [Fact]
    public async Task An_ignored_status_leaves_no_trace_in_the_history_either()
    {
        // A typo is not a move. It is already refused on the purchase; this is the second
        // half of the same promise, because an event nobody can see the status of would
        // still date a step on the customer's page.
        using var db = NewDb();
        var purchase = await SeedAsync(db);
        var svc = NewService(db);

        await svc.UpdateOrderAsync(purchase.Id, new OrderUpdateInput { Status = "somewhere-else" }, "anna@nvc.bg", Ct);

        Assert.Empty(await db.OrderStatusEvents.ToListAsync());
    }

    [Fact]
    public async Task The_customer_is_told_when_each_step_happened_and_never_who_moved_it()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.Placed);
        var svc = NewService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);

        foreach (var next in new[] { OrderStatuses.Fabricating, OrderStatuses.Travelling, OrderStatuses.Cancelled })
            await svc.UpdateOrderAsync(purchase.Id, new OrderUpdateInput { Status = next }, "anna@nvc.bg", Ct);

        var view = await svc.PublicAsync(code, Ct);

        // Oldest first, and every step carries a date somebody actually observed.
        Assert.Equal(
            new[] { OrderStatuses.Fabricating, OrderStatuses.Travelling },
            view!.History.Select(s => s.Status));
        Assert.All(view.History, s => Assert.True(DateTimeOffset.TryParse(s.At, out _)));

        // Cancelled is off the timeline (see OrderStatuses), so it is off this list too —
        // drawn as a step it would show a stopped order as though it were still moving.
        Assert.DoesNotContain(OrderStatuses.Cancelled, view.History.Select(s => s.Status));

        // And the actor never crosses over. The staff endpoint is where the names live.
        var history = await svc.HistoryAsync(purchase.Id, Ct);
        Assert.All(history!, e => Assert.Equal("anna@nvc.bg", e.ChangedByUpn));

        // "Last touched at all", which a page with no recent step can still say.
        Assert.NotNull(view.UpdatedAt);
    }

    [Fact]
    public async Task A_status_set_twice_is_dated_by_the_later_time_not_the_first()
    {
        // The customer is reading "when did it get there", not an edit history of our
        // board: an order that was marked at-harbor, corrected back and re-marked arrived
        // on the second date.
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.AtHarbor);

        var july = new Func<int, DateTimeOffset>(day => new DateTimeOffset(2026, 7, day, 9, 0, 0, TimeSpan.Zero));
        db.OrderStatusEvents.AddRange(
            new OrderStatusEvent { PurchaseId = purchase.Id, Status = OrderStatuses.AtHarbor, ChangedAt = july(1) },
            new OrderStatusEvent { PurchaseId = purchase.Id, Status = OrderStatuses.Travelling, ChangedAt = july(5) },
            new OrderStatusEvent { PurchaseId = purchase.Id, Status = OrderStatuses.AtHarbor, ChangedAt = july(9) });
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);
        var view = await svc.PublicAsync(code, Ct);

        // One entry per status, and the surviving dates decide the order.
        Assert.Equal(
            new[] { OrderStatuses.Travelling, OrderStatuses.AtHarbor },
            view!.History.Select(s => s.Status));
        Assert.Equal(july(9).ToString("o"), view.History.Last().At);

        // The staff view keeps every move, including the one the customer never sees.
        Assert.Equal(3, (await svc.HistoryAsync(purchase.Id, Ct))!.Count);
    }

    [Fact]
    public async Task The_board_says_when_each_order_was_last_touched_and_by_whom()
    {
        using var db = NewDb();
        var moved = await SeedAsync(db, OrderStatuses.Placed);
        var untouched = await SeedAsync(db, OrderStatuses.Fabricating);
        var svc = NewService(db);

        await svc.UpdateOrderAsync(moved.Id,
            new OrderUpdateInput { Status = OrderStatuses.Fabricating }, "anna@nvc.bg", Ct);

        var rows = (await svc.ListAsync(null, Ct)).ToDictionary(r => r.PurchaseId);

        Assert.Equal("anna@nvc.bg", rows[moved.Id].LastMovedBy);
        Assert.True(DateTimeOffset.TryParse(rows[moved.Id].LastMovedAt, out _));

        // An order nobody has moved reads as "no move on file" rather than borrowing a
        // date from somewhere — this is the column the office scans for orders going stale,
        // and a fabricated date is exactly the thing it must not show.
        Assert.Null(rows[untouched.Id].LastMovedAt);
        Assert.Null(rows[untouched.Id].LastMovedBy);
    }

    [Fact]
    public async Task An_order_older_than_the_history_table_is_undated_rather_than_invented()
    {
        // NO BACKFILL. Deriving a step date from UpdatedAt would put a date in front of a
        // customer that nobody ever observed — the same invention this codebase refuses
        // when it declines to store LeftToPay.
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.Travelling);
        purchase.UpdatedAt = new DateTimeOffset(2026, 5, 4, 12, 0, 0, TimeSpan.Zero);
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);
        var view = await svc.PublicAsync(code, Ct);

        // It still places itself on the timeline; it just cannot say when it got there.
        Assert.Empty(view!.History);
        Assert.Equal(OrderStatuses.Timeline.ToList().IndexOf(OrderStatuses.Travelling), view.Step);
    }

    [Fact]
    public async Task The_customer_sees_the_catalogue_photo_by_the_same_route_the_gallery_uses()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db);
        var houseId = purchase.HouseId!.Value;

        // Cover is the first image in the house's own order — the gallery's rule, not a
        // second one invented for this page.
        db.HouseImages.AddRange(
            new HouseImage { HouseId = houseId, ImageKey = $"gallery/{houseId}/second.webp", SortOrder = 1 },
            new HouseImage { HouseId = houseId, ImageKey = $"gallery/{houseId}/cover.webp", SortOrder = 0 });
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);

        Assert.Equal($"/api/img/gallery/{houseId}/cover.webp", (await svc.PublicAsync(code, Ct))!.ImageUrl);
    }

    [Fact]
    public async Task A_custom_build_shows_no_photo_rather_than_the_wrong_house()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db);
        purchase.HouseId = null;
        purchase.CustomModel = "Два вагона 6м, съединени";
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);

        var view = await svc.PublicAsync(code, Ct);
        Assert.Null(view!.ImageUrl);
        Assert.Equal("Два вагона 6м, съединени", view.Model);
    }

    [Fact]
    public void The_status_column_is_the_row_version_that_a_move_is_checked_against()
    {
        // The failure a hand-worked board gets as soon as two people work it. Anna presses
        // the next-step button; Boris presses it on a row that still reads "scheduled" on his
        // screen. Both requests read the old status, both conclude they are making the move,
        // and both append an event — one move, two history rows, the later of which credits
        // the person who did not make it. A double-click on one slow connection produces the
        // same pair of in-flight writes.
        //
        // Marking Status a concurrency token puts it in the UPDATE's WHERE clause, so the
        // second write matches no row and throws instead of quietly winning.
        //
        // Asserted against the MODEL rather than demonstrated against a database, because the
        // in-memory provider does not implement optimistic concurrency at all — run that race
        // against it and both writes land, which is what it looked like before this. What is
        // pinned here is the one declaration that makes SQL Server emit the guarded UPDATE,
        // and it is exactly the sort of line a later edit drops without noticing.
        using var db = NewDb();

        var status = db.Model
            .FindEntityType(typeof(Purchase))!
            .FindProperty(nameof(Purchase.Status))!;

        Assert.True(status.IsConcurrencyToken);
    }

    [Fact]
    public async Task A_write_onto_a_row_that_changed_underneath_it_answers_409_not_500()
    {
        // What the board is told when it loses that race, so it can re-read and show what
        // actually happened. A 500 reads as "the system is broken"; the truth is "the row you
        // are looking at is not the row you read".
        //
        // The window is forced open by hand, because the in-memory provider gives no other
        // way to reach the failure: the row is taken away between this request's read and its
        // write. That is also a real case in its own right — the customer's sheet can delete
        // a purchase while this board has it open.
        var shared = $"orders-{Guid.NewGuid()}";
        using var seed = NewDb(shared);
        var purchase = await SeedAsync(seed, OrderStatuses.Scheduled);

        using var board = NewDb(shared);
        board.SavingChanges += (_, _) =>
        {
            using var elsewhere = NewDb(shared);
            elsewhere.Purchases.Remove(elsewhere.Purchases.First(p => p.Id == purchase.Id));
            elsewhere.SaveChanges();
        };

        // A bare HttpContext, only so the controller can look for a signed-in name and find
        // none — an unattributed move is a real case (see OrderStatusEvent.ChangedByUpn).
        var controller = new AdminOrdersController(NewService(board))
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var response = await controller.Update(
            purchase.Id, new OrderUpdateInput { Status = OrderStatuses.Travelling }, Ct);

        Assert.IsType<ConflictObjectResult>(response);
    }

    [Fact]
    public async Task Two_people_moving_the_same_order_at_once_cannot_both_write_the_move()
    {
        // The failure a hand-worked board actually has once two people work it. Anna moves the
        // order on; Boris, looking at a row that still reads "scheduled", moves it somewhere
        // else. Both read the old status, both conclude they are the one making the move, and
        // without the token the second write would land on top of the first — the board would
        // then show a step nobody who is looking at it took.
        var shared = $"orders-{Guid.NewGuid()}";
        using var seed = NewDb(shared);
        var purchase = await SeedAsync(seed, OrderStatuses.Scheduled);

        using var anna = NewDb(shared);
        using var boris = NewDb(shared);

        // Both requests read the order BEFORE either of them writes, which is the whole of
        // the race: after this point neither can be told anything by the other.
        await anna.Purchases.FirstAsync(p => p.Id == purchase.Id);
        await boris.Purchases.FirstAsync(p => p.Id == purchase.Id);

        Assert.True(await NewService(anna).UpdateOrderAsync(
            purchase.Id, new OrderUpdateInput { Status = OrderStatuses.Travelling }, "anna@nvc.bg", Ct));

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => NewService(boris).UpdateOrderAsync(
            purchase.Id, new OrderUpdateInput { Status = OrderStatuses.Delivered }, "boris@nvc.bg", Ct));

        // One move, and the order carries the one that was actually made.
        //
        // Not asserted here: that the losing request left no event behind either. It does not,
        // in production — UpdateOrderAsync appends the event and writes the status in a single
        // SaveChanges, which SQL Server runs as one transaction, so the rejected update rolls
        // the append back with it. The in-memory provider has no transaction: it applies the
        // append, then throws on the status, and keeps the orphan. Asserting it here would be
        // asserting a property of the provider rather than of the code.
        using var after = NewDb(shared);
        var reread = await after.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchase.Id);
        Assert.Equal(OrderStatuses.Travelling, reread.Status);
    }

    [Fact]
    public async Task The_losing_half_of_a_race_is_a_409_rather_than_a_silent_win()
    {
        // What the board is told, so it can re-read and show the move that did land. A 500
        // would read as "the system is broken"; the truth is "you are looking at an old row".
        var shared = $"orders-{Guid.NewGuid()}";
        using var seed = NewDb(shared);
        var purchase = await SeedAsync(seed, OrderStatuses.Scheduled);

        using var first = NewDb(shared);
        using var second = NewDb(shared);
        await first.Purchases.FirstAsync(p => p.Id == purchase.Id);
        await second.Purchases.FirstAsync(p => p.Id == purchase.Id);

        await NewService(first).UpdateOrderAsync(
            purchase.Id, new OrderUpdateInput { Status = OrderStatuses.Travelling }, "anna@nvc.bg", Ct);

        // The controller reads a signed-in name before it reaches the service, so it needs a
        // context to read one from. Which name is beside the point here: this move loses the
        // race and is never written, so there is nobody to credit it to.
        var controller = new AdminOrdersController(NewService(second))
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var response = await controller.Update(
            purchase.Id, new OrderUpdateInput { Status = OrderStatuses.Travelling }, Ct);

        Assert.IsType<ConflictObjectResult>(response);
    }

    // --- Who is allowed to write an order's progress -------------------------------------

    [Fact]
    public async Task Recording_a_purchase_dates_the_first_step_of_its_timeline()
    {
        // Every later step is written by the person who makes it from the board. "Placed"
        // happens HERE, when the sale is recorded, and nothing can reconstruct it afterwards
        // — so without this the first row of every customer's timeline is undated forever.
        using var db = NewDb();
        var customers = new CustomerAdminService(db);

        var created = await customers.CreateAsync(new CustomerInput
        {
            Name = "Иван Петров",
            Purchases = new List<PurchaseInput> { new() { CategoryKey = "prefab", FinalPrice = 24_900m } },
        }, "maria@nvc.bg", Ct);

        var placed = Assert.Single(await db.OrderStatusEvents.AsNoTracking().ToListAsync());
        Assert.Equal(OrderStatuses.Placed, placed.Status);
        Assert.Equal("maria@nvc.bg", placed.ChangedByUpn);
        Assert.Equal(created.Purchases.Single().Id, placed.PurchaseId);

        // And the customer sees it dated, rather than as a step that never happened.
        var svc = NewService(db);
        var code = await svc.EnsureReferenceAsync(placed.PurchaseId, Ct);
        var view = await svc.PublicAsync(code, Ct);
        Assert.Equal(OrderStatuses.Placed, view!.History.Single().Status);
    }

    [Fact]
    public async Task Editing_a_customer_cannot_erase_what_the_orders_board_typed()
    {
        // The customer's sheet is a whole-row writer with no inputs for any of this, so every
        // save of a phone number used to null the tracking number, the carrier note and both
        // expected dates on every purchase that customer had. Nothing warned anybody; typed
        // data simply went missing.
        using var db = NewDb();
        var customers = new CustomerAdminService(db);

        var created = await customers.CreateAsync(new CustomerInput
        {
            Name = "Иван Петров",
            Phone = "0888 000 000",
            Purchases = new List<PurchaseInput> { new() { CategoryKey = "prefab", FinalPrice = 24_900m } },
        }, "maria@nvc.bg", Ct);

        var purchaseId = created.Purchases.Single().Id;
        await NewService(db).UpdateOrderAsync(purchaseId, new OrderUpdateInput
        {
            Status = OrderStatuses.Travelling,
            ExpectedAtHarbor = "2026-09-10",
            ExpectedReadyAt = "2026-09-20",
            CarrierName = "Ro-Ro Lines",
            TrackingReference = "RRL-8891",
            CarrierNote = "Товари се в сряда",
        }, "georgi@nvc.bg", Ct);

        // Somebody corrects the phone number, exactly as the customer panel submits it.
        await customers.UpdateAsync(created.Id, new CustomerInput
        {
            Name = "Иван Петров",
            Phone = "0888 111 111",
            Purchases = new List<PurchaseInput>
            {
                new() { Id = purchaseId, CategoryKey = "prefab", FinalPrice = 24_900m },
            },
        }, "maria@nvc.bg", Ct);

        var after = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchaseId);
        Assert.Equal(OrderStatuses.Travelling, after.Status);
        Assert.Equal("Ro-Ro Lines", after.CarrierName);
        Assert.Equal("RRL-8891", after.TrackingReference);
        Assert.Equal("Товари се в сряда", after.CarrierNote);
        Assert.NotNull(after.CarrierCheckedAt);
        Assert.NotNull(after.ExpectedAtHarbor);
        Assert.NotNull(after.ExpectedReadyAt);

        // And the move that got it there is still the only one on file: the customer endpoint
        // has no door onto Status, so it cannot move an order without writing the history.
        var moves = await db.OrderStatusEvents.AsNoTracking()
            .Where(e => e.PurchaseId == purchaseId).ToListAsync();
        Assert.Equal(
            new[] { OrderStatuses.Placed, OrderStatuses.Travelling },
            moves.OrderBy(e => e.Id).Select(e => e.Status));
    }

    // --- Reading the history back --------------------------------------------------------

    [Fact]
    public async Task Two_steps_written_in_the_same_tick_keep_the_order_they_were_written_in()
    {
        // A double-submit puts two events on one clock tick. Grouping them by status and then
        // sorting on the date alone leaves that tie to whichever status happened to be seen
        // first, which can show the customer an order reaching the harbour before it started
        // travelling.
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.AtHarbor);

        var tick = new DateTimeOffset(2026, 7, 9, 9, 0, 0, TimeSpan.Zero);
        db.OrderStatusEvents.AddRange(
            new OrderStatusEvent { PurchaseId = purchase.Id, Status = OrderStatuses.AtHarbor, ChangedAt = tick.AddDays(-8) },
            new OrderStatusEvent { PurchaseId = purchase.Id, Status = OrderStatuses.Travelling, ChangedAt = tick.AddDays(-4) },
            new OrderStatusEvent { PurchaseId = purchase.Id, Status = OrderStatuses.Travelling, ChangedAt = tick },
            new OrderStatusEvent { PurchaseId = purchase.Id, Status = OrderStatuses.AtHarbor, ChangedAt = tick });
        await db.SaveChangesAsync();

        var svc = NewService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);
        var view = await svc.PublicAsync(code, Ct);

        // Travelling was written first, so travelling is drawn first — the same tiebreak the
        // board's last-moved column uses, and for the same reason.
        Assert.Equal(
            new[] { OrderStatuses.Travelling, OrderStatuses.AtHarbor },
            view!.History.Select(s => s.Status));
    }

    [Fact]
    public async Task The_customer_is_never_handed_the_timestamp_of_office_activity()
    {
        // The code in the URL is not a credential for office facts. Purchase.UpdatedAt moves
        // when a price is edited, when a phone number is corrected on the customer's sheet
        // and when the link itself is minted — none of which happened to the order.
        using var db = NewDb();
        var purchase = await SeedAsync(db, OrderStatuses.Travelling);
        var svc = NewService(db);
        var code = await svc.EnsureReferenceAsync(purchase.Id, Ct);

        // An order older than the history table has nothing observable to report, however
        // recently the office touched the row.
        purchase.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        Assert.Null((await svc.PublicAsync(code, Ct))!.UpdatedAt);

        // A real, customer-visible fact is what fills it: the day the carrier note was last
        // confirmed, or the last move, whichever is later.
        await svc.UpdateOrderAsync(purchase.Id,
            new OrderUpdateInput { Status = OrderStatuses.Travelling, CarrierNote = "Left Singapore" },
            "anna@nvc.bg", Ct);

        var checkedAt = (await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchase.Id)).CarrierCheckedAt;
        Assert.Equal(checkedAt?.ToString("o"), (await svc.PublicAsync(code, Ct))!.UpdatedAt);
    }

    [Fact]
    public async Task The_board_tells_an_order_nobody_has_looked_at_from_one_being_minded()
    {
        // Six weeks in "travelling" is normal. The person minding it rings the carrier every
        // few days and writes down what they said, and never touches the status — so the last
        // MOVE alone would badge the best-kept order on the screen as abandoned.
        using var db = NewDb();
        var minded = await SeedAsync(db, OrderStatuses.Travelling);
        var forgotten = await SeedAsync(db, OrderStatuses.Travelling);
        var svc = NewService(db);

        var longAgo = DateTimeOffset.UtcNow.AddDays(-40);
        db.OrderStatusEvents.AddRange(
            new OrderStatusEvent { PurchaseId = minded.Id, Status = OrderStatuses.Travelling, ChangedAt = longAgo },
            new OrderStatusEvent { PurchaseId = forgotten.Id, Status = OrderStatuses.Travelling, ChangedAt = longAgo });
        await db.SaveChangesAsync();

        await svc.UpdateOrderAsync(minded.Id,
            new OrderUpdateInput { Status = OrderStatuses.Travelling, CarrierNote = "Passing Suez" },
            "anna@nvc.bg", Ct);

        var rows = (await svc.ListAsync(null, Ct)).ToDictionary(r => r.PurchaseId);

        // Neither has moved. Only one of them has been looked at.
        Assert.Equal(rows[minded.Id].LastMovedAt, rows[forgotten.Id].LastMovedAt);
        Assert.NotEqual(rows[minded.Id].LastMovedAt, rows[minded.Id].LastTouchedAt);
        Assert.Equal(rows[forgotten.Id].LastMovedAt, rows[forgotten.Id].LastTouchedAt);

        // An order with neither still reads as nothing on file, rather than borrowing a date
        // from somewhere — the same refusal as LastMovedAt.
        var fresh = await SeedAsync(db, OrderStatuses.Fabricating);
        Assert.Null((await svc.ListAsync(null, Ct)).Single(r => r.PurchaseId == fresh.Id).LastTouchedAt);
    }

    [Fact]
    public async Task The_history_endpoint_answers_404_only_for_an_order_that_does_not_exist()
    {
        using var db = NewDb();
        var purchase = await SeedAsync(db);
        var controller = new AdminOrdersController(NewService(db));

        Assert.IsType<NotFoundResult>(await controller.History(purchase.Id + 9_999, Ct));

        // An order nobody has moved is a different answer: 200 with an empty list, because
        // "no such order" and "nothing has happened yet" are different facts on a board
        // whose whole job is telling them apart.
        var found = Assert.IsType<OkObjectResult>(await controller.History(purchase.Id, Ct));
        Assert.Empty(Assert.IsAssignableFrom<List<OrderHistoryDto>>(found.Value));
    }
}
