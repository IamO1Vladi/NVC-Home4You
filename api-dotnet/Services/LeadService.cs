using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

// Creating and advancing leads — the relationship layer on top of the offers and questions
// that arrive from the site.
//
// SQL-only, like LeadAdminService: this replaces what sales did by hand inside Quickbase,
// so there is no Quickbase implementation to fall back to and no ILeadStore-style split.
//
// Every write that changes what a reader would understand about the lead also writes a
// LeadActivity. That is the whole design: the thread is not a log bolted on beside the
// data, it IS the record, and anything that moves the lead without leaving a trace makes
// the history lie by omission.
public class LeadService
{
    private readonly AppDbContext _db;

    public LeadService(AppDbContext db)
    {
        _db = db;
    }

    // Why a promotion did or didn't produce a new lead. The caller needs to tell "created"
    // apart from "already existed" — the second is a normal double-click, not an error, but
    // reporting it as a fresh creation would have the UI announce a lead it didn't make.
    public enum PromotionOutcome { Created, AlreadyExisted, NotFound }

    public record PromotionResult(PromotionOutcome Outcome, Lead? Lead)
    {
        public bool Ok => Outcome != PromotionOutcome.NotFound;
    }

    /// <summary>
    /// Turns an enquiry into a lead, carrying across what the form collected and opening the
    /// thread with the customer's original words.
    ///
    /// Idempotent: promoting the same enquiry twice returns the existing lead rather than
    /// making a second one. The unique index is the real guarantee — this check just means
    /// the common case doesn't have to surface as a constraint violation.
    /// </summary>
    public async Task<PromotionResult> PromoteAsync(string kind, int id, string? actorUpn, CancellationToken ct = default)
    {
        if (string.Equals(kind, LeadAdminService.KindOffer, StringComparison.OrdinalIgnoreCase))
            return await PromoteOfferAsync(id, actorUpn, ct);

        if (string.Equals(kind, LeadAdminService.KindQuestion, StringComparison.OrdinalIgnoreCase))
            return await PromoteQuestionAsync(id, actorUpn, ct);

        return new PromotionResult(PromotionOutcome.NotFound, null);
    }

    private async Task<PromotionResult> PromoteOfferAsync(int offerId, string? actorUpn, CancellationToken ct)
    {
        var existing = await _db.Leads
            .Include(l => l.Activities)
            .FirstOrDefaultAsync(l => l.OfferId == offerId, ct);
        if (existing is not null)
            return new PromotionResult(PromotionOutcome.AlreadyExisted, existing);

        var offer = await _db.Offers.FirstOrDefaultAsync(o => o.Id == offerId, ct);
        if (offer is null) return new PromotionResult(PromotionOutcome.NotFound, null);

        var lead = new Lead
        {
            OfferId = offer.Id,
            Name = offer.Name ?? "",
            Email = offer.Email,
            Phone = offer.Phone,
            Locale = offer.Locale,
            HouseId = await ResolveHouseIdAsync(offer.ModelId, ct),
            Status = LeadStatuses.New,
            OwnerUpn = actorUpn,
            // Born at the moment the customer asked, not the moment someone got round to
            // promoting it. Otherwise every lead looks brand new on the day sales opened it
            // and "how long did we sit on this?" becomes unanswerable.
            CreatedAt = offer.CreatedAt,
        };

        return await FinishPromotionAsync(lead, offer.Message, offer.CreatedAt, ct, () =>
        {
            offer.LeadCreated = true;
            offer.UpdatedAt = DateTimeOffset.UtcNow;
        });
    }

    private async Task<PromotionResult> PromoteQuestionAsync(int questionId, string? actorUpn, CancellationToken ct)
    {
        var existing = await _db.Leads
            .Include(l => l.Activities)
            .FirstOrDefaultAsync(l => l.QuestionId == questionId, ct);
        if (existing is not null)
            return new PromotionResult(PromotionOutcome.AlreadyExisted, existing);

        var question = await _db.Questions.FirstOrDefaultAsync(q => q.Id == questionId, ct);
        if (question is null) return new PromotionResult(PromotionOutcome.NotFound, null);

        // No phone and no model: the question form collects neither, and inventing empty
        // strings for them would make the lead claim the customer left them blank.
        var lead = new Lead
        {
            QuestionId = question.Id,
            Name = question.Name ?? "",
            Email = question.Email,
            Locale = question.Locale,
            Status = LeadStatuses.New,
            OwnerUpn = actorUpn,
            CreatedAt = question.CreatedAt,
        };

        return await FinishPromotionAsync(lead, question.Message, question.CreatedAt, ct, () =>
        {
            question.LeadCreated = true;
            question.UpdatedAt = DateTimeOffset.UtcNow;
        });
    }

