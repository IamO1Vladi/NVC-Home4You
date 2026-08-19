using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The catalogue at factory cost. AdminOnly, no-store — see AdminBuyCyclesController.
[ApiController]
[Route("api/admin/product-models")]
[Authorize(Policy = "AdminOnly")]
// HANDOFF.md's rule is no-store on EVERY response, and the hand-typed header lines only
// covered the GETs — mutations echo the same financial DTOs (2026-08-19 review). The
// class-level attribute is the version no future endpoint can forget.
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AdminProductModelsController : ControllerBase
{
    private readonly ProductModelAdminService _svc;

    public AdminProductModelsController(ProductModelAdminService svc) => _svc = svc;

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(ct));
    }

    /// <summary>
    /// The category keys, served rather than hard-coded in the SPA.
    ///
    /// Deliberately the SAME list the sales side uses (PurchaseCategories), so "what we
    /// bought" and "what we sold" group identically. Two hand-maintained copies of a key list
    /// drift, and the failure is silent — a category spelled one way here and another way
    /// there simply stops matching.
    /// </summary>
    [HttpGet("categories")]
    public IActionResult Categories()
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(PurchaseCategories.All);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var model = await _svc.GetAsync(id, ct);
        return model is null ? NotFound() : Ok(model);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductModelInput input, CancellationToken ct)
    {
        var errors = ProductModelAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var created = await _svc.CreateAsync(input, Actor(), ct);

        // Rides on the successful response rather than blocking it, exactly as the duplicate
        // name does on a factory: a second cost row for one house is legitimate (the same
        // model from two factories at two prices), so this is information for the person who
        // just typed it, not a verdict.
        var duplicate = await _svc.HouseLinkExistsAsync(input.HouseId, created.Id, ct);
        return Ok(new { ok = true, model = created, duplicateHouseLink = duplicate });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ProductModelInput input, CancellationToken ct)
    {
        var errors = ProductModelAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var updated = await _svc.UpdateAsync(id, input, Actor(), ct);
        if (updated is null) return NotFound();

        var duplicate = await _svc.HouseLinkExistsAsync(input.HouseId, id, ct);
        return Ok(new { ok = true, model = updated, duplicateHouseLink = duplicate });
    }

    /// <summary>409 with the count when lots name it — deactivate instead. See the factory equivalent.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var (outcome, lots) = await _svc.DeleteAsync(id, ct);

        return outcome switch
        {
            ProductModelAdminService.DeleteOutcome.Deleted => Ok(new { ok = true, id }),
            ProductModelAdminService.DeleteOutcome.NotFound => NotFound(),
            _ => Conflict(new
            {
                errors = new[] { "Shipments still carry this model. Deactivate it instead." },
                lotCount = lots,
            }),
        };
    }
}
