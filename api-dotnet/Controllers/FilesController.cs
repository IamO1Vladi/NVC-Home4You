using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Services;

namespace Controllers;

[ApiController]
[Route("api/files")]
public class FilesController : ControllerBase
{
    // The {version} segment is part of the URL, and Quickbase mints a new version whenever
    // an attachment is replaced. The bytes behind any one URL therefore never change, which
    // makes them safe to cache indefinitely — both here and in the visitor's browser.
    private static readonly TimeSpan BrowserTtl = TimeSpan.FromDays(365);

    private readonly QuickbaseClient _qb;
    private readonly ImageCache _images;

    public FilesController(QuickbaseClient qb, ImageCache images)
    {
        _qb = qb;
        _images = images;
    }

    [HttpGet("{table}/{rid:long}/{fid:int}/{version:int}")]
    public async Task<IActionResult> Get(string table, long rid, int fid, int version, CancellationToken ct)
    {
        var path = $"v1/files/{table}/{rid}/{fid}/{version}";

        if (_images.TryGet(path, out var cachedBytes, out var cachedType))
            return CachedFile(cachedBytes, cachedType);

        var resp = await _qb.RawGetAsync(path, ct);
        var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
        var contentType = resp.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";

        _images.Set(path, bytes, contentType);
        return CachedFile(bytes, contentType);
    }

    // Tells the browser it may reuse the bytes for a year without revalidating.
    // "immutable" is what stops the conditional round trip on every repeat view; with it
    // there's no point paying to compute an ETag, since the browser won't ask again.
    private IActionResult CachedFile(byte[] bytes, string contentType)
    {
        Response.Headers[HeaderNames.CacheControl] =
            $"public, max-age={(int)BrowserTtl.TotalSeconds}, immutable";
        return File(bytes, contentType);
    }
}
