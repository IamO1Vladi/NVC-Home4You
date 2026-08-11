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

// Copies the Quickbase lead tables (offers and questions) into SQL.
//
//   dotnet run -- import-leads [--dry-run]
//   dotnet run -- compare-leads
//
// Idempotent: rows are matched on QuickbaseRecordId, so re-running updates in place
// rather than duplicating. Quickbase stays the source of truth until cutover.
//
// Unlike the reviews import this carries the two sales checkboxes across, because they
// are the workflow rather than decoration — importing the intake fields alone would take
// away the tool sales uses and hand back a list. Their field ids differ per table
// (offers 13/14, questions 9/10), which is why they come from EnvConfig rather than
// being written twice.
public class LeadImportService
{
    private readonly QuickbaseApi _qb;
    private readonly EnvConfig _env;
    private readonly AppDbContext _db;

    public LeadImportService(QuickbaseApi qb, EnvConfig env, AppDbContext db)
    {
        _qb = qb;
        _env = env;
        _db = db;
    }

    public record ImportResult(int Fetched, int Inserted, int Updated, int Skipped);

    public async Task<ImportResult> ImportOffersAsync(bool dryRun, CancellationToken ct)
    {
        var rows = await FetchAllAsync(
            _env.TableOffer,
            new[]
            {
                _env.F_LEAD_RID, _env.F_OFFER_NAME, _env.F_OFFER_EMAIL, _env.F_OFFER_PHONE,
                _env.F_OFFER_MESSAGE, _env.F_OFFER_MODEL_ID, _env.F_OFFER_REACHED_OUT,
                _env.F_OFFER_LEAD_CREATED, _env.F_LEAD_CREATED_ON, _env.F_LEAD_MODIFIED_ON,
            },
            ct);

        int inserted = 0, updated = 0, skipped = 0;
        var existing = await _db.Offers
            .Where(o => o.QuickbaseRecordId != null)
            .ToDictionaryAsync(o => o.QuickbaseRecordId!.Value, ct);

        foreach (var row in rows)
        {
            var rid = ParseInt(Get(row, _env.F_LEAD_RID));
            if (rid is null) { skipped++; continue; }

            if (!existing.TryGetValue(rid.Value, out var entity))
            {
                entity = new Offer { QuickbaseRecordId = rid.Value };
                if (!dryRun) _db.Offers.Add(entity);
                inserted++;
            }
            else
            {
                updated++;
            }

            entity.Name = Trim(Get(row, _env.F_OFFER_NAME), 200) ?? "";
            entity.Email = Trim(Get(row, _env.F_OFFER_EMAIL), 320);
            entity.Phone = Trim(Get(row, _env.F_OFFER_PHONE), 64);
            entity.Message = Trim(Get(row, _env.F_OFFER_MESSAGE), 4000);
            entity.ModelId = Trim(Get(row, _env.F_OFFER_MODEL_ID), 100);
            entity.ReachedOut = ParseBool(Get(row, _env.F_OFFER_REACHED_OUT));
            entity.LeadCreated = ParseBool(Get(row, _env.F_OFFER_LEAD_CREATED));
            entity.CreatedAt = ParseDate(Get(row, _env.F_LEAD_CREATED_ON)) ?? entity.CreatedAt;
            entity.UpdatedAt = ParseDate(Get(row, _env.F_LEAD_MODIFIED_ON));
        }

        if (!dryRun) await _db.SaveChangesAsync(ct);
        return new ImportResult(rows.Count, inserted, updated, skipped);
    }

