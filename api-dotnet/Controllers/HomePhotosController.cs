using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The home page's photo slots, read side (2026-10). One small anonymous payload the SPA
// merges over its content defaults, so an empty or failed answer is still a working page;
// the heavy lifting is the cache inside HomePhotoService.
//
// The service lives in the SQL block of Program.cs, so on a machine without a database it
// is simply absent. Taking it as optional keeps this route answering the empty shape there
// rather than failing to activate, which is the same outcome the SPA would fall back to.
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
