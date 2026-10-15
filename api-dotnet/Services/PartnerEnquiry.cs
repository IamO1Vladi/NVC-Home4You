using System;
using System.Collections.Generic;
using System.Linq;
using Models;

namespace Services;

/// <summary>
/// The partner page's enquiry (2026-10-15): what the form may send, and the one Bulgarian line
/// staff read instead of it.
///
/// The form posts to /api/offer like every other quote request, with one extra block of
/// choices (OfferDto.Partner). Nothing in the panel, the mail or the pipeline learns a new
/// column from it. The server turns the block into a single line — "Партньорско запитване ·
/// Препродавач · Гърция, Солун · Контейнери, Бокс 58 · 6–10 бр. · …" — and puts it in front of
/// the visitor's own words, the way the model and representative lines are put there. So a
/// Greek dealer's enquiry reaches staff in Bulgarian, the Enquiries search already finds it,
/// and the lead thread opens with it.
///
/// EVERY CHOICE IS A KEY FROM A FIXED LIST and only the list's own label is ever written: a
/// visitor cannot put words of their own into the line except through the three free boxes
/// (region, company, VAT/company id), which are flattened to one line and capped by
/// OfferModel.CleanText exactly as a gallery title is. An unknown key is refused with a 400
/// naming the field (Validate), never dropped quietly, because a form that sends a key this
/// list has never heard of is a form out of step with the server, and that should be loud.
///
/// The line is also read back, once: LeadService stamps Lead.Source from it when the enquiry
/// is promoted (SourceFor), because the panel's promote button sends no source of its own.
/// </summary>
public static class PartnerEnquiry
{
    public const int MaxRegionLength = 80;
    public const int MaxCompanyLength = 120;
    public const int MaxVatIdLength = 30;

    // Lead.Source's column width. A stamp that would not fit is not written (SourceFor).
    public const int MaxSourceLength = 60;

    private const string LinePrefix = "Партньорско запитване";
    private const string Separator = " · ";
    private const string SourcePrefix = "Партньорска страница";
    private const string SourceSuffix = "партньор";

    // Key → the Bulgarian label staff read. Arrays rather than dictionaries where the order
    // is part of the output: products are written in this order whatever order they arrived
    // in, so two enquiries for the same things read the same.
    private static readonly (string Key, string Label)[] RoleList =
    {
        ("reseller", "Препродавач"),
        ("ownSite", "За свой обект"),
        ("other", "Друго"),
    };

    private static readonly (string Key, string Label)[] SectorList =
    {
        ("glamping", "Къмпинг/глемпинг"),
        ("hotel", "Хотел/къща за гости"),
        ("construction", "Строителна фирма"),
        ("farm", "Стопанство"),
        ("investor", "Инвеститор"),
        ("shop", "Магазин"),
        ("realEstate", "Агенция за имоти"),
        ("other", "Друга сфера"),
    };

    private static readonly (string Key, string Label)[] ProductList =
    {
        ("container", "Контейнери"),
        ("box37", "Бокс 37"),
        ("box58", "Бокс 58"),
        ("box73", "Бокс 73"),
        ("steel", "Сглобяема къща по проект"),
    };

    private static readonly (string Key, string Label)[] QuantityList =
    {
        ("2-5", "2–5 бр."),
        ("6-10", "6–10 бр."),
        ("11-25", "11–25 бр."),
        ("25+", "25+ бр."),
    };

    private static readonly (string Key, string Label)[] TimingList =
    {
        ("month", "До 1 месец"),
        ("1-3m", "1–3 месеца"),
        ("3-6m", "3–6 месеца"),
        ("season", "За следващия сезон"),
        ("exploring", "Само проучва"),
    };

    private static readonly (string Key, string Label)[] CountryList =
    {
        ("BG", "България"),
        ("GR", "Гърция"),
        ("MK", "Северна Македония"),
        ("RO", "Румъния"),
        ("EU", "Друга държава в ЕС"),
        ("nonEU", "Извън ЕС"),
    };

