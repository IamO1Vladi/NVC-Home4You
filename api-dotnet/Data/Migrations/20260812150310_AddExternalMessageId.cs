using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalMessageId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalMessageId",
                table: "LeadActivities",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeadActivities_ExternalMessageId",
                table: "LeadActivities",
                column: "ExternalMessageId",
                unique: true,
                filter: "[ExternalMessageId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LeadActivities_ExternalMessageId",
                table: "LeadActivities");

            migrationBuilder.DropColumn(
                name: "ExternalMessageId",
                table: "LeadActivities");
        }
    }
}
