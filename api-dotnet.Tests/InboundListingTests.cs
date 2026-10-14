using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// What the inbound poller takes from the mailbox listing, and how it decides a message is
// already in a thread. Pinned as data, like InboundAttachmentTests, because both went wrong
// quietly: a panel reply caught as a draft could be filed as the customer speaking, a
// "from": null failed every tick it appeared in, and ids differing only in letter case were
// treated by the database as one.
public class InboundListingTests
{
    private const string Received = "2026-10-15T08:30:00Z";

    [Fact]
    public void An_ordinary_message_is_read_whole()
    {
        var messages = LeadMailPoller.ParseMessageList($$"""
        { "value": [ {
            "id": "AAMk-1", "conversationId": "conv-1", "subject": "Re: оферта",
            "body": { "contentType": "html", "content": "<p>Yes please.</p>" },
            "from": { "emailAddress": { "name": "Ivan", "address": "ivan@example.com" } },
            "receivedDateTime": "{{Received}}", "isDraft": false } ] }
        """);

        var m = Assert.Single(messages);
        Assert.Equal("AAMk-1", m.Id);
        Assert.Equal("conv-1", m.ConversationId);
        Assert.Equal("Re: оферта", m.Subject);
        Assert.Equal("<p>Yes please.</p>", m.Body);
        Assert.Equal("ivan@example.com", m.FromAddress);
        Assert.Equal(DateTimeOffset.Parse(Received), m.ReceivedAt);
    }

    [Fact]
    public void A_draft_is_skipped_whoever_it_seems_to_be_from()
    {
        // Our own reply, caught between creation and send. Filed, it would show the
        // worker's words as the customer's and take the id our record needs.
        var messages = LeadMailPoller.ParseMessageList($$"""
        { "value": [
          { "id": "draft-1", "conversationId": "conv-1", "subject": "Re: оферта",
            "body": { "content": "<p>Our reply</p>" }, "receivedDateTime": "{{Received}}", "isDraft": true },
          { "id": "draft-2", "conversationId": "conv-1",
            "from": { "emailAddress": { "address": "ivan@example.com" } },
            "receivedDateTime": "{{Received}}", "isDraft": true },
          { "id": "real-1", "conversationId": "conv-1",
            "from": { "emailAddress": { "address": "ivan@example.com" } },
            "receivedDateTime": "{{Received}}", "isDraft": false }
        ] }
        """);

        Assert.Equal(new[] { "real-1" }, messages.Select(m => m.Id));
    }

    [Fact]
    public void A_listing_without_the_draft_flag_still_reads_every_message()
    {
        // isDraft absent is not a draft: a tenant or API version that leaves it out must not
        // stop inbound mail.
        var messages = LeadMailPoller.ParseMessageList($$"""
        { "value": [ { "id": "AAMk-1", "from": { "emailAddress": { "address": "ivan@example.com" } },
                       "receivedDateTime": "{{Received}}" } ] }
        """);

        Assert.Single(messages);
    }

    [Fact]
    public void A_missing_or_null_sender_is_no_sender_rather_than_a_failed_tick()
    {
        var messages = LeadMailPoller.ParseMessageList($$"""
        { "value": [
          { "id": "no-from", "receivedDateTime": "{{Received}}" },
          { "id": "null-from", "from": null, "receivedDateTime": "{{Received}}" },
          { "id": "null-address", "from": { "emailAddress": null }, "receivedDateTime": "{{Received}}" },
          { "id": "odd-from", "from": "ivan@example.com", "body": null, "subject": null,
            "receivedDateTime": "{{Received}}" },
          { "id": "fine", "from": { "emailAddress": { "address": "ivan@example.com" } },
            "receivedDateTime": "{{Received}}" }
        ] }
        """);

        Assert.Equal(new[] { "no-from", "null-from", "null-address", "odd-from", "fine" }, messages.Select(m => m.Id));
        Assert.All(messages.Take(4), m => Assert.Null(m.FromAddress));
        Assert.Equal("", messages[3].Body);
        Assert.Null(messages[3].Subject);
        Assert.Equal("ivan@example.com", messages[4].FromAddress);
    }

    [Fact]
    public void Entries_without_a_usable_id_are_skipped()
    {
        var messages = LeadMailPoller.ParseMessageList("""
        { "value": [ { "id": null }, { "id": "" }, { "subject": "no id" }, 42, { "id": "kept" } ] }
        """);

        Assert.Equal(new[] { "kept" }, messages.Select(m => m.Id));
    }

    [Fact]
    public void A_listing_with_no_value_array_is_empty()
    {
        Assert.Empty(LeadMailPoller.ParseMessageList("{}"));
        Assert.Empty(LeadMailPoller.ParseMessageList("""{ "value": null }"""));
    }

