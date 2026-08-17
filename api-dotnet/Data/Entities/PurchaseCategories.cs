using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// What a customer can have bought.
//
// A superset of HouseCategories, because the gallery's four filters are not the full list of
// what the company sells. Leads already hit this — the imported enquiry mix contains
// "Контейнер", "Logistics" and "Interiors" — and a purchase hits it harder, since materials
// orders are a real and frequent line of business that no gallery filter will ever cover.
//
// Served to the panel by AdminCustomersController rather than hard-coded in the SPA, for the
// same reason the gallery serves its own: two hand-maintained copies of a key list drift,
// and the failure is silent.
public static class PurchaseCategories
{
    public static readonly IReadOnlyList<string> All = new[]
    {
        HouseCategories.Prefab,
        HouseCategories.Wagon,
        HouseCategories.Modular,
        HouseCategories.Garage,
        "container",
        "interiors",
        "logistics",
        "materials",
        "other",
    };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);

    /// <summary>
    /// The categories where picking a model out of the catalogue makes sense.
    ///
    /// MODULAR IS DELIBERATELY ABSENT, and it is the only entry here that needs explaining.
    /// The gallery lists modular houses and a modular LEAD can be linked to one, because at
    /// enquiry time a customer is pointing at a picture. What actually gets built and sold is
    /// a custom project every time — so a modular purchase carries a written description in
    /// CustomModel, not a foreign key to a catalogue row it does not match.
    ///
    /// Confirmed as the business rule 2026-08-14. If modular houses ever start shipping to
    /// catalogue spec, adding the key back here is the whole change.
    /// </summary>
    public static readonly IReadOnlyList<string> WithGalleryModels = new[]
    {
        HouseCategories.Prefab,
        HouseCategories.Wagon,
        HouseCategories.Garage,
    };

    public static bool AllowsGalleryModel(string? key) =>
        key is not null && WithGalleryModels.Contains(key);

    /// <summary>
    /// Categories whose sales are NOT tracked through a deposit and a final invoice.
    ///
    /// Wagons are paid in one go, so the payment block is noise on that form — five boxes
    /// nobody fills in, on the category that produces the most rows. The panel hides them;
    /// the schema still allows them, because a wagon that did take a deposit is a real thing
    /// that would otherwise be unrecordable, and a column that refuses real data is worse
    /// than a form that has to be nudged.
    /// </summary>
    public static bool TracksStagedPayment(string? key) =>
        !string.Equals(key, HouseCategories.Wagon, StringComparison.OrdinalIgnoreCase);
}
