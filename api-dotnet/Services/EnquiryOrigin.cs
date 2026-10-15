using System;
using System.Collections.Generic;
using System.Linq;
using Models;

namespace Services;

/// <summary>
/// Which page an ordinary offer was sent from, for the few pages whose enquiries are not about
/// a house (2026-10-15): the internal doors, the interiors/renovation service, the About page.
///
/// The page posts the ordinary offer to /api/offer with one optional key, OfferDto.Origin,
/// and composes its own message text — the server adds nothing else. From the key it writes
/// ONE short Bulgarian line in front of the visitor's words ("Запитване за врати"), below the
/// model and representative lines, exactly where the partner page's line goes; tags the sales
/// mail's subject ("[Врати] Ново запитване за оферта: …"); and, on promotion, stamps
/// Lead.Source from the line. Recipients do not change: these all go to LEAD_NOTIFY_EMAIL.
///
/// A partner enquiry keeps its own line. When a body carries both the partner block and an
/// origin, the partner wins and the origin is ignored (it is still validated: a key the list
/// does not know is a form out of step with the server, and the 400 is what shows it).
///
/// The key is matched exactly after trimming; blank is the same as absent, so a form that
/// sends "" behaves like every older client that sends nothing.
/// </summary>
public static class EnquiryOrigin
{
    public const string Doors = "doors";
    public const string Interiors = "interiors";
    public const string About = "about";

    private const string Separator = " · ";

    // Key → the line staff read, the subject tag, the Source a promotion stamps, and the short
    // suffix a representative's stamp gets ("Представител: dtodorov · врати").
    private static readonly (string Key, string Line, string Tag, string Source, string Suffix)[] List =
    {
        (Doors, "Запитване за врати", "[Врати]", "Страница за врати", "врати"),
        (Interiors, "Запитване за ремонт", "[Ремонт]", "Страница за ремонти", "ремонт"),
        (About, "Запитване от страницата „За нас“", "[За нас]", "Страница „За нас“", "за нас"),
    };

    /// <summary>The keys, for the tests and for anyone checking the SPA against the server.</summary>
    public static IReadOnlyList<string> Keys { get; } = List.Select(x => x.Key).ToArray();

    /// <summary>Key → the Bulgarian line, for the SPA contract test.</summary>
    public static IReadOnlyDictionary<string, string> Lines { get; } =
        List.ToDictionary(x => x.Key, x => x.Line, StringComparer.Ordinal);

    /// <summary>
    /// What is wrong with an offer's origin, keyed "origin" the way ASP.NET's own 400s key
    /// their fields. Empty when there is none or it is one of the keys.
    /// </summary>
    public static Dictionary<string, string[]> Validate(OfferDto dto)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(dto.Origin) && Find(dto.Origin) is null)
            errors["origin"] = new[] { $"Must be one of: {string.Join(", ", Keys)}." };
        return errors;
    }

    /// <summary>
    /// The origin that counts for this offer: its key, or null without one, with an unknown
    /// one, or with a partner block (the partner line wins).
    /// </summary>
    public static string? Effective(OfferDto dto) =>
        dto.Partner is not null ? null : Find(dto.Origin)?.Key;

    /// <summary>The line staff read for this offer, or null (see Effective).</summary>
    public static string? Line(OfferDto dto) => Find(Effective(dto))?.Line;

    /// <summary>The subject tag for an effective origin key ("[Врати]"), or null.</summary>
    public static string? Tag(string? key) => Find(key)?.Tag;

    /// <summary>The line for an effective origin key, or null.</summary>
    public static string? LineFor(string? key) => Find(key)?.Line;

    /// <summary>
    /// The visitor's text with the origin line in front of it, blank line between, mirroring
    /// PartnerEnquiry.Prepend. Applied before the representative and model lines, so it ends
    /// up directly above the visitor's words.
    /// </summary>
    public static string? Prepend(string? message, OfferDto dto)
    {
        var line = Line(dto);
        if (line is null) return message;

        var text = message?.Trim();
        return string.IsNullOrEmpty(text) ? line : line + "\n\n" + text;
    }

    /// <summary>
    /// The origin key a stored enquiry carries, or null. Only the lines the server writes
    /// count, in the order it writes them: an optional model line, an optional representative
    /// line, then this one as a whole paragraph. Text a visitor typed sits below all of them.
    /// </summary>
    public static string? KeyIn(string? message)
    {
        if (string.IsNullOrEmpty(message)) return null;

        foreach (var paragraph in message.Split("\n\n", 4))
        {
            foreach (var x in List)
                if (string.Equals(paragraph, x.Line, StringComparison.Ordinal)) return x.Key;
            if (OfferModel.HasModelLine(paragraph) || RepresentativeLine.IsLine(paragraph)) continue;
            return null;
        }
        return null;
    }

    /// <summary>
    /// Lead.Source for an enquiry being promoted: unchanged unless the message carries an
    /// origin line. With it, "Страница за врати" when nobody else claimed the lead, or the
    /// existing stamp tagged " · врати" so a representative keeps the lead his link brought in.
    /// A tagged stamp too long for the column keeps the representative's, as PartnerEnquiry does.
    /// </summary>
    public static string? SourceFor(string? message, string? source)
    {
        var entry = Find(KeyIn(message));
        if (entry is null) return source;
        if (string.IsNullOrWhiteSpace(source)) return entry.Value.Source;

        var tagged = source.Trim() + Separator + entry.Value.Suffix;
        return tagged.Length <= PartnerEnquiry.MaxSourceLength ? tagged : source;
    }

    private static (string Key, string Line, string Tag, string Source, string Suffix)? Find(string? key)
    {
        var k = key?.Trim();
        if (string.IsNullOrEmpty(k)) return null;
        foreach (var x in List)
            if (string.Equals(x.Key, k, StringComparison.Ordinal)) return x;
        return null;
    }
}