    private async Task<PromotionResult> FinishPromotionAsync(
        Lead lead, string? enquiryText, DateTimeOffset enquiredAt, CancellationToken ct, Action markSourceHandled)
    {
        _db.Leads.Add(lead);

        // The customer's original message opens the thread, attributed to them (null actor)
        // and timestamped when they sent it. Without this the history starts at whatever we
        // said first, which reads as though we cold-called someone who actually approached
        // us — and it is the message a drafted reply most needs to have read.
        if (!string.IsNullOrWhiteSpace(enquiryText))
        {
            lead.Activities.Add(new LeadActivity
            {
                Type = LeadActivityTypes.EmailIn,
                Body = enquiryText!,
                ActorUpn = null,
                OccurredAt = enquiredAt,
            });
            lead.LastActivityAt = enquiredAt;
        }

        // Makes the hand-maintained Quickbase checkbox automatic, which is what it always
        // meant: "this enquiry has become a lead". Offer.cs flagged this as the follow-up.
        markSourceHandled();

        await _db.SaveChangesAsync(ct);
        return new PromotionResult(PromotionOutcome.Created, lead);
    }

    /// <summary>
    /// A lead with no website origin — the phone call, the trade fair, the builder who
    /// already knows us. Both origin ids stay null; see Lead.OfferId.
    /// </summary>
    public async Task<Lead> CreateAsync(Lead lead, CancellationToken ct = default)
    {
        if (!LeadStatuses.IsValid(lead.Status)) lead.Status = LeadStatuses.New;
        lead.CreatedAt = lead.CreatedAt == default ? DateTimeOffset.UtcNow : lead.CreatedAt;

        _db.Leads.Add(lead);
        await _db.SaveChangesAsync(ct);
        return lead;
    }

    /// <summary>
    /// Appends to the thread. Returns null if the lead does not exist, rather than writing
    /// an orphan the foreign key would reject anyway.
    /// </summary>
    public async Task<LeadActivity?> AddActivityAsync(
        int leadId,
        string type,
        string? subject,
        string body,
        string? actorUpn,
        DateTimeOffset? occurredAt = null,
        string? conversationId = null,
        CancellationToken ct = default)
    {
        var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == leadId, ct);
        if (lead is null) return null;
        if (!LeadActivityTypes.IsValid(type)) return null;

        var when = occurredAt ?? DateTimeOffset.UtcNow;

        var activity = new LeadActivity
        {
            LeadId = leadId,
            Type = type,
            Subject = subject,
            Body = body ?? "",
            ActorUpn = actorUpn,
            ConversationId = conversationId,
            OccurredAt = when,
        };

        _db.LeadActivities.Add(activity);

        // Only ever moves forward. A call logged late — OccurredAt in the past — must not
        // drag the lead back up the "quietest first" list and make it look neglected when
        // it isn't.
        if (lead.LastActivityAt is null || when > lead.LastActivityAt) lead.LastActivityAt = when;
        lead.UpdatedAt = DateTimeOffset.UtcNow;

        // Doing something schedules the next thing. Silent on purpose — nobody is asked, and
        // a date already set for the future is left alone; see FollowUpAfterOurMove.
        //
        // Dated from now rather than from `when`, for the same reason LastActivityAt is: a
        // call typed in this morning and dated to last week is still a promise made today,
        // and taking three days from the backdated moment would file it as already overdue.
        if (LeadActivityTypes.IsOurMove(type))
            lead.NextContactAt = FollowUpAfterOurMove(lead.NextContactAt, DateTimeOffset.UtcNow);