    // "own" is the option the owner offered partners on 2026-10-15: pay the factory directly
    // and arrange the transport themselves.
    private static readonly (string Key, string Label)[] LogisticsList =
    {
        ("ours", "Доставка от нас"),
        ("own", "Собствена логистика"),
    };

    // The keys, for the tests and for anyone checking the SPA against the server.
    public static IReadOnlyList<string> Roles { get; } = RoleList.Select(x => x.Key).ToArray();
    public static IReadOnlyList<string> Sectors { get; } = SectorList.Select(x => x.Key).ToArray();
    public static IReadOnlyList<string> Products { get; } = ProductList.Select(x => x.Key).ToArray();
    public static IReadOnlyList<string> Quantities { get; } = QuantityList.Select(x => x.Key).ToArray();
    public static IReadOnlyList<string> Timings { get; } = TimingList.Select(x => x.Key).ToArray();
    public static IReadOnlyList<string> Countries { get; } = CountryList.Select(x => x.Key).ToArray();
    public static IReadOnlyList<string> LogisticsOptions { get; } = LogisticsList.Select(x => x.Key).ToArray();

    /// <summary>
    /// What is wrong with an offer's partner block, keyed by field ("partner.role", "phone")
    /// the way ASP.NET's own 400s key theirs. Empty when there is no block or nothing is wrong.
    ///
    /// Keys are matched exactly, after trimming: the SPA sends them from its own constants, so
    /// "Reseller" is a form out of step, not a visitor's typo. A phone is required with the
    /// block — a business enquiry is answered by a call — and only with it, so every other
    /// form keeps its optional phone.
    /// </summary>
    public static Dictionary<string, string[]> Validate(OfferDto dto)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var p = dto.Partner;
        if (p is null) return errors;

        Required(errors, "partner.role", p.Role, RoleList);
        Required(errors, "partner.quantity", p.Quantity, QuantityList);
        Required(errors, "partner.country", p.Country, CountryList);
        Optional(errors, "partner.sector", p.Sector, SectorList);
        Optional(errors, "partner.timing", p.Timing, TimingList);
        Optional(errors, "partner.logistics", p.Logistics, LogisticsList);

        if (p.Products is { } products && products.Any(k => LabelOf(ProductList, k) is null))
            errors["partner.products"] = new[] { $"Each product must be one of: {string.Join(", ", Products)}." };

        if (string.IsNullOrWhiteSpace(dto.Phone))
            errors["phone"] = new[] { "A phone number is required for a partner enquiry." };

