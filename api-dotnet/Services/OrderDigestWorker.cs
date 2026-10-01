using System;
using System.Globalization;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Sends the weekly order digest (#27) — Mondays at 08:00 Sofia, or at the first hourly
/// check after that if the app was asleep at eight. See OrderDigestSchedule.Due for why it
/// asks "has this week's gone?" rather than "is it eight?".
///
/// Registered with the SQL services (it reads the order board, which only exists when SQL is
/// configured), and checks its own switch from there, the shape of AuditArchiveWorker. OFF
/// unless ORDER_DIGEST_ENABLED=true: deploying the code must not start mailing people by
/// itself, and a developer's machine running the app for a prerender must never send the
/// office a Monday email from a laptop.
/// </summary>
public sealed class OrderDigestWorker : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly EnvConfig _env;
    private readonly OrderDigestMarker _marker;
    private readonly ILogger<OrderDigestWorker> _log;

    // Short, unlike the audit archive's ten minutes: this is not destructive, and the marker
    // already makes a send at most once a week. The delay only keeps it out of the way of a
    // deploy's own restart churn.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(2);

    // How often it looks at most. An hour is a fair price for "sent within the hour" after a
    // sleep, and it is one tiny file read, not a query — the database is only read when due.
    // An app that is awake does not wait out the hour across the slot: it sleeps exactly
    // until eight (see NextWake), so the usual Monday lands at 08:00, not at 08:47.
    private static readonly TimeSpan CheckEvery = TimeSpan.FromHours(1);

    public OrderDigestWorker(
        IServiceProvider services, EnvConfig env, OrderDigestMarker marker, ILogger<OrderDigestWorker> log)
    {
        _services = services;
        _env = env;
        _marker = marker;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_env.OrderDigestEnabled)
        {
            _log.LogInformation("The weekly order digest is off (ORDER_DIGEST_ENABLED unset).");
            return;
        }

        _log.LogInformation("The weekly order digest is ON: Mondays 08:00 Sofia, to {To}.", _env.OrderDigestTo);

        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            var due = OrderDigestSchedule.Due(DateTimeOffset.UtcNow, _marker.LastSentSlot);
            if (due is DateTimeOffset slot)
            {
                try
                {
                    using var scope = _services.CreateScope();
                    var digest = scope.ServiceProvider.GetRequiredService<OrderDigestService>();
                    var result = await digest.SendAsync(DateTimeOffset.UtcNow, stoppingToken);

                    // Recorded only when the week is DONE — sent, or nothing to send. A failed
                    // send stays owed and is tried again at the next check.
                    if (result.Done) _marker.Record(slot);
                    else
                        _log.LogWarning("Order digest for {Slot:u} not done ({Outcome}: {Error}); retrying in an hour.",
                            slot, result.Outcome, result.Error);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    // Swallowed so one bad Monday does not end the loop for the life of the
                    // process; the week stays owed and the next check tries again.
                    _log.LogError(ex, "Order digest for {Slot:u} failed; retrying in an hour.", slot);
                }
            }

            try { await Task.Delay(NextWake(DateTimeOffset.UtcNow), stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>
    /// How long to sleep: an hour, or less when the next Monday 08:00 comes sooner — plus a
    /// few seconds, so the wake lands just past the slot rather than a hair before it.
    /// </summary>
    public static TimeSpan NextWake(DateTimeOffset now)
    {
        var untilSlot = OrderDigestSchedule.NextSlot(now) - now + TimeSpan.FromSeconds(5);
        return untilSlot < CheckEvery ? untilSlot : CheckEvery;
    }
}

/// <summary>
/// The one fact the digest has to remember across restarts: which Monday it last covered.
///
/// A small file rather than a table, because it is one timestamp and a migration for it
/// would be a schema change to hold a sticky note. It lives under %HOME%, which App Service
/// keeps across restarts AND deploys (wwwroot is replaced on a deploy; %HOME%\data is not),
/// and which every instance of the app shares.
///
/// READ ON EVERY CHECK, not once per process: a second instance — a scale-out, or the old
/// and new workers overlapping in a restart — must see the week the first one sent, or each
/// would only ever know its own sends and both would mail every Monday. The in-memory value
/// is kept as a floor under the file, so a file that cannot be written costs at most one
/// repeat after the next restart — never an email every hour.
/// </summary>
public sealed class OrderDigestMarker
{
    private readonly string _path;
    private readonly ILogger<OrderDigestMarker> _log;
    private readonly object _gate = new();
    private DateTimeOffset? _lastSent;

    public OrderDigestMarker(ILogger<OrderDigestMarker> log) : this(DefaultPath(), log) { }

    public OrderDigestMarker(string path, ILogger<OrderDigestMarker> log)
    {
        _path = path;
        _log = log;
    }

    public string FilePath => _path;

    public DateTimeOffset? LastSentSlot
    {
        get
        {
            lock (_gate)
            {
                var onDisk = Read();
                if (onDisk is DateTimeOffset disk && (_lastSent is null || disk > _lastSent)) _lastSent = disk;
                return _lastSent;
            }
        }
    }

    public void Record(DateTimeOffset slot)
    {
        lock (_gate)
        {
            _lastSent = slot;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
                File.WriteAllText(_path, slot.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture));
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Could not record the order digest marker at {Path}. The next restart may send this week's digest again.", _path);
            }
        }
    }

    private DateTimeOffset? Read()
    {
        try
        {
            if (!File.Exists(_path)) return null;
            var text = File.ReadAllText(_path).Trim();
            return DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var at)
                ? at
                : null;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Could not read the order digest marker at {Path}; treating this week as owed.", _path);
            return null;
        }
    }

    // %HOME% is App Service's persistent root (D:\home on Windows, /home on Linux). A machine
    // without it — a developer's — falls back to the user's local app data, which is only
    // ever reached there when somebody has deliberately switched the digest on.
    private static string DefaultPath()
    {
        var home = Environment.GetEnvironmentVariable("HOME");
        var root = !string.IsNullOrWhiteSpace(home)
            ? Path.Combine(home, "data")
            : Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return Path.Combine(root, "nvc", "order-digest-last-slot.txt");
    }
}
