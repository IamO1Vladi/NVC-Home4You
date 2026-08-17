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

// People who have bought, what they bought, and the invoices for it.
//
// THE MOST SENSITIVE TABLE IN THE PANEL. Rows here carry ЕГН and ЕИК, home addresses and
// invoice PDFs. Three rules hold across every endpoint below and any that get added:
//
//   1. AdminOnly, and no anonymous read path — including for the files.
//   2. no-store on every response. A browser cache holding somebody's ЕГН on a shared
//      office machine is exactly the failure this table must not have.
//   3. An ЕГН is never a lookup key. Search matches name, phone, email and ЕИК and nothing
//      else, so a personal id cannot be used to find anybody — and the LIST response does
//      not carry one at all, only the detail record does.
//
//      Note what this does NOT claim: the search box sends whatever was typed as ?q=, so
//      somebody who types an ЕГН into it does put that string in a URL. What is guaranteed
//      is that it matches nothing, which is why the column is not worth typing there. Never
//      add PersonalId to the search predicate — a query string outlives the response in
//      logs and history, and that is the moment it would start being worth it.
[ApiController]
[Route("api/admin/customers")]
[Authorize(Policy = "AdminOnly")]
public class AdminCustomersController : ControllerBase
{
    private readonly CustomerAdminService _svc;
    private readonly AppDbContext _db;
    private readonly LeadFileStore _files;

