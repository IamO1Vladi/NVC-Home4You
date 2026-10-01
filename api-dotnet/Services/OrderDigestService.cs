using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>One active order as the digest lists it.</summary>
public sealed record OrderDigestLine(
    int PurchaseId,
    string CustomerName,
    string? Model,
    int Quantity,
    string Status,
    // Null unless the board would badge it „Без движение" — see OrderStaleness.
    int? StalledDays,
    // When anybody last touched it (a move or a carrier note); null when nothing is on file.
    DateTimeOffset? LastTouchedAt,
    string? ExpectedReadyAt);

/// <summary>The week's digest: the stuck orders first, then every other active one.</summary>
public sealed record OrderDigest(IReadOnlyList<OrderDigestLine> Stalled, IReadOnlyList<OrderDigestLine> Moving)
{
    public int ActiveCount => Stalled.Count + Moving.Count;
}

/// <summary>
/// The weekly order digest (#27): every active order on the board, the stuck ones on top,
/// mailed to the person who moves them.
///
/// Why it exists, in the owner's terms (decided 2026-09-11, scheduled 2026-09-30): the board
/// is hand-worked — tbonin@ moves every order along — and a hand-worked board does not fail
/// by showing a wrong status, it fails by showing an old one nobody has questioned. A stale
/// public tracking page is worse than none. So once a week the board comes to him, with the
/// work already sorted, instead of waiting to be opened.
///
/// THE EMAIL CARRIES THE WORK, NOT THE RECORD: who, what, where it stands, how long it has
/// been silent. No money, no phone, no address — the same rule LeadFollowUpService keeps,
/// for the same reason: an inbox has none of the panel's protection, and the board is one
/// link away. Bulgarian only: it goes to two people who read the panel in Bulgarian.
/// </summary>
public sealed class OrderDigestService
{
    /// <summary>
    /// Where the email points. A constant rather than the request's origin (which the due
    /// report uses) because there is no request: this runs from a timer.
    /// </summary>
    public const string BoardUrl = GallerySlugs.SiteUrl + "/admin/orders";

    // The board's own Bulgarian labels (AdminOrdersPage.jsx, TEXT.bg.statuses), so the email
    // and the screen it links to call each step by the same name. OrderDigestTests checks
    // every one still appears in the JSX.
    public static readonly IReadOnlyDictionary<string, string> StatusLabels = new Dictionary<string, string>
    {
        [OrderStatuses.Placed] = "Приета",
        [OrderStatuses.Fabricating] = "В производство",
        [OrderStatuses.Scheduled] = "Насрочена за товарене",
        [OrderStatuses.Travelling] = "Пътува",
        [OrderStatuses.AtHarbor] = "На пристанище",
        [OrderStatuses.Ready] = "Готова за доставка",
        [OrderStatuses.Delivered] = "Доставена",
        [OrderStatuses.Cancelled] = "Отказана",
    };

    private readonly OrderTrackingService _orders;
    private readonly EmailService _email;
    private readonly EnvConfig _env;
    private readonly ILogger<OrderDigestService> _log;

    public OrderDigestService(
        OrderTrackingService orders, EmailService email, EnvConfig env, ILogger<OrderDigestService> log)
    {
        _orders = orders;
        _email = email;
        _env = env;
        _log = log;
    }

    public enum DigestOutcome { Sent, NothingActive, NotConfigured, NoRecipients, Failed }

    public sealed record DigestResult(
        DigestOutcome Outcome, int Active, int Stalled, IReadOnlyCollection<string> Recipients, string? Error)
    {
        /// <summary>
        /// Done for this week. "Nothing active" counts: there was nothing to say, and saying
        /// nothing IS the answer — retrying it every hour would only ask the same question.
        /// </summary>
        public bool Done => Outcome is DigestOutcome.Sent or DigestOutcome.NothingActive;
    }

    /// <summary>The digest as it stands right now, read from the same query the board uses.</summary>
    public async Task<OrderDigest> BuildAsync(DateTimeOffset now, CancellationToken ct) =>
        Compose(await _orders.ListAsync(null, ct), now);

