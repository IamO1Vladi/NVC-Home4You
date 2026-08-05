using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// Gallery management. Same auth as the review queue: the "AdminOnly" policy, which is only
// registered when Entra is fully configured, so this fails closed rather than open.
[ApiController]
[Route("api/admin/gallery")]
[Authorize(Policy = "AdminOnly")]
public class AdminGalleryController : ControllerBase
{
    // Bigger than any sane photo, small enough that a mis-drop cannot exhaust the app's
    // memory. The processor downscales past this anyway, so a larger original buys nothing.
    private const long MaxUploadBytes = 25L * 1024 * 1024;

    private readonly GalleryAdminService _svc;

    public AdminGalleryController(GalleryAdminService svc)
    {
        _svc = svc;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(ct));
    }

    [HttpGet("categories")]
    public IActionResult Categories()
    {
        // Served rather than hard-coded in the SPA so the two cannot drift: an unrecognised
        // category makes a house vanish from every filter, silently.
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(HouseCategories.All);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var house = await _svc.GetAsync(id, ct);
        return house is null ? NotFound() : Ok(house);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] HouseInput input, CancellationToken ct)
    {
        var errors = Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        return Ok(await _svc.CreateAsync(input, Actor(), ct));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] HouseInput input, CancellationToken ct)
    {
        var errors = Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var updated = await _svc.UpdateAsync(id, input, Actor(), ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await _svc.DeleteAsync(id, ct) ? Ok(new { ok = true, id }) : NotFound();

    [HttpPost("{id:int}/images")]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<IActionResult> AddImage(
        int id, IFormFile file, [FromForm] string? altText, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { errors = new[] { "No file was uploaded." } });

        if (file.Length > MaxUploadBytes)
            return BadRequest(new { errors = new[] { $"That image is larger than the {MaxUploadBytes / 1024 / 1024} MB limit." } });

        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);

        var image = await _svc.AddImageAsync(id, buffer.ToArray(), file.FileName, altText, ct);

        // Null covers both "no such house" and "those bytes are not an image". The message
        // says the second, because the first cannot happen from the panel's own UI.
        return image is null
            ? BadRequest(new { errors = new[] { "That file could not be read as an image." } })
            : Ok(image);
    }

    [HttpDelete("{id:int}/images/{imageId:int}")]
    public async Task<IActionResult> DeleteImage(int id, int imageId, CancellationToken ct) =>
        await _svc.DeleteImageAsync(id, imageId, ct) ? Ok(new { ok = true, imageId }) : NotFound();

    public sealed class ReorderInput
    {
        public List<int> ImageIds { get; set; } = new();
    }

    [HttpPost("{id:int}/images/order")]
    public async Task<IActionResult> ReorderImages(int id, [FromBody] ReorderInput input, CancellationToken ct) =>
        await _svc.ReorderImagesAsync(id, input.ImageIds ?? new List<int>(), ct)
            ? Ok(new { ok = true })
            : NotFound();

    // Mandatory fields, enforced here as well as in the schema. The schema stops bad data
    // being stored; this is what turns that into a message the editor can act on rather than
    // a 500 from a constraint violation.
    private static List<string> Validate(HouseInput input)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(input.Title))
            errors.Add("Title is required.");

        if (string.IsNullOrWhiteSpace(input.CategoryKey))
            errors.Add("Category is required.");
        else if (!HouseCategories.IsValid(input.CategoryKey.Trim()))
            errors.Add($"Category must be one of: {string.Join(", ", HouseCategories.All)}.");

        if (input.Price is < 0)
            errors.Add("Price cannot be negative.");

        return errors;
    }

    // Recorded on the row as LastModifiedBy, so "who changed this price" has an answer.
    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;
}
