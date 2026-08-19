using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Services;

// Copies the Quickbase buy side into SQL: cycles, shipments, lots, models, expenses.
//
// `dotnet run -- import-billing [--dry-run]`. Idempotent on QuickbaseRecordId, like every
// importer before it: a re-run creates nothing that already came across and NEVER
// overwrites — a row edited in the panel after import must not be quietly reverted to what
// Quickbase said.
//
// THE AUTHORITY RULE, from the owner (2026-08-19): "Quickbase was poorly built, so we made
// workarounds." QB is the record of WHAT happened, never the model of how it should be
// stored. Three translations follow from that:
//
//   ONE CYCLE.   All QB cycle rows merge into a single BuyCycle labelled "2024-2026" —
//                the six rows were an artefact of the build, not six real cycles. Each
//                shipment's Notes remembers which QB cycle it came from.
//   USD.         The business pays shipment costs in dollars; QB's EUR columns were the
//                workaround. Costs are converted BACK to USD through each shipment's own
//                FX field, and the EUR originals ride along in Notes so nothing is lost
//                to rounding.
//   RATES→AMOUNTS. QB derives customs and VAT from percentages; our schema stores the
//                amounts. The importer reads QB's own computed figures (its formula
//                fields), so the numbers land exactly as QB reported them.
//
// Sales (bvuz3pj9w) joined in phase 2, once their SQL home existed. Their one mapping
// caveat: QB's customer links point at a table ours was never imported from, so the
// customer NAME rides into Notes instead of a guessed foreign key.
public sealed class BillingImportService
{
    private readonly AppDbContext _db;
    private readonly QuickbaseApi _qb;
    private readonly EnvConfig _env;

    public BillingImportService(AppDbContext db, QuickbaseApi qb, EnvConfig env)
    {
        _db = db;
        _qb = qb;
        _env = env;
    }

    /// <summary>The one cycle everything lands in. The label is the owner's, 2026-08-19.</summary>
    public const string MergedCycleLabel = "2024-2026";

    // --- Quickbase field ids, from the 2026-08-19 schema pull --------------------------

    private static class CycleF
    {
        public const int Rid = 3, Name = 6, StartDate = 7, DefaultVatPct = 10;
    }

    private static class ShipF
    {
        public const int Rid = 3, CycleRid = 6, Name = 8,
            IntlTransportEur = 12, BgTransportEur = 13, OtherImportEur = 14,
            FxUsed = 15, CustomsAmountEur = 18, VatAmountEur = 20;
    }

    private static class ModelF
    {
        public const int Rid = 3, Name = 6, Type = 7, DefaultUnitCostUsd = 8;
    }

    private static class LotF
    {
        public const int Rid = 3, Qty = 6, EurOverride = 8, UsdUsed = 9,
            ShipmentRid = 22, ModelRid = 24, ArrivalDate = 43;
    }

    private static class OpexF
    {
        public const int Rid = 3, Date = 6, Category = 7, AmountEur = 8, Notes = 9,
            Invoice = 10, CycleRid = 11;
    }

    private static class SaleF
    {
        public const int Rid = 3, Date = 6, Qty = 7, UnitPriceEur = 8, PaymentFees = 9,
            BgTransport = 10, Building = 11, OtherCosts = 12, LotRid = 18,
            CustomerName = 26;
    }

    public sealed record Report(
        bool DryRun,
        bool TablesExist,
        int CyclesMerged,
        List<string> Lines,
        List<string> Problems)
    {
        public bool Ok => Problems.Count == 0;
    }

