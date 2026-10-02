# Where things stand — 2026-09-30

**Start here.** This is the one handoff file — consolidated 2026-08-18 from the dated
handoffs (git history has them). `ROADMAP.md` owns what is worth doing next; `DEPLOY.md`
owns release mechanics, **including §6b, the prerender step, which silently ships stale
pages when skipped**.

Tests: **800 .NET, 479 frontend.** `npm run audit:a11y`: 0 violations on 104 page-loads.

---

## State of play

| | |
|---|---|
| **Live** | `69f9724`, tagged **`deploy-2026-09-20`** — #28: kitchen appliance placement in the configurator, plus the retirement of the kitchen-extras section. SPA-only release: no API changes, **no migrations**. The bundle rehashed to `index-B6E00noi.js` and the snapshots were regenerated with it — 52/52 routes against a local app run with the SQL data-source flags, freshness guard clean before AND at publish. Verified live the same day, not just probed: the appliance stage renders on Интериор, stacking the hob on the oven produces the OV+HB dot with „позиция 1 · върху фурната", „Кухненски добавки" is gone, the live page's bundle reference resolves 200, and the browser console is clean. **What remains human:** the owner's eyeball pass over the slot-overlay sheet (a nudged dot = one line in `boxConfiguratorApplianceSlots.js` + redeploy), one real offer submission to see the appliance lines and the not-supplied disclaimer arrive in the sales mail, and the offerText-vs-4000-char measurement noted in the #28 DONE entry. |
| **`production` branch** | **AHEAD of live, NOT published.** Pushed 2026-09-30/10-01 carrying #31 (second payment), #32 (A1–A3 renders + kitchen slots + the sink that follows the drawing) #27's weekly order digest (ships OFF; switched on as step 5 below), #29, replies with up to 20 MB of files (verified by a real send as step 4b), and — owner's decision 2026-10-01 — **#11, the Greek fixes**, which carry the fix for a LIVE bug: the internal-doors „review & send" button has thrown since 2026-08-18, so no doors enquiry can be sent. Then — owner's decision 2026-10-02 — **#34, a gallery enquiry names its model** (sales could not tell which house a gallery „Поискай оферта" was about; no migration). Then, also the owner's decisions of 2026-10-02, three more. **The gallery SEO store fix, with 301s for the three retitled product addresses** (API-only, no migration): the product-page `<head>` tags and `sitemap-gallery.xml` read Quickbase while the site serves SQL, so a product that exists only in SQL, or whose title was corrected there, answers crawlers **404 + noindex** (humans see the page; Google and email link-checkers get the 404), and the three addresses from before the August title corrections, which show visitors "Model not found", now 301 to their products. Its probes are in step 4 and the Search Console follow-up is Do next 5. **#35, a gallery public id that cannot collide** (SPA + API, no migration): live serves the Space house (made in the panel, SQL id 15) and the imported 73 m² house (Quickbase id 15) both as `id: 15`, so Space house enquiries became 73 m² leads and the prices page gives the Space house the 73 m² house's €2,280 assembly. Houses made in the panel are now served as 100000 + SQL id (the Space house becomes **100015**); imported houses keep their numbers. Its probes and the owner's read-only lead check are Do next 0b. **#36, a case public id that cannot collide** (API-only, no migration): the same scheme for the cases page and its clients, so cases made in the panel are served as 100000 + SQL id. Nothing collides live today; its probe is in step 4. The publish could not be finished from the secondary device (no Blob string there for the prerender); it is the first item under Do next. |
| **`master`** | = `production`. |
| **Data fix, 2026-09-03** | **The duplicate cleanup, by direct SQL** (owner-approved plan, reviewed-plan gate, one transaction): 21 duplicate leads → `lost`/`Дубликат` with `ClosedAt` backdated straight past the three-day linger, 17 duplicate offers archived — 38 rows, 0 skipped. Being direct SQL it is **absent from Одит** — the LostReason is the record. Per approved rule: in each phone-duplicate group the newest worked lead survives; the older #303–356 copies went. A customer reply to a lost duplicate's old thread will still revive it onto the board — known, by design. |
| **Migrations** | **`AddPurchaseSecondPayment` is APPLIED to production** (owner, 2026-09-30, ahead of the publish as §5b asks) — two nullable columns on `Purchases`; the live `69f9724` code reads the table fine with them present, so the gap until the publish is harmless. A panel tab still on the old bundle after the publish is harmless too: the server leaves an absent second payment alone. Before that: `AddActivityRecipients` applied to production 2026-09-02, before the publish — via `$env:` in the owner's terminal: **user-secrets on this machine do NOT hold the SQL string**, whatever this file's §"user-secrets" implies. `AddPublicDocuments` applied to production 2026-08-28, before the publish. **`import-brochures` has been RUN against production** the same day: six imported, and an immediate re-run answered 0 imported / 6 skipped, which is the idempotency rule observed live. Do not expect a re-run to refresh anything — rows in SQL are the panel's now. Five applied to production over 2026-08-20/21: `AddOrderStatusHistory`, `RenamePrepaidInvoiceKind`, `BackfillPurchaseQuantityAndStatus`, `RenameLeadOwners` and `BackfillPurchaseModelLinks`. The last two are data-only and were applied BEFORE the publish, so the отговорник dropdown corrected itself without waiting for code. The six billing tables are still there, orphaned and unread — **no migration drops them**; see `_archive/billing-2026-08-19/README.md`. |
| `DATA_SOURCE_SAVEDCONFIGS` | **=sql, set by the owner 2026-08-18. Quickbase has no live runtime path left.** The token's ~Feb 2027 expiry now only matters for the import tooling (relevant to ROADMAP #21). |

