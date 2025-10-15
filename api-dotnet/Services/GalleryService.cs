using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services
{
    public class GalleryService
    {
        private readonly QuickbaseClient _qb;
        private readonly EnvConfig _env;

        public GalleryService(QuickbaseClient qb, EnvConfig env)
        {
            _qb = qb;
            _env = env;
        }

        public async Task<IEnumerable<GalleryItem>> GetAsync(CancellationToken ct = default)
        {
            // 1) Houses — one query
            var qHouses = new
            {
                from = _env.TableHouses,
                select = new[] { _env.F_HOUSE_RID, _env.F_HOUSE_TITLE, _env.F_HOUSE_PRICE, _env.F_HOUSE_DESC },
                where = "",
                sortBy = new[] { new { fieldId = _env.F_HOUSE_TITLE, order = "ASC" } }
            };
            var houses = await _qb.QueryAsync(qHouses, ct);

            var items = new List<GalleryItem>();
            if (houses?.data == null || houses.data.Count == 0) return items;

            foreach (var rec in houses.data)
            {
                var idStr = rec.Get(_env.F_HOUSE_RID);
                if (!long.TryParse(idStr, out var id)) continue;

                decimal? price = null;
                var priceStr = rec.Get(_env.F_HOUSE_PRICE);
                if (decimal.TryParse(priceStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var p))
                    price = p;

                items.Add(new GalleryItem
                {
                    Id = id,
                    Title = rec.Get(_env.F_HOUSE_TITLE) ?? "",
                    Price = price,
                    Currency = "EUR",
                    Description = rec.Get(_env.F_HOUSE_DESC) ?? "",
                    Images = new List<string>()
                });
            }

            if (items.Count == 0) return items;

            // 2) Images — ONE QUERY PER HOUSE (explicitly as you requested)
            foreach (var it in items)
            {
                var where = "{" + _env.F_IMG_PARENT + ".EX.'" + it.Id + "'}";
                var qImg = new
                {
                    from = _env.TableImages,
                    // Only the fields we actually use:
                    // - attachment JSON (F_IMG_FILE)
                    // - optional text URL fallback (F_IMG_URL)
                    select = new[] { _env.F_IMG_FILE, _env.F_IMG_URL },
                    where
                };

                var imgs = await _qb.QueryAsync(qImg, ct);
                if (imgs?.data == null || imgs.data.Count == 0) continue;

                var urls = new List<String>();

                foreach (var rec in imgs.data)
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

                            // If we have "/files/dbid/rid/fid/version" we can split it and build the "up" URL
                            var up = BuildUpUrlFromFilesPath(valueUrl, fileName);
                            if (!string.IsNullOrWhiteSpace(up)) finalUrl = up;
                            // If not, fallback to the /files link itself (still works with open-access)
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

                    if (!string.IsNullOrWhiteSpace(finalUrl))
                    {
                        urls.Add(finalUrl);
                    }
                }

                if (urls.Count > 0)
                {
                    it.Images = urls;
                    it.CoverUrl = urls[0];
                }
            }

            return items;
        }

        /// <summary>
        /// Build "up" style public URL using only the string parts, as you requested:
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
