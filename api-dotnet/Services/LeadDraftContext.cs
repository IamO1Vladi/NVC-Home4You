using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>
/// Everything a drafted reply needs to know, and deliberately nothing else.
///
/// This is the part of the AI feature with all the decisions in it, so it is kept apart
/// from the API call: it is pure, it needs no key, and it is fully testable. The call
/// itself is a thin wrapper over this.
///
/// The whole design is one idea — SEND THE SLICE, NOT THE CATALOGUE. The generated
/// catalogue data is ~20k tokens across two files. Passing all of it would make every
/// draft ten times the input it needs, and would bury the one model the customer asked
/// about in a list of everything the company sells. That costs answer quality before it
/// costs money. The lead already says which slice: HouseId resolves to the exact
/// catalogue row, and the thread carries the rest.
/// </summary>
public record LeadDraftContext(
    string CustomerName,
    string? Locale,
    string Status,
    string? ModelSummary,
    string ThreadTranscript,
    IReadOnlyList<string> Notes)
{
    // Roughly four characters per token for the Latin/Cyrillic mix these threads carry.
    // Deliberately crude: it exists to catch a context that has grown an order of
    // magnitude beyond expectations, not to bill anyone.
    public int ApproximateTokens =>
        (CustomerName.Length + (ModelSummary?.Length ?? 0) + ThreadTranscript.Length
         + Notes.Sum(n => n.Length)) / 4;
}

public class LeadDraftContextBuilder
{
    private readonly AppDbContext _db;

    public LeadDraftContextBuilder(AppDbContext db)
    {
        _db = db;
    }

    // How much of the thread to carry. A long negotiation is mostly scheduling noise;
    // the recent exchanges are what a reply has to answer. Oldest-first within the
    // window so the conversation still reads forwards.
    public const int MaxThreadEntries = 30;

    // Per-message ceiling. One pasted configurator summary can be thousands of
    // characters, and three of them would crowd out the actual conversation.
    public const int MaxBodyChars = 2000;

    /// <summary>
    /// Assembles the context for one lead, or null if the lead does not exist.
    /// </summary>
    public async Task<LeadDraftContext?> BuildAsync(int leadId, CancellationToken ct = default)
    {
        var lead = await _db.Leads
            .AsNoTracking()
            .Include(l => l.House)
            .FirstOrDefaultAsync(l => l.Id == leadId, ct);

        if (lead is null) return null;

        // Newest-first in SQL so the window is the RECENT end of a long thread, then
        // reversed for rendering. Taking the first N instead would hand a drafter the
        // opening of a conversation whose last six months it never sees.
        var recent = await _db.LeadActivities
            .AsNoTracking()
            .Where(a => a.LeadId == leadId)
            .OrderByDescending(a => a.OccurredAt)
            .Take(MaxThreadEntries)
            .ToListAsync(ct);

        recent.Reverse();

        return new LeadDraftContext(
            CustomerName: lead.Name,
            Locale: lead.Locale,
            Status: lead.Status,
            ModelSummary: DescribeModel(lead),
            ThreadTranscript: RenderThread(recent),
            Notes: BuildNotes(lead));
    }

    /// <summary>
    /// The catalogue slice: the linked house, the free-text model, or both.
    ///
    /// Prices come from the House row rather than from anything the model might recall,
    /// because a drafted reply that invents a price is worse than one that omits it —
    /// the customer holds us to what we wrote.
    /// </summary>
    private static string? DescribeModel(Lead lead)
    {
        var parts = new List<string>();

        if (lead.House is { } house)
        {
            var line = new StringBuilder(house.Title);
            if (house.Price is { } price)
            {
                // Invariant culture on purpose: this is a figure for the model to read
                // and echo, not a localised string for a customer's screen. Rendering it
                // under the server's culture would turn 26500.00 into "26 500,00" on one
                // machine and "26,500.00" on another, for the same lead.
                line.Append(CultureInfo.InvariantCulture,
                    $" — {price.ToString("0.##", CultureInfo.InvariantCulture)} {house.Currency}");
            }
            parts.Add(line.ToString());
        }

        // Not an else. "The Nova 60, but 2m longer" is a real enquiry, and dropping the
        // second half because the first resolved would lose the thing that makes it
        // interesting.
        if (!string.IsNullOrWhiteSpace(lead.CustomModel))
            parts.Add(lead.CustomModel!.Trim());

        return parts.Count == 0 ? null : string.Join("; ", parts);
    }

    /// <summary>
    /// The thread as plain text, oldest first.
    ///
    /// Attributed by role rather than by name: what a drafter needs is which side said
    /// it, and staff names in the transcript invite a reply that addresses a colleague.
    /// Status changes are included because "they went quiet after we quoted" is exactly
    /// the context that changes what a good reply says.
    /// </summary>
    private static string RenderThread(IReadOnlyList<LeadActivity> activities)
    {
        var sb = new StringBuilder();

        foreach (var a in activities)
        {
            var who = a.ActorUpn is null ? "Customer" : "Us";
            var when = a.OccurredAt.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            var label = a.Type switch
            {
                LeadActivityTypes.EmailIn => $"{when} {who} (email)",
                LeadActivityTypes.EmailOut => $"{when} {who} (email)",
                LeadActivityTypes.Call => $"{when} {who} (call)",
                LeadActivityTypes.Meeting => $"{when} {who} (meeting)",
                LeadActivityTypes.StatusChange => $"{when} [status]",
                _ => $"{when} {who} (note)",
            };

            sb.Append(label);
            if (!string.IsNullOrWhiteSpace(a.Subject)) sb.Append(" — ").Append(a.Subject);
            sb.AppendLine(":");
            sb.AppendLine(Clamp(a.Body));
            sb.AppendLine();
        }

        return sb.ToString().TrimEnd();
    }

    /// <summary>
    /// Standing facts about the lead that are not in the thread — where it is going,
    /// what it is called, what sales said happens next.
    /// </summary>
    private static List<string> BuildNotes(Lead lead)
    {
        var notes = new List<string>();

        void Add(string label, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value)) notes.Add($"{label}: {value!.Trim()}");
        }

        Add("Project", lead.ProjectName);
        Add("Country", lead.Country);
        Add("Build location", lead.BuildLocation);
        Add("Next step", lead.NextStep);
        Add("Notes", lead.Notes);

        return notes;
    }

    // Clamps mid-message rather than at the end, because the opening and the closing of
    // a long message are both load-bearing — a configurator paste leads with the model
    // and ends with the customer's actual question, and tail-truncation drops the
    // question.
    private static string Clamp(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return "(no content)";

        var text = body.Trim();
        if (text.Length <= MaxBodyChars) return text;

        var half = MaxBodyChars / 2;
        return string.Concat(
            text.AsSpan(0, half).ToString(),
            "\n… [trimmed] …\n",
            text.AsSpan(text.Length - half).ToString());
    }
}
