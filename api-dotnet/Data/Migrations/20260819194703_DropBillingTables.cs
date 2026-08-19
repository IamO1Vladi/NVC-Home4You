using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <summary>
    /// Drops the six billing tables and everything in them (2026-08-19).
    ///
    /// ⚠ DESTRUCTIVE, AND DELIBERATELY LEFT UNAPPLIED. It removes the imported buy-side
    /// data: 1 buy cycle, 8 shipments, 9 product models, 15 purchase lots, 79 operating
    /// expenses. Quickbase still holds every one of those rows — the app tables were a
    /// copy and the QB tables were never written to — so this is recoverable while the
    /// Quickbase token lives (~Feb 2027), and after that it is not.
    ///
    /// Apply only when someone has decided that Quickbase is the record:
    ///     dotnet ef database update
    /// To stop BEFORE it and keep the data, name the previous migration instead:
    ///     dotnet ef database update RemoveSaleLotLink
    /// </summary>
    public partial class DropBillingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OperatingExpenses");

            migrationBuilder.DropTable(
                name: "PurchaseLots");

            migrationBuilder.DropTable(
                name: "Targets");

            migrationBuilder.DropTable(
                name: "ProductModels");

            migrationBuilder.DropTable(
                name: "Shipments");

            migrationBuilder.DropTable(
                name: "BuyCycles");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BuyCycles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BorderVatRate = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndDate = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsClosed = table.Column<bool>(type: "bit", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MarkupCoefficient = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartDate = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedByUpn = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BuyCycles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProductModels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    HouseId = table.Column<int>(type: "int", nullable: true),
                    CategoryKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FactoryPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    QuickbaseRecordId = table.Column<long>(type: "bigint", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedByUpn = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductModels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductModels_Houses_HouseId",
                        column: x => x.HouseId,
                        principalTable: "Houses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OperatingExpenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BuyCycleId = table.Column<int>(type: "int", nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CategoryKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    QuickbaseRecordId = table.Column<long>(type: "bigint", nullable: true),
                    SpentAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    SubmittedByUpn = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedByUpn = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    VatAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperatingExpenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperatingExpenses_BuyCycles_BuyCycleId",
                        column: x => x.BuyCycleId,
                        principalTable: "BuyCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Shipments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BuyCycleId = table.Column<int>(type: "int", nullable: false),
                    FactoryId = table.Column<int>(type: "int", nullable: true),
                    ArrivedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CustomsDuty = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    DepartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    FreightCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ImportVatPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OrderedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    OtherCosts = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    OtherCostsNote = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    QuickbaseRecordId = table.Column<long>(type: "bigint", nullable: true),
                    RateAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RateSource = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedByUpn = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    UsdToEurRate = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Shipments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Shipments_BuyCycles_BuyCycleId",
                        column: x => x.BuyCycleId,
                        principalTable: "BuyCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Shipments_Factories_FactoryId",
                        column: x => x.FactoryId,
                        principalTable: "Factories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Targets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BuyCycleId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    MetricKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Month = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PeriodType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TargetValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedByUpn = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    Year = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Targets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Targets_BuyCycles_BuyCycleId",
                        column: x => x.BuyCycleId,
                        principalTable: "BuyCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PurchaseLots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductModelId = table.Column<int>(type: "int", nullable: false),
                    ShipmentId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    QuickbaseRecordId = table.Column<long>(type: "bigint", nullable: true),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedByUpn = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseLots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseLots_ProductModels_ProductModelId",
                        column: x => x.ProductModelId,
                        principalTable: "ProductModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PurchaseLots_Shipments_ShipmentId",
                        column: x => x.ShipmentId,
                        principalTable: "Shipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BuyCycles_IsClosed_StartDate",
                table: "BuyCycles",
                columns: new[] { "IsClosed", "StartDate" });

            migrationBuilder.CreateIndex(
                name: "IX_OperatingExpenses_BuyCycleId",
                table: "OperatingExpenses",
                column: "BuyCycleId",
                filter: "[BuyCycleId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OperatingExpenses_CategoryKey_SpentAt",
                table: "OperatingExpenses",
                columns: new[] { "CategoryKey", "SpentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OperatingExpenses_QuickbaseRecordId",
                table: "OperatingExpenses",
                column: "QuickbaseRecordId",
                unique: true,
                filter: "[QuickbaseRecordId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OperatingExpenses_SpentAt",
                table: "OperatingExpenses",
                column: "SpentAt");

            migrationBuilder.CreateIndex(
                name: "IX_ProductModels_HouseId",
                table: "ProductModels",
                column: "HouseId",
                filter: "[HouseId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ProductModels_IsActive_Name",
                table: "ProductModels",
                columns: new[] { "IsActive", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductModels_QuickbaseRecordId",
                table: "ProductModels",
                column: "QuickbaseRecordId",
                unique: true,
                filter: "[QuickbaseRecordId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseLots_ProductModelId",
                table: "PurchaseLots",
                column: "ProductModelId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseLots_QuickbaseRecordId",
                table: "PurchaseLots",
                column: "QuickbaseRecordId",
                unique: true,
                filter: "[QuickbaseRecordId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseLots_ShipmentId",
                table: "PurchaseLots",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_BuyCycleId_ArrivedAt",
                table: "Shipments",
                columns: new[] { "BuyCycleId", "ArrivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_FactoryId",
                table: "Shipments",
                column: "FactoryId",
                filter: "[FactoryId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_QuickbaseRecordId",
                table: "Shipments",
                column: "QuickbaseRecordId",
                unique: true,
                filter: "[QuickbaseRecordId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Targets_BuyCycleId",
                table: "Targets",
                column: "BuyCycleId");

            migrationBuilder.CreateIndex(
                name: "IX_Targets_PeriodType_MetricKey_Year_Month_BuyCycleId",
                table: "Targets",
                columns: new[] { "PeriodType", "MetricKey", "Year", "Month", "BuyCycleId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_PurchaseLots_PurchaseLotId",
                table: "Sales",
                column: "PurchaseLotId",
                principalTable: "PurchaseLots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