    /// <summary>
    /// Builds and sends it.
    ///
    /// No active orders means no email — a Monday message saying "nothing to do" is how a
    /// report becomes something people filter out of their inbox, taking the useful weeks
    /// with it (the due report's rule). Checked before the mail settings, so a quiet week is
    /// reported as quiet rather than as a configuration problem.
    /// </summary>
    public async Task<DigestResult> SendAsync(DateTimeOffset now, CancellationToken ct)
    {
        var recipients = EmailService.ParseRecipients(_env.OrderDigestTo);
        var digest = await BuildAsync(now, ct);

        if (digest.ActiveCount == 0)
            return new DigestResult(DigestOutcome.NothingActive, 0, 0, recipients, null);

        if (!_email.IsConfigured)
            return new DigestResult(DigestOutcome.NotConfigured, digest.ActiveCount, digest.Stalled.Count,
                recipients, "Email is not configured.");

        if (recipients.Count == 0)
            return new DigestResult(DigestOutcome.NoRecipients, digest.ActiveCount, digest.Stalled.Count,
                recipients, "ORDER_DIGEST_TO resolves to no address.");

        var sent = await _email.TrySendInternalReportAsync(recipients, Subject(digest), Html(digest, now), ct);
        if (!sent)
        {
            _log.LogError("Order digest ({Active} active, {Stalled} stalled) could not be sent to {To}",
                digest.ActiveCount, digest.Stalled.Count, string.Join(", ", recipients));
            return new DigestResult(DigestOutcome.Failed, digest.ActiveCount, digest.Stalled.Count,
                recipients, "The digest was not sent.");
        }

        _log.LogInformation("Order digest sent to {To}: {Active} active, {Stalled} without movement",
            string.Join(", ", recipients), digest.ActiveCount, digest.Stalled.Count);
        return new DigestResult(DigestOutcome.Sent, digest.ActiveCount, digest.Stalled.Count, recipients, null);
    }

