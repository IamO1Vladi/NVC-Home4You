using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Archiving the old part of the audit log: email it, then delete it.
//
// This is the only code in the application that deletes audit entries, which makes it the
// only code that can destroy evidence. Everything below exists to pin one rule — NOTHING IS
// DELETED THAT WAS NOT PROVABLY SENT FIRST — and the failure it guards against is the worst
// kind available here: silent, permanent, and discovered months later by someone who needed
// the record.
public class AuditArchiveTests
{
    /// <summary>
    /// Stands in for the mail transport. Records what it was handed, and can be told to
    /// fail — which is the case that matters most.
    /// </summary>
    private sealed class FakeEmail : EmailService
    {
        private readonly bool _succeed;

        public FakeEmail(bool succeed, EnvConfig env)
            : base(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance)
        {
            _succeed = succeed;
        }

        public int Sends { get; private set; }
        public byte[]? LastAttachment { get; private set; }
        public string? LastFileName { get; private set; }
        public IReadOnlyCollection<string>? LastRecipients { get; private set; }

        public override Task<bool> TrySendInternalReportWithAttachmentAsync(
            IReadOnlyCollection<string> toEmails, string subject, string html,
            string fileName, string contentType, byte[] content, CancellationToken ct = default)
        {
            Sends++;
            LastRecipients = toEmails;
            LastFileName = fileName;
            LastAttachment = content;
            return Task.FromResult(_succeed);
        }
    }

