# Where things stand — 2026-10-03

**Start here.** This is the one handoff file — consolidated 2026-08-18 from the dated
handoffs (git history has them). `ROADMAP.md` owns what is worth doing next; `DEPLOY.md`
owns release mechanics, **including §6b, the prerender step**. Skipped when the SPA changed,
the freshness guard stops the publish. Skipped when only data or copy changed, it **silently
ships stale pages**.

Tests at `deploy-2026-10-04`: **1104 .NET, 847 frontend**, all green. `npm run audit:a11y`:
0 violations on 104 page-loads.

---

## State of play

| | |
|---|---|
| **Live** | `ac5286b`, tagged **`deploy-2026-10-04`** (published 2026-10-04). It carries #33 (a failed image retries once, then falls back once and stops; the prerender refuses a page with a failed image), #37 (a retitled product keeps its old address: `HouseSlugHistory`, written by the save that changes a title, 301s it to the house's current page; „Стари адреси" in the house dialog) and A1's fifth kitchen position (owner, 2026-10-03: the tall unit under position 4, at 40.3/30.4, for a fridge). Its one migration, `AddHouseSlugHistory`, was applied by the owner on 2026-10-03, before the publish. The bundle is `index-BXFgat5H.js` with 52/52 snapshots (catalogue matched live on all 15 items, no `IMAGES` route), compared page by page against the deploy-2026-10-03 set and trial-published before the real one. **Verified live 2026-10-04:** the bundle loads; the configurator shows A1 with five positions, позиция 5 at 40.3% 30.4%, free for the fridge; `/en/gallery/panaromic-box-house-37-m2?utm_source=x` and the Cyrillic-„а" address still 301 with the query kept; `/en/gallery/space-house` 200; an unknown product 404; `/api/gallery` 15 items, no id twice; `sitemap-gallery.xml` 45; `GET /api/admin/gallery/{id}/retired-addresses` answers 401 signed out. Before it: `deploy-2026-10-03` (`36f158c`), the big release (#31, #32, #27, #29, #11, #34, the gallery SEO store fix, #35, #36); its record is in git history. Rollback snapshots for both on the main device: `D:\NVCHome4Youfinalversion\prerendered-backup-deploy-2026-10-03` and `…-2026-09-20`. **What remains human:** Do next 0 and 0b. |
| **`production` branch** | = live, `ac5286b`. |
| **`master`** | = `production`, plus this record. |
| **Data fix, 2026-09-03** | **The duplicate cleanup, by direct SQL** (owner-approved plan, reviewed-plan gate, one transaction): 21 duplicate leads → `lost`/`Дубликат` with `ClosedAt` backdated straight past the three-day linger, 17 duplicate offers archived — 38 rows, 0 skipped. Being direct SQL it is **absent from Одит** — the LostReason is the record. Per approved rule: in each phone-duplicate group the newest worked lead survives; the older #303–356 copies went. A customer reply to a lost duplicate's old thread will still revive it onto the board — known, by design. |
| **Migrations** | **`AddPurchaseSecondPayment` is APPLIED to production** (owner, 2026-09-30, ahead of the publish as §5b asks; the publish followed on 2026-10-03) — two nullable columns on `Purchases`; the then-live `69f9724` code read the table fine with them present, so the three-day gap was harmless. A panel tab still on the old bundle after the publish is harmless too: the server leaves an absent second payment alone. Before that: `AddActivityRecipients` applied to production 2026-09-02, before the publish — via `$env:` in the owner's terminal, because **the secondary device's user-secrets do NOT hold the SQL string**. The MAIN device's do (checked 2026-10-03): its user-secrets carry production's `SQL_CONNECTION_STRING` and `BLOB_CONNECTION_STRING`, so a bare `dotnet run`, EF command or CLI verb there talks to production. DEPLOY.md, "Check what this machine's secrets point at", has the mechanics. `AddPublicDocuments` applied to production 2026-08-28, before the publish. **`import-brochures` has been RUN against production** the same day: six imported, and an immediate re-run answered 0 imported / 6 skipped, which is the idempotency rule observed live. Do not expect a re-run to refresh anything — rows in SQL are the panel's now. Five applied to production over 2026-08-20/21: `AddOrderStatusHistory`, `RenamePrepaidInvoiceKind`, `BackfillPurchaseQuantityAndStatus`, `RenameLeadOwners` and `BackfillPurchaseModelLinks`. The last two are data-only and were applied BEFORE the publish, so the отговорник dropdown corrected itself without waiting for code. The six billing tables are still there, orphaned and unread — **no migration drops them**; see `_archive/billing-2026-08-19/README.md`. |
| `DATA_SOURCE_SAVEDCONFIGS` | **=sql, set by the owner 2026-08-18.** Quickbase keeps one user-visible runtime path, plus two silent ones (the save-time code collision check, and `/api/img` falling back on a Blob miss; a dead token degrades both quietly). A `/c/{code}` link that was never imported still falls back to it (by design, see "Saved configurator links"). The product-page SEO tags and `sitemap-gallery.xml` read it too until deploy-2026-10-03 moved them to SQL. Otherwise the token's ~Feb 2027 expiry matters only for the import tooling (relevant to ROADMAP #21). |

