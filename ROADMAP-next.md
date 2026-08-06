# Next phase — what is left on Quickbase, and the admin panel

Written 2026-08-06, at the end of the session that moved gallery, cases and all images off
Quickbase. Start here tomorrow; `DEPLOY.md` has the release mechanics and
`ROADMAP-datalayer-admin.md` has the history of how the data layer got here.

## Where today ended

Live and verified on production:

| Area | Store |
|---|---|
| Reviews | Azure SQL |
| Gallery (houses + images) | Azure SQL, `DATA_SOURCE_GALLERY=sql` |
| Cases | Azure SQL, `DATA_SOURCE_CASES=sql` |
| All images | Azure Blob, WebP, served from `/api/img/*`, `IMAGES_VIA_APP=true` |
| **Leads** (offers, questions) | **Quickbase** |
| **Saved configurator links** | **Quickbase** |

Tagged `deploy-2026-08-06`. Roughly 92 MB saved converting images to WebP.

**Quickbase cannot be switched off yet** — the two rows above are still live on it, and both
are revenue paths.

---

## 1. Leads: offers and questions

> **Superseded 2026-08-06 by [ROADMAP-leads.md](ROADMAP-leads.md).** The open question at the
> bottom of this section has been answered — sales *does* work leads inside Quickbase daily —
> so this is a workflow to replace, not a table to move, and the plan changed accordingly.
> That file also records a silent lead-loss path that is live today and is worth fixing
> before any migration work starts. Read it instead of this section; the text below is kept
> for what was believed beforehand.

The last thing standing between here and retiring Quickbase, and the highest-risk item in the
whole migration. `QB_TABLE_OFFER` and `QB_TABLE_QUESTION`, written by `FormService`.

**Why it is different from everything migrated so far.** Gallery and cases are *read* paths:
if a read broke, the page looked wrong and someone noticed. A lead write that fails is a
customer who filled in a form, saw "thank you", and vanished. Nobody notices — there is no
missing thing to see.

It also has a dependency the earlier tables did not: PR #8's autoresponder fires off the
write. If the write path changes, the email path has to be re-verified with it.

Suggested shape, deliberately more cautious than the pattern used so far:

- `Offer` and `Question` entities + migration, mirroring the Quickbase fields exactly.
- Import the history so the admin panel has something to show and nothing is stranded.
- **Dual-write for a soak period** rather than a flag flip: write SQL *and* Quickbase, treat
  Quickbase as authoritative, and compare. This is the one table where a straight cutover is
  not worth the risk, because the failure is invisible.
- Only once the diff log is clean for a couple of weeks, make SQL authoritative and stop
  writing to Quickbase.
- A **read-only leads view** in the admin panel comes first and is useful immediately — it
  gives sales somewhere to look that is not Quickbase, without touching the write path.

Open question worth settling before starting: **does sales actually work leads inside
Quickbase day to day?** If they do, migrating leads means replacing a workflow, not just a
table, and the admin panel needs to cover it before the cutover. If they do not, this is much
simpler. `ROADMAP-datalayer-admin.md` has been carrying this question unanswered since the
start.

*Answered 2026-08-06: they do. See [ROADMAP-leads.md](ROADMAP-leads.md).*

## 2. Saved configurator links

`QB_TABLE_SAVED_CONFIGS`, behind `/c/{code}` short links, cached 12h.

Smaller than leads but with a sharp edge: **those codes are already in customers' inboxes**,
sent by the PR #8 autoresponder. Any migration has to keep every existing code resolving —
forever, realistically. A saved config is immutable once written, so:

- Import every existing row, preserving the code exactly.
- Keep the Quickbase lookup as a fallback during transition, the same way images did.
- Never re-mint or re-number codes.

Note this is configured only in App Service — `QB_TABLE_SAVED_CONFIGS` is not in local
user-secrets, so the feature is inert on a dev machine and its endpoints answer 503. Worth
setting locally before working on it, or the first thing you will debug is its absence.

## 3. Factory sheet into the admin panel

Currently at `/internal/factory-sheet`, and it is not really a page so much as a local
document: **everything lives in `localStorage`**, gated by a shared password in
`sessionStorage`.

That means today the data exists in exactly one browser. Clear the site data, use a different
machine, or a colleague opens it — and it is empty. It has no server storage at all.

Moving it into `/admin` therefore buys three things at once:

- **Real persistence** (SQL), so a sheet survives the browser and is visible to whoever needs
  it.
- **Real auth** — Entra sign-in instead of a shared password, and an actual record of who
  changed what, which for a factory order is worth having.
- One place for staff to work rather than a hidden URL people have to be told about.

Mostly a port rather than a redesign: the form and its calculations already exist and work.
The work is a `FactorySheet` entity, CRUD behind `AdminOnly`, and a list view. Check whether
anyone has unsaved sheets in their browser before removing the localStorage version.

## 4. The "website files" table

**Checked: there is no such table.** Nothing in the code references a Quickbase table for
files, documents, brochures or PDFs — the eight tables the app knows about are houses,
images, cases, case images, reviews, offers, questions and saved configs. Nothing was missed
in the migration.

The site's downloadable files — the brochure PDFs, floor plans, static photography — live in
`NVC Claude version/public/` and **are tracked in git**. Vite copies them into `wwwroot` at
build time.

So there is nothing to migrate. There is, however, probably a real want behind the question:
**changing a brochure currently requires a developer and a deploy.** If that is the itch, the
work is an admin "Documents" section backed by Blob — upload a PDF, it gets a stable URL, the
page links to it, no redeploy. That is a genuinely useful feature and shares everything with
the image pipeline already built (`/api/img` becomes `/api/file`, same key scheme, same
upload path). Worth confirming that is what was meant before building it.

## 5. Order tracking (later)

Sketched only, explicitly not for tomorrow. Roughly: an order gets a reference and a status
timeline, the customer follows it from a link, staff move it along from the admin panel.

Two things to settle before any of it is designed:

- **Where does an order come from?** Today a lead is an offer in Quickbase and everything
  after that happens off-system. An order tracker is only truthful if someone maintains it,
  so the question is less "what does the page look like" and more "who updates the status,
  and as part of what routine".
- **What does the customer see?** A public status link is a support-load reducer, but a stale
  one is worse than none.

It depends on leads being migrated first, since an order almost certainly hangs off one.

---

## Carried over — not blocking, worth not forgetting

- **The admin panel's authenticated path has still never been exercised end to end.** It has
  only ever been tested logged out, where it correctly fails closed at 401. Sign in, create a
  house, upload an image, edit a case. If anything is wrong, it is there.
- **`dbadmin` is still the app's SQL login** — the server administrator. Should become a
  contained user with read/write on the app's tables only.
- **Secret expiry ~2027-02-04.** Entra client secret, Graph email credentials, Quickbase
  token. Each fails silently and partially; see `DEPLOY.md`.
- **Managed identity for Blob.** The app authenticates to storage with an account key in
  App Settings. A managed identity removes the stored secret and its expiry entirely.
- **Image optimisation is done for stored images, not for delivery.** Everything is WebP and
  capped at 2560px, but there is no per-breakpoint `srcset` for the migrated images —
  a phone downloads the desktop-sized file. `cdnImage`/`cdnSrcSet` already exist and are
  inert until `VITE_CLOUDINARY_CLOUD` is set; now that images come from our own origin, it
  may be simpler to resize at upload into a couple of widths instead.
