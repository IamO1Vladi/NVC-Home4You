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
// so renaming a label in three languages never touches a row.
//
// THIS IS THE LIVE LIST, NOT A PROPOSAL. The first draft of this file invented eight
// plausible categories; the owner's answer to ROADMAP #21 question 3 (2026-08-19) was, in
// effect, "use ours" — and the Quickbase Operating Expenses table (bvuz3p5hs, 81 records)
// holds the real one as a multiple-choice field. These keys are that list, one per choice,
// so the importer maps 1:1 and no historical row lands in "other" because our taxonomy was
// tidier than the business.
//
// The three names are deliberate categories, not a modelling accident: ВЛАДИ, ЦЕЦО and НИКИ
// are how the firm tracks money its three people take out. A generic "owner draw" bucket
// would collapse the one distinction those rows exist to record.
public static class ExpenseCategories
{
    public const string SiteHosting = "site-hosting";          // Сайт hosting
    public const string Microsoft365 = "microsoft-365";        // Microsoft 365
    public const string Warehouse = "warehouse";               // Склад
    public const string SampleRent = "sample-rent";            // Мостра наем
    public const string Printing = "printing";                 // Принтиране
    public const string Travel = "travel";                     // Пътуване
    public const string Ads = "ads";                           // Реклама
    public const string CompanyPhone = "company-phone";        // Служебен телефон
    public const string Accountant = "accountant";             // Счетоводител
    public const string Bank = "bank";                         // Банка
    public const string UnloadingCrew = "unloading-crew";      // Разтоварване и неща за работниците
    public const string Notary = "notary";                     // нотариус
    public const string Materials = "materials";               // Материали
    public const string PackageFee = "package-fee";            // Такса по пакетна програма
    public const string Crane = "crane";                       // Кран
    public const string WorkSoftware = "work-software";        // Нужни програми за работа
    public const string ClaudeAi = "claude-ai";                // Claude AI
    public const string Vat = "vat";                           // ДДС
    public const string SocialSecurity = "social-security";    // Осигуровки

    // The personal draws — see the class comment.
    public const string DrawVladi = "draw-vladi";              // Влади
    public const string DrawCeco = "draw-ceco";                // Цецо
    public const string DrawNiki = "draw-niki";                // Ники

    // Not in Quickbase, kept as the escape hatch: a real cost with no category still
    // deserves a row, and the rollup shows it under its own visible line.
    public const string Other = "other";

    public static readonly IReadOnlyList<string> All = new[]
    {
        SiteHosting, Microsoft365, Warehouse, SampleRent, Printing, Travel, Ads,
        CompanyPhone, Accountant, Bank, UnloadingCrew, Notary, Materials, PackageFee,
        Crane, WorkSoftware, ClaudeAi, Vat, SocialSecurity,
        DrawVladi, DrawCeco, DrawNiki,
        Other,
    };

    /// <summary>
    /// The Quickbase choice string for each key, for the importer — the mapping is here,
    /// next to the keys, so adding a category means touching one file.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> QuickbaseLabels =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [SiteHosting] = "Сайт hosting",
            [Microsoft365] = "Microsoft 365",
            [Warehouse] = "Склад",
            [SampleRent] = "Мостра наем",
            [Printing] = "Принтиране",
            [Travel] = "Пътуване",
            [Ads] = "Реклама",
            [CompanyPhone] = "Служебен телефон",
            [Accountant] = "Счетоводител",
            [Bank] = "Банка",
            [UnloadingCrew] = "Разтоварване и неща за работниците",
            [Notary] = "нотариус",
            [Materials] = "Материали",
            [PackageFee] = "Такса по пакетна програма",
            [Crane] = "Кран",
            [WorkSoftware] = "Нужни програми за работа",
            [ClaudeAi] = "Claude AI",
            [Vat] = "ДДС",
            [SocialSecurity] = "Осигуровки",
            [DrawVladi] = "Влади",
            [DrawCeco] = "Цецо",
            [DrawNiki] = "Ники",
        };

    /// <summary>The key for a Quickbase choice string, or null when it matches nothing.</summary>
    public static string? FromQuickbaseLabel(string? label)
    {
        var trimmed = (label ?? "").Trim();
        if (trimmed.Length == 0) return null;

        return QuickbaseLabels
            .FirstOrDefault(p => string.Equals(p.Value, trimmed, StringComparison.OrdinalIgnoreCase))
            .Key;
    }

    // Null is valid: an expense recorded in a hurry with no category is still a real cost,
    // and refusing it would mean the amount never gets entered. It lands in the rollup's
    // "uncategorised" line, which is visible and therefore fixable.
    public static bool IsValid(string? key) => key is null || All.Contains(key);
}
