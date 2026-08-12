using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Sending a reply to a lead from the shared mailbox, and recording it in the thread.
///
/// Everything goes out from contact@ — never from the salesperson's own address. That was
/// decided deliberately: a reply sent from an individual routes the customer's answer to a
/// personal mailbox, around the shared one, and out of the thread entirely. Personalisation
/// belongs in the body and signature, never in the headers.
/// </summary>
public class LeadMailService
{
    private readonly AppDbContext _db;
    private readonly EnvConfig _env;
    private readonly IHttpClientFactory _httpFactory;
    private readonly GraphTokens _tokens;
    private readonly ILogger<LeadMailService> _log;

    public LeadMailService(
        AppDbContext db, EnvConfig env, IHttpClientFactory httpFactory,
        GraphTokens tokens, ILogger<LeadMailService> log)
    {
        _db = db;
        _env = env;
        _httpFactory = httpFactory;
        _tokens = tokens;
        _log = log;
    }

    public bool IsConfigured => _env.GraphConfigured;

    public enum SendOutcome { Sent, NotConfigured, LeadNotFound, NoAddress, Failed }

    public record SendResult(SendOutcome Outcome, int? ActivityId, string? Error)
    {
        public bool Ok => Outcome == SendOutcome.Sent;
    }

    /// <summary>
    /// Sends a reply and writes it into the thread.
    ///
    /// The order matters and is the opposite of the obvious one: SEND FIRST, then record.
    /// Recording first and sending second would leave the thread claiming we replied when
    /// the send failed — sales would see an answered lead and move on, and the customer
    /// would hear nothing. The other way round, a failure after a successful send costs a
    /// missing thread entry, which is visible and fixable; a lie in the record is neither.
    /// </summary>
    public async Task<SendResult> SendReplyAsync(
        int leadId, string? subject, string body, string? actorUpn, CancellationToken ct = default)
    {
        if (!IsConfigured)
            return new SendResult(SendOutcome.NotConfigured, null, "Email is not configured.");

        var lead = await _db.Leads.AsNoTracking().FirstOrDefaultAsync(l => l.Id == leadId, ct);
        if (lead is null)
            return new SendResult(SendOutcome.LeadNotFound, null, "No such lead.");

        if (string.IsNullOrWhiteSpace(lead.Email))
            return new SendResult(SendOutcome.NoAddress, null,
                "This lead has no email address — reply by phone, and log the call.");

        // Reuse the existing subject so the customer's mail client threads it, rather than
        // starting a new conversation on every reply.
        var resolvedSubject = string.IsNullOrWhiteSpace(subject)
            ? await DefaultSubjectAsync(leadId, lead, ct)
            : subject!.Trim();

        try
        {
            var token = await _tokens.GetAsync(ct);

            string? messageId = null;
            string? conversationId = null;

            // Preferred path: create the message, then send it. sendMail returns nothing,
            // and the conversationId Graph assigns is the only durable handle tying a
            // future reply back to this lead — creating it first hands us that before
            // anything leaves the building.
            //
            // But creating a message needs Mail.ReadWrite, while sending needs only
            // Mail.Send. Those are different grants, and an installation that has one
            // without the other must still be able to REPLY — losing inbound threading is
            // a degraded feature, losing the ability to answer a customer is a broken one.
            try
            {
                (messageId, conversationId) = await CreateDraftAsync(
                    token, lead.Email!, resolvedSubject, body, ct);

                await SendDraftAsync(token, messageId, ct);
            }
            catch (GraphException ex) when (ex.IsPermissionProblem)
            {
                _log.LogWarning(
                    "Mail.ReadWrite is not granted for {Mailbox}, so the reply was sent without " +
                    "capturing a conversation id. The reply is delivered; the customer's answer " +
                    "will not thread back automatically until Mail.ReadWrite is granted.",
                    _env.GraphSender);

                await SendDirectAsync(token, lead.Email!, resolvedSubject, body, ct);
                messageId = null;
                conversationId = null;
            }

            var now = DateTimeOffset.UtcNow;
            var activity = new LeadActivity
            {
                LeadId = leadId,
                Type = LeadActivityTypes.EmailOut,
                Subject = resolvedSubject,
                Body = body,
                ActorUpn = actorUpn,
                ConversationId = conversationId,
                ExternalMessageId = messageId,
                OccurredAt = now,
            };
            _db.LeadActivities.Add(activity);

            var tracked = await _db.Leads.FirstAsync(l => l.Id == leadId, ct);
            if (tracked.LastActivityAt is null || now > tracked.LastActivityAt) tracked.LastActivityAt = now;
            tracked.UpdatedAt = now;

            await _db.SaveChangesAsync(ct);

            return new SendResult(SendOutcome.Sent, activity.Id, null);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Logged loudly: if the send succeeded and the write failed, the customer has
            // a reply that the thread does not show, and only this log says so.
            _log.LogError(ex, "Reply to lead {LeadId} failed", leadId);

            // A permission failure will not fix itself on a retry, and "try again" sends
            // someone clicking a button that cannot work. Name the cause instead.
            var message = ex is GraphException graph && graph.IsPermissionProblem
                ? "The mailbox refused the send. Check that Mail.Send is granted and the access policy covers this mailbox."
                : "The reply was not sent. Try again.";

            return new SendResult(SendOutcome.Failed, null, message);
        }
    }

