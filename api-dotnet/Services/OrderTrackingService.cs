using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>
/// What the board writes: an order's progress, and nothing about its money.
/// </summary>
public sealed class OrderUpdateInput
{
    public string? Status { get; set; }
    public string? ExpectedAtHarbor { get; set; }
    public string? ExpectedReadyAt { get; set; }
    public string? CarrierName { get; set; }
    public string? TrackingReference { get; set; }
    public string? CarrierNote { get; set; }
}

/// <summary>
/// One order on the staff board — and the report the owner asked for, which is the same
/// row: customer, model, deposit, final price, left to pay, factory.
/// </summary>
public sealed record OrderRowDto(
    int PurchaseId,
    int CustomerId,
    string CustomerName,
    string? Model,
    string? CategoryKey,
    string? FactoryName,
    int Quantity,
    decimal? DepositPaid,
    decimal? FinalPrice,
    decimal? LeftToPay,
    string Currency,
    string Status,
    string? PurchasedAt,
    string? ExpectedAtHarbor,
    string? ExpectedReadyAt,
    string? CarrierName,
    string? TrackingReference,
    string? CarrierNote,
    string? CarrierCheckedAt,
    string? PublicReference);

/// <summary>
/// What the CUSTOMER sees at /order/{reference}.
///
/// Deliberately a different shape from OrderRowDto rather than the same record with fields
/// blanked: money, ЕГН, addresses and internal notes are not omitted here, they are
/// UNREACHABLE from here. A DTO that could carry a price is a DTO that one day does.
/// </summary>
public sealed record PublicOrderDto(
    string Reference,
    string Status,
    int Step,
    IReadOnlyList<string> Timeline,
    string? Model,
    string? ExpectedAtHarbor,
    string? ExpectedReadyAt,
    string? CarrierName,
    string? CarrierNote,
    string? CarrierCheckedAt,
    string? OrderedAt);

// Order tracking (ROADMAP #27): the staff board, the report, and the customer's own view.
public sealed class OrderTrackingService
{
    private readonly AppDbContext _db;

    public OrderTrackingService(AppDbContext db) => _db = db;

    // Same alphabet as SavedConfig: no l/I/1/0/O, because these codes get read aloud down a
    // phone and typed by people who did not choose them.
    private const string CodeAlphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 10;

    /// <summary>
    /// The board: every order, newest first, optionally filtered to one status.
    ///
    /// "delivered" and "cancelled" are INCLUDED rather than hidden — this doubles as the
    /// owner's report, and a report that silently drops finished business answers "what did
    /// we sell?" wrongly. The screen filters; the query does not decide for it.
    /// </summary>
    public async Task<List<OrderRowDto>> ListAsync(string? status, CancellationToken ct)
    {
        var query = _db.Purchases
            .AsNoTracking()
            .Include(p => p.Customer)
            .Include(p => p.Factory)
            .Include(p => p.House)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && OrderStatuses.IsValid(status))
            query = query.Where(p => p.Status == status);

        var rows = await query
            .OrderByDescending(p => p.PurchasedAt ?? p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync(ct);

        return rows.Select(ToRow).ToList();
    }

    /// <summary>
    /// Moves an order along. ORDER FIELDS ONLY — status, the two expected dates, and what
    /// the carrier last said.
    ///
    /// Deliberately not a general purchase writer: money and invoices are edited on the
    /// customer's own sheet, where the documents live, and a second endpoint that could
    /// also write a price would eventually be used to write one. The board says the money
    /// is read-only; this is what makes that true rather than a convention.
    /// </summary>
    public async Task<bool> UpdateOrderAsync(int purchaseId, OrderUpdateInput input, string? actor, CancellationToken ct)
    {
        var purchase = await _db.Purchases.FirstOrDefaultAsync(p => p.Id == purchaseId, ct);
        if (purchase is null) return false;

        // An unrecognised status is ignored, not stored: the public timeline draws from
        // this key, and a typo would render as no step at all on the customer's page.
        if (OrderStatuses.IsValid(input.Status)) purchase.Status = input.Status!;

        purchase.CarrierName = Clean(input.CarrierName);
        purchase.TrackingReference = Clean(input.TrackingReference);

        // The note and its timestamp move together, always. A note without a date is the
        // stale-information failure this feature exists to avoid; stamping it here means
        // "as of" is never something a person has to remember to update.
        var note = Clean(input.CarrierNote);
        if (note != purchase.CarrierNote)
        {
            purchase.CarrierNote = note;
            purchase.CarrierCheckedAt = note is null ? null : DateTimeOffset.UtcNow;
        }

        if (CustomerAdminService.TryParsePurchaseDate(input.ExpectedAtHarbor, out var atHarbor))
            purchase.ExpectedAtHarbor = atHarbor;
        if (CustomerAdminService.TryParsePurchaseDate(input.ExpectedReadyAt, out var readyAt))
            purchase.ExpectedReadyAt = readyAt;

        purchase.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// Mints the customer's tracking code, or returns the one already minted.
    ///
    /// ON DEMAND, never at creation: most purchases are recorded long before anyone wants
    /// to share a link, and a code that exists is a code that can leak. Idempotent, so the
    /// button can be pressed twice without handing out two links to one order — the second
    /// press returns the first code, which is also what makes it safe to put in an email
    /// template.
    /// </summary>
    public async Task<string?> EnsureReferenceAsync(int purchaseId, CancellationToken ct)
    {
        var purchase = await _db.Purchases.FirstOrDefaultAsync(p => p.Id == purchaseId, ct);
        if (purchase is null) return null;
        if (!string.IsNullOrWhiteSpace(purchase.PublicReference)) return purchase.PublicReference;

        // Collision is vanishingly unlikely at 56^10, but the unique index would turn one
        // into a failed save rather than a duplicate link — so retry a few times and then
        // lengthen, exactly as SavedConfigService does.
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var code = GenerateCode(CodeLength);
            if (!await _db.Purchases.AnyAsync(p => p.PublicReference == code, ct))
            {
                purchase.PublicReference = code;
                purchase.UpdatedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(ct);
                return code;
            }
        }

        purchase.PublicReference = GenerateCode(CodeLength + 4);
        purchase.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return purchase.PublicReference;
    }

