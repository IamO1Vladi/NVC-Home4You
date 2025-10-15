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
        => Ok(new { items = await _svc.GetAsync(ct) });
}
