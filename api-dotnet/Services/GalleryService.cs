using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Models;

namespace Services
{
    public class GalleryService
    {
        private readonly QuickbaseClient _qb;
        private readonly EnvConfig _env;
        private readonly IMemoryCache _cache;
        private readonly ImageUrls _imageUrls;

        private const string CacheKey = "gallery:list:v2";
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

        // Max number of image queries (one per house) to run against Quickbase concurrently.
        private const int ImageFetchConcurrency = 6;

        public GalleryService(QuickbaseClient qb, EnvConfig env, IMemoryCache cache, ImageUrls imageUrls)
        {
            _qb = qb;
            _env = env;
            _cache = cache;
            _imageUrls = imageUrls;
        }

        public async Task<IReadOnlyList<GalleryItem>> GetAsync(CancellationToken ct = default)
        {
            if (!_cache.TryGetValue(CacheKey, out IReadOnlyList<GalleryItem>? items) || items is null)
            {
                items = await LoadAsync(ct);
                _cache.Set(CacheKey, items, new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = CacheTtl
                });
            }

            // Applied on the way out rather than before caching, so what's cached is always the
            // raw Quickbase URLs. Flipping IMAGES_VIA_APP then takes effect on the next request
            // instead of trailing the 10-minute TTL — which matters most when flipping it back.
            return WithResponseUrls(items);
        }

        // Copies rather than mutating: the cached instances are shared by every subsequent
        // request, so rewriting them in place would rewrite the cache too, and the second flip
        // of the flag would find the originals already gone.
        private IReadOnlyList<GalleryItem> WithResponseUrls(IReadOnlyList<GalleryItem> items)
        {
            if (!_imageUrls.ViaApp) return items;

            return items.Select(it => new GalleryItem
            {
                Id = it.Id,
                Title = it.Title,
                Price = it.Price,
                Currency = it.Currency,
                Description = it.Description,
                CoverUrl = _imageUrls.ForResponse(it.CoverUrl),
                Images = it.Images.Select(u => _imageUrls.ForResponse(u) ?? u).ToList(),
                TitleBg = it.TitleBg,
                DescriptionBg = it.DescriptionBg,
                TitleEl = it.TitleEl,
                DescriptionEl = it.DescriptionEl,
                Category = it.Category,
                CatalogId = it.CatalogId,
            }).ToList();
        }

