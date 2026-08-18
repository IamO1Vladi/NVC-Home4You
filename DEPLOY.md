# Deploying NVC Home4You

Azure App Service, published by **Zip Deploy from VS Code**. Azure is not connected to
GitHub, so *merging to `master` does not deploy anything* — a human publishes.

## Branches

| Branch | Means |
|---|---|
| `master` | Integration. Feature branches merge here. **Merged ≠ live.** |
| `production` | What is actually deployed. Only ever fast-forwarded from `master`, at deploy time. |
| `feature/*` | Short-lived. Branch off `master`, merge back, delete. |

The question "what's merged but not yet live?" is answered by:

```bash
git log --oneline production..master
```

This replaces the hand-written `DEPLOY PENDING` block that used to live at the top of
the old tracker (now `ROADMAP.md`).

## Publish — step by step

1. **Merge the work into `master`** (PR on GitHub, squash merge, delete the branch).

2. **Check what's about to ship.**
   ```bash
   git checkout master && git pull
   git log --oneline production..master
   ```

3. **Run the tests.** Both halves:
   ```bash
   cd api-dotnet.Tests && dotnet test
   cd "../NVC Claude version" && npm test
   ```

4. **Check for vulnerable dependencies.**
   ```bash
   cd api-dotnet && dotnet list package --vulnerable --include-transitive
   ```
   `--include-transitive` is the point: the build only warns about packages referenced
   directly, so a High severity issue can sit in a dependency-of-a-dependency for months
   without ever showing up in normal output. Anything listed gets pinned explicitly to a
   patched version before shipping.

5. **Move `production` up to `master` and push.**
   ```bash
   git checkout production && git merge --ff-only master && git push
   ```
   `--ff-only` is deliberate: if it refuses, someone committed directly to `production`,
   which should never happen. Investigate rather than forcing it.

6. **Publish from the `production` checkout.** In VS Code: right-click the `api-dotnet`
   project → **Publish to Azure** → pick the App Service.

   You do **not** need to build the frontend first. Publishing runs `npm run build`
   automatically (the `BuildSpa` target in `api-dotnet.csproj`) and writes it into
   `wwwroot`, so the SPA can never ship stale. There is no `dist/` → `wwwroot` copy step
   any more — if you still have that in muscle memory, drop it.

6b. **Refresh the prerendered pages** — needed whenever page copy, routes or the gallery
   changed. Skip it and the deploy still works; it just ships the previous snapshots.

   These are what give crawlers a page with content in it instead of an empty
   `<div id="root">`. Unlike the SPA build, this one is **not** automatic: it needs the app
   running, which a publish does not have.

   **Build first, then start the app, then prerender — in that order.** The app reads
   `index.html` once at startup, so a rebuild while it is running leaves it serving a page
   that points at a JS bundle the build just deleted; React never boots and every snapshot
   would be empty. The script refuses to write anything in that case rather than shipping 55
   blank pages, so a mistake here costs a restart, not a bad release.

   ```bash
   cd "NVC Claude version" && npm run build
   cd ../api-dotnet && DATA_SOURCE_GALLERY=sql DATA_SOURCE_CASES=sql DATA_SOURCE_REVIEWS=sql dotnet run
   ```

   **The DATA_SOURCE flags matter, and it is GALLERY, not HOUSES.** A local app without
   them reads Quickbase while production reads SQL, so snapshots would freeze prices from
   the wrong store — this actually happened with a corrected price on 2026-08-15. The
   prerender script now compares the local catalogue against the live site and refuses to
   run on a mismatch, so forgetting the flags fails loudly instead of silently.
   then, in a second terminal:
   ```bash
   cd "NVC Claude version" && npm run prerender
   ```

   Expect `55/55 routes`. It writes to `api-dotnet/prerendered/`, which the publish picks
   up (`StagePrerenderedForPublish`). Then stop the local app and publish as above.

   Run it **against a local app, never against production** — snapshots taken from the live
   site would bake in whatever is currently deployed, which is the version you are replacing.

7. **Tag the deploy** so you can identify what's live later:
   ```bash
   git tag deploy-$(date +%Y-%m-%d) && git push --tags
   ```

8. **Verify on the live site**, hard-refreshed (Ctrl+F5):
   - the pages you changed
   - a `/c/{code}` short link still resolves
   - submitting the offer form still sends the autoresponder

## App Service environment variables

All under **Settings → Environment variables → App settings** (not the Connection
strings tab below it — App Service renames those to `SQLAZURECONNSTR_*`).

