using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <summary>
    /// Gives the purchases that predate order tracking the two values their columns were
    /// always supposed to hold.
    ///
    /// MergeSalesIntoPurchasesAndTrackOrders added Quantity and Status to a table that
    /// already had rows in it, and a NOT NULL column added to a populated table has to be
    /// given a default: Quantity landed as 0 and Status as ''. Neither is a value the
    /// application can produce or read. Quantity is what FinalPrice is divided by for a
    /// unit price and is now refused below one on save, so a legacy row answers a save of
    /// the customer's phone number with a validation error about a count nobody typed —
    /// the whole sheet blocked by a column no screen could reach. Status is matched against
    /// OrderStatuses.Timeline to draw the customer's tracking page, and '' matches nothing,
    /// so those orders render as a timeline with no step reached.
    ///
    /// One is what Apply used to write on the first save of any such row, back when it
    /// clamped rather than left the count alone, so it is the value those rows were already
    /// heading for. 'placed' is the entity default and the honest reading of an order that
    /// exists and has never been moved.
    ///
    /// NO OrderStatusEvent is written for them, deliberately, and for the reason already
    /// recorded on that entity: a history row needs a date somebody actually observed, and
    /// inventing one from CreatedAt would put a moment in front of a customer that never
    /// happened. Their timelines show the step and no date, which is true.
    /// </summary>
    public partial class BackfillPurchaseQuantityAndStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE [Purchases] SET [Quantity] = 1 WHERE [Quantity] <= 0;");
            migrationBuilder.Sql(
                "UPDATE [Purchases] SET [Status] = 'placed' WHERE [Status] = '' OR [Status] IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Nothing to reverse, and that is not an omission. Down would have to know which
            // rows held the defaults before this ran, and putting a 0 and an '' back would
            // recreate a state no code path in this application can cope with.
        }
    }
}
