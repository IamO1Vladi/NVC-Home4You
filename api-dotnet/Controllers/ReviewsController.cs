using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    //
    // A product page adds ?product=modularBuilds and gets that product's reviews, rating and
    // count. The only server cache is the full approved list, which does not depend on the
    // product, and the HTTP cache below is keyed by the whole URL, query included.
    [HttpGet("featured")]
    public async Task<IActionResult> Featured([FromQuery] int take, [FromQuery] string? product, CancellationToken ct)
    {
        if (take <= 0) take = 3;
        if (take > 12) take = 12;

        product = string.IsNullOrWhiteSpace(product) ? null : product.Trim();
        if (product is not null && !IsProductKey(product))
            return BadRequest(new { error = "Unknown product." });

        var dto = await _store.GetFeaturedAsync(take, product, ct);
        Response.Headers["Cache-Control"] = "public, max-age=120";
        return Ok(dto);
    }

    // The review form saves a product as a short camelCase key ("modularBuilds"). Anything
    // else cannot match a key, so it is refused rather than answered with an empty feed that
    // a typo in a page would then hide behind.
    private static bool IsProductKey(string value) =>
        value.Length <= 40 && value.All(char.IsAsciiLetter);

    // The write side only: the homepage feed above is read by every visitor and must not
    // share a budget with a form. Same policy as the enquiry forms ("public-write").
    [HttpPost]
    [EnableRateLimiting("public-write")]
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
