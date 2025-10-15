using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
public class OfferController : ControllerBase
{
    private readonly FormService _svc;
    public OfferController(FormService svc) { _svc = svc; }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] OfferDto dto, CancellationToken ct)
    {
        var rid = await _svc.CreateOfferAsync(dto, ct);
        return Ok(new { recordId = rid });
    }
}
