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
    public sealed record Call(string Url, string Body);

    public List<Call> Calls { get; } = new();

    private readonly Queue<(HttpStatusCode Status, string Body)> _responses = new();

    public void Enqueue(HttpStatusCode status, string body) => _responses.Enqueue((status, body));

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
        Calls.Add(new Call(request.RequestUri!.ToString(), body));

        var (status, responseBody) = _responses.Count > 0 ? _responses.Dequeue() : (HttpStatusCode.OK, "{}");
        return new HttpResponseMessage(status)
        {
            Content = new StringContent(responseBody, System.Text.Encoding.UTF8, "application/json"),
        };
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
