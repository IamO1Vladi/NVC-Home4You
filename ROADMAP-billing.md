# Billing & procurement — data model design

Written 2026-08-17, from the owner's description of the Quickbase tables. **This is a design
to react to, not a schema that has shipped.** Nothing here exists in code yet. The
field-builder mobile app is **on hold** — expenses will be entered through the admin panel
for now, which is why attribution columns still appear below.

Companion to `improvements.txt` #21, which holds the settle-first questions. This file adds
the proposed structure and the reasoning; the questions it cannot answer are marked **OPEN**.

---

## What the business needs from it

1. **Track procurement**: cycles → containers → what was in each container at what factory
   cost, plus the freight and border costs that make up the true landed cost.
2. **Track operating expenses**, categorised, dated, attributed to who entered them.
3. **A dashboard**: how are we doing — costs, revenue, margin — **against targets set per
   month, per fiscal cycle, and per year**.
4. Later, not now: field builders submitting expenses from their own app.

## The domain, one line each

```
BuyCycle 1──* Shipment 1──* PurchaseLot *──1 ProductModel ?──1 House (gallery)
                 │
                 ?──1 Factory (existing supplier directory)

Purchase (existing, sales side)          OperatingExpense          Target
```

---

## The pricing formula — CONFIRM BEFORE RELYING ON IT

As described: *price = (purchase lots + shipment cost to warehouse), times 2.7, plus 20%
VAT because the goods cross the border from China.*

Two readings, and they differ by real money. With lots €10,000 and freight €2,000
(base €12,000, ×2.7 = €32,400):

| Reading | Formula | Result |
|---|---|---|
| **A** | (base × 2.7) × 1.20 — VAT on the marked-up price | **€38,880** |
| **B** | base × 2.7 + base × 0.20 — VAT on the border value | **€34,800** |

Customs practice says import VAT is assessed on the border value (goods + freight), which
is reading B's VAT base — but B then treats a recoverable input VAT as if it were part of
the sale price. Reading A is the usual retail-price shape. **OPEN: which is it?** (Related
OPEN, for the accountant: is the border VAT reclaimed as input VAT? If yes it is cash flow,
not cost, and the dashboard must not count it in margin.)

**Either way, `2.7` and `0.20` are data, not code.** They will change; the dashboard must
be able to reproduce last year's numbers with last year's coefficients. They live on
`BuyCycle`, defaulted from the previous cycle at creation.

---

## Entities

Conventions follow the existing tables: `int` identity ids, money as `decimal(18,2)`
configured in `AppDbContext`, dates stored at midnight UTC (`Purchase.PurchasedAt`
precedent), `CreatedAt`/`UpdatedAt`/`UpdatedByUpn` attribution, `IsActive` soft-retire
instead of delete (`Factory` precedent), and **no stored derived values** — the
`LeftToPay` rule. Every "total" below is computed, never a column.

### BuyCycle

| Field | Type | Why |
|---|---|---|
| `Id` | int | |
| `Label` | string(100), required | How staff name it — "2026 C1". |
| `StartDate` / `EndDate` | date | Aggregation boundary for the dashboard; **OPEN: how many cycles a year, and can they overlap?** |
| `MarkupCoefficient` | decimal(9,4) | The 2.7. Per cycle so history reproduces. |
| `BorderVatRate` | decimal(9,4) | The 0.20. Same reason. |
| `IsClosed` | bool | A closed cycle drops out of "add shipment" dropdowns; nothing is refused or deleted. |
| `Notes`, audit fields | | |

### Shipment — one container

| Field | Type | Why |
|---|---|---|
| `Id`, `BuyCycleId` (required FK) | | A container always belongs to a cycle. |
| `Reference` | string(100) | Container / bill-of-lading number — what people quote on the phone. |
| `FactoryId` | int?, FK | **Reuses the existing `Factory` supplier directory.** Nullable, same reasoning as `Purchase.FactoryId`. |
| `FreightCost` | decimal? | The "shipment cost to our warehouse" from the formula. |
| `CustomsDuty` | decimal? | Duty is not VAT; separate column or it silently vanishes into one number. |
| `ImportVatPaid` | decimal? | What the border **actually** assessed — a fact, recorded, not derived from the 20% (assessments differ from theory). |
| `OtherCosts` | decimal? | Port fees, inland haulage, inspection — with `Notes` saying what. |
| `OrderedAt` / `DepartedAt` / `ArrivedAt` | date? | Lead-time tracking falls out of these for free. No `Status` column — status is derivable from which dates are filled. |
| `Notes`, audit fields | | |

**No `GoodsCost` column.** It is `SUM(lot.Quantity × lot.UnitCost)` — stored, it becomes
the copy people read while the lots drift.

**OPEN — currency.** Factories in China are usually paid in USD. Proposal: all columns
hold **EUR as actually paid** (what left the account), original currency in `Notes`. A
proper `OriginalCurrency`/`OriginalAmount`/`Rate` triple is easy to add later if the
answer is "we need to see the USD".

### ProductModel — the catalogue at factory cost

| Field | Type | Why |
|---|---|---|
| `Id`, `Name` (string(200), required) | | |
| `CategoryKey` | string(60) | Same loose key set as `PurchaseCategories` — houses, wagons, materials. |
| `HouseId` | int?, FK → `House` | **The id-link to the gallery when the model is a catalogue model.** Retail price stays on the gallery row; this table holds cost only. Two free-standing price lists is the 73 m² incident. Null for materials. |
| `FactoryPrice` | decimal? | The **current reference** price, used to prefill new lots. Editing it never rewrites history — see `PurchaseLot.UnitCost`. |
| `IsActive`, `Notes`, audit fields | | |

