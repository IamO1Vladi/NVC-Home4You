namespace Services;

/// <summary>
/// The id a case goes by in public: /api/cases-page's case `id`, and the `id` of each client
/// derived from a case. The cases page uses both only as React keys. Everything inside the
/// database — the admin panel's case editor, blob keys — uses the SQL Case.Id.
///
/// The same scheme as HousePublicIds, for the same reason. Imported cases are served under
/// their Quickbase record id; cases created in the admin panel have none and are served as
/// AdminOffset + SQL id. Before this they were served under their bare SQL id. The import
/// numbers cases 1, 2, 3… in Quickbase's sort order whatever their Quickbase ids are, so a
/// panel case's SQL id can be an imported case's Quickbase id — the collision #35 found
/// live on the gallery.
///
/// Disjoint by construction: SQL ids are positive, so admin ids are all above AdminOffset,
/// and every Quickbase id is below it. CasesImportService — the only code that writes
/// Case.QuickbaseRecordId — refuses a run that would break that.
/// </summary>
public static class CasePublicIds
{
    // The houses' offset, so one rule reads across the site: below it a public id is a
    // Quickbase record id, above it something made in the admin panel.
    public const long AdminOffset = HousePublicIds.AdminOffset;

    public static string For(long? quickbaseRecordId, int id) => (quickbaseRecordId ?? AdminOffset + id).ToString();

    /// <summary>Whether a Quickbase record id can be served without entering the admin range.</summary>
    public static bool FitsQuickbaseRange(long quickbaseRecordId) => quickbaseRecordId < AdminOffset;
}
