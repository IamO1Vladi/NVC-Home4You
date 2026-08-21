using System.Collections.Generic;
using System.Linq;

namespace Data.Entities;

// What kind of thing happened on a lead. Stable keys, same reasoning as LeadStatuses.
//
// Email is split by direction rather than carried as a bool, because the two are not
// symmetric: an outbound mail has an author on our side and a Graph conversation id we
// minted, an inbound one has neither and arrives from the customer. Reading "type" and
// having to check a second column to know which way it went is how threads get rendered
// backwards.
public static class LeadActivityTypes
{
    public const string EmailOut = "email_out";
    public const string EmailIn = "email_in";
    public const string Call = "call";
    public const string Meeting = "meeting";
    public const string Note = "note";

    // Written by the app, not by a person: "Maria moved this to Quoted". Kept in the same
    // thread as everything else so the history reads in one pass instead of forcing a
    // reader to interleave a separate audit log by hand.
    public const string StatusChange = "status";

    public static readonly IReadOnlyList<string> All = new[]
    {
        EmailOut, EmailIn, Call, Meeting, Note, StatusChange,
    };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);

    // The types a human may file by hand. StatusChange is excluded because the app writes
    // it as a side effect of an actual status change — letting someone post a bare "status"
    // row would put a claim in the history that the Status column doesn't back up.
    public static readonly IReadOnlyList<string> ManuallyLoggable = new[]
    {
        EmailOut, Call, Meeting, Note,
    };

    public static bool IsManuallyLoggable(string? key) => key is not null && ManuallyLoggable.Contains(key);

    // The types that mean WE did something, and therefore that we owe the customer a next
    // move — see LeadService.FollowUpAfterOurMove, which dates that move.
    //
    // EmailIn is out because a customer writing to us is not us promising anything, and
    // StatusChange is out because moving a lead to Quoted records where it stands rather
    // than an action anyone took towards the customer. Letting either in would push the
    // follow-up date forward every time mail arrived or a stage was corrected, which is
    // exactly how a due report stops meaning anything.
    //
    // Spelled out rather than reusing ManuallyLoggable, whose members happen to coincide
    // today. That list answers "what may a person POST to the activities endpoint"; this one
    // answers "does this entry put the ball back in our court", and the reply path writes an
    // EmailOut without going near that endpoint at all.
    public static readonly IReadOnlyList<string> OurMove = new[]
    {
        EmailOut, Call, Meeting, Note,
    };

    public static bool IsOurMove(string? key) => key is not null && OurMove.Contains(key);
}
