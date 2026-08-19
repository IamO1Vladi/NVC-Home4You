# Where things stand — 2026-08-19

**Start here.** This is the one handoff file — consolidated 2026-08-18 from the dated
handoffs (git history has them). `ROADMAP.md` owns what is worth doing next; `DEPLOY.md`
owns release mechanics, **including §6b, the prerender step, which silently ships stale
pages when skipped**.

Tests: **709 .NET, 252 frontend.**

---

## State of play

| | |
|---|---|
| **Live** | `791896a` (tag `deploy-2026-08-19b`) — the whole buy side: procurement/cost-prices/expenses/targets screens, imported Quickbase data, inline lot editing. Verified from outside: public pages serve prerendered content, bundle + AdminProcurementPage chunk serve as `text/javascript`, all five new APIs 401 anonymous. |
| **`production` branch** | `791896a` = live. |
| **`master`** | `791896a` = `production`. Both pushed. |
| **Migrations** | None pending. `AddBillingAndProcurement` applied to production 2026-08-19 (additive; live code does not read the new tables until the next publish). `AddAuditLog` and `AddFactorySheets` applied and live. |
| `DATA_SOURCE_SAVEDCONFIGS` | **=sql, set by the owner 2026-08-18. Quickbase has no live runtime path left.** The token's ~Feb 2027 expiry now only matters for the import tooling (relevant to ROADMAP #21). |

**Probe production before believing a deployment claim in this file.** This section has
been wrong before (17 Aug: two "not deployed" fixes were live — the publish had been made
from a pre-squash working tree, so no commit mapped to the zip and `production..master`
was empty either way). Checking the live site settles such questions in a minute.

## Do next

1. **The delayed publish is DONE** — tagged `deploy-2026-08-19`. `production` has since been
   fast-forwarded onto the publish guard (`6645457`), which is build-only and can ship with
   whatever goes next; DEPLOY.md owns the steps. What may still be outstanding is the
   post-publish walkthrough: sign in and look at **Одит** (edit something small first) and
   **Фабрични поръчки** — and on whichever browser held the old factory sheet, accept the
   import banner so the localStorage copy reaches SQL.
2. **Search Console, the remainder**: request indexing for the 26 clean product URLs
   (~10/day), then the 16 corrected ones from a fresh `sitemap-gallery.xml`. **The two title
   fixes are done** — verified 2026-08-19 against the live `/api/gallery`: no `Panaromic`
   survives, and no otherwise-Latin string in the payload contains a Cyrillic character.
   Nothing is left here but the indexing requests themselves.
