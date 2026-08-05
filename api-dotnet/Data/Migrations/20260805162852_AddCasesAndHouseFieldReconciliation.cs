using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCasesAndHouseFieldReconciliation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Category",
                table: "Houses");

            migrationBuilder.AddColumn<string>(
                name: "CategoryKey",
                table: "Houses",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastModifiedBy",
                table: "Houses",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Cases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QuickbaseRecordId = table.Column<long>(type: "bigint", nullable: true),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    Featured = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CompanyName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    CompanySector = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    BuyerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    BuyerRole = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Country = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    City = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CategoryKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    ProductName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ProductVariant = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    UnitsQty = table.Column<int>(type: "int", nullable: true),
                    Year = table.Column<int>(type: "int", nullable: true),
                    DeliveredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Scope = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Result = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PublicQuote = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RatingSnapshot = table.Column<double>(type: "float", nullable: true),
                    CompanyLogoImageKey = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    CoverImageKey = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CaseImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CaseId = table.Column<int>(type: "int", nullable: false),
                    QuickbaseRecordId = table.Column<long>(type: "bigint", nullable: true),
                    ImageKey = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    AltText = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaseImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CaseImages_Cases_CaseId",
                        column: x => x.CaseId,
                        principalTable: "Cases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CaseImages_CaseId_ImageKey",
                table: "CaseImages",
                columns: new[] { "CaseId", "ImageKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CaseImages_CaseId_SortOrder",
                table: "CaseImages",
                columns: new[] { "CaseId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CaseImages_QuickbaseRecordId",
                table: "CaseImages",
                column: "QuickbaseRecordId",
                unique: true,
                filter: "[QuickbaseRecordId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Cases_IsPublished_Featured",
                table: "Cases",
                columns: new[] { "IsPublished", "Featured" });

            migrationBuilder.CreateIndex(
                name: "IX_Cases_IsPublished_SortOrder",
                table: "Cases",
                columns: new[] { "IsPublished", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Cases_QuickbaseRecordId",
                table: "Cases",
                column: "QuickbaseRecordId",
                unique: true,
                filter: "[QuickbaseRecordId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CaseImages");

            migrationBuilder.DropTable(
                name: "Cases");

            migrationBuilder.DropColumn(
                name: "CategoryKey",
                table: "Houses");

            migrationBuilder.DropColumn(
                name: "LastModifiedBy",
                table: "Houses");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Houses",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);
        }
    }
}
