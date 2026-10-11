using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Services;

/// <summary>
/// The rows behind the home page's photo slots (HomeSlot, 2026-10): what the panel lists,
/// what the public page reads, and the rules that keep a slot pointing at a real photo.
/// Blob bytes are the controller's business, through BlobImageSource — this class never
/// touches storage, which is what keeps every rule here testable against an in-memory
/// database, the same split as PublicDocumentService.
/// </summary>
public sealed class HomePhotoService
{
    private readonly AppDbContext _db;
    private readonly ImageUrls _imageUrls;
    private readonly IMemoryCache _cache;
    private readonly ILogger<HomePhotoService> _log;

    // The public read is one eight-row query, but the home page is the busiest page on the
    // site and the prerenderer hits it three times per run, so it is cached like the
    // gallery is. Every write path below evicts by this name.
    public const string CacheKey = "home:photos:v1";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

    // When the table cannot be read, the empty answer is kept for a minute, not ten: long
    // enough to spare the database a failing query per request, short enough that a
    // migration applied after the publish heals by itself (SqlGalleryService does the same).
    private static readonly TimeSpan DegradedTtl = TimeSpan.FromMinutes(1);

    public const int MaxAltLength = 400;

    public HomePhotoService(
        AppDbContext db, ImageUrls imageUrls, IMemoryCache cache, ILogger<HomePhotoService>? log = null)
    {
        _db = db;
        _imageUrls = imageUrls;
        _cache = cache;
        _log = log ?? NullLogger<HomePhotoService>.Instance;
    }

    public enum Outcome { Ok, NotFound, Refused }

    public record Result(Outcome Outcome, HomeSlotAdminDto? Slot, string? Error)
    {
        public bool Ok => Outcome == Outcome.Ok;

        public static Result Success(HomeSlotAdminDto slot) => new(Outcome.Ok, slot, null);
        public static Result NotFound() => new(Outcome.NotFound, null, "No such slot.");
        public static Result Refuse(string error) => new(Outcome.Refused, null, error);
    }

    // --- The panel --------------------------------------------------------------------

    /// <summary>
    /// One entry per allow-listed name, row or not, in page order — a screen that only
    /// shows what has been uploaded cannot show where an upload belongs.
    /// </summary>
    public async Task<List<HomeSlotAdminDto>> ListAdminAsync(CancellationToken ct)
    {
        var rows = await _db.HomeSlots.AsNoTracking().ToListAsync(ct);
        var byName = rows.ToDictionary(r => r.Name, StringComparer.Ordinal);

        return HomeSlotNames.All
            .Select(name => ToDto(name, byName.GetValueOrDefault(name)))
            .ToList();
    }

    /// <summary>
    /// Points a slot at a key the caller has already uploaded under home/. Blob first, row
    /// second: a failure here costs an orphaned blob, never a row pointing at bytes that
    /// failed to arrive. A null alt keeps whatever the slot had.
    /// </summary>
    public async Task<Result> RecordImageAsync(
        string name, string imageKey, string? alt, string? actorUpn, CancellationToken ct)
    {
        if (!HomeSlotNames.IsValid(name)) return Result.NotFound();
        if (!ImageKey.IsValid(imageKey)) return Result.Refuse("That is not a valid image key.");
        if (alt is not null && alt.Trim().Length > MaxAltLength)
            return Result.Refuse($"Alt text must be {MaxAltLength} characters or fewer.");

        var row = await RowAsync(name, ct);
        row.ImageKey = imageKey;
        if (alt is not null) row.Alt = Clean(alt);
        Stamp(row, actorUpn);

        await _db.SaveChangesAsync(ct);
        Evict();
        return Result.Success(ToDto(name, row));
    }

    /// <summary>
    /// Points a slot at a photo the site already has. The key must be one the site serves —
    /// a gallery or case image row, or a content/ key the SPA's own pages use — because
    /// anything else would put a broken picture on the busiest page. The KEY is copied, not
    /// referenced: a later gallery delete must not empty the hero.
    /// </summary>
    public async Task<Result> PickAsync(string name, string? imageKey, string? actorUpn, CancellationToken ct)
    {
        if (!HomeSlotNames.IsValid(name)) return Result.NotFound();

        var key = imageKey?.Trim() ?? "";
        if (!ImageKey.IsValid(key) || !await IsKnownAsync(key, ct))
            return Result.Refuse("That image is not in the gallery.");

        var row = await RowAsync(name, ct);
        row.ImageKey = key;
        Stamp(row, actorUpn);

        await _db.SaveChangesAsync(ct);
        Evict();
        return Result.Success(ToDto(name, row));
    }

