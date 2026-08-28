using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Blob storage for the public brochures (ROADMAP #16).
///
/// The EXISTING images container, under a brochures/ prefix — deliberately NOT the
/// lead-files container, which holds purchase invoices carrying ЕГН and addresses. The
/// public/private split between the two containers is an application-layer fact, not a
/// storage one: both are created PublicAccessType.None, and what makes this one public is
/// only that BrochuresController reads it without authentication, the way ImagesController
/// reads the images. That is why <see cref="IsValidKey"/> exists and why Program.cs fails
/// fast if the two container names are ever configured equal — either mistake would put a
/// customer's invoice one guessed URL away from the open internet.
/// </summary>
public sealed class PublicDocumentStore
{
    private readonly ILogger<PublicDocumentStore> _log;
    private readonly BlobContainerClient? _container;

    public PublicDocumentStore(EnvConfig env, ILogger<PublicDocumentStore> log)
    {
        _log = log;

        // Built rather than injected, same reasoning as LeadFileStore: the registered
        // BlobContainerClient singleton is the images container for image reads, and a
        // second registration of the same type is a DI puzzle that buys nothing.
        if (env.BlobConfigured)
            _container = new BlobContainerClient(env.BlobConnectionString, env.BlobImagesContainer);
    }

    public bool IsConfigured => _container is not null;

    // 32 MB. The largest brochure today is the 16.5 MB box house catalogue — already the
    // output of compress_brochure.py, which exists because the raw Canva export was 82.5 MB.
    // The cap is the polite reminder that the compression step comes first, not a ceiling
    // anyone hits in normal use.
    public const long MaxBytes = 32L * 1024 * 1024;

    private const string Prefix = "brochures/";

    /// <summary>
    /// Minted fresh for every upload — replacing a brochure writes a NEW blob under a new
    /// GUID and repoints the row, so the public URL never moves and the old bytes are never
    /// overwritten. The GUID is also what makes the key a correct strong ETag: it changes
    /// on replacement and never otherwise.
    /// </summary>
    public static string MintKey() => $"{Prefix}{Guid.NewGuid():N}.pdf";

    /// <summary>
    /// First line of the read path, the way ImagesController.Get checks ImageKey before
    /// anything else — even though every key this serves was minted by us. The container is
    /// shared with images, so a key outside the brochures/ prefix must never be readable
    /// through the brochure route, whatever a row in the table comes to say.
    /// </summary>
    public static bool IsValidKey(string? key) =>
        !string.IsNullOrWhiteSpace(key)
        && key.StartsWith(Prefix, StringComparison.Ordinal)
        && !key.Contains("..", StringComparison.Ordinal)
        && key.EndsWith(".pdf", StringComparison.Ordinal);

    public async Task UploadAsync(string key, Stream content, CancellationToken ct)
    {
        if (_container is null) throw new InvalidOperationException("Blob storage is not configured.");
        if (!IsValidKey(key)) throw new ArgumentException("Not a brochure key.", nameof(key));

        await _container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);

        var blob = _container.GetBlobClient(key);
        await blob.UploadAsync(
            content,
            new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = "application/pdf",

                    // Inline, unlike LeadFileStore's attachment: a brochure link's whole
                    // job is to open in the browser's PDF viewer at its #page anchor.
                    // An attachment disposition would download the file and drop the page.
                    ContentDisposition = "inline",
                },
            },
            ct);
    }

    /// <summary>
    /// A SEEKABLE stream over the blob, so the controller can hand it to File(...,
    /// enableRangeProcessing: true) and let ASP.NET answer Range requests properly —
    /// Chrome's PDF viewer asks in ranges, and the 16.5 MB brochure sits on the page whose
    /// whole purpose is that brochure. OpenReadAsync fetches ranges lazily under the hood,
    /// so a viewer reading page 3 does not pull all 16.5 MB.
    /// </summary>
    public async Task<(Stream Content, long Length)?> TryOpenReadAsync(string key, CancellationToken ct)
    {
        if (_container is null || !IsValidKey(key)) return null;

        try
        {
            var blob = _container.GetBlobClient(key);
            var stream = await blob.OpenReadAsync(new BlobOpenReadOptions(allowModifications: false), ct);
            return (stream, stream.Length);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // The row exists but the object does not — the upload half-failed, and a page
            // on the public site is showing a button that cannot deliver. Worth a log line
            // that names the key, because nothing else will say it.
            _log.LogWarning("Brochure blob missing for key {Key}", key);
            return null;
        }
    }
}
