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
using Models;

namespace Services;

/// <summary>
/// The rows behind the home page's photo slots and the product pages' main photos
/// (HomeSlot, 2026-10): what the panel lists, what the public pages read, and the rules that
/// keep a slot pointing at a real photo.
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
    private readonly IGalleryStore? _gallery;

    // The public read is one query over at most twenty-nine rows, but the home page is the
    // busiest page on the site and the prerenderer hits it once per locale for the home page
    // and again for each page that reads a slot, so it is cached like the gallery is. Every
    // write path below evicts by this name. The version moves whenever the body's shape does
    // (v2 added "pages", v3 added "from", both 2026-10-12; v4 added pages.delivery and v5
    // pages.partner, both 2026-10-15; v6 added "slots", the page photos, 2026-10-16): the
    // cache is in-process today and dies with a publish anyway, but a key that names its shape
    // is what keeps an entry of the old shape from ever being read back as the new one.
    public const string CacheKey = "home:photos:v6";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

    // When the table cannot be read, the empty answer is kept for a minute, not ten: long
    // enough to spare the database a failing query per request, short enough that a
    // migration applied after the publish heals by itself (SqlGalleryService does the same).
    private static readonly TimeSpan DegradedTtl = TimeSpan.FromMinutes(1);

    public const int MaxAltLength = 400;

    // The gallery is optional so the tests that only care about slots need not build one,
    // and so a host without a gallery store answers "from" as unknown rather than failing
    // to activate. Program.cs always registers IGalleryStore, so on the site it is there.
    public HomePhotoService(
        AppDbContext db,
        ImageUrls imageUrls,
        IMemoryCache cache,
        ILogger<HomePhotoService>? log = null,
        IGalleryStore? gallery = null)
    {
        _db = db;
        _imageUrls = imageUrls;
        _cache = cache;
        _log = log ?? NullLogger<HomePhotoService>.Instance;
        _gallery = gallery;
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
    /// meant. A product page's photo is not swapped at all, not even with another page's:
    /// it shows THAT product, so a container on the houses page is a mistake, not an order.
    /// A page photo (kind "photo": a team portrait, a tile, an About or Interiors picture) is
    /// not swapped either, for the same reason: it belongs to one place on one page.
    /// </summary>
    public async Task<Result> SwapAsync(string a, string b, string? actorUpn, CancellationToken ct)
    {
        if (!HomeSlotNames.IsValid(a) || !HomeSlotNames.IsValid(b)) return Result.NotFound();
        if (a == b) return Result.Refuse("Choose two different slots to swap.");
        if (HomeSlotNames.KindOf(a) == HomeSlotNames.PageKind || HomeSlotNames.KindOf(b) == HomeSlotNames.PageKind)
            return Result.Refuse("A product page's photo belongs to that page and cannot be swapped.");
        if (HomeSlotNames.KindOf(a) == HomeSlotNames.PhotoKind || HomeSlotNames.KindOf(b) == HomeSlotNames.PhotoKind)
            return Result.Refuse("This photo belongs to its place and cannot be swapped.");
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
    /// What the home page and the product pages fetch: the hero slides that have a photo,
    /// in slot order; the three model cards keyed by configurator model; the five product
    /// pages' main photos keyed by the SPA's route key — null where a slot is empty; the page
    /// photos of kind "photo" that have one, keyed by slot name; and the cheapest published
    /// price per category, which the home hero's "from" figure quotes. The SPA merges this
    /// over its content defaults, so an empty answer is a working page.
    /// </summary>
    public async Task<HomePhotosDto> ReadPublicAsync(CancellationToken ct)
    {
        if (!_cache.TryGetValue(CacheKey, out HomePhotosDto? photos) || photos is null)
        {
            var (dto, read) = await LoadPublicAsync(ct);
            photos = dto;
            _cache.Set(CacheKey, photos, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = read ? CacheTtl : DegradedTtl,
            });
        }

        // The figures ride on the gallery's cache, not this one: the gallery store keeps its
        // own ten-minute entry, which GalleryAdminService evicts after every edit. Kept in this
        // entry instead, a price staff just lowered would show in the gallery at once and on
        // the home hero up to ten minutes later, and the hero would quote a figure the gallery
        // no longer does. Read off the gallery's entry the two cannot disagree, and the cost is
        // one pass over a list already in memory. The cached entry itself goes out when the
        // figures are unknown, since there is nothing to copy in.
        var from = await LowestPricesAsync(ct);
        return from == photos.From ? photos : photos with { From = from };
    }

    /// <summary>
    /// The cheapest published price in each category the home page quotes, from the rows
    /// /api/gallery serves — SQL or Quickbase, whichever DATA_SOURCE_GALLERY picks. Gallery
    /// prices include VAT, and a wagon's already contains its assembly (WAGON_ASSEMBLY_GROSS
    /// in the SPA's prices.js), so the wagon figure is the finished price of the cheapest
    /// container and nothing is added to it.
    ///
    /// Unknown, never zero, when there is nothing to read: no store, no priced row in the
    /// category, or a store that failed. The SPA prints its lead without a figure then, which
    /// is honest; "from €0", or a figure typed into the copy, would not be.
    /// </summary>
    private async Task<HomeFromDto> LowestPricesAsync(CancellationToken ct)
    {
        if (_gallery is null) return HomeFromDto.Unknown;
        try
        {
            return HomeFromDto.Of(await _gallery.GetAsync(ct));
        }
        // Same rule as the slots: an abandoned request is not a fault and is not logged as one.
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _log.LogWarning(ex,
                "Home photos: could not read the gallery, so the home hero prints its lead without a " +
                "\"from\" figure until it can.");
            return HomeFromDto.Unknown;
        }
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

            var pages = new Dictionary<string, HomePhotoDto?>(StringComparer.Ordinal);
            foreach (var key in HomeSlotNames.PageKeys)
            {
                var r = byName.GetValueOrDefault(HomeSlotNames.SlotOfPage(key)!);
                var url = r is null ? null : _imageUrls.ForKey(r.ImageKey);
                pages[key] = url is null ? null : new HomePhotoDto(url, r!.Alt ?? "");
            }

            // The page photos, by slot name, and ONLY the filled ones: a missing name means
            // "show the default", which the SPA already treats exactly like null, and the whole
            // body is copied into the <head> of every prerendered page that reads it, so the
            // empty slots are not worth their bytes. Only kind "photo": the hero, model and
            // page slots already travel in their own fields above, and repeating them here
            // would double their share of every snapshot for nothing.
            var slots = new Dictionary<string, HomePhotoDto>(StringComparer.Ordinal);
            foreach (var name in HomeSlotNames.OfKind(HomeSlotNames.PhotoKind))
            {
                var r = byName.GetValueOrDefault(name);
                var url = r is null ? null : _imageUrls.ForKey(r.ImageKey);
                if (url is not null) slots[name] = new HomePhotoDto(url, r!.Alt ?? "");
            }

            return (new HomePhotosDto(hero, models, pages, HomeFromDto.Unknown, slots), true);
        }
        // Keyed on the token, not the exception type: a request the client abandoned
        // mid-query must not be logged as a fault or cached as "no photos" for everyone.
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _log.LogWarning(ex,
                "Home photos: could not read HomeSlots, so the home and product pages show their default photos " +
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
        PanelIndexOf(name),
        row?.ImageKey,
        row?.ImageKey is null ? null : _imageUrls.ForKey(row.ImageKey),
        row?.Alt,
        row?.UpdatedAt.ToString("o"),
        row?.UpdatedByUpn);

    // Read off the kind, so a slot of a kind with no number of its own gets its name
    // rather than a "0" that would read as a hero slide nobody has.
    private static string PanelIndexOf(string name) => HomeSlotNames.KindOf(name) switch
    {
        HomeSlotNames.HeroKind => HomeSlotNames.HeroNumberOf(name).ToString(),
        HomeSlotNames.ModelKind => HomeSlotNames.ModelKeyOf(name)!,
        HomeSlotNames.PageKind => HomeSlotNames.PageKeyOf(name)!,
        _ => name,
    };
}

