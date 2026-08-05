using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Services;

namespace Controllers;

// First-party image URL: /api/img/{key}, where key is the normalised Quickbase attachment
// path (see ImageKey).
//
// This exists because Quickbase serves images with `Cache-Control: max-age=7200, private`
// and `cf-cache-status: DYNAMIC` — never edge-cached, and gone from the browser cache after
// two hours, at ~250-320ms per image. Serving them from our own origin lets us mark them
// immutable for a year, and puts them on the connection the page is already using.
[ApiController]
[Route("api/img")]
public class ImagesController : ControllerBase
{
    // The ids in the key include Quickbase's attachment version, which changes whenever a
    // file is replaced. The bytes behind one key therefore never change, so the browser can
    // keep them for a year and never revalidate.
    private static readonly TimeSpan BrowserTtl = TimeSpan.FromDays(365);

    private readonly ImageStore _images;

    public ImagesController(ImageStore images)
    {
        _images = images;
    }

    [HttpGet("{*key}")]
    public async Task<IActionResult> Get(string key, CancellationToken ct)
    {
        if (!ImageKey.IsValid(key)) return NotFound();

        var image = await _images.TryGetAsync(key, ct);
        if (image is null) return NotFound();

        Response.Headers[HeaderNames.CacheControl] =
            $"public, max-age={(int)BrowserTtl.TotalSeconds}, immutable";

        // Lets `verify-images` and a browser devtools check tell a migrated image from one
        // still being fetched from Quickbase. Costs nothing and is the only way to see that
        // the container is actually being hit.
        Response.Headers["X-Image-Origin"] = image.Origin.ToString();

        return File(image.Bytes, image.ContentType);
    }
}
