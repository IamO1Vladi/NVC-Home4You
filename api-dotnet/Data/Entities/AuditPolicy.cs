using System;
using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

/// <summary>What happened to a row. Stable string keys, same reasoning as LeadStatuses.</summary>
public static class AuditActions
{
    public const string Created = "created";
    public const string Updated = "updated";
    public const string Deleted = "deleted";

    public static readonly IReadOnlyList<string> All = new[] { Created, Updated, Deleted };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);
}

/// <summary>
/// Which tables are worth a history, and which are deliberately not.
///
/// The list is an ALLOW-list rather than "everything except", because the cost of auditing
/// the wrong table is not a missing feature — it is a log so noisy that nobody reads it, and
/// a second copy of data that already had a home.
/// </summary>
public static class AuditedEntities
{
    private static readonly HashSet<string> Included = new(StringComparer.Ordinal)
    {
        // Money and identity — the reason this exists at all.
        nameof(Customer), nameof(Purchase), nameof(PurchaseFile),

        // "You edit live pricing", the concern that first raised an audit log.
        nameof(House), nameof(HouseImage),

        // The supplier directory a purchase points at.
        nameof(Factory),

        // What we tell the factory to build. Wrong here is wrong in steel.
        nameof(FactorySheet),

        // Published content and moderation decisions.
        nameof(Case), nameof(CaseImage), nameof(Review),

        // Status, owner and the fields sales edits. NOT the conversation — see below.
        nameof(Lead),

    };

    /// <summary>
    /// Deliberately NOT audited, with the reason, so nobody "fixes" the omission later:
    ///
    /// LeadActivity / LeadAttachment — already an append-only thread that records its own
    ///   actor on every row. Auditing it would store a second copy of every customer
    ///   conversation to learn nothing the thread does not already say.
    /// Offer / Question — immutable inbound submissions. Nothing edits them, so a history
    ///   would be one "created" row each, forever.
    /// OrderStatusEvent — is itself the history of a status move, append-only, and already
    ///   names the person who made it. Auditing it would keep two logs of one fact.
    /// SavedConfig — written by customers using the configurator, not by staff. High volume,
    ///   no human decision behind it.
    /// AuditEntry — auditing the audit log is a loop, and it is append-only anyway.
    /// </summary>
    public static bool IsAudited(string? entityType) =>
        entityType is not null && Included.Contains(entityType);
}

/// <summary>
/// What must never be written into an audit entry, and how much of anything else to keep.
///
/// THE POINT OF THIS CLASS: an audit log is a second copy of your data in a table with
/// different access patterns and a much longer life. Customer.cs calls ЕГН "the most
/// sensitive value in this database" and CustomerAdminService goes out of its way to keep it
/// out of search — so copying every old and new ЕГН into a log would quietly undo that work
/// and put the value somewhere it can never be corrected or removed.
///
/// So a redacted field still records THAT it changed, which is the audit question, and never
/// WHAT it changed to, which is the customer's business.
/// </summary>
public static class AuditRedaction
{
    /// <summary>Placeholders. Distinguishable, so a reader can see what kind of change it was.</summary>
    public const string RedactedSet = "(set)";
    public const string RedactedCleared = "(cleared)";
    public const string RedactedChanged = "(changed)";

    /// <summary>Values longer than this are cut. A Notes field can hold an essay.</summary>
    public const int MaxValueChars = 120;

    // Named exactly. The tuple form keeps it honest: redacting "Name" everywhere because one
    // table has a sensitive one would gut the log for the other nine.
    private static readonly HashSet<(string Entity, string Property)> Sensitive = new()
    {
        // ЕГН, or a foreign buyer's passport / national id number.
        (nameof(Customer), nameof(Customer.PersonalId)),
    };

    // A safety net for the field nobody remembered to add above. It will not catch a badly
    // named column, but it catches the obvious ones, and an audit log's failure mode should
    // lean towards recording too little rather than leaking.
    //
    // ЕИК is deliberately NOT here: Customer.cs says it "identifies a company in a public
    // register and is reasonable to search on", so redacting it would cost information for
    // no privacy gained.
    private static readonly string[] SuspiciousNames =
    {
        "personalid", "egn", "password", "secret", "token", "apikey", "connectionstring",
    };

    public static bool IsSensitive(string entityType, string propertyName)
    {
        if (Sensitive.Contains((entityType, propertyName))) return true;

        var lowered = propertyName.ToLowerInvariant();
        return SuspiciousNames.Any(s => lowered.Contains(s));
    }

    /// <summary>
    /// One value as it should appear in the log: redacted if sensitive, truncated if long,
    /// null left as null so "was empty" and "was 'null'" stay different things.
    /// </summary>
    public static string? Format(string entityType, string propertyName, object? value)
    {
        var text = value switch
        {
            null => null,
            string s => s,
            bool b => b ? "true" : "false",
            DateTimeOffset d => d.UtcDateTime.ToString("O"),
            DateTime d => d.ToString("O"),
            IFormattable f => f.ToString(null, System.Globalization.CultureInfo.InvariantCulture),
            _ => value.ToString(),
        };

        if (IsSensitive(entityType, propertyName))
            return string.IsNullOrEmpty(text) ? null : RedactedChanged;

        if (text is null) return null;
        return text.Length <= MaxValueChars ? text : text[..MaxValueChars] + "…";
    }

    /// <summary>
    /// The from/to pair for a sensitive field, said in terms of what a reader needs: it was
    /// filled in, it was emptied, or it was replaced.
    /// </summary>
    public static (string? From, string? To) Describe(object? before, object? after)
    {
        var had = before is string s0 ? !string.IsNullOrEmpty(s0) : before is not null;
        var has = after is string s1 ? !string.IsNullOrEmpty(s1) : after is not null;

        if (!had && has) return (null, RedactedSet);
        if (had && !has) return (RedactedChanged, RedactedCleared);
        return (RedactedChanged, RedactedChanged);
    }
}