    public async Task<ImportResult> ImportQuestionsAsync(bool dryRun, CancellationToken ct)
    {
        var rows = await FetchAllAsync(
            _env.TableQuestion,
            new[]
            {
                _env.F_LEAD_RID, _env.F_Q_NAME, _env.F_Q_EMAIL, _env.F_Q_MESSAGE,
                _env.F_Q_REACHED_OUT, _env.F_Q_LEAD_CREATED,
                _env.F_LEAD_CREATED_ON, _env.F_LEAD_MODIFIED_ON,
            },
            ct);

        int inserted = 0, updated = 0, skipped = 0;
        var existing = await _db.Questions
            .Where(q => q.QuickbaseRecordId != null)
            .ToDictionaryAsync(q => q.QuickbaseRecordId!.Value, ct);

        foreach (var row in rows)
        {
            var rid = ParseInt(Get(row, _env.F_LEAD_RID));
            if (rid is null) { skipped++; continue; }

            if (!existing.TryGetValue(rid.Value, out var entity))
            {
                entity = new Question { QuickbaseRecordId = rid.Value };
                if (!dryRun) _db.Questions.Add(entity);
                inserted++;
            }
            else
            {
                updated++;
            }

            entity.Name = Trim(Get(row, _env.F_Q_NAME), 200) ?? "";
            entity.Email = Trim(Get(row, _env.F_Q_EMAIL), 320);
            entity.Message = Trim(Get(row, _env.F_Q_MESSAGE), 4000);
            entity.ReachedOut = ParseBool(Get(row, _env.F_Q_REACHED_OUT));
            entity.LeadCreated = ParseBool(Get(row, _env.F_Q_LEAD_CREATED));
            entity.CreatedAt = ParseDate(Get(row, _env.F_LEAD_CREATED_ON)) ?? entity.CreatedAt;
            entity.UpdatedAt = ParseDate(Get(row, _env.F_LEAD_MODIFIED_ON));
        }

        if (!dryRun) await _db.SaveChangesAsync(ct);
        return new ImportResult(rows.Count, inserted, updated, skipped);
    }

    public record Difference(string Table, int QuickbaseRecordId, string Field, string? Quickbase, string? Sql);

    // Read-only shadow comparison, the acceptance gate before DATA_SOURCE_LEADS is
    // flipped. Compares the workflow checkboxes too: if sales ticks "reached out to?" in
    // Quickbase and SQL does not learn about it, the cutover silently resets the queue.
    public async Task<(int Compared, List<Difference> Differences)> CompareAsync(CancellationToken ct)
    {
        var diffs = new List<Difference>();
        var compared = 0;

        var offerRows = await FetchAllAsync(
            _env.TableOffer,
            new[]
            {
                _env.F_LEAD_RID, _env.F_OFFER_NAME, _env.F_OFFER_EMAIL, _env.F_OFFER_PHONE,
                _env.F_OFFER_MESSAGE, _env.F_OFFER_REACHED_OUT, _env.F_OFFER_LEAD_CREATED,
            },
            ct);
        var offers = await _db.Offers.Where(o => o.QuickbaseRecordId != null)
            .ToDictionaryAsync(o => o.QuickbaseRecordId!.Value, ct);

        foreach (var row in offerRows)
        {
            var rid = ParseInt(Get(row, _env.F_LEAD_RID));
            if (rid is null) continue;
            if (!offers.TryGetValue(rid.Value, out var e))
            {
                diffs.Add(new Difference("offers", rid.Value, "(row)", "present", "MISSING"));
                continue;
            }

            compared++;
            Compare(diffs, "offers", rid.Value, "Name", Trim(Get(row, _env.F_OFFER_NAME), 200) ?? "", e.Name);
            Compare(diffs, "offers", rid.Value, "Email", Trim(Get(row, _env.F_OFFER_EMAIL), 320), e.Email);
            Compare(diffs, "offers", rid.Value, "Phone", Trim(Get(row, _env.F_OFFER_PHONE), 64), e.Phone);
            Compare(diffs, "offers", rid.Value, "Message", Trim(Get(row, _env.F_OFFER_MESSAGE), 4000), e.Message);
            CompareBool(diffs, "offers", rid.Value, "ReachedOut", Get(row, _env.F_OFFER_REACHED_OUT), e.ReachedOut);
            CompareBool(diffs, "offers", rid.Value, "LeadCreated", Get(row, _env.F_OFFER_LEAD_CREATED), e.LeadCreated);
        }

        var questionRows = await FetchAllAsync(
            _env.TableQuestion,
            new[]
            {
                _env.F_LEAD_RID, _env.F_Q_NAME, _env.F_Q_EMAIL, _env.F_Q_MESSAGE,
                _env.F_Q_REACHED_OUT, _env.F_Q_LEAD_CREATED,
            },
            ct);
        var questions = await _db.Questions.Where(q => q.QuickbaseRecordId != null)
            .ToDictionaryAsync(q => q.QuickbaseRecordId!.Value, ct);

        foreach (var row in questionRows)
        {
            var rid = ParseInt(Get(row, _env.F_LEAD_RID));
            if (rid is null) continue;
            if (!questions.TryGetValue(rid.Value, out var e))
            {
                diffs.Add(new Difference("questions", rid.Value, "(row)", "present", "MISSING"));
                continue;
            }

            compared++;
            Compare(diffs, "questions", rid.Value, "Name", Trim(Get(row, _env.F_Q_NAME), 200) ?? "", e.Name);
            Compare(diffs, "questions", rid.Value, "Email", Trim(Get(row, _env.F_Q_EMAIL), 320), e.Email);
            Compare(diffs, "questions", rid.Value, "Message", Trim(Get(row, _env.F_Q_MESSAGE), 4000), e.Message);
            CompareBool(diffs, "questions", rid.Value, "ReachedOut", Get(row, _env.F_Q_REACHED_OUT), e.ReachedOut);
            CompareBool(diffs, "questions", rid.Value, "LeadCreated", Get(row, _env.F_Q_LEAD_CREATED), e.LeadCreated);
        }

        return (compared, diffs);
    }

