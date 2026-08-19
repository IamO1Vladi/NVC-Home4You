using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// What the business spends that is not a container: salaries, rent, fuel, marketing, fees.
//
// The other half of the dashboard. Procurement tells you what the goods cost; this tells you
// what it cost to be open that month, and the two together are the only way "did we make
// money in July?" has an answer.
public class OperatingExpense
{
    public int Id { get; set; }

    // Quickbase Record ID# (3) — idempotent import, as on Shipment.
    public long? QuickbaseRecordId { get; set; }

    // Required, and the column the monthly rollup is driven by — hence "spent at" rather
    // than "created at": an invoice entered in September for August rent is August's cost.
    // Midnight UTC, same date convention as everywhere else.
    public DateTimeOffset SpentAt { get; set; }

    // A stable key from ExpenseCategories, served to the panel by the API rather than
    // hard-coded in the SPA — two hand-maintained copies of a key list drift, and the
    // failure is silent. Same reasoning as PurchaseCategories.
    [MaxLength(60)] public string? CategoryKey { get; set; }

    // EUR. Unlike the procurement tables there is no rate here and no conversion: opex is
    // incurred in the reporting currency already, so storing a rate would be recording an
    // exchange that never happened.
    public decimal Amount { get; set; }

    // Nullable, and null means "not broken out" rather than zero — plenty of expenses arrive
    // as a single figure with no VAT line, and calling that zero VAT would be a claim the
    // receipt does not make.
    public decimal? VatAmount { get; set; }

    [MaxLength(400)] public string? Description { get; set; }

    // Who submitted it, from day one — an Entra UPN, same free-text convention as
    // Factory.UpdatedByUpn.
    //
    // Present now although everything is entered through the panel, because this is the
    // column the field-builder mobile app writes when it arrives (ON HOLD as of 2026-08-17,
    // not cancelled). Adding it later would mean either backfilling every existing row with
    // a guess or reporting "submitted by: unknown" for the whole history before the app
    // shipped. It costs one column now to avoid that.
    [MaxLength(320)] public string? SubmittedByUpn { get; set; }

    // The cycle this expense belongs to, when the person entering it says so.
    //
    // The first draft deliberately omitted this ("opex is monthly; a cycle view is a
    // date-range query") and the owner reversed it on 2026-08-19 — with the deciding fact
    // coming from the Quickbase schema itself: its Buy Cycles table has NO end-date column,
    // so the explicit link is the only way cycle attribution has ever existed, and 81
    // historical rows carry it. Dropping it at import would destroy information nothing
    // can reconstruct.
    //
    // NULLABLE, and null is normal: rent belongs to no container cycle, and forcing a
    // choice at entry time is how wrong attributions happen.
    public int? BuyCycleId { get; set; }
    public BuyCycle? BuyCycle { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }
}
