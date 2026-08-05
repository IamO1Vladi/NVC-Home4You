using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// The Category Key values the cases table uses (Quickbase field 16).
//
// Unlike the gallery's category this is advisory rather than structural: the cases page
// groups on it, so an unrecognised value degrades to "ungrouped" instead of making the row
// unreachable. It is still worth constraining in the admin panel, because a typo silently
// moves a case out of its group.
public static class CaseCategories
{
    public const string ModularBuilds = "Modular builds";
    public const string ModularHouses = "Modular houses";
    public const string SteelHouses = "Steel houses";
    public const string Interiors = "Interiors";
    public const string Delivery = "Delivery";
    public const string Logistics = "Logistics";
    public const string Other = "Other";

    public static readonly IReadOnlyList<string> All = new[]
    {
        ModularBuilds, ModularHouses, SteelHouses, Interiors, Delivery, Logistics, Other,
    };

    // The live table also contains "modularBuilds" — camelCase, alongside the spaced
    // "Modular builds". Almost certainly a legacy value from before the choice list settled,
    // and the two group separately today, which is a real (if small) bug on the page.
    //
    // Normalised on import rather than left alone: after Quickbase is retired nobody will be
    // able to see the choice list that explains where it came from. Recorded here rather than
    // silently mapped so the decision stays visible.
    private static readonly Dictionary<string, string> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["modularBuilds"] = ModularBuilds,
        ["modularHouses"] = ModularHouses,
        ["steelHouses"] = SteelHouses,
    };

    public static bool IsKnown(string? key) =>
        key is not null && All.Contains(key, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Canonicalises a stored category. Unknown values are returned trimmed rather than
    /// dropped — losing a case's category on import would be worse than keeping an odd one,
    /// and the importer reports them so they can be cleaned up deliberately.
    /// </summary>
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var value = raw.Trim();
        if (Aliases.TryGetValue(value, out var canonical)) return canonical;

        // Match case-insensitively but return the canonical casing.
        var known = All.FirstOrDefault(k => k.Equals(value, StringComparison.OrdinalIgnoreCase));
        return known ?? value;
    }
}
