using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// Sales to customers. AdminOnly with no anonymous read path, like everything in the panel —
// this is revenue data sitting beside the customer records.
//
// The buy side that this used to belong to was archived on 2026-08-19; see Sale.
[ApiController]
[Route("api/admin/sales")]
[Authorize(Policy = "AdminOnly")]
// HANDOFF.md's rule is no-store on EVERY response, and hand-typed header lines only ever
// covered the GETs (2026-08-19 review). The class-level attribute is the version no future
// endpoint can forget.
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AdminSalesController : ControllerBase
{
    private readonly SaleAdminService _svc;

    public AdminSalesController(SaleAdminService svc) => _svc = svc;

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    /// <summary>Every sale, or one customer's — the customer page reads it with ?customerId=.</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? customerId, CancellationToken ct) =>
        Ok(await _svc.ListAsync(customerId, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var sale = await _svc.GetAsync(id, ct);
        return sale is null ? NotFound() : Ok(sale);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaleInput input, CancellationToken ct)
    {
        var errors = SaleAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        return Ok(new { ok = true, sale = await _svc.CreateAsync(input, Actor(), ct) });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaleInput input, CancellationToken ct)
    {
        var errors = SaleAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var updated = await _svc.UpdateAsync(id, input, Actor(), ct);
        return updated is null ? NotFound() : Ok(new { ok = true, sale = updated });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await _svc.DeleteAsync(id, ct) ? Ok(new { ok = true, id }) : NotFound();
}
