using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One thing a customer bought, from one factory, for one price.
//
// This is the join between Customer and Factory, and it exists as its own table rather than
// as a FactoryId column on Customer because the interesting facts are all properties of the
// TRANSACTION, not of the person: which factory, which model, what was paid, which invoice.
// A repeat customer gets a second row here and keeps one identity — the alternative is two
// customers sharing an ЕГН, which is the point at which "how much has this client spent
// with us?" stops being answerable.
//
// Deliberately NOT a billing record. There is no VAT, no payment schedule, no ledger and no
// document generation here — that logic is still in Quickbase. This holds what sales knows:
// what was bought, from whom, what has been paid, and where the paperwork is — the two
// проформи and the two фактури a sale produces, plus anything else filed with it (see
// PurchaseFileKinds). When billing moves across it can build on this table instead of
// replacing it.
public class Purchase
{
    public int Id { get; set; }

    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }

    // Which factory it came from. NULLABLE: a sale is frequently recorded before the
    // production order is placed, and refusing to save the customer until someone knows the
    // factory would mean the deposit goes unrecorded to satisfy a constraint.
    public int? FactoryId { get; set; }
    public Factory? Factory { get; set; }

    // --- What they bought -------------------------------------------------------------
    // Same key set as Lead.CategoryKey, and deliberately as loose: mostly gallery
    // categories, but the company also sells containers, logistics and interior fit-outs
    // that the gallery has no filter for. See Lead.CategoryKey for the full reasoning.
    [MaxLength(60)] public string? CategoryKey { get; set; }

    // The catalogue model, when it was one. A real foreign key so the record follows the
    // house when its title is corrected, exactly as on Lead.
    //
    // Null for a modular house: those are custom builds with no catalogue row, and
    // CustomModel below carries the description instead. Also null for anything the gallery
    // does not list.
    public int? HouseId { get; set; }
    public House? House { get; set; }

    // The free-text case — a custom build, a materials order, "two wagons 6m joined".
    [MaxLength(400)] public string? CustomModel { get; set; }

    // --- Money ------------------------------------------------------------------------
    // How many of it. Almost always 1 — a customer buys a house — so a row nobody types a
    // count into DEFAULTS to 1 here, and that default is the only thing that establishes
    // the value: the customer's sheet OWNS this field now (there is a "Брой" box on the
    // purchase card), and an absent quantity in a submission means "leave the stored count
    // alone" rather than "one". See CustomerAdminService.Apply, where writing 1 for an
    // absent quantity is what turned somebody's three wagons back into one every time a
    // phone number was corrected. It exists at all because the archived Sale table tracked
    // it and merging the two (owner, 2026-08-19) must not lose the count on the orders that
    // had one. FinalPrice stays the TOTAL, so unit price is FinalPrice / Quantity, computed
    // in the DTO and stored nowhere: two price columns is exactly the drift this schema
    // refuses everywhere else.
    public int Quantity { get; set; } = 1;

    // decimal(18,2), never double: this is money that appears on an invoice, and binary
    // floating point cannot represent 0.1. Precision is configured in AppDbContext.
    //
    // BOTH NULLABLE, and they mean different things when empty. A null FinalPrice is "not
    // agreed yet", which is a real state for weeks; a null DepositPaid is "nothing has come
    // in". Defaulting either to zero would make "left to pay" confidently wrong — a deal
    // with no agreed price would report the deposit as an overpayment.
    public decimal? DepositPaid { get; set; }
    public decimal? FinalPrice { get; set; }

    // --- What the sale itself cost, all nullable ---------------------------------------
    //
    // Inherited from the archived Sale table, which itemised them because "where does sale
    // money leak?" needs them apart rather than in one blob. Null means "not recorded", not
    // zero — the distinction every money column here keeps.
    public decimal? PaymentFees { get; set; }
    public decimal? TransportCost { get; set; }
    public decimal? InstallationCost { get; set; }
    public decimal? OtherCosts { get; set; }

    // NOTE: there is no LeftToPay column, on purpose. It is FinalPrice - DepositPaid and
    // nothing else, so storing it creates a second copy of a fact that can disagree with
    // the first one — and the copy is what people would read. It is computed in the DTO and
    // recomputed live in the panel as the numbers are typed.

    [MaxLength(8)] public string Currency { get; set; } = "EUR";

    // When the deal was struck. A DATE in practice, stored at midnight UTC like
    // Lead.NextContactAt — purchases are dated in days, and a time component would make
    // "which purchases were in July?" depend on the reader's timezone.
    public DateTimeOffset? PurchasedAt { get; set; }

    // --- Order tracking (ROADMAP #27) --------------------------------------------------
    //
    // What the customer follows. The whole feature hangs off THIS row because a purchase is
    // the only thing that knows both who is waiting and what they are waiting for — which
    // is why Sale was merged into it first rather than built alongside.

    /// <summary>
    /// Where the order is — a key from OrderStatuses. Never null: an order that exists has
    /// been placed, and a null status would render the public page as a blank timeline.
    ///
    /// Also the row's CONCURRENCY TOKEN (see AppDbContext), because moving an order is a
    /// read-modify-write and two people work this board at once.
    /// </summary>
    [MaxLength(30)] public string Status { get; set; } = OrderStatuses.Placed;

    /// <summary>
    /// The unguessable code in the customer's tracking link, minted on demand rather than
    /// at creation — most purchases are recorded long before anyone wants to share a link,
    /// and a code that exists is a code that can leak.
    ///
    /// UNIQUE where present (see AppDbContext). It is the ONLY credential on the public
    /// endpoint, which is why the page it opens shows a status and dates and never a price,
    /// an address or an ЕГН.
    /// </summary>
    [MaxLength(32)] public string? PublicReference { get; set; }

    // The two dates the owner named, and they are ESTIMATES — hence "expected". Both
    // nullable and both shown to the customer as approximate; a date presented as certain
    // and then missed costs more trust than no date at all.
    public DateTimeOffset? ExpectedAtHarbor { get; set; }
    public DateTimeOffset? ExpectedReadyAt { get; set; }

    // --- The carrier, while it is on the water ------------------------------------------
    //
    // Filled in BY HAND today. The owner asked whether the shipping line (Maersk and the
    // like) could feed this automatically: their APIs exist but need a commercial account
    // and credentials this system does not have, so the columns are shaped for a feed to
    // fill later — a carrier name, the number you would type into their tracker, and a
    // free-text note — and staff type them meanwhile. CarrierCheckedAt is what makes the
    // difference visible: it says WHEN the note was last true, so a three-week-old
    // "leaving Singapore" reads as stale rather than as current.
    [MaxLength(120)] public string? CarrierName { get; set; }
    [MaxLength(120)] public string? TrackingReference { get; set; }
    [MaxLength(400)] public string? CarrierNote { get; set; }
    public DateTimeOffset? CarrierCheckedAt { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    public List<PurchaseFile> Files { get; set; } = new();
}
