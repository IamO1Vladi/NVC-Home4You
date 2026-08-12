using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Services;

/// <summary>
/// Client-credentials tokens for Microsoft Graph, cached until they are nearly expired.
///
/// Extracted from EmailService once a second caller appeared. Caching is the point: Graph
/// tokens last about an hour, and the inbound poller wakes every couple of minutes. Minting
/// a fresh token per call would mean hundreds of pointless round trips a day and would
/// eventually get the app throttled by the identity endpoint — a failure that looks like
/// "email stopped working" and has nothing to do with mail.
/// </summary>
public class GraphTokens
{
    private readonly EnvConfig _env;
    private readonly IHttpClientFactory _httpFactory;

    // One refresh at a time. Without it, a poll tick and an outbound send arriving together
    // on a cold cache both request a token; harmless but wasteful, and it makes throttling
    // behaviour depend on timing.
    private readonly SemaphoreSlim _gate = new(1, 1);

    private string? _token;
    private DateTimeOffset _expiresAt;

    public GraphTokens(EnvConfig env, IHttpClientFactory httpFactory)
    {
        _env = env;
        _httpFactory = httpFactory;
    }

    // Refresh a minute early. A token that expires between the check and Graph reading it
    // fails the request rather than the token fetch, which surfaces as a confusing 401 on
    // a send instead of an obvious auth problem.
    private static readonly TimeSpan Margin = TimeSpan.FromMinutes(1);

    public async Task<string> GetAsync(CancellationToken ct = default)
    {
        if (_token is { Length: > 0 } cached && DateTimeOffset.UtcNow < _expiresAt - Margin)
            return cached;

        await _gate.WaitAsync(ct);
        try
        {
            // Re-check inside the gate: whoever was ahead of us has already refreshed it.
            if (_token is { Length: > 0 } fresh && DateTimeOffset.UtcNow < _expiresAt - Margin)
                return fresh;

            var http = _httpFactory.CreateClient();
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"https://login.microsoftonline.com/{Uri.EscapeDataString(_env.GraphTenantId)}/oauth2/v2.0/token")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = _env.GraphClientId,
                    ["client_secret"] = _env.GraphClientSecret,
                    ["scope"] = "https://graph.microsoft.com/.default",
                    ["grant_type"] = "client_credentials",
                }),
            };

            using var response = await http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Graph token request failed: {(int)response.StatusCode} {body}");

            using var doc = JsonDocument.Parse(body);
            var token = doc.RootElement.TryGetProperty("access_token", out var tokenEl) ? tokenEl.GetString() : null;
            if (string.IsNullOrWhiteSpace(token))
                throw new InvalidOperationException("Graph token response did not contain an access_token.");

            // Graph reports expires_in as seconds. Treated as a string OR a number,
            // because the identity endpoint has historically returned both.
            var lifetime = TimeSpan.FromMinutes(55);
            if (doc.RootElement.TryGetProperty("expires_in", out var expEl))
            {
                var seconds = expEl.ValueKind == JsonValueKind.Number
                    ? expEl.GetInt32()
                    : int.TryParse(expEl.GetString(), out var parsed) ? parsed : 0;
                if (seconds > 0) lifetime = TimeSpan.FromSeconds(seconds);
            }

            _token = token;
            _expiresAt = DateTimeOffset.UtcNow + lifetime;
            return token!;
        }
        finally
        {
            _gate.Release();
        }
    }
}
