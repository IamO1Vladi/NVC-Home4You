using System;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Models;
using Services;

namespace Controllers;

[ApiController]
[Route("api/config-email")]
public class ConfigEmailController : ControllerBase
{
    private readonly SavedConfigService _saved;
    private readonly EmailService _email;
    private readonly ILogger<ConfigEmailController> _logger;

    public ConfigEmailController(SavedConfigService saved, EmailService email, ILogger<ConfigEmailController> logger)
    {
        _saved = saved;
        _email = email;
        _logger = logger;
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
        catch (Exception ex)
        {
            // The config was saved (link is valid); only delivery failed. Surface the
            // underlying transport error (SMTP/Graph) so mail-config issues are diagnosable.
            var detail = Flatten(ex);
            _logger.LogError(ex, "config-email send failed: {Detail}", detail);
            return StatusCode(StatusCodes.Status502BadGateway, new { error = "send_failed", detail });
        }

        return Ok(new { ok = true });
    }

    // Concatenates the message of an exception and its inner exceptions — the real
    // SMTP/Graph error usually lives in an inner exception.
    private static string Flatten(Exception ex)
    {
        var sb = new StringBuilder();
        for (Exception? e = ex; e is not null; e = e.InnerException)
        {
            if (sb.Length > 0) sb.Append(" | ");
            sb.Append(e.Message);
        }
        return sb.ToString();
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
