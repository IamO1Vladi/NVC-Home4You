using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// A reply that went out but whose Graph message id the database refused as a duplicate.
//
// Found on production 2026-10-15: the id column compared without regard to case, Graph ids
// are case-sensitive base64url, and two drafts whose mailbox counters differ by 26 get ids
// that differ only in the case of one character. The unique index then refused a second,
// perfectly distinct reply after the customer already had it, and the worker was told to
// log it as a note. Two fixes, both pinned here: the column now compares exactly (the
// model and the migration), and a refusal on that index is recovered from instead of
// reported.
//
// The in-memory provider enforces neither unique indexes nor collations, so the refusal is
// staged: an interceptor throws exactly what SQL Server's would — a DbUpdateException over
// a SqlException 2601 naming the index — at the save it is told to.
public class ReplyMessageIdTests
{
    // --- The refusal the database would raise ---------------------------------------------

    // SqlException has no public constructor. Built the way SqlClient builds its own, by
    // reflection over the internal factory, so the code under test sees the real type and
    // reads the real Number and Message. Picked by shape rather than by exact signature, so
    // a SqlClient upgrade that adds a parameter does not quietly turn these tests off — it
    // either still works or fails here, loudly.
    internal static SqlException SqlError(int number, string message)
    {
        var errorCtor = typeof(SqlError)
            .GetConstructors(BindingFlags.NonPublic | BindingFlags.Instance)
            .Where(c =>
            {
                var p = c.GetParameters();
                return p.Length >= 7 && p[0].ParameterType == typeof(int) && p[4].ParameterType == typeof(string);
            })
            .OrderBy(c => c.GetParameters().Length)
            .First();
        var args = errorCtor.GetParameters().Select((p, i) => i switch
        {
            0 => (object?)number,
            1 => (byte)1,
            2 => (byte)14,
            3 => "test-server",
            4 => message,
            5 => "",
            6 => 1,
            _ => p.HasDefaultValue ? p.DefaultValue : (p.ParameterType.IsValueType ? Activator.CreateInstance(p.ParameterType) : null),
        }).ToArray();
        var error = (SqlError)errorCtor.Invoke(args);

        var errors = (SqlErrorCollection)typeof(SqlErrorCollection)
            .GetConstructor(BindingFlags.NonPublic | BindingFlags.Instance, Type.EmptyTypes)!
            .Invoke(null);
        typeof(SqlErrorCollection)
            .GetMethod("Add", BindingFlags.NonPublic | BindingFlags.Instance)!
            .Invoke(errors, new object[] { error });

        var create = typeof(SqlException)
            .GetMethods(BindingFlags.NonPublic | BindingFlags.Static)
            .Where(m => m.Name == "CreateException")
            .Select(m => (Method: m, Params: m.GetParameters()))
            .Where(x => x.Params.Length == 2
                        && x.Params[0].ParameterType == typeof(SqlErrorCollection)
                        && x.Params[1].ParameterType == typeof(string))
            .Single().Method;
        return (SqlException)create.Invoke(null, new object[] { errors, "16.0" })!;
    }

    private static DbUpdateException DuplicateMessageId(string id) =>
        new("An error occurred while saving the entity changes. See the inner exception for details.",
            SqlError(2601,
                "Cannot insert duplicate key row in object 'dbo.LeadActivities' with unique index " +
                $"'IX_LeadActivities_ExternalMessageId'. The duplicate key value is ({id})."));

    // Throws at the saves it is told to: before the write (the database refused it) or
    // after it (the write landed and the answer was lost — what EF's retry strategy re-runs).
    private sealed class FailingSaves : SaveChangesInterceptor
    {
        private int _saves;
        public Dictionary<int, Func<Exception>> Before { get; } = new();
        public Dictionary<int, Func<Exception>> After { get; } = new();

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
        {
            _saves++;
            if (Before.TryGetValue(_saves, out var fail)) throw fail();
            return ValueTask.FromResult(result);
        }

        public override ValueTask<int> SavedChangesAsync(
            SaveChangesCompletedEventData eventData, int result, CancellationToken ct = default)
        {
            if (After.TryGetValue(_saves, out var fail)) throw fail();
            return ValueTask.FromResult(result);
        }
    }

