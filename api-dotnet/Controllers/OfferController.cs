using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
public class OfferController : ControllerBase
{
    private readonly ILeadStore _leads;
    private readonly EmailService _email;
    private readonly ILogger<OfferController> _logger;

    public OfferController(ILeadStore leads, EmailService email, ILogger<OfferController> logger)
    {
        _leads = leads;
        _email = email;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] OfferDto dto, CancellationToken ct)
    {
        var write = await _leads.CreateOfferAsync(dto, ct);

        // Best-effort emails (never block capture): acknowledge the lead + notify sales.
        // The notification is also the safety net when the write did not land, so unlike
        // before its outcome is kept rather than discarded.
        var autoresponder = _email.TrySendLeadAutoresponderAsync(dto.Email, dto.Name, isOffer: true, dto.Project, dto.Locale, ct);
        var notification = _email.TrySendLeadNotificationAsync(isOffer: true, dto.Name, dto.Email, dto.Phone, dto.Project, ct);
        await Task.WhenAll(autoresponder, notification);

        return LeadResponse.For(this, _logger, "offer", dto.Email, write, salesNotified: await notification);
    }
}
