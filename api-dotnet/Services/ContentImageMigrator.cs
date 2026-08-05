using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Services;

// Migrates the image URLs hard-coded in the frontend source.
//
// These are the majority of the site's photographs — homepage, delivery, interiors, steel
// houses, partner — and the API never sees them, so no amount of database migration touches
// them. They point straight at Quickbase, which makes them the hard gate on retiring it: the
// day Quickbase is switched off, every one of these becomes a broken image.
//
// A one-shot tool that rewrites source files, so it is deliberately conservative: it only
// replaces URLs it has successfully uploaded, and it is safe to re-run because a rewritten
// file no longer contains anything for it to match.
public sealed class ContentImageMigrator
{
    // Quickbase image URLs as they appear in the content files, quoted in JS string literals.
    private static readonly Regex UrlPattern = new(
        @"https://[A-Za-z0-9.-]*\.quickbase\.com/(?:up|files)/[^\s'""`)]+",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly string[] SourceExtensions = { ".js", ".jsx" };

    private readonly QuickbaseImageSource _source;
    private readonly BlobImageSource _blob;
    private readonly ImageProcessor _processor;
    private readonly EnvConfig _env;

    public ContentImageMigrator(
        QuickbaseImageSource source, BlobImageSource blob, ImageProcessor processor, EnvConfig env)
    {
        _source = source;
        _blob = blob;
        _processor = processor;
        _env = env;
    }

    public record Result(
        int FilesScanned,
        int UniqueUrls,
        int Uploaded,
        int AlreadyInBlob,
        int FilesRewritten,
        int ReferencesReplaced,
        long BytesSaved,
        List<string> Problems);

    public async Task<Result> MigrateAsync(string sourceRoot, bool dryRun, CancellationToken ct)
    {
        var problems = new List<string>();

        if (!Directory.Exists(sourceRoot))
        {
            problems.Add($"Source directory not found: {sourceRoot}");
            return new Result(0, 0, 0, 0, 0, 0, 0, problems);
        }

        var files = Directory
            .EnumerateFiles(sourceRoot, "*.*", SearchOption.AllDirectories)
            .Where(f => SourceExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
            .ToList();

        // One pass to find every distinct URL. The same photo appears in the BG, EN and EL
        // copies of a page, so uploading per occurrence would move the same bytes three times.
        var urls = new HashSet<string>(StringComparer.Ordinal);
        foreach (var file in files)
        foreach (Match match in UrlPattern.Matches(await File.ReadAllTextAsync(file, ct)))
            urls.Add(match.Value);

        var mapping = new Dictionary<string, string>(StringComparer.Ordinal);
        var uploaded = 0;
        var already = 0;
        long saved = 0;

        foreach (var url in urls)
        {
            ct.ThrowIfCancellationRequested();

            var sourceKey = ImageKey.TryNormalize(url, _env.Realm);
            if (sourceKey is null)
            {
                problems.Add($"not a recognised Quickbase attachment: {url}");
                continue;
            }

            try
            {
                var (bytes, notFound) = await _source.TryGetDetailedAsync(sourceKey, ct);
                if (bytes is null)
                {
                    // Left pointing at Quickbase rather than rewritten to a blob that does not
                    // exist: a URL that already 404s is a pre-existing problem, and swapping it
                    // for one that 404s differently would only hide it.
                    problems.Add(notFound
                        ? $"Quickbase has no attachment for {sourceKey} (404) — left unchanged"
                        : $"could not download {sourceKey} — left unchanged");
                    continue;
                }

                var processed = _processor.TryProcess(bytes.Bytes);
                var extension = processed?.Extension ?? Path.GetExtension(sourceKey);
                if (string.IsNullOrWhiteSpace(extension)) extension = ".jpg";

                var key = ImageKey.ContentKeyFor(sourceKey, extension);
                if (key is null)
                {
                    problems.Add($"could not derive a key for {sourceKey}");
                    continue;
                }

                if (await _blob.ExistsAsync(key, ct))
                {
                    already++;
                }
                else if (!dryRun)
                {
                    await _blob.UploadAsync(
                        key,
                        processed?.Bytes ?? bytes.Bytes,
                        processed?.ContentType ?? bytes.ContentType,
                        ct);
                    uploaded++;
                }
                else
                {
                    uploaded++;
                }

                saved += bytes.Bytes.Length - (processed?.Bytes.Length ?? bytes.Bytes.Length);
                mapping[url] = ImageKey.ToPublicPath(key);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                problems.Add($"{sourceKey} -> {ex.GetType().Name}: {ex.Message}");
            }
        }

        var rewritten = 0;
        var replaced = 0;

        foreach (var file in files)
        {
            var text = await File.ReadAllTextAsync(file, ct);
            var updated = text;
            var fileReplacements = 0;

            foreach (var (from, to) in mapping)
            {
                if (!updated.Contains(from, StringComparison.Ordinal)) continue;

                // Count before replacing, so the report reflects references rather than files.
                fileReplacements += CountOccurrences(updated, from);
                updated = updated.Replace(from, to, StringComparison.Ordinal);
            }

            if (fileReplacements == 0) continue;

            rewritten++;
            replaced += fileReplacements;

            if (!dryRun) await File.WriteAllTextAsync(file, updated, ct);
        }

        return new Result(files.Count, urls.Count, uploaded, already, rewritten, replaced, saved, problems);
    }

    private static int CountOccurrences(string haystack, string needle)
    {
        var count = 0;
        var index = 0;
        while ((index = haystack.IndexOf(needle, index, StringComparison.Ordinal)) >= 0)
        {
            count++;
            index += needle.Length;
        }
        return count;
    }
}
