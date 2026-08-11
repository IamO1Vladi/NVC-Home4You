using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services;

// Lead storage, implemented over Quickbase (FormService) and SQL (SqlLeadService), and
// selected per request by DATA_SOURCE_LEADS. DualWriteLeadStore composes the two.
//
// Write-only on purpose, for now. The site never reads a lead back — FormService only
// ever wrote — so adding reads here before the admin leads view exists would be an
// interface with no caller. The read side arrives with that view.
public interface ILeadStore
{
    Task<LeadWriteResult> CreateOfferAsync(OfferDto dto, CancellationToken ct = default);

    Task<LeadWriteResult> CreateQuestionAsync(QuestionDto dto, CancellationToken ct = default);
}
