using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The home page's photo slots, read side (2026-10), and since 2026-10-12 the product pages'
// main photos too ("pages", keyed by the SPA's route key). One small anonymous payload the
// SPA merges over its content defaults, so an empty or failed answer is still a working
// page; the heavy lifting is the cache inside HomePhotoService. One address for both rather
// than a /api/pages/photos beside it: the rows are one table and one cached read, and a
// second route would be a second cache to evict on every write.
//
// It also carries "from", the cheapest published gallery price per category, for the home
// hero's first sentence. That is not a photo, but the home page already waits on this one
// call and seeds its answer into <head> for the next load, so the figure rides along at no
// extra request and a prerendered page paints it without a flash; a /api/home/from beside
// it would be a second call for the prerender to wait on and a second seed to keep.
//
// The service lives in the SQL block of Program.cs, so on a machine without a database it
// is simply absent. Taking it as optional keeps this route answering the empty shape there
// (no photos, no "from" figure) rather than failing to activate, which is the same outcome
// the SPA would fall back to.
[ApiController]
[Route("api/home/photos")]
public class HomePhotosController : ControllerBase
{
    private readonly HomePhotoService? _svc;

    public HomePhotosController(HomePhotoService? svc = null) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "public, max-age=120";
        return Ok(_svc is null ? HomePhotosDto.Empty() : await _svc.ReadPublicAsync(ct));
    }
}
