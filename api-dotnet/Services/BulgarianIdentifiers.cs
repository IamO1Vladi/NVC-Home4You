using System;
using System.Linq;

namespace Services;

/// <summary>
/// Checksum validation for the two identifiers a Bulgarian invoice is addressed by.
///
/// Worth the ~70 lines because of what these numbers are FOR. An ЕГН or ЕИК with a
/// transposed digit does not fail anywhere in this system — it is stored happily, printed
/// onto an invoice, and discovered by an accountant weeks later, at which point the document
/// has to be reissued. Both numbers carry a check digit precisely so that a typo can be
/// caught at the point of entry, and catching it costs one function call.
///
/// Public algorithms, both defined by the National Statistical Institute.
/// </summary>
public static class BulgarianIdentifiers
{
    // ЕГН: nine digits under fixed weights, mod 11, with 10 folding to 0.
    private static readonly int[] EgnWeights = { 2, 4, 8, 5, 10, 9, 7, 3, 6 };

    // ЕИК/Булстат, first pass over the leading eight digits.
    private static readonly int[] EikWeights1 = { 1, 2, 3, 4, 5, 6, 7, 8 };

    // The fallback weights, used only when the first pass lands on 10 — which is the case
    // the naive implementations get wrong and the reason this is not three lines.
    private static readonly int[] EikWeights2 = { 3, 4, 5, 6, 7, 8, 9, 10 };

    // The extra check digit on a 13-digit ЕИК, over digits 9-12.
    private static readonly int[] EikWeights3 = { 2, 7, 3, 5 };
    private static readonly int[] EikWeights4 = { 4, 9, 5, 7 };

    /// <summary>True when the value is exactly ten digits — the shape of an ЕГН.</summary>
    public static bool LooksLikeEgn(string? value) =>
        value is { Length: 10 } && value.All(char.IsAsciiDigit);

    /// <summary>
    /// Whether a ten-digit string is a well-formed ЕГН.
    ///
    /// Checks the checksum only, NOT the date encoded in the first six digits. A date check
    /// would reject the small number of legitimately issued numbers with irregular dates,
    /// and rejecting a real person's real ЕГН is a worse failure than accepting an
    /// implausible one.
    /// </summary>
    public static bool IsValidEgn(string? value)
    {
        if (!LooksLikeEgn(value)) return false;

        var sum = 0;
        for (var i = 0; i < 9; i++) sum += (value![i] - '0') * EgnWeights[i];

        var check = sum % 11;
        if (check == 10) check = 0;

        return check == value![9] - '0';
    }

    /// <summary>True when the value is 9 or 13 digits — the two shapes of an ЕИК.</summary>
    public static bool LooksLikeEik(string? value) =>
        value is { Length: 9 or 13 } && value.All(char.IsAsciiDigit);

    /// <summary>
    /// Whether a value is a well-formed ЕИК (9 digits) or ЕИК of a branch (13 digits).
    /// </summary>
    public static bool IsValidEik(string? value)
    {
        if (!LooksLikeEik(value)) return false;

        if (!NineDigitsValid(value!)) return false;
        if (value!.Length == 9) return true;

        // The 13-digit form is a valid 9-digit ЕИК plus four digits and a second check
        // digit computed over them alone.
        var check = Weighted(value, 8, 4, EikWeights3);
        if (check == 10) check = Weighted(value, 8, 4, EikWeights4);
        if (check == 10) check = 0;

        return check == value[12] - '0';
    }

    private static bool NineDigitsValid(string value)
    {
        var check = Weighted(value, 0, 8, EikWeights1);
        if (check == 10) check = Weighted(value, 0, 8, EikWeights2);
        if (check == 10) check = 0;

        return check == value[8] - '0';
    }

    private static int Weighted(string value, int offset, int count, int[] weights)
    {
        var sum = 0;
        for (var i = 0; i < count; i++) sum += (value[offset + i] - '0') * weights[i];
        return sum % 11;
    }

    /// <summary>
    /// Whether a country string is one we should read a ten-digit id as an ЕГН for.
    ///
    /// This gates the ЕГН checksum, and the gate is the whole reason it can be enforced at
    /// all. A foreign buyer's identity number can be ten digits and will not satisfy a
    /// Bulgarian checksum, so an unconditional check would refuse to store a real customer's
    /// real passport number. An empty country counts as Bulgarian: the overwhelming majority
    /// of these customers are, and someone who leaves it blank while typing a foreign id has
    /// a one-word fix the error message can name.
    /// </summary>
    public static bool LooksBulgarian(string? country)
    {
        if (string.IsNullOrWhiteSpace(country)) return true;

        var value = country.Trim();
        return value.Equals("bg", StringComparison.OrdinalIgnoreCase)
            || value.Equals("bulgaria", StringComparison.OrdinalIgnoreCase)
            || value.Equals("българия", StringComparison.OrdinalIgnoreCase)
            || value.Equals("бг", StringComparison.OrdinalIgnoreCase);
    }
}
