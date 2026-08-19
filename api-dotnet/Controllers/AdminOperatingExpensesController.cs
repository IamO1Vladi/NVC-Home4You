using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// Operating expenses. AdminOnly, no-store — see AdminBuyCyclesController.
[ApiController]
[Route("api/admin/operating-expenses")]
[Authorize(Policy = "AdminOnly")]
public class AdminOperatingExpensesController : ControllerBase
{
    private readonly OperatingExpenseAdminService _svc;

    public AdminOperatingExpensesController(OperatingExpenseAdminService svc) => _svc = svc;

    private string? Actor() =>
        User.FindFirst("preferred_username")?.Value ?? User.Identity?.Name;

    /// <summary>
    /// A window from the query string, as "YYYY-MM-DD".
    ///
    /// Unparseable in means no bound rather than an error: these are optional filters on a
    /// list screen, and a typo in a date box should widen the list, not empty it with a
    /// message about date formats.
    /// </summary>
    private static System.DateTimeOffset? DateFrom(string? raw) =>
        CustomerAdminService.TryParsePurchaseDate(raw, out var value) ? value : null;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? category, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(await _svc.ListAsync(DateFrom(from), DateFrom(to), category, ct));
    }

    /// <summary>The category keys, served rather than hard-coded in the SPA. See ExpenseCategories.</summary>
    [HttpGet("categories")]
    public IActionResult Categories()
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(ExpenseCategories.All);
    }

    /// <summary>
    /// Totals by category and by month over the same window.
    ///
    /// Both in one response because the dashboard shows them side by side, and two round
    /// trips over one date range is how the two halves of a screen end up describing
    /// different months.
    /// </summary>
    [HttpGet("rollup")]
    public async Task<IActionResult> Rollup(
        [FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";

        var start = DateFrom(from);
        var end = DateFrom(to);

        return Ok(new
        {
            byCategory = await _svc.ByCategoryAsync(start, end, ct),
            byMonth = await _svc.ByMonthAsync(start, end, ct),
        });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var expense = await _svc.GetAsync(id, ct);
        return expense is null ? NotFound() : Ok(expense);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] OperatingExpenseInput input, CancellationToken ct)
    {
        var errors = OperatingExpenseAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        return Ok(new { ok = true, expense = await _svc.CreateAsync(input, Actor(), ct) });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id, [FromBody] OperatingExpenseInput input, CancellationToken ct)
    {
        var errors = OperatingExpenseAdminService.Validate(input);
        if (errors.Count > 0) return BadRequest(new { errors });

        var updated = await _svc.UpdateAsync(id, input, Actor(), ct);
        return updated is null ? NotFound() : Ok(new { ok = true, expense = updated });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await _svc.DeleteAsync(id, ct) ? Ok(new { ok = true, id }) : NotFound();
}
