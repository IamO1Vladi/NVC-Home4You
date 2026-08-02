using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
public class OfferController : ControllerBase
{
    private readonly FormService _svc;
    private readonly EmailService _email;
    public OfferController(FormService svc, EmailService email) { _svc = svc; _email = email; }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] OfferDto dto, CancellationToken ct)
    {
        var rid = await _svc.CreateOfferAsync(dto, ct);
        // Best-effort emails (never block capture): acknowledge the lead + notify sales.
        await Task.WhenAll(
            _email.TrySendLeadAutoresponderAsync(dto.Email, dto.Name, isOffer: true, dto.Project, dto.Locale, ct),
            _email.TrySendLeadNotificationAsync(isOffer: true, dto.Name, dto.Email, dto.Phone, dto.Project, ct));
        return Ok(new { recordId = rid });
    }
}
