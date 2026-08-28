using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Inbound mail, and the one piece of it that decides whether the whole feature is usable.
//
// Trimming quoted history sounds cosmetic and isn't: without it, reply three contains
// replies two and one, reply four contains all of them, and by the tenth message the panel
// is unreadable — and every drafted reply is paying to read the same conversation several
// times over.
public class LeadMailTests
{
    private const string Conn = "Server=(localdb)\\MSSQLLocalDB;Database=X;Trusted_Connection=True";

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static (string, string)[] GraphSettings => new[]
    {
        ("GRAPH_TENANT_ID", "tenant"),
        ("GRAPH_CLIENT_ID", "client"),
        ("GRAPH_CLIENT_SECRET", "secret"),
        ("GRAPH_SENDER", "contact@nvc-home4you.eu"),
        ("SQL_CONNECTION_STRING", Conn),
    };

    // --- The opt-in switch --------------------------------------------------------------

    [Fact]
    public void Inbound_mail_is_off_unless_explicitly_switched_on()
    {
        // Reading the mailbox needs Mail.Read plus an Application Access Policy. Without
        // that policy, application permissions are tenant-wide — so this must never
        // switch itself on just because sending happens to be configured.
        Assert.False(Config(GraphSettings).InboundMailConfigured);
    }

    [Fact]
    public void Inbound_mail_needs_graph_as_well_as_the_switch()
    {
        Assert.False(Config(("INBOUND_MAIL_ENABLED", "true"), ("SQL_CONNECTION_STRING", Conn)).InboundMailConfigured);
    }

    [Fact]
    public void With_the_switch_and_graph_inbound_mail_is_on()
    {
        var settings = new List<(string, string)>(GraphSettings) { ("INBOUND_MAIL_ENABLED", "true") };
        Assert.True(Config(settings.ToArray()).InboundMailConfigured);
    }

    // --- Trimming quoted history ---------------------------------------------------------

    [Fact]
    public void An_english_reply_keeps_only_what_the_customer_just_wrote()
    {
        var body = """
            Yes, Friday works for us.

            On Tue, 12 Aug 2026 at 09:14, NVC-HOME4YOU <contact@nvc-home4you.eu> wrote:
            > Would Friday suit you for the site visit?
            > Kind regards
            """;

        var trimmed = LeadMailPoller.TrimQuotedHistory(body);

        Assert.Equal("Yes, Friday works for us.", trimmed);
    }

    [Fact]
    public void An_outlook_style_header_block_is_cut()
    {
        var body = "Потвърждавам.\n\nFrom: NVC-HOME4YOU\nSent: 12 August 2026\nTo: Ivan\nSubject: Re: оферта";

        var trimmed = LeadMailPoller.TrimQuotedHistory(body);

        Assert.Equal("Потвърждавам.", trimmed);
    }

    [Fact]
    public void A_bulgarian_quote_header_is_cut()
    {
        // Outlook localises the header block, so an English-only rule would leave the
        // entire history in every Bulgarian reply — the common case for this company.
        var body = "Благодаря!\n\nОт: NVC-HOME4YOU\nИзпратено: 12 август 2026\n> предишно съобщение";

        var trimmed = LeadMailPoller.TrimQuotedHistory(body);

        Assert.Equal("Благодаря!", trimmed);
    }

    [Fact]
    public void A_greek_quote_header_is_cut()
    {
        var body = "Ευχαριστώ πολύ.\n\nΑπό: NVC-HOME4YOU\nΣτις 12 Αυγούστου";

        var trimmed = LeadMailPoller.TrimQuotedHistory(body);

        Assert.Equal("Ευχαριστώ πολύ.", trimmed);
    }

    [Fact]
    public void The_underscore_separator_some_clients_use_is_cut()
    {
        var body = "Sounds good.\n\n________________________________\nFrom: someone";

        Assert.Equal("Sounds good.", LeadMailPoller.TrimQuotedHistory(body));
    }

