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
    string? PublicReference,
    // When somebody last moved this order along, and who. The board's answer to "has anyone
    // touched this in three weeks?", which on a hand-worked board is the question that
    // actually goes wrong — not a wrong status, a status nobody has looked at.
    //
    // Null for an order that predates OrderStatusEvent, or that has not moved since it was
    // recorded. Both read as "no move on file", which is the truth in either case.
    string? LastMovedAt,
    string? LastMovedBy,
    // When anybody last did anything to this order that counts as work: the last move, OR
    // the last time somebody rang the carrier and wrote down what they said.
    //
    // Separate from LastMovedAt because the two answer different questions and the board
    // needs both. An order sits in "travelling" for six weeks by design; the person minding
    // it updates the note every few days and never touches the status, so LastMovedAt alone
    // would badge the most diligently kept order on the screen as abandoned. "Has not moved"
    // and "nobody has been near this" are different problems, and only the second one is
    // worth interrupting somebody about.
    //
    // Computed on read from the two facts that already exist, never stored — same rule as
    // LeftToPay.
    string? LastTouchedAt);

/// <summary>
/// One dated step on the customer's timeline. Status is the key; the page translates it.
/// </summary>
public sealed record PublicOrderStepDto(string Status, string At);

/// <summary>
/// What the CUSTOMER sees at /order/{reference}.
///
/// Deliberately a different shape from OrderRowDto rather than the same record with fields
/// blanked: money, ЕГН, addresses and internal notes are not omitted here, they are
/// UNREACHABLE from here. A DTO that could carry a price is a DTO that one day does.
///
/// The same rule governs the fields added for the dated timeline: History carries WHEN each
/// step happened and never WHO moved it. Which member of staff pressed save is an office
/// fact, and the customer's tracking code is not a credential for office facts.
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
    string? OrderedAt,
    // The steps that actually happened, oldest first, each with the date it happened on.
    // Empty for an order that predates the history table — the page draws its steps undated
    // rather than being handed a date nobody observed. See OrderStatusEvent.
    IReadOnlyList<PublicOrderStepDto> History,
    // The photo of the thing they are waiting for, when it is a catalogue model. A product
    // photo, not customer data — the same image the gallery serves, resolved the same way.
    string? ImageUrl,
    // When something the customer can SEE last changed, so a page with no recent step can
    // still say that somebody has been here: the newest move on file, or the day the carrier
    // note was last confirmed, whichever is later.
    //
    // Deliberately NOT Purchase.UpdatedAt, which is stamped by every admin write to the row —
    // correcting a phone number on the customer's sheet re-stamps all of their purchases, and
    // minting or revoking the tracking link stamps it too. Handing that timestamp to a holder
    // of the code would report the rhythm of office activity on their record and announce
    // changes that did not happen, both of which this DTO says the code is not a credential
    // for. Null when neither fact exists, which is honest: nothing observable has happened.
    string? UpdatedAt);

/// <summary>
/// One row of an order's history, for the STAFF board — the same event the customer's
/// timeline draws from, plus the actor it withholds from them.
/// </summary>
public sealed record OrderHistoryDto(string Status, string ChangedAt, string? ChangedByUpn);

// Order tracking (ROADMAP #27): the staff board, the report, and the customer's own view.
public sealed class OrderTrackingService
{
    private readonly AppDbContext _db;
    private readonly ImageUrls _imageUrls;

    // ImageUrls rather than a stored URL, for the reason HouseImage gives: the row holds a
    // key, and who serves the bytes is decided at response time. The customer's page gets
    // its photo through exactly the same door as the gallery.
    public OrderTrackingService(AppDbContext db, ImageUrls imageUrls)
    {
        _db = db;
        _imageUrls = imageUrls;
    }

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

        var lastMoved = await LastMovedAsync(rows.Select(p => p.Id).ToList(), ct);

