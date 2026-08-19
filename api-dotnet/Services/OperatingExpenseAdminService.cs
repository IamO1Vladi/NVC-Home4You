using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>What the panel sends when recording an operating expense.</summary>
public sealed class OperatingExpenseInput
{
    public string? SpentAt { get; set; }
    public int? BuyCycleId { get; set; }
    public string? CategoryKey { get; set; }
    public decimal Amount { get; set; }
    public decimal? VatAmount { get; set; }
    public string? Description { get; set; }
    public string? Notes { get; set; }
}

/// <summary>An expense as the panel sees it. Every amount EUR — see OperatingExpense.</summary>
public sealed record OperatingExpenseDto(
    int Id,
    string SpentAt,
    int? BuyCycleId,
    string? BuyCycleLabel,
    string? CategoryKey,
    decimal Amount,
    decimal? VatAmount,
    string? Description,
    string? SubmittedByUpn,
    string? Notes,
    string? UpdatedAt,
    string? UpdatedByUpn);

/// <summary>
/// One line of the rollup: a category, or a month, and what it came to.
///
/// Count travels with the total because an average matters when reading it — €40,000 of
/// salaries across two rows and across two hundred are different stories, and only one of
/// them suggests somebody has been entering payroll one person at a time.
/// </summary>
public sealed record ExpenseRollupRow(string Key, decimal Total, int Count);

// Operating expenses: the non-container half of what the business spends.
public sealed class OperatingExpenseAdminService
{
    private readonly AppDbContext _db;

    public OperatingExpenseAdminService(AppDbContext db) => _db = db;

    /// <summary>
    /// Expenses in a window, most recent first.
    ///
    /// The window is INCLUSIVE OF ITS LAST DAY, which is why `to` is compared against the
    /// next midnight rather than against itself: SpentAt is stored at midnight UTC, so
    /// `SpentAt &lt;= to` would silently drop everything dated on the closing day — the last
    /// day of the month, on a monthly report.
    /// </summary>
    public async Task<List<OperatingExpenseDto>> ListAsync(
        DateTimeOffset? from, DateTimeOffset? to, string? categoryKey, CancellationToken ct)
    {
        var query = _db.OperatingExpenses.AsNoTracking().AsQueryable();

        if (from is DateTimeOffset start) query = query.Where(x => x.SpentAt >= start);
        if (to is DateTimeOffset end) query = query.Where(x => x.SpentAt < end.AddDays(1));
        if (!string.IsNullOrWhiteSpace(categoryKey))
            query = query.Where(x => x.CategoryKey == categoryKey);

        return await query
            .OrderByDescending(x => x.SpentAt)
            .ThenByDescending(x => x.Id)
            .Select(x => new OperatingExpenseDto(
                x.Id,
                x.SpentAt.ToString("yyyy-MM-dd"),
                x.BuyCycleId,
                x.BuyCycle == null ? null : x.BuyCycle.Label,
                x.CategoryKey, x.Amount, x.VatAmount, x.Description,
                x.SubmittedByUpn, x.Notes,
                x.UpdatedAt == null ? null : x.UpdatedAt!.Value.ToString("o"),
                x.UpdatedByUpn))
            .ToListAsync(ct);
    }