        await _db.SaveChangesAsync(ct);
        return activity;
    }

    /// <summary>
    /// Moves the lead along the ladder and records the move in the thread.
    ///
    /// False means either "no such lead" or "not a real status" — both are the caller
    /// sending something wrong, and neither should report success.
    /// </summary>
    public async Task<bool> SetStatusAsync(int leadId, string status, string? actorUpn, CancellationToken ct = default)
    {
        if (!LeadStatuses.IsValid(status)) return false;

        var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == leadId, ct);
        if (lead is null) return false;

        // Re-saving the status it already has is a no-op, not an event. Otherwise a page
        // that posts the whole form on every save fills the thread with "moved to Quoted"
        // from Quoted.
        if (string.Equals(lead.Status, status, StringComparison.Ordinal)) return true;

        var from = lead.Status;
        lead.Status = status;
        lead.UpdatedAt = DateTimeOffset.UtcNow;

        // Stamped on the way into a terminal stage, cleared on the way back out. The
        // archive countdown starts here rather than at UpdatedAt, so editing a note on a
        // closed deal cannot quietly pull it back onto the board.
        if (!LeadStatuses.IsOpen(status)) lead.ClosedAt ??= DateTimeOffset.UtcNow;
        else lead.ClosedAt = null;

        var now = DateTimeOffset.UtcNow;
        _db.LeadActivities.Add(new LeadActivity
        {
            LeadId = leadId,
            Type = LeadActivityTypes.StatusChange,
            // Both ends, because "moved to Quoted" alone loses the shape of the pipeline —
            // whether that was progress or a lead falling back a stage.
            Body = $"{from} → {status}",
            ActorUpn = actorUpn,
            OccurredAt = now,
        });

        if (lead.LastActivityAt is null || now > lead.LastActivityAt) lead.LastActivityAt = now;

        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Assigns or unassigns the lead, and records the handover in the thread.
    ///
    /// Null clears it. An unassigned lead is a real state — the one nobody has picked up —
    /// so "unassign" has to be expressible rather than implied by an empty string.
    /// </summary>
    public async Task<bool> SetOwnerAsync(int leadId, string? ownerUpn, string? actorUpn, CancellationToken ct = default)
    {
        var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == leadId, ct);
        if (lead is null) return false;

        var next = string.IsNullOrWhiteSpace(ownerUpn) ? null : ownerUpn.Trim();
        if (string.Equals(lead.OwnerUpn, next, StringComparison.OrdinalIgnoreCase)) return true;

        var from = lead.OwnerUpn;
        lead.OwnerUpn = next;
        lead.UpdatedAt = DateTimeOffset.UtcNow;

        // Written to the thread because "who was supposed to be handling this?" is a
        // question that gets asked about leads that went cold, and the Owner column only
        // ever holds the current answer.
        var now = DateTimeOffset.UtcNow;
        _db.LeadActivities.Add(new LeadActivity
        {
            LeadId = leadId,
            Type = LeadActivityTypes.StatusChange,
            Body = $"owner: {from ?? "unassigned"} → {next ?? "unassigned"}",
            ActorUpn = actorUpn,
            OccurredAt = now,
        });

        if (lead.LastActivityAt is null || now > lead.LastActivityAt) lead.LastActivityAt = now;

        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// The fields sales maintains by hand. Null leaves a field alone, so one box can be
    /// edited without restating the rest and clobbering a colleague's change.
    ///
    /// Deliberately NOT written to the thread: these are working notes that get corrected
    /// constantly, and an activity per keystroke-save would drown the actual conversation.
    /// The customer's own details go the same way, and that is a judgement rather than an
    /// oversight — a corrected typo is not a fact about the relationship, and status and
    /// owner, which are, still each write their line.
    /// </summary>
    public async Task<bool> UpdateFieldsAsync(
        int leadId,
        string? nextStep,
        string? notes,
        string? projectName,
        string? buildLocation,
        string? customerAddress,
        string? country,
        string? nextContactAt = null,
        string? categoryKey = null,
        int? houseId = null,
        bool clearHouse = false,
        string? customModel = null,
        string? name = null,
        string? email = null,
        string? phone = null,
        CancellationToken ct = default)
    {
        var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == leadId, ct);
        if (lead is null) return false;

        // WHO the lead is, correctable here because a name or an address typed wrong at
        // enquiry time otherwise stays wrong forever — the offer behind it is an immutable
        // event and must keep saying what the form said, so the lead is the only row where
        // the correction can land.
        //
        // Name is the odd one out: the column is NOT NULL and every list on the board is a
        // row of names, so a blank one is a lead nobody can find again. The caller is
        // expected to have refused it already (see AdminPipelineController.SetFields);
        // reaching here with one leaves the stored name alone, which is the least
        // destructive reading of an edit that cannot be carried out.
        if (!string.IsNullOrWhiteSpace(name)) lead.Name = name.Trim();

        // Both legitimately empty — a walk-in who left a phone number and no email address is
        // a real lead, and so is the reverse — so these clear like every other field here
        // rather than being defended.
        if (email is not null) lead.Email = Trimmed(email);
        if (phone is not null) lead.Phone = Trimmed(phone);

        if (categoryKey is not null) lead.CategoryKey = Trimmed(categoryKey);
        if (customModel is not null) lead.CustomModel = Trimmed(customModel);

        // "No model chosen" has to be expressible, and null already means "leave alone" on
        // every other field here — so clearing takes its own flag rather than overloading
        // one of the two meanings onto the same argument.
        if (clearHouse) lead.HouseId = null;
        else if (houseId is not null) lead.HouseId = houseId;

        if (nextStep is not null) lead.NextStep = Trimmed(nextStep);
        if (notes is not null) lead.Notes = Trimmed(notes);
        if (projectName is not null) lead.ProjectName = Trimmed(projectName);
        if (buildLocation is not null) lead.BuildLocation = Trimmed(buildLocation);
        if (customerAddress is not null) lead.CustomerAddress = Trimmed(customerAddress);
        if (country is not null) lead.Country = Trimmed(country);

        // Same rule as every field above — null leaves it alone, blank clears it. The
        // caller is expected to have refused an unparseable date already (see
        // TryParseFollowUpDate); reaching here with one clears the date rather than
        // storing a wrong one, because a follow-up on the wrong day is worse than none.
        if (nextContactAt is not null)
        {
            TryParseFollowUpDate(nextContactAt, out var parsed);
            lead.NextContactAt = parsed;
        }

        lead.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Whether a house id points at a real catalogue row.
    ///
    /// Checked before the save rather than relying on the foreign key, because a violated
    /// FK surfaces as a 500 with nothing an editor can act on — and the realistic cause is
    /// a model deleted from the gallery while somebody had the lead open.
    /// </summary>
    public Task<bool> HouseExistsAsync(int houseId, CancellationToken ct = default) =>
        _db.Houses.AsNoTracking().AnyAsync(h => h.Id == houseId, ct);

    /// <summary>
    /// The email address currently stored on a lead, so a save can tell an EDIT of that box
    /// from a resend of what was already in it.
    ///
    /// This column has never been validated on the way in and holds whatever its source had.
    /// CrmLeadImportService takes it straight off the Quickbase field with nothing but a
    /// truncation, across the whole imported book, and the public forms carry no format
    /// attribute either — so "ivan@abv.bg, maria@abv.bg", "Ivan Petrov &lt;ivan@abv.bg&gt;",
    /// "n/a" and a bare phone number are all things really sitting in it.
    ///
    /// The panel resends every field on every save, the untouched ones included. Without
    /// this comparison, one of those addresses would refuse every future edit to the lead
    /// that holds it — the notes, the next step, the follow-up date — over a box nobody
    /// opened, with a message naming no field. A bad address must block an attempt to CHANGE
    /// it, not the rest of the row.
    ///
    /// Null for a lead that does not exist, which is the same answer as a lead with no
    /// address; the caller's own save reports the missing row as a 404 straight after.
    /// </summary>
    public Task<string?> StoredEmailAsync(int leadId, CancellationToken ct = default) =>
        _db.Leads.AsNoTracking()
            .Where(l => l.Id == leadId)
            .Select(l => l.Email)
            .FirstOrDefaultAsync(ct);

    /// <summary>
    /// Reads a follow-up date off the wire. Blank is a real answer — it means "no date" —
    /// so only genuinely unreadable input is a failure.
    /// </summary>
    /// <remarks>
    /// AssumeUniversal, so "2026-08-20" from a date input becomes midnight UTC rather than
    /// midnight in whatever timezone the server happens to run in. Without it the same
    /// lead is due on different days depending on where it was saved, and a report that
    /// disagrees with itself is a report nobody uses twice.
    /// </remarks>
    public static bool TryParseFollowUpDate(string? raw, out DateTimeOffset? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(raw)) return true;

        if (!DateTimeOffset.TryParse(
                raw, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal
                | System.Globalization.DateTimeStyles.AdjustToUniversal,
                out var parsed))
        {
            return false;
        }

        // Truncated to the day it was agreed for. A follow-up is a day, never a minute,
        // and keeping a stray time makes "due today" start at an arbitrary hour.
        value = new DateTimeOffset(parsed.UtcDateTime.Date, TimeSpan.Zero);
        return true;
    }

    /// <summary>
    /// How far out logging something pushes the follow-up date. THE OWNER'S CHOICE, given
    /// when this rule was agreed: long enough that a customer has had a working day or two
    /// to answer, short enough that nothing sits for a week unnoticed. It is a decision
    /// about how this company sells, not a computed interval, which is why it is written
    /// down here as a named one rather than left as a 3 in the middle of a method.
    /// </summary>
    public const int AutoFollowUpDays = 3;

    /// <summary>
    /// The follow-up date after we have done something on a lead: three days out when there
    /// is no date or the one there has already come round, and untouched when it is set to a
    /// future day.
    ///
    /// That last half is the rule that matters. A lead deliberately dated for next month —
    /// the customer who said "call me after the holidays" — must not be dragged to Thursday
    /// because somebody added a note to it, and a system that did that would teach people to
    /// stop dating leads at all.
    ///
    /// A date of TODAY counts as arrived, not as future. ListDueAsync reads a follow-up as
    /// due from the start of its day, so a lead dated today is one we owe a move now — and
    /// logging the call we just made is precisely that move.
    /// </summary>
    /// <remarks>
    /// Midnight UTC, exactly as TryParseFollowUpDate stores what a person types. A follow-up
    /// is a day and never a minute; a stray time here would make "due today" begin at
    /// whatever hour the note happened to be saved, and the report would disagree with
    /// itself depending on where the server runs.
    /// </remarks>
    public static DateTimeOffset? FollowUpAfterOurMove(DateTimeOffset? current, DateTimeOffset now)
    {
        var today = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);

        if (current is not null && current.Value > today) return current;

        return today.AddDays(AutoFollowUpDays);
    }

    // An emptied box means "clear this", which is null in the database — storing "" would
    // make a cleared field and a never-filled one look different in every query.
    private static string? Trimmed(string value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// One lead with its thread, oldest first — the detail view.
    /// </summary>
    public async Task<Lead?> GetAsync(int id, CancellationToken ct = default) =>
        await _db.Leads
            .AsNoTracking()
            .Include(l => l.Activities.OrderBy(a => a.OccurredAt))
            .Include(l => l.House)
            .FirstOrDefaultAsync(l => l.Id == id, ct);

    /// <summary>
    /// Maps the model id an enquiry carried back to a catalogue row.
    ///
    /// This is the inverse of what the gallery serves, and it has to be exactly the inverse
    /// or leads attach to the wrong house. SqlGalleryService sends `QuickbaseRecordId ?? Id`
    /// as a house's public id, so a house that has a Quickbase id is only ever addressed by
    /// THAT, never by its SQL id. Matching on Id first — the obvious implementation — would
    /// therefore hand back whichever imported house happens to have that SQL primary key,
    /// which is a different building.
    ///
    /// Hence: try QuickbaseRecordId, then fall back to Id only among rows that have no
    /// Quickbase id, because those are precisely the ones the gallery addresses by Id.
    ///
    /// Null when it doesn't resolve, and nothing is invented in CustomModel: a bare number
    /// is not a model name, and the customer's own description is already in the thread.
    /// </summary>
    private async Task<int?> ResolveHouseIdAsync(string? modelId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(modelId)) return null;
        if (!long.TryParse(modelId.Trim(), out var n)) return null;

        var byQuickbase = await _db.Houses
            .AsNoTracking()
            .Where(h => h.QuickbaseRecordId == n)
            .Select(h => (int?)h.Id)
            .FirstOrDefaultAsync(ct);
        if (byQuickbase is not null) return byQuickbase;

        // House.Id is an int and QuickbaseRecordId is a long, so a model id larger than an
        // int cannot be a SQL primary key. Checking rather than casting: an unchecked cast
        // wraps, and a wrapped value would match a real, unrelated house.
        if (n < int.MinValue || n > int.MaxValue) return null;
        var sqlId = (int)n;

        return await _db.Houses
            .AsNoTracking()
            .Where(h => h.QuickbaseRecordId == null && h.Id == sqlId)
            .Select(h => (int?)h.Id)
            .FirstOrDefaultAsync(ct);
    }
}