| Name | Purpose |
|---|---|
| `SQL_CONNECTION_STRING` | Azure SQL. Absent = every entity reads Quickbase, as before. |
| `DATA_SOURCE_REVIEWS` | `sql` to serve reviews from SQL; anything else = Quickbase. |
| `ENTRA_CLIENT_ID` / `ENTRA_TENANT_ID` | Admin sign-in. Not secrets. |
| `ENTRA_CLIENT_SECRET` | Admin sign-in. **Secret.** |
| `ADMIN_ALLOWED_USERS` | Optional. Comma-separated emails; empty = anyone in the tenant. |
| `BLOB_CONNECTION_STRING` | Azure Blob, for images. Absent = images are read from Quickbase. **Secret.** |
| `BLOB_IMAGES_CONTAINER` | Optional. Defaults to `images`. |
| `IMAGES_VIA_APP` | `true` to serve images from our own origin. Anything else = Quickbase URLs, as before. |
| `DATA_SOURCE_GALLERY` | `sql` to serve the gallery from SQL; anything else = Quickbase. |
| `DATA_SOURCE_CASES` | `sql` to serve the cases page from SQL; anything else = Quickbase. |
| `AUDIT_ARCHIVE_ENABLED` | `true` to switch on audit-log archiving. **Absent = nothing is ever deleted**, which is the safe default. |
| `AUDIT_ARCHIVE_TO` | Where the archive CSV is emailed. Defaults to `vvladimirov@nvc-home4you.eu`. |
| `AUDIT_RETENTION_MONTHS` | How much history stays in the panel. Defaults to 6; anything under 1 is ignored. |

### Switching on audit archiving

The audit log grows forever until this is enabled, and that is deliberate — a job that
deletes evidence should not start on its own the day it deploys.

Before setting `AUDIT_ARCHIVE_ENABLED=true`, see what a real run would remove:

```powershell
cd api-dotnet
dotnet run -- archive-audit-log --dry-run
```

It writes the CSV to disk and sends and deletes nothing. Read it, confirm the row count and
the date range are what you expect, then set the flag.

**Nothing is deleted that was not first emailed successfully.** If the send fails the rows
stay and the next run retries them; a failure is logged as `AUDIT GAP` or as an explicit
archive error. The worker runs daily, ten minutes after startup.

## Release: gallery + cases to SQL and Blob

**Read this whole section before starting.** Roughly an hour, most of it waiting on
imports. Every step is reversible by unsetting one variable, and nothing is destructive —
no Quickbase data is modified or deleted at any point.

The flags default to Quickbase, so **publishing the code changes nothing on its own**. That
is deliberate: the deploy and the cutover are separate events, and you can stop between any
two steps and leave the site in a working state.

### Before you start

Confirm all of these are set under **App settings**, then restart the App Service once so it
picks them up:

- `SQL_CONNECTION_STRING`, `BLOB_CONNECTION_STRING`
- `ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_SECRET`
- Leave `BLOB_IMAGES_CONTAINER` unset (defaults to `images`)
- Leave `IMAGES_VIA_APP`, `DATA_SOURCE_GALLERY`, `DATA_SOURCE_CASES` unset for now

You will run the import commands **from your machine against production**, so your IP needs
to be in the SQL server firewall (Portal → SQL servers → `nvc-home4you` → Networking).

#### Check what this machine's secrets point at — do this first

The import commands read configuration exactly as the app does: **user-secrets**, overridden
by environment variables. Normally user-secrets already hold the right values and there is
nothing to do. The check matters because a machine used for development may have been pointed
at LocalDB or at a scratch container, and if it has, these commands will write production data
somewhere harmless-looking and report success.

```powershell
cd api-dotnet
dotnet user-secrets list
```

For the migration this machine needs:

| Key | Value |
|---|---|
| `SQL_CONNECTION_STRING` | the **production** Azure SQL string — not `(localdb)` |
| `BLOB_CONNECTION_STRING` | the production storage string |
| `BLOB_IMAGES_CONTAINER` | **unset**, so it defaults to `images` (a value like `images-dev` sends everything to a scratch container) |
| `DATA_SOURCE_GALLERY` / `DATA_SOURCE_CASES` | unset — these only affect a local run, never what the importers write |

##### Setting a value that contains a double quote

`dotnet user-secrets set` goes through PowerShell's native-argument handling, which **silently
strips `"` characters** — a connection string whose password contains one is stored wrong, with
no error, and every command then fails to authenticate for no visible reason. Quoting the
argument does not help; the stripping happens after PowerShell is done with it.

Two ways round it. Escape the quote as `\"`:

```powershell
dotnet user-secrets set "SQL_CONNECTION_STRING" 'Server=...;Password=aa\"bb;'
```

Or, less error-prone, edit the file directly in VS Code — JSON uses the same `\"` escape, and
the editor flags it if you get it wrong:

```
%APPDATA%\Microsoft\UserSecrets\eeb92d08-ebad-4094-86a6-24cf86c0cac2\secrets.json
```

Either way, confirm it round-tripped before relying on it:

