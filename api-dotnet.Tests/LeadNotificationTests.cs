using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The internal "new lead" email is no longer just a convenience. Since the lead write was
// hardened, it is what decides whether a failed write is a recoverable problem (200) or a
// genuinely lost lead (502) — so who receives it, and that it is parsed at all, matters.
public class LeadNotificationTests
{
    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    [Fact]
    public void All_three_of_sales_are_notified_by_default()
    {
        var recipients = Config().LeadNotifyEmail;

        Assert.Contains("nlekov@nvc-home4you.eu", recipients);
        Assert.Contains("vvladimirov@nvc-home4you.eu", recipients);
        Assert.Contains("tbonin@nvc-home4you.eu", recipients);
    }

    [Fact]
    public void An_explicit_app_setting_still_wins_over_the_default()
    {
        // App Service overriding this is the expected way to change the list; the default
        // only applies when the variable is absent.
        var recipients = Config(("LEAD_NOTIFY_EMAIL", "someone@example.com")).LeadNotifyEmail;

        Assert.Equal("someone@example.com", recipients);
        Assert.DoesNotContain("nlekov", recipients);
    }

    [Theory]
    [InlineData("a@x.com,b@x.com", 2)]
    [InlineData("a@x.com; b@x.com ;c@x.com", 3)]
    [InlineData("a@x.com,,b@x.com", 2)]
    [InlineData("not-an-email,b@x.com", 1)]   // entries without @ are dropped
    [InlineData("a@x.com,a@x.com", 1)]        // and duplicates collapse
    public void The_recipient_list_is_parsed_the_way_the_default_is_written(string raw, int expected)
    {
        // Mirrors EmailService.ParseRecipients, which is private; this pins the contract
        // the default above relies on — three addresses separated by commas.
        var parsed = raw
            .Split(new[] { ',', ';' }, System.StringSplitOptions.RemoveEmptyEntries | System.StringSplitOptions.TrimEntries)
            .Where(x => x.Contains('@'))
            .Distinct()
            .ToArray();

        Assert.Equal(expected, parsed.Length);
    }

    [Fact]
    public void The_default_list_parses_into_exactly_three_addresses()
    {
        var parsed = Config().LeadNotifyEmail
            .Split(new[] { ',', ';' }, System.StringSplitOptions.RemoveEmptyEntries | System.StringSplitOptions.TrimEntries)
            .Where(x => x.Contains('@'))
            .Distinct()
            .ToArray();

        Assert.Equal(3, parsed.Length);
    }
}
