using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// AdminAuthConfigured gates whether the admin panel is wired up at all. If it ever
// returned true on incomplete config, the panel could be exposed without working
// authentication - worse than not shipping it. These tests pin the fail-closed behaviour.
public class AdminAuthConfigTests
{
    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static (string, string)[] Complete => new[]
    {
        ("ENTRA_CLIENT_ID", "da402120-b69a-41fb-b14e-79ed931aacdd"),
        ("ENTRA_TENANT_ID", "30a85277-6118-4809-93d3-bdac653e82cb"),
        ("ENTRA_CLIENT_SECRET", "a-secret-value"),
    };

    [Fact]
    public void Complete_configuration_enables_admin_auth()
    {
        Assert.True(Config(Complete).AdminAuthConfigured);
    }

    [Fact]
    public void Nothing_configured_disables_admin_auth()
    {
        Assert.False(Config().AdminAuthConfigured);
    }

    [Theory]
    [InlineData("ENTRA_CLIENT_ID")]
    [InlineData("ENTRA_TENANT_ID")]
    [InlineData("ENTRA_CLIENT_SECRET")]
    public void Any_missing_value_disables_admin_auth(string missing)
    {
        var settings = new List<(string, string)>(Complete);
        settings.RemoveAll(s => s.Item1 == missing);

        Assert.False(Config(settings.ToArray()).AdminAuthConfigured);
    }

    [Theory]
    [InlineData("ENTRA_CLIENT_SECRET", "   ")]
    [InlineData("ENTRA_CLIENT_ID", "")]
    public void Blank_values_do_not_count_as_configured(string key, string blank)
    {
        var settings = new List<(string, string)>(Complete);
        settings.RemoveAll(s => s.Item1 == key);
        settings.Add((key, blank));

        Assert.False(Config(settings.ToArray()).AdminAuthConfigured);
    }

    [Fact]
    public void Allowed_users_are_split_trimmed_and_lowercased()
    {
        var cfg = Config(("ADMIN_ALLOWED_USERS", " Vladi@nvc-home4you.eu , NLekov@nvc-home4you.eu "));

        Assert.Equal(
            new[] { "vladi@nvc-home4you.eu", "nlekov@nvc-home4you.eu" },
            cfg.AdminAllowedUsers);
    }

    [Fact]
    public void Empty_allow_list_means_no_restriction_beyond_the_tenant()
    {
        Assert.Empty(Config().AdminAllowedUsers);
    }
}
