using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The one thing #38 changed about the admin gate: an EMPTY allow-list no longer means
// "anyone in the tenant", because the tenant now holds a kind of account that is in it by
// design and is not staff — a representative. AdminAuthConfigTests pins what the allow-list
// parses to and RepresentativePolicyTests pins the rep gate; this pins the branch between
// the two, where a registered representative with no allow-list set would otherwise have
// walked into live pricing and every customer's thread.
//
// The AdminOnly body is a closure in Program.cs's top-level statements, with no seam a test
// can reach. So two halves: a text pin that the else-branch is there and calls the rule the
// rep gate is built on, negated; and the same shape rebuilt here — RequireAuthenticatedUser
// plus the two branches, as Program.cs writes them — run through the real authorization
// service, which is what shows the refusal is a refusal and not a thrown "policy not found".
public class AdminOnlyPolicyTests
{
    private const string Rep = "dtodorov@nvc-home4you.eu";
    private const string Admin = "vladi@nvc-home4you.eu";

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    // The policy as Program.cs registers it once sign-in is ready. The readiness flag's
    // deny-everything branch is the rep gate's test's subject, and the same code; it is left
    // out here so what remains is exactly the two branches under test.
    private static IAuthorizationService Auth(EnvConfig env)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddOptions();
        services.AddAuthorization(options => options.AddPolicy("AdminOnly", policy =>
        {
            policy.RequireAuthenticatedUser();

            var allowed = env.AdminAllowedUsers;
            if (allowed.Length > 0)
            {
                policy.RequireAssertion(ctx =>
                {
                    var upn = ctx.User.FindFirst("preferred_username")?.Value
                              ?? ctx.User.Identity?.Name
                              ?? "";
                    return allowed.Contains(upn.Trim().ToLowerInvariant());
                });
            }
            else
            {
                policy.RequireAssertion(ctx => !RepresentativePolicy.IsRepresentative(ctx.User, env));
            }
        }));

        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    private static ClaimsPrincipal SignedIn(string upn) =>
        new(new ClaimsIdentity(new[] { new Claim("preferred_username", upn) }, "test"));

    private static async Task<bool> Admitted(EnvConfig env, ClaimsPrincipal user) =>
        (await Auth(env).AuthorizeAsync(user, null, "AdminOnly")).Succeeded;

    [Fact]
    public async Task With_no_allow_list_a_registered_representative_is_refused_and_the_rest_of_the_tenant_admitted()
    {
        // "Anyone in the tenant" minus exactly the registry: the new hire still walks in,
        // the representative does not, and the whole of the difference is one setting.
        var env = Config(("REPRESENTATIVES", $"dtodorov={Rep}"));

        Assert.False(await Admitted(env, SignedIn(Rep)));
        Assert.False(await Admitted(env, SignedIn("DTodorov@NVC-Home4You.eu")));
        Assert.True(await Admitted(env, SignedIn("newhire@nvc-home4you.eu")));
    }

    [Fact]
    public async Task With_neither_list_set_the_tenant_is_admitted_as_before()
    {
        // Every installation before #38: no registry, no allow-list, the tenant is the
        // staff. The else-branch must not have narrowed that by a single account.
        Assert.True(await Admitted(Config(), SignedIn("anyone@nvc-home4you.eu")));
    }

    [Fact]
    public async Task With_an_allow_list_the_list_decides_and_the_registry_is_not_consulted()
    {
        // The allow-listed branch is as it was: a representative not on the list is refused
        // for not being on it, and one who IS on it is admitted — which is the only way a
        // salesperson with a link of his own holds both panels.
        var env = Config(("ADMIN_ALLOWED_USERS", Admin), ("REPRESENTATIVES", $"dtodorov={Rep}"));
        Assert.True(await Admitted(env, SignedIn(Admin)));
        Assert.False(await Admitted(env, SignedIn(Rep)));

        var both = Config(("ADMIN_ALLOWED_USERS", $"{Admin}, {Rep}"), ("REPRESENTATIVES", $"dtodorov={Rep}"));
        Assert.True(await Admitted(both, SignedIn(Rep)));
    }

    [Fact]
    public async Task Nobody_signed_in_is_refused_on_either_branch()
    {
        var anonymous = new ClaimsPrincipal(new ClaimsIdentity());

        Assert.False(await Admitted(Config(), anonymous));
        Assert.False(await Admitted(Config(("REPRESENTATIVES", $"dtodorov={Rep}")), anonymous));
        Assert.False(await Admitted(Config(("ADMIN_ALLOWED_USERS", Admin)), anonymous));
    }

    [Fact]
    public void Program_refuses_representatives_in_the_empty_allow_list_branch()
    {
        // The text pin, in SpaFallbackRouteTests' manner: the shape rebuilt above is only
        // what the app runs if Program.cs's AdminOnly block still carries the else-branch,
        // and the branch still calls the rule the rep gate is built on, negated.
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "api-dotnet", "Program.cs")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var source = File.ReadAllText(Path.Combine(dir!.FullName, "api-dotnet", "Program.cs"));

        var start = source.IndexOf("options.AddPolicy(\"AdminOnly\"", StringComparison.Ordinal);
        var end = source.IndexOf("options.AddPolicy(Services.RepresentativePolicy.Name", StringComparison.Ordinal);
        Assert.True(start >= 0 && end > start, "the AdminOnly registration has moved or been renamed");
        var adminOnly = source[start..end];

        Assert.Contains("policy.RequireAuthenticatedUser();", adminOnly);
        var allowListed = adminOnly.IndexOf("if (allowed.Length > 0)", StringComparison.Ordinal);
        Assert.True(allowListed >= 0, "the allow-listed branch has moved or been renamed");

        // In the ELSE branch, after the allow-listed one — not a blanket rule above both,
        // which would refuse the allow-listed salesperson who is also a representative.
        const string refusal = "policy.RequireAssertion(ctx => !Services.RepresentativePolicy.IsRepresentative(ctx.User, envCfg));";
        var elseAt = adminOnly.IndexOf("else", allowListed, StringComparison.Ordinal);
        var refusalAt = adminOnly.IndexOf(refusal, StringComparison.Ordinal);
        Assert.True(elseAt > allowListed, "the empty allow-list branch has no else");
        Assert.True(refusalAt > elseAt, "the representative refusal is missing from the else-branch");
    }
}
