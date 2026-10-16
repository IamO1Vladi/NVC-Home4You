using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// The five categories the gallery filter understands, as stable keys.
//
// These are not free text. galleryUtils.js filters on exactly this set (FILTER_IDS), so a
// value outside it makes a house unreachable through every filter on the page — the failure
// is silent and looks like the house simply vanished. Quickbase enforced it with a
// multiple-choice field; in SQL nothing enforces it, so the admin panel has to.
//
// Two of them changed meaning or arrived on 2026-10-17, at the owner's request for two new
// gallery sections:
//
// - Capsule is new: the space capsule, which until then was filed under modular because there
//   was nowhere else to put it. It is sold like a Box house (same delivery, crane, lead time
//   and warranty) but arrives ready, with no assembly — so it gets its own section rather
//   than standing among the Box houses. Staff move it into this key in the admin panel; the
//   release itself changes no rows.
// - Prefab is the existing key, now holding the steel-frame projects already built: a
//   customer points at one and asks for something similar. Every steel house is its own
//   project and priced per project, so a prefab row's price is what THAT build cost, never a
//   standard price for the model (see LeadDraftContext, which tells the AI drafter so).
//
// The Bulgarian labels are what Quickbase stored and what the importer maps from. They are
// presentation only from here on: the frontend owns the BG/EN labels and resolves a key
// directly, so translating a label can never again change which houses are filterable.
public static class HouseCategories
{
    public const string Prefab = "prefab";
    public const string Wagon = "wagon";
    public const string Modular = "modular";
    public const string Capsule = "capsule";
    public const string Garage = "garage";

    // The order is the admin panel's dropdown order (AdminGalleryController.Categories).
    public static readonly IReadOnlyList<string> All = new[] { Prefab, Wagon, Modular, Capsule, Garage };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);

    // Quickbase's stored label -> key. English labels are included because galleryUtils.js
    // accepts either, so the live data may contain either. Quickbase never held a capsule
    // (it was made in the admin panel), so its two labels are the site's own names for the
    // category, for an import or a CRM interest that spells it out.
    private static readonly Dictionary<string, string> ByLabel = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Сглобяема къща"] = Prefab,
        ["Prefab house"] = Prefab,
        ["Фургон"] = Wagon,
        ["Wagon / site cabin"] = Wagon,
        ["Модулна къща"] = Modular,
        ["Modular house"] = Modular,
        ["Космическа капсула"] = Capsule,
        ["Space capsule"] = Capsule,
        ["Гараж"] = Garage,
        ["Garage"] = Garage,
    };

    /// <summary>
    /// Resolves a Quickbase category value to a key, or null if it is not one we recognise.
    ///
    /// Null rather than a guess on purpose: the importer reports unmapped values instead of
    /// quietly filing them under something plausible, because a wrong category is invisible
    /// on the page — the house just stops appearing under its filter.
    /// </summary>
    public static string? FromQuickbaseLabel(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var value = raw.Trim();
        if (IsValid(value)) return value;                      // already a key
        return ByLabel.TryGetValue(value, out var key) ? key : null;
    }
}
