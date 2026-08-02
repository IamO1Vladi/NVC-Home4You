using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuestionController : ControllerBase
{
    private readonly FormService _svc;
    private readonly EmailService _email;
    public QuestionController(FormService svc, EmailService email) { _svc = svc; _email = email; }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] QuestionDto dto, CancellationToken ct)
    {
        var rid = await _svc.CreateQuestionAsync(dto, ct);
        // Best-effort emails (never block capture): acknowledge the lead + notify sales.
        await Task.WhenAll(
            _email.TrySendLeadAutoresponderAsync(dto.Email, dto.Name, isOffer: false, dto.Question, dto.Locale, ct),
            _email.TrySendLeadNotificationAsync(isOffer: false, dto.Name, dto.Email, null, dto.Question, ct));
        return Ok(new { recordId = rid });
    }
}
