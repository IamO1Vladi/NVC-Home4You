using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Services;

namespace Controllers;

// The public address of a brochure: /api/brochures/{slug}.pdf?lang=el (ROADMAP #16).
//
// THE URL IS THE CONTRACT. Twelve prerendered snapshots carry these links as literal text,
// and check-prerender-freshness.mjs only watches /assets/ files — so this address must
// survive every replacement, which it does because replacing a brochure repoints the row
// at a new blob and touches nothing here.
//
// Unauthenticated like ImagesController, and as paranoid: the container behind this is
// shared with the public images, so the brochures/ prefix check runs before any byte is
// read, even though every key served here was minted by us.
[ApiController]
[Route("api/brochures")]
public class BrochuresController : ControllerBase
{
    private readonly PublicDocumentService _docs;
    private readonly PublicDocumentStore _store;

    public BrochuresController(PublicDocumentService docs, PublicDocumentStore store)
    {
        _docs = docs;
        _store = store;
    }

    [HttpGet("{slug}.pdf")]
    public async Task<IActionResult> Get(string slug, [FromQuery] string? lang, CancellationToken ct)
    {
        if (!_store.IsConfigured) return NotFound();

        var doc = await _docs.ResolveAsync(slug, lang, ct);
        if (doc is null) return NotFound();

        if (!PublicDocumentStore.IsValidKey(doc.BlobKey)) return NotFound();

        var opened = await _store.TryOpenReadAsync(doc.BlobKey, ct);
        if (opened is null) return NotFound();

        // An hour of freshness against a document that changes a few times a year, and a
        // strong ETag for everything past the hour. The BlobKey GUID changes on every
        // replacement and never otherwise, so a 304 here is always telling the truth —
        // and If-Range keeps Chrome's PDF viewer from stitching ranges of two editions.
        Response.Headers[HeaderNames.CacheControl] = "public, max-age=3600";

        // Inline, so the #page anchors the pages link with actually land somewhere. The
        // filename is what the browser suggests on save — a label from the row, never a key.
        Response.Headers[HeaderNames.ContentDisposition] =
            new ContentDispositionHeaderValue("inline") { FileNameStar = doc.FileName }.ToString();

        var etag = new EntityTagHeaderValue($"\"{System.IO.Path.GetFileNameWithoutExtension(doc.BlobKey)}\"");

        // The framework's range machinery, not ours: the stream is seekable over lazy
        // ranged reads, so Chrome paging through the 16.5 MB catalogue pulls the pages it
        // shows, and If-None-Match / If-Range are answered per the RFC for free.
        return File(opened.Value.Content, doc.ContentType ?? "application/pdf",
            lastModified: doc.UpdatedAt ?? doc.CreatedAt, entityTag: etag, enableRangeProcessing: true);
    }
}
