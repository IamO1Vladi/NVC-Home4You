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

    // DELIBERATELY NO BuyCycleId. Opex is monthly by nature — rent is not a property of a
    // container-buying cycle — and "what did this cycle cost us to run?" is a date-range
    // query against SpentAt using the cycle's own start and end. A foreign key here would
    // force every expense to be attributed to a cycle at entry time, which is a decision the
    // person typing it does not have and would get wrong.

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }
}
