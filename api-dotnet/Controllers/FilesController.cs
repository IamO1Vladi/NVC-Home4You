using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

[ApiController]
[Route("api/files")]
public class FilesController : ControllerBase
{
    private readonly QuickbaseClient _qb;
    public FilesController(QuickbaseClient qb) { _qb = qb; }

    [HttpGet("{table}/{rid:long}/{fid:int}/{version:int}")]
    public async Task<IActionResult> Get(string table, long rid, int fid, int version, CancellationToken ct)
    {
        var resp = await _qb.RawGetAsync($"v1/files/{table}/{rid}/{fid}/{version}", ct);
        var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
        var contentType = resp.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        return File(bytes, contentType);
    }
}