**Probe production before believing a deployment claim in this file.** This section has
been wrong before (17 Aug: two "not deployed" fixes were live — the publish had been made
from a pre-squash working tree, so no commit mapped to the zip and `production..master`
was empty either way). Checking the live site settles such questions in a minute.

## Do next

0. **After `deploy-2026-10-04`: seed the old addresses, then the Greek retitles.**
   1. **Seed the history, once.** `cd api-dotnet; dotnet run -- seed-slug-history --dry-run`
      on the main device (production SQL via user-secrets; it reads Одит and writes
      nothing). Read the list and every warning, then run it without `--dry-run`. A second
      run adds nothing. It writes production data, so it is the owner's to run.
   2. **Probe:** in Галерия, the Panoramic 37 m² house and the 58 m² and 73 m² double-roof
      houses list their August addresses under „Стари адреси" (the seeder turns
      `RetiredSlugs` into rows too), plus anything it recovered from Одит.
   3. **Then the Greek retitles** ("Next up" under "Renaming a product moves its address").
      Retitling is safe from now on: the save itself keeps the old address.
   4. **Search Console:** Do next 5, and the owner's Word checklist
      (`D:\NVCHome4Youfinalversion\Search-Console-checklist-deploy-2026-10-03.docx`).

0b. **After `deploy-2026-10-03`: what the owner still owes, all of it small.** That release
   is done and verified (its record is in git history at `990e66e`).
   - **The read-only Space house lead check (#35). Run it now; the release is live.** This
     is the owner's to run, not Claude's, because it is production SQL. Open
     `sql/2026-10-02-space-house-leads-on-the-73m2-house.sql`, paste it into the Azure
     portal's Query editor on the production database (SQL databases → the database →
     Query editor), and run it. Sign in with SQL authentication, using the server admin
     login, or with Entra if the server has an Entra admin set. Any SQL client works too. It holds SELECTs only and returns ONE
     result, because the portal shows only a script's last one:
     - A single STOP row if there is not exactly one 73 m² house (Quickbase id 15) and one
       Space house (SQL id 15, no Quickbase id). The leads query did not run; find out why
       before anything else.
     - Otherwise every lead linked to the 73 m² house whose enquiry carried "15" or names
       the Space house, each with a Verdict (no rows means nothing to review):
       - **1 SPACE HOUSE:** the enquiry's model line names the Space house. Decisive.
       - **2 UNDECIDED:** the enquiry was made while both houses were "15" and has no model
         line. Read the message. The Hint column flags „космическа", „капсула" and 55 000.
         It misses "55,000" and the Bulgarian non-breaking-space form, so read the message
         rather than trusting a blank hint.
       - **x:** nothing to fix. The last column shows the Space house line rows were matched
         against, in case its title has changed.

     Fix a row in the panel (Лийдове, the lead, its model), not with an UPDATE, so Одит
     records the change. Expect very few verdict-1 rows and a short list overall. #34
     already stopped linking a shared 15 to either house, and before #34 few gallery
     enquiries carried an id at all. The file was run on 2026-10-03 against a scratch LocalDB
     copy of the schema (one result in both branches, the verdicts as described). It has
     never met production data.
   - **Search Console:** Do next 5.
   - **The first weekly order digest.** `ORDER_DIGEST_ENABLED=true` was set on 2026-10-03,
     and the restart that caused owes the current week. It should have gone out a few
     minutes later to tbonin@ and vvladimirov@, unless no order is active, in which case
     nothing is sent and the week still counts as done. Check that it arrived. Read its
     active count: an old order left at „Приета" counts as active every week, so the email
     would never skip a week. Then every Monday 08:00 Sofia. If nothing came and orders are
     active, the App Service log stream shows the digest's "not done" line. DEPLOY.md,
     "Switching on the weekly order digest", has the preview and `--send`.
   - **#11, now live: a native speaker's read of the drafted Greek,** and the two open
     questions in ROADMAP #11. Should the modular-houses cell's 78 m² be 73? And the Greek
     bathroom codes B1–B9 read like the 58 m² layouts B1–B6.
   - **#28's leftovers.** The slot-overlay eyeball pass goes on the post-release A1–A3 art,
     because #32 re-mapped those kitchens after the 09-20 sheet was made (A4–C6 on the old
     sheet are unaffected). One real configurator offer submission, to see the appliance
     lines and the not-supplied disclaimer in the sales mail. The offerText-vs-4000-char
     measurement noted in the ROADMAP #28 entry.
   - **Space house assembly: decided 2026-10-03, none for now.** It stays „по запитване"
     on /bg/ceni. If it gets one, add `100015: <net €>` to `BOX_ASSEMBLY_NET_BY_ID` in
     `content/shared/prices.js`.