        return errors;
    }

    /// <summary>
    /// The one line staff read, or null without a block or without a role this list knows.
    ///
    /// Only what was chosen is written: an optional field left blank leaves no "Сфера: —"
    /// behind. Unknown keys are skipped rather than echoed, so a caller that skipped Validate
    /// still cannot put a visitor's text into the line through a choice field.
    /// </summary>
    public static string? Line(PartnerDto? p)
    {
        var role = LabelOf(RoleList, p?.Role);
        if (p is null || role is null) return null;

        var parts = new List<string> { LinePrefix, role };
        Add(parts, LabelOf(SectorList, p.Sector));

        var country = LabelOf(CountryList, p.Country);
        var region = OfferModel.CleanText(p.Region, MaxRegionLength);
        Add(parts, country is null ? region : region is null ? country : $"{country}, {region}");

        var products = ProductList
            .Where(x => p.Products?.Any(k => string.Equals(k?.Trim(), x.Key, StringComparison.Ordinal)) == true)
            .Select(x => x.Label)
            .ToArray();
        if (products.Length > 0) parts.Add(string.Join(", ", products));

        Add(parts, LabelOf(QuantityList, p.Quantity));
        Add(parts, LabelOf(TimingList, p.Timing));
        Add(parts, LabelOf(LogisticsList, p.Logistics));

        var company = OfferModel.CleanText(p.Company, MaxCompanyLength);
        if (company is not null) parts.Add("Фирма: " + company);
        var vatId = OfferModel.CleanText(p.VatId, MaxVatIdLength);
        if (vatId is not null) parts.Add("ЕИК/ДДС: " + vatId);

        return string.Join(Separator, parts);
    }

    /// <summary>
    /// The visitor's text with the partner line in front of it, blank line between, mirroring
    /// RepresentativeLine.Prepend. Applied FIRST, so the line ends up below the model and
    /// representative lines: the house is resolved off the first line, and the representative
    /// line is where the intake's mail and the panel look for it.
    /// </summary>
    public static string? Prepend(string? message, PartnerDto? p)
    {
        var line = Line(p);
        if (line is null) return message;

        var text = message?.Trim();
        return string.IsNullOrEmpty(text) ? line : line + "\n\n" + text;
    }

    /// <summary>
    /// The role label of the partner line a stored enquiry carries ("Препродавач"), or null
    /// when it carries none.
    ///
    /// Only the lines the server writes count, in the order it writes them: an optional model
    /// line, an optional representative line, then this one, and only with a role label from
    /// the list above. Text a visitor typed sits below all of them, so it is read only if it
    /// opens with a forgery of the whole line — and the worst that does is label a lead.
    /// </summary>
    public static string? RoleIn(string? message)
    {
        if (string.IsNullOrEmpty(message)) return null;

        foreach (var paragraph in message.Split("\n\n", 4))
        {
            if (paragraph.StartsWith(LinePrefix + Separator, StringComparison.Ordinal))
            {
                var rest = paragraph[(LinePrefix.Length + Separator.Length)..];
                var cut = rest.IndexOf(Separator, StringComparison.Ordinal);
                var role = cut < 0 ? rest : rest[..cut];
                return RoleList.Any(x => x.Label == role) ? role : null;
            }
            if (OfferModel.HasModelLine(paragraph) || RepresentativeLine.IsLine(paragraph)) continue;
            return null;
        }
        return null;
    }

    /// <summary>
    /// Lead.Source for an enquiry being promoted: unchanged unless the message carries the
    /// partner line. With it, "Партньорска страница · Препродавач" when nobody else claimed the
    /// lead, or the existing stamp tagged " · партньор" — "Представител: dtodorov · партньор" —
    /// so a representative keeps the lead his link brought in and the board still shows it as a
    /// partner's. A tagged stamp too long for the column keeps the representative's, because
    /// who owns the lead matters more than how it is labelled.
    /// </summary>
    public static string? SourceFor(string? message, string? source)
    {
        var role = RoleIn(message);
        if (role is null) return source;
        if (string.IsNullOrWhiteSpace(source)) return SourcePrefix + Separator + role;

        var tagged = source.Trim() + Separator + SourceSuffix;
        return tagged.Length <= MaxSourceLength ? tagged : source;
    }

    private static string? LabelOf((string Key, string Label)[] list, string? key)
    {
        var k = key?.Trim();
        if (string.IsNullOrEmpty(k)) return null;
        foreach (var (Key, Label) in list)
            if (string.Equals(Key, k, StringComparison.Ordinal)) return Label;
        return null;
    }

    private static void Required(
        Dictionary<string, string[]> errors, string field, string? value, (string Key, string Label)[] list)
    {
        if (string.IsNullOrWhiteSpace(value))
            errors[field] = new[] { "Required." };
        else if (LabelOf(list, value) is null)
            errors[field] = new[] { $"Must be one of: {string.Join(", ", list.Select(x => x.Key))}." };
    }

    private static void Optional(
        Dictionary<string, string[]> errors, string field, string? value, (string Key, string Label)[] list)
    {
        if (!string.IsNullOrWhiteSpace(value) && LabelOf(list, value) is null)
            errors[field] = new[] { $"Must be one of: {string.Join(", ", list.Select(x => x.Key))}." };
    }

    private static void Add(List<string> parts, string? part)
    {
        if (part is not null) parts.Add(part);
    }
}
