# Where things stand — 2026-08-20

**Start here.** This is the one handoff file — consolidated 2026-08-18 from the dated
handoffs (git history has them). `ROADMAP.md` owns what is worth doing next; `DEPLOY.md`
owns release mechanics, **including §6b, the prerender step, which silently ships stale
pages when skipped**.

Tests: **686 .NET, 295 frontend.**

---

## State of play

| | |
|---|---|
| **Live** | `db24ce5`, tagged **`deploy-2026-08-20`** — order tracking, and the server-side fix that made `/order/{code}` resolve. Verified from outside 2026-08-20: the live bundle `index-BXwZandb.js` is the same hash the shipped snapshots reference and serves as `text/javascript`, and `/order/TESTCODE` answers 200 rather than the 404 every customer link was getting the day before. |
| **`production` branch** | `db24ce5` = live. Seven commits had gone out untagged before this; the tag was added afterwards, which is why `deploy-2026-08-19c` sat three days behind what was actually running. |
| **`master`** | `db24ce5` = `production`. Both pushed. `leads-table` is fully merged and holds nothing of its own. |
| **Migrations** | `AddOrderStatusHistory` is **APPLIED to production** (2026-08-20). Additive only, and the live build does not know the table exists, so applying it changed nothing on the site — verified straight afterwards. **TWO STILL PENDING and both ship with the code that needs them:** `RenamePrepaidInvoiceKind` and `BackfillPurchaseQuantityAndStatus`. Migrate BEFORE publishing — DEPLOY.md §5b now carries the reasoning: a migration is readable by the build already running, while the new build ships expecting data the migration has produced. `MergeSalesIntoPurchasesAndTrackOrders` is applied to production. The six billing tables are still there, orphaned and unread — **no migration drops them**; see `_archive/billing-2026-08-19/README.md` for the SQL if that is ever wanted. |
| `DATA_SOURCE_SAVEDCONFIGS` | **=sql, set by the owner 2026-08-18. Quickbase has no live runtime path left.** The token's ~Feb 2027 expiry now only matters for the import tooling (relevant to ROADMAP #21). |

**Probe production before believing a deployment claim in this file.** This section has
been wrong before (17 Aug: two "not deployed" fixes were live — the publish had been made
from a pre-squash working tree, so no commit mapped to the zip and `production..master`
was empty either way). Checking the live site settles such questions in a minute.

## Do next

1. **The publish is out and tagged** (`deploy-2026-08-20` → `db24ce5`), and the live site was
   checked from outside afterwards — see the table above. Two things are still owed from it:
   the post-publish walkthrough (sign in, edit something small and look at **Одит**, then
   **Фабрични поръчки** — and on whichever browser held the old factory sheet, accept the
   import banner so the localStorage copy reaches SQL), and **tagging at the time of the
   publish rather than days later**, which is the only reason anyone had to ask what was live.

   **The NEXT publish carries a migration.** `AddOrderStatusHistory` must be applied, and the
   prerender re-run before publishing (DEPLOY.md §6b, and the guard will stop the publish if
   it is not) — the SPA changed, so the bundle hash has moved.
2. **Search Console, the remainder**: request indexing for the 26 clean product URLs
   (~10/day), then the 16 corrected ones from a fresh `sitemap-gallery.xml`. **The two title
   fixes are done** — verified 2026-08-19 against the live `/api/gallery`: no `Panaromic`
   survives, and no otherwise-Latin string in the payload contains a Cyrillic character.
   Nothing is left here but the indexing requests themselves.
