using System.Collections.Generic;
using System.Linq;
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
    private readonly EnvConfig _env;
    private readonly CustomerAdminService _customers;

    public AdminPipelineController(
        LeadPipelineService read, LeadService leads, LeadDraftService drafts,
        LeadMailService mail, LeadFollowUpService followUps, EnvConfig env,
        CustomerAdminService customers)
    {
        _read = read;
        _leads = leads;
        _drafts = drafts;
        _mail = mail;
        _followUps = followUps;
        _env = env;
        _customers = customers;
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

    /// <summary>
    /// Who a lead can be assigned to. Backs the owner dropdown; see
    /// LeadPipelineService.ListAssignableAsync for what "assignable" means and why.
    /// </summary>
    [HttpGet("users")]
    public async Task<IActionResult> Users(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _read.ListAssignableAsync(_env.AdminAllowedUsers, CurrentUpn, ct));
    }

    public record ReportRequest(string? To, string? Owner);

    /// <summary>
    /// Emails the overdue follow-up list, with every lead in it linking back here.
    ///
    /// Recipients come from the request, not from configuration: the person pressing the
    /// button decides who reads it, and defaulting to the whole sales list would make a
    /// stray click mail three colleagues. The panel prefills their own address.
    ///
    /// Owner comes from the request for a different reason: the button sits in the toolbar
    /// beside the due tab's owner filter, and a report that ignored it would mail the whole
    /// team's list to somebody who had just narrowed the screen to one person and pressed
    /// Send to forward what they were reading. Absent is everyone, exactly as it is on the
    /// list endpoint this reports from.
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

        // "mine" resolves the same way it does on the list endpoint, so a link or a script
        // that says owner=mine cannot mean one thing on the board and another in the mail.
        var owner = string.Equals(body?.Owner, "mine", System.StringComparison.OrdinalIgnoreCase)
            ? CurrentUpn
            : body?.Owner;

        var result = await _followUps.SendDueReportAsync(recipients, baseUrl, CurrentUpn, owner, ct);

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

    /// <summary>
    /// Makes a customer out of this lead — identity only, no purchase. See
    /// CustomerAdminService.ConvertLeadAsync for the contract; the panel opens the
    /// customer's editor next, which is where the purchase gets added.
    /// </summary>
    [HttpPost("{id:int}/convert")]
    public async Task<IActionResult> Convert(int id, CancellationToken ct)
    {
        var result = await _customers.ConvertLeadAsync(id, CurrentUpn, ct);
        if (result is null) return NotFound();

        // Written into the thread only on a REAL conversion. The double-click that finds
        // the existing customer must not add a second "converted" line to the history.
        if (result.Created)
        {
            await _leads.AddActivityAsync(
                id, LeadActivityTypes.Note, null,
                $"Създаден клиент №{result.Customer.Id} / converted to customer #{result.Customer.Id}",
                CurrentUpn, ct: ct);
        }

        return Ok(new { ok = true, customerId = result.Customer.Id, created = result.Created });
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
        string? CategoryKey, int? HouseId, string? CustomModel,
        string? Name, string? Email, string? Phone);

    [HttpPost("{id:int}/fields")]
    public async Task<IActionResult> SetFields(int id, [FromBody] FieldsChange body, CancellationToken ct)
    {
        if (body is null) return BadRequest(new { errors = new[] { "Nothing to update." } });

        // Read before anything is judged, because one of the rules is about what CHANGED
        // rather than about what arrived. See ValidateContact and LeadService.StoredEmailAsync.
        var errors = ValidateContact(body, await _leads.StoredEmailAsync(id, ct));
        if (errors.Count > 0) return BadRequest(new { errors });

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
            body.CategoryKey, houseId, clearHouse, body.CustomModel,
            body.Name, body.Email, body.Phone, ct);

        return ok ? Ok(new { ok = true, id }) : NotFound();
    }

    /// <summary>
    /// Everything wrong with the customer's own details on a field edit.
    ///
    /// These three are here at all because a name or an address mistyped at enquiry time was
    /// previously uncorrectable: the offer behind the lead is an immutable event and must
    /// keep saying what the form said, so the lead row is the only place the correction can
    /// go, and this endpoint did not accept it.
    ///
    /// ABSENT AND EMPTY ARE DIFFERENT here, exactly as they are for every other field on
    /// this endpoint: null is "this save is not about that box, leave it alone", and a blank
    /// string is "clear it". Collapsing the two would make the panel wipe a phone number
    /// every time somebody saved a note from a form that does not carry one.
    ///
    /// The refusals are English, like every other one in the panel's API (see
    /// CustomerAdminService.Validate) — the SPA translates stable KEYS for stored values, and
    /// validation messages have always travelled as prose instead. Worth saying because these
    /// are the first refusals on this screen an ordinary working day will produce.
    /// </summary>
    /// <param name="storedEmail">
    /// What is in the column now. The panel resends every field on every save, so the email
    /// box arrives on a save that was about the follow-up date — and this column has never
    /// been validated on the way in (see LeadService.StoredEmailAsync). Comparing against it
    /// is what keeps a pre-existing bad address blocking an attempt to change it rather than
    /// every other edit on the row.
    /// </param>
    private static List<string> ValidateContact(FieldsChange body, string? storedEmail)
    {
        var errors = new List<string>();

        // Blank is a real edit for the other two and an impossible one for this: the column
        // is NOT NULL, and every list on the board is a column of names — a nameless row is
        // one nobody can find again to fix. So it is refused rather than stored or quietly
        // ignored, because a save that reports success and keeps the old name is how someone
        // walks away believing they renamed a lead.
        if (body.Name is not null && string.IsNullOrWhiteSpace(body.Name))
            errors.Add("A lead has to keep a name.");
        else if (body.Name is not null && body.Name.Trim().Length > 200)
            errors.Add("That name is too long.");

        // Only when there is something to check, and only when it is not what is already
        // there. Clearing an address is legitimate — plenty of leads arrive by phone with
        // nothing but a number — so an empty box means "no email", not "a malformed one";
        // and an untouched box means this save is not about the email at all, whatever
        // happens to be sitting in it.
        //
        // That second half is not defensive tidiness. The imported book is full of addresses
        // no parser accepts, the panel resends the box on every save, and without the
        // comparison the lead most likely to need a note or a follow-up date — an imported
        // one nobody has cleaned up — is the one lead on which nothing can be saved at all,
        // over a field the person never opened.
        var emailChanged = !string.Equals(
            (body.Email ?? "").Trim(), (storedEmail ?? "").Trim(), System.StringComparison.Ordinal);

        if (emailChanged && !string.IsNullOrWhiteSpace(body.Email))
        {
            // The same rule the config-email endpoint sends to; see EmailService for why it
            // is a parser and not a regex. Refused rather than stored, because an address
            // the mail transport will reject is one whose failure surfaces days later, in a
            // reply that never arrived.
            if (!EmailService.IsValidAddress(body.Email))
                errors.Add("That does not look like an email address.");
            else if (body.Email.Trim().Length > 320)
                errors.Add("That email address is too long.");
        }

        if (!string.IsNullOrWhiteSpace(body.Phone) && body.Phone.Trim().Length > 64)
            errors.Add("That phone number is too long.");

        return errors;
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
        [FromForm] string? cc,
        [FromForm] List<IFormFile>? files,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body))
            return BadRequest(new { errors = new[] { "The reply cannot be empty." } });

        // The CC box arrives raw, comma- or semicolon-separated, and is judged here in
        // full before a single attachment byte is read — the same front-loading as the
        // files below, and for the same reason: a bad address Graph rejects mid-send
        // costs the reply someone typed.
        var ccRecipients = SplitCc(cc);
        var errors = ValidateCc(ccRecipients);
        if (errors.Count > 0) return BadRequest(new { errors });

        var picked = files ?? new List<IFormFile>();

        errors = ValidateAttachments(picked);
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

        var result = await _mail.SendReplyAsync(id, subject, body, CurrentUpn, attachments, ccRecipients, ct);

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
    /// The CC box, split but NOT judged — every non-empty token survives, so that
    /// ValidateCc below gets to refuse the bad ones by name. ParseRecipients is not used
    /// here on purpose: its '@' filter would swallow exactly the token this box mistypes
    /// most — an address whose '@' became a dot — and the reply would go out with that
    /// person quietly missing, which is the very failure the strict rule exists to stop.
    /// </summary>
    private static List<string> SplitCc(string? raw) =>
        (raw ?? "")
            .Split(new[] { ',', ';' }, System.StringSplitOptions.RemoveEmptyEntries | System.StringSplitOptions.TrimEntries)
            // Case-insensitively, unlike ParseRecipients: capitals are not identity in an
            // address, and Arch@ и arch@ copied twice is the same person emailed twice.
            .Distinct(System.StringComparer.OrdinalIgnoreCase)
            .ToList();

    /// <summary>
    /// Everything wrong with the CC list on a reply, checked BEFORE anything is sent.
    ///
    /// STRICT where ParseRecipients is lax, and deliberately so: the due-report's "to" box
    /// mails a colleague who watches the result arrive, while a CC here is stored against
    /// the thread and sent alongside the customer's copy — a mistyped one is a bounce the
    /// customer may see and a record that names someone who was never told. So every token
    /// meets IsValidAddress, and the refusal names the token, because "one of your
    /// addresses is wrong" out of five is not a sentence anyone can act on.
    /// </summary>
    private static List<string> ValidateCc(IReadOnlyList<string> recipients)
    {
        var errors = new List<string>();

        foreach (var address in recipients)
        {
            if (!EmailService.IsValidAddress(address))
                errors.Add($"'{address}' does not look like an email address.");
        }

        // The joined list is what LeadActivity.CcRecipients stores, so its ceiling is the
        // column's — refused here as a sentence rather than surfacing as a 500 after the
        // mail has already gone out, which is the one order of events with no way back.
        if (string.Join(", ", recipients).Length > 500)
            errors.Add("That is too many CC addresses for one reply.");

        return errors;
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