    private static void Compare(List<Difference> diffs, string table, int rid, string field, string? qb, string? sql)
    {
        // Quickbase returns "" for an unset text field while SQL stores NULL; that is not
        // a meaningful difference and would otherwise drown the real ones.
        if (string.IsNullOrWhiteSpace(qb) && string.IsNullOrWhiteSpace(sql)) return;
        if (string.Equals(qb?.Trim(), sql?.Trim(), StringComparison.Ordinal)) return;
        diffs.Add(new Difference(table, rid, field, qb, sql));
    }

    private static void CompareBool(List<Difference> diffs, string table, int rid, string field, string? qb, bool sql)
    {
        var qbValue = ParseBool(qb);
        if (qbValue == sql) return;
        diffs.Add(new Difference(table, rid, field, qbValue.ToString(), sql.ToString()));
    }

    // Pages until Quickbase stops returning rows: the default query caps at 500, and a
    // lead table only grows.
    private async Task<List<QbRec>> FetchAllAsync(string tableId, IEnumerable<int> fields, CancellationToken ct)
    {
        if (!_qb.IsConfigured)
            throw new InvalidOperationException("Quickbase is not configured (QUICKBASE_REALM / QUICKBASE_TOKEN).");
        if (string.IsNullOrWhiteSpace(tableId))
            throw new InvalidOperationException("Quickbase lead table id is missing (QB_TABLE_OFFER / QB_TABLE_QUESTION).");

        const int PageSize = 500;
        var all = new List<QbRec>();
        var select = fields.Where(f => f > 0).Distinct().ToArray();

        for (var skip = 0; ; skip += PageSize)
        {
            var page = await _qb.QueryPageAsync(tableId, select, "", _env.F_LEAD_RID, "ASC", skip, PageSize, ct);
            var rows = page.data ?? new List<QbRec>();
            all.AddRange(rows);
            if (rows.Count < PageSize) break;
        }

        return all;
    }

    private string? Get(QbRec row, int fid) => fid > 0 ? row.Get(fid) : null;

    private static string? Trim(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        return v.Length <= max ? v : v[..max];
    }

    private static int? ParseInt(string? value) =>
        int.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var i) ? i : null;

    // Quickbase checkboxes come back as JSON true/false, which QbValue renders as the
    // strings "true"/"false"; an unticked box can also arrive as empty or "0".
    private static bool ParseBool(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var v = value.Trim();
        return v.Equals("true", StringComparison.OrdinalIgnoreCase) || v == "1";
    }

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
