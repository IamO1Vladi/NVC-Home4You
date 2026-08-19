using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One sale of goods out of a container: this many units of that lot, at this price, with
// the costs the sale itself incurred.
//
// The phase-2 half of ROADMAP #21, and the table stock-on-hand falls out of: what a lot
// holds minus what its sales took is what is left in the yard. Quickbase ran exactly this
// shape (its Sales table, bvuz3pj9w) and the owner confirmed the design twice — "that is
// the idea, to be able to track what we have in stock as well".
//
// DELIBERATELY NOT A RIVAL TO Purchase. Purchase is the customer-facing sales record —
// deposits, invoices, the negotiation. This is the PROCUREMENT ledger's view: which
// container line the goods physically came from, and what the transaction really earned
// once its own costs are counted. The two meet through CustomerId today and can grow a
// direct link when the sales workflow starts creating both at once.
public class Sale
{
    public int Id { get; set; }

    // Quickbase Record ID# (3) — idempotent import, as on Shipment.
    public long? QuickbaseRecordId { get; set; }

    // The container line the goods came off. REQUIRED: a sale that names no lot cannot
    // subtract from stock, which is the one job this table exists to do. Restrict on the
    // FK — see AppDbContext; a lot with sales against it is history, not clutter.
    public int PurchaseLotId { get; set; }
    public PurchaseLot? PurchaseLot { get; set; }

    // Who bought it, when known. Nullable for the imported history: Quickbase's customer
    // rids point at a table ours was never imported from, so machine-matching would mint
    // wrong foreign keys — the QB customer NAME rides in Notes instead, and staff link the
    // right customer when it matters.
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    // A date at midnight UTC, same convention as Purchase.PurchasedAt: sales are dated in
    // days, and the monthly revenue rollup must not depend on the reader's timezone.
    public DateTimeOffset SoldAt { get; set; }

    // Greater than zero, enforced in validation. Stock arithmetic with a zero-quantity
    // sale is a row that quietly does nothing.
    public int Quantity { get; set; }

    // EUR — the sell side is the reporting currency, so unlike the buy side there is no
    // rate here and nothing to convert. Zero is legitimate (a warranty replacement leaves
    // stock without earning), negative is not.
    public decimal UnitSalePrice { get; set; }

    // --- What the sale itself cost, all EUR, all nullable -----------------------------
    //
    // Null means "not recorded", not zero — the same distinction every money column in
    // this schema keeps. These are the costs Quickbase itemised, kept as four columns
    // rather than one blob because the dashboard's "where does sale money leak?" question
    // needs them apart.
    public decimal? PaymentFees { get; set; }
    public decimal? TransportCost { get; set; }        // QB: Bulgarian Transport
    public decimal? InstallationCost { get; set; }     // QB: Building / Installation
    public decimal? OtherCosts { get; set; }

    // NOTE: no SaleAmount, no COGS, no profit columns. Amount is qty × price; COGS is
    // qty × the lot's landed unit cost, which LandedCost computes from the container it
    // rode in; profit is the difference. Stored, each would be a second copy that drifts —
    // the same rule as Purchase.LeftToPay and Shipment's missing GoodsCost, and the same
    // reason Quickbase could keep its formula columns honest: they were never stored.

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }
}
