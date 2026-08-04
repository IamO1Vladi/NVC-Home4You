using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Models;

namespace Services;

public class CasesPageService
{
    private readonly QuickbaseApi _qb;
    private readonly EnvConfig _env;
    private readonly IMemoryCache _cache;
    private readonly IReviewReader _reviews;

    private const string CacheKey = "cases-page:v1";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

    public CasesPageService(QuickbaseApi qb, EnvConfig env, IMemoryCache cache, IReviewReader reviews)
    {
        _qb = qb;
        _env = env;
        _cache = cache;
        _reviews = reviews;
    }

    public async Task<CasesPageResponse> GetAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out CasesPageResponse? cached) && cached is not null)
            return cached;

        var response = await LoadAsync(ct);

        _cache.Set(CacheKey, response, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = CacheTtl
        });

        return response;
    }

    private async Task<CasesPageResponse> LoadAsync(CancellationToken ct)
    {
        if (!_qb.IsConfigured || string.IsNullOrWhiteSpace(_env.TableCases))
        {
            return new CasesPageResponse();
        }

        var caseRows = await _qb.QueryAsync(_env.TableCases, BuildCaseSelect(), "", _env.F_CASE_SORT, "ASC", ct);
        var rawCases = caseRows.data ?? new List<QbRec>();

        var publicCaseIds = rawCases
            .Where(IsCasePublic)
            .Select(row => ToLong(Get(row, _env.F_CASE_RID) ?? Get(row, 3)))
            .Where(id => id > 0)
            .Distinct()
            .ToArray();

        var relatedImages = await LoadCaseImagesAsync(publicCaseIds, ct);
        var cases = MapCases(rawCases, relatedImages);
        var reviews = await _reviews.GetApprovedReviewsAsync(ct);
        var clients = BuildClients(cases);

        return new CasesPageResponse
        {
            Stats = new CasesPageStats
            {
                PublishedCases = cases.Count,
                ApprovedReviews = reviews.Count,
                CountriesServed = CountCountries(cases)
            },
            Clients = clients,
            Cases = cases,
            Reviews = reviews
        };
    }

    private IReadOnlyCollection<int> BuildCaseSelect()
    {
        var fields = new HashSet<int>
        {
            _env.F_CASE_RID,
            _env.F_CASE_PUBLISHED,
            _env.F_CASE_FEATURED,
            _env.F_CASE_SORT,
            _env.F_CASE_COMPANY_NAME,
            _env.F_CASE_COMPANY_SECTOR,
            _env.F_CASE_BUYER_NAME,
            _env.F_CASE_BUYER_ROLE,
            _env.F_CASE_COUNTRY,
            _env.F_CASE_CITY,
            _env.F_CASE_PUBLIC_LOCATION,
            _env.F_CASE_CATEGORY,
            _env.F_CASE_PRODUCT_NAME,
            _env.F_CASE_PRODUCT_VARIANT,
            _env.F_CASE_UNITS,
            _env.F_CASE_YEAR,
            _env.F_CASE_DELIVERED_AT,
            _env.F_CASE_SCOPE,
            _env.F_CASE_RESULT,
            _env.F_CASE_QUOTE,
            _env.F_CASE_RATING,
            _env.F_CASE_LOGO_FILE,
            _env.F_CASE_IMAGE_FILE,
            _env.F_CASE_VISIBILITY,
            _env.F_CASE_IS_PUBLIC,
            _env.F_CASE_PUBLIC_BUYER_LABEL,
        };

        foreach (var fid in _env.CaseExtraImageFids)
        {
            if (fid > 0) fields.Add(fid);
        }

        return fields.Where(fid => fid > 0).ToArray();
    }

    private async Task<Dictionary<long, List<string>>> LoadCaseImagesAsync(
        IReadOnlyCollection<long> parentCaseIds,
        CancellationToken ct)
    {
        var map = new Dictionary<long, List<(int Sort, int Seq, string Url)>>();

        if (string.IsNullOrWhiteSpace(_env.TableCaseImages) ||
            _env.F_CASEIMG_PARENT <= 0 ||
            parentCaseIds.Count == 0)
        {
            return new Dictionary<long, List<string>>();
        }

        var select = new HashSet<int>
        {
            _env.F_CASEIMG_RID,
            _env.F_CASEIMG_PARENT
        };

        if (_env.F_CASEIMG_FILE.HasValue)
            select.Add(_env.F_CASEIMG_FILE.Value);

        if (_env.F_CASEIMG_URL.HasValue)
            select.Add(_env.F_CASEIMG_URL.Value);

      

        var seq = 0;
        var sortField = _env.F_CASEIMG_SORT > 0 ? _env.F_CASEIMG_SORT : _env.F_CASEIMG_RID;

        foreach (var batch in Batch(parentCaseIds, 50))
        {
            var where = BuildCaseImageWhere(batch);
            if (string.IsNullOrWhiteSpace(where))
                continue;

            // Assumes QuickbaseApi has a where-capable overload.
            var rows = await _qb.QueryAsync(_env.TableCaseImages, select, where, sortField, "ASC", ct);

            foreach (var row in rows.data ?? new List<QbRec>())
            {
                var parentRid = ToLong(Get(row, _env.F_CASEIMG_PARENT));
                if (parentRid <= 0)
                    continue;

                var imageRowRid = ToLong(Get(row, _env.F_CASEIMG_RID));

                // Direct URL field should only normalize what is already stored.
                var directUrl = ResolveStoredUrl(Get(row, _env.F_CASEIMG_URL));

                // File field should resolve attachment JSON / attachment path.
                var fileUrl = ResolveAttachmentUrl(row, _env.TableCaseImages, imageRowRid, _env.F_CASEIMG_FILE);

                var url = FirstNonEmpty(directUrl, fileUrl);
                if (string.IsNullOrWhiteSpace(url))
                    continue;

                if (!map.TryGetValue(parentRid, out var items))
                {
                    items = new List<(int Sort, int Seq, string Url)>();
                    map[parentRid] = items;
                }

                items.Add((
                    ParseSortNumber(Get(row, _env.F_CASEIMG_SORT)),
                    seq++,
                    url
                ));
            }
        }

        return map.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value
                .OrderBy(x => x.Sort)
                .ThenBy(x => x.Seq)
                .Select(x => x.Url)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList()
        );
    }

    private string BuildCaseImageWhere(IEnumerable<long> parentCaseIds)
    {
        return string.Join(
            "OR",
            parentCaseIds
                .Where(id => id > 0)
                .Distinct()
                .Select(id => "{" + _env.F_CASEIMG_PARENT + ".EX.'" + id.ToString(CultureInfo.InvariantCulture) + "'}")
        );
    }

    private List<PublicCaseDto> MapCases(
        IEnumerable<QbRec> rows,
        IReadOnlyDictionary<long, List<string>> relatedImages)
    {
        var list = new List<PublicCaseDto>();

        foreach (var row in rows)
        {
            if (!IsCasePublic(row))
                continue;

            var ridText = Get(row, _env.F_CASE_RID) ?? Get(row, 3) ?? Guid.NewGuid().ToString("N");
            var rid = ToLong(ridText);
            var companyName = Get(row, _env.F_CASE_COMPANY_NAME) ?? string.Empty;
            var hasCompany = !string.IsNullOrWhiteSpace(companyName);
            var buyerName = Get(row, _env.F_CASE_BUYER_NAME);
            var publicBuyerLabel = Get(row, _env.F_CASE_PUBLIC_BUYER_LABEL);

            var images = new List<string>();

            AddUnique(images, ResolveAttachmentUrl(row, _env.TableCases, rid, _env.F_CASE_IMAGE_FILE));

            foreach (var fid in _env.CaseExtraImageFids)
            {
                AddUnique(images, ResolveAttachmentUrl(row, _env.TableCases, rid, fid));
            }

            if (rid > 0 && relatedImages.TryGetValue(rid, out var extraImages))
            {
                foreach (var image in extraImages)
                {
                    AddUnique(images, image);
                }
            }

            var item = new PublicCaseDto
            {
                Id = ridText,
                Featured = IsTruthy(Get(row, _env.F_CASE_FEATURED)),
                CompanyName = companyName,
                // Sector, buyer role and logo are company-only fields. When there is no
                // company name the case is a private individual, so we leave them empty.
                CompanyType = hasCompany ? Get(row, _env.F_CASE_COMPANY_SECTOR) : null,
                BuyerName = FirstNonEmpty(buyerName, publicBuyerLabel, companyName),
                BuyerRole = hasCompany ? Get(row, _env.F_CASE_BUYER_ROLE) : null,
                Category = Get(row, _env.F_CASE_CATEGORY),
                Product = ComposeProductName(Get(row, _env.F_CASE_PRODUCT_NAME), Get(row, _env.F_CASE_PRODUCT_VARIANT)),
                Units = Get(row, _env.F_CASE_UNITS),
                Location = FirstNonEmpty(
                    Get(row, _env.F_CASE_PUBLIC_LOCATION),
                    JoinNonEmpty(", ", Get(row, _env.F_CASE_CITY), Get(row, _env.F_CASE_COUNTRY))
                ),
                Year = FirstNonEmpty(
                    NormalizeYear(Get(row, _env.F_CASE_YEAR)),
                    NormalizeYear(Get(row, _env.F_CASE_DELIVERED_AT))
                ),
                Scope = Get(row, _env.F_CASE_SCOPE),
                Result = Get(row, _env.F_CASE_RESULT),
                Quote = Get(row, _env.F_CASE_QUOTE),
                Rating = ToDouble(Get(row, _env.F_CASE_RATING)),
                CompanyLogoUrl = hasCompany ? ResolveAttachmentUrl(row, _env.TableCases, rid, _env.F_CASE_LOGO_FILE) : null,
                ImageUrl = images.FirstOrDefault(),
                Images = images,
            };

            // Keep the case as long as it has something to identify it by. Cases sold to a
            // private individual have no company name but still carry a buyer name / product.
            if (string.IsNullOrWhiteSpace(item.CompanyName) &&
                string.IsNullOrWhiteSpace(item.BuyerName) &&
                string.IsNullOrWhiteSpace(item.Product))
                continue;

            list.Add(item);
        }

        return list;
    }

    private bool IsCasePublic(QbRec row)
    {
        if (IsTruthy(Get(row, _env.F_CASE_PUBLISHED))) return true;
        if (IsTruthy(Get(row, _env.F_CASE_IS_PUBLIC))) return true;

        var status = (Get(row, _env.F_CASE_VISIBILITY) ?? string.Empty).Trim();

        return status.Equals("public", StringComparison.OrdinalIgnoreCase)
            || status.Equals("published", StringComparison.OrdinalIgnoreCase)
            || status.Equals("visible", StringComparison.OrdinalIgnoreCase)
            || status.Equals("show", StringComparison.OrdinalIgnoreCase);
    }

    private List<PublicClientDto> BuildClients(IEnumerable<PublicCaseDto> cases)
    {
        var map = new Dictionary<string, PublicClientDto>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in cases)
        {
            if (string.IsNullOrWhiteSpace(item.CompanyName)) continue;
            if (map.ContainsKey(item.CompanyName)) continue;

            map[item.CompanyName] = new PublicClientDto
            {
                Id = item.Id,
                Name = item.CompanyName,
                Sector = item.CompanyType,
                Country = LastLocationPart(item.Location),
                LogoUrl = item.CompanyLogoUrl,
            };
        }

        return map.Values.ToList();
    }

    private static int CountCountries(IEnumerable<PublicCaseDto> cases)
    {
        return cases
            .Select(x => LastLocationPart(x.Location))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();
    }

    private string? ResolveAttachmentUrl(QbRec row, string tableId, long recordId, int? fid)
    {
        if (!fid.HasValue || fid.Value <= 0)
            return null;

        if (row.TryGetElement(fid.Value, out var raw))
        {
            var fromElement = ResolveAttachmentElement(raw, tableId, recordId, fid.Value);
            if (!string.IsNullOrWhiteSpace(fromElement))
                return fromElement;
        }

        var rawText = row.Get(fid.Value);
        if (string.IsNullOrWhiteSpace(rawText))
            return null;

        var trimmed = rawText.Trim();

        if (trimmed.StartsWith("{", StringComparison.Ordinal) ||
            trimmed.StartsWith("[", StringComparison.Ordinal))
        {
            try
            {
                using var doc = JsonDocument.Parse(trimmed);
                var fromJson = ResolveAttachmentElement(doc.RootElement, tableId, recordId, fid.Value);
                if (!string.IsNullOrWhiteSpace(fromJson))
                    return fromJson;
            }
            catch
            {
                // Ignore malformed JSON and fall through.
            }
        }

        return ResolveStoredUrl(trimmed)
            ?? BuildDownloadUrl(
                tableId,
                recordId.ToString(CultureInfo.InvariantCulture),
                fid.Value.ToString(CultureInfo.InvariantCulture),
                "0",
                null);
    }

    private string? ResolveAttachmentElement(JsonElement raw, string tableId, long recordId, int fid)
    {
        if (IsEmpty(raw))
            return null;

        if (raw.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in raw.EnumerateArray())
            {
                var candidate = ResolveAttachmentElement(child, tableId, recordId, fid);
                if (!string.IsNullOrWhiteSpace(candidate))
                    return candidate;
            }

            return null;
        }

        if (raw.ValueKind == JsonValueKind.Object)
        {
            // Prefer browserUrl first because that preserves the exact Quickbase /up/... URL
            // shape like:
            //   https://vladimirbuilder.quickbase.com/up/bvxetssae/g/rb/e4/vb
            var valueUrl = FirstNonEmpty(
                GetJsonString(raw, "browserUrl"),
                GetNestedJsonString(raw, "value", "browserUrl"),
                GetJsonArrayItemString(raw, "versions", 0, "browserUrl"),
                GetNestedJsonArrayItemString(raw, "value", "versions", 0, "browserUrl"),
                GetJsonString(raw, "url"),
                GetNestedJsonString(raw, "value", "url"),
                GetNestedJsonString(raw, "value", "valueUrl"),
                GetJsonArrayItemString(raw, "versions", 0, "url"),
                GetNestedJsonArrayItemString(raw, "value", "versions", 0, "url")
            );

            var fileName = FirstNonEmpty(
                GetJsonString(raw, "fileName"),
                GetJsonString(raw, "filename"),
                GetJsonString(raw, "name"),
                GetNestedJsonString(raw, "value", "fileName"),
                GetNestedJsonString(raw, "value", "filename"),
                GetNestedJsonString(raw, "value", "name"),
                GetJsonArrayItemString(raw, "versions", 0, "fileName"),
                GetNestedJsonArrayItemString(raw, "value", "versions", 0, "fileName")
            );

            return ResolveStoredUrl(valueUrl, fileName)
                ?? BuildDownloadUrl(
                    tableId,
                    recordId.ToString(CultureInfo.InvariantCulture),
                    fid.ToString(CultureInfo.InvariantCulture),
                    "0",
                    fileName);
        }

        if (raw.ValueKind == JsonValueKind.String)
        {
            return ResolveStoredUrl(raw.GetString())
                ?? BuildDownloadUrl(
                    tableId,
                    recordId.ToString(CultureInfo.InvariantCulture),
                    fid.ToString(CultureInfo.InvariantCulture),
                    "0",
                    null);
        }

        return BuildDownloadUrl(
            tableId,
            recordId.ToString(CultureInfo.InvariantCulture),
            fid.ToString(CultureInfo.InvariantCulture),
            "0",
            null);
    }

    private string? ResolveStoredUrl(string? valueUrl, string? fileName = null)
    {
        if (string.IsNullOrWhiteSpace(valueUrl))
            return null;

        var trimmed = valueUrl.Trim();

        if (trimmed.StartsWith("data:", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("blob:", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            if (trimmed.Contains("/up/", StringComparison.OrdinalIgnoreCase))
                return trimmed;

            var absolutePath = Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
                ? uri.AbsolutePath
                : trimmed;

            var rebuiltFromFiles = BuildUpUrlFromFilesPath(absolutePath, fileName);
            if (!string.IsNullOrWhiteSpace(rebuiltFromFiles))
                return rebuiltFromFiles;

            return trimmed;
        }

        if (trimmed.StartsWith("/up/", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("up/", StringComparison.OrdinalIgnoreCase))
        {
            return MakeAbsoluteUrl(trimmed);
        }

        var rebuilt = BuildUpUrlFromFilesPath(trimmed, fileName);
        if (!string.IsNullOrWhiteSpace(rebuilt))
            return rebuilt;

        if (trimmed.StartsWith("/", StringComparison.Ordinal) ||
            trimmed.StartsWith("files/", StringComparison.OrdinalIgnoreCase))
        {
            return MakeAbsoluteUrl(trimmed);
        }

        return null;
    }

    private string? BuildUpUrlFromFilesPath(string? valueUrl, string? fileName)
    {
        if (!TryParseFilesPath(valueUrl, out var dbid, out var rid, out var fid, out var version))
            return null;

        return BuildDownloadUrl(dbid, rid, fid, version, fileName);
    }

    private string? BuildDownloadUrl(
        string tableId,
        string recordId,
        string fieldId,
        string? version,
        string? fileName)
    {
        if (string.IsNullOrWhiteSpace(tableId) ||
            string.IsNullOrWhiteSpace(recordId) ||
            string.IsNullOrWhiteSpace(fieldId))
        {
            return null;
        }

        var safeVersion = string.IsNullOrWhiteSpace(version) ? "0" : version.Trim();
        var path = $"/up/{tableId.Trim()}/a/r{recordId.Trim()}/e{fieldId.Trim()}/v{safeVersion}";
        var absolute = MakeAbsoluteUrl(path);

        if (string.IsNullOrWhiteSpace(absolute))
            return null;

        return string.IsNullOrWhiteSpace(fileName)
            ? absolute
            : $"{absolute}/{Uri.EscapeDataString(fileName)}";
    }

    private string? MakeAbsoluteUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();

        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        if (trimmed.StartsWith("/", StringComparison.Ordinal))
        {
            return string.IsNullOrWhiteSpace(_env.Realm)
                ? trimmed
                : $"https://{_env.Realm}{trimmed}";
        }

        if (trimmed.StartsWith("up/", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("files/", StringComparison.OrdinalIgnoreCase))
        {
            return string.IsNullOrWhiteSpace(_env.Realm)
                ? "/" + trimmed.TrimStart('/')
                : $"https://{_env.Realm}/{trimmed.TrimStart('/')}";
        }

        return trimmed;
    }

    private static bool TryParseFilesPath(
        string? valueUrl,
        out string dbid,
        out string rid,
        out string fid,
        out string version)
    {
        dbid = rid = fid = version = string.Empty;

        if (string.IsNullOrWhiteSpace(valueUrl))
            return false;

        var normalized = NormalizeFilesPath(valueUrl);
        if (string.IsNullOrWhiteSpace(normalized))
            return false;

        var parts = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 5 || !parts[0].Equals("files", StringComparison.OrdinalIgnoreCase))
            return false;

        dbid = parts[1];
        rid = parts[2];
        fid = parts[3];
        version = parts[4];
        return true;
    }

    private static string? NormalizeFilesPath(string valueUrl)
    {
        var trimmed = valueUrl.Trim();

        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
            {
                trimmed = uri.AbsolutePath;
            }
        }

        var index = trimmed.IndexOf("/files/", StringComparison.OrdinalIgnoreCase);

        if (index >= 0)
        {
            trimmed = trimmed[index..];
        }
        else if (trimmed.StartsWith("files/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = "/" + trimmed;
        }

        return trimmed;
    }

    private static bool IsEmpty(JsonElement raw)
    {
        return raw.ValueKind switch
        {
            JsonValueKind.Undefined => true,
            JsonValueKind.Null => true,
            JsonValueKind.String => string.IsNullOrWhiteSpace(raw.GetString()),
            JsonValueKind.Array => raw.GetArrayLength() == 0,
            JsonValueKind.Object => !raw.EnumerateObject().Any(),
            _ => false,
        };
    }

    private static string? Get(QbRec row, int? fid)
    {
        if (!fid.HasValue || fid.Value <= 0)
            return null;

        return row.Get(fid.Value);
    }

    private static string? GetJsonString(JsonElement raw, string propertyName)
    {
        if (raw.ValueKind != JsonValueKind.Object)
            return null;

        foreach (var property in raw.EnumerateObject())
        {
            if (!property.NameEquals(propertyName))
                continue;

            return property.Value.ValueKind == JsonValueKind.String
                ? property.Value.GetString()
                : property.Value.GetRawText();
        }

        return null;
    }

    private static string? GetNestedJsonString(JsonElement raw, string parentProperty, string childProperty)
    {
        if (raw.ValueKind != JsonValueKind.Object)
            return null;

        foreach (var property in raw.EnumerateObject())
        {
            if (!property.NameEquals(parentProperty) || property.Value.ValueKind != JsonValueKind.Object)
                continue;

            return GetJsonString(property.Value, childProperty);
        }

        return null;
    }

    private static string? GetJsonArrayItemString(
        JsonElement raw,
        string arrayProperty,
        int index,
        string childProperty)
    {
        if (raw.ValueKind != JsonValueKind.Object)
            return null;

        foreach (var property in raw.EnumerateObject())
        {
            if (!property.NameEquals(arrayProperty) || property.Value.ValueKind != JsonValueKind.Array)
                continue;

            if (property.Value.GetArrayLength() <= index)
                return null;

            return GetJsonString(property.Value[index], childProperty);
        }

        return null;
    }

    private static string? GetNestedJsonArrayItemString(
        JsonElement raw,
        string parentProperty,
        string arrayProperty,
        int index,
        string childProperty)
    {
        if (raw.ValueKind != JsonValueKind.Object)
            return null;

        foreach (var property in raw.EnumerateObject())
        {
            if (!property.NameEquals(parentProperty) || property.Value.ValueKind != JsonValueKind.Object)
                continue;

            return GetJsonArrayItemString(property.Value, arrayProperty, index, childProperty);
        }

        return null;
    }

    private static bool IsTruthy(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var normalized = value.Trim().ToLowerInvariant();
        return normalized is "1" or "true" or "yes" or "on" or "checked";
    }

    private static void AddUnique(List<string> list, string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        if (list.Any(existing => string.Equals(existing, value, StringComparison.OrdinalIgnoreCase))) return;
        list.Add(value);
    }

    private static string? ComposeProductName(string? name, string? variant)
    {
        var cleanName = Clean(name);
        var cleanVariant = Clean(variant);

        if (!string.IsNullOrWhiteSpace(cleanName) && !string.IsNullOrWhiteSpace(cleanVariant))
            return $"{cleanName} - {cleanVariant}";

        return FirstNonEmpty(cleanName, cleanVariant);
    }

    private static string? Clean(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? JoinNonEmpty(string separator, params string?[] values)
    {
        var list = values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .ToArray();

        return list.Length == 0 ? null : string.Join(separator, list);
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }

        return null;
    }

    private static long ToLong(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return 0;

        return long.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var number)
            ? number
            : 0;
    }

    private static int ParseSortNumber(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return int.MaxValue;

        if (int.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var number))
            return number;

        return int.MaxValue;
    }

    private static double ToDouble(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return 0;

        if (double.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var num))
            return num;

        if (double.TryParse(value, NumberStyles.Any, CultureInfo.CurrentCulture, out num))
            return num;

        return 0;
    }

    private static string? NormalizeYear(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        if (int.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var year) &&
            year >= 1900 &&
            year <= 3000)
        {
            return year.ToString(CultureInfo.InvariantCulture);
        }

        if (long.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var epoch) &&
            epoch > 100000000000)
        {
            try
            {
                return DateTimeOffset
                    .FromUnixTimeMilliseconds(epoch)
                    .UtcDateTime
                    .Year
                    .ToString(CultureInfo.InvariantCulture);
            }
            catch
            {
            }
        }

        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
        {
            return dto.UtcDateTime.Year.ToString(CultureInfo.InvariantCulture);
        }

        return value;
    }

    private static string? LastLocationPart(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var parts = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length == 0 ? value : parts[^1];
    }

    private static IEnumerable<List<long>> Batch(IEnumerable<long> values, int batchSize)
    {
        if (batchSize <= 0)
            throw new ArgumentOutOfRangeException(nameof(batchSize));

        var batch = new List<long>(batchSize);

        foreach (var value in values)
        {
            if (value <= 0)
                continue;

            batch.Add(value);

            if (batch.Count >= batchSize)
            {
                yield return batch;
                batch = new List<long>(batchSize);
            }
        }

        if (batch.Count > 0)
            yield return batch;
    }
}