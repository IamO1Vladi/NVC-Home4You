using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEnquiryArchive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ArchivedAt",
                table: "Questions",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ArchivedAt",
                table: "Offers",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Questions_ArchivedAt",
                table: "Questions",
                column: "ArchivedAt",
                filter: "[ArchivedAt] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Offers_ArchivedAt",
                table: "Offers",
                column: "ArchivedAt",
                filter: "[ArchivedAt] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Questions_ArchivedAt",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_Offers_ArchivedAt",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "Offers");
        }
    }
}
