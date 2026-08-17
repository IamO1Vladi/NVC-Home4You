using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Services;

/// <summary>
/// Copies the Quickbase CRM "Lead" table into the SQL Leads table.
///
///   dotnet run -- import-crm-leads [--dry-run]
///
/// A DIFFERENT import from `import-leads`, which carries website form submissions into
/// Offers and Questions. That one moves an inbox; this one moves the sales relationship
/// sheet the team maintained by hand — owners, stages, follow-up dates and all.
///
/// One-time by intent, idempotent by construction: rows are matched on
/// Lead.QuickbaseRecordId, so a second run updates in place rather than producing a
/// second copy of every customer.
///
/// THE HARD PART IS NOT THE COPYING, it is that the two systems disagree about what a
/// lead is. Quickbase has nine stages and a separate Open/Closed flag; we have six stages
/// where Won and Lost ARE closed. Quickbase has one "Interest / Product Line" multi-select
/// mixing gallery categories with things the gallery has no filter for. Every one of those
/// judgements is below, named, and covered by a test — because a silently wrong mapping
/// here shows up as a customer in the wrong column months later, with nothing to trace it
/// back to.
/// </summary>
public class CrmLeadImportService
{
    private readonly QuickbaseApi _qb;
    private readonly EnvConfig _env;
    private readonly AppDbContext _db;

    public CrmLeadImportService(QuickbaseApi qb, EnvConfig env, AppDbContext db)
    {
        _qb = qb;
        _env = env;
        _db = db;
    }

    public record ImportResult(
        int Fetched, int Inserted, int Updated, int Skipped,
        int LinkedToHouse, int UnresolvedHouses, List<string> Warnings)
    {
        /// <summary>
        /// What the import produced, by stage and by category.
        ///
        /// Printed after every run, including a dry one, because the counts are the only
        /// practical check that a mapping decision was right. "257 rows written" says the
        /// copying worked; "230 lost, 2 open" would say the Open/Closed rule is inverted,
        /// and nothing else would.
        /// </summary>
        public Dictionary<string, int> ByStatus { get; init; } = new();

        public Dictionary<string, int> ByCategory { get; init; } = new();

        public int WithFollowUp { get; init; }
        public int WithOwner { get; init; }
    }

    public bool IsConfigured => _qb.IsConfigured && !string.IsNullOrWhiteSpace(_env.TableCrmLeads);

