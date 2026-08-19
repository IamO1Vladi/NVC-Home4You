using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// A buying cycle — the period the business plans and reports procurement in.
//
// Everything on the buy side hangs off one of these: a container belongs to a cycle, and a
// cycle is what "how did we do?" is asked about, alongside the month and the year. It exists
// as a table rather than as a date range computed on the fly because of the two coefficients
// below, which are properties of the cycle and of nothing else.
//
// NOT tied to the calendar. A cycle can straddle a month or a year end — StartDate and
// EndDate say what it covered and nothing derives the boundaries from them, so a cycle that
// runs mid-November to mid-February is recordable without argument.
public class BuyCycle
{
    public int Id { get; set; }

    // What people call it out loud — "2026 C1". Required, because a cycle nobody can name is
    // a row nobody can pick out of a dropdown.
    [Required]
    [MaxLength(100)] public string Label { get; set; } = "";

    // Dates at midnight UTC, same convention as Purchase.PurchasedAt: a cycle is bounded in
    // days, and a time component would make "which cycle was this in?" depend on who is
    // asking and from where.
    //
    // Both nullable. A cycle is frequently opened before anyone knows when it ends, and
    // refusing to save it until someone invents an end date means the first container gets
    // recorded against nothing.
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }

    // --- The pricing coefficients -----------------------------------------------------
    //
    // THESE ARE DATA, NOT CODE, AND THAT IS THE WHOLE REASON THIS TABLE EXISTS. The markup
    // and the border VAT rate change between cycles; if they lived in a constant somewhere,
    // recomputing last year's dashboard would silently reprice last year's containers with
    // this year's numbers, and the report would change every time the business did.
    //
    // Held on the cycle and defaulted from the previous one when a cycle is created, so a
    // closed cycle reproduces its own figures forever.
    //
    // The formula they feed (confirmed with the owner 2026-08-17) is:
    //
    //     LandedBase = SUM(lot.Quantity * lot.UnitCost) + Freight + Customs + Other
    //     Price      = LandedBase * MarkupCoefficient  +  LandedBase * BorderVatRate
    //
    // VAT applies to the whole landed value, customs included — not to the goods alone.
    // Both terms multiply the same base, so it collapses to LandedBase * (Markup + Vat);
    // it is written as two fields anyway because they are two separate business facts that
    // move independently, and a single combined coefficient could not be explained to an
    // accountant.
    //
    // decimal(9,4): 2.7000 and 0.2000 are the current values, and four decimal places is
    // enough for a rate quoted in basis points without inviting a float.
    public decimal? MarkupCoefficient { get; set; }
    public decimal? BorderVatRate { get; set; }

    // A closed cycle drops out of the "add a shipment" dropdown. Nothing is refused, deleted
    // or made read-only — the same soft-retire as Factory.IsActive, for the same reason:
    // "we have stopped buying in this cycle" is a different statement from "it never
    // happened", and a late-arriving invoice against a closed cycle is a real event.
    public bool IsClosed { get; set; }

    // NVARCHAR(MAX), never indexed. What went wrong, who to chase, why the markup moved.
    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    // Entra UPN, same free-text convention as Factory.UpdatedByUpn — there is no user table.
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }

    public List<Shipment> Shipments { get; set; } = new();
}
