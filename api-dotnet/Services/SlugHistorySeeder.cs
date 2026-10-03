using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Services;

/// <summary>
/// Fills HouseSlugHistory, once, with the addresses houses lost BEFORE #37 kept them:
/// `dotnet run -- seed-slug-history` (with `--dry-run` to only list them). Two sources:
///
/// 1. RETITLES MADE IN THE PANEL, from Одит. Every House edit is audited with the old and new
///    value of each field that changed (AuditInterceptor). Starting from each house's CURRENT
///    titles and walking its audited edits newest first, undoing each one gives the titles it
///    had before, and the addresses those made in each locale. Wherever an edit moved an
///    address, the old one is a candidate, with the edit's date and author. Addresses are
///    computed from whole title SETS, not from the one field that changed, which is what
///    gets the fallbacks right: a Bulgarian page with no TitleBg is addressed by the English
///    title, so an English retitle moved it too.
/// 2. GallerySlugs.RetiredSlugs, the three Quickbase-era corrections, so they follow their
///    house through any later rename like every other old address, and show in the panel.
///    The hand-kept list stays as a fallback either way.
///
/// What it will not invent:
/// - A replay that does not line up stops for that house, with a warning. That is caught
///   when a logged edit's "to" value is not what the house held at that point, and, for a
///   house created since the log began (2026-08-18), when the titles the replay arrives at
///   are not the ones its creation record holds. A title changed outside the log (a direct
///   SQL fix, or a gap the interceptor reported) on a house OLDER than the log, in a field
///   no later logged edit touches, cannot be seen; for those the Bulgarian and Greek
///   fallback addresses are only as right as the log is complete.
/// - A value the log cut short (AuditRedaction.MaxValueChars) cannot be undone. Titles are
///   rarely that long.
/// - Retitles made in Quickbase before the SQL cutover are not in the log at all.
///
/// Never overwrites: an address already in the history is left alone, and so is one served
/// today, by the same house or by another PUBLISHED house, under the same rule
/// GalleryAdminService writes by. Where two houses lost the same address, a house published
/// today wins over a draft, then the most recent loss. And an address another house held
/// AFTER it was given up (even one since deleted) is not recorded but reported, since the
/// live writer would have released it. Safe to re-run; a second run adds nothing.
/// </summary>
public sealed class SlugHistorySeeder
{
    private readonly AppDbContext _db;

    public SlugHistorySeeder(AppDbContext db) => _db = db;

    public sealed record HouseTitles(
        int Id, long? QuickbaseRecordId, string Title, string? TitleBg, string? TitleEl, bool IsPublished = true);

    public sealed record AuditedEdit(
        int AuditId, string HouseId, DateTimeOffset OccurredAt, string? ActorUpn, string ChangesJson,
        string Action = AuditActions.Updated);

    public sealed record Candidate(
        int HouseId, string Locale, string Slug, DateTimeOffset RetiredAt, string? RetiredByUpn, string FromTitle);

    public sealed record Outcome(
        List<Candidate> Added,
        List<Candidate> AlreadyKnown,
        List<Candidate> ServedToday,
        List<string> Warnings);

    /// <summary>
    /// When the three RetiredSlugs corrections were made and verified live (HANDOFF: "the two
    /// title fixes are done", 2026-08-19). The panel shows this date beside them.
    /// </summary>
    public static readonly DateTimeOffset RetiredSlugsDate = new(2026, 8, 19, 0, 0, 0, TimeSpan.Zero);

