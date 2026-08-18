using System;
using System.Linq;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The factory order sheets, now rows instead of one browser's localStorage.
//
// The sharp edges pinned here: the list must never carry the plan image (it is the whole
// row's weight), the JSON payloads are opaque but must at least BE json (a corrupted payload
// stored today is an editor that cannot open the sheet next month), and edits land in the
// audit log like everything else staff change.
public class FactorySheetTests
{
    private static AppDbContext NewDb(bool audited = false) =>
        new(audited
            ? new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"sheets-{Guid.NewGuid()}")
                .AddInterceptors(new AuditInterceptor(new Actor(), NullLogger<AuditInterceptor>.Instance))
                .Options
            : new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"sheets-{Guid.NewGuid()}")
                .Options);

    private sealed class Actor : ICurrentActor
    {
        public string? Upn => "vladi@nvc-home4you.eu";
    }

    private static FactorySheetInput NewInput(
        string? client = "Иван Петров", string? reference = "FS-2026-014",
        string? windows = null, string? planImage = null) => new()
        {
            Client = client,
            Project = "Разгъваема къща 58 м²",
            Reference = reference,
            SheetDate = "2026-08-18",
            Lang = "bg",
            PlanImage = planImage,
            WindowsJson = windows ?? """[{"id":"w-1","x":25,"y":40,"type":"1200×950","note":""}]""",
            ContactsJson = """[{"id":"c-1","x":60,"y":70,"purpose":"Кухня","ctype":"Двоен контакт","note":""}]""",
            SpecsJson = """[{"id":"s-1","label":"Модел","value":"58 м²"}]""",
            Notes = "Терасата гледа на юг.",
        };

    // --- The list stays light -------------------------------------------------------------

    [Fact]
    public async Task The_list_carries_counts_and_a_flag_but_never_the_image()
    {
        using var db = NewDb();
        var svc = new FactorySheetAdminService(db);
        await svc.CreateAsync(NewInput(planImage: "data:image/jpeg;base64," + new string('A', 200_000)), "v@x.eu", default);

        var list = await svc.ListAsync(default);

        var row = Assert.Single(list);
        Assert.True(row.HasPlan);
        Assert.Equal(1, row.WindowCount);
        Assert.Equal(1, row.ContactCount);
        // The DTO type simply has no image property — pinned so nobody adds one for
        // convenience and quietly makes every list request carry every plan.
        Assert.DoesNotContain(typeof(FactorySheetSummaryDto).GetProperties(),
            p => p.Name.Contains("Image", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task The_detail_view_is_where_the_plan_lives()
    {
        using var db = NewDb();
        var svc = new FactorySheetAdminService(db);
        var created = await svc.CreateAsync(NewInput(planImage: "data:image/jpeg;base64,QUJD"), "v@x.eu", default);

        var detail = await svc.GetAsync(created.Id, default);

        Assert.Equal("data:image/jpeg;base64,QUJД".Replace("Д", "D"), detail!.PlanImage);
        Assert.Equal("2026-08-18", detail.SheetDate);
        Assert.Contains("1200×950", detail.WindowsJson);
    }

    // --- Validation -----------------------------------------------------------------------

    [Fact]
    public void A_sheet_with_nothing_to_find_it_by_is_refused()
    {
        var input = NewInput(client: null, reference: null);
        input.Project = null;

        var errors = FactorySheetAdminService.Validate(input);

        Assert.Contains(errors, e => e.Contains("found again"));
    }

    [Theory]
    [InlineData("{ not json")]
    [InlineData("\"a string\"")]
    [InlineData("{\"an\":\"object\"}")]
    public void A_payload_that_is_not_a_json_list_is_refused(string windows)
    {
        // Opaque is not the same as unchecked: a corrupted payload stored today is an
        // editor that cannot open the sheet next month.
        var errors = FactorySheetAdminService.Validate(NewInput(windows: windows));

        Assert.NotEmpty(errors);
    }

    [Fact]
    public void An_oversized_plan_is_refused_rather_than_stored()
    {
        var input = NewInput(planImage: new string('x', FactorySheetAdminService.MaxPlanImageChars + 1));

        Assert.Contains(FactorySheetAdminService.Validate(input), e => e.Contains("too large"));
    }

    [Theory]
    [InlineData("2026-08-18", true)]
    [InlineData("", true)]
    [InlineData(null, true)]
    [InlineData("18/08/2026", false)]
    [InlineData("nonsense", false)]
    public void The_date_parses_or_refuses_but_never_guesses(string? value, bool ok)
    {
        Assert.Equal(ok, FactorySheetAdminService.TryParseDate(value, out _));
    }

    // --- Round trip -----------------------------------------------------------------------

    [Fact]
    public async Task An_update_replaces_the_sheet_and_records_who()
    {
        using var db = NewDb();
        var svc = new FactorySheetAdminService(db);
        var created = await svc.CreateAsync(NewInput(), "first@x.eu", default);

        var input = NewInput();
        input.Notes = "Прозорецът в банята става фиксиран.";
        var updated = await svc.UpdateAsync(created.Id, input, "second@x.eu", default);

        Assert.Equal("Прозорецът в банята става фиксиран.", updated!.Notes);
        Assert.Equal("second@x.eu", updated.UpdatedByUpn);
    }

    [Fact]
    public async Task Deleting_a_sheet_removes_the_row()
    {
        using var db = NewDb();
        var svc = new FactorySheetAdminService(db);
        var created = await svc.CreateAsync(NewInput(), "v@x.eu", default);

        Assert.True(await svc.DeleteAsync(created.Id, default));
        Assert.Empty(await svc.ListAsync(default));
        Assert.False(await svc.DeleteAsync(created.Id, default));
    }

    // --- The audit log covers it ---------------------------------------------------------

    [Fact]
    public async Task Sheet_edits_land_in_the_audit_log()
    {
        // What we tell the factory to build; wrong here is wrong in steel. The interceptor
        // covers it because FactorySheet is on the audited allow-list — this pins that the
        // name is actually on the list, which a typo would silently break.
        using var db = NewDb(audited: true);
        var svc = new FactorySheetAdminService(db);

        var created = await svc.CreateAsync(NewInput(), "vladi@nvc-home4you.eu", default);
        var input = NewInput();
        input.Client = "Мария Тодорова";
        await svc.UpdateAsync(created.Id, input, "vladi@nvc-home4you.eu", default);

        var entries = await db.AuditEntries.Where(a => a.EntityType == nameof(FactorySheet)).ToListAsync();

        Assert.Equal(2, entries.Count);
        Assert.Contains(entries, e => e.Action == AuditActions.Created);
        var edit = entries.Single(e => e.Action == AuditActions.Updated);
        Assert.Contains("Мария Тодорова", edit.ChangesJson);
        Assert.Equal("vladi@nvc-home4you.eu", edit.ActorUpn);
    }
}
