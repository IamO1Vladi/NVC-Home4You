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
    /// THIS LIST TRACKS THE CATALOGUE, not the vocabulary. The tempting reading is to ask
    /// which of the four gallery keys sound like a building somebody could point at — and it
    /// is the wrong question, because the dropdown is filled from the gallery and an empty
    /// dropdown helps nobody. The checkable question is "does the gallery hold models filed
    /// under this key?", and counted against the live gallery on 2026-08-21 the answer was:
    /// modular 8, wagon 6, prefab 0, garage 0. So the picker follows the models — wagon and
    /// modular offer one, prefab and garage are typed by hand until there is something to
    /// offer.
    ///
    /// Modular's earlier absence was the other reading, and it cost the category the catalogue
    /// carries most of: the purchases screen filtered its eight modular houses out of the
    /// picker, so a modular purchase could not be linked to one at all, and an API caller who
    /// tried was refused with "a modular house is a custom build". Not silent — a hard no to a
    /// link the catalogue plainly supports.
    ///
    /// WHICH IS THE COST OF BEING WRONG IN EITHER DIRECTION, and it is not symmetric. Adding a
    /// key only ever permits something. REMOVING one refuses every save of a customer who
    /// already has a purchase filed under it with a model attached, including saves that are
    /// about their phone number — see ValidatePurchase, which runs over every purchase in the
    /// submission before anything is written. Prefab and garage came off this list in the same
    /// change that added modular, and BackfillPurchaseModelLinks is what made that safe.
    ///
    /// Confirmed with the owner 2026-08-21, superseding the 2026-08-14 rule that read modular
    /// as always-custom. If the catalogue ever grows prefab or garage models, adding the key
    /// back here is the whole change; taking one off needs the stored rows dealt with first.
    /// </summary>
    public static readonly IReadOnlyList<string> WithGalleryModels = new[]
    {
        HouseCategories.Wagon,
        HouseCategories.Modular,
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
