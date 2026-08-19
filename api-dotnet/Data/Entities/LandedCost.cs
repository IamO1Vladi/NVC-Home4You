using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

/// <summary>
/// The procurement arithmetic, in one place.
///
/// Every figure on the billing dashboard is DERIVED — nothing in these tables stores a total,
/// a line total, or a euro amount (see Shipment's missing GoodsCost, PurchaseLot's missing
/// LineTotal, and Purchase.LeftToPay before them). That rule only holds if there is exactly
/// one implementation of the sums, which is this class. A second copy in a controller is how
/// two screens start disagreeing about one container.
///
/// Same reasoning as CaseFormulas: computed on read, so it cannot drift from the rows it
/// came from.
///
/// THE FORMULA, confirmed with the owner 2026-08-17:
///
///     LandedBase = SUM(lot.Quantity * lot.UnitCost) + Freight + Customs + Other
///     Price      = LandedBase * MarkupCoefficient  +  LandedBase * BorderVatRate
///
/// VAT applies to the whole landed value, customs included — the owner's words were that it
/// is "on the whole price — purchase lots, shipments and customs". Both terms multiply the
/// same base, so this is algebraically LandedBase * (Markup + Vat); it is computed as two
/// terms because they are two business facts, and a single coefficient could not be
/// explained to an accountant or moved independently when one of them changes.
///
/// EVERYTHING HERE IS USD until ToEur is called. The buy side is transacted in dollars and
/// stored as paid; conversion happens at the last possible moment, using the rate on the
/// individual shipment, so a rate that moves never re-values a container that already landed.
/// </summary>
public static class LandedCost
{
    /// <summary>What the goods themselves cost at the factory gate, USD. Sum of the lots.</summary>
    public static decimal GoodsCost(IEnumerable<PurchaseLot>? lots) =>
        lots is null ? 0m : lots.Sum(l => l.Quantity * l.UnitCost);

    /// <summary>
    /// Freight + customs duty + other costs, USD.
    ///
    /// ImportVatPaid is deliberately NOT included. It is what the border actually charged,
    /// recorded so it can be compared against what BorderVatRate predicted; adding it here
    /// would apply VAT twice, once as a real cost and again as the rate term in Price.
    /// </summary>
    public static decimal CrossingCost(Shipment? s) =>
        s is null ? 0m : (s.FreightCost ?? 0m) + (s.CustomsDuty ?? 0m) + (s.OtherCosts ?? 0m);

    /// <summary>The full landed value the price is built on, USD.</summary>
    public static decimal Base(Shipment? shipment, IEnumerable<PurchaseLot>? lots) =>
        GoodsCost(lots) + CrossingCost(shipment);

    /// <summary>
    /// Suggested retail for a whole shipment, USD, or null when the cycle has not been given
    /// its coefficients.
    ///
    /// Null rather than a fallback of 1.0 or 0: a missing markup means nobody has said what
    /// this cycle sells at, and a screen that answers "the same as cost" to that question is
    /// worse than one that says nothing. The panel shows a dash and a reason.
    /// </summary>
    public static decimal? SuggestedPrice(decimal landedBase, BuyCycle? cycle)
    {
        if (cycle?.MarkupCoefficient is not decimal markup) return null;
        var vat = cycle.BorderVatRate ?? 0m;

        return landedBase * markup + landedBase * vat;
    }

    /// <summary>
    /// USD to EUR at the shipment's own captured rate, or null when no rate has been recorded.
    ///
    /// Null propagates on purpose, all the way to the screen. A container whose rate nobody
    /// has entered has no euro value, and inventing one — today's rate, last shipment's rate —
    /// would produce a report that changes on its own.
    /// </summary>
    public static decimal? ToEur(decimal? usd, Shipment? shipment)
    {
        if (usd is not decimal amount) return null;
        if (shipment?.UsdToEurRate is not decimal rate) return null;

        return decimal.Round(amount * rate, 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>How a shipment's freight and customs get spread over the things inside it.</summary>
    public enum Allocation
    {
        /// <summary>
        /// By each lot's share of the goods value. THE ANSWER — confirmed by the owner
        /// 2026-08-19 (ROADMAP #21 question 5), and independently by the Quickbase system
        /// itself: every Allocated-* formula on its Purchase Lots table multiplies by
        /// "Share of Shipment Goods Value". It is also the fairer split when a container
        /// mixes a €12,000 house with €200 of fittings.
        /// </summary>
        ByValue,

        /// <summary>
        /// Evenly per unit. Kept as a what-if lens the panel can request, never a default —
        /// the by-value decision above is settled.
        /// </summary>
        ByCount,
    }

    /// <summary>
    /// The landed cost of ONE unit of one lot, USD: its own factory price plus its share of
    /// the crossing.
    ///
    /// This is the number the margin report is built on, so the allocation choice is not
    /// cosmetic — on a mixed container the two methods can differ by more than the margin
    /// itself.
    /// </summary>
    public static decimal? UnitLandedCost(
        PurchaseLot lot,
        Shipment shipment,
        IReadOnlyCollection<PurchaseLot> allLots,
        Allocation method = Allocation.ByValue)
    {
        if (lot.Quantity <= 0) return null;

        var crossing = CrossingCost(shipment);
        decimal share;

        if (method == Allocation.ByCount)
        {
            var totalUnits = allLots.Sum(l => l.Quantity);
            share = totalUnits <= 0 ? 0m : crossing * lot.Quantity / totalUnits;
        }
        else
        {
            var totalValue = GoodsCost(allLots);

            // A container of things that cost nothing — free samples, a warranty replacement
            // — has no value shares to divide by. Fall back to per-unit rather than
            // returning null: the crossing was still paid for, and refusing to attribute it
            // would quietly understate the cost of the only goods on the boat.
            if (totalValue <= 0m)
            {
                var totalUnits = allLots.Sum(l => l.Quantity);
                share = totalUnits <= 0 ? 0m : crossing * lot.Quantity / totalUnits;
            }
            else
            {
                share = crossing * (lot.Quantity * lot.UnitCost) / totalValue;
            }
        }

        return lot.UnitCost + share / lot.Quantity;
    }

    /// <summary>
    /// Whether a shipment has everything the arithmetic needs, and what is missing if not.
    ///
    /// Exists so the panel can distinguish "this container cost $0 to bring in" from "nobody
    /// has entered the freight yet" — two states a bare total renders identically, and the
    /// second one is the one that makes a quote wrong.
    /// </summary>
    public static IReadOnlyList<string> MissingForCosting(Shipment shipment, BuyCycle? cycle)
    {
        var missing = new List<string>();

        if (shipment.FreightCost is null) missing.Add(nameof(Shipment.FreightCost));
        if (shipment.CustomsDuty is null) missing.Add(nameof(Shipment.CustomsDuty));
        if (shipment.UsdToEurRate is null) missing.Add(nameof(Shipment.UsdToEurRate));
        if (cycle?.MarkupCoefficient is null) missing.Add(nameof(BuyCycle.MarkupCoefficient));

        return missing;
    }
}
