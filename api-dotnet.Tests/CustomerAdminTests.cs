using System.Collections.Generic;
using System.Linq;
using apidotnet.Data.Migrations;
using Data.Entities;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The customer, factory and purchase rules.
//
// Everything pinned here shares a failure mode: it is wrong on a document rather than wrong
// on a screen. A transposed ЕГН, a deposit counted against no agreed price, a modular house
// claiming to be a catalogue model — none of these throw, none of them look broken in the
// panel, and all of them are discovered by somebody holding an invoice weeks later.
public class CustomerAdminTests
{
    // --- Identifier checksums ----------------------------------------------------------
    //
    // The vectors below were generated from the published algorithms, not copied from real
    // people or real companies.

    [Theory]
    [InlineData("7501011000")]
    [InlineData("8001152342")]
    [InlineData("9203305012")]
    public void A_well_formed_egn_passes(string egn)
    {
        Assert.True(BulgarianIdentifiers.IsValidEgn(egn));
    }

    [Fact]
    public void A_transposed_egn_digit_is_caught()
    {
        Assert.True(BulgarianIdentifiers.IsValidEgn("8001152342"));

        // Two digits swapped in the middle — the single most common typing mistake, and the
        // whole reason the number carries a check digit.
        Assert.False(BulgarianIdentifiers.IsValidEgn("8001125342"));
    }

    [Theory]
    [InlineData("750101100")]      // nine digits, not ten
    [InlineData("75010110000")]    // eleven
    [InlineData("750101100X")]
    [InlineData("")]
    [InlineData(null)]
    public void Anything_that_is_not_ten_digits_is_not_an_egn(string? value)
    {
        Assert.False(BulgarianIdentifiers.LooksLikeEgn(value));
        Assert.False(BulgarianIdentifiers.IsValidEgn(value));
    }

    [Theory]
    [InlineData("831919995")]
    [InlineData("123456786")]
    [InlineData("8319199950014")]
    [InlineData("1234567861237")]
    public void A_well_formed_eik_passes(string eik)
    {
        Assert.True(BulgarianIdentifiers.IsValidEik(eik));
    }

    [Fact]
    public void A_wrong_eik_check_digit_is_caught()
    {
        Assert.True(BulgarianIdentifiers.IsValidEik("831919995"));
        Assert.False(BulgarianIdentifiers.IsValidEik("831919992"));

        // The thirteen-digit form has its own second check digit over the branch part, so a
        // valid nine-digit base is not enough on its own.
        Assert.False(BulgarianIdentifiers.IsValidEik("8319199950015"));
    }

    [Theory]
    [InlineData("83191999")]       // eight digits
    [InlineData("8319199950")]     // ten
    [InlineData("83191999A")]
    public void Only_nine_or_thirteen_digits_can_be_an_eik(string value)
    {
        Assert.False(BulgarianIdentifiers.LooksLikeEik(value));
    }

    // --- Who the ЕГН rule applies to ---------------------------------------------------

    [Fact]
    public void A_foreign_customer_is_not_held_to_a_bulgarian_checksum()
    {
        // Ten digits, fails the ЕГН checksum (1234567890 would pass — the last digit is the
        // check digit), and belongs to a Greek buyer. Refusing this
        // would mean a real customer cannot be stored — see BulgarianIdentifiers.LooksBulgarian.
        var input = Customer("person", country: "Greece", personalId: "1234567891");

        Assert.Empty(CustomerAdminService.Validate(input));
    }

