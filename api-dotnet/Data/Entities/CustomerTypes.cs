using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// Физическо лице or юридическо лице, as stable keys.
//
// This is not cosmetic and it is not a label: it decides which identifier the customer is
// legally addressed by on an invoice. A company has an ЕИК, a person has an ЕГН (or a
// foreign identity number). Getting it wrong produces a document that is wrong in the one
// way that matters to an accountant.
//
// String keys rather than an enum column, matching LeadStatuses and HouseCategories: they
// survive a migration, read correctly in a raw SQL query, and do not renumber themselves.
public static class CustomerTypes
{
    // Физическо лице.
    public const string Person = "person";

    // Юридическо лице.
    public const string Company = "company";

    public static readonly IReadOnlyList<string> All = new[] { Person, Company };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);
}
