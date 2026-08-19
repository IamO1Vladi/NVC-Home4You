using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// Sales out of containers. AdminOnly, no-store — see AdminBuyCyclesController; this is
// revenue and margin data, the most commercially sensitive numbers in the panel.
[ApiController]
[Route("api/admin/sales")]
[Authorize(Policy = "AdminOnly")]
public class AdminSalesController : ControllerBase
{
    private readonly SaleAdminService _svc;

    public AdminSalesController(SaleAdminService svc) => _svc = svc;

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(ct));
    }

    /// <summary>
    /// The container lines the form can offer, with how many each still holds — the
    /// availability is ON the option, so the form can say "3 left" before anyone types.
    /// </summary>
    [HttpGet("lot-options")]
    public async Task<IActionResult> LotOptions(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.LotOptionsAsync(ct));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var sale = await _svc.GetAsync(id, ct);
        return sale is null ? NotFound() : Ok(sale);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaleInput input, CancellationToken ct)
    {
        var errors = SaleAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var (outcome, available, sale) = await _svc.CreateAsync(input, Actor(), ct);
        return Respond(outcome, available, sale);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaleInput input, CancellationToken ct)
    {
        var errors = SaleAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var (outcome, available, sale) = await _svc.UpdateAsync(id, input, Actor(), ct);
        return Respond(outcome, available, sale);
    }

    /// <summary>Deleting a sale puts its units back into stock; the audit log keeps what it was.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await _svc.DeleteAsync(id, ct) ? Ok(new { ok = true, id }) : NotFound();

    private IActionResult Respond(SaleAdminService.SaveOutcome outcome, int available, SaleDto? sale) =>
        outcome switch
        {
            SaleAdminService.SaveOutcome.Saved => Ok(new { ok = true, sale }),
            SaleAdminService.SaveOutcome.NotFound => NotFound(),
            // 409 with the number the person actually needs: how many that line still has.
            _ => Conflict(new
            {
                errors = new[] { $"That line has only {available} left." },
                available,
            }),
        };
}
