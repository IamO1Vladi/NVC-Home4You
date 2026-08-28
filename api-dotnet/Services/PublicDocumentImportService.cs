using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>
/// Stage 3 of ROADMAP #16: carries the six brochure PDFs from the SPA's public folder into
/// Blob and SQL, once. `dotnet run -- import-brochures [--dry-run] [--dir path]`.
///
/// Idempotent the way every importer here is, and in the same direction: a slug that
/// already has a Bulgarian row is SKIPPED, never overwritten. After the cutover the panel
/// owns those rows — someone may have replaced a catalogue since, and a re-run of this
/// command must not quietly restore last season's edition.
/// </summary>
public class PublicDocumentImportService
{
    private readonly AppDbContext _db;
    private readonly PublicDocumentStore _store;

    public PublicDocumentImportService(AppDbContext db, PublicDocumentStore store)
    {
        _db = db;
        _store = store;
    }

    public record Source(string Slug, string FileName, string Title);

    // The six, keyed to the exact file names the content files carry — Cyrillic, spaces,
    // typographic quotes and all. These names are why the slug column exists: they are
    // fine as labels and exactly wrong as addresses.
    public static readonly IReadOnlyList<Source> TheSix = new[]
    {
        new Source(PublicDocumentSlugs.ModularBuilds, "modular-builds.pdf", "Модулни сгради — общ каталог"),
        new Source(PublicDocumentSlugs.StandardContainers, "Стандартни контейнери.pdf", "Стандартни контейнери"),
        new Source(PublicDocumentSlugs.VillaOffice, "Вила-Офис.pdf", "Вила-Офис"),
        new Source(PublicDocumentSlugs.SlopedRoof, "Скосен покрив.pdf", "Скосен покрив"),
        new Source(PublicDocumentSlugs.SpaceCapsules, "Космически Капсули.pdf", "Космически Капсули"),
        new Source(PublicDocumentSlugs.BoxHouse, "Разгъваеми “Бокс” Къща.pdf", "Разгъваеми „Бокс“ къща"),
    };

    public record ImportResult(int Imported, int Skipped, List<string> Problems);

    /// <summary>
    /// Everything lands as the Bulgarian edition — the six files ARE the Bulgarian
    /// editions; the EN and EL translations arrive later through the panel (owner,
    /// 2026-08-20, answer 4) and the public route falls back to bg until they do.
    /// </summary>
    public async Task<ImportResult> ImportAsync(string dir, bool dryRun, CancellationToken ct)
    {
        var imported = 0;
        var skipped = 0;
        var problems = new List<string>();

        foreach (var source in TheSix)
        {
            var exists = await _db.PublicDocuments
                .AnyAsync(d => d.Slug == source.Slug && d.Lang == "bg", ct);
            if (exists)
            {
                // The panel owns this row now; restoring the import copy over a
                // replacement somebody made would be the quiet kind of data loss.
                skipped++;
                continue;
            }

            var path = Path.Combine(dir, source.FileName);
            if (!File.Exists(path))
            {
                problems.Add($"{source.Slug}: '{source.FileName}' not found in {dir}");
                continue;
            }

            var size = new FileInfo(path).Length;

            if (!dryRun)
            {
                var key = PublicDocumentStore.MintKey();
                await using (var stream = File.OpenRead(path))
                {
                    await _store.UploadAsync(key, stream, ct);
                }

                _db.PublicDocuments.Add(new PublicDocument
                {
                    Slug = source.Slug,
                    Lang = "bg",
                    Title = source.Title,
                    FileName = source.FileName,
                    BlobKey = key,
                    SizeBytes = size,
                    ContentType = "application/pdf",
                    SortOrder = PublicDocumentSlugs.WiredOrder(source.Slug),
                });
                // Saved per document rather than once at the end, so a failure mid-run
                // leaves complete rows behind it and the re-run skips them.
                await _db.SaveChangesAsync(ct);
            }

            imported++;
        }

        return new ImportResult(imported, skipped, problems);
    }
}
