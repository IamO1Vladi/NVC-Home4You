using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>
/// One row of the owner's "Factory Invoices and Payments" spreadsheet, as the XLSX-to-JSON
/// step emits it. Every field except the client's down payment is carried as the sheet's raw
/// text: the sheet mixes currencies, writes sums like "7700 + 150EURO", and dates several
/// ways, and a number read wrongly is worse than a string carried whole. The down payment is
/// the one value the panel does arithmetic on (left to pay), so it alone is parsed — and a
/// row whose payment cannot be read is refused rather than saved without its money.
/// </summary>
public sealed class PaymentsSheetRow
{
    public string? Factory { get; set; }
    public string? InvoiceNumber { get; set; }
    public string? FirstPayment { get; set; }
    public string? SecondPayment { get; set; }
    public string? TotalAmount { get; set; }
    public string? Product { get; set; }
    public string? ClientName { get; set; }
    public string? ClientDownPayment { get; set; }
    public string? FirstPaymentDate { get; set; }
    public string? Shipping { get; set; }
}

public sealed record PaymentsSheetImportResult(
    int Rows,
    List<string> FactoriesExisting,
    List<string> FactoriesCreated,
    List<string> CustomersSkipped,
    List<string> CustomersCreated,
    List<string> SimilarNames,
    List<string> Problems);

// Carries the owner's payments spreadsheet into Customers, Factories and Purchases.
//
// Everything is written THROUGH CustomerAdminService and FactoryAdminService rather than
// straight onto the context, so an imported row is indistinguishable from one typed into the
// panel: same validation, same audit trail, and — the part that cannot be reconstructed
// later — the first "placed" OrderStatusEvent on every new purchase.
//
// Idempotency: these tables have no natural key to an external sheet (unlike the Quickbase
// importers, which match on record id), so the match is the customer's NAME, normalised for
// case and spacing. A name already present is skipped whole — the panel owns that customer
// now, and a re-run must not stack a second copy of their purchase. The cost is that two
// genuinely different customers sharing an exact name would need the second one entered by
// hand; with full three-part Bulgarian names that is the smaller risk by far.
//
// The order-tracking columns (status, carrier, tracking reference) are deliberately NOT
// written even though the sheet holds container numbers — those columns belong to
// OrderTrackingService and every value lands in the purchase notes instead, verbatim, for
// staff to move onto the orders board through the door that writes history.
public sealed class PaymentsSheetImportService
{
    private readonly AppDbContext _db;
    private readonly CustomerAdminService _customers;
    private readonly FactoryAdminService _factories;

    public PaymentsSheetImportService(
        AppDbContext db, CustomerAdminService customers, FactoryAdminService factories)
    {
        _db = db;
        _customers = customers;
        _factories = factories;
    }

    public async Task<PaymentsSheetImportResult> ImportAsync(
        string jsonPath, bool dryRun, string? actor, string sourceNote, CancellationToken ct)
    {
        var problems = new List<string>();
        var rows = Load(jsonPath, problems);

        var result = new PaymentsSheetImportResult(
            rows.Count, new(), new(), new(), new(), new(), problems);

        // --- Factories: match on a punctuation-blind key, create the rest ---------------
        // The sheet spells one supplier "H E B E I ..." with a space between every letter;
        // folding to letters and digits only makes that, the tidy version, and any comma
        // variant the panel may already hold, the same factory.
        var factoriesInDb = await _db.Factories.AsNoTracking().ToListAsync(ct);
        var factoryIdByKey = factoriesInDb
            .GroupBy(f => FactoryKey(f.Name))
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var name in rows
                     .Select(r => (r.Factory ?? "").Trim())
                     .Where(n => n.Length > 0)
                     .GroupBy(FactoryKey)
                     .Select(g => g.First()))
        {
            var key = FactoryKey(name);
            if (factoryIdByKey.TryGetValue(key, out var existing))
            {
                result.FactoriesExisting.Add($"{name} = #{existing.Id} \"{existing.Name}\"");
                continue;
            }

            result.FactoriesCreated.Add(name);
            if (dryRun) continue;

            var created = await _factories.CreateAsync(new FactoryInput
            {
                Name = name,
                Country = "Китай",
                Notes = sourceNote,
            }, actor, ct);

            factoryIdByKey[key] = new Data.Entities.Factory { Id = created.Id, Name = created.Name };
        }

