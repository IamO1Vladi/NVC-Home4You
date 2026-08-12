using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The sales pipeline: leads with owners, stages and conversation threads.
//
// Distinct from AdminLeadsController, which is the ENQUIRY queue (offers and questions,
// the workflow inherited from Quickbase). An enquiry is an immutable event; a lead is the
// relationship that may grow out of one. Same protection, different resource.
//
// This holds the full conversation history with customers, so it is the most sensitive
// surface in the panel — everything here is behind AdminOnly, and there is no anonymous
// read path for attachments (see AdminPipelineAttachmentsController).
[ApiController]
[Route("api/admin/pipeline")]
[Authorize(Policy = "AdminOnly")]
public class AdminPipelineController : ControllerBase
{
    private readonly LeadPipelineService _read;
    private readonly LeadService _leads;
    private readonly LeadDraftService _drafts;
    private readonly LeadMailService _mail;

    public AdminPipelineController(
        LeadPipelineService read, LeadService leads, LeadDraftService drafts, LeadMailService mail)
    {
        _read = read;
        _leads = leads;
        _drafts = drafts;
        _mail = mail;
    }

    // The signed-in salesperson, as the UPN everything here records them by. Matches the
    // claim the AdminOnly policy checks, so ownership and the allow-list can never
    // disagree about who someone is.
    private string? CurrentUpn =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? owner, CancellationToken ct)
    {
        // "mine" saves the panel from having to know its own user's UPN to filter by it.
        var ownerFilter = string.Equals(owner, "mine", System.StringComparison.OrdinalIgnoreCase)
            ? CurrentUpn
            : owner;

        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _read.ListAsync(status, ownerFilter, ct));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var lead = await _read.GetAsync(id, ct);
        if (lead is null) return NotFound();

        // A thread someone is replying to must never be served stale.
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(lead);
    }

    // --- Moving the lead along -------------------------------------------------------

    public record StatusChange(string Status);

    [HttpPost("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] StatusChange body, CancellationToken ct)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { errors = new[] { "A status is required." } });

        if (!LeadStatuses.IsValid(body.Status))
            return BadRequest(new { errors = new[] { $"'{body.Status}' is not one of the pipeline stages." } });

        var ok = await _leads.SetStatusAsync(id, body.Status, CurrentUpn, ct);
        return ok ? Ok(new { ok = true, id, status = body.Status }) : NotFound();
    }

    public record OwnerChange(string? OwnerUpn);

    // Null clears the owner. An unassigned lead is a real state — it is the one nobody
    // has picked up — so "unassign" must be expressible.
    //
    // "me" resolves here rather than in the browser. The panel would otherwise have to
    // fetch its own UPN just to claim a lead, and a client-supplied identity is something
    // the server should never take at face value anyway.
    [HttpPost("{id:int}/owner")]
    public async Task<IActionResult> SetOwner(int id, [FromBody] OwnerChange body, CancellationToken ct)
    {
        var requested = body?.OwnerUpn;
        var owner = string.Equals(requested, "me", System.StringComparison.OrdinalIgnoreCase)
            ? CurrentUpn
            : requested;

        var ok = await _leads.SetOwnerAsync(id, owner, CurrentUpn, ct);
        return ok ? Ok(new { ok = true, id, ownerUpn = owner }) : NotFound();
    }

    public record FieldsChange(string? NextStep, string? Notes, string? ProjectName, string? BuildLocation, string? Country);

    [HttpPost("{id:int}/fields")]
    public async Task<IActionResult> SetFields(int id, [FromBody] FieldsChange body, CancellationToken ct)
    {
        if (body is null) return BadRequest(new { errors = new[] { "Nothing to update." } });

        var ok = await _leads.UpdateFieldsAsync(
            id, body.NextStep, body.Notes, body.ProjectName, body.BuildLocation, body.Country, ct);

        return ok ? Ok(new { ok = true, id }) : NotFound();
    }

    // --- The thread ------------------------------------------------------------------

    public record NewActivity(string Type, string? Subject, string Body, string? OccurredAt);

    // Logging a call, a meeting or a note. Sending email is a different endpoint, because
    // it has side effects outside the database and must not look like a local write.
    [HttpPost("{id:int}/activities")]
    public async Task<IActionResult> AddActivity(int id, [FromBody] NewActivity body, CancellationToken ct)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Body))
            return BadRequest(new { errors = new[] { "The entry cannot be empty." } });

        // Only the types a person may file by hand. A status row written this way would
        // put a claim in the history that the Status column does not back up.
        if (!LeadActivityTypes.IsManuallyLoggable(body.Type))
            return BadRequest(new { errors = new[] { $"'{body.Type}' cannot be logged by hand." } });

        System.DateTimeOffset? occurred = null;
        if (!string.IsNullOrWhiteSpace(body.OccurredAt)
            && System.DateTimeOffset.TryParse(body.OccurredAt, out var parsed))
        {
            occurred = parsed;
        }

        var activity = await _leads.AddActivityAsync(
            id, body.Type, body.Subject, body.Body, CurrentUpn, occurred, ct: ct);

        return activity is null ? NotFound() : Ok(new { ok = true, id = activity.Id });
    }

    // --- Replying --------------------------------------------------------------------

    public record ReplyRequest(string? Subject, string Body);

    // Sends from the shared mailbox and writes the message into the thread. Separate from
    // the activities endpoint on purpose: this one has effects outside the database and
    // must not look like a local write that can simply be retried.
    [HttpPost("{id:int}/reply")]
    public async Task<IActionResult> Reply(int id, [FromBody] ReplyRequest body, CancellationToken ct)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Body))
            return BadRequest(new { errors = new[] { "The reply cannot be empty." } });

        var result = await _mail.SendReplyAsync(id, body.Subject, body.Body, CurrentUpn, ct);

        return result.Outcome switch
        {
            LeadMailService.SendOutcome.Sent => Ok(new { ok = true, activityId = result.ActivityId }),
            LeadMailService.SendOutcome.LeadNotFound => NotFound(),

            // A lead with no address is the operator's problem to solve, not a server
            // fault — 400 with the reason, so the panel can say "reply by phone".
            LeadMailService.SendOutcome.NoAddress => BadRequest(new { errors = new[] { result.Error } }),

            LeadMailService.SendOutcome.NotConfigured =>
                StatusCode(503, new { errors = new[] { result.Error } }),

            _ => StatusCode(502, new { errors = new[] { result.Error } }),
        };
    }

    // --- Drafting --------------------------------------------------------------------

    public record DraftRequest(string? Instruction);

    // Returns text for a person to edit. Nothing is stored and nothing is sent — a draft
    // only becomes part of the record if someone sends it.
    [HttpPost("{id:int}/draft")]
    public async Task<IActionResult> Draft(int id, [FromBody] DraftRequest? body, CancellationToken ct)
    {
        var result = await _drafts.DraftReplyAsync(id, body?.Instruction, ct);

        return result.Outcome switch
        {
            LeadDraftService.DraftOutcome.Ok => Ok(new { ok = true, text = result.Text }),
            LeadDraftService.DraftOutcome.LeadNotFound => NotFound(),

            // 503 rather than 500: the feature is switched off, not broken, and the panel
            // should say so rather than offer a retry that cannot succeed.
            LeadDraftService.DraftOutcome.NotConfigured =>
                StatusCode(503, new { errors = new[] { result.Error } }),

            _ => StatusCode(502, new { errors = new[] { result.Error } }),
        };
    }
}
