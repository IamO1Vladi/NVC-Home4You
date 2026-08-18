using System;
using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// Who changed what, and when.
//
// READ ONLY, deliberately and completely: there is no POST, PUT or DELETE on this controller
// and no service method behind it that could back one. An audit log the application can edit
// proves nothing, so the absence of a write path here is the feature.
//
// Behind AdminOnly like the rest of the panel. Note what that means: everyone who can read
// this log is also someone it records. That is the right trade for a team of three — a
// separate "auditor" role would be ceremony over the same three people — but it is a
// decision rather than an oversight, and it is the thing to revisit when the team grows.
//
// The entries themselves carry no ЕГН: see AuditRedaction, which is enforced on the way IN
// rather than on the way out, so there is nothing here that could accidentally serve one.
[ApiController]
[Route("api/admin/audit")]
[Authorize(Policy = "AdminOnly")]
public class AdminAuditController : ControllerBase
{
    private readonly AuditReadService _svc;

    public AdminAuditController(AuditReadService svc) => _svc = svc;

    /// <summary>Recent activity, newest first, with optional filters.</summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? entityType,
        [FromQuery] string? actor,
        [FromQuery] string? action,
        [FromQuery] string? since,
        [FromQuery] string? until,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(action) && !AuditActions.IsValid(action))
            return BadRequest(new { errors = new[] { $"'{action}' is not an audit action." } });

        // A date the server cannot read is refused rather than ignored. Silently dropping it
        // would answer a narrowed question with the whole table, which reads as "there were
        // no changes in that window" only if you do not look closely.
        if (!TryParseBoundary(since, out var sinceAt))
            return BadRequest(new { errors = new[] { "That is not a date we can read." } });
        if (!TryParseBoundary(until, out var untilAt))
            return BadRequest(new { errors = new[] { "That is not a date we can read." } });

        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(entityType, actor, action, sinceAt, untilAt, skip, take, ct));
    }

    /// <summary>Everything that ever happened to one record.</summary>
    [HttpGet("{entityType}/{entityId}")]
    public async Task<IActionResult> ForRecord(string entityType, string entityId, CancellationToken ct)
    {
        // Answered with an empty list rather than a 404 when the type is not audited: the
        // caller asked a legitimate question and the honest answer is "nothing is recorded
        // for this", which is different from "no such endpoint".
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ForRecordAsync(entityType, entityId, ct));
    }

    /// <summary>The values worth offering in the filter dropdowns.</summary>
    [HttpGet("filters")]
    public async Task<IActionResult> Filters(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.FiltersAsync(ct));
    }

    private static bool TryParseBoundary(string? value, out DateTimeOffset? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(value)) return true;

        if (!DateTimeOffset.TryParse(
                value, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal |
                System.Globalization.DateTimeStyles.AdjustToUniversal,
                out var result))
        {
            return false;
        }

        parsed = result;
        return true;
    }
}
