using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The targets the dashboard measures against. AdminOnly, no-store — see AdminBuyCyclesController.
[ApiController]
[Route("api/admin/targets")]
[Authorize(Policy = "AdminOnly")]
// HANDOFF.md's rule is no-store on EVERY response, and the hand-typed header lines only
// covered the GETs — mutations echo the same financial DTOs (2026-08-19 review). The
// class-level attribute is the version no future endpoint can forget.
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AdminTargetsController : ControllerBase
{
    private readonly TargetAdminService _svc;

    public AdminTargetsController(TargetAdminService svc) => _svc = svc;

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(ct));
    }

    /// <summary>Both key lists in one response — the form needs both to render a single row.</summary>
    [HttpGet("keys")]
    public IActionResult Keys()
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(new { periodTypes = PeriodTypes.All, metrics = TargetMetrics.All });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var target = await _svc.GetAsync(id, ct);
        return target is null ? NotFound() : Ok(target);
    }

    /// <summary>
    /// Sets a target — creating it, or replacing the one already set for that metric and
    /// period.
    ///
    /// ONE ENDPOINT RATHER THAN POST-AND-PUT, because there is only one target per metric per
    /// period and the panel has no id to send until it has fetched one. A separate create
    /// that fails with "already exists" would push the person into a dead end on the screen
    /// whose entire job is revising a number. See TargetAdminService.SetAsync.
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Set([FromBody] TargetInput input, CancellationToken ct)
    {
        var errors = TargetAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var (outcome, target) = await _svc.SetAsync(input, Actor(), ct);
        return Ok(new { ok = true, created = outcome == TargetAdminService.SaveOutcome.Created, target });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await _svc.DeleteAsync(id, ct) ? Ok(new { ok = true, id }) : NotFound();
}