**Probe production before believing a deployment claim in this file.** This section has
been wrong before (17 Aug: two "not deployed" fixes were live — the publish had been made
from a pre-squash working tree, so no commit mapped to the zip and `production..master`
was empty either way). Checking the live site settles such questions in a minute.

## Do next

0. **THE BIG RELEASE — #31 + #32 + #27 + #29 + #11 + #34 + the gallery SEO fix + #35 +
   #36, from the MAIN device.** Pushed and waiting: `production` = `master`. The
   `AddPurchaseSecondPayment` migration is ALREADY applied to production; nothing else in
   the release needs one. Tests green at the release: 1065 .NET, 824 frontend. In order:

   1. **Pull and build.** `git checkout production; git pull`, then
      `cd "NVC Claude version"; npm run build`.
   2. **Prerender.** Start the app with `SQL_CONNECTION_STRING` **and**
      `BLOB_CONNECTION_STRING` plus the three `DATA_SOURCE_*=sql` flags (recipe below), then
      `npm run prerender` in a second terminal — expect **52/52**. The Blob string is not
      optional: without it every `/api/img` image 404s locally, the home and modular-builds
      pages never go quiet (ROADMAP #33) and the snapshots would bake placeholder art in.
      The secondary device stopped here on 2026-09-30 for exactly that reason (45/52).
      Expect one warning naming id 15 from the catalogue check; it is #35's, see Do next 0b.
   3. **Publish.** Stop the local app, publish from VS Code, then
      `git tag deploy-YYYY-MM-DD; git push --tags`.
   4. **Probe live** (Ctrl+F5). Configurator: the new A1–A3 renders, kitchen dots on the
      worktops, and the sink dot ON the drawn sink after picking A2 (position 4) and A3
      (position 2); the home page's „58" entry lands on B1 with the sink at position 2.
      Panel: Клиенти shows Второ плащане + Дата на второто плащане on a purchase and
      Платено изцяло once a client is settled; Поръчки shows the badge and the second
      payment in the report line. Greek (#11): /el/diamorfotis-box-spitiou shows Greek
      option names and „14.840 €"-style prices; a /el gallery product page names its
      category in Greek. **The doors fix:** /bg/interiorni-vrati's „review & send" opens the
      form (it has not since 2026-08-18) — send one real enquiry to see it arrive.
      **#34:** open a model from the gallery LIST (the pop-up, not a direct link), press
      „Поискай оферта": the form shows „Модел: <name>". Send it: the sales email has a
      „Модел:" row with the name linked to its page and the name at the end of the
      subject, and Запитвания shows „Модел от сайта: …" as the message's first line.
      **Gallery SEO store fix:** check the HTTP status, not the page (the SPA renders it
      either way): `curl.exe -s -o NUL -w "%{http_code}" <url>` for
      `/en/gallery/space-house`, `/bg/galeriq/космическа-къща-капсула` and
      `/en/gallery/panoramic-box-house-37-m2` must answer **200**. They answered 404 on
      2026-10-02. `/sitemap-gallery.xml` must list one `<loc>` per item per locale (45 for
      today's 15 items; it was 42), including `space-house`, with no `panaromic`.
      **The three retitled addresses:**
      `curl.exe -s -o NUL -w "%{http_code} %{redirect_url}" <url>` on
      `/en/gallery/panaromic-box-house-37-m2` must print `301` and the
      `…/panoramic-box-house-37-m2` URL. It printed 200 on 2026-10-02. With
      `?utm_source=x` added, the printed URL must end in `?utm_source=x` too, because the
      redirect keeps the query.
      **#36:** in `/api/cases-page`, no case `id` and no client `id` appears twice. The
      one case served on 2026-10-02 was `"2"`; it stays `"2"` if it was imported and becomes
      `"100002"` if it was made in the panel. Either is correct.
   4b. **Send a real large attachment (#29)** — the one part of this release that has only
      ever met a stub of Graph. From the panel, reply on a test lead whose address is a
      mailbox you can read, with one PDF of 5–15 MB and one small file. Expect: it sends,
      both files arrive intact, the thread shows the reply and both files, and contact@'s
      Drafts holds nothing left over. Then pick files totalling over 20 MB: Send greys out
      with a sentence, and „Запиши като" still files them. If the large send fails, the
      panel's message names the step and the file — keep it for the fix; small attachments
      do not use the new route and keep working regardless.
   5. **Switch on the weekly order digest (#27)** — it ships OFF. With the SQL string set:
      `cd api-dotnet; dotnet run -- order-digest` previews it (counts on screen, the email
      as an .html in the temp folder, nothing sent). Check the active count: an old order
      left at „Приета" keeps every week "active", so the email would never skip a week.
      Optional: `dotnet run -- order-digest --send` mails it now (needs the GRAPH_* settings
      too). Then App Service → Environment variables → `ORDER_DIGEST_ENABLED` = `true`
      (`ORDER_DIGEST_TO` only to change the default tbonin@ + vvladimirov@). The first
      digest arrives a few minutes after that restart; then every Monday 08:00 Sofia.
      DEPLOY.md, "Switching on the weekly order digest", has the details.
   6. **Record it.** Here: the Live row, the test counts, and this item gone. In ROADMAP:
      #31, #32, #29, #11, #34, #35 and #36 marked deployed, #27's digest marked live.

0b. **#35, the gallery id fix: what its release needs, and one read-only check for the
   owner.** In `master` and `production` on the owner's go-ahead (2026-10-02), so it ships
   with the big release. No migration. ROADMAP #35 has the design.
   - **In the big release:**
     - At step 2 the prerender prints one warning naming id 15. That is expected. Live
       still serves both houses as 15, so that id is skipped rather than compared (DEPLOY
       §6b).
     - At step 4, probe `/api/gallery`: the Space house has `"id":100015`, and no id appears
       twice.
     - At step 4, probe /bg/ceni: the Space house's assembly reads „по запитване" and its
       total equals its price. It currently shows €2,280 assembly, which is the 73 m²
       house's.
     - **Owner's call:** if the Space house has an assembly cost of its own, it goes into
       `BOX_ASSEMBLY_NET_BY_ID` in `content/shared/prices.js` as `100015: <net €>`.
   - **The read-only lead check, run by the owner, not Claude (it is production SQL).**
     Open `sql/2026-10-02-space-house-leads-on-the-73m2-house.sql`, paste it into the Azure
     portal's Query editor (or any SQL client) on the production database, and run it. It
     is SELECTs only and returns ONE result, because the portal shows only a script's last
     one:
     - A single STOP row if there is not exactly one 73 m² house (Quickbase id 15) and one
       Space house (SQL id 15, no Quickbase id). The leads query did not run; find out why
       before anything else.
     - Otherwise every lead linked to the 73 m² house whose enquiry carried "15" or names
       the Space house, each with a Verdict (no rows means nothing to review):
       - **1 SPACE HOUSE:** the enquiry's model line names the Space house. Decisive.
       - **2 UNDECIDED:** the enquiry was made while both houses were "15" and has no model
         line. Read the message; the Hint column flags „космическа", „капсула" and 55 000.
       - **x:** nothing to fix. The last column shows the Space house line rows were matched
         against, in case its title has changed.

     Fix a row in the panel (Лийдове, the lead, its model), not with an UPDATE, so Одит
     records the change. Expect very few verdict-1 rows: #34 already stopped linking a
     shared 15 to either house, so one only appears if someone linked it by hand. Before
     #34, few gallery enquiries carried an id at all, because the modal threw it away. The
     whole list should be short.

     **The file has never been run against a database.** It was checked only with a T-SQL
     parser (which also confirmed it holds no write statement) and against the column
     names in the EF model snapshot.
   - **Old enquiries keep resolving.** Promoting a stored offer understands three kinds of
     id: the new 100015-style ids, Quickbase ids, and the bare SQL id a panel-made house had
     before #35. A shared "15" is settled by the enquiry's date (made before the Space house
     existed means the 73 m² house) or by its „Модел от сайта:" line. Otherwise it links to
     neither, as it has since #34.
     - Below 100000, a model line that names a different house than the number found means
       no link. That covers a Space house deleted later: an old "15" whose line names it
       would otherwise find only the 73 m² house. An enquiry from before #34 has no line, so
       it has no such protection. The cost is that a house retitled between enquiry and
       promotion is not linked automatically; staff link it by hand from the line.

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

5. **Search Console: RESUBMIT `sitemap-gallery.xml` once the gallery SEO store fix is
   live** (Sitemaps → the gallery sitemap → resubmit). Until then the sitemap was built from
   Quickbase, not from the SQL catalogue the site serves. So "the two title fixes are done"
   (verified 2026-08-19) was true of `/api/gallery` and the SPA, but **never reached
   crawlers**: the sitemap and the server's 200/404 answer still carried Quickbase's titles.
   Diffing the live sitemap against the live `/api/gallery` on 2026-10-02 showed this:
   - **404 until the fix, 200 after it. Request indexing:** `/en/gallery/space-house`,
     `/bg/galeriq/космическа-къща-капсула`, `/el/gkaleri/φουτουριστική-κατοικία-κάψουλα`,
     `/en/gallery/panoramic-box-house-37-m2`, and
     `/en/gallery/expandable-house-{58,73}m2-with-balcony-and-a-double-roof`.
   - **200 until the fix, 301 to the corrected page after it** (owner's decision,
     2026-10-02): `/en/gallery/panaromic-box-house-37-m2` and the two
     `…-and-а-double-roof` URLs, whose "а" is Cyrillic. The 200 was only ever the server's
     answer. A visitor there has seen "Model not found" since the August corrections,
     because the SPA matches against the corrected titles. They are the three entries in
     `GallerySlugs.RetiredSlugs`. Nothing to do in Search Console: Google follows the 301
     and moves them to the corrected URLs on its own.

   Then, as before, request indexing for the remaining product URLs (~10/day).
   **#35 ships in the same release** (Do next 0b). It fixes the duplicate public id 15: the
   Space house and the 73 m² house both serve `id: 15` from `/api/gallery`, which breaks
   the uniqueness of the JSON-LD `sku`. Slugs, the sitemap and the product tags do not key
   on id, so this fix does not depend on #35, but the SEO is not clean until both are live.
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
$env:SQL_CONNECTION_STRING = '...'; $env:BLOB_CONNECTION_STRING = '...'   # BOTH — see Do next 0
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

### Anything public that reads the gallery takes `IGalleryStore`, never `GalleryService`

`GalleryService` is the Quickbase implementation. Production reads the gallery from SQL via
`DATA_SOURCE_GALLERY=sql`, and only `IGalleryStore` follows that flag. The product SEO tags
and the sitemap named the concrete class, and that went unnoticed for weeks (found
2026-10-02). The SPA rendered every page correctly while the server answered crawlers
from Quickbase's catalogue. `GalleryStoreWiringTests` now refuses any constructor that
names a concrete gallery store, except `GalleryImportService`, whose job is to read
Quickbase.

### Renaming a product moves its address

A gallery URL is its title, slugified per locale. Staff can retitle a house in the admin
panel, and the moment they do, the old URL (indexed, in emails, shared) shows "Model not
found" to visitors and answers 404 to crawlers. **Nothing records old titles
automatically.** To keep an old address alive, add it to `GallerySlugs.RetiredSlugs`,
with the locale, the old slug (`GallerySlugs.Slugify(oldTitle)`) and the new slug. It
will then 301, with any query string kept. One row covers both forms of the old address:
the current one, and the pre-2026-08-17 form that Greek and some Bulgarian links still
carry. If you retitle a product that already has an entry, point that entry at the new
slug too, because the lookup follows only one hop. `GalleryRetiredSlugTests` checks every
entry against the fixtures' current titles, so add the product's new title there as well.
An admin-side slug history, which would do this on save, would remove the manual step. It
is proposed as ROADMAP #37 and has not been built.

**Next up: the owner's Greek retitles** (ROADMAP #11 Group 3). Seven gallery `titleEl`
values carry English words: ids 13, 6, 8, 14, 7 ("Σπίτι τύπου Container …"), 16
("Πανοραμικό Box House – 37 m²") and 12 ("Πανοραμικό Office Container …"). Their
`/el/gkaleri/` URLs are in the sitemap and answer 200. Changing them in the panel moves
all seven. Do them in one batch, then add seven `("el", …)` rows in one commit, and
publish soon after. If #37 ships first, the batch needs no developer.

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
| Quickbase token | Only the #21 import tooling now. That is true once the gallery SEO store fix is live; before it, product-page tags and `sitemap-gallery.xml` read Quickbase too | Everything live |

Renewal steps in DEPLOY.md. A calendar reminder two weeks ahead is the actual fix.
