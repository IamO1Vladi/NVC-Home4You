using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Services;

// The staff-facing side of the leads migration: the work queue that replaces what sales
// does inside Quickbase today.
//
// SQL-only by design, like ReviewModerationService — this exists precisely so Quickbase
// can stop being the staff interface, so there is no Quickbase implementation to fall
// back to. While Quickbase is still authoritative for writes, a tick made here does NOT
// appear there; the team has to work from one place or the other.
//
// Offers and questions are separate tables but one queue, because "who has not been
// contacted?" is the same question for both and sales should not have to ask it twice.
public class LeadAdminService
{
    private readonly AppDbContext _db;

    public LeadAdminService(AppDbContext db)
    {
        _db = db;
    }

    public const string KindOffer = "offer";
    public const string KindQuestion = "question";

    // How many rows a single report will return. High enough that the queue is never
    // silently truncated in practice, capped so a runaway table cannot take the page down.
    private const int MaxRows = 1000;

    /// <summary>
    /// The queue. <paramref name="reachedOut"/> narrows to outstanding or handled (null is
    /// both), and <paramref name="archived"/> switches between the working queue and the
    /// things that have been put away.
    /// </summary>
    /// <remarks>
    /// Archived rows are excluded from EVERY other view, not just from the outstanding tab.
    /// A queue that still lists what someone deliberately put away is a queue people stop
    /// trusting, and "All" was the view where that would have shown up first.
    /// </remarks>
    public async Task<List<AdminLeadDto>> ListAsync(bool? reachedOut, CancellationToken ct, bool archived = false)
    {
        var offerQuery = _db.Offers.AsNoTracking().AsQueryable();
        var questionQuery = _db.Questions.AsNoTracking().AsQueryable();

        if (archived)
        {
            offerQuery = offerQuery.Where(o => o.ArchivedAt != null);
            questionQuery = questionQuery.Where(q => q.ArchivedAt != null);
        }
        else
        {
            offerQuery = offerQuery.Where(o => o.ArchivedAt == null);
            questionQuery = questionQuery.Where(q => q.ArchivedAt == null);
        }

        if (reachedOut.HasValue)
        {
            offerQuery = offerQuery.Where(o => o.ReachedOut == reachedOut.Value);
            questionQuery = questionQuery.Where(q => q.ReachedOut == reachedOut.Value);
        }

        // Two round trips rather than a UNION: the tables have different shapes, and
        // projecting each to the shared DTO in memory is clearer than teaching EF to
        // combine them.
        var offers = await offerQuery
            .OrderByDescending(o => o.CreatedAt)
            .Take(MaxRows)
            .ToListAsync(ct);

        var questions = await questionQuery
            .OrderByDescending(q => q.CreatedAt)
            .Take(MaxRows)
            .ToListAsync(ct);

        // Which of these already became deals. Two small lookups rather than a join per
        // row: the page renders a different control depending on the answer, and asking
        // per enquiry would be a query per card.
        var offerIds = offers.Select(o => o.Id).ToList();
        var questionIds = questions.Select(q => q.Id).ToList();

        var dealByOffer = await _db.Leads.AsNoTracking()
            .Where(l => l.OfferId != null && offerIds.Contains(l.OfferId.Value))
            .Select(l => new { OfferId = l.OfferId!.Value, l.Id })
            .ToDictionaryAsync(x => x.OfferId, x => x.Id, ct);

        var dealByQuestion = await _db.Leads.AsNoTracking()
            .Where(l => l.QuestionId != null && questionIds.Contains(l.QuestionId.Value))
            .Select(l => new { QuestionId = l.QuestionId!.Value, l.Id })
            .ToDictionaryAsync(x => x.QuestionId, x => x.Id, ct);

        var combined = offers.Select(o => new AdminLeadDto
        {
            Kind = KindOffer,
            Id = o.Id,
            QuickbaseRecordId = o.QuickbaseRecordId,
            Name = o.Name ?? "",
            Email = o.Email ?? "",
            Phone = o.Phone ?? "",
            Message = o.Message ?? "",
            ModelId = o.ModelId ?? "",
            Locale = o.Locale ?? "",
            ReachedOut = o.ReachedOut,
            LeadCreated = o.LeadCreated,
            ArchivedAt = o.ArchivedAt is null ? null : Iso(o.ArchivedAt.Value),
            DealId = dealByOffer.TryGetValue(o.Id, out var offerDeal) ? offerDeal : null,
            CreatedAt = Iso(o.CreatedAt),
            UpdatedAt = o.UpdatedAt is null ? null : Iso(o.UpdatedAt.Value),
        }).Concat(questions.Select(q => new AdminLeadDto
        {
            Kind = KindQuestion,
            Id = q.Id,
            QuickbaseRecordId = q.QuickbaseRecordId,
            Name = q.Name ?? "",
            Email = q.Email ?? "",
            Phone = "",              // questions collect no phone number
            Message = q.Message ?? "",
            ModelId = "",            // nor a model
            Locale = q.Locale ?? "",
            ReachedOut = q.ReachedOut,
            LeadCreated = q.LeadCreated,
            ArchivedAt = q.ArchivedAt is null ? null : Iso(q.ArchivedAt.Value),
            DealId = dealByQuestion.TryGetValue(q.Id, out var questionDeal) ? questionDeal : null,
            CreatedAt = Iso(q.CreatedAt),
            UpdatedAt = q.UpdatedAt is null ? null : Iso(q.UpdatedAt.Value),
        }));

        // Outstanding work is sorted oldest first: an untouched lead from three weeks ago
        // is the one at risk, and newest-first would bury it under today's arrivals.
        // Everything else — including the archive — reads as a history, so it is newest
        // first.
        var ordered = !archived && reachedOut == false
            ? combined.OrderBy(l => l.CreatedAt)
            : combined.OrderByDescending(l => l.CreatedAt);

        return ordered.Take(MaxRows).ToList();
    }

