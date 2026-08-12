# Leads — the last thing on Quickbase

> **Largely done, 2026-08-11 — see [HANDOFF-2026-08-12.md](HANDOFF-2026-08-12.md).**
> Phase 1 (the silent-failure fix) shipped, Phase 0's schema dump exists as
> `dotnet run -- lead-schema`, and Phases 2–3 shipped together: the SQL tables are live with
> 252 rows imported, and `/admin/leads` is a working queue rather than the read-only view
> planned here. What remains from this file is the **cutover** — flipping
> `DATA_SOURCE_LEADS=sql` and moving the workflow — plus the Lead/LeadActivity design, which
> the handoff specifies.
>
> One correction to the text below: the checkbox field ids are **not** the same on both
> tables. Offers use 13/14, questions use 9/10.

Written 2026-08-06, after the admin panel got its navigation and the editors became dialogs.
`ROADMAP-next.md` has the wider picture and what else is left; this file is only about
offers and questions, because they turned out to need a different plan from everything
migrated so far.

`DEPLOY.md` has the release mechanics.

---

## The question that was open since the start is now answered

`ROADMAP-datalayer-admin.md` and then `ROADMAP-next.md` both carried the same unanswered
question: *does sales actually work leads inside Quickbase day to day?*

**Yes.** Confirmed 2026-08-06.

That changes what this job is. Gallery and cases were tables: move the rows, flip a flag,
the pages keep rendering. Leads are a **workflow**. Migrating the table without replacing
what sales does on top of it would take away the tool they use and give back a list.

## What the application actually knows

Checked rather than assumed, and this is the constraint the whole plan hangs off.

`FormService` writes **five fields** for an offer — name, email, phone, message, and a model
id when the lead came from the configurator — and **three** for a question: name, email,
message. That is the entire surface. It writes and never reads either table back. There is
no status, no owner, no notes, no follow-up date anywhere in this codebase.

So everything that constitutes the workflow — whatever statuses exist, who a lead belongs
to, where call notes go, which view someone opens each morning — lives in fields the
application has never touched and that cannot be discovered from the repository.

**The replacement cannot be specified from the code.** The eight fields we know about are
the intake form. The workflow is everything after it, and it has to be observed.

---

## Phase 1 — A silent failure that is live right now

Independent of the migration, worth doing first, and small.

`QuickbaseClient.CreateAsync` calls `EnsureSuccessStatusCode()`, so a genuinely failed HTTP
request throws and surfaces as a 500. That part is fine. The gap is the other path:

```csharp
var rid = await _svc.CreateOfferAsync(dto, ct);   // int?  — may be null
return Ok(new { recordId = rid });                // 200 either way
```

Quickbase's `/records` endpoint returns **200 with `lineErrors`** when it accepts the
request but rejects the record — field validation, a bad value, a field id that changed
underneath us. `EnsureSuccessStatusCode()` passes. `firstRecordId` comes back null.
`CreateOfferAsync` returns null. The controller returns `200 {recordId: null}`. The customer
sees "thank you" and the lead does not exist.

It gets worse on inspection: `QbCreateResult` models only `metadata.firstRecordId` and
`data`. There is **no `lineErrors` property**, so Quickbase's stated reason is thrown away
during deserialization. The failure is not merely unhandled, it is currently
undiscoverable — there is nothing in a log to find afterwards.

Both `OfferController` and `QuestionController` have this shape.

The fix, roughly:

- Add `lineErrors` to `QbCreateResult` so the reason survives.
- Treat a null record id as a failure rather than a success: log it at error with the
  payload and whatever Quickbase said.
- Decide what the customer sees. A lost lead is worse than an apology, so this should
  probably not keep returning 200.
- Keep the lead somewhere regardless — the autoresponder already has the address and the
  message, and a notification email to sales is better than nothing at all.

This is worth shipping on its own, before any of what follows.

## Phase 0 — Discovery, before any migration code

Two pieces of work, neither of them code.

**Dump the real schema of both tables.** Every field, not the eight we write. Field ids,
labels, types, and which are populated in practice versus which exist and are always empty.

**Watch someone in sales work a lead for half an hour.** What is needed out of it:

- What statuses exist, and who moves a lead between them
- Whether a lead is assigned to a person, and how that happens
- Where notes and call history go
- What they open first each morning — a report, a saved view, a filter?
- How a lead ends. Won, lost, gone quiet — is that recorded, and where?
- **Are there Quickbase-side automations, notifications, forms, or reports firing on these
  tables?** This is the one that bites. They are invisible from here and would simply stop
  at cutover, with nobody necessarily noticing which one stopped.

Until this exists, everything below is an estimate.

## Phase 2 — A read-only leads view in /admin

Reads Quickbase, changes no write path, ships safely on its own.

It gives sales somewhere to look that is not Quickbase, and — more useful to us — it puts
our field mapping on a screen where it can be checked against the real thing before
anything depends on it. If Phase 0 missed a field, this is where it shows up, at zero cost.

## Phase 3 — Model it in SQL

`Offer` and `Question` entities mirroring the **whole** table from Phase 0, not just the
intake fields, plus the migration and a history import so nothing is stranded and the admin
panel has something real to show.

## Phase 4 — Dual-write and soak

Write both, treat **Quickbase as authoritative**, log every difference.

Deliberately more cautious than the flag flip used for gallery and cases, for the reason in
Phase 1: a read path that breaks is visible on the page, and a lead write that fails is a
customer who saw "thank you" and vanished. Weeks, not days.

PR #8's autoresponder fires off the same request, so it gets re-verified here rather than
assumed.

## Phase 5 — Move the workflow, then cut over

Sales works leads in `/admin` while Quickbase is still authoritative and still being
written. Only when they have stopped opening Quickbase of their own accord does SQL become
the source of truth and the Quickbase write stop.

**The cutover is Phase 5, not Phase 4.** The table will be ready long before the workflow
is, and that gap is the whole risk in this job.

---

## Order of play

Phase 1 stands alone and should go first — it is live, it is small, and it is losing leads
today for all we know.

Phase 0 gates 3, 4 and 5. Phase 2 can start as soon as Phase 0 has the schema, and is worth
having in front of sales early.

**Saved configurator links** are independent of all of this and lower risk. Reasonable to do
in parallel, or while Phase 4 soaks. See `ROADMAP-next.md`.

**Order tracking** hangs off leads existing in SQL with a workflow attached, so it stays
parked until Phase 5. Its own open questions — who maintains a status, and what the customer
sees — are unchanged and still unanswered.

## Still open

- Everything in Phase 0.
- Whether leads should keep returning 200 when the write did not land (Phase 1).
- Whether sales wants to keep working leads in Quickbase indefinitely. If the honest answer
  is yes, then the goal changes from "retire Quickbase" to "stop the website depending on
  it", which is a smaller job: Phases 1 and 2, and stop there.