/// <summary>
/// One slot as the panel sees it. Index is "1".."5" for a hero slide, the model key ("37")
/// for a model card, the SPA route key ("modularHouses") for a product page and the slot's
/// own name ("about-hero") for a page photo — a string every way, so the panel does not have
/// to know which kind it is holding to print it.
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

/// <summary>A model card's photo, a product page's main photo, or a page photo.</summary>
public sealed record HomePhotoDto(string Url, string Alt);

/// <summary>
/// The body of GET /api/home/photos. Models always carries all three model keys and Pages
/// all five page keys (modularBuilds, modularHouses, steelHouses, delivery, partner), null when empty, so the
/// SPA never has to tell "no photo" from "an older API that did not know the key". From is
/// always there too, with null figures when they are unknown.
///
/// Slots (2026-10-16) is the other way round: only the page photos (kind "photo") that HAVE
/// a photo, keyed by slot name ("about-hero"), and an empty object when none has. An older
/// API (or an older body seeded into a prerendered page's head) is told apart by the field being absent
/// altogether, which a reader must take as "every page photo shows its default", the same
/// thing an empty slot means.
/// </summary>
public sealed record HomePhotosDto(
    List<HomeHeroPhotoDto> Hero,
    Dictionary<string, HomePhotoDto?> Models,
    Dictionary<string, HomePhotoDto?> Pages,
    HomeFromDto From,
    Dictionary<string, HomePhotoDto> Slots)
{
    public static HomePhotosDto Empty() => new(
        new List<HomeHeroPhotoDto>(),
        HomeSlotNames.ModelKeys.ToDictionary(k => k, _ => (HomePhotoDto?)null, StringComparer.Ordinal),
        HomeSlotNames.PageKeys.ToDictionary(k => k, _ => (HomePhotoDto?)null, StringComparer.Ordinal),
        HomeFromDto.Unknown,
        new Dictionary<string, HomePhotoDto>(StringComparer.Ordinal));
}

