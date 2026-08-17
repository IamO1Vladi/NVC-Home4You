using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>One thing bought, as the panel submits it. Id 0 means "new".</summary>
public sealed class PurchaseInput
{
    public int Id { get; set; }
    public int? FactoryId { get; set; }
    public string? CategoryKey { get; set; }
    public int? HouseId { get; set; }
    public string? CustomModel { get; set; }
    public decimal? DepositPaid { get; set; }
    public decimal? FinalPrice { get; set; }
    public string? Currency { get; set; }

    // "YYYY-MM-DD" from <input type="date">. Parsed by TryParsePurchaseDate.
    public string? PurchasedAt { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// A customer and everything they bought, as one submission.
///
/// Purchases ride along with the customer rather than living behind their own endpoints,
/// because the panel presents them as one form with one Save button. Splitting them would
/// mean a half-saved customer whenever the second request failed — a person recorded with
/// their identity but not their deposit.
/// </summary>
public sealed class CustomerInput
{
    public string Type { get; set; } = CustomerTypes.Person;
    public string? Eik { get; set; }
    public string? PersonalId { get; set; }
    public string Name { get; set; } = "";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Country { get; set; }
    public string? Notes { get; set; }
    public int? LeadId { get; set; }

    // Absent (null) and empty are DIFFERENT. Null means "this submission is not about
    // purchases, leave them alone"; an empty list means "this customer has none, delete what
    // is there". Treating the two the same would make any caller that omits the field wipe
    // the sales history.
    public List<PurchaseInput>? Purchases { get; set; }
}

/// <summary>
/// A customer as the list shows them.
///
/// NO PersonalId. The list is fetched every time the page opens, so putting an ЕГН in it
/// would mean the most sensitive column in the database travelling over the wire, and
/// sitting in browser memory, for every row on screen — to render a column nobody reads at
/// a glance. It is on the detail record, which is fetched when somebody opens one customer
/// on purpose.
/// </summary>
public sealed record CustomerSummaryDto(
    int Id,
    string Type,
    string Name,
    string? Eik,
    string? Phone,
    string? Email,
    string? Country,
    int PurchaseCount,
    string? ModelLabel,
    decimal? TotalFinalPrice,
    decimal? TotalDeposit,
    decimal? TotalLeftToPay,
    string? Currency,
    string CreatedAt);

public sealed record CustomerDetailDto(
    int Id,
    string Type,
    string? Eik,
    string? PersonalId,
    string Name,
    string? Phone,
    string? Email,
    string? Address,
    string? Country,
    string? Notes,
    int? LeadId,
    string? LeadName,
    string CreatedAt,
    string? UpdatedAt,
    string? UpdatedByUpn,
    List<PurchaseDto> Purchases);

public sealed record PurchaseDto(
    int Id,
    int? FactoryId,
    string? FactoryName,
    string? CategoryKey,
    int? HouseId,
    string? HouseTitle,
    string? CustomModel,
    decimal? DepositPaid,
    decimal? FinalPrice,

    // Derived, never stored — see the note on Purchase. Sent anyway so the list and the
    // detail view cannot disagree about the arithmetic.
    decimal? LeftToPay,
    string Currency,
    string? PurchasedAt,
    string? Notes,
    List<PurchaseFileDto> Files);

public sealed record PurchaseFileDto(
    int Id,
    string Kind,
    string FileName,
    string? ContentType,
    long SizeBytes,

    // Deliberately no blob key. Files are fetched through an authenticated endpoint by row
    // id, because an invoice carries a name, an address and an ЕГН.
    string DownloadUrl,
    string CreatedAt);

// CRUD for customers, their purchases, and the link out to the supplier directory.
//
// Everything here is behind AdminOnly at the controller. Nothing in this file writes an
// identifier to a log line.
public sealed class CustomerAdminService
{
    private readonly AppDbContext _db;

    public CustomerAdminService(AppDbContext db) => _db = db;

    // --- Reading ----------------------------------------------------------------------

    /// <summary>
    /// The customer list, newest first, optionally narrowed by a search box.
    ///
    /// The search covers name, phone, email and ЕИК — the four things somebody has in front
    /// of them when they are looking a customer up.
    ///
    /// It does NOT cover PersonalId, and that omission is load-bearing rather than an
    /// oversight. The term arrives in a query string, and a URL survives in logs and browser
    /// history long after the response is gone; the moment an ЕГН becomes a working lookup
    /// key is the moment people start putting one there. Pinned by
    /// CustomerStoreTests.Search_never_matches_a_personal_id.
    /// </summary>
    public async Task<List<CustomerSummaryDto>> ListAsync(string? search, CancellationToken ct)
    {
        var query = _db.Customers
            .AsNoTracking()
            .Include(c => c.Purchases).ThenInclude(p => p.House)
            .AsQueryable();

        var term = AdminText.Clean(search);
        if (term is not null)
        {
            query = query.Where(c =>
                c.Name.Contains(term)
                || (c.Phone != null && c.Phone.Contains(term))
                || (c.Email != null && c.Email.Contains(term))
                || (c.Eik != null && c.Eik.Contains(term)));
        }

        var customers = await query
            .OrderByDescending(c => c.CreatedAt)
            .ThenByDescending(c => c.Id)
            .ToListAsync(ct);

        return customers.Select(ToSummary).ToList();
    }

    public async Task<CustomerDetailDto?> GetAsync(int id, CancellationToken ct)
    {
        var customer = await _db.Customers
            .AsNoTracking()
            .Include(c => c.Lead)
            .Include(c => c.Purchases).ThenInclude(p => p.House)
            .Include(c => c.Purchases).ThenInclude(p => p.Factory)
            .Include(c => c.Purchases).ThenInclude(p => p.Files)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        return customer is null ? null : ToDetail(customer);
    }

    // --- Writing ----------------------------------------------------------------------

    public async Task<CustomerDetailDto> CreateAsync(CustomerInput input, string? actor, CancellationToken ct)
    {
        var customer = new Customer { CreatedAt = DateTimeOffset.UtcNow };
        Apply(customer, input, actor);

        _db.Customers.Add(customer);
        await _db.SaveChangesAsync(ct);

        if (input.Purchases is not null)
        {
            await SyncPurchasesAsync(customer.Id, input.Purchases, ct);
        }

        return (await GetAsync(customer.Id, ct))!;
    }

    public async Task<CustomerDetailDto?> UpdateAsync(int id, CustomerInput input, string? actor, CancellationToken ct)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return null;

        Apply(customer, input, actor);
        await _db.SaveChangesAsync(ct);

        if (input.Purchases is not null)
        {
            await SyncPurchasesAsync(id, input.Purchases, ct);
        }

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Removes a customer and everything hanging off them.
    ///
    /// Purchases and file ROWS go with it, by cascade. The blob objects are deliberately
    /// left behind — same decision as GalleryAdminService and the lead attachments: storage
    /// is cheap, and a delete that reaches into object storage is the one that cannot be
    /// undone when it turns out to have been the wrong row.
    /// </summary>
    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return false;

        _db.Customers.Remove(customer);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Brings the stored purchases in line with what was submitted.
    ///
    /// Matched on id: rows that came back are updated, rows with no id are new, and rows the
    /// panel no longer sends are gone. Deleting by omission is safe here only because
    /// CustomerInput.Purchases distinguishes "not mentioned" (null) from "none" (empty) —
    /// see the note there.
    /// </summary>
    private async Task SyncPurchasesAsync(int customerId, List<PurchaseInput> submitted, CancellationToken ct)
    {
        var existing = await _db.Purchases
            .Where(p => p.CustomerId == customerId)
            .ToListAsync(ct);

        var keptIds = submitted.Where(p => p.Id > 0).Select(p => p.Id).ToHashSet();

        foreach (var gone in existing.Where(p => !keptIds.Contains(p.Id)))
        {
            _db.Purchases.Remove(gone);
        }

        foreach (var input in submitted)
        {
            var purchase = input.Id > 0
                ? existing.FirstOrDefault(p => p.Id == input.Id)
                : null;

            // An id that is not this customer's is treated as a new row rather than an
            // error. The alternative is letting one customer's form reach into another's
            // purchase by guessing a number.
            if (purchase is null)
            {
                purchase = new Purchase { CustomerId = customerId, CreatedAt = DateTimeOffset.UtcNow };
                _db.Purchases.Add(purchase);
            }

            Apply(purchase, input);
        }

        await _db.SaveChangesAsync(ct);
    }

    // --- Validation -------------------------------------------------------------------

    /// <summary>
    /// Everything wrong with a submitted customer, checked before anything is written.
    ///
    /// The identifier rules are the substance here. Both are checksum-bearing numbers that
    /// end up on an invoice, so a transposed digit is caught now rather than by an
    /// accountant later — but neither is REQUIRED, because a customer whose ЕИК has not been
    /// sent through yet is still a customer, and a form that refuses to save is a form that
    /// gets "000000000" typed into it.
    /// </summary>
    public static List<string> Validate(CustomerInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (!CustomerTypes.IsValid(input.Type))
            errors.Add("A customer is either a person or a company.");

        if (string.IsNullOrWhiteSpace(input.Name)) errors.Add("A name is required.");
        else if (input.Name.Trim().Length > 200) errors.Add("That name is too long.");

        if (!string.IsNullOrWhiteSpace(input.Email) && !input.Email.Contains('@'))
            errors.Add("That does not look like an email address.");

        var eik = Digits(input.Eik);
        if (eik is not null)
        {
            if (!BulgarianIdentifiers.LooksLikeEik(eik))
                errors.Add("An ЕИК is 9 or 13 digits.");
            else if (!BulgarianIdentifiers.IsValidEik(eik))
                errors.Add("That ЕИК does not check out — one of the digits is wrong.");
        }
        else if (!string.IsNullOrWhiteSpace(input.Eik))
        {
            errors.Add("An ЕИК is digits only.");
        }

        var personalId = AdminText.Clean(input.PersonalId);

        // The ЕГН checksum runs only for a Bulgarian customer. A foreign buyer's identity
        // number can be ten digits and will not satisfy it, and refusing to store a real
        // passport number to enforce a Bulgarian rule is the worse failure — see
        // BulgarianIdentifiers.LooksBulgarian.
        if (personalId is not null
            && BulgarianIdentifiers.LooksBulgarian(input.Country)
            && BulgarianIdentifiers.LooksLikeEgn(personalId)
            && !BulgarianIdentifiers.IsValidEgn(personalId))
        {
            errors.Add(
                "That ЕГН does not check out — one of the digits is wrong. " +
                "If it is a foreign identity number, set the country first.");
        }

        foreach (var purchase in input.Purchases ?? new List<PurchaseInput>())
        {
            errors.AddRange(ValidatePurchase(purchase));
        }

        return errors;
    }

    private static IEnumerable<string> ValidatePurchase(PurchaseInput purchase)
    {
        if (!string.IsNullOrWhiteSpace(purchase.CategoryKey)
            && !PurchaseCategories.IsValid(purchase.CategoryKey))
        {
            yield return $"'{purchase.CategoryKey}' is not one of the things we sell.";
        }

        // Refused rather than absorbed: a modular purchase pointing at a catalogue row is a
        // claim that what shipped matches that row, and it does not. See
        // PurchaseCategories.WithGalleryModels.
        if (purchase.HouseId is > 0 && !PurchaseCategories.AllowsGalleryModel(purchase.CategoryKey))
        {
            yield return
                "A modular house is a custom build — describe it in the free-text field " +
                "rather than linking a catalogue model.";
        }

        if (purchase.DepositPaid is < 0) yield return "A deposit cannot be negative.";
        if (purchase.FinalPrice is < 0) yield return "A price cannot be negative.";

        // A warning would be ignored; this is arithmetic that produces a negative "left to
        // pay" and a customer conversation about a refund nobody meant to promise.
        if (purchase.DepositPaid is > 0 && purchase.FinalPrice is > 0
            && purchase.DepositPaid > purchase.FinalPrice)
        {
            yield return "The deposit is larger than the final price.";
        }

        if (!TryParsePurchaseDate(purchase.PurchasedAt, out _))
            yield return "That is not a date we can read.";
    }

    /// <summary>Whether a house exists, for the "is this model real?" check.</summary>
    public Task<bool> HouseExistsAsync(int houseId, CancellationToken ct) =>
        _db.Houses.AnyAsync(h => h.Id == houseId, ct);

    /// <summary>Whether a factory exists, same purpose.</summary>
    public Task<bool> FactoryExistsAsync(int factoryId, CancellationToken ct) =>
        _db.Factories.AnyAsync(f => f.Id == factoryId, ct);

    /// <summary>
    /// Other customers already carrying this ЕИК or ЕГН, so the panel can ask "did you mean
    /// the existing one?".
    ///
    /// A warning, never a block, and the database has no unique index for the same reason: a
    /// company that buys through two branches is one ЕИК twice, and a hard constraint turns
    /// a mistyped digit into a save that fails without saying which row it hit.
    /// </summary>
    public async Task<string?> FindDuplicateAsync(CustomerInput input, int? exceptId, CancellationToken ct)
    {
        var skip = exceptId ?? 0;

        var eik = Digits(input.Eik);
        if (eik is not null)
        {
            var match = await _db.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id != skip && c.Eik == eik, ct);
            if (match is not null) return match.Name;
        }

        var personalId = AdminText.Clean(input.PersonalId);
        if (personalId is not null)
        {
            var match = await _db.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id != skip && c.PersonalId == personalId, ct);
            if (match is not null) return match.Name;
        }

        return null;
    }

