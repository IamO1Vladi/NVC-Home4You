using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <summary>
    /// Unlinks the purchases whose category stopped being able to carry a catalogue model,
    /// keeping what they said in words.
    ///
    /// Nothing about the schema changed, which is why EF generated this empty. What changed
    /// is PurchaseCategories.WithGalleryModels: modular joined it and prefab and garage came
    /// off it, because the list is meant to track which categories the gallery actually holds
    /// models under and on 2026-08-21 those two held none.
    ///
    /// ADDING A KEY IS FREE. REMOVING ONE IS NOT, and this migration is the difference.
    /// ValidatePurchase refuses any purchase carrying a HouseId under a category that is not
    /// on the list, and AdminCustomersController runs it over EVERY purchase in a submission
    /// before a single column is written. A row filed as prefab or garage with a model
    /// attached — perfectly legal to save until this release, and reachable for any house
    /// recategorised in the gallery after the sale was recorded — would therefore refuse
    /// every future save of the customer holding it. Not the purchase: the customer. Their
    /// phone number, their address, their notes and all their other purchases, frozen behind
    /// a 400 about a box nobody opened, on a screen with no way to act on it.
    ///
    /// So the link is converted rather than left to detonate. The house's title moves into
    /// CustomModel, which is the column that exists for exactly this — "a custom build, a
    /// materials order, two wagons joined" — and the foreign key is cleared. A purchase that
    /// already carried its own description keeps it: what somebody wrote about this sale
    /// outranks a title copied off a catalogue row, and the row it pointed at is by
    /// definition no longer filed under the category the purchase claims.
    ///
    /// The category list is written out here rather than read from PurchaseCategories, which
    /// is right for a migration and wrong anywhere else: this statement has to keep meaning
    /// what it meant on the day it was written, however the constant moves afterwards. The
    /// next removal from that list needs its own migration, not an edit to this one.
    ///
    /// A no-op on a database that has no such rows, which is the expected case and the reason
    /// this is safe to ship without knowing the answer in advance.
    /// </summary>
    public partial class BackfillPurchaseModelLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE p
                SET p.[CustomModel] =
                        COALESCE(NULLIF(LTRIM(RTRIM(p.[CustomModel])), ''), h.[Title]),
                    p.[HouseId] = NULL
                FROM [Purchases] p
                INNER JOIN [Houses] h ON h.[Id] = p.[HouseId]
                WHERE p.[HouseId] IS NOT NULL
                  AND (p.[CategoryKey] IS NULL
                       OR p.[CategoryKey] NOT IN ('wagon', 'modular'));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Deliberately empty, and the emptiness is the honest answer rather than an
            // omission. Up destroys the only record of which catalogue row each purchase
            // pointed at — that is the whole point of it — so there is nothing left to read
            // the foreign keys back out of. Matching CustomModel against Houses.Title to
            // guess them would relink purchases that never had a model in the first place,
            // any time somebody had typed a house's name into the free-text box by hand.
            //
            // Rolling back leaves those purchases describing what was bought in words, which
            // is a state the old code reads perfectly well: it is what every modular purchase
            // looked like before this release. Nothing is stranded and nothing errors. The
            // link simply does not come back, and re-establishing one is a person choosing
            // the model again on a screen that shows them what they are choosing.
        }
    }
}
