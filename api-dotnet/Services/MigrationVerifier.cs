using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Microsoft.EntityFrameworkCore;

namespace Services;

// Answers the one question that gates the cutover: is every image the site will ask for
// actually in the Blob container?
//
// This replaces an earlier check that looked for Quickbase-shaped keys ("up/…"). That made
// sense while the plan was to move the same bytes under the same names, but the importers now
// MINT new keys ("gallery/{id}/{guid}.webp"), so the old check could never pass and reported
// every migrated image as missing. A verification step that always fails is worse than none —
// it trains you to ignore it.
//
// The two halves are checked from where the site actually reads them:
//   - gallery and cases  -> the image keys stored in SQL
//   - static site images -> the /api/img/content/… paths in the frontend source
public sealed class MigrationVerifier
{
    private static readonly Regex ContentPath = new(
        @"/api/img/(content/[A-Za-z0-9._~/-]+)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly string[] SourceExtensions = { ".js", ".jsx" };

    private readonly AppDbContext _db;
    private readonly BlobImageSource _blob;

    public MigrationVerifier(AppDbContext db, BlobImageSource blob)
    {
        _db = db;
        _blob = blob;
    }

    public record Section(string Name, int Checked, int Present, List<string> Missing);

    public record Report(string Container, List<Section> Sections)
    {
        public int TotalMissing => Sections.Sum(s => s.Missing.Count);
    }

    public async Task<Report> VerifyAsync(string? frontendSourceRoot, CancellationToken ct)
    {
        var sections = new List<Section>
        {
            await CheckAsync("gallery", await GalleryKeysAsync(ct), ct),
            await CheckAsync("cases", await CaseKeysAsync(ct), ct),
        };

        if (!string.IsNullOrWhiteSpace(frontendSourceRoot) && Directory.Exists(frontendSourceRoot))
            sections.Add(await CheckAsync("site content", ContentKeys(frontendSourceRoot), ct));
        else
            sections.Add(new Section("site content", 0, 0,
                new List<string> { $"frontend source not found at '{frontendSourceRoot}' — content images NOT verified" }));

        return new Report(_blob.ContainerName, sections);
    }

    private async Task<List<string>> GalleryKeysAsync(CancellationToken ct) =>
        await _db.HouseImages
            .AsNoTracking()
            .Where(i => i.ImageKey != "")
            .Select(i => i.ImageKey)
            .Distinct()
            .ToListAsync(ct);

    private async Task<List<string>> CaseKeysAsync(CancellationToken ct)
    {
        var gallery = await _db.CaseImages.AsNoTracking()
            .Where(i => i.ImageKey != "").Select(i => i.ImageKey).ToListAsync(ct);

        // Logo and cover live on the case row rather than in CaseImages, so they need pulling
        // out separately — and they are exactly the sort of thing a check like this misses.
        var singles = await _db.Cases.AsNoTracking()
            .Select(c => new { c.CompanyLogoImageKey, c.CoverImageKey })
            .ToListAsync(ct);

        return gallery
            .Concat(singles.Select(s => s.CompanyLogoImageKey))
            .Concat(singles.Select(s => s.CoverImageKey))
            .Where(k => !string.IsNullOrWhiteSpace(k))
            .Select(k => k!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    private static List<string> ContentKeys(string root)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);

        foreach (var file in Directory
                     .EnumerateFiles(root, "*.*", SearchOption.AllDirectories)
                     .Where(f => SourceExtensions.Contains(Path.GetExtension(f).ToLowerInvariant())))
        {
            foreach (Match match in ContentPath.Matches(File.ReadAllText(file)))
                keys.Add(Uri.UnescapeDataString(match.Groups[1].Value));
        }

        return keys.ToList();
    }

    private async Task<Section> CheckAsync(string name, List<string> keys, CancellationToken ct)
    {
        var missing = new List<string>();
        var guard = new object();

        using var gate = new SemaphoreSlim(8);

        await Task.WhenAll(keys.Select(async key =>
        {
            await gate.WaitAsync(ct);
            try
            {
                if (!await _blob.ExistsAsync(key, ct))
                    lock (guard) missing.Add(key);
            }
            finally { gate.Release(); }
        }));

        return new Section(name, keys.Count, keys.Count - missing.Count, missing);
    }
}
