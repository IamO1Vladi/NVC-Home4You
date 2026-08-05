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

[ApiController]
[Route("api/admin/cases")]
[Authorize(Policy = "AdminOnly")]
public class AdminCasesController : ControllerBase
{
    private const long MaxUploadBytes = 25L * 1024 * 1024;
    private static readonly string[] Slots = { "gallery", "logo", "cover" };

    private readonly CasesAdminService _svc;

    public AdminCasesController(CasesAdminService svc)
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
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(CaseCategories.All);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var item = await _svc.GetAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CaseInput input, CancellationToken ct)
    {
        var errors = Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        return Ok(await _svc.CreateAsync(input, Actor(), ct));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CaseInput input, CancellationToken ct)
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
        int id, IFormFile file, [FromForm] string? slot, [FromForm] string? altText, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { errors = new[] { "No file was uploaded." } });

        if (file.Length > MaxUploadBytes)
            return BadRequest(new { errors = new[] { $"That image is larger than the {MaxUploadBytes / 1024 / 1024} MB limit." } });

        var target = string.IsNullOrWhiteSpace(slot) ? "gallery" : slot.Trim().ToLowerInvariant();
        if (!Slots.Contains(target))
            return BadRequest(new { errors = new[] { $"slot must be one of: {string.Join(", ", Slots)}." } });

        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);

        var image = await _svc.AddImageAsync(id, target, buffer.ToArray(), file.FileName, altText, ct);

        return image is null
            ? BadRequest(new { errors = new[] { "That file could not be read as an image." } })
            : Ok(image);
    }

    [HttpDelete("{id:int}/images/{imageId:int}")]
    public async Task<IActionResult> DeleteImage(int id, int imageId, CancellationToken ct) =>
        await _svc.DeleteImageAsync(id, imageId, ct) ? Ok(new { ok = true, imageId }) : NotFound();

    [HttpDelete("{id:int}/images/slot/{slot}")]
    public async Task<IActionResult> ClearSlot(int id, string slot, CancellationToken ct)
    {
        var target = (slot ?? "").Trim().ToLowerInvariant();
        if (target is not ("logo" or "cover"))
            return BadRequest(new { errors = new[] { "slot must be logo or cover." } });

        return await _svc.ClearSlotAsync(id, target, ct) ? Ok(new { ok = true }) : NotFound();
    }

    public sealed class ReorderInput
    {
        public List<int> ImageIds { get; set; } = new();
    }

    [HttpPost("{id:int}/images/order")]
    public async Task<IActionResult> ReorderImages(int id, [FromBody] ReorderInput input, CancellationToken ct) =>
        await _svc.ReorderImagesAsync(id, input.ImageIds ?? new List<int>(), ct)
            ? Ok(new { ok = true })
            : NotFound();

    private static List<string> Validate(CaseInput input)
    {
        var errors = new List<string>();

        // A case needs an attributable subject. Both empty would render as an anonymous
        // testimonial, which reads as filler and is worse than not publishing it.
        if (string.IsNullOrWhiteSpace(input.CompanyName) && string.IsNullOrWhiteSpace(input.BuyerName))
            errors.Add("Either a company name or a buyer name is required.");

        if (input.RatingSnapshot is < 0 or > 5)
            errors.Add("Rating must be between 0 and 5.");

        if (input.Year is < 1900 or > 2200)
            errors.Add("Year looks wrong.");

        if (input.UnitsQty is < 0)
            errors.Add("Units cannot be negative.");

        // Unknown categories are allowed through — the cases page groups rather than filters,
        // so an odd value degrades to "ungrouped" instead of hiding the case. Warned about in
        // the UI rather than blocked here.
        return errors;
    }

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;
}
