using System;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Models;

namespace Services;

/// <summary>
/// Which gallery model an offer enquiry is about, cleaned up for staff to read.
///
/// A gallery "request an offer" sends three loose strings alongside the form: the model's
/// public id, its Bulgarian title and its Bulgarian page path. The id alone was never
/// enough. It is not unique on live — SqlGalleryService exposes QuickbaseRecordId ?? Id,
/// so an admin-created house and an imported one can both answer to "15" — and a raw
/// "Модел: 15" told sales nothing they could act on. The title says it in words and the
/// link opens the exact page the customer was looking at.
///
/// ALL THREE ARRIVE FROM AN ANONYMOUS PUBLIC FORM and end up in the sales inbox and on every
/// admin surface that shows the enquiry, so none of them is trusted:
///
/// - The title is flattened to one capped line, because it lands in a mail subject and in
///   the first line of the stored message, where a smuggled line break would forge a
///   second line that looks like ours.
/// - The path becomes a link ONLY if it is one of our own gallery product pages, and the
///   link is rebuilt on our own base URL rather than echoed. A link inside a mail from our
///   own sales system is exactly what a phisher would like to control; anything that is
///   not plainly a product page gets no link, and the title still shows.
///
/// Everything here is plain text. HTML encoding belongs to whoever renders it.
/// </summary>
public sealed record OfferModel(string? Id, string? Title, string? Url)
{
    public const int MaxTitleLength = 200;

    // The width of Offer.ModelId, so the email never shows more of an id than was stored.
    public const int MaxIdLength = 100;

    // Generous for any real title, and small enough that the escaped URL — up to nine
    // characters per Cyrillic or Greek letter — keeps the stored model line far below the
    // 4000-character message limit it is prepended to.
    public const int MaxSlugLength = 200;

    // Anything longer cannot be a slug of MaxSlugLength however it was escaped, so it is
    // refused before it is decoded.
    private const int MaxPathLength = 2048;

    // Exactly the shape GallerySlugs.Slugify (and slugify() in galleryUtils.js) produces:
    // letters and digits in hyphen-separated runs. Matching that, rather than listing the
    // characters to refuse, is what rules out a second '/', '?', '#', '\', '%', a scheme or
    // whitespace in one stroke — none of them is a letter or a digit. \z, not $, because $
    // also matches before a trailing newline and "%0A" decodes to one.
    private static readonly Regex SlugShape = new(@"^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*\z", RegexOptions.CultureInvariant);

    /// <summary>The model an offer names, or null when it names none.</summary>
    public static OfferModel? From(OfferDto dto) => From(dto.ModelId, dto.ModelTitle, dto.ModelPath);

    /// <summary>
    /// Cleans the three fields the site sends. Null when there is neither an id nor a title,
    /// which is every enquiry that did not start in the gallery.
    ///
    /// A link with no title is dropped: the site always sends the two together, and without
    /// a title there is nothing to hang the link on.
    /// </summary>
    public static OfferModel? From(string? id, string? title, string? path)
    {
        var cleanId = CleanText(id, MaxIdLength);
        var cleanTitle = CleanText(title, MaxTitleLength);
        if (cleanId is null && cleanTitle is null) return null;

        return new OfferModel(cleanId, cleanTitle, cleanTitle is null ? null : UrlFor(path));
    }

    /// <summary>
    /// One line of plain text, or null when nothing readable is left.
    ///
    /// Line breaks and other control characters become single spaces rather than vanishing,
    /// so "Space\nhouse" still reads as two words. Invisible formatting characters are
    /// removed outright, because a right-to-left override is how a title is made to display
    /// as something other than what it says.
    /// </summary>
    public static string? CleanText(string? raw, int max)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var sb = new StringBuilder(raw.Length);
        var pendingSpace = false;
        // By code point, not by char: each half of a surrogate pair is categorised as a
        // Surrogate, so a char loop would wave through invisible astral formatting such as
        // the Unicode tag characters (U+E0000-E007F), which can hide whole sentences.
        foreach (var r in raw.EnumerateRunes())
        {
            if (Rune.IsWhiteSpace(r) || Rune.IsControl(r))
            {
                pendingSpace = sb.Length > 0;
                continue;
            }
            if (Rune.GetUnicodeCategory(r) == UnicodeCategory.Format) continue;

            if (pendingSpace) sb.Append(' ');
            pendingSpace = false;
            sb.Append(r.ToString());
        }

        if (sb.Length == 0) return null;
        if (sb.Length <= max) return sb.ToString();

        // Never cut between the two halves of a surrogate pair: half an emoji is an
        // invalid string that some mail transports refuse outright.
        var cut = char.IsHighSurrogate(sb[max - 1]) ? max - 1 : max;
        return sb.ToString(0, cut).TrimEnd();
    }

    /// <summary>
    /// The absolute URL of a gallery product page, or null when the path is anything else.
    ///
    /// Accepted: one of our gallery bases (GallerySlugs.Locales) followed by exactly one
    /// slug, raw or percent-encoded. The slug is decoded ONCE, so a double-encoded one still
    /// carries a '%' and is refused, and the URL is rebuilt from GallerySlugs.SiteUrl, so
    /// nothing the visitor typed can choose the host.
    /// </summary>
    public static string? UrlFor(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;

        var trimmed = path.Trim();
        if (trimmed.Length > MaxPathLength) return null;

        foreach (var (_, prefix) in GallerySlugs.Locales)
        {
            // Ordinal, unlike GallerySlugs.TryParsePath: that one reads whatever a browser
            // asked for, whereas the site sends this base exactly as GallerySlugs spells it.
            if (!trimmed.StartsWith(prefix, StringComparison.Ordinal)) continue;

            var slug = Uri.UnescapeDataString(trimmed[prefix.Length..]);
            if (slug.Length > MaxSlugLength || !SlugShape.IsMatch(slug)) return null;

            return GallerySlugs.SiteUrl + prefix + Uri.EscapeDataString(slug);
        }

        return null;
    }

    /// <summary>
    /// The first line of the stored enquiry — "Модел от сайта: title — url" — or null
    /// without a title. Bulgarian because only staff ever read the stored message.
    ///
    /// The link is shown DECODED here. The escaped form is for an href; in the stored text
    /// nothing turns it into a link, and a Cyrillic slug escapes to six characters a letter,
    /// which filled the Enquiries preview with %D0%.. before the customer's own words.
    /// Decoding is safe: UrlFor only builds a Url from our own base and a slug that passed
    /// SlugShape, so all that comes back is letters, digits and hyphens.
    /// </summary>
    public string? MessageLine => Title is null
        ? null
        : Url is null ? $"Модел от сайта: {Title}" : $"Модел от сайта: {Title} — {Uri.UnescapeDataString(Url)}";

    /// <summary>
    /// The customer's text with the model line in front of it, separated by a blank line.
    ///
    /// In FRONT, not behind: the message is cut at 4000 characters, and a configurator-sized
    /// paste would push a trailing line off the end. In front it also becomes the preview
    /// the Enquiries list shows, which is where sales first look.
    /// </summary>
    public static string? WithModelLine(OfferModel? model, string? message)
    {
        var line = model?.MessageLine;
        if (line is null) return message;

        var text = message?.Trim();
        return string.IsNullOrEmpty(text) ? line : line + "\n\n" + text;
    }
}
