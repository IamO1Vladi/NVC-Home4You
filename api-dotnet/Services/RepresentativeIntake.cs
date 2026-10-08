using System;
using System.Threading;
using System.Threading.Tasks;
using Data.Entities;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// What the intake did with an enquiry that came through a representative's link (#38).
///
/// LeadCreated is the only field a caller branches on. The rest is what the notification
/// says: which lead (new or already there), which open lead already looked like the same
/// customer and whose it is, and — when nothing was created — a short machine-readable
/// reason that goes into the mail verbatim, so "why is there no lead?" is answered by the
/// mail rather than by a log search.
/// </summary>
public sealed record IntakeOutcome(
    bool LeadCreated, int? LeadId, int? DuplicateOfLeadId, string? DuplicateOwnerUpn, string? SkippedBecause)
{
    public static IntakeOutcome Skipped(string reason) => new(false, null, null, null, reason);
}

/// <summary>
/// Turns a stored enquiry into the representative's lead the moment it arrives.
///
/// An interface, because the real thing needs the SQL lead layer and the public form
/// controllers must construct whether or not SQL is configured: NullRepresentativeIntake
/// stands in without a database. Both are "never throw" — the controller has already told
/// the customer "thank you" by the time this runs, and nothing here may change that.
/// </summary>
public interface IRepresentativeIntake
{
    Task<IntakeOutcome> TryPromoteAsync(
        string kind, long? recordId, EnvConfig.Representative rep, string? email, string? phone, CancellationToken ct);
}

/// <summary>
/// The real intake: the same promotion the panel's button performs, done by the app at
/// enquiry time with the representative as owner and "Представител: slug" as the source.
///
/// Why promote at all, rather than leave the enquiry in the queue with the rep's name on
/// it: the representative can only see LEADS he owns (the rep panel reads nothing else), so
/// an enquiry that stayed an enquiry would be invisible to the one person it was for.
///
/// Why REPORT a duplicate rather than act on it: the owner's call, and the same one
/// LeadDuplicateService makes. A customer who already has an open lead and then comes in
/// through a rep's link is an edge case, and the two leads need a person to decide which
/// survives. So the rep's lead is created regardless, and the duplicate is named in the
/// thread and in the mail where that person will see it.
/// </summary>
public sealed class RepresentativeIntake : IRepresentativeIntake
{
    private readonly EnvConfig _env;
    private readonly LeadService _leads;
    private readonly LeadDuplicateService _duplicates;
    private readonly ILogger<RepresentativeIntake> _logger;

    public RepresentativeIntake(
        EnvConfig env, LeadService leads, LeadDuplicateService duplicates, ILogger<RepresentativeIntake> logger)
    {
        _env = env;
        _leads = leads;
        _duplicates = duplicates;
        _logger = logger;
    }

    /// <summary>The Lead.Source stamp for a representative's lead. Free prose, never parsed.</summary>
    public static string SourceFor(EnvConfig.Representative rep) => $"Представител: {rep.Slug}";

    public async Task<IntakeOutcome> TryPromoteAsync(
        string kind, long? recordId, EnvConfig.Representative rep, string? email, string? phone, CancellationToken ct)
    {
        try
        {
            // The record id is only a SQL enquiry id when SQL is the authoritative lead
            // store. Under Quickbase (dual-write included) it is a Quickbase record id, and
            // promoting whatever SQL row happens to share the number would attach the rep
            // to a stranger's enquiry.
            if (_env.DataSourceFor("leads") != DataSource.Sql)
                return IntakeOutcome.Skipped("leads-not-sql");

            if (recordId is null or <= 0 or > int.MaxValue)
                return IntakeOutcome.Skipped("no-record-id");

            // The strict rule, the one for an address about to be stored against a person:
            // a lead is a relationship that gets written to, and one on "asdf" is a row
            // nobody can ever contact. The enquiry itself is still stored and still names
            // the rep, so nothing is lost — it simply waits for a person in Запитвания.
            if (!EmailService.IsValidAddress(email))
                return IntakeOutcome.Skipped("invalid-email");

            // Looked up BEFORE the promotion, or the new lead would match itself.
            var duplicate = await _duplicates.FindOpenMatchAsync(email, phone, ct);

            var result = await _leads.PromoteAsync(kind, (int)recordId.Value, rep.Upn, SourceFor(rep), ct);

            switch (result.Outcome)
            {
                case LeadService.PromotionOutcome.Created:
                {
                    var lead = result.Lead!;
                    if (duplicate is not null)
                    {
                        // App-written, like the owner and status lines (see
                        // LeadService.SetOwnerAsync): StatusChange type, no actor. Not a
                        // Note, which the panel offers as something a person files, and not
                        // "our move" either — a warning does not promise the customer anything.
                        await _leads.AddActivityAsync(
                            lead.Id, LeadActivityTypes.StatusChange, subject: null,
                            body: DuplicateNote(duplicate, rep.Slug), actorUpn: null, ct: ct);
                    }

                    return new IntakeOutcome(true, lead.Id, duplicate?.Id, duplicate?.OwnerUpn, null);
                }

                case LeadService.PromotionOutcome.AlreadyExisted:
                    // The unique index already guarantees one lead per enquiry; this is the
                    // same enquiry arriving twice (a retried POST), and the first lead stands
                    // with whoever owns it.
                    return new IntakeOutcome(false, result.Lead!.Id, null, null, "already-promoted");

                default:
                    return IntakeOutcome.Skipped("enquiry-not-found");
            }
        }
        catch (Exception ex)
        {
            // Everything, cancellation included: the customer has been thanked, the enquiry
            // is stored with the rep's name in it, and the worst outcome here is a lead that
            // somebody promotes by hand tomorrow. A thrown exception would turn that into a
            // 500 on a form that already succeeded.
            _logger.LogError(ex,
                "Representative intake failed for {Kind} {RecordId} via {Slug}; the enquiry is stored and can be promoted by hand.",
                kind, recordId, rep.Slug);
            return IntakeOutcome.Skipped("error");
        }
    }

    // Bulgarian, like every other app-written line in the thread.
    private static string DuplicateNote(LeadDuplicateService.OpenMatch duplicate, string slug) =>
        $"Възможен дубликат: лийд #{duplicate.Id} (отговорник: {duplicate.OwnerUpn ?? "никой"}). Създаден от линк на представител {slug}.";
}

/// <summary>
/// The intake without a database: nothing to promote into, so every enquiry is reported
/// as skipped and the controllers never have to ask whether SQL exists. The enquiry still
/// lands in Quickbase with the rep's line in its message.
/// </summary>
public sealed class NullRepresentativeIntake : IRepresentativeIntake
{
    public Task<IntakeOutcome> TryPromoteAsync(
        string kind, long? recordId, EnvConfig.Representative rep, string? email, string? phone, CancellationToken ct) =>
        Task.FromResult(IntakeOutcome.Skipped("sql-not-configured"));
}
