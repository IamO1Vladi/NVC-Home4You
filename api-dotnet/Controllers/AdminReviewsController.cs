using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The app's first authenticated surface. Every action requires a signed-in staff member
// via the "AdminOnly" policy (Entra ID + the optional ADMIN_ALLOWED_USERS allow-list).
//
// This controller is only reachable when admin auth is fully configured — Program.cs does
// not register authentication otherwise, and [Authorize] then rejects every request rather
// than falling open.
[ApiController]
[Route("api/admin/reviews")]
[Authorize(Policy = "AdminOnly")]
public class AdminReviewsController : ControllerBase
{
    private readonly ReviewModerationService _svc;

    public AdminReviewsController(ReviewModerationService svc)
    {
        _svc = svc;
    }

    // status: "pending" (default), a specific value, or "all".
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, CancellationToken ct)
    {
        var items = await _svc.ListAsync(string.IsNullOrWhiteSpace(status) ? "pending" : status, ct);
        // Moderation decisions must never be served from a cache.
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(items);
    }

    [HttpGet("counts")]
    public async Task<IActionResult> Counts(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.CountsByStatusAsync(ct));
    }

    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, CancellationToken ct) =>
        await _svc.ApproveAsync(id, ct) ? Ok(new { ok = true, id, status = "approved" }) : NotFound();

    [HttpPost("{id:int}/reject")]
    public async Task<IActionResult> Reject(int id, CancellationToken ct) =>
        await _svc.RejectAsync(id, ct) ? Ok(new { ok = true, id, status = "rejected" }) : NotFound();

    [HttpPost("{id:int}/pending")]
    public async Task<IActionResult> ResetToPending(int id, CancellationToken ct) =>
        await _svc.ResetToPendingAsync(id, ct) ? Ok(new { ok = true, id, status = "pending" }) : NotFound();

    // Lets the SPA show who is signed in, and confirm the session is still valid.
    [HttpGet("/api/admin/me")]
    public IActionResult Me() => Ok(new
    {
        name = User.Identity?.Name ?? "",
        email = User.FindFirst("preferred_username")?.Value ?? "",
    });
}