    /// <summary>
    /// The board's rows, reduced to the active ones and put in the order they get worked.
    ///
    /// Stuck first, longest-silent at the top: that list IS the job. Then everything still
    /// moving, nearest the customer first — an order at the harbour is closer to a phone call
    /// than one still at the factory.
    /// </summary>
    public static OrderDigest Compose(IEnumerable<OrderRowDto> rows, DateTimeOffset now)
    {
        var lines = rows
            .Where(r => r.Status is not (OrderStatuses.Delivered or OrderStatuses.Cancelled))
            .Select(r =>
            {
                var touched = ParseMoment(r.LastTouchedAt);
                return new OrderDigestLine(
                    r.PurchaseId,
                    r.CustomerName,
                    r.Model,
                    r.Quantity,
                    r.Status,
                    OrderStaleness.StalledFor(r.Status, touched, now),
                    touched,
                    r.ExpectedReadyAt);
            })
            .ToList();

        var stalled = lines
            .Where(l => l.StalledDays is not null)
            .OrderByDescending(l => l.StalledDays)
            .ThenBy(l => l.CustomerName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        var moving = lines
            .Where(l => l.StalledDays is null)
            .OrderByDescending(l => TimelineIndex(l.Status))
            .ThenBy(l => l.CustomerName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        return new OrderDigest(stalled, moving);
    }

    /// <summary>What the recipient sees before opening anything: is there work in it or not.</summary>
    //
    // The calm variant says what the rule found — none stuck — and not "all moving": the
    // second list also holds what the rule declines to judge ('placed', orders with nothing
    // on file), and a subject promising movement would be claiming something it never checked.
    public static string Subject(OrderDigest digest)
    {
        var active = digest.ActiveCount == 1 ? "1 активна" : $"{digest.ActiveCount} активни";
        return digest.Stalled.Count > 0
            ? $"NVC · Поръчки: {digest.Stalled.Count} без движение от {active}"
            : $"NVC · Поръчки: {active}, нито една без движение";
    }

    /// <summary>
    /// The email. Plain rows, the due report's look: it is read on a phone and forwarded,
    /// and both go better with less. Colour never carries meaning on its own — every flag is
    /// also in words, for clients that strip styles.
    /// </summary>
    public static string Html(OrderDigest digest, DateTimeOffset now)
    {
        var sb = new StringBuilder();
        sb.Append("""<div style="font-family:Segoe UI,Arial,sans-serif;color:#1b2530;max-width:640px">""");

        sb.Append(CultureInfo.InvariantCulture,
            $"""
             <h2 style="margin:0 0 4px;font-size:19px">Поръчки — седмичен преглед</h2>
             <p style="margin:0 0 18px;color:#5a6572;font-size:14px">
               {digest.ActiveCount} {(digest.ActiveCount == 1 ? "активна поръчка" : "активни поръчки")}
               към {Escape(SofiaDate(now))}.
             </p>
             """);

        if (digest.Stalled.Count > 0)
        {
            sb.Append(CultureInfo.InvariantCulture,
                $"""
                 <h3 style="margin:0 0 6px;font-size:16px;color:#b4232a">
                   Без движение — над {OrderStaleness.StaleAfterDays} дни ({digest.Stalled.Count})
                 </h3>
                 <p style="margin:0 0 8px;color:#5a6572;font-size:13px">
                   Нито смяна на статуса, нито бележка от превозвача. Проверете ги първо.
                 </p>
                 """);
            AppendTable(sb, digest.Stalled, stalled: true, now);
        }

        if (digest.Moving.Count > 0)
        {
            sb.Append(CultureInfo.InvariantCulture,
                $"""
                 <h3 style="margin:{(digest.Stalled.Count > 0 ? "22px" : "0")} 0 6px;font-size:16px">
                   {(digest.Stalled.Count > 0 ? "Останалите активни" : "Активни")} ({digest.Moving.Count})
                 </h3>
                 """);
            AppendTable(sb, digest.Moving, stalled: false, now);
        }

        sb.Append(CultureInfo.InvariantCulture,
            $"""
             <p style="margin:22px 0 0">
               <a href="{BoardUrl}"
                  style="display:inline-block;padding:11px 18px;background:#1b5e8f;color:#fff;
                         border-radius:8px;text-decoration:none;font-weight:600">
                 Отвори Поръчки
               </a>
             </p>
             <p style="margin:16px 0 0;color:#8a93a0;font-size:12px">
               Изпраща се всеки понеделник от административния панел на NVC-HOME4YOU.
             </p>
             </div>
             """);

        return sb.ToString();
    }

    private static void AppendTable(StringBuilder sb, IReadOnlyList<OrderDigestLine> lines, bool stalled, DateTimeOffset now)
    {
        sb.Append("""<table style="border-collapse:collapse;width:100%;font-size:14px">""");
        foreach (var line in lines)
        {
            // Only the model is data and gets escaped; the count suffix is ours.
            var what = Escape(string.IsNullOrWhiteSpace(line.Model) ? "—" : line.Model!);
            if (line.Quantity > 1) what += $" × {line.Quantity} бр.";

            sb.Append(CultureInfo.InvariantCulture,
                $"""
                 <tr>
                   <td style="padding:10px 0;border-bottom:1px solid #e3e8ee">
                     <div style="font-weight:600;font-size:15px">{Escape(line.CustomerName)}</div>
                     <div style="color:#5a6572;font-size:13px;margin-top:2px">{what} · {Escape(Label(line.Status))}</div>
                     <div style="color:{(stalled ? "#b4232a" : "#5a6572")};font-size:13px;margin-top:2px">{Escape(Silence(line, stalled, now))}</div>
                   </td>
                 </tr>
                 """);
        }
        sb.Append("</table>");
    }

    // The one line that says why this order is on the list.
    private static string Silence(OrderDigestLine line, bool stalled, DateTimeOffset now)
    {
        var parts = new List<string>();
        if (stalled) parts.Add($"Без движение {line.StalledDays} дни");
        else if (line.LastTouchedAt is not DateTimeOffset touched) parts.Add("Няма записано движение");
        // "Актуализация", not "движение": the clock counts carrier notes as well as moves,
        // and calling a phone call to Maersk a movement would be the email lying.
        //
        // CALENDAR days in Sofia, not elapsed 24-hour periods. "днес" and "преди 3 дни" name
        // days on a wall calendar; counted in periods, a Sunday-afternoon note read at eight
        // on Monday would be "today" and Friday's move "2 days ago". The stuck rule keeps the
        // board's floored periods — that is parity — but these words are for a person.
        else parts.Add(CalendarDaysBetween(touched, now) switch
        {
            <= 0 => "Последна актуализация: днес",
            1 => "Последна актуализация: вчера",
            var d => $"Последна актуализация: преди {d} дни",
        });

        if (FormatDate(line.ExpectedReadyAt) is string ready) parts.Add($"очаквана готовност {ready}");
        return string.Join(" · ", parts);
    }

    // Wall-calendar days between two moments, both read in Sofia: Sunday 15:00 → Monday 08:00
    // is 1 ("вчера"), however few hours apart they are.
    private static int CalendarDaysBetween(DateTimeOffset earlier, DateTimeOffset later) =>
        (TimeZoneInfo.ConvertTime(later, OrderDigestSchedule.Sofia).Date
         - TimeZoneInfo.ConvertTime(earlier, OrderDigestSchedule.Sofia).Date).Days;

    private static string Label(string status) =>
        StatusLabels.TryGetValue(status, out var label) ? label : status;

    private static int TimelineIndex(string status) => OrderStatuses.Timeline.ToList().IndexOf(status);

    private static DateTimeOffset? ParseMoment(string? iso) =>
        DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var at)
            ? at
            : null;

    // "2026-09-20" → "20.09.2026", the way the office writes a date.
    private static string? FormatDate(string? isoDate) =>
        DateTime.TryParseExact(isoDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture)
            : null;

    private static string SofiaDate(DateTimeOffset now) =>
        TimeZoneInfo.ConvertTime(now, OrderDigestSchedule.Sofia).ToString("dd.MM.yyyy", CultureInfo.InvariantCulture);

    private static string Escape(string value) => WebUtility.HtmlEncode(value);
}

/// <summary>
/// When the digest is due: Mondays at 08:00, Sofia time (owner, 2026-09-30).
///
/// Computed in Sofia's own clock rather than as "every 7 × 24 hours", so it stays at eight
/// across the two daylight-saving changes a year instead of drifting to seven or nine.
/// </summary>
public static class OrderDigestSchedule
{
    public static readonly TimeZoneInfo Sofia = FindSofia();

