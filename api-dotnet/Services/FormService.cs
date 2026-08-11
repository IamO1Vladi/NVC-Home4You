using Microsoft.Extensions.Logging;
using Models;

namespace Services;

// Writes leads (offers and questions) to Quickbase.
//
// Every method returns a LeadWriteResult rather than an int?, because a null record id
// used to be indistinguishable from a successful write: Quickbase answers 200 with
// metadata.lineErrors when it accepts the request but rejects the record, so
// EnsureSuccessStatusCode() passes and nothing downstream could tell the difference.
// A lost lead is a customer who saw "thank you" and vanished, so the failure has to be
// nameable rather than inferred from a null.
public class FormService : ILeadStore
{
    private readonly QuickbaseClient _qb;
    private readonly EnvConfig _env;
    private readonly ILogger<FormService> _logger;

    public FormService(QuickbaseClient qb, EnvConfig env, ILogger<FormService> logger)
    {
        _qb = qb;
        _env = env;
        _logger = logger;
    }

    public async Task<LeadWriteResult> CreateOfferAsync(OfferDto dto, CancellationToken ct = default)
    {
        var rec = new Dictionary<string, object?>
        {
            [_env.F_OFFER_NAME.ToString()] = new { value = dto.Name },
            [_env.F_OFFER_EMAIL.ToString()] = new { value = dto.Email },
            [_env.F_OFFER_PHONE.ToString()] = new { value = dto.Phone },
            [_env.F_OFFER_MESSAGE.ToString()] = new { value = dto.Project },
        };
        if (!string.IsNullOrWhiteSpace(dto.ModelId))
            rec[_env.F_OFFER_MODEL_ID.ToString()] = new { value = dto.ModelId };

        return await CreateAsync(_env.TableOffer, rec, "offer", ct);
    }

    public async Task<LeadWriteResult> CreateQuestionAsync(QuestionDto dto, CancellationToken ct = default)
    {
        var rec = new Dictionary<string, object?>
        {
            [_env.F_Q_NAME.ToString()] = new { value = dto.Name },
            [_env.F_Q_EMAIL.ToString()] = new { value = dto.Email },
            [_env.F_Q_MESSAGE.ToString()] = new { value = dto.Question },
        };

        return await CreateAsync(_env.TableQuestion, rec, "question", ct);
    }

    private async Task<LeadWriteResult> CreateAsync(
        string table, Dictionary<string, object?> rec, string kind, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(table))
        {
            _logger.LogError("Cannot write {Kind}: the Quickbase table is not configured.", kind);
            return LeadWriteResult.Failed("Quickbase table is not configured.");
        }

        var body = new { to = table, data = new[] { rec }, fieldsToReturn = new[] { 3 } };

        QbCreateResult? res;
        try
        {
            res = await _qb.CreateAsync(body, ct);
        }
        catch (Exception ex)
        {
            // A transport or non-2xx failure. Already loud, but log here too so the lead
            // itself is in the record rather than only the HTTP error.
            _logger.LogError(ex, "Quickbase rejected the {Kind} write outright.", kind);
            return LeadWriteResult.Failed(ex.Message);
        }

        // 200 + lineErrors: accepted the request, refused the record. Quickbase's stated
        // reason used to be discarded during deserialization, which made this failure not
        // merely unhandled but undiscoverable afterwards.
        if (res?.HasLineErrors == true)
        {
            var reason = res.DescribeLineErrors();
            _logger.LogError("Quickbase accepted the {Kind} request but rejected the record: {Reason}", kind, reason);
            return LeadWriteResult.Failed(reason ?? "Quickbase rejected the record.");
        }

        // FirstOrDefault() on an empty List<int> yields 0, not null, so an empty
        // createdRecordIds would otherwise be mistaken for record 0.
        var created = res?.metadata?.createdRecordIds;
        var rid = res?.metadata?.firstRecordId
                  ?? (created is { Count: > 0 } ? created[0] : (int?)null)
                  ?? ParseRecordIdFromData(res);

        if (rid is null or <= 0)
        {
            _logger.LogError("Quickbase returned no record id for the {Kind} write and gave no reason.", kind);
            return LeadWriteResult.Failed("Quickbase returned no record id.");
        }

        return LeadWriteResult.Succeeded(rid.Value);
    }

    private static int? ParseRecordIdFromData(QbCreateResult? res)
    {
        var first = res?.data?.FirstOrDefault()?.Get(3);
        return int.TryParse(first, out var n) ? n : null;
    }
}
