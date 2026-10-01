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
    private readonly LeadFileStore _files;
    private readonly ILogger<LeadMailService> _log;

    public LeadMailService(
        AppDbContext db, EnvConfig env, IHttpClientFactory httpFactory,
        GraphTokens tokens, LeadFileStore files, ILogger<LeadMailService> log)
    {
        _db = db;
        _env = env;
        _httpFactory = httpFactory;
        _tokens = tokens;
        _files = files;
        _log = log;
    }

    public bool IsConfigured => _env.GraphConfigured;

    /// <summary>
    /// A file travelling out with a reply, held in memory: it is read whole from the form,
    /// base64'd into one request when small and cut into pieces when not, and capped at
    /// LeadFileStore.MaxEmailBytes in total either way.
    /// </summary>
    public record OutgoingFile(string FileName, string ContentType, byte[] Content);

    // --- Large attachments (#29) -----------------------------------------------------
    //
    // Graph has two ways to put a file on a message and each refuses the other's sizes
    // (learn.microsoft.com/graph/outlook-large-attachments): a single POST to /attachments
    // only below 3 MB — the base64 has to fit Graph's 4 MB request limit — and an upload
    // session only from 3 MB up, refusing anything smaller with
    // ErrorAttachmentSizeShouldNotBeLessThanMinimumSize. So the line is drawn exactly where
    // Graph draws it, per file, and a reply can mix the two on one draft.

    /// <summary>
    /// At or above this a file goes up through an upload session; below it, the single POST
    /// it always used. The docs say "3 MB" and never which: 3,000,000 is the lower reading,
    /// so a single POST is only ever asked to carry what fits a 4 MB request under either
    /// one (with GraphJson below — see there for why the encoder matters). If the service
    /// means 3 MiB and refuses a session for a file between the two, the file falls back to
    /// the single POST, which fits at that size — see AttachToDraftAsync.
    /// </summary>
    public const long UploadSessionThresholdBytes = 3_000_000;

    /// <summary>
    /// JSON for payloads that carry file bytes. NOT the web default, whose encoder escapes
    /// every '+' in base64 as a six-byte unicode escape (backslash, u, 002B): that makes the body ~1.44× the file
    /// rather than 4/3, and a 2.95 MB PDF then breaks Graph's 4 MB request limit with a 413
    /// on every attempt (found in review, #29 — and true of the old 3 MB cap too). Relaxed
    /// escaping is safe here: this JSON goes to Graph and is never written into a page.
    /// </summary>
    private static readonly JsonSerializerOptions GraphJson = new(JsonSerializerDefaults.Web)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>
    /// The HttpClient name for calls to an upload session's own URL. Registered in
    /// Program.cs WITHOUT the factory's request logging: that URL carries the session's
    /// access token in its query string, and .NET 8's HttpClient logging writes request URLs
    /// out whole — a credential in the log for every piece of every large file.
    /// </summary>
    public const string UploadClientName = "graph-upload-session";

    /// <summary>
    /// Bytes per PUT to an upload session: under the documented 4 MB per request, and a
    /// multiple of 320 KiB as well — the Outlook guide does not ask for that, the SDK's
    /// own sample does, and 10 × 320 KiB satisfies both readings. A 20 MB file is 7 PUTs.
    /// </summary>
    public const int UploadChunkBytes = 10 * 320 * 1024;

    /// <summary>
    /// What the sendMail fallback can carry, in raw bytes. That path is ONE JSON request
    /// with the files base64'd inside it, so it lives under Graph's 4 MB request limit and
    /// cannot use upload sessions at all (they need a message, i.e. Mail.ReadWrite — the
    /// grant this path exists for lacking). 2.8 MB is 3.73 MB once base64'd (with GraphJson;
    /// the web default would make it 4.02 MB), leaving the reply's own body room under the
    /// limit.
    /// </summary>
    public const long DirectSendMaxAttachmentBytes = 2_800_000;

    // How often a throttled piece (429/503) is tried before the send is given up.
    private const int MaxChunkAttempts = 3;

    // How long the send itself may take once it is asked for — HttpClient's own default,
    // made explicit because it now runs on its own clock rather than the request's.
    private static readonly TimeSpan SendTimeout = TimeSpan.FromSeconds(100);

    // SentNotRecorded is the outcome discovered the hard way (2026-09-11, lead #334): the
    // customer received the email — several times — because every failure AFTER the send
    // was reported as "not sent" and the person did the reasonable thing and pressed Send
    // again. The two states must never share a message: one invites a retry, the other
    // forbids it.
    public enum SendOutcome { Sent, SentNotRecorded, NotConfigured, LeadNotFound, NoAddress, Failed }

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
        int leadId, string? subject, string body, string? actorUpn,
        IReadOnlyList<OutgoingFile>? attachments = null, IReadOnlyList<string>? cc = null,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
            return new SendResult(SendOutcome.NotConfigured, null, "Email is not configured.");

        var lead = await _db.Leads.AsNoTracking().FirstOrDefaultAsync(l => l.Id == leadId, ct);
        if (lead is null)
            return new SendResult(SendOutcome.LeadNotFound, null, "No such lead.");

        // Deliberately before the CC list is even looked at: a CC is a copy of the reply
        // to the customer, never a substitute recipient. A reply that went only to the
        // copied colleague would show the thread answered while the customer heard nothing.
        if (string.IsNullOrWhiteSpace(lead.Email))
            return new SendResult(SendOutcome.NoAddress, null,
                "This lead has no email address — reply by phone, and log the call.");

        // Reuse the existing subject so the customer's mail client threads it, rather than
        // starting a new conversation on every reply.
        var resolvedSubject = string.IsNullOrWhiteSpace(subject)
            ? await DefaultSubjectAsync(leadId, lead, ct)
            : subject!.Trim();

        // Set the moment the send itself is asked for. Before it, nothing can have reached the
        // customer and "not sent, try again" is the truth; after it, any answer short of a
        // definite refusal means the email MAY be out, and "try again" is how a customer gets
        // the same 20 MB twice (lead #334). The catches below read this, not the exception type.
        var sendAttempted = false;

        try
        {
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
            //
            // ONLY a refused CREATE means that. A 401/403 later in the flow — attaching, or
            // the send itself — comes from a mailbox that just created a draft, so the grant
            // the fallback exists for is plainly there; treating it as missing would send
            // the reply down a path that cannot carry large files and then blame the wrong
            // permission (found in review, #29).
            try
            {
                (messageId, conversationId) = await CreateDraftAsync(
                    await _tokens.GetAsync(ct), lead.Email!, resolvedSubject, body, cc, ct);
            }
            catch (GraphException ex) when (ex.IsPermissionProblem)
            {
                // Refused here, before sendMail is asked, and named: past this size that one
                // JSON request is over Graph's limit and would come back 413 — a "try again"
                // that can never succeed. Nothing has been sent at this point.
                var inline = attachments?.Sum(a => a.Content.LongLength) ?? 0;
                if (inline > DirectSendMaxAttachmentBytes)
                    throw new DirectSendTooLargeException(inline, ex.Status);

                // Its own clock, for the reason given at SendDraftAsync below.
                using var sending = new CancellationTokenSource(SendTimeout);
                var directToken = await _tokens.GetAsync(sending.Token);
                sendAttempted = true;
                await SendDirectAsync(directToken, lead.Email!, resolvedSubject, body, cc, attachments, sending.Token);

                _log.LogWarning(
                    "Mail.ReadWrite is not granted for {Mailbox}, so the reply was sent without " +
                    "capturing a conversation id. The reply is delivered; the customer's answer " +
                    "will not thread back automatically until Mail.ReadWrite is granted.",
                    _env.GraphSender);
            }

            if (messageId is not null)
            {
                // Onto the draft rather than into its creation payload: attaching
                // separately is what keeps one oversized file from failing the whole
                // message creation, and it is the documented route for anything but the
                // smallest parts.
                if (attachments is { Count: > 0 })
                {
                    try
                    {
                        foreach (var file in attachments)
                            await AttachToDraftAsync(messageId, file, ct);
                    }
                    catch
                    {
                        // The draft now holds a half-built reply nobody will send, in the
                        // shared mailbox's Drafts where the team would find it and wonder.
                        // Gone before the failure is reported — with large files there are
                        // more ways for this step to fail than there used to be.
                        await TryDeleteDraftAsync(messageId);
                        throw;
                    }
                }

                try
                {
                    // On its own clock, not the request's: once the send is asked for, a
                    // browser closing must not cancel the read of Graph's 202 — the email
                    // would be out and this code would believe otherwise.
                    using var sending = new CancellationTokenSource(SendTimeout);
                    sendAttempted = true;
                    await SendDraftAsync(messageId, sending.Token);
                }
                catch (GraphException ex) when ((int)ex.Status is >= 400 and < 500)
                {
                    // A 4xx is a definitive refusal: nothing went out, so the finished draft
                    // goes too, rather than waiting in Drafts for a colleague to send it from
                    // Outlook, outside the thread. A 5xx or a dropped connection is NOT
                    // definitive — the message may have left — and keeps its draft.
                    await TryDeleteDraftAsync(messageId);
                    throw;
                }
            }

            // From here the customer has the email, so the bookkeeping runs on its own clocks
            // rather than the request's. The browser closing on a long 20 MB send must not
            // cancel the thread entry halfway — that is how a reply goes unrecorded, gets
            // sent again, and arrives twice (lead #334). Bounded, so nothing can hang: each
            // file copy gets its own clock (a slow one loses only that copy), and the thread
            // entry gets a fresh one after them, so the copies can never spend its time.

            // Everything from here on is bookkeeping about an email THE CUSTOMER ALREADY
            // HAS. Its own catch, because a failure here must never wear the "not sent"
            // message — that message is an instruction to try again, and trying again
            // sends the customer a duplicate. This is not hypothetical: see SendOutcome.
            try
            {
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
                    // Recorded from the same list both send paths were handed, so the thread
                    // shows exactly who was copied — the send-first ordering above only keeps
                    // the record honest if what is written is what went out.
                    CcRecipients = cc is { Count: > 0 } ? string.Join(", ", cc) : null,
                    OccurredAt = now,
                };
                // Stored only now, and only if the send worked. A file recorded against a
                // reply that never left would show sales an attachment the customer does not
                // have — the same lie the send-first ordering above exists to avoid.
                //
                // A storage failure here is logged and swallowed: the customer has the file,
                // and losing the whole thread entry over a copy of it would be the worse
                // trade by a distance.
                if (attachments is { Count: > 0 })
                {
                    foreach (var file in attachments)
                    {
                        try
                        {
                            var key = LeadFileStore.MintKey(leadId, file.FileName);
                            using var stream = new System.IO.MemoryStream(file.Content);
                            using var copying = new CancellationTokenSource(TimeSpan.FromSeconds(90));
                            await _files.UploadAsync(key, stream, file.ContentType, copying.Token);

                            activity.Attachments.Add(new LeadAttachment
                            {
                                FileName = file.FileName,
                                BlobKey = key,
                                ContentType = file.ContentType,
                                SizeBytes = file.Content.LongLength,
                                UploadedByUpn = actorUpn,
                            });
                        }
                        // Cancellation included: it can only be this copy's own clock.
                        catch (Exception ex)
                        {
                            _log.LogError(ex,
                                "Reply to lead {LeadId} was sent with {FileName}, but the copy could " +
                                "not be stored — the thread will not show it", leadId, file.FileName);
                        }
                    }
                }

                _db.LeadActivities.Add(activity);

                using var recording = new CancellationTokenSource(TimeSpan.FromSeconds(60));
                var recordCt = recording.Token;
                var tracked = await _db.Leads.FirstAsync(l => l.Id == leadId, recordCt);
                if (tracked.LastActivityAt is null || now > tracked.LastActivityAt) tracked.LastActivityAt = now;
                tracked.UpdatedAt = now;

                // A reply is a move like any other, so it schedules the next one. Here rather
                // than only in LeadService.AddActivityAsync because this path writes its own
                // activity — the send has to happen first, so it cannot go through that method —
                // and a rule that held for a logged call but not for the email somebody actually
                // sent would be the one people noticed.
                tracked.NextContactAt = LeadService.FollowUpAfterOurMove(tracked.NextContactAt, now);

                await _db.SaveChangesAsync(recordCt);

                return new SendResult(SendOutcome.Sent, activity.Id, null);
            }
            // Cancellation included: here it can only be the bookkeeping's own clock running
            // out, and the email is still with the customer either way.
            catch (Exception ex)
            {
                // Logged loudly: the customer has a reply that the thread does not show,
                // and this log line is the only place that says so — and the only place
                // holding the actual reason recording failed.
                _log.LogError(ex,
                    "Reply to lead {LeadId} WAS SENT but could not be recorded in the thread",
                    leadId);

                return new SendResult(SendOutcome.SentNotRecorded, null,
                    "The email WAS sent — do not send it again. It could not be written " +
                    "into the thread; log it as a note instead.");
            }
        }
        // A send was asked for and did not come back with a definite answer — a timeout, a
        // dropped connection, a 5xx. The email may be out. Logged as such whatever happens next
        // (it is the only record that it might be), and never answered with "try again".
        catch (Exception ex) when (sendAttempted && !IsDefiniteRefusal(ex))
        {
            _log.LogError(ex,
                "Reply to lead {LeadId}: the send was asked for but not confirmed — it MAY have gone out",
                leadId);

            // Nobody is left to read the answer if the browser went; the log line above is
            // what someone will find.
            if (ex is OperationCanceledException && ct.IsCancellationRequested) throw;

            return new SendResult(SendOutcome.Failed, null, MayHaveGoneOut);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // The browser left before anything was sent; nobody is waiting for an answer.
            throw;
        }
        catch (OperationCanceledException ex)
        {
            // Not the browser, and before any send was asked for: the mail service did not
            // answer in time, and whatever was half-built has been removed.
            _log.LogError(ex, "Reply to lead {LeadId}: the mail service did not answer in time", leadId);
            return new SendResult(SendOutcome.Failed, null,
                "The reply was not sent — the mail service did not answer in time. Try again.");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Reply to lead {LeadId} failed before the send completed", leadId);

            // A permission failure will not fix itself on a retry, and "try again" sends
            // someone clicking a button that cannot work. Name the cause instead. Other
            // Graph refusals carry their status code — "Graph answered 429" is something
            // support can act on, "try again" is not.
            var message = ex switch
            {
                GraphException g when g.AttachingFile is not null =>
                    $"The reply was not sent: the mail service would not take '{g.AttachingFile}' (it answered {(int)g.Status}). Try again.",
                GraphException g when g.IsPermissionProblem =>
                    "The mailbox refused the send. Check that Mail.Send is granted and the access policy covers this mailbox.",
                GraphException g =>
                    $"The reply was not sent (the mail service answered {(int)g.Status}). Try again.",
                // Not "try again": the same files will be refused the same way every time. And
                // said as what was SEEN — the draft was refused — not as one certain cause: an
                // access policy that misses this mailbox looks exactly the same from here.
                DirectSendTooLargeException big =>
                    $"The reply was NOT sent. The mailbox refused to create a draft (it answered {(int)big.CreateStatus}) — " +
                    "usually because the app has no Mail.ReadWrite, or the access policy does not cover this mailbox — " +
                    $"and without a draft only {Megabytes(DirectSendMaxAttachmentBytes, roundUp: false)} of files can go " +
                    $"with a reply; these are {Megabytes(big.Bytes, roundUp: true)}. Log the big files to the conversation " +
                    "and send a link, or fix the grant (a new grant can take up to an hour to apply).",
                AttachmentUploadException up =>
                    $"The reply was not sent: uploading '{up.FileName}' failed ({up.Detail}). Try again.",
                _ => "The reply was not sent. Try again.",
            };

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
        public GraphException(
            System.Net.HttpStatusCode status, string message, string? attachingFile = null, bool sending = false)
            : base(message)
        {
            Status = status;
            AttachingFile = attachingFile;
            Sending = sending;
        }

        public System.Net.HttpStatusCode Status { get; }

        // Which step said no, so the sentence the person reads names it: a refused attachment
        // is about that file, not about the send permission.
        public string? AttachingFile { get; }
        public bool Sending { get; }

        // 403 is the documented answer for a missing application permission. 401 is
        // included because a token minted before a grant was added comes back
        // unauthorized rather than forbidden, and the fallback is right in both cases.
        public bool IsPermissionProblem =>
            Status == System.Net.HttpStatusCode.Forbidden || Status == System.Net.HttpStatusCode.Unauthorized;
    }

    /// <summary>
    /// The sendMail fallback was about to be asked to carry more than it can (see
    /// DirectSendMaxAttachmentBytes). Thrown before anything is sent.
    /// </summary>
    public sealed class DirectSendTooLargeException : Exception
    {
        public DirectSendTooLargeException(long bytes, System.Net.HttpStatusCode createStatus)
            : base($"{bytes} bytes is too much for sendMail.")
        {
            Bytes = bytes;
            CreateStatus = createStatus;
        }

        public long Bytes { get; }

        // What the draft creation answered — the observation the message reports.
        public System.Net.HttpStatusCode CreateStatus { get; }
    }

    private const string MayHaveGoneOut =
        "The mail service did not confirm the send, so the reply MAY have gone out. Check the Sent Items " +
        "of the shared mailbox before sending it again.";

    // A refusal that settles the matter: Graph said no (4xx), so nothing went out.
    private static bool IsDefiniteRefusal(Exception ex) =>
        ex is GraphException g && (int)g.Status is >= 400 and < 500;

    // A size for a sentence, rounded the way that keeps a refusal honest: the limit DOWN and
    // the size UP, so the two can never print as the same number. Culture-invariant, so the
    // server's locale cannot turn "2.7" into "2,7".
    private static string Megabytes(long bytes, bool roundUp)
    {
        var tenths = bytes / (1024.0 * 1024.0) * 10;
        var value = (roundUp ? Math.Ceiling(tenths) : Math.Floor(tenths)) / 10;
        return value.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) + " MB";
    }

    /// <summary>
    /// A piece of a large file was refused by the upload session.
    ///
    /// Deliberately NOT a GraphException. The session's URL carries its own token, so a 401
    /// from it means that token expired — not that a permission is missing — and as a
    /// GraphException it would trip IsPermissionProblem and send the reply down the sendMail
    /// fallback, which then refuses the size and blames a permission that is fine.
    /// </summary>
    public sealed class AttachmentUploadException : Exception
    {
        public AttachmentUploadException(string fileName, string detail) : base($"Upload of '{fileName}' failed: {detail}")
        {
            FileName = fileName;
            Detail = detail;
        }

        public string FileName { get; }
        public string Detail { get; }
    }

    /// <summary>
    /// Sends without creating a message first. Needs only Mail.Send.
    ///
    /// The fallback: no conversationId comes back, so a reply to this message will not
    /// thread automatically. The customer still gets their answer, which is the part that
    /// cannot be allowed to fail.
    /// </summary>
    private async Task SendDirectAsync(
        string token, string toAddress, string subject, string body, IReadOnlyList<string>? cc,
        IReadOnlyList<OutgoingFile>? attachments, CancellationToken ct)
    {
        // A dictionary rather than an anonymous type, for the same reason as FileAttachment
        // below: ccRecipients must be genuinely absent when nobody is copied, and an
        // anonymous type can only ever null a property out.
        var message = new Dictionary<string, object?>
        {
            ["subject"] = subject,
            ["body"] = new { contentType = "HTML", content = body },
            ["toRecipients"] = Recipients(new[] { toAddress }),

            // Inline in the payload here, because this path has no message to attach
            // to afterwards — that is exactly the permission it is missing. The size
            // ceiling enforced by the caller is what keeps this request legal.
            ["attachments"] = attachments?.Select(FileAttachment).ToArray(),
        };
        if (cc is { Count: > 0 }) message["ccRecipients"] = Recipients(cc);

        var payload = new { message, saveToSentItems = true };

        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}/sendMail")
        {
            // GraphJson: the files ride inside this request as base64 — see GraphJson.
            Content = JsonContent.Create(payload, options: GraphJson),
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
        string token, string toAddress, string subject, string body,
        IReadOnlyList<string>? cc, CancellationToken ct)
    {
        // Same shape as SendDirectAsync's message, and a dictionary for the same reason:
        // absent and null are different things to send Graph.
        var payload = new Dictionary<string, object?>
        {
            ["subject"] = subject,
            ["body"] = new { contentType = "HTML", content = body },
            ["toRecipients"] = Recipients(new[] { toAddress }),
        };
        if (cc is { Count: > 0 }) payload["ccRecipients"] = Recipients(cc);

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

    /// <summary>
    /// Addresses in the shape Graph expects wherever recipients appear — the same for
    /// toRecipients and ccRecipients.
    /// </summary>
    private static object[] Recipients(IEnumerable<string> addresses) =>
        addresses.Select(a => (object)new { emailAddress = new { address = a } }).ToArray();

    /// <summary>
    /// One file, in the shape Graph expects wherever an attachment may appear.
    /// </summary>
    private static object FileAttachment(OutgoingFile file) => new Dictionary<string, object>
    {
        // The type discriminator is not optional: without it Graph cannot tell a file
        // from a reference to one, and rejects the whole message.
        ["@odata.type"] = "#microsoft.graph.fileAttachment",
        ["name"] = file.FileName,
        ["contentType"] = file.ContentType,
        ["contentBytes"] = Convert.ToBase64String(file.Content),
    };

    /// <summary>
    /// Hangs one file on a message that has been created but not yet sent — in one request
    /// below UploadSessionThresholdBytes, through an upload session at or above it.
    ///
    /// The token is fetched per call, not once per reply: a 20 MB send with a throttled
    /// piece can outlive a token minted a minute before expiry, and the 401 that follows is
    /// not a missing grant. GraphTokens caches, so asking again costs nothing.
    /// </summary>
    private async Task AttachToDraftAsync(string messageId, OutgoingFile file, CancellationToken ct)
    {
        // A session refused as too small is the one reading of "3 MB" this code cannot know
        // in advance (see UploadSessionThresholdBytes); such a file fits a single POST.
        if (file.Content.LongLength >= UploadSessionThresholdBytes
            && await TryUploadLargeAttachmentAsync(messageId, file, ct))
            return;

        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{MessageUrl(messageId)}/attachments")
        {
            // GraphJson: the base64 has to fit 4 MB — see GraphJson.
            Content = JsonContent.Create(FileAttachment(file), options: GraphJson),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await _tokens.GetAsync(ct));

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var raw = await response.Content.ReadAsStringAsync(ct);
            throw new GraphException(response.StatusCode,
                $"Graph attach '{file.FileName}' failed: {(int)response.StatusCode} {raw}", attachingFile: file.FileName);
        }
    }

    /// <summary>
    /// One file of 3 MB or more onto a draft, through an upload session (#29).
    ///
    /// The protocol, from learn.microsoft.com/graph/outlook-large-attachments: open a session
    /// on the draft (an ordinary Graph call, with the token), then PUT the RAW bytes — not
    /// base64 — to the uploadUrl it returns, in order, each piece labelled with its
    /// Content-Range and sent WITHOUT an Authorization header: the URL is pre-authenticated
    /// on outlook.office.com and must not be customised. Every piece but the last answers
    /// 200 with where to continue; the last answers 201.
    ///
    /// False only when the service refuses the session because the file is under ITS
    /// minimum — the caller then sends it as a single POST.
    /// </summary>
    private async Task<bool> TryUploadLargeAttachmentAsync(string messageId, OutgoingFile file, CancellationToken ct)
    {
        var http = _httpFactory.CreateClient();
        var pieces = _httpFactory.CreateClient(UploadClientName);
        var total = file.Content.LongLength;

        string uploadUrl;
        using (var open = new HttpRequestMessage(HttpMethod.Post, $"{MessageUrl(messageId)}/attachments/createUploadSession")
        {
            // "AttachmentItem", capitalised, exactly as every documented example sends it — a
            // dictionary key, because JsonContent's web defaults camel-case PROPERTY names and
            // would quietly send "attachmentItem" from an anonymous type (caught by a test).
            Content = JsonContent.Create(new Dictionary<string, object>
            {
                ["AttachmentItem"] = new { attachmentType = "file", name = file.FileName, size = total, contentType = file.ContentType },
            }),
        })
        {
            open.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await _tokens.GetAsync(ct));

            using var response = await http.SendAsync(open, ct);
            var raw = await response.Content.ReadAsStringAsync(ct);

            // The one refusal that is not a failure: under the service's own minimum, which
            // is a single POST's size (see UploadSessionThresholdBytes).
            if (response.StatusCode == System.Net.HttpStatusCode.BadRequest
                && raw.Contains("ErrorAttachmentSizeShouldNotBeLessThanMinimumSize", StringComparison.Ordinal)
                && total < 3L * 1024 * 1024)
                return false;

            if (!response.IsSuccessStatusCode)
                throw new GraphException(response.StatusCode,
                    $"Graph upload session for '{file.FileName}' failed: {(int)response.StatusCode} {raw}", attachingFile: file.FileName);

            using var doc = JsonDocument.Parse(raw);
            uploadUrl = (doc.RootElement.TryGetProperty("uploadUrl", out var u) ? u.GetString() : null)
                ?? throw new AttachmentUploadException(file.FileName, "the mail service opened no upload session");
        }

        try
        {
            long offset = 0;
            while (offset < total)
            {
                var length = (int)Math.Min(UploadChunkBytes, total - offset);
                var (status, next) = await PutPieceAsync(pieces, uploadUrl, file, offset, length, ct);

                // 201: the whole file is on the draft.
                if (status == System.Net.HttpStatusCode.Created) return true;

                // 200: carry on from where the SERVICE says it is, not from our own sum —
                // after a dropped piece the two differ, and the service is the one that knows.
                // A position that does not move forward would loop forever, so it is a failure.
                var resumeAt = next ?? offset + length;
                if (resumeAt <= offset)
                    throw new AttachmentUploadException(file.FileName, $"no progress past byte {offset}");
                offset = resumeAt;
            }

            throw new AttachmentUploadException(file.FileName, "every byte was sent but the attachment was never created");
        }
        catch
        {
            // Abandoned rather than left to expire: a session holds the file's bytes in the
            // mailbox until it does. Best effort, the failure itself is what gets reported.
            await TryCancelUploadAsync(pieces, uploadUrl);
            throw;
        }
    }

    /// <summary>
    /// One piece of a large file. Throttling (429, or 503) is waited out and retried — the
    /// documented answer, with Retry-After honoured when the service sends one; anything
    /// else is a failure of the whole send.
    /// </summary>
    private static async Task<(System.Net.HttpStatusCode Status, long? Next)> PutPieceAsync(
        HttpClient http, string uploadUrl, OutgoingFile file, long offset, int length, CancellationToken ct)
    {
        var total = file.Content.LongLength;
        for (var attempt = 1; ; attempt++)
        {
            using var put = new HttpRequestMessage(HttpMethod.Put, uploadUrl)
            {
                Content = new ByteArrayContent(file.Content, (int)offset, length),
            };
            put.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            put.Content.Headers.ContentRange = new ContentRangeHeaderValue(offset, offset + length - 1, total);
            // NO Authorization header — see UploadLargeAttachmentAsync.

            using var response = await http.SendAsync(put, ct);
            if (response.StatusCode is System.Net.HttpStatusCode.OK or System.Net.HttpStatusCode.Created)
                return (response.StatusCode, NextExpectedByte(await response.Content.ReadAsStringAsync(ct)));

            var throttled = (int)response.StatusCode is 429 or 503;
            if (throttled && attempt < MaxChunkAttempts)
            {
                await Task.Delay(RetryDelay(response, attempt), ct);
                continue;
            }

            var raw = await response.Content.ReadAsStringAsync(ct);
            throw new AttachmentUploadException(file.FileName,
                $"bytes {offset}-{offset + length - 1}/{total} answered {(int)response.StatusCode} {raw}".Trim());
        }
    }

    // The service's Retry-After when it gave one (capped — a reply is waiting on a person),
    // otherwise a short doubling backoff.
    private static TimeSpan RetryDelay(HttpResponseMessage response, int attempt)
    {
        var cap = TimeSpan.FromSeconds(30);
        var given = response.Headers.RetryAfter?.Delta
            ?? (response.Headers.RetryAfter?.Date is DateTimeOffset at ? at - DateTimeOffset.UtcNow : null);
        if (given is TimeSpan wait) return wait < TimeSpan.Zero ? TimeSpan.Zero : (wait > cap ? cap : wait);
        return TimeSpan.FromSeconds(Math.Pow(2, attempt));
    }

    /// <summary>
    /// Where the upload session wants the next piece to start, from a 200's body. For
    /// Outlook the docs say a single "{start}"; the first response shows "0-", and the
    /// guide allows that more than one range may appear — so the leading number of the
    /// first entry is taken, and property names are matched without regard to case
    /// (the documented examples mix them). Null when the body says nothing usable.
    /// </summary>
    public static long? NextExpectedByte(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (!property.Name.Equals("nextExpectedRanges", StringComparison.OrdinalIgnoreCase)) continue;
                if (property.Value.ValueKind != JsonValueKind.Array || property.Value.GetArrayLength() == 0) return null;
                var first = property.Value[0].GetString() ?? "";
                var digits = new string(first.TakeWhile(char.IsAsciiDigit).ToArray());
                return long.TryParse(digits, out var start) ? start : null;
            }
        }
        catch (JsonException)
        {
        }
        return null;
    }

    // DELETE on the uploadUrl itself, also without a token; 204 when it worked. Never throws.
    private async Task TryCancelUploadAsync(HttpClient http, string uploadUrl)
    {
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var request = new HttpRequestMessage(HttpMethod.Delete, uploadUrl);
            using var response = await http.SendAsync(request, timeout.Token);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Could not cancel an abandoned attachment upload session");
        }
    }

    // A failed reply's draft, removed so contact@'s Drafts does not collect half-built
    // replies. Its own short timeout and never the request's token: the request may be the
    // very thing that was cancelled. Never throws — the failure being reported is the other one.
    private async Task TryDeleteDraftAsync(string messageId)
    {
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            var http = _httpFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Delete, MessageUrl(messageId));
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await _tokens.GetAsync(timeout.Token));
            using var response = await http.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
                _log.LogWarning("Could not delete the unsent draft {MessageId}: {Status}", messageId, (int)response.StatusCode);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Could not delete the unsent draft {MessageId}", messageId);
        }
    }

    private string MessageUrl(string messageId) =>
        $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}/messages/{Uri.EscapeDataString(messageId)}";

    private async Task SendDraftAsync(string messageId, CancellationToken ct)
    {
        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{MessageUrl(messageId)}/send");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await _tokens.GetAsync(ct));

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var raw = await response.Content.ReadAsStringAsync(ct);
            throw new GraphException(response.StatusCode, $"Graph send failed: {(int)response.StatusCode} {raw}", sending: true);
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
