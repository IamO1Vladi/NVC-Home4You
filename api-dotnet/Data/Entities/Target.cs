using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// What we said we would do, so the dashboard has something to compare against.
//
// A number without a target is a number; the whole point of the reporting screen is
// "revenue vs plan", and this is the plan.
public class Target
{
    public int Id { get; set; }

    // Which kind of period this target is for — see PeriodTypes. Together with the three
    // nullable period columns below it says exactly one of: this month, this cycle, this
    // year.
    //
    // Three columns rather than a start/end date pair because these are the three periods
    // the business actually plans in, and a date range would let someone set a target for
    // "12 March to 4 August", which no report would ever pick up.
    [Required]
    [MaxLength(20)] public string PeriodType { get; set; } = PeriodTypes.Month;

    public int? Year { get; set; }
    public int? Month { get; set; }

    public int? BuyCycleId { get; set; }
    public BuyCycle? BuyCycle { get; set; }

    // What is being targeted — see TargetMetrics. A key rather than a column per metric, so
    // adding "units sold" next quarter is a row, not a migration.
    [Required]
    [MaxLength(60)] public string MetricKey { get; set; } = "";

    // EUR, like every other reported figure.
    public decimal TargetValue { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }

    // A UNIQUE INDEX covers (PeriodType, MetricKey, Year, Month, BuyCycleId) — see
    // AppDbContext. It is the one place in these tables where a duplicate is refused
    // outright rather than warned about, because two revenue targets for the same month
    // leaves the dashboard picking one, and there is no correct way to pick.
}
