using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Services;

// Copies the Quickbase reviews table into SQL. Deliberately not exposed over HTTP: the
// app has no authentication yet, so an import endpoint would be an unauthenticated way
// to hammer Quickbase and rewrite the table. Run it from the CLI instead:
//
//   dotnet run -- import-reviews      (import/refresh)
//   dotnet run -- compare-reviews     (shadow comparison, read-only)
//
// Idempotent: rows are matched on QuickbaseRecordId, so re-running updates in place
// rather than duplicating. Quickbase stays the source of truth until cutover.
public class ReviewImportService
{
    private readonly QuickbaseApi _qb;
    private readonly EnvConfig _env;
    private readonly AppDbContext _db;

    public ReviewImportService(QuickbaseApi qb, EnvConfig env, AppDbContext db)
    {
        _qb = qb;
        _env = env;
        _db = db;
    }

    public record ImportResult(int Fetched, int Inserted, int Updated, int Skipped);

    public async Task<ImportResult> ImportAsync(CancellationToken ct)
    {
        var rows = await FetchAllAsync(ct);
        int inserted = 0, updated = 0, skipped = 0;

        // One round trip for the existing rows: the table is small (hundreds), and this
        // avoids a SELECT per imported record.
        var existing = await _db.Reviews
            .Where(r => r.QuickbaseRecordId != null)
            .ToDictionaryAsync(r => r.QuickbaseRecordId!.Value, ct);

        foreach (var row in rows)
        {
            var rid = ParseInt(Get(row, _env.F_REVIEW_RID));
            if (rid is null) { skipped++; continue; }   // no record id: nothing stable to key on

            if (!existing.TryGetValue(rid.Value, out var entity))
            {
                entity = new Review { QuickbaseRecordId = rid.Value };
                _db.Reviews.Add(entity);
                inserted++;
            }
            else
            {
                updated++;
            }

            entity.Name = Trim(Get(row, _env.F_REVIEW_NAME), 200) ?? "";
            entity.Company = Trim(Get(row, _env.F_REVIEW_COMPANY), 200);
            entity.Email = Trim(Get(row, _env.F_REVIEW_EMAIL), 320);
            entity.Location = Trim(Get(row, _env.F_REVIEW_LOCATION), 200);
            entity.Product = Trim(Get(row, _env.F_REVIEW_PRODUCT), 200);
            entity.Comment = Trim(Get(row, _env.F_REVIEW_COMMENT), 4000);
            entity.Rating = ParseDouble(Get(row, _env.F_REVIEW_RATING));
            entity.Status = Trim(Get(row, _env.F_REVIEW_STATUS), 32) ?? _env.ReviewPendingValue;
            entity.CreatedAt = ParseDate(Get(row, _env.F_REVIEW_CREATED)) ?? entity.CreatedAt;
            entity.UpdatedAt = ParseDate(Get(row, _env.F_REVIEW_MODIFIED));
        }

        await _db.SaveChangesAsync(ct);
        return new ImportResult(rows.Count, inserted, updated, skipped);
    }

    public record Difference(int QuickbaseRecordId, string Field, string? Quickbase, string? Sql);

