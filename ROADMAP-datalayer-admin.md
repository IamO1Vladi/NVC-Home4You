# Roadmap — Data layer migration (Quickbase → SQL) + Admin panel

Goal: move the site's data off the external Quickbase API onto a first-party
Microsoft stack (SQL Server / Azure SQL + EF Core), for lower latency and a
single-vendor operational story — and build the admin UI that has to exist
before Quickbase can be retired.

**Hard constraint: the new data layer stays off the live page until it is
verified.** Every read path ships behind a feature flag, defaulting to
Quickbase. Nothing switches over on merge.

Tracked separately from `improvements.txt` because this spans both halves of
the repo and several PRs. Cross-reference: this is a prerequisite for retiring
Quickbase, not a listed improvements item.

`[x]` = done · `[~]` = done for **reviews only** (the migration is per-entity, so most
foundation items get re-touched once per table) · `[ ]` = not started.

---

## Why an admin panel is part of this, not a follow-up

Quickbase is currently **both** the database and the staff-facing admin UI. Today
your team edits houses, cases, gallery images and moderates reviews inside
Quickbase's own interface. The moment data lives in SQL instead, that interface
is gone — so the admin panel is not a nice-to-have bolted on afterwards, it is
the replacement for a tool the business uses daily. Migration cannot complete
without it.

---

## Current state (as of 2026-08-05)

- **Azure SQL is live, for reviews only.** EF Core + `AppDbContext` + two migrations;
  `DATA_SOURCE_REVIEWS=sql` in App Service. Reads *and* writes. Every other table is
  still Quickbase.
- **Entra ID auth is live** on `/api/admin/*`, and fails closed (401) when the
  `ENTRA_*` settings are missing — which is the normal state on a dev machine.
- **Images: the serving path is built, the bytes have not moved yet.** `/api/img/{key}`
  (`ImagesController` + `ImageStore`) is merged and serves from Blob with a Quickbase
  fallback, behind `IMAGES_VIA_APP`. Nothing is uploaded to the container yet and the flag
  is off, so today every image still comes from Quickbase. See Phase 2b.
  The old `FilesController` was deleted 2026-08-05 — it was dead code, and leaving two
  image routes around was how the wrong assumption survived as long as it did.
- **8 Quickbase tables** in play (`Services/EnvConfig.cs`) — the table below is the
  original survey; reviews now read/write SQL instead:

  | Table | Used by | Direction |
  |---|---|---|
  | `QB_TABLE_HOUSES` | catalog / configurator models | read |
  | `QB_TABLE_IMAGES` | `GalleryService` | read |
  | `QB_TABLE_CASES` + `QB_TABLE_CASE_IMAGES` | `CasesPageService` | read |
  | `QB_TABLE_REVIEWS` (+ approved/pending states) | `ReviewService` | read + write + moderation |
  | `QB_TABLE_OFFER` | `FormService` — **leads** | write |
  | `QB_TABLE_QUESTION` | `FormService` — **leads** | write |
  | `QB_TABLE_SAVED_CONFIGS` | `SavedConfigService` — short links `/c/{code}` | read + write |

- **Content list caching is already done.** `CasesPageService`, `GalleryService`
  and `ReviewService` each use `IMemoryCache` with a 10-minute TTL. The list
  endpoints are not the bottleneck.
- **The uncached hot paths are:**
  - ~~`FilesController` — **every image request** proxies to Quickbase~~
    **✗ This was wrong, corrected 2026-08-05.** `FilesController` is dead code: nothing
    builds `/api/files/...` — not the frontend, not `GalleryService`, not
    `CasesPageService`. Those services return **direct** `https://{realm}/up/...` URLs and
    the browser fetches Quickbase itself, so the .NET app was never in the image path at
    all. Phase 0's proxy cache and `ImageCache` were therefore optimising a route with zero
    traffic. See Phase 2b for what the real problem turned out to be.
  - `SavedConfigService.GetAsync` / `GetReturnPathAsync` — every `/c/{code}`
    short-link click queries Quickbase. These links are in customer inboxes via
    the PR #8 autoresponder, and a saved config is immutable once written, so
    it's an ideal cache candidate.
  - `SitemapController` — crawler traffic, uncached.

> **Sequencing insight:** because image proxying is the real bottleneck, the
> single biggest latency win in this whole roadmap is **moving images to Blob
> Storage** — not the SQL migration. Consider pulling Blob forward and shipping
> it before the row migration; it's independently valuable and lower risk.

---

## Target architecture

- **Azure SQL** (same region as the App Service) + **EF Core** code-first
  migrations. See "Open decisions" — "local" needs pinning down.
