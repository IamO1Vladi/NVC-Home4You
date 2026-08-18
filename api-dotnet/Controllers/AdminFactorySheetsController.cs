using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The factory order sheets — what we hand the factory for each order.
//
// This replaces the /internal/factory-sheet page and its bundle-shipped password. The gate
// is now the same Entra sign-in as the rest of the panel, and the data is rows here instead
// of one browser's localStorage. Writes are audited like everything else staff edit.
[ApiController]
[Route("api/admin/factory-sheets")]
[Authorize(Policy = "AdminOnly")]
public class AdminFactorySheetsController : ControllerBase
{
    private readonly FactorySheetAdminService _svc;

    public AdminFactorySheetsController(FactorySheetAdminService svc) => _svc = svc;

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
        var sheet = await _svc.GetAsync(id, ct);
        return sheet is null ? NotFound() : Ok(sheet);
    }

    // Above Kestrel's ~30MB default this would be moot, but saying it here makes the ceiling
    // deliberate: the plan image is capped at 4MB of data URL by the service, and the rest
    // of the sheet is text.
    [HttpPost]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Create([FromBody] FactorySheetInput input, CancellationToken ct)
    {
        var errors = FactorySheetAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var sheet = await _svc.CreateAsync(input, Actor(), ct);
        return Ok(new { ok = true, sheet });
    }

    [HttpPut("{id:int}")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Update(int id, [FromBody] FactorySheetInput input, CancellationToken ct)
    {
        var errors = FactorySheetAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var sheet = await _svc.UpdateAsync(id, input, Actor(), ct);
        return sheet is null ? NotFound() : Ok(new { ok = true, sheet });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await _svc.DeleteAsync(id, ct) ? Ok(new { ok = true, id }) : NotFound();
}