    public async Task<Outcome> RunAsync(bool dryRun, CancellationToken ct)
    {
        var houses = await _db.Houses.AsNoTracking()
            .Select(h => new HouseTitles(h.Id, h.QuickbaseRecordId, h.Title, h.TitleBg, h.TitleEl, h.IsPublished))
            .ToListAsync(ct);

        // Deleted entries too: a house since deleted may have held an address after another
        // gave it up (see TakenSince).
        var edits = await _db.AuditEntries.AsNoTracking()
            .Where(a => a.EntityType == nameof(House))
            .Select(a => new AuditedEdit(a.Id, a.EntityId, a.OccurredAt, a.ActorUpn, a.ChangesJson, a.Action))
            .ToListAsync(ct);

        var (fromLog, warnings) = Replay(houses, edits);
        var (fromList, listWarnings) = FromRetiredSlugs(houses);
        warnings.AddRange(listWarnings);

        var published = houses.ToDictionary(h => h.Id, h => h.IsPublished);
        var candidates = new List<Candidate>();
        foreach (var c in PickPerAddress(fromLog.Concat(fromList), published))
        {
            if (TakenSince(c, edits) is { } by)
            {
                warnings.Add($"{c.Locale} \"{c.Slug}\" (house #{c.HouseId} gave it up {c.RetiredAt:yyyy-MM-dd}): house #{by} " +
                             "had a title making that address afterwards, so the address may have been its page since. " +
                             "Not recorded; add it by hand if it should still redirect.");
                continue;
            }
            candidates.Add(c);
        }

        var servedBy = new Dictionary<(string Locale, string Slug), List<HouseTitles>>();
        foreach (var h in houses)
        {
            foreach (var (locale, slug) in SlugsOf(h))
            {
                if (!servedBy.TryGetValue((locale, slug), out var list)) servedBy[(locale, slug)] = list = new();
                list.Add(h);
            }
        }

        var known = (await _db.HouseSlugHistory.AsNoTracking()
                .Select(x => new { x.Locale, x.Slug })
                .ToListAsync(ct))
            .Select(x => (x.Locale, x.Slug))
            .ToHashSet();

        var outcome = new Outcome(new(), new(), new(), warnings);

        foreach (var c in candidates)
        {
            var holders = servedBy.TryGetValue((c.Locale, c.Slug), out var hs) ? hs : new List<HouseTitles>();
            var served = holders.Any(h => h.Id == c.HouseId || h.IsPublished);

            if (served) outcome.ServedToday.Add(c);
            else if (known.Contains((c.Locale, c.Slug))) outcome.AlreadyKnown.Add(c);
            else outcome.Added.Add(c);
        }

        if (!dryRun && outcome.Added.Count > 0)
        {
            _db.HouseSlugHistory.AddRange(outcome.Added.Select(c => new HouseSlugHistory
            {
                HouseId = c.HouseId,
                Locale = c.Locale,
                Slug = c.Slug,
                RetiredAt = c.RetiredAt,
                RetiredByUpn = c.RetiredByUpn,
            }));
            await _db.SaveChangesAsync(ct);
        }

        return outcome;
    }

