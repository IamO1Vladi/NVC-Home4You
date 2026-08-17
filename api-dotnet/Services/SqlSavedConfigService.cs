using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Models;

namespace Services;

/// <summary>
/// Saved configurator links on Azure SQL — the last table off Quickbase.
///
/// THE FALLBACK IS THE POINT OF THIS CLASS. Every other migrated table could be cut over on
/// a flag because a wrong answer showed up on a page somebody looks at. These codes are in
/// customers' inboxes, sent by the autoresponder since PR #8, and a code that stops
/// resolving is a customer clicking a link WE sent them and getting nothing — with no
/// signal to us that it happened. So a read that misses in SQL falls through to Quickbase,
/// exactly as ImageStore chains memory → Blob → Quickbase. That means the flag can be
/// flipped before the import has run, and a partial import degrades instead of breaking.
///
/// Writes go only to SQL. There is no dual-write: a saved config is write-once and
/// self-contained, so the worst case after a rollback is that configs saved during the SQL
/// window are missing from Quickbase — recoverable by re-importing in the other direction,
/// unlike a lead, where a lost write is a lost customer.
/// </summary>
public sealed class SqlSavedConfigService : ISavedConfigStore
{
    // Kept identical to SavedConfigService: codes minted before and after the cutover have
    // to be indistinguishable, and a customer reading one aloud must not hit a character
    // that only one generation of the code space allowed.
    private const string CodeAlphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 8;
    private const int MaxCollisionRetries = 5;

    private const string CachePrefix = "savedcfg:sql:";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(12);

    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly SavedConfigService _quickbase;
    private readonly ILogger<SqlSavedConfigService> _log;

    public SqlSavedConfigService(
        AppDbContext db,
        IMemoryCache cache,
        SavedConfigService quickbase,
        ILogger<SqlSavedConfigService> log)
    {
        _db = db;
        _cache = cache;
        _quickbase = quickbase;
        _log = log;
    }

    // SQL is configured whenever this service is resolvable at all — DataSourceFor only
    // returns Sql when a connection string is present.
    public bool IsConfigured => true;

    public async Task<string> SaveAsync(SaveConfigRequest req, CancellationToken ct = default)
    {
        var code = await GenerateUniqueCodeAsync(ct);

        _db.SavedConfigs.Add(new SavedConfig
        {
            Code = code,
            // Stored exactly as it arrived. The server has no business parsing the
            // configurator's schema, and a schema change must not strand saved links.
            ConfigJson = req.Config.GetRawText(),
            ModelLabel = AdminText.Clean(req.ModelLabel),
            Locale = AdminText.Clean(req.Locale),
            ReturnPath = AdminText.Clean(req.ReturnPath),
            Email = AdminText.Clean(req.Email),
        });

        await _db.SaveChangesAsync(ct);
        return code;
    }

    public async Task<SavedConfigDto?> GetAsync(string code, CancellationToken ct = default)
    {
        var clean = Sanitize(code);
        if (clean.Length == 0) return null;

        var cacheKey = $"{CachePrefix}cfg:{clean}";
        if (_cache.TryGetValue(cacheKey, out SavedConfigDto? cached) && cached is not null)
            return cached;

        var row = await _db.SavedConfigs.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Code == clean, ct);

        if (row is null)
        {
            // Not ours — try the store it may still live in. See the class comment.
            var legacy = await FromQuickbaseAsync(
                () => _quickbase.GetAsync(clean, ct), clean, nameof(GetAsync));
            if (legacy is not null)
                _cache.Set(cacheKey, legacy, Options());
            return legacy;
        }

        JsonElement config;
        try { config = JsonSerializer.Deserialize<JsonElement>(row.ConfigJson); }
        catch (JsonException)
        {
            // A row whose JSON will not parse is worse than a miss: it would resolve to a
            // blank configurator. Log it and let the caller 404 instead.
            _log.LogWarning("Saved config {Code} holds unparseable JSON", clean);
            return null;
        }