    private static EnvConfig Env(params (string Key, string Value)[] settings) =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(settings.ToDictionary(s => s.Key, s => (string?)s.Value))
            .Build());

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"auditarchive-{Guid.NewGuid()}")
            .Options);

    private static async Task Seed(AppDbContext db, int oldCount, int recentCount)
    {
        for (var i = 0; i < oldCount; i++)
            db.AuditEntries.Add(new AuditEntry
            {
                EntityType = nameof(Customer), EntityId = $"old-{i}", Action = AuditActions.Updated,
                ActorUpn = "maria@x.eu", Summary = $"old {i}", ChangesJson = "[]",
                OccurredAt = DateTimeOffset.UtcNow.AddMonths(-8).AddMinutes(i),
            });

        for (var i = 0; i < recentCount; i++)
            db.AuditEntries.Add(new AuditEntry
            {
                EntityType = nameof(Customer), EntityId = $"new-{i}", Action = AuditActions.Updated,
                ActorUpn = "maria@x.eu", Summary = $"recent {i}", ChangesJson = "[]",
                OccurredAt = DateTimeOffset.UtcNow.AddDays(-3).AddMinutes(i),
            });

        await db.SaveChangesAsync();
    }

    private static AuditArchiveService Service(AppDbContext db, EnvConfig env) =>
        new(db, new EmailService(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance),
            env, NullLogger<AuditArchiveService>.Instance);

    private static (AuditArchiveService Service, FakeEmail Email) WithMail(
        AppDbContext db, EnvConfig env, bool sendSucceeds)
    {
        var mail = new FakeEmail(sendSucceeds, env);
        return (new AuditArchiveService(db, mail, env, NullLogger<AuditArchiveService>.Instance), mail);
    }

    // --- The rule the whole class exists for ---------------------------------------------

    [Fact]
    public async Task A_failed_send_deletes_absolutely_nothing()
    {
        // THE test. Email is unconfigured here, so the send returns false — the same answer
        // a network failure or a refused Graph call gives. Every row must survive, so the
        // next run archives them instead of them being gone with no copy anywhere.
        using var db = NewDb();
        await Seed(db, oldCount: 5, recentCount: 2);

        var env = Env(("AUDIT_ARCHIVE_ENABLED", "true"), ("AUDIT_ARCHIVE_TO", "vvladimirov@nvc-home4you.eu"));
        var result = await Service(db, env).RunAsync(force: true, CancellationToken.None);

        Assert.Equal(AuditArchiveService.ArchiveOutcome.SendFailed, result.Outcome);
        Assert.False(result.Ok);
        // All seven, not just the recent two.
        Assert.Equal(7, await db.AuditEntries.CountAsync());
    }

    [Fact]
    public async Task With_no_recipient_it_refuses_rather_than_guessing()
    {
        // The mail is about to become the only copy of this history. Guessing where it goes
        // is not a guess worth making.
        using var db = NewDb();
        await Seed(db, oldCount: 3, recentCount: 0);

        var env = Env(("AUDIT_ARCHIVE_ENABLED", "true"), ("AUDIT_ARCHIVE_TO", "   "));
        var result = await Service(db, env).RunAsync(force: true, CancellationToken.None);

        Assert.Equal(AuditArchiveService.ArchiveOutcome.NoRecipients, result.Outcome);
        Assert.Equal(3, await db.AuditEntries.CountAsync());
    }

    [Fact]
    public async Task Switched_off_it_reads_nothing_and_deletes_nothing()
    {
        // Deploying the archive job must not start deleting history on its own.
        using var db = NewDb();
        await Seed(db, oldCount: 4, recentCount: 1);

        var env = Env(("AUDIT_ARCHIVE_TO", "vvladimirov@nvc-home4you.eu"));
        var result = await Service(db, env).RunAsync(force: false, CancellationToken.None);

        Assert.Equal(AuditArchiveService.ArchiveOutcome.Disabled, result.Outcome);
        Assert.Equal(5, await db.AuditEntries.CountAsync());
    }

    [Fact]
    public async Task Nothing_old_enough_is_a_success_not_a_failure()
    {
        using var db = NewDb();
        await Seed(db, oldCount: 0, recentCount: 4);

        var env = Env(("AUDIT_ARCHIVE_ENABLED", "true"), ("AUDIT_ARCHIVE_TO", "vvladimirov@nvc-home4you.eu"));
        var result = await Service(db, env).RunAsync(force: true, CancellationToken.None);

        Assert.Equal(AuditArchiveService.ArchiveOutcome.NothingToArchive, result.Outcome);
        Assert.True(result.Ok);
        Assert.Equal(4, await db.AuditEntries.CountAsync());
    }

    [Fact]
    public async Task A_transport_that_is_configured_but_fails_mid_send_still_deletes_nothing()
    {
        // Distinct from the unconfigured case above: here the mail system is present and
        // willing and the send itself fails — a refused Graph call, a dropped connection.
        // That is the likelier failure in production and it must behave identically.
        using var db = NewDb();
        await Seed(db, oldCount: 8, recentCount: 1);

        var env = Env(("AUDIT_ARCHIVE_ENABLED", "true"), ("AUDIT_ARCHIVE_TO", "vvladimirov@nvc-home4you.eu"));
        var (service, mail) = WithMail(db, env, sendSucceeds: false);

        var result = await service.RunAsync(force: true, CancellationToken.None);

        Assert.Equal(AuditArchiveService.ArchiveOutcome.SendFailed, result.Outcome);
        Assert.Equal(1, mail.Sends);            // it really did try
        Assert.Equal(9, await db.AuditEntries.CountAsync());   // and nothing went
    }

    [Fact]
    public async Task A_successful_send_deletes_exactly_the_rows_that_were_in_the_file()
    {
        // The other half of the rule. The old entries go, the recent ones stay, and the
        // count deleted is the count reported — a run that removed more than it sent would
        // be destroying history silently.
        using var db = NewDb();
        await Seed(db, oldCount: 6, recentCount: 3);

        var env = Env(("AUDIT_ARCHIVE_ENABLED", "true"), ("AUDIT_ARCHIVE_TO", "vvladimirov@nvc-home4you.eu"));
        var (service, mail) = WithMail(db, env, sendSucceeds: true);

        var result = await service.RunAsync(force: true, CancellationToken.None);

        Assert.Equal(AuditArchiveService.ArchiveOutcome.Archived, result.Outcome);
        Assert.Equal(6, result.Count);
        Assert.Equal(1, mail.Sends);

        var left = await db.AuditEntries.ToListAsync();
        Assert.Equal(3, left.Count);
        Assert.All(left, e => Assert.StartsWith("recent", e.Summary));
    }

    [Fact]
    public async Task Every_deleted_row_is_present_in_the_file_that_was_sent()
    {
        // The guarantee that makes deletion acceptable at all: after this run the attachment
        // is the ONLY copy, so anything deleted and missing from it is gone for good.
        using var db = NewDb();
        await Seed(db, oldCount: 12, recentCount: 2);

        var before = await db.AuditEntries
            .Where(a => a.Summary!.StartsWith("old"))
            .Select(a => a.Summary!)
            .ToListAsync();

        var env = Env(("AUDIT_ARCHIVE_ENABLED", "true"), ("AUDIT_ARCHIVE_TO", "vvladimirov@nvc-home4you.eu"));
        var (service, mail) = WithMail(db, env, sendSucceeds: true);
        await service.RunAsync(force: true, CancellationToken.None);

        var csv = Encoding.UTF8.GetString(mail.LastAttachment!);
        foreach (var summary in before) Assert.Contains(summary, csv);

        // ...and nothing that survived was in the file.
        Assert.DoesNotContain("recent 0", csv);
    }

    [Fact]
    public async Task The_file_is_sent_to_the_configured_address_and_named_for_its_window()
    {
        using var db = NewDb();
        await Seed(db, oldCount: 4, recentCount: 0);

        var env = Env(("AUDIT_ARCHIVE_ENABLED", "true"), ("AUDIT_ARCHIVE_TO", "vvladimirov@nvc-home4you.eu"));
        var (service, mail) = WithMail(db, env, sendSucceeds: true);
        var result = await service.RunAsync(force: true, CancellationToken.None);

        Assert.Equal(new[] { "vvladimirov@nvc-home4you.eu" }, mail.LastRecipients);
        Assert.EndsWith(".csv", mail.LastFileName);
        Assert.StartsWith("audit-log-", mail.LastFileName);
        Assert.Equal(mail.LastFileName, result.FileName);
    }

    [Fact]
    public async Task A_second_run_with_nothing_left_to_archive_sends_no_mail()
    {
        // Idempotent: the daily job must not mail an empty file every day forever.
        using var db = NewDb();
        await Seed(db, oldCount: 3, recentCount: 1);

        var env = Env(("AUDIT_ARCHIVE_ENABLED", "true"), ("AUDIT_ARCHIVE_TO", "vvladimirov@nvc-home4you.eu"));
        var (service, mail) = WithMail(db, env, sendSucceeds: true);

        await service.RunAsync(force: true, CancellationToken.None);
        var second = await service.RunAsync(force: true, CancellationToken.None);

        Assert.Equal(AuditArchiveService.ArchiveOutcome.NothingToArchive, second.Outcome);
        Assert.Equal(1, mail.Sends);
    }

    // --- The retention window ---------------------------------------------------------------

    [Fact]
    public void Retention_defaults_to_six_months_and_refuses_a_zero()
    {
        // A misconfigured "0" would archive and delete everything written today.
        Assert.Equal(6, Env().AuditRetentionMonths);
        Assert.Equal(6, Env(("AUDIT_RETENTION_MONTHS", "0")).AuditRetentionMonths);
        Assert.Equal(6, Env(("AUDIT_RETENTION_MONTHS", "-3")).AuditRetentionMonths);
        Assert.Equal(6, Env(("AUDIT_RETENTION_MONTHS", "nonsense")).AuditRetentionMonths);
        Assert.Equal(24, Env(("AUDIT_RETENTION_MONTHS", "24")).AuditRetentionMonths);
    }

    [Fact]
    public void Archiving_is_off_unless_explicitly_switched_on()
    {
        Assert.False(Env().AuditArchiveEnabled);
        Assert.False(Env(("AUDIT_ARCHIVE_ENABLED", "")).AuditArchiveEnabled);
        Assert.False(Env(("AUDIT_ARCHIVE_ENABLED", "yes")).AuditArchiveEnabled);
        Assert.True(Env(("AUDIT_ARCHIVE_ENABLED", "true")).AuditArchiveEnabled);
        Assert.True(Env(("AUDIT_ARCHIVE_ENABLED", "TRUE")).AuditArchiveEnabled);
    }

    [Fact]
    public void The_archive_defaults_to_the_owner_who_asked_for_it()
    {
        Assert.Equal("vvladimirov@nvc-home4you.eu", Env().AuditArchiveTo);
    }

    // --- The file itself ----------------------------------------------------------------------

    [Fact]
    public void The_csv_carries_a_bom_so_excel_does_not_mangle_cyrillic()
    {
        // Without it Excel reads the file as the local codepage and every Bulgarian name
        // becomes mojibake — permanent, for an archive nobody regenerates.
        var csv = AuditArchiveService.ToCsv(new[]
        {
            new AuditEntry
            {
                EntityType = nameof(Customer), EntityId = "1", Action = AuditActions.Updated,
                Summary = "Стройко ООД", ChangesJson = "[]", OccurredAt = DateTimeOffset.UtcNow,
            },
        });

        Assert.True(csv.Length > 3);
        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, csv.Take(3).ToArray());
        Assert.Contains("Стройко ООД", Encoding.UTF8.GetString(csv));
    }

    [Fact]
    public void A_summary_containing_a_comma_or_quote_cannot_break_the_columns()
    {
        // A field that breaks the column alignment corrupts every row after it, and this is
        // an archive — there is no re-export to fix it with.
        var csv = Encoding.UTF8.GetString(AuditArchiveService.ToCsv(new[]
        {
            new AuditEntry
            {
                EntityType = nameof(Customer), EntityId = "1", Action = AuditActions.Updated,
                Summary = "Smith, \"Bob\" & Co\nsecond line",
                ChangesJson = """[{"Field":"Name","From":"a,b","To":"c"}]""",
                OccurredAt = DateTimeOffset.UtcNow,
            },
        }));

        // Quotes doubled, the whole field wrapped — so the embedded comma and newline stay
        // inside one cell.
        Assert.Contains("\"Smith, \"\"Bob\"\" & Co\nsecond line\"", csv);
        Assert.StartsWith("﻿OccurredAtUtc,Actor,EntityType,EntityId,Action,Summary,Changes", csv);
    }

    [Fact]
    public void The_null_actor_is_written_as_system_so_the_file_and_the_screen_agree()
    {
        var csv = Encoding.UTF8.GetString(AuditArchiveService.ToCsv(new[]
        {
            new AuditEntry
            {
                EntityType = nameof(Factory), EntityId = "1", Action = AuditActions.Created,
                ActorUpn = null, ChangesJson = "[]", OccurredAt = DateTimeOffset.UtcNow,
            },
        }));

        Assert.Contains("\"system\"", csv);
    }

    [Fact]
    public void Every_archived_row_appears_in_the_file()
    {
        // The file is the only copy after a run. A row that is deleted but absent from the
        // CSV is history destroyed, which is the one outcome that cannot be undone.
        var rows = Enumerable.Range(0, 50).Select(i => new AuditEntry
        {
            EntityType = nameof(Customer), EntityId = i.ToString(), Action = AuditActions.Updated,
            Summary = $"row-{i}", ChangesJson = "[]", OccurredAt = DateTimeOffset.UtcNow.AddMinutes(-i),
        }).ToList();

        var csv = Encoding.UTF8.GetString(AuditArchiveService.ToCsv(rows));

        foreach (var row in rows) Assert.Contains($"row-{row.EntityId}", csv);
        // Header plus one line each, and a trailing newline.
        Assert.Equal(rows.Count + 2, csv.Split("\r\n").Length);
    }
}
