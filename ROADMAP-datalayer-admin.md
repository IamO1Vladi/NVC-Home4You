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

- **Caching is inconsistent:** only `CasesPageService` uses `IMemoryCache`.
  `GalleryService` and `ReviewService` hit Quickbase on every request.
- **Files:** `FilesController` proxies Quickbase attachments — images are stored
  in Quickbase, so migrating them means moving blobs, not just rows.

> ⚠️ **Worth knowing before you invest in this:** a chunk of the load-time win is
> available *without* migrating at all — adding `IMemoryCache` to Gallery and
> Reviews (the same pattern `CasesPageService` already uses) would cut most
> repeat-request latency in an afternoon. Migration is still the right call for
> vendor consolidation and query flexibility, but do the caching first so you
> can measure what the migration itself actually buys.

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

## Open decisions

1. **"Local" — where does the DB actually live?** On Azure, the latency win comes
   from an Azure SQL instance in the *same region* as the App Service, not from a
   machine on your premises. A truly on-prem DB behind your office network would
   likely be *slower* for Azure-hosted requests and adds VPN/firewall work.
   **Recommendation: Azure SQL, same region.** Worth confirming this matches what
   you had in mind — it changes Phase 1 materially.
2. **Admin auth.** Microsoft Entra ID (staff sign in with existing M365 accounts,
   nothing new to manage, MFA included) vs ASP.NET Identity (self-contained, more
   code, own password handling). **Recommendation: Entra ID** — you already run
   M365 and Graph OAuth for email, so it's the same identity system.
3. **Do leads migrate at all?** If sales works offers/questions inside Quickbase
   day to day, moving them means rebuilding that workflow in the admin panel.
   Viable to keep leads in Quickbase and migrate only content tables.
4. **Hosting tier / cost** for Azure SQL — not free; worth a quick check against
   what Quickbase currently costs.

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