    // Read-only shadow comparison: does SQL agree with Quickbase right now? This is the
    // acceptance gate before any DATA_SOURCE_* flag is flipped to sql.
    public async Task<(int Compared, List<Difference> Differences)> CompareAsync(CancellationToken ct)
    {
        var rows = await FetchAllAsync(ct);
        var sqlRows = await _db.Reviews
            .Where(r => r.QuickbaseRecordId != null)
            .ToDictionaryAsync(r => r.QuickbaseRecordId!.Value, ct);

        var diffs = new List<Difference>();
        var compared = 0;

        foreach (var row in rows)
        {
            var rid = ParseInt(Get(row, _env.F_REVIEW_RID));
            if (rid is null) continue;

            if (!sqlRows.TryGetValue(rid.Value, out var e))
            {
                diffs.Add(new Difference(rid.Value, "(row)", "present", "MISSING"));
                continue;
            }

            compared++;
            Compare(diffs, rid.Value, "Name", Trim(Get(row, _env.F_REVIEW_NAME), 200) ?? "", e.Name);
            Compare(diffs, rid.Value, "Company", Trim(Get(row, _env.F_REVIEW_COMPANY), 200), e.Company);
            Compare(diffs, rid.Value, "Email", Trim(Get(row, _env.F_REVIEW_EMAIL), 320), e.Email);
            Compare(diffs, rid.Value, "Location", Trim(Get(row, _env.F_REVIEW_LOCATION), 200), e.Location);
            Compare(diffs, rid.Value, "Product", Trim(Get(row, _env.F_REVIEW_PRODUCT), 200), e.Product);
            Compare(diffs, rid.Value, "Comment", Trim(Get(row, _env.F_REVIEW_COMMENT), 4000), e.Comment);
            Compare(diffs, rid.Value, "Status", Trim(Get(row, _env.F_REVIEW_STATUS), 32), e.Status);

            var qbRating = ParseDouble(Get(row, _env.F_REVIEW_RATING));
            if (Math.Abs(qbRating - e.Rating) > 0.001)
                diffs.Add(new Difference(rid.Value, "Rating", qbRating.ToString(CultureInfo.InvariantCulture),
                    e.Rating.ToString(CultureInfo.InvariantCulture)));
        }

        // Rows in SQL that Quickbase no longer has — deletions the import doesn't yet mirror.
        var qbIds = rows.Select(r => ParseInt(Get(r, _env.F_REVIEW_RID))).Where(i => i is not null).Select(i => i!.Value).ToHashSet();
        foreach (var orphan in sqlRows.Keys.Where(k => !qbIds.Contains(k)))
            diffs.Add(new Difference(orphan, "(row)", "MISSING", "present"));

        return (compared, diffs);
    }

    private static void Compare(List<Difference> diffs, int rid, string field, string? qb, string? sql)
    {
        // Treat null and empty as equivalent: Quickbase returns "" for an unset text field
        // while SQL stores NULL, and that difference isn't meaningful.
        if (string.IsNullOrWhiteSpace(qb) && string.IsNullOrWhiteSpace(sql)) return;
        if (string.Equals(qb?.Trim(), sql?.Trim(), StringComparison.Ordinal)) return;
        diffs.Add(new Difference(rid, field, qb, sql));
    }

    private async Task<List<QbRec>> FetchAllAsync(CancellationToken ct)
    {
        if (!_qb.IsConfigured || string.IsNullOrWhiteSpace(_env.TableReviews))
            throw new InvalidOperationException("Quickbase is not configured (QUICKBASE_REALM / QUICKBASE_TOKEN / QB_TABLE_REVIEWS).");

        var fields = new HashSet<int>
        {
            _env.F_REVIEW_RID, _env.F_REVIEW_NAME, _env.F_REVIEW_COMPANY, _env.F_REVIEW_EMAIL,
            _env.F_REVIEW_LOCATION, _env.F_REVIEW_PRODUCT, _env.F_REVIEW_RATING,
            _env.F_REVIEW_COMMENT, _env.F_REVIEW_STATUS,
        };
        if (_env.F_REVIEW_CREATED.HasValue) fields.Add(_env.F_REVIEW_CREATED.Value);
        if (_env.F_REVIEW_MODIFIED.HasValue) fields.Add(_env.F_REVIEW_MODIFIED.Value);

        // No status filter: moderation needs pending rows too, unlike the public read path.
        var sortField = _env.F_REVIEW_CREATED ?? _env.F_REVIEW_RID;
        var res = await _qb.QueryAsync(_env.TableReviews, fields, "", sortField, "DESC", ct);
        return res.data ?? new List<QbRec>();
    }

    private string? Get(QbRec row, int? fid) =>
        fid.HasValue && fid.Value > 0 ? row.Get(fid.Value) : null;

    private static string? Trim(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        return v.Length <= max ? v : v[..max];
    }

    private static int? ParseInt(string? value) =>
        int.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var i) ? i : null;

    private static double ParseDouble(string? value) =>
        double.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0;

    private static DateTimeOffset? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (long.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var epoch) && epoch > 100000000000)
        {
            try { return DateTimeOffset.FromUnixTimeMilliseconds(epoch); } catch { }
        }
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto)
            ? dto : null;
    }
}
