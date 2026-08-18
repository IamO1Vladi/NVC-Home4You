using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// Who changed what, and when.
//
// The panel holds ЕГН, ЕИК, deposits and invoices, and until now it recorded only who
// touched a row LAST — Customer.UpdatedByUpn and its four siblings. That answers "who is
// responsible for the current state" and nothing else: the previous value is gone, the
// person who set it is gone, and a row that was correct last week and wrong today has no
// story attached to it. This table is that story.
//
// APPEND-ONLY BY CONSTRUCTION. Nothing in the application updates or deletes a row here —
// there is no service method that can, and the read endpoints are read-only. An audit log
// that the app can rewrite is a log that proves nothing.
//
// Written by AuditInterceptor from EF's change tracker rather than by each service calling
// a "record this" helper. That is the whole point: a helper is something the next feature
// forgets to call, and the failure is silent — you find out there is no record at exactly
// the moment you need one. Anything that reaches SaveChangesAsync is audited, including
// code written years from now by someone who has never read this comment.
public class AuditEntry
{
    public int Id { get; set; }

    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;

    // The Entra UPN, same free-text convention as Lead.OwnerUpn and House.LastModifiedBy —
    // there is no user table to point at.
    //
    // NULL MEANS THE SYSTEM DID IT, and that is a real and useful answer rather than a gap:
    // the importers, the inbound mail poller and the CLI commands all write without an HTTP
    // request behind them. Recording those as "nobody" would be a lie; recording them as
    // null and rendering them as "system" is the truth.
    [MaxLength(320)] public string? ActorUpn { get; set; }

    // The CLR type name — "Customer", "Purchase". Not a foreign key to anything: this table
    // outlives the rows it describes, and the most important entry about a record is often
    // the one that says it was deleted.
    [Required]
    [MaxLength(100)] public string EntityType { get; set; } = "";

    // Stringified primary key. A string rather than an int so a composite or non-integer key
    // needs no schema change here, and so a deleted row's id stays readable.
    [Required]
    [MaxLength(64)] public string EntityId { get; set; } = "";

    // See AuditActions.
    [Required]
    [MaxLength(20)] public string Action { get; set; } = "";

    // How a person recognises the row — a customer's name, a house's title. Denormalised on
    // purpose, and it is the only denormalised thing here: an audit entry for a row that has
    // since been deleted must still say WHICH one, and a join cannot answer that.
    [MaxLength(300)] public string? Summary { get; set; }

    // The field-level diff, as a JSON array of { field, from, to }.
    //
    // JSON rather than a child table because this is written on every save and read rarely,
    // by a handful of people, on a database with a few thousand rows a year. A child table
    // would double the write cost of every request in the panel to make a query nobody has
    // asked for yet cheaper.
    //
    // VALUES ARE REDACTED AND TRUNCATED BEFORE THEY GET HERE — see AuditRedaction. An ЕГН
    // must never appear in this column.
    public string ChangesJson { get; set; } = "[]";
}
