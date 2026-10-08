using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>
/// Finds leads that look like the same customer twice.
///
/// The CRM import created 257 leads with no link to any website enquiry, and the panel had
/// already been promoting enquiries into leads of its own. A customer who both filled in
/// the form and was written down by hand now exists twice, and nothing in the schema
/// notices: the filtered unique indexes stop ONE enquiry becoming two leads, which is a
/// different problem.
///
/// REPORTS ONLY, and that is not timidity. Merging two leads means choosing which name,
/// which owner and which stage survive, and then moving a conversation under a different
/// row — decisions that need somebody who knows the customer. An automatic merge that gets
/// it wrong loses history silently, which is the one outcome worse than a duplicate.
/// </summary>
public class LeadDuplicateService
{
    private readonly AppDbContext _db;

    public LeadDuplicateService(AppDbContext db)
    {
        _db = db;
    }

    public record Candidate(
        int Id, string Name, string? Email, string? Phone, string Status,
        DateTimeOffset CreatedAt, int? QuickbaseRecordId, int? OfferId, int? QuestionId,
        int ActivityCount, string? OwnerUpn)
    {
        /// <summary>Where this lead came from, in the words someone deciding would use.</summary>
        public string Origin =>
            QuickbaseRecordId is { } qb ? $"imported (QB {qb})"
            : OfferId is { } offer ? $"from offer #{offer}"
            : QuestionId is { } question ? $"from question #{question}"
            : "created in the panel";
    }

    public record Cluster(string Signal, string Value, List<Candidate> Leads);

    public record Report(int Scanned, List<Cluster> Strong, List<Cluster> Weak)
    {
        public int DuplicateLeads => Strong.Sum(c => c.Leads.Count - 1);
    }