```powershell
dotnet user-secrets list | Select-String "SQL_CONNECTION_STRING"
```

##### Afterwards

If this is a development machine, put it back when the migration is done — restore the local
`SQL_CONNECTION_STRING` and set `BLOB_IMAGES_CONTAINER` to a scratch container — so ordinary
local work cannot reach production storage.

### Step 1 — Ship the code

From the repo root, one command per line:

```powershell
git checkout master
git pull
git merge --ff-only feature/images-blob-migration
git log --oneline production..master
```

That last line lists exactly what is about to go live. Then the pre-flight checks:

```powershell
cd api-dotnet
dotnet list package --vulnerable --include-transitive
cd ..
dotnet test
cd "NVC Claude version"
npm test
cd ..
```

Then move `production` up and push:

```powershell
git checkout production
git merge --ff-only master
git push
```

Publish from the `production` checkout: **VS Code → right-click `api-dotnet` → Publish to
Azure**. That is the whole publish. The `BuildSpa` target in `api-dotnet.csproj` runs
`npm run build` into `wwwroot` as part of it, so there is no `dist` copy step on any machine.

**Verify before going further:** the site looks exactly as it did. Every flag is still off,
so this is the check that the deploy itself changed nothing.

### Step 2 — Create the database tables

```powershell
cd api-dotnet
dotnet ef database update
```

Uses `$env:SQL_CONNECTION_STRING` from the block above. Adds `Houses`, `HouseImages`,
`Cases`, `CaseImages`. Nothing reads them yet.

### Step 3 — Copy the data and images

Run these one at a time and read each result before moving on:

```powershell
dotnet run -- import-gallery --dry-run
dotnet run -- import-gallery
dotnet run -- import-cases --dry-run
dotnet run -- import-cases
```

Run each dry run first and read its output. The gallery import **refuses the whole run** if
any house has a category it cannot map — better to find that before it has uploaded half the
images. Expect roughly 14 houses / 63 images and 1 case / 5 images, and a WebP saving around
70 MB.

Both are idempotent: re-running uploads nothing and changes nothing.

### Step 4 — Migrate the hard-coded site images

The URLs were rewritten in the repo and shipped in step 1, but the **blobs** still have to
exist in whichever container this environment uses.

⚠️ **The obvious command does nothing here.** `migrate-content-images` finds images by
scanning the source for Quickbase URLs — and the committed source no longer contains any, so
it reports "0 unique URLs found" and exits successfully having uploaded nothing. That is a
successful-looking no-op, and it is how you end up flipping the flags with an empty container.

Run it against the source as it was **before** the rewrite instead:

```powershell
cd ..
git archive 2eba191 "NVC Claude version/src" | tar -x -C "$env:TEMP\prerewrite"
cd api-dotnet
dotnet run -- migrate-content-images "$env:TEMP\prerewrite\NVC Claude version\src"
```

`2eba191` is the commit before the rewrite. The command uploads the 47 blobs and rewrites the
throwaway copy, which nothing reads. Expect `47 uploaded`.

These are the majority of the site's photographs, and unlike gallery and cases images they
have **no Quickbase fallback** — their URLs no longer point there. A missing blob is a broken
photo, not a slow one.

### Step 5 — Check before switching anything on

```powershell
dotnet run -- verify-images
```

Checks the three groups independently, against where the site actually reads them from — the
image keys stored in SQL for gallery and cases, and the `/api/img/content/…` paths in the
frontend source. Names the container, and exits non-zero if anything is missing. A clean run
looks like:

```
Container: images
  gallery        63/63 present, 0 missing
  cases          5/5 present, 0 missing
  site content   47/47 present, 0 missing
OK — every referenced image is in Blob.
```

All three must be clean. `cases` covers the company logo and cover image as well as the
carousel — they live on the case row rather than in the images table, so they are exactly the
sort of thing a looser check misses.

Then request an image from the **live site** and look at the response header:

```powershell
(Invoke-WebRequest -Method Head -Uri "https://nvc-home4you.eu/api/img/content/bukcsfwf9-rdg-eg-vb.webp").Headers["X-Image-Origin"]
```

It must print **`Blob`**. This step is not optional: the read path falls back to Quickbase per
key, so an empty, misnamed or unreachable container still serves perfectly good images and is
indistinguishable from success without this header.

`Quickbase` here means the blob is missing and you are still being carried by the fallback —
which will stop working for content images, because their URLs no longer point at Quickbase.
Go back to step 4.

### Step 6 — Flip the flags, one at a time

Set one, wait for the App Service to restart, check the site, then set the next:

1. `IMAGES_VIA_APP=true` — images now come from our origin with a year of `immutable`
   caching instead of Quickbase's `max-age=7200, private`. Check the homepage and a gallery
   page, hard-refreshed.
