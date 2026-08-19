using System.Collections.Generic;
using System.Linq;
using Data.Entities;
using Xunit;

namespace ApiDotnet.Tests;

// The procurement arithmetic (ROADMAP #21).
//
// Everything here shares the failure mode the billing tables were designed around: it is
// wrong on a price list rather than wrong on a screen. A landed cost that quietly omits
// customs, a container valued at today's exchange rate instead of the one it was bought at,
// freight spread evenly over a container holding one house and ten door handles — none of
// these throw, all of them look plausible, and each produces a number somebody then quotes.
//
// The worked example below is the owner's own, confirmed 2026-08-17. It is pinned here so
// that if the formula is ever "simplified", the test says which business rule was lost.
public class BillingArithmeticTests
{
    private static PurchaseLot Lot(int quantity, decimal unitCost, int id = 0) =>
        new() { Id = id, Quantity = quantity, UnitCost = unitCost };

    // --- The formula --------------------------------------------------------------------

    [Fact]
    public void The_owners_worked_example_still_produces_36250()
    {
        // Lots $10,000, freight $2,000, customs $500 — a landed base of $12,500.
        var lots = new[] { Lot(1, 10_000m) };
        var shipment = new Shipment { FreightCost = 2_000m, CustomsDuty = 500m };
        var cycle = new BuyCycle { MarkupCoefficient = 2.7m, BorderVatRate = 0.20m };

        var landedBase = LandedCost.Base(shipment, lots);
        Assert.Equal(12_500m, landedBase);

        // 12,500 x 2.7 = 33,750, plus 12,500 x 0.20 = 2,500.
        Assert.Equal(36_250m, LandedCost.SuggestedPrice(landedBase, cycle));
    }

    [Fact]
    public void Vat_applies_to_the_whole_landed_value_not_just_the_goods()
    {
        // The distinction the owner was explicit about: VAT is on "purchase lots, shipments
        // and customs". If it were charged on the goods alone, this would be
        // 10,000 x 0.20 = 2,000 of VAT instead of 2,500 — a 500 dollar hole per container
        // that nothing else in the system would reveal.
        var lots = new[] { Lot(1, 10_000m) };
        var shipment = new Shipment { FreightCost = 2_000m, CustomsDuty = 500m };
        var cycle = new BuyCycle { MarkupCoefficient = 1m, BorderVatRate = 0.20m };

        var landedBase = LandedCost.Base(shipment, lots);

        Assert.Equal(12_500m + 2_500m, LandedCost.SuggestedPrice(landedBase, cycle));
    }

    [Fact]
    public void Import_vat_actually_paid_is_recorded_but_never_priced_in()
    {
        // ImportVatPaid exists so the rate on the cycle can be checked against what the
        // border really charged. Adding it to the landed base would charge VAT twice — once
        // as a real cost and again as the rate term.
        var lots = new[] { Lot(1, 10_000m) };
        var withoutVatColumn = new Shipment { FreightCost = 2_000m, CustomsDuty = 500m };
        var withVatColumn = new Shipment { FreightCost = 2_000m, CustomsDuty = 500m, ImportVatPaid = 2_400m };

        Assert.Equal(
            LandedCost.Base(withoutVatColumn, lots),
            LandedCost.Base(withVatColumn, lots));
    }

    [Fact]
    public void A_cycle_with_no_markup_prices_nothing_rather_than_pricing_at_cost()
    {
        // Null, not the landed base. A screen that answers "it sells for what it cost" to a
        // question nobody has configured is worse than one that shows a dash.
        Assert.Null(LandedCost.SuggestedPrice(12_500m, new BuyCycle()));
        Assert.Null(LandedCost.SuggestedPrice(12_500m, null));
    }

    [Fact]
    public void A_missing_border_rate_is_treated_as_no_vat_not_as_no_price()
    {
        // Unlike the markup, a null VAT rate has a sensible reading — nothing was charged at
        // the border — so it degrades to zero rather than voiding the whole price.
        var cycle = new BuyCycle { MarkupCoefficient = 2.7m };

        Assert.Equal(33_750m, LandedCost.SuggestedPrice(12_500m, cycle));
    }

    // --- The VAT reclaim (owner, 2026-08-19) ---------------------------------------------

