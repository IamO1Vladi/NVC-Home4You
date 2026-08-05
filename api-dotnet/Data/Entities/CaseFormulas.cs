using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// The Quickbase formula fields, reimplemented over the SQL columns.
//
// Quickbase recalculated these on every read, so they could never disagree with the row they
// came from. Storing them in SQL would break that: editing City or Publish in the admin panel
// would leave the stored label behind, and nothing would notice. Computing them keeps the
// single-source property that made them safe in the first place.
//
// Definitions recovered from CasesPageService, which is the behaviour currently on the live
// site — so the SQL read path reproduces the page exactly rather than approximating it.
public static class CaseFormulas
{
    // Quickbase "Public Visibility Status" values that mean visible.
    private static readonly string[] VisibleStatuses = { "public", "published", "visible", "show" };

    /// <summary>
    /// Quickbase "Is Public" (29). In SQL this is just IsPublished, because the other two
    /// inputs to the original chain — Is Public (29) and Public Visibility Status (28) —
    /// were themselves formulas with no independent storage.
    ///
    /// The IMPORTER is what must apply the full chain (see IsPublicDuringImport), so a case
    /// that was public only by virtue of its visibility status does not silently disappear.
    /// </summary>
    public static bool IsPublic(Case c) => c.IsPublished;

    /// <summary>
    /// The original Quickbase chain, for import only: Publish OR Is Public OR a visibility
    /// status that means visible. Collapses three Quickbase fields into the one SQL column.
    /// </summary>
    public static bool IsPublicDuringImport(bool publish, bool isPublicFlag, string? visibilityStatus)
    {
        if (publish || isPublicFlag) return true;

        var status = (visibilityStatus ?? "").Trim();
        return VisibleStatuses.Any(s => status.Equals(s, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Quickbase "Public Location Label" (15): the stored label if there was one, otherwise
    /// "City, Country". In SQL the stored label is gone, so it is always composed — which is
    /// what the live fallback already did whenever the formula field was empty.
    /// </summary>
    public static string? PublicLocationLabel(Case c) => JoinNonEmpty(", ", c.City, c.Country);

    /// <summary>
    /// Quickbase "Public Buyer Label" (30), as consumed by the page: the buyer's name, else
    /// the public label, else the company name. The middle term was itself the formula, so in
    /// SQL it reduces to buyer name, else company name.
    ///
    /// Never empty in practice: a case always has a company name or a buyer name, and showing
    /// an unattributed quote would be worse than showing the company.
    /// </summary>
    public static string? PublicBuyerLabel(Case c) => FirstNonEmpty(c.BuyerName, c.CompanyName);

    /// <summary>
    /// A case with no company name is a private individual. The live page suppresses the
    /// sector, the buyer's role and the company logo for those, so that someone's employer is
    /// never inferred from a personal purchase. Kept identical here.
    /// </summary>
    public static bool HasCompany(Case c) => !string.IsNullOrWhiteSpace(c.CompanyName);

    /// <summary>Product name and variant joined the way the page shows them.</summary>
    public static string? ProductLabel(Case c) => JoinNonEmpty(" ", c.ProductName, c.ProductVariant);

    /// <summary>
    /// Year shown on the page: the explicit Year, else the year of Delivered At.
    /// </summary>
    public static string? YearLabel(Case c)
    {
        if (c.Year is > 0) return c.Year.Value.ToString();
        return c.DeliveredAt?.Year.ToString();
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

    private static string? JoinNonEmpty(string separator, params string?[] values)
    {
        var parts = values
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v!.Trim())
            .ToArray();

        return parts.Length == 0 ? null : string.Join(separator, parts);
    }
}
