using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// The sales ladder a lead climbs, as stable keys.
//
// Same reasoning as HouseCategories: these are not free text. The admin panel groups the
// pipeline by exactly this set, so a value outside it makes a lead invisible in every
// column — it doesn't error, it just stops being anywhere. Quickbase never modelled this
// at all (sales tracked it in their heads and in two checkboxes), so nothing enforces it
// but us.
//
// Won and Lost are both terminal, and deliberately distinct rather than one "Closed" with
// a boolean: "why did we lose it" is the question worth being able to ask later.
public static class LeadStatuses
{
    public const string New = "new";
    public const string Contacted = "contacted";
    public const string Quoted = "quoted";
    public const string Negotiating = "negotiating";
    public const string Won = "won";
    public const string Lost = "lost";

    // Ordered as the pipeline runs, because the admin panel renders them in this order and
    // deriving that from a set would mean re-stating it somewhere else.
    public static readonly IReadOnlyList<string> All = new[]
    {
        New, Contacted, Quoted, Negotiating, Won, Lost,
    };

    // Nothing follows Won or Lost. Reopening is a deliberate act, not a step.
    public static readonly IReadOnlyList<string> Open = new[]
    {
        New, Contacted, Quoted, Negotiating,
    };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);

    public static bool IsOpen(string? key) => key is not null && Open.Contains(key);
}
