using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Models;

namespace Services;

// Writes every lead to both stores while only one of them is authoritative.
//
// This is the soak described in ROADMAP-leads Phase 4 (the plan file is deleted;
// git history has it), and it is deliberately more
// cautious than the flag flip used for gallery and cases. A read path that breaks is
// visible on the page; a lead write that fails is a customer who saw "thank you" and
// vanished. So SQL gets exercised under real traffic for weeks before anything depends
// on it, and the secondary store can fail all it likes without costing a lead.
//
// Which store is authoritative is decided by DATA_SOURCE_LEADS, exactly as for every
// other entity — this class only adds the second write. Enabled by LEADS_DUAL_WRITE,
// independent of the data-source flag for the same reason IMAGES_VIA_APP is independent
// of BLOB_CONNECTION_STRING: the two decisions carry different risk and are worth rolling
// out separately.
public class DualWriteLeadStore : ILeadStore
{
    private readonly ILeadStore _primary;
    private readonly ILeadStore _secondary;
    private readonly ILogger<DualWriteLeadStore> _logger;

    public DualWriteLeadStore(ILeadStore primary, ILeadStore secondary, ILogger<DualWriteLeadStore> logger)
    {
        _primary = primary;
        _secondary = secondary;
        _logger = logger;
    }

    public async Task<LeadWriteResult> CreateOfferAsync(OfferDto dto, CancellationToken ct = default)
    {
        var primary = await _primary.CreateOfferAsync(dto, ct);
        var secondary = await _secondary.CreateOfferAsync(dto, ct);
        LogDivergence("offer", dto.Email, primary, secondary);
        return primary;
    }

    public async Task<LeadWriteResult> CreateQuestionAsync(QuestionDto dto, CancellationToken ct = default)
    {
        var primary = await _primary.CreateQuestionAsync(dto, ct);
        var secondary = await _secondary.CreateQuestionAsync(dto, ct);
        LogDivergence("question", dto.Email, primary, secondary);
        return primary;
    }

    // The secondary store's result is never returned — only the authoritative one decides
    // what the customer sees. It is logged instead, and that log is the acceptance gate:
    // cut over only once it has been quiet under real traffic.
    private void LogDivergence(string kind, string? email, LeadWriteResult primary, LeadWriteResult secondary)
    {
        if (primary.Ok == secondary.Ok) return;

        if (primary.Ok)
        {
            _logger.LogError(
                "Dual-write divergence on a {Kind} from {Email}: the authoritative store accepted it but the secondary refused ({Error}). Not safe to cut over yet.",
                kind, email, secondary.Error);
        }
        else
        {
            // Worth its own branch: the store we are migrating *to* is the healthy one,
            // which is good news for the migration and bad news for today.
            _logger.LogError(
                "Dual-write divergence on a {Kind} from {Email}: the authoritative store refused it ({Error}) but the secondary accepted it as record {RecordId}.",
                kind, email, primary.Error, secondary.RecordId);
        }
    }
}
