using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Services;

/// <summary>
/// The read side of the pipeline: the board, and one lead with its thread.
///
/// Separate from LeadService, which owns the writes. The split is not ceremony — the read
/// projections need Include chains and DTO shaping that have nothing to do with the rules
/// about how a lead may change, and mixing them made LeadService hard to read.
/// </summary>
public class LeadPipelineService
{
    private readonly AppDbContext _db;

    public LeadPipelineService(AppDbContext db)
    {
        _db = db;
    }

    // Same ceiling as the enquiry queue: high enough never to truncate in practice,
    // capped so a runaway table cannot take the page down.
    private const int MaxRows = 1000;

    /// <summary>
    /// How long a Won or Lost deal stays on the working board before it archives itself.
    /// </summary>
    public static readonly TimeSpan ArchiveAfter = TimeSpan.FromDays(3);

    /// <summary>
    /// The board. Optionally narrowed to one status, or to the open stages only.
    /// </summary>
    public async Task<List<LeadSummaryDto>> ListAsync(string? status, string? ownerUpn, CancellationToken ct)
    {
        var query = _db.Leads.AsNoTracking().Include(l => l.House).AsQueryable();

        // A deal that has been Won or Lost for more than this drops off the board. Won and
        // Lost are not "done" the moment they are set — there is usually paperwork, a
        // deposit, a polite last email — so it stays visible for a few days and then gets
        // out of the way on its own. Nothing deletes it; the archive view still has it.
        var archivedBefore = DateTimeOffset.UtcNow - ArchiveAfter;

        if (string.IsNullOrWhiteSpace(status) || status.Equals("open", StringComparison.OrdinalIgnoreCase))
        {
            // "open" is the useful default view — everything still in play. Spelling it as
            // a pseudo-status keeps the caller from having to list four stages.
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(l => LeadStatuses.Open.Contains(l.Status));
            else
                // No filter at all still means "the working board": recently closed deals
                // are included, long-closed ones are not. Someone asking for everything
                // wants what they are working on, not two years of history.
                query = query.Where(l => l.ClosedAt == null || l.ClosedAt > archivedBefore);
        }
        else if (status.Equals("archived", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(l => l.ClosedAt != null && l.ClosedAt <= archivedBefore);
        }
        else if (LeadStatuses.IsValid(status))
        {
            query = query.Where(l => l.Status == status);
        }
        else
        {
            // An unrecognised status narrows to nothing rather than silently listing
            // everything, which would look like the filter worked.
            return new List<LeadSummaryDto>();
        }

        if (!string.IsNullOrWhiteSpace(ownerUpn))
            query = query.Where(l => l.OwnerUpn == ownerUpn);

        // Quietest first: the lead nobody has touched is the one at risk, and
        // newest-first would bury it under today's activity. Nulls (nothing has happened
        // yet) sort to the very top for the same reason.
        var leads = await query
            .OrderBy(l => l.LastActivityAt ?? DateTimeOffset.MinValue)
            .Take(MaxRows)
            .ToListAsync(ct);

        var ids = leads.Select(l => l.Id).ToList();
        var counts = await _db.LeadActivities
            .AsNoTracking()
            .Where(a => ids.Contains(a.LeadId))
            .GroupBy(a => a.LeadId)
            .Select(g => new { LeadId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.LeadId, x => x.Count, ct);

        return leads.Select(l => new LeadSummaryDto
        {
            Id = l.Id,
            Name = l.Name,
            Status = l.Status,
            OwnerUpn = l.OwnerUpn ?? "",
            ModelLabel = ModelLabel(l),
            NextStep = l.NextStep ?? "",
            CreatedAt = Iso(l.CreatedAt),
            LastActivityAt = l.LastActivityAt is null ? null : Iso(l.LastActivityAt.Value),
            ActivityCount = counts.TryGetValue(l.Id, out var n) ? n : 0,
        }).ToList();
    }

    /// <summary>
    /// One lead and its whole thread, oldest first. Null when there is no such lead.
    /// </summary>
    public async Task<LeadDetailDto?> GetAsync(int id, CancellationToken ct)
    {
        var lead = await _db.Leads
            .AsNoTracking()
            .Include(l => l.House)
            .FirstOrDefaultAsync(l => l.Id == id, ct);

        if (lead is null) return null;

        // The whole thread, not a window: the drafting context trims to fit a prompt, but
        // a person reading the history needs all of it.
        var activities = await _db.LeadActivities
            .AsNoTracking()
            .Where(a => a.LeadId == id)
            .Include(a => a.Attachments)
            .OrderBy(a => a.OccurredAt)
            .ThenBy(a => a.Id)          // stable within a second, so the order never jitters
            .ToListAsync(ct);

        return new LeadDetailDto
        {
            Id = lead.Id,
            Name = lead.Name,
            Email = lead.Email ?? "",
            Phone = lead.Phone ?? "",
            Status = lead.Status,
            OwnerUpn = lead.OwnerUpn ?? "",
            Locale = lead.Locale ?? "",
            Country = lead.Country ?? "",
            CustomerAddress = lead.CustomerAddress ?? "",
            BuildLocation = lead.BuildLocation ?? "",
            ProjectName = lead.ProjectName ?? "",
            NextStep = lead.NextStep ?? "",
            Notes = lead.Notes ?? "",
            HouseId = lead.HouseId,
            HouseTitle = lead.House?.Title ?? "",
            CustomModel = lead.CustomModel ?? "",
            OfferId = lead.OfferId,
            QuestionId = lead.QuestionId,
            CreatedAt = Iso(lead.CreatedAt),
            LastActivityAt = lead.LastActivityAt is null ? null : Iso(lead.LastActivityAt.Value),
            Activities = activities.Select(ToDto).ToList(),
        };
    }

    private static LeadActivityDto ToDto(LeadActivity a) => new()
    {
        Id = a.Id,
        Type = a.Type,
        Subject = a.Subject ?? "",
        Body = a.Body,
        ActorUpn = a.ActorUpn ?? "",

        // Derived here rather than left to the panel to infer from an empty string.
        // "Which side said this" decides the entire chat layout, and a null check spread
        // across JSX is the kind of thing that ends up inconsistent between views.
        FromCustomer = a.ActorUpn is null,

        OccurredAt = Iso(a.OccurredAt),
        Attachments = a.Attachments.Select(f => new LeadAttachmentDto
        {
            Id = f.Id,
            FileName = f.FileName,
            ContentType = f.ContentType ?? "",
            SizeBytes = f.SizeBytes,
            DownloadUrl = $"/api/admin/pipeline/attachments/{f.Id}",
        }).ToList(),
    };

    private static string ModelLabel(Lead lead)
    {
        if (lead.House is { } house) return house.Title;
        return lead.CustomModel ?? "";
    }

    private static string Iso(DateTimeOffset value) =>
        value.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
}
