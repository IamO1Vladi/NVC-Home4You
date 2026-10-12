using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The home-page photo screen's API (2026-10): eleven fixed slots — the home page's eight and
// the three product pages' main photos — and for each one upload, pick from the gallery,
// clear, swap with a neighbour (hero and model slots only), or caption. The allow-list of names
// lives in HomeSlotNames and every verb refuses anything outside it HERE, not merely in the
// panel, because a rule that lives only in the panel is one rebuild away from disappearing.
//
// Same protection as the rest of the panel: the photos are public, but the ability to swap
// what the busiest page on the site shows is exactly as sensitive as editing the gallery.
//
// Blob first, row second, like every upload here. The storage half is optional in the
// constructor because BlobImageSource is registered only when Blob is configured; with SQL
// alone the list, pick, clear, swap and alt verbs still work and only the upload says 503.
[ApiController]
[Route("api/admin/home-photos")]
[Authorize(Policy = "AdminOnly")]
public class AdminHomePhotosController : ControllerBase
{
    // Same ceiling as the gallery: bigger than any sane photo, small enough that a mis-drop
    // cannot exhaust the app's memory. The processor downscales past this anyway.
    private const long MaxUploadBytes = 25L * 1024 * 1024;

    private readonly HomePhotoService _svc;
    private readonly ImageProcessor _processor;
    private readonly BlobImageSource? _blob;

    public AdminHomePhotosController(HomePhotoService svc, ImageProcessor processor, BlobImageSource? blob = null)
    {
        _svc = svc;
        _processor = processor;
        _blob = blob;
    }

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    // The allow-list rides along so the panel can draw every slot BEFORE any row
    // exists — a screen that only shows what has been uploaded cannot show where an upload
    // belongs. The list itself already carries one entry per name for the same reason.
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(new
        {
            slots = await _svc.ListAdminAsync(ct),
            names = HomeSlotNames.All,
        });
    }

    /// <summary>
    /// Upload a fresh photo into {name}. Converted to WebP, stored under a NEW home/ key
    /// (the /api/img route is immutable for a year, so replacing bytes must never reuse a
    /// key), then the row is pointed at it.
    /// </summary>
    [HttpPost("{name}/file")]
    [RequestSizeLimit(MaxUploadBytes + (1024 * 1024))]   // headroom for the multipart envelope
    public async Task<IActionResult> Upload(string name, IFormFile file, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        if (!HomeSlotNames.IsValid(name)) return NotFound();

        if (_blob is null)
            return StatusCode(503, new { errors = new[] { "Image storage is not configured." } });

        if (file is null || file.Length == 0)
            return BadRequest(new { errors = new[] { "No file was uploaded." } });

        if (file.Length > MaxUploadBytes)
            return BadRequest(new { errors = new[] { "That file is too large (max 25 MB)." } });

        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);

        // Rejected rather than stored as-is: an upload that will not decode is not an image,
        // and storing it would put a broken picture on the home page.
        var processed = _processor.TryProcess(buffer.ToArray());
        if (processed is null)
            return BadRequest(new { errors = new[] { "That file could not be read as an image." } });

        // Blob first, row second. A failure between the two costs an orphaned blob nobody
        // can reach; the other order shows the public page a photo that cannot load.
        var key = ImageKey.NewOwnedKey(ImageKey.HomeScope, HomeSlotNames.IndexOf(name), file.FileName, processed.Extension);
        await _blob.UploadAsync(key, processed.Bytes, processed.ContentType, ct);

        var result = await _svc.RecordImageAsync(name, key, alt: null, Actor(), ct);
        return ToResponse(result);
    }

    public record PickRequest(string? ImageKey);

    /// <summary>Point {name} at a photo the site already has, by its image key.</summary>
    [HttpPost("{name}/pick")]
    public async Task<IActionResult> Pick(string name, [FromBody] PickRequest body, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        if (!HomeSlotNames.IsValid(name)) return NotFound();
        if (body is null) return BadRequest(new { errors = new[] { "Nothing to pick." } });

        return ToResponse(await _svc.PickAsync(name, body.ImageKey, Actor(), ct));
    }

    [HttpDelete("{name}")]
    public async Task<IActionResult> Clear(string name, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return await _svc.ClearAsync(name, Actor(), ct) == HomePhotoService.Outcome.NotFound
            ? NotFound()
            : NoContent();
    }

    public record SwapRequest(string? A, string? B);

    [HttpPost("swap")]
    public async Task<IActionResult> Swap([FromBody] SwapRequest body, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        if (body is null) return BadRequest(new { errors = new[] { "Nothing to swap." } });

        var result = await _svc.SwapAsync(body.A ?? "", body.B ?? "", Actor(), ct);
        return result.Outcome switch
        {
            HomePhotoService.Outcome.Ok => Ok(new { ok = true }),
            HomePhotoService.Outcome.NotFound => NotFound(),
            _ => BadRequest(new { errors = new[] { result.Error } }),
        };
    }

    public record AltRequest(string? Alt);

    [HttpPost("{name}/alt")]
    public async Task<IActionResult> SetAlt(string name, [FromBody] AltRequest body, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        if (!HomeSlotNames.IsValid(name)) return NotFound();
        if (body is null) return BadRequest(new { errors = new[] { "Nothing to update." } });

        return ToResponse(await _svc.SetAltAsync(name, body.Alt, Actor(), ct));
    }

    private IActionResult ToResponse(HomePhotoService.Result result) => result.Outcome switch
    {
        HomePhotoService.Outcome.Ok => Ok(result.Slot),
        HomePhotoService.Outcome.NotFound => NotFound(),
        _ => BadRequest(new { errors = new[] { result.Error } }),
    };
}