    public async Task<ImportResult> ImportAsync(bool dryRun, CancellationToken ct)
    {
        var fids = new[]
        {
            _env.F_LEAD_RID, _env.F_LEAD_CREATED_ON, _env.F_LEAD_MODIFIED_ON,
            _env.F_CRM_FIRST_NAME, _env.F_CRM_LAST_NAME, _env.F_CRM_EMAIL, _env.F_CRM_PHONE,
            _env.F_CRM_PROJECT, _env.F_CRM_COUNTRY, _env.F_CRM_SITE_ADDRESS,
            _env.F_CRM_LANGUAGE, _env.F_CRM_CONTACT_METHOD, _env.F_CRM_SOURCE,
            _env.F_CRM_INTEREST, _env.F_CRM_SIZE, _env.F_CRM_BUDGET, _env.F_CRM_TIMELINE,
            _env.F_CRM_NOTES, _env.F_CRM_DELIVERY_REGION, _env.F_CRM_STAGE, _env.F_CRM_STATUS,
            _env.F_CRM_OWNER, _env.F_CRM_NEXT_FOLLOWUP, _env.F_CRM_LAST_CONTACT,
            _env.F_CRM_NEXT_STEP, _env.F_CRM_CONVERTED, _env.F_CRM_CONVERTED_AT,
            _env.F_CRM_LOST_REASON, _env.F_CRM_HOUSE,
        };

        var rows = await FetchAllAsync(_env.TableCrmLeads, fids, ct);

        // Houses are addressed by their QUICKBASE record id, never by their SQL primary
        // key. SqlGalleryService serves `QuickbaseRecordId ?? Id`, so matching on Id would
        // attach a lead to a different building — silently. The same trap LeadService
        // documents, and worth paying the one extra query to avoid.
        var houseByQbId = await _db.Houses
            .AsNoTracking()
            .Where(h => h.QuickbaseRecordId != null)
            .Select(h => new { Qb = h.QuickbaseRecordId!.Value, h.Id, h.CategoryKey })
            .ToDictionaryAsync(h => h.Qb, h => (h.Id, h.CategoryKey), ct);

        var existing = await _db.Leads
            .Where(l => l.QuickbaseRecordId != null)
            .ToDictionaryAsync(l => l.QuickbaseRecordId!.Value, ct);

        int inserted = 0, updated = 0, skipped = 0, linked = 0, unresolved = 0;
        var warnings = new List<string>();
        var byStatus = new Dictionary<string, int>(StringComparer.Ordinal);
        var byCategory = new Dictionary<string, int>(StringComparer.Ordinal);
        int withFollowUp = 0, withOwner = 0;

        foreach (var row in rows)
        {
            var rid = ParseInt(Get(row, _env.F_LEAD_RID));
            if (rid is null) { skipped++; continue; }

            var name = BuildName(Get(row, _env.F_CRM_FIRST_NAME), Get(row, _env.F_CRM_LAST_NAME));
            var email = Clean(Get(row, _env.F_CRM_EMAIL));
            var phone = Clean(Get(row, _env.F_CRM_PHONE));

            // A row with no name, no email AND no phone is not a lead, it is a blank form
            // somebody saved. Importing it would put an unnameable row on the board that
            // nobody can act on or safely delete.
            //
            // The phone is in that test deliberately: a name nobody wrote down does not
            // make a number somebody called any less of a lead, and dropping those would
            // be losing real customers to a tidiness rule.
            if (string.IsNullOrWhiteSpace(name)
                && string.IsNullOrWhiteSpace(email)
                && string.IsNullOrWhiteSpace(phone))
            {
                skipped++;
                warnings.Add($"record {rid}: no name, email or phone — skipped as a blank row");
                continue;
            }

            if (!existing.TryGetValue(rid.Value, out var lead))
            {
                lead = new Lead { QuickbaseRecordId = rid.Value };
                if (!dryRun) _db.Leads.Add(lead);
                inserted++;
            }
            else
            {
                updated++;
            }

            // Something has to be on the card. Falling back through email to phone means
            // an unnamed lead still reads as a person rather than as a blank row.
            lead.Name = Truncate(
                !string.IsNullOrWhiteSpace(name) ? name
                : !string.IsNullOrWhiteSpace(email) ? email!
                : phone!, 200)!;
            lead.Email = Truncate(email, 320);
            lead.Phone = Truncate(phone, 64);
            lead.ProjectName = Truncate(Clean(Get(row, _env.F_CRM_PROJECT)), 200);
            lead.Country = Truncate(Clean(Get(row, _env.F_CRM_COUNTRY)), 100);
            lead.BuildLocation = Truncate(Clean(Get(row, _env.F_CRM_SITE_ADDRESS)), 400);
            lead.Locale = MapLocale(Get(row, _env.F_CRM_LANGUAGE));
            lead.Source = Truncate(Clean(Get(row, _env.F_CRM_SOURCE)), 60);
            lead.NextStep = Truncate(Clean(Get(row, _env.F_CRM_NEXT_STEP)), 1000);
            lead.OwnerUpn = Truncate(ReadUserEmail(row, _env.F_CRM_OWNER), 320);

            var (status, closedAt) = MapStatus(row, _env);
            lead.Status = status;
            lead.ClosedAt = closedAt;
            lead.LostReason = status == LeadStatuses.Lost
                ? Truncate(Clean(Get(row, _env.F_CRM_LOST_REASON)), 120)
                : null;

            // Truncated to the day, matching everything else that touches this column —
            // see LeadService.TryParseFollowUpDate for why a follow-up is a date and not
            // a moment.
            var followUp = ParseDate(Get(row, _env.F_CRM_NEXT_FOLLOWUP));
            lead.NextContactAt = followUp is null
                ? null
                : new DateTimeOffset(followUp.Value.UtcDateTime.Date, TimeSpan.Zero);

            lead.LastActivityAt = ParseDate(Get(row, _env.F_CRM_LAST_CONTACT));
            lead.CreatedAt = ParseDate(Get(row, _env.F_LEAD_CREATED_ON)) ?? lead.CreatedAt;
            lead.UpdatedAt = ParseDate(Get(row, _env.F_LEAD_MODIFIED_ON));

            var interests = ReadInterests(row, _env.F_CRM_INTEREST);
            lead.CustomModel = Truncate(
                interests.Count == 0 ? null : string.Join(", ", interests), 400);

            // The linked house is the better answer to BOTH "which model?" and "which
            // category?": it is a real row in our catalogue, so the category comes from
            // the house itself rather than from a guess about a free-text label.
            var houseQbId = ParseInt(Get(row, _env.F_CRM_HOUSE));
            if (houseQbId is not null && houseByQbId.TryGetValue(houseQbId.Value, out var house))
            {
                lead.HouseId = house.Id;
                lead.CategoryKey = house.CategoryKey;
                linked++;
            }
            else
            {
                lead.HouseId = null;
                lead.CategoryKey = MapInterestCategory(interests);

                if (houseQbId is not null)
                {
                    unresolved++;
                    warnings.Add(
                        $"record {rid}: house {houseQbId} is not in the SQL catalogue, left unlinked");
                }
            }

            lead.Notes = BuildNotes(row, _env);

            byStatus[lead.Status] = byStatus.TryGetValue(lead.Status, out var s) ? s + 1 : 1;
            var categoryLabel = lead.CategoryKey ?? "(none)";
            byCategory[categoryLabel] = byCategory.TryGetValue(categoryLabel, out var c) ? c + 1 : 1;
            if (lead.NextContactAt is not null) withFollowUp++;
            if (!string.IsNullOrWhiteSpace(lead.OwnerUpn)) withOwner++;
        }

        if (!dryRun) await _db.SaveChangesAsync(ct);

        return new ImportResult(rows.Count, inserted, updated, skipped, linked, unresolved, warnings)
        {
            ByStatus = byStatus,
            ByCategory = byCategory,
            WithFollowUp = withFollowUp,
            WithOwner = withOwner,
        };
    }

