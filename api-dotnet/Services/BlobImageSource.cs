using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;

namespace Services;

// Reads image bytes from the Azure Blob container, using the ImageKey as the blob name.
//
// Registered only when BLOB_CONNECTION_STRING is set (see Program.cs), so an environment
// without storage configured behaves exactly as before rather than failing.
public sealed class BlobImageSource : IImageSource
{
    private readonly BlobContainerClient _container;
    private readonly ILogger<BlobImageSource> _log;

    public BlobImageSource(BlobContainerClient container, ILogger<BlobImageSource> log)
    {
        _container = container;
        _log = log;
    }

    public async Task<ImageBytes?> TryGetAsync(string key, CancellationToken ct)
    {
        if (!ImageKey.IsValid(key)) return null;

        try
        {
            var blob = _container.GetBlobClient(key);
            var response = await blob.DownloadContentAsync(ct);

            var contentType = response.Value.Details.ContentType;
            if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

            return new ImageBytes(response.Value.Content.ToArray(), contentType);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // Not migrated yet. The expected case until the import has run for every key,
            // so it is a miss rather than something to log.
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Storage is unreachable or misconfigured. Fall through to Quickbase rather than
            // failing the request — a degraded image path beats a broken one — but say so,
            // because otherwise a dead container looks exactly like a successful migration
            // that simply never gets hit.
            _log.LogWarning(ex, "Blob read failed for image key {Key}; falling back to Quickbase.", key);
            return null;
        }
    }

    /// <summary>
    /// Uploads one image, overwriting any existing blob. Used by the import command.
    /// Content type is stored on the blob so the read path can serve it back without sniffing.
    /// </summary>
    public async Task UploadAsync(string key, byte[] bytes, string contentType, CancellationToken ct)
    {
        if (!ImageKey.IsValid(key))
            throw new ArgumentException($"Refusing to upload an invalid image key: {key}", nameof(key));

        var blob = _container.GetBlobClient(key);
        using var stream = new MemoryStream(bytes, writable: false);

        await blob.UploadAsync(
            stream,
            new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = contentType },
            },
            ct);
    }

    /// <summary>True when the blob already exists, so the import can skip re-uploading it.</summary>
    public async Task<bool> ExistsAsync(string key, CancellationToken ct)
    {
        if (!ImageKey.IsValid(key)) return false;
        return await _container.GetBlobClient(key).ExistsAsync(ct);
    }
}
