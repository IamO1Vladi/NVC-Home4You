using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
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
/// configurator data is ~20k tokens across two files. Passing all of it would make every
/// draft ten times the input it needs, and would bury the one model the customer asked
/// about in a list of everything the company sells. That costs answer quality before it
/// costs money. The lead already says which slice: HouseId resolves to the exact
/// catalogue row, and the thread carries the rest.
///
/// What the slice now includes, and why it grew: the model the lead is about in FULL
/// (its description as well as its price), plus a PRICE LIST of the rest of the range —
/// one line per house, no descriptions. Customers ask "what else do you have around
/// 20 000?" constantly, and a drafter that can only see one house has to answer every
/// such question with "a colleague will confirm". A title-and-price line is a few dozen
/// characters, so the whole range costs less than one pasted configurator summary.
/// </summary>
public record LeadDraftContext(
    string CustomerName,
    string? Locale,
    string Status,
    string? ModelSummary,
    string ThreadTranscript,
    IReadOnlyList<string> Notes,
    string? ModelDetail = null,
    string? PriceList = null)
{
    // Roughly four characters per token for the Latin/Cyrillic mix these threads carry.
    // Deliberately crude: it exists to catch a context that has grown an order of
    // magnitude beyond expectations, not to bill anyone.
    public int ApproximateTokens =>
        (CustomerName.Length + (ModelSummary?.Length ?? 0) + (ModelDetail?.Length ?? 0)
         + (PriceList?.Length ?? 0) + ThreadTranscript.Length + Notes.Sum(n => n.Length)) / 4;
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

    // How much of the linked model's description travels. Enough to answer "what is
    // included?", short of pasting a brochure page into every draft.
    public const int MaxDescriptionChars = 900;

    // The price list is one line per house, so the ceiling is about the size of the
    // catalogue rather than about tokens: a range this size is dozens of models, and a
    // number an order of magnitude above that means something has gone wrong upstream —
    // a bad import, a duplicated table — and the right answer is to send a partial list
    // rather than a prompt nobody budgeted for.
    public const int MaxPriceListRows = 150;

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
            Notes: BuildNotes(lead),
            ModelDetail: DescribeModelDetail(lead),
            PriceList: await BuildPriceListAsync(lead, ct));
    }

    /// <summary>
    /// The rest of the range as one line per model: name, price, category.
    ///
    /// PUBLISHED ROWS ONLY, and that is not a detail. An unpublished house is one the
    /// company has decided visitors cannot see — a model being retired, a price still
    /// being argued about — and quoting it to a customer is exactly the mistake the
    /// IsPublished flag exists to prevent.
    ///
    /// Descriptions are deliberately absent. The point is to let a drafter say "we also
    /// do the Nova 40 at 18 900" instead of "a colleague will confirm"; anything more
    /// than that is a conversation the customer is about to have anyway, and paying to
    /// send forty brochure entries on the off-chance is how a cheap feature stops being
    /// one.
    /// </summary>
    private async Task<string?> BuildPriceListAsync(Lead lead, CancellationToken ct)
    {
        var houses = await _db.Houses
            .AsNoTracking()
            .Where(h => h.IsPublished)
            .OrderBy(h => h.SortOrder)
            .ThenBy(h => h.Title)
            .Take(MaxPriceListRows)
            .Select(h => new
            {
                h.Id, h.Title, h.TitleBg, h.TitleEl, h.Price, h.Currency, h.CategoryKey,
            })
            .ToListAsync(ct);

        if (houses.Count == 0) return null;

        var sb = new StringBuilder();
        foreach (var house in houses)
        {
            // The linked model has its own section above with the description in it.
            // Repeating it here would spend tokens saying the same thing twice and
            // makes it look like two different products.
            if (lead.HouseId is { } linked && house.Id == linked) continue;

            var title = Localised(lead.Locale, house.Title, house.TitleBg, house.TitleEl);
            sb.Append("- ").Append(title);

            sb.Append(house.Price is { } price
                ? $" — {price.ToString("0.##", CultureInfo.InvariantCulture)} {house.Currency}"
                // Said out loud rather than left blank: a missing figure with no
                // explanation reads as an oversight the drafter is free to fill in.
                : " — price not published");

            if (!string.IsNullOrWhiteSpace(house.CategoryKey))
                sb.Append(" (").Append(house.CategoryKey).Append(')');

            sb.AppendLine();
        }

        var text = sb.ToString().TrimEnd();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    /// <summary>
    /// What the linked model actually is, in the customer's own language where we have it.
    ///
    /// The description is Rich Text in the catalogue, so it arrives as HTML. Flattened
    /// here rather than sent raw: markup is tokens that say nothing, and a half-closed tag
    /// is the sort of thing that turns up quoted verbatim in a draft.
    /// </summary>
    private static string? DescribeModelDetail(Lead lead)
    {
        if (lead.House is not { } house) return null;

        var description = Localised(
            lead.Locale, house.Description, house.DescriptionBg, house.DescriptionEl);

        var text = StripHtml(description);
        if (string.IsNullOrWhiteSpace(text)) return null;

        return text.Length <= MaxDescriptionChars
            ? text
            : text[..MaxDescriptionChars].TrimEnd() + " …";
    }

    /// <summary>
    /// The customer's own language where the catalogue has it, the default otherwise.
    ///
    /// Worth the lookup: the draft comes back in their language, and handing the model an
    /// English description to translate on the fly is how a specification quietly changes
    /// meaning between the catalogue and the customer's inbox.
    /// </summary>
    private static string Localised(string? locale, string fallback, string? bg, string? el)
    {
        var preferred = locale switch
        {
            "bg" => bg,
            "el" => el,
            _ => null,
        };

        return string.IsNullOrWhiteSpace(preferred) ? fallback ?? "" : preferred!;
    }

    private static readonly Regex HtmlTag = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex Blanks = new(@"[ \t]*\n\s*", RegexOptions.Compiled);

    private static string StripHtml(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";

        var text = raw!;
        if (text.Contains('<'))
        {
            // Block ends become newlines first, so a list does not collapse into one
            // run-on sentence once the tags are gone.
            text = Regex.Replace(text, @"(?i)<br\s*/?>|</p>|</div>|</li>|</tr>", "\n");
            text = HtmlTag.Replace(text, "");
        }

        text = System.Net.WebUtility.HtmlDecode(text);
        return Blanks.Replace(text, "\n").Trim();
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
            var line = new StringBuilder(
                Localised(lead.Locale, house.Title, house.TitleBg, house.TitleEl));
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
