using Models;

namespace Services;

public class FormService
{
    private readonly QuickbaseClient _qb;
    private readonly EnvConfig _env;

    public FormService(QuickbaseClient qb, EnvConfig env)
    {
        _qb = qb;
        _env = env;
    }

    public async Task<int?> CreateOfferAsync(OfferDto dto, CancellationToken ct = default)
    {
        var f = _env;
        var rec = new Dictionary<string, object?>{
    [_env.F_OFFER_NAME.ToString()]    = new { value = dto.Name },
    [_env.F_OFFER_EMAIL.ToString()]   = new { value = dto.Email },
    [_env.F_OFFER_PHONE.ToString()]   = new { value = dto.Phone },
    [_env.F_OFFER_MESSAGE.ToString()] = new { value = dto.Project }
};
if (!string.IsNullOrWhiteSpace(dto.ModelId))
    rec[_env.F_OFFER_MODEL_ID.ToString()] = new { value = dto.ModelId };

var body = new {
    to = _env.TableOffer,
    data = new[] { rec },
    fieldsToReturn = new[]{ 3 }
};
        var res = await _qb.CreateAsync(body, ct);
        var rid = res?.metadata?.firstRecordId;
        if (rid.HasValue) return rid.Value;
        var first = res?.data?.FirstOrDefault()?.Get(3);
        return int.TryParse(first, out var n) ? n : null;
    }

    public async Task<int?> CreateQuestionAsync(QuestionDto dto, CancellationToken ct = default)
    {
        var f = _env;
        var rec = new Dictionary<string, object?>{
    [_env.F_Q_NAME.ToString()]    = new { value = dto.Name },
    [_env.F_Q_EMAIL.ToString()]   = new { value = dto.Email },
    [_env.F_Q_MESSAGE.ToString()] = new { value = dto.Question }
};

var body = new {
    to = _env.TableQuestion,
    data = new[] { rec },
    fieldsToReturn = new[]{ 3 }
};
        var res = await _qb.CreateAsync(body, ct);
        var rid = res?.metadata?.firstRecordId;
        if (rid.HasValue) return rid.Value;
        var first = res?.data?.FirstOrDefault()?.Get(3);
        return int.TryParse(first, out var n) ? n : null;
    }
}
