using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Serves canned Graph responses and keeps every request it saw, so the outbound reply
// path can be tested without a tenant — same idea as LeadImportTests' StubHandler, plus
// the recording, because these tests are ABOUT what the payload contained.
internal sealed class GraphStubHandler : HttpMessageHandler
{
    // Method, headers and raw bytes as well since #29: the large-attachment tests are about
    // HOW each piece went up — its Content-Range, and the Authorization header it must NOT
    // carry — as much as what it contained.
    public sealed record Call(
        string Url, string Body, string Method, IReadOnlyDictionary<string, string> Headers, byte[] Bytes)
    {
        public bool HasAuthorization => Headers.ContainsKey("Authorization");
        public string? Header(string name) => Headers.TryGetValue(name, out var value) ? value : null;
    }

    public List<Call> Calls { get; } = new();

    private readonly Queue<(HttpStatusCode Status, string Body, int? RetryAfterSeconds)> _responses = new();

    public void Enqueue(HttpStatusCode status, string body, int? retryAfterSeconds = null) =>
        _responses.Enqueue((status, body, retryAfterSeconds));

    // Runs AFTER a request is answered — how a test makes the browser walk away at an exact
    // point in the flow (cancelling the request's token right after /send, say).
    public Action<HttpRequestMessage>? AfterRequest { get; set; }

    // Answers a matching request with an exception instead of a response — a connection
    // reset (HttpRequestException) or a timeout (TaskCanceledException).
    public Func<HttpRequestMessage, Exception?>? FailWith { get; set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (FailWith?.Invoke(request) is Exception failure)
        {
            Calls.Add(new Call(request.RequestUri!.ToString(), "", request.Method.Method,
                new Dictionary<string, string>(), Array.Empty<byte>()));
            throw failure;
        }

        var response = await Answer(request, ct);
        AfterRequest?.Invoke(request);
        return response;
    }

    private async Task<HttpResponseMessage> Answer(HttpRequestMessage request, CancellationToken ct)
    {
        var bytes = request.Content is null ? Array.Empty<byte>() : await request.Content.ReadAsByteArrayAsync(ct);
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var h in request.Headers) headers[h.Key] = string.Join(",", h.Value);
        if (request.Content is not null)
        {
            foreach (var h in request.Content.Headers) headers[h.Key] = string.Join(",", h.Value);
            if (request.Content.Headers.ContentLength is long length) headers["Content-Length"] = length.ToString();
        }

        Calls.Add(new Call(request.RequestUri!.ToString(), System.Text.Encoding.UTF8.GetString(bytes),
            request.Method.Method, headers, bytes));

        var (status, responseBody, retryAfter) = _responses.Count > 0 ? _responses.Dequeue() : (HttpStatusCode.OK, "{}", null);
        var response = new HttpResponseMessage(status)
        {
            Content = new StringContent(responseBody, System.Text.Encoding.UTF8, "application/json"),
        };
        if (retryAfter is int seconds)
            response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(seconds));
        return response;
    }
}