    private const DayOfWeek SlotDay = DayOfWeek.Monday;
    private static readonly TimeSpan SlotTime = TimeSpan.FromHours(8);

    /// <summary>The most recent Monday 08:00 in Sofia at or before <paramref name="now"/>.</summary>
    public static DateTimeOffset MostRecentSlot(DateTimeOffset now)
    {
        var local = TimeZoneInfo.ConvertTime(now, Sofia);
        var daysBack = ((int)local.DayOfWeek - (int)SlotDay + 7) % 7;
        var slot = AtSofia(local.Date.AddDays(-daysBack) + SlotTime);
        if (slot > now) slot = AtSofia(local.Date.AddDays(-daysBack - 7) + SlotTime);
        return slot;
    }

    /// <summary>The first Monday 08:00 in Sofia strictly after <paramref name="now"/>.</summary>
    public static DateTimeOffset NextSlot(DateTimeOffset now)
    {
        // A week on from the most recent one, worked out on the wall clock again rather than
        // as +7×24h, so the slot after a daylight-saving change is still eight o'clock.
        var next = MostRecentSlot(now.AddDays(7));
        return next > now ? next : MostRecentSlot(now.AddDays(8));
    }

    /// <summary>
    /// The slot to send for now, or null when this week's has already gone.
    ///
    /// "Has this week's gone?" rather than "is it eight o'clock?" — the difference is the
    /// whole design. App Service unloads an idle app and restarts on every deploy, and
    /// eight on a Monday morning is exactly when nobody has visited all weekend; a timer that
    /// only fires AT the slot would skip every week the process happened to be asleep. This
    /// sends on the first check after the slot instead, and the recorded slot makes it once.
    /// Null <paramref name="lastSentSlot"/> (never sent) means the current week is owed —
    /// switching the digest on sends the first one at the worker's first check, minutes
    /// after the setting restarts the app.
    /// </summary>
    public static DateTimeOffset? Due(DateTimeOffset now, DateTimeOffset? lastSentSlot)
    {
        var slot = MostRecentSlot(now);
        return lastSentSlot is null || lastSentSlot < slot ? slot : null;
    }

    // A local wall-clock time in Sofia, as an instant. Eight in the morning is never inside
    // a DST gap or overlap (those are at 03:00/04:00), so the offset is unambiguous.
    private static DateTimeOffset AtSofia(DateTime wallClock)
    {
        var unspecified = DateTime.SpecifyKind(wallClock, DateTimeKind.Unspecified);
        return new DateTimeOffset(unspecified, Sofia.GetUtcOffset(unspecified));
    }

    // IANA first (Linux, and Windows with ICU — .NET 8 on App Service), then the Windows id,
    // which names the same rules. Never silently UTC: a digest an hour or two early or late
    // all year is the kind of wrong nobody reports.
    private static TimeZoneInfo FindSofia()
    {
        foreach (var id in new[] { "Europe/Sofia", "FLE Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        throw new InvalidOperationException("Neither 'Europe/Sofia' nor 'FLE Standard Time' is known to this machine.");
    }
}
