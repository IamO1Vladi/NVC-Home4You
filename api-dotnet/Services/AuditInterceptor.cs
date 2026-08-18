using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Writes the audit log, by watching what EF is about to save.
///
/// WHY AN INTERCEPTOR AND NOT A HELPER EACH SERVICE CALLS. A helper is something the next
/// feature forgets, and the failure is invisible: nothing breaks, no test goes red, and you
/// find the gap on the day somebody asks who changed a deposit. Everything that reaches
/// SaveChanges passes through here — including code written long after this comment, by
/// someone who never read it. That property is the only thing that makes an audit log worth
/// having.
///
/// TWO PHASES, for an unglamorous reason: a newly inserted row has no id until the INSERT
/// runs, so entries written before the save would file every creation under id 0. The diff
/// is therefore captured in SavingChanges — while the change tracker still knows what was
/// modified and what the previous values were, since afterwards everything reads as
/// Unchanged — and the rows are written in SavedChanges, once the ids exist.
///
/// THAT SECOND WRITE MAY FAIL WITHOUT TAKING THE REQUEST WITH IT, deliberately. The
/// alternative is an audit log that can refuse a customer's deposit, and a tool that stops
/// working to protect its own paperwork is a tool people learn to work around. A failure is
/// logged as an error, loudly, and it is the one case where the history has a hole. The
/// ordering guarantees the hole is always "a change happened that was not recorded" and
/// never "a change was recorded that did not happen" — a log that overstates is worse than
/// one that admits a gap.
/// </summary>
public sealed class AuditInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentActor _actor;
    private readonly ILogger<AuditInterceptor> _log;

    // Held between the two phases. Instance state is safe because this is registered scoped,
    // so there is one per DbContext — and a DbContext is not thread-safe regardless.
    private readonly List<PendingEntry> _pending = new();

    // Guards the recursion the second save would otherwise cause: writing AuditEntry rows is
    // itself a SaveChanges, which would come straight back through here.
    private bool _writing;

    public AuditInterceptor(ICurrentActor actor, ILogger<AuditInterceptor> log)
    {
        _actor = actor;
        _log = log;
    }

    private sealed record PendingEntry(EntityEntry Entry, AuditEntry Audit);

    private sealed record Change(string Field, string? From, string? To);

    // --- Phase one: read the change tracker while it still knows anything ----------------

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData, InterceptionResult<int> result)
    {
        Capture(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
    {
        Capture(eventData.Context);
        return base.SavingChangesAsync(eventData, result, ct);
    }

    private void Capture(DbContext? context)
    {
        _pending.Clear();
        if (_writing || context is null) return;

        var actor = _actor.Upn;
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in context.ChangeTracker.Entries())
        {
            var type = entry.Metadata.ClrType.Name;
            if (!AuditedEntities.IsAudited(type)) continue;

            var action = entry.State switch
            {
                EntityState.Added => AuditActions.Created,
                EntityState.Modified => AuditActions.Updated,
                EntityState.Deleted => AuditActions.Deleted,
                _ => null,
            };
            if (action is null) continue;

            var changes = action == AuditActions.Updated
                ? Modifications(entry, type)
                // A creation and a deletion both record the row's meaningful state: what
                // appeared, and what was lost.
                : Snapshot(entry, type, deleting: action == AuditActions.Deleted);

            // A save that touched a row without changing a value. EF reports these routinely
            // — re-attaching an entity, assigning a property the value it already had.
            // Recording them would fill the log with entries saying nothing happened.
            if (action == AuditActions.Updated && changes.Count == 0) continue;

            _pending.Add(new PendingEntry(entry, new AuditEntry
            {
                OccurredAt = now,
                ActorUpn = actor,
                EntityType = type,
                Action = action,
                Summary = Summarise(entry),
                // Updates and deletes know their id already; creations are filled in below.
                EntityId = KeyOf(entry) ?? "",
                ChangesJson = JsonSerializer.Serialize(changes),
            }));
        }
    }

    // --- Phase two: the ids exist now, so write -----------------------------------------

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        Flush(eventData.Context, async: false).GetAwaiter().GetResult();
        return base.SavedChanges(eventData, result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken ct = default)
    {
        await Flush(eventData.Context, async: true, ct);
        return await base.SavedChangesAsync(eventData, result, ct);
    }

    private async Task Flush(DbContext? context, bool async, CancellationToken ct = default)
    {
        if (_writing || context is null || _pending.Count == 0) return;

        var rows = new List<AuditEntry>(_pending.Count);
        foreach (var pending in _pending)
        {
            if (string.IsNullOrEmpty(pending.Audit.EntityId))
                pending.Audit.EntityId = KeyOf(pending.Entry) ?? "";
            rows.Add(pending.Audit);
        }
        _pending.Clear();

        _writing = true;
        try
        {
            context.Set<AuditEntry>().AddRange(rows);
            if (async) await context.SaveChangesAsync(ct);
            else context.SaveChanges();
        }
        catch (Exception ex)
        {
            // See the class comment: the business write already succeeded and must stand.
            // This line is the only trace that the history has a gap here.
            _log.LogError(ex,
                "AUDIT GAP: {Count} change(s) were saved but could not be recorded. Entities: {Entities}",
                rows.Count,
                string.Join(", ", rows.Select(r => r.EntityType + "#" + r.EntityId + " " + r.Action)));

            // Detached so a later save in the same request does not retry and fail again.
            foreach (var row in rows)
            {
                try { context.Entry(row).State = EntityState.Detached; }
                catch { /* already gone; nothing to do */ }
            }
        }
        finally
        {
            _writing = false;
        }
    }

    // --- Reading one entity -------------------------------------------------------------

    private static List<Change> Modifications(EntityEntry entry, string type)
    {
        var changes = new List<Change>();

        foreach (var prop in entry.Properties)
        {
            if (prop.Metadata.IsPrimaryKey()) continue;
            if (!prop.IsModified) continue;

            var before = prop.OriginalValue;
            var after = prop.CurrentValue;
            // EF flags a property modified whenever it was assigned, even to the same value.
            if (Equals(before, after)) continue;

            var name = prop.Metadata.Name;

            if (AuditRedaction.IsSensitive(type, name))
            {
                var (from, to) = AuditRedaction.Describe(before, after);
                changes.Add(new Change(name, from, to));
                continue;
            }

            changes.Add(new Change(
                name,
                AuditRedaction.Format(type, name, before),
                AuditRedaction.Format(type, name, after)));
        }

        return changes;
    }

    /// <summary>
    /// The row's meaningful state, for a creation (what appeared) or a deletion (what is
    /// gone). Empty and default values are skipped: twenty "null" lines would bury the two
    /// that matter, and on a delete they would be a misleading tombstone.
    /// </summary>
    private static List<Change> Snapshot(EntityEntry entry, string type, bool deleting)
    {
        var changes = new List<Change>();

        foreach (var prop in entry.Properties)
        {
            if (prop.Metadata.IsPrimaryKey()) continue;

            var value = deleting ? prop.OriginalValue : prop.CurrentValue;
            if (value is null) continue;
            if (value is string s && string.IsNullOrWhiteSpace(s)) continue;
            if (value is bool b && !b) continue;
            if (value is int i && i == 0) continue;

            var name = prop.Metadata.Name;

            if (AuditRedaction.IsSensitive(type, name))
            {
                changes.Add(deleting
                    ? new Change(name, AuditRedaction.RedactedChanged, null)
                    : new Change(name, null, AuditRedaction.RedactedSet));
                continue;
            }

            var formatted = AuditRedaction.Format(type, name, value);
            changes.Add(deleting ? new Change(name, formatted, null) : new Change(name, null, formatted));
        }

        return changes;
    }

    /// <summary>The primary key as a string, joined for the composite case.</summary>
    private static string? KeyOf(EntityEntry entry)
    {
        var key = entry.Metadata.FindPrimaryKey();
        if (key is null) return null;

        var parts = key.Properties
            .Select(p => entry.Property(p.Name).CurrentValue?.ToString() ?? "")
            .Where(v => v.Length > 0)
            .ToList();

        if (parts.Count == 0) return null;

        var joined = string.Join("|", parts);
        // "0" is what an identity column reads as before EF has filled it in. Treated as
        // "no id yet", so phase two knows to look again.
        return joined == "0" ? null : joined;
    }

    /// <summary>
    /// How a person recognises this row later. Tries the columns that tend to hold a label,
    /// in the order somebody would look for one.
    ///
    /// Never a redacted column. A summary is rendered in a list, so putting an identifier
    /// here would leak it into exactly the view redaction exists to keep it out of.
    /// </summary>
    private static string? Summarise(EntityEntry entry)
    {
        var type = entry.Metadata.ClrType.Name;
        var candidates = new[] { "Name", "Title", "Reference", "Label", "FileName", "CustomModel" };

        foreach (var candidate in candidates)
        {
            var prop = entry.Properties.FirstOrDefault(p => p.Metadata.Name == candidate);
            if (prop is null) continue;
            if (AuditRedaction.IsSensitive(type, candidate)) continue;

            var value = (entry.State == EntityState.Deleted ? prop.OriginalValue : prop.CurrentValue) as string;
            if (!string.IsNullOrWhiteSpace(value))
                return value.Length <= 300 ? value : value[..300];
        }

        return null;
    }
}