        private async Task<IReadOnlyList<GalleryItem>> LoadAsync(CancellationToken ct)
        {
            // 1) Houses — one query
            // Build select list: base fields + optional localized + catalogue fields
            var select = new List<int>
            {
                _env.F_HOUSE_RID, _env.F_HOUSE_TITLE, _env.F_HOUSE_PRICE, _env.F_HOUSE_DESC, _env.F_HOUSE_CATEGORY
            };
            if (_env.F_HOUSE_TITLE_BG.HasValue) select.Add(_env.F_HOUSE_TITLE_BG.Value);
            if (_env.F_HOUSE_DESC_BG.HasValue) select.Add(_env.F_HOUSE_DESC_BG.Value);
            if (_env.F_HOUSE_TITLE_EL.HasValue) select.Add(_env.F_HOUSE_TITLE_EL.Value);
            if (_env.F_HOUSE_DESC_EL.HasValue) select.Add(_env.F_HOUSE_DESC_EL.Value);
            if (_env.F_HOUSE_CATALOG_ID.HasValue) select.Add(_env.F_HOUSE_CATALOG_ID.Value);

            var qHouses = new
            {
                from = _env.TableHouses,
                select = select.Distinct().ToArray(),
                where = "",
                sortBy = new[] { new { fieldId = _env.F_HOUSE_TITLE, order = "ASC" } }
            };

            var houses = await _qb.QueryAsync(qHouses, ct);

            var items = new List<GalleryItem>();

            if (houses?.data != null)
            {
                foreach (var rec in houses.data)
                {
                    var idStr = rec.Get(_env.F_HOUSE_RID);
                    if (!long.TryParse(idStr, out var id)) continue;

                    var title = rec.Get(_env.F_HOUSE_TITLE) ?? "";
                    var desc = rec.Get(_env.F_HOUSE_DESC) ?? "";

                    string? titleBg = _env.F_HOUSE_TITLE_BG.HasValue ? rec.Get(_env.F_HOUSE_TITLE_BG.Value) : null;
                    string? descBg = _env.F_HOUSE_DESC_BG.HasValue ? rec.Get(_env.F_HOUSE_DESC_BG.Value) : null;
                    string? titleEl = _env.F_HOUSE_TITLE_EL.HasValue ? rec.Get(_env.F_HOUSE_TITLE_EL.Value) : null;
                    string? descEl = _env.F_HOUSE_DESC_EL.HasValue ? rec.Get(_env.F_HOUSE_DESC_EL.Value) : null;
                    string? catalogId = _env.F_HOUSE_CATALOG_ID.HasValue ? rec.Get(_env.F_HOUSE_CATALOG_ID.Value) : null;

                    string? category = rec.Get(_env.F_HOUSE_CATEGORY) ?? "";

                    decimal? price = null;
                    var priceStr = rec.Get(_env.F_HOUSE_PRICE);
                    if (decimal.TryParse(priceStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var p))
                        price = p;

                    items.Add(new GalleryItem
                    {
                        Id = id,
                        Title = title,
                        Description = desc,
                        TitleBg = string.IsNullOrWhiteSpace(titleBg) ? null : titleBg,
                        DescriptionBg = string.IsNullOrWhiteSpace(descBg) ? null : descBg,
                        TitleEl = string.IsNullOrWhiteSpace(titleEl) ? null : titleEl,
                        DescriptionEl = string.IsNullOrWhiteSpace(descEl) ? null : descEl,
                        CatalogId = string.IsNullOrWhiteSpace(catalogId) ? null : catalogId.Trim(),
                        Price = price,
                        Currency = "EUR",
                        Category = category,
                        Images = new List<string>()
                    });
                }
            }

            if (items.Count == 0) return items;

            // 2) Images — batched. One query per chunk of houses instead of one query per house.
            var imagesByParent = await LoadImagesAsync(items.Select(i => i.Id).ToList(), ct);

            foreach (var it in items)
            {
                if (imagesByParent.TryGetValue(it.Id, out var urls) && urls.Count > 0)
                {
                    it.Images = urls;
                    it.CoverUrl = urls[0];
                }
            }

            return items;
        }

        /// <summary>
        /// Fetches every image for the given house ids. Uses one query per house (the exact, proven
        /// per-parent filter — no reading the parent field back) but runs them in parallel with a
        /// small concurrency cap, so we keep the latency win over the old sequential loop.
        /// </summary>
        private async Task<Dictionary<long, List<string>>> LoadImagesAsync(IReadOnlyList<long> ids, CancellationToken ct)
        {
            using var gate = new SemaphoreSlim(ImageFetchConcurrency);

            async Task<(long Id, List<string> Urls)> FetchOneAsync(long id)
            {
                await gate.WaitAsync(ct);
                try
                {
                    var where = "{" + _env.F_IMG_PARENT + ".EX.'" + id + "'}";
                    var qImg = new
                    {
                        from = _env.TableImages,
                        select = new[] { _env.F_IMG_FILE, _env.F_IMG_URL },
                        where
                    };

                    var imgs = await _qb.QueryAsync(qImg, ct);

                    var urls = new List<string>();
                    if (imgs?.data != null)
                    {
                        foreach (var rec in imgs.data)
                        {
                            var url = ExtractImageUrl(rec);
                            if (!string.IsNullOrWhiteSpace(url)) urls.Add(url);
                        }
                    }
                    return (id, urls);
                }
                finally
                {
                    gate.Release();
                }
            }

            var results = await Task.WhenAll(ids.Select(FetchOneAsync));

            var byParent = new Dictionary<long, List<string>>();
            foreach (var (id, urls) in results)
            {
                if (urls.Count > 0) byParent[id] = urls;
            }
            return byParent;
        }

