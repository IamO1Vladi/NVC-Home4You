using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>What the panel sends when creating or updating a buying cycle.</summary>
public sealed class BuyCycleInput
{
    public string Label { get; set; } = "";
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public decimal? MarkupCoefficient { get; set; }
    public decimal? BorderVatRate { get; set; }
    public bool IsClosed { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// A cycle as the panel sees it.
///
/// ShipmentCount is carried for the same reason FactoryDto carries PurchaseCount: the one
/// thing a person needs before touching a cycle row is how much history hangs off it.
/// </summary>
public sealed record BuyCycleDto(
    int Id,
    string Label,
    string? StartDate,
    string? EndDate,
    decimal? MarkupCoefficient,
    decimal? BorderVatRate,
    bool IsClosed,
    string? Notes,
    int ShipmentCount,
    string? UpdatedAt,
    string? UpdatedByUpn);

// The buying cycles, and the two coefficients that price everything inside them.
public sealed class BuyCycleAdminService
{
    private readonly AppDbContext _db;

    public BuyCycleAdminService(AppDbContext db) => _db = db;

    /// <summary>
    /// Every cycle, open ones first, then most recent first.
    ///
    /// Closed cycles are listed rather than hidden — this is the screen where a cycle gets
    /// reopened, and every report reads them all. It is the "add a shipment" dropdown that
    /// filters, not this. Same call as FactoryAdminService.ListAsync.
    /// </summary>
    public async Task<List<BuyCycleDto>> ListAsync(CancellationToken ct) =>
        await _db.BuyCycles
            .AsNoTracking()
            .OrderBy(c => c.IsClosed)
            .ThenByDescending(c => c.StartDate ?? c.CreatedAt)
            .Select(c => new BuyCycleDto(
                c.Id, c.Label,
                c.StartDate == null ? null : c.StartDate!.Value.ToString("yyyy-MM-dd"),
                c.EndDate == null ? null : c.EndDate!.Value.ToString("yyyy-MM-dd"),
                c.MarkupCoefficient, c.BorderVatRate, c.IsClosed, c.Notes,
                c.Shipments.Count,
                c.UpdatedAt == null ? null : c.UpdatedAt!.Value.ToString("o"),
                c.UpdatedByUpn))
            .ToListAsync(ct);

    public async Task<BuyCycleDto?> GetAsync(int id, CancellationToken ct) =>
        (await ListAsync(ct)).FirstOrDefault(c => c.Id == id);

    /// <summary>
    /// The coefficients a new cycle should start from — the most recent cycle that has them.
    ///
    /// Defaulted rather than left blank because the markup rarely moves between cycles, and a
    /// cycle with no markup prices nothing at all: every shipment in it shows a dash where
    /// the suggested retail belongs, and the person who created the cycle is not usually the
    /// person who notices. Prefilled is editable; blank is a silent gap.
    /// </summary>
    public async Task<(decimal? Markup, decimal? BorderVat)> PreviousCoefficientsAsync(CancellationToken ct)
    {
        var previous = await _db.BuyCycles
            .AsNoTracking()
            .Where(c => c.MarkupCoefficient != null)
            .OrderByDescending(c => c.StartDate ?? c.CreatedAt)
            .FirstOrDefaultAsync(ct);

        return (previous?.MarkupCoefficient, previous?.BorderVatRate);
    }

    public async Task<BuyCycleDto> CreateAsync(BuyCycleInput input, string? actor, CancellationToken ct)
    {
        var cycle = new BuyCycle { CreatedAt = DateTimeOffset.UtcNow };
        Apply(cycle, input, actor);

        // DELIBERATELY NO SERVER-SIDE BACKFILL of the coefficients. The form prefills them
        // from /defaults so the person can see the numbers and DISAGREE on the spot — and
        // a first draft of this method quietly re-applied the previous cycle's values when
        // both boxes came back cleared, which is exactly the "I disagree with both"
        // gesture. What the form sends is what the cycle holds; empty means unpriced, and
        // unpriced shows as a dash, never as somebody else's markup (2026-08-19 review).

        _db.BuyCycles.Add(cycle);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(cycle.Id, ct))!;
    }

    public async Task<BuyCycleDto?> UpdateAsync(int id, BuyCycleInput input, string? actor, CancellationToken ct)
    {
        var cycle = await _db.BuyCycles.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cycle is null) return null;

        Apply(cycle, input, actor);
        await _db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public enum DeleteOutcome { Deleted, NotFound, InUse }

    /// <summary>
    /// Removes a cycle nothing points at.
    ///
    /// Refused with counts rather than cascaded, exactly as FactoryAdminService refuses a
    /// supplier in use — and the stakes are higher here, because the rows that would go are
    /// containers and attributed spending. A cycle that is over gets closed; that is what
    /// IsClosed is for.
    /// </summary>
    public async Task<(DeleteOutcome Outcome, int ShipmentCount, int TargetCount, int ExpenseCount)> DeleteAsync(
        int id, CancellationToken ct)
    {
        var cycle = await _db.BuyCycles.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cycle is null) return (DeleteOutcome.NotFound, 0, 0, 0);

        var shipments = await _db.Shipments.CountAsync(s => s.BuyCycleId == id, ct);
        var targets = await _db.Targets.CountAsync(t => t.BuyCycleId == id, ct);
        var expenses = await _db.OperatingExpenses.CountAsync(x => x.BuyCycleId == id, ct);
        if (shipments > 0 || targets > 0 || expenses > 0)
            return (DeleteOutcome.InUse, shipments, targets, expenses);

        _db.BuyCycles.Remove(cycle);
        await _db.SaveChangesAsync(ct);
        return (DeleteOutcome.Deleted, 0, 0, 0);
    }