2. `DATA_SOURCE_GALLERY=sql` — check the gallery page, and that each of the four category
   filters returns the right models.
3. `DATA_SOURCE_CASES=sql` — check the cases page: photos, logos, quotes, and the location
   and attribution labels.

**Rollback is unsetting the flag you just set.** It takes effect on the next request rather
than after the 10-minute payload cache, because the URL rewrite happens on the way out of the
cache rather than into it.

### Step 7 — Verify the admin panel

Sign in at `/admin`, then check `/admin/gallery` and `/admin/cases`. Edit something small,
save, and confirm it appears on the public page immediately.

This is the first time admin sign-in is exercised against the new sections, and it cannot be
tested without `ENTRA_*` — so if anything is going to need attention, it is here. A failed
sign-in redirects to `/admin?authError=…` with the reason rather than a blank 500.

### Step 8 — Tag it

```powershell
git tag "deploy-$(Get-Date -Format yyyy-MM-dd)"
git push --tags
```

Then **close the terminal** you set the environment variables in, so this machine goes back
to its own configuration rather than silently staying pointed at production.

### What is NOT done by this release

Quickbase is still the source for **leads** (offers/questions) and **saved configurator
links**, and both still run through it. Reviews, gallery and cases are on SQL; images are on
Blob. Do not switch Quickbase off — `verify-images` passing means the images are safe, not
that the whole site is off Quickbase.

## Image storage cutover (background)

The two image settings are independent on purpose, and the order matters:

1. **Copy the bytes.** With `BLOB_CONNECTION_STRING` set:
   ```bash
   cd api-dotnet && dotnet run -- import-images
   ```
2. **Confirm they arrived.** `dotnet run -- verify-images` exits non-zero if anything the site
   references is missing from the container.
3. **Check the read path.** Request any image and look at `X-Image-Origin`; it should say
   `Blob`. This step is not optional — the read path falls back to Quickbase per key, so an
   empty, misnamed or unreachable container still serves perfectly good images and is
   indistinguishable from success without that header.
4. **Then flip `IMAGES_VIA_APP=true`**, which is what actually changes the URLs in the
   gallery and cases payloads.

Rolling back is setting `IMAGES_VIA_APP` back to `false`; it takes effect on the next request
rather than after the 10-minute payload cache, because the rewrite happens on the way out of
the cache rather than into it.

Worth knowing: turning on `IMAGES_VIA_APP` is worthwhile **even with no Blob container at
all**. Quickbase serves images as `Cache-Control: max-age=7200, private` with
`cf-cache-status: DYNAMIC` — never edge-cached, re-fetched every two hours, ~250-320ms each.
Serving them from our origin replaces that with a year of `immutable`.

## ⚠️ Secret expiry — every 6 months

The Entra client secret, and the other credentials this app uses, are issued for
**6 months**. Created 2026-08-04, so the first renewal is due around **2027-02-04**.

This matters more than it sounds. Each expiry fails *silently and partially*:

| Expired credential | What breaks | What still works (hiding it) |
|---|---|---|
| `ENTRA_CLIENT_SECRET` | Admin sign-in | The whole public site |
| Graph / email credentials | Lead autoresponder, "email me my config" | Forms still submit successfully |
| Quickbase token | Gallery, cases, any table still on Quickbase | Anything already moved to SQL |

None of these take the site down, so nothing alerts you — the first sign is usually a
customer saying they never got an email. **Put a recurring 6-monthly calendar reminder in
now**, a couple of weeks ahead of the date, and renew all of them together.

To renew the Entra one: app registration → Certificates & secrets → New client secret →
copy the **Value** → update `ENTRA_CLIENT_SECRET` in App Service → delete the old secret.

The admin panel fails closed: if any of the three `ENTRA_*` values is missing, every
`/api/admin/*` endpoint answers 401 and nothing is exposed.

## Rules of thumb

- **Publish only from a clean `production` checkout.** Zip Deploy ships whatever is on
  disk, including uncommitted edits — a clean checkout is what stops "works on my
  machine" reaching customers.
- **`wwwroot` is generated, never authored.** It's gitignored. Edit the frontend in
  `NVC Claude version/`; the build populates `wwwroot`.
- **Rolling back** = check out the previous `deploy-*` tag and publish from it.

## Local development

Unchanged, and it does not use `wwwroot`:

```bash
cd api-dotnet && dotnet run                 # API on :5178
cd "NVC Claude version" && npm run dev      # SPA on :5173, proxies /api to :5178
```

Work at <http://localhost:5173>. To exercise the *built* SPA against the local API
instead, run `npm run build` once and open <http://localhost:5178>.

To publish without rebuilding the frontend (rare — e.g. an API-only hotfix when the
frontend is known-good): `dotnet publish /p:SkipSpaBuild=true`.
