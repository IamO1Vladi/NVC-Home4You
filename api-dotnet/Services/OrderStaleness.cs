using System;
using System.Collections.Generic;
using System.Linq;
using Data.Entities;

namespace Services;

/// <summary>
/// When an order that is supposed to be moving has been silent long enough to say so — the
/// board's „Без движение" badge, and the weekly order digest (#27).
///
/// THE SAME RULE IN TWO PLACES, on purpose and pinned. The board computes it in the browser
/// (STALE_AFTER_DAYS, MOVING_STATUSES and stalledFor in AdminOrdersPage.jsx), because it
/// re-renders the moment an order moves; the digest computes it here, because it runs at
/// eight on a Monday morning with no browser anywhere. Two copies of a rule drift apart
/// without a sound, and then the badge on screen and the email in the inbox disagree about
/// which orders are stuck — so OrderDigestTests reads the JSX and fails when the number or
/// the status list differ. Change both in the same commit; the reasoning for each choice
/// lives beside the JSX copy, where the argument about the number is expected to happen.
/// </summary>
public static class OrderStaleness
{
    /// <summary>More than this many whole days silent is stale. Mirrors STALE_AFTER_DAYS.</summary>
    public const int StaleAfterDays = 14;

    /// <summary>
    /// The statuses where silence is a problem — something out in the world is supposed to
    /// be happening. 'placed' is waiting on US rather than on the world; 'delivered' and
    /// 'cancelled' are finished. Mirrors MOVING_STATUSES.
    /// </summary>
    public static readonly IReadOnlyList<string> MovingStatuses = new[]
    {
        OrderStatuses.Fabricating,
        OrderStatuses.Scheduled,
        OrderStatuses.Travelling,
        OrderStatuses.AtHarbor,
        OrderStatuses.Ready,
    };

    /// <summary>
    /// Whole days since a moment, floored — the board's daysSince, to the day. Null when
    /// there is no moment to count from.
    /// </summary>
    public static int? DaysSince(DateTimeOffset? then, DateTimeOffset now) =>
        then is null ? null : (int)Math.Floor((now - then.Value).TotalDays);

    /// <summary>
    /// How long this order has been silent, or null when that is not a fair question to ask
    /// of it: a status where silence is normal, or no date on file to have been silent since
    /// (orders older than the history table, or one recorded ten minutes ago). Measured from
    /// the last time anybody touched it — a move OR a carrier note, see OrderRowDto's
    /// LastTouchedAt — so the best-kept order sailing for six weeks is never called stuck.
    /// </summary>
    public static int? StalledFor(string? status, DateTimeOffset? lastTouchedAt, DateTimeOffset now)
    {
        if (status is null || !MovingStatuses.Contains(status)) return null;
        var days = DaysSince(lastTouchedAt, now);
        return days is int d && d > StaleAfterDays ? d : null;
    }
}
