using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

// Copies the Quickbase cases table into SQL and its attachments into Blob.
//
// Same shape as GalleryImportService, with two differences that matter:
//
//   - It imports UNPUBLISHED cases too (see CasesPageService.LoadForImportAsync). Leaving
//     them behind would strand drafts in a system about to be switched off.
//   - Visibility comes from three Quickbase fields, not one. The full chain is applied here,
//     so a case that was live only because of its visibility status stays live.
//
// Idempotent: cases match on Quickbase record id, images on SourceKey.
public sealed class CasesImportService
{
    private const int Concurrency = 3;

    private readonly CasesPageService _cases;
    private readonly QuickbaseImageSource _source;
    private readonly BlobImageSource _blob;
    private readonly ImageProcessor _processor;
    private readonly AppDbContext _db;
    private readonly EnvConfig _env;

    public CasesImportService(
        CasesPageService cases,
        QuickbaseImageSource source,
        BlobImageSource blob,
        ImageProcessor processor,
        AppDbContext db,
        EnvConfig env)
    {
        _cases = cases;
        _source = source;
        _blob = blob;
        _processor = processor;
        _db = db;
        _env = env;
    }

    public record ImportResult(
        int CasesFetched,
        int CasesInserted,
        int CasesUpdated,
        int ImagesUploaded,
        int ImagesAlreadyPresent,
        List<string> Problems);

    public async Task<ImportResult> ImportAsync(bool dryRun, CancellationToken ct)
    {
        var rows = await _cases.LoadForImportAsync(ct);
        var problems = new List<string>();

        var existing = await _db.Cases
            .Include(c => c.Images)
            .Where(c => c.QuickbaseRecordId != null)
            .ToDictionaryAsync(c => c.QuickbaseRecordId!.Value, ct);

        var inserted = 0;
        var updated = 0;
        var uploaded = 0;
        var present = 0;

        foreach (var row in rows)
        {
            ct.ThrowIfCancellationRequested();

            if (!existing.TryGetValue(row.QuickbaseRecordId, out var entity))
            {
                entity = new Case { QuickbaseRecordId = row.QuickbaseRecordId, CreatedAt = DateTimeOffset.UtcNow };
                _db.Cases.Add(entity);
                existing[row.QuickbaseRecordId] = entity;
                inserted++;
            }
            else
            {
                updated++;
            }

            // Three Quickbase fields collapse into one column. Reading only Publish here would
            // silently unpublish every case that was live via its visibility status.
            entity.IsPublished = CaseFormulas.IsPublicDuringImport(row.Publish, row.IsPublicFlag, row.VisibilityStatus);

            entity.Featured = row.Featured;
            entity.SortOrder = row.SortOrder;
            entity.CompanyName = row.CompanyName;
            entity.CompanySector = row.CompanySector;
            entity.BuyerName = row.BuyerName;
            entity.BuyerRole = row.BuyerRole;
            entity.Country = row.Country;
            entity.City = row.City;
            entity.CategoryKey = CaseCategories.Normalize(row.CategoryKey);
            entity.ProductName = row.ProductName;
            entity.ProductVariant = row.ProductVariant;
            entity.UnitsQty = row.UnitsQty;
            entity.Year = row.Year;
            entity.DeliveredAt = row.DeliveredAt;
            entity.Scope = row.Scope;
            entity.Result = row.Result;
            entity.PublicQuote = row.PublicQuote;
            entity.RatingSnapshot = row.RatingSnapshot;
            entity.UpdatedAt = DateTimeOffset.UtcNow;

            // The case id is part of every blob key it owns, so a new row must exist first.
            if (entity.Id == 0 && !dryRun) await _db.SaveChangesAsync(ct);

            // Logo and cover are single attachments on the case row, not child images, so they
            // are migrated as their own fields — which is also how the admin panel will edit
            // them. Their keys are recorded on the case rather than in CaseImages.
            entity.CompanyLogoImageKey = await MigrateSingleAsync(
                entity, row.CompanyLogoUrl, entity.CompanyLogoImageKey, "logo", dryRun, problems, ct)
                ?? entity.CompanyLogoImageKey;

            entity.CoverImageKey = await MigrateSingleAsync(
                entity, row.CoverImageUrl, entity.CoverImageKey, "cover", dryRun, problems, ct)
                ?? entity.CoverImageKey;

            var (up, alreadyThere) = await MigrateGalleryAsync(entity, row.ImageUrls, dryRun, problems, ct);
            uploaded += up;
            present += alreadyThere;
        }

        if (!dryRun) await _db.SaveChangesAsync(ct);

        return new ImportResult(rows.Count, inserted, updated, uploaded, present, problems);
    }

