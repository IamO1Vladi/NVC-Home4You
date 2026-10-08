using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace Services;

/// <summary>
/// Who may open the representative's panel (#38): a signed-in account whose UPN is in the
/// REPRESENTATIVES registry, and nobody else.
///
/// Registered in Program.cs beside AdminOnly, with the same unconfigured-means-deny shape.
/// The body lives here rather than inline so a test can exercise the assertion without a
/// web host — AdminOnly's closure has no such test, and this gate opens customer
/// conversations to people who are not staff, which is worth one.
///
/// Admins are NOT implicitly representatives and representatives are NOT admins. The
/// allow-list and the registry are two settings, and each policy reads only its own: a
/// salesperson who should also see the leads from "his" link is listed in both, and a
/// representative who is listed only here never sees the enquiry queue, the customers or
/// anybody else's leads. The same Entra sign-in serves both; what differs is the list the
/// UPN is looked up in afterwards.
/// </summary>
public static class RepresentativePolicy
{
    public const string Name = "RepresentativeOnly";

    public static void Configure(AuthorizationPolicyBuilder policy, bool authReady, EnvConfig env)
    {
        // The same fail-closed rule as AdminOnly: without working sign-in the route denies
        // everyone cleanly rather than throwing "policy not found" and answering a 500.
        if (!authReady)
        {
            policy.RequireAssertion(_ => false);
            return;
        }

        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(ctx => IsRepresentative(ctx.User, env));
    }

    /// <summary>
    /// Whether this signed-in principal is a registered representative. The claim is read
    /// the way every controller and HttpCurrentActor read it, so the UPN the gate admits is
    /// the UPN the leads are owned by.
    /// </summary>
    public static bool IsRepresentative(ClaimsPrincipal user, EnvConfig env)
    {
        var upn = user.FindFirst("preferred_username")?.Value ?? user.Identity?.Name;
        return env.FindRepresentativeByUpn(upn) is not null;
    }
}
