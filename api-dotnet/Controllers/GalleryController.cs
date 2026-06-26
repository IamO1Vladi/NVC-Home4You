using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
public class GalleryController : ControllerBase
{
    private readonly GalleryService _svc;
    public GalleryController(GalleryService svc) { _svc = svc; }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var items = await _svc.GetAsync(ct);
        // Short shared-cache window; the heavy lifting is the in-memory cache inside GalleryService.
        Response.Headers["Cache-Control"] = "public, max-age=120";
        return Ok(new { items });
    }
}
