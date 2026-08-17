using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// A factory we have bought from — a house, a wagon, or the materials that went into one.
//
// A short table by design. This is a supplier directory, not a procurement system: the
// point is that "which factory built this?" has one spelling per factory instead of five
// spellings across five customer rows, so the question can actually be asked later.
//
// The link to a customer runs THROUGH Purchase, never directly. A factory is a property of
// the thing that was bought, not of the person who bought it — the same customer can take
// a wagon from one factory and a modular house from another, and putting FactoryId on the
// customer would force a choice between those two facts.
public class Factory
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)] public string Name { get; set; } = "";

    // Where they are. Country is the one people actually filter on ("do we have a Turkish
    // supplier for this?"), so it is its own column rather than part of the address blob.
    [MaxLength(100)] public string? Country { get; set; }
    [MaxLength(100)] public string? City { get; set; }
    [MaxLength(400)] public string? Address { get; set; }

    // Who we ring. One contact, not a contacts table: a supplier we deal with through two
    // people is rare enough that the second name goes in Notes, and a child table here
    // would be three more screens for something nobody asked for.
    [MaxLength(200)] public string? ContactName { get; set; }
    [MaxLength(64)] public string? ContactPhone { get; set; }
    [MaxLength(320)] public string? ContactEmail { get; set; }
    [MaxLength(400)] public string? Website { get; set; }

    // NVARCHAR(MAX): it accretes — lead times, who to chase, what went wrong last time —
    // and it is never indexed or filtered on.
    public string? Notes { get; set; }

    // A factory we have stopped using drops out of the dropdown on new purchases but keeps
    // every purchase that already names it. Deleting it instead would either orphan that
    // history or be refused (see the Restrict FK on Purchase), and "we don't buy from them
    // any more" is a different statement from "they never existed".
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    // Entra UPN, same free-text convention as House.LastModifiedBy and Lead.OwnerUpn:
    // there is no user table to point at.
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }

    public List<Purchase> Purchases { get; set; } = new();
}
