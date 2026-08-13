using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Blob storage for files attached to lead conversations.
///
/// A SEPARATE container from images, and that is the whole point of this class existing.
/// `/api/img/{key}` is unauthenticated by design — it serves the public site — so anything
/// sharing that container is reachable by anyone who guesses a path. Customer surveys,
/// contracts and site photos cannot live there. Different container, private access, and
/// the only way out is through an endpoint behind AdminOnly.
/// </summary>
public sealed class LeadFileStore
{
    private readonly EnvConfig _env;
    private readonly ILogger<LeadFileStore> _log;
    private readonly BlobContainerClient? _container;

    public LeadFileStore(EnvConfig env, ILogger<LeadFileStore> log)
    {
        _env = env;
        _log = log;

        // Built here rather than injected: BlobContainerClient is already registered as a
        // singleton for the images container, and two registrations of the same type is a
        // DI puzzle that buys nothing over one constructor call.
        if (env.BlobConfigured)
            _container = new BlobContainerClient(env.BlobConnectionString, env.LeadFilesContainer);
    }

    public bool IsConfigured => _container is not null;

    // 20 MB. Above this the message is likely to bounce at the far end anyway — Exchange
    // and most receiving servers cap attachments well below what a browser will upload —
    // so refusing here gives a clear error instead of a send that fails later.
    public const long MaxBytes = 20L * 1024 * 1024;

    // The ceiling for files that go OUT with a reply, which is a different and much lower
    // number than what may be stored against a thread.
    //
    // 3 MB is Graph's own limit for attaching a file to a message in a single request;
    // past it the API requires an upload session, which is a different protocol and a
    // meaningful amount of machinery for a case sales can solve in one sentence ("I have
    // put it on a link"). Checked before anything is sent, because finding out at send
    // time means a lost draft.
    //
    // The total counts too: Graph rejects a message whose parts together exceed its size
    // limit, so four 2 MB drawings pass every per-file check and still bounce.
    public const long MaxEmailBytes = 3L * 1024 * 1024;

    // Allow-list, not a block-list. A block-list of "dangerous" types is a game you lose:
    // the useful set here is small and known, so anything outside it is refused rather
    // than guessed about.
    private static readonly Dictionary<string, string> AllowedByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".webp"] = "image/webp",
        [".heic"] = "image/heic",
        [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xls"] = "application/vnd.ms-excel",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".dwg"] = "application/acad",
        [".dxf"] = "application/dxf",
        [".zip"] = "application/zip",
        [".txt"] = "text/plain",
        [".csv"] = "text/csv",
    };

    public static bool IsAllowed(string fileName, out string contentType)
    {
        contentType = "application/octet-stream";
        if (string.IsNullOrWhiteSpace(fileName)) return false;

        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(ext)) return false;

        return AllowedByExtension.TryGetValue(ext, out contentType!);
    }

    /// <summary>
    /// Mints the storage key for a file.
    ///
    /// NEVER derived from the customer's filename. That is untrusted input: as a key it
    /// invites traversal ("../../"), and it collides the moment two people both attach
    /// "scan.pdf". The original name is kept in SQL for display and for re-sending, where
    /// it is data rather than a path.
    /// </summary>
    public static string MintKey(int leadId, string fileName)
    {
        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(ext) || ext.Length > 12) ext = "";

        // Lower-cased so the key is stable across the case-insensitive filesystems people
        // upload from and the case-sensitive store it lands in.
        return $"leads/{leadId}/{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
    }

    public async Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct)
    {
        if (_container is null) throw new InvalidOperationException("Blob storage is not configured.");

        // PublicAccessType.None: even if someone later points a CDN or a public route at
        // this container, the container itself refuses anonymous reads.
        await _container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);

        var blob = _container.GetBlobClient(key);
        await blob.UploadAsync(
            content,
            new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = contentType,

                    // Stored on the blob as well as sent by the download endpoint, so the
                    // file cannot render inline even if it is ever fetched another way.
                    ContentDisposition = "attachment",
                },
            },
            ct);
    }

    public async Task<(Stream Content, string ContentType)?> TryOpenAsync(string key, CancellationToken ct)
    {
        if (_container is null) return null;

        try
        {
            var blob = _container.GetBlobClient(key);
            var response = await blob.DownloadStreamingAsync(cancellationToken: ct);

            var contentType = response.Value.Details.ContentType;
            if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

            return (response.Value.Content, contentType);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // The row exists but the object does not — worth saying, because it means the
            // upload half-failed and the panel is showing a file nobody can open.
            _log.LogWarning("Lead attachment blob missing for key {Key}", key);
            return null;
        }
    }
}