    [Fact]
    public void Html_mail_is_flattened_before_the_markers_are_looked_for()
    {
        // Graph returns HTML for most mail. Matching markers before stripping tags would
        // miss them, because the marker sits inside a <div>.
        var body = "<html><body><div>Yes, that works.</div><br><div>On Tue, 12 Aug 2026, NVC wrote:</div>"
                 + "<blockquote>Would Friday suit?</blockquote></body></html>";

        var trimmed = LeadMailPoller.TrimQuotedHistory(body);

        Assert.Equal("Yes, that works.", trimmed);
        Assert.DoesNotContain("Would Friday suit", trimmed);
        Assert.DoesNotContain("<div>", trimmed);
    }

    [Fact]
    public void Html_entities_are_decoded_so_the_thread_is_not_full_of_amp()
    {
        var trimmed = LeadMailPoller.TrimQuotedHistory("<p>Ivan &amp; Maria said &quot;yes&quot;</p>");

        Assert.Contains("Ivan & Maria", trimmed);
        Assert.Contains("\"yes\"", trimmed);
    }

    [Fact]
    public void A_message_with_no_quote_marker_is_kept_whole()
    {
        // The conservative half of the design: showing slightly too much is cosmetic,
        // while an over-eager rule silently deletes what the customer actually said.
        var body = "Hello, I would like to know the delivery time for the 58 m² model. Thanks, Ivan";

        Assert.Equal(body, LeadMailPoller.TrimQuotedHistory(body));
    }

    [Fact]
    public void A_marker_at_the_very_start_does_not_empty_the_message()
    {
        // A forwarded enquiry begins with the header block. Cutting at index 0 would file
        // an empty activity and lose the message entirely.
        var body = "From: customer@example.com\nSubject: Question\n\nDo you deliver to Greece?";

        var trimmed = LeadMailPoller.TrimQuotedHistory(body);

        Assert.Contains("Do you deliver to Greece?", trimmed);
    }

    [Fact]
    public void Runs_of_blank_lines_are_collapsed_but_paragraphs_survive()
    {
        var trimmed = LeadMailPoller.TrimQuotedHistory("First para.\n\n\n\n\nSecond para.");

        Assert.Equal("First para.\n\nSecond para.", trimmed);
    }

    [Fact]
    public void An_empty_body_is_an_empty_string_not_a_crash()
    {
        Assert.Equal("", LeadMailPoller.TrimQuotedHistory(null));
        Assert.Equal("", LeadMailPoller.TrimQuotedHistory("   "));
    }

