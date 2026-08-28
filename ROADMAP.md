# ROADMAP — the one tracker

Consolidated 2026-08-18 from `improvements.txt`, `ROADMAP-datalayer-admin.md`,
`ROADMAP-next.md`, `ROADMAP-leads.md` and `ROADMAP-billing.md`, all deleted the same day —
git history has every one of them, and the two migration stories they told (the data layer
off Quickbase, the leads workflow) are finished work best read there.

Three documents now, each owning one question:

| File | Owns |
|---|---|
| **ROADMAP.md** | What is worth doing, and the designs for it |
| **HANDOFF.md** | What is true right now — state, next actions, sharp edges |
| **DEPLOY.md** | How a release physically happens |

Item numbers are ids, not priorities — they survive from the old tracker so that old
commits, notes and conversations still resolve.

---

## OPEN — roughly in the order they earn their keep

### Product & revenue

- [ ] **3. Popular presets / quick-start bundles in the configurator.** 3–4 ready-made
  configurations to pick and tweak; fights choice overload. Partly addressed by the
  home-page configurator strip, which makes the FIRST choice for the visitor.
- [ ] **5. Financing / total-cost calculator.** Monthly payment estimate; clear "included
  vs quote-on-review" breakdown. Cheaper now: the prices page already computes finished
  totals per model.
