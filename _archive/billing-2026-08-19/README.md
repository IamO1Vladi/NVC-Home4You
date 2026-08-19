# Billing & procurement — archived 2026-08-19

**This folder is not built, not bundled and not published.** It sits above both projects:
`api-dotnet.csproj` globs from `api-dotnet/`, Vite globs from `NVC Claude version/src/`, and
a publish ships the API's own output — none of them can see `_archive/`. It is here to be
*read*, and to be restorable in an afternoon.

## Why it is here

The team decided on 2026-08-19 that migrating billing off Quickbase is **too much change to
absorb right now** — not that the design was wrong. Everything below worked: it shipped,
the data imported cleanly, and the whole thing was verified in production before being
pulled back out. It was removed to keep the panel small while the business does other
things.

What stayed behind in the live code: **`Sale`**, reduced to what the owner asked for — a
sale linked to a customer, nothing else. Its container-line link, its cost-of-goods and its
margin arithmetic left with the rest of this folder.

## What is in here

| | |
|---|---|
| `Entities/` | `BuyCycle`, `Shipment`, `PurchaseLot`, `ProductModel`, `OperatingExpense`, `Target`, plus `LandedCost` (all the arithmetic), `ExpenseCategories`, `TargetMetrics` |
| `Services/` | the five admin services, `DashboardService`, and `BillingImportService` (the Quickbase importer) |
| `Controllers/` | six `AdminOnly` controllers under `api/admin/*` |
| `Pages/` | five React screens and their tests — procurement, cost prices, expenses, targets, dashboard |
| `Tests/` | 43 backend tests: the landed-cost arithmetic, the import mapping, the store rules, the dashboard |

## The state of the world when this was pulled

**The production database still holds the tables and the imported data** — 1 buy cycle,
8 shipments, 9 product models, 15 purchase lots, 79 operating expenses. Nothing was dropped
by the removal itself; the tables are simply unread now.

A migration that DROPS them exists and was deliberately **left unapplied**
(`api-dotnet/Data/Migrations/*_DropBillingTables.cs`). Applying it destroys that data. It
is safe to apply *only* once someone is content that Quickbase remains the record — which
it does: the app tables were a copy, and the six Quickbase tables
(`bvuz3dthx`, `bvuz3mm8e`, `bvuz3nu2v`, `bvuz3n862`, `bvuz3pj9w`, `bvuz3p5hs`) were never
written to by this system.

The 30 imported sales stayed in the `Sales` table and lost their lot link. Each carries its
Quickbase customer NAME in `Notes` — the import never linked them to `Customer` rows,
because ours were never imported from Quickbase.

## Restoring it

1. `git mv` these files back to the paths their headers imply (the structure here mirrors
   the tree they came from).
2. Re-add the `DbSet`s and the `OnModelCreating` blocks to `AppDbContext` — the deleted
   versions are in `git show 59e1b1b:api-dotnet/Data/AppDbContext.cs`.
3. Re-add the entity names to `AuditedEntities` in `Data/Entities/AuditPolicy.cs`.
4. Re-register the services in `Program.cs`, and the `import-billing` CLI block.
5. Re-add the routes in `App.jsx`, the nav sections in `AdminShell.jsx` and the tiles in
   `AdminHomePage.jsx`.
6. Restore `Sale.PurchaseLotId` and the COGS half of `SaleAdminService`.
7. Do **not** apply the drop migration; if it was applied, the tables come back with
   `dotnet ef database update` and the data comes back with `dotnet run -- import-billing`
   **while the Quickbase token lives (~Feb 2027)** — after that the import path is gone.

The commit that removed it all is the one that added this file; `git log --follow` on any
file here reads its whole history.

## The decisions inside, so they are not re-derived

- **VAT** applies to the whole landed value, customs included: `Price = Base × Markup +
  Base × BorderVat`. Reclaimed on everything except customs, so `customs × rate` is a true
  cost and the rest is timing. Quickbase computed this differently and the owner ruled
  Quickbase wrong.
- **The buy side is USD** as paid; every report is EUR, converted at the rate stored on the
  individual shipment so history never re-values.
- **Freight allocates by value share**, confirmed by the owner and by Quickbase's own
  formulas.
- **A lot's unit cost is a snapshot**, never read live from the model — a factory price
  correction must not reprice last year's containers.
- **Nothing stores a total.** Every sum is computed; `LandedCost` owns them all.
