using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddImageSourceKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_HouseImages_HouseId_ImageKey",
                table: "HouseImages");

            migrationBuilder.DropIndex(
                name: "IX_CaseImages_CaseId_ImageKey",
                table: "CaseImages");

            migrationBuilder.AddColumn<string>(
                name: "SourceKey",
                table: "HouseImages",
                type: "nvarchar(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceKey",
                table: "CaseImages",
                type: "nvarchar(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_HouseImages_HouseId_SourceKey",
                table: "HouseImages",
                columns: new[] { "HouseId", "SourceKey" },
                unique: true,
                filter: "[SourceKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CaseImages_CaseId_SourceKey",
                table: "CaseImages",
                columns: new[] { "CaseId", "SourceKey" },
                unique: true,
                filter: "[SourceKey] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_HouseImages_HouseId_SourceKey",
                table: "HouseImages");

            migrationBuilder.DropIndex(
                name: "IX_CaseImages_CaseId_SourceKey",
                table: "CaseImages");

            migrationBuilder.DropColumn(
                name: "SourceKey",
                table: "HouseImages");

            migrationBuilder.DropColumn(
                name: "SourceKey",
                table: "CaseImages");

            migrationBuilder.CreateIndex(
                name: "IX_HouseImages_HouseId_ImageKey",
                table: "HouseImages",
                columns: new[] { "HouseId", "ImageKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CaseImages_CaseId_ImageKey",
                table: "CaseImages",
                columns: new[] { "CaseId", "ImageKey" },
                unique: true);
        }
    }
}