1. **The 2026-09-02 pair is CHECKED — the owner went through the new features on the
   live panel (2026-09-03) and everything works.** Nothing owed here. The one behaviour
   that only shows itself in anger: the „от <адрес>“ marker appears when a third party
   replies-all into a lead's thread — the first real occurrence is worth a glance.

2. **`deploy-2026-08-29` is out and verified; what remains on it is human.** The
   signed-in QA backlog (item 3) now also carries: drag a PDF onto the leads reply box
   (veil lights, chip lands), miss the box on purpose (nothing happens — the page must
   not navigate), drag selected TEXT into the editor (no veil, quoting still works), and
   the a11y spot-checks a machine cannot make — tab order, focus visibility, the
   configurator and floor planner by keyboard alone. Visible-by-design changes: darker
   footer text, darker active filter chips on Проекти, solid pills behind the two slide
   counters.

3. **Everything through stage 4 of #16 is live and the record is clean** — two publishes
   on 2026-08-28, both probe-verified, branch and tags pushed. What remains is the
   signed-in QA pass nobody has made yet:

   **Брошури**: six cards, three slots each, the Bulgarian slots filled by the import, the
   booklet icon in the nav and the tile on Начало. **The three public pages**
   (`/bg/modulni-postroiki`, `/en/modular-houses`, `/el/domika-spitia`): brochure buttons
   open the right PDF at the right page, EL links say `lang=el`. **The 25 Aug four**: a
   saved customer sheet closes with „Запазено“; „16 000“ in Крайна цена settles to 16000;
   a long filename stays inside its slot; the leads name filter narrows all five tabs.
   **The older backlog**: Поръчки advance + history, the four document slots, the
   awaiting-reply badge, the blank-name modal test, Одит after an edit, Фабрични поръчки,
   the factory-sheet import banner.

   And one standing invitation rather than a task: **the owner can upload the EN and EL
   brochure editions in Брошури whenever they are ready** — they start serving the moment
   they land, no deploy. Until then EN/EL visitors get the Bulgarian edition by design.
   One behaviour worth knowing when testing leads: **a customer reply to an archived
   (Won/Lost) lead restarts its three-day archive countdown** — the lead resurfaces on
   the board; its status does not change.

4. **The three published releases: `deploy-2026-08-20`, `-20b`, and `deploy-2026-08-21` (`62365ab`).**
   Each was tagged at publish time, migrations applied BEFORE the publish, prerender re-run
   first — the order DEPLOY.md §5b argues for and §6b has always required.

   **ADMIN_ALLOWED_USERS is now set** (owner, 2026-08-21). Until then it was unset, which the
   AdminOnly policy treats as "anyone signed in to the tenant" — every M365 mailbox the company
   issued had full access to leads, ЕГН, invoices and the audit log. It is now the three staff
   addresses. Adding a fourth person means adding them there, or they are refused.

   **What is still owed — none of it checkable from outside, all of it needs a signed-in look:**
   the **Поръчки** board's advance button and history panel; the four document slots on a
   customer's purchase, including that a document filed before the rename shows up in the
   catch-all slot rather than nowhere; the **awaiting-reply badge** on a lead that has replied;
   and one deliberate mistake — blank a lead's name and confirm the modal stays open with the
   typing intact rather than closing and losing it. Also still owed from 20 Aug: **Одит** after
   a small edit, **Фабрични поръчки**, and accepting the factory-sheet import banner on
   whichever browser still holds the old localStorage copy.