/// <summary>
/// The cheapest published gallery price in euro, VAT included, per category. Wagon is the
/// cheapest container with its assembly already in the price; Modular the cheapest Box house,
/// the house alone. Null where the gallery has no priced row in that category.
/// </summary>
public sealed record HomeFromDto(decimal? Wagon, decimal? Modular)
{
    public static readonly HomeFromDto Unknown = new(null, null);

    /// <summary>
    /// The minimum per category over the gallery items either store serves. The category goes
    /// through HouseCategories.FromQuickbaseLabel because the SQL store sends the key ("wagon")
    /// and the Quickbase store the label ("Фургон"), and that function reads both. A price that
    /// is missing, zero or negative is skipped rather than quoted, and so is one in another
    /// currency: the hero prints euro, and every gallery row is in euro today.
    /// </summary>
    public static HomeFromDto Of(IEnumerable<GalleryItem>? items)
    {
        decimal? wagon = null, modular = null;
        foreach (var item in items ?? Enumerable.Empty<GalleryItem>())
        {
            if (item?.Price is not decimal price || price <= 0) continue;
            if (!string.Equals(item.Currency ?? "EUR", "EUR", StringComparison.OrdinalIgnoreCase)) continue;

            switch (HouseCategories.FromQuickbaseLabel(item.Category))
            {
                case HouseCategories.Wagon:
                    if (wagon is null || price < wagon) wagon = price;
                    break;
                case HouseCategories.Modular:
                    if (modular is null || price < modular) modular = price;
                    break;
            }
        }
        return new HomeFromDto(wagon, modular);
    }
}
