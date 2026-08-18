using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Runs the audit archive once a day.
///
/// Registered unconditionally and checks its own configuration, the same shape as
/// LeadMailPoller — so "is this switched on?" is answered in one place (EnvConfig) rather
/// than split between a registration and a runtime check.
///
/// A day is the right cadence for a six-month window: the job is idempotent, missing a run
/// costs nothing (tomorrow's picks up the same rows), and running it hourly would be twelve
/// pointless queries a day against a serverless database that bills for being awake.
///
/// The first pass is delayed rather than run at startup. App Service restarts on deploys, on
/// scaling, and on its own schedule; without the delay, an archive — a DESTRUCTIVE operation
/// — would fire on every one of those.
/// </summary>
public sealed class AuditArchiveWorker : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly EnvConfig _env;
    private readonly ILogger<AuditArchiveWorker> _log;

    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    public AuditArchiveWorker(IServiceProvider services, EnvConfig env, ILogger<AuditArchiveWorker> log)
    {
        _services = services;
        _env = env;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_env.AuditArchiveEnabled)
        {
            // Said once, at startup, so "why is nothing being archived?" is answerable from
            // the log rather than by reading this file.
            _log.LogInformation(
                "Audit archiving is off (AUDIT_ARCHIVE_ENABLED unset). The audit log will grow " +
                "indefinitely, which is a safe default — nothing is ever deleted.");
            return;
        }

        _log.LogInformation(
            "Audit archiving is ON: entries older than {Months} months will be emailed to {To} and then removed.",
            _env.AuditRetentionMonths, _env.AuditArchiveTo);

        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Its own scope: this is a background loop and the DbContext it uses must
                // not be shared with, or outlive, anything else.
                using var scope = _services.CreateScope();
                var archive = scope.ServiceProvider.GetRequiredService<AuditArchiveService>();
                await archive.RunAsync(force: false, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                // Swallowed so one bad night does not end the loop for the lifetime of the
                // process. Nothing was deleted — RunAsync only deletes after a confirmed
                // send — so the same rows are simply archived tomorrow.
                _log.LogError(ex, "Audit archive run failed. Nothing was deleted; it will retry.");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }
}