        var dto = new SavedConfigDto(config, row.ModelLabel, row.Locale);
        _cache.Set(cacheKey, dto, Options());
        return dto;
    }

    public async Task<string?> GetReturnPathAsync(string code, CancellationToken ct = default)
    {
        var clean = Sanitize(code);
        if (clean.Length == 0) return null;

        var cacheKey = $"{CachePrefix}path:{clean}";
        if (_cache.TryGetValue(cacheKey, out string? cached) && !string.IsNullOrWhiteSpace(cached))
            return cached;

        var path = await _db.SavedConfigs.AsNoTracking()
            .Where(c => c.Code == clean)
            .Select(c => c.ReturnPath)
            .FirstOrDefaultAsync(ct);

        // Distinguish "no such code" from "code exists with no path": only the first should
        // fall through to Quickbase. A row that genuinely has no return path is answered,
        // not re-queried against a store we are trying to retire.
        if (path is null)
        {
            var exists = await _db.SavedConfigs.AsNoTracking().AnyAsync(c => c.Code == clean, ct);
            if (!exists)
            {
                path = await FromQuickbaseAsync(
                    () => _quickbase.GetReturnPathAsync(clean, ct), clean, nameof(GetReturnPathAsync));
            }
        }

        if (string.IsNullOrWhiteSpace(path)) return null;

        _cache.Set(cacheKey, path, Options());
        return path;
    }

    /// <summary>
    /// Runs a Quickbase fallback, swallowing its failures.
    ///
    /// A dead Quickbase must degrade to "code not found" rather than a 500 — by the time
    /// this path is live, Quickbase is the store being retired, and its token expiry is a
    /// known future event. A miss is recoverable by the customer asking for a new link; an
    /// exception is a broken page.
    /// </summary>
    private async Task<T?> FromQuickbaseAsync<T>(Func<Task<T?>> read, string code, string op)
        where T : class
    {
        if (!_quickbase.IsConfigured) return null;

        try
        {
            var value = await read();
            if (value is not null)
                _log.LogInformation("Saved config {Code} resolved from Quickbase ({Op}) — not yet imported", code, op);
            return value;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Quickbase fallback failed for saved config {Code} ({Op})", code, op);
            return null;
        }
    }

    private static MemoryCacheEntryOptions Options() =>
        new() { AbsoluteExpirationRelativeToNow = CacheTtl };

    /// <summary>
    /// Mints a code nothing already uses — checked against BOTH stores.
    ///
    /// Quickbase is consulted too, and that is not paranoia: until the import has run, a
    /// code that exists only in Quickbase is invisible to a SQL-only uniqueness check, and
    /// re-minting it would point one customer's link at another customer's configuration.
    /// </summary>
    private async Task<string> GenerateUniqueCodeAsync(CancellationToken ct)
    {
        for (var attempt = 0; attempt < MaxCollisionRetries; attempt++)
        {
            var code = GenerateCode(CodeLength);

            if (await _db.SavedConfigs.AnyAsync(c => c.Code == code, ct)) continue;

            var takenInQuickbase = await FromQuickbaseAsync(
                () => _quickbase.GetAsync(code, ct), code, "collision-check") is not null;
            if (takenInQuickbase) continue;

            return code;
        }

        // Astronomically unlikely after five collisions; widen the space rather than fail
        // a save the customer is waiting on.
        return GenerateCode(CodeLength + 4);
    }

    private static string GenerateCode(int length)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++)
            chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return new string(chars);
    }

    /// <summary>
    /// Codes are minted from a fixed alphanumeric alphabet, so a legitimate one can never
    /// contain anything else. Kept even though EF parameterises the query: it also normalises
    /// the cache key, and it keeps the two implementations answering identically for junk
    /// input.
    /// </summary>
    public static string Sanitize(string? code) =>
        new((code ?? "").Where(char.IsLetterOrDigit).ToArray());
}
