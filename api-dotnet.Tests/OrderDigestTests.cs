using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
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

// The weekly order digest (#27, scheduled 2026-09-30).
//
// What fails quietly here, and so is pinned: the server's copy of the board's "stuck" rule
// drifting from the browser's (then the badge and the email disagree), a schedule that
// slides an hour at every daylight-saving change, a week that is skipped because the app
// was asleep at eight or sent twice because it restarted, and an email that carries money
// or markup it should not.
public class OrderDigestTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 5, 6, 30, 0, TimeSpan.Zero); // Mon 09:30 Sofia

    private static OrderRowDto Row(
        int id, string status, DateTimeOffset? lastTouched, string name = "Иван Петров",
        string? model = "Nova 60", int quantity = 1, string? expectedReady = null,
        decimal? deposit = null, decimal? finalPrice = null) => new(
            id, id, name, model, "prefab", "Bursa Prefab", quantity,
            deposit, null, finalPrice, null, false, "EUR", status,
            "2026-06-01", null, expectedReady, null, null, null, null, null,
            lastTouched?.ToString("o"), "tbonin@nvc-home4you.eu", lastTouched?.ToString("o"));

    // --- The stuck rule, and its twin in the browser ----------------------------------

    [Theory]
    [InlineData("fabricating", 15.0, 15)]   // past the threshold
    [InlineData("fabricating", 14.0, null)] // exactly on it is not past it
    [InlineData("fabricating", 14.9, null)] // whole days, floored — the board's daysSince
    [InlineData("ready", 80.0, 80)]         // the step the customer is least patient about
    [InlineData("placed", 100.0, null)]     // waiting on us, not on the world
    [InlineData("delivered", 100.0, null)]  // finished
    [InlineData("cancelled", 100.0, null)]
    public void An_order_is_stuck_only_where_silence_is_a_problem(string status, double daysAgo, int? expected)
    {
        Assert.Equal(expected, OrderStaleness.StalledFor(status, Now.AddDays(-daysAgo), Now));
    }

    [Fact]
    public void Nothing_on_file_is_never_called_stuck()
    {
        // No date to have been silent since — colouring a row against a moment nobody
        // observed is the invention the board refuses, and so does the email.
        Assert.Null(OrderStaleness.StalledFor(OrderStatuses.Travelling, null, Now));
    }

    [Fact]
    public void The_server_rule_is_the_boards_rule()
    {
        // The browser computes the badge, the server computes the email. Read the browser's
        // copy as text — what goes wrong is somebody changing one and not the other, and a
        // text check catches that exactly as well as running both would.
        var jsx = BoardSource();

        var days = Regex.Match(jsx, @"const STALE_AFTER_DAYS = (\d+)");
        Assert.True(days.Success, "STALE_AFTER_DAYS not found in AdminOrdersPage.jsx");
        Assert.Equal(OrderStaleness.StaleAfterDays, int.Parse(days.Groups[1].Value));

        var set = Regex.Match(jsx, @"const MOVING_STATUSES = new Set\(\[([^\]]*)\]\)");
        Assert.True(set.Success, "MOVING_STATUSES not found in AdminOrdersPage.jsx");
        var browser = Regex.Matches(set.Groups[1].Value, "'([^']+)'").Select(m => m.Groups[1].Value).OrderBy(s => s);
        Assert.Equal(OrderStaleness.MovingStatuses.OrderBy(s => s), browser);
    }

    [Fact]
    public void The_email_names_each_step_the_way_the_board_does()
    {
        var jsx = BoardSource();
        foreach (var (status, label) in OrderDigestService.StatusLabels)
        {
            Assert.Contains($"'{label}'", jsx);
            Assert.Contains(status, OrderStatuses.All);
        }
        Assert.Equal(OrderStatuses.All.OrderBy(s => s), OrderDigestService.StatusLabels.Keys.OrderBy(s => s));
    }

    private static string BoardSource()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "NVC Claude version")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine(dir!.FullName, "NVC Claude version", "src", "pages", "AdminOrdersPage.jsx"));
    }

    // --- When it is due ----------------------------------------------------------------

    [Fact]
    public void The_slot_is_monday_eight_in_sofia_on_both_sides_of_daylight_saving()
    {
        // Summer (EEST, +03): Monday 2026-10-19 08:00 Sofia is 05:00 UTC.
        Assert.Equal(new DateTimeOffset(2026, 10, 19, 5, 0, 0, TimeSpan.Zero),
            OrderDigestSchedule.MostRecentSlot(new DateTimeOffset(2026, 10, 19, 5, 0, 0, TimeSpan.Zero)));

        // The clocks go back on Sunday 2026-10-25. Winter (EET, +02): the next Monday's
        // eight o'clock is 06:00 UTC — an hour LATER in UTC, the same eight on the wall.
        var winterMonday = new DateTimeOffset(2026, 10, 26, 6, 0, 0, TimeSpan.Zero);
        Assert.Equal(winterMonday, OrderDigestSchedule.MostRecentSlot(winterMonday));

        // One minute before it, the previous week's slot still stands.
        Assert.Equal(new DateTimeOffset(2026, 10, 19, 5, 0, 0, TimeSpan.Zero),
            OrderDigestSchedule.MostRecentSlot(winterMonday.AddMinutes(-1)));

        // And spring forward (Sunday 2026-03-29): Monday 2026-03-30 08:00 is 05:00 UTC again.
        var springMonday = new DateTimeOffset(2026, 3, 30, 5, 0, 0, TimeSpan.Zero);
        Assert.Equal(springMonday, OrderDigestSchedule.MostRecentSlot(springMonday.AddHours(30)));
    }

    [Fact]
    public void Mid_week_the_slot_is_the_monday_just_gone()
    {
        var thursday = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
        Assert.Equal(new DateTimeOffset(2026, 9, 28, 5, 0, 0, TimeSpan.Zero), OrderDigestSchedule.MostRecentSlot(thursday));

        // Sunday night is still last Monday's week.
        var sunday = new DateTimeOffset(2026, 10, 4, 20, 0, 0, TimeSpan.Zero); // 23:00 Sofia
        Assert.Equal(new DateTimeOffset(2026, 9, 28, 5, 0, 0, TimeSpan.Zero), OrderDigestSchedule.MostRecentSlot(sunday));
    }

    [Fact]
    public void A_week_is_sent_once_however_often_the_app_restarts()
    {
        var slot = OrderDigestSchedule.MostRecentSlot(Now);

        // Never sent: this week is owed — switching it on sends the first one within the hour.
        Assert.Equal(slot, OrderDigestSchedule.Due(Now, lastSentSlot: null));

        // Sent at nine: a restart at ten, at noon, on Thursday — nothing more this week.
        Assert.Null(OrderDigestSchedule.Due(Now.AddHours(1), slot));
        Assert.Null(OrderDigestSchedule.Due(Now.AddDays(3), slot));

        // Next Monday at eight it is owed again.
        var next = slot.AddDays(7);
        Assert.Equal(next, OrderDigestSchedule.Due(next, slot));
    }

    [Fact]
    public void An_awake_app_wakes_at_eight_not_up_to_an_hour_later()
    {
        // Sunday 23:00 Sofia: the slot is nine hours off, so the ordinary hourly check.
        var sunday = new DateTimeOffset(2026, 10, 4, 20, 0, 0, TimeSpan.Zero);
        Assert.Equal(TimeSpan.FromHours(1), OrderDigestWorker.NextWake(sunday));

        // Monday 07:30 Sofia: it sleeps until just past eight, not until 08:30.
        var mondayEarly = new DateTimeOffset(2026, 10, 5, 4, 30, 0, TimeSpan.Zero);
        Assert.Equal(TimeSpan.FromMinutes(30) + TimeSpan.FromSeconds(5), OrderDigestWorker.NextWake(mondayEarly));

        // And the slot after a clock change is still eight on the wall: 06:00Z in winter.
        Assert.Equal(new DateTimeOffset(2026, 10, 26, 6, 0, 0, TimeSpan.Zero),
            OrderDigestSchedule.NextSlot(new DateTimeOffset(2026, 10, 19, 5, 0, 0, TimeSpan.Zero)));
    }

    [Fact]
    public void A_monday_the_app_slept_through_is_caught_up_not_skipped()
    {
        // Nobody visits all weekend; the app is unloaded at eight; the first visitor wakes it
        // at 11:40. A timer that only fires AT eight would skip the week. This sends.
        var lastWeek = OrderDigestSchedule.MostRecentSlot(Now).AddDays(-7);
        var wokeAt = new DateTimeOffset(2026, 10, 5, 8, 40, 0, TimeSpan.Zero);
        Assert.Equal(OrderDigestSchedule.MostRecentSlot(Now), OrderDigestSchedule.Due(wokeAt, lastWeek));
    }

    // --- What goes in it -----------------------------------------------------------------

    [Fact]
    public void Finished_orders_are_left_out_and_the_stuck_ones_lead()
    {
        var digest = OrderDigestService.Compose(new[]
        {
            Row(1, OrderStatuses.Delivered, Now.AddDays(-100), name: "Доставен"),
            Row(2, OrderStatuses.Cancelled, Now.AddDays(-100), name: "Отказан"),
            Row(3, OrderStatuses.Fabricating, Now.AddDays(-20), name: "Двайсет"),
            Row(4, OrderStatuses.Ready, Now.AddDays(-40), name: "Четирийсет"),
            Row(5, OrderStatuses.Travelling, Now.AddDays(-3), name: "Пътува"),
            Row(6, OrderStatuses.Placed, Now.AddDays(-60), name: "Приета"),
            Row(7, OrderStatuses.AtHarbor, null, name: "Без дата"),
        }, Now);

        Assert.Equal(5, digest.ActiveCount);

        // Longest silence first: that list IS the job.
        Assert.Equal(new[] { "Четирийсет", "Двайсет" }, digest.Stalled.Select(l => l.CustomerName));
        Assert.Equal(new[] { 40, 20 }, digest.Stalled.Select(l => l.StalledDays!.Value));

        // Then the rest, nearest the customer first; 'placed' never counts as stuck.
        Assert.Equal(new[] { "Без дата", "Пътува", "Приета" }, digest.Moving.Select(l => l.CustomerName));
    }

    [Fact]
    public void The_subject_says_whether_there_is_work_in_it()
    {
        var stuck = OrderDigestService.Compose(new[]
        {
            Row(1, OrderStatuses.Fabricating, Now.AddDays(-20)),
            Row(2, OrderStatuses.Travelling, Now.AddDays(-2)),
        }, Now);
        Assert.Equal("NVC · Поръчки: 1 без движение от 2 активни", OrderDigestService.Subject(stuck));

        // Says what the rule found — none stuck — not "all moving": 'placed' and orders with
        // nothing on file are in that list too, and the rule never judged them.
        var calm = OrderDigestService.Compose(new[]
        {
            Row(1, OrderStatuses.Travelling, Now.AddDays(-2)),
            Row(2, OrderStatuses.Placed, Now.AddDays(-40)),
        }, Now);
        Assert.Equal("NVC · Поръчки: 2 активни, нито една без движение", OrderDigestService.Subject(calm));
        Assert.DoesNotContain("В движение", OrderDigestService.Html(calm, Now));
    }

    [Theory]
    // Now is Monday 2026-10-05 09:30 Sofia (06:30Z). Words name CALENDAR days in Sofia.
    [InlineData("2026-10-05T04:00:00Z", "Последна актуализация: днес")]          // Mon 07:00
    [InlineData("2026-10-04T12:00:00Z", "Последна актуализация: вчера")]         // Sun 15:00 — 17.5 h, still yesterday
    [InlineData("2026-10-02T13:00:00Z", "Последна актуализация: преди 3 дни")]   // Fri 16:00 — 2.7 periods, 3 days
    public void Recency_is_told_in_calendar_days(string touchedIso, string expected)
    {
        var touched = DateTimeOffset.Parse(touchedIso, System.Globalization.CultureInfo.InvariantCulture);
        var digest = OrderDigestService.Compose(new[] { Row(1, OrderStatuses.Travelling, touched) }, Now);
        Assert.Contains(expected, OrderDigestService.Html(digest, Now));
    }

    [Fact]
    public void The_email_carries_the_work_and_not_the_money()
    {
        var digest = OrderDigestService.Compose(new[]
        {
            Row(1, OrderStatuses.Ready, Now.AddDays(-20), name: "<b>Иван</b> & Co",
                model: "Nova 60", quantity: 2, expectedReady: "2026-09-20", deposit: 5000m, finalPrice: 24900m),
        }, Now);

        var html = OrderDigestService.Html(digest, Now);

        Assert.Contains(OrderDigestService.BoardUrl, html);
        Assert.Contains("https://nvc-home4you.eu/admin/orders", html);
        Assert.Contains("Без движение 20 дни", html);
        Assert.Contains("Готова за доставка", html);
        Assert.Contains("Nova 60 × 2 бр.", html);
        Assert.Contains("очаквана готовност 20.09.2026", html);

        // A name is text, never markup.
        Assert.Contains("&lt;b&gt;Иван&lt;/b&gt; &amp; Co", html);
        Assert.DoesNotContain("<b>Иван</b>", html);

        // An inbox has none of the panel's protection: no amounts of any kind.
        Assert.DoesNotContain("24900", html);
        Assert.DoesNotContain("24 900", html);
        Assert.DoesNotContain("5000", html);
        Assert.DoesNotContain("€", html);
        Assert.DoesNotContain("EUR", html);
    }

    // --- Sending -------------------------------------------------------------------------

    private sealed class FakeEmail : EmailService
    {
        private readonly bool _succeed;

        public FakeEmail(bool succeed, EnvConfig env)
            : base(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance)
        {
            _succeed = succeed;
        }

        public int Sends { get; private set; }
        public string? LastSubject { get; private set; }
        public IReadOnlyCollection<string>? LastRecipients { get; private set; }

        public override Task<bool> TrySendInternalReportAsync(
            IReadOnlyCollection<string> toEmails, string subject, string html, CancellationToken ct = default)
        {
            Sends++;
            LastSubject = subject;
            LastRecipients = toEmails;
            return Task.FromResult(_succeed);
        }
    }

    private static EnvConfig Env(params (string Key, string Value)[] settings) =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
            }.Concat(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value))))
            .Build());

    // Graph settings that make EmailService report itself configured; FakeEmail never sends.
    private static readonly (string, string)[] MailOn =
    {
        ("GRAPH_TENANT_ID", "t"), ("GRAPH_CLIENT_ID", "c"), ("GRAPH_CLIENT_SECRET", "s"), ("GRAPH_SENDER", "contact@nvc-home4you.eu"),
    };

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"orderdigest-{Guid.NewGuid()}")
            .Options);

    private static async Task SeedAsync(AppDbContext db, string status, DateTimeOffset? movedAt)
    {
        var customer = new Customer { Name = "Иван Петров" };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        var purchase = new Purchase { CustomerId = customer.Id, CustomModel = "Nova 60", Quantity = 1, Status = status };
        db.Purchases.Add(purchase);
        await db.SaveChangesAsync();
        if (movedAt is DateTimeOffset at)
        {
            db.OrderStatusEvents.Add(new OrderStatusEvent { PurchaseId = purchase.Id, Status = status, ChangedAt = at });
            await db.SaveChangesAsync();
        }
    }

    private static OrderDigestService NewDigest(AppDbContext db, EmailService email, EnvConfig env) =>
        new(new OrderTrackingService(db, new ImageUrls(env)), email, env, NullLogger<OrderDigestService>.Instance);

    [Fact]
    public async Task It_goes_to_the_person_who_moves_the_orders_and_the_owner()
    {
        using var db = NewDb();
        await SeedAsync(db, OrderStatuses.Fabricating, Now.AddDays(-20));
        var env = Env(MailOn);
        var email = new FakeEmail(succeed: true, env);

        var result = await NewDigest(db, email, env).SendAsync(Now, CancellationToken.None);

        Assert.Equal(OrderDigestService.DigestOutcome.Sent, result.Outcome);
        Assert.True(result.Done);
        Assert.Equal(1, email.Sends);
        Assert.Equal(new[] { "tbonin@nvc-home4you.eu", "vvladimirov@nvc-home4you.eu" }, email.LastRecipients);
        Assert.Equal("NVC · Поръчки: 1 без движение от 1 активна", email.LastSubject);
    }

    [Fact]
    public async Task A_week_with_nothing_active_sends_nothing_and_is_done()
    {
        using var db = NewDb();
        await SeedAsync(db, OrderStatuses.Delivered, Now.AddDays(-30));
        var env = Env(MailOn);
        var email = new FakeEmail(succeed: true, env);

        var result = await NewDigest(db, email, env).SendAsync(Now, CancellationToken.None);

        Assert.Equal(OrderDigestService.DigestOutcome.NothingActive, result.Outcome);
        Assert.True(result.Done); // nothing to retry every hour
        Assert.Equal(0, email.Sends);
    }

    [Fact]
    public async Task A_failed_send_leaves_the_week_owed()
    {
        using var db = NewDb();
        await SeedAsync(db, OrderStatuses.Travelling, Now.AddDays(-2));
        var env = Env(MailOn);

        var result = await NewDigest(db, new FakeEmail(succeed: false, env), env).SendAsync(Now, CancellationToken.None);

        Assert.Equal(OrderDigestService.DigestOutcome.Failed, result.Outcome);
        Assert.False(result.Done); // the worker records no marker, and tries again in an hour
    }

    [Fact]
    public async Task No_mail_settings_is_reported_as_such_not_as_a_quiet_week()
    {
        using var db = NewDb();
        await SeedAsync(db, OrderStatuses.Travelling, Now.AddDays(-2));
        var env = Env();
        var email = new FakeEmail(succeed: true, env);

        var result = await NewDigest(db, email, env).SendAsync(Now, CancellationToken.None);

        Assert.Equal(OrderDigestService.DigestOutcome.NotConfigured, result.Outcome);
        Assert.False(result.Done);
        Assert.Equal(0, email.Sends);
    }

    [Fact]
    public void It_is_off_until_switched_on_and_addressed_as_the_owner_decided()
    {
        Assert.False(Env().OrderDigestEnabled);
        Assert.False(Env(("ORDER_DIGEST_ENABLED", "yes")).OrderDigestEnabled); // only "true" counts
        Assert.True(Env(("ORDER_DIGEST_ENABLED", "true")).OrderDigestEnabled);

        Assert.Equal(new[] { "tbonin@nvc-home4you.eu", "vvladimirov@nvc-home4you.eu" },
            EmailService.ParseRecipients(Env().OrderDigestTo));
    }

    // --- The marker ----------------------------------------------------------------------

    [Fact]
    public void The_marker_survives_a_restart()
    {
        var path = Path.Combine(Path.GetTempPath(), $"order-digest-{Guid.NewGuid()}", "last.txt");
        try
        {
            var slot = OrderDigestSchedule.MostRecentSlot(Now);
            new OrderDigestMarker(path, NullLogger<OrderDigestMarker>.Instance).Record(slot);

            var afterRestart = new OrderDigestMarker(path, NullLogger<OrderDigestMarker>.Instance);
            Assert.Equal(slot, afterRestart.LastSentSlot);
            Assert.Null(OrderDigestSchedule.Due(Now.AddHours(2), afterRestart.LastSentSlot));
        }
        finally
        {
            Directory.Delete(Path.GetDirectoryName(path)!, recursive: true);
        }
    }

    [Fact]
    public void A_second_instance_sees_the_week_the_first_one_sent()
    {
        // Two workers over one %HOME% — a scale-out, or old and new overlapping in a
        // restart. Each loaded the marker before either sent; the one that did not send must
        // still learn this week is done, or both mail every Monday from then on.
        var path = Path.Combine(Path.GetTempPath(), $"order-digest-{Guid.NewGuid()}", "last.txt");
        try
        {
            var a = new OrderDigestMarker(path, NullLogger<OrderDigestMarker>.Instance);
            var b = new OrderDigestMarker(path, NullLogger<OrderDigestMarker>.Instance);
            Assert.Null(a.LastSentSlot);
            Assert.Null(b.LastSentSlot);

            var slot = OrderDigestSchedule.MostRecentSlot(Now);
            a.Record(slot);

            Assert.Equal(slot, b.LastSentSlot);
            Assert.Null(OrderDigestSchedule.Due(Now, b.LastSentSlot));
        }
        finally
        {
            Directory.Delete(Path.GetDirectoryName(path)!, recursive: true);
        }
    }

    [Fact]
    public void A_marker_that_cannot_be_written_still_stops_an_hourly_repeat()
    {
        // The directory is a FILE, so the write fails. The week must still count as sent for
        // the life of the process — the cost of a broken disk is at most one repeat after a
        // restart, never an email every hour.
        var blocker = Path.Combine(Path.GetTempPath(), $"order-digest-blocker-{Guid.NewGuid()}");
        File.WriteAllText(blocker, "not a directory");
        try
        {
            var marker = new OrderDigestMarker(Path.Combine(blocker, "last.txt"), NullLogger<OrderDigestMarker>.Instance);
            var slot = OrderDigestSchedule.MostRecentSlot(Now);
            marker.Record(slot);

            Assert.Equal(slot, marker.LastSentSlot);
            Assert.Null(OrderDigestSchedule.Due(Now.AddHours(1), marker.LastSentSlot));
        }
        finally
        {
            File.Delete(blocker);
        }
    }

    [Fact]
    public void An_unreadable_marker_means_the_week_is_owed()
    {
        var path = Path.Combine(Path.GetTempPath(), $"order-digest-garbage-{Guid.NewGuid()}.txt");
        File.WriteAllText(path, "not a date");
        try
        {
            Assert.Null(new OrderDigestMarker(path, NullLogger<OrderDigestMarker>.Instance).LastSentSlot);
        }
        finally
        {
            File.Delete(path);
        }
    }
}
