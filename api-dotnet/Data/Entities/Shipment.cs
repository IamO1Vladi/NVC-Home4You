using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One container, from ordered to arrived, with the costs that turn a factory price into a
// landed one.
//
// The shipment is where freight, customs and the exchange rate live, because those are facts
// about the crossing rather than about any single item inside it — a lot knows what it cost
// at the factory gate, and nothing more.
public class Shipment
{
    public int Id { get; set; }

    // Quickbase Record ID# (3). Makes the import idempotent — a re-run updates nothing
    // and creates nothing that already came across. Null for rows created in the panel,
    // and for every row once Quickbase is gone. Same convention as House and Lead.
    public long? QuickbaseRecordId { get; set; }

    // Required. A container that belongs to no cycle cannot appear in any report, which
    // makes it a row that silently does not count.
    public int BuyCycleId { get; set; }
    public BuyCycle? BuyCycle { get; set; }

    // The container or bill-of-lading number — how this shipment is identified in every
    // conversation with the freight forwarder. Not unique in the database: forwarders reuse
    // references across years, and a unique index would turn a legitimate second container
    // into a save that fails with no way to see what it collided with. Same call as
    // Factory.Name and Customer.Eik; the panel warns instead.
    [MaxLength(100)] public string? Reference { get; set; }

    // Who built what is inside it. REUSES the existing supplier directory rather than
    // introducing a second one — the whole point of Factory is that a supplier has one
    // spelling. Nullable for the same reason it is nullable on Purchase: the shipment is
    // often recorded before the paperwork names the factory.
    public int? FactoryId { get; set; }
    public Factory? Factory { get; set; }

    // --- The costs of the crossing, ALL IN USD --------------------------------------
    //
    // The buy side is transacted in dollars and stored as paid; see UsdToEurRate below for
    // why nothing here is converted on the way in.
    //
    // All nullable, and null means "not known yet" rather than zero. A container in transit
    // has no customs figure for weeks, and defaulting that to zero would report a landed
    // cost that is confidently too low — the number a person would then quote from.
    public decimal? FreightCost { get; set; }

    // Duty, which is NOT VAT. Kept apart from ImportVatPaid because they are assessed on
    // different bases by different rules, and the pricing formula uses duty in the landed
    // base while VAT is applied to that base — collapsing the two would double-count.
    public decimal? CustomsDuty { get; set; }

    // What the border ACTUALLY assessed, as opposed to what BuyCycle.BorderVatRate predicts.
    // Recorded because the two disagree in practice, and the difference is the only way to
    // find out that the rate on the cycle has drifted from reality. Deliberately not used in
    // the price formula — that uses the rate, so a quote does not wait on a customs bill.
    public decimal? ImportVatPaid { get; set; }

    [MaxLength(400)] public string? OtherCostsNote { get; set; }
    public decimal? OtherCosts { get; set; }

    // --- Where it is ------------------------------------------------------------------
    //
    // NO STATUS COLUMN, on purpose. Status is derivable from which of these are filled in:
    // ordered but not departed, departed but not arrived, arrived. A status column alongside
    // them is a second copy of that fact which people then edit independently, and lead-time
    // reporting ("how long from order to arrival, on average?") falls out of the dates for
    // free while it cannot be computed from a status at all.
    public DateTimeOffset? OrderedAt { get; set; }
    public DateTimeOffset? DepartedAt { get; set; }
    public DateTimeOffset? ArrivedAt { get; set; }

    // --- The exchange rate, ON THE SHIPMENT -------------------------------------------
    //
    // The buy side is USD; every report is EUR. The rate lives here, on the individual
    // container, and NOT as one global setting — that is the load-bearing decision in this
    // table.
    //
    // A single current rate would re-value every historical container each time it moved, so
    // last quarter's landed costs would change overnight without anyone touching the data.
    // A rate captured per shipment makes every past cycle reproducible forever, which is the
    // property a financial report needs most.
    //
    // decimal(18,6): FX is quoted to more places than money is.
    public decimal? UsdToEurRate { get; set; }

    // Where the rate came from and when it was taken — "ECB 2026-08-14", "bank, on the
    // transfer". An audit trail for the one number nobody can re-derive later.
    [MaxLength(200)] public string? RateSource { get; set; }
    public DateTimeOffset? RateAt { get; set; }

    // NOTE, and this is deliberate: there is NO GoodsCost column and NO EUR columns.
    //
    // GoodsCost is SUM(lot.Quantity * lot.UnitCost) and EUR is USD * rate. Stored, each
    // becomes a second copy of a computed fact — and the copy is the one people read, so it
    // is the copy that is wrong after somebody edits a lot. Same rule as Purchase.LeftToPay.
    // Both are computed in the DTO.

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }

    public List<PurchaseLot> Lots { get; set; } = new();
}