    // --- Already filed? ---------------------------------------------------------------------

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"listing-{Guid.NewGuid()}")
            .Options);

    private static async Task<int> SeedAsync(AppDbContext db, params string[] filedIds)
    {
        var lead = new Lead { Name = "Ivan Petrov", Email = "ivan@example.com", Status = LeadStatuses.Contacted };
        db.Leads.Add(lead);
        await db.SaveChangesAsync();
        foreach (var id in filedIds)
            db.LeadActivities.Add(new LeadActivity
            {
                LeadId = lead.Id, Type = LeadActivityTypes.EmailIn, Body = "x",
                ExternalMessageId = id, ConversationId = "conv-" + id,
            });
        await db.SaveChangesAsync();
        return lead.Id;
    }

    [Fact]
    public async Task A_message_already_in_a_thread_is_known_and_its_case_twin_is_new()
    {
        // 'Z' and 'z' are different base64url digits: two different messages.
        using var db = NewDb();
        await SeedAsync(db, "AAMkAAAYbvZaAAA=");

        var known = await LeadMailPoller.AlreadyFiledAsync(
            db, new[] { "AAMkAAAYbvZaAAA=", "AAMkAAAYbvzaAAA=", "AAMk-never-seen" }, CancellationToken.None);

        Assert.Equal(new[] { "AAMkAAAYbvZaAAA=" }, known.ToArray());
        Assert.DoesNotContain("AAMkAAAYbvzaAAA=", known);
    }

    [Fact]
    public async Task Nothing_asked_is_nothing_known()
    {
        using var db = NewDb();
        await SeedAsync(db, "AAMk-1");

        Assert.Empty(await LeadMailPoller.AlreadyFiledAsync(db, Array.Empty<string>(), CancellationToken.None));
    }

    [Fact]
    public async Task Conversations_differing_only_in_case_belong_to_their_own_leads()
    {
        using var db = NewDb();
        var first = await SeedAsync(db, "a");
        var second = await SeedAsync(db, "b");
        // Re-point the two conversations at case-twins of each other.
        var rows = await db.LeadActivities.OrderBy(a => a.Id).ToListAsync();
        rows[0].ConversationId = "AAQkConvZa";
        rows[1].ConversationId = "AAQkConvza";
        await db.SaveChangesAsync();

        var byConversation = await LeadMailPoller.LeadsByConversationAsync(
            db, new[] { "AAQkConvZa", "AAQkConvza" }, CancellationToken.None);

        Assert.Equal(first, byConversation["AAQkConvZa"]);
        Assert.Equal(second, byConversation["AAQkConvza"]);
    }

    // --- The SQL Server sees ----------------------------------------------------------------

    // Stands in for the server: the connection is never opened, and the first command is
    // caught and kept instead of sent.
    private sealed class FirstCommand : DbConnectionInterceptor, IDbCommandInterceptor
    {
        public string? Text;

        public override ValueTask<InterceptionResult> ConnectionOpeningAsync(
            System.Data.Common.DbConnection connection, ConnectionEventData eventData,
            InterceptionResult result, CancellationToken ct = default) =>
            ValueTask.FromResult(InterceptionResult.Suppress());

        public ValueTask<InterceptionResult<System.Data.Common.DbDataReader>> ReaderExecutingAsync(
            System.Data.Common.DbCommand command, CommandEventData eventData,
            InterceptionResult<System.Data.Common.DbDataReader> result, CancellationToken ct = default)
        {
            Text = command.CommandText;
            throw new OperationCanceledException("captured");
        }
    }

    private static async Task<string> SqlSentBy(Func<AppDbContext, Task> query)
    {
        var capture = new FirstCommand();
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=127.0.0.1,1;Database=NeverOpened;Connect Timeout=1")
            .AddInterceptors(capture)
            .Options);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => query(db));
        return capture.Text!;
    }

    [Fact]
    public async Task The_id_lists_reach_SQL_Server_as_constants_that_take_the_columns_collation()
    {
        // EF 8 sends a list as JSON unpacked by OPENJSON, whose column has the database's
        // case-insensitive collation; against the binary id columns that is a collation
        // conflict (error 468) and every tick would fail. Constants take the column's.
        var ids = new[] { "AAMkAAAYbvZaAAA=", "AAMkAAAYbvzaAAA=" };

        var filed = await SqlSentBy(db => LeadMailPoller.AlreadyFiledAsync(db, ids, CancellationToken.None));
        Assert.DoesNotContain("OPENJSON", filed);
        Assert.Contains("[ExternalMessageId] IN (N'AAMkAAAYbvZaAAA=', N'AAMkAAAYbvzaAAA=')", filed);

        var routed = await SqlSentBy(db => LeadMailPoller.LeadsByConversationAsync(db, ids, CancellationToken.None));
        Assert.DoesNotContain("OPENJSON", routed);
        Assert.Contains("[ConversationId] IN (N'AAMkAAAYbvZaAAA=', N'AAMkAAAYbvzaAAA=')", routed);
    }

    [Fact]
    public async Task An_id_cannot_break_out_of_its_constant()
    {
        // The ids come from the mailbox, so the constants must be quoted, not pasted.
        var sql = await SqlSentBy(db => LeadMailPoller.AlreadyFiledAsync(
            db, new[] { "x'); DROP TABLE Leads;--" }, CancellationToken.None));

        Assert.Contains("N'x''); DROP TABLE Leads;--'", sql);
    }
}
