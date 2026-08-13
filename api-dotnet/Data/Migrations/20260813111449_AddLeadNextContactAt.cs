using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadNextContactAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "NextContactAt",
                table: "Leads",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Leads_NextContactAt",
                table: "Leads",
                column: "NextContactAt",
                filter: "[NextContactAt] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Leads_NextContactAt",
                table: "Leads");

            migrationBuilder.DropColumn(
                name: "NextContactAt",
                table: "Leads");
        }
    }
}