    /// <summary>
    /// Reads a "YYYY-MM-DD" from the panel into midnight UTC.
    ///
    /// Same treatment as Lead.NextContactAt: a purchase is dated in days, and keeping a time
    /// component would make "which sales were in July?" depend on who is asking and from
    /// where. Blank parses successfully to null — clearing a date is a legitimate edit.
    /// </summary>
    public static bool TryParsePurchaseDate(string? raw, out DateTimeOffset? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(raw)) return true;

        if (!DateTime.TryParse(
                raw, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var parsed))
        {
            return false;
        }

        value = new DateTimeOffset(parsed.Date, TimeSpan.Zero);
        return true;
    }

    /// <summary>
    /// What is still owed: the agreed price less whatever has come in.
    ///
    /// Null when there is no agreed price, because "nothing outstanding" and "we have not
    /// settled on a number" are different answers and only one of them is good news. A null
    /// deposit counts as zero here — nothing paid means all of it is outstanding.
    /// </summary>
    public static decimal? LeftToPay(decimal? finalPrice, decimal? depositPaid) =>
        finalPrice is null ? null : finalPrice.Value - (depositPaid ?? 0m);

    // --- Mapping ----------------------------------------------------------------------

    private void Apply(Customer customer, CustomerInput input, string? actor)
    {
        customer.Type = input.Type;
        customer.Name = input.Name.Trim();
        customer.Phone = AdminText.Clean(input.Phone);
        customer.Email = AdminText.Clean(input.Email);
        customer.Address = AdminText.Clean(input.Address);
        customer.Country = AdminText.Clean(input.Country);
        customer.Notes = AdminText.Clean(input.Notes);
        customer.LeadId = input.LeadId is > 0 ? input.LeadId : null;

        // Only the identifier that belongs to the type is kept. Switching a customer from
        // company to person otherwise leaves the ЕИК behind as a value nothing on the form
        // shows and nothing will ever correct.
        customer.Eik = input.Type == CustomerTypes.Company ? Digits(input.Eik) : null;
        customer.PersonalId = input.Type == CustomerTypes.Person
            ? AdminText.Clean(input.PersonalId)
            : null;

        customer.UpdatedAt = DateTimeOffset.UtcNow;
        customer.UpdatedByUpn = actor;
    }

    private static void Apply(Purchase purchase, PurchaseInput input)
    {
        purchase.FactoryId = input.FactoryId is > 0 ? input.FactoryId : null;
        purchase.CategoryKey = AdminText.Clean(input.CategoryKey);

        // A model only survives on a category that can carry one — the same rule validation
        // refuses, applied again here so a category changed after the fact cannot leave a
        // stale foreign key pointing at a house this purchase is not.
        purchase.HouseId = input.HouseId is > 0 && PurchaseCategories.AllowsGalleryModel(input.CategoryKey)
            ? input.HouseId
            : null;

        purchase.CustomModel = AdminText.Clean(input.CustomModel);
        purchase.DepositPaid = input.DepositPaid;
        purchase.FinalPrice = input.FinalPrice;
        purchase.Currency = AdminText.Clean(input.Currency) ?? "EUR";
        purchase.Notes = AdminText.Clean(input.Notes);

        if (TryParsePurchaseDate(input.PurchasedAt, out var purchasedAt))
        {
            purchase.PurchasedAt = purchasedAt;
        }

        purchase.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static CustomerSummaryDto ToSummary(Customer customer)
    {
        var purchases = customer.Purchases;

        // Totals only when every purchase is in the same currency. Adding 20 000 EUR to
        // 5 000 BGN produces a number that is wrong in a way nobody spots, so the honest
        // answer for a mixed customer is no number at all — the detail view shows each
        // purchase in its own currency.
        var currencies = purchases
            .Select(p => p.Currency)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct()
            .ToList();

        var single = currencies.Count == 1 ? currencies[0] : null;
        var comparable = single is not null;

        return new CustomerSummaryDto(
            customer.Id,
            customer.Type,
            customer.Name,
            customer.Eik,
            customer.Phone,
            customer.Email,
            customer.Country,
            purchases.Count,
            ModelLabel(purchases),
            comparable ? Sum(purchases, p => p.FinalPrice) : null,
            comparable ? Sum(purchases, p => p.DepositPaid) : null,
            comparable
                ? Sum(purchases, p => LeftToPay(p.FinalPrice, p.DepositPaid))
                : null,
            single,
            customer.CreatedAt.ToString("o"));
    }

    // Null when nothing in the set carries a value, rather than 0 — "no prices recorded"
    // and "the total is zero" are different facts.
    private static decimal? Sum(List<Purchase> purchases, Func<Purchase, decimal?> pick)
    {
        var values = purchases.Select(pick).Where(v => v.HasValue).Select(v => v!.Value).ToList();
        return values.Count == 0 ? null : values.Sum();
    }

    // What the list column says they bought: the first purchase, plus a count of the rest.
    // The alternative is a cell holding four model names, which is unreadable at list width.
    private static string? ModelLabel(List<Purchase> purchases)
    {
        if (purchases.Count == 0) return null;

        var first = purchases
            .OrderByDescending(p => p.PurchasedAt ?? p.CreatedAt)
            .First();

        var label = first.House?.Title
            ?? AdminText.Clean(first.CustomModel)
            ?? first.CategoryKey;

        if (label is null) return null;
        return purchases.Count > 1 ? $"{label} +{purchases.Count - 1}" : label;
    }

    private static CustomerDetailDto ToDetail(Customer customer) => new(
        customer.Id,
        customer.Type,
        customer.Eik,
        customer.PersonalId,
        customer.Name,
        customer.Phone,
        customer.Email,
        customer.Address,
        customer.Country,
        customer.Notes,
        customer.LeadId,
        customer.Lead?.Name,
        customer.CreatedAt.ToString("o"),
        customer.UpdatedAt?.ToString("o"),
        customer.UpdatedByUpn,
        customer.Purchases
            .OrderByDescending(p => p.PurchasedAt ?? p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .Select(ToDto)
            .ToList());

    private static PurchaseDto ToDto(Purchase purchase) => new(
        purchase.Id,
        purchase.FactoryId,
        purchase.Factory?.Name,
        purchase.CategoryKey,
        purchase.HouseId,
        purchase.House?.Title,
        purchase.CustomModel,
        purchase.DepositPaid,
        purchase.FinalPrice,
        LeftToPay(purchase.FinalPrice, purchase.DepositPaid),
        purchase.Currency,

        // Date only. The panel puts it straight into <input type="date">, which cannot read
        // anything else, and the stored value has no meaningful time component anyway.
        purchase.PurchasedAt?.ToString("yyyy-MM-dd"),
        purchase.Notes,
        purchase.Files
            .OrderBy(f => f.CreatedAt)
            .Select(f => new PurchaseFileDto(
                f.Id,
                f.Kind,
                f.FileName,
                f.ContentType,
                f.SizeBytes,
                $"/api/admin/customers/files/{f.Id}",
                f.CreatedAt.ToString("o")))
            .ToList());

    // Digits only, so "831 919 995" and "831919995" are the same value. Null when the
    // input holds anything else at all — a letter in an ЕИК is a mistake worth reporting,
    // not something to quietly strip.
    private static string? Digits(string? value)
    {
        var trimmed = (value ?? "").Where(c => !char.IsWhiteSpace(c)).ToArray();
        if (trimmed.Length == 0) return null;
        return trimmed.All(char.IsAsciiDigit) ? new string(trimmed) : null;
    }
}
