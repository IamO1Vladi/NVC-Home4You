using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One thing that happened on a lead: an email either way, a call, a meeting, a note, or a
// status move. Together they are the thread — what the admin panel renders, and what a
// drafted reply will later read to know what has already been said.
//
// Append-only in spirit. Nothing here is edited after the fact: a note that turned out to
// be wrong gets a correcting note, because a history that can be quietly rewritten is not
// a history. Nothing enforces that at the database level; it is a rule about how the
// service writes, not a constraint.
public class LeadActivity
{
    public int Id { get; set; }

    public int LeadId { get; set; }
    public Lead? Lead { get; set; }

    // See LeadActivityTypes.
    [Required]
    [MaxLength(20)] public string Type { get; set; } = LeadActivityTypes.Note;

    // Present on emails, usually absent on everything else.
    [MaxLength(400)] public string? Subject { get; set; }

    // NVARCHAR(MAX): an email body with quoted history behind it has no useful ceiling,
    // and this is never indexed or filtered on.
    public string Body { get; set; } = "";

    // Who did it, as an Entra UPN — same convention as Lead.OwnerUpn.
    //
    // NULL MEANS THE CUSTOMER. That is the one piece of encoding here worth knowing: an
    // inbound email has no staff actor, and using the customer's address in this column
    // instead would make "which of our people touched this lead" a query that has to know
    // every customer address to exclude.
    [MaxLength(320)] public string? ActorUpn { get; set; }

    // Graph's conversationId, stored when we send so a reply can be matched back to this
    // lead when inbound mail arrives (phase 2).
    //
    // Recorded now, while sending is being built, because it is free to store on the way
    // out and impossible to reconstruct afterwards — a thread sent before this column
    // existed can never be matched to its replies. The inbound poller does not exist yet;
    // this is the hook it will use.
    [MaxLength(400)] public string? ConversationId { get; set; }

    // The Graph message id, on anything that came from or went to a mailbox.
    //
    // This is the poller's dedupe key, and without it the feature is broken in a way that
    // only shows up after a restart: the poller has no memory of its own, so on every
    // start it would re-import the same replies and the thread would fill with duplicates.
    // A timestamp watermark is not enough — mail arrives out of order and a redeploy mid-
    // poll would straddle it. The unique index is what actually enforces this, so two
    // poll cycles racing each other cannot both insert the same message.
    [MaxLength(400)] public string? ExternalMessageId { get; set; }

    // When it actually happened, which is not when it was typed in: a call logged the next
    // morning belongs at the time of the call, or the thread tells the wrong story.
    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;

    // When the row was written. Kept alongside OccurredAt precisely because they differ,
    // and "when did we learn this" is an audit question the other column cannot answer.
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Files that came with this message. See LeadAttachment for why they hang off the
    // activity rather than the lead.
    public List<LeadAttachment> Attachments { get; set; } = new();
}
