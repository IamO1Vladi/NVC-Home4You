using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// Containers and their contents. AdminOnly, no-store — see AdminBuyCyclesController.
//
// Every write that touches a line returns THE WHOLE SHIPMENT, not the line. Freight is
// shared across the lines by value, so adding, editing or removing any one of them changes
// the landed cost of every other one — a response carrying just the edited row would leave
// the rest of the table on screen quietly stale, and stale money is the thing this feature
// exists to stop.
[ApiController]
[Route("api/admin/shipments")]
[Authorize(Policy = "AdminOnly")]
public class AdminShipmentsController : ControllerBase
{
    private readonly ShipmentAdminService _svc;

    public AdminShipmentsController(ShipmentAdminService svc) => _svc = svc;

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    /// <summary>
    /// How freight and customs are spread over the units, from the query string.
    ///
    /// By value is the decision (owner, 2026-08-19 — and Quickbase's own allocation
    /// formulas agree). The by-count reading stays available as a what-if lens, which is
    /// all the parameter is for now.
    /// </summary>
    private static LandedCost.Allocation AllocationFrom(string? raw) =>
        string.Equals(raw, "count", System.StringComparison.OrdinalIgnoreCase)
            ? LandedCost.Allocation.ByCount
            : LandedCost.Allocation.ByValue;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? cycleId, [FromQuery] string? allocation, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(cycleId, ct, AllocationFrom(allocation)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, [FromQuery] string? allocation, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var shipment = await _svc.GetAsync(id, ct, AllocationFrom(allocation));
        return shipment is null ? NotFound() : Ok(shipment);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ShipmentInput input, CancellationToken ct)
    {
        var errors = ShipmentAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        return Ok(new { ok = true, shipment = await _svc.CreateAsync(input, Actor(), ct) });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ShipmentInput input, CancellationToken ct)
    {
        var errors = ShipmentAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var updated = await _svc.UpdateAsync(id, input, Actor(), ct);
        return updated is null ? NotFound() : Ok(new { ok = true, shipment = updated });
    }

    /// <summary>
    /// Removes a container and its lines.
    ///
    /// No 409 branch here, unlike a cycle or a supplier: the only rows that point at a
    /// shipment are its own lots, and they have no meaning without it. See the Cascade in
    /// AppDbContext, which is the only one in these tables.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await _svc.DeleteAsync(id, ct) ? Ok(new { ok = true, id }) : NotFound();

    // --- Lines --------------------------------------------------------------------------

    [HttpPost("{id:int}/lots")]
    public async Task<IActionResult> AddLot(int id, [FromBody] PurchaseLotInput input, CancellationToken ct)
    {
        var errors = ShipmentAdminService.ValidateLot(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var shipment = await _svc.AddLotAsync(id, input, Actor(), ct);
        return shipment is null ? NotFound() : Ok(new { ok = true, shipment });
    }

    [HttpPut("lots/{lotId:int}")]
    public async Task<IActionResult> UpdateLot(
        int lotId, [FromBody] PurchaseLotInput input, CancellationToken ct)
    {
        var errors = ShipmentAdminService.ValidateLot(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var shipment = await _svc.UpdateLotAsync(lotId, input, Actor(), ct);
        return shipment is null ? NotFound() : Ok(new { ok = true, shipment });
    }

    [HttpDelete("lots/{lotId:int}")]
    public async Task<IActionResult> DeleteLot(int lotId, CancellationToken ct)
    {
        var shipment = await _svc.DeleteLotAsync(lotId, ct);
        return shipment is null ? NotFound() : Ok(new { ok = true, shipment });
    }
}
