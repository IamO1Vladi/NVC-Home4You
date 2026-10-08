using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
// See OfferController: the same per-visitor budget on the same kind of public form.
[EnableRateLimiting("public-write")]
public class QuestionController : ControllerBase
{
    private readonly ILeadStore _leads;
    private readonly EmailService _email;
    private readonly EnvConfig _env;
    private readonly IRepresentativeIntake _intake;
    private readonly ILogger<QuestionController> _logger;

    public QuestionController(
        ILeadStore leads, EmailService email, EnvConfig env, IRepresentativeIntake intake, ILogger<QuestionController> logger)
    {
        _leads = leads;
        _email = email;
        _env = env;
        _intake = intake;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] QuestionDto dto, CancellationToken ct)
    {
        // Same order as OfferController: the honeypot first, then the rep slug resolved so
        // only the registry's spelling reaches a store.
        if (LeadResponse.HoneypotTripped(dto.Website))
            return LeadResponse.Decoy(this, _logger, "question", dto.Email);

        var rep = _env.FindRepresentativeBySlug(dto.Rep);
        dto = dto with { Rep = rep?.Slug };

        var write = await _leads.CreateQuestionAsync(dto, ct);

        // No phone: the question form does not collect one, so the duplicate check runs on
        // the address alone. Otherwise as OfferController.
        var intake = rep is null
            ? null
            : new LeadIntakeNote(
                rep.Slug, rep.Upn,
                write.Ok
                    ? await _intake.TryPromoteAsync(LeadAdminService.KindQuestion, write.RecordId, rep, dto.Email, null, ct)
                    : IntakeOutcome.Skipped("enquiry-not-stored"),
                $"{Request.Scheme}://{Request.Host}");

        // See OfferController: the sales notification doubles as the safety net, so its
        // result decides whether a failed write is recoverable or a genuinely lost lead.
        var autoresponder = _email.TrySendLeadAutoresponderAsync(dto.Email, dto.Name, isOffer: false, dto.Question, dto.Locale, ct);
        var notification = _email.TrySendLeadNotificationAsync(isOffer: false, dto.Name, dto.Email, null, dto.Question, ct, intake: intake);
        await Task.WhenAll(autoresponder, notification);

        return LeadResponse.For(this, _logger, "question", dto.Email, write, salesNotified: await notification);
    }
}
