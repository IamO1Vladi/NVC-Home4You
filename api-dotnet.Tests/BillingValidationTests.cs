using System.Linq;
using Data.Entities;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// What the billing forms refuse, and what they deliberately let through (ROADMAP #21).
//
// The pattern these follow is the one FactoryAdminService set: refuse what has no true
// reading, warn about what is merely unusual, and never demand a field that would stop a
// real record being written at all.
public class BillingValidationTests
{
    private static BuyCycleInput Cycle(string label = "2026 C1") => new() { Label = label };

    // --- Buying cycles ------------------------------------------------------------------

    [Fact]
    public void A_cycle_needs_only_a_label()
    {
        // Deliberately permissive, same call as a factory with nothing but a name: a cycle
        // is frequently opened before anyone knows when it ends or what the markup will be.
        Assert.Empty(BuyCycleAdminService.Validate(Cycle()));
    }

    [Fact]
    public void A_cycle_with_no_label_is_refused()
    {
        Assert.NotEmpty(BuyCycleAdminService.Validate(new BuyCycleInput { Label = "  " }));
    }

    [Fact]
    public void A_vat_rate_typed_as_a_percentage_is_refused()
    {
        // THE mistake this validation exists for. 20 where 0.20 belongs multiplies every
        // price in the cycle by a hundred, looks unremarkable in the form, and is discovered
        // on the dashboard weeks later. There is no true reading of a 2000% border rate.
        var input = Cycle();
        input.BorderVatRate = 20m;

        Assert.Contains(
            BuyCycleAdminService.Validate(input),
            e => e.Contains("fraction"));
    }

    [Theory]
    [InlineData(0.20)]
    [InlineData(0)]
    [InlineData(0.999)]
    public void A_plausible_vat_rate_passes(double rate)
    {
        var input = Cycle();
        input.BorderVatRate = (decimal)rate;

        Assert.Empty(BuyCycleAdminService.Validate(input));
    }

    [Fact]
    public void A_markup_of_zero_or_less_is_refused()
    {
        var input = Cycle();
        input.MarkupCoefficient = 0m;

        Assert.NotEmpty(BuyCycleAdminService.Validate(input));
    }

    [Fact]
    public void A_cycle_cannot_end_before_it_starts()
    {
        var input = Cycle();
        input.StartDate = "2026-03-01";
        input.EndDate = "2026-02-01";

        Assert.NotEmpty(BuyCycleAdminService.Validate(input));
    }

    [Fact]
    public void A_cycle_may_straddle_a_month_and_a_year()
    {
        // ROADMAP #21 open question 2 is which boundaries the business uses. Whatever the
        // answer, the schema must not have pre-decided it — a cycle running mid-November to
        // mid-February is recordable.
        var input = Cycle("2026 C1");
        input.StartDate = "2025-11-14";
        input.EndDate = "2026-02-09";

        Assert.Empty(BuyCycleAdminService.Validate(input));
    }

    // --- Shipments ----------------------------------------------------------------------

    [Fact]
    public void A_shipment_needs_a_cycle()
    {
        // A container attributed to no cycle appears in no report — a row that silently does
        // not count, which is worse than one that is refused.
        Assert.NotEmpty(ShipmentAdminService.Validate(new ShipmentInput { BuyCycleId = 0 }));
    }

    [Fact]
    public void A_shipment_needs_nothing_else()
    {
        // Costs and dates all arrive later, over weeks. Demanding them up front means the
        // container does not get recorded at all.
        Assert.Empty(ShipmentAdminService.Validate(new ShipmentInput { BuyCycleId = 1 }));
    }

    [Fact]
    public void A_container_cannot_arrive_before_it_departed()
    {
        // Refused rather than warned about because Status is derived from these dates: an
        // out-of-order pair reports a negative lead time and files the container in the
        // wrong column of the cycle page.
        var input = new ShipmentInput
        {
            BuyCycleId = 1,
            OrderedAt = "2026-01-10",
            DepartedAt = "2026-02-01",
            ArrivedAt = "2026-01-20",
        };

        Assert.NotEmpty(ShipmentAdminService.Validate(input));
    }

