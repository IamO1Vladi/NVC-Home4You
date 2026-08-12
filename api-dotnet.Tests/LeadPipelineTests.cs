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

// The pipeline board and the lead detail view.
//
// Sales works from the board every day, so the ordering is the feature: the lead nobody
// has touched has to be the one at the top. The detail view's job is different — it must
// show the WHOLE thread, in a stable order, with the two sides of the conversation
// distinguishable, because it is about to become a chat window.
public class LeadPipelineTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"pipeline-{Guid.NewGuid()}")
            .Options);

    private static Lead NewLead(string name, string status, DateTimeOffset? lastActivity = null, string? owner = null) =>
        new()
        {
            Name = name,
            Status = status,
            OwnerUpn = owner,
            LastActivityAt = lastActivity,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
        };

    // --- The board --------------------------------------------------------------------

    [Fact]
    public async Task The_board_puts_the_quietest_lead_first()
    {
        // The lead going cold is the one that needs attention; newest-first buries it.
        using var db = NewDb();
        db.Leads.AddRange(
            NewLead("Spoke yesterday", LeadStatuses.Contacted, DateTimeOffset.UtcNow.AddDays(-1)),
            NewLead("Silent for a month", LeadStatuses.Quoted, DateTimeOffset.UtcNow.AddDays(-30)),
            NewLead("Spoke last week", LeadStatuses.Contacted, DateTimeOffset.UtcNow.AddDays(-7)));
        await db.SaveChangesAsync();

        var board = await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None);

        Assert.Equal("Silent for a month", board.First().Name);
        Assert.Equal("Spoke yesterday", board.Last().Name);
    }

    [Fact]
    public async Task A_lead_nothing_has_happened_to_sorts_above_everything()
    {
        // Null LastActivityAt means nobody has done anything at all — the most urgent
        // state there is, and the easiest one for a naive sort to drop to the bottom.
        using var db = NewDb();
        db.Leads.AddRange(
            NewLead("Touched", LeadStatuses.Contacted, DateTimeOffset.UtcNow.AddDays(-20)),
            NewLead("Never touched", LeadStatuses.New, lastActivity: null));
        await db.SaveChangesAsync();

        var board = await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None);

        Assert.Equal("Never touched", board.First().Name);
    }

    [Fact]
    public async Task Open_lists_every_stage_still_in_play_and_no_closed_ones()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            NewLead("A", LeadStatuses.New),
            NewLead("B", LeadStatuses.Negotiating),
            NewLead("C", LeadStatuses.Won),
            NewLead("D", LeadStatuses.Lost));
        await db.SaveChangesAsync();

        var open = await new LeadPipelineService(db).ListAsync("open", null, CancellationToken.None);

        Assert.Equal(2, open.Count);
        Assert.DoesNotContain(open, l => l.Status == LeadStatuses.Won || l.Status == LeadStatuses.Lost);
    }

    [Fact]
    public async Task An_unrecognised_status_filter_returns_nothing_rather_than_everything()
    {
        // Falling through to "no filter" would look like the filter worked and quietly
        // show closed leads in a view that promised open ones.
        using var db = NewDb();
        db.Leads.Add(NewLead("A", LeadStatuses.New));
        await db.SaveChangesAsync();

        var rows = await new LeadPipelineService(db).ListAsync("nearly_won", null, CancellationToken.None);

        Assert.Empty(rows);
    }

    [Fact]
    public async Task The_board_can_be_narrowed_to_one_persons_leads()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            NewLead("Mine", LeadStatuses.New, owner: "ivan@nvc-home4you.eu"),
            NewLead("Theirs", LeadStatuses.New, owner: "maria@nvc-home4you.eu"),
            NewLead("Nobody's", LeadStatuses.New, owner: null));
        await db.SaveChangesAsync();

        var mine = await new LeadPipelineService(db).ListAsync(null, "ivan@nvc-home4you.eu", CancellationToken.None);

        Assert.Equal("Mine", Assert.Single(mine).Name);
    }

    [Fact]
    public async Task The_board_counts_the_thread_without_loading_it()
    {
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Contacted);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();
        for (var i = 0; i < 3; i++)
            db.LeadActivities.Add(new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.Note, Body = $"n{i}" });
        await db.SaveChangesAsync();

        var row = Assert.Single(await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None));

        Assert.Equal(3, row.ActivityCount);
    }

    // --- The detail view --------------------------------------------------------------

    [Fact]
    public async Task The_detail_view_shows_the_whole_thread_not_a_window()
    {
        // The drafting context trims to fit a prompt; a person reading the history needs
        // all of it, however long the negotiation ran.
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Negotiating);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();
        for (var i = 0; i < 60; i++)
        {
            db.LeadActivities.Add(new LeadActivity
            {
                LeadId = lead.Id, Type = LeadActivityTypes.Note, Body = $"entry {i}",
                OccurredAt = DateTimeOffset.UtcNow.AddDays(-60 + i),
            });
        }
        await db.SaveChangesAsync();

        var detail = await new LeadPipelineService(db).GetAsync(lead.Id, CancellationToken.None);

        Assert.Equal(60, detail!.Activities.Count);
    }

    [Fact]
    public async Task The_thread_reads_oldest_first_and_stays_stable_within_a_second()
    {
        // Two entries logged in the same second must not swap places between page loads.
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Contacted);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        var sameMoment = DateTimeOffset.UtcNow.AddHours(-1);
        db.LeadActivities.AddRange(
            new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.Note, Body = "first", OccurredAt = sameMoment },
            new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.Note, Body = "second", OccurredAt = sameMoment });
        await db.SaveChangesAsync();

        var a = await new LeadPipelineService(db).GetAsync(lead.Id, CancellationToken.None);
        var b = await new LeadPipelineService(db).GetAsync(lead.Id, CancellationToken.None);

        Assert.Equal(new[] { "first", "second" }, a!.Activities.Select(x => x.Body));
        Assert.Equal(a.Activities.Select(x => x.Id), b!.Activities.Select(x => x.Id));
    }

    [Fact]
    public async Task Each_entry_says_which_side_of_the_conversation_it_came_from()
    {
        // The whole chat layout hangs off this, so it is derived once here rather than
        // re-inferred from an empty string in every view.
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Contacted);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();
        db.LeadActivities.AddRange(
            new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.EmailIn, Body = "Hi", ActorUpn = null, OccurredAt = DateTimeOffset.UtcNow.AddDays(-2) },
            new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.EmailOut, Body = "Hello", ActorUpn = "s@x.eu", OccurredAt = DateTimeOffset.UtcNow.AddDays(-1) });
        await db.SaveChangesAsync();

        var detail = await new LeadPipelineService(db).GetAsync(lead.Id, CancellationToken.None);

        Assert.True(detail!.Activities[0].FromCustomer);
        Assert.False(detail.Activities[1].FromCustomer);
    }

    [Fact]
    public async Task Attachments_are_served_through_an_authenticated_route_not_a_blob_url()
    {
        // /api/img is unauthenticated. A customer's survey or contract must not be
        // reachable by anyone who guesses a path, so the DTO never carries a blob key.
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Contacted);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();
        var activity = new LeadActivity { LeadId = lead.Id, Type = LeadActivityTypes.EmailIn, Body = "See attached" };
        db.LeadActivities.Add(activity);
        await db.SaveChangesAsync();
        db.LeadAttachments.Add(new LeadAttachment
        {
            LeadActivityId = activity.Id,
            FileName = "survey.pdf",
            BlobKey = "leads/1/abc.pdf",
            ContentType = "application/pdf",
            SizeBytes = 12345,
        });
        await db.SaveChangesAsync();

        var detail = await new LeadPipelineService(db).GetAsync(lead.Id, CancellationToken.None);

        var file = Assert.Single(detail!.Activities.Single().Attachments);
        Assert.Equal("survey.pdf", file.FileName);
        Assert.StartsWith("/api/admin/pipeline/attachments/", file.DownloadUrl);
        Assert.DoesNotContain("leads/1/abc.pdf", file.DownloadUrl);
    }

    [Fact]
    public async Task A_missing_lead_is_reported_rather_than_returned_empty()
    {
        using var db = NewDb();

        Assert.Null(await new LeadPipelineService(db).GetAsync(999, CancellationToken.None));
    }

    // --- Owner and field edits ---------------------------------------------------------

    [Fact]
    public async Task A_handover_is_recorded_in_the_thread()
    {
        // "Who was supposed to be handling this?" gets asked about leads that went cold,
        // and the Owner column only ever holds the current answer.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan", OwnerUpn = "ivan@x.eu" });

        await svc.SetOwnerAsync(lead.Id, "maria@x.eu", "boss@x.eu");

        var entry = await db.LeadActivities.SingleAsync();
        Assert.Contains("ivan@x.eu", entry.Body);
        Assert.Contains("maria@x.eu", entry.Body);
    }

    [Fact]
    public async Task A_lead_can_be_returned_to_the_unassigned_pool()
    {
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan", OwnerUpn = "ivan@x.eu" });

        await svc.SetOwnerAsync(lead.Id, null, "boss@x.eu");

        Assert.Null((await db.Leads.SingleAsync()).OwnerUpn);
        Assert.Contains("unassigned", (await db.LeadActivities.SingleAsync()).Body);
    }

    [Fact]
    public async Task Reassigning_to_the_same_person_is_not_an_event()
    {
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan", OwnerUpn = "ivan@x.eu" });

        Assert.True(await svc.SetOwnerAsync(lead.Id, "ivan@x.eu", "boss@x.eu"));
        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }

    [Fact]
    public async Task Editing_one_field_leaves_the_others_alone()
    {
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead
        {
            Name = "Ivan", NextStep = "Call Monday", Notes = "Prefers evenings", Country = "Bulgaria",
        });

        await svc.UpdateFieldsAsync(lead.Id, nextStep: "Send quote", notes: null, projectName: null, buildLocation: null, country: null);

        var saved = await db.Leads.SingleAsync();
        Assert.Equal("Send quote", saved.NextStep);
        Assert.Equal("Prefers evenings", saved.Notes);   // untouched
        Assert.Equal("Bulgaria", saved.Country);         // untouched
    }

    [Fact]
    public async Task Clearing_a_field_stores_null_rather_than_an_empty_string()
    {
        // A cleared field and a never-filled one must not look different in a query.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan", NextStep = "Call Monday" });

        await svc.UpdateFieldsAsync(lead.Id, nextStep: "   ", notes: null, projectName: null, buildLocation: null, country: null);

        Assert.Null((await db.Leads.SingleAsync()).NextStep);
    }

    [Fact]
    public async Task Field_edits_stay_out_of_the_thread()
    {
        // Working notes get corrected constantly; an activity per save would drown the
        // actual conversation.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        await svc.UpdateFieldsAsync(lead.Id, "a", "b", "c", "d", "e");

        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }
}
