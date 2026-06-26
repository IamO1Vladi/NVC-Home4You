using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services;

public class QuickbaseApi
{
    private readonly HttpClient _http;
    private readonly EnvConfig _env;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public QuickbaseApi(HttpClient http, EnvConfig env)
    {
        _http = http;
        _env = env;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_env.Realm) &&
        !string.IsNullOrWhiteSpace(_env.Token);

    public async Task<QbQueryResult> QueryAsync(string tableId, IEnumerable<int> select,string where, int? sortFid, string sortOrder, CancellationToken ct)
    {
        EnsureConfigured();
        if (string.IsNullOrWhiteSpace(tableId)) throw new InvalidOperationException("Quickbase table id is missing.");

        var selectList = select.Where(fid => fid > 0).Distinct().ToArray();
        if (selectList.Length == 0) throw new InvalidOperationException("Quickbase select list is empty.");

        var payload = new Dictionary<string, object?>
        {
            ["from"] = tableId,
            ["select"] = selectList,
            ["options"] = new { skip = 0, top = 500 }
        };

        if (sortFid.HasValue && sortFid.Value > 0)
        {
            payload["sortBy"] = new[] { new { fieldId = sortFid.Value, order = string.IsNullOrWhiteSpace(sortOrder) ? "ASC" : sortOrder } };
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/records/query")
        {
            Content = JsonContent.Create(payload)
        };

        AddHeaders(request);

        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Quickbase query failed: {(int)response.StatusCode} {body}");
        }

        return JsonSerializer.Deserialize<QbQueryResult>(body, JsonOptions) ?? new QbQueryResult();
    }

    public async Task<QbCreateResult> CreateAsync(string tableId, Dictionary<int, object?> fields, CancellationToken ct)
    {
        EnsureConfigured();
        if (string.IsNullOrWhiteSpace(tableId)) throw new InvalidOperationException("Quickbase table id is missing.");

        var dataRecord = new Dictionary<string, object>();
        foreach (var kvp in fields.Where(x => x.Key > 0 && x.Value is not null))
        {
            dataRecord[kvp.Key.ToString()] = new { value = kvp.Value };
        }

        if (dataRecord.Count == 0) throw new InvalidOperationException("Quickbase create payload is empty.");

        var payload = new
        {
            to = tableId,
            data = new[] { dataRecord },
            fieldsToReturn = new[] { 3 }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/records")
        {
            Content = JsonContent.Create(payload)
        };

        AddHeaders(request);

        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Quickbase create failed: {(int)response.StatusCode} {body}");
        }

        return JsonSerializer.Deserialize<QbCreateResult>(body, JsonOptions) ?? new QbCreateResult();
    }

    private void AddHeaders(HttpRequestMessage request)
    {
        request.Headers.TryAddWithoutValidation("QB-Realm-Hostname", _env.Realm);
        request.Headers.TryAddWithoutValidation("Authorization", $"QB-USER-TOKEN {_env.Token}");
        request.Headers.TryAddWithoutValidation("Accept", "application/json");
        request.Headers.TryAddWithoutValidation("User-Agent", "NVC-Home4You/1.0");
    }

    private void EnsureConfigured()
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "Quickbase integration is missing QUICKBASE_REALM or QUICKBASE_TOKEN.");
        }
    }
}
