using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Customers against a real DbContext — the behaviours that only exist once there are rows.
//
// CustomerAdminTests covers the pure rules. What is here is the half that a comment cannot
// guarantee: which columns a search actually touches, what the list actually sends, and what
// happens to purchases the panel stops mentioning.
public class CustomerStoreTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"customers-{Guid.NewGuid()}")
            .Options);

    private static CustomerInput NewInput(
        string name = "Иван Петров",
        string type = CustomerTypes.Person,
        string? personalId = null,
        string? eik = null,
        string? phone = null,
        string? email = null,
        List<PurchaseInput>? purchases = null) => new()
        {
            Name = name,
            Type = type,
            PersonalId = personalId,
            Eik = eik,
            Phone = phone,
            Email = email,
            Purchases = purchases,
        };

    // --- Converting a lead --------------------------------------------------------------

    [Fact]
    public async Task Converting_a_lead_copies_the_identity_and_links_back()
    {
        using var db = NewDb();
        db.Leads.Add(new Lead
        {
            Id = 7,
            Name = "Мария Тодорова",
            Email = "maria@example.com",
            Phone = "0888000111",
            CustomerAddress = "ул. Витоша 1, София",
            BuildLocation = "с. Бистрица",   // must NOT become the customer's address
            Country = "България",
        });
        await db.SaveChangesAsync();

        var result = await new CustomerAdminService(db).ConvertLeadAsync(7, "sales@x.eu", default);

        Assert.NotNull(result);
        Assert.True(result!.Created);
        var c = result.Customer;
        Assert.Equal("Мария Тодорова", c.Name);
        Assert.Equal("maria@example.com", c.Email);
        Assert.Equal("0888000111", c.Phone);
        // The customer's own address, not the plot: the person is the identity, the build
        // site is a property of the deal.
        Assert.Equal("ул. Витоша 1, София", c.Address);
        Assert.Equal(7, c.LeadId);
        // Identity only, by decision — the purchase is added in the editor this opens into.
        Assert.Empty(c.Purchases);
        Assert.Equal(CustomerTypes.Person, c.Type);
    }

    [Fact]
    public async Task Converting_twice_returns_the_same_customer_rather_than_a_namesake()
    {
        // The double click, and the colleague who did not know it was already done. A
        // second customer with the same name would be the duplicate nobody notices until
        // two people record deposits on different rows.
        using var db = NewDb();
        db.Leads.Add(new Lead { Id = 7, Name = "Иван" });
        await db.SaveChangesAsync();

        var svc = new CustomerAdminService(db);
        var first = await svc.ConvertLeadAsync(7, null, default);
        var second = await svc.ConvertLeadAsync(7, null, default);

        Assert.True(first!.Created);
        Assert.False(second!.Created);
        Assert.Equal(first.Customer.Id, second.Customer.Id);
        Assert.Equal(1, await db.Customers.CountAsync());
    }

    [Fact]
    public async Task Converting_a_lead_that_does_not_exist_is_null_not_a_customer()
    {
        using var db = NewDb();

        Assert.Null(await new CustomerAdminService(db).ConvertLeadAsync(999, null, default));
        Assert.Equal(0, await db.Customers.CountAsync());
    }

    // --- What a search may touch --------------------------------------------------------

    [Fact]
    public async Task Search_finds_a_customer_by_name_phone_email_or_eik()
    {
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        await svc.CreateAsync(NewInput(
            name: "Стройко ООД", type: CustomerTypes.Company, eik: "831919995",
            phone: "0888123456", email: "office@stroyko.example"), null, default);

        foreach (var term in new[] { "Стройко", "0888123456", "office@", "831919995" })
        {
            var hits = await svc.ListAsync(term, default);
            Assert.Single(hits);
        }
    }

    [Fact]
    public async Task Search_never_matches_a_personal_id()
    {
        // THE actual guarantee behind "you cannot look a customer up by ЕГН". The panel's
        // search box will happily send whatever was typed — what stops an identifier being a
        // usable lookup key is that nothing here compares against the column.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        await svc.CreateAsync(NewInput(personalId: "7501011000"), null, default);

        Assert.Empty(await svc.ListAsync("7501011000", default));
        // ...and the customer is really there, so this is not passing for the wrong reason.
        Assert.Single(await svc.ListAsync("Иван", default));
    }

    [Fact]
    public async Task The_list_never_carries_a_personal_id_at_all()
    {
        // The list is fetched every time the page opens. An ЕГН in it would mean the most
        // sensitive column in the database travelling over the wire, and sitting in browser
        // memory, for every row on screen.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        await svc.CreateAsync(NewInput(personalId: "7501011000"), null, default);

        var summary = Assert.Single(await svc.ListAsync(null, default));
        Assert.DoesNotContain(
            typeof(CustomerSummaryDto).GetProperties(),
            p => p.Name.Contains("Personal", StringComparison.OrdinalIgnoreCase));

        // The detail record is where it lives, fetched when somebody opens one customer.
        var detail = await svc.GetAsync(summary.Id, default);
        Assert.Equal("7501011000", detail!.PersonalId);
    }

    // --- The type decides which identifier is stored ------------------------------------

    [Fact]
    public async Task Switching_a_company_to_a_person_does_not_leave_its_eik_behind()
    {
        // Otherwise the ЕИК sits there as a value nothing on the form shows and nothing will
        // ever correct — and it stays searchable.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(
            NewInput(name: "Стройко ООД", type: CustomerTypes.Company, eik: "831919995"), null, default);

        await svc.UpdateAsync(
            created.Id,
            NewInput(name: "Иван Петров", type: CustomerTypes.Person, personalId: "7501011000"),
            null, default);

        var after = await svc.GetAsync(created.Id, default);
        Assert.Null(after!.Eik);
        Assert.Equal("7501011000", after.PersonalId);
        Assert.Empty(await svc.ListAsync("831919995", default));
    }

    [Fact]
    public async Task An_eik_is_stored_without_the_spaces_it_was_typed_with()
    {
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(
            NewInput(type: CustomerTypes.Company, eik: "831 919 995"), null, default);

        Assert.Equal("831919995", (await svc.GetAsync(created.Id, default))!.Eik);
    }

    // --- Purchases ----------------------------------------------------------------------

    [Fact]
    public async Task A_customer_can_buy_more_than_once()
    {
        // The whole reason Purchase is its own table. Two sales, one identity.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Wagon, CustomModel = "Фургон 6м", PurchasedAt = "2026-05-04" },
            new() { CategoryKey = HouseCategories.Prefab, FinalPrice = 50000m, PurchasedAt = "2026-07-14" },
        }), null, default);

        Assert.Equal(2, created.Purchases.Count);
        // Newest first — a purchase list is read the way a statement is.
        Assert.Equal("2026-07-14", created.Purchases[0].PurchasedAt);
    }

    [Fact]
    public async Task An_edit_updates_the_purchase_it_names_rather_than_making_another()
    {
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Prefab, FinalPrice = 50000m },
        }), null, default);

        var existingId = created.Purchases[0].Id;

        var updated = await svc.UpdateAsync(created.Id, NewInput(purchases: new List<PurchaseInput>
        {
            new() { Id = existingId, CategoryKey = HouseCategories.Prefab, FinalPrice = 52000m, DepositPaid = 10000m },
        }), null, default);

        var purchase = Assert.Single(updated!.Purchases);
        Assert.Equal(existingId, purchase.Id);
        Assert.Equal(52000m, purchase.FinalPrice);
        Assert.Equal(42000m, purchase.LeftToPay);
    }

    [Fact]
    public async Task A_purchase_the_panel_stops_sending_is_deleted()
    {
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Prefab },
            new() { CategoryKey = HouseCategories.Wagon },
        }), null, default);

        var keep = created.Purchases[0].Id;

        var updated = await svc.UpdateAsync(created.Id, NewInput(purchases: new List<PurchaseInput>
        {
            new() { Id = keep, CategoryKey = HouseCategories.Prefab },
        }), null, default);

        Assert.Single(updated!.Purchases);
        Assert.Equal(1, await db.Purchases.CountAsync());
    }

    [Fact]
    public async Task A_submission_that_does_not_mention_purchases_leaves_them_alone()
    {
        // Null and empty are DIFFERENT, and this is the test that keeps them that way. If
        // they were conflated, any caller that omitted the field would wipe the sales
        // history — quietly, and with a 200.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Prefab, FinalPrice = 50000m },
        }), null, default);

        var input = NewInput();
        input.Purchases = null;                     // "this submission is not about purchases"
        var untouched = await svc.UpdateAsync(created.Id, input, null, default);
        Assert.Single(untouched!.Purchases);

        input.Purchases = new List<PurchaseInput>(); // "this customer has none"
        var cleared = await svc.UpdateAsync(created.Id, input, null, default);
        Assert.Empty(cleared!.Purchases);
    }

    [Fact]
    public async Task Saving_a_customer_leaves_the_columns_no_form_can_reach_exactly_as_they_were()
    {
        // The quantity and the four sale-expense columns came across with the Quickbase
        // import and no screen in the panel can type into any of them. Apply() wrote all five
        // unconditionally from a payload that never mentions them, so correcting a phone
        // number turned three wagons back into one and nulled everything the sale had cost —
        // quietly, with a 200, on every purchase that customer had. Same disease the order
        // fields were cured of; this is the rest of it.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(NewInput(phone: "0888 000 000", purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Wagon, FinalPrice = 30000m },
        }), null, default);

        var purchaseId = created.Purchases[0].Id;

        // The row as the import left it: three wagons, and what the sale itself cost.
        var imported = await db.Purchases.FirstAsync(p => p.Id == purchaseId);
        imported.Quantity = 3;
        imported.PaymentFees = 120m;
        imported.TransportCost = 250m;
        imported.InstallationCost = 800m;
        imported.OtherCosts = 40m;
        await db.SaveChangesAsync();

        // Somebody corrects the phone number — the exact ten fields the sheet submits.
        await svc.UpdateAsync(created.Id, NewInput(phone: "0888 111 111", purchases: new List<PurchaseInput>
        {
            new() { Id = purchaseId, CategoryKey = HouseCategories.Wagon, FinalPrice = 30000m },
        }), null, default);

        var after = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchaseId);
        Assert.Equal(3, after.Quantity);
        Assert.Equal(120m, after.PaymentFees);
        Assert.Equal(250m, after.TransportCost);
        Assert.Equal(800m, after.InstallationCost);
        Assert.Equal(40m, after.OtherCosts);

        // And all five are still READ back. Closing the write path is not the same as
        // dropping the columns: the import's numbers are real, they travel with the record,
        // and nothing in the panel draws them yet — see PurchaseInput, which spells out that
        // they are import-only history until billing moves across.
        var dto = Assert.Single((await svc.GetAsync(created.Id, default))!.Purchases);
        Assert.Equal(1210m, dto.SaleExpenses);
        Assert.Equal(10000m, dto.UnitPrice);
    }

    [Fact]
    public async Task A_quantity_somebody_does_type_is_stored()
    {
        // Absent means "leave the count alone"; sent means what it says. Somebody selling two
        // wagons has to be able to record two, which is why this column kept its door when
        // the expense ones lost theirs.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Wagon, FinalPrice = 18000m },
        }), null, default);

        // A brand-new purchase nobody typed a count into is still one, from the entity
        // default rather than from Apply overwriting anything.
        Assert.Equal(1, created.Purchases[0].Quantity);

        var updated = await svc.UpdateAsync(created.Id, NewInput(purchases: new List<PurchaseInput>
        {
            new()
            {
                Id = created.Purchases[0].Id,
                CategoryKey = HouseCategories.Wagon,
                FinalPrice = 18000m,
                Quantity = 2,
            },
        }), null, default);

        Assert.Equal(2, updated!.Purchases[0].Quantity);
        Assert.Equal(9000m, updated.Purchases[0].UnitPrice);
    }

    [Fact]
    public async Task A_quantity_of_zero_or_less_is_refused_rather_than_stored()
    {
        // The unit price divides by this, so a purchase of nothing is arithmetic waiting to
        // happen. Validation is what the panel is told; Apply refuses it a second time so a
        // caller that skipped validation cannot leave one behind either.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Wagon, FinalPrice = 18000m, Quantity = 4 },
        }), null, default);

        var purchaseId = created.Purchases[0].Id;

        foreach (var refused in new[] { 0, -1 })
        {
            var input = NewInput(purchases: new List<PurchaseInput>
            {
                new() { Id = purchaseId, CategoryKey = HouseCategories.Wagon, Quantity = refused },
            });

            Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("quantity"));

            await svc.UpdateAsync(created.Id, input, null, default);
            var after = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchaseId);
            Assert.Equal(4, after.Quantity);
        }
    }

    [Fact]
    public async Task A_purchase_id_belonging_to_someone_else_is_treated_as_a_new_row()
    {
        // Never as an edit. The alternative is letting one customer's form reach into
        // another's purchase by guessing a number.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var theirs = await svc.CreateAsync(NewInput(name: "Първи", purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Prefab, FinalPrice = 50000m },
        }), null, default);

        var victimPurchaseId = theirs.Purchases[0].Id;

        var mine = await svc.CreateAsync(NewInput(name: "Втори", purchases: new List<PurchaseInput>
        {
            new() { Id = victimPurchaseId, CategoryKey = HouseCategories.Garage, FinalPrice = 1m },
        }), null, default);

        Assert.NotEqual(victimPurchaseId, mine.Purchases[0].Id);

        // The other customer's purchase is exactly as it was.
        var theirsAfter = await svc.GetAsync(theirs.Id, default);
        Assert.Equal(50000m, Assert.Single(theirsAfter!.Purchases).FinalPrice);
    }

    [Fact]
    public async Task A_model_does_not_survive_a_move_to_a_category_that_cannot_carry_one()
    {
        // Applied on write as well as in validation, so a category changed after the fact
        // cannot leave a stale foreign key pointing at a house this purchase is not.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 4, Title = "Nova 40", CategoryKey = HouseCategories.Modular });
        await db.SaveChangesAsync();

        var svc = new CustomerAdminService(db);
        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Modular, HouseId = 4 },
        }), null, default);

        Assert.Equal(4, created.Purchases[0].HouseId);

        var moved = await svc.UpdateAsync(created.Id, NewInput(purchases: new List<PurchaseInput>
        {
            new() { Id = created.Purchases[0].Id, CategoryKey = HouseCategories.Garage, HouseId = 4 },
        }), null, default);

        Assert.Null(moved!.Purchases[0].HouseId);
    }

    [Fact]
    public async Task A_modular_purchase_keeps_the_model_that_was_picked_for_it()
    {
        // What the category change bought, pinned at the layer that writes it: modular is on
        // WithGalleryModels now, so Apply() keeps the foreign key instead of dropping it.
        //
        // The old behaviour was not a silent loss, and it is worth being exact about that,
        // because the two failures call for opposite fixes. Before this change the panel
        // filtered modular out of the picker, so the eight modular houses the catalogue
        // carries could not be chosen at all; a caller who sent one anyway was refused with a
        // 400 by ValidatePurchase, which runs over every purchase before either write. The
        // model was unreachable, not discarded — see the comment on Apply for why the null
        // branch below is defence in depth rather than the path anything took.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 4, Title = "Nova 60", CategoryKey = HouseCategories.Modular });
        await db.SaveChangesAsync();

        var svc = new CustomerAdminService(db);
        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Modular, HouseId = 4 },
        }), null, default);

        Assert.Equal(4, created.Purchases[0].HouseId);
        Assert.Equal("Nova 60", created.Purchases[0].HouseTitle);

        // And it is really in the column, not just echoed back out of the submission.
        Assert.Equal(4, (await db.Purchases.AsNoTracking().SingleAsync()).HouseId);
    }

    // --- Totals on the list -------------------------------------------------------------

    [Fact]
    public async Task Totals_add_up_across_a_customers_purchases()
    {
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { FinalPrice = 50000m, DepositPaid = 15000m, Currency = "EUR" },
            new() { FinalPrice = 20000m, DepositPaid = 5000m, Currency = "EUR" },
        }), null, default);

        var row = Assert.Single(await svc.ListAsync(null, default));
        Assert.Equal(70000m, row.TotalFinalPrice);
        Assert.Equal(20000m, row.TotalDeposit);
        Assert.Equal(50000m, row.TotalLeftToPay);
        Assert.Equal("EUR", row.Currency);
    }

    [Fact]
    public async Task A_customer_buying_in_two_currencies_gets_no_total_at_all()
    {
        // Adding 20 000 EUR to 5 000 BGN produces a number that is wrong in a way nobody
        // spots. No number is the honest answer; the detail view shows each in its own.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { FinalPrice = 20000m, Currency = "EUR" },
            new() { FinalPrice = 5000m, Currency = "BGN" },
        }), null, default);

        var row = Assert.Single(await svc.ListAsync(null, default));
        Assert.Null(row.TotalFinalPrice);
        Assert.Null(row.TotalLeftToPay);
        Assert.Null(row.Currency);
    }

    [Fact]
    public async Task No_prices_recorded_is_not_a_total_of_zero()
    {
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Wagon, Currency = "EUR" },
        }), null, default);

        var row = Assert.Single(await svc.ListAsync(null, default));
        Assert.Null(row.TotalFinalPrice);
    }

    // --- Deleting -----------------------------------------------------------------------

    [Fact]
    public async Task Deleting_a_customer_takes_their_purchases_with_them()
    {
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var created = await svc.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Prefab },
        }), null, default);

        Assert.True(await svc.DeleteAsync(created.Id, default));
        Assert.Equal(0, await db.Purchases.CountAsync());
        Assert.False(await svc.DeleteAsync(created.Id, default));
    }

    // --- The supplier directory ---------------------------------------------------------

    [Fact]
    public async Task A_factory_named_by_a_purchase_cannot_be_deleted()
    {
        // Refused here rather than left to the foreign key, so the panel can say "12
        // purchases name this — deactivate it instead" rather than "something went wrong".
        using var db = NewDb();
        var factories = new FactoryAdminService(db);
        var customers = new CustomerAdminService(db);

        var factory = await factories.CreateAsync(new FactoryInput { Name = "Bursa Prefab" }, null, default);
        await customers.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { FactoryId = factory.Id, CategoryKey = HouseCategories.Prefab },
        }), null, default);

        var (outcome, count) = await factories.DeleteAsync(factory.Id, default);
        Assert.Equal(FactoryAdminService.DeleteOutcome.InUse, outcome);
        Assert.Equal(1, count);

        // Deactivating is the way out, and it keeps the purchase pointing somewhere real.
        await factories.UpdateAsync(factory.Id, new FactoryInput { Name = "Bursa Prefab", IsActive = false }, null, default);
        Assert.False((await factories.GetAsync(factory.Id, default))!.IsActive);
    }

    [Fact]
    public async Task An_unused_factory_can_be_deleted()
    {
        using var db = NewDb();
        var factories = new FactoryAdminService(db);

        var factory = await factories.CreateAsync(new FactoryInput { Name = "Ruse Steel" }, null, default);

        var (outcome, _) = await factories.DeleteAsync(factory.Id, default);
        Assert.Equal(FactoryAdminService.DeleteOutcome.Deleted, outcome);
        Assert.Empty(await factories.ListAsync(default));
    }

    [Fact]
    public async Task The_factory_list_counts_what_hangs_off_each_row()
    {
        using var db = NewDb();
        var factories = new FactoryAdminService(db);
        var customers = new CustomerAdminService(db);

        var used = await factories.CreateAsync(new FactoryInput { Name = "Bursa Prefab" }, null, default);
        await factories.CreateAsync(new FactoryInput { Name = "Пловдив Модул" }, null, default);

        await customers.CreateAsync(NewInput(purchases: new List<PurchaseInput>
        {
            new() { FactoryId = used.Id },
            new() { FactoryId = used.Id },
        }), null, default);

        var rows = await factories.ListAsync(default);
        Assert.Equal(2, rows.Single(f => f.Name == "Bursa Prefab").PurchaseCount);
        Assert.Equal(0, rows.Single(f => f.Name == "Пловдив Модул").PurchaseCount);
    }

    [Fact]
    public async Task An_inactive_factory_is_still_listed_on_its_own_screen()
    {
        // This is where a supplier gets reactivated. A row you cannot see is a row you
        // cannot fix — the purchase form is where inactive ones drop out.
        using var db = NewDb();
        var factories = new FactoryAdminService(db);

        await factories.CreateAsync(new FactoryInput { Name = "Retired", IsActive = false }, null, default);
        await factories.CreateAsync(new FactoryInput { Name = "Active", IsActive = true }, null, default);

        var rows = await factories.ListAsync(default);
        Assert.Equal(2, rows.Count);
        // Active first, so the ones in play are the ones at the top.
        Assert.Equal("Active", rows[0].Name);
    }

    [Fact]
    public async Task A_duplicate_factory_name_is_reported_but_not_refused()
    {
        using var db = NewDb();
        var factories = new FactoryAdminService(db);

        var first = await factories.CreateAsync(new FactoryInput { Name = "Bursa Prefab" }, null, default);
        await factories.CreateAsync(new FactoryInput { Name = "Bursa Prefab" }, null, default);

        Assert.Equal(2, (await factories.ListAsync(default)).Count);
        Assert.True(await factories.NameExistsAsync("Bursa Prefab", first.Id, default));
        Assert.False(await factories.NameExistsAsync("Somewhere Else", null, default));
    }

    [Fact]
    public async Task A_duplicate_identifier_is_reported_but_not_refused()
    {
        // A company that buys through two branches is one ЕИК twice, and a hard constraint
        // turns a mistyped digit into a save that fails without saying which row it hit.
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        var first = await svc.CreateAsync(
            NewInput(name: "Стройко ООД", type: CustomerTypes.Company, eik: "831919995"), null, default);

        // Re-saving the original must not report the original against itself, or every edit
        // to an existing customer would carry a duplicate warning.
        Assert.Null(await svc.FindDuplicateAsync(
            NewInput(name: "Стройко ООД", type: CustomerTypes.Company, eik: "831919995"),
            first.Id, default));

        // A second row with the same number is reported...
        var duplicate = NewInput(name: "Стройко ООД клон Русе", type: CustomerTypes.Company, eik: "831919995");
        Assert.Equal("Стройко ООД", await svc.FindDuplicateAsync(duplicate, null, default));

        // ...and saved anyway.
        await svc.CreateAsync(duplicate, null, default);
        Assert.Equal(2, (await svc.ListAsync(null, default)).Count);
    }

    [Fact]
    public async Task A_duplicate_personal_id_is_reported_too()
    {
        using var db = NewDb();
        var svc = new CustomerAdminService(db);

        await svc.CreateAsync(NewInput(name: "Иван Петров", personalId: "7501011000"), null, default);

        Assert.Equal("Иван Петров", await svc.FindDuplicateAsync(
            NewInput(name: "И. Петров", personalId: "7501011000"), null, default));
    }
}
