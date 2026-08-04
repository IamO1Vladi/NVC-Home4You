using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Services;

// Placeholder authentication scheme used when Entra ID is not configured.
//
// The admin endpoints are [Authorize]-gated, and an authorization failure triggers a
// challenge. With no scheme registered at all, that challenge throws and the endpoint
// answers 500 — safe, but indistinguishable from a real fault. This handler authenticates
// nobody and challenges with a plain 401, so an unconfigured environment gives the same
// clear "not signed in" answer as a signed-out browser would.
public class DisabledAdminAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "AdminDisabled";

    public DisabledAdminAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    // NoResult, not Fail: there is no credential to reject, there is simply no identity.
    protected override Task<AuthenticateResult> HandleAuthenticateAsync() =>
        Task.FromResult(AuthenticateResult.NoResult());
}
