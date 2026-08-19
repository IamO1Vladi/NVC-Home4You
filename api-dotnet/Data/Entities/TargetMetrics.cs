using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

/// <summary>
/// The three periods the business plans in. Stable keys, same convention as LeadStatuses.
///
/// Deliberately not an enum: these keys travel to the SPA and back as JSON, and an enum
/// would be serialised as an integer whose meaning lives only in this file — renumbering it
/// later silently re-points every stored row.
/// </summary>
public static class PeriodTypes
{
    public const string Month = "month";
    public const string Cycle = "cycle";
    public const string Year = "year";

    public static readonly IReadOnlyList<string> All = new[] { Month, Cycle, Year };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);
}

/// <summary>
/// What can be targeted.
///
/// A key list rather than a column per metric on Target: adding "units sold" next quarter
/// should be a row someone types, not a migration someone deploys.
///
/// Also a PROPOSAL pending the owner (ROADMAP #21). Unlike ExpenseCategories this one is
/// nearly free to change later — a target is a plan, so a metric nobody used has no history
/// to re-categorise.
/// </summary>
public static class TargetMetrics
{
    public const string Revenue = "revenue";
    public const string GrossMargin = "gross-margin";
    public const string NetResult = "net-result";
    public const string OpexCap = "opex-cap";
    public const string UnitsSold = "units-sold";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Revenue, GrossMargin, NetResult, OpexCap, UnitsSold,
    };

    // Required here, unlike an expense category: a target with no metric is not an
    // incomplete record, it is an uninterpretable one — there is no dashboard line for it to
    // land in.
    public static bool IsValid(string? key) => key is not null && All.Contains(key);
}
