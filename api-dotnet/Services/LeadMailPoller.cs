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

        var leadByConversation = await db.LeadActivities
            .AsNoTracking()
            .Where(a => a.ConversationId != null && conversationIds.Contains(a.ConversationId))
            .Select(a => new { a.ConversationId, a.LeadId })
            .Distinct()
            .ToDictionaryAsync(x => x.ConversationId!, x => x.LeadId, ct);

        if (leadByConversation.Count == 0) return 0;

        // Belt and braces alongside the unique index: checking first turns the common case
        // (nothing new since last tick) into one query instead of a batch of failed inserts.
        var seenIds = messages.Select(m => m.Id).ToList();
        var alreadyFiled = await db.LeadActivities
            .AsNoTracking()
            .Where(a => a.ExternalMessageId != null && seenIds.Contains(a.ExternalMessageId))
            .Select(a => a.ExternalMessageId!)
            .ToListAsync(ct);
        var known = alreadyFiled.ToHashSet(StringComparer.Ordinal);

        var filed = 0;

        foreach (var message in messages)
        {
            if (string.IsNullOrWhiteSpace(message.ConversationId)) continue;
            if (known.Contains(message.Id)) continue;
            if (!leadByConversation.TryGetValue(message.ConversationId!, out var leadId)) continue;

            // Skip our own sent mail. It is already in the thread from the moment we sent
            // it, and filing it again would double every outbound message.
            if (IsFromUs(message.FromAddress)) continue;

            var activity = new LeadActivity
            {
                LeadId = leadId,
                Type = LeadActivityTypes.EmailIn,
                Subject = message.Subject,
                Body = TrimQuotedHistory(message.Body),
                ActorUpn = null,                    // null means the customer
                ConversationId = message.ConversationId,
                ExternalMessageId = message.Id,
                OccurredAt = message.ReceivedAt,
            };

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

            var lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == leadId, ct);
            if (lead is not null && (lead.LastActivityAt is null || message.ReceivedAt > lead.LastActivityAt))
                lead.LastActivityAt = message.ReceivedAt;

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

    private bool IsFromUs(string? address) =>
        !string.IsNullOrWhiteSpace(address)
        && address.Equals(_env.GraphSender, StringComparison.OrdinalIgnoreCase);

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