    /// <summary>
    /// Empties a slot so the SPA's default shows. The row stays (it is the audit trail's
    /// anchor) and so does the blob, as everywhere else. The alt goes with the photo it
    /// described, so the next upload does not inherit a caption for a different picture.
    /// </summary>
    public async Task<Outcome> ClearAsync(string name, string? actorUpn, CancellationToken ct)
    {
        if (!HomeSlotNames.IsValid(name)) return Outcome.NotFound;

        var row = await _db.HomeSlots.FirstOrDefaultAsync(s => s.Name == name, ct);
        if (row is null) return Outcome.Ok;   // never touched: already empty

        row.ImageKey = null;
        row.Alt = null;
        Stamp(row, actorUpn);

        await _db.SaveChangesAsync(ct);
        Evict();
        return Outcome.Ok;
    }

    /// <summary>
    /// Exchanges two slots' photo and alt — how the owner reorders the hero without
    /// re-uploading. Same kind only: a model card is a 4:3 crop keyed to a configurator
    /// model, a hero slide is neither, so moving one into the other is never what anyone
    /// meant.
    /// </summary>
    public async Task<Result> SwapAsync(string a, string b, string? actorUpn, CancellationToken ct)
    {
        if (!HomeSlotNames.IsValid(a) || !HomeSlotNames.IsValid(b)) return Result.NotFound();
        if (a == b) return Result.Refuse("Choose two different slots to swap.");
        if (HomeSlotNames.KindOf(a) != HomeSlotNames.KindOf(b))
            return Result.Refuse("Hero slides and model photos cannot be swapped with each other.");

        var rowA = await RowAsync(a, ct);
        var rowB = await RowAsync(b, ct);

        (rowA.ImageKey, rowB.ImageKey) = (rowB.ImageKey, rowA.ImageKey);
        (rowA.Alt, rowB.Alt) = (rowB.Alt, rowA.Alt);
        Stamp(rowA, actorUpn);
        Stamp(rowB, actorUpn);

        await _db.SaveChangesAsync(ct);
        Evict();
        return Result.Success(ToDto(a, rowA));
    }

    public async Task<Result> SetAltAsync(string name, string? alt, string? actorUpn, CancellationToken ct)
    {
        if (!HomeSlotNames.IsValid(name)) return Result.NotFound();

        var clean = Clean(alt);
        if (clean is not null && clean.Length > MaxAltLength)
            return Result.Refuse($"Alt text must be {MaxAltLength} characters or fewer.");

        var row = await RowAsync(name, ct);
        row.Alt = clean;
        Stamp(row, actorUpn);

        await _db.SaveChangesAsync(ct);
        Evict();
        return Result.Success(ToDto(name, row));
    }

    // --- The public page --------------------------------------------------------------