    public async Task<Report> FindAsync(CancellationToken ct = default)
    {
        var leads = await _db.Leads
            .AsNoTracking()
            .Select(l => new
            {
                l.Id, l.Name, l.Email, l.Phone, l.Status, l.CreatedAt,
                l.QuickbaseRecordId, l.OfferId, l.QuestionId, l.OwnerUpn,
                ActivityCount = l.Activities.Count,
            })
            .ToListAsync(ct);

        var candidates = leads.ToDictionary(
            l => l.Id,
            l => new Candidate(
                l.Id, l.Name, l.Email, l.Phone, l.Status, l.CreatedAt,
                l.QuickbaseRecordId, l.OfferId, l.QuestionId, l.ActivityCount, l.OwnerUpn));

        // Email and phone are the strong signals: two people do not share either by
        // accident. Grouped separately rather than merged into one cluster per person,
        // because WHICH signal matched is what tells a reader how much to trust it.
        var byEmail = GroupBy(leads.Select(l => (l.Id, Key: NormaliseEmail(l.Email))));
        var byPhone = GroupBy(leads.Select(l => (l.Id, Key: NormalisePhone(l.Phone))));

        var strong = byEmail.Select(g => new Cluster("email", g.Key, Resolve(g.Value, candidates)))
            .Concat(byPhone
                // A pair already reported on email is not news again on phone — the same
                // customer with both fields filled in matches twice, and reporting it
                // twice makes the list look worse than it is.
                .Where(g => !IsAlreadyCovered(g.Value, byEmail))
                .Select(g => new Cluster("phone", g.Key, Resolve(g.Value, candidates))))
            .OrderByDescending(c => c.Leads.Count)
            .ThenBy(c => c.Leads[0].Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        // A shared name is a hint, never a finding: "Иван Петров" is not rare. Reported
        // apart so nobody merges on it without looking, and only when neither strong
        // signal already caught the pair.
        var byName = GroupBy(leads.Select(l => (l.Id, Key: NormaliseName(l.Name))))
            .Where(g => !IsAlreadyCovered(g.Value, byEmail) && !IsAlreadyCovered(g.Value, byPhone))
            .Select(g => new Cluster("name", g.Key, Resolve(g.Value, candidates)))
            .OrderBy(c => c.Value, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new Report(leads.Count, strong, byName);
    }

    /// <summary>
    /// The open lead that already looks like this customer, or null — the single-customer
    /// question the representative intake asks before it creates a lead of its own (#38).
    /// </summary>
    /// <remarks>
    /// Same two strong signals as the report, same normalisers, and the same stance: this
    /// REPORTS. The caller still creates the representative's lead and writes a note naming
    /// this one, because the alternative — silently attaching a new enquiry to whichever
    /// older lead matched — is the automatic merge the class comment refuses.
    ///
    /// Open leads only (LeadStatuses.Open): a customer who was Lost last year and comes back
    /// through a representative is a new conversation, not a duplicate of a closed one.
    /// Most recently active first, so a customer with two old open rows is reported against
    /// the one somebody is actually working.
    ///
    /// Normalisation happens in memory: the phone rule strips to the last nine digits, which
    /// no SQL translation of this query could express. The open set is bounded (closed deals
    /// archive off the board), so reading it is cheap, and only the handful of columns that
    /// decide the match are pulled.
    /// </remarks>
    public async Task<OpenMatch?> FindOpenMatchAsync(string? email, string? phone, CancellationToken ct = default)
    {
        var wantedEmail = NormaliseEmail(email);
        var wantedPhone = NormalisePhone(phone);
        if (wantedEmail is null && wantedPhone is null) return null;

        var open = await _db.Leads
            .AsNoTracking()
            .Where(l => LeadStatuses.Open.Contains(l.Status) && (l.Email != null || l.Phone != null))
            .Select(l => new { l.Id, l.Email, l.Phone, l.OwnerUpn, l.CreatedAt, l.LastActivityAt })
            .ToListAsync(ct);

        var match = open
            .Where(l =>
                (wantedEmail is not null && NormaliseEmail(l.Email) == wantedEmail) ||
                (wantedPhone is not null && NormalisePhone(l.Phone) == wantedPhone))
            .OrderByDescending(l => l.LastActivityAt ?? l.CreatedAt)
            .ThenByDescending(l => l.Id)
            .FirstOrDefault();

        return match is null ? null : new OpenMatch(match.Id, match.OwnerUpn);
    }

    /// <summary>What the intake needs to name the older lead: which row, and whose it is.</summary>
    public sealed record OpenMatch(int Id, string? OwnerUpn);

    private static List<KeyValuePair<string, List<int>>> GroupBy(IEnumerable<(int Id, string? Key)> rows) =>
        rows.Where(r => r.Key is not null)
            .GroupBy(r => r.Key!, StringComparer.Ordinal)
            .Where(g => g.Count() > 1)
            .Select(g => new KeyValuePair<string, List<int>>(g.Key, g.Select(r => r.Id).OrderBy(x => x).ToList()))
            .ToList();

    // Whether every lead in this group is already together in some group of another kind.
    private static bool IsAlreadyCovered(List<int> ids, List<KeyValuePair<string, List<int>>> groups) =>
        groups.Any(g => ids.All(id => g.Value.Contains(id)));

    private static List<Candidate> Resolve(List<int> ids, Dictionary<int, Candidate> candidates) =>
        ids.Select(id => candidates[id])
            // Oldest first: whichever record has the longest history is usually the one to
            // keep, and it reads as the original with the copies under it.
            .OrderBy(c => c.CreatedAt)
            .ToList();

    private static string? NormaliseEmail(string? raw)
    {
        var value = raw?.Trim().ToLowerInvariant();
        return string.IsNullOrWhiteSpace(value) || !value.Contains('@') ? null : value;
    }

    /// <summary>
    /// The last nine digits, which is what makes +359 88 123 4567 and 0888 123 456 the
    /// same phone.
    /// </summary>
    /// <remarks>
    /// Bulgarian subscriber numbers are nine digits; the leading 0 and the +359 are two
    /// spellings of the same prefix, and the CRM has both. Comparing the raw strings would
    /// miss most real duplicates — which is the entire point of this report.
    ///
    /// Under eight digits is not a phone number, it is a fragment somebody typed, and
    /// matching on those would pair unrelated people.
    /// </remarks>
    private static string? NormalisePhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length < 8) return null;

        return digits.Length <= 9 ? digits : digits[^9..];
    }

    private static string? NormaliseName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var collapsed = string.Join(' ',
            raw.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

        // A one-word name is too thin to suggest anything by itself.
        return collapsed.Length < 4 || !collapsed.Contains(' ') ? null : collapsed.ToLowerInvariant();
    }
}
