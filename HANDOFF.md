# Where things stand — 2026-08-05

> **Superseded 2026-08-06.** Gallery, cases and every image have since moved off Quickbase and
> are live. **Start at [ROADMAP-next.md](ROADMAP-next.md)**, which covers what is left
> (leads, saved configs, factory sheet) and the state as of that release, `deploy-2026-08-06`.
> This file is kept for the history below — what was believed on 2026-08-05, including the two
> claims in "Next steps" that turned out to be wrong.

Written at the end of the vacation working session. Everything below is **deployed and
verified live** unless it says otherwise. Start here when you pick the project back up.

---

## Live state

Production is `deploy-2026-08-05`. `master` == `production` == what's deployed.

| Area | Status |
|---|---|
| Reviews | **Fully on Azure SQL** — reads and writes |
| Admin panel | **Live** at `/admin`, Entra ID sign-in, BG + EN |
| Everything else | Still Quickbase: gallery, cases, houses/catalog, saved configs, leads |

Publishing is now one action (VS Code → right-click `api-dotnet` → Publish). The SPA
builds itself; there is no `dist/` → `wwwroot` copy step any more. See `DEPLOY.md`.

---

## What was done this session

1. **Phase 0 caching** — the image proxy (`/api/files`) now sends
   `Cache-Control: public, max-age=31536000, immutable` and caches bytes server-side;
   `/c/{code}` short-link lookups cached 12h. These were the only uncached hot paths
   hitting Quickbase.
2. **Publishing automated** — `dotnet publish` builds the SPA (`BuildSpa` target).
   `wwwroot` untracked; 713 stale bundles removed from git.
3. **`master` / `production` branches** — `git log --oneline production..master` answers
   "what's merged but not live", replacing the hand-written DEPLOY PENDING block.
4. **Reviews migrated to Azure SQL** — EF Core, importer, shadow comparison, per-entity
   feature flag, read + write seam.
5. **Admin panel** — Entra ID (authorization code flow), review moderation queue.
6. **Security** — publish-profile credential untracked, three package vulnerabilities
   closed (one High predated this work).

---

## Next steps, in the order I'd take them

### 1. Blob storage for images — biggest remaining win
**Started 2026-08-05; two claims in this section turned out to be wrong.** Corrected in
ROADMAP-datalayer-admin.md → Phase 2b, which supersedes the paragraph below.

- *"Every gallery image is a separate Quickbase round trip [through the app]"* — no. Nothing
  ever called `FilesController`; the browser fetched Quickbase directly, so Phase 0's cache
  sat on a route with no traffic. That controller has now been deleted.
- *"`FilesController` already proxies by `{table}/{rid}/{fid}/{version}`, so the URL shape
  can stay identical"* — that shape cannot express the base-36 `/up/` URLs the site actually
  serves. The replacement, `/api/img/{key}`, keys on the attachment path instead.

The real cost was how Quickbase serves images: `Cache-Control: max-age=7200, private` and
`cf-cache-status: DYNAMIC` — never edge-cached, re-fetched every two hours, ~250-320ms each.
The `images` container already exists.

### 2. Migrate the next table
The pattern is proven and largely mechanical now:
`Entity` → migration → `IXStore` interface → `SqlXService` → importer + compare → flag.
Lowest-risk order: **gallery → cases → houses**. Leave **leads** last, or never — sales
works them in Quickbase, and PR #8's autoresponder depends on those writes.

### 3. Extend the admin panel
It only does review moderation today. The natural next piece is **houses/catalog CRUD**,
so price changes stop being code edits (PR #4 was a manual price commit).

### 4. Roadmap items, unblocked and frontend-only
`#3` popular presets, `#5` financing calculator. See `improvements.txt`.

---

## Things that will bite if forgotten

**Secret expiry — every 6 months, first due ~2027-02-04.** Entra client secret, Graph
email credentials, Quickbase token. Each fails *silently and partially*: an expired Graph
credential stops lead autoresponders while forms still report success. Nothing alerts.
Details per-credential in `DEPLOY.md`.

**Quickbase and SQL have now diverged.** Reviews are authoritative in SQL. Re-running
`dotnet run -- import-reviews` would overwrite moderation decisions made in the panel with
Quickbase's stale copy. Only run it if that is genuinely what you want.

**`dbadmin` is still the app's SQL login.** That is the server administrator — more
privilege than the app needs. Worth replacing with a contained user limited to read/write
on the app's tables. Not urgent, but it shouldn't stay that way indefinitely.

**Auto-pause is off the free tier's default.** Billing continues past the free vCore
allowance rather than the database going unavailable mid-month — correct for production,
but it means the bill is no longer guaranteed to be zero. Worth a look at the first
invoice.

**Run the dependency audit before each deploy:**
`dotnet list package --vulnerable --include-transitive`. The normal build only warns about
direct packages, which is how a High severity issue sat unnoticed.

---

## Hard-won details worth not rediscovering

- **`InvariantGlobalization` must stay `false`.** `Microsoft.Data.SqlClient` throws on
  connect otherwise. This blocked Azure SQL entirely until found.
- **Admin sign-in took four chained fixes.** An API must return **401**, never a 302 to
  Microsoft — `fetch` follows redirects and the login host sends no CORS headers.
  Interactive sign-in only works as a top-level navigation (`/admin/signin`). App Service
  terminates TLS, so `UseForwardedHeaders` is required or the correlation cookie can't be
  `SameSite=None; Secure` and the callback throws. And the app uses **authorization code
  flow**, so implicit grant stays disabled on the registration.
- **`OnRemoteFailure` redirects to `/admin?authError=…`** instead of a blank 500. That is
  what made the last bug diagnosable — keep it.
- **The cases page caches its whole payload for 10 minutes.** Moderation evicts that entry;
  without it an approved review appears on the homepage instantly and there ten minutes
  later, which looks like a bug.
- **Config image filenames are built by template literal** (`` `bath-${key}.webp` ``), so a
  text search will report every asset as unused. Do not delete assets on that basis.
- **User-secrets are per-machine.** They do not travel with the repo; each machine needs
  its own `SQL_CONNECTION_STRING`.

---

## Local development

```bash
cd api-dotnet && dotnet run                 # API on :5178
cd "NVC Claude version" && npm run dev      # SPA on :5173, proxies /api
```

Admin panel needs `ENTRA_*` in user-secrets to work locally; without them it fails closed
at 401 and everything else runs normally.

Tests: `dotnet test` (64) and `npm test` (47).
