using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
public class GalleryController : ControllerBase
{
    // IGalleryStore, not GalleryService: which store answers is decided per request by
    // DATA_SOURCE_GALLERY (see Program.cs), so the controller must not name one of them.
    private readonly IGalleryStore _svc;
    public GalleryController(IGalleryStore svc) { _svc = svc; }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var items = await _svc.GetAsync(ct);
        // Short shared-cache window; the heavy lifting is the in-memory cache inside GalleryService.
        Response.Headers["Cache-Control"] = "public, max-age=120";
        return Ok(new { items });
    }
}
