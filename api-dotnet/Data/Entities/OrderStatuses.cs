using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

/// <summary>
/// Where a customer's order is, in the words the business already uses (owner, 2026-08-19).
///
/// Stable string keys, never display labels — the panel and the public page translate them,
/// so renaming "Пътува" in three languages never touches a row. Same convention as
/// LeadStatuses and PurchaseCategories.
///
/// ORDERED, and the order is the point: this is a timeline a customer reads top to bottom,
/// so the list doubles as the sequence the public page draws. Nothing enforces the order in
/// the database — real orders skip steps and occasionally go backwards, and a state machine
/// that refuses a correction is a state machine staff route around.
/// </summary>
public static class OrderStatuses
{
    /// <summary>Ordered, but nothing has been told to the customer yet.</summary>
    public const string Placed = "placed";

    /// <summary>Being built at the factory.</summary>
    public const string Fabricating = "fabricating";

    /// <summary>Built, and booked onto a sailing.</summary>
    public const string Scheduled = "scheduled";

    /// <summary>On the water. This is where the carrier fields on Purchase earn their keep.</summary>
    public const string Travelling = "travelling";

    /// <summary>Landed at the port, not yet cleared or collected.</summary>
    public const string AtHarbor = "at-harbor";

    /// <summary>Cleared and ready for the customer's delivery date.</summary>
    public const string Ready = "ready";

    /// <summary>With the customer. The end of the public timeline.</summary>
    public const string Delivered = "delivered";

    /// <summary>
    /// Stopped, for whatever reason. Deliberately OUTSIDE the sequence: the public page
    /// shows it as its own state rather than as a step, because a cancelled order that
    /// renders as "somewhere between scheduled and travelling" is worse than silence.
    /// </summary>
    public const string Cancelled = "cancelled";

    /// <summary>The timeline, in order. Cancelled is not in it — see above.</summary>
    public static readonly IReadOnlyList<string> Timeline = new[]
    {
        Placed, Fabricating, Scheduled, Travelling, AtHarbor, Ready, Delivered,
    };

    public static readonly IReadOnlyList<string> All =
        Timeline.Concat(new[] { Cancelled }).ToList();

    public static bool IsValid(string? key) => key is not null && All.Contains(key);

    /// <summary>
    /// How far along the timeline a status is, for drawing progress. -1 for cancelled and
    /// for anything unrecognised, so a caller has to handle "not on the timeline" rather
    /// than getting a plausible 0 that would render as step one.
    /// </summary>
    public static int StepOf(string? key)
    {
        if (key is null) return -1;
        var i = Timeline.ToList().IndexOf(key);
        return i;
    }

    /// <summary>
    /// Whether this status means the goods are travelling, and so whether the carrier
    /// fields are worth showing. AtHarbor counts: the container is still the carrier's
    /// until it clears, and that is exactly when people ask where it is.
    /// </summary>
    public static bool ShowsCarrier(string? key) =>
        key == Travelling || key == AtHarbor;
}
