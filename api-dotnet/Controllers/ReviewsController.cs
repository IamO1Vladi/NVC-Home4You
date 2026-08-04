using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/reviews")]
public class ReviewsController : ControllerBase
{
    // Reads and writes both go through IReviewStore, which resolves to Quickbase or SQL
    // per DATA_SOURCE_REVIEWS. They move together on purpose: reading from one store while
    // writing to the other would make a new review invisible until the next import.
    private readonly IReviewStore _store;

    public ReviewsController(IReviewStore store)
    {
        _store = store;
    }

    // Lightweight social-proof feed for the homepage: top approved reviews plus the
    // aggregate rating/count. Kept separate from /api/cases-page so the homepage doesn't
    // download the full cases + image payload just to show a few testimonials.
    [HttpGet("featured")]
    public async Task<IActionResult> Featured([FromQuery] int take, CancellationToken ct)
    {
        if (take <= 0) take = 3;
        if (take > 12) take = 12;

        var dto = await _store.GetFeaturedAsync(take, ct);
        Response.Headers["Cache-Control"] = "public, max-age=120";
        return Ok(dto);
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] ReviewDto? dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new { error = "Missing body." });
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { error = "Name is required." });
        if (string.IsNullOrWhiteSpace(dto.Email)) return BadRequest(new { error = "Email is required." });
        if (string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest(new { error = "Comment is required." });
        if (dto.Rating < 1 || dto.Rating > 5) return BadRequest(new { error = "Rating must be between 1 and 5." });

        try
        {
            var rid = await _store.CreatePendingReviewAsync(dto, ct);
            return Ok(new { ok = true, recordId = rid, status = "pending" });
        }
        catch (InvalidOperationException ex)
        {
            return Problem(detail: ex.Message, statusCode: 500, title: "Quickbase review integration is not configured.");
        }
    }
}