    /// <summary>
    /// What the home page fetches: the hero slides that have a photo, in slot order, and
    /// the three model cards keyed by configurator model, null where the slot is empty.
    /// The SPA merges this over its content defaults, so an empty answer is a working page.
    /// </summary>
    public async Task<HomePhotosDto> ReadPublicAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out HomePhotosDto? cached) && cached is not null)
            return cached;

        var (dto, read) = await LoadPublicAsync(ct);

        _cache.Set(CacheKey, dto, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = read ? CacheTtl : DegradedTtl,
        });
        return dto;
    }

    /// <summary>
    /// A failure here never takes the home page down. The table arrives by migration,
    /// applied BEFORE the publish (DEPLOY §5b), but if the order is ever reversed the
    /// busiest page on the site must show its defaults, not an error.
    /// </summary>
    private async Task<(HomePhotosDto Dto, bool Read)> LoadPublicAsync(CancellationToken ct)
    {
        try
        {
            var rows = await _db.HomeSlots.AsNoTracking()
                .Where(s => s.ImageKey != null)
                .Select(s => new { s.Name, s.ImageKey, s.Alt })
                .ToListAsync(ct);
            var byName = rows.ToDictionary(r => r.Name, StringComparer.Ordinal);

            var hero = HomeSlotNames.OfKind(HomeSlotNames.HeroKind)
                .Select(name => byName.GetValueOrDefault(name))
                .Where(r => r is not null)
                .Select(r => new { r!.Name, Url = _imageUrls.ForKey(r.ImageKey), r.Alt })
                .Where(r => r.Url is not null)
                .Select(r => new HomeHeroPhotoDto(r.Name, r.Url!, r.Alt ?? ""))
                .ToList();

            var models = new Dictionary<string, HomePhotoDto?>(StringComparer.Ordinal);
            foreach (var key in HomeSlotNames.ModelKeys)
            {
                var r = byName.GetValueOrDefault($"model-{key}");
                var url = r is null ? null : _imageUrls.ForKey(r.ImageKey);
                models[key] = url is null ? null : new HomePhotoDto(url, r!.Alt ?? "");
            }

            return (new HomePhotosDto(hero, models), true);
        }
        // Keyed on the token, not the exception type: a request the client abandoned
        // mid-query must not be logged as a fault or cached as "no photos" for everyone.
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _log.LogWarning(ex,
                "Home photos: could not read HomeSlots, so the home page shows its default photos " +
                "until it can. Is the AddHomeSlots migration applied?");
            return (HomePhotosDto.Empty(), false);
        }
    }

    /// <summary>
    /// The public read caches for ten minutes. Without this an admin edit appears to do
    /// nothing for up to ten minutes, which reads as a broken save and invites a second one.
    /// </summary>
    public void Evict() => _cache.Remove(CacheKey);

    // --- Helpers ------------------------------------------------------------------------

    // Known to the site = stored on a gallery or case image row, or under content/, which
    // is the scope the SPA's own pages hard-code. Keys under home/ are not "known" this way
    // on purpose: they arrive through the upload path, which records them itself.
    private async Task<bool> IsKnownAsync(string key, CancellationToken ct)
    {
        if (key.StartsWith(ImageKey.ContentScope + "/", StringComparison.Ordinal)) return true;
        if (await _db.HouseImages.AsNoTracking().AnyAsync(i => i.ImageKey == key, ct)) return true;
        return await _db.CaseImages.AsNoTracking().AnyAsync(i => i.ImageKey == key, ct);
    }

    private async Task<HomeSlot> RowAsync(string name, CancellationToken ct)
    {
        var row = await _db.HomeSlots.FirstOrDefaultAsync(s => s.Name == name, ct);
        if (row is not null) return row;

        row = new HomeSlot { Name = name };
        _db.HomeSlots.Add(row);
        return row;
    }

    private static void Stamp(HomeSlot row, string? actorUpn)
    {
        row.UpdatedAt = DateTimeOffset.UtcNow;
        row.UpdatedByUpn = actorUpn;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private HomeSlotAdminDto ToDto(string name, HomeSlot? row) => new(
        name,
        HomeSlotNames.KindOf(name)!,
        HomeSlotNames.ModelKeyOf(name) ?? HomeSlotNames.HeroNumberOf(name).ToString(),
        row?.ImageKey,
        row?.ImageKey is null ? null : _imageUrls.ForKey(row.ImageKey),
        row?.Alt,
        row?.UpdatedAt.ToString("o"),
        row?.UpdatedByUpn);
}

/// <summary>
/// One slot as the panel sees it. Index is "1".."5" for a hero slide and the model key
/// ("37") for a model card — a string either way, so the panel does not have to know which
/// kind it is holding to print it.
/// </summary>
public sealed record HomeSlotAdminDto(
    string Name,
    string Kind,
    string Index,
    string? ImageKey,
    string? Url,
    string? Alt,
    string? UpdatedAt,
    string? UpdatedByUpn);

/// <summary>A hero slide that has a photo. Slot is the name ("hero-2"), kept so the SPA can key its merge.</summary>
public sealed record HomeHeroPhotoDto(string Slot, string Url, string Alt);

/// <summary>A model card's photo.</summary>
public sealed record HomePhotoDto(string Url, string Alt);

/// <summary>The body of GET /api/home/photos. Models always carries all three keys, null when empty.</summary>
public sealed record HomePhotosDto(List<HomeHeroPhotoDto> Hero, Dictionary<string, HomePhotoDto?> Models)
{
    public static HomePhotosDto Empty() => new(
        new List<HomeHeroPhotoDto>(),
        HomeSlotNames.ModelKeys.ToDictionary(k => k, _ => (HomePhotoDto?)null, StringComparer.Ordinal));
}
