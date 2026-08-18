using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Emails the old part of the audit log as a CSV, and only then deletes it.
///
/// Retention decided by the owner 2026-08-18: entries older than six months are sent to them
/// as a file and removed from the table.
///
/// THIS IS THE ONLY CODE IN THE APPLICATION THAT DELETES AUDIT ENTRIES, and everything about
/// it is arranged around one rule: NOTHING IS DELETED THAT WAS NOT PROVABLY SENT FIRST.
///
///   1. The rows are read and rendered to CSV.
///   2. The mail is sent. If the send returns false — not configured, Graph refused, the
///      network blinked — the method stops. Nothing is deleted, and the next run tries the
///      same rows again.
///   3. Only the EXACT ids that went into the file are deleted. Not "everything older than
///      the cutoff" re-evaluated afterwards, which is a different set the moment anything
///      else is happening.
///
/// It is also OFF until switched on (AUDIT_ARCHIVE_ENABLED), so deploying this cannot start
/// deleting history on its own — a scheduled job that destroys evidence the day it ships is
/// exactly the failure worth engineering out.
/// </summary>
public sealed class AuditArchiveService
{
    private readonly AppDbContext _db;
    private readonly EmailService _email;
    private readonly EnvConfig _env;
    private readonly ILogger<AuditArchiveService> _log;

    public AuditArchiveService(
        AppDbContext db, EmailService email, EnvConfig env, ILogger<AuditArchiveService> log)
    {
        _db = db;
        _email = email;
        _env = env;
        _log = log;
    }

    public enum ArchiveOutcome
    {
        /// <summary>Sent and pruned.</summary>
        Archived,
        /// <summary>Nothing was old enough. Not a failure.</summary>
        NothingToArchive,
        /// <summary>Switched off. Nothing was read, sent or deleted.</summary>
        Disabled,
        /// <summary>No recipient configured — so nowhere to send the only copy.</summary>
        NoRecipients,
        /// <summary>The send failed. NOTHING WAS DELETED.</summary>
        SendFailed,
    }

    public sealed record ArchiveResult(
        ArchiveOutcome Outcome, int Count, string? FileName, IReadOnlyCollection<string> Recipients, string? Error)
    {
        public bool Ok => Outcome is ArchiveOutcome.Archived or ArchiveOutcome.NothingToArchive;
    }

    /// <summary>
    /// Runs one archive pass for everything older than the retention window.
    ///
    /// <paramref name="force"/> ignores the enabled flag, for the CLI command — someone
    /// typing the command has decided, and a flag that also blocks the manual path would
    /// just mean editing config to run a one-off.
    /// </summary>
    public async Task<ArchiveResult> RunAsync(bool force = false, CancellationToken ct = default)
    {
        if (!force && !_env.AuditArchiveEnabled)
            return new ArchiveResult(ArchiveOutcome.Disabled, 0, null, Array.Empty<string>(), null);

        var recipients = EmailService.ParseRecipients(_env.AuditArchiveTo);
        if (recipients.Count == 0)
        {
            // Refused rather than defaulted. The mail is about to become the only copy of
            // this history, and guessing where it goes is not a guess worth making.
            const string error = "AUDIT_ARCHIVE_TO is not set, so there is nowhere to send the archive.";
            _log.LogWarning("Audit archive skipped: {Error}", error);
            return new ArchiveResult(ArchiveOutcome.NoRecipients, 0, null, Array.Empty<string>(), error);
        }

        var cutoff = DateTimeOffset.UtcNow.AddMonths(-_env.AuditRetentionMonths);

        // Read the WHOLE set once, ids included. Everything downstream works from this list
        // rather than re-querying, so the rows that are deleted are exactly the rows in the
        // file — see the class comment.
        var rows = await _db.AuditEntries
            .AsNoTracking()
            .Where(a => a.OccurredAt < cutoff)
            .OrderBy(a => a.OccurredAt)
            .ThenBy(a => a.Id)
            .ToListAsync(ct);

        if (rows.Count == 0)
            return new ArchiveResult(ArchiveOutcome.NothingToArchive, 0, null, recipients, null);

        var fileName = $"audit-log-{rows[0].OccurredAt.UtcDateTime:yyyy-MM-dd}-to-{rows[^1].OccurredAt.UtcDateTime:yyyy-MM-dd}.csv";
        var csv = ToCsv(rows);

        var sent = await _email.TrySendInternalReportWithAttachmentAsync(
            recipients,
            $"NVC Home4You — audit log archive, {rows.Count} entries to {cutoff.UtcDateTime:yyyy-MM-dd}",
            BuildBody(rows, cutoff, fileName),
            fileName,
            "text/csv",
            csv,
            ct);

        if (!sent)
        {
            // The whole point of the ordering. The next run will pick up the same rows.
            const string error = "The archive email was not sent, so nothing was deleted.";
            _log.LogError(
                "Audit archive FAILED to send {Count} entries to {Recipients}. Nothing was deleted; " +
                "the next run will retry the same rows.",
                rows.Count, string.Join(", ", recipients));
            return new ArchiveResult(ArchiveOutcome.SendFailed, rows.Count, fileName, recipients, error);
        }

        // Deleted by id, and only these ids.
        var ids = rows.Select(r => r.Id).ToList();
        var doomed = await _db.AuditEntries.Where(a => ids.Contains(a.Id)).ToListAsync(ct);
        _db.AuditEntries.RemoveRange(doomed);
        await _db.SaveChangesAsync(ct);

        _log.LogInformation(
            "Audit archive: {Count} entries older than {Cutoff:yyyy-MM-dd} were emailed to {Recipients} as {FileName} and removed.",
            doomed.Count, cutoff.UtcDateTime, string.Join(", ", recipients), fileName);

        return new ArchiveResult(ArchiveOutcome.Archived, doomed.Count, fileName, recipients, null);
    }

