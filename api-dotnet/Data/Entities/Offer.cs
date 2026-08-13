using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// SQL counterpart of the Quickbase offers table — the "request a quote" modal.
//
// Field names mirror OfferDto so the mapping stays obvious, and lengths are explicit
// rather than NVARCHAR(MAX) so the columns can be indexed, matching the Review pattern.
//
// Unlike gallery or cases, this table is written by the public site on every enquiry, so
// nothing here is required beyond what the form actually collects: a lead that arrives
// with a missing phone number is still a lead and must not be rejected by a constraint.
public class Offer
{
    public int Id { get; set; }

    // Quickbase record id this row was imported from, or the id Quickbase assigned during
    // dual-write. Null for rows created natively in SQL after cutover. Kept for the whole
    // dual-run period so the import is idempotent and the two stores can be compared.
    public int? QuickbaseRecordId { get; set; }

    [MaxLength(200)] public string Name { get; set; } = "";
    [MaxLength(320)] public string? Email { get; set; }   // 320 = max practical email length
    [MaxLength(64)] public string? Phone { get; set; }

    // The free-text "project" field from the modal. Configurator enquiries paste a whole
    // configuration summary in here, so it needs real room.
    [MaxLength(4000)] public string? Message { get; set; }

    // Set when the enquiry came from the Box house configurator rather than a plain form.
    [MaxLength(100)] public string? ModelId { get; set; }

    // Which language the customer was browsing in. Not written to Quickbase today, but the
    // autoresponder already varies by it and sales will want it in the admin list.
    [MaxLength(10)] public string? Locale { get; set; }

    // --- Sales workflow ------------------------------------------------------------
    // Quickbase checkboxes, mirrored so the workflow survives the migration rather than
    // being replaced by a list. Both are maintained by hand today; making LeadCreated
    // automatic is the follow-up, not this change.
    public bool ReachedOut { get; set; }      // Quickbase fid 13 — "reached out to?"
    public bool LeadCreated { get; set; }     // Quickbase fid 14 — "Lead created"

    // When someone put this enquiry away. An enquiry is finished once we have contacted
    // the person and the conversation has moved into a lead — after that it is history,
    // and leaving it in the queue means the queue stops meaning "work to do".
    //
    // A TIMESTAMP rather than a bool, and nothing ever deletes an enquiry: this is the
    // only record that a person asked us something on a particular day, and the usual
    // reason to reach for delete (a test submission, a duplicate) is exactly the case
    // where being able to put it back matters.
    public DateTimeOffset? ArchivedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Mirrors Quickbase's "Date Modified", so a re-import can pull only what changed.
    public DateTimeOffset? UpdatedAt { get; set; }
}
