using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Reading the audit log.
//
// The entries are written by an interceptor and tested in AuditLogTests; what is pinned here
// is the half a person actually meets — the ordering, the filters, and the paging. A log
// whose paging can repeat or skip a row is worse than no log, because it looks complete.
public class AuditReadTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"auditread-{Guid.NewGuid()}")
            .Options);

    // Written directly rather than through the interceptor: these are tests of the read
    // side, and building state by hand keeps them from failing for a writer's reasons.
    private static AuditEntry Entry(
        string type = nameof(Customer), string id = "1", string action = AuditActions.Updated,
        string? actor = "maria@x.eu", int minutesAgo = 0, string? summary = null,
        string changes = "[]") => new()
        {
            EntityType = type,
            EntityId = id,
            Action = action,
            ActorUpn = actor,
            Summary = summary,
            ChangesJson = changes,
            OccurredAt = DateTimeOffset.UtcNow.AddMinutes(-minutesAgo),
        };

    private static async Task<AppDbContext> Seeded(params AuditEntry[] entries)
    {
        var db = NewDb();
        db.AuditEntries.AddRange(entries);
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task The_log_reads_newest_first()
    {
        // The opposite of the leads board's quietest-first, for the opposite reason: a board
        // surfaces what has been neglected, a log answers "what just happened".
        using var db = await Seeded(
            Entry(summary: "oldest", minutesAgo: 60),
            Entry(summary: "newest", minutesAgo: 1),
            Entry(summary: "middle", minutesAgo: 30));

        var page = await new AuditReadService(db).ListAsync(
            null, null, null, null, null, 0, 50, CancellationToken.None);

        Assert.Equal(new[] { "newest", "middle", "oldest" }, page.Entries.Select(e => e.Summary));
        Assert.Equal(3, page.Total);
        Assert.False(page.HasMore);
    }

    [Fact]
    public async Task Paging_never_repeats_or_skips_a_row_even_at_the_same_timestamp()
    {
        // Entries written in one save share a timestamp to the tick. Without the id
        // tiebreak the sort is unstable and page two can repeat a row from page one — a log
        // that quietly lies about what happened while looking complete.
        var sameMoment = DateTimeOffset.UtcNow;
        using var db = NewDb();
        for (var i = 0; i < 10; i++)
            db.AuditEntries.Add(new AuditEntry
            {
                EntityType = nameof(Customer), EntityId = i.ToString(),
                Action = AuditActions.Updated, Summary = $"row {i}",
                OccurredAt = sameMoment, ChangesJson = "[]",
            });
        await db.SaveChangesAsync();

        var svc = new AuditReadService(db);
        var first = await svc.ListAsync(null, null, null, null, null, 0, 4, CancellationToken.None);
        var second = await svc.ListAsync(null, null, null, null, null, 4, 4, CancellationToken.None);
        var third = await svc.ListAsync(null, null, null, null, null, 8, 4, CancellationToken.None);

        var seen = first.Entries.Concat(second.Entries).Concat(third.Entries).Select(e => e.Id).ToList();

        Assert.Equal(10, seen.Count);
        Assert.Equal(10, seen.Distinct().Count());
        Assert.True(first.HasMore);
        Assert.False(third.HasMore);
    }

    [Fact]
    public async Task A_page_size_cannot_be_talked_past_the_cap()
    {
        using var db = NewDb();
        for (var i = 0; i < AuditReadService.MaxPageSize + 40; i++)
            db.AuditEntries.Add(Entry(id: i.ToString()));
        await db.SaveChangesAsync();

        var page = await new AuditReadService(db).ListAsync(
            null, null, null, null, null, 0, 5000, CancellationToken.None);

        Assert.Equal(AuditReadService.MaxPageSize, page.Entries.Count);
        Assert.True(page.HasMore);
    }

    // --- Filters --------------------------------------------------------------------------

    [Fact]
    public async Task Filtering_by_actor_entity_and_action_each_narrow_the_log()
    {
        using var db = await Seeded(
            Entry(type: nameof(Customer), actor: "maria@x.eu", action: AuditActions.Updated),
            Entry(type: nameof(House), actor: "vladi@x.eu", action: AuditActions.Created),
            Entry(type: nameof(House), actor: "maria@x.eu", action: AuditActions.Deleted));

        var svc = new AuditReadService(db);
        var none = CancellationToken.None;

        Assert.Equal(2, (await svc.ListAsync(null, "maria@x.eu", null, null, null, 0, 50, none)).Total);
        Assert.Equal(2, (await svc.ListAsync(nameof(House), null, null, null, null, 0, 50, none)).Total);
        Assert.Equal(1, (await svc.ListAsync(null, null, AuditActions.Deleted, null, null, 0, 50, none)).Total);
        Assert.Equal(1, (await svc.ListAsync(nameof(House), "maria@x.eu", null, null, null, 0, 50, none)).Total);
    }

    [Fact]
    public async Task The_system_actor_can_be_filtered_for_by_name()
    {
        // The importers and the CLI write with a null actor. Without this, the one category
        // of change nobody performed is also the one nobody can look up.
        using var db = await Seeded(
            Entry(actor: null, summary: "imported"),
            Entry(actor: "maria@x.eu", summary: "edited by hand"));

        var page = await new AuditReadService(db).ListAsync(
            null, "system", null, null, null, 0, 50, CancellationToken.None);

        Assert.Single(page.Entries);
        Assert.Equal("imported", page.Entries[0].Summary);
        Assert.Null(page.Entries[0].ActorUpn);
    }

    [Fact]
    public async Task A_date_window_bounds_the_log_on_both_sides()
    {
        using var db = await Seeded(
            Entry(summary: "last week", minutesAgo: 60 * 24 * 7),
            Entry(summary: "yesterday", minutesAgo: 60 * 24),
            Entry(summary: "just now", minutesAgo: 1));

        var page = await new AuditReadService(db).ListAsync(
            null, null, null,
            since: DateTimeOffset.UtcNow.AddDays(-2),
            until: DateTimeOffset.UtcNow.AddMinutes(-10),
            0, 50, CancellationToken.None);

        Assert.Single(page.Entries);
        Assert.Equal("yesterday", page.Entries[0].Summary);
    }

    // --- One record's history ---------------------------------------------------------------

    [Fact]
    public async Task One_records_history_is_only_its_own()
    {
        using var db = await Seeded(
            Entry(type: nameof(Customer), id: "7", summary: "ours", minutesAgo: 5),
            Entry(type: nameof(Customer), id: "7", summary: "also ours", minutesAgo: 1),
            Entry(type: nameof(Customer), id: "8", summary: "someone else"),
            // Same id, different table — the pair is what identifies a record.
            Entry(type: nameof(House), id: "7", summary: "a house"));

        var history = await new AuditReadService(db)
            .ForRecordAsync(nameof(Customer), "7", CancellationToken.None);

        Assert.Equal(new[] { "also ours", "ours" }, history.Select(h => h.Summary));
    }

    [Fact]
    public async Task A_record_with_no_history_is_an_empty_list_not_an_error()
    {
        using var db = await Seeded(Entry(id: "1"));

        var history = await new AuditReadService(db)
            .ForRecordAsync(nameof(Customer), "999", CancellationToken.None);

        Assert.Empty(history);
    }

    // --- Shape of what is served ------------------------------------------------------------

    [Fact]
    public async Task Changes_arrive_parsed_rather_than_as_a_string_to_parse_again()
    {
        using var db = await Seeded(Entry(
            changes: """[{"Field":"Phone","From":"0888111222","To":"0888999000"}]"""));

        var page = await new AuditReadService(db).ListAsync(
            null, null, null, null, null, 0, 50, CancellationToken.None);

        var change = Assert.Single(page.Entries[0].Changes);
        Assert.Equal("Phone", change.Field);
        Assert.Equal("0888111222", change.From);
        Assert.Equal("0888999000", change.To);
    }

    [Fact]
    public async Task A_malformed_entry_does_not_take_the_whole_view_down()
    {
        // One unreadable row must not make the history unavailable at the moment it is
        // being consulted. The entry is still evidence that something happened.
        using var db = await Seeded(
            Entry(summary: "broken", changes: "{ this is not json"),
            Entry(summary: "fine", changes: """[{"Field":"Name","From":"a","To":"b"}]"""));

        var page = await new AuditReadService(db).ListAsync(
            null, null, null, null, null, 0, 50, CancellationToken.None);

        Assert.Equal(2, page.Entries.Count);
        Assert.Empty(page.Entries.Single(e => e.Summary == "broken").Changes);
        Assert.Single(page.Entries.Single(e => e.Summary == "fine").Changes);
    }

    [Fact]
    public async Task The_filter_lists_come_from_the_log_itself()
    {
        // "Who has actually changed something" — which includes people who have since left
        // and excludes people who have never touched a record.
        using var db = await Seeded(
            Entry(type: nameof(Customer), actor: "maria@x.eu"),
            Entry(type: nameof(House), actor: "gone@x.eu"),
            Entry(type: nameof(House), actor: null));

        var filters = await new AuditReadService(db).FiltersAsync(CancellationToken.None);
        var json = System.Text.Json.JsonSerializer.Serialize(filters);

        Assert.Contains("maria@x.eu", json);
        Assert.Contains("gone@x.eu", json);
        Assert.Contains(nameof(Customer), json);
        Assert.Contains(nameof(House), json);
        Assert.Contains("\"hasSystem\":true", json);
    }
}
