using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// A sales relationship, and the thing the whole leads migration was for.
//
// A lead is NOT a bigger Offer, and the difference is why this is a separate table rather
// than more columns on that one. An offer is an immutable event: someone submitted a form
// at a point in time, and rewriting it later would be falsifying the record. A lead is a
// relationship — it has an owner, a status that moves, a next step, and a history. The two
// have different lifetimes and different truth conditions, so they get different tables.
//
// One offer produces at most one lead (enforced by a filtered unique index in AppDbContext),
// but a lead can exist with no offer at all — see below.
public class Lead
{
    public int Id { get; set; }

    // --- Where it came from ---------------------------------------------------------
    // BOTH NULLABLE, deliberately. The obvious modelling here is "a lead is always born
    // from a website enquiry", and it is wrong: the ones that arrive by phone, at a trade
    // fair, or through a builder we already work with have no form submission behind them,
    // and those are frequently the biggest. Requiring an origin would mean inventing a fake
    // offer to hold a real customer, which corrupts the offers table to protect a
    // constraint that shouldn't exist.
    //
    // At most one of the two is set; a lead is not born from an offer AND a question.
    public int? OfferId { get; set; }
    public Offer? Offer { get; set; }

    public int? QuestionId { get; set; }
    public Question? Question { get; set; }

    // --- Who ------------------------------------------------------------------------
    // Copied from the originating enquiry rather than read through the FK, because the
    // customer may correct their own phone number over the course of the conversation and
    // the offer must keep saying what the form actually said.
    [MaxLength(200)] public string Name { get; set; } = "";
    [MaxLength(320)] public string? Email { get; set; }
    [MaxLength(64)] public string? Phone { get; set; }

    [MaxLength(100)] public string? Country { get; set; }

    // Where the customer is, and where the house goes. Different fields because they are
    // routinely different places — the buyer lives in Sofia, the plot is in the mountains —
    // and delivery, permitting and site access all hang off the second one.
    [MaxLength(400)] public string? CustomerAddress { get; set; }
    [MaxLength(400)] public string? BuildLocation { get; set; }

    [MaxLength(200)] public string? ProjectName { get; set; }

    // --- What they want -------------------------------------------------------------
    // TWO FIELDS, deliberately. A catalogue model is a real foreign key, so the lead
    // follows the house when its title or price is edited, and "how many leads for the
    // Nova 60?" is a join rather than a string match. But a good share of enquiries are for
    // "a modular house, roughly 80m², two bedrooms" — no catalogue row exists, and forcing
    // one would mean creating junk houses to satisfy a foreign key.
    //
    // Quickbase held both in one "Related Houses/Wagon" field, and the result was exactly
    // the mess you would expect: model names, half-sentences and record ids in one column,
    // unjoinable and unfilterable. Not repeating that is worth a second column.
    //
    // Both may be set: "the Nova 60, but 2m longer" is a real enquiry.
    public int? HouseId { get; set; }
    public House? House { get; set; }

    [MaxLength(400)] public string? CustomModel { get; set; }

    // --- Where it stands ------------------------------------------------------------
    // See LeadStatuses. Not an enum column: the string keys survive a migration, read
    // correctly in a raw SQL query, and don't renumber themselves when someone inserts a
    // stage in the middle.
    [Required]
    [MaxLength(20)] public string Status { get; set; } = LeadStatuses.New;

    // The Entra account that owns this lead, stored as a UPN.
    //
    // Free text rather than a foreign key, matching House.LastModifiedBy: there is no user
    // table to point at, and the sign-in path already identifies people by UPN (the
    // AdminOnly policy matches ADMIN_ALLOWED_USERS on preferred_username). Storing the oid
    // instead would be more stable across email changes but would need a lookup to render
    // a name anywhere, for a team of three.
    //
    // Nullable: an unassigned lead is a real and important state — it is the one nobody has
    // picked up yet.
    [MaxLength(320)] public string? OwnerUpn { get; set; }

    // The single most useful field on the whole table: what happens next, in a person's
    // own words. Everything else describes the past.
    [MaxLength(1000)] public string? NextStep { get; set; }

    // WHEN that next step is due. NextStep says what to do; this says when, and it is the
    // difference between a note nobody reads again and a lead that comes back to find you.
    //
    // A DATE, stored at midnight UTC. Follow-ups are agreed in days ("I'll call you
    // Tuesday"), never in minutes, and a time component would make "is this due?" depend
    // on which hour of Tuesday it is — so a lead due today is overdue from the start of
    // that day, which is what makes a morning report useful.
    //
    // Nullable, and most leads have it null: a date on every lead would be a date nobody
    // trusts. The overdue report is only as good as the restraint people show filling
    // this in.
    public DateTimeOffset? NextContactAt { get; set; }

    // Standing context about the customer, distinct from the thread — "prefers to be called
    // after 6", "brother-in-law is the actual decision maker". NVARCHAR(MAX): it accretes,
    // and it is never indexed or filtered on.
    public string? Notes { get; set; }

    // The language the customer wrote in, carried from the originating enquiry. Drives
    // which language we answer in, and later which language a drafted reply comes back in.
    [MaxLength(10)] public string? Locale { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    // Denormalised from the thread, because the pipeline view sorts on "quietest first" and
    // computing it per row would mean a correlated subquery over every activity on every
    // page load. Maintained by LeadService alongside the activity insert.
    public DateTimeOffset? LastActivityAt { get; set; }

    // When the deal reached Won or Lost. Null while it is still in play, and cleared again
    // if someone reopens it.
    //
    // A column rather than a computed thing, because "closed three days ago" is the whole
    // basis of the archive rule and deriving it from the thread would mean scanning
    // activities for the last status change on every board query. Distinct from UpdatedAt,
    // which moves whenever anyone edits a note — a closed deal must not un-archive itself
    // because somebody fixed a typo.
    public DateTimeOffset? ClosedAt { get; set; }

    public List<LeadActivity> Activities { get; set; } = new();
}