### PurchaseLot — the line item

| Field | Type | Why |
|---|---|---|
| `Id`, `ShipmentId` (required FK), `ProductModelId` (required FK) | | |
| `Quantity` | int, required, > 0 | |
| `UnitCost` | decimal, required | **Snapshot at purchase time**, prefilled from `ProductModel.FactoryPrice`, editable. A factory price correction next year must not silently reprice last year's containers. |
| `Notes`, audit fields | | |

No `LineTotal` — `Quantity × UnitCost`.

### Sales — extend `Purchase`, do not build a rival

`Purchase.cs` already says it: *"When billing moves across it can build on this table
instead of replacing it."* The sales side of this domain **is** the existing entity —
customer, model, price, deposit, invoices, dated. A second sales table would fork the
truth.

**OPEN — what does "needs improvement" mean concretely?** One suggestion that unlocks the
dashboard's best numbers: a small allocation table linking a sale to the physical unit it
was fulfilled from —

```
SaleAllocation: PurchaseId ── PurchaseLotId, Quantity
```

That single table yields **stock on hand** (units bought − units allocated) and **true
per-unit margin** (sale price vs that unit's landed cost) with no new workflow beyond
"pick which container it came from" at sale time. Phase 2; needs the owner's yes.

### OperatingExpense

| Field | Type | Why |
|---|---|---|
| `Id` | | |
| `SpentAt` | date, required | Drives the monthly rollup. |
| `CategoryKey` | string(60) | Static list served by the API like `PurchaseCategories` (two hand-maintained copies drift). Proposed keys: `salaries`, `rent`, `transport-fuel`, `marketing`, `utilities`, `tools-equipment`, `fees-taxes`, `other` — **OPEN: correct list?** |
| `Amount` | decimal, required | |
| `VatAmount` | decimal? | Nullable — recorded when it matters, never guessed. |
| `Description` | string(400) | |
| `SubmittedByUpn` | string(320) | Attribution from day one — this is the column the future field-builder app writes, and the audit-log argument in miniature. |
| `Notes`, `CreatedAt`, `UpdatedAt` | | |

**Deliberately no `BuyCycleId`.** Opex is monthly by nature; a cycle view of expenses is a
date-range query, and storing the link would make every expense answer a question twice.
Receipt attachments: phase 2, on the `PurchaseFile` pattern (private container, AdminOnly
read path).

### Target

| Field | Type | Why |
|---|---|---|
| `Id` | | |
| `PeriodType` | string: `month` \| `cycle` \| `year` | |
| `Year` | int? | Set for `month` and `year`. |
| `Month` | int? | Set for `month` only. |
| `BuyCycleId` | int?, FK | Set for `cycle` only. |
| `MetricKey` | string(60) | Static list again. Proposed: `revenue`, `gross-margin`, `net-result`, `opex-cap`, `units-sold`. |
| `TargetValue` | decimal, required | |
| audit fields | | |

Unique index on `(PeriodType, MetricKey, Year, Month, BuyCycleId)` — one target per metric
per period, updated in place, so the dashboard never has to pick between two answers.

---

## The dashboard — everything derived, nothing stored

| Metric | Computed from |
|---|---|
| Landed cost per shipment | lots + freight + duty (+ border VAT **only if** the accountant says it is a cost) |
| Landed cost per unit | shipment costs allocated across lots — **by value share** by default (**OPEN**: or by unit count?) |
| Suggested retail | the cycle's formula, once A/B is confirmed |
| Margin per model | gallery retail (by the `HouseId` link) vs landed cost |
| Revenue per month/cycle/year | `Purchase.PurchasedAt` + `FinalPrice` |
| Opex per period | `OperatingExpense.SpentAt` rollup |
| Everything vs target | the `Target` rows for that period |

Monthly and yearly rollups key on dates; cycle rollups key on the FK chain. Both are
`GROUP BY`, no new storage.

---

## How it gets built — the proven path, minus its hardest step

The order every migration here has followed: **entities → one migration → static key lists
served by the API → store + AdminOnly endpoints → importer with `--dry-run` → panel
screens → staff switch over.**

What makes this one *easier* than gallery/leads/saved-configs: **no public read path.**
Nothing on the website reads procurement data, so there is no `DATA_SOURCE_*` flag, no
fallback chain, no cutover moment that can break a customer. Quickbase simply becomes the
old copy that stops being updated.

What makes it *harder*: it is a daily staff workflow (the leads lesson), so the panel
screens must cover what staff actually do in Quickbase before anyone is asked to move —
and **the import must run while the Quickbase token lives (~Feb 2027)**.

Suggested panel shape: Cycles list → cycle page (shipments + cycle totals vs target) →
shipment page (lots, costs, dates); Expenses (list + quick-add form); Targets (one editor
page); Dashboard (the rollups above). Sequencing with the rest of the backlog: **audit log
(#14) first** — money records created by several people need "who changed what" before the
records exist, not after.

## Open questions, gathered

1. Pricing formula: reading **A or B**? And is border VAT reclaimed (cost vs cash flow)?
2. Cycles per year, and their boundaries — can they overlap a month boundary?
3. Currency: is "EUR as paid, USD in notes" enough, or is the USD amount itself needed?
4. The opex category list — right set?
5. "Sales needs improvement" — does the `SaleAllocation` sketch match the intent?
6. Freight allocation per unit: by value share or by count?
