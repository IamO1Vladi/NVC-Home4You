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
`improvements.txt`.

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