    [Fact]
    public void A_bulgarian_customer_is()
    {
        var input = Customer("person", country: "България", personalId: "1234567891");

        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("ЕГН"));
    }

    [Fact]
    public void A_blank_country_counts_as_bulgarian()
    {
        // The overwhelming majority of these customers are, and somebody typing a foreign id
        // into an empty form has a one-word fix the error message names.
        var input = Customer("person", country: null, personalId: "1234567891");

        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("ЕГН"));
    }

    [Fact]
    public void A_passport_number_is_stored_as_written()
    {
        // Not ten digits, so no checksum applies whatever the country says.
        var input = Customer("person", country: "Bulgaria", personalId: "AB1234567");

        Assert.Empty(CustomerAdminService.Validate(input));
    }

    // --- The type decides which identifier survives ------------------------------------

    [Fact]
    public void Neither_identifier_is_required()
    {
        // A customer whose ЕИК has not been sent through yet is still a customer. A form
        // that refuses to save is a form that gets "000000000" typed into it.
        Assert.Empty(CustomerAdminService.Validate(Customer("company")));
        Assert.Empty(CustomerAdminService.Validate(Customer("person")));
    }

    [Fact]
    public void An_eik_with_letters_in_it_is_reported_rather_than_stripped()
    {
        var input = Customer("company");
        input.Eik = "83191999X";

        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("digits"));
    }

    [Fact]
    public void A_customer_is_a_person_or_a_company_and_nothing_else()
    {
        var input = Customer("sole-trader");

        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("person or a company"));
    }

    [Fact]
    public void A_name_is_required()
    {
        var input = Customer("person");
        input.Name = "   ";

        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("name is required"));
    }

    // --- What was bought ---------------------------------------------------------------

    [Fact]
    public void A_garage_cannot_be_linked_to_a_catalogue_model()
    {
        // Not because a garage is inherently custom, but because the catalogue has no garages
        // in it to link to — see PurchaseCategories.WithGalleryModels. A foreign key here
        // would be a claim about a row that could not be the one that shipped.
        var input = Customer("person");
        input.Purchases = new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Garage, HouseId = 4 },
        };

        // And it names the category, because this is the one refusal on this form that can
        // fire over a value nobody typed — the panel resends every purchase on every save.
        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("'garage'"));
    }

    [Fact]
    public void Every_refusal_says_which_purchase_it_is_about()
    {
        // One alert, above a form that holds as many purchase cards as the customer has
        // sales. "A deposit cannot be negative" over four of them names nothing to go and
        // fix, and the reflex is to hunt through every box on the card. The number is
        // 1-based to match the heading the panel prints over each card.
        var input = Customer("person");
        input.Purchases = new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Wagon, Quantity = 2 },
            new() { CategoryKey = HouseCategories.Garage, HouseId = 4 },
            new() { CategoryKey = HouseCategories.Wagon, DepositPaid = -1m },
        };

        var errors = CustomerAdminService.Validate(input);

        Assert.Contains(errors, e => e.StartsWith("Purchase 2:") && e.Contains("no models"));
        Assert.Contains(errors, e => e.StartsWith("Purchase 3:") && e.Contains("deposit"));
        // The one that is fine is not mentioned at all.
        Assert.DoesNotContain(errors, e => e.StartsWith("Purchase 1:"));
    }

    [Fact]
    public void The_categories_that_do_come_out_of_the_catalogue_still_can()
    {
        foreach (var key in PurchaseCategories.WithGalleryModels)
        {
            var input = Customer("person");
            input.Purchases = new List<PurchaseInput> { new() { CategoryKey = key, HouseId = 4 } };

            Assert.Empty(CustomerAdminService.Validate(input));
        }
    }

    [Fact]
    public void The_picker_follows_the_catalogue_rather_than_what_sounds_like_a_house()
    {
        // The measured list, pinned. Counted against the live gallery on 2026-08-21: modular
        // 8 models, wagon 6, prefab 0, garage 0 — so the two that can fill a dropdown offer
        // one and the two that cannot are typed by hand. Reading it the other way is what
        // left the category the catalogue carries most of unable to link to a model at all:
        // the picker did not offer them, and an API caller who sent one was refused.
        //
        // The removals in the same change are the half that needed data behind it — a key
        // coming OFF this list turns any stored purchase carrying it into a customer who
        // cannot be saved at all. See BackfillPurchaseModelLinks.
        Assert.True(PurchaseCategories.AllowsGalleryModel(HouseCategories.Modular));
        Assert.True(PurchaseCategories.AllowsGalleryModel(HouseCategories.Wagon));
        Assert.False(PurchaseCategories.AllowsGalleryModel(HouseCategories.Prefab));
        Assert.False(PurchaseCategories.AllowsGalleryModel(HouseCategories.Garage));

        // All four remain things we sell; carrying no catalogue model is not the same as not
        // being on the price list.
        foreach (var key in new[]
                 {
                     HouseCategories.Modular, HouseCategories.Wagon,
                     HouseCategories.Prefab, HouseCategories.Garage,
                 })
        {
            Assert.True(PurchaseCategories.IsValid(key));
        }
    }

    [Fact]
    public void Materials_and_containers_are_things_we_sell_too()
    {
        // The gallery has no filter for these, which is exactly why the purchase category
        // list is a superset of HouseCategories rather than the same four keys.
        Assert.True(PurchaseCategories.IsValid("materials"));
        Assert.True(PurchaseCategories.IsValid("container"));
        Assert.False(PurchaseCategories.AllowsGalleryModel("materials"));
    }

    [Fact]
    public void A_category_we_do_not_sell_is_refused()
    {
        var input = Customer("person");
        input.Purchases = new List<PurchaseInput> { new() { CategoryKey = "yacht" } };

        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("yacht"));
    }

    [Fact]
    public void Wagons_are_the_one_category_with_no_staged_payment()
    {
        Assert.False(PurchaseCategories.TracksStagedPayment(HouseCategories.Wagon));

        foreach (var key in PurchaseCategories.All.Where(k => k != HouseCategories.Wagon))
        {
            Assert.True(PurchaseCategories.TracksStagedPayment(key));
        }
    }

    [Fact]
    public void A_wagon_that_did_take_a_deposit_is_still_storable()
    {
        // The panel hides the payment block for wagons; the schema does not forbid it. A
        // column that refuses real data is worse than a form that has to be nudged.
        var input = Customer("person");
        input.Purchases = new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Wagon, DepositPaid = 500m, FinalPrice = 9000m },
        };

        Assert.Empty(CustomerAdminService.Validate(input));
    }

    // --- What a customer submission is allowed to write ---------------------------------

    [Fact]
    public void The_sale_expense_columns_have_no_door_on_the_customer_sheet()
    {
        // Payment fees, transport, installation and other costs arrived with the Quickbase
        // import and nothing in the panel can type into one. PurchaseInput is a whole-row
        // writer, so a property here IS a way to clear the column — re-adding any of these
        // is how a corrected phone number starts nulling them again. The behaviour is pinned
        // by CustomerStoreTests; this pins the shape, because the shape is what somebody
        // "just wiring up a field" changes first.
        var written = typeof(PurchaseInput).GetProperties().Select(p => p.Name).ToList();

        foreach (var column in new[] { "PaymentFees", "TransportCost", "InstallationCost", "OtherCosts" })
        {
            Assert.DoesNotContain(column, written);
        }

        // Quantity is the deliberate exception, and belongs here rather than in a comment
        // somewhere: the panel is growing an input for it. What made it safe was changing
        // what an ABSENT quantity means, not taking the door away.
        Assert.Contains("Quantity", written);
    }

    [Fact]
    public void A_quantity_is_only_checked_when_one_was_actually_sent()
    {
        // Absent is not zero, and absent is the CONTRACT rather than an accident of what the
        // sheet happens to send: an omitted quantity means "leave the stored count alone",
        // so a rule that fired on null would refuse every caller that is not writing counts.
        // The sheet does send one now — that is exactly why the rule has to tolerate absent
        // rather than lean on nobody sending it.
        Assert.Empty(CustomerAdminService.Validate(WithQuantity(null)));
        Assert.Empty(CustomerAdminService.Validate(WithQuantity(3)));

        Assert.Contains(CustomerAdminService.Validate(WithQuantity(0)), e => e.Contains("quantity"));
        Assert.Contains(CustomerAdminService.Validate(WithQuantity(-2)), e => e.Contains("quantity"));
    }

    // --- The documents a purchase carries ----------------------------------------------

    [Fact]
    public void A_sale_produces_four_documents_in_the_order_they_happen()
    {
        // A customer pays twice, and each payment is invoiced twice over: a проформа asking
        // for the money, then a фактура once it has arrived. The order is not decoration —
        // the panel draws its slots off this list, so a list in the wrong order is a sheet
        // that reads backwards.
        Assert.Equal(
            new[] { "deposit-proforma", "deposit-invoice", "final-proforma", "final-invoice", "other" },
            PurchaseFileKinds.All);

        // Every one of them is uploadable. IsValid is the whole of the check
        // AdminCustomersController.UploadFile makes, and the only place a kind is validated
        // server-side at all.
        foreach (var kind in PurchaseFileKinds.All)
        {
            Assert.True(PurchaseFileKinds.IsValid(kind));
        }
    }

    [Fact]
    public void The_key_that_described_the_wrong_document_is_no_longer_accepted()
    {
        // 'prepaid-invoice' held a PROFORMA against the deposit — the panel's label said so
        // and the constant's own comment said so; only the key disagreed. Its rows move to
        // 'deposit-proforma' in RenamePrepaidInvoiceKind, and refusing the old key on upload
        // is what stops a fresh document being filed under a name that now sits between two
        // of the four slots.
        Assert.False(PurchaseFileKinds.IsValid("prepaid-invoice"));
        Assert.False(PurchaseFileKinds.IsValid("проформа"));
        Assert.False(PurchaseFileKinds.IsValid(null));
    }

    [Fact]
    public void The_rename_migration_moves_the_misfiled_rows_and_touches_nothing_else()
    {
        // Written by hand: no schema changed, so EF generated an empty Up and Down. Read back
        // off the migration rather than out of the file, so deleting the statement while
        // keeping the migration fails here instead of on a database nobody is watching.
        var migration = new RenamePrepaidInvoiceKind();

        var up = Assert.Single(migration.UpOperations.OfType<SqlOperation>()).Sql;
        Assert.Contains($"[Kind] = '{PurchaseFileKinds.DepositProforma}'", up);
        Assert.Contains("[Kind] = 'prepaid-invoice'", up);

        // The two keys that already say what they mean are not in the statement at all —
        // 'final-invoice' keeping its key is the reason none of its rows have to move.
        Assert.DoesNotContain(PurchaseFileKinds.FinalInvoice, up);
        Assert.DoesNotContain(PurchaseFileKinds.Other, up);

        var down = Assert.Single(migration.DownOperations.OfType<SqlOperation>()).Sql;
        Assert.Contains(
            $"[Kind] = 'prepaid-invoice' WHERE [Kind] = '{PurchaseFileKinds.DepositProforma}'", down);
    }

    [Fact]
    public void The_backfill_gives_the_older_purchases_a_count_and_a_status()
    {
        // Quantity and Status were added to a table that already had rows in it, so both
        // landed on the default a NOT NULL column is given: 0, and ''. Neither is a value
        // this application can produce or read. 0 is now refused on the way in, which means
        // a purchase recorded before that migration could not have its customer's phone
        // number corrected — the sheet answered with a validation error about a count
        // nobody typed; '' matches no step of OrderStatuses.Timeline, so the customer's
        // tracking page drew a timeline with nothing reached.
        //
        // Read off the migration rather than out of the file, same as the rename above.
        var migration = new BackfillPurchaseQuantityAndStatus();
        var up = migration.UpOperations.OfType<SqlOperation>().Select(o => o.Sql).ToList();

        Assert.Contains(up, sql => sql.Contains("[Quantity] = 1") && sql.Contains("[Quantity] <= 0"));
        Assert.Contains(up, sql =>
            sql.Contains($"[Status] = '{OrderStatuses.Placed}'") && sql.Contains("[Status] = ''"));

        // Nothing to reverse, deliberately: Down would have to know which rows held the
        // defaults, and writing a 0 and an '' back recreates the state this exists to end.
        Assert.Empty(migration.DownOperations);
    }

    [Fact]
    public void The_model_backfill_unlinks_the_categories_that_stopped_carrying_one()
    {
        // The half of the category change that needed data behind it. Prefab and garage came
        // off WithGalleryModels, and ValidatePurchase refuses a HouseId under any category
        // that is not on it — over every purchase in the submission, before a column is
        // written. So a row filed as prefab with a model attached, legal to save until this
        // release, would have refused every future save of the CUSTOMER holding it: their
        // phone number, their address, their notes, all of it, behind a 400 about a box
        // nobody opened.
        //
        // Converted rather than left to detonate: the house's title goes into CustomModel,
        // which is the column that exists for describing what the catalogue has no row for,
        // and the foreign key is cleared.
        var migration = new BackfillPurchaseModelLinks();
        var up = Assert.Single(migration.UpOperations.OfType<SqlOperation>()).Sql;

        Assert.Contains("[HouseId] = NULL", up);
        Assert.Contains("[CustomModel]", up);
        // A purchase that already described itself keeps its own words: what somebody wrote
        // about this sale outranks a title copied off a catalogue row.
        Assert.Contains("COALESCE", up);

        // The list is written out rather than read from PurchaseCategories, which is right
        // for a migration and wrong anywhere else — this statement has to keep meaning what
        // it meant on the day it ran, however the constant moves afterwards.
        foreach (var key in PurchaseCategories.WithGalleryModels) Assert.Contains($"'{key}'", up);
        Assert.DoesNotContain($"'{HouseCategories.Prefab}'", up);
        Assert.DoesNotContain($"'{HouseCategories.Garage}'", up);

        // Nothing to reverse: Up destroys the only record of which row each purchase pointed
        // at, and guessing them back by matching titles would relink purchases that never
        // had a model — anywhere somebody had typed a house's name in by hand.
        Assert.Empty(migration.DownOperations);
    }

    [Fact]
    public void A_document_is_addressed_by_row_id_and_never_by_blob_key()
    {
        // One expression behind two callers — the detail read describes a file with it and
        // the upload endpoint answers with it, so the panel can drop the row it just filed
        // into the sheet it already has open. The blob key never appears in a URL: an
        // invoice carries a name, an address and an ЕГН, and a path that can be guessed is
        // a path that does not need a session.
        Assert.Equal("/api/admin/customers/files/90", CustomerAdminService.FileDownloadUrl(90));
    }

    // --- Money -------------------------------------------------------------------------

    [Fact]
    public void Left_to_pay_is_the_price_less_what_has_come_in()
    {
        Assert.Equal(35000m, CustomerAdminService.LeftToPay(50000m, 15000m));
    }

    [Fact]
    public void Nothing_paid_means_all_of_it_is_outstanding()
    {
        Assert.Equal(50000m, CustomerAdminService.LeftToPay(50000m, null));
    }

    [Fact]
    public void No_agreed_price_means_no_answer_rather_than_zero()
    {
        // "Nothing outstanding" and "we have not settled on a number" are different facts,
        // and only one of them is good news.
        Assert.Null(CustomerAdminService.LeftToPay(null, 15000m));
        Assert.Null(CustomerAdminService.LeftToPay(null, null));
    }

    [Fact]
    public void A_deposit_larger_than_the_price_is_refused()
    {
        var input = Customer("person");
        input.Purchases = new List<PurchaseInput> { new() { DepositPaid = 60000m, FinalPrice = 50000m } };

        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("larger than"));
    }

    [Fact]
    public void Negative_money_is_refused()
    {
        var input = Customer("person");
        input.Purchases = new List<PurchaseInput> { new() { DepositPaid = -1m, FinalPrice = -2m } };

        var errors = CustomerAdminService.Validate(input);
        Assert.Contains(errors, e => e.Contains("deposit cannot be negative"));
        Assert.Contains(errors, e => e.Contains("price cannot be negative"));
    }

    // --- Dates -------------------------------------------------------------------------

    [Fact]
    public void A_purchase_date_is_stored_at_midnight_utc()
    {
        Assert.True(CustomerAdminService.TryParsePurchaseDate("2026-07-14", out var value));

        Assert.NotNull(value);
        Assert.Equal(2026, value!.Value.Year);
        Assert.Equal(7, value.Value.Month);
        Assert.Equal(14, value.Value.Day);
        Assert.Equal(System.TimeSpan.Zero, value.Value.Offset);
        Assert.Equal(System.TimeSpan.Zero, value.Value.TimeOfDay);
    }

    [Fact]
    public void Clearing_a_purchase_date_is_a_legitimate_edit()
    {
        Assert.True(CustomerAdminService.TryParsePurchaseDate("", out var value));
        Assert.Null(value);
    }

    [Fact]
    public void A_date_we_cannot_read_is_refused_rather_than_absorbed()
    {
        Assert.False(CustomerAdminService.TryParsePurchaseDate("next Tuesday", out _));

        var input = Customer("person");
        input.Purchases = new List<PurchaseInput> { new() { PurchasedAt = "next Tuesday" } };
        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("not a date"));
    }

    // --- Factories ---------------------------------------------------------------------

    [Fact]
    public void A_factory_needs_only_a_name()
    {
        // A supplier who is currently just a name and a phone number is still worth
        // recording — demanding an address means the row does not get created at all.
        Assert.Empty(FactoryAdminService.Validate(new FactoryInput { Name = "Bursa Prefab" }));
    }

    [Fact]
    public void A_factory_without_a_name_is_refused()
    {
        Assert.Contains(
            FactoryAdminService.Validate(new FactoryInput { Name = "  " }),
            e => e.Contains("name is required"));
    }

    [Fact]
    public void A_factory_contact_email_is_checked_loosely()
    {
        Assert.Contains(
            FactoryAdminService.Validate(new FactoryInput { Name = "X", ContactEmail = "not-an-address" }),
            e => e.Contains("email address"));

        Assert.Empty(FactoryAdminService.Validate(new FactoryInput { Name = "X", ContactEmail = "a@b.bg" }));
    }

    [Fact]
    public void Blank_input_becomes_null_rather_than_an_empty_string()
    {
        // Both mean "not filled in". Storing both makes every later "is this set?" check
        // wrong half the time.
        Assert.Null(AdminText.Clean("   "));
        Assert.Null(AdminText.Clean(null));
        Assert.Equal("Bursa", AdminText.Clean("  Bursa  "));
    }

    private static CustomerInput Customer(
        string type, string? country = null, string? personalId = null) => new()
    {
        Type = type,
        Name = "Иван Петров",
        Country = country,
        PersonalId = personalId,
    };

    private static CustomerInput WithQuantity(int? quantity)
    {
        var input = Customer(CustomerTypes.Person);
        input.Purchases = new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Wagon, Quantity = quantity },
        };
        return input;
    }
}