5. **Search Console, after `deploy-2026-10-03`: the checklist.** Before that release the
   product-page 200/404 and `sitemap-gallery.xml` came from Quickbase, so the August title
   fixes never reached crawlers, and six product addresses (four products) answered Google
   404 + noindex. All 96
   addresses in both sitemaps answered 200 on 2026-10-03. In the domain property
   `nvc-home4you.eu`:
   1. **Sitemaps** (Indexing → Sitemaps): resubmit `https://nvc-home4you.eu/sitemap-gallery.xml`
      (45 addresses; it was 42) and `https://nvc-home4you.eu/sitemap.xml` (51). Both should
      read "Success" with those counts once Google refetches. robots.txt already names both.
   2. **Request indexing for the six that answered 404.** The quota is roughly 10 a day per
      property, so these go first. For each: URL Inspection → paste. The first panel may
      still say "URL is not on Google" / "Not found (404)". That is Google's old crawl and is
      expected. Press **Test live URL**: it should say "URL is available to Google" with
      "Indexing allowed? Yes". Then press **Request indexing**.
      - `https://nvc-home4you.eu/en/gallery/space-house`
      - `https://nvc-home4you.eu/bg/galeriq/космическа-къща-капсула`
      - `https://nvc-home4you.eu/el/gkaleri/φουτουριστική-κατοικία-κάψουλα`
      - `https://nvc-home4you.eu/en/gallery/panoramic-box-house-37-m2`
      - `https://nvc-home4you.eu/en/gallery/expandable-house-58m2-with-balcony-and-a-double-roof`
      - `https://nvc-home4you.eu/en/gallery/expandable-house-73m2-with-balcony-and-a-double-roof`
   3. **The three retired addresses need nothing.** `/en/gallery/panaromic-box-house-37-m2`
      and the two `…-and-а-double-roof` addresses (Cyrillic „а") now 301; Google follows that
      on its own. If one is inspected, "Page with redirect" is the right answer.
      They are `GallerySlugs.RetiredSlugs`.
   4. **Pages report** (Indexing → Pages): open "Not found (404)" and "Excluded by 'noindex'
      tag". **Validate fix** re-checks every address under that reason, not just the six,
      and both lists can hold addresses that are meant to stay gone (junk URLs land on the
      noindex 404 page). Validation would then end "Failed" with the six fixed. So press it
      only where the six are all or most of the list; otherwise leave it, since step 2
      already covers them. Validation takes days to weeks and reports by email.
   5. **Product snippets / Merchant listings** (under Shopping or Enhancements): look, do
      not press Validate fix. #35's sku fix has no issue type there, and the usual
      missing-field warnings (shippingDetails, hasMerchantReturnPolicy, review) were not
      changed by this release. An absent or empty report is fine.
   6. **Then the rest, about 10 a day, optional.** Google will also find them from the
      sitemap. The other 32 product addresses are everything in `sitemap-gallery.xml`
      except the six above and seven Greek ones. **Do not request the seven Greek
      addresses with English words in them**: the five `σπίτι-τύπου-container-…`,
      `πανοραμικό-box-house-37-m2` and `πανοραμικό-office-container-6000-3000-mm`. They are
      the owner's pending Greek retitles (ids 13, 6, 8, 14, 7, 16, 12; "Next up" below),
      and their addresses move when the titles change.
6. **Order tracking (#27): the decision is MADE, and the feature was rebuilt around it.**
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
7. **Audit archiving stays OFF until wanted.** Nothing is ever deleted while
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
$env:SQL_CONNECTION_STRING = '...'; $env:BLOB_CONNECTION_STRING = '...'   # BOTH — DEPLOY 6b says why
#   (on the main device user-secrets already supply both; this line then only overrides them)
$env:DATA_SOURCE_GALLERY = 'sql'; $env:DATA_SOURCE_CASES = 'sql'; $env:DATA_SOURCE_REVIEWS = 'sql'
dotnet run -p:SkipSpaBuild=true
# second terminal:
cd "NVC Claude version"; npm run prerender     # expect 52/52
```

**Never pipe that `dotnet run` through `Select-Object`** — it kills the server once it has
its lines, mid-prerender, and the script clears the snapshot folder before writing, so the
folder is left EMPTY (happened 18 Aug; a publish in that window would have shipped zero).

The six traps that each produced a successful-looking run, still true:

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
6. **A cold API used to freeze loading pages in, and the run still reported 52/52**
   (2026-10-03). networkidle2 fires with one slow call still open. The first run of that
   day froze „Зареждане на цените…" into /bg/ceni, did the same to the BG gallery and
   cases, and dropped the reviews from the home pages. Before the first route, a warm-up
   now calls the gallery, cases and reviews endpoints with up to 150s each
   (`PRERENDER_WARMUP_TIMEOUT`), because a paused database plus the app's retry backoff can
   take ~90s. A local app that cannot answer is refused with that reason, before the folder
   is emptied. Then `settle()` waits for every open `/api/` call except `/api/img`, up to
   `PRERENDER_DATA_TIMEOUT` (60s). A call still open fails that route as `API`. Before publishing, compare a few snapshots with the backup:
   prices, gallery, cases and the home page should have their data in them.

The prerender script empties the folder before it renders, so a deleted route's snapshot
goes with the next run, and so does everything live if the run then fails. Back the folder
up first (DEPLOY 6b has the command). A partial run exits 1 and names the routes with no
snapshot.

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

### Anything public that reads the gallery takes `IGalleryStore`, never `GalleryService`

`GalleryService` is the Quickbase implementation. Production reads the gallery from SQL via
`DATA_SOURCE_GALLERY=sql`, and only `IGalleryStore` follows that flag. The product SEO tags
and the sitemap named the concrete class, and that went unnoticed for weeks (found
2026-10-02). The SPA rendered every page correctly while the server answered crawlers
from Quickbase's catalogue. `GalleryStoreWiringTests` now refuses any constructor that
names a concrete gallery store, except `GalleryImportService`, whose job is to read
Quickbase.

### Renaming a product moves its address

A gallery URL is its title, slugified per locale. Retitling a house in the admin panel
moves it, and the old URL (indexed, in emails, shared) would show "Model not found" to
visitors and answer 404 to crawlers.

**This is automatic since #37, live since `deploy-2026-10-04`.**
The save that changes a title writes the old address into `HouseSlugHistory`, and it 301s
to the house's current address, with any query string kept, in both its current and its
pre-2026-08-17 form. The house dialog lists them under „Стари адреси". Nothing to do by
hand: no `RetiredSlugs` row, no publish. Renames made in the panel BEFORE #37 are recovered
once from Одит by `dotnet run -- seed-slug-history` (`--dry-run` first).

`GallerySlugs.RetiredSlugs` stays, for the three Quickbase-era corrections that never
passed through the panel. A new row there is only ever needed for an address the panel
never held. `GalleryRetiredSlugTests` checks every entry against the fixtures' current
titles.

**Next up: the owner's Greek retitles** (ROADMAP #11 Group 3). Seven gallery `titleEl`
values carry English words: ids 13, 6, 8, 14, 7 ("Σπίτι τύπου Container …"), 16
("Πανοραμικό Box House – 37 m²") and 12 ("Πανοραμικό Office Container …"). Their
`/el/gkaleri/` URLs are in the sitemap and answer 200. **Now, after the seeder** (Do next 0):
retitle them in the panel, check „Стари адреси" on each, and request indexing for the
seven new `/el/gkaleri/` addresses in Search Console. No developer needed.

### A house's public id is not its SQL id

`/api/gallery`'s `id`, an offer's `ModelId`, the keys of the prices page's assembly table,
the JSON-LD `sku` and React keys all use the public id from `HousePublicIds`:

- An imported house uses its Quickbase id.
- A house made in the panel uses 100000 + its SQL id.

Everything inside the database (`Lead.HouseId`, `Purchase.HouseId`, the admin panel's house
pickers, blob keys) uses the SQL `House.Id`; only Запитвания prints an offer's stored
`ModelId` as it arrived. Mixing the two attaches things to the wrong building, and
nothing errors. Before #35, panel houses were served under their bare SQL id, which put two
houses on "15" live. `LeadService.ResolveHouseIdAsync` is the only code that maps a public
id back to a house, and it still reads the ids stored before #35.

Promoting a stored offer understands three kinds of id: the 100015-style ids, Quickbase
ids, and the bare SQL id a panel-made house had before #35. A shared "15" is settled by the
enquiry's date (made before the Space house existed means the 73 m² house) or by its
„Модел от сайта:" line; otherwise it links to neither, as it has since #34. Below 100000, a
model line that names a different house than the number found means no link. That covers
a Space house deleted later (an old "15" whose line names it would otherwise find only the
73 m² house). An enquiry from before #34 has no line, so it has no such protection. The
cost is that a house retitled between enquiry and
promotion is not linked automatically; staff link it by hand from the line.

Cases, and the clients derived from them, follow the same rule through `CasePublicIds` (#36).
Their ids are only React keys on the cases page, and nothing maps them back.


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
the production database**, and Quickbase still holds the originals. See the end of Do next 6.

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
| Graph / email credentials | Autoresponder, replies, inbound mail filing, config emails, **audit archive mail**, the weekly order digest | Forms still submit |
| Quickbase token | Never-imported `/c/{code}` links (they answer "not found") and the #21 import tooling | Everything else live, including the product tags and `sitemap-gallery.xml` since deploy-2026-10-03 |

Renewal steps in DEPLOY.md. A calendar reminder two weeks ahead is the actual fix.
