# Where things stand — 2026-08-18

**Start here.** This is the one handoff file — consolidated 2026-08-18 from the dated
handoffs (git history has them). `ROADMAP.md` owns what is worth doing next; `DEPLOY.md`
owns release mechanics, **including §6b, the prerender step, which silently ships stale
pages when skipped**.

Tests: **639 .NET, 252 frontend.**

---

## State of play

| | |
|---|---|
| **Live** | `deploy-2026-08-18` = `7fa1b17` — www redirect, services page retired, gallery slugs corrected, the five lead-panel features |
| **`production` branch** | `de8e3b6` (audit log) — **ONE RELEASE AHEAD OF LIVE**: a publish was staged on 18 Aug and the owner delayed it. Until the next publish, `git log` cannot answer "what is live"; the `deploy-2026-08-18` tag can. |
| **`master`** | audit log + factory sheets in the panel + fire-and-forget public forms + this docs consolidation — all undeployed |
| **Migrations** | `AddAuditLog` and `AddFactorySheets` are **already applied** to the production database. Safe: both purely additive, and nothing in the live code reads the new tables until the next publish. |
| `DATA_SOURCE_SAVEDCONFIGS` | **=sql, set by the owner 2026-08-18. Quickbase has no live runtime path left.** The token's ~Feb 2027 expiry now only matters for the import tooling (relevant to ROADMAP #21). |

**Probe production before believing a deployment claim in this file.** This section has
been wrong before (17 Aug: two "not deployed" fixes were live — the publish had been made
from a pre-squash working tree, so no commit mapped to the zip and `production..master`
was empty either way). Checking the live site settles such questions in a minute.

## Do next

1. **Publish** (the delayed one). From the repo root:
   - `git checkout production && git merge --ff-only master && git push`
   - §6b prerender — **expect 52/52** — then VS Code → right-click `api-dotnet` →
     Publish to Azure, and watch for `Prerendered pages staged for publish: 52 files.`
   - Verify after: `/api/admin/audit` and `/api/admin/factory-sheets` answer 401 anonymous;
     `/admin/audit` and `/admin/factory-sheets` resolve; submitting the offer form closes
     the modal instantly and shows the top-right banner; `/internal/factory-sheet`
     redirects. Tag `deploy-YYYY-MM-DD` (the 18th is taken — suffix it).
   - Then sign in and look at **Одит** (edit something small first) and **Фабрични
     поръчки** — and on whichever browser held the old factory sheet, accept the import
     banner so the localStorage copy reaches SQL.
2. **Search Console, the remainder**: request indexing for the 26 clean product URLs
   (~10/day), then the 16 corrected ones from a fresh `sitemap-gallery.xml`. Two fixes
   that are TITLE DATA, not code, in `/admin/gallery`: `Panaromic` → `Panoramic`, and the
   Cyrillic `а` in "…and а double roof" on two English titles. The slug follows the title;
   the old URL 301s itself.
3. **Audit archiving stays OFF until wanted.** Nothing is ever deleted while
   `AUDIT_ARCHIVE_ENABLED` is unset. When ready: `dotnet run -- archive-audit-log
   --dry-run` first (writes the CSV to disk, sends and deletes nothing), then set the flag
   in App Service. Recipient defaults to vvladimirov@nvc-home4you.eu. See DEPLOY.md.

---

## Prerendering — read before every release

**The prerender runs locally against a local app; the output ships inside the publish**
(`StagePrerenderedForPublish`). Nothing runs on the server.

**`api-dotnet/prerendered/` is gitignored — the 52 snapshots live on ONE machine.** A
publish from a fresh clone ships zero snapshots and quietly undoes the SEO work; the only
signal is one MSBuild line. `Prerendered pages staged for publish: 52 files.` = good;
`No prerendered pages found` = stop.

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