        return rows
            .Select(p => ToRow(p, lastMoved.TryGetValue(p.Id, out var moved) ? moved : null))
            .ToList();
    }

    /// <summary>
    /// The most recent status move for each of these orders, in ONE query.
    ///
    /// This is the screen somebody stares at all day, so the last-touched column must not
    /// cost a query per row — and it must not cost every row's whole history either, which
    /// is what ordering the events client-side would quietly do once the board holds a few
    /// hundred orders. "No later event exists for this purchase" asks the database for the
    /// one row per order that the answer needs, and walks the (PurchaseId, ChangedAt) index
    /// doing it.
    /// </summary>
    private async Task<Dictionary<int, (DateTimeOffset ChangedAt, string? ChangedByUpn)>> LastMovedAsync(
        List<int> purchaseIds, CancellationToken ct)
    {
        if (purchaseIds.Count == 0) return new();

        var latest = await _db.OrderStatusEvents
            .AsNoTracking()
            .Where(e => purchaseIds.Contains(e.PurchaseId))
            // Id breaks the tie, because two moves inside the same clock tick is a
            // double-click rather than a paradox, and the later insert is the later truth.
            .Where(e => !_db.OrderStatusEvents.Any(later =>
                later.PurchaseId == e.PurchaseId &&
                (later.ChangedAt > e.ChangedAt ||
                 (later.ChangedAt == e.ChangedAt && later.Id > e.Id))))
            .Select(e => new { e.PurchaseId, e.ChangedAt, e.ChangedByUpn })
            .ToListAsync(ct);

        return latest.ToDictionary(e => e.PurchaseId, e => (e.ChangedAt, e.ChangedByUpn));
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
        //
        // Only a REAL move is written to the history. Saving the carrier note on an order
        // that is still travelling re-submits the same status, and logging that would fill
        // the timeline with steps that did not happen — a log full of no-ops is a log staff
        // learn to skim, which costs exactly the question this table exists to answer.
        if (OrderStatuses.IsValid(input.Status) && input.Status != purchase.Status)
        {
            purchase.Status = input.Status!;
            _db.OrderStatusEvents.Add(new OrderStatusEvent
            {
                PurchaseId = purchase.Id,
                Status = purchase.Status,
                ChangedAt = DateTimeOffset.UtcNow,
                // Null is "the system did it" rather than a lost name — see OrderStatusEvent.
                ChangedByUpn = Clean(actor),
            });
        }

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

        var (steps, lastEventAt) = await TimelineAsync(purchase.Id, ct);

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
            purchase.PurchasedAt?.ToString("yyyy-MM-dd"),
            steps,
            await CoverImageUrlAsync(purchase.HouseId, ct),
            Newest(lastEventAt, purchase.CarrierCheckedAt)?.ToString("o"));
    }

    /// <summary>
    /// The dated steps for the customer's page, oldest first — and, alongside them, when the
    /// order last moved at all, which is the honest half of "somebody has been here".
    ///
    /// Two rules govern the steps, and both are about what the page is FOR. Cancelled never
    /// appears: it is off the timeline (see OrderStatuses) and the page renders it as its own
    /// state, so letting it in as a step would draw a cancelled order as though it were still
    /// moving. And when a status was set, undone and set again, the LATEST occurrence wins —
    /// the customer is reading "when did it get there", not an edit history of our board.
    ///
    /// The moves the steps discard still count as touches, which is why the last-moved moment
    /// is taken over EVERY event and the timeline filter is applied afterwards, in memory. An
    /// order's history is a handful of rows, so the whole of it is cheaper to read than a
    /// second query for the newest one.
    /// </summary>
    private async Task<(IReadOnlyList<PublicOrderStepDto> Steps, DateTimeOffset? LastEventAt)>
        TimelineAsync(int purchaseId, CancellationToken ct)
    {
        var events = await _db.OrderStatusEvents
            .AsNoTracking()
            .Where(e => e.PurchaseId == purchaseId)
            // Id breaks the tie for the same reason it does in LastMovedAsync: two events
            // inside one clock tick are a double-submit, and the later insert is the later
            // truth. It has to be carried through the projection as well, because the
            // regrouping below would otherwise decide those ties by group order instead.
            .OrderBy(e => e.ChangedAt).ThenBy(e => e.Id)
            .Select(e => new { e.Id, e.Status, e.ChangedAt })
            .ToListAsync(ct);

        var steps = events
            .Where(e => OrderStatuses.Timeline.Contains(e.Status))
            // Already oldest first, so the last of each group is that status's latest move.
            .GroupBy(e => e.Status)
            .Select(g => g.Last())
            .OrderBy(e => e.ChangedAt).ThenBy(e => e.Id)
            .Select(e => new PublicOrderStepDto(e.Status, e.ChangedAt.ToString("o")))
            .ToList();

        return (steps, events.Count == 0 ? null : events[^1].ChangedAt);
    }

    /// <summary>
    /// The catalogue photo of what they bought, or null when there is no catalogue model —
    /// a custom build has nothing to show, and a placeholder would be a picture of the wrong
    /// house. Cover is the first image in the house's own order, which is the same rule the
    /// gallery uses, resolved through ImageUrls so the URL follows the current configuration
    /// rather than a second one invented here.
    /// </summary>
    private async Task<string?> CoverImageUrlAsync(int? houseId, CancellationToken ct)
    {
        if (houseId is null) return null;

        var key = await _db.HouseImages
            .AsNoTracking()
            .Where(i => i.HouseId == houseId.Value)
            .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
            .Select(i => i.ImageKey)
            .FirstOrDefaultAsync(ct);

        return _imageUrls.ForKey(key);
    }

    /// <summary>
    /// An order's full history for the board, newest first — every move, including cancelled
    /// ones, and including who made each. Null when the purchase does not exist, so the
    /// controller can tell "no such order" from "an order nobody has moved yet", which reads
    /// as an empty list.
    /// </summary>
    public async Task<List<OrderHistoryDto>?> HistoryAsync(int purchaseId, CancellationToken ct)
    {
        if (!await _db.Purchases.AnyAsync(p => p.Id == purchaseId, ct)) return null;

        var events = await _db.OrderStatusEvents
            .AsNoTracking()
            .Where(e => e.PurchaseId == purchaseId)
            .OrderByDescending(e => e.ChangedAt).ThenByDescending(e => e.Id)
            .Select(e => new { e.Status, e.ChangedAt, e.ChangedByUpn })
            .ToListAsync(ct);

        return events
            .Select(e => new OrderHistoryDto(e.Status, e.ChangedAt.ToString("o"), e.ChangedByUpn))
            .ToList();
    }

    /// <summary>
    /// What the thing IS, for a human: the catalogue title when it is a catalogue model,
    /// the typed description otherwise. Same fallback the customer sheet uses.
    /// </summary>
    private static string? ModelOf(Purchase p) =>
        !string.IsNullOrWhiteSpace(p.House?.Title) ? p.House!.Title : p.CustomModel;

    private static OrderRowDto ToRow(
        Purchase p, (DateTimeOffset ChangedAt, string? ChangedByUpn)? lastMoved) => new(
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
        p.PublicReference,
        lastMoved?.ChangedAt.ToString("o"),
        lastMoved?.ChangedByUpn,
        Newest(lastMoved?.ChangedAt, p.CarrierCheckedAt)?.ToString("o"));

    // The later of two moments, either of which may never have happened.
    private static DateTimeOffset? Newest(DateTimeOffset? a, DateTimeOffset? b) =>
        a is null ? b : b is null ? a : (a > b ? a : b);

    private static string GenerateCode(int length)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++)
            chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return new string(chars);
    }
}
