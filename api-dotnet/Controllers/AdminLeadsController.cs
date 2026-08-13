using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The leads work queue. Same protection as every other admin surface: the "AdminOnly"
// policy (Entra ID plus the optional ADMIN_ALLOWED_USERS allow-list), and unreachable
// altogether when admin auth is not configured, because Program.cs then registers no
// authentication and [Authorize] rejects everything rather than falling open.
//
// This one holds customer contact details for every enquiry ever received, so it is the
// most sensitive thing behind that policy so far.
[ApiController]
[Route("api/admin/leads")]
[Authorize(Policy = "AdminOnly")]
public class AdminLeadsController : ControllerBase
{
    private readonly LeadAdminService _svc;

    public AdminLeadsController(LeadAdminService svc)
    {
        _svc = svc;
    }

    // reached=false -> the outstanding queue (default), true -> already handled,
    // all -> everything still in the queue, archived -> the things put away.
    //
    // Archived is spelled as a value of the same parameter rather than a second flag,
    // because it is the same choice from the panel's side: four tabs, one at a time.
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? reached, CancellationToken ct)
    {
        var raw = (reached ?? "").Trim().ToLowerInvariant();
        var archived = raw == "archived";

        bool? filter = raw switch
        {
            "true" => true,
            "all" or "archived" => null,
            _ => false,
        };

        var items = await _svc.ListAsync(filter, ct, archived);
        // A work queue must never be served stale: a lead someone just ticked has to be
        // gone when the next person looks.
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(items);
    }

    [HttpGet("counts")]
    public async Task<IActionResult> Counts(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.CountsAsync(ct));
    }

    public record UpdateLeadFlags(bool? ReachedOut, bool? LeadCreated);

    // Both flags are optional so one box can be ticked without restating the other, which
    // would otherwise silently undo a change someone else made a second earlier.
    [HttpPost("{kind}/{id:int}")]
    public async Task<IActionResult> Update(string kind, int id, [FromBody] UpdateLeadFlags body, CancellationToken ct)
    {
        if (body is null || (body.ReachedOut is null && body.LeadCreated is null))
            return BadRequest(new { error = "Nothing to update." });

        var ok = await _svc.SetFlagsAsync(kind, id, body.ReachedOut, body.LeadCreated, ct);
        return ok
            ? Ok(new { ok = true, kind, id, reachedOut = body.ReachedOut, leadCreated = body.LeadCreated })
            : NotFound();
    }

    public record ArchiveRequest(bool Archived);

    // Its own endpoint rather than another optional flag on the update above. Archiving is
    // the one action here that takes a row out of everybody's view, so it is worth being
    // impossible to trigger by accident from a payload that meant to tick a checkbox.
    [HttpPost("{kind}/{id:int}/archive")]
    public async Task<IActionResult> Archive(string kind, int id, [FromBody] ArchiveRequest body, CancellationToken ct)
    {
        if (body is null) return BadRequest(new { errors = new[] { "Nothing to update." } });

        var ok = await _svc.SetArchivedAsync(kind, id, body.Archived, ct);
        return ok ? Ok(new { ok = true, kind, id, archived = body.Archived }) : NotFound();
    }
}