3. **Order tracking (#27): the decision is MADE, and the feature was rebuilt around it.**
   The owner settled it on 2026-08-20: **a member of staff moves every order along by hand,
   from the admin Поръчки board. There will be no carrier account and no feed.** That turns
   hand-entry from a fallback into the product, so the work that followed was about making
   the manual routine fast and honest rather than about automating it.

   What that surfaced, and what was done:
   - **The board could never save.** `AdminOrdersPage.save()` PUT to
     `/api/admin/customers/{id}/purchases/{purchaseId}`, a route that does not exist —
     purchases are edited nested inside the customer PUT. Every status change from that
     screen 404'd, so the feature had never actually worked from the screen built for it.
     It now writes through `PUT /api/admin/orders/{purchaseId}`, the order-fields-only
     writer that already existed. A test pins the URL, because nothing else would have
     caught it: the page looked finished.
   - **Status history** (`OrderStatusEvents`, append-only, one row per real move with who
     moved it). A hand-updated board cannot answer "when did it actually reach the harbour?"
     unless each move is recorded as it happens; it also gives the office "has anyone
     touched this in three weeks?", which is the failure mode a manual board really has.
     No backfill — orders older than the table show undated steps rather than invented ones.
   - **The customer's page was rebuilt.** It now answers "where is my house?" in a sentence
     before any timeline, dates each step from the history, carries the model photo, follows
     the site's own theme (it was reading `prefers-color-scheme`, so it sat in light mode
     inside a dark site), and speaks Greek — the site sells in three languages and it had
     only two. It also stopped pointing customers at `info@nvc-home4you.eu`, which is not
     the address the rest of the site publishes; it is `contact@`.
   - **`/order/` is now disallowed in robots.txt.** The noindex tag only exists once the SPA
     has booted, and this page is not prerendered; the Disallow is what stops a crawler that
     never runs the JavaScript from queueing a customer's URL at all.
   - **The customer sheet was quietly wiping the order columns.** Its payload carries no
     carrier fields, and `Apply()` wrote all six unconditionally, so correcting a phone
     number erased what a worker had typed on the board that morning. The order fields are
     now GONE from `PurchaseInput` and `Apply` — `UpdateOrderAsync` is the only door onto
     `Status`, which is also what makes a move impossible without its history row.
     **The same wipe took Quantity and the four sale-expense columns, and both are now
     closed.** The expenses left `PurchaseInput` the way the order fields did — import-only
     history with no screen and no writer until billing moves across. Quantity went the
     other way: the sheet grew a "Брой" box, so the column has an owner, and what changed
     is that an ABSENT quantity now leaves the stored count alone instead of meaning one.
     `BackfillPurchaseQuantityAndStatus` gives the rows that predate the column the 1 and
     the `placed` they should have had — they were added to a populated table and landed on
     0 and `''`, and a 0 is refused on save, which blocked the whole customer.
   - **`Purchase.Status` is now a concurrency token**, so two people advancing the same
     order do not both write a move and credit the wrong one. No migration: the status
     column IS the version.

   Still true: carrier notes are typed by hand and stamp their own "as of" date, and the four
   carrier columns stay shaped for a feed if that decision is ever revisited.
   Billing (#21) stays archived in `_archive/billing-2026-08-19/`; its six tables sit
   orphaned in production and Quickbase remains their record. The importer only works
   while the QB token lives (~Feb 2027).
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

### A new route needs the SERVER told about it, not just App.jsx

The fallback in `Program.cs` decides whether a path is a page from the SEO manifest plus a
short hand-maintained list of shapes the manifest cannot know (bare redirects, gallery
detail prefixes, and the unlisted `/internal/`, `/admin/`, `/order/` branch). A route that
is registered in `App.jsx` but missing there **works when you click to it and 404s when you
open it directly** — the one case nobody tests by hand.

It has now happened twice: the Services page (18 Aug, in paths.js but never routed) and
order tracking (20 Aug, routed but unknown to the server — every customer link answered a
real HTTP 404 while React rendered the page underneath). `SpaFallbackRouteTests` pins it
now. **Probing the live URL is the only check that catches this class**, which is why it is
worth doing after every publish that adds a route.


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

### The billing tables — archived, not deleted

The buy side (cycles, shipments, lots, cost models, expenses, targets, the dashboard and
the Quickbase importer) was built and shipped on 2026-08-19 and pulled the same day; the
team judged the migration too much change for now. Everything, including the business
rules settled with the owner and the restore steps, is in
**`_archive/billing-2026-08-19/README.md`** — outside both projects, so it is neither
built, bundled nor published.

The one fact that outlives the archive: **the tables and their imported rows are still in
the production database**, and Quickbase still holds the originals. See Do next #3.

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
