using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Services;

namespace Controllers;

// Uploading and downloading the files attached to a lead conversation.
//
// Split out from AdminPipelineController because everything here is multipart or a binary
// stream rather than JSON, and because the security rules are specific enough to be worth
// reading in one place: private container, authenticated download only, allow-listed
// types, and never served inline.
[ApiController]
[Route("api/admin/pipeline")]
[Authorize(Policy = "AdminOnly")]
public class AdminPipelineFilesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LeadFileStore _files;
    private readonly LeadService _leads;

    public AdminPipelineFilesController(AppDbContext db, LeadFileStore files, LeadService leads)
    {
        _db = db;
        _files = files;
        _leads = leads;
    }

    private string? CurrentUpn =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    /// <summary>
    /// Attaches a file to a lead, as a note in the thread carrying it.
    ///
    /// An attachment always arrives with an activity, because a file on its own loses most
    /// of its meaning — "here is the survey" and the survey belong together.
    /// </summary>
    [HttpPost("{leadId:int}/attachments")]
    [RequestSizeLimit(LeadFileStore.MaxBytes + (1024 * 1024))]   // headroom for the multipart envelope
    public async Task<IActionResult> Upload(int leadId, IFormFile file, [FromForm] string? caption, CancellationToken ct)
    {
        if (!_files.IsConfigured)
            return StatusCode(503, new { errors = new[] { "File storage is not configured." } });

        if (file is null || file.Length == 0)
            return BadRequest(new { errors = new[] { "No file was uploaded." } });

        if (file.Length > LeadFileStore.MaxBytes)
            return BadRequest(new { errors = new[] { $"Files must be under {LeadFileStore.MaxBytes / (1024 * 1024)} MB." } });

        // The browser's filename is the only thing we trust it for, and only as a label —
        // strip any path it carries so a crafted name cannot influence anything downstream.
        var fileName = System.IO.Path.GetFileName(file.FileName ?? "");
        if (string.IsNullOrWhiteSpace(fileName))
            return BadRequest(new { errors = new[] { "The file has no name." } });

        // Allow-list by extension. The browser-supplied content type is ignored entirely:
        // it is trivially spoofed and tells us nothing we should act on.
        if (!LeadFileStore.IsAllowed(fileName, out var contentType))
            return BadRequest(new { errors = new[] { $"'{System.IO.Path.GetExtension(fileName)}' files are not accepted." } });

        var lead = await _db.Leads.AsNoTracking().FirstOrDefaultAsync(l => l.Id == leadId, ct);
        if (lead is null) return NotFound();

        var key = LeadFileStore.MintKey(leadId, fileName);

        // Blob first, row second. A row pointing at an object that failed to upload shows
        // sales a file nobody can open; an orphaned blob costs a few kilobytes and is
        // invisible. Cheap failure over confusing failure.
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

    /// <summary>
    /// Streams one attachment back, by row id.
    ///
    /// Addressed by ROW ID, never by blob key. The key never reaches the browser, so a
    /// customer's file cannot be found by guessing a path, and access is decided here —
    /// behind AdminOnly — rather than by whoever happens to hold a URL.
    /// </summary>
    [HttpGet("attachments/{id:int}")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        if (!_files.IsConfigured) return NotFound();

        var attachment = await _db.LeadAttachments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, ct);

        if (attachment is null) return NotFound();

        var opened = await _files.TryOpenAsync(attachment.BlobKey, ct);
        if (opened is null) return NotFound();

        // nosniff plus an attachment disposition. Without both, an uploaded .html or .svg
        // would render in the panel's own origin, and a file a customer emailed us becomes
        // script running against an authenticated admin session.
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "no-store";

        return File(opened.Value.Content, opened.Value.ContentType, attachment.FileName);
    }

    /// <summary>
    /// Removes an attachment from the thread.
    ///
    /// Drops the row and leaves the bytes, matching GalleryAdminService. Deleting objects
    /// on a row delete makes the operation unrecoverable and hard to reason about when the
    /// same bytes were ever referenced twice; storage is cheap and a stray blob is not a
    /// correctness problem.
    /// </summary>
    [HttpDelete("attachments/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var attachment = await _db.LeadAttachments.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (attachment is null) return NotFound();

        _db.LeadAttachments.Remove(attachment);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
