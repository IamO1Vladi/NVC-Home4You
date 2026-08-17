using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The supplier directory: the factories we have bought houses and materials from.
//
// Same protection as everything else in the panel. Nothing here is sensitive in the way the
// customers table is, but a supplier list with contacts and notes is still commercial
// information that has no business being public.
[ApiController]
[Route("api/admin/factories")]
[Authorize(Policy = "AdminOnly")]
public class AdminFactoriesController : ControllerBase
{
    private readonly FactoryAdminService _svc;

    public AdminFactoriesController(FactoryAdminService svc) => _svc = svc;

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(ct));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var factory = await _svc.GetAsync(id, ct);
        return factory is null ? NotFound() : Ok(factory);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FactoryInput input, CancellationToken ct)
    {
        var errors = FactoryAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var created = await _svc.CreateAsync(input, Actor(), ct);

        // The duplicate check rides on the successful response rather than blocking it.
        // Two suppliers can share a name across countries, so this is information for the
        // person who just typed it, not a verdict on whether the row may exist.
        var duplicate = await _svc.NameExistsAsync(input.Name, created.Id, ct);
        return Ok(new { ok = true, factory = created, duplicateName = duplicate });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] FactoryInput input, CancellationToken ct)
    {
        var errors = FactoryAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var updated = await _svc.UpdateAsync(id, input, Actor(), ct);
        if (updated is null) return NotFound();

        var duplicate = await _svc.NameExistsAsync(input.Name, id, ct);
        return Ok(new { ok = true, factory = updated, duplicateName = duplicate });
    }

    /// <summary>
    /// Removes a factory nothing points at.
    ///
    /// 409 with the count when purchases name it, rather than a cascade or a raw FK error.
    /// The right answer in that case is to deactivate — the history stays readable and the
    /// name stops appearing on new purchases — and the response says so.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var (outcome, count) = await _svc.DeleteAsync(id, ct);

        return outcome switch
        {
            FactoryAdminService.DeleteOutcome.Deleted => Ok(new { ok = true, id }),
            FactoryAdminService.DeleteOutcome.NotFound => NotFound(),
            _ => Conflict(new { errors = new[] { "This factory is named by existing purchases." }, purchaseCount = count }),
        };
    }
}