    public AdminCustomersController(CustomerAdminService svc, AppDbContext db, LeadFileStore files)
    {
        _svc = svc;
        _db = db;
        _files = files;
    }

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    // --- Reading ----------------------------------------------------------------------

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(q, ct));
    }

    /// <summary>
    /// The vocabulary the customer form needs: what we sell, which of those come out of the
    /// catalogue, and which take a staged payment.
    ///
    /// Served rather than hard-coded in the SPA, matching AdminGalleryController.Categories.
    /// Two hand-maintained copies of a key list drift, and the failure is silent — a
    /// purchase filed under a category the server does not recognise.
    /// </summary>
    [HttpGet("categories")]
    public IActionResult Categories()
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(new
        {
            all = PurchaseCategories.All,
            withGalleryModels = PurchaseCategories.WithGalleryModels,
            stagedPayment = PurchaseCategories.All.Where(PurchaseCategories.TracksStagedPayment),
            types = CustomerTypes.All,
        });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var customer = await _svc.GetAsync(id, ct);
        return customer is null ? NotFound() : Ok(customer);
    }

    // --- Writing ----------------------------------------------------------------------

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CustomerInput input, CancellationToken ct)
    {
        var errors = await ValidateAsync(input, ct);
        if (errors.Count > 0) return BadRequest(new { errors });

        Response.Headers["Cache-Control"] = "no-store";

        // Checked BEFORE the insert, so the name reported is a genuinely pre-existing
        // customer rather than the one just created.
        var duplicate = await _svc.FindDuplicateAsync(input, null, ct);
        var created = await _svc.CreateAsync(input, Actor(), ct);

        return Ok(new { ok = true, customer = created, duplicateOf = duplicate });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CustomerInput input, CancellationToken ct)
    {
        var errors = await ValidateAsync(input, ct);
        if (errors.Count > 0) return BadRequest(new { errors });

        Response.Headers["Cache-Control"] = "no-store";

        var duplicate = await _svc.FindDuplicateAsync(input, id, ct);
        var updated = await _svc.UpdateAsync(id, input, Actor(), ct);

        return updated is null
            ? NotFound()
            : Ok(new { ok = true, customer = updated, duplicateOf = duplicate });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await _svc.DeleteAsync(id, ct) ? Ok(new { ok = true, id }) : NotFound();

    /// <summary>
    /// Everything wrong with a submission — the pure rules plus the two that need the
    /// database (does this factory exist, does this model exist).
    ///
    /// The existence checks are here rather than left to the foreign keys because a
    /// DbUpdateException reaches the panel as "something went wrong", and "that model is not
    /// in the catalogue" is a sentence somebody can act on.
    /// </summary>
    private async Task<List<string>> ValidateAsync(CustomerInput? input, CancellationToken ct)
    {
        var errors = CustomerAdminService.Validate(input);
        if (errors.Count > 0 || input is null) return errors;

        foreach (var purchase in input.Purchases ?? new List<PurchaseInput>())
        {
            if (purchase.HouseId is > 0 && !await _svc.HouseExistsAsync(purchase.HouseId.Value, ct))
                errors.Add("That model is not in the catalogue.");

            if (purchase.FactoryId is > 0 && !await _svc.FactoryExistsAsync(purchase.FactoryId.Value, ct))
                errors.Add("That factory is not in the list.");
        }

        return errors;
    }

    // --- Invoices and other documents -------------------------------------------------

    /// <summary>
    /// Attaches a document to a purchase — the proforma, the final invoice, a contract.
    ///
    /// Uploaded against a SAVED purchase, which is why the panel disables these controls on
    /// a row that has not been saved yet: a file needs something to belong to, and inventing
    /// a placeholder purchase to hold one would leave an empty row behind whenever the
    /// person changed their mind.
    /// </summary>
    [HttpPost("purchases/{purchaseId:int}/files")]
    [RequestSizeLimit(LeadFileStore.MaxBytes + (1024 * 1024))]   // headroom for the multipart envelope
    public async Task<IActionResult> UploadFile(
        int purchaseId, IFormFile file, [FromForm] string? kind, CancellationToken ct)
    {
        if (!_files.IsConfigured)
            return StatusCode(503, new { errors = new[] { "File storage is not configured." } });

        if (file is null || file.Length == 0)
            return BadRequest(new { errors = new[] { "No file was uploaded." } });

        if (file.Length > LeadFileStore.MaxBytes)
            return BadRequest(new { errors = new[] { $"Files must be under {LeadFileStore.MaxBytes / (1024 * 1024)} MB." } });

        if (!PurchaseFileKinds.IsValid(kind))
            return BadRequest(new { errors = new[] { "That is not a kind of document we file." } });

        // The browser's filename is a label, never a path — strip any directory it carries.
        var fileName = System.IO.Path.GetFileName(file.FileName ?? "");
        if (string.IsNullOrWhiteSpace(fileName))
            return BadRequest(new { errors = new[] { "The file has no name." } });

        // Allow-listed by extension. The browser-supplied content type is ignored entirely:
        // it is trivially spoofed and tells us nothing we should act on.
        if (!LeadFileStore.IsAllowed(fileName, out var contentType))
            return BadRequest(new { errors = new[] { $"'{System.IO.Path.GetExtension(fileName)}' files are not accepted." } });

        var purchase = await _db.Purchases.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == purchaseId, ct);
        if (purchase is null) return NotFound();

        // Keyed by CUSTOMER, not by purchase: the objects for one client stay together, which
        // is what makes a retention request answerable with a prefix rather than a join.
        var key = LeadFileStore.MintKey("customers", purchase.CustomerId, fileName);

        // Blob first, row second. A row pointing at an object that failed to upload shows an
        // invoice nobody can open; an orphaned blob costs a few kilobytes and is invisible.
        await using (var stream = file.OpenReadStream())
        {
            await _files.UploadAsync(key, stream, contentType, ct);
        }

        var row = new PurchaseFile
        {
            PurchaseId = purchaseId,
            Kind = kind!,
            FileName = fileName,
            BlobKey = key,
            ContentType = contentType,
            SizeBytes = file.Length,
            UploadedByUpn = Actor(),
        };

        _db.PurchaseFiles.Add(row);
        await _db.SaveChangesAsync(ct);

        Response.Headers["Cache-Control"] = "no-store";
        return Ok(new { ok = true, id = row.Id, fileName, kind });
    }

    /// <summary>
    /// Streams one document back, by row id.
    ///
    /// Addressed by ROW ID, never by blob key — the key never reaches the browser, so an
    /// invoice cannot be found by guessing a path, and access is decided here, behind
    /// AdminOnly, rather than by whoever happens to hold a URL.
    /// </summary>
    [HttpGet("files/{id:int}")]
    public async Task<IActionResult> DownloadFile(int id, CancellationToken ct)
    {
        if (!_files.IsConfigured) return NotFound();

        var row = await _db.PurchaseFiles.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id, ct);
        if (row is null) return NotFound();

        var opened = await _files.TryOpenAsync(row.BlobKey, ct);
        if (opened is null) return NotFound();

        // nosniff plus an attachment disposition. Without both, an uploaded .html or .svg
        // would render in the panel's own origin, and a document becomes script running
        // against an authenticated admin session.
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "no-store";

        return File(opened.Value.Content, opened.Value.ContentType, row.FileName);
    }

    /// <summary>
    /// Removes a document. Drops the row and leaves the bytes, matching every other delete
    /// in this codebase — storage is cheap, and a delete that reaches into object storage is
    /// the one that cannot be undone when it turns out to have been the wrong row.
    /// </summary>
    [HttpDelete("files/{id:int}")]
    public async Task<IActionResult> DeleteFile(int id, CancellationToken ct)
    {
        var row = await _db.PurchaseFiles.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (row is null) return NotFound();

        _db.PurchaseFiles.Remove(row);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
