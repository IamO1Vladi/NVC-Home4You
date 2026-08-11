using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuestionController : ControllerBase
{
    private readonly ILeadStore _leads;
    private readonly EmailService _email;
    private readonly ILogger<QuestionController> _logger;

    public QuestionController(ILeadStore leads, EmailService email, ILogger<QuestionController> logger)
    {
        _leads = leads;
        _email = email;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] QuestionDto dto, CancellationToken ct)
    {
        var write = await _leads.CreateQuestionAsync(dto, ct);

        // See OfferController: the sales notification doubles as the safety net, so its
        // result decides whether a failed write is recoverable or a genuinely lost lead.
        var autoresponder = _email.TrySendLeadAutoresponderAsync(dto.Email, dto.Name, isOffer: false, dto.Question, dto.Locale, ct);
        var notification = _email.TrySendLeadNotificationAsync(isOffer: false, dto.Name, dto.Email, null, dto.Question, ct);
        await Task.WhenAll(autoresponder, notification);

        return LeadResponse.For(this, _logger, "question", dto.Email, write, salesNotified: await notification);
    }
}