    // Every count except Archived is a count of the WORKING queue. The badge in the panel's
    // navigation reads NotReachedOut, and an archived enquiry that still added to it would
    // send someone looking for work that is not there.
    public async Task<LeadCountsDto> CountsAsync(CancellationToken ct) => new()
    {
        NotReachedOut =
            await _db.Offers.AsNoTracking().CountAsync(o => !o.ReachedOut && o.ArchivedAt == null, ct) +
            await _db.Questions.AsNoTracking().CountAsync(q => !q.ReachedOut && q.ArchivedAt == null, ct),
        ReachedOut =
            await _db.Offers.AsNoTracking().CountAsync(o => o.ReachedOut && o.ArchivedAt == null, ct) +
            await _db.Questions.AsNoTracking().CountAsync(q => q.ReachedOut && q.ArchivedAt == null, ct),
        Archived =
            await _db.Offers.AsNoTracking().CountAsync(o => o.ArchivedAt != null, ct) +
            await _db.Questions.AsNoTracking().CountAsync(q => q.ArchivedAt != null, ct),
        Offers = await _db.Offers.AsNoTracking().CountAsync(o => o.ArchivedAt == null, ct),
        Questions = await _db.Questions.AsNoTracking().CountAsync(q => q.ArchivedAt == null, ct),
    };

    // Null leaves a flag alone, so the caller can tick one box without having to restate
    // the other and risk clobbering a change someone else just made.
    //
    // False means "no such lead", which the controller turns into a 404 rather than
    // reporting success for an id that never existed.
    public async Task<bool> SetFlagsAsync(string kind, int id, bool? reachedOut, bool? leadCreated, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;

        if (string.Equals(kind, KindOffer, StringComparison.OrdinalIgnoreCase))
        {
            var offer = await _db.Offers.FirstOrDefaultAsync(o => o.Id == id, ct);
            if (offer is null) return false;
            if (reachedOut.HasValue) offer.ReachedOut = reachedOut.Value;
            if (leadCreated.HasValue) offer.LeadCreated = leadCreated.Value;
            offer.UpdatedAt = now;
        }
        else if (string.Equals(kind, KindQuestion, StringComparison.OrdinalIgnoreCase))
        {
            var question = await _db.Questions.FirstOrDefaultAsync(q => q.Id == id, ct);
            if (question is null) return false;
            if (reachedOut.HasValue) question.ReachedOut = reachedOut.Value;
            if (leadCreated.HasValue) question.LeadCreated = leadCreated.Value;
            question.UpdatedAt = now;
        }
        else
        {
            return false;
        }

        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Puts an enquiry away, or brings it back.
    ///
    /// Deliberately NOT automatic on "create a lead". The two are different claims: a lead
    /// says the conversation moved somewhere else, archiving says a person looked at this
    /// row and decided it is finished with. Doing it on their behalf would empty the
    /// handled list underneath someone who was still working through it.
    ///
    /// False means "no such enquiry", the same as SetFlagsAsync.
    /// </summary>
    public async Task<bool> SetArchivedAsync(string kind, int id, bool archived, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        // Re-archiving must not move the timestamp: it is the record of when this was put
        // away, and a second click should be a no-op rather than a rewrite of history.
        DateTimeOffset? stamp = archived ? now : null;

        if (string.Equals(kind, KindOffer, StringComparison.OrdinalIgnoreCase))
        {
            var offer = await _db.Offers.FirstOrDefaultAsync(o => o.Id == id, ct);
            if (offer is null) return false;
            if (archived && offer.ArchivedAt is not null) return true;
            offer.ArchivedAt = stamp;
            offer.UpdatedAt = now;
        }
        else if (string.Equals(kind, KindQuestion, StringComparison.OrdinalIgnoreCase))
        {
            var question = await _db.Questions.FirstOrDefaultAsync(q => q.Id == id, ct);
            if (question is null) return false;
            if (archived && question.ArchivedAt is not null) return true;
            question.ArchivedAt = stamp;
            question.UpdatedAt = now;
        }
        else
        {
            return false;
        }

        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static string Iso(DateTimeOffset value) =>
        value.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
}
