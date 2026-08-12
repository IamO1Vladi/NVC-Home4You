using System.Collections.Generic;
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
}
