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

// The staff work queue that replaces the Quickbase workflow. What matters here is that
// the outstanding list is complete and correctly ordered, and that ticking one box never
// disturbs the other — sales works from this every day, so a wrong row is a missed call.
public class LeadAdminTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"leadadmin-{Guid.NewGuid()}")
            .Options);

    private static async Task<AppDbContext> Seeded()
    {
        var db = NewDb();
        db.Offers.AddRange(
            new Offer { Name = "Old offer", Email = "old@x.com", ReachedOut = false, CreatedAt = DateTimeOffset.UtcNow.AddDays(-21) },
            new Offer { Name = "New offer", Email = "new@x.com", ReachedOut = false, CreatedAt = DateTimeOffset.UtcNow.AddDays(-1) },
            new Offer { Name = "Handled offer", Email = "done@x.com", ReachedOut = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-5) });
        db.Questions.AddRange(
            new Question { Name = "Open question", Email = "q@x.com", ReachedOut = false, CreatedAt = DateTimeOffset.UtcNow.AddDays(-10) },
            new Question { Name = "Handled question", Email = "qd@x.com", ReachedOut = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-2) });
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task The_outstanding_queue_covers_offers_and_questions_together()
    {
        // "Who has not been called back?" is one question, not two.
        using var db = await Seeded();

        var open = await new LeadAdminService(db).ListAsync(reachedOut: false, CancellationToken.None);

        Assert.Equal(3, open.Count);
        Assert.Contains(open, l => l.Kind == "offer" && l.Name == "Old offer");
        Assert.Contains(open, l => l.Kind == "question" && l.Name == "Open question");
        Assert.DoesNotContain(open, l => l.ReachedOut);
    }

    [Fact]
    public async Task The_outstanding_queue_puts_the_oldest_lead_first()
    {
        // The lead going cold is the one that needs attention; newest-first would bury it.
        using var db = await Seeded();

        var open = await new LeadAdminService(db).ListAsync(reachedOut: false, CancellationToken.None);

        Assert.Equal("Old offer", open.First().Name);
        Assert.Equal("New offer", open.Last().Name);
    }

    [Fact]
    public async Task The_handled_list_reads_newest_first_because_it_is_a_history()
    {
        using var db = await Seeded();

        var done = await new LeadAdminService(db).ListAsync(reachedOut: true, CancellationToken.None);

        Assert.Equal(2, done.Count);
        Assert.Equal("Handled question", done.First().Name);   // 2 days ago
        Assert.Equal("Handled offer", done.Last().Name);       // 5 days ago
    }

    [Fact]
    public async Task Counts_split_the_queue_the_way_the_tabs_do()
    {
        using var db = await Seeded();

        var counts = await new LeadAdminService(db).CountsAsync(CancellationToken.None);

        Assert.Equal(3, counts.NotReachedOut);
        Assert.Equal(2, counts.ReachedOut);
        Assert.Equal(3, counts.Offers);
        Assert.Equal(2, counts.Questions);
    }

    [Fact]
    public async Task Ticking_reached_out_leaves_lead_created_alone()
    {
        // Both flags are optional in the payload precisely so one tick cannot silently
        // undo a change someone else made a second earlier.
        using var db = NewDb();
        db.Offers.Add(new Offer { Id = 1, Name = "A", ReachedOut = false, LeadCreated = true });
        await db.SaveChangesAsync();

        var ok = await new LeadAdminService(db).SetFlagsAsync("offer", 1, reachedOut: true, leadCreated: null, CancellationToken.None);

        Assert.True(ok);
        var saved = db.Offers.Single();
        Assert.True(saved.ReachedOut);
        Assert.True(saved.LeadCreated);   // untouched
        Assert.NotNull(saved.UpdatedAt);
    }

    [Fact]
    public async Task A_question_is_addressed_by_kind_because_the_ids_overlap()
    {
        // Offer 1 and Question 1 both exist; the kind is what tells them apart.
        using var db = NewDb();
        db.Offers.Add(new Offer { Id = 1, Name = "The offer", ReachedOut = false });
        db.Questions.Add(new Question { Id = 1, Name = "The question", ReachedOut = false });
        await db.SaveChangesAsync();

        await new LeadAdminService(db).SetFlagsAsync("question", 1, reachedOut: true, leadCreated: null, CancellationToken.None);

        Assert.False(db.Offers.Single().ReachedOut);    // the offer was not touched
        Assert.True(db.Questions.Single().ReachedOut);
    }

    [Fact]
    public async Task An_unknown_lead_reports_failure_rather_than_silent_success()
    {
        using var db = NewDb();
        var svc = new LeadAdminService(db);

        Assert.False(await svc.SetFlagsAsync("offer", 999, true, null, CancellationToken.None));
        Assert.False(await svc.SetFlagsAsync("wombat", 1, true, null, CancellationToken.None));
    }

    [Fact]
    public async Task A_question_is_projected_without_inventing_fields_it_does_not_have()
    {
        // Questions collect no phone number and no model; the shared DTO must not imply
        // otherwise.
        using var db = NewDb();
        db.Questions.Add(new Question { Name = "Maria", Email = "m@x.com", Message = "Hi", ReachedOut = false });
        await db.SaveChangesAsync();

        var lead = (await new LeadAdminService(db).ListAsync(false, CancellationToken.None)).Single();

        Assert.Equal("question", lead.Kind);
        Assert.Equal("", lead.Phone);
        Assert.Equal("", lead.ModelId);
        Assert.Equal("Hi", lead.Message);
    }

    [Fact]
    public async Task Listing_everything_returns_both_states()
    {
        using var db = await Seeded();

        var all = await new LeadAdminService(db).ListAsync(reachedOut: null, CancellationToken.None);

        Assert.Equal(5, all.Count);
    }
}
