using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One move of one order, dated, with the person who made it.
//
// There is NO carrier account and there will not be one (owner, 2026-08-20): a member of
// staff walks every order down the timeline by hand from the Поръчки board. That decision is
// what makes this table necessary rather than nice to have. Purchase.Status only ever holds
// where the order is NOW, so "when did it actually reach the harbour?" has no answer unless
// the move is written down at the moment somebody makes it — nothing reconstructs it later.
//
// It buys two things. The customer's page stops being a list of words and becomes a dated
// timeline, which is the difference between "travelling" and "travelling since 4 August".
// And the office gets an answer to "has anyone touched this order in three weeks?" — the
// failure mode a hand-updated board actually has, which is not a wrong status but a status
// nobody has looked at since.
//
// APPEND-ONLY, and unlike LeadActivity that is not merely a rule about how the service
// writes: nothing in the codebase updates or deletes a row here. The only thing that removes
// one is the cascade from its own purchase, because a history of an order that no longer
// exists describes nothing.
//
// Not audited, deliberately — see AuditedEntities. This IS a history, and it already records
// its own actor on every row.
public class OrderStatusEvent
{
    public int Id { get; set; }

    public int PurchaseId { get; set; }
    public Purchase? Purchase { get; set; }

    /// <summary>Where it moved TO — a key from OrderStatuses, never a display label.</summary>
    [MaxLength(30)] public string Status { get; set; } = "";

    /// <summary>
    /// When the move was made, which for a hand-worked board is when somebody pressed save.
    /// That is an honest answer and the only one available; see the no-backfill note below.
    /// </summary>
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Who moved it, as an Entra UPN — same convention as LeadActivity.ActorUpn and
    /// AuditEntry.ActorUpn.
    ///
    /// NULL MEANS THE SYSTEM did it, not that the actor was lost: no automation writes here
    /// today, so a null row is one written by a caller that had no signed-in user. It never
    /// reaches the customer — PublicOrderDto carries the dates and not the names.
    /// </summary>
    [MaxLength(320)] public string? ChangedByUpn { get; set; }

    // NO BACKFILL for orders that predate this table. They simply have no history and the
    // page draws their steps undated. Deriving a ChangedAt from Purchase.UpdatedAt would put
    // a date in front of a customer that nobody ever observed — the same invention this
    // codebase refuses when it declines to store LeftToPay.
}
