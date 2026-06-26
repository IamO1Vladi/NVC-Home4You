using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

[ApiController]
[Route("api/cases-page")]
public class CasesPageController : ControllerBase
{
    private readonly CasesPageService _svc;

    public CasesPageController(CasesPageService svc)
    {
        _svc = svc;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var dto = await _svc.GetAsync(ct);
        // Short shared-cache window; the heavy lifting is the in-memory cache inside CasesPageService.
        Response.Headers["Cache-Control"] = "public, max-age=120";
        return Ok(dto);
    }
}
