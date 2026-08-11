using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// SQL counterpart of the Quickbase questions table — the "ask a question" modal.
//
// Deliberately a separate table rather than an Offer with a type discriminator, because
// that is how Quickbase models it: two tables, two field id sets, and a sales workflow
// that treats a quote request and a question differently. Merging them here would make
// the import and the dual-write comparison harder to reason about for no gain.
public class Question
{
    public int Id { get; set; }

    // See Offer.QuickbaseRecordId — same purpose, same dual-run lifetime.
    public int? QuickbaseRecordId { get; set; }

    [MaxLength(200)] public string Name { get; set; } = "";
    [MaxLength(320)] public string? Email { get; set; }

    // The question itself. Shorter than an offer's project field in practice, but there is
    // no reason to be stingier than the form allows.
    [MaxLength(4000)] public string? Message { get; set; }

    [MaxLength(10)] public string? Locale { get; set; }

    // --- Sales workflow ------------------------------------------------------------
    // The same two Quickbase checkboxes as Offer; see that file.
    public bool ReachedOut { get; set; }      // Quickbase fid 13 — "reached out to?"
    public bool LeadCreated { get; set; }     // Quickbase fid 14 — "Lead created"

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? UpdatedAt { get; set; }
}
