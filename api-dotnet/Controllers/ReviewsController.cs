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
    private readonly ReviewService _svc;

    public ReviewsController(ReviewService svc)
    {
        _svc = svc;
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
            var rid = await _svc.CreatePendingReviewAsync(dto, ct);
            return Ok(new { ok = true, recordId = rid, status = "pending" });
        }
        catch (InvalidOperationException ex)
        {
            return Problem(detail: ex.Message, statusCode: 500, title: "Quickbase review integration is not configured.");
        }
    }
}
