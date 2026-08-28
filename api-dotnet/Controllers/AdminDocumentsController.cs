using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The brochure screen's API (ROADMAP #16): six slugs, three language slots each, and
// Replace as the only verb that matters. Everything dangerous the first design allowed —
// retiring a slug the site links, deleting it, renaming it — is refused HERE rather than
// merely not offered, because a rule that lives only in the panel is one rebuild away
// from disappearing.
//
// Same protection as the rest of the panel. The documents themselves are public marketing,
// but the ability to swap what the public site serves is exactly as sensitive as editing
// the gallery.
[ApiController]
[Route("api/admin/documents")]
[Authorize(Policy = "AdminOnly")]
public class AdminDocumentsController : ControllerBase
{
    private readonly PublicDocumentService _svc;
    private readonly PublicDocumentStore _store;

    public AdminDocumentsController(PublicDocumentService svc, PublicDocumentStore store)
    {
        _svc = svc;
        _store = store;
    }

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    // The wired list and the language list ride along so the panel can draw all six rows
    // with their empty slots BEFORE any row exists — a screen that only shows what has
    // been uploaded cannot show where an upload belongs.
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(new
        {
            documents = await _svc.ListAsync(ct),
            wired = PublicDocumentSlugs.Wired,
            langs = PublicDocumentSlugs.Langs,
        });
    }

    /// <summary>
    /// The one button: upload this file as the {lang} edition of {slug}. Creates the row
    /// when the slot was empty (the owner uploading the Greek translation), repoints it
    /// when it was not (a new season's catalogue). The public URL never moves either way.
    /// </summary>
    [HttpPost("{slug}/{lang}/file")]
    [RequestSizeLimit(PublicDocumentStore.MaxBytes + (1024 * 1024))]   // headroom for the multipart envelope
    public async Task<IActionResult> Upload(string slug, string lang, IFormFile file, CancellationToken ct)
    {
        if (!_store.IsConfigured)
            return StatusCode(503, new { errors = new[] { "File storage is not configured." } });

        if (file is null || file.Length == 0)
            return BadRequest(new { errors = new[] { "No file was uploaded." } });

        if (file.Length > PublicDocumentStore.MaxBytes)
            return BadRequest(new { errors = new[] {
                $"Files must be under {PublicDocumentStore.MaxBytes / (1024 * 1024)} MB. " +
                "Large catalogue exports need the compression step first — see the catalogue README." } });

        // A brochure is a PDF; the extension is the only thing the browser said that we
        // check, and the content type it claimed is ignored entirely.
        var fileName = System.IO.Path.GetFileName(file.FileName ?? "");
        if (string.IsNullOrWhiteSpace(fileName))
            return BadRequest(new { errors = new[] { "The file has no name." } });
        if (!fileName.EndsWith(".pdf", System.StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { errors = new[] { "Brochures are PDF files." } });

        // Blob first, row second — same order as every upload here. A failure between the
        // two costs an orphaned blob nobody can reach; the other order shows the public
        // site a button that cannot deliver.
        var key = PublicDocumentStore.MintKey();
        await using (var stream = file.OpenReadStream())
        {
            await _store.UploadAsync(key, stream, ct);
        }

        var result = await _svc.RecordUploadAsync(slug, lang, key, fileName, file.Length, Actor(), ct);
        return result.Ok
            ? Ok(new { ok = true, slug, lang })
            : BadRequest(new { errors = new[] { result.Error } });
    }

    public record ActiveRequest(bool Active);

    [HttpPost("{slug}/{lang}/active")]
    public async Task<IActionResult> SetActive(string slug, string lang, [FromBody] ActiveRequest body, CancellationToken ct)
    {
        if (body is null) return BadRequest(new { errors = new[] { "Nothing to update." } });

        var result = await _svc.SetActiveAsync(slug, lang, body.Active, Actor(), ct);
        return result.Outcome switch
        {
            PublicDocumentService.Outcome.Ok => Ok(new { ok = true, slug, lang, active = body.Active }),
            PublicDocumentService.Outcome.NotFound => NotFound(),
            _ => BadRequest(new { errors = new[] { result.Error } }),
        };
    }

    [HttpDelete("{slug}/{lang}")]
    public async Task<IActionResult> Delete(string slug, string lang, CancellationToken ct)
    {
        var result = await _svc.DeleteAsync(slug, lang, ct);
        return result.Outcome switch
        {
            PublicDocumentService.Outcome.Ok => Ok(new { ok = true }),
            PublicDocumentService.Outcome.NotFound => NotFound(),
            _ => BadRequest(new { errors = new[] { result.Error } }),
        };
    }
}
