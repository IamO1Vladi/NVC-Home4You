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

/// <summary>One sheet as the panel submits it. The arrays travel as raw JSON strings.</summary>
public sealed class FactorySheetInput
{
    public string? Client { get; set; }
    public string? Project { get; set; }
    public string? Reference { get; set; }

    // "YYYY-MM-DD" from an <input type="date">, or empty.
    public string? SheetDate { get; set; }

    public string? Lang { get; set; }
    public string? PlanImage { get; set; }
    public string? PlanName { get; set; }
    public string? WindowsJson { get; set; }
    public string? ContactsJson { get; set; }
    public string? SpecsJson { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// The list row. Deliberately WITHOUT the plan image — see FactorySheet.PlanImage: the list
/// must stay cheap however many sheets accumulate, and the image is the whole row's weight.
/// </summary>
public sealed record FactorySheetSummaryDto(
    int Id,
    string? Client,
    string? Project,
    string? Reference,
    string? SheetDate,
    bool HasPlan,
    int WindowCount,
    int ContactCount,
    string CreatedAt,
    string? UpdatedAt,
    string? UpdatedByUpn);

public sealed record FactorySheetDetailDto(
    int Id,
    string? Client,
    string? Project,
    string? Reference,
    string? SheetDate,
    string Lang,
    string? PlanImage,
    string? PlanName,
    string WindowsJson,
    string ContactsJson,
    string SpecsJson,
    string? Notes,
    string CreatedAt,
    string? UpdatedAt,
    string? UpdatedByUpn);

public sealed class FactorySheetAdminService
{
    private readonly AppDbContext _db;

    public FactorySheetAdminService(AppDbContext db) => _db = db;

    /// <summary>
    /// The panel downscales the plan before upload to roughly a quarter megabyte; this is
    /// the server refusing to take a browser's word for it. Four megabytes is far above
    /// anything the downscaler produces and far below anything that could hurt the table.
    /// </summary>
    public const int MaxPlanImageChars = 4 * 1024 * 1024;

    public static List<string> Validate(FactorySheetInput? input)
    {
        var errors = new List<string>();
        if (input is null)
        {
            errors.Add("Nothing was submitted.");
            return errors;
        }

        // At least one identifying field, or the list fills with rows nobody can tell apart.
        if (string.IsNullOrWhiteSpace(input.Client)
            && string.IsNullOrWhiteSpace(input.Project)
            && string.IsNullOrWhiteSpace(input.Reference))
        {
            errors.Add("Give the sheet a client, a project or a reference, so it can be found again.");
        }

        if (!TryParseDate(input.SheetDate, out _))
            errors.Add("That is not a date we can read.");

        if ((input.PlanImage?.Length ?? 0) > MaxPlanImageChars)
            errors.Add("The plan image is too large. Re-upload it so the panel can shrink it.");

        // The arrays are opaque to the server, but they still have to BE json — a corrupted
        // payload stored today is an editor that cannot open the sheet next month.
        foreach (var (value, name) in new[]
        {
            (input.WindowsJson, "windows"), (input.ContactsJson, "contacts"), (input.SpecsJson, "specs"),
        })
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            try
            {
                using var doc = JsonDocument.Parse(value);
                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                    errors.Add($"The {name} payload is not a list.");
            }
            catch (JsonException)
            {
                errors.Add($"The {name} payload is not valid JSON.");
            }
        }

        return errors;
    }

    public async Task<List<FactorySheetSummaryDto>> ListAsync(CancellationToken ct)
    {
        // The image column stays out of the query entirely — projecting first is what makes
        // that true, rather than fetching whole rows and dropping the heavy part after.
        var rows = await _db.FactorySheets
            .AsNoTracking()
            .OrderByDescending(s => s.UpdatedAt ?? s.CreatedAt)
            .ThenByDescending(s => s.Id)
            .Select(s => new
            {
                s.Id, s.Client, s.Project, s.Reference, s.SheetDate,
                HasPlan = s.PlanImage != null && s.PlanImage != "",
                s.WindowsJson, s.ContactsJson,
                s.CreatedAt, s.UpdatedAt, s.UpdatedByUpn,
            })
            .ToListAsync(ct);

        return rows.Select(s => new FactorySheetSummaryDto(
            s.Id, s.Client, s.Project, s.Reference,
            s.SheetDate is null ? null : DateOnlyIso(s.SheetDate.Value),
            s.HasPlan,
            CountArray(s.WindowsJson),
            CountArray(s.ContactsJson),
            Iso(s.CreatedAt),
            s.UpdatedAt is null ? null : Iso(s.UpdatedAt.Value),
            s.UpdatedByUpn)).ToList();
    }

    public async Task<FactorySheetDetailDto?> GetAsync(int id, CancellationToken ct)
    {
        var sheet = await _db.FactorySheets.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct);
        return sheet is null ? null : ToDetail(sheet);
    }