    [Fact]
    public void The_reclaim_excludes_customs_and_the_two_slices_sum_to_the_vat_charged()
    {
        // The owner's rule: VAT is PAID on the whole landed base, RECLAIMED "on the total
        // price of the shipment without the customs". On the worked example — base $12,500
        // of which $500 customs, rate 0.20 — that is $2,400 back and $100 gone for good.
        var cycle = new BuyCycle { MarkupCoefficient = 2.7m, BorderVatRate = 0.20m };

        Assert.Equal(2_400m, LandedCost.ReclaimableVat(12_500m, 500m, cycle));
        Assert.Equal(100m, LandedCost.UnrecoverableVat(500m, cycle));

        // Together they are exactly the VAT term the price formula charges — the split
        // reallocates the payment between cost and timing, it never invents or loses money.
        Assert.Equal(12_500m * 0.20m,
            LandedCost.ReclaimableVat(12_500m, 500m, cycle) + LandedCost.UnrecoverableVat(500m, cycle));
    }

    [Fact]
    public void True_cost_adds_only_the_vat_that_never_comes_back()
    {
        // NOT base + all VAT (Quickbase's reading, which overstates cost by the reclaimable
        // slice on every container) and NOT base alone (which pretends the customs slice
        // comes back — it does not).
        var cycle = new BuyCycle { BorderVatRate = 0.20m };

        Assert.Equal(12_600m, LandedCost.TrueCost(12_500m, 500m, cycle));
    }

    [Fact]
    public void No_rate_means_no_vat_moved_in_either_direction()
    {
        Assert.Equal(0m, LandedCost.ReclaimableVat(12_500m, 500m, new BuyCycle()));
        Assert.Equal(0m, LandedCost.UnrecoverableVat(500m, null));
        Assert.Equal(12_500m, LandedCost.TrueCost(12_500m, 500m, null));
    }

    // --- Currency -----------------------------------------------------------------------

    [Fact]
    public void Euro_comes_from_the_shipments_own_rate()
    {
        var shipment = new Shipment { UsdToEurRate = 0.92m };

        Assert.Equal(11_500m, LandedCost.ToEur(12_500m, shipment));
    }

    [Fact]
    public void Two_containers_bought_at_different_rates_keep_their_own_valuations()
    {
        // THE reason the rate lives on the shipment rather than in a setting. One global
        // rate would re-value both of these every time it moved, so last quarter's landed
        // costs would change overnight with nobody editing anything.
        var january = new Shipment { UsdToEurRate = 0.90m };
        var august = new Shipment { UsdToEurRate = 0.95m };

        Assert.Equal(9_000m, LandedCost.ToEur(10_000m, january));
        Assert.Equal(9_500m, LandedCost.ToEur(10_000m, august));
    }

    [Fact]
    public void No_rate_means_no_euro_figure_at_all()
    {
        // Null propagates to the screen on purpose: inventing today's rate for a container
        // nobody has entered one for produces a report that changes on its own.
        Assert.Null(LandedCost.ToEur(12_500m, new Shipment()));
        Assert.Null(LandedCost.ToEur(null, new Shipment { UsdToEurRate = 0.92m }));
    }

    // --- Allocation (ROADMAP #21, open question 5) --------------------------------------

    [Fact]
    public void Value_and_count_allocation_disagree_sharply_on_a_mixed_container()
    {
        // One house at $10,000 and ten fittings at $100. Goods $11,000, crossing $1,100.
        var house = Lot(1, 10_000m, id: 1);
        var fittings = Lot(10, 100m, id: 2);
        var lots = new[] { house, fittings };
        var shipment = new Shipment { FreightCost = 1_100m };

        // By value: the house carries 10/11 of the freight.
        Assert.Equal(11_000m, LandedCost.UnitLandedCost(house, shipment, lots));
        Assert.Equal(110m, LandedCost.UnitLandedCost(fittings, shipment, lots));

        // By count: every one of the eleven units carries $100 — which doubles what a door
        // handle appears to cost, and understates the house by $900. This is the choice the
        // owner has not yet made, and the gap between the two columns is why it matters.
        Assert.Equal(10_100m, LandedCost.UnitLandedCost(house, shipment, lots, LandedCost.Allocation.ByCount));
        Assert.Equal(200m, LandedCost.UnitLandedCost(fittings, shipment, lots, LandedCost.Allocation.ByCount));
    }

