using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

// Copies the Quickbase houses table into SQL, and each house's attachments into Blob.
//
// Reads through GalleryService rather than querying Quickbase directly, so the import sees
// exactly what the live gallery sees — same field ids, same attachment resolution, same
// ordering. A second query written here could drift from the one being migrated away from,
// and the difference would only show as missing images after the cutover.
//
// Idempotent: safe to run repeatedly while both systems are live. Houses match on Quickbase
// record id, images on SourceKey.
public sealed class GalleryImportService
{
    // Images are downloaded from Quickbase and uploaded to Blob one at a time within a house.
    // Quickbase is the thing being migrated off and is serving the live site meanwhile, so
    // there is no reason to pull hard on it.
    private const int Concurrency = 3;

    private readonly GalleryService _gallery;
    private readonly QuickbaseImageSource _source;
    private readonly BlobImageSource _blob;
    private readonly AppDbContext _db;
    private readonly EnvConfig _env;

    public GalleryImportService(
        GalleryService gallery,
        QuickbaseImageSource source,
        BlobImageSource blob,
        AppDbContext db,
        EnvConfig env)
    {
        _gallery = gallery;
        _source = source;
        _blob = blob;
        _db = db;
        _env = env;
    }

    public record ImportResult(
        int HousesFetched,
        int HousesInserted,
        int HousesUpdated,
        int ImagesUploaded,
        int ImagesAlreadyPresent,
        List<string> Problems);

    public async Task<ImportResult> ImportAsync(bool dryRun, CancellationToken ct)
    {
        var items = await _gallery.GetAsync(ct);

        var problems = new List<string>();

        // Category is mandatory and CategoryKey is NOT NULL, so an unmappable value cannot be
        // stored. Checked up front and the whole run refused, rather than importing the good
        // rows and leaving a handful behind: a partial gallery is harder to notice than a
        // failed command, because the page still looks fine.
        var unmapped = items
            .Where(i => HouseCategories.FromQuickbaseLabel(i.Category) is null)
            .Select(i => $"house {i.Id} \"{Truncate(i.Title)}\" has category \"{i.Category}\", which maps to none of: {string.Join(", ", HouseCategories.All)}")
            .ToList();

        if (unmapped.Count > 0)
        {
            problems.AddRange(unmapped);
            return new ImportResult(items.Count, 0, 0, 0, 0, problems);
        }

        var existing = await _db.Houses
            .Include(h => h.Images)
            .Where(h => h.QuickbaseRecordId != null)
            .ToDictionaryAsync(h => h.QuickbaseRecordId!.Value, ct);

        var inserted = 0;
        var updated = 0;
        var uploaded = 0;
        var alreadyPresent = 0;

        var sortOrder = 0;

        foreach (var item in items)
        {
            ct.ThrowIfCancellationRequested();

            if (!existing.TryGetValue(item.Id, out var house))
            {
                house = new House { QuickbaseRecordId = item.Id, CreatedAt = DateTimeOffset.UtcNow };
                _db.Houses.Add(house);
                existing[item.Id] = house;
                inserted++;
            }
            else
            {
                updated++;
            }

            house.Title = item.Title ?? "";
            house.TitleBg = item.TitleBg;
            house.TitleEl = item.TitleEl;
            house.Description = item.Description ?? "";
            house.DescriptionBg = item.DescriptionBg;
            house.DescriptionEl = item.DescriptionEl;
            house.Price = item.Price;
            house.Currency = string.IsNullOrWhiteSpace(item.Currency) ? "EUR" : item.Currency;
            house.CategoryKey = HouseCategories.FromQuickbaseLabel(item.Category)!;
            house.CatalogId = item.CatalogId;
            house.SortOrder = sortOrder++;
            house.UpdatedAt = DateTimeOffset.UtcNow;

            // Quickbase has no publish flag on this table, so everything it holds is live.
            // Only set on insert: flipping a house to unpublished in the admin panel must not
            // be undone by the next import while both systems are still running.
            if (house.Id == 0) house.IsPublished = true;

            // The house id is part of the blob key, so a new house has to exist before its
            // images can be named. Cheap: one round trip per import, not per image.
            if (house.Id == 0 && !dryRun) await _db.SaveChangesAsync(ct);

            var (up, present, imageProblems) = await ImportImagesAsync(house, item.Images, dryRun, ct);
            uploaded += up;
            alreadyPresent += present;
            problems.AddRange(imageProblems);
        }

        if (!dryRun) await _db.SaveChangesAsync(ct);

        return new ImportResult(items.Count, inserted, updated, uploaded, alreadyPresent, problems);
    }

    private async Task<(int Uploaded, int Present, List<string> Problems)> ImportImagesAsync(
        House house, IReadOnlyList<string> urls, bool dryRun, CancellationToken ct)
    {
        var problems = new List<string>();
        var uploaded = 0;
        var present = 0;

        // Keyed by SourceKey: what has already been imported for this house.
        var bySource = house.Images
            .Where(i => i.SourceKey is not null)
            .ToDictionary(i => i.SourceKey!, StringComparer.Ordinal);

        var order = 0;
        using var gate = new SemaphoreSlim(Concurrency);
        var work = new List<Task>();
        var guard = new object();

        foreach (var url in urls)
        {
            var sourceKey = ImageKey.TryNormalize(url, _env.Realm);
            if (sourceKey is null)
            {
                problems.Add($"house {house.QuickbaseRecordId}: image URL not recognised as a Quickbase attachment: {Truncate(url)}");
                continue;
            }

            var position = order++;

            if (bySource.TryGetValue(sourceKey, out var already))
            {
                // Already migrated. Keep ordering in step with Quickbase, but do not
                // re-download bytes that cannot have changed — the attachment version is part
                // of the source key, so a changed image arrives as a different key.
                already.SortOrder = position;
                present++;
                continue;
            }

            work.Add(ImportOneAsync(sourceKey, position));
        }

        await Task.WhenAll(work);
        return (uploaded, present, problems);

        async Task ImportOneAsync(string sourceKey, int position)
        {
            await gate.WaitAsync(ct);
            try
            {
                // Downloaded even on a dry run: "can every attachment actually be fetched from
                // Quickbase?" is the question most worth answering before committing to the
                // real run, and it is the step most likely to fail.
                var bytes = await _source.TryGetAsync(sourceKey, ct);
                if (bytes is null)
                {
                    lock (guard) problems.Add($"house {house.QuickbaseRecordId}: could not download {Truncate(sourceKey)}");
                    return;
                }

                if (dryRun)
                {
                    // No key is minted here. A house being inserted has no id until it is
                    // saved, and the blob key is built from that id — so on a dry run there is
                    // genuinely nothing to name the blob after. Counting it as "would upload"
                    // is the honest report.
                    lock (guard) uploaded++;
                    return;
                }

                var blobKey = ImageKey.NewOwnedKey(ImageKey.GalleryScope, house.Id, FileNameFrom(sourceKey));
                await _blob.UploadAsync(blobKey, bytes.Bytes, bytes.ContentType, ct);

                lock (guard)
                {
                    house.Images.Add(new HouseImage
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
                lock (guard) problems.Add($"house {house.QuickbaseRecordId}: {Truncate(sourceKey)} -> {ex.GetType().Name}: {ex.Message}");
            }
            finally
            {
                gate.Release();
            }
        }
    }

    // Only for its extension: NewOwnedKey generates the filename and accepts only a known-safe
    // extension, so nothing attacker-controlled survives into the blob name.
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