    // --- The judgement calls ------------------------------------------------------------

    /// <summary>
    /// Quickbase's Bulgarian stage labels, mapped onto our six.
    ///
    /// Two of these are worth explaining. "Опитали сме за контакт" is "we TRIED to make
    /// contact" — an attempt, not a conversation — but it is still further along than a
    /// lead nobody has touched, so it lands on Contacted rather than New. "Чакат Оферта"
    /// is "they are waiting for a quote", which means we owe them one and have not sent
    /// it: Contacted, emphatically not Quoted, or the pipeline would claim work that has
    /// not been done.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> StageMap =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Първи Контакт"] = LeadStatuses.New,
            ["Опитали сме за контакт"] = LeadStatuses.Contacted,
            ["Свързали сме се"] = LeadStatuses.Contacted,
            ["Чакат Оферта"] = LeadStatuses.Contacted,
            ["Пратена е оферта"] = LeadStatuses.Quoted,
            ["В комуникация за сделка"] = LeadStatuses.Negotiating,
            // Quickbase's own typo for "Пред сделка" — on the point of a deal. Mapped as
            // spelled, because what is in the table is what the import has to read.
            ["Пред сдекла"] = LeadStatuses.Negotiating,
            ["Пред сделка"] = LeadStatuses.Negotiating,
            ["Готова сделка!"] = LeadStatuses.Won,
            ["Загубна сделка!"] = LeadStatuses.Lost,
        };

    /// <summary>
    /// Where a lead stands, and when it stopped moving.
    ///
    /// The two systems disagree in a way that has to be resolved rather than averaged.
    /// Quickbase carries a stage AND a separate Open/Closed flag; we have six stages of
    /// which Won and Lost are themselves the closed ones. Half the table is Closed while
    /// still sitting on a mid-pipeline stage — those are leads the team gave up on, and
    /// the Lost Reason field ("No response", 26 of them) says so out loud.
    ///
    /// So: Closed and not Won means Lost. Leaving them Open instead would drop 120 dead
    /// leads onto the working board on day one, which is the surest way to make the board
    /// worthless.
    /// </summary>
    public static (string Status, DateTimeOffset? ClosedAt) MapStatus(QbRec row, EnvConfig env)
    {
        var stage = Clean(Get(row, env.F_CRM_STAGE));
        var mapped = stage is not null && StageMap.TryGetValue(stage, out var key) ? key : null;

        var converted = ParseBool(Get(row, env.F_CRM_CONVERTED));
        var closed = string.Equals(Clean(Get(row, env.F_CRM_STATUS)), "Closed", StringComparison.OrdinalIgnoreCase);

        // Converted is a fact about the outcome; a stage is somebody's note about
        // progress. Where they disagree, the fact wins.
        var status = converted || mapped == LeadStatuses.Won
            ? LeadStatuses.Won
            : mapped == LeadStatuses.Lost || closed
                ? LeadStatuses.Lost
                : mapped ?? LeadStatuses.New;

        if (LeadStatuses.IsOpen(status)) return (status, null);

        // ClosedAt drives the archive rule, so a closed lead must carry one. Falling back
        // to Date Modified is a guess, but a dated guess archives; a null never does, and
        // the board would keep 120 finished leads in view forever.
        var closedAt = ParseDate(Get(row, env.F_CRM_CONVERTED_AT))
            ?? ParseDate(Get(row, env.F_LEAD_MODIFIED_ON))
            ?? DateTimeOffset.UtcNow;

        return (status, closedAt);
    }

    /// <summary>
    /// Quickbase's product-line labels, mapped to a gallery category where one fits.
    ///
    /// Where one FITS is the whole point. "Сглобяема къща" is the gallery's prefab filter;
    /// "Модулна / Контейнерна къща" is its modular one. But "Контейнер", "Logistics" and
    /// "Interiors" are things the company sells that the gallery has no filter for, and
    /// "Бокс къща" is the configurator's product rather than a gallery category at all.
    ///
    /// Those are kept VERBATIM rather than forced into a gallery key or dropped. The panel
    /// then asks HouseCategories.IsValid and shows a model dropdown only when there are
    /// models to show — which is exactly the rule that makes a category field useful
    /// instead of a second name for the same thing.
    /// </summary>
    public static string? MapInterestCategory(IReadOnlyList<string> interests)
    {
        if (interests.Count == 0) return null;

        // A gallery category wins over a non-gallery one wherever both are ticked: it is
        // the more useful of the two, because it is the one that leads somewhere.
        foreach (var interest in interests)
        {
            var direct = HouseCategories.FromQuickbaseLabel(interest);
            if (direct is not null) return direct;

            if (InterestToCategory.TryGetValue(interest, out var mapped)) return mapped;
        }

        return Truncate(interests[0], 60);
    }

    private static readonly IReadOnlyDictionary<string, string> InterestToCategory =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Модулна / Контейнерна къща"] = HouseCategories.Modular,
            ["Modular Houses"] = HouseCategories.Modular,
            ["Modular Builds"] = HouseCategories.Modular,
        };

    private static string? MapLocale(string? raw) => Clean(raw) switch
    {
        "Български" => "bg",
        "Английски" => "en",
        "Гръцки" => "el",
        _ => null,
    };

    /// <summary>
    /// The fields worth keeping but not worth a column, folded into the notes.
    ///
    /// Budget, timeline, size, delivery region and the rest are real information that
    /// sales wrote down, and dropping them on import would be throwing away somebody's
    /// work. But each would be a column on a form that every future lead has to look at,
    /// for data only the imported rows carry. Prose keeps them without that cost.
    /// </summary>
    private static string? BuildNotes(QbRec row, EnvConfig env)
    {
        var sb = new StringBuilder();

        var notes = Clean(Get(row, env.F_CRM_NOTES));
        if (notes is not null) sb.AppendLine(notes);

        var extras = new List<string>();
        void Add(string label, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value)) extras.Add($"{label}: {value!.Trim()}");
        }

        Add("Размер / Size", Clean(Get(row, env.F_CRM_SIZE)));
        Add("Бюджет / Budget", Clean(Get(row, env.F_CRM_BUDGET)));
        Add("Срок / Timeline", Clean(Get(row, env.F_CRM_TIMELINE)));
        Add("Регион / Delivery region", Clean(Get(row, env.F_CRM_DELIVERY_REGION)));
        Add("Предпочитан контакт / Preferred contact", Clean(Get(row, env.F_CRM_CONTACT_METHOD)));

        if (extras.Count > 0)
        {
            if (sb.Length > 0) sb.AppendLine();
            // Labelled as imported so nobody later mistakes it for something a colleague
            // typed into this panel.
            sb.AppendLine("— от Quickbase / imported —");
            foreach (var extra in extras) sb.AppendLine(extra);
        }

        var text = sb.ToString().Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    // --- Reading Quickbase's shapes -----------------------------------------------------

    // "-" is what somebody types into a required box they have no answer for, and
    // "Не е споменато" ("not mentioned") is the same thing spelled out. Both mean empty,
    // and importing them verbatim would put placeholder text on 200 customer cards.
    private static readonly HashSet<string> Placeholders = new(StringComparer.OrdinalIgnoreCase)
    {
        "-", "--", "n/a", "na", "Не е споменато", "не е посочено",
    };

    private static string? Clean(string? raw)
    {
        var value = raw?.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;
        return Placeholders.Contains(value) ? null : value;
    }

    private static string BuildName(string? first, string? last)
    {
        var parts = new[] { Clean(first), Clean(last) }.Where(x => x is not null);
        return string.Join(" ", parts).Trim();
    }

    // A Quickbase User field is an object, not a string: {"email":..,"id":..,"name":..}.
    // The email is the only part of it that means anything to us — it is the same UPN the
    // Entra sign-in produces, so an imported owner and a panel owner are the same person.
    private static string? ReadUserEmail(QbRec row, int fid)
    {
        if (!row.TryGetElement(fid, out var element)) return null;
        if (element.ValueKind != JsonValueKind.Object) return null;

        return element.TryGetProperty("email", out var email) && email.ValueKind == JsonValueKind.String
            ? Clean(email.GetString())
            : null;
    }

    // A multi-select comes back as a JSON array of strings.
    private static List<string> ReadInterests(QbRec row, int fid)
    {
        var values = new List<string>();
        if (!row.TryGetElement(fid, out var element)) return values;

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                var value = Clean(item.GetString());
                if (value is not null) values.Add(value);
            }
        }
        else
        {
            var value = Clean(element.GetString());
            if (value is not null) values.Add(value);
        }

        return values;
    }

    private static string? Get(QbRec row, int fid) => row.Get(fid);

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    private static int? ParseInt(string? raw) =>
        decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var value)
            ? (int)value            // Quickbase sends related-record ids as "10.0"
            : null;

    private static bool ParseBool(string? raw) =>
        raw is not null && (raw == "1" || raw.Equals("true", StringComparison.OrdinalIgnoreCase));

    private static DateTimeOffset? ParseDate(string? raw) =>
        DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var value)
            ? value
            : null;

    // Paged, for the reason QueryPageAsync exists: the 500-row cap is silent, and an
    // import that quietly stops at 500 looks exactly like one that finished.
    private async Task<List<QbRec>> FetchAllAsync(string tableId, IEnumerable<int> fids, CancellationToken ct)
    {
        var all = new List<QbRec>();

        for (var skip = 0; ; skip += 500)
        {
            var page = await _qb.QueryPageAsync(
                tableId, fids, where: "", sortFid: _env.F_LEAD_RID, sortOrder: "ASC",
                skip: skip, top: 500, ct);

            var batch = page.data ?? new List<QbRec>();
            all.AddRange(batch);
            if (batch.Count < 500) break;
        }

        return all;
    }
}
