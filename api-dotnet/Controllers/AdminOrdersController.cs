using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The orders board, which is also the report the owner asked for: customer, model, deposit,
// final price, left to pay, factory (ROADMAP #27, 2026-08-19).
//
// AdminOnly with no anonymous read path — every row names a customer and what they paid.
// The one PUBLIC surface in this feature is OrderController, which is a separate class on
// purpose: the two DTOs cannot be confused for each other if they never meet.
[ApiController]
[Route("api/admin/orders")]
[Authorize(Policy = "AdminOnly")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AdminOrdersController : ControllerBase
{
    private readonly OrderTrackingService _svc;

    public AdminOrdersController(OrderTrackingService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, CancellationToken ct) =>
        Ok(await _svc.ListAsync(status, ct));

    /// <summary>The status keys and their order, served rather than hard-coded in the SPA.</summary>
    [HttpGet("statuses")]
    public IActionResult Statuses() =>
        Ok(new { timeline = OrderStatuses.Timeline, all = OrderStatuses.All });

    /// <summary>Moves the order along. Order fields only — see UpdateOrderAsync.</summary>
    [HttpPut("{purchaseId:int}")]
    public async Task<IActionResult> Update(
        int purchaseId, [FromBody] OrderUpdateInput input, CancellationToken ct)
    {
        if (input?.Status is not null && !OrderStatuses.IsValid(input.Status))
            return BadRequest(new { errors = new[] { "That is not an order status." } });

        var actor = User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;
        return await _svc.UpdateOrderAsync(purchaseId, input!, actor, ct)
            ? Ok(new { ok = true })
            : NotFound();
    }

    /// <summary>
    /// Mints (or returns) the customer's tracking code. Idempotent — see EnsureReferenceAsync.
    /// </summary>
    [HttpPost("{purchaseId:int}/reference")]
    public async Task<IActionResult> Reference(int purchaseId, CancellationToken ct)
    {
        var code = await _svc.EnsureReferenceAsync(purchaseId, ct);
        return code is null ? NotFound() : Ok(new { ok = true, reference = code });
    }

    /// <summary>Withdraws the link — the URL stops resolving, the order keeps its history.</summary>
    [HttpDelete("{purchaseId:int}/reference")]
    public async Task<IActionResult> Revoke(int purchaseId, CancellationToken ct) =>
        await _svc.RevokeReferenceAsync(purchaseId, ct) ? Ok(new { ok = true }) : NotFound();
}