    [Fact]
    public void Negative_crossing_costs_are_refused()
    {
        var input = new ShipmentInput { BuyCycleId = 1, FreightCost = -100m };

        Assert.NotEmpty(ShipmentAdminService.Validate(input));
    }

    [Fact]
    public void An_exchange_rate_of_zero_is_refused()
    {
        // Zero would value the whole container at nothing in euro, which is a report that
        // looks complete and says the business bought air.
        var input = new ShipmentInput { BuyCycleId = 1, UsdToEurRate = 0m };

        Assert.NotEmpty(ShipmentAdminService.Validate(input));
    }

    // --- Lines --------------------------------------------------------------------------

    [Fact]
    public void A_lot_needs_a_model_and_at_least_one_unit()
    {
        Assert.NotEmpty(ShipmentAdminService.ValidateLot(new PurchaseLotInput { ProductModelId = 0, Quantity = 1 }));
        Assert.NotEmpty(ShipmentAdminService.ValidateLot(new PurchaseLotInput { ProductModelId = 1, Quantity = 0 }));
    }

    [Fact]
    public void A_lot_of_zero_cost_goods_is_allowed()
    {
        // Samples and warranty replacements are real lines. Only a NEGATIVE cost is refused.
        Assert.Empty(ShipmentAdminService.ValidateLot(
            new PurchaseLotInput { ProductModelId = 1, Quantity = 4, UnitCost = 0m }));
    }

    // --- Models -------------------------------------------------------------------------

    [Fact]
    public void A_model_may_belong_to_no_category()
    {
        // Fittings and fixings belong to no category anyone filters on, and refusing them
        // would keep the cost of half a container out of the system.
        Assert.Empty(ProductModelAdminService.Validate(new ProductModelInput { Name = "M8 anchor bolt" }));
    }

    [Fact]
    public void A_model_category_must_be_one_we_buy_in()
    {
        var input = new ProductModelInput { Name = "Something", CategoryKey = "not-a-category" };

        Assert.NotEmpty(ProductModelAdminService.Validate(input));
    }

    [Fact]
    public void The_model_categories_are_the_same_ones_sales_uses()
    {
        // Shared deliberately, so "what we bought" and "what we sold" group identically.
        // If this ever diverges, the margin report starts comparing different populations.
        foreach (var key in PurchaseCategories.All)
        {
            Assert.Empty(ProductModelAdminService.Validate(
                new ProductModelInput { Name = "x", CategoryKey = key }));
        }
    }

    // --- Operating expenses --------------------------------------------------------------

    [Fact]
    public void An_expense_needs_a_date_and_an_amount()
    {
        Assert.NotEmpty(OperatingExpenseAdminService.Validate(
            new OperatingExpenseInput { Amount = 100m }));

        Assert.NotEmpty(OperatingExpenseAdminService.Validate(
            new OperatingExpenseInput { SpentAt = "2026-08-01", Amount = 0m }));
    }

    [Fact]
    public void Vat_larger_than_the_amount_it_is_part_of_is_refused()
    {
        // Almost always the gross typed into the VAT box. Worth catching, because it
        // survives into the reclaim figure otherwise.
        var input = new OperatingExpenseInput { SpentAt = "2026-08-01", Amount = 100m, VatAmount = 120m };

        Assert.NotEmpty(OperatingExpenseAdminService.Validate(input));
    }

    [Fact]
    public void An_uncategorised_expense_is_allowed()
    {
        // It lands in the rollup's own "uncategorised" line, which is visible and therefore
        // fixable — unlike an amount that never got entered because the form argued.
        var input = new OperatingExpenseInput { SpentAt = "2026-08-01", Amount = 100m };

        Assert.Empty(OperatingExpenseAdminService.Validate(input));
    }

