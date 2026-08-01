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
        // Best-effort instant acknowledgement to the lead (never blocks capture).
        await _email.TrySendLeadAutoresponderAsync(dto.Email, dto.Name, isOffer: false, dto.Question, dto.Locale, ct);
        return Ok(new { recordId = rid });
    }
}