3. **Billing & procurement (#21): LIVE.** Imported data + all four screens published
   2026-08-19 (`deploy-2026-08-19b`) and verified from outside. Remaining, in order:
   - **Owner: type the markup (×2.7)** into cycle "2024-2026" in Доставки — Quickbase
     never stored one, so no container shows a suggested price until it is set. Border
     VAT 0.20 came across. Then eyeball one container against Quickbase.
   - **Phase 2: the Sales table** (QB `bvuz3pj9w`, 32 rows, still uncopied — mirrors the
     QB shape: per-lot sale, unit price EUR, sale expenses, customer link). Stock on hand
     = bought − sold falls out of it; the owner asked for sales reports 2026-08-19.
   - **The dashboard**: costs / revenue / margin / stock vs the Цели targets, per month,
     cycle and year. All arithmetic questions are settled; LandedCost holds the pieces.
   - The 79 invoice files still in Quickbase (attachments on expenses, PurchaseFile
     pattern) — before the token dies ~Feb 2027.

   - **Apply the migration**: `dotnet ef database update` against the production database.
     Additive and unread by live code, so it can go ahead of the panel — same shape as the
     two migrations that were staged this way on the 18th.
   - The **five open questions** are still open, but none of them block the build; they
     shape the DASHBOARD, which is the next piece. Question 5 (freight by value or by
     count) is already a parameter — `?allocation=count` on the shipments endpoint — so
     the answer is a setting, not a rewrite.
4. **Audit archiving stays OFF until wanted.** Nothing is ever deleted while
   `AUDIT_ARCHIVE_ENABLED` is unset. When ready: `dotnet run -- archive-audit-log
   --dry-run` first (writes the CSV to disk, sends and deletes nothing), then set the flag
   in App Service. Recipient defaults to vvladimirov@nvc-home4you.eu. See DEPLOY.md.

---

## Prerendering — read before every release

**The prerender runs locally against a local app; the output ships inside the publish**
(`StagePrerenderedForPublish`). Nothing runs on the server.

**A guard now refuses a publish whose snapshots are stale** (added 2026-08-19, after the
outage below). `VerifyPrerenderedFreshness` in the csproj runs
`scripts/check-prerender-freshness.mjs`: every `/assets/` file the snapshots reference must
exist in the freshly built `wwwroot`, or the publish STOPS with the fix printed. It is an
error rather than a warning because this failure ships a broken site, where the older
"no prerendered pages found" warning ships a working client-rendered one.

**IT HAS ALREADY PAID FOR ITSELF ONCE — 2026-08-18, the outage it exists to prevent.** A
publish shipped the previous day's snapshots alongside a freshly built SPA. The publish
rebuilds the bundle; Vite hashes it by content; the hash moved. Every public page's
`<script src>` pointed at a file that no longer existed, the server answered with the HTML
fallback, the browser refused it (*"Loading module … was blocked because of a disallowed
MIME type"*), and React never booted. The site rendered as dead HTML: no cookie banner, no
modals, no theme switch, no language switch. **The admin panel was fine, because it is not
prerendered — which is the tell.** Nothing failed: build succeeded, publish succeeded. Fixed
by re-running the prerender and publishing again.

**`api-dotnet/prerendered/` is gitignored — the 52 snapshots live on ONE machine.** A
publish from a fresh clone ships zero snapshots and quietly undoes the SEO work; the only
signal is one MSBuild line. `Prerendered pages staged for publish: 52 files.` = good;
`No prerendered pages found` = a warning, and a working but client-rendered site.

**On Windows the DATA_SOURCE flags are `$env:` assignments** — the bash prefix form fails:

```powershell
cd "NVC Claude version"; npm run build
cd ..\api-dotnet
$env:DATA_SOURCE_GALLERY = 'sql'; $env:DATA_SOURCE_CASES = 'sql'; $env:DATA_SOURCE_REVIEWS = 'sql'
dotnet run -p:SkipSpaBuild=true
# second terminal:
cd "NVC Claude version"; npm run prerender     # expect 52/52
```

**Never pipe that `dotnet run` through `Select-Object`** — it kills the server once it has
its lines, mid-prerender, and the script clears the snapshot folder before writing, so the
folder is left EMPTY (happened 18 Aug; a publish in that window would have shipped zero).

The five traps that each produced a successful-looking run, still true:

1. **`DATA_SOURCE_GALLERY`, not `DATA_SOURCE_HOUSES`.** Without the flags a dev machine
   reads Quickbase while production reads SQL; the script now compares the local catalogue
   against the live site and refuses on a mismatch.
2. **Build → start → prerender, in that order.** The app reads `index.html` once at
   startup; rebuilding under it leaves it serving a deleted bundle.
3. **The generator would read its own output** — it sends `X-Prerender-Bypass: 1`.
   Do not remove that header.
4. **Restart after prerendering** — snapshots load at startup.
5. **The rendered DOM has two of every meta tag** (server + helmet); `dedupeHead()` keeps
   helmet's. `<title>` is exempt.

The prerender script writes files but does not prune ones whose route is gone — deleting a
page means deleting its snapshot by hand, or it keeps shipping.

---

## Domain knowledge worth not rediscovering

### Saved configurator links

The one migration with a Quickbase fallback (codes are in customers' inboxes; a miss falls
through rather than 404ing, and a dead Quickbase degrades to "not found", never a 500).
Code minting checks BOTH stores; the importer never overwrites a code already in SQL. You
cannot tell from outside which store answered — that is the point; read the logs
(`resolved from Quickbase … not yet imported`) or the App Service setting, never the site.

### Prices page arithmetic

Priced from `/api/gallery`, never a second list (the 73 m² incident: two stores disagreed
on one price for weeks). Assembly costs keyed by **gallery id**. The two sections do
OPPOSITE arithmetic: a box house's gallery price is the house inc VAT and assembly is
**added** (€700–€3,000 net); a wagon's gallery price is the **total** and €1,000 gross
assembly is **subtracted out** for display. Pinned in `prices.test.js`.

### Admin data rules

Customers hold ЕГН/ЕИК, addresses, invoices. Anything added near them: AdminOnly with no
anonymous read path (files included); `no-store` on every response; an ЕГН is never a
lookup key (search matches name/phone/email/ЕИК; the list endpoint does not return
`PersonalId` at all). The audit log never records an ЕГН value — redaction is enforced on
the way IN (`AuditRedaction`), so nothing downstream can leak one.

### The billing tables (new, 2026-08-19 — not yet in the panel)

Six tables: `BuyCycle` → `Shipment` → `PurchaseLot` → `ProductModel`, plus `OperatingExpense`
and `Target`. Four facts worth not rediscovering:

**The buy side is USD; every report is EUR, and the rate lives on the individual shipment.**
One global rate would re-value every historical container each time it moved. No euro amount
is stored anywhere — `LandedCost.ToEur` converts at read time and returns null when a shipment
has no rate, rather than inventing one.

**`PurchaseLot.UnitCost` is a snapshot.** It is prefilled from `ProductModel.FactoryPrice` once
and then belongs to the lot forever, so a factory price correction cannot reprice containers
bought last year. Cost lives on `ProductModel`, retail stays on the gallery row, linked by
`HouseId` — two free-standing price lists is the 73 m² incident.

**Nothing stores a total.** No `LineTotal`, no `GoodsCost`, no EUR columns — the same rule as
`Purchase.LeftToPay`, and `BillingArithmeticTests` pins it by reflection so a
denormalise-for-speed change has to argue with a test.

**The one hard constraint is the unique index on `Target`, and its `HasFilter(null)` is
LOAD-BEARING.** EF's SQL Server provider automatically filters a unique index over nullable
columns to `WHERE … IS NOT NULL`, and every target row is null in at least one of
Year/Month/BuyCycleId — a monthly target has no cycle, a cycle target has no year. Without the
explicit null filter the index is unique over the empty set: present in the schema, enforcing
nothing, and discovered when the dashboard shows two revenue targets for one month.

### The audit log

Interceptor-captured (nothing staff-edited escapes it), read-only API and UI, and the only
delete path is the archive service, which NEVER deletes what was not provably emailed
first. Everyone who can read the log is also someone it records — fine for a team of
three, revisit with growth. `FactorySheet` is audited; `LeadActivity` deliberately is not
(it is its own append-only record).

### Public form submissions

Fire-and-forget since 2026-08-18: modals close on Send; `backgroundSubmit.js` retries up
to 5 times (2/4/8/16s) on network errors and 408/425/429/5xx, never on other 4xx; the
top-right banner reports; analytics fire only on confirmed sends. If someone reports
"nothing happens when I press send", the banner IS the feedback — check it before the code.

### The www certificate (for the next domain)

Domain **validation** accepts a CNAME to the apex; a **managed certificate** does not — it
needs the CNAME pointed at the app's own hostname (`nvchome4you.azurewebsites.net`, no
hyphens). Validating is not qualifying; the error message names the requirement.

## ⚠️ Secret expiry — ~2027-02-04, and each fails silently

| Expired credential | What breaks | What still works (hiding it) |
|---|---|---|
| `ENTRA_CLIENT_SECRET` | Admin sign-in | The whole public site |
| Graph / email credentials | Autoresponder, replies, config emails, **audit archive mail** | Forms still submit |
| Quickbase token | Only the #21 import tooling now | Everything live |

Renewal steps in DEPLOY.md. A calendar reminder two weeks ahead is the actual fix.
