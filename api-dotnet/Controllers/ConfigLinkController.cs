using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/config-link")]
public class ConfigLinkController : ControllerBase
{
    private readonly ISavedConfigStore _svc;
    public ConfigLinkController(ISavedConfigStore svc) { _svc = svc; }

    // Save a configuration and get back a short code + absolute /c/{code} URL.
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveConfigRequest req, CancellationToken ct)
    {
        if (!_svc.IsConfigured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "saved_configs_disabled" });

        if (req is null || req.Config.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            return BadRequest(new { error = "missing_config" });

        var code = await _svc.SaveAsync(req, ct);
        var url = $"{Request.Scheme}://{Request.Host}/c/{code}";
        return Ok(new SaveConfigResponse(code, url));
    }

    // Resolve a short code back to its stored configuration.
    [HttpGet("{code}")]
    public async Task<IActionResult> Get(string code, CancellationToken ct)
    {
        if (!_svc.IsConfigured) return NotFound();

        var dto = await _svc.GetAsync(code, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}
