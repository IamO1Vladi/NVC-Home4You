using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/config-email")]
public class ConfigEmailController : ControllerBase
{
    private readonly SavedConfigService _saved;
    private readonly EmailService _email;

    public ConfigEmailController(SavedConfigService saved, EmailService email)
    {
        _saved = saved;
        _email = email;
    }

    // Save the config behind a short link, then email that link to the visitor.
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] EmailConfigRequest req, CancellationToken ct)
    {
        // Both the store and SMTP must be configured for this flow to work.
        if (!_email.IsConfigured || !_saved.IsConfigured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "email_disabled" });

        if (req is null || req.Config.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            return BadRequest(new { error = "missing_config" });

        if (string.IsNullOrWhiteSpace(req.Email) || !IsValidEmail(req.Email))
            return BadRequest(new { error = "invalid_email" });

        var code = await _saved.SaveAsync(
            new SaveConfigRequest(req.Config, req.ModelLabel, req.Locale, req.ReturnPath, req.Email), ct);
        var url = $"{Request.Scheme}://{Request.Host}/c/{code}";

        try
        {
            await _email.SendConfigLinkAsync(req.Email, url, req.ModelLabel, req.Locale, ct);
        }
        catch
        {
            // The config was saved (link is valid); only delivery failed.
            return StatusCode(StatusCodes.Status502BadGateway, new { error = "send_failed" });
        }

        return Ok(new { ok = true });
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email.Trim());
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }
}