    // --- Placing a message whose conversation we have never seen -------------------------
    //
    // A conversation id only ever gets recorded when somebody emailed the lead FROM THE
    // PANEL. The autoresponder records nothing, so until the sender fallback existed the
    // most ordinary thing a customer can do — hit reply on their acknowledgement — was
    // dropped silently. These are about that fallback and, just as much, about where it
    // stops.

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"inbound-{Guid.NewGuid()}")
            .Options);

    private static readonly Dictionary<string, int> NoConversation = new();

    private static Lead LeadWith(string email, string status, DateTimeOffset? lastActivity = null) =>
        new()
        {
            Name = "Ivan Petrov",
            Email = email,
            Status = status,
            LastActivityAt = lastActivity,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
        };

    [Fact]
    public async Task A_reply_to_the_autoresponder_lands_on_the_lead_that_owns_the_address()
    {
        using var db = NewDb();
        db.Leads.Add(LeadWith("ivan@example.com", LeadStatuses.New));
        await db.SaveChangesAsync();
        var leadId = (await db.Leads.SingleAsync()).Id;

        var byAddress = await LeadMailPoller.LeadsByAddressAsync(
            db, new[] { "ivan@example.com" }, CancellationToken.None);

        Assert.Equal(leadId, LeadMailPoller.RouteToLead("conv-nobody-recorded", "ivan@example.com", NoConversation, byAddress)?.LeadId);
    }

    [Fact]
    public async Task The_address_is_matched_case_insensitively_and_otherwise_exactly()
    {
        // Case, because mail clients rewrite it freely. Nothing else: a shared domain is not
        // a shared customer, and a near miss would file a stranger's message into a thread.
        using var db = NewDb();
        db.Leads.Add(LeadWith("Ivan.Petrov@Example.COM", LeadStatuses.Contacted));
        await db.SaveChangesAsync();

        var byAddress = await LeadMailPoller.LeadsByAddressAsync(
            db, new[] { "ivan.petrov@example.com", "maria@example.com" }, CancellationToken.None);

        Assert.NotNull(LeadMailPoller.RouteToLead(null, "IVAN.PETROV@example.com", NoConversation, byAddress));
        Assert.Null(LeadMailPoller.RouteToLead(null, "maria@example.com", NoConversation, byAddress));
    }

    [Fact]
    public async Task When_several_leads_share_an_address_the_most_recently_active_open_one_takes_it()
    {
        // The returning customer asking about a second house. The guess is "the deal
        // somebody is actually working, most recently touched" — and when it is wrong the
        // message is still in the panel, on the customer's other thread.
        using var db = NewDb();
        db.Leads.AddRange(
            LeadWith("ivan@example.com", LeadStatuses.Won, DateTimeOffset.UtcNow.AddHours(-1)),
            LeadWith("ivan@example.com", LeadStatuses.Quoted, DateTimeOffset.UtcNow.AddDays(-9)),
            LeadWith("ivan@example.com", LeadStatuses.Negotiating, DateTimeOffset.UtcNow.AddDays(-2)));
        await db.SaveChangesAsync();

        var expected = (await db.Leads.SingleAsync(l => l.Status == LeadStatuses.Negotiating)).Id;

        var byAddress = await LeadMailPoller.LeadsByAddressAsync(
            db, new[] { "ivan@example.com" }, CancellationToken.None);

        // Not the Won lead, even though it was touched an hour ago.
        Assert.Equal(expected, LeadMailPoller.RouteToLead(null, "ivan@example.com", NoConversation, byAddress)?.LeadId);
    }

    [Fact]
    public async Task With_nothing_open_the_most_recently_active_lead_of_any_status_takes_it()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            LeadWith("ivan@example.com", LeadStatuses.Lost, DateTimeOffset.UtcNow.AddDays(-40)),
            LeadWith("ivan@example.com", LeadStatuses.Won, DateTimeOffset.UtcNow.AddDays(-3)));
        await db.SaveChangesAsync();

        var expected = (await db.Leads.SingleAsync(l => l.Status == LeadStatuses.Won)).Id;

        var byAddress = await LeadMailPoller.LeadsByAddressAsync(
            db, new[] { "ivan@example.com" }, CancellationToken.None);

        Assert.Equal(expected, LeadMailPoller.RouteToLead(null, "ivan@example.com", NoConversation, byAddress)?.LeadId);
    }

    [Fact]
    public async Task Company_mail_from_an_address_that_belongs_to_no_lead_is_still_ignored()
    {
        // The line the fallback must not cross. The accountant, the supplier, the
        // newsletter — none of them are in Lead.Email, so none of them are filed, and the
        // shared mailbox does not turn into the pipeline.
        using var db = NewDb();
        db.Leads.Add(LeadWith("ivan@example.com", LeadStatuses.New));
        await db.SaveChangesAsync();

        var byAddress = await LeadMailPoller.LeadsByAddressAsync(
            db, new[] { "accountant@some-firm.bg" }, CancellationToken.None);

        Assert.Empty(byAddress);
        Assert.Null(LeadMailPoller.RouteToLead("a-conversation", "accountant@some-firm.bg", NoConversation, byAddress));
    }

    [Fact]
    public void Our_own_sent_mail_is_still_skipped()
    {
        // Unchanged and still load-bearing: our copy of an outbound message is in the thread
        // from the moment it was sent, and filing it again would double every reply.
        Assert.True(LeadMailPoller.IsFromUs("Contact@NVC-Home4You.eu", "contact@nvc-home4you.eu"));
        Assert.False(LeadMailPoller.IsFromUs("ivan@example.com", "contact@nvc-home4you.eu"));
        Assert.False(LeadMailPoller.IsFromUs(null, "contact@nvc-home4you.eu"));
    }

    [Fact]
    public void A_known_conversation_stays_the_fast_path_whatever_the_address_says()
    {
        // The conversation is exact and survives a customer answering from a second address.
        // The fallback is a guess, so it only ever runs when there is nothing better.
        var byConversation = new Dictionary<string, int> { ["AAQkAGI2"] = 7 };
        var byAddress = new Dictionary<string, int> { ["ivan@example.com"] = 99 };

        Assert.Equal(7, LeadMailPoller.RouteToLead("AAQkAGI2", "ivan@example.com", byConversation, byAddress)?.LeadId);
    }

    [Fact]
    public void A_message_the_conversation_placed_records_it_as_the_thread_anchor()
    {
        var placed = new LeadMailPoller.Placement(7, ByConversation: true);
        var activity = LeadMailPoller.InboundActivity(
            placed, "AAQkAGI2", "msg-1", "Re: Вашето запитване", "Да, петък е добре.", DateTimeOffset.UtcNow);

        Assert.Equal(7, activity.LeadId);
        Assert.Equal("AAQkAGI2", activity.ConversationId);
        Assert.Equal("msg-1", activity.ExternalMessageId);
        Assert.Equal(LeadActivityTypes.EmailIn, activity.Type);
        Assert.Null(activity.ActorUpn);          // null actor == the customer
    }

    [Fact]
    public void A_message_placed_by_its_sender_records_no_conversation_at_all()
    {
        // The guess must not become the fast path, because the fast path answers BEFORE the
        // sender's address is looked at. Ivan writes CCing Maria and is placed by address;
        // stamp his thread onto his lead and Maria's reply-all — a lead in her own right —
        // is filed on Ivan's thread as though she were him.
        var guessed = new LeadMailPoller.Placement(7, ByConversation: false);
        var activity = LeadMailPoller.InboundActivity(
            guessed, "AAQkAGI2", "msg-1", "Re: Вашето запитване", "Да, петък е добре.", DateTimeOffset.UtcNow);

        Assert.Equal(7, activity.LeadId);
        Assert.Null(activity.ConversationId);
        // Everything else is filed exactly as before — the message itself is not in doubt.
        Assert.Equal("msg-1", activity.ExternalMessageId);
        Assert.Equal("Да, петък е добре.", activity.Body);
    }

    // --- Two leads in one conversation, and the outage that used to be ------------------

    [Fact]
    public async Task A_conversation_that_ended_up_on_two_leads_resolves_instead_of_throwing()
    {
        // Graph decides what a conversation is, and it groups by participants and topic — so
        // a returning customer mailed twice from the panel under the same default subject is
        // enough to put one conversation on two leads. Keyed straight into a dictionary that
        // threw on the second row, which is the tick's FIRST query: no message would be
        // filed, for any lead, until the thread aged out of the lookback window.
        using var db = NewDb();
        db.Leads.AddRange(
            LeadWith("ivan@example.com", LeadStatuses.Quoted),
            LeadWith("ivan@example.com", LeadStatuses.New));
        await db.SaveChangesAsync();

        var leads = await db.Leads.OrderBy(l => l.Id).ToListAsync();
        db.LeadActivities.AddRange(
            new LeadActivity
            {
                LeadId = leads[0].Id, Type = LeadActivityTypes.EmailOut, Body = "Първо",
                ActorUpn = "sales@nvc.eu", ConversationId = "AAQkAGI2",
                OccurredAt = DateTimeOffset.UtcNow.AddDays(-4),
            },
            new LeadActivity
            {
                LeadId = leads[1].Id, Type = LeadActivityTypes.EmailOut, Body = "Второ",
                ActorUpn = "sales@nvc.eu", ConversationId = "AAQkAGI2",
                OccurredAt = DateTimeOffset.UtcNow.AddDays(-1),
            });
        await db.SaveChangesAsync();

        var byConversation = await LeadMailPoller.LeadsByConversationAsync(
            db, new[] { "AAQkAGI2" }, CancellationToken.None);

        // The thread somebody is actually in: the lead it was last used on.
        Assert.Equal(leads[1].Id, byConversation["AAQkAGI2"]);
    }

    // --- Mail that is in the mailbox but is not the customer speaking -------------------

    [Fact]
    public void An_automatic_reply_is_not_the_customer_speaking()
    {
        // The board reads the newest entry with no UPN on it as "they are waiting on us".
        // An out-of-office would raise that for the whole holiday, and the only way to lower
        // it is to write into the thread — so the board would be asking somebody to answer
        // an autoresponder.
        Assert.True(LeadMailPoller.IsAutomated("""
            { "internetMessageHeaders": [
                { "name": "Subject", "value": "Automatic reply: Вашата оферта" },
                { "name": "Auto-Submitted", "value": "auto-replied" } ] }
            """));

        // Exchange and the mailing lists that predate RFC 3834.
        Assert.True(LeadMailPoller.IsAutomated("""
            { "internetMessageHeaders": [ { "name": "X-Autoreply", "value": "yes" } ] }
            """));

        // "no" is how an ordinary message says so out loud, and it must not be read as a
        // machine just because the field is present.
        Assert.False(LeadMailPoller.IsAutomated("""
            { "internetMessageHeaders": [ { "name": "auto-submitted", "value": "no" } ] }
            """));

        // A customer typing at a keyboard, and a response we could not read: both are mail
        // to be filed. Guessing "automated" would silently drop a real reply.
        Assert.False(LeadMailPoller.IsAutomated("""
            { "internetMessageHeaders": [ { "name": "Received", "value": "by mail.example.com" } ] }
            """));
        Assert.False(LeadMailPoller.IsAutomated("{ }"));
        Assert.False(LeadMailPoller.IsAutomated("not json at all"));
        Assert.False(LeadMailPoller.IsAutomated(null));
    }

    // --- What filing a reply does to the lead itself ------------------------------------
    //
    // TouchLead is the one write the poller makes to the lead row, and ClosedAt moving
    // forward (2026-08-28) is the fix for a real silence: a customer replying to an
    // archived deal was recorded faithfully and seen by nobody, because the board filters
    // on ClosedAt and nothing moved it.

    [Fact]
    public void A_reply_to_a_closed_lead_restarts_the_archive_countdown_but_not_the_deal()
    {
        var lead = LeadWith("ivan@example.com", LeadStatuses.Lost);
        lead.ClosedAt = DateTimeOffset.UtcNow.AddDays(-10);

        var receivedAt = DateTimeOffset.UtcNow;
        LeadMailPoller.TouchLead(lead, receivedAt);

        // The countdown restarts; the deal does not reopen. Reopening stays a person's
        // deliberate act — the board's job here is only to make the reply visible.
        Assert.Equal(receivedAt, lead.ClosedAt);
        Assert.Equal(LeadStatuses.Lost, lead.Status);
        Assert.Equal(receivedAt, lead.LastActivityAt);
    }

    [Fact]
    public void A_reply_to_an_open_lead_does_not_invent_a_closing_date()
    {
        var lead = LeadWith("ivan@example.com", LeadStatuses.Quoted);

        LeadMailPoller.TouchLead(lead, DateTimeOffset.UtcNow);

        Assert.Null(lead.ClosedAt);
    }

    [Fact]
    public void A_late_arriving_older_message_rewinds_neither_clock()
    {
        // The Lookback window can hand the poller a message whose successors it has already
        // filed. Both clocks only ever move forward.
        var lastActivity = DateTimeOffset.UtcNow.AddDays(-1);
        var closedAt = DateTimeOffset.UtcNow.AddDays(-2);
        var lead = LeadWith("ivan@example.com", LeadStatuses.Won, lastActivity);
        lead.ClosedAt = closedAt;

        LeadMailPoller.TouchLead(lead, DateTimeOffset.UtcNow.AddDays(-5));

        Assert.Equal(lastActivity, lead.LastActivityAt);
        Assert.Equal(closedAt, lead.ClosedAt);
    }

    [Fact]
    public async Task The_replied_to_archived_lead_is_back_on_the_board_for_three_more_days()
    {
        // End to end through the board query: archived a week ago, replied to now — visible
        // again on the working board, gone from the archive tab, and the ClosedAt it now
        // carries puts it away again in three days if nobody acts.
        using var db = NewDb();
        var lead = LeadWith("ivan@example.com", LeadStatuses.Lost);
        lead.ClosedAt = DateTimeOffset.UtcNow.AddDays(-10);
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        LeadMailPoller.TouchLead(lead, DateTimeOffset.UtcNow);
        await db.SaveChangesAsync();

        var svc = new LeadPipelineService(db);
        var board = await svc.ListAsync(null, null, CancellationToken.None);
        var archived = await svc.ListAsync("archived", null, CancellationToken.None);

        Assert.Equal(lead.Id, Assert.Single(board).Id);
        Assert.Empty(archived);
    }
}