    public async Task<FactorySheetDetailDto> CreateAsync(FactorySheetInput input, string? actor, CancellationToken ct)
    {
        var sheet = new FactorySheet { CreatedAt = DateTimeOffset.UtcNow };
        Apply(sheet, input, actor);

        _db.FactorySheets.Add(sheet);
        await _db.SaveChangesAsync(ct);
        return ToDetail(sheet);
    }

    public async Task<FactorySheetDetailDto?> UpdateAsync(int id, FactorySheetInput input, string? actor, CancellationToken ct)
    {
        var sheet = await _db.FactorySheets.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sheet is null) return null;

        Apply(sheet, input, actor);
        await _db.SaveChangesAsync(ct);
        return ToDetail(sheet);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var sheet = await _db.FactorySheets.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sheet is null) return false;

        // A plain delete. The audit log keeps the tombstone — who deleted which sheet — and
        // the JSON columns are truncated into it, so "it was there last week" is answerable.
        _db.FactorySheets.Remove(sheet);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static void Apply(FactorySheet sheet, FactorySheetInput input, string? actor)
    {
        sheet.Client = AdminText.Clean(input.Client);
        sheet.Project = AdminText.Clean(input.Project);
        sheet.Reference = AdminText.Clean(input.Reference);
        sheet.Lang = input.Lang == "en" ? "en" : "bg";
        sheet.PlanImage = string.IsNullOrWhiteSpace(input.PlanImage) ? null : input.PlanImage;
        sheet.PlanName = AdminText.Clean(input.PlanName);
        sheet.WindowsJson = string.IsNullOrWhiteSpace(input.WindowsJson) ? "[]" : input.WindowsJson!;
        sheet.ContactsJson = string.IsNullOrWhiteSpace(input.ContactsJson) ? "[]" : input.ContactsJson!;
        sheet.SpecsJson = string.IsNullOrWhiteSpace(input.SpecsJson) ? "[]" : input.SpecsJson!;
        sheet.Notes = AdminText.Clean(input.Notes);
        sheet.UpdatedAt = DateTimeOffset.UtcNow;
        sheet.UpdatedByUpn = actor;

        TryParseDate(input.SheetDate, out var date);
        sheet.SheetDate = date;
    }

    /// <summary>"YYYY-MM-DD" to midnight UTC; empty is fine, junk is not.</summary>
    public static bool TryParseDate(string? value, out DateTimeOffset? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(value)) return true;

        if (!DateTime.TryParseExact(
                value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var date))
        {
            return false;
        }

        parsed = new DateTimeOffset(date, TimeSpan.Zero);
        return true;
    }

    private static int CountArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return 0;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Array ? doc.RootElement.GetArrayLength() : 0;
        }
        catch (JsonException)
        {
            return 0;
        }
    }

    private static FactorySheetDetailDto ToDetail(FactorySheet s) => new(
        s.Id, s.Client, s.Project, s.Reference,
        s.SheetDate is null ? null : DateOnlyIso(s.SheetDate.Value),
        s.Lang, s.PlanImage, s.PlanName,
        s.WindowsJson, s.ContactsJson, s.SpecsJson, s.Notes,
        Iso(s.CreatedAt),
        s.UpdatedAt is null ? null : Iso(s.UpdatedAt.Value),
        s.UpdatedByUpn);

    private static string Iso(DateTimeOffset value) =>
        value.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);

    private static string DateOnlyIso(DateTimeOffset value) =>
        value.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}