    [Fact]
    public void Every_published_expense_category_is_accepted()
    {
        // The list the API serves and the list validation accepts must be the same list —
        // the panel offers a dropdown built from the first one.
        foreach (var key in ExpenseCategories.All)
        {
            Assert.Empty(OperatingExpenseAdminService.Validate(
                new OperatingExpenseInput { SpentAt = "2026-08-01", Amount = 1m, CategoryKey = key }));
        }
    }

    // --- Targets -------------------------------------------------------------------------

    [Fact]
    public void A_monthly_target_needs_a_year_and_a_month_and_no_cycle()
    {
        var good = new TargetInput
        {
            PeriodType = PeriodTypes.Month,
            Year = 2026, Month = 8,
            MetricKey = TargetMetrics.Revenue,
            TargetValue = 250_000m,
        };
        Assert.Empty(TargetAdminService.Validate(good));

        // The period columns are checked AGAINST the period type because the unique index
        // keys on the combination: a stray cycle id would occupy a slot nothing later
        // matches, so the target is set once and then invisible to the dashboard.
        var strayCycle = new TargetInput
        {
            PeriodType = PeriodTypes.Month,
            Year = 2026, Month = 8, BuyCycleId = 3,
            MetricKey = TargetMetrics.Revenue,
            TargetValue = 250_000m,
        };
        Assert.NotEmpty(TargetAdminService.Validate(strayCycle));
    }

    [Fact]
    public void A_cycle_target_needs_a_cycle_and_no_month()
    {
        var good = new TargetInput
        {
            PeriodType = PeriodTypes.Cycle,
            BuyCycleId = 3,
            MetricKey = TargetMetrics.GrossMargin,
            TargetValue = 90_000m,
        };
        Assert.Empty(TargetAdminService.Validate(good));

        var noCycle = new TargetInput
        {
            PeriodType = PeriodTypes.Cycle,
            MetricKey = TargetMetrics.GrossMargin,
            TargetValue = 90_000m,
        };
        Assert.NotEmpty(TargetAdminService.Validate(noCycle));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    public void A_month_outside_the_calendar_is_refused(int month)
    {
        var input = new TargetInput
        {
            PeriodType = PeriodTypes.Month,
            Year = 2026, Month = month,
            MetricKey = TargetMetrics.Revenue,
            TargetValue = 1m,
        };

        Assert.NotEmpty(TargetAdminService.Validate(input));
    }

    [Fact]
    public void A_target_of_zero_is_allowed_but_a_negative_one_is_not()
    {
        // "Hold marketing at nothing this quarter" is a real target, and OpexCap is a
        // ceiling rather than a goal.
        var zero = new TargetInput
        {
            PeriodType = PeriodTypes.Year, Year = 2026,
            MetricKey = TargetMetrics.OpexCap, TargetValue = 0m,
        };
        Assert.Empty(TargetAdminService.Validate(zero));

        zero.TargetValue = -1m;
        Assert.NotEmpty(TargetAdminService.Validate(zero));
    }

    [Fact]
    public void An_unknown_metric_is_refused()
    {
        var input = new TargetInput
        {
            PeriodType = PeriodTypes.Year, Year = 2026,
            MetricKey = "vibes", TargetValue = 1m,
        };

        Assert.NotEmpty(TargetAdminService.Validate(input));
    }

    [Fact]
    public void Nothing_at_all_is_refused_everywhere_rather_than_throwing()
    {
        // Every Validate takes a nullable input, because a malformed body deserialises to
        // null and a NullReferenceException is a 500 where this is a 400.
        Assert.NotEmpty(BuyCycleAdminService.Validate(null));
        Assert.NotEmpty(ShipmentAdminService.Validate(null));
        Assert.NotEmpty(ShipmentAdminService.ValidateLot(null));
        Assert.NotEmpty(ProductModelAdminService.Validate(null));
        Assert.NotEmpty(OperatingExpenseAdminService.Validate(null));
        Assert.NotEmpty(TargetAdminService.Validate(null));
    }
}