    /// <summary>
    /// Withdraws the link. The order keeps its history; the URL simply stops resolving,
    /// which is the only remedy available when a link reaches the wrong inbox.
    /// </summary>
    public async Task<bool> RevokeReferenceAsync(int purchaseId, CancellationToken ct)
    {
        var purchase = await _db.Purchases.FirstOrDefaultAsync(p => p.Id == purchaseId, ct);
        if (purchase is null) return false;

        purchase.PublicReference = null;
        purchase.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// The customer's view, by code. Null for an unknown OR revoked code — the caller
    /// answers 404 either way, because distinguishing them tells a stranger which codes
    /// once existed.
    /// </summary>
    public async Task<PublicOrderDto?> PublicAsync(string? reference, CancellationToken ct)
    {
        var code = (reference ?? "").Trim();
        if (code.Length is < 6 or > 32) return null;

        var purchase = await _db.Purchases
            .AsNoTracking()
            .Include(p => p.House)
            .FirstOrDefaultAsync(p => p.PublicReference == code, ct);
        if (purchase is null) return null;

        return new PublicOrderDto(
            code,
            purchase.Status,
            OrderStatuses.StepOf(purchase.Status),
            OrderStatuses.Timeline,
            ModelOf(purchase),
            purchase.ExpectedAtHarbor?.ToString("yyyy-MM-dd"),
            purchase.ExpectedReadyAt?.ToString("yyyy-MM-dd"),
            // The carrier block is shown only while it means something — see
            // OrderStatuses.ShowsCarrier. A carrier name lingering on a delivered order is
            // clutter at best and a wrong answer at worst.
            OrderStatuses.ShowsCarrier(purchase.Status) ? purchase.CarrierName : null,
            OrderStatuses.ShowsCarrier(purchase.Status) ? purchase.CarrierNote : null,
            OrderStatuses.ShowsCarrier(purchase.Status) ? purchase.CarrierCheckedAt?.ToString("o") : null,
            purchase.PurchasedAt?.ToString("yyyy-MM-dd"));
    }

    /// <summary>
    /// What the thing IS, for a human: the catalogue title when it is a catalogue model,
    /// the typed description otherwise. Same fallback the customer sheet uses.
    /// </summary>
    private static string? ModelOf(Purchase p) =>
        !string.IsNullOrWhiteSpace(p.House?.Title) ? p.House!.Title : p.CustomModel;

    private static OrderRowDto ToRow(Purchase p) => new(
        p.Id,
        p.CustomerId,
        p.Customer?.Name ?? "",
        ModelOf(p),
        p.CategoryKey,
        p.Factory?.Name,
        p.Quantity,
        p.DepositPaid,
        p.FinalPrice,
        CustomerAdminService.LeftToPay(p.FinalPrice, p.DepositPaid),
        p.Currency,
        p.Status,
        p.PurchasedAt?.ToString("yyyy-MM-dd"),
        p.ExpectedAtHarbor?.ToString("yyyy-MM-dd"),
        p.ExpectedReadyAt?.ToString("yyyy-MM-dd"),
        p.CarrierName,
        p.TrackingReference,
        p.CarrierNote,
        p.CarrierCheckedAt?.ToString("o"),
        p.PublicReference);

    private static string GenerateCode(int length)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++)
            chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return new string(chars);
    }
}
