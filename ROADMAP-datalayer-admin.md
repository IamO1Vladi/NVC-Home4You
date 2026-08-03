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

---

## Why an admin panel is part of this, not a follow-up

Quickbase is currently **both** the database and the staff-facing admin UI. Today
your team edits houses, cases, gallery images and moderates reviews inside
Quickbase's own interface. The moment data lives in SQL instead, that interface
is gone — so the admin panel is not a nice-to-have bolted on afterwards, it is
the replacement for a tool the business uses daily. Migration cannot complete
without it.

---

## Current state (as of 2026-08-03)

- **No database anywhere.** `api-dotnet.csproj` has exactly one package
  (Swashbuckle). No EF Core, no SQL client, no migrations.
- **No auth anywhere.** No `[Authorize]`, no Identity, no Entra. Every endpoint
  is public. The admin panel is greenfield.
- **8 Quickbase tables** in play (`Services/EnvConfig.cs`):

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
  - `FilesController` — **every image request** proxies to Quickbase
    (`RawGetAsync v1/files/{table}/{rid}/{fid}/{version}`), no cache, no
    long-lived HTTP cache headers. A gallery page = one Quickbase round trip
    *per image*. **This is the most likely cause of "requests take too long."**
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
- **Azure Blob Storage** for images, fronted by the existing `FilesController`
  route shape so URLs don't change.
- **Admin panel** as an authenticated area of the existing SPA (`/admin/*`),
  talking to new `[Authorize]`-gated API endpoints.
- **Repository seam:** each service gets an interface with two implementations
  (`QuickbaseXService`, `SqlXService`) chosen by a feature flag per entity, so
  the cutover is per-table and instantly revertible.

---

## Phase 0 — Quick latency wins (independent of the migration)

Ship these first; each is small, low-risk and measurable on its own.

- [ ] **Cache the `/c/{code}` short-link lookup** in `SavedConfigService`.
      Saved configs are immutable once written, so a long TTL is safe. These
      links are live in customer inboxes.
- [ ] **Cache + set HTTP cache headers on `FilesController`.** Image bytes keyed
      by `{table}/{rid}/{fid}/{version}` are immutable — the version is in the
      key — so they can be cached hard (`Cache-Control: public, max-age=1y,
      immutable`). Biggest single win available today.
- [ ] Measure before/after so the Blob migration's benefit is provable.

## Phase 1 — Foundation (no behaviour change)

- [ ] Add EF Core + `Microsoft.Data.SqlClient` to `api-dotnet.csproj`
- [ ] `AppDbContext` + entity models mirroring the 8 tables above
- [ ] Initial migration; LocalDB/SQL Express for dev, Azure SQL for deployed envs
- [ ] Connection string via `EnvConfig` (never committed; Azure App Settings in prod)
- [ ] Per-entity feature flags, e.g. `DATA_SOURCE_HOUSES=quickbase|sql`, defaulting
      to `quickbase` everywhere
- [ ] Extract interfaces (`IGalleryService`, `IReviewService`, …) and register the
      Quickbase implementations — **zero functional change; this is the seam**

## Phase 2 — Import + shadow verification (still not live)

- [ ] One-off import command: Quickbase → SQL for all 8 tables
- [ ] Blob migration for gallery/case images; keep Quickbase IDs as a mapping column
- [ ] Nightly re-import while both systems run, so SQL stays fresh during testing
- [ ] **Shadow-read comparison:** serve from Quickbase, query SQL in parallel, log
      diffs. This is the acceptance gate — cut over an entity only when its diff
      log is clean.
- [ ] Latency benchmark: Quickbase vs SQL per endpoint (proves the premise)

## Phase 3 — Admin panel

- [ ] Admin auth (see open decisions) + `[Authorize]` on all admin endpoints
- [ ] `/admin` shell in the SPA: login, nav, not indexed (`robots`, no sitemap entry)
- [ ] **Review moderation** — approve/reject queue (replaces the pending/approved
      flow currently done in Quickbase)
- [ ] **Houses/catalog CRUD** — prices, specs, plans (you edit these regularly;
      PR #4 was a manual price change that could have been an admin edit)
- [ ] **Cases + gallery CRUD** with image upload to Blob
- [ ] **Leads view** — read-only list of offers/questions with export
- [ ] Audit log (who changed what, when) — you're editing live pricing
- [ ] Admin tests (xUnit for endpoints/authz, Vitest for the UI)

## Phase 4 — Cutover

- [ ] Flip read entities to `sql` one at a time, lowest-risk first:
      gallery → cases → houses → reviews
- [ ] Writes last, and **leads last of all** (see risks)
- [ ] Soak on SQL with Quickbase still importable as rollback
- [ ] Retire Quickbase per table; remove dead code + env vars only after soak

---

## Decisions made (2026-08-03)

- ✅ **Azure SQL**, same region as the App Service.
- ✅ **Azure Blob Storage** for images.
- ✅ **Billing/invoicing stays in Quickbase** — out of scope for this migration.
  Only the site-facing content tables move.

## Open decisions

1. **Admin auth.** Microsoft Entra ID (staff sign in with existing M365 accounts,
   nothing new to manage, MFA included) vs ASP.NET Identity (self-contained, more
   code, own password handling). **Recommendation: Entra ID** — you already run
   M365 and Graph OAuth for email, so it's the same identity system.
2. **Do leads migrate?** If sales works offers/questions inside Quickbase day to
   day — and billing already stays there — it may be simplest to keep leads in
   Quickbase too and migrate only content. Decide after the admin panel exists.
3. **Azure SQL tier.** Serverless (auto-pause, scales to near-zero when idle)
   suits this traffic shape better than a fixed tier. Confirm against current
   Azure pricing before provisioning.

---

## Risks

- **Leads are revenue.** `QB_TABLE_OFFER`/`QB_TABLE_QUESTION` writes are the
  business's lead flow, and PR #8's autoresponder now depends on them. A failed
  write is a lost customer — migrate these last, dual-write during transition.
- **Images are the long pole.** Blob migration + URL stability affects SEO;
  `SitemapController` and gallery URLs must not change shape.
- **Admin panel is new public attack surface.** No auth exists today, so this is
  the first authenticated area in the app: rate limiting, HTTPS-only cookies,
  no admin routes in the sitemap, and authz tests before it ships.
- **Saved configs are live.** `/c/{code}` short links are already out in the wild
  in customer emails (PR #8 autoresponder) — those codes must keep resolving
  through and after migration.
