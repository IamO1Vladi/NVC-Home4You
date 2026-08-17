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

## The pricing formula — confirmed 2026-08-17

**VAT applies to the landed value, not to the marked-up price**, and the landed value
includes customs. Owner's words: *"the VAT is on the whole price — purchase lots, shipments
and customs."* So:

```
LandedBase = SUM(lot.Quantity × lot.UnitCost) + FreightCost + CustomsDuty + OtherCosts
Price      = LandedBase × MarkupCoefficient  +  LandedBase × BorderVatRate
```

With lots $10,000, freight $2,000, customs $500 (base $12,500):
`12,500 × 2.7 = 33,750`, plus `12,500 × 0.20 = 2,500`, giving **$36,250**.

**Sanity check worth doing against a real container**, because it collapses to one number:
since both terms multiply the same base, `Price = LandedBase × (2.7 + 0.20)` =
**`LandedBase × 2.9`**. If that does not match how a real price was actually set, the
formula above is wrong and this is where it shows.

**`2.7` and `0.20` are data, not code.** They will change; the dashboard must reproduce
last year's numbers with last year's coefficients. They live on `BuyCycle`, defaulted from
the previous cycle at creation.

**OPEN, for the accountant, and it changes the dashboard rather than the price:** is the
border VAT reclaimed as input VAT? If it is, it is cash flow and not a cost, so it must not
be subtracted in margin — even though it is charged on. The formula above is unaffected
either way.

## Currency — confirmed 2026-08-17

**The buy side is USD. Everything else is EUR. Reports are EUR.** Goods come from China
and are paid in dollars; sales, operating expenses and every dashboard figure are euros.

So procurement amounts are **stored in USD as paid**, with the conversion rate recorded on
the shipment, and EUR is **computed** — never stored, on the no-derived-values rule:

| On `Shipment` | Type | Why |
|---|---|---|
| `UsdToEurRate` | decimal(18,6), required | The rate for **this** shipment. Six decimals because FX rates need them. |
| `RateSource` | string(200)? | Where it came from — the bank's rate on the payment, the customs rate, a manual figure. Two shipments a week apart will disagree, and someone will ask why. |
| `RateAt` | date? | Which day's rate it is. |

`PurchaseLot.UnitCost` and every `Shipment` cost column are USD. `Purchase` (sales) and
`OperatingExpense` are EUR and need no rate — they are already in the reporting currency.

**The rate belongs on the shipment, not in a global settings row.** One rate for the whole
system would silently re-value historical containers every time it was updated, which is
the same failure as storing a derived total: the number people read stops matching the
number that was paid. A per-shipment rate makes every past cycle reproducible forever.

**`Target.TargetValue` is EUR**, like every other reported figure.

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
| `UsdToEurRate` | decimal(18,6), required | See **Currency** above. All cost columns on this table are **USD**; EUR is computed. |
| `RateSource` / `RateAt` | string(200)? / date? | Where the rate came from, and for which day. |
| `Notes`, audit fields | | |

**No `GoodsCost` column.** It is `SUM(lot.Quantity × lot.UnitCost)` — stored, it becomes
the copy people read while the lots drift.

**No EUR columns either**, for the same reason: `usd × UsdToEurRate`.

### ProductModel — the catalogue at factory cost

| Field | Type | Why |
|---|---|---|
| `Id`, `Name` (string(200), required) | | |
| `CategoryKey` | string(60) | Same loose key set as `PurchaseCategories` — houses, wagons, materials. |
| `HouseId` | int?, FK → `House` | **The id-link to the gallery when the model is a catalogue model.** Retail price stays on the gallery row; this table holds cost only. Two free-standing price lists is the 73 m² incident. Null for materials. |
| `FactoryPrice` | decimal? | **USD.** The **current reference** price, used to prefill new lots. Editing it never rewrites history — see `PurchaseLot.UnitCost`. |
| `IsActive`, `Notes`, audit fields | | |

### PurchaseLot — the line item

| Field | Type | Why |
|---|---|---|
| `Id`, `ShipmentId` (required FK), `ProductModelId` (required FK) | | |
| `Quantity` | int, required, > 0 | |
| `UnitCost` | decimal, required | **USD**, and a **snapshot at purchase time** — prefilled from `ProductModel.FactoryPrice`, editable. A factory price correction next year must not silently reprice last year's containers. |
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

Every figure below is **EUR**, converted with the shipment's own `UsdToEurRate`.

| Metric | Computed from |
|---|---|
| Landed cost per shipment | (lots + freight + duty + other) × rate |
| Landed cost per unit | shipment costs allocated across lots — **by value share** by default (**OPEN**: or by unit count?) |
| Suggested retail | `LandedBase × (Markup + BorderVat)` — see the formula section |
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

**Answered 2026-08-17:** the pricing formula (VAT on the landed value including customs —
`base × 2.9` as one number, worth checking against a real container) and currency (buy side
USD with a per-shipment rate, everything reported in EUR).

Still open:

1. Is border VAT reclaimed as input VAT? Changes the **dashboard** (cost vs cash flow), not
   the price.
2. Cycles per year, and their boundaries — can a cycle straddle a month boundary?
3. The opex category list — right set?
4. "Sales needs improvement" — does the `SaleAllocation` sketch match the intent?
5. Freight allocation per unit: by value share or by count?
