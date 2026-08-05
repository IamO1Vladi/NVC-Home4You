using System;
using Data.Entities;
using Xunit;

namespace ApiDotnet.Tests;

// The Quickbase formula fields, reimplemented over SQL columns. These are not new behaviour —
// they have to reproduce what the live cases page shows today, or the migration silently
// changes the page. The definitions were recovered from CasesPageService, so these tests are
// what stops them drifting once Quickbase is gone and the original formulas are unreadable.
public class CaseFormulaTests
{
    private static Case NewCase() => new()
    {
        CompanyName = "Acme Ltd",
        CompanySector = "Construction",
        BuyerName = "Ivan Petrov",
        BuyerRole = "Site manager",
        City = "Plovdiv",
        Country = "Bulgaria",
        IsPublished = true,
    };

    [Fact]
    public void Location_is_city_then_country()
    {
        Assert.Equal("Plovdiv, Bulgaria", CaseFormulas.PublicLocationLabel(NewCase()));
    }

    [Fact]
    public void Location_degrades_to_whichever_part_exists()
    {
        var onlyCountry = NewCase();
        onlyCountry.City = null;
        Assert.Equal("Bulgaria", CaseFormulas.PublicLocationLabel(onlyCountry));

        var neither = NewCase();
        neither.City = null;
        neither.Country = "   ";
        // Null rather than an empty string or a stray comma, so the page can omit the line.
        Assert.Null(CaseFormulas.PublicLocationLabel(neither));
    }

    [Fact]
    public void Buyer_label_prefers_the_buyer_then_falls_back_to_the_company()
    {
        Assert.Equal("Ivan Petrov", CaseFormulas.PublicBuyerLabel(NewCase()));

        var noBuyer = NewCase();
        noBuyer.BuyerName = null;
        // Attributing the quote to the company beats showing it unattributed.
        Assert.Equal("Acme Ltd", CaseFormulas.PublicBuyerLabel(noBuyer));
    }

    [Fact]
    public void A_case_with_no_company_is_a_private_individual()
    {
        // The live page suppresses sector, buyer role and logo for these, so a personal
        // purchase never implies someone's employer.
        var person = NewCase();
        person.CompanyName = "";

        Assert.False(CaseFormulas.HasCompany(person));
        Assert.True(CaseFormulas.HasCompany(NewCase()));
    }

    [Fact]
    public void Is_public_in_sql_is_just_the_published_flag()
    {
        var c = NewCase();
        Assert.True(CaseFormulas.IsPublic(c));

        c.IsPublished = false;
        Assert.False(CaseFormulas.IsPublic(c));
    }

    [Theory]
    [InlineData(true, false, null, true)]        // Publish ticked
    [InlineData(false, true, null, true)]        // Is Public formula was true
    [InlineData(false, false, "public", true)]   // visible only via status
    [InlineData(false, false, "Published", true)]
    [InlineData(false, false, "visible", true)]
    [InlineData(false, false, "show", true)]
    [InlineData(false, false, "draft", false)]
    [InlineData(false, false, "", false)]
    [InlineData(false, false, null, false)]
    public void The_import_applies_the_full_quickbase_visibility_chain(
        bool publish, bool isPublicFlag, string? status, bool expected)
    {
        // Three Quickbase fields collapse into one SQL column. If the import looked only at
        // Publish, a case that was live purely because of its visibility status would vanish
        // from the site the moment the flag flipped -- and nothing would report it.
        Assert.Equal(expected, CaseFormulas.IsPublicDuringImport(publish, isPublicFlag, status));
    }

    [Fact]
    public void Product_label_joins_name_and_variant()
    {
        var c = NewCase();
        c.ProductName = "Box House";
        c.ProductVariant = "60m²";

        Assert.Equal("Box House 60m²", CaseFormulas.ProductLabel(c));

        c.ProductVariant = null;
        Assert.Equal("Box House", CaseFormulas.ProductLabel(c));
    }

    [Fact]
    public void Year_falls_back_to_the_delivery_date()
    {
        var c = NewCase();
        c.Year = 2025;
        Assert.Equal("2025", CaseFormulas.YearLabel(c));

        c.Year = null;
        c.DeliveredAt = new DateTimeOffset(2024, 6, 1, 0, 0, 0, TimeSpan.Zero);
        Assert.Equal("2024", CaseFormulas.YearLabel(c));

        c.DeliveredAt = null;
        Assert.Null(CaseFormulas.YearLabel(c));
    }
}