// Sending a reply, seen from Graph's side of the wire.
//
// What these pin is the CC contract: the copied addresses appear in whichever payload
// actually goes out — the create-draft path and the sendMail fallback both — and what the
// thread then records is exactly that list, because a record of a copy nobody received
// would be the same lie the send-first ordering exists to prevent.
public class LeadMailSendTests
{
    private sealed class HandlerFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;
        public HandlerFactory(HttpMessageHandler handler) => _handler = handler;
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"reply-{Guid.NewGuid()}")
            .Options);

    private static LeadMailService Service(AppDbContext db, GraphStubHandler graph)
    {
        var env = new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["GRAPH_TENANT_ID"] = "tenant",
            ["GRAPH_CLIENT_ID"] = "client",
            ["GRAPH_CLIENT_SECRET"] = "secret",
            ["GRAPH_SENDER"] = "contact@nvc-home4you.eu",
        }).Build());

        var factory = new HandlerFactory(graph);
        return new LeadMailService(
            db, env, factory, new GraphTokens(env, factory),
            new LeadFileStore(env, NullLogger<LeadFileStore>.Instance),
            NullLogger<LeadMailService>.Instance);
    }

    private static async Task<int> LeadAsync(AppDbContext db, string? email = "ivan@example.com")
    {
        var lead = new Lead { Name = "Ivan Petrov", Email = email, Status = LeadStatuses.Contacted };
        db.Leads.Add(lead);
        await db.SaveChangesAsync();
        return lead.Id;
    }

    private const string Token = """{ "access_token": "tok", "expires_in": 3600 }""";
    private const string Draft = """{ "id": "m1", "conversationId": "c1" }""";

    // Call [0] is always the token fetch; the first Graph message call is [1].
    private static JsonDocument Payload(GraphStubHandler graph, int call) =>
        JsonDocument.Parse(graph.Calls[call].Body);

    [Fact]
    public async Task The_copied_addresses_ride_in_the_draft_payload_and_land_in_the_thread()
    {
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);      // create draft
        graph.Enqueue(HttpStatusCode.Accepted, "");        // send it

        var result = await Service(db, graph).SendReplyAsync(
            leadId, "Re: оферта", "<p>Costed below.</p>", "maria@nvc.eu",
            cc: new[] { "office@partner.bg", "boss@nvc.eu" });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);

        using var payload = Payload(graph, 1);
        var cc = payload.RootElement.GetProperty("ccRecipients");
        Assert.Equal(2, cc.GetArrayLength());
        Assert.Equal("office@partner.bg", cc[0].GetProperty("emailAddress").GetProperty("address").GetString());
        // The customer stays the recipient; the copies are only ever copies.
        Assert.Equal("ivan@example.com",
            payload.RootElement.GetProperty("toRecipients")[0]
                .GetProperty("emailAddress").GetProperty("address").GetString());

        // And the record says what the wire said.
        var activity = await db.LeadActivities.SingleAsync();
        Assert.Equal("office@partner.bg, boss@nvc.eu", activity.CcRecipients);
    }

    [Fact]
    public async Task A_reply_with_nobody_copied_sends_the_payload_it_always_did()
    {
        // Absent, not null: Graph is entitled to treat "ccRecipients": null and a missing
        // property differently, and the common case must stay the proven one.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Accepted, "");

        var result = await Service(db, graph).SendReplyAsync(
            leadId, "Re: оферта", "<p>Costed below.</p>", "maria@nvc.eu");

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);

        using var payload = Payload(graph, 1);
        Assert.False(payload.RootElement.TryGetProperty("ccRecipients", out _));

        Assert.Null((await db.LeadActivities.SingleAsync()).CcRecipients);
    }

    [Fact]
    public async Task The_send_direct_fallback_carries_the_same_copies()
    {
        // The degraded installation — Mail.Send without Mail.ReadWrite — must not also
        // quietly lose the CC. Create-draft answers 403, sendMail takes over.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Forbidden, """{ "error": { "code": "ErrorAccessDenied" } }""");
        graph.Enqueue(HttpStatusCode.Accepted, "");

        var result = await Service(db, graph).SendReplyAsync(
            leadId, "Re: оферта", "<p>Costed below.</p>", "maria@nvc.eu",
            cc: new[] { "office@partner.bg" });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.EndsWith("/sendMail", new Uri(graph.Calls[2].Url).AbsolutePath);

        using var payload = Payload(graph, 2);
        var message = payload.RootElement.GetProperty("message");
        Assert.Equal("office@partner.bg",
            message.GetProperty("ccRecipients")[0]
                .GetProperty("emailAddress").GetProperty("address").GetString());

        Assert.Equal("office@partner.bg", (await db.LeadActivities.SingleAsync()).CcRecipients);
    }

    // --- Large attachments (#29) ----------------------------------------------------------

    private const string UploadUrl = "https://outlook.office.com/api/v2.0/Users('x')/Messages('m1')/AttachmentSessions('s1')?authtoken=abc";
    private static readonly string Session = $$"""{ "uploadUrl": "{{UploadUrl}}", "expirationDateTime": "2026-10-01T18:00:00Z", "nextExpectedRanges": ["0-"] }""";

    // Bytes that say where they came from, so a slice that went up from the wrong offset
    // cannot pass for the right one.
    private static LeadMailService.OutgoingFile Pdf(string name, long size)
    {
        var bytes = new byte[size];
        for (var i = 0; i < bytes.Length; i++) bytes[i] = (byte)(i % 251);
        return new LeadMailService.OutgoingFile(name, "application/pdf", bytes);
    }

    private static string Next(long at) => $$"""{ "expirationDateTime": "2026-10-01T18:00:00Z", "nextExpectedRanges": ["{{at}}"] }""";

    [Fact]
    public async Task A_file_under_three_megabytes_still_goes_in_one_request()
    {
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Created, "{}");       // the attachment
        graph.Enqueue(HttpStatusCode.Accepted, "");        // send

        var file = Pdf("oferta.pdf", LeadMailService.UploadSessionThresholdBytes - 1);
        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu", new[] { file });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.EndsWith("/messages/m1/attachments", new Uri(graph.Calls[2].Url).AbsolutePath);
        using var payload = Payload(graph, 2);
        Assert.Equal(Convert.ToBase64String(file.Content), payload.RootElement.GetProperty("contentBytes").GetString());
        Assert.DoesNotContain(graph.Calls, c => c.Url.Contains("createUploadSession"));

        // And it FITS. The web default escapes every '+' of the base64 as "+", making
        // the body ~1.44× the file; a 2.95 MB PDF then broke Graph's 4 MB limit on every
        // attempt (found in review). Raw '+', and a body inside 4 MiB at the very edge.
        Assert.Contains('+', graph.Calls[2].Body);
        Assert.DoesNotContain("\\u002B", graph.Calls[2].Body);
        Assert.True(graph.Calls[2].Bytes.Length <= 4 * 1024 * 1024,
            $"{graph.Calls[2].Bytes.Length} bytes is over Graph's 4 MB request limit");
    }

    [Fact]
    public async Task A_session_refused_as_too_small_falls_back_to_the_single_request()
    {
        // The docs say "3 MB" and never which. A file between 3,000,000 and 3 MiB opens a
        // session first; if the service means 3 MiB it says so, and the file fits one POST.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.BadRequest, """{ "error": { "code": "ErrorAttachmentSizeShouldNotBeLessThanMinimumSize" } }""");
        graph.Enqueue(HttpStatusCode.Created, "{}");
        graph.Enqueue(HttpStatusCode.Accepted, "");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("scan.pdf", 3_100_000) });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.EndsWith("/createUploadSession", new Uri(graph.Calls[2].Url).AbsolutePath);
        Assert.EndsWith("/messages/m1/attachments", new Uri(graph.Calls[3].Url).AbsolutePath);
        Assert.True(graph.Calls[3].Bytes.Length <= 4 * 1024 * 1024);
    }

    [Fact]
    public async Task A_refused_send_after_the_draft_exists_names_mail_send_and_never_falls_back()
    {
        // The mailbox just CREATED a draft, so Mail.ReadWrite is plainly granted; a 403 at
        // /send means Mail.Send. Falling back to sendMail here would refuse the size and
        // blame the wrong permission (found in review). Nothing went out — the draft goes too.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Created, Session);
        graph.Enqueue(HttpStatusCode.Created, "");
        graph.Enqueue(HttpStatusCode.Forbidden, """{ "error": { "code": "ErrorAccessDenied" } }""");
        graph.Enqueue(HttpStatusCode.NoContent, "");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("plans.pdf", 3_200_000) });

        Assert.Equal(LeadMailService.SendOutcome.Failed, result.Outcome);
        Assert.Contains("Mail.Send", result.Error);
        Assert.DoesNotContain("Mail.ReadWrite", result.Error);
        Assert.DoesNotContain(graph.Calls, c => c.Url.EndsWith("/sendMail"));
        Assert.Equal("DELETE", graph.Calls[5].Method);
        Assert.EndsWith("/messages/m1", new Uri(graph.Calls[5].Url).AbsolutePath);
    }

    [Fact]
    public async Task A_send_that_fails_on_the_service_side_keeps_its_draft()
    {
        // A 5xx is not a definitive refusal — the message may have left — so the draft is
        // not deleted from under what might be a sent message.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.InternalServerError, "");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu");

        Assert.Equal(LeadMailService.SendOutcome.Failed, result.Outcome);
        Assert.DoesNotContain(graph.Calls, c => c.Method == "DELETE");

        // And the person is told so: "not sent, try again" here is how the customer gets the
        // same reply twice (found in the re-check).
        Assert.Contains("MAY have gone out", result.Error);
        Assert.DoesNotContain("Try again", result.Error);
    }

    [Fact]
    public async Task A_connection_dropped_during_the_send_is_a_maybe_not_a_no()
    {
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.FailWith = r => r.RequestUri!.AbsolutePath.EndsWith("/send")
            ? new HttpRequestException("connection reset by peer")
            : null;

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu");

        Assert.Equal(LeadMailService.SendOutcome.Failed, result.Outcome);
        Assert.Contains("MAY have gone out", result.Error);
        Assert.DoesNotContain(graph.Calls, c => c.Method == "DELETE");
    }

    [Fact]
    public async Task A_timeout_before_the_send_is_a_plain_not_sent()
    {
        // Nothing can have reached the customer — the draft is removed — so here, and only
        // here, "try again" is the right advice.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.NoContent, "");        // the draft's deletion
        graph.FailWith = r => r.RequestUri!.AbsolutePath.EndsWith("/createUploadSession")
            ? new TaskCanceledException("HttpClient.Timeout elapsed")
            : null;

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("plans.pdf", 4L * 1024 * 1024) });

        Assert.Equal(LeadMailService.SendOutcome.Failed, result.Outcome);
        Assert.Contains("not sent", result.Error);
        Assert.DoesNotContain("MAY have gone out", result.Error);
        Assert.Contains(graph.Calls, c => c.Method == "DELETE" && c.Url.EndsWith("/messages/m1"));
    }

    [Fact]
    public async Task An_attachment_refused_after_the_draft_exists_is_named_not_blamed_on_a_permission()
    {
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Forbidden, """{ "error": { "code": "ErrorAccessDenied" } }""");   // createUploadSession
        graph.Enqueue(HttpStatusCode.NoContent, "");                                                   // delete draft

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("plans.pdf", 5L * 1024 * 1024) });

        Assert.Equal(LeadMailService.SendOutcome.Failed, result.Outcome);
        Assert.Contains("'plans.pdf'", result.Error);
        Assert.DoesNotContain("Mail.ReadWrite", result.Error);
        Assert.DoesNotContain(graph.Calls, c => c.Url.EndsWith("/sendMail"));
        Assert.Equal("DELETE", graph.Calls[3].Method);
    }

    [Fact]
    public async Task A_browser_that_leaves_right_after_the_send_still_gets_the_reply_recorded()
    {
        // The customer has the email the moment /send answers 202. If closing the tab could
        // cancel the bookkeeping, the thread would show nothing, nothing would be logged, and
        // the reasonable next move — Send again — mails the customer twice (lead #334).
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Accepted, "");

        using var browser = new CancellationTokenSource();
        graph.AfterRequest = request =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("/send")) browser.Cancel();
        };

        var result = await Service(db, graph).SendReplyAsync(
            leadId, "Re", "<p>x</p>", "maria@nvc.eu", ct: browser.Token);

        Assert.True(browser.IsCancellationRequested);
        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.Equal(1, await db.LeadActivities.CountAsync());
    }

    [Fact]
    public async Task A_bigger_file_goes_up_in_ordered_raw_pieces_without_the_token()
    {
        // 7 MiB: three pieces of at most 3,276,800 bytes (10 × 320 KiB, under Graph's 4 MB).
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Created, Session);
        graph.Enqueue(HttpStatusCode.OK, Next(3_276_800));
        graph.Enqueue(HttpStatusCode.OK, Next(6_553_600));
        graph.Enqueue(HttpStatusCode.Created, "");
        graph.Enqueue(HttpStatusCode.Accepted, "");

        var file = Pdf("plans.pdf", 7L * 1024 * 1024);
        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu", new[] { file });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);

        // The session is an ordinary Graph call: token on, the size declared up front.
        var open = graph.Calls[2];
        Assert.EndsWith("/messages/m1/attachments/createUploadSession", new Uri(open.Url).AbsolutePath);
        Assert.True(open.HasAuthorization);
        using (var body = JsonDocument.Parse(open.Body))
        {
            var item = body.RootElement.GetProperty("AttachmentItem");
            Assert.Equal("file", item.GetProperty("attachmentType").GetString());
            Assert.Equal("plans.pdf", item.GetProperty("name").GetString());
            Assert.Equal(file.Content.LongLength, item.GetProperty("size").GetInt64());
        }

        // The pieces: to the uploadUrl verbatim, raw bytes in order, labelled, and NO token.
        var pieces = graph.Calls.Skip(3).Take(3).ToList();
        Assert.All(pieces, p =>
        {
            Assert.Equal("PUT", p.Method);
            Assert.Equal(UploadUrl, p.Url);
            Assert.False(p.HasAuthorization);
            Assert.Equal("application/octet-stream", p.Header("Content-Type"));
        });
        Assert.Equal("bytes 0-3276799/7340032", pieces[0].Header("Content-Range"));
        Assert.Equal("bytes 3276800-6553599/7340032", pieces[1].Header("Content-Range"));
        Assert.Equal("bytes 6553600-7340031/7340032", pieces[2].Header("Content-Range"));
        Assert.Equal(file.Content.Skip(3_276_800).Take(3_276_800).ToArray(), pieces[1].Bytes);
        Assert.Equal(file.Content.Skip(6_553_600).ToArray(), pieces[2].Bytes);

        // Sent only after the file is whole.
        Assert.EndsWith("/messages/m1/send", new Uri(graph.Calls[6].Url).AbsolutePath);
        Assert.Equal(7, graph.Calls.Count);
    }

    [Fact]
    public async Task Small_and_large_files_ride_one_reply_each_by_its_own_route()
    {
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Created, "{}");          // small one, single POST
        graph.Enqueue(HttpStatusCode.Created, Session);       // big one, session...
        graph.Enqueue(HttpStatusCode.Created, "");            // ...exactly the threshold is ONE piece
        graph.Enqueue(HttpStatusCode.Accepted, "");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("note.pdf", 200_000), Pdf("plans.pdf", LeadMailService.UploadSessionThresholdBytes) });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.EndsWith("/attachments", new Uri(graph.Calls[2].Url).AbsolutePath);
        Assert.EndsWith("/createUploadSession", new Uri(graph.Calls[3].Url).AbsolutePath);
        Assert.Equal("bytes 0-2999999/3000000", graph.Calls[4].Header("Content-Range"));
        Assert.EndsWith("/send", new Uri(graph.Calls[5].Url).AbsolutePath);
    }

    [Fact]
    public async Task The_next_piece_starts_where_the_service_says_not_where_we_counted()
    {
        // After a dropped connection the two differ, and the service is the one that knows.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Created, Session);
        graph.Enqueue(HttpStatusCode.OK, Next(1_000_000));
        graph.Enqueue(HttpStatusCode.Created, "");
        graph.Enqueue(HttpStatusCode.Accepted, "");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("plans.pdf", 4L * 1024 * 1024) });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.Equal("bytes 1000000-4194303/4194304", graph.Calls[4].Header("Content-Range"));
    }

    [Fact]
    public async Task A_throttled_piece_is_waited_out_and_sent_again()
    {
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Created, Session);
        graph.Enqueue(HttpStatusCode.TooManyRequests, "", retryAfterSeconds: 0);
        graph.Enqueue(HttpStatusCode.Created, "");
        graph.Enqueue(HttpStatusCode.Accepted, "");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("plans.pdf", 3L * 1024 * 1024 + 10) });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.Equal(graph.Calls[3].Header("Content-Range"), graph.Calls[4].Header("Content-Range"));
    }

    [Fact]
    public async Task A_failed_piece_sends_nothing_and_leaves_no_session_or_draft_behind()
    {
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Created, Session);
        graph.Enqueue(HttpStatusCode.InternalServerError, """{ "error": "boom" }""");
        graph.Enqueue(HttpStatusCode.NoContent, "");          // cancel the session
        graph.Enqueue(HttpStatusCode.NoContent, "");          // delete the draft

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("plans.pdf", 5L * 1024 * 1024) });

        Assert.Equal(LeadMailService.SendOutcome.Failed, result.Outcome);
        Assert.Contains("plans.pdf", result.Error);

        var cancel = graph.Calls[4];
        Assert.Equal("DELETE", cancel.Method);
        Assert.Equal(UploadUrl, cancel.Url);
        Assert.False(cancel.HasAuthorization);

        var deleteDraft = graph.Calls[5];
        Assert.Equal("DELETE", deleteDraft.Method);
        Assert.EndsWith("/messages/m1", new Uri(deleteDraft.Url).AbsolutePath);
        Assert.True(deleteDraft.HasAuthorization);

        Assert.DoesNotContain(graph.Calls, c => c.Url.EndsWith("/send") || c.Url.EndsWith("/sendMail"));
        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }

    [Fact]
    public async Task A_401_from_the_upload_url_is_an_expired_session_not_a_missing_permission()
    {
        // As a GraphException it would trip IsPermissionProblem, fall back to sendMail and
        // blame Mail.ReadWrite — which is granted; the session's own token had expired.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, Draft);
        graph.Enqueue(HttpStatusCode.Created, Session);
        graph.Enqueue(HttpStatusCode.Unauthorized, "");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("plans.pdf", 5L * 1024 * 1024) });

        Assert.Equal(LeadMailService.SendOutcome.Failed, result.Outcome);
        Assert.Contains("uploading 'plans.pdf' failed", result.Error);
        Assert.DoesNotContain("Mail.ReadWrite", result.Error);
        Assert.DoesNotContain(graph.Calls, c => c.Url.EndsWith("/sendMail"));
    }

    [Fact]
    public async Task Without_mail_readwrite_a_big_reply_is_refused_by_name_before_anything_is_sent()
    {
        // The sendMail fallback is one JSON request under Graph's 4 MB limit; past
        // DirectSendMaxAttachmentBytes it would 413 — a "try again" that can never succeed.
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Forbidden, """{ "error": { "code": "ErrorAccessDenied" } }""");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("plans.pdf", 2_850_000) });

        Assert.Equal(LeadMailService.SendOutcome.Failed, result.Outcome);
        Assert.Contains("NOT sent", result.Error);
        // What was SEEN, not one certain cause: an access policy looks the same from here.
        Assert.Contains("refused to create a draft (it answered 403)", result.Error);
        Assert.Contains("Mail.ReadWrite", result.Error);
        Assert.Contains("access policy", result.Error);
        // The limit rounded down, the size up — never the same number twice (found in re-check).
        Assert.Contains("only 2.6 MB of files", result.Error);
        Assert.Contains("these are 2.8 MB", result.Error);
        Assert.DoesNotContain(graph.Calls, c => c.Url.EndsWith("/sendMail"));
        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }

    [Fact]
    public async Task Without_mail_readwrite_a_small_reply_still_goes_out_inline()
    {
        using var db = NewDb();
        var leadId = await LeadAsync(db);
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Forbidden, """{ "error": { "code": "ErrorAccessDenied" } }""");
        graph.Enqueue(HttpStatusCode.Accepted, "");

        var result = await Service(db, graph).SendReplyAsync(leadId, "Re", "<p>x</p>", "maria@nvc.eu",
            new[] { Pdf("note.pdf", 1_000_000) });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.EndsWith("/sendMail", new Uri(graph.Calls[2].Url).AbsolutePath);
        using var payload = Payload(graph, 2);
        Assert.Equal(1, payload.RootElement.GetProperty("message").GetProperty("attachments").GetArrayLength());
    }

    [Theory]
    [InlineData("""{ "nextExpectedRanges": ["3276800"] }""", 3_276_800L)]
    [InlineData("""{ "nextExpectedRanges": ["0-"] }""", 0L)]                  // the first response's shape
    [InlineData("""{ "NextExpectedRanges": ["100-200", "300-"] }""", 100L)]   // case, and more than one range
    [InlineData("""{ "nextExpectedRanges": [] }""", null)]
    [InlineData("""{ "expirationDateTime": "2026-10-01T18:00:00Z" }""", null)]
    [InlineData("", null)]
    [InlineData("not json", null)]
    public void Where_to_continue_is_read_defensively(string body, long? expected)
    {
        Assert.Equal(expected, LeadMailService.NextExpectedByte(body));
    }

    [Fact]
    public void The_panel_counts_to_the_same_limit_the_server_enforces()
    {
        // Two copies of one number: the panel's must count first because App Service turns
        // requests past ~28.6 MB away before the app can answer with its own sentence.
        var dir = new System.IO.DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !System.IO.Directory.Exists(System.IO.Path.Combine(dir.FullName, "NVC Claude version")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var jsx = System.IO.File.ReadAllText(System.IO.Path.Combine(dir!.FullName, "NVC Claude version", "src", "pages", "AdminPipelinePage.jsx"));

        var match = System.Text.RegularExpressions.Regex.Match(jsx, @"const REPLY_MAX_BYTES = (\d+) \* 1024 \* 1024");
        Assert.True(match.Success, "REPLY_MAX_BYTES not found in AdminPipelinePage.jsx");
        Assert.Equal(LeadFileStore.MaxEmailBytes, long.Parse(match.Groups[1].Value) * 1024 * 1024);
    }

    [Fact]
    public async Task A_lead_with_no_address_is_not_replied_to_however_many_copies_were_asked_for()
    {
        // A CC is a copy of the reply to the customer, never a substitute recipient. A
        // send that reached only the copied colleague would mark the thread answered
        // while the customer heard nothing.
        using var db = NewDb();
        var leadId = await LeadAsync(db, email: null);
        var graph = new GraphStubHandler();

        var result = await Service(db, graph).SendReplyAsync(
            leadId, null, "<p>Hello?</p>", "maria@nvc.eu", cc: new[] { "office@partner.bg" });

        Assert.Equal(LeadMailService.SendOutcome.NoAddress, result.Outcome);
        Assert.Empty(graph.Calls);
        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }
}
