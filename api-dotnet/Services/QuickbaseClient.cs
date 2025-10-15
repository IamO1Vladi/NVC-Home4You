using System.Net.Http.Json;
using Models;

namespace Services;

public class QuickbaseClient
{
    private readonly HttpClient _http;
    private readonly EnvConfig _env;
    public QuickbaseClient(HttpClient http, EnvConfig env, IConfiguration cfg)
    {
        _http = http;
        _env = env;
        if (!_http.DefaultRequestHeaders.Contains("QB-Realm-Hostname"))
            _http.DefaultRequestHeaders.Add("QB-Realm-Hostname", _env.Realm);
        if (!_http.DefaultRequestHeaders.Contains("Authorization"))
            _http.DefaultRequestHeaders.Add("Authorization", "QB-USER-TOKEN " + _env.Token);
    }

    public async Task<QbQueryResult?> QueryAsync(object body, CancellationToken ct = default)
    {
        var res = await _http.PostAsJsonAsync("v1/records/query", body, ct);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<QbQueryResult>(cancellationToken: ct);
    }

    public async Task<QbCreateResult?> CreateAsync(object body, CancellationToken ct = default)
    {
        var res = await _http.PostAsJsonAsync("v1/records", body, ct);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<QbCreateResult>(cancellationToken: ct);
    }

    public async Task<HttpResponseMessage> RawGetAsync(string path, CancellationToken ct = default)
    {
        var resp = await _http.GetAsync(path, ct);
        resp.EnsureSuccessStatusCode();
        return resp;
    }
}