- [~] **21. Billing & procurement on Azure SQL** — **BUILT, SHIPPED, THEN PULLED BACK OUT
  (2026-08-19).** The team decided migrating billing off Quickbase is too much change to
  absorb right now. It is not a failed design: it worked, the Quickbase data imported
  cleanly, and it was verified in production before being archived. All of it —
  entities, services, endpoints, five screens, the importer, the dashboard and 43 tests —
  lives in **`_archive/billing-2026-08-19/`**, which is outside both projects and is
  neither built, bundled nor published. Its README carries the restore steps and every
  business rule that was settled with the owner (the VAT reclaim split, USD-in/EUR-out, the
  per-shipment rate, by-value freight allocation, the snapshot unit cost).

  **What is still live:** nothing of the sales half under its own name — `Sale` was merged
  into `Purchase` on 2026-08-20 (see #27) and the `/admin/sales` screen went with it; what
  it did lives on as the **Поръчки** board. **What is still in the production database:** the six billing
  tables and their imported rows — `DropBillingTables` exists and is deliberately
  unapplied. **The clock that matters:** the importer only works while the Quickbase token
  lives (~Feb 2027); after that, restoring means re-entering by hand.

- [~] **27. Order tracking** — **BUILT 2026-08-20.** `Purchase` is now the one record of
  what a customer bought: `Sale` was merged into it (quantity + the four sale-expense
  columns; unit price is FinalPrice/Quantity, computed) and retired, so order tracking has
  exactly one row to hang a status off.

  What shipped: an eight-step status (`OrderStatuses` — placed → fabricating → scheduled →
  travelling → at-harbor → ready → delivered, with cancelled deliberately OFF the
  timeline), the two expected dates the owner named (at harbour, ready for delivery),
  carrier fields, an admin **Поръчки** board that doubles as the report (customer, model,
  deposit, final price, left to pay, factory), a per-order tracking link minted on demand,
  and the public page at `/order/{code}` — noindex, no money, no identity, carrier block
  shown only while the goods are actually moving.

  **Carrier feeds are MANUAL for now.** Maersk and the other lines do publish tracking
  APIs, but they need a commercial account and credentials this system does not have. The
  columns are shaped for a feed to fill later (`CarrierName`, `TrackingReference`,
  `CarrierNote`, `CarrierCheckedAt`); staff type them meanwhile, and the note stamps its
  own "as of" date so a stale one reads as stale. **To automate: get API credentials from
  the carrier, then one poller fills those four columns — nothing else changes.**

  Still to settle, and it is the operational risk the original sketch already named:
  **who moves the status, and as part of what routine.** A stale public page is worse than
  none.

### Content & trust (the compounding bets)

- [ ] **6. Content engine** *(in progress)*. Technical SEO is done; what is left is
  genuinely content: product pages are ~135 words, `/en/modular-houses` is 278, and the
  two comparison articles („сглобяема къща или тухла", „колко струва сглобяема къща") are
  low-difficulty, high-intent, and both feed the prices page internally.
- [ ] **7. Trust & proof.** Case studies with real timelines/photos, a "homes delivered"
  counter, warranty/certifications page, embedded Google reviews.

### Platform & polish

- [ ] **8. PWA** — service worker via vite-plugin-pwa; installable, fast repeat visits.
- [ ] **9. Per-breakpoint `srcset`** *(the open half of the performance pass)*. Images are
  WebP, capped at 2560px, served from our origin with a year of immutable caching — but a
  phone still downloads the desktop-sized file.
- [ ] **10. Accessibility audit.** The EU Accessibility Act applies since June 2025.
- [ ] **11. Greek translation completeness audit.**
- [ ] **13. @vitejs/plugin-react upgrade path** (v6 supports vite 8) — only when needed.

### Infrastructure

- [ ] **17. The app's SQL login is still `dbadmin`** — the server administrator, far more
  privilege than it needs. Should become a contained user with read/write on the app's
  tables only. Carried since the start of the migration.
- [ ] **18. Managed identity for Blob** instead of a stored account key — removes the
  secret and its expiry entirely.
- [ ] **19. Secret expiry ~2027-02-04**: Entra client secret, Graph credentials, Quickbase
  token. Each fails silently and partially — see the table in HANDOFF.md. Calendar
  reminder territory, not code.

---

## Documents section — the design (#16)

Scoped 2026-08-20 by reading the gallery image pipeline end to end, mapping every PDF
reference in the SPA, and then attacking the result. **Stages 1–3 are built** (see the
open-list entry); the four questions below are all ANSWERED and their answers are baked
into the code. Kept for the reasoning.

### What is true today

Six PDFs sit in `NVC Claude version/public/modular-builds/` and are copied wholesale into
the published site by Vite. Eight distinct hrefs point at them from four pages in three
languages — and the pages do not agree with themselves: `ModularBuildsPage.jsx:6-9`
percent-encodes the filename, `ModularHousesPage.jsx:14` does not, `modularBuilds.js` stores
a bare filename while `steelHouses.js` and `interiors.js` store `modular-builds/...`. Two of
the six are not data at all — they are hard-coded hrefs in `ModularHousesPage.jsx` at lines
19 and 25, and they are the two biggest files (19 MB of the 22.7 MB total).

The filenames are Cyrillic, with spaces and typographic quotes. That is survivable as a
static path and is exactly the wrong thing to turn into a storage key.

### The shape

Bytes in Blob, facts in SQL, a screen in the panel — the gallery pipeline, pointed at PDFs.

**The one idea that carries the design: the public URL is a slug, and it never changes.**
`/api/brochures/villa-office.pdf`. Replacing a brochure writes a NEW blob under a NEW GUID
key and repoints the row; the address is untouched. This matters because twelve prerendered
snapshots carry these links as literal text — if the URL moved on every replacement, every
replacement would silently stale the snapshots, and `check-prerender-freshness.mjs` would not
notice (verified: it matches only `/assets/*.js|css`).

### Where the bytes live, and why it cannot leak

The existing **`images` container**, under a new `brochures/` prefix, through a new
`PublicDocumentStore`. NOT the `lead-files` container — that one holds purchase invoices
carrying ЕГН and addresses.

Neither container is anonymously readable in Azure; both are created `PublicAccessType.None`.
**The public/private split here is an application-layer fact, not a storage one**:
`BlobImageSource` (images) is read by the unauthenticated `ImagesController`, while
`LeadFileStore` (lead-files) is only ever read by AdminOnly controllers that address files by
ROW ID, so the blob key never reaches a browser. A brochure route must therefore be as
paranoid as `ImagesController` is:

- `PublicDocumentKey.IsValid` requires the `brochures/` root, checked as the first line of the
  read action — the way `ImagesController.cs:34` does it even though every key it serves was
  minted by us.
- A startup guard that fails fast if `BLOB_LEAD_FILES_CONTAINER` ever equals
  `BLOB_IMAGES_CONTAINER`. Both are free text today, and `LeadFileStoreTests` only pins that
  they differ BY DEFAULT.

**Do not count "the allow-list is .pdf only" as a mitigation.** Every dangerous document here
is already a PDF — `PurchaseFileKinds` names contracts and delivery notes among them. The real
control is the wired-slug rule below: under replace-only there is no "add" button, so there is
nowhere to put a contract.

### The entity

One table, `PublicDocument`, in the usual idiom: `int` id, `Slug` (unique, ASCII, write-once),
`Title`, `FileName` (the label a customer sees when saving, never the key), `BlobKey`,
`SizeBytes`, `ContentType`, `SortOrder`, `IsActive`, `CreatedAt`/`UpdatedAt`/`UpdatedByUpn`.
No `Page` column — `#page=3` belongs on the link, where it already lives. No `HouseId`: a
brochure is free-standing, addressed by slug. Audited (`AuditedEntities.Included`), which gives
replacement history for free.

### The blocker the review caught, and its fix

**The panel as first designed could 404 a live marketing page in one click.** Retire, delete and
slug-edit are each unguarded against a slug that four pages and twelve snapshots hard-code.
`IsActive = false` does not remove the button — it turns it into a 404, and nothing notices: not
a test, not the freshness guard, not the publish. Same silent broken-reference class as the
2026-08-18 outage.

So: a readonly `WiredSlugs` list in the API naming the six the content files use. `Slug` is
accepted on POST and ignored on PUT. DELETE and `IsActive = false` answer 400 for a wired slug.
The panel row shows which pages a document appears on. **Replace becomes the only button that is
safe, which is also the only one the owner actually needs.**

### Stages, each shipping alone

Status 2026-08-28: ALL DONE — 1 shipped 2026-08-21, 2–3 built, imported and published the
same day (migration applied, six PDFs carried into Blob + SQL, `deploy-2026-08-28`), 4
built the same afternoon (pages on the slugs, locale threaded through nine routes, the six
PDFs deleted, the catalogue README repointed at the panel), 5 dissolved by answer 2.

1. **Make all six look the same** — lift the two hard-coded hrefs into the content files, one
   shared URL helper instead of two that disagree, one path convention. No API, no database, no
   Azure. *Small, and independent of every question below.* Without it, anyone implementing #16
   migrates four of six brochures and leaves the two biggest behind.
2. **Storage, API, panel screen** — invisible to the public site. Entity, migration, store,
   services, `AdminDocumentsController`, `BrochuresController`, `AdminDocumentsPage.jsx`, four
   edits in `AdminShell.jsx`. Include from the start: key validation on the read path; an `ETag`
   taken from the BlobKey GUID (it changes on replacement and never otherwise, so it is a correct
   strong validator); `Range` forwarding, because Chrome's PDF viewer uses it and the 16.5 MB
   brochure sits on the page whose whole purpose is that brochure; and a streamed upload rather
   than buffering 16 MB.
3. **Import the six** into Blob and SQL, idempotently.
4. **Point the pages at the slugs** — the old files stay in `public/` throughout. Budget for the
   locale, which is the part that is not one edit in `brochure.js`: answer 4 puts `?lang=` in the
   public URL, and three of the four pages that call `brochureUrl` have no locale in scope to
   give it. `SteelHousesPage({ content })` and `InteriorsPage({ content })` take none, and there
   is no locale context in the app (`src/context` holds only ModalActions and Theme) — so this
   stage is also a new prop on two page components and six route files. The cheap way out at
   that moment is to omit the argument, which is silent: the helper still builds a valid URL and
   the API still answers, with the Bulgarian edition, for every EN and EL visitor forever, while
   the owner uploads translations that nothing serves. Pin it with a test that one brochure
   resolves to three distinct hrefs across bg/el/en — an assertion stage 1 cannot make, because
   the static path has no language in it.
5. **Redirects** for the six old URLs, then the files can go.

`verify-brochures` must run SOURCE → ROWS, the way `MigrationVerifier` actually works (it regexes
the SPA source and checks blob existence; it makes no HTTP calls). Rows → HTTP proves the wrong
direction: the failure that will happen is a content file naming a slug no active row has.

### ANSWERED BY THE OWNER — 2026-08-20

1. **Replace-only.** In the owner's words: *"these are our current catalogues, however we update
   them from time to time"* — which is replacement, not authoring. The screen is a fixed list of
   six rows with one Replace button each. No add, no delete, no page-picker.

   The owner asked whether a seventh catalogue could still be added one day. It can, and this is
   why the answer costs nothing: **a new catalogue arrives with a new page**, and building a page
   is a development job in any case — copy in three languages, a route, a layout. Adding a row to
   this table during that work is minutes. The self-service alternative would build a
   "which page does this appear on" concept now, for a situation that never arrives without a
   developer already present.

2. **The six current URLs do NOT need to keep working.** No redirects, and stage 5 disappears —
   the six PDFs are deleted once the pages point at slugs. Cheaper and simpler than the default
   this design assumed.

   **The six PDFs, not the folder.** `public/modular-builds/` also holds `card.svg`, which is
   the `onError` fallback in `GlideServices`, `HeroShowcase`, `ProcessTicker`, `ServiceTiles`,
   `InteriorsPage`, `InternalDoorsPage`, `ModularBuildsPage`, `ModularHousesPage` (twice) and
   `SteelHousesPage`, and `hero.svg`, which nothing references. A fallback fires only after the
   primary image has already failed, so it renders in no test and on no smoke click: deleting
   the directory wholesale would surface as a broken-image icon across the public site on the
   first day Cloudinary or `/api/img` has a bad minute — precisely the day the fallback was
   there for. `rm public/modular-builds/*.pdf`, and the folder stays for the placeholder art.

3. **"Gone from the website" is enough.** `IsActive = false` stops the public URL resolving; the
   bytes stay in Azure. No hard delete, no blob cleanup. (Which is also what makes the wired-slug
   rule bearable: retiring is the reversible action, and for the six wired slugs it is refused
   anyway.)

4. **Three editions per brochure — BG, EN, EL.** The owner will produce the translated PDFs
   themselves; nothing here translates anything.

   So the entity gains a `Lang` column after all, and the slug stops being unique on its own:
   the unique key is **(Slug, Lang)**. A brochure is therefore a slug with up to three files
   behind it.

   **The public route falls back rather than 404ing:** `/api/brochures/{slug}.pdf?lang=el`
   serves the Greek edition if one exists and the Bulgarian one if it does not. A Greek visitor
   gets a real catalogue from day one, in Bulgarian, and starts getting the Greek edition the
   moment it is uploaded — with no code change and no page edit, because the URL does not move.
   Fallback order: requested language, then `bg`, then whatever edition exists.

   The panel row becomes six rows with three slots each, the way the purchase documents screen
   groups Проформа and Фактура under each payment — an empty EN or EL slot reads as
   "not translated yet", which is a true and useful thing for the screen to say.

### The catalogue pipeline writes one of these files — found 2026-08-20, after the review

The Бокс brochure is not a file anybody drops in. `scripts/catalogue/README.md:25` documents the
last step of the catalogue→configurator pipeline as:

```bash
python compress_brochure.py "<source.pdf>" "../../public/modular-builds/Разгъваеми “Бокс” Къща.pdf"
```

That script re-encodes the 82.5MB Canva export down to 16.5MB and writes it **straight into the
directory this design deletes**. So the move must land there too, or the next catalogue rebuild
silently writes a file nothing serves. `compress_brochure.py` keeps its job — compress to a local
path — and the README's final instruction becomes "upload the result in the panel". Worth doing
in the same stage that empties the folder, so the two never disagree.

### Not doing

A public "list all documents" endpoint nobody calls; a reorder endpoint for a list of six that
no page orders by; redirects for the old URLs (answer 2); hard delete or blob cleanup (answer 3);
and any attempt to translate a brochure — the owner supplies the EN and EL editions.

---

## Billing & procurement — the design (#21)

Written 2026-08-17 from the owner's description of the Quickbase tables; formula and
currency confirmed the same day. **A design to react to — nothing here exists in code.**
The field-builder mobile app is ON HOLD (owner, 2026-08-17); expenses enter through the
panel, which is why attribution columns appear throughout.

### What the business needs from it

1. **Track procurement**: cycles → containers → what was in each container at what factory
   cost, plus the freight and border costs that make up the true landed cost.
2. **Track operating expenses**, categorised, dated, attributed.
3. **A dashboard**: costs, revenue, margin — against targets per month, fiscal cycle and
   year.
4. Later: field builders submitting expenses from their own app.

### The domain

```
BuyCycle 1──* Shipment 1──* PurchaseLot *──1 ProductModel ?──1 House (gallery)
                 │
                 ?──1 Factory (existing supplier directory)

Purchase (existing, sales side)          OperatingExpense          Target
```

### The pricing formula — confirmed 2026-08-17

**VAT applies to the landed value, customs included** (owner: *"the VAT is on the whole
price — purchase lots, shipments and customs"*):

```
LandedBase = SUM(lot.Quantity × lot.UnitCost) + FreightCost + CustomsDuty + OtherCosts
Price      = LandedBase × MarkupCoefficient  +  LandedBase × BorderVatRate
```

With lots $10,000, freight $2,000, customs $500 (base $12,500): `12,500 × 2.7 = 33,750`,
plus `12,500 × 0.20 = 2,500` → **$36,250**. Since both terms multiply the same base, this
collapses to **`LandedBase × 2.9`** — worth checking against a real container's actual
price before the dashboard is built on it.

**`2.7` and `0.20` are data, not code** — they live on `BuyCycle`, defaulted from the
previous cycle, so last year's dashboard reproduces with last year's coefficients.

### Currency — confirmed 2026-08-17

**The buy side is USD; everything else, and every report, is EUR.** Procurement amounts
are stored in USD as paid, with the conversion rate ON THE SHIPMENT (`UsdToEurRate`
decimal(18,6), plus `RateSource`/`RateAt`), and EUR is computed, never stored. One global
rate would silently re-value historical containers every time it changed; a per-shipment
rate makes every past cycle reproducible forever. `Purchase` (sales) and
`OperatingExpense` are already in the reporting currency and need no rate.

### Entities

Conventions as everywhere: `int` ids, money `decimal(18,2)`, dates at midnight UTC,
`CreatedAt`/`UpdatedAt`/`UpdatedByUpn`, `IsActive` soft-retire, and **no stored derived
values** — every total is computed (the `LeftToPay` rule).

**BuyCycle** — `Label` (string(100), required, "2026 C1"), `StartDate`/`EndDate` (date),
`MarkupCoefficient` + `BorderVatRate` (decimal(9,4), see formula), `IsClosed` (drops out
of "add shipment" dropdowns; nothing refused or deleted), notes + audit fields.

**Shipment — one container** — `BuyCycleId` (required FK), `Reference` (string(100),
container / bill-of-lading number), `FactoryId` (int? FK, **reuses the existing Factory
directory**), `FreightCost` / `CustomsDuty` / `ImportVatPaid` / `OtherCosts` (decimal?,
all USD; duty is not VAT, and `ImportVatPaid` records what the border ACTUALLY assessed),
`OrderedAt`/`DepartedAt`/`ArrivedAt` (date? — lead-time tracking falls out free; no Status
column, status is derivable from which dates are filled), `UsdToEurRate` + `RateSource` +
`RateAt`, notes + audit fields. **No `GoodsCost` column** (= SUM of lots) and **no EUR
columns** (= usd × rate): stored, they become the copy people read while the parts drift.

**ProductModel — the catalogue at factory cost** — `Name` (string(200), required),
`CategoryKey` (string(60), same loose key set as `PurchaseCategories`), `HouseId` (int?
FK → House: **the id-link to the gallery when it is a catalogue model; retail stays on
the gallery row, this table holds cost only** — two free-standing price lists is the
73 m² incident; null for materials), `FactoryPrice` (decimal?, USD, the current REFERENCE
used to prefill new lots — editing it never rewrites history), `IsActive`, notes + audit.

**PurchaseLot — the line item** — `ShipmentId` + `ProductModelId` (required FKs),
`Quantity` (int, > 0), `UnitCost` (decimal, required, USD, **a snapshot at purchase
time** — a factory price correction next year must not silently reprice last year's
containers), notes + audit. No `LineTotal`.

**Sales — extend `Purchase`, do not build a rival.** `Purchase.cs` already says billing
should build on it. The one sketch on the table: a `SaleAllocation` link
(`PurchaseId ── PurchaseLotId, Quantity`) which yields **stock on hand** (bought −
allocated) and **true per-unit margin** with no new workflow beyond "pick which container
it came from" at sale time. Phase 2; needs the owner's yes.

**OperatingExpense** — `SpentAt` (date, required — drives the monthly rollup),
`CategoryKey` (string(60), static list served by the API; proposed: `salaries`, `rent`,
`transport-fuel`, `marketing`, `utilities`, `tools-equipment`, `fees-taxes`, `other`),
`Amount` (decimal, required, EUR), `VatAmount` (decimal?), `Description` (string(400)),
`SubmittedByUpn` (attribution from day one — the column the future field-builder app
writes), notes + timestamps. **Deliberately no `BuyCycleId`**: opex is monthly by nature,
a cycle view is a date-range query. Receipt attachments: phase 2 on the `PurchaseFile`
pattern.

**Target** — `PeriodType` (`month` | `cycle` | `year`), `Year` (int?), `Month` (int?),
`BuyCycleId` (int? FK), `MetricKey` (string(60); proposed: `revenue`, `gross-margin`,
`net-result`, `opex-cap`, `units-sold`), `TargetValue` (decimal, EUR), audit fields.
Unique on `(PeriodType, MetricKey, Year, Month, BuyCycleId)` — one target per metric per
period, updated in place, so the dashboard never picks between two answers.

### The dashboard — everything derived, nothing stored

Every figure in EUR, converted with the shipment's own rate.

| Metric | Computed from |
|---|---|
| Landed cost per shipment | (lots + freight + duty + other) × rate |
| Landed cost per unit | shipment costs allocated across lots — by value share by default |
| Suggested retail | `LandedBase × (Markup + BorderVat)` |
| Margin per model | gallery retail (via the `HouseId` link) vs landed cost |
| Revenue per month/cycle/year | `Purchase.PurchasedAt` + `FinalPrice` |
| Opex per period | `OperatingExpense.SpentAt` rollup |
| Everything vs target | the `Target` rows for that period |

### How it gets built

The proven path: **entities → one migration → static key lists served by the API → store +
AdminOnly endpoints → importer with `--dry-run` → panel screens → staff switch over.**

Easier than every previous migration: **no public read path**, so no `DATA_SOURCE_*` flag,
no fallback chain, no cutover that can break a customer — Quickbase just becomes the old
copy that stops being updated. Harder in the one way that matters: it is a daily staff
workflow (the leads lesson), so the panel must cover what staff actually do in Quickbase
before anyone is asked to move. **And the import must run while the Quickbase token lives
(~Feb 2027).**

Suggested panel shape: Cycles list → cycle page (shipments + totals vs target) → shipment
page (lots, costs, dates); Expenses (list + quick-add); Targets (one editor); Dashboard.

### The five questions — ANSWERED (owner, 2026-08-19)

1. **Border VAT is reclaimed as input VAT — but the reclaim base EXCLUDES customs.** In the
   owner's words: the VAT is reclaimed "on the total price of the shipment without the
   customs", and the reclaim then offsets the VAT owed on sales ("makes the sale VAT way
   less"). Now CODED in `LandedCost` — `ReclaimableVat`, `UnrecoverableVat`, `TrueCost` —
   after the VAT-base question resolved the same day (this formula was right; Quickbase
   was not).
2. **Freight allocation: by value.** Confirmed twice over — the owner's answer, and
   Quickbase's own `Allocated *` formulas, which all multiply by "Share of Shipment Goods
   Value". `LandedCost.Allocation.ByCount` survives only as a what-if lens.
3. **Expense categories: the live Quickbase list, verbatim.** 22 choices off the
   Operating Expenses table (bvuz3p5hs), including „Влади"/„Цецо"/„Ники" — the personal
   draws, which are categories on purpose. `ExpenseCategories.cs` now carries the full
   list plus the QB-label mapping the importer will use. The describe-what-it-was field
   the owner asked about already exists (`Description`).
4. **Periods: months inside a cycle, cycles against each other at year end.** All three
   `PeriodTypes` are real. Dashboard shape: monthly drill-down within a cycle view, and a
   cycle-vs-cycle comparison for the year view.
5. **`SaleAllocation`: yes — stock tracking is the point.** And it turns out Quickbase
   already RUNS this design: its Sales table (bvuz3pj9w, 32 records) is per-lot — qty, unit
   sale price (EUR), sale expenses (payment fees / BG transport / building & installation /
   other), COGS from the lot's landed unit cost, and a Customer link. Phase 2 should mirror
   that shape rather than invent one.

### The Quickbase app — table ids (pulled 2026-08-19, app `bvguw9swh`)

The billing six, named so clearly they map themselves:

| Quickbase table | id | records | SQL counterpart |
|---|---|---|---|
| Buy Cycles | `bvuz3dthx` | 6 | `BuyCycle` |
| Shipments | `bvuz3mm8e` | 9 | `Shipment` |
| Product Models | `bvuz3nu2v` | 9 | `ProductModel` |
| Purchase Lots | `bvuz3n862` | 20 | `PurchaseLot` |
| Sales | `bvuz3pj9w` | 32 | phase 2 (`SaleAllocation`) |
| Operating Expenses | `bvuz3p5hs` | 81 | `OperatingExpense` |

Also in the app, already migrated or out of scope: Houses/Wagons `bvguw9sxx`, Images
`bvguw9s2h`, WebSite Images `bvk4n834b`, Website Files `bvqfmmueg`, Offers/Quotes
`bvguw9s4y`, Questions `bvguw9s74`, Leads `bvucxewvr`, Lead Activities `bvucze2q3`,
Customers `bvwfq82rb`, Cases `bvxetssae`, Reviews `bvxeybcfy`, SavedConfigs `bv88xk7c2`,
House Configurations `bv5eeixxr`, Configuration Add-ons `bv5fxbza8`, Quotes `bv5fxqqut`,
Clients-old `bvix5jgtz`, Calls `bvnjhx7jx`, Expenses-Old `bvpd9em7n`.

Field schemas were pulled the same day (`GET /v1/fields?tableId=…`); re-fetch at import
time rather than trusting a copy.

### The schema-alignment decisions — RESOLVED (owner, 2026-08-19, same day)

The live Quickbase schema disagreed with the design in six places; the owner ruled on every
one, with one recurring theme — **"Quickbase was poorly built, so we made workarounds"** —
which means QB is the authority on WHAT was recorded, never on HOW it should be modelled:

1. **The VAT base: the formula here is correct, Quickbase's is not.** VAT applies to the
   whole landed base, freight included; QB charging it on goods + customs only was bad
   build, not business rule. So `LandedCost.SuggestedPrice` stands, and the reclaim rule is
   now CODED: `ReclaimableVat` (base minus customs, times rate — comes back by shrinking
   sales VAT), `UnrecoverableVat` (the customs slice — a true cost), `TrueCost` (base +
   unrecoverable only). A reconciliation against QB's historicals will show a per-container
   gap of ~freight × rate on the VAT figure and the full reclaimable slice on landed cost —
   both known, both accepted.
2. **Shipment costs stay USD.** The business genuinely pays shipment costs in dollars;
   QB's EUR-entry columns were the workaround, not the reality. Schema unchanged: USD
   amounts as paid, EUR computed at the shipment's own rate for every dashboard figure.
   The importer converts QB's EUR entries back using each shipment's own FX field.
3. **Opex → cycle link: added.** `OperatingExpense.BuyCycleId` (nullable, Restrict), in the
   regenerated migration, the service, and the panel (open cycles only in the dropdown).
   The deciding fact: QB cycles have no end date, so the explicit link is the only
   attribution that exists — 81 rows carry it and dates cannot reconstruct it. The QB
   invoice-file attachment stays phase 2 on the PurchaseFile pattern.
4. **No `InitialInvestment` on BuyCycle** — declined by the owner.
5. **No `DefaultSalePriceEur` on ProductModel** — declined: every customer's house is
   priced individually for its added features, so a per-model list price would be a number
   nobody could stand behind. Retail stays gallery-linked where a gallery row exists.
6. **Importer rule — ALL Quickbase cycles merge into ONE SQL cycle.** The six QB cycle
   rows are an artefact of the poor build, not six real cycles. The import maps every
   shipment (and cycle-linked expense) to a single cycle; its label is the owner's to
   pick at import time.

## DONE — newest first

- [x] **16. Documents section in the panel** (2026-08-28, all stages). The six brochures
  live in Blob + SQL behind `/api/brochures/{slug}.pdf` — an address that survives every
  replacement — with a three-slot-per-brochure panel screen (Брошури) where replacing a
  catalogue is one upload and no deploy. The public pages link the slugs and carry the
  visitor's language; the API falls back requested → bg → whatever exists, so the EN and EL
  editions start serving the moment the owner uploads them. The six PDFs are gone from
  `public/modular-builds/` (card.svg stays — it is the onError fallback nine components
  use), and the catalogue pipeline's compress step now ends "upload in the panel" instead
  of writing into a folder nothing serves. Design and the owner's four answers below.

- [x] **21a. Billing & procurement: data layer and API** (2026-08-19). Six tables, one
  additive migration, the landed-cost formula in one testable place, AdminOnly endpoints and
  70 tests. Deliberately backend-only: the panel screens are the next step, and the leads
  lesson says the panel must cover what staff actually do before anyone is asked to move off
  Quickbase. Not deployed; the migration is not applied.

- [x] **Publish guard against stale prerendered pages** (2026-08-19). The publish now fails
  loudly if the snapshots reference a bundle the build did not produce. Written the morning
  after that exact mismatch took the public site down for real — see HANDOFF.md.

- [x] **Public forms close on Send** (2026-08-18). Offer, question and doors-review forms
  close immediately; the request runs in the background with 5 attempts and backoff; a
  top-right banner (mobile: full-width) reports sending/retrying/sent/failed with retry.
  Analytics fire only on a confirmed send. Reason, in the owner's words: "we are getting
  spammed" — a button that appears to do nothing gets pressed again.
- [x] **15. Factory sheet into the panel** (2026-08-18). Entra sign-in instead of a
  password in the JS bundle; SQL rows instead of one browser's localStorage; edits
  audited. Form and printed page unchanged. Old URL redirects; old .json files still
  open; a sheet still in a browser's localStorage is offered as a one-time import.
- [x] **14. Audit log** (2026-08-18). EF interceptor capture (cannot be forgotten by the
  next feature); ЕГН never recorded — the log says a field changed, never to what;
  read-only API + Audit page + per-record History; retention = email a CSV to the owner
  at 6 months then delete, nothing deleted that was not provably sent first, OFF until
  `AUDIT_ARCHIVE_ENABLED=true`.
- [x] **22–26. The five lead-panel requests** (2026-08-17, deployed 2026-08-18): sheet
  auto-close on save; rich-text composer with auto signature (024 371 650); board filters
  (status + activity window); convert lead → customer (identity-only, idempotent,
  `Customer.LeadId`); assign to any user.
- [x] **20. www canonicalised** (2026-08-18). Managed cert issued after repointing the
  CNAME at the app hostname (a CNAME to the apex validates the domain but is NOT eligible
  for a managed cert); `www` 301s to the apex, path and query intact.
- [x] **Gallery slugs corrected** (deployed 2026-08-18). NFKC instead of NFKD — accents no
  longer decompose into hyphens; 16 of 42 product URLs fixed; every old URL 301s via the
  retained legacy algorithm.
- [x] **Services page retired** (deployed 2026-08-18). Was a soft 404 IN THE SITEMAP
  (path registered, route never was). All three URLs 301 to their locale homepage; a new
  test pins paths.js against App.jsx routes so the gap cannot recur.
- [x] **Saved configurator links on Azure SQL** (2026-08-15; import 2026-08-17; flag
  flipped 2026-08-18). **Quickbase has no live runtime path left.**
- [x] **Prices page** — /bg/ceni, /en/prices, /el/times (2026-08-15). Priced FROM the
  gallery; box assembly ADDED, a wagon's price already contains its €1000 assembly.
- [x] **Configurator strip on the home page** (2026-08-15).
- [x] **SEO audit and fixes** (2026-08-14/15): 42 product pages canonicalising to the
  homepage fixed at request time; 55-route body prerendering; FAQ schema; sitemap from
  paths.js; HSTS.
- [x] **Customers, factories and purchases in the panel** (2026-08-14).
- [x] **Leads pipeline** (2026-08-12/13): inquiry queue + pipeline, threads, attachments,
  follow-ups + due report, AI drafts; 257 CRM leads imported.
- [x] **Gallery + cases on Azure SQL, all images on Blob as WebP** (2026-08-06).
- [x] **Reviews on Azure SQL + the first admin panel** (2026-08-05).
- [x] 1. Funnel analytics (GTM). 2. Save & resume. 4. Speed-to-lead. 12. bin/obj hygiene.
  Mobile-first configurator redesign. Homepage testimonials.

## DELIBERATELY NOT DOING

- **Homepage H1 stays the slogan** „Защото домът не трябва да е лукс" even though it
  carries no target keyword. Brand copy in three languages; a business call.
- ~~Billing/invoicing stays in Quickbase~~ — reversed 2026-08-17 by #21. Kept as a line so
  the reversal is visible.