    /// <summary>
    /// Everything wrong with a submitted cycle.
    ///
    /// The coefficients are checked for plausibility rather than against a fixed value: a
    /// markup is a multiplier near 2.7, and A VAT RATE IS A FRACTION. Somebody typing 20
    /// where 0.20 belongs multiplies every price in the cycle by a hundred — a mistake that
    /// looks unremarkable in a form and absurd only on the dashboard, weeks later. Refused
    /// rather than warned about, because there is no reading of a 2000% border rate that is
    /// true.
    /// </summary>
    public static List<string> Validate(BuyCycleInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (string.IsNullOrWhiteSpace(input.Label)) errors.Add("A label is required.");
        else if (input.Label.Trim().Length > 100) errors.Add("That label is too long.");

        if (!CustomerAdminService.TryParsePurchaseDate(input.StartDate, out var start))
            errors.Add("That start date is not a date.");
        if (!CustomerAdminService.TryParsePurchaseDate(input.EndDate, out var end))
            errors.Add("That end date is not a date.");

        if (start is not null && end is not null && end < start)
            errors.Add("The cycle ends before it starts.");

        if (input.MarkupCoefficient is decimal markup && markup <= 0m)
            errors.Add("The markup must be greater than zero.");

        if (input.BorderVatRate is decimal vat && (vat < 0m || vat >= 1m))
            errors.Add("The border VAT rate is a fraction — 0.20 for 20%, not 20.");

        return errors;
    }

    private static void Apply(BuyCycle cycle, BuyCycleInput input, string? actor)
    {
        cycle.Label = input.Label.Trim();

        // The dates are parsed with the panel's own convention — "YYYY-MM-DD" into midnight
        // UTC — by reusing the purchase parser rather than restating it. One date convention
        // per application, or "which month was this in?" starts having two answers.
        if (CustomerAdminService.TryParsePurchaseDate(input.StartDate, out var start))
            cycle.StartDate = start;
        if (CustomerAdminService.TryParsePurchaseDate(input.EndDate, out var end))
            cycle.EndDate = end;

        cycle.MarkupCoefficient = input.MarkupCoefficient;
        cycle.BorderVatRate = input.BorderVatRate;
        cycle.IsClosed = input.IsClosed;
        cycle.Notes = FactoryAdminService.Clean(input.Notes);
        cycle.UpdatedAt = DateTimeOffset.UtcNow;
        cycle.UpdatedByUpn = actor;
    }
}
