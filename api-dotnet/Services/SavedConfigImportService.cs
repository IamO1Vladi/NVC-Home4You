using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Services;

/// <summary>
/// One-off import of saved configurator links from Quickbase into SQL.
///
/// Re-runnable: rows are matched on QuickbaseRecordId, so a second run updates in place
/// rather than minting a second row for a code. That matters more here than elsewhere — a
/// duplicated code would violate the unique index and fail the whole batch, and a code
/// resolving to two configurations is the failure this table exists to prevent.
///
/// A CODE THAT ALREADY EXISTS IN SQL IS LEFT ALONE. After the cutover, new configs are
/// saved natively and carry no Quickbase id; if the importer met a code it had already
/// seen from the other direction it would be about to overwrite live data with a stale
/// copy. It skips instead and reports the collision.
/// </summary>
public sealed class SavedConfigImportService
{
    private readonly AppDbContext _db;
    private readonly QuickbaseClient _qb;
    private readonly EnvConfig _env;

    public SavedConfigImportService(AppDbContext db, QuickbaseClient qb, EnvConfig env)
    {
        _db = db;
        _qb = qb;
        _env = env;
    }

    public sealed record Report(int Fetched, int Created, int Updated, int Skipped, List<string> Problems);

    public async Task<Report> ImportAsync(bool dryRun, CancellationToken ct = default)
    {
        var problems = new List<string>();

        if (!_env.SavedConfigsConfigured)
        {
            problems.Add("QB_TABLE_SAVED_CONFIGS is not set — nothing to import from.");
            return new Report(0, 0, 0, 0, problems);
        }

        var select = new List<int>
        {
            _env.F_SAVEDCFG_RID, _env.F_SAVEDCFG_CODE, _env.F_SAVEDCFG_JSON,
            _env.F_SAVEDCFG_MODEL, _env.F_SAVEDCFG_LOCALE, _env.F_SAVEDCFG_PATH,
        };
        if (_env.F_SAVEDCFG_EMAIL is int emailFid) select.Add(emailFid);

        // Paged: Quickbase caps a query at 500 rows and says nothing when it truncates, so
        // an unpaged read would import "the first 500" and look complete.
        var rows = await QueryAllAsync(select.ToArray(), ct);

        var created = 0;
        var updated = 0;
        var skipped = 0;

        foreach (var row in rows)
        {
            var code = SqlSavedConfigService.Sanitize(row.Get(_env.F_SAVEDCFG_CODE));
            var json = row.Get(_env.F_SAVEDCFG_JSON);
            var ridRaw = row.Get(_env.F_SAVEDCFG_RID);

            if (code.Length == 0 || string.IsNullOrWhiteSpace(json))
            {
                skipped++;
                problems.Add($"record {ridRaw}: missing code or config, skipped");
                continue;
            }

            // Parsed only to reject rows that would resolve to a blank configurator. The
            // ORIGINAL text is what gets stored — re-serialising would rewrite a customer's
            // saved configuration through this version of System.Text.Json.
            try { JsonSerializer.Deserialize<JsonElement>(json); }
            catch (JsonException)
            {
                skipped++;
                problems.Add($"record {ridRaw} ({code}): config JSON does not parse, skipped");
                continue;
            }

            int? rid = int.TryParse(ridRaw, out var parsed) ? parsed : null;

            var existing = rid is null
                ? null
                : await _db.SavedConfigs.FirstOrDefaultAsync(c => c.QuickbaseRecordId == rid, ct);

            if (existing is null)
            {
                var codeTaken = await _db.SavedConfigs.AnyAsync(c => c.Code == code, ct);
                if (codeTaken)
                {
                    // Saved natively in SQL after the cutover, or imported under a different
                    // record id. Either way the SQL row is the live one.
                    skipped++;
                    problems.Add($"record {ridRaw}: code {code} already exists in SQL, left untouched");
                    continue;
                }

                if (!dryRun)
                {
                    _db.SavedConfigs.Add(new SavedConfig
                    {
                        Code = code,
                        ConfigJson = json,
                        ModelLabel = AdminText.Clean(row.Get(_env.F_SAVEDCFG_MODEL)),
                        Locale = AdminText.Clean(row.Get(_env.F_SAVEDCFG_LOCALE)),
                        ReturnPath = AdminText.Clean(row.Get(_env.F_SAVEDCFG_PATH)),
                        Email = _env.F_SAVEDCFG_EMAIL is int fid ? AdminText.Clean(row.Get(fid)) : null,
                        QuickbaseRecordId = rid,
                    });
                }
                created++;
            }
            else
            {
                if (!dryRun)
                {
                    // The code is deliberately NOT reassigned: it is the identity a customer
                    // holds, and Quickbase changing it would be a bug, not an update.
                    existing.ConfigJson = json;
                    existing.ModelLabel = AdminText.Clean(row.Get(_env.F_SAVEDCFG_MODEL));
                    existing.Locale = AdminText.Clean(row.Get(_env.F_SAVEDCFG_LOCALE));
                    existing.ReturnPath = AdminText.Clean(row.Get(_env.F_SAVEDCFG_PATH));
                }
                updated++;
            }
        }

        if (!dryRun) await _db.SaveChangesAsync(ct);

        return new Report(rows.Count, created, updated, skipped, problems);
    }

    private async Task<List<QbRec>> QueryAllAsync(int[] select, CancellationToken ct)
    {
        var all = new List<QbRec>();
        var skip = 0;
        const int page = 500;

        while (true)
        {
            var body = new
            {
                from = _env.TableSavedConfigs,
                select,
                options = new { top = page, skip },
            };

            var res = await _qb.QueryAsync(body, ct);
            var batch = res?.data;
            if (batch is null || batch.Count == 0) break;

            all.AddRange(batch);
            if (batch.Count < page) break;
            skip += page;
        }

        return all;
    }
}