    /// <summary>
    /// The archive itself. CSV because it has to be readable in ten years by whoever opens
    /// it — a spreadsheet, a text editor, anything — which is not true of a database dump
    /// and barely true of JSON.
    /// </summary>
    public static byte[] ToCsv(IReadOnlyCollection<AuditEntry> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("OccurredAtUtc,Actor,EntityType,EntityId,Action,Summary,Changes");

        foreach (var row in rows)
        {
            sb.Append(Csv(row.OccurredAt.UtcDateTime.ToString("O", CultureInfo.InvariantCulture))).Append(',');
            // The same word the panel shows, so the file and the screen agree about who
            // "nobody" was.
            sb.Append(Csv(row.ActorUpn ?? "system")).Append(',');
            sb.Append(Csv(row.EntityType)).Append(',');
            sb.Append(Csv(row.EntityId)).Append(',');
            sb.Append(Csv(row.Action)).Append(',');
            sb.Append(Csv(row.Summary ?? "")).Append(',');
            sb.Append(Csv(row.ChangesJson));
            sb.Append("\r\n");
        }

        // BOM on purpose: without it Excel reads the file as the local codepage and every
        // Cyrillic name in it turns to mojibake, which for an archive nobody re-generates
        // is permanent.
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
    }

    private static string Csv(string value)
    {
        // Quoted always. A summary can contain a comma, a newline or a quote, and a field
        // that breaks the column alignment corrupts every row after it.
        var escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }

    private static string BuildBody(IReadOnlyCollection<AuditEntry> rows, DateTimeOffset cutoff, string fileName)
    {
        var oldest = rows.Min(r => r.OccurredAt).UtcDateTime;
        var newest = rows.Max(r => r.OccurredAt).UtcDateTime;

        return $"""
            <p>Attached is the archived audit log for NVC Home4You.</p>
            <ul>
              <li><strong>{rows.Count}</strong> entries</li>
              <li>{oldest:yyyy-MM-dd} to {newest:yyyy-MM-dd}</li>
              <li>Everything older than {cutoff.UtcDateTime:yyyy-MM-dd} ({rows.Count} rows)</li>
              <li>File: {System.Net.WebUtility.HtmlEncode(fileName)}</li>
            </ul>
            <p><strong>These entries have now been removed from the panel.</strong> This
            attachment is the only remaining copy — keep it somewhere it will survive.</p>
            <p style="color:#666;font-size:12px">Personal identifiers were never recorded in
            the audit log, so this file contains none.</p>
            """;
    }
}
