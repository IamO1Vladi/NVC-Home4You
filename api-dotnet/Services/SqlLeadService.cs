using System;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.Extensions.Logging;
using Models;

namespace Services;

// SQL implementation of ILeadStore. Selected by DATA_SOURCE_LEADS=sql, and used as the
// secondary store during dual-write while Quickbase is still authoritative.
//
// Both writes catch rather than throw. When this store is the authoritative one the
// controller turns a failed result into a 502; when it is the dual-write shadow, a
// failure must not take down a lead that Quickbase already accepted.
public class SqlLeadService : ILeadStore
{
    private readonly AppDbContext _db;
    private readonly ILogger<SqlLeadService> _logger;

    public SqlLeadService(AppDbContext db, ILogger<SqlLeadService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<LeadWriteResult> CreateOfferAsync(OfferDto dto, CancellationToken ct = default)
    {
        try
        {
            var entity = new Offer
            {
                Name = Trim(dto.Name, 200) ?? "",
                Email = Trim(dto.Email, 320),
                Phone = Trim(dto.Phone, 64),
                // The model a gallery enquiry is about goes in front of the customer's words,
                // where the truncation below cannot reach it. That puts it on every staff
                // screen that shows the message — the Enquiries list and its search, the
                // lead thread's first message, the drafted reply's context — without a
                // column or a migration. Only the stored copy changes: the autoresponder
                // still echoes dto.Project, the customer's own text.
                Message = Trim(OfferModel.WithModelLine(OfferModel.From(dto), dto.Project), 4000),
                ModelId = Trim(dto.ModelId, 100),
                Locale = Trim(dto.Locale, 10),
                CreatedAt = DateTimeOffset.UtcNow,
            };

            _db.Offers.Add(entity);
            await _db.SaveChangesAsync(ct);
            return LeadWriteResult.Succeeded(entity.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write an offer from {Email} to SQL.", dto.Email);
            return LeadWriteResult.Failed(ex.Message);
        }
    }

    public async Task<LeadWriteResult> CreateQuestionAsync(QuestionDto dto, CancellationToken ct = default)
    {
        try
        {
            var entity = new Question
            {
                Name = Trim(dto.Name, 200) ?? "",
                Email = Trim(dto.Email, 320),
                Message = Trim(dto.Question, 4000),
                Locale = Trim(dto.Locale, 10),
                CreatedAt = DateTimeOffset.UtcNow,
            };

            _db.Questions.Add(entity);
            await _db.SaveChangesAsync(ct);
            return LeadWriteResult.Succeeded(entity.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write a question from {Email} to SQL.", dto.Email);
            return LeadWriteResult.Failed(ex.Message);
        }
    }

    // Truncate rather than let SqlException reject the row: a lead that is 20 characters
    // too long is still a lead, and losing it to a length constraint is the exact failure
    // mode this whole change exists to prevent.
    private static string? Trim(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        return v.Length <= max ? v : v[..max];
    }
}