- **Azure Blob Storage** for images, fronted by `ImagesController` at `/api/img/{key}`.
  (Originally written as "fronted by the existing `FilesController` route shape so URLs
  don't change" — but that route was never used by anything, and its `{table}/{rid}/{fid}/
  {version}` shape cannot express the base-36 `/up/` URLs the site actually serves.)
- **Admin panel** as an authenticated area of the existing SPA (`/admin/*`),
  talking to new `[Authorize]`-gated API endpoints.
- **Repository seam:** each service gets an interface with two implementations
  (`QuickbaseXService`, `SqlXService`) chosen by a feature flag per entity, so
  the cutover is per-table and instantly revertible.

---

## Phase 0 — Quick latency wins (independent of the migration) ✅

- [x] **Cache the `/c/{code}` short-link lookup** in `SavedConfigService`
      (12h TTL). Only *successful* lookups are cached — caching a miss could pin
      a "not found" for a code about to be minted, breaking a link already sent
      to a customer. The collision check in `GenerateUniqueCodeAsync` calls
      `LookupAsync` directly and so deliberately bypasses the cache.
- [x] **Cache + HTTP cache headers on `FilesController`.**
      ⚠️ *Inert as shipped — `FilesController` served no traffic, and it was deleted
      2026-08-05. The `ImageCache` below survived and is now the memory tier of
      `ImageStore`, so the caching design was sound; only its subject was wrong.*
      Responses carried
      `Cache-Control: public, max-age=31536000, immutable`, so a browser reuses
      image bytes for a year without even revalidating. Server-side bytes live in
      `ImageCache` — a *separate* size-capped `MemoryCache` (64 MB budget, 4 MB
      per-item ceiling), because putting a `SizeLimit` on the shared
      `IMemoryCache` would make every existing caller throw.
- [ ] Measure before/after so the Blob migration's benefit is provable.
      **Do this on the deployed site**, not locally — the win is the round trip
      to Quickbase, which localhost doesn't reproduce faithfully.

## Phase 1 — Foundation (no behaviour change) ✅ *(built out for reviews)*

- [x] Add EF Core + `Microsoft.Data.SqlClient` to `api-dotnet.csproj`
      (`Microsoft.EntityFrameworkCore.SqlServer` + `.Design` 8.0.11)
- [~] `AppDbContext` + entity models mirroring the 8 tables above
      — `Data/Entities/Review.cs` only. Entities land per migration, not all up front.
- [x] Initial migration; LocalDB/SQL Express for dev, Azure SQL for deployed envs
      (`InitialCreate_Reviews`, `AddReviewUpdatedAt`, + `AppDbContextFactory` for design-time)
- [x] Connection string via `EnvConfig` (never committed; Azure App Settings in prod).
      Absent = every entity reads Quickbase; the app no longer crashes at startup without it.
- [x] Per-entity feature flags, e.g. `DATA_SOURCE_HOUSES=quickbase|sql`, defaulting
      to `quickbase` everywhere (`Services/DataSource.cs`)
- [~] Extract interfaces (`IGalleryService`, `IReviewService`, …) and register the
      Quickbase implementations — **zero functional change; this is the seam**
      — `IReviewStore` only so far.

> **`InvariantGlobalization` must stay `false`.** `Microsoft.Data.SqlClient` throws on
> connect otherwise. This blocked Azure SQL entirely until it was found.

## Phase 2 — Import + shadow verification

- [~] One-off import command: Quickbase → SQL for all 8 tables
      — reviews only: `dotnet run -- import-reviews`.
      ⚠️ **Reviews have since diverged.** SQL is authoritative and moderation decisions live
      there; re-running the import overwrites them with Quickbase's stale copy. Only run it
      if that is genuinely what you want.
- [ ] Blob migration for gallery/case images; keep Quickbase IDs as a mapping column
      — **see Phase 2b below**, which supersedes this line: the key is the attachment path,
      so no mapping column is needed.
- [ ] ~~Nightly re-import while both systems run~~ — **dropped for reviews.** It would
      clobber moderation state (above). Reconsider per-table for read-only entities.
- [~] **Shadow-read comparison:** serve from Quickbase, query SQL in parallel, log
      diffs. This is the acceptance gate — cut over an entity only when its diff
      log is clean. — built and used for reviews.
- [ ] Latency benchmark: Quickbase vs SQL per endpoint (proves the premise)

## Phase 2b — Images to Blob (code merged, not yet deployed)

### What the problem actually is

The original survey said images were slow because the app proxied each one. It doesn't —
see "Current state". Measured against the live host on 2026-08-05, the real cost is how
Quickbase serves them:

| | Quickbase today | After |
|---|---|---|
| `Cache-Control` | `max-age=7200, private` | `public, max-age=31536000, immutable` |
| Edge cache | `cf-cache-status: DYNAMIC` — never cached | n/a, served from our origin |
| TTFB | ~250-320ms per image, cold ~500ms | ~8ms once warm (memory cache) |
| Origin | third-party host, own DNS + TLS handshake | same origin as the page |

`private` + two hours is the headline: a returning visitor re-downloads every image, and no
shared cache may hold them. Some assets are also unoptimised — one case image is 2.8 MB, one
gallery image 1.9 MB, with no WebP negotiation. That is roadmap item #9, not this work.

### Design

- **The blob name is the normalised Quickbase attachment path** (`up/{dbid}/g/…`), so both
  URL shapes work without decoding base-36, and no mapping column is needed.
- Keys are stored **decoded**, because ASP.NET decodes route values before the controller
  sees them — an encoded key could never match an incoming request. Real filenames are
  percent-encoded Cyrillic, so this is the common case, not an edge case.
- `ImageStore` chains memory → Blob → **Quickbase fallback**, so URLs can be switched before
  every byte is copied and a partial import degrades instead of breaking.
- Two independent flags; see DEPLOY.md for the order. `IMAGES_VIA_APP` is worth turning on
  by itself, before any container exists, purely for the cache headers.

- [x] `ImageKey` — one identity for the blob name, the cache entry and the route, validated
      against traversal and against pointing anywhere but a Quickbase attachment path
- [x] `ImageStore` + `BlobImageSource` + `QuickbaseImageSource` fallback chain
- [x] `/api/img/{key}` with immutable caching and an `X-Image-Origin` diagnostic header
- [x] `IMAGES_VIA_APP` rewrite in `GalleryService` and `CasesPageService`, applied on the way
      out of the cache so a flip takes effect immediately rather than after the TTL
- [x] `import-images` / `verify-images` commands
- [x] Tests (41 new; 105 total)
- [ ] **Run the import against the real container** — needs Azure credentials
- [ ] **Rewrite the 168 hard-coded `/up/` URLs** across 23 frontend content files. These are
      the majority of the site's images (homepage, delivery, interiors) and the API never
      sees them, so `import-images` does not cover them. Separate pass.
- [ ] Re-measure on the deployed site once live

## Phase 3 — Admin panel

- [x] Admin auth (Entra ID, authorization code flow) + `[Authorize]` on all admin endpoints
- [x] `/admin` shell in the SPA: login, nav, not indexed (`robots`, no sitemap entry)
- [x] **Review moderation** — approve/reject queue (replaces the pending/approved
      flow previously done in Quickbase). BG + EN.
- [ ] **Houses/catalog CRUD** — prices, specs, plans (you edit these regularly;
      PR #4 was a manual price change that could have been an admin edit)
- [ ] **Cases + gallery CRUD** with image upload to Blob
- [ ] **Leads view** — read-only list of offers/questions with export
- [ ] Audit log (who changed what, when) — you're editing live pricing
- [x] Admin tests (xUnit for endpoints/authz, Vitest for the UI)
      — `AdminAuthConfigTests`, `ReviewModerationTests`, `AdminReviewsPage.test.jsx`

## Phase 4 — Cutover

- [~] Flip read entities to `sql` one at a time, lowest-risk first:
      gallery → cases → houses → reviews
      — **reviews went first**, out of the planned order: it was the only table needing an
      admin UI anyway, so migrating it proved the seam and the panel together.
- [~] Writes last, and **leads last of all** (see risks) — review writes are live on SQL;
      leads remain entirely on Quickbase.
- [ ] Soak on SQL with Quickbase still importable as rollback
- [ ] Retire Quickbase per table; remove dead code + env vars only after soak

---

## Decisions made (2026-08-03)

- ✅ **Azure SQL**, same region as the App Service.
- ✅ **Azure Blob Storage** for images.
- ✅ **Billing/invoicing stays in Quickbase** — out of scope for this migration.
  Only the site-facing content tables move.

## Decisions made (2026-08-04/05)

- ✅ **Admin auth: Microsoft Entra ID**, authorization code flow (implicit grant stays
  disabled on the registration). Same identity system as the Graph email credentials.
  Optional `ADMIN_ALLOWED_USERS` allowlist; empty = anyone in the tenant.
- ✅ **Azure SQL tier: serverless**, but **auto-pause disabled**. Billing continues past
  the free vCore allowance rather than the database going unavailable mid-month — correct
  for production, but it means the bill is no longer guaranteed to be zero. Check the
  first invoice.

## Open decisions

1. **Do leads migrate?** If sales works offers/questions inside Quickbase day to
   day — and billing already stays there — it may be simplest to keep leads in
   Quickbase too and migrate only content. Leaning **no**: PR #8's autoresponder
   depends on those writes, and the upside is small.
2. **App SQL login.** The app still connects as `dbadmin` — the server administrator,
   far more privilege than it needs. Should become a contained user limited to
   read/write on the app's tables. Not urgent; shouldn't stay indefinitely.

---

## Risks

- **Leads are revenue.** `QB_TABLE_OFFER`/`QB_TABLE_QUESTION` writes are the
  business's lead flow, and PR #8's autoresponder now depends on them. A failed
  write is a lost customer — migrate these last, dual-write during transition.
- **Images are the long pole.** Blob migration + URL stability affects SEO;
  `SitemapController` and gallery URLs must not change shape.
- **Admin panel is new public attack surface.** It is the first authenticated area in
  the app: HTTPS-only cookies, no admin routes in the sitemap, authz tests. Shipped
  2026-08-05 and fails closed, but it stays on this list — it's live surface now.
- **Saved configs are live.** `/c/{code}` short links are already out in the wild
  in customer emails (PR #8 autoresponder) — those codes must keep resolving
  through and after migration.
