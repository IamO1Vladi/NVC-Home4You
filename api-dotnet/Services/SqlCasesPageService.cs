using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Models;

namespace Services;

// The SQL cases page read path, served when DATA_SOURCE_CASES=sql.
//
// Reproduces the Quickbase payload exactly — same shape, same suppression rules, same derived
// labels — so the cutover is invisible to the frontend. The formula fields are computed here
// via CaseFormulas rather than read from columns; see Case for why they are not stored.
public sealed class SqlCasesPageService : ICasesPageStore
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly IReviewStore _reviews;
    private readonly ImageUrls _imageUrls;

    // Shares the Quickbase path's cache key so admin moderation, which already evicts it,
    // keeps working against whichever store is serving.
    public const string CacheKey = CasesPageService.CacheKey;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

    public SqlCasesPageService(AppDbContext db, IMemoryCache cache, IReviewStore reviews, ImageUrls imageUrls)
    {
        _db = db;
        _cache = cache;
        _reviews = reviews;
        _imageUrls = imageUrls;
    }

    public async Task<CasesPageResponse> GetAsync(CancellationToken ct)
    {
        // Only the case rows are cached. Reviews come from IReviewStore on every call, as they
        // do on the Quickbase path, so a moderation decision is not held behind this TTL.
        if (!_cache.TryGetValue(CacheKey + ":sql", out List<Case>? cases) || cases is null)
        {
            cases = await _db.Cases
                .AsNoTracking()
                .Include(c => c.Images)
                .Where(c => c.IsPublished)
                .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
                .ToListAsync(ct);

            _cache.Set(CacheKey + ":sql", cases, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = CacheTtl,
            });
        }

        var reviews = await _reviews.GetApprovedReviewsAsync(ct);
        var dtos = cases.Select(ToDto).ToList();
        var clients = BuildClients(dtos, cases);

        return new CasesPageResponse
        {
            Stats = new CasesPageStats
            {
                PublishedCases = dtos.Count,
                ApprovedReviews = reviews.Count,
                CountriesServed = cases
                    .Select(c => (c.Country ?? "").Trim())
                    .Where(c => c.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Count(),
            },
            Clients = clients,
            Cases = dtos,
            Reviews = reviews,
        };
    }

    private PublicCaseDto ToDto(Case c)
    {
        // A case with no company name is a private individual: the sector, the buyer's role
        // and the logo are all suppressed, so a personal purchase never implies an employer.
        // Same rule as the live Quickbase path.
        var hasCompany = CaseFormulas.HasCompany(c);

        var gallery = c.Images
            .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
            .Select(i => _imageUrls.ForKey(i.ImageKey))
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u!)
            .ToList();

        var cover = _imageUrls.ForKey(c.CoverImageKey);

        // The Quickbase payload puts the cover FIRST inside Images as well as exposing it as
        // ImageUrl, because there it was just another attachment that happened to sort first.
        // Omitting it here would quietly drop one photo from every case's lightbox.
        if (cover is not null) gallery.Insert(0, cover);

        return new PublicCaseDto
        {
            // String id, and the Quickbase record id where there is one, so anything already
            // linking to a case keeps resolving.
            Id = (c.QuickbaseRecordId ?? c.Id).ToString(),
            Featured = c.Featured,
            CompanyName = c.CompanyName,
            CompanyType = hasCompany ? c.CompanySector : null,
            BuyerName = CaseFormulas.PublicBuyerLabel(c),
            BuyerRole = hasCompany ? c.BuyerRole : null,
            Category = c.CategoryKey,
            Product = CaseFormulas.ProductLabel(c),
            Units = c.UnitsQty?.ToString(),
            Location = CaseFormulas.PublicLocationLabel(c),
            Year = CaseFormulas.YearLabel(c),
            Scope = c.Scope,
            Result = c.Result,
            Quote = c.PublicQuote,
            Rating = c.RatingSnapshot ?? 0,
            CompanyLogoUrl = hasCompany ? _imageUrls.ForKey(c.CompanyLogoImageKey) : null,
            // The cover if there is one, otherwise the first gallery image — matching the
            // Quickbase path, where the cover attachment simply sorted first.
            ImageUrl = cover ?? gallery.FirstOrDefault(),
            Images = gallery,
        };
    }

    // Clients are derived from cases rather than stored, exactly as on the Quickbase path:
    // there is no clients table, only the company details repeated on each case.
    private static List<PublicClientDto> BuildClients(List<PublicCaseDto> dtos, List<Case> cases)
    {
        var byName = new Dictionary<string, PublicClientDto>(StringComparer.OrdinalIgnoreCase);

        foreach (var c in cases)
        {
            if (!CaseFormulas.HasCompany(c)) continue;

            var name = c.CompanyName.Trim();
            if (byName.ContainsKey(name)) continue;

            var dto = dtos.FirstOrDefault(d => string.Equals(d.CompanyName, name, StringComparison.OrdinalIgnoreCase));

            byName[name] = new PublicClientDto
            {
                Id = (c.QuickbaseRecordId ?? c.Id).ToString(),
                Name = name,
                Sector = c.CompanySector,
                Country = c.Country,
                LogoUrl = dto?.CompanyLogoUrl,
            };
        }

        return byName.Values.ToList();
    }
}
