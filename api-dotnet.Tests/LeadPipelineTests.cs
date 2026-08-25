using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using apidotnet.Data.Migrations;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
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

    // --- Who a lead can be assigned to ------------------------------------------------

    [Fact]
    public async Task Assignable_users_merge_the_allow_list_with_the_owners_already_on_leads()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            NewLead("A", LeadStatuses.New, owner: "maria@x.eu"),
            // Someone no longer on the allow-list who still owns history. A dropdown that
            // cannot express the current owner would silently reassign it on the next save.
            NewLead("B", LeadStatuses.Quoted, owner: "left-the-company@x.eu"),
            NewLead("C", LeadStatuses.New, owner: null));
        await db.SaveChangesAsync();

        var users = await new LeadPipelineService(db).ListAssignableAsync(
            new[] { "vladi@x.eu", "maria@x.eu" }, "me@x.eu", CancellationToken.None);

        Assert.Equal(new[] { "left-the-company@x.eu", "maria@x.eu", "me@x.eu", "vladi@x.eu" }, users);
    }

    [Fact]
    public async Task Assignable_users_deduplicate_case_insensitively_and_skip_blanks()
    {
        // UPNs are emails, and "Maria@X.eu" and "maria@x.eu" are the same person — two
        // entries would make the dropdown ask which of her to pick.
        using var db = NewDb();
        db.Leads.Add(NewLead("A", LeadStatuses.New, owner: "Maria@X.eu"));
        await db.SaveChangesAsync();

        var users = await new LeadPipelineService(db).ListAssignableAsync(
            new[] { "maria@x.eu", "", "  " }, null, CancellationToken.None);

        Assert.Single(users);
    }

    [Fact]
    public async Task The_caller_can_always_assign_to_themselves()
    {
        // A fresh installation with no allow-list and no owned leads yet: the first user
        // must still appear in their own dropdown.
        using var db = NewDb();

        var users = await new LeadPipelineService(db).ListAssignableAsync(
            System.Array.Empty<string>(), "first@x.eu", CancellationToken.None);

        Assert.Equal(new[] { "first@x.eu" }, users);
    }

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

    // --- The archive rule, from the board's side ---------------------------------------
    //
    // Nothing pinned this until 2026-08-25, when the Mine tab was reported as showing an
    // already-archived lead. It does not, and these say so. Mine is the one tab that sends
    // no status at all, so it rests entirely on ClosedAt rather than on a stage filter —
    // exactly the path nothing was covering.
    //
    // Dated relative to ArchiveAfter rather than to a literal three days, so changing the
    // window moves these with it instead of breaking them.

    [Fact]
    public async Task A_lead_closed_beyond_the_window_is_off_the_mine_tab_too()
    {
        using var db = NewDb();
        var gone = NewLead("Won and finished", LeadStatuses.Won, owner: "ivan@nvc-home4you.eu");
        gone.ClosedAt = DateTimeOffset.UtcNow - LeadPipelineService.ArchiveAfter - TimeSpan.FromDays(1);
        db.Leads.AddRange(gone, NewLead("Still open", LeadStatuses.Quoted, owner: "ivan@nvc-home4you.eu"));
        await db.SaveChangesAsync();

        // owner=mine with no status — what the Mine tab actually sends.
        var mine = await new LeadPipelineService(db).ListAsync(null, "ivan@nvc-home4you.eu", CancellationToken.None);

        Assert.Equal("Still open", Assert.Single(mine).Name);
    }

    [Fact]
    public async Task A_lead_closed_inside_the_window_stays_on_the_board_on_purpose()
    {
        // The grace period is the feature, not an oversight: a deal just won still has
        // paperwork, a deposit and a last email attached to it. A Won lead sitting on the
        // board for a couple of days is this rule working, and it is the likeliest thing
        // anyone means when they report seeing a finished lead there.
        using var db = NewDb();
        var justWon = NewLead("Won this morning", LeadStatuses.Won, owner: "ivan@nvc-home4you.eu");
        justWon.ClosedAt = DateTimeOffset.UtcNow - LeadPipelineService.ArchiveAfter + TimeSpan.FromHours(1);
        db.Leads.Add(justWon);
        await db.SaveChangesAsync();

        var mine = await new LeadPipelineService(db).ListAsync(null, "ivan@nvc-home4you.eu", CancellationToken.None);

        Assert.Equal("Won this morning", Assert.Single(mine).Name);
    }

    [Fact]
    public async Task The_archive_tab_holds_exactly_what_the_board_dropped()
    {
        // The board and the archive are two separate predicates rather than one negated,
        // so nothing but a test stops them drifting into a gap that loses a lead from both
        // views at once — the failure that shows up as "where did that deal go?".
        using var db = NewDb();
        var gone = NewLead("Won and finished", LeadStatuses.Won);
        gone.ClosedAt = DateTimeOffset.UtcNow - LeadPipelineService.ArchiveAfter - TimeSpan.FromDays(1);
        var justWon = NewLead("Won this morning", LeadStatuses.Won);
        justWon.ClosedAt = DateTimeOffset.UtcNow - LeadPipelineService.ArchiveAfter + TimeSpan.FromHours(1);
        db.Leads.AddRange(gone, justWon, NewLead("Still open", LeadStatuses.Quoted));
        await db.SaveChangesAsync();

        var svc = new LeadPipelineService(db);
        var archived = await svc.ListAsync("archived", null, CancellationToken.None);
        var board = await svc.ListAsync(null, null, CancellationToken.None);

        Assert.Equal("Won and finished", Assert.Single(archived).Name);
        Assert.Equal(
            new[] { "Still open", "Won this morning" },
            board.Select(l => l.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray());
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

    // --- Who spoke last ----------------------------------------------------------------
    //
    // The board's most useful column and the cheapest one to get subtly wrong. It is NOT an
    // unread flag: nothing tracks who has looked at what, so a reply somebody read on Monday
    // and never answered is still flagged on Thursday — which is the failure the column
    // exists to catch.

    private static LeadActivity Said(int leadId, string? actorUpn, DateTimeOffset when, string body) =>
        new()
        {
            LeadId = leadId,
            Type = actorUpn is null ? LeadActivityTypes.EmailIn : LeadActivityTypes.EmailOut,
            Body = body,
            ActorUpn = actorUpn,      // null == the customer, exactly as LeadActivity documents
            OccurredAt = when,
        };

    [Fact]
    public async Task A_lead_whose_last_word_was_the_customers_is_awaiting_a_reply()
    {
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Quoted);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        db.LeadActivities.AddRange(
            Said(lead.Id, "maria@nvc-home4you.eu", DateTimeOffset.UtcNow.AddDays(-4), "Here is the quote."),
            Said(lead.Id, null, DateTimeOffset.UtcNow.AddDays(-3), "Can you do it in oak?"));
        await db.SaveChangesAsync();

        var row = Assert.Single(await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None));

        Assert.True(row.AwaitingReply);
    }

    [Fact]
    public async Task Answering_clears_the_flag_without_anyone_marking_anything_read()
    {
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Quoted);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        db.LeadActivities.Add(Said(lead.Id, null, DateTimeOffset.UtcNow.AddDays(-3), "Can you do it in oak?"));
        await db.SaveChangesAsync();

        Assert.True(Assert.Single(await new LeadPipelineService(db)
            .ListAsync(null, null, CancellationToken.None)).AwaitingReply);

        db.LeadActivities.Add(Said(lead.Id, "maria@nvc-home4you.eu", DateTimeOffset.UtcNow, "Oak, yes — costed below."));
        await db.SaveChangesAsync();

        Assert.False(Assert.Single(await new LeadPipelineService(db)
            .ListAsync(null, null, CancellationToken.None)).AwaitingReply);
    }

    [Fact]
    public async Task An_old_unanswered_reply_is_still_flagged_however_long_it_has_sat()
    {
        // The whole reason this is not an unread flag. Read on Monday, unanswered on
        // Thursday, and the board has to keep saying so.
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Negotiating);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        db.LeadActivities.Add(Said(lead.Id, null, DateTimeOffset.UtcNow.AddDays(-45), "Well?"));
        await db.SaveChangesAsync();

        var row = Assert.Single(await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None));

        Assert.True(row.AwaitingReply);
    }

    [Fact]
    public async Task A_lead_nobody_has_said_anything_on_is_not_awaiting_a_reply()
    {
        // An empty thread is a lead nobody has started, which is a different problem and
        // one the quietest-first ordering already shows.
        using var db = NewDb();
        db.Leads.Add(NewLead("Ivan", LeadStatuses.New));
        await db.SaveChangesAsync();

        var row = Assert.Single(await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None));

        Assert.False(row.AwaitingReply);
    }

    [Fact]
    public async Task The_flag_follows_who_spoke_last_and_not_the_kind_of_entry()
    {
        // A status move is written by one of us, so it answers the customer's message as far
        // as this column is concerned — the definition is the actor, never the type string.
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Quoted);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        db.LeadActivities.AddRange(
            Said(lead.Id, null, DateTimeOffset.UtcNow.AddDays(-2), "We are thinking about it."),
            new LeadActivity
            {
                LeadId = lead.Id,
                Type = LeadActivityTypes.StatusChange,
                Body = "quoted → negotiating",
                ActorUpn = "maria@nvc-home4you.eu",
                OccurredAt = DateTimeOffset.UtcNow.AddDays(-1),
            });
        await db.SaveChangesAsync();

        var row = Assert.Single(await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None));

        Assert.False(row.AwaitingReply);
    }

    [Fact]
    public async Task Two_entries_in_the_same_second_are_broken_by_the_later_insert()
    {
        // A customer's message and our answer saved inside one clock tick. The later row is
        // the later truth — the same tie-break the orders board uses.
        using var db = NewDb();
        var lead = NewLead("Ivan", LeadStatuses.Quoted);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        var sameMoment = DateTimeOffset.UtcNow.AddHours(-1);
        db.LeadActivities.AddRange(
            Said(lead.Id, null, sameMoment, "Can you do it in oak?"),
            Said(lead.Id, "maria@nvc-home4you.eu", sameMoment, "Oak, yes."));
        await db.SaveChangesAsync();

        var row = Assert.Single(await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None));

        Assert.False(row.AwaitingReply);
    }

    [Fact]
    public async Task Every_lead_on_the_board_gets_its_own_answer()
    {
        // One query serves the whole board, so the risk is not an N+1 that shows in a test —
        // it is one lead's last word being reported for another.
        using var db = NewDb();
        var waiting = NewLead("Waiting", LeadStatuses.Quoted);
        var answered = NewLead("Answered", LeadStatuses.Quoted);
        var silent = NewLead("Silent", LeadStatuses.New);
        db.Leads.AddRange(waiting, answered, silent);
        await db.SaveChangesAsync();

        db.LeadActivities.AddRange(
            Said(waiting.Id, "maria@nvc-home4you.eu", DateTimeOffset.UtcNow.AddDays(-5), "Quote attached."),
            Said(waiting.Id, null, DateTimeOffset.UtcNow.AddDays(-4), "One question…"),
            Said(answered.Id, null, DateTimeOffset.UtcNow.AddDays(-6), "Is it in stock?"),
            Said(answered.Id, "maria@nvc-home4you.eu", DateTimeOffset.UtcNow.AddDays(-5), "It is."));
        await db.SaveChangesAsync();

        var board = await new LeadPipelineService(db).ListAsync(null, null, CancellationToken.None);
        var byName = board.ToDictionary(r => r.Name, r => r.AwaitingReply);

        Assert.True(byName["Waiting"]);
        Assert.False(byName["Answered"]);
        Assert.False(byName["Silent"]);
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

        await svc.UpdateFieldsAsync(lead.Id, nextStep: "Send quote", notes: null, projectName: null, buildLocation: null, customerAddress: null, country: null);

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

        await svc.UpdateFieldsAsync(lead.Id, nextStep: "   ", notes: null, projectName: null, buildLocation: null, customerAddress: null, country: null);

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

        await svc.UpdateFieldsAsync(lead.Id, "a", "b", "c", "d", "e", "f");

        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }

    [Fact]
    public async Task Where_the_customer_is_and_where_the_house_goes_are_kept_apart()
    {
        // Routinely different places — the buyer lives in Sofia, the plot is in the
        // mountains — and delivery, permitting and site access all hang off the second.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        await svc.UpdateFieldsAsync(
            lead.Id, nextStep: null, notes: null, projectName: null,
            buildLocation: "Borovets, plot 42", customerAddress: "Sofia, ul. Vitosha 1", country: null);

        var saved = await db.Leads.SingleAsync();
        Assert.Equal("Borovets, plot 42", saved.BuildLocation);
        Assert.Equal("Sofia, ul. Vitosha 1", saved.CustomerAddress);
    }

    // --- Correcting who the customer is -------------------------------------------------
    //
    // These three were not editable at all until now, and the consequence was not cosmetic:
    // the offer behind a lead is an immutable event and must keep saying what the form said,
    // so the lead row is the only place a mistyped name or address can be put right. Without
    // it, "Ivna" stayed Ivna in every list forever and a reply went to an address nobody
    // reads.

    [Fact]
    public async Task The_customers_name_email_and_phone_can_be_put_right()
    {
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead
        {
            Name = "Ivna Petrov", Email = "ivna@exmaple.com", Phone = "+359 88 000 0000",
        });

        await svc.UpdateFieldsAsync(
            lead.Id, nextStep: null, notes: null, projectName: null, buildLocation: null,
            customerAddress: null, country: null,
            name: "Ivan Petrov", email: "ivan@example.com", phone: "+359 88 123 4567");

        var saved = await db.Leads.SingleAsync();
        Assert.Equal("Ivan Petrov", saved.Name);
        Assert.Equal("ivan@example.com", saved.Email);
        Assert.Equal("+359 88 123 4567", saved.Phone);

        // ...and it is the detail view the panel reads back, not just the column.
        var detail = await new LeadPipelineService(db).GetAsync(lead.Id, CancellationToken.None);
        Assert.Equal("Ivan Petrov", detail!.Name);
        Assert.Equal("ivan@example.com", detail.Email);
        Assert.Equal("+359 88 123 4567", detail.Phone);
    }

    [Fact]
    public async Task A_save_that_does_not_mention_the_customer_leaves_all_three_alone()
    {
        // Absent and empty are different here for the same reason they are everywhere else on
        // this endpoint: a form that saves a note without carrying a phone number must not
        // wipe the phone number.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead
        {
            Name = "Ivan Petrov", Email = "ivan@example.com", Phone = "+359 88 123 4567",
        });

        await svc.UpdateFieldsAsync(
            lead.Id, nextStep: "Send quote", notes: null, projectName: null, buildLocation: null,
            customerAddress: null, country: null);

        var saved = await db.Leads.SingleAsync();
        Assert.Equal("Ivan Petrov", saved.Name);
        Assert.Equal("ivan@example.com", saved.Email);
        Assert.Equal("+359 88 123 4567", saved.Phone);
    }

    [Fact]
    public async Task An_email_or_a_phone_can_be_cleared_because_plenty_of_leads_have_neither()
    {
        // A walk-in who left a phone number and nothing else is a real lead, so both columns
        // have to be emptiable — and emptied means null, not "", or every "do we have an
        // address for them?" query answers yes.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead
        {
            Name = "Ivan Petrov", Email = "ivan@example.com", Phone = "+359 88 123 4567",
        });

        await svc.UpdateFieldsAsync(
            lead.Id, nextStep: null, notes: null, projectName: null, buildLocation: null,
            customerAddress: null, country: null, email: "", phone: "   ");

        var saved = await db.Leads.SingleAsync();
        Assert.Null(saved.Email);
        Assert.Null(saved.Phone);
    }

    [Fact]
    public async Task A_blank_name_leaves_the_stored_one_standing()
    {
        // The controller refuses this outright — see AdminValidationTests. What is pinned
        // here is what the service does if it is ever reached with one anyway: the column is
        // NOT NULL and every list on the board is a column of names, so the least destructive
        // reading of an edit that cannot be carried out is to carry out nothing.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan Petrov" });

        await svc.UpdateFieldsAsync(
            lead.Id, nextStep: null, notes: null, projectName: null, buildLocation: null,
            customerAddress: null, country: null, name: "   ");

        Assert.Equal("Ivan Petrov", (await db.Leads.SingleAsync()).Name);
    }

    [Fact]
    public async Task The_stored_address_can_be_read_back_to_tell_an_edit_from_a_resend()
    {
        // What the endpoint compares against so a bad address blocks an attempt to CHANGE it
        // rather than every other edit on the row — see AdminValidationTests for the rule and
        // LeadService.StoredEmailAsync for why the column holds values no parser accepts.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan", Email = "ivan@abv.bg, maria@abv.bg" });
        var noAddress = await svc.CreateAsync(new Lead { Name = "Walk-in" });

        Assert.Equal("ivan@abv.bg, maria@abv.bg", await svc.StoredEmailAsync(lead.Id));
        Assert.Null(await svc.StoredEmailAsync(noAddress.Id));

        // A lead that is not there reads the same as one with no address, and that is fine:
        // the caller's own save answers the missing row with a 404 a moment later.
        Assert.Null(await svc.StoredEmailAsync(999));
    }

    [Fact]
    public async Task Correcting_the_customer_stays_out_of_the_thread()
    {
        // Same judgement as the working notes above: a corrected typo is not a fact about the
        // relationship. Status and owner, which are, still each write their line.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivna" });

        await svc.UpdateFieldsAsync(
            lead.Id, nextStep: null, notes: null, projectName: null, buildLocation: null,
            customerAddress: null, country: null, name: "Ivan", email: "ivan@example.com");

        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }

    [Fact]
    public async Task A_modular_lead_keeps_the_catalogue_model_it_was_given()
    {
        // Modular is the category the catalogue carries most of — eight models against
        // wagon's six on 2026-08-21 — and it is now the category the picker offers first. The
        // leads endpoint takes whatever house it is handed as long as the house exists; what
        // decides whether a dropdown appears at all is PurchaseCategories.WithGalleryModels,
        // which is where the previous rule went wrong.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 4, Title = "Nova 60", CategoryKey = HouseCategories.Modular });
        await db.SaveChangesAsync();

        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        Assert.True(await svc.HouseExistsAsync(4));
        await svc.UpdateFieldsAsync(
            lead.Id, nextStep: null, notes: null, projectName: null, buildLocation: null,
            customerAddress: null, country: null, categoryKey: HouseCategories.Modular, houseId: 4);

        var saved = await db.Leads.SingleAsync();
        Assert.Equal(HouseCategories.Modular, saved.CategoryKey);
        Assert.Equal(4, saved.HouseId);

        // And the picker follows the catalogue rather than the word: garage sounds like a
        // building and has nothing in the gallery to offer.
        Assert.True(PurchaseCategories.AllowsGalleryModel(HouseCategories.Modular));
        Assert.False(PurchaseCategories.AllowsGalleryModel(HouseCategories.Garage));
    }

    [Fact]
    public async Task The_detail_view_returns_every_field_sales_maintains()
    {
        // The panel edits these, so a field missing from the projection reads as an empty
        // box and gets silently overwritten with blank on the next save.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead
        {
            Name = "Ivan", ProjectName = "Cabin", Country = "Bulgaria",
            CustomerAddress = "Sofia", BuildLocation = "Borovets",
            NextStep = "Call Monday", Notes = "Prefers evenings",
        });

        var detail = await new LeadPipelineService(db).GetAsync(lead.Id, CancellationToken.None);

        Assert.Equal("Cabin", detail!.ProjectName);
        Assert.Equal("Bulgaria", detail.Country);
        Assert.Equal("Sofia", detail.CustomerAddress);
        Assert.Equal("Borovets", detail.BuildLocation);
        Assert.Equal("Call Monday", detail.NextStep);
        Assert.Equal("Prefers evenings", detail.Notes);
    }

    // --- The overdue list -------------------------------------------------------------
    //
    // A different question from the board's. The board asks "who has nobody spoken to?";
    // this asks "who did we PROMISE to speak to?" — and a promise with a date on it
    // outranks a silence.

    private static Lead DueLead(string name, int daysAgo, string status = LeadStatuses.Contacted, string? owner = null)
    {
        var lead = NewLead(name, status, DateTimeOffset.UtcNow.AddDays(-1), owner);
        lead.NextContactAt = new DateTimeOffset(DateTimeOffset.UtcNow.UtcDateTime.Date, TimeSpan.Zero).AddDays(-daysAgo);
        return lead;
    }

    [Fact]
    public async Task The_due_list_holds_exactly_the_leads_whose_date_has_arrived()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            DueLead("Due today", 0),
            DueLead("Overdue", 5),
            DueLead("Due next week", -7),
            NewLead("No date at all", LeadStatuses.Contacted, DateTimeOffset.UtcNow.AddDays(-40)));
        await db.SaveChangesAsync();

        var due = await new LeadPipelineService(db).ListDueAsync(DateTimeOffset.UtcNow, null, CancellationToken.None);

        Assert.Equal(2, due.Count);
        Assert.Contains(due, l => l.Name == "Due today");
        Assert.Contains(due, l => l.Name == "Overdue");
    }

    [Fact]
    public async Task The_most_overdue_promise_comes_first()
    {
        // The report is worked top to bottom, so the ordering is the apology schedule.
        using var db = NewDb();
        db.Leads.AddRange(DueLead("A little late", 1), DueLead("Very late", 12), DueLead("Due today", 0));
        await db.SaveChangesAsync();

        var due = await new LeadPipelineService(db).ListDueAsync(DateTimeOffset.UtcNow, null, CancellationToken.None);

        Assert.Equal("Very late", due.First().Name);
        Assert.Equal("Due today", due.Last().Name);
    }

    [Fact]
    public async Task A_closed_lead_is_never_chased_whatever_its_date_says()
    {
        // Chasing a lead that closed last week is the fastest way to teach people to
        // ignore the report.
        using var db = NewDb();
        db.Leads.AddRange(
            DueLead("Won long ago", 30, LeadStatuses.Won),
            DueLead("Lost long ago", 30, LeadStatuses.Lost),
            DueLead("Still in play", 30));
        await db.SaveChangesAsync();

        var due = await new LeadPipelineService(db).ListDueAsync(DateTimeOffset.UtcNow, null, CancellationToken.None);

        var row = Assert.Single(due);
        Assert.Equal("Still in play", row.Name);
    }

    [Fact]
    public async Task The_due_list_narrows_to_one_owner_like_the_board_does()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            DueLead("Mine", 2, owner: "me@x.eu"),
            DueLead("Someone else's", 2, owner: "colleague@x.eu"));
        await db.SaveChangesAsync();

        var due = await new LeadPipelineService(db).ListDueAsync(DateTimeOffset.UtcNow, "me@x.eu", CancellationToken.None);

        var row = Assert.Single(due);
        Assert.Equal("Mine", row.Name);
    }

    [Fact]
    public async Task The_emailed_report_narrows_to_the_same_owner_the_screen_does()
    {
        // The report goes with the VIEW it reports on, and the Send report button sits two
        // controls from the due tab's owner filter. It used to pass ownerUpn: null whatever
        // was on screen — so a manager who narrowed to one salesperson, read her twelve
        // overdue rows and pressed Send mailed the whole team's three hundred, the first hint
        // being a confirmation whose number matched nothing in front of them.
        //
        // Pinned on the "nothing due" answer because it is returned before a single byte goes
        // near a transport: with the owner ignored these two rows would be found and the send
        // attempted instead.
        using var db = NewDb();
        db.Leads.AddRange(
            DueLead("Maria's", 4, owner: "maria@x.eu"),
            DueLead("Vladi's", 9, owner: "vladi@x.eu"));
        await db.SaveChangesAsync();

        var result = await NewFollowUps(db).SendDueReportAsync(
            new[] { "boss@x.eu" }, "https://nvc-home4you.eu", "boss@x.eu",
            ownerUpn: "nobody@x.eu", ct: CancellationToken.None);

        Assert.Equal(LeadFollowUpService.ReportOutcome.NothingDue, result.Outcome);
        Assert.Equal(0, result.Count);
    }

    // Configured enough for SendDueReportAsync to get past its "email is not configured"
    // guard and reach the query, which is the part under test. The transport is never
    // exercised — every assertion here is on an outcome returned before the send.
    private static LeadFollowUpService NewFollowUps(AppDbContext db)
    {
        var env = new EnvConfig(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["SMTP_USER"] = "panel@x.eu",
                ["SMTP_PASSWORD"] = "not-a-real-secret",
                ["SMTP_FROM"] = "panel@x.eu",
            }).Build());

        return new LeadFollowUpService(
            new LeadPipelineService(db),
            new EmailService(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance),
            env,
            NullLogger<LeadFollowUpService>.Instance);
    }

    [Fact]
    public async Task The_due_date_travels_on_both_projections()
    {
        // The board shows the label and the report links the row; both read the same
        // field, so both DTOs have to carry it.
        using var db = NewDb();
        db.Leads.Add(DueLead("Ivan", 3));
        await db.SaveChangesAsync();
        var id = db.Leads.Single().Id;

        var pipeline = new LeadPipelineService(db);
        var summary = (await pipeline.ListDueAsync(DateTimeOffset.UtcNow, null, CancellationToken.None)).Single();
        var detail = await pipeline.GetAsync(id, CancellationToken.None);

        Assert.False(string.IsNullOrEmpty(summary.NextContactAt));
        Assert.Equal(summary.NextContactAt, detail!.NextContactAt);
    }

    // --- Reading the date off the wire --------------------------------------------------

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void No_date_is_a_real_answer_not_an_error(string? raw)
    {
        Assert.True(LeadService.TryParseFollowUpDate(raw, out var value));
        Assert.Null(value);
    }

    [Fact]
    public void A_date_from_the_panel_lands_on_midnight_utc()
    {
        // "2026-08-20" saved in Sofia and in Lisbon has to be the same follow-up day, or
        // the report disagrees with itself depending on where a lead was last edited.
        Assert.True(LeadService.TryParseFollowUpDate("2026-08-20", out var value));

        Assert.Equal(new DateTimeOffset(2026, 8, 20, 0, 0, 0, TimeSpan.Zero), value);
    }

    [Fact]
    public void A_stray_time_component_is_truncated_to_the_day()
    {
        Assert.True(LeadService.TryParseFollowUpDate("2026-08-20T15:45:00Z", out var value));

        Assert.Equal(new DateTimeOffset(2026, 8, 20, 0, 0, 0, TimeSpan.Zero), value);
    }

    [Fact]
    public void Gibberish_is_refused_rather_than_saved_as_no_date()
    {
        // Absorbing it would silently drop the lead out of the one report that exists to
        // catch it.
        Assert.False(LeadService.TryParseFollowUpDate("next tuesday-ish", out _));
    }

    [Fact]
    public async Task Saving_fields_can_set_and_clear_the_follow_up_date()
    {
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        await svc.UpdateFieldsAsync(lead.Id, null, null, null, null, null, null, "2026-08-20");
        Assert.NotNull((await db.Leads.SingleAsync()).NextContactAt);

        // Blank clears — an emptied date box means "no promise outstanding".
        await svc.UpdateFieldsAsync(lead.Id, null, null, null, null, null, null, "");
        Assert.Null((await db.Leads.SingleAsync()).NextContactAt);

        // And null leaves it alone, like every other field on this endpoint.
        await svc.UpdateFieldsAsync(lead.Id, null, null, null, null, null, null, "2026-08-20");
        await svc.UpdateFieldsAsync(lead.Id, "call them", null, null, null, null, null, null);
        Assert.NotNull((await db.Leads.SingleAsync()).NextContactAt);
    }

    // --- Renaming the owners ------------------------------------------------------------

    [Fact]
    public void The_owner_rename_moves_assignments_and_leaves_the_history_alone()
    {
        // Read back off the migration rather than out of the file, the same way the purchase
        // migrations are pinned: deleting a statement while keeping the migration fails here
        // instead of on a database nobody is watching.
        var migration = new RenameLeadOwners();
        var up = migration.UpOperations.OfType<SqlOperation>().Select(o => o.Sql).ToList();

        Assert.Equal(3, up.Count);
        foreach (var (before, after) in new[]
                 {
                     ("bonin01@abv.bg", "tbonin@nvc-home4you.eu"),
                     ("vvladimirov@quickbase.com", "vvladimirov@nvc-home4you.eu"),
                     ("radinaivanova64@gmail.com", "rivanova@nvc-home4you.eu"),
                 })
        {
            Assert.Contains(up, sql =>
                sql.Contains($"[OwnerUpn] = '{after}'") && sql.Contains($"[OwnerUpn] = '{before}'"));
        }

        // THE POINT OF THE MIGRATION, and the reason it is three narrow statements rather than
        // a sweep over every UPN column. OwnerUpn is an assignment — a fact about now — so
        // moving it is correcting where an answer points. Every other UPN in this database
        // records who did something on the day they did it, at the address that was theirs
        // that day; rewriting one to match a later rename would have the log claim an account
        // sent an email months before that account existed.
        var everySql = up.Concat(migration.DownOperations.OfType<SqlOperation>().Select(o => o.Sql));
        foreach (var sql in everySql)
        {
            Assert.Contains("[Leads]", sql);
            foreach (var actorColumn in new[]
                     {
                         "ActorUpn", "UpdatedByUpn", "UploadedByUpn", "ChangedByUpn",
                         "LeadActivities", "AuditEntries",
                     })
            {
                Assert.DoesNotContain(actorColumn, sql);
            }
        }

        // ONE-WAY, and pinned as such so nobody restores the symmetric Down that used to be
        // here. It read every lead owned by a new address back onto the old one, on the
        // reasoning that only Up could have put a new address there. It could not: the old
        // addresses are what the CRM import copies out of Quickbase, while the app itself
        // writes the signed-in UPN (LeadService.CreateAsync, PromoteOfferAsync) and everybody
        // has signed in on the nvc-home4you.eu tenant since the move. Every lead created in
        // the panel since then already carries an address this migration renames TO — a
        // rollback would have swept all of them onto accounts that no longer exist, emptied
        // their owners' "Mine" tab, and put the dead addresses back in the assignable
        // dropdown, which is the exact condition Up exists to remove.
        Assert.Empty(migration.DownOperations);
    }
}
