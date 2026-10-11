using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The REPRESENTATIVES setting (#38): who may hand out a personal enquiry link and sign in to
// see the leads it brings.
//
// Same shape and the same stakes as the ADMIN_ALLOWED_USERS tests above it in EnvConfig: a
// slug reaches a stored message, a mail subject and a Lead.Source straight from a setting, a
// UPN becomes a lead's owner and a mail recipient, and the sign-in gate for the rep panel
// is "is this UPN in here". So what is pinned is mostly what gets REFUSED, and that a typo
// further along the setting cannot quietly re-point an existing link.
public class RepresentativeRegistryTests
{
    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static EnvConfig Registry(string value) => Config(("REPRESENTATIVES", value));

    [Fact]
    public void One_entry_parses_into_a_slug_and_a_upn()
    {
        var reps = Registry("dtodorov=dtodorov@nvc-home4you.eu").Representatives;

        var rep = Assert.Single(reps);
        Assert.Equal("dtodorov", rep.Slug);
        Assert.Equal("dtodorov@nvc-home4you.eu", rep.Upn);
    }

    [Fact]
    public void Entries_are_split_on_commas_or_semicolons_trimmed_and_lower_cased()
    {
        // The App Service settings blade is where this gets typed, by hand, with whatever
        // spacing and capitals come naturally.
        var reps = Registry("  DTodorov = DTodorov@NVC-Home4You.eu ; ivanov=Ivanov@nvc-home4you.eu , ").Representatives;

        Assert.Equal(
            new[] { ("dtodorov", "dtodorov@nvc-home4you.eu"), ("ivanov", "ivanov@nvc-home4you.eu") },
            reps.Select(r => (r.Slug, r.Upn)).ToArray());
    }

    [Fact]
    public void The_first_spelling_of_a_slug_wins()
    {
        // A link already in a video must keep pointing where it did; a later duplicate is a
        // mistake in the setting, not a re-assignment.
        var reps = Registry("dtodorov=first@nvc-home4you.eu,dtodorov=second@nvc-home4you.eu").Representatives;

        var rep = Assert.Single(reps);
        Assert.Equal("first@nvc-home4you.eu", rep.Upn);
    }

    [Theory]
    [InlineData("dtodorov")]                                   // no '='
    [InlineData("=dtodorov@nvc-home4you.eu")]                  // no slug
    [InlineData("dtodorov=")]                                  // no address
    [InlineData("dtodorov=not-an-address")]                    // not an address
    [InlineData("dtodorov=Dimitar <dtodorov@nvc-home4you.eu>")] // a display name is not an address
    [InlineData("d todorov=dtodorov@nvc-home4you.eu")]         // a space in the slug
    [InlineData("-dtodorov=dtodorov@nvc-home4you.eu")]         // must start with a letter or digit
    [InlineData("d=dtodorov@nvc-home4you.eu")]                 // too short
    [InlineData("дтодоров=dtodorov@nvc-home4you.eu")]          // the slug goes in a URL: ASCII only
    public void A_malformed_entry_is_skipped_and_the_rest_survive(string bad)
    {
        var reps = Registry($"{bad};ivanov=ivanov@nvc-home4you.eu").Representatives;

        var rep = Assert.Single(reps);
        Assert.Equal("ivanov", rep.Slug);
    }

    [Fact]
    public void A_slug_longer_than_forty_characters_is_refused()
    {
        var forty = new string('a', 40);
        var fortyOne = new string('a', 41);

        Assert.Single(Registry($"{forty}=a@nvc-home4you.eu").Representatives);
        Assert.Empty(Registry($"{fortyOne}=a@nvc-home4you.eu").Representatives);
    }

    [Fact]
    public void Nothing_configured_means_nobody()
    {
        Assert.Empty(Config().Representatives);
        Assert.Empty(Registry("").Representatives);
        Assert.Empty(Registry("  ;  ,  ").Representatives);
        Assert.Null(Config().FindRepresentativeBySlug("dtodorov"));
        Assert.Null(Config().FindRepresentativeByUpn("dtodorov@nvc-home4you.eu"));
    }

    // --- Lookups ------------------------------------------------------------------------

    [Fact]
    public void A_slug_is_found_whatever_the_browser_did_to_it()
    {
        // The slug arrives from localStorage, originally from a URL somebody typed or
        // pasted; capitals and stray spaces are not identity.
        var cfg = Registry("dtodorov=dtodorov@nvc-home4you.eu");

        Assert.Equal("dtodorov", cfg.FindRepresentativeBySlug(" DTodorov ")!.Slug);
        Assert.Equal("dtodorov@nvc-home4you.eu", cfg.FindRepresentativeBySlug("dtodorov")!.Upn);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("unknown")]
    [InlineData("dtodorov2")]
    public void An_unknown_or_blank_slug_is_nobody_rather_than_an_error(string? slug)
    {
        // An unknown slug is an ordinary enquiry with a stale link on it; the caller treats
        // null as "no rep" and stores the enquiry as it always did.
        Assert.Null(Registry("dtodorov=dtodorov@nvc-home4you.eu").FindRepresentativeBySlug(slug));
    }

    [Fact]
    public void A_upn_is_found_case_insensitively()
    {
        // The UPN on the sign-in side comes from the Entra token, whose casing is not ours.
        var cfg = Registry("dtodorov=dtodorov@nvc-home4you.eu");

        Assert.Equal("dtodorov", cfg.FindRepresentativeByUpn("DTodorov@NVC-Home4You.eu")!.Slug);
        Assert.Equal("dtodorov", cfg.FindRepresentativeByUpn("  dtodorov@nvc-home4you.eu ")!.Slug);
        Assert.Null(cfg.FindRepresentativeByUpn("someone@nvc-home4you.eu"));
        Assert.Null(cfg.FindRepresentativeByUpn(null));
        Assert.Null(cfg.FindRepresentativeByUpn(""));
    }

    [Fact]
    public void Admins_are_not_representatives_and_representatives_are_not_admins()
    {
        // Two lists, two gates. An admin who is not in the registry has no rep panel, and a
        // representative who is not on the allow-list has no admin panel — the whole point
        // of a RESTRICTED panel is that the registry alone opens it.
        var cfg = Config(
            ("ADMIN_ALLOWED_USERS", "vladi@nvc-home4you.eu"),
            ("REPRESENTATIVES", "dtodorov=dtodorov@nvc-home4you.eu"));

        Assert.Null(cfg.FindRepresentativeByUpn("vladi@nvc-home4you.eu"));
        Assert.DoesNotContain("dtodorov@nvc-home4you.eu", cfg.AdminAllowedUsers);
    }
}
