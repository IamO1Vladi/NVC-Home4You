using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityRecipients : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CcRecipients",
                table: "LeadActivities",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FromAddress",
                table: "LeadActivities",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CcRecipients",
                table: "LeadActivities");

            migrationBuilder.DropColumn(
                name: "FromAddress",
                table: "LeadActivities");
        }
    }
}
