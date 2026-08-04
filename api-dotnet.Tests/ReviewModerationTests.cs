using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Moderation is the workflow the admin panel takes over from Quickbase, so these pin the
// behaviour the UI depends on: what the queue shows, what approving publishes, and that
// acting on a missing review reports failure rather than silently succeeding.
public class ReviewModerationTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            // Unique name per test so cases can't leak state into one another.
            .UseInMemoryDatabase($"moderation-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }

    private static EnvConfig Env() =>
        new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build());

    private static async Task<AppDbContext> SeededDb()
    {
        var db = NewDb();
        db.Reviews.AddRange(
            new Review { Name = "Approved One", Status = "approved", Rating = 5, CreatedAt = DateTimeOffset.UtcNow.AddDays(-3) },
            new Review { Name = "Pending One", Status = "pending", Rating = 4, CreatedAt = DateTimeOffset.UtcNow.AddDays(-2) },
            new Review { Name = "Pending Two", Status = "pending", Rating = 3, CreatedAt = DateTimeOffset.UtcNow.AddDays(-1) });
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task Queue_defaults_to_pending_only()
    {
        using var db = await SeededDb();
        var svc = new ReviewModerationService(db, Env());

        var pending = await svc.ListAsync("pending", CancellationToken.None);

        Assert.Equal(2, pending.Count);
        Assert.All(pending, r => Assert.Equal("pending", r.Status));
    }

    [Fact]
    public async Task All_returns_every_status()
    {
        using var db = await SeededDb();
        var svc = new ReviewModerationService(db, Env());

        Assert.Equal(3, (await svc.ListAsync("all", CancellationToken.None)).Count);
    }

    [Fact]
    public async Task Queue_is_newest_first()
    {
        using var db = await SeededDb();
        var svc = new ReviewModerationService(db, Env());

        var pending = await svc.ListAsync("pending", CancellationToken.None);

        Assert.Equal("Pending Two", pending[0].Name);
    }

    [Fact]
    public async Task Approving_publishes_the_review_and_stamps_updated_at()
    {
        using var db = await SeededDb();
        var svc = new ReviewModerationService(db, Env());
        var target = db.Reviews.First(r => r.Name == "Pending One").Id;

        Assert.True(await svc.ApproveAsync(target, CancellationToken.None));

        var updated = await db.Reviews.FindAsync(target);
        Assert.Equal("approved", updated!.Status);
        Assert.NotNull(updated.UpdatedAt);
    }

    [Fact]
    public async Task Rejecting_keeps_the_row_but_out_of_the_public_feed()
    {
        using var db = await SeededDb();
        var svc = new ReviewModerationService(db, Env());
        var target = db.Reviews.First(r => r.Name == "Pending One").Id;

        Assert.True(await svc.RejectAsync(target, CancellationToken.None));

        var updated = await db.Reviews.FindAsync(target);
        // Rejected, not deleted — an accidental rejection has to be reversible.
        Assert.Equal("rejected", updated!.Status);
        Assert.Equal(3, await db.Reviews.CountAsync());
    }

    [Fact]
    public async Task A_decision_can_be_undone()
    {
        using var db = await SeededDb();
        var svc = new ReviewModerationService(db, Env());
        var target = db.Reviews.First(r => r.Name == "Approved One").Id;

        Assert.True(await svc.ResetToPendingAsync(target, CancellationToken.None));

        Assert.Equal("pending", (await db.Reviews.FindAsync(target))!.Status);
    }

    [Theory]
    [InlineData("approve")]
    [InlineData("reject")]
    [InlineData("pending")]
    public async Task Acting_on_a_missing_review_reports_failure(string action)
    {
        using var db = await SeededDb();
        var svc = new ReviewModerationService(db, Env());

        var result = action switch
        {
            "approve" => await svc.ApproveAsync(9999, CancellationToken.None),
            "reject" => await svc.RejectAsync(9999, CancellationToken.None),
            _ => await svc.ResetToPendingAsync(9999, CancellationToken.None),
        };

        // False so the controller can answer 404 rather than reporting success for an id
        // that never existed.
        Assert.False(result);
    }

    [Fact]
    public async Task Counts_are_grouped_by_status()
    {
        using var db = await SeededDb();
        var svc = new ReviewModerationService(db, Env());

        var counts = await svc.CountsByStatusAsync(CancellationToken.None);

        Assert.Equal(1, counts["approved"]);
        Assert.Equal(2, counts["pending"]);
    }

    [Fact]
    public async Task Admin_listing_exposes_the_email_the_public_feed_hides()
    {
        using var db = NewDb();
        db.Reviews.Add(new Review { Name = "X", Status = "pending", Email = "who@example.com", Rating = 5 });
        await db.SaveChangesAsync();
        var svc = new ReviewModerationService(db, Env());

        var items = await svc.ListAsync("pending", CancellationToken.None);

        // Moderators need to see who submitted a review before publishing it.
        Assert.Equal("who@example.com", items[0].Email);
    }
}
