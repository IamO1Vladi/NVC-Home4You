using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <summary>
    /// Sale loses its container-line link (2026-08-19).
    ///
    /// The buy side was archived — see _archive/billing-2026-08-19/ — and the owner kept
    /// Sale for customer sales alone. SAFE TO APPLY: it touches only the Sales table, and
    /// the 30 imported rows keep their date, quantity, price and their Quickbase customer
    /// name in Notes. The billing TABLES are left standing by this migration on purpose;
    /// DropBillingTables is the one that removes them, and it is deliberately separate.
    /// </summary>
    public partial class RemoveSaleLotLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Sales_PurchaseLots_PurchaseLotId",
                table: "Sales");

            migrationBuilder.DropIndex(
                name: "IX_Sales_CustomerId",
                table: "Sales");

            migrationBuilder.DropIndex(
                name: "IX_Sales_PurchaseLotId",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "PurchaseLotId",
                table: "Sales");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Sales",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_CustomerId_SoldAt",
                table: "Sales",
                columns: new[] { "CustomerId", "SoldAt" },
                filter: "[CustomerId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Sales_CustomerId_SoldAt",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Sales");

            migrationBuilder.AddColumn<int>(
                name: "PurchaseLotId",
                table: "Sales",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_CustomerId",
                table: "Sales",
                column: "CustomerId",
                filter: "[CustomerId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_PurchaseLotId",
                table: "Sales",
                column: "PurchaseLotId");
        }
    }
}
