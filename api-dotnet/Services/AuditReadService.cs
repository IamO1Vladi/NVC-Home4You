using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>One field that changed, as the panel renders it.</summary>
public sealed record AuditChangeDto(string Field, string? From, string? To);

/// <summary>
/// One entry. Changes arrive parsed, so the browser is not handed a JSON string inside a
/// JSON document and asked to parse it again — a shape that invites someone to render it
/// raw the first time it is unexpected.
/// </summary>
public sealed record AuditEntryDto(
    int Id,
    string OccurredAt,
    string? ActorUpn,
    string EntityType,
    string EntityId,
    string Action,
    string? Summary,
    List<AuditChangeDto> Changes);

public sealed record AuditPageDto(List<AuditEntryDto> Entries, int Total, bool HasMore);

/// <summary>
/// Reading the audit log. READ ONLY, and that is the design rather than an omission — there
/// is deliberately no method here that updates or deletes an entry, so the application has
/// no code path that can rewrite its own history.
/// </summary>
public sealed class AuditReadService
{
    private readonly AppDbContext _db;

    public AuditReadService(AppDbContext db) => _db = db;

    /// <summary>
    /// Capped hard. The panel pages; nothing should be able to ask for the whole table and
    /// hold a year of history in memory to render thirty rows of it.
    /// </summary>
    public const int MaxPageSize = 100;

    /// <summary>
    /// Recent activity, newest first, optionally narrowed.
    ///
    /// Newest-first is the opposite of the leads board's quietest-first ordering, and for the
    /// opposite reason: a board exists to surface what has been neglected, a log exists to
    /// answer "what just happened".
    /// </summary>
    public async Task<AuditPageDto> ListAsync(
        string? entityType, string? actor, string? action,
        DateTimeOffset? since, DateTimeOffset? until,
        int skip, int take, CancellationToken ct)
    {
        var query = _db.AuditEntries.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(a => a.EntityType == entityType);

        if (!string.IsNullOrWhiteSpace(actor))
        {
            // "system" is the UI's word for the null actor — the importers and the CLI. It
            // has to be expressible as a filter, or the one category of change nobody
            // performed is also the one nobody can look up.
            query = string.Equals(actor, "system", StringComparison.OrdinalIgnoreCase)
                ? query.Where(a => a.ActorUpn == null)
                : query.Where(a => a.ActorUpn == actor);
        }

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action == action);

        if (since is not null) query = query.Where(a => a.OccurredAt >= since);
        if (until is not null) query = query.Where(a => a.OccurredAt <= until);

        var total = await query.CountAsync(ct);

        var page = Math.Clamp(take, 1, MaxPageSize);
        var offset = Math.Max(0, skip);

        var rows = await query
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.Id)   // stable within a second, so paging cannot repeat a row
            .Skip(offset)
            .Take(page)
            .ToListAsync(ct);

        return new AuditPageDto(
            rows.Select(ToDto).ToList(),
            total,
            offset + rows.Count < total);
    }

    /// <summary>
    /// Everything that ever happened to one record, newest first.
    ///
    /// Not paged: a single row's history is bounded by how often people edit it, and the
    /// question being asked here — "what happened to this customer?" — is one whose answer
    /// should not arrive in instalments.
    /// </summary>
    public async Task<List<AuditEntryDto>> ForRecordAsync(
        string entityType, string entityId, CancellationToken ct)
    {
        var rows = await _db.AuditEntries.AsNoTracking()
            .Where(a => a.EntityType == entityType && a.EntityId == entityId)
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.Id)
            .Take(MaxPageSize * 5)
            .ToListAsync(ct);

        return rows.Select(ToDto).ToList();
    }

    /// <summary>
    /// The distinct actors and entity types present, for the filter dropdowns.
    ///
    /// Read from the log itself rather than from the allow-list, because the useful list is
    /// "who has actually changed something", which includes people who have since left and
    /// excludes people who have never touched a record.
    /// </summary>
    public async Task<object> FiltersAsync(CancellationToken ct)
    {
        var actors = await _db.AuditEntries.AsNoTracking()
            .Where(a => a.ActorUpn != null)
            .Select(a => a.ActorUpn!)
            .Distinct()
            .OrderBy(a => a)
            .ToListAsync(ct);

        var types = await _db.AuditEntries.AsNoTracking()
            .Select(a => a.EntityType)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync(ct);

        var hasSystem = await _db.AuditEntries.AsNoTracking().AnyAsync(a => a.ActorUpn == null, ct);

        return new
        {
            actors,
            entityTypes = types,
            hasSystem,
            actions = AuditActions.All,
        };
    }

    private static AuditEntryDto ToDto(AuditEntry entry) => new(
        entry.Id,
        entry.OccurredAt.UtcDateTime.ToString("O", CultureInfo.InvariantCulture),
        entry.ActorUpn,
        entry.EntityType,
        entry.EntityId,
        entry.Action,
        entry.Summary,
        ParseChanges(entry.ChangesJson));

    /// <summary>
    /// Tolerates a malformed value rather than throwing.
    ///
    /// An entry whose JSON cannot be read is still evidence that something happened, and
    /// letting one bad row take down the whole history view would turn a cosmetic problem
    /// into the log being unavailable exactly when it is being consulted.
    /// </summary>
    private static List<AuditChangeDto> ParseChanges(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<AuditChangeDto>();

        try
        {
            return JsonSerializer.Deserialize<List<AuditChangeDto>>(json) ?? new List<AuditChangeDto>();
        }
        catch (JsonException)
        {
            return new List<AuditChangeDto>();
        }
    }
}
