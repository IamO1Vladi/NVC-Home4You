using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The per-entity DATA_SOURCE_* flags are what make the Quickbase -> SQL cutover safe:
// one table at a time, revertible by changing one variable. These tests pin the
// fail-safe behaviour — anything ambiguous must resolve to Quickbase, never SQL.
public class DataSourceFlagTests
{
    private const string Conn = "Server=(localdb)\\MSSQLLocalDB;Database=X;Trusted_Connection=True";

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    [Fact]
    public void Without_a_connection_string_everything_stays_on_quickbase()
    {
        // Even if a flag says "sql", no database means Quickbase. This is what keeps a
        // half-configured environment from taking the site down.
        var cfg = Config(("DATA_SOURCE_REVIEWS", "sql"));

        Assert.False(cfg.SqlConfigured);
        Assert.Equal(DataSource.Quickbase, cfg.DataSourceFor("reviews"));
    }

    [Fact]
    public void Flag_set_to_sql_with_a_connection_string_selects_sql()
    {
        var cfg = Config(("SQL_CONNECTION_STRING", Conn), ("DATA_SOURCE_REVIEWS", "sql"));

        Assert.True(cfg.SqlConfigured);
        Assert.Equal(DataSource.Sql, cfg.DataSourceFor("reviews"));
    }

    [Fact]
    public void Entities_are_switched_independently()
    {
        // The whole point of one-table-at-a-time: flipping reviews must not move houses.
        var cfg = Config(("SQL_CONNECTION_STRING", Conn), ("DATA_SOURCE_REVIEWS", "sql"));

        Assert.Equal(DataSource.Sql, cfg.DataSourceFor("reviews"));
        Assert.Equal(DataSource.Quickbase, cfg.DataSourceFor("houses"));
        Assert.Equal(DataSource.Quickbase, cfg.DataSourceFor("gallery"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("quickbase")]
    [InlineData("SQL_BUT_TYPOED")]
    [InlineData("true")]
    [InlineData("1")]
    [InlineData("yes")]
    public void Anything_that_is_not_exactly_sql_means_quickbase(string raw)
    {
        var cfg = Config(("SQL_CONNECTION_STRING", Conn), ("DATA_SOURCE_REVIEWS", raw));

        Assert.Equal(DataSource.Quickbase, cfg.DataSourceFor("reviews"));
    }

    [Theory]
    [InlineData("SQL")]
    [InlineData("Sql")]
    [InlineData(" sql ")]
    public void The_sql_value_is_case_and_whitespace_tolerant(string raw)
    {
        var cfg = Config(("SQL_CONNECTION_STRING", Conn), ("DATA_SOURCE_REVIEWS", raw));

        Assert.Equal(DataSource.Sql, cfg.DataSourceFor("reviews"));
    }

    [Fact]
    public void Entity_name_casing_does_not_matter()
    {
        var cfg = Config(("SQL_CONNECTION_STRING", Conn), ("DATA_SOURCE_REVIEWS", "sql"));

        Assert.Equal(DataSource.Sql, cfg.DataSourceFor("Reviews"));
        Assert.Equal(DataSource.Sql, cfg.DataSourceFor("REVIEWS"));
    }

    [Fact]
    public void A_whitespace_only_connection_string_does_not_count_as_configured()
    {
        var cfg = Config(("SQL_CONNECTION_STRING", "   "), ("DATA_SOURCE_REVIEWS", "sql"));

        Assert.False(cfg.SqlConfigured);
        Assert.Equal(DataSource.Quickbase, cfg.DataSourceFor("reviews"));
    }
}
