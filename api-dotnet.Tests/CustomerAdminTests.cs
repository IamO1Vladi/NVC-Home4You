using System.Collections.Generic;
using System.Linq;
using Data.Entities;
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
    public void A_modular_house_cannot_be_linked_to_a_catalogue_model()
    {
        // Confirmed as the business rule: modular houses ship as custom builds, so a foreign
        // key to a catalogue row would be a claim that what shipped matches that row.
        var input = Customer("person");
        input.Purchases = new List<PurchaseInput>
        {
            new() { CategoryKey = HouseCategories.Modular, HouseId = 4 },
        };

        Assert.Contains(CustomerAdminService.Validate(input), e => e.Contains("custom build"));
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
    public void Modular_is_a_category_we_sell_even_though_it_carries_no_model()
    {
        Assert.True(PurchaseCategories.IsValid(HouseCategories.Modular));
        Assert.False(PurchaseCategories.AllowsGalleryModel(HouseCategories.Modular));
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
}
