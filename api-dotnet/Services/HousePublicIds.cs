namespace Services;

/// <summary>
/// The id a house goes by in public: /api/gallery's `id`, an offer's ModelId, the prices
/// page's assembly table and anchors, the product JSON-LD sku, React keys. Everything inside
/// the database — Lead.HouseId, Purchase.HouseId, the admin panel, blob keys — uses the SQL
/// House.Id instead and never sees this number.
///
/// Two kinds of house share the catalogue, and their native ids overlap:
///
/// - Imported from Quickbase: served under the Quickbase record id, as they always were.
///   Stored enquiries and the assembly table (prices.js) hold those numbers, so they never
///   change.
/// - Created in the admin panel: no Quickbase id, so served as AdminOffset + SQL id.
///
/// The offset is #35. Before it, admin-created houses were served under their bare SQL id,
/// on the belief that SQL ids would start above anything Quickbase had issued. They did
/// not: the import gave the fourteen Quickbase houses SQL ids 1–14 while their Quickbase
/// ids ran 4–17, so the first house made in the panel (SQL 15, the Space house) went live
/// as "15" beside the imported 73 m² house that already was — and SQL 16 and 17 would have
/// collided too. Enquiries from that era can still carry a bare SQL id; LeadService reads
/// them.
///
/// Disjoint by construction: SQL ids are positive, so admin ids are all above AdminOffset,
/// and every Quickbase id is below it. GalleryImportService — the only code that writes
/// House.QuickbaseRecordId — refuses a run that would break that.
/// </summary>
public static class HousePublicIds
{
    // A hundred thousand: Quickbase issued 17 gallery record ids in the table's whole life
    // and is retired, and six digits still read back over the phone.
    public const long AdminOffset = 100_000;

    public static long For(long? quickbaseRecordId, int id) => quickbaseRecordId ?? AdminOffset + id;

    /// <summary>Whether a Quickbase record id can be served without entering the admin range.</summary>
    public static bool FitsQuickbaseRange(long quickbaseRecordId) => quickbaseRecordId < AdminOffset;

    /// <summary>
    /// The SQL id of the admin-created house a public id names, or null when the number is
    /// not in the admin range. Checked rather than cast: an unchecked long-to-int cast wraps,
    /// and a wrapped value can land on a real, unrelated house.
    /// </summary>
    public static int? AdminHouseId(long publicId)
    {
        if (publicId <= AdminOffset) return null;
        var id = publicId - AdminOffset;
        return id <= int.MaxValue ? (int)id : null;
    }
}
