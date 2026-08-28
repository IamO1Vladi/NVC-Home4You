using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Pulls replies out of the shared mailbox and files them into the right lead's thread, so
/// sales can keep the whole conversation in the admin panel.
///
/// Polling rather than Graph webhooks, deliberately. Webhooks need a public endpoint, a
/// validation handshake, and subscription renewal every three days — a renewal this app has
/// no scheduler to perform, so the day it silently lapses is the day inbound mail stops
/// with nothing in the logs. A poll that fails is visible on the next tick.
///
/// Matching is on Graph's conversationId, which LeadMailService stored when it sent. The
/// payoff is bigger than the admin panel: a reply to mail someone sent straight from
/// Outlook lands in the thread too, so nobody has to live in the panel for the history to
/// be complete.
///
/// When there is no such conversation the sender's address is tried instead — see
/// RouteToLead for why that fallback had to exist and where it stops, and InboundActivity
/// for why a message placed that way records no conversation of its own.
///
/// What lands in a thread is the customer speaking, and only that: our own sent copy is
/// skipped, and so is anything a machine generated — see IsAutomated.
/// </summary>
public class LeadMailPoller : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly EnvConfig _env;
    private readonly IHttpClientFactory _httpFactory;
    private readonly GraphTokens _tokens;
    private readonly LeadFileStore _files;
    private readonly ILogger<LeadMailPoller> _log;

    public LeadMailPoller(
        IServiceScopeFactory scopes, EnvConfig env, IHttpClientFactory httpFactory,
        GraphTokens tokens, LeadFileStore files, ILogger<LeadMailPoller> log)
    {
        _scopes = scopes;
        _env = env;
        _httpFactory = httpFactory;
        _tokens = tokens;
        _files = files;
        _log = log;
    }

    // Two minutes: fast enough that a salesperson watching a thread sees the reply arrive
    // in a plausible time, slow enough to be nothing against Graph's limits.
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    // How far back a single tick looks. Generously wider than the interval so a slow tick,
    // a redeploy, or a few minutes of downtime cannot open a hole — the unique index on
    // ExternalMessageId makes the resulting overlap free.
    private static readonly TimeSpan Lookback = TimeSpan.FromHours(2);

    private const int PageSize = 50;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Absent config is not an error. The app runs perfectly well with inbound mail
        // switched off; sales just types replies into the thread by hand.
        if (!_env.InboundMailConfigured)
        {
            _log.LogInformation(
                "Inbound lead mail is off (INBOUND_MAIL_ENABLED unset, or Graph/SQL not configured).");
            return;
        }

        _log.LogInformation("Inbound lead mail polling {Mailbox} every {Minutes} min",
            _env.GraphSender, Interval.TotalMinutes);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                var filed = await PollOnceAsync(ct);
                if (filed > 0) _log.LogInformation("Filed {Count} inbound message(s) into lead threads", filed);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Never let one bad tick kill the loop. A transient Graph error, a throttle,
                // a DNS blip — all of them should cost one cycle, not the feature until the
                // next deploy.
                _log.LogError(ex, "Inbound mail poll failed; will retry on the next tick");
            }

            try
            {
                await Task.Delay(Interval, ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    /// <summary>
    /// One cycle. Returns how many messages were filed. Public so a test or an admin
    /// endpoint can run a single pass without waiting on the timer.
    /// </summary>
    public async Task<int> PollOnceAsync(CancellationToken ct)
    {
        var token = await _tokens.GetAsync(ct);
        var messages = await FetchRecentAsync(token, ct);
        if (messages.Count == 0) return 0;

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Which conversations do we actually know about? Anything else in the mailbox is
        // ordinary company mail and must not be filed against a lead.
        var conversationIds = messages
            .Select(m => m.ConversationId)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct()
            .ToList();

        var leadByConversation = await LeadsByConversationAsync(db, conversationIds!, ct);

        // The fallback's input: everyone who wrote to us in a conversation we do not know.
        // Gathered for the whole batch and looked up once — a tick carries up to PageSize
        // messages, and a query each would turn a quiet mailbox into fifty round trips.
        //
        // Our own sent mail is excluded here as well as below, so a tick that contains
        // nothing but outbound copies does not go looking for a lead with contact@ in its
        // Email column.
        var unplacedSenders = messages
            .Where(m => string.IsNullOrWhiteSpace(m.ConversationId)
                        || !leadByConversation.ContainsKey(m.ConversationId!))
            .Where(m => !IsFromUs(m.FromAddress))
            .Select(m => m.FromAddress)
            .Where(a => !string.IsNullOrWhiteSpace(a))
            .Select(a => a!.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var leadByAddress = await LeadsByAddressAsync(db, unplacedSenders, ct);

        if (leadByConversation.Count == 0 && leadByAddress.Count == 0) return 0;

        // Belt and braces alongside the unique index: checking first turns the common case
        // (nothing new since last tick) into one query instead of a batch of failed inserts.
        var seenIds = messages.Select(m => m.Id).ToList();
        var alreadyFiled = await db.LeadActivities
            .AsNoTracking()
            .Where(a => a.ExternalMessageId != null && seenIds.Contains(a.ExternalMessageId))
            .Select(a => a.ExternalMessageId!)
            .ToListAsync(ct);
        var known = alreadyFiled.ToHashSet(StringComparer.Ordinal);

        // Every message placed before anything is written, so the leads they land on can be
        // loaded in one query instead of one per message.
        var routed = new List<(MailMessage Message, Placement Where)>();

        foreach (var message in messages)
        {
            if (known.Contains(message.Id)) continue;

            // Skip our own sent mail. It is already in the thread from the moment we sent
            // it, and filing it again would double every outbound message.
            if (IsFromUs(message.FromAddress)) continue;

            var placement = RouteToLead(message.ConversationId, message.FromAddress, leadByConversation, leadByAddress);
            if (placement is null) continue;

            // Asked only about mail that would otherwise be filed, so the mailbox's ordinary
            // traffic costs nothing. See IsAutomatedAsync for why the headers are fetched a
            // message at a time rather than pulled down with the list.
            if (await IsAutomatedAsync(token, message.Id, ct))
            {
                _log.LogInformation(
                    "Message {MessageId} is an automatic reply; not filing it as the customer speaking",
                    message.Id);
                continue;
            }

            routed.Add((message, placement.Value));
        }

        if (routed.Count == 0) return 0;

        var routedLeadIds = routed.Select(r => r.Where.LeadId).Distinct().ToList();
        var leads = await db.Leads
            .Where(l => routedLeadIds.Contains(l.Id))
            .ToDictionaryAsync(l => l.Id, ct);

        var filed = 0;

        foreach (var (message, where) in routed)
        {
            var leadId = where.LeadId;
            var activity = InboundActivity(
                where, message.ConversationId, message.Id, message.Subject, message.Body, message.ReceivedAt);

            // The plot survey, the bank confirmation, the photo of where it is going —
            // customers send these constantly, and until now they stayed in the mailbox
            // while the panel showed a message that referred to a file nobody in the
            // panel could open.
            //
            // Everything about this is best-effort: a file we cannot fetch or cannot
            // store must never cost us the message it came with. That is why it is inside
            // its own try and why a failure only logs.
            if (message.HasAttachments)
            {
                try
                {
                    foreach (var file in await FetchAttachmentsAsync(token, message.Id, leadId, ct))
                        activity.Attachments.Add(file);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _log.LogError(ex,
                        "Could not file the attachments on inbound message {MessageId}; " +
                        "the message itself is still being recorded", message.Id);
                }
            }

            db.LeadActivities.Add(activity);

            if (leads.TryGetValue(leadId, out var lead))
                TouchLead(lead, message.ReceivedAt);

            filed++;
        }

        if (filed == 0) return 0;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            // The unique index did its job — another instance filed the same message
            // between our check and our write. Expected under two app instances, and not
            // worth an error: the next tick sees it as already filed.
            _log.LogInformation(ex, "Inbound message already filed by another instance; skipping");
            return 0;
        }

        return filed;
    }

    private bool IsFromUs(string? address) => IsFromUs(address, _env.GraphSender);

    // Static twin so the rule can be exercised without a mailbox behind it. Unchanged and
    // still load-bearing: our own copy of an outbound message is already in the thread.
    public static bool IsFromUs(string? address, string? mailbox) =>
        !string.IsNullOrWhiteSpace(address)
        && !string.IsNullOrWhiteSpace(mailbox)
        && address.Trim().Equals(mailbox.Trim(), StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Whether a Graph message is a machine answering rather than the customer speaking —
    /// the out-of-office, the delivery report, the ticket system's acknowledgement.
    ///
    /// It matters because the thread's newest entry with no UPN on it is what the board
    /// reads as "they are waiting on us" (LeadPipelineService.AwaitingReplyAsync). A holiday
    /// notice would raise that flag for as long as the customer is away, and the only way to
    /// lower it is to write into the thread — so the board would be asking somebody to
    /// answer an autoresponder.
    /// </summary>
    /// <remarks>
    /// RFC 3834's Auto-Submitted is the whole rule, plus the two X- headers that predate it.
    /// It is what Exchange, Gmail and every mailing list stamp on generated mail, and it says
    /// so in a field rather than in prose — no subject sniffing, which would have to guess at
    /// "Automatic reply", "Автоматичен отговор" and whatever the customer's client writes.
    ///
    /// X-Auto-Response-Suppress is deliberately NOT on the list, though a Microsoft
    /// autoresponder does carry it. It is an instruction about future mail, and a corporate
    /// gateway that stamps it on everything leaving the building would make us drop a real
    /// customer's real reply — a far worse trade than a badge that stays lit for a week.
    /// </remarks>
    public static bool IsAutomated(string? messageJson)
    {
        if (string.IsNullOrWhiteSpace(messageJson)) return false;

        try
        {
            using var doc = JsonDocument.Parse(messageJson!);
            if (!doc.RootElement.TryGetProperty("internetMessageHeaders", out var headers)
                || headers.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            foreach (var header in headers.EnumerateArray())
            {
                var name = header.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(name)) continue;

                if (name!.Equals("X-Autoreply", StringComparison.OrdinalIgnoreCase)
                    || name.Equals("X-Autorespond", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (!name.Equals("Auto-Submitted", StringComparison.OrdinalIgnoreCase)) continue;

                // "no" is the RFC's way for an ordinary message to say so explicitly.
                // Everything else — auto-replied, auto-generated — is a machine.
                var value = header.TryGetProperty("value", out var valueEl) ? valueEl.GetString() : null;
                if (!string.IsNullOrWhiteSpace(value)
                    && !value!.Trim().Equals("no", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }
        catch (JsonException)
        {
            // Unreadable headers are not evidence of anything. Filing the message is the
            // behaviour we had before this rule existed, and it loses nothing.
            return false;
        }

        return false;
    }

    /// <summary>
    /// Fetches one message's internet headers and asks IsAutomated about them.
    /// </summary>
    /// <remarks>
    /// A MESSAGE AT A TIME, not on the list query's $select. internetMessageHeaders is a
    /// property Graph returns only when asked for, and asking for it across a collection is
    /// the sort of thing Graph refuses for some properties and not others — a refusal here
    /// would be a 400 on the ONE request the whole feature stands on, every two minutes.
    /// This costs one small request per message that is about to be filed — a handful on a
    /// busy day — and nothing at all for the mailbox's ordinary traffic. An automatic reply
    /// is never recorded, so it is asked about again each tick until it ages out of the
    /// lookback window, which is the cheap half of the trade.
    ///
    /// Any failure means "not automated", so a Graph hiccup files the message as usual
    /// rather than silently dropping a customer's reply.
    /// </remarks>
    private async Task<bool> IsAutomatedAsync(string token, string messageId, CancellationToken ct)
    {
        try
        {
            var url =
                $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}" +
                $"/messages/{Uri.EscapeDataString(messageId)}?$select=internetMessageHeaders";

            var http = _httpFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return false;

            return IsAutomated(await response.Content.ReadAsStringAsync(ct));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _log.LogInformation(ex,
                "Could not read the headers of message {MessageId}; filing it as ordinary mail", messageId);
            return false;
        }
    }

    /// <summary>
    /// Where a message was filed, and which of the two rules put it there. The second half
    /// is not bookkeeping: an anchor is only ever recorded for a message the CONVERSATION
    /// placed — see InboundActivity.
    /// </summary>
    public readonly record struct Placement(int LeadId, bool ByConversation);

    /// <summary>
    /// Which lead a message belongs to, or null for mail that belongs to none.
    ///
    /// THE CONVERSATION IS THE FAST PATH and stays first. It is exact, it is what
    /// LeadMailService wrote down when the panel sent, and it keeps working when a customer
    /// answers from a second address or a colleague's mailbox.
    ///
    /// THE SENDER'S ADDRESS IS THE FALLBACK, and it exists because a conversation id is
    /// only ever recorded when somebody emailed the lead FROM THE PANEL. The autoresponder
    /// records nothing, so a customer who simply hit reply on their acknowledgement — the
    /// most ordinary thing a customer can do — was skipped with nothing in the logs. Matched
    /// exactly and case-insensitively against Lead.Email: no domain matching, because half a
    /// company's staff share a domain with each other and with our own suppliers, and no
    /// fuzzy matching, because a near miss files a stranger's message into someone's thread.
    ///
    /// THE LINE THIS MUST NOT CROSS: ordinary company mail from an address that belongs to
    /// no lead is still ignored, exactly as before. An accountant, a supplier, a newsletter —
    /// none of them appear in Lead.Email, so none of them are filed, and the mailbox does not
    /// become the pipeline.
    /// </summary>
    public static Placement? RouteToLead(
        string? conversationId,
        string? fromAddress,
        IReadOnlyDictionary<string, int> leadByConversation,
        IReadOnlyDictionary<string, int> leadByAddress)
    {
        if (!string.IsNullOrWhiteSpace(conversationId)
            && leadByConversation.TryGetValue(conversationId!, out var byConversation))
        {
            return new Placement(byConversation, ByConversation: true);
        }

        if (!string.IsNullOrWhiteSpace(fromAddress)
            && leadByAddress.TryGetValue(fromAddress!.Trim().ToLowerInvariant(), out var byAddress))
        {
            return new Placement(byAddress, ByConversation: false);
        }

        return null;
    }

    /// <summary>
    /// One inbound message as a thread entry, before its files are hung on it.
    /// </summary>
    /// <remarks>
    /// THE CONVERSATION ID IS RECORDED ONLY WHEN THE CONVERSATION IS WHAT PLACED THE
    /// MESSAGE, so an anchor always means "we emailed this lead in this thread" and never
    /// "we guessed once". Writing a guessed one down would promote it to the fast path
    /// above, and the fast path answers before the sender's address is even looked at:
    ///
    ///   Ivan and Maria are two leads. Ivan writes, CCing Maria; the address places him on
    ///   his lead. Stamp that thread onto Ivan's lead and Maria's reply-all — her words, her
    ///   plot survey — is filed on Ivan's thread as though she were him, while her own lead
    ///   reports a customer nobody has heard from. Nothing in the panel can move it back.
    ///
    /// The cost of leaving it off is that every further reply in such a thread is placed by
    /// address again. That is the guess LeadsByAddressAsync documents and accepts: it is
    /// deterministic, and when it is wrong the message is still on one of THAT customer's
    /// own threads rather than on a stranger's.
    /// </remarks>
    public static LeadActivity InboundActivity(
        Placement where, string? conversationId, string externalMessageId,
        string? subject, string? body, DateTimeOffset receivedAt) => new()
        {
            LeadId = where.LeadId,
            Type = LeadActivityTypes.EmailIn,
            Subject = subject,
            Body = TrimQuotedHistory(body),
            ActorUpn = null,                    // null means the customer
            ConversationId = where.ByConversation ? conversationId : null,
            ExternalMessageId = externalMessageId,
            OccurredAt = receivedAt,
        };

    /// <summary>
    /// What filing a customer's message does to the lead itself, beyond the thread.
    /// </summary>
    /// <remarks>
    /// LastActivityAt is the board's sort key, so it moves to the newest thing that
    /// happened — that much was always here.
    ///
    /// ClosedAt moving is the deliberate part (2026-08-28). The three-day archive countdown
    /// (LeadPipelineService.ArchiveAfter) runs from ClosedAt, so a customer writing back to
    /// a Won or Lost deal restarts it: the lead returns to the board wearing its
    /// awaiting-reply badge, and puts itself away again three days later if nobody acts.
    /// Before this, the reply was filed faithfully onto the archived lead and seen by
    /// nobody — the only tab that showed it is the one tab nobody works from.
    ///
    /// The STATUS is not touched. LeadStatuses documents reopening as a deliberate act, and
    /// this keeps it one: the board surfaces the conversation, a person decides whether the
    /// deal reopens. Nor is the true closing date lost — the status-change activity in the
    /// thread still carries it.
    ///
    /// Only the customer speaking gets here — our own copies and out-of-office autoreplies
    /// are dropped before routing — so an autoreply cannot drag a dead deal back onto the
    /// board. And only ever forward: a late-arriving message older than what the lead
    /// already knows must not rewind either clock.
    /// </remarks>
    public static void TouchLead(Lead lead, DateTimeOffset receivedAt)
    {
        if (lead.LastActivityAt is null || receivedAt > lead.LastActivityAt)
            lead.LastActivityAt = receivedAt;

        if (lead.ClosedAt is not null && receivedAt > lead.ClosedAt)
            lead.ClosedAt = receivedAt;
    }

    /// <summary>
    /// The lead each of these conversations belongs to. One query for the whole tick.
    /// </summary>
    /// <remarks>
    /// TOLERANT OF A CONVERSATION THAT SPANS TWO LEADS, because the alternative is an
    /// outage. Keyed straight into a dictionary this would throw on the second row, inside
    /// the tick's first query — and a poller that throws files nothing at all, for every
    /// lead, until the offending thread falls out of the Lookback window. Graph decides what
    /// a conversation is, and it groups by participants and topic: a returning customer with
    /// two open leads, mailed twice from the panel under the same default subject, is enough
    /// to produce one.
    ///
    /// THE LEAD IT WAS LAST USED ON WINS, which is the same instinct as LeadsByAddressAsync
    /// — the thread somebody is actually in — and it is stable, since filing a message
    /// against that lead only reinforces the answer.
    /// </remarks>
    public static async Task<Dictionary<string, int>> LeadsByConversationAsync(
        AppDbContext db, IReadOnlyCollection<string> conversationIds, CancellationToken ct)
    {
        var empty = new Dictionary<string, int>(StringComparer.Ordinal);
        if (conversationIds.Count == 0) return empty;

        var wanted = conversationIds.ToList();

        // Grouped in the database rather than here: a long thread is one row per message,
        // and the poller only ever needs the newest of them.
        var candidates = await db.LeadActivities
            .AsNoTracking()
            .Where(a => a.ConversationId != null && wanted.Contains(a.ConversationId))
            .GroupBy(a => new { a.ConversationId, a.LeadId })
            .Select(g => new { g.Key.ConversationId, g.Key.LeadId, Latest = g.Max(a => a.OccurredAt) })
            .ToListAsync(ct);

        return candidates
            .GroupBy(x => x.ConversationId!, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                // Id last so two leads mailed within the same clock tick still resolve the
                // same way on every poll.
                g => g.OrderByDescending(x => x.Latest)
                      .ThenByDescending(x => x.LeadId)
                      .First().LeadId,
                StringComparer.Ordinal);
    }

    /// <summary>
    /// The lead behind each of these addresses, keyed by the lower-cased address. One query
    /// for the whole tick.
    /// </summary>
    /// <remarks>
    /// Several leads sharing an address is normal rather than exceptional: a returning
    /// customer asking about a second house, a builder who enquires for every client he has.
    /// So the tie has to be broken by a rule rather than by whichever row the database
    /// happened to return.
    ///
    /// MOST RECENTLY ACTIVE, OPEN FIRST. An open lead is one somebody is working; a Won or
    /// Lost one is finished, and a reply about a finished deal is nearly always about the
    /// next thing rather than the old one. Among the open ones the most recently active is
    /// the conversation the customer is most likely continuing.
    ///
    /// What it costs when it is wrong: the message lands on the customer's other lead. The
    /// text is still in the panel, still attributed to them, still searchable — a person
    /// reading two threads sees it in the wrong one and can say so. Nothing is lost, which
    /// is the whole reason a guess is acceptable here and would not be if the alternative
    /// were deleting the message.
    /// </remarks>
    public static async Task<Dictionary<string, int>> LeadsByAddressAsync(
        AppDbContext db, IReadOnlyCollection<string> addresses, CancellationToken ct)
    {
        var empty = new Dictionary<string, int>(StringComparer.Ordinal);
        if (addresses.Count == 0) return empty;

        var wanted = addresses.ToList();

        var candidates = await db.Leads
            .AsNoTracking()
            .Where(l => l.Email != null && wanted.Contains(l.Email.ToLower()))
            .Select(l => new { l.Id, l.Email, l.Status, l.LastActivityAt })
            .ToListAsync(ct);

        return candidates
            .GroupBy(l => l.Email!.Trim().ToLowerInvariant(), StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                // Id last so the answer is the same on every tick even for two leads created
                // in the same second with nothing on either thread yet.
                g => g.OrderByDescending(l => LeadStatuses.IsOpen(l.Status))
                      .ThenByDescending(l => l.LastActivityAt ?? DateTimeOffset.MinValue)
                      .ThenByDescending(l => l.Id)
                      .First().Id,
                StringComparer.Ordinal);
    }

    private record MailMessage(string Id, string? ConversationId, string? Subject, string Body,
        string? FromAddress, DateTimeOffset ReceivedAt, bool HasAttachments);

    /// <summary>
    /// Pulls the files off one inbound message and into blob storage, returning the rows
    /// to hang on its thread entry.
    ///
    /// Two things here are load-bearing:
    ///
    /// INLINE PARTS ARE SKIPPED. Every corporate signature carries two or three logos as
    /// attachments with isInline set. Filing them would attach "image001.png" to every
    /// message in every thread, and the real survey would be lost among them.
    ///
    /// THE ALLOW-LIST IS THE SAME ONE THE UPLOAD BUTTON USES. A file arriving by email is
    /// no more trustworthy than one someone picked in a file dialog — less, since nobody
    /// chose it — so a .exe or an .html from a stranger is refused at the same gate.
    /// </summary>
    private async Task<List<LeadAttachment>> FetchAttachmentsAsync(
        string token, string messageId, int leadId, CancellationToken ct)
    {
        var stored = new List<LeadAttachment>();

        // Storage off means the bytes have nowhere to go. Not an error: the panel is
        // perfectly usable without attachments, and a row pointing at nothing would be
        // worse than none.
        if (!_files.IsConfigured) return stored;

        var http = _httpFactory.CreateClient();

        // contentBytes is deliberately NOT selected: it would download every file,
        // including the ones about to be rejected for size or type, in one response.
        var listUrl =
            $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}" +
            $"/messages/{Uri.EscapeDataString(messageId)}/attachments" +
            "?$select=id,name,contentType,size,isInline";

        using var listRequest = new HttpRequestMessage(HttpMethod.Get, listUrl);
        listRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var listResponse = await http.SendAsync(listRequest, ct);
        var listRaw = await listResponse.Content.ReadAsStringAsync(ct);

        if (!listResponse.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Graph list attachments failed: {(int)listResponse.StatusCode} {listRaw}");

        using var doc = JsonDocument.Parse(listRaw);
        if (!doc.RootElement.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.Array)
            return stored;

        foreach (var item in value.EnumerateArray())
        {
            var type = item.TryGetProperty("@odata.type", out var typeEl) ? typeEl.GetString() : null;

            // itemAttachment (a forwarded email) and referenceAttachment (a OneDrive
            // link) have no bytes to fetch. Ignored rather than half-handled.
            if (!string.Equals(type, "#microsoft.graph.fileAttachment", StringComparison.Ordinal)) continue;

            if (item.TryGetProperty("isInline", out var inlineEl) && inlineEl.ValueKind == JsonValueKind.True) continue;

            var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            var name = item.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)) continue;

            // Path components stripped for the same reason as on upload: the sender chose
            // this string and it is a label, never a location.
            var fileName = System.IO.Path.GetFileName(name!);
            if (!LeadFileStore.IsAllowed(fileName, out var contentType))
            {
                _log.LogInformation(
                    "Skipped inbound attachment {FileName} on message {MessageId}: type not accepted",
                    fileName, messageId);
                continue;
            }

            var size = item.TryGetProperty("size", out var sizeEl) && sizeEl.TryGetInt64(out var bytes)
                ? bytes
                : 0;

            if (size > LeadFileStore.MaxBytes)
            {
                _log.LogInformation(
                    "Skipped inbound attachment {FileName} on message {MessageId}: {Size} bytes is over the limit",
                    fileName, messageId, size);
                continue;
            }

            var contentUrl =
                $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}" +
                $"/messages/{Uri.EscapeDataString(messageId)}/attachments/{Uri.EscapeDataString(id!)}/$value";

            using var contentRequest = new HttpRequestMessage(HttpMethod.Get, contentUrl);
            contentRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            using var contentResponse = await http.SendAsync(contentRequest, ct);
            if (!contentResponse.IsSuccessStatusCode)
            {
                _log.LogWarning(
                    "Could not download attachment {FileName} on message {MessageId}: {Status}",
                    fileName, messageId, (int)contentResponse.StatusCode);
                continue;
            }

            var key = LeadFileStore.MintKey(leadId, fileName);
            await using (var stream = await contentResponse.Content.ReadAsStreamAsync(ct))
            {
                await _files.UploadAsync(key, stream, contentType, ct);
            }

            stored.Add(new LeadAttachment
            {
                FileName = fileName,
                BlobKey = key,
                ContentType = contentType,
                // Graph's `size` counts the MIME-encoded part, so it runs a third above
                // the real file. Preferred anyway when the response does not say: an
                // approximate "1.4 MB" in the panel beats a confident zero.
                SizeBytes = contentResponse.Content.Headers.ContentLength ?? size,

                // Null is the customer, exactly as on LeadActivity.ActorUpn. Nobody on
                // our side put this here.
                UploadedByUpn = null,
            });
        }

        return stored;
    }

    private async Task<List<MailMessage>> FetchRecentAsync(string token, CancellationToken ct)
    {
        var since = DateTimeOffset.UtcNow - Lookback;
        var filter = Uri.EscapeDataString($"receivedDateTime ge {since.UtcDateTime:yyyy-MM-ddTHH:mm:ssZ}");

        var url =
            $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}/messages" +
            $"?$filter={filter}" +
            $"&$select=id,conversationId,subject,body,from,receivedDateTime,hasAttachments" +
            $"&$orderby=receivedDateTime desc&$top={PageSize}";

        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await http.SendAsync(request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            // 403 here is almost always the missing piece rather than a bug: Mail.Read
            // granted but no Application Access Policy, or the policy scoped to a
            // different mailbox. Say so, because the generic message sends people
            // debugging the wrong thing.
            if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                throw new InvalidOperationException(
                    "Graph refused to read the mailbox (403). Check that Mail.Read has admin " +
                    $"consent and that an Application Access Policy grants access to {_env.GraphSender}. Body: {raw}");

            throw new InvalidOperationException($"Graph list messages failed: {(int)response.StatusCode} {raw}");
        }

        using var doc = JsonDocument.Parse(raw);
        var results = new List<MailMessage>();

        if (!doc.RootElement.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.Array)
            return results;

        foreach (var item in value.EnumerateArray())
        {
            var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrWhiteSpace(id)) continue;

            var body = "";
            if (item.TryGetProperty("body", out var bodyEl)
                && bodyEl.TryGetProperty("content", out var contentEl))
            {
                body = contentEl.GetString() ?? "";
            }

            string? from = null;
            if (item.TryGetProperty("from", out var fromEl)
                && fromEl.TryGetProperty("emailAddress", out var addrEl)
                && addrEl.TryGetProperty("address", out var addressEl))
            {
                from = addressEl.GetString();
            }

            var received = item.TryGetProperty("receivedDateTime", out var recEl)
                && recEl.TryGetDateTimeOffset(out var parsed)
                ? parsed
                : DateTimeOffset.UtcNow;

            results.Add(new MailMessage(
                id!,
                item.TryGetProperty("conversationId", out var convEl) ? convEl.GetString() : null,
                item.TryGetProperty("subject", out var subEl) ? subEl.GetString() : null,
                body,
                from,
                received,
                item.TryGetProperty("hasAttachments", out var hasEl) && hasEl.ValueKind == JsonValueKind.True));
        }

        return results;
    }

    // Everything below the first quote marker. Mail clients differ, so this matches the
    // common ones rather than trying to be exhaustive.
    private static readonly Regex QuoteMarker = new(
        @"(?im)^\s*(-{2,}\s*Original Message|_{5,}|From:\s|On .{0,80}\bwrote:|От:\s|Από:\s)",
        RegexOptions.Compiled);

    private static readonly Regex HtmlTag = new("<[^>]+>", RegexOptions.Compiled);

    /// <summary>
    /// Strips the quoted history a reply carries.
    ///
    /// Sounds trivial and is the single thing that decides whether a homegrown thread is
    /// readable: without it, message three contains messages two and one, message four
    /// contains all of them, and by the tenth reply the panel is unusable — and every
    /// drafted reply is reading the same conversation several times over.
    ///
    /// Conservative on purpose. If no marker is found the body is kept whole: showing a
    /// little too much is a cosmetic problem, while an over-eager rule that cuts at the
    /// wrong place silently deletes what the customer actually said.
    /// </summary>
    public static string TrimQuotedHistory(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return "";

        var text = body!;

        // Graph returns HTML for most mail. Blocks become newlines first, so the quote
        // markers are still recognisable once the tags are gone.
        if (text.Contains('<'))
        {
            text = Regex.Replace(text, @"(?i)<br\s*/?>|</p>|</div>|</tr>", "\n");
            text = HtmlTag.Replace(text, "");
            text = System.Net.WebUtility.HtmlDecode(text);
        }

        var match = QuoteMarker.Match(text);
        if (match.Success && match.Index > 0)
            text = text[..match.Index];

        // Collapse the run of blank lines mail clients leave behind, without touching
        // deliberate paragraph breaks.
        text = Regex.Replace(text, @"\n{3,}", "\n\n");

        return text.Trim();
    }
}
