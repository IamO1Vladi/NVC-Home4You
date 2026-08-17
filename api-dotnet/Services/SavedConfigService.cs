using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Models;

namespace Services;

// Stores/retrieves configurator configurations behind a short share code, backed by a
// Quickbase table (mirrors FormService's use of QuickbaseClient with raw request bodies).
// The config payload is treated as opaque JSON, so this service never depends on the
// configurator's schema.
public class SavedConfigService : ISavedConfigStore
{
    // Base62, minus visually ambiguous characters (0/O, 1/l/I) so codes stay readable
    // when typed or shared verbally.
    private const string CodeAlphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 8;
    private const int MaxCollisionRetries = 5;

    // A saved config row is write-once: SaveAsync creates it and nothing ever updates it,
    // so a resolved code can be cached for a long time. Only *successful* lookups are
    // cached — caching a miss would risk pinning a "not found" for a code that is about
    // to be minted, which would break a link already sent to a customer.
    private const string CachePrefix = "savedcfg:";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(12);

    private readonly QuickbaseClient _qb;
    private readonly EnvConfig _env;
    private readonly IMemoryCache _cache;

    public SavedConfigService(QuickbaseClient qb, EnvConfig env, IMemoryCache cache)
    {
        _qb = qb;
        _env = env;
        _cache = cache;
    }

    public bool IsConfigured => _env.SavedConfigsConfigured;

    // Persists the config and returns its freshly minted short code.
    public async Task<string> SaveAsync(SaveConfigRequest req, CancellationToken ct = default)
    {
        var code = await GenerateUniqueCodeAsync(ct);

        var rec = new Dictionary<string, object?>
        {
            [_env.F_SAVEDCFG_CODE.ToString()] = new { value = code },
            [_env.F_SAVEDCFG_JSON.ToString()] = new { value = req.Config.GetRawText() },
        };
        if (!string.IsNullOrWhiteSpace(req.ModelLabel))
            rec[_env.F_SAVEDCFG_MODEL.ToString()] = new { value = req.ModelLabel };
        if (!string.IsNullOrWhiteSpace(req.Locale))
            rec[_env.F_SAVEDCFG_LOCALE.ToString()] = new { value = req.Locale };
        if (!string.IsNullOrWhiteSpace(req.ReturnPath))
            rec[_env.F_SAVEDCFG_PATH.ToString()] = new { value = req.ReturnPath };
        if (_env.F_SAVEDCFG_EMAIL is int emailFid && !string.IsNullOrWhiteSpace(req.Email))
            rec[emailFid.ToString()] = new { value = req.Email };

        var body = new { to = _env.TableSavedConfigs, data = new[] { rec }, fieldsToReturn = new[] { 3 } };
        await _qb.CreateAsync(body, ct);
        return code;
    }

    // Returns the stored config (and its metadata) for a code, or null if unknown.
    public async Task<SavedConfigDto?> GetAsync(string code, CancellationToken ct = default)
    {
        var cacheKey = $"{CachePrefix}cfg:{Sanitize(code)}";
        if (_cache.TryGetValue(cacheKey, out SavedConfigDto? cached) && cached is not null)
            return cached;

        var row = await LookupAsync(code, new[] { _env.F_SAVEDCFG_JSON, _env.F_SAVEDCFG_MODEL, _env.F_SAVEDCFG_LOCALE }, ct);
        if (row is null) return null;

        var json = row.Get(_env.F_SAVEDCFG_JSON);
        if (string.IsNullOrWhiteSpace(json)) return null;

        JsonElement config;
        try { config = JsonSerializer.Deserialize<JsonElement>(json); }
        catch (JsonException) { return null; }

        var dto = new SavedConfigDto(config, row.Get(_env.F_SAVEDCFG_MODEL), row.Get(_env.F_SAVEDCFG_LOCALE));
        _cache.Set(cacheKey, dto, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = CacheTtl });
        return dto;
    }

    // Resolves a code to the localized return path saved with it (for the /c/{code}
    // redirect), or null if the code is unknown / has no stored path.
    public async Task<string?> GetReturnPathAsync(string code, CancellationToken ct = default)
    {
        var cacheKey = $"{CachePrefix}path:{Sanitize(code)}";
        if (_cache.TryGetValue(cacheKey, out string? cached) && !string.IsNullOrWhiteSpace(cached))
            return cached;

        var row = await LookupAsync(code, new[] { _env.F_SAVEDCFG_PATH }, ct);
        var path = row?.Get(_env.F_SAVEDCFG_PATH);
        if (string.IsNullOrWhiteSpace(path)) return null;

        _cache.Set(cacheKey, path, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = CacheTtl });
        return path;
    }

    private async Task<QbRec?> LookupAsync(string code, int[] select, CancellationToken ct)
    {
        var clean = Sanitize(code);
        if (clean.Length == 0) return null;

        var body = new
        {
            from = _env.TableSavedConfigs,
            select,
            where = $"{{{_env.F_SAVEDCFG_CODE}.EX.'{clean}'}}",
            options = new { top = 1 }
        };
        var res = await _qb.QueryAsync(body, ct);
        return res?.data?.FirstOrDefault();
    }

    private async Task<string> GenerateUniqueCodeAsync(CancellationToken ct)
    {
        for (var attempt = 0; attempt < MaxCollisionRetries; attempt++)
        {
            var code = GenerateCode(CodeLength);
            var existing = await LookupAsync(code, new[] { _env.F_SAVEDCFG_RID }, ct);
            if (existing is null) return code;
        }
        // Astronomically unlikely after 5 collisions; widen the code space instead of failing.
        return GenerateCode(CodeLength + 4);
    }

    private static string GenerateCode(int length)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++)
            chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return new string(chars);
    }

    // Codes are minted from a fixed alphanumeric alphabet, so a legitimate code can never
    // contain a quote or brace. Strip everything else before interpolating into a Quickbase
    // query, closing off any query-injection via a crafted {code} path segment.
    private static string Sanitize(string code) =>
        new string((code ?? "").Where(char.IsLetterOrDigit).ToArray());
}
