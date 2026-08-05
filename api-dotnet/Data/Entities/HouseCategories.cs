using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// The four categories the gallery filter understands, as stable keys.
//
// These are not free text. galleryUtils.js filters on exactly this set (FILTER_IDS), so a
// value outside it makes a house unreachable through every filter on the page — the failure
// is silent and looks like the house simply vanished. Quickbase enforced it with a
// multiple-choice field; in SQL nothing enforces it, so the admin panel has to.
//
// The Bulgarian labels are what Quickbase stored and what the importer maps from. They are
// presentation only from here on: the frontend owns the BG/EN labels and resolves a key
// directly, so translating a label can never again change which houses are filterable.
public static class HouseCategories
{
    public const string Prefab = "prefab";
    public const string Wagon = "wagon";
    public const string Modular = "modular";
    public const string Garage = "garage";

    public static readonly IReadOnlyList<string> All = new[] { Prefab, Wagon, Modular, Garage };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);

    // Quickbase's stored label -> key. English labels are included because galleryUtils.js
    // accepts either, so the live data may contain either.
    private static readonly Dictionary<string, string> ByLabel = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Сглобяема къща"] = Prefab,
        ["Prefab house"] = Prefab,
        ["Фургон"] = Wagon,
        ["Wagon / site cabin"] = Wagon,
        ["Модулна къща"] = Modular,
        ["Modular house"] = Modular,
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
