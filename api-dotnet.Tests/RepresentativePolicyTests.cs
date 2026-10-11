using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The gate on the representative's panel (#38), exercised through the real authorization
// service rather than by reading its closure. AdminAuthConfigTests pins the fail-closed
// behaviour of the admin gate's configuration; this pins the rep gate's, and the one rule
// that gate adds on top: the registry decides, and only the registry.
public class RepresentativePolicyTests
{
    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static EnvConfig Registry() =>
        Config(
            ("REPRESENTATIVES", "dtodorov=dtodorov@nvc-home4you.eu"),
            ("ADMIN_ALLOWED_USERS", "vladi@nvc-home4you.eu"));

    // The policy as Program.cs registers it, in a container with nothing else in it.
    private static IAuthorizationService Auth(EnvConfig env, bool authReady = true)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddOptions();
        services.AddAuthorization(options =>
            options.AddPolicy(RepresentativePolicy.Name, policy => RepresentativePolicy.Configure(policy, authReady, env)));

        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    private static ClaimsPrincipal SignedIn(string upn) =>
        new(new ClaimsIdentity(new[] { new Claim("preferred_username", upn) }, "test"));

    private static ClaimsPrincipal Anonymous => new(new ClaimsIdentity());

    private static async Task<bool> Admitted(EnvConfig env, ClaimsPrincipal user, bool authReady = true) =>
        (await Auth(env, authReady).AuthorizeAsync(user, null, RepresentativePolicy.Name)).Succeeded;

    [Fact]
    public async Task A_registered_representative_is_admitted_whatever_the_tokens_casing()
    {
        Assert.True(await Admitted(Registry(), SignedIn("dtodorov@nvc-home4you.eu")));
        Assert.True(await Admitted(Registry(), SignedIn("DTodorov@NVC-Home4You.eu")));
    }

    [Fact]
    public async Task An_admin_who_is_not_in_the_registry_is_refused()
    {
        // The allow-list opens the admin panel and nothing else. Being staff does not make
        // somebody a representative, and the other way round is pinned on AdminOnly's side
        // by what the allow-list contains.
        Assert.False(await Admitted(Registry(), SignedIn("vladi@nvc-home4you.eu")));
    }

    [Fact]
    public async Task Anyone_else_in_the_tenant_is_refused()
    {
        Assert.False(await Admitted(Registry(), SignedIn("newhire@nvc-home4you.eu")));
    }

    [Fact]
    public async Task Nobody_signed_in_is_refused()
    {
        Assert.False(await Admitted(Registry(), Anonymous));
    }

    [Fact]
    public async Task With_no_registry_configured_nobody_is_a_representative()
    {
        // Unlike ADMIN_ALLOWED_USERS, where an empty list means "the whole tenant": an empty
        // registry is a panel nobody can open, because there is nobody it would be for.
        var noRegistry = Config(("ADMIN_ALLOWED_USERS", "vladi@nvc-home4you.eu"));

        Assert.False(await Admitted(noRegistry, SignedIn("dtodorov@nvc-home4you.eu")));
        Assert.False(await Admitted(noRegistry, SignedIn("vladi@nvc-home4you.eu")));
    }

    [Fact]
    public async Task Without_working_sign_in_the_gate_is_shut_even_for_a_registered_representative()
    {
        // The same fail-closed shape as AdminOnly: no Entra, no SQL, no panel — denied
        // cleanly rather than "policy not found".
        Assert.False(await Admitted(Registry(), SignedIn("dtodorov@nvc-home4you.eu"), authReady: false));
    }

    [Fact]
    public async Task The_identity_name_is_the_fallback_when_there_is_no_upn_claim()
    {
        // The same fallback every controller and HttpCurrentActor apply, so the gate admits
        // exactly the people whose UPN the leads are owned by.
        var byName = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "dtodorov@nvc-home4you.eu") }, "test"));

        Assert.True(await Admitted(Registry(), byName));
        Assert.True(RepresentativePolicy.IsRepresentative(byName, Registry()));
        Assert.False(RepresentativePolicy.IsRepresentative(Anonymous, Registry()));
    }

    [Fact]
    public void Program_registers_the_policy_beside_AdminOnly_with_the_same_readiness_flag()
    {
        // A text pin, like SpaFallbackRouteTests: the gate above is only what the app runs if
        // Program.cs wires it under this name, next to the admin one, with the same flag.
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "api-dotnet", "Program.cs")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var source = File.ReadAllText(Path.Combine(dir!.FullName, "api-dotnet", "Program.cs"));

        var adminOnly = source.IndexOf("options.AddPolicy(\"AdminOnly\"", StringComparison.Ordinal);
        var repOnly = source.IndexOf("options.AddPolicy(Services.RepresentativePolicy.Name", StringComparison.Ordinal);
        Assert.True(adminOnly >= 0, "the AdminOnly registration has moved or been renamed");
        Assert.True(repOnly > adminOnly, "the RepresentativeOnly registration is missing or not beside AdminOnly");
        Assert.Contains("Services.RepresentativePolicy.Configure(policy, adminAuthReady, envCfg)", source);
    }
}
