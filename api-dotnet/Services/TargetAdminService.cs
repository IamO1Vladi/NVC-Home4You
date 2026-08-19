using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>What the panel sends when setting a target.</summary>
public sealed class TargetInput
{
    public string PeriodType { get; set; } = PeriodTypes.Month;
    public int? Year { get; set; }
    public int? Month { get; set; }
    public int? BuyCycleId { get; set; }
    public string MetricKey { get; set; } = "";
    public decimal TargetValue { get; set; }
    public string? Notes { get; set; }
}

/// <summary>A target as the panel sees it. PeriodLabel is what a person reads on the row.</summary>
public sealed record TargetDto(
    int Id,
    string PeriodType,
    int? Year,
    int? Month,
    int? BuyCycleId,
    string? BuyCycleLabel,
    string PeriodLabel,
    string MetricKey,
    decimal TargetValue,
    string? Notes,
    string? UpdatedAt,
    string? UpdatedByUpn);

// What we said we would do. See Target.
public sealed class TargetAdminService
{
    private readonly AppDbContext _db;

    public TargetAdminService(AppDbContext db) => _db = db;

    public async Task<List<TargetDto>> ListAsync(CancellationToken ct)
    {
        var targets = await _db.Targets
            .AsNoTracking()
            .Include(t => t.BuyCycle)
            .ToListAsync(ct);

        return targets
            .OrderByDescending(t => t.Year ?? 0)
            .ThenByDescending(t => t.Month ?? 0)
            .ThenBy(t => t.MetricKey)
            .Select(ToDto)
            .ToList();
    }

    public async Task<TargetDto?> GetAsync(int id, CancellationToken ct)
    {
        var target = await _db.Targets
            .AsNoTracking()
            .Include(t => t.BuyCycle)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        return target is null ? null : ToDto(target);
    }

    public enum SaveOutcome { Created, Updated, NotFound }

    /// <summary>
    /// Sets a target, replacing whatever was already set for that metric and period.
    ///
    /// AN UPSERT ON PURPOSE, and it is the behaviour the unique index exists to make safe.
    /// The alternative — refusing the save with "a target already exists" — hands the person
    /// a dead end on the one screen where the whole job is revising a number, and the way out
    /// of a dead end is usually a second row somewhere it does not collide.
    ///
    /// Matching on the same five columns as the index, so the check here and the constraint
    /// in the database can never disagree about what counts as the same target.
    /// </summary>
    public async Task<(SaveOutcome Outcome, TargetDto Target)> SetAsync(
        TargetInput input, string? actor, CancellationToken ct)
    {
        var periodType = Normalise(input);

        var existing = await _db.Targets.FirstOrDefaultAsync(
            t => t.PeriodType == periodType
              && t.MetricKey == input.MetricKey
              && t.Year == input.Year
              && t.Month == input.Month
              && t.BuyCycleId == input.BuyCycleId,
            ct);

        if (existing is not null)
        {
            existing.TargetValue = input.TargetValue;
            existing.Notes = FactoryAdminService.Clean(input.Notes);
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            existing.UpdatedByUpn = actor;

            await _db.SaveChangesAsync(ct);
            return (SaveOutcome.Updated, (await GetAsync(existing.Id, ct))!);
        }

        var target = new Target
        {
            PeriodType = periodType,
            Year = input.Year,
            Month = input.Month,
            BuyCycleId = input.BuyCycleId,
            MetricKey = input.MetricKey,
            TargetValue = input.TargetValue,
            Notes = FactoryAdminService.Clean(input.Notes),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            UpdatedByUpn = actor,
        };

        _db.Targets.Add(target);
        await _db.SaveChangesAsync(ct);

        return (SaveOutcome.Created, (await GetAsync(target.Id, ct))!);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var target = await _db.Targets.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (target is null) return false;

        _db.Targets.Remove(target);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Everything wrong with a submitted target.
    ///
    /// The period columns are checked AGAINST THE PERIOD TYPE rather than independently,
    /// because the combination is what the unique index keys on: a monthly target that
    /// arrived with no month, or a cycle target carrying a stray year from the form it was
    /// typed in, would each occupy a slot nothing later matches — set once, then invisible
    /// to the dashboard and impossible to overwrite from the same screen.
    /// </summary>
    public static List<string> Validate(TargetInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (!PeriodTypes.IsValid(input.PeriodType))
            errors.Add("That is not a period type.");

        if (!TargetMetrics.IsValid(input.MetricKey))
            errors.Add("That is not something we set targets on.");

        switch (input.PeriodType)
        {
            case PeriodTypes.Month:
                if (input.Year is null) errors.Add("A monthly target needs a year.");
                if (input.Month is not int m || m < 1 || m > 12)
                    errors.Add("A monthly target needs a month between 1 and 12.");
                if (input.BuyCycleId is not null)
                    errors.Add("A monthly target does not belong to a buying cycle.");
                break;

            case PeriodTypes.Year:
                if (input.Year is null) errors.Add("A yearly target needs a year.");
                if (input.Month is not null) errors.Add("A yearly target has no month.");
                if (input.BuyCycleId is not null)
                    errors.Add("A yearly target does not belong to a buying cycle.");
                break;

            case PeriodTypes.Cycle:
                if (input.BuyCycleId is null) errors.Add("A cycle target needs a cycle.");
                if (input.Month is not null) errors.Add("A cycle target has no month.");
                break;
        }

        if (input.Year is int year && (year < 2000 || year > 2100))
            errors.Add("That year does not look right.");

        // Zero is allowed — "hold marketing at nothing this quarter" is a real target, and
        // OpexCap in particular is a ceiling rather than a goal. Negative is not.
        if (input.TargetValue < 0m) errors.Add("A target cannot be negative.");

        return errors;
    }

    /// <summary>
    /// Blanks the period columns the type does not use.
    ///
    /// Validation already refuses a stray value, so this is belt and braces for anything that
    /// reaches SetAsync another way — an importer, a later endpoint. The unique index keys on
    /// all five columns, so one stray year is enough to make a target invisible to every
    /// lookup that goes looking for it.
    /// </summary>
    private static string Normalise(TargetInput input)
    {
        var periodType = PeriodTypes.IsValid(input.PeriodType) ? input.PeriodType : PeriodTypes.Month;

        if (periodType != PeriodTypes.Cycle) input.BuyCycleId = null;
        if (periodType != PeriodTypes.Month) input.Month = null;
        if (periodType == PeriodTypes.Cycle) input.Year = null;

        return periodType;
    }

    private static TargetDto ToDto(Target t) => new(
        t.Id,
        t.PeriodType,
        t.Year,
        t.Month,
        t.BuyCycleId,
        t.BuyCycle?.Label,
        PeriodLabel(t),
        t.MetricKey,
        t.TargetValue,
        t.Notes,
        t.UpdatedAt?.ToString("o"),
        t.UpdatedByUpn);

    /// <summary>What the period is called on screen. Formatting only — nothing keys on it.</summary>
    public static string PeriodLabel(Target t) => t.PeriodType switch
    {
        PeriodTypes.Month => t.Year is int y && t.Month is int m ? $"{y:D4}-{m:D2}" : "—",
        PeriodTypes.Year => t.Year is int y2 ? y2.ToString() : "—",
        PeriodTypes.Cycle => t.BuyCycle?.Label ?? "—",
        _ => "—",
    };
}