    public async Task<OperatingExpenseDto?> GetAsync(int id, CancellationToken ct) =>
        await _db.OperatingExpenses
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new OperatingExpenseDto(
                x.Id,
                x.SpentAt.ToString("yyyy-MM-dd"),
                x.BuyCycleId,
                x.BuyCycle == null ? null : x.BuyCycle.Label,
                x.CategoryKey, x.Amount, x.VatAmount, x.Description,
                x.SubmittedByUpn, x.Notes,
                x.UpdatedAt == null ? null : x.UpdatedAt!.Value.ToString("o"),
                x.UpdatedByUpn))
            .FirstOrDefaultAsync(ct);

    /// <summary>
    /// Totals by category over a window.
    ///
    /// Uncategorised rows are reported under their own key rather than dropped, so the parts
    /// always add up to the whole. A breakdown that silently omits a category is how a
    /// month's costs come out lower than they were.
    /// </summary>
    public async Task<List<ExpenseRollupRow>> ByCategoryAsync(
        DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct)
    {
        var query = _db.OperatingExpenses.AsNoTracking().AsQueryable();
        if (from is DateTimeOffset start) query = query.Where(x => x.SpentAt >= start);
        if (to is DateTimeOffset end) query = query.Where(x => x.SpentAt < end.AddDays(1));

        var rows = await query
            .GroupBy(x => x.CategoryKey)
            .Select(g => new { Key = g.Key, Total = g.Sum(x => x.Amount), Count = g.Count() })
            .ToListAsync(ct);

        return rows
            .Select(r => new ExpenseRollupRow(r.Key ?? "uncategorised", r.Total, r.Count))
            .OrderByDescending(r => r.Total)
            .ToList();
    }

    /// <summary>Totals by calendar month ("2026-08"), oldest first — the shape a chart wants.</summary>
    public async Task<List<ExpenseRollupRow>> ByMonthAsync(
        DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct)
    {
        var query = _db.OperatingExpenses.AsNoTracking().AsQueryable();
        if (from is DateTimeOffset start) query = query.Where(x => x.SpentAt >= start);
        if (to is DateTimeOffset end) query = query.Where(x => x.SpentAt < end.AddDays(1));

        var rows = await query
            .GroupBy(x => new { x.SpentAt.Year, x.SpentAt.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Total = g.Sum(x => x.Amount),
                Count = g.Count(),
            })
            .ToListAsync(ct);

        return rows
            .OrderBy(r => r.Year).ThenBy(r => r.Month)
            .Select(r => new ExpenseRollupRow($"{r.Year:D4}-{r.Month:D2}", r.Total, r.Count))
            .ToList();
    }

    public async Task<OperatingExpenseDto> CreateAsync(
        OperatingExpenseInput input, string? actor, CancellationToken ct)
    {
        var expense = new OperatingExpense { CreatedAt = DateTimeOffset.UtcNow };
        Apply(expense, input, actor);

        // Attribution is stamped once, at creation, and never rewritten by a later edit:
        // "who submitted this" is a different question from "who last touched it", and
        // UpdatedByUpn already answers the second.
        expense.SubmittedByUpn = actor;

        _db.OperatingExpenses.Add(expense);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(expense.Id, ct))!;
    }

    public async Task<OperatingExpenseDto?> UpdateAsync(
        int id, OperatingExpenseInput input, string? actor, CancellationToken ct)
    {
        var expense = await _db.OperatingExpenses.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (expense is null) return null;

        Apply(expense, input, actor);
        await _db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Deletes an expense outright — no soft-retire and nothing refuses it.
    ///
    /// Unlike a factory or a model, nothing points at an expense, so there is no history to
    /// orphan. It is deliberately the plain delete a mistyped row deserves; the audit log
    /// records that it happened and what it was.
    /// </summary>
    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var expense = await _db.OperatingExpenses.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (expense is null) return false;

        _db.OperatingExpenses.Remove(expense);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public static List<string> Validate(OperatingExpenseInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (string.IsNullOrWhiteSpace(input.SpentAt))
            errors.Add("A date is required.");
        else if (!CustomerAdminService.TryParsePurchaseDate(input.SpentAt, out _))
            errors.Add("That date is not a date.");

        // Zero is refused along with negatives: an expense of nothing is a row somebody
        // abandoned halfway, and it would sit in the rollup adding a count but no money.
        if (input.Amount <= 0m) errors.Add("The amount must be greater than zero.");

        if (input.VatAmount is decimal vat)
        {
            if (vat < 0m) errors.Add("The VAT cannot be negative.");

            // VAT larger than the amount it is part of is always a mistake — usually the
            // gross typed into the VAT box. Worth refusing, because it survives into the
            // reclaim figure otherwise.
            else if (vat > input.Amount) errors.Add("The VAT is larger than the amount.");
        }

        if (!ExpenseCategories.IsValid(input.CategoryKey))
            errors.Add("That is not an expense category.");

        return errors;
    }

    private static void Apply(OperatingExpense expense, OperatingExpenseInput input, string? actor)
    {
        if (CustomerAdminService.TryParsePurchaseDate(input.SpentAt, out var spentAt) && spentAt is not null)
            expense.SpentAt = spentAt.Value;

        expense.BuyCycleId = input.BuyCycleId;
        expense.CategoryKey = FactoryAdminService.Clean(input.CategoryKey);
        expense.Amount = input.Amount;
        expense.VatAmount = input.VatAmount;
        expense.Description = FactoryAdminService.Clean(input.Description);
        expense.Notes = FactoryAdminService.Clean(input.Notes);
        expense.UpdatedAt = DateTimeOffset.UtcNow;
        expense.UpdatedByUpn = actor;
    }
}
