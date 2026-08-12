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

            // Two calls, not sendMail. sendMail returns nothing, and we need the
            // conversationId Graph assigns — it is the only durable handle that ties a
            // future reply back to this lead. Creating the message first hands us both
            // that and the message id before anything leaves the building.
            var (messageId, conversationId) = await CreateDraftAsync(
                token, lead.Email!, resolvedSubject, body, ct);

            await SendDraftAsync(token, messageId, ct);

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
            return new SendResult(SendOutcome.Failed, null, "The reply was not sent. Try again.");
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
            throw new InvalidOperationException($"Graph create message failed: {(int)response.StatusCode} {raw}");

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
            throw new InvalidOperationException($"Graph send failed: {(int)response.StatusCode} {raw}");
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
