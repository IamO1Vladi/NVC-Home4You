using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The reporting screen's one endpoint. AdminOnly, no-store — this is the whole business in
// numbers, the most sensitive read in the panel.
[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Policy = "AdminOnly")]
// HANDOFF.md's rule is no-store on EVERY response, and the hand-typed header lines only
// covered the GETs — mutations echo the same financial DTOs (2026-08-19 review). The
// class-level attribute is the version no future endpoint can forget.
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AdminDashboardController : ControllerBase
{
    private readonly DashboardService _svc;

    public AdminDashboardController(DashboardService svc) => _svc = svc;

    /// <summary>
    /// One period, fully computed: ?period=month&amp;year=2026&amp;month=8, or
    /// ?period=cycle&amp;cycleId=1, or ?period=year&amp;year=2026.
    ///
    /// Defaults to the current month, so the panel's first paint needs no arguments.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? period,
        [FromQuery] int? year, [FromQuery] int? month, [FromQuery] int? cycleId,
        CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";

        var now = DateTimeOffset.UtcNow;

        switch ((period ?? "month").ToLowerInvariant())
        {
            case "cycle":
                if (cycleId is not int id) return BadRequest(new { errors = new[] { "cycleId is required." } });
                var cycle = await _svc.CycleAsync(id, ct);
                return cycle is null ? NotFound() : Ok(cycle);

            case "year":
                return Ok(await _svc.YearAsync(year ?? now.Year, ct));

            default:
                return Ok(await _svc.MonthAsync(year ?? now.Year, month ?? now.Month, ct));
        }
    }
}
