using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
// A public form with no sign-in in front of it: ten writes per visitor per ten minutes,
// the "public-write" policy in Program.cs. The SPA retries a 429 with backoff, so a real
// visitor who somehow hits it sees "retrying", not a dead button.
[EnableRateLimiting("public-write")]
public class OfferController : ControllerBase
{
    private readonly ILeadStore _leads;
    private readonly EmailService _email;
    private readonly EnvConfig _env;
    private readonly IRepresentativeIntake _intake;
    private readonly ILogger<OfferController> _logger;

    public OfferController(
        ILeadStore leads, EmailService email, EnvConfig env, IRepresentativeIntake intake, ILogger<OfferController> logger)
    {
        _leads = leads;
        _email = email;
        _env = env;
        _intake = intake;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] OfferDto dto, CancellationToken ct)
    {
        // A filled honeypot is a bot. It gets the real success answer and nothing else —
        // LeadResponse.Decoy says why not a 4xx. Checked before anything is stored or sent.
        if (LeadResponse.HoneypotTripped(dto.Website))
            return LeadResponse.Decoy(this, _logger, "offer", dto.Email);

        // The slug the browser remembered from a /r/{slug} link is untrusted; only the
        // registry's own spelling, or nothing, goes any further (#38).
        var rep = _env.FindRepresentativeBySlug(dto.Rep);
        dto = dto with { Rep = rep?.Slug };

        var write = await _leads.CreateOfferAsync(dto, ct);

        // An enquiry through a representative's link becomes that representative's lead
        // now, rather than waiting in the queue for someone to promote it — the rep's panel
        // shows leads he owns and nothing else. Best effort, and it never changes what the
        // customer is told: the stored message already names the rep (RepresentativeLine),
        // so a skipped promotion loses nothing that cannot be done by hand from Запитвания.
        // When the write itself failed there is no row to promote, and the note says so.
        var intake = rep is null
            ? null
            : new LeadIntakeNote(
                rep.Slug, rep.Upn,
                write.Ok
                    ? await _intake.TryPromoteAsync(LeadAdminService.KindOffer, write.RecordId, rep, dto.Email, dto.Phone, ct)
                    : IntakeOutcome.Skipped("enquiry-not-stored"),
                $"{Request.Scheme}://{Request.Host}");

        // Best-effort emails (never block capture): acknowledge the lead + notify sales.
        // The notification is also the safety net when the write did not land, so unlike
        // before its outcome is kept rather than discarded.
        //
        // The model a gallery enquiry is about goes to sales only. The autoresponder echoes
        // the customer's own text and nothing else, so it never repeats back a title or a
        // link that a stranger typed into the form. The representative goes the same way.
        var autoresponder = _email.TrySendLeadAutoresponderAsync(dto.Email, dto.Name, isOffer: true, dto.Project, dto.Locale, ct);
        var notification = _email.TrySendLeadNotificationAsync(
            isOffer: true, dto.Name, dto.Email, dto.Phone, dto.Project, ct, model: OfferModel.From(dto), intake: intake);
        await Task.WhenAll(autoresponder, notification);

        return LeadResponse.For(this, _logger, "offer", dto.Email, write, salesNotified: await notification);
    }
}
