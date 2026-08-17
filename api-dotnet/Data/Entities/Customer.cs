using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// Someone who has actually bought. Distinct from Lead for the same reason Lead is distinct
// from Offer: a lead is a conversation that may go nowhere, a customer is a party to a
// completed transaction, and the two have different lifetimes and different truth
// conditions. A lost lead is deleted from nobody's memory; a customer is a financial record.
//
// This row holds WHO they are and nothing about what they paid. Everything transactional —
// the factory, the model, the deposit, the invoices — lives on Purchase, because a customer
// who buys a wagon in May and a modular house in July is one person with two transactions,
// and money columns on this table would force that into either one overwritten row or two
// customers sharing an ЕГН.
//
// CONTAINS PERSONAL IDENTIFIERS (ЕГН / ЕИК). Everything that reads this table is behind the
// AdminOnly policy, responses are no-store, and no identifier is ever put in a URL or a log
// line. Treat any new endpoint over it the same way.
public class Customer
{
    public int Id { get; set; }

    // See CustomerTypes: "person" (физическо лице) or "company" (юридическо лице). Decides
    // which of the two identifier columns below is the one that applies.
    [Required]
    [MaxLength(20)] public string Type { get; set; } = CustomerTypes.Person;

    // --- How they are legally identified ---------------------------------------------
    // TWO COLUMNS, not one nullable "identifier" with the meaning implied by Type. They
    // are different things: an ЕИК identifies a company in a public register and is
    // reasonable to search on; an ЕГН identifies a private individual and is the most
    // sensitive value in this database. Collapsing them would mean every query that
    // touches company numbers also touches personal ones.

    // Единен идентификационен код — companies only. Nine or thirteen digits.
    [MaxLength(20)] public string? Eik { get; set; }

    // ЕГН for a Bulgarian individual, or whatever identity document a foreign buyer is on
    // (passport, national id). ONE column for both, because the alternative is a third
    // column that is empty for nearly every row and a form asking employees to decide which
    // box a Greek passport belongs in. Country below is what says which kind it is.
    [MaxLength(40)] public string? PersonalId { get; set; }

    // --- Who --------------------------------------------------------------------------
    // For a company this is the registered name; for a person, their name. Not split into
    // first/last: Bulgarian invoices carry the full name as one string, and splitting it
    // only creates two boxes to get wrong.
    [Required]
    [MaxLength(200)] public string Name { get; set; } = "";

    [MaxLength(64)] public string? Phone { get; set; }
    [MaxLength(320)] public string? Email { get; set; }

    [MaxLength(400)] public string? Address { get; set; }

    // Also the signal for how to read PersonalId — a customer whose country is not Bulgaria
    // is not carrying an ЕГН, whatever the box is labelled.
    [MaxLength(100)] public string? Country { get; set; }

    public string? Notes { get; set; }

    // --- Where they came from ---------------------------------------------------------
    // The lead this customer grew out of, if there was one. Nullable and Restrict, for the
    // same reasons Lead.OfferId is: plenty of business arrives without ever being a lead in
    // the panel, and a customer must never lose their conversation history because someone
    // tidied up the pipeline.
    //
    // The payoff is that "what did we actually promise them?" stays answerable after the
    // sale, which is when it starts being asked.
    public int? LeadId { get; set; }
    public Lead? Lead { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    [MaxLength(320)] public string? UpdatedByUpn { get; set; }

    public List<Purchase> Purchases { get; set; } = new();
}
