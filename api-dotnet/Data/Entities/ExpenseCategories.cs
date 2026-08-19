using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// What an operating expense can be.
//
// Served to the panel by AdminOperatingExpensesController rather than hard-coded in the SPA,
// for exactly the reason PurchaseCategories gives: two hand-maintained copies of a key list
// drift, and the failure is silent — a category typed one way here and another way there
// simply stops appearing in the rollup, with nothing to notice it.
//
// Stable keys, never display labels. The panel translates them; the database stores the key,
// so renaming "Tools & equipment" in three languages never touches a row.
//
// THIS LIST IS A PROPOSAL awaiting the owner (ROADMAP #21, open question 3). It is cheap to
// change — a key list served by the API, with no schema behind it — but not free once rows
// exist, since re-categorising is a data migration. Worth settling before the first month of
// real entry rather than after.
public static class ExpenseCategories
{
    public const string Salaries = "salaries";
    public const string Rent = "rent";
    public const string TransportFuel = "transport-fuel";
    public const string Marketing = "marketing";
    public const string Utilities = "utilities";
    public const string ToolsEquipment = "tools-equipment";
    public const string FeesTaxes = "fees-taxes";
    public const string Other = "other";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Salaries, Rent, TransportFuel, Marketing, Utilities, ToolsEquipment, FeesTaxes, Other,
    };

    // Null is valid: an expense recorded in a hurry with no category is still a real cost,
    // and refusing it would mean the amount never gets entered. It lands in the rollup's
    // "uncategorised" line, which is visible and therefore fixable.
    public static bool IsValid(string? key) => key is null || All.Contains(key);
}