    // Returns the new key, or null when nothing changed / nothing to do.
    private async Task<string?> MigrateSingleAsync(
        Case entity, string? url, string? currentKey, string label,
        bool dryRun, List<string> problems, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        var sourceKey = ImageKey.TryNormalize(url, _env.Realm);
        if (sourceKey is null)
        {
            problems.Add($"case {entity.QuickbaseRecordId}: {label} URL not recognised: {Truncate(url)}");
            return null;
        }

        // Already ours — nothing to re-download. There is no SourceKey column for these two,
        // so "already migrated" is inferred from the key we own having been written.
        if (currentKey is not null && ImageKey.IsOwned(currentKey)) return null;

        try
        {
            var (bytes, notFound) = await _source.TryGetDetailedAsync(sourceKey, ct);
            if (bytes is null)
            {
                // Quickbase produces an attachment URL even for an empty file field (version
                // "v0"), so a 404 here means the case simply has no logo/cover — ordinary
                // data, not a migration failure. It is also a small live bug being fixed:
                // today the page emits that dead URL and the browser 404s on it. After
                // migration the field is just absent.
                if (!notFound)
                    problems.Add($"case {entity.QuickbaseRecordId}: could not download {label} {Truncate(sourceKey)}");

                return null;
            }

            if (dryRun) return null;

            var processed = _processor.TryProcess(bytes.Bytes);
            var blobKey = ImageKey.NewOwnedKey(
                ImageKey.CasesScope, entity.Id, FileNameFrom(sourceKey), processed?.Extension);

            await _blob.UploadAsync(
                blobKey,
                processed?.Bytes ?? bytes.Bytes,
                processed?.ContentType ?? bytes.ContentType,
                ct);

            return blobKey;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            problems.Add($"case {entity.QuickbaseRecordId}: {label} {Truncate(sourceKey)} -> {ex.GetType().Name}: {ex.Message}");
            return null;
        }
    }

    private async Task<(int Uploaded, int Present)> MigrateGalleryAsync(
        Case entity, IReadOnlyList<string> urls, bool dryRun, List<string> problems, CancellationToken ct)
    {
        var bySource = entity.Images
            .Where(i => i.SourceKey is not null)
            .ToDictionary(i => i.SourceKey!, StringComparer.Ordinal);

        var uploaded = 0;
        var present = 0;
        var order = 0;

        using var gate = new SemaphoreSlim(Concurrency);
        var work = new List<Task>();
        var guard = new object();

        foreach (var url in urls)
        {
            var sourceKey = ImageKey.TryNormalize(url, _env.Realm);
            if (sourceKey is null)
            {
                problems.Add($"case {entity.QuickbaseRecordId}: image URL not recognised: {Truncate(url)}");
                continue;
            }

            var position = order++;

            if (bySource.TryGetValue(sourceKey, out var already))
            {
                already.SortOrder = position;
                present++;
                continue;
            }

            work.Add(OneAsync(sourceKey, position));
        }

        await Task.WhenAll(work);
        return (uploaded, present);

        async Task OneAsync(string sourceKey, int position)
        {
            await gate.WaitAsync(ct);
            try
            {
                var bytes = await _source.TryGetAsync(sourceKey, ct);
                if (bytes is null)
                {
                    lock (guard) problems.Add($"case {entity.QuickbaseRecordId}: could not download {Truncate(sourceKey)}");
                    return;
                }

                if (dryRun)
                {
                    lock (guard) uploaded++;
                    return;
                }

                // Converted on the way in, so the migration lands optimised images rather than
                // moving the heavy originals and needing a second pass later.
                var processed = _processor.TryProcess(bytes.Bytes);

                var blobKey = ImageKey.NewOwnedKey(
                    ImageKey.CasesScope, entity.Id, FileNameFrom(sourceKey), processed?.Extension);

                await _blob.UploadAsync(
                    blobKey,
                    processed?.Bytes ?? bytes.Bytes,
                    processed?.ContentType ?? bytes.ContentType,
                    ct);

                lock (guard)
                {
                    entity.Images.Add(new CaseImage
                    {
                        ImageKey = blobKey,
                        SourceKey = sourceKey,
                        SortOrder = position,
                        CreatedAt = DateTimeOffset.UtcNow,
                    });
                    uploaded++;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                lock (guard) problems.Add($"case {entity.QuickbaseRecordId}: {Truncate(sourceKey)} -> {ex.GetType().Name}: {ex.Message}");
            }
            finally
            {
                gate.Release();
            }
        }
    }

    private static string FileNameFrom(string sourceKey)
    {
        var slash = sourceKey.LastIndexOf('/');
        return slash >= 0 && slash < sourceKey.Length - 1 ? sourceKey[(slash + 1)..] : sourceKey;
    }

    private static string Truncate(string? value, int max = 120)
    {
        if (string.IsNullOrEmpty(value)) return "";
        return value.Length <= max ? value : value[..max] + "…";
    }
}
