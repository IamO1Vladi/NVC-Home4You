using Microsoft.AspNetCore.Http;

namespace Services;

/// <summary>
/// Who is acting on this request, for code that is too far from the controller to be handed
/// a UPN — which in practice means the audit interceptor.
///
/// Every controller already computes this the same way, six times over
/// (`User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name`), and this is
/// deliberately the SAME expression rather than a better one: the audit log must name people
/// exactly as Lead.OwnerUpn, Customer.UpdatedByUpn and the AdminOnly allow-list already do,
/// or "who owns this lead" and "who changed it" would print two different spellings of one
/// person.
///
/// Services keep taking an explicit actor parameter. That is not redundancy — an explicit
/// argument is testable and honest about what a method depends on, and the importers pass
/// null on purpose. This exists only for the layer that has no other way to know.
/// </summary>
public interface ICurrentActor
{
    /// <summary>The signed-in UPN, or null when nothing human is behind the write.</summary>
    string? Upn { get; }
}

public sealed class HttpCurrentActor : ICurrentActor
{
    private readonly IHttpContextAccessor _http;

    public HttpCurrentActor(IHttpContextAccessor http) => _http = http;

    public string? Upn
    {
        get
        {
            var user = _http.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true) return null;

            var upn = user.FindFirst("preferred_username")?.Value ?? user.Identity.Name;
            return string.IsNullOrWhiteSpace(upn) ? null : upn;
        }
    }
}

/// <summary>
/// The actor when there is no request: the importers, the mail poller, the CLI commands.
/// Null is the correct answer and AuditEntry.ActorUpn documents why — "the system did it" is
/// a fact worth recording, not a gap to paper over with a fake username.
/// </summary>
public sealed class SystemActor : ICurrentActor
{
    public string? Upn => null;
}
