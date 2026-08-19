using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The buying cycles.
//
// AdminOnly with no anonymous read path, like everything else in the panel — and here the
// reason is sharper than usual: these tables are what the business pays for its goods and
// what it marks them up by. There is no public read path anywhere in ROADMAP #21, which is
// what makes the whole feature simpler than the migrations before it: no DATA_SOURCE flag,
// no fallback chain, no cutover that can break a customer.
[ApiController]
[Route("api/admin/buy-cycles")]
[Authorize(Policy = "AdminOnly")]
public class AdminBuyCyclesController : ControllerBase
{
    private readonly BuyCycleAdminService _svc;

    public AdminBuyCyclesController(BuyCycleAdminService svc) => _svc = svc;

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(ct));
    }

    /// <summary>
    /// The coefficients a new cycle should open with. The form asks for this before it is
    /// filled in, so the markup is already in the box rather than left blank — see
    /// BuyCycleAdminService.PreviousCoefficientsAsync for why blank is the dangerous state.
    /// </summary>
    [HttpGet("defaults")]
    public async Task<IActionResult> Defaults(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var (markup, borderVat) = await _svc.PreviousCoefficientsAsync(ct);
        return Ok(new { markupCoefficient = markup, borderVatRate = borderVat });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var cycle = await _svc.GetAsync(id, ct);
        return cycle is null ? NotFound() : Ok(cycle);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BuyCycleInput input, CancellationToken ct)
    {
        var errors = BuyCycleAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        return Ok(new { ok = true, cycle = await _svc.CreateAsync(input, Actor(), ct) });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] BuyCycleInput input, CancellationToken ct)
    {
        var errors = BuyCycleAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var updated = await _svc.UpdateAsync(id, input, Actor(), ct);
        return updated is null ? NotFound() : Ok(new { ok = true, cycle = updated });
    }

    /// <summary>
    /// Removes a cycle nothing points at.
    ///
    /// 409 with both counts when shipments or targets name it, rather than a cascade — the
    /// right answer in that case is to close the cycle, and the response says so with the
    /// numbers that make it obvious why. Same shape as AdminFactoriesController.Delete.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var (outcome, shipments, targets) = await _svc.DeleteAsync(id, ct);

        return outcome switch
        {
            BuyCycleAdminService.DeleteOutcome.Deleted => Ok(new { ok = true, id }),
            BuyCycleAdminService.DeleteOutcome.NotFound => NotFound(),
            _ => Conflict(new
            {
                errors = new[] { "This cycle still has shipments or targets against it. Close it instead." },
                shipmentCount = shipments,
                targetCount = targets,
            }),
        };
    }
}