    private sealed class HandlerFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;
        public HandlerFactory(HttpMessageHandler handler) => _handler = handler;
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }

    private static AppDbContext NewDb(FailingSaves saves, string name) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .AddInterceptors(saves)
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

    // Two ids as Graph mints them for neighbouring drafts: the same but for the case of one
    // counter digit ('Z' is 25, 'z' is 51).
    private const string OurId = "AAMkAGI2TG93AAA=AAAYbvZaAAA=";
    private const string TwinId = "AAMkAGI2TG93AAA=AAAYbvzaAAA=";

    private const string Token = """{ "access_token": "tok", "expires_in": 3600 }""";

    private static GraphStubHandler GraphThatSends(string draftId)
    {
        var graph = new GraphStubHandler();
        graph.Enqueue(HttpStatusCode.OK, Token);
        graph.Enqueue(HttpStatusCode.Created, $$"""{ "id": "{{draftId}}", "conversationId": "conv-1" }""");
        graph.Enqueue(HttpStatusCode.Accepted, "");
        return graph;
    }

    // A lead with an earlier reply on it, under the case-twin of the id the next draft gets.
    // Two saves, so the reply's own recording is save 3.
    private static async Task<(int LeadId, int TwinActivityId)> SeedAsync(AppDbContext db)
    {
        var lead = new Lead { Name = "Ivan Petrov", Email = "ivan@example.com", Status = LeadStatuses.Contacted };
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        var earlier = new LeadActivity
        {
            LeadId = lead.Id,
            Type = LeadActivityTypes.EmailOut,
            Body = "<p>The first answer.</p>",
            ExternalMessageId = TwinId,
            ConversationId = "conv-1",
            OccurredAt = DateTimeOffset.UtcNow.AddDays(-2),
        };
        db.LeadActivities.Add(earlier);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return (lead.Id, earlier.Id);
    }

    // --- Recognising the refusal ----------------------------------------------------------

    [Fact]
    public void A_duplicate_key_on_the_message_id_index_is_recognised_through_the_wrappers()
    {
        Assert.True(LeadMailService.IsDuplicateMessageId(DuplicateMessageId(OurId)));

        // And through a further wrapper, as the retry strategy can add one.
        Assert.True(LeadMailService.IsDuplicateMessageId(
            new InvalidOperationException("retry gave up", DuplicateMessageId(OurId))));

        // 2627 is the same refusal from a unique constraint rather than an index.
        Assert.True(LeadMailService.IsDuplicateMessageIdError(2627,
            "Violation of UNIQUE KEY constraint 'IX_LeadActivities_ExternalMessageId'."));
    }

    [Fact]
    public void Other_database_refusals_are_not_mistaken_for_it()
    {
        // The other unique index on this path: a collision there is a different story.
        Assert.False(LeadMailService.IsDuplicateMessageId(new DbUpdateException("x",
            SqlError(2601, "Cannot insert duplicate key row in object 'dbo.LeadAttachments' with unique index 'IX_LeadAttachments_BlobKey'."))));

        // The right index named, the wrong error: a truncation is not a duplicate.
        Assert.False(LeadMailService.IsDuplicateMessageIdError(2628,
            "String or binary data would be truncated ... IX_LeadActivities_ExternalMessageId"));

        Assert.False(LeadMailService.IsDuplicateMessageId(new DbUpdateException("x", new TimeoutException())));
        Assert.False(LeadMailService.IsDuplicateMessageId(null));
    }

    // --- Recovering from it -----------------------------------------------------------------

    [Fact]
    public async Task A_reply_whose_id_is_refused_is_recorded_without_it_and_reported_sent()
    {
        var saves = new FailingSaves();
        var name = $"reply-dup-{Guid.NewGuid()}";
        using var db = NewDb(saves, name);
        var (leadId, twinActivityId) = await SeedAsync(db);
        saves.Before[3] = () => DuplicateMessageId(OurId);

        var result = await Service(db, GraphThatSends(OurId)).SendReplyAsync(
            leadId, "Re: оферта", "<p>The second answer.</p>", "maria@nvc.eu",
            cc: new[] { "boss@nvc.eu" });

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        Assert.NotNull(result.ActivityId);
        Assert.NotEqual(twinActivityId, result.ActivityId);

        using var check = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options);
        var thread = await check.LeadActivities.Where(a => a.LeadId == leadId).OrderBy(a => a.Id).ToListAsync();
        Assert.Equal(2, thread.Count);

        // The earlier reply untouched; the new one in full, minus only the id.
        Assert.Equal(TwinId, thread[0].ExternalMessageId);
        var recorded = thread[1];
        Assert.Equal(result.ActivityId, recorded.Id);
        Assert.Null(recorded.ExternalMessageId);
        Assert.Equal(LeadActivityTypes.EmailOut, recorded.Type);
        Assert.Equal("<p>The second answer.</p>", recorded.Body);
        Assert.Equal("Re: оферта", recorded.Subject);
        Assert.Equal("maria@nvc.eu", recorded.ActorUpn);
        Assert.Equal("boss@nvc.eu", recorded.CcRecipients);
        Assert.Equal("conv-1", recorded.ConversationId);

        // And the lead moved as any recorded reply moves it.
        var lead = await check.Leads.SingleAsync(l => l.Id == leadId);
        Assert.NotNull(lead.LastActivityAt);
        Assert.NotNull(lead.NextContactAt);
    }

    [Fact]
    public async Task A_save_that_had_landed_before_the_refusal_is_not_written_twice()
    {
        // EF's retry strategy re-running a save whose commit went through: the row the index
        // found is this very reply. One email went out, so one entry, and it is "Sent".
        var saves = new FailingSaves();
        var name = $"reply-landed-{Guid.NewGuid()}";
        using var db = NewDb(saves, name);
        var (leadId, _) = await SeedAsync(db);
        saves.After[3] = () => DuplicateMessageId(OurId);

        var result = await Service(db, GraphThatSends(OurId)).SendReplyAsync(
            leadId, "Re: оферта", "<p>The second answer.</p>", "maria@nvc.eu");

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);

        using var check = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options);
        var ours = await check.LeadActivities.Where(a => a.ExternalMessageId == OurId).ToListAsync();
        Assert.Single(ours);
        Assert.Equal(result.ActivityId, ours[0].Id);
        Assert.Equal(2, await check.LeadActivities.CountAsync(a => a.LeadId == leadId));
    }

    [Fact]
    public async Task A_row_holding_the_exact_id_on_another_lead_is_not_taken_for_ours()
    {
        // Same id, but somebody else's thread (the poller filed the draft before the fix,
        // say). Not "already recorded": the reply still needs its own entry on its own lead.
        var saves = new FailingSaves();
        var name = $"reply-other-{Guid.NewGuid()}";
        using var db = NewDb(saves, name);
        var (leadId, _) = await SeedAsync(db);
        var other = new Lead { Name = "Someone Else", Email = "else@example.com", Status = LeadStatuses.New };
        db.Leads.Add(other);
        await db.SaveChangesAsync();                                   // save 3
        db.LeadActivities.Add(new LeadActivity
        {
            LeadId = other.Id, Type = LeadActivityTypes.EmailIn, Body = "x", ExternalMessageId = OurId,
        });
        await db.SaveChangesAsync();                                   // save 4
        db.ChangeTracker.Clear();
        saves.Before[5] = () => DuplicateMessageId(OurId);

        var result = await Service(db, GraphThatSends(OurId)).SendReplyAsync(
            leadId, "Re: оферта", "<p>The second answer.</p>", "maria@nvc.eu");

        Assert.Equal(LeadMailService.SendOutcome.Sent, result.Outcome);
        using var check = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options);
        var recorded = await check.LeadActivities.SingleAsync(a => a.Id == result.ActivityId);
        Assert.Equal(leadId, recorded.LeadId);
        Assert.Equal(LeadActivityTypes.EmailOut, recorded.Type);
        Assert.Null(recorded.ExternalMessageId);
    }

    [Fact]
    public async Task Any_other_recording_failure_is_still_sent_but_not_recorded()
    {
        var saves = new FailingSaves();
        var name = $"reply-other-error-{Guid.NewGuid()}";
        using var db = NewDb(saves, name);
        var (leadId, _) = await SeedAsync(db);
        saves.Before[3] = () => new DbUpdateException("x",
            SqlError(2628, "String or binary data would be truncated in table 'dbo.LeadActivities', column 'Subject'."));

        var result = await Service(db, GraphThatSends(OurId)).SendReplyAsync(
            leadId, "Re: оферта", "<p>The second answer.</p>", "maria@nvc.eu");

        Assert.Equal(LeadMailService.SendOutcome.SentNotRecorded, result.Outcome);
        Assert.Null(result.ActivityId);
        using var check = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options);
        Assert.Equal(1, await check.LeadActivities.CountAsync(a => a.LeadId == leadId));
    }

    [Fact]
    public async Task When_the_second_attempt_fails_too_the_answer_is_still_sent_but_not_recorded()
    {
        // Never "not sent": the customer has the email whatever the thread says.
        var saves = new FailingSaves();
        var name = $"reply-twice-{Guid.NewGuid()}";
        using var db = NewDb(saves, name);
        var (leadId, _) = await SeedAsync(db);
        saves.Before[3] = () => DuplicateMessageId(OurId);
        saves.Before[4] = () => new DbUpdateException("x", new TimeoutException());

        var result = await Service(db, GraphThatSends(OurId)).SendReplyAsync(
            leadId, "Re: оферта", "<p>The second answer.</p>", "maria@nvc.eu");

        Assert.Equal(LeadMailService.SendOutcome.SentNotRecorded, result.Outcome);
        using var check = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options);
        Assert.Equal(1, await check.LeadActivities.CountAsync(a => a.LeadId == leadId));
    }

    [Fact]
    public void The_second_attempt_keeps_everything_but_the_id_files_included()
    {
        // The files are what a worker would otherwise have to re-attach to a note by hand.
        // Built from the refused entry as data: blob storage is not there in tests, so a
        // reply's files cannot get this far through SendReplyAsync itself.
        var occurred = DateTimeOffset.UtcNow.AddMinutes(-1);
        var failed = new LeadActivity
        {
            Id = 77,
            LeadId = 5,
            Type = LeadActivityTypes.EmailOut,
            Subject = "Re: оферта",
            Body = "<p>Plan attached.</p>",
            ActorUpn = "maria@nvc.eu",
            ConversationId = "conv-1",
            ExternalMessageId = OurId,
            CcRecipients = "boss@nvc.eu",
            OccurredAt = occurred,
        };
        failed.Attachments.Add(new LeadAttachment
        {
            Id = 9, LeadActivityId = 77, FileName = "plan.pdf", BlobKey = "leads/5/abc.pdf",
            ContentType = "application/pdf", SizeBytes = 1234, UploadedByUpn = "maria@nvc.eu",
        });

        var again = LeadMailService.WithoutMessageId(failed);

        Assert.Null(again.ExternalMessageId);
        Assert.Equal(0, again.Id);
        Assert.Equal(5, again.LeadId);
        Assert.Equal(LeadActivityTypes.EmailOut, again.Type);
        Assert.Equal("Re: оферта", again.Subject);
        Assert.Equal("<p>Plan attached.</p>", again.Body);
        Assert.Equal("maria@nvc.eu", again.ActorUpn);
        Assert.Equal("conv-1", again.ConversationId);
        Assert.Equal("boss@nvc.eu", again.CcRecipients);
        Assert.Equal(occurred, again.OccurredAt);

        var file = Assert.Single(again.Attachments);
        Assert.NotSame(failed.Attachments[0], file);
        Assert.Equal(0, file.Id);
        Assert.Equal(0, file.LeadActivityId);
        Assert.Equal("plan.pdf", file.FileName);
        Assert.Equal("leads/5/abc.pdf", file.BlobKey);
        Assert.Equal("application/pdf", file.ContentType);
        Assert.Equal(1234, file.SizeBytes);
        Assert.Equal("maria@nvc.eu", file.UploadedByUpn);
    }

    // --- The column itself ----------------------------------------------------------------

    private static AppDbContext SqlServerModel() =>
        // Never opened: the model and the migration script are both built offline.
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=127.0.0.1,1;Database=NeverOpened;Connect Timeout=1")
            .Options);

    [Theory]
    [InlineData(nameof(LeadActivity.ExternalMessageId))]
    [InlineData(nameof(LeadActivity.ConversationId))]
    public void Graph_ids_are_compared_exactly_in_the_database(string property)
    {
        using var db = SqlServerModel();
        // The design-time model: the runtime one does not keep collations.
        var column = db.GetService<IDesignTimeModel>().Model
            .FindEntityType(typeof(LeadActivity))!.FindProperty(property)!;

        Assert.Equal("Latin1_General_100_BIN2", column.GetCollation());
        Assert.Equal(AppDbContext.GraphIdCollation, column.GetCollation());
    }

    [Fact]
    public void The_migration_rebuilds_both_indexes_around_the_collation_change()
    {
        // SQL Server refuses ALTER COLUMN ... COLLATE while an index uses the column, so the
        // script must drop each index first and put it back exactly as it was: the message
        // id's unique and filtered, the conversation's filtered only.
        using var db = SqlServerModel();
        var sql = db.GetService<IMigrator>().GenerateScript("20261011183913_AddHomeSlots", "MakeGraphIdsCaseSensitive");

        static int At(string sql, string text)
        {
            var i = sql.IndexOf(text, StringComparison.Ordinal);
            Assert.True(i >= 0, $"Missing from the script: {text}");
            return i;
        }

        var dropId = At(sql, "DROP INDEX [IX_LeadActivities_ExternalMessageId] ON [LeadActivities];");
        var alterId = At(sql, "ALTER TABLE [LeadActivities] ALTER COLUMN [ExternalMessageId] nvarchar(400) COLLATE Latin1_General_100_BIN2 NULL;");
        var createId = At(sql, "CREATE UNIQUE INDEX [IX_LeadActivities_ExternalMessageId] ON [LeadActivities] ([ExternalMessageId]) WHERE [ExternalMessageId] IS NOT NULL;");
        Assert.True(dropId < alterId && alterId < createId);

        var dropConv = At(sql, "DROP INDEX [IX_LeadActivities_ConversationId] ON [LeadActivities];");
        var alterConv = At(sql, "ALTER TABLE [LeadActivities] ALTER COLUMN [ConversationId] nvarchar(400) COLLATE Latin1_General_100_BIN2 NULL;");
        var createConv = At(sql, "CREATE INDEX [IX_LeadActivities_ConversationId] ON [LeadActivities] ([ConversationId]) WHERE [ConversationId] IS NOT NULL;");
        Assert.True(dropConv < alterConv && alterConv < createConv);
    }
}