    /// <summary>
    /// The replay itself, over plain rows — public so it can be pinned without a database.
    /// One candidate per (locale, slug): if an address was given up more than once, the most
    /// recent loss wins, matching the one-house-per-address rule of the live writer.
    /// </summary>
    public static (List<Candidate> Candidates, List<string> Warnings) Replay(
        IReadOnlyList<HouseTitles> houses, IReadOnlyList<AuditedEdit> edits)
    {
        var found = new List<Candidate>();
        var warnings = new List<string>();

        var byHouse = edits.GroupBy(e => e.HouseId).ToDictionary(g => g.Key, g => g.ToList());

        foreach (var house in houses)
        {
            if (!byHouse.TryGetValue(house.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), out var history))
                continue;

            var updates = history
                .Where(e => e.Action == AuditActions.Updated)
                .OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.AuditId)
                .ToList();
            var created = history
                .Where(e => e.Action == AuditActions.Created)
                .OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.AuditId)
                .FirstOrDefault();

            var mine = new List<Candidate>();
            var state = house;
            var broken = false;

            foreach (var edit in updates)
            {
                var changes = TitleChanges(edit.ChangesJson);
                if (changes.Count == 0) continue;

                string? mismatch = null;
                foreach (var (field, from, to) in changes)
                {
                    if (!SameAsLogged(Get(state, field), to))
                    {
                        mismatch = $"house #{house.Id} ({house.Title}): the log says {field} became \"{to}\" on " +
                                   $"{edit.OccurredAt:yyyy-MM-dd}, but the title it had next was \"{Get(state, field)}\". " +
                                   "Something changed it outside the log, so its history before that was not used.";
                        break;
                    }
                    if (IsCut(from))
                    {
                        mismatch = $"house #{house.Id} ({house.Title}): its {field} before {edit.OccurredAt:yyyy-MM-dd} " +
                                   $"was longer than the log keeps (\"{from}\"), so its history before that was not used.";
                        break;
                    }
                }

                if (mismatch is not null)
                {
                    warnings.Add(mismatch);
                    broken = true;
                    break;
                }

                var before = state;
                foreach (var (field, from, _) in changes) before = Set(before, field, from);

                var slugsBefore = SlugsOf(before);
                var slugsAfter = SlugsOf(state);
                foreach (var (locale, _) in GallerySlugs.Locales)
                {
                    var oldSlug = slugsBefore[locale];
                    if (oldSlug == slugsAfter[locale]) continue;
                    if (oldSlug.Length > HouseSlugHistory.MaxSlugLength) continue;

                    mine.Add(new Candidate(house.Id, locale, oldSlug, edit.OccurredAt, edit.ActorUpn,
                        GallerySlugs.TitleFor(ToItem(before), locale)));
                }

                state = before;
            }

            // A house created since the log began has a full record of its first titles. If
            // the replay does not arrive there, something changed a title outside the log, and
            // no candidate for this house can be trusted.
            if (!broken && created is not null)
            {
                var first = CreatedTitles(created.ChangesJson);
                var off = TitleFields.FirstOrDefault(f => !SameAsLogged(Get(state, f), first.GetValueOrDefault(f)));
                if (off is not null)
                {
                    warnings.Add($"house #{house.Id} ({house.Title}): replaying its log arrives at {off} \"{Get(state, off)}\", " +
                                 $"but it was created as \"{first.GetValueOrDefault(off)}\". A title changed outside the log, " +
                                 "so none of its history was used.");
                    continue;
                }
            }

            found.AddRange(mine);
        }

        return (PickPerAddress(found, houses.ToDictionary(h => h.Id, h => h.IsPublished)), warnings);
    }

    /// <summary>
    /// One candidate per (locale, slug). A house published today wins over a draft, as in
    /// the live writer, where a draft never takes over another house's row (and a draft's
    /// row could not redirect anyway); among equals, the most recent loss wins.
    /// </summary>
    private static List<Candidate> PickPerAddress(IEnumerable<Candidate> candidates, IReadOnlyDictionary<int, bool> published) =>
        candidates
            .GroupBy(c => (c.Locale, c.Slug))
            .Select(g => g
                .OrderByDescending(c => published.TryGetValue(c.HouseId, out var p) && p)
                .ThenByDescending(c => c.RetiredAt)
                .First())
            .OrderBy(c => c.HouseId).ThenBy(c => c.RetiredAt).ThenBy(c => c.Locale)
            .ToList();

    /// <summary>
    /// The id of another house whose log, after this address was given up, holds a title
    /// that makes the same address, or null. Deliberately broad (any logged title value, in
    /// any edit, created or deleted record): the live writer releases an address a published
    /// house takes, so if one did, re-creating the row would 301 that house's old page to a
    /// different product. A false alarm costs a warning; a miss costs a wrong redirect.
    /// </summary>
    public static int? TakenSince(Candidate c, IReadOnlyList<AuditedEdit> edits)
    {
        foreach (var e in edits)
        {
            if (e.OccurredAt <= c.RetiredAt) continue;
            if (!int.TryParse(e.HouseId, out var other) || other == c.HouseId) continue;

            foreach (var change in Changes(e.ChangesJson))
            {
                var field = change.TryGetProperty("Field", out var f) ? f.GetString() : null;
                // An English title addresses every locale whose own title is empty.
                var applies = field == nameof(House.Title)
                    || (field == nameof(House.TitleBg) && c.Locale == "bg")
                    || (field == nameof(House.TitleEl) && c.Locale == "el");
                if (!applies) continue;

                foreach (var value in new[] { Text(change, "From"), Text(change, "To") })
                {
                    if (!string.IsNullOrWhiteSpace(value) && !IsCut(value) && GallerySlugs.Slugify(value) == c.Slug)
                        return other;
                }
            }
        }
        return null;
    }

    /// <summary>
    /// GallerySlugs.RetiredSlugs as candidates: each old address, keyed to the house that
    /// serves its target today. A target no house (or more than one) serves is reported.
    /// </summary>
    public static (List<Candidate> Candidates, List<string> Warnings) FromRetiredSlugs(IReadOnlyList<HouseTitles> houses)
    {
        var found = new List<Candidate>();
        var warnings = new List<string>();

        foreach (var (locale, oldSlug, currentSlug) in GallerySlugs.RetiredSlugs)
        {
            var holders = houses.Where(h => SlugsOf(h)[locale] == currentSlug).ToList();
            var published = holders.Where(h => h.IsPublished).ToList();
            var holder = published.Count == 1 ? published[0] : holders.Count == 1 ? holders[0] : null;

            if (holder is null)
            {
                warnings.Add($"RetiredSlugs: {locale} \"{oldSlug}\" points at \"{currentSlug}\", which " +
                             (holders.Count == 0 ? "no house serves today" : "more than one house serves") +
                             "; left to the hand-kept list.");
                continue;
            }

            found.Add(new Candidate(holder.Id, locale, oldSlug, RetiredSlugsDate, null, "GallerySlugs.RetiredSlugs"));
        }

        return (found, warnings);
    }

    private static readonly string[] TitleFields = { nameof(House.Title), nameof(House.TitleBg), nameof(House.TitleEl) };

    private static List<(string Field, string? From, string? To)> TitleChanges(string json)
    {
        var list = new List<(string, string?, string?)>();
        foreach (var change in Changes(json))
        {
            var field = change.TryGetProperty("Field", out var f) ? f.GetString() : null;
            if (field is null || !TitleFields.Contains(field)) continue;
            list.Add((field, Text(change, "From"), Text(change, "To")));
        }
        return list;
    }

    // A creation records each non-empty field as To; an absent title was empty.
    private static Dictionary<string, string?> CreatedTitles(string json)
    {
        var titles = new Dictionary<string, string?>();
        foreach (var change in Changes(json))
        {
            var field = change.TryGetProperty("Field", out var f) ? f.GetString() : null;
            if (field is not null && TitleFields.Contains(field)) titles[field] = Text(change, "To");
        }
        return titles;
    }

    private static List<JsonElement> Changes(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "[]" : json);
            return doc.RootElement.ValueKind == JsonValueKind.Array
                ? doc.RootElement.EnumerateArray().Select(e => e.Clone()).ToList()
                : new List<JsonElement>();
        }
        catch (JsonException)
        {
            // An unreadable entry says nothing about titles; the replay checks still catch a
            // title that moved without a readable record.
            return new List<JsonElement>();
        }
    }

    private static string? Text(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static string? Get(HouseTitles h, string field) => field switch
    {
        nameof(House.Title) => h.Title,
        nameof(House.TitleBg) => h.TitleBg,
        _ => h.TitleEl,
    };

    private static HouseTitles Set(HouseTitles h, string field, string? value) => field switch
    {
        nameof(House.Title) => h with { Title = value ?? "" },
        nameof(House.TitleBg) => h with { TitleBg = value },
        _ => h with { TitleEl = value },
    };

    // The log keeps at most MaxValueChars, then "…". Null, empty and whitespace-only are all
    // "no title": the log skips blank values in a creation record, and GallerySlugs.TitleFor
    // treats them as absent, so they make the same addresses.
    private static bool SameAsLogged(string? actual, string? logged)
    {
        var a = string.IsNullOrWhiteSpace(actual) ? "" : actual;
        var l = string.IsNullOrWhiteSpace(logged) ? "" : logged;
        if (IsCut(l)) return a.Length > AuditRedaction.MaxValueChars && a[..AuditRedaction.MaxValueChars] + "…" == l;
        return a == l;
    }

    private static bool IsCut(string? value) =>
        value is not null && value.Length == AuditRedaction.MaxValueChars + 1 && value.EndsWith('…');

    private static GalleryItem ToItem(HouseTitles h) => new()
    {
        Id = HousePublicIds.For(h.QuickbaseRecordId, h.Id),
        Title = h.Title,
        TitleBg = h.TitleBg,
        TitleEl = h.TitleEl,
    };

    private static Dictionary<string, string> SlugsOf(HouseTitles h)
    {
        var item = ToItem(h);
        return GallerySlugs.Locales.ToDictionary(l => l.Locale, l => GallerySlugs.SlugFor(item, l.Locale));
    }
}