    /// <summary>
    /// A Graph call that failed, carrying enough to decide what to do about it.
    ///
    /// Exists so the caller can tell "you are not allowed to do that" apart from "that did
    /// not work" — the first has a fallback, the second does not, and a bare
    /// InvalidOperationException made them indistinguishable.
    /// </summary>
    public sealed class GraphException : Exception
    {
        public GraphException(System.Net.HttpStatusCode status, string message) : base(message)
        {
            Status = status;
        }

        public System.Net.HttpStatusCode Status { get; }

        // 403 is the documented answer for a missing application permission. 401 is
        // included because a token minted before a grant was added comes back
        // unauthorized rather than forbidden, and the fallback is right in both cases.
        public bool IsPermissionProblem =>
            Status == System.Net.HttpStatusCode.Forbidden || Status == System.Net.HttpStatusCode.Unauthorized;
    }

    /// <summary>
    /// Sends without creating a message first. Needs only Mail.Send.
    ///
    /// The fallback: no conversationId comes back, so a reply to this message will not
    /// thread automatically. The customer still gets their answer, which is the part that
    /// cannot be allowed to fail.
    /// </summary>
    private async Task SendDirectAsync(
        string token, string toAddress, string subject, string body, CancellationToken ct)
    {
        var payload = new
        {
            message = new
            {
                subject,
                body = new { contentType = "HTML", content = body },
                toRecipients = new[] { new { emailAddress = new { address = toAddress } } },
            },
            saveToSentItems = true,
        };

        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}/sendMail")
        {
            Content = JsonContent.Create(payload),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var raw = await response.Content.ReadAsStringAsync(ct);
            throw new GraphException(response.StatusCode, $"Graph sendMail failed: {(int)response.StatusCode} {raw}");
        }
    }

    /// <summary>
    /// Creates the message in the mailbox without sending it, and returns Graph's ids.
    /// </summary>
    private async Task<(string MessageId, string? ConversationId)> CreateDraftAsync(
        string token, string toAddress, string subject, string body, CancellationToken ct)
    {
        var payload = new
        {
            subject,
            body = new { contentType = "HTML", content = body },
            toRecipients = new[] { new { emailAddress = new { address = toAddress } } },
        };

        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}/messages")
        {
            Content = JsonContent.Create(payload),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await http.SendAsync(request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new GraphException(response.StatusCode, $"Graph create message failed: {(int)response.StatusCode} {raw}");

        using var doc = JsonDocument.Parse(raw);
        var id = doc.RootElement.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        var conversationId = doc.RootElement.TryGetProperty("conversationId", out var cEl) ? cEl.GetString() : null;

        if (string.IsNullOrWhiteSpace(id))
            throw new InvalidOperationException("Graph create message returned no id.");

        return (id!, conversationId);
    }

    private async Task SendDraftAsync(string token, string messageId, CancellationToken ct)
    {
        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}/messages/{Uri.EscapeDataString(messageId)}/send");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var raw = await response.Content.ReadAsStringAsync(ct);
            throw new GraphException(response.StatusCode, $"Graph send failed: {(int)response.StatusCode} {raw}");
        }
    }

    /// <summary>
    /// Continues the existing subject when there is one, so the customer sees a thread
    /// rather than a stream of unrelated messages.
    /// </summary>
    private async Task<string> DefaultSubjectAsync(int leadId, Lead lead, CancellationToken ct)
    {
        var previous = await _db.LeadActivities
            .AsNoTracking()
            .Where(a => a.LeadId == leadId && a.Subject != null && a.Subject != "")
            .OrderByDescending(a => a.OccurredAt)
            .Select(a => a.Subject)
            .FirstOrDefaultAsync(ct);

        if (!string.IsNullOrWhiteSpace(previous))
            return previous!.StartsWith("Re:", StringComparison.OrdinalIgnoreCase) ? previous! : $"Re: {previous}";

        // First reply on a lead with no subject yet. Locale-aware because the customer
        // reads the subject line before anything else.
        return lead.Locale switch
        {
            "bg" => "NVC-HOME4YOU — Вашето запитване",
            "el" => "NVC-HOME4YOU — Το αίτημά σας",
            _ => "NVC-HOME4YOU — your enquiry",
        };
    }
}
