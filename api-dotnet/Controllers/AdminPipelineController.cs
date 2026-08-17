using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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
    private readonly LeadFollowUpService _followUps;

    public AdminPipelineController(
        LeadPipelineService read, LeadService leads, LeadDraftService drafts,
        LeadMailService mail, LeadFollowUpService followUps)
    {
        _read = read;
        _leads = leads;
        _drafts = drafts;
        _mail = mail;
        _followUps = followUps;
    }

    // The signed-in salesperson, as the UPN everything here records them by. Matches the
    // claim the AdminOnly policy checks, so ownership and the allow-list can never
    // disagree about who someone is.
    private string? CurrentUpn =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status, [FromQuery] string? owner, [FromQuery] bool due, CancellationToken ct)
    {
        // "mine" saves the panel from having to know its own user's UPN to filter by it.
        var ownerFilter = string.Equals(owner, "mine", System.StringComparison.OrdinalIgnoreCase)
            ? CurrentUpn
            : owner;

        Response.Headers["Cache-Control"] = "no-store";

        // due=true is a different question from any status filter — "who did we promise to
        // contact by now?" — so it takes over rather than combining. Combining it with a
        // stage would produce a report that is quietly incomplete.
        return Ok(due
            ? await _read.ListDueAsync(System.DateTimeOffset.UtcNow, ownerFilter, ct)
            : await _read.ListAsync(status, ownerFilter, ct));
    }

    public record ReportRequest(string? To);

    /// <summary>
    /// Emails the overdue follow-up list, with every lead in it linking back here.
    ///
    /// Recipients come from the request, not from configuration: the person pressing the
    /// button decides who reads it, and defaulting to the whole sales list would make a
    /// stray click mail three colleagues. The panel prefills their own address.
    /// </summary>
    [HttpPost("due/report")]
    public async Task<IActionResult> SendDueReport([FromBody] ReportRequest? body, CancellationToken ct)
    {
        var recipients = string.IsNullOrWhiteSpace(body?.To)
            ? _followUps.DefaultRecipients(CurrentUpn)
            : EmailService.ParseRecipients(body!.To);

        // The panel's own origin, so a link in the mail lands back on the host the person
        // is actually signed in to rather than one written down in a setting months ago.
        var baseUrl = $"{Request.Scheme}://{Request.Host}";

        var result = await _followUps.SendDueReportAsync(recipients, baseUrl, CurrentUpn, ct);

        return result.Outcome switch
        {
            LeadFollowUpService.ReportOutcome.Sent =>
                Ok(new { ok = true, count = result.Count, recipients = result.Recipients }),

            // Not an error: there was genuinely nothing to send, and saying so is more
            // useful than an empty inbox item.
            LeadFollowUpService.ReportOutcome.NothingDue =>
                Ok(new { ok = true, count = 0, recipients = result.Recipients }),

            LeadFollowUpService.ReportOutcome.NoRecipients =>
                BadRequest(new { errors = new[] { result.Error } }),

            LeadFollowUpService.ReportOutcome.NotConfigured =>
                StatusCode(503, new { errors = new[] { result.Error } }),

            _ => StatusCode(502, new { errors = new[] { result.Error } }),
        };
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

    // --- Creating a deal --------------------------------------------------------------

    public record PromoteRequest(string Kind, int Id);

    /// <summary>
    /// Turns an enquiry from the queue into a deal with a conversation.
    ///
    /// This is the normal way a deal is born, and it is what the "Lead created" checkbox
    /// inherited from Quickbase always meant — the difference is that it now actually
    /// creates something instead of recording that someone did it by hand.
    /// </summary>
    [HttpPost("promote")]
    public async Task<IActionResult> Promote([FromBody] PromoteRequest body, CancellationToken ct)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Kind))
            return BadRequest(new { errors = new[] { "An enquiry is required." } });

        var result = await _leads.PromoteAsync(body.Kind, body.Id, CurrentUpn, ct);

        if (result.Outcome == LeadService.PromotionOutcome.NotFound) return NotFound();

        // AlreadyExisted is a success, not a conflict: the usual cause is a double click,
        // and the right answer is to hand back the deal that already exists so the panel
        // opens it rather than showing an error for something that worked.
        return Ok(new
        {
            ok = true,
            id = result.Lead!.Id,
            created = result.Outcome == LeadService.PromotionOutcome.Created,
        });
    }

    public record NewLead(
        string Name, string? Email, string? Phone, string? CustomModel, string? Country,
        string? Locale, string? NextContactAt);

    /// <summary>
    /// A deal with no website enquiry behind it — the phone call, the trade fair, the
    /// builder who already knows us. See Lead.OfferId for why that has to be possible.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] NewLead body, CancellationToken ct)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { errors = new[] { "A name is required." } });

        if (!LeadService.TryParseFollowUpDate(body.NextContactAt, out var nextContact))
            return BadRequest(new { errors = new[] { "That is not a date we can read." } });

        var lead = await _leads.CreateAsync(new Lead
        {
            NextContactAt = nextContact,
            Name = body.Name.Trim(),
            Email = string.IsNullOrWhiteSpace(body.Email) ? null : body.Email.Trim(),
            Phone = string.IsNullOrWhiteSpace(body.Phone) ? null : body.Phone.Trim(),
            CustomModel = string.IsNullOrWhiteSpace(body.CustomModel) ? null : body.CustomModel.Trim(),
            Country = string.IsNullOrWhiteSpace(body.Country) ? null : body.Country.Trim(),
            Locale = string.IsNullOrWhiteSpace(body.Locale) ? null : body.Locale.Trim(),

            // Whoever typed it in owns it. A cold-call lead with no owner would sit at the
            // top of the quietest-first board forever, which is the opposite of useful.
            OwnerUpn = CurrentUpn,
        }, ct);

        return Ok(new { ok = true, id = lead.Id });
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

    public record FieldsChange(
        string? NextStep, string? Notes, string? ProjectName, string? BuildLocation,
        string? CustomerAddress, string? Country, string? NextContactAt,
        string? CategoryKey, int? HouseId, string? CustomModel);

    [HttpPost("{id:int}/fields")]
    public async Task<IActionResult> SetFields(int id, [FromBody] FieldsChange body, CancellationToken ct)
    {
        if (body is null) return BadRequest(new { errors = new[] { "Nothing to update." } });

        // Refused here rather than absorbed. A date the server cannot read would otherwise
        // save as "no follow-up", and the lead would silently drop out of the one report
        // that exists to catch it.
        if (!LeadService.TryParseFollowUpDate(body.NextContactAt, out _))
            return BadRequest(new { errors = new[] { "That is not a date we can read." } });

        // 0 is how a cleared <select> arrives, and it is not a house id. Treated as "no
        // model" rather than passed through to fail a foreign key.
        var clearHouse = body.HouseId is 0;
        var houseId = body.HouseId is > 0 ? body.HouseId : null;

        if (houseId is not null && !await _leads.HouseExistsAsync(houseId.Value, ct))
            return BadRequest(new { errors = new[] { "That model is not in the catalogue." } });

        var ok = await _leads.UpdateFieldsAsync(
            id, body.NextStep, body.Notes, body.ProjectName, body.BuildLocation,
            body.CustomerAddress, body.Country, body.NextContactAt,
            body.CategoryKey, houseId, clearHouse, body.CustomModel, ct);

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

    // Sends from the shared mailbox and writes the message into the thread. Separate from
    // the activities endpoint on purpose: this one has effects outside the database and
    // must not look like a local write that can simply be retried.
    //
    // Form-encoded rather than JSON, because a reply can carry files and a reply that
    // carries files must be ONE request. Uploading first and sending second would leave a
    // file in the thread whenever the send then failed — an attachment sales believes the
    // customer has and the customer has never seen.
    [HttpPost("{id:int}/reply")]
    [RequestSizeLimit((LeadFileStore.MaxEmailBytes * 2) + (1024 * 1024))]
    public async Task<IActionResult> Reply(
        int id,
        [FromForm] string? subject,
        [FromForm] string? body,
        [FromForm] List<IFormFile>? files,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body))
            return BadRequest(new { errors = new[] { "The reply cannot be empty." } });

        var picked = files ?? new List<IFormFile>();

        var errors = ValidateAttachments(picked);
        if (errors.Count > 0) return BadRequest(new { errors });

        var attachments = new List<LeadMailService.OutgoingFile>();
        foreach (var file in picked)
        {
            if (file.Length == 0) continue;

            var fileName = System.IO.Path.GetFileName(file.FileName);
            LeadFileStore.IsAllowed(fileName, out var contentType);

            using var stream = new System.IO.MemoryStream();
            await file.CopyToAsync(stream, ct);
            attachments.Add(new LeadMailService.OutgoingFile(fileName, contentType, stream.ToArray()));
        }

        var result = await _mail.SendReplyAsync(id, subject, body, CurrentUpn, attachments, ct);

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

    /// <summary>
    /// Everything wrong with the files on a reply, checked BEFORE anything is sent.
    ///
    /// Order matters here: an oversized file discovered by Graph mid-send costs the reply
    /// someone typed as well as the attachment, because there is no draft left to go back
    /// to. Refusing up front turns that into a sentence they can act on.
    /// </summary>
    private static List<string> ValidateAttachments(IEnumerable<IFormFile> files)
    {
        var errors = new List<string>();
        long total = 0;

        foreach (var file in files)
        {
            if (file.Length == 0) continue;

            // Path components stripped: the browser chose this string, and it is a label
            // rather than a location.
            var fileName = System.IO.Path.GetFileName(file.FileName ?? "");
            if (string.IsNullOrWhiteSpace(fileName))
            {
                errors.Add("One of the files has no name.");
                continue;
            }

            // Allow-listed by extension, exactly as on the upload endpoint. The browser's
            // content type is ignored: it is trivially spoofed and tells us nothing.
            if (!LeadFileStore.IsAllowed(fileName, out _))
                errors.Add($"'{System.IO.Path.GetExtension(fileName)}' files are not accepted.");

            total += file.Length;
        }

        // The total, not just each file: four 2 MB drawings pass every per-file check and
        // still bounce off Graph's message size limit.
        if (total > LeadFileStore.MaxEmailBytes)
        {
            errors.Add(
                $"Files sent with a reply must total under {LeadFileStore.MaxEmailBytes / (1024 * 1024)} MB. " +
                "Attach bigger ones with a note instead, or send a link.");
        }

        return errors;
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