        // --- Customers: skip the present, create the absent -----------------------------
        var customersInDb = await _db.Customers.AsNoTracking()
            .Select(c => new { c.Id, c.Name, PurchaseCount = c.Purchases.Count })
            .ToListAsync(ct);
        var customersByKey = customersInDb
            .GroupBy(c => NameKey(c.Name))
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var row in rows)
        {
            var name = (row.ClientName ?? "").Trim();
            var key = NameKey(name);

            if (customersByKey.TryGetValue(key, out var present))
            {
                // A matched customer with NOTHING bought is the fingerprint of an aborted
                // run: CreateAsync commits the identity and the purchase in two saves, so a
                // failure between them leaves exactly this row behind. Skipping it quietly
                // would make the deposit unimportable by any number of re-runs — flag it
                // loudly instead. (It can also be a panel customer who genuinely has no
                // purchase yet; either way a person decides, the importer does not guess.)
                if (present.PurchaseCount == 0)
                {
                    problems.Add(
                        $"{name}: matches #{present.Id} \"{present.Name}\", which has NO " +
                        "purchases — possibly a half-created row from an aborted run. Add " +
                        "the purchase in the panel, or delete that customer and re-run.");
                    continue;
                }

                result.CustomersSkipped.Add(
                    $"{name} = #{present.Id} \"{present.Name}\" (покупки: {present.PurchaseCount})");
                continue;
            }

            // A partial sheet name ("Виолета") hiding inside a full stored one is worth a
            // human look, but only a warning: refusing to import on a shared first name
            // would silently drop real customers, and a wrongly created one is visible in
            // the panel and deletable.
            foreach (var candidate in customersInDb.Where(c =>
                         NameKey(c.Name) != key
                         && (NameKey(c.Name).Contains(key) || key.Contains(NameKey(c.Name)))))
            {
                result.SimilarNames.Add($"{name} ~ #{candidate.Id} \"{candidate.Name}\"");
            }

            var deposit = ParseEuroAmount(row.ClientDownPayment);
            if (deposit is null)
            {
                problems.Add(
                    $"{name}: down payment \"{row.ClientDownPayment}\" is not a EUR amount " +
                    "this importer can read — row not imported.");
                continue;
            }

            int? factoryId = null;
            var factoryName = (row.Factory ?? "").Trim();
            if (factoryName.Length > 0 && factoryIdByKey.TryGetValue(FactoryKey(factoryName), out var factory))
                factoryId = factory.Id;

            var product = AdminText.Clean(row.Product);
            var input = new CustomerInput
            {
                Type = Data.Entities.CustomerTypes.Person,
                Name = name,
                Purchases = new List<PurchaseInput>
                {
                    new()
                    {
                        FactoryId = factoryId,
                        CategoryKey = "container",
                        CustomModel = product is null ? null : $"Контейнер {product}",
                        DepositPaid = deposit,
                        Currency = "EUR",
                        Notes = BuildPurchaseNotes(row, sourceNote),
                    },
                },
            };

            var errors = CustomerAdminService.Validate(input);
            if (errors.Count > 0)
            {
                problems.Add($"{name}: {string.Join(" ", errors)} — row not imported.");
                continue;
            }

            if (!dryRun)
            {
                try
                {
                    await _customers.CreateAsync(input, actor, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // One row must not take the rest of the file down with it — but a failed
                    // save can leave its entities sitting in the change tracker, where the
                    // NEXT row's SaveChanges would try to insert them again. Clear first.
                    _db.ChangeTracker.Clear();
                    problems.Add($"{name}: save failed ({ex.GetBaseException().Message}) — " +
                                 "row not imported; later rows continue.");
                    continue;
                }
            }

            result.CustomersCreated.Add(
                $"{name} — {product ?? "?"}, капаро {deposit:0.##} EUR, завод " +
                (factoryId is int id ? $"#{id}" : dryRun ? "(нов)" : "(няма)"));
        }

        return result;
    }

    private static List<PaymentsSheetRow> Load(string jsonPath, List<string> problems)
    {
        SheetFile? file = null;
        try
        {
            file = JsonSerializer.Deserialize<SheetFile>(
                File.ReadAllText(jsonPath),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (Exception ex) when (ex is IOException or JsonException)
        {
            problems.Add($"Could not read {jsonPath}: {ex.Message}");
        }

        var rows = file?.Rows ?? new List<PaymentsSheetRow>();
        var usable = new List<PaymentsSheetRow>();
        for (var i = 0; i < rows.Count; i++)
        {
            if (AdminText.Clean(rows[i].ClientName) is null)
            {
                problems.Add($"Row {i + 1} has no client name — row not imported.");
                continue;
            }
            usable.Add(rows[i]);
        }

        // The same client twice in one file would import twice — the in-database check
        // cannot see the first copy until it is saved, so refuse the file instead.
        foreach (var dupe in usable
                     .GroupBy(r => NameKey(r.ClientName!))
                     .Where(g => g.Count() > 1))
        {
            problems.Add(
                $"\"{dupe.First().ClientName!.Trim()}\" appears {dupe.Count()} times in the " +
                "file — fix the file first; nothing was imported for this name.");
            usable.RemoveAll(r => NameKey(r.ClientName!) == dupe.Key);
        }

        return usable;
    }

    private sealed class SheetFile { public List<PaymentsSheetRow>? Rows { get; set; } }

    // Letters and digits only, lowercased — so casing, commas, "Ltd" dots and the
    // one-space-per-letter spelling all fold to the same supplier.
    internal static string FactoryKey(string name) =>
        new(name.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    // Case-blind, spacing-blind. Cyrillic lowercases fine under the invariant culture.
    internal static string NameKey(string name) =>
        string.Join(" ", name.ToLowerInvariant().Split(
            (char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    /// <summary>
    /// Reads the sheet's EUR spellings — "14 700.00 EURO", "12,500 EURO", "18 120.00 €",
    /// "9660EURO" — into a decimal. Null for anything else, INCLUDING dollar amounts and
    /// composite sums: a value this cannot read with certainty must block the row, not
    /// land as a wrong number on an invoice.
    /// </summary>
    internal static decimal? ParseEuroAmount(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (raw.Contains("USD", StringComparison.OrdinalIgnoreCase) || raw.Contains('$')) return null;

        var s = raw
            .Replace("EURO", "", StringComparison.OrdinalIgnoreCase)
            .Replace("EUR", "", StringComparison.OrdinalIgnoreCase)
            .Replace("€", "");
        s = new string(s.Where(c => !char.IsWhiteSpace(c)).ToArray());
        if (s.Length == 0 || s.Any(c => !char.IsAsciiDigit(c) && c != '.' && c != ',')) return null;

        if (s.Contains(',') && s.Contains('.'))
        {
            s = s.Replace(",", "");
        }
        else if (s.Contains(','))
        {
            // "12,500" is thousands; a comma not followed by exactly three digits at the
            // end would be a decimal comma. The sheet only writes the former, but check
            // rather than assume.
            var lastComma = s.LastIndexOf(',');
            s = s.Length - lastComma - 1 == 3 ? s.Replace(",", "") : s.Replace(',', '.');
        }

        return decimal.TryParse(s, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var v)
            && v > 0
                ? v
                : null;
    }

    // Everything factory-side lands here verbatim, labelled — the invoice number, both
    // payments, the container/tracking strings. See the class comment for why the tracking
    // columns themselves stay untouched.
    private static string BuildPurchaseNotes(PaymentsSheetRow row, string sourceNote)
    {
        var lines = new List<string>();
        void Add(string label, string? value)
        {
            if (AdminText.Clean(value) is string v) lines.Add($"{label}: {v}");
        }

        Add("Фактура от завода", row.InvoiceNumber);
        Add("Първо плащане към завода", row.FirstPayment);
        Add("Второ плащане към завода", row.SecondPayment);
        Add("Дата на плащане към завода", row.FirstPaymentDate);
        Add("Обща сума към завода", row.TotalAmount);
        Add("Спедиция/контейнер", row.Shipping);
        lines.Add(sourceNote);
        return string.Join("\n", lines);
    }
}
