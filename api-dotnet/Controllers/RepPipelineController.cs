using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Services;

namespace Controllers;

// The representative's panel (#38): the pipeline, cut down to the leads the caller owns.
//
// A representative is not staff. He hands out a link, the enquiries it brings become leads
// owned by him (RepresentativeIntake), and this is where he works them — and NOTHING else:
// no other owner's leads, no enquiry queue, no customers, no promoting, no reassigning. So
// every endpoint here answers one question before its real one — "is this the caller's
// lead?" — and answers NO with a 404, never a 403. A 403 would confirm that the id exists,
// ids are sequential, and "how many leads does the company have" is not his to learn.
//
// Deliberately the same request and response shapes as AdminPipelineController, down to
// reusing its record types, so the SPA's pipeline page runs against either route. Equally
// deliberately NOT the same controller with a flag: the admin route's reach is the whole
// table, and a scope check that could be forgotten on one action is worse than two files.
// What is shared is the rules (PipelineRules) and the services; the scoping is here, once
// per action, in plain sight.
//
// The ActorUpn on every write is the caller's own claim, exactly as the admin controller
// and HttpCurrentActor record it, so the audit log and the thread name him the same way.
[ApiController]
[Route("api/rep/pipeline")]
[Authorize(Policy = RepresentativePolicy.Name)]
public class RepPipelineController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LeadPipelineService _read;
    private readonly LeadService _leads;
    private readonly LeadDraftService _drafts;
    private readonly LeadMailService _mail;
    private readonly LeadFileStore _files;
    private readonly EnvConfig _env;

    public RepPipelineController(
        AppDbContext db, LeadPipelineService read, LeadService leads, LeadDraftService drafts,
        LeadMailService mail, LeadFileStore files, EnvConfig env)
    {
        _db = db;
        _read = read;
        _leads = leads;
        _drafts = drafts;
        _mail = mail;
        _files = files;
        _env = env;
    }

    // Where THIS panel downloads an attachment from. The lead detail links here rather than
    // at the admin route, which would answer a representative 403 — and the download below
    // performs the ownership check the admin route has no reason to.
    public const string AttachmentsPath = "/api/rep/pipeline/attachments";

    // The claim, read the same way as everywhere else (see HttpCurrentActor): what every
    // write here is attributed to.
    private string? CurrentUpn =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    // The caller as the registry spells them — lower-cased, which is the spelling the intake
    // wrote into Lead.OwnerUpn, and so the one the board filters on. Null cannot happen
    // behind the policy, which made this same lookup to let the request in; the Forbid in
    // List is the belt to that brace.
    private EnvConfig.Representative? Caller => _env.FindRepresentativeByUpn(CurrentUpn);

    // Whether lead {id} is the caller's. One cheap read (LeadService.OwnerOfAsync), and "no
    // such lead", "nobody's lead" and "somebody else's lead" are the same answer on purpose.
    private async Task<bool> OwnsAsync(int leadId, CancellationToken ct)
    {
        if (Caller is not { } caller) return false;

        var (exists, owner) = await _leads.OwnerOfAsync(leadId, ct);
        return exists && owner is not null && string.Equals(owner, caller.Upn, StringComparison.OrdinalIgnoreCase);
    }

    // An attachment hangs off a thread entry, which hangs off the lead (see LeadAttachment
    // for why it is not on the lead directly), so ownership is two hops away.
    private async Task<bool> OwnsAttachmentAsync(int attachmentId, CancellationToken ct)
    {
        var leadId = await (
            from file in _db.LeadAttachments.AsNoTracking()
            join entry in _db.LeadActivities.AsNoTracking() on file.LeadActivityId equals entry.Id
            where file.Id == attachmentId
            select (int?)entry.LeadId).FirstOrDefaultAsync(ct);

        return leadId is { } id && await OwnsAsync(id, ct);
    }

    // Lets the SPA show who is signed in and which panel this is, as /api/admin/me does for
    // the admin shell. The role is what the shell keys its chrome on.
    [HttpGet("/api/rep/me")]
    public IActionResult Me() => Ok(new
    {
        name = User.Identity?.Name ?? "",
        email = User.FindFirst("preferred_username")?.Value ?? "",
        role = "representative",
    });

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] bool due, CancellationToken ct)
    {
        // No owner parameter, and none is read off the query string: the filter is the
        // caller, always. An ?owner= on the URL is simply not looked at.
        if (Caller is not { } caller) return Forbid();

        Response.Headers["Cache-Control"] = "no-store";

        // due=true takes over rather than combining, exactly as on the admin board.
        return Ok(due
            ? await _read.ListDueAsync(DateTimeOffset.UtcNow, caller.Upn, ct)
            : await _read.ListAsync(status, caller.Upn, ct));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        if (!await OwnsAsync(id, ct)) return NotFound();

        var lead = await _read.GetAsync(id, AttachmentsPath, ct);
        if (lead is null) return NotFound();

        Response.Headers["Cache-Control"] = "no-store";
        return Ok(lead);
    }

    // --- Moving the lead along -------------------------------------------------------
    //
    // No owner endpoint and no convert: who owns the lead is the one thing a representative
    // must not be able to change, and making a customer is sales' decision.

    [HttpPost("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] AdminPipelineController.StatusChange body, CancellationToken ct)
    {
        if (!await OwnsAsync(id, ct)) return NotFound();

        if (body is null || string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { errors = new[] { "A status is required." } });

        if (!LeadStatuses.IsValid(body.Status))
            return BadRequest(new { errors = new[] { $"'{body.Status}' is not one of the pipeline stages." } });

        var ok = await _leads.SetStatusAsync(id, body.Status, CurrentUpn, ct);
        return ok ? Ok(new { ok = true, id, status = body.Status }) : NotFound();
    }

    [HttpPost("{id:int}/fields")]
    public async Task<IActionResult> SetFields(int id, [FromBody] AdminPipelineController.FieldsChange body, CancellationToken ct)
    {
        if (!await OwnsAsync(id, ct)) return NotFound();

        if (body is null) return BadRequest(new { errors = new[] { "Nothing to update." } });

        // The same rules, in the same order, as the admin's SetFields; see that method and
        // PipelineRules.ValidateContact for why each is where it is.
        var errors = PipelineRules.ValidateContact(body, await _leads.StoredEmailAsync(id, ct));
        if (errors.Count > 0) return BadRequest(new { errors });

        if (!LeadService.TryParseFollowUpDate(body.NextContactAt, out _))
            return BadRequest(new { errors = new[] { "That is not a date we can read." } });

        var clearHouse = body.HouseId is 0;
        var houseId = body.HouseId is > 0 ? body.HouseId : null;

        if (houseId is not null && !await _leads.HouseExistsAsync(houseId.Value, ct))
            return BadRequest(new { errors = new[] { "That model is not in the catalogue." } });

        var ok = await _leads.UpdateFieldsAsync(
            id, body.NextStep, body.Notes, body.ProjectName, body.BuildLocation,
            body.CustomerAddress, body.Country, body.NextContactAt,
            body.CategoryKey, houseId, clearHouse, body.CustomModel,
            body.Name, body.Email, body.Phone, ct);

        return ok ? Ok(new { ok = true, id }) : NotFound();
    }

    // --- The thread ------------------------------------------------------------------

    [HttpPost("{id:int}/activities")]
    public async Task<IActionResult> AddActivity(int id, [FromBody] AdminPipelineController.NewActivity body, CancellationToken ct)
    {
        if (!await OwnsAsync(id, ct)) return NotFound();

        if (body is null || string.IsNullOrWhiteSpace(body.Body))
            return BadRequest(new { errors = new[] { "The entry cannot be empty." } });

        if (!LeadActivityTypes.IsManuallyLoggable(body.Type))
            return BadRequest(new { errors = new[] { $"'{body.Type}' cannot be logged by hand." } });

        var activity = await _leads.AddActivityAsync(
            id, body.Type, body.Subject, body.Body, CurrentUpn, PipelineRules.ParseOccurredAt(body.OccurredAt), ct: ct);

        return activity is null ? NotFound() : Ok(new { ok = true, id = activity.Id });
    }

    // --- Replying --------------------------------------------------------------------

    // Same contract and the same limits as the admin's Reply, and the mail still goes out
    // from the shared mailbox — see LeadMailService for why never from the person's own.
    [HttpPost("{id:int}/reply")]
    [RequestSizeLimit((LeadFileStore.MaxEmailBytes * 2) + (1024 * 1024))]
    public async Task<IActionResult> Reply(
        int id,
        [FromForm] string? subject,
        [FromForm] string? body,
        [FromForm] string? cc,
        [FromForm] List<IFormFile>? files,
        CancellationToken ct)
    {
        if (!await OwnsAsync(id, ct)) return NotFound();

        if (string.IsNullOrWhiteSpace(body))
            return BadRequest(new { errors = new[] { "The reply cannot be empty." } });

        var ccRecipients = PipelineRules.SplitCc(cc);
        var errors = PipelineRules.ValidateCc(ccRecipients);
        if (errors.Count > 0) return BadRequest(new { errors });

        var picked = files ?? new List<IFormFile>();

        errors = PipelineRules.ValidateAttachments(picked);
        if (errors.Count > 0) return BadRequest(new { errors });

        var attachments = await PipelineRules.ReadAttachmentsAsync(picked, ct);

        var result = await _mail.SendReplyAsync(id, subject, body, CurrentUpn, attachments, ccRecipients, ct);

        return result.Outcome switch
        {
            LeadMailService.SendOutcome.Sent => Ok(new { ok = true, activityId = result.ActivityId }),

            LeadMailService.SendOutcome.SentNotRecorded =>
                Ok(new { ok = true, activityId = (int?)null, sentNotRecorded = true, warning = result.Error }),

            LeadMailService.SendOutcome.LeadNotFound => NotFound(),

            LeadMailService.SendOutcome.NoAddress => BadRequest(new { errors = new[] { result.Error } }),

            LeadMailService.SendOutcome.NotConfigured =>
                StatusCode(503, new { errors = new[] { result.Error } }),

            _ => StatusCode(502, new { errors = new[] { result.Error } }),
        };
    }

    // --- Drafting --------------------------------------------------------------------

    [HttpPost("{id:int}/draft")]
    public async Task<IActionResult> Draft(int id, [FromBody] AdminPipelineController.DraftRequest? body, CancellationToken ct)
    {
        if (!await OwnsAsync(id, ct)) return NotFound();

        var result = await _drafts.DraftReplyAsync(id, body?.Instruction, ct);

        return result.Outcome switch
        {
            LeadDraftService.DraftOutcome.Ok => Ok(new { ok = true, text = result.Text }),
            LeadDraftService.DraftOutcome.LeadNotFound => NotFound(),

            LeadDraftService.DraftOutcome.NotConfigured =>
                StatusCode(503, new { errors = new[] { result.Error } }),

            _ => StatusCode(502, new { errors = new[] { result.Error } }),
        };
    }

    // --- Files -----------------------------------------------------------------------
    //
    // The same three operations as AdminPipelineFilesController, with the ownership check
    // in front of each. The write sequence is repeated rather than shared because it is
    // the one place "blob first, row second" is decided, and that file explains why.

    [HttpPost("{leadId:int}/attachments")]
    [RequestSizeLimit(LeadFileStore.MaxBytes + (1024 * 1024))]   // headroom for the multipart envelope
    public async Task<IActionResult> Upload(int leadId, IFormFile file, [FromForm] string? caption, CancellationToken ct)
    {
        if (!await OwnsAsync(leadId, ct)) return NotFound();

        if (!_files.IsConfigured)
            return StatusCode(503, new { errors = new[] { "File storage is not configured." } });

        if (PipelineRules.UploadRefusal(file, out var fileName, out var contentType) is { } refusal)
            return BadRequest(new { errors = new[] { refusal } });

        var key = LeadFileStore.MintKey(leadId, fileName);

        // Blob first, row second — see AdminPipelineFilesController.Upload.
        await using (var stream = file.OpenReadStream())
        {
            await _files.UploadAsync(key, stream, contentType, ct);
        }

        var body = string.IsNullOrWhiteSpace(caption) ? fileName : caption!.Trim();
        var activity = await _leads.AddActivityAsync(
            leadId, LeadActivityTypes.Note, null, body, CurrentUpn, ct: ct);

        if (activity is null) return NotFound();

        _db.LeadAttachments.Add(new LeadAttachment
        {
            LeadActivityId = activity.Id,
            FileName = fileName,
            BlobKey = key,
            ContentType = contentType,
            SizeBytes = file.Length,
            UploadedByUpn = CurrentUpn,
        });
        await _db.SaveChangesAsync(ct);

        return Ok(new { ok = true, activityId = activity.Id, fileName });
    }

    [HttpGet("attachments/{id:int}")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        // Ownership before configuration: the answer to somebody else's file is the same
        // 404 whether or not storage is wired up, so nothing about the file is learned.
        if (!await OwnsAttachmentAsync(id, ct)) return NotFound();

        if (!_files.IsConfigured) return NotFound();

        var attachment = await _db.LeadAttachments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, ct);

        if (attachment is null) return NotFound();

        var opened = await _files.TryOpenAsync(attachment.BlobKey, ct);
        if (opened is null) return NotFound();

        // nosniff plus an attachment disposition, for the same reason as the admin route:
        // an uploaded .html must never render in this origin.
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "no-store";

        return File(opened.Value.Content, opened.Value.ContentType, attachment.FileName);
    }

    [HttpDelete("attachments/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!await OwnsAttachmentAsync(id, ct)) return NotFound();

        var attachment = await _db.LeadAttachments.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (attachment is null) return NotFound();

        // Drops the row and leaves the bytes, matching the admin route and GalleryAdminService.
        _db.LeadAttachments.Remove(attachment);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
