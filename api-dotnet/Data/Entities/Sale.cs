using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One sale to one customer: this many of a thing, at this price, with the costs the sale
// itself incurred.
//
// WHAT THIS WAS, AND WHAT IT IS NOW. It began (2026-08-19) as the sell side of the
// procurement ledger — every sale named the container line its goods came off, and cost of
// goods came from that lot's landed cost. The team pulled the buy side the same day
// (_archive/billing-2026-08-19/), and the owner's instruction was that this table stays,
// "only to be used with the customer table nothing else for now". So the lot link, the
// COGS and the margin left with it; what remains is revenue and the costs of selling.
//
// ⚠ IT NOW OVERLAPS `Purchase`, AND THAT IS AN OPEN DECISION, NOT A DESIGN.
// `Purchase` is the older customer-facing record: one thing a customer bought, from one
// factory, with deposit, final price and the two invoices. This is the same event counted
// differently — a quantity, a unit price, and four columns of sale expenses. Two tables
// answering "what did this customer buy?" is precisely the shape this codebase refuses
// everywhere else (see Purchase's own note on why it is not a billing record, and the
// 73 m² incident in the prices page). Before anything else is built on either — order
// tracking above all, which needs ONE row to hang a status off — the two should become
// one. The recommendation on the table: keep `Purchase`, move the columns this has that it
// lacks (Quantity, UnitSalePrice, the four expense columns) onto it, and retire this.
public class Sale
{
    public int Id { get; set; }

    // Quickbase Record ID# (3) — from the 2026-08-19 import of the QB Sales table. Kept so
    // the 30 imported rows stay identifiable, and so a re-import could still recognise
    // them; nothing writes it now that the importer is archived.
    public long? QuickbaseRecordId { get; set; }

    // Who bought it. THE link, now that the container line is gone.
    //
    // NULLABLE for one reason, and it is history rather than design: the 30 sales imported
    // from Quickbase point at a customer table ours was never imported from, so they carry
    // the QB customer NAME in Notes instead of a foreign key. Requiring the column would
    // have meant either inventing links or dropping the revenue history. New sales are
    // required to name a customer — see SaleAdminService.Validate — so the nullability is
    // a fact about the past, not a licence for the future.
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    // What was sold, in words. Free text on purpose: the catalogue link lived on the
    // archived ProductModel, and a sale of "two wagons joined" was never a catalogue row
    // anyway — the same reasoning as Purchase.CustomModel.
    [MaxLength(400)] public string? Description { get; set; }

    // A date at midnight UTC, same convention as Purchase.PurchasedAt: sales are dated in
    // days, and a monthly total must not depend on the reader's timezone.
    public DateTimeOffset SoldAt { get; set; }

    // Greater than zero, enforced in validation.
    public int Quantity { get; set; }

    // EUR. Zero is legitimate (a warranty replacement earns nothing), negative is not.
    public decimal UnitSalePrice { get; set; }

    // --- What the sale itself cost, all EUR, all nullable -----------------------------
    //
    // Null means "not recorded", not zero — the same distinction every money column in this
    // schema keeps. Four columns rather than one blob because "where does sale money leak?"
    // needs them apart.
    public decimal? PaymentFees { get; set; }
    public decimal? TransportCost { get; set; }
    public decimal? InstallationCost { get; set; }
    public decimal? OtherCosts { get; set; }

    // NOTE: no SaleAmount and no profit columns. Amount is qty × price and expenses are
    // their own sum; stored, each becomes a second copy that drifts — the same rule as
    // Purchase.LeftToPay. Both are computed in the DTO.
    //
    // COGS and margin are simply GONE rather than computed: they came from the landed cost
    // of the container line, and there is no container line any more. A margin figure
    // without a cost basis would be a guess wearing a number's clothes.

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }
}