    public async Task<Report> ImportAsync(bool dryRun, CancellationToken ct = default)
    {
        var lines = new List<string>();
        var problems = new List<string>();

        // Whether the migration has been applied. Probed rather than assumed, because the
        // dry-run is most useful BEFORE anything has touched the database — it must work
        // against a database where the tables do not exist yet, and say so plainly.
        var tablesExist = await ProbeTablesAsync(ct);
        if (!tablesExist)
        {
            lines.Add("The billing tables do not exist in this database yet " +
                      "(AddBillingAndProcurement has not been applied).");
            if (!dryRun)
            {
                problems.Add("Cannot import: run `dotnet ef database update` first.");
                return new Report(dryRun, tablesExist, 0, lines, problems);
            }
            lines.Add("Dry run continues against Quickbase alone; nothing is checked for " +
                      "already-imported rows.");
        }

        // --- Fetch everything first, so a half-reachable Quickbase fails before any write.
        var qbCycles = await FetchAsync(_env.TableBuyCycles,
            new[] { CycleF.Rid, CycleF.Name, CycleF.StartDate, CycleF.DefaultVatPct }, ct);
        var qbShipments = await FetchAsync(_env.TableShipments,
            new[] { ShipF.Rid, ShipF.CycleRid, ShipF.Name, ShipF.IntlTransportEur, ShipF.BgTransportEur,
                    ShipF.OtherImportEur, ShipF.FxUsed, ShipF.CustomsAmountEur, ShipF.VatAmountEur }, ct);
        var qbModels = await FetchAsync(_env.TableProductModels,
            new[] { ModelF.Rid, ModelF.Name, ModelF.Type, ModelF.DefaultUnitCostUsd }, ct);
        var qbLots = await FetchAsync(_env.TablePurchaseLots,
            new[] { LotF.Rid, LotF.Qty, LotF.EurOverride, LotF.UsdUsed, LotF.ShipmentRid,
                    LotF.ModelRid, LotF.ArrivalDate }, ct);
        var qbOpex = await FetchAsync(_env.TableOperatingExpenses,
            new[] { OpexF.Rid, OpexF.Date, OpexF.Category, OpexF.AmountEur, OpexF.Notes,
                    OpexF.Invoice, OpexF.CycleRid }, ct);
        var qbSales = await FetchAsync(_env.TableSales,
            new[] { SaleF.Rid, SaleF.Date, SaleF.Qty, SaleF.UnitPriceEur, SaleF.PaymentFees,
                    SaleF.BgTransport, SaleF.Building, SaleF.OtherCosts, SaleF.LotRid,
                    SaleF.CustomerName }, ct);

        lines.Add($"Fetched from Quickbase: {qbCycles.Count} cycles, {qbShipments.Count} shipments, " +
                  $"{qbModels.Count} models, {qbLots.Count} lots, {qbOpex.Count} expenses, " +
                  $"{qbSales.Count} sales.");

        // --- The one merged cycle -----------------------------------------------------
        var cycleNames = qbCycles
            .Select(c => $"{c.Get(CycleF.Name)} (rid {c.Get(CycleF.Rid)})")
            .ToList();

        var startDate = qbCycles
            .Select(c => ParseDate(c.Get(CycleF.StartDate)))
            .Where(d => d is not null)
            .DefaultIfEmpty(null)
            .Min();

        // The VAT rate of the LATEST QB cycle — the closest thing the merged cycle has to
        // a current rate. Markup stays null: Quickbase never had one, and inventing 2.7
        // here would present a guess as history. The owner types it once, in the panel.
        var latestVat = qbCycles
            .OrderByDescending(c => ParseDate(c.Get(CycleF.StartDate)) ?? DateTimeOffset.MinValue)
            .Select(c => ParseDecimal(c.Get(CycleF.DefaultVatPct)))
            .FirstOrDefault(v => v is not null);

        BuyCycle? cycle = null;
        if (tablesExist)
        {
            // The import cycle is recognised by ITS OWN DATA — any cycle holding a
            // Quickbase-imported shipment is the one every import wrote to — with the
            // label as the fresh-database fallback. Matching on label alone was the
            // 2026-08-19 review's finding: the panel can rename the cycle, and a renamed
            // cycle plus a re-run would have split the ledger across two cycles.
            cycle = await _db.BuyCycles
                .FirstOrDefaultAsync(c => c.Shipments.Any(sh => sh.QuickbaseRecordId != null), ct)
                ?? await _db.BuyCycles.FirstOrDefaultAsync(c => c.Label == MergedCycleLabel, ct);
        }

        if (cycle is null)
        {
            cycle = new BuyCycle
            {
                Label = MergedCycleLabel,
                StartDate = startDate,
                BorderVatRate = latestVat,
                Notes = "Обединени цикли от Quickbase: " + string.Join("; ", cycleNames),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedByUpn = "import-billing",
            };
            if (!dryRun) _db.BuyCycles.Add(cycle);
            lines.Add($"Cycle \"{MergedCycleLabel}\": will create (start {startDate:yyyy-MM-dd}, " +
                      $"border VAT {latestVat?.ToString(CultureInfo.InvariantCulture) ?? "—"}, markup left for the owner). " +
                      $"Merges: {string.Join(" + ", cycleNames)}.");
        }
        else
        {
            lines.Add($"Cycle \"{MergedCycleLabel}\" already exists (id {cycle.Id}) — reused, not touched.");
        }

        // --- Models --------------------------------------------------------------------
        var existingModels = tablesExist
            ? await _db.ProductModels.Where(m => m.QuickbaseRecordId != null)
                .ToDictionaryAsync(m => m.QuickbaseRecordId!.Value, ct)
            : new Dictionary<long, ProductModel>();

        var modelByRid = new Dictionary<long, ProductModel>();
        int modelsNew = 0, modelsSkipped = 0;

        foreach (var rec in qbModels)
        {
            if (!TryRid(rec, ModelF.Rid, out var rid)) { problems.Add("A model row has no record id."); continue; }

            if (existingModels.TryGetValue(rid, out var already))
            {
                modelByRid[rid] = already;
                modelsSkipped++;
                continue;
            }

            var name = (rec.Get(ModelF.Name) ?? "").Trim();
            if (name.Length == 0) { problems.Add($"Model rid {rid} has no name — skipped."); continue; }

            var typeRaw = rec.Get(ModelF.Type);
            var category = MapModelType(typeRaw);
            if (category is null && !string.IsNullOrWhiteSpace(typeRaw))
                problems.Add($"Model rid {rid} \"{name}\": unknown type \"{typeRaw}\" — imported without a category.");

            var model = new ProductModel
            {
                QuickbaseRecordId = rid,
                Name = name,
                CategoryKey = category,
                FactoryPrice = ParseDecimal(rec.Get(ModelF.DefaultUnitCostUsd)),
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedByUpn = "import-billing",
            };
            modelByRid[rid] = model;
            if (!dryRun) _db.ProductModels.Add(model);
            modelsNew++;
        }

        lines.Add($"Models: {modelsNew} new, {modelsSkipped} already imported.");

        // --- Shipments -----------------------------------------------------------------
        var existingShipments = tablesExist
            ? await _db.Shipments.Where(s => s.QuickbaseRecordId != null)
                .ToDictionaryAsync(s => s.QuickbaseRecordId!.Value, ct)
            : new Dictionary<long, Shipment>();

        // Arrival lives on the QB LOT, of all places; a shipment arrives when its goods did.
        var arrivalByShipmentRid = qbLots
            .Select(l => (Rid: RidOf(l.Get(LotF.ShipmentRid)), Date: ParseDate(l.Get(LotF.ArrivalDate))))
            .Where(x => x.Rid is not null)
            .GroupBy(x => x.Rid!.Value)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Date).Where(d => d is not null).Max());

        var qbCycleNameByRid = new Dictionary<long, string>();
        foreach (var c in qbCycles)
        {
            if (RidOf(c.Get(CycleF.Rid)) is long cycleNameRid)
                qbCycleNameByRid[cycleNameRid] = (c.Get(CycleF.Name) ?? "").Trim();
        }

        var shipmentByRid = new Dictionary<long, Shipment>();
        int shipmentsNew = 0, shipmentsSkipped = 0;

        foreach (var rec in qbShipments)
        {
            if (!TryRid(rec, ShipF.Rid, out var rid)) { problems.Add("A shipment row has no record id."); continue; }

            if (existingShipments.TryGetValue(rid, out var already))
            {
                shipmentByRid[rid] = already;
                shipmentsSkipped++;
                continue;
            }

            var fx = ParseDecimal(rec.Get(ShipF.FxUsed));
            var intlEur = ParseDecimal(rec.Get(ShipF.IntlTransportEur));
            var bgEur = ParseDecimal(rec.Get(ShipF.BgTransportEur));
            var otherEur = ParseDecimal(rec.Get(ShipF.OtherImportEur));
            var customsEur = ParseDecimal(rec.Get(ShipF.CustomsAmountEur));
            var vatEur = ParseDecimal(rec.Get(ShipF.VatAmountEur));

            if (fx is null or 0m)
            {
                problems.Add($"Shipment rid {rid} \"{rec.Get(ShipF.Name)}\": no FX rate — " +
                             "EUR costs cannot be converted back to USD; imported with empty costs.");
            }

            var qbCycleName = TryRid(rec, ShipF.CycleRid, out var cycleRid)
                && qbCycleNameByRid.TryGetValue(cycleRid, out var n) ? n : "?";

            var notes =
                $"Импортиран от Quickbase (rid {rid}, цикъл „{qbCycleName}“). " +
                $"Оригинални суми в EUR: межд. транспорт {Eur(intlEur)}, бг транспорт {Eur(bgEur)}, " +
                $"други {Eur(otherEur)}, мито {Eur(customsEur)}, ДДС на границата {Eur(vatEur)}.";

            // QB splits transport in two; our schema has one freight column, so the
            // domestic leg lands in OtherCosts with the note saying exactly what it is.
            var otherUsd = SumOrNull(ToUsd(bgEur, fx), ToUsd(otherEur, fx));

            var shipment = new Shipment
            {
                QuickbaseRecordId = rid,
                BuyCycle = cycle,
                Reference = FactoryAdminService.Clean(rec.Get(ShipF.Name)),
                FreightCost = ToUsd(intlEur, fx),
                OtherCosts = otherUsd,
                OtherCostsNote = otherUsd is not null ? "БГ транспорт + други (виж бележките)" : null,
                CustomsDuty = ToUsd(customsEur, fx),
                ImportVatPaid = ToUsd(vatEur, fx),
                ArrivedAt = arrivalByShipmentRid.TryGetValue(rid, out var arrived) ? arrived : null,
                UsdToEurRate = fx is 0m ? null : fx,
                RateSource = "Quickbase: FX USD→EUR Used",
                Notes = notes,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedByUpn = "import-billing",
            };
            shipmentByRid[rid] = shipment;
            if (!dryRun) _db.Shipments.Add(shipment);
            shipmentsNew++;
        }

        lines.Add($"Shipments: {shipmentsNew} new, {shipmentsSkipped} already imported.");

        // --- Lots ----------------------------------------------------------------------
        // rid -> entity rather than a bare id set: the sales below need to point at the
        // lot rows, whether those came across in an earlier run or this one.
        var lotByRid = tablesExist
            ? await _db.PurchaseLots.Where(l => l.QuickbaseRecordId != null)
                .ToDictionaryAsync(l => l.QuickbaseRecordId!.Value, ct)
            : new Dictionary<long, PurchaseLot>();

        int lotsNew = 0, lotsSkipped = 0;

        foreach (var rec in qbLots)
        {
            if (!TryRid(rec, LotF.Rid, out var rid)) { problems.Add("A lot row has no record id."); continue; }
            if (lotByRid.ContainsKey(rid)) { lotsSkipped++; continue; }

            if (!TryRid(rec, LotF.ShipmentRid, out var shipRid) || !shipmentByRid.TryGetValue(shipRid, out var lotShipment))
            {
                problems.Add($"Lot rid {rid}: its shipment is missing — skipped.");
                continue;
            }
            if (!TryRid(rec, LotF.ModelRid, out var modelRid) || !modelByRid.TryGetValue(modelRid, out var lotModel))
            {
                problems.Add($"Lot rid {rid}: its product model is missing — skipped.");
                continue;
            }

            var qty = (int)(ParseDecimal(rec.Get(LotF.Qty)) ?? 0m);
            if (qty <= 0)
            {
                problems.Add($"Lot rid {rid}: quantity {qty} — skipped, a lot of nothing prices nothing.");
                continue;
            }

            var unitCost = ResolveUnitCostUsd(
                ParseDecimal(rec.Get(LotF.UsdUsed)),
                ParseDecimal(rec.Get(LotF.EurOverride)),
                lotShipment.UsdToEurRate);

            if (unitCost is null)
            {
                problems.Add($"Lot rid {rid}: no resolvable unit cost — imported at 0, fix in the panel.");
            }

            var lot = new PurchaseLot
            {
                QuickbaseRecordId = rid,
                Shipment = lotShipment,
                ProductModel = lotModel,
                Quantity = qty,
                UnitCost = unitCost ?? 0m,
                Notes = $"Импортиран от Quickbase (rid {rid}).",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedByUpn = "import-billing",
            };
            lotByRid[rid] = lot;
            if (!dryRun) _db.PurchaseLots.Add(lot);
            lotsNew++;
        }

        lines.Add($"Lots: {lotsNew} new, {lotsSkipped} already imported.");

        // --- Operating expenses --------------------------------------------------------
        var existingOpex = tablesExist
            ? (await _db.OperatingExpenses.Where(x => x.QuickbaseRecordId != null)
                .Select(x => x.QuickbaseRecordId!.Value).ToListAsync(ct)).ToHashSet()
            : new HashSet<long>();

        int opexNew = 0, opexSkipped = 0, opexWithFiles = 0, opexLinked = 0;

        foreach (var rec in qbOpex)
        {
            if (!TryRid(rec, OpexF.Rid, out var rid)) { problems.Add("An expense row has no record id."); continue; }
            if (existingOpex.Contains(rid)) { opexSkipped++; continue; }

            var spentAt = ParseDate(rec.Get(OpexF.Date));
            if (spentAt is null)
            {
                problems.Add($"Expense rid {rid}: no date — skipped, the rollup has nowhere to put it.");
                continue;
            }

            var amount = ParseDecimal(rec.Get(OpexF.AmountEur));
            if (amount is null or <= 0m)
            {
                problems.Add($"Expense rid {rid}: amount {amount?.ToString(CultureInfo.InvariantCulture) ?? "—"} — skipped.");
                continue;
            }

            var rawCategory = rec.Get(OpexF.Category);
            var category = ExpenseCategories.FromQuickbaseLabel(rawCategory);
            if (category is null && !string.IsNullOrWhiteSpace(rawCategory))
                problems.Add($"Expense rid {rid}: unknown category \"{rawCategory}\" — imported uncategorised.");

            // The attachment is not carried (phase 2, PurchaseFile pattern) — but its
            // existence is counted and reported, so it is a known gap rather than a
            // silent one, and the note on the row says where to find the original.
            var hasFile = rec.TryGetElement(OpexF.Invoice, out var el)
                && el.ValueKind is not System.Text.Json.JsonValueKind.Null
                    and not System.Text.Json.JsonValueKind.Undefined
                && el.GetRawText() is not ("\"\"" or "{}" or "null");
            if (hasFile) opexWithFiles++;

            var linked = TryRid(rec, OpexF.CycleRid, out _);
            if (linked) opexLinked++;

            var expense = new OperatingExpense
            {
                QuickbaseRecordId = rid,
                SpentAt = spentAt.Value,
                CategoryKey = category,
                Amount = amount.Value,
                Description = category is null ? FactoryAdminService.Clean(rawCategory) : null,
                // Every QB cycle merged into the one — so every linked expense points there.
                BuyCycle = linked ? cycle : null,
                Notes = JoinNotes(
                    FactoryAdminService.Clean(rec.Get(OpexF.Notes)),
                    $"Импортиран от Quickbase (rid {rid})." + (hasFile ? " Има фактура в Quickbase." : "")),
                SubmittedByUpn = "import-billing",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedByUpn = "import-billing",
            };
            if (!dryRun) _db.OperatingExpenses.Add(expense);
            opexNew++;
        }

        lines.Add($"Expenses: {opexNew} new, {opexSkipped} already imported; " +
                  $"{opexLinked} carry the cycle link, {opexWithFiles} have an invoice file " +
                  "still in Quickbase (not carried — phase 2).");

        // --- Sales (phase 2) -----------------------------------------------------------
        // Whether the Sales table exists gates BOTH the seed and, below, the writes. The
        // first draft gated only the seed, so a real run in the documented migration gap
        // (AddBillingAndProcurement applied, AddSales not) staged Sale rows anyway and the
        // one SaveChanges aborted the ENTIRE import — buy side included (2026-08-19
        // review). Now the buy side lands and sales are reported as waiting.
        var salesTableExists = tablesExist && await ProbeSalesAsync(ct);
        var existingSales = salesTableExists
            ? (await _db.Sales.Where(x => x.QuickbaseRecordId != null)
                .Select(x => x.QuickbaseRecordId!.Value).ToListAsync(ct)).ToHashSet()
            : new HashSet<long>();

        int salesNew = 0, salesSkipped = 0, salesWithCustomer = 0, salesOversold = 0;

        // Sold-per-lot, tracked BY HAND rather than through lot.Sales: the navigation is
        // empty on lots loaded without an Include and never fixed up on a dry run, so
        // summing it would silently check nothing. Seeded from the database where the
        // sales table exists, then fed by the loop below.
        var soldByLotRid = new Dictionary<long, int>();
        if (existingSales.Count > 0)
        {
            var dbSold = await _db.Sales
                .Where(x => x.PurchaseLot!.QuickbaseRecordId != null)
                .GroupBy(x => x.PurchaseLot!.QuickbaseRecordId!.Value)
                .Select(g => new { Rid = g.Key, Sum = g.Sum(x => x.Quantity) })
                .ToListAsync(ct);
            foreach (var row in dbSold) soldByLotRid[row.Rid] = row.Sum;
        }

        foreach (var rec in qbSales)
        {
            if (!TryRid(rec, SaleF.Rid, out var rid)) { problems.Add("A sale row has no record id."); continue; }
            if (existingSales.Contains(rid)) { salesSkipped++; continue; }

            if (!TryRid(rec, SaleF.LotRid, out var lotRid) || !lotByRid.TryGetValue(lotRid, out var saleLot))
            {
                problems.Add($"Sale rid {rid}: its container line is missing — skipped.");
                continue;
            }

            var soldAt = ParseDate(rec.Get(SaleF.Date));
            if (soldAt is null)
            {
                problems.Add($"Sale rid {rid}: no date — skipped, the revenue rollup has nowhere to put it.");
                continue;
            }

            var qty = (int)(ParseDecimal(rec.Get(SaleF.Qty)) ?? 0m);
            if (qty <= 0)
            {
                problems.Add($"Sale rid {rid}: quantity {qty} — skipped.");
                continue;
            }

            var price = ParseDecimal(rec.Get(SaleF.UnitPriceEur));
            if (price is null)
                problems.Add($"Sale rid {rid}: no unit price — imported at 0, fix in the panel.");

            // History is history: an oversold lot is reported, never refused — the panel
            // blocks NEW oversells, but what Quickbase recorded stands.
            var customerName = FactoryAdminService.Clean(rec.Get(SaleF.CustomerName));
            if (customerName is not null) salesWithCustomer++;

            var sale = new Sale
            {
                QuickbaseRecordId = rid,
                PurchaseLot = saleLot,
                SoldAt = soldAt.Value,
                Quantity = qty,
                UnitSalePrice = price ?? 0m,
                PaymentFees = ParseDecimal(rec.Get(SaleF.PaymentFees)),
                TransportCost = ParseDecimal(rec.Get(SaleF.BgTransport)),
                InstallationCost = ParseDecimal(rec.Get(SaleF.Building)),
                OtherCosts = ParseDecimal(rec.Get(SaleF.OtherCosts)),
                // The QB customer link cannot be machine-mapped (see the class comment),
                // so the name is carried where a person can act on it.
                Notes = $"Импортирана от Quickbase (rid {rid})."
                    + (customerName is null ? "" : $" Клиент по Quickbase: {customerName}."),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedByUpn = "import-billing",
            };
            soldByLotRid[lotRid] = (soldByLotRid.TryGetValue(lotRid, out var already) ? already : 0) + qty;
            if (!dryRun && salesTableExists) _db.Sales.Add(sale);
            salesNew++;
        }

        // The stock check, across everything now known: a lot oversold by its sales is
        // worth a report line even when every row imported cleanly.
        foreach (var (rid, sold) in soldByLotRid)
        {
            if (lotByRid.TryGetValue(rid, out var lot) && sold > lot.Quantity)
            {
                salesOversold++;
                problems.Add($"Lot rid {rid}: sold {sold} of {lot.Quantity} purchased — Quickbase history oversells it.");
            }
        }

        if (!salesTableExists && !dryRun && salesNew > 0)
        {
            problems.Add($"The Sales table does not exist (AddSales not applied) — " +
                $"{salesNew} sale(s) were NOT imported. Run `dotnet ef database update`, then re-run.");
            salesNew = 0;
        }

        lines.Add($"Sales: {salesNew} new, {salesSkipped} already imported; " +
                  $"{salesWithCustomer} carry a Quickbase customer name (in Notes — no machine link), " +
                  $"{salesOversold} lot(s) oversold by history.");
        if (!dryRun)
        {
            await _db.SaveChangesAsync(ct);
            lines.Add("Written.");
        }
        else
        {
            lines.Add("DRY RUN — nothing was written.");
        }

        return new Report(dryRun, tablesExist, qbCycles.Count, lines, problems);
    }

    // --- Mapping helpers, static so the tests can hold them still ----------------------

    /// <summary>QB "Type" choice → PurchaseCategories key. Null for blank or unknown.</summary>
    public static string? MapModelType(string? raw) => (raw ?? "").Trim() switch
    {
        "Контейнери" => "container",
        "Бокс къщи" => HouseCategories.Prefab,
        "Модулни Къщи" => HouseCategories.Modular,
        "Гаражи" => HouseCategories.Garage,
        "Друго" => "other",
        _ => null,
    };

    /// <summary>
    /// EUR back to USD through the shipment's own rate — the reverse of the workaround.
    /// Null in, null out; null rate means no conversion exists, so null out too.
    /// </summary>
    public static decimal? ToUsd(decimal? eur, decimal? fx)
    {
        if (eur is not decimal amount) return null;
        if (fx is not decimal rate || rate == 0m) return null;
        return decimal.Round(amount / rate, 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// A lot's USD unit cost, the way QB itself resolved it: an explicit EUR override wins
    /// (converted back), otherwise the USD figure QB used.
    /// </summary>
    public static decimal? ResolveUnitCostUsd(decimal? usdUsed, decimal? eurOverride, decimal? fx)
    {
        // An override that cannot be converted (no FX on the shipment) falls back to the
        // USD figure QB itself used rather than resolving to nothing — a lot imported at
        // $0 is a claim that deflates every downstream sum, where QB's own USD number is
        // merely approximate (2026-08-19 review).
        if (eurOverride is decimal over && over != 0m) return ToUsd(over, fx) ?? usdUsed;
        return usdUsed;
    }

    private static decimal? SumOrNull(decimal? a, decimal? b) =>
        a is null && b is null ? null : (a ?? 0m) + (b ?? 0m);

    private static string Eur(decimal? v) =>
        v is decimal d ? "€" + d.ToString("0.##", CultureInfo.InvariantCulture) : "—";

    private static string JoinNotes(string? qbNotes, string provenance) =>
        string.IsNullOrWhiteSpace(qbNotes) ? provenance : qbNotes + "\n" + provenance;

    private static decimal? ParseDecimal(string? raw) =>
        decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : null;

    private static DateTimeOffset? ParseDate(string? raw) =>
        CustomerAdminService.TryParsePurchaseDate(raw, out var v) ? v : null;

    /// <summary>
    /// A Quickbase record id out of a field value. PARSED AS A DECIMAL, deliberately:
    /// QB serialises numeric reference fields as `2.0`, not `2`, and the first dry-run
    /// against the live app failed to link every single lot because long.TryParse refused
    /// the ".0". Whole-number check kept, so a genuinely fractional value still refuses.
    /// </summary>
    public static long? RidOf(string? raw)
    {
        var v = ParseDecimal(raw);
        if (v is not decimal d || d <= 0m || d != decimal.Truncate(d)) return null;
        return (long)d;
    }

    private static bool TryRid(QbRec rec, int fid, out long rid)
    {
        var parsed = RidOf(rec.Get(fid));
        rid = parsed ?? 0;
        return parsed is not null;
    }

    private async Task<List<QbRec>> FetchAsync(string tableId, int[] select, CancellationToken ct)
    {
        // One page of 500 is plenty: the largest table is 81 rows. If this business ever
        // has 500 containers in Quickbase, something has gone wrong with the cutover plan.
        var result = await _qb.QueryAsync(tableId, select, where: "", sortFid: 3, sortOrder: "ASC", ct);
        return result.data ?? new List<QbRec>();
    }

    // Separate from ProbeTablesAsync because the two migrations can be applied apart:
    // AddBillingAndProcurement went first, AddSales is phase 2, and a dry-run in the gap
    // must report the buy side as present and sales as still waiting for their table.
    private async Task<bool> ProbeSalesAsync(CancellationToken ct)
    {
        try
        {
            await _db.Sales.AnyAsync(ct);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<bool> ProbeTablesAsync(CancellationToken ct)
    {
        try
        {
            await _db.BuyCycles.AnyAsync(ct);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