        /// <summary>
        /// Resolves a single image record to a public URL: attachment-first (built as an "up" URL),
        /// then the /files link, then an absolute text URL fallback.
        /// </summary>
        private string? ExtractImageUrl(QbRec rec)
        {
            string? finalUrl = null;

            // Attachment-first: we only need to split value.url and read versions[0].fileName
            var attachJson = rec.Get(_env.F_IMG_FILE);
            if (!string.IsNullOrWhiteSpace(attachJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(attachJson);
                    var root = doc.RootElement;

                    // value.url -> "/files/{dbid}/{rid}/{fid}/{version}"
                    string? valueUrl = null;
                    if (root.TryGetProperty("url", out var urlProp) &&
                        urlProp.ValueKind == JsonValueKind.String)
                    {
                        valueUrl = urlProp.GetString();
                    }

                    // versions[0].fileName
                    string? fileName = null;
                    if (root.TryGetProperty("versions", out var vers) &&
                        vers.ValueKind == JsonValueKind.Array &&
                        vers.GetArrayLength() > 0)
                    {
                        var v0 = vers[0];
                        if (v0.TryGetProperty("fileName", out var fn) &&
                            fn.ValueKind == JsonValueKind.String)
                        {
                            fileName = fn.GetString();
                        }
                    }

                    var up = BuildUpUrlFromFilesPath(valueUrl, fileName);
                    if (!string.IsNullOrWhiteSpace(up)) finalUrl = up;

                    if (string.IsNullOrWhiteSpace(finalUrl) && !string.IsNullOrWhiteSpace(valueUrl))
                    {
                        if (!string.IsNullOrWhiteSpace(_env.Realm))
                            finalUrl = "https://" + _env.Realm + valueUrl;
                    }
                }
                catch
                {
                    // ignore JSON parse errors
                }
            }

            // Fallback: Text URL field if absolute
            if (string.IsNullOrWhiteSpace(finalUrl))
            {
                var textUrl = rec.Get(_env.F_IMG_URL);
                if (!string.IsNullOrWhiteSpace(textUrl) &&
                   (textUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                    textUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
                {
                    finalUrl = textUrl;
                }
            }

            return finalUrl;
        }

        /// <summary>
        /// Build "up" style public URL using only the string parts:
        ///   https://{realm}/up/{dbid}/a/r{rid}/e{fid}/v{version}/{fileName}
        /// We parse value.url = "/files/{dbid}/{rid}/{fid}/{version}" and append fileName.
        /// </summary>
        private string? BuildUpUrlFromFilesPath(string? valueUrl, string? fileName)
        {
            if (string.IsNullOrWhiteSpace(valueUrl) || string.IsNullOrWhiteSpace(_env.Realm))
                return null;

            // Expect "/files/{dbid}/{rid}/{fid}/{version}"
            var parts = valueUrl.Split('/', StringSplitOptions.RemoveEmptyEntries);
            // parts[0] should be "files"
            if (parts.Length < 5 || !parts[0].Equals("files", StringComparison.OrdinalIgnoreCase))
                return null;

            var dbid = parts[1];
            var rid = parts[2];
            var fid = parts[3];
            var version = parts[4];

            if (!string.IsNullOrWhiteSpace(fileName))
            {
                return $"https://{_env.Realm}/up/{dbid}/a/r{rid}/e{fid}/v{version}/{Uri.EscapeDataString(fileName)}";
            }
            else
            {
                // No filename? Return a valid /files link at least.
                return $"https://{_env.Realm}/files/{dbid}/{rid}/{fid}/{version}";
            }
        }
    }
}