    [Fact]
    public void Allocation_never_loses_or_invents_money()
    {
        var house = Lot(1, 10_000m, id: 1);
        var fittings = Lot(10, 100m, id: 2);
        var lots = new[] { house, fittings };
        var shipment = new Shipment { FreightCost = 1_100m };

        foreach (var method in new[] { LandedCost.Allocation.ByValue, LandedCost.Allocation.ByCount })
        {
            var total = lots.Sum(l => l.Quantity * LandedCost.UnitLandedCost(l, shipment, lots, method)!.Value);

            Assert.Equal(LandedCost.Base(shipment, lots), total);
        }
    }

    [Fact]
    public void A_container_of_free_goods_still_carries_its_freight()
    {
        // Warranty replacements, samples: goods value zero, so there are no value shares to
        // divide by. Falling back to per-unit rather than returning null keeps the crossing
        // attributed — it was paid for, whatever the invoice for the contents said.
        var samples = Lot(4, 0m, id: 1);
        var lots = new[] { samples };
        var shipment = new Shipment { FreightCost = 400m };

        Assert.Equal(100m, LandedCost.UnitLandedCost(samples, shipment, lots));
    }

    [Fact]
    public void A_lot_of_nothing_has_no_unit_cost_to_report()
    {
        var empty = Lot(0, 500m, id: 1);

        Assert.Null(LandedCost.UnitLandedCost(empty, new Shipment(), new[] { empty }));
    }

    // --- Completeness and status --------------------------------------------------------

    [Fact]
    public void An_incomplete_container_says_what_it_is_waiting_for()
    {
        // The distinction a bare total cannot make: "this cost nothing to bring in" versus
        // "nobody has entered the freight yet".
        var shipment = new Shipment { CustomsDuty = 500m, UsdToEurRate = 0.92m };
        var cycle = new BuyCycle { MarkupCoefficient = 2.7m };

        var missing = LandedCost.MissingForCosting(shipment, cycle);

        Assert.Contains(nameof(Shipment.FreightCost), missing);
        Assert.DoesNotContain(nameof(Shipment.CustomsDuty), missing);
        Assert.DoesNotContain(nameof(Shipment.UsdToEurRate), missing);
        Assert.DoesNotContain(nameof(BuyCycle.MarkupCoefficient), missing);
    }

    [Fact]
    public void A_complete_container_is_missing_nothing()
    {
        var shipment = new Shipment { FreightCost = 2_000m, CustomsDuty = 500m, UsdToEurRate = 0.92m };
        var cycle = new BuyCycle { MarkupCoefficient = 2.7m, BorderVatRate = 0.20m };

        Assert.Empty(LandedCost.MissingForCosting(shipment, cycle));
    }

    [Theory]
    [InlineData(false, false, false, "draft")]
    [InlineData(true, false, false, "ordered")]
    [InlineData(true, true, false, "in-transit")]
    [InlineData(true, true, true, "arrived")]
    public void Status_is_derived_from_the_dates_not_stored(
        bool ordered, bool departed, bool arrived, string expected)
    {
        var when = new System.DateTimeOffset(2026, 8, 1, 0, 0, 0, System.TimeSpan.Zero);

        var shipment = new Shipment
        {
            OrderedAt = ordered ? when : null,
            DepartedAt = departed ? when : null,
            ArrivedAt = arrived ? when : null,
        };

        Assert.Equal(expected, Services.ShipmentAdminService.StatusOf(shipment));
    }

    // --- The no-stored-totals rule ------------------------------------------------------

    [Fact]
    public void Nothing_in_these_tables_stores_a_total()
    {
        // The rule Purchase.LeftToPay established, pinned by reflection so a well-meaning
        // "denormalise for speed" change has to argue with a test rather than slip through.
        // A stored total is a second copy of a computed fact, and the copy is the one people
        // read after the parts have moved.
        var banned = new[] { "LineTotal", "GoodsCost", "TotalCost", "LandedCost", "AmountEur", "TotalEur" };

        foreach (var type in new[]
                 {
                     typeof(Shipment), typeof(PurchaseLot), typeof(BuyCycle),
                     typeof(OperatingExpense), typeof(Target), typeof(ProductModel),
                 })
        {
            foreach (var property in type.GetProperties())
            {
                Assert.DoesNotContain(property.Name, banned);
            }
        }
    }
}
