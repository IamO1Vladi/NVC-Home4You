using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Services;

// Sends the "email me my configuration" message. Prefers Microsoft Graph /sendMail
// (OAuth2 client credentials) when configured — Microsoft 365 has deprecated SMTP
// Basic Auth — and otherwise falls back to SMTP via System.Net.Mail.
public class EmailService
{
    private readonly EnvConfig _env;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<EmailService> _logger;

    public EmailService(EnvConfig env, IHttpClientFactory httpFactory, ILogger<EmailService> logger)
    {
        _env = env;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public bool IsConfigured => _env.EmailConfigured;

    public async Task SendConfigLinkAsync(string toEmail, string shortUrl, string? modelLabel, string? locale, CancellationToken ct = default)
    {
        var (subject, html) = BuildMessage(shortUrl, modelLabel, locale);
        await SendAsync(new[] { toEmail }, subject, html, replyTo: null, ct);
    }

    // Best-effort lead autoresponder: confirms receipt to the lead and echoes what they
    // submitted (which already carries the config link). Never throws — a mail failure
    // must not affect lead capture.
    public async Task<bool> TrySendLeadAutoresponderAsync(string? toEmail, string name, bool isOffer, string details, string? locale, CancellationToken ct = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(toEmail)) return false;
        try
        {
            var (subject, html) = BuildAutoresponder(name, isOffer, details, locale);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(20));
            await SendAsync(new[] { toEmail! }, subject, html, replyTo: null, timeout.Token);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lead autoresponder failed for {Email}", toEmail);
            return false;
        }
    }

    // Best-effort internal "new lead" notification to the sales inbox, with Reply-To set
    // to the lead so the team can respond directly. Never throws.
    public async Task<bool> TrySendLeadNotificationAsync(bool isOffer, string name, string leadEmail, string? phone, string details, CancellationToken ct = default)
    {
        if (!IsConfigured) return false;
        var recipients = ParseRecipients(_env.LeadNotifyEmail);
        if (recipients.Count == 0) return false;
        try
        {
            var (subject, html) = BuildLeadNotification(isOffer, name, leadEmail, phone, details);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(20));
            var replyTo = string.IsNullOrWhiteSpace(leadEmail) ? null : leadEmail.Trim();
            await SendAsync(recipients, subject, html, replyTo, timeout.Token);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lead notification failed");
            return false;
        }
    }

    private static IReadOnlyCollection<string> ParseRecipients(string? raw) =>
        (raw ?? "")
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => x.Contains('@'))
            .Distinct()
            .ToArray();

    // Picks the configured transport (Graph preferred, SMTP fallback).
    private Task SendAsync(IReadOnlyCollection<string> toEmails, string subject, string html, string? replyTo, CancellationToken ct) =>
        _env.GraphConfigured
            ? SendViaGraphAsync(toEmails, subject, html, replyTo, ct)
            : SendViaSmtpAsync(toEmails, subject, html, replyTo, ct);

    private async Task SendViaSmtpAsync(IReadOnlyCollection<string> toEmails, string subject, string html, string? replyTo, CancellationToken ct)
    {
        using var message = new MailMessage
        {
            From = new MailAddress(_env.SmtpFrom, _env.SmtpFromName),
            Subject = subject,
            Body = html,
            IsBodyHtml = true,
        };
        foreach (var to in toEmails) message.To.Add(new MailAddress(to));
        if (!string.IsNullOrWhiteSpace(replyTo)) message.ReplyToList.Add(new MailAddress(replyTo));

        using var client = new SmtpClient(_env.SmtpHost, _env.SmtpPort)
        {
            EnableSsl = true, // STARTTLS on port 587
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Credentials = new NetworkCredential(_env.SmtpUser, _env.SmtpPassword),
        };

        await client.SendMailAsync(message, ct);
    }

    // Sends via Graph POST /users/{sender}/sendMail using an app-only access token.
    // The sender is fixed by the URL path, so the app needs Mail.Send (application).
    private async Task SendViaGraphAsync(IReadOnlyCollection<string> toEmails, string subject, string html, string? replyTo, CancellationToken ct)
    {
        var token = await GetGraphTokenAsync(ct);

        var toRecipients = toEmails.Select(a => new { emailAddress = new { address = a } }).ToArray();
        object messageObj = string.IsNullOrWhiteSpace(replyTo)
            ? new
            {
                subject,
                body = new { contentType = "HTML", content = html },
                toRecipients,
            }
            : new
            {
                subject,
                body = new { contentType = "HTML", content = html },
                toRecipients,
                replyTo = new[] { new { emailAddress = new { address = replyTo } } },
            };
        var payload = new { message = messageObj, saveToSentItems = false };

        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_env.GraphSender)}/sendMail")
        {
            Content = JsonContent.Create(payload),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Graph sendMail failed: {(int)response.StatusCode} {body}");
        }
    }

    private async Task<string> GetGraphTokenAsync(CancellationToken ct)
    {
        var http = _httpFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://login.microsoftonline.com/{Uri.EscapeDataString(_env.GraphTenantId)}/oauth2/v2.0/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _env.GraphClientId,
                ["client_secret"] = _env.GraphClientSecret,
                ["scope"] = "https://graph.microsoft.com/.default",
                ["grant_type"] = "client_credentials",
            }),
        };

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Graph token request failed: {(int)response.StatusCode} {body}");

        using var doc = JsonDocument.Parse(body);
        if (doc.RootElement.TryGetProperty("access_token", out var tokenEl) && tokenEl.GetString() is { Length: > 0 } token)
            return token;
        throw new InvalidOperationException("Graph token response did not contain an access_token.");
    }

    // Minimal localized transactional email. Kept plain and inline-styled so it
    // renders in every mail client without external assets.
    private (string subject, string html) BuildMessage(string url, string? modelLabel, string? locale)
    {
        var loc = (locale ?? "en").Trim().ToLowerInvariant();
        var model = string.IsNullOrWhiteSpace(modelLabel) ? "" : System.Net.WebUtility.HtmlEncode(modelLabel);
        var safeUrl = System.Net.WebUtility.HtmlEncode(url);

        string subject, intro, cta, outro;
        switch (loc)
        {
            case "bg":
                subject = "Вашата конфигурация — NVC Home4You";
                intro = string.IsNullOrEmpty(model)
                    ? "Ето връзка към конфигурацията, която създадохте:"
                    : $"Ето връзка към вашата конфигурация ({model}):";
                cta = "Отвори моята конфигурация";
                outro = "Връзката отваря конфигуратора точно както го оставихте. Можете да я запазите или споделите.";
                break;
            case "el":
                subject = "Η διαμόρφωσή σας — NVC Home4You";
                intro = string.IsNullOrEmpty(model)
                    ? "Ορίστε ο σύνδεσμος για τη διαμόρφωση που δημιουργήσατε:"
                    : $"Ορίστε ο σύνδεσμος για τη διαμόρφωσή σας ({model}):";
                cta = "Άνοιγμα της διαμόρφωσής μου";
                outro = "Ο σύνδεσμος ανοίγει τον διαμορφωτή ακριβώς όπως τον αφήσατε. Μπορείτε να τον αποθηκεύσετε ή να τον μοιραστείτε.";
                break;
            default:
                subject = "Your configuration — NVC Home4You";
                intro = string.IsNullOrEmpty(model)
                    ? "Here's the link to the configuration you built:"
                    : $"Here's the link to your configuration ({model}):";
                cta = "Open my configuration";
                outro = "The link opens the configurator exactly as you left it. You can bookmark or share it.";
                break;
        }

        var html =
$@"<div style=""font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6;max-width:560px"">
  <p>{intro}</p>
  <p style=""margin:24px 0"">
    <a href=""{safeUrl}"" style=""background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block"">{cta}</a>
  </p>
  <p style=""font-size:13px;color:#555"">{outro}</p>
  <p style=""font-size:13px;color:#555;word-break:break-all"">{safeUrl}</p>
  <hr style=""border:none;border-top:1px solid #eee;margin:24px 0"" />
  <p style=""font-size:12px;color:#888"">NVC Home4You · nvc-home4you.eu</p>
</div>";

        return (subject, html);
    }

    // Localized "we received your request/question" acknowledgement, echoing what the
    // lead submitted (their config summary + link).
    private (string subject, string html) BuildAutoresponder(string name, bool isOffer, string details, string? locale)
    {
        var loc = (locale ?? "en").Trim().ToLowerInvariant();
        var safeName = System.Net.WebUtility.HtmlEncode((name ?? "").Trim());
        var detailsHtml = LinkifyEncoded(details ?? "");

        string subject, greeting, intro, detailsHeading, signoff;
        switch (loc)
        {
            case "bg":
                subject = isOffer ? "Получихме вашата заявка — NVC Home4You" : "Получихме вашия въпрос — NVC Home4You";
                greeting = string.IsNullOrEmpty(safeName) ? "Здравейте," : $"Здравейте, {safeName},";
                intro = isOffer
                    ? "Благодарим ви, че се свързахте с NVC Home4You. Получихме вашата заявка и наш екип ще се свърже с вас възможно най-скоро."
                    : "Благодарим ви, че се свързахте с NVC Home4You. Получихме вашия въпрос и наш екип ще се свърже с вас възможно най-скоро.";
                detailsHeading = "Ето копие на изпратеното от вас:";
                signoff = "— Екипът на NVC Home4You";
                break;
            case "el":
                subject = isOffer ? "Λάβαμε το αίτημά σας — NVC Home4You" : "Λάβαμε την ερώτησή σας — NVC Home4You";
                greeting = string.IsNullOrEmpty(safeName) ? "Γεια σας," : $"Γεια σας, {safeName},";
                intro = isOffer
                    ? "Σας ευχαριστούμε που επικοινωνήσατε με την NVC Home4You. Λάβαμε το αίτημά σας και η ομάδα μας θα επικοινωνήσει μαζί σας σύντομα."
                    : "Σας ευχαριστούμε που επικοινωνήσατε με την NVC Home4You. Λάβαμε την ερώτησή σας και η ομάδα μας θα επικοινωνήσει μαζί σας σύντομα.";
                detailsHeading = "Ορίστε ένα αντίγραφο αυτού που μας στείλατε:";
                signoff = "— Η ομάδα της NVC Home4You";
                break;
            default:
                subject = isOffer ? "We've received your request — NVC Home4You" : "We've received your question — NVC Home4You";
                greeting = string.IsNullOrEmpty(safeName) ? "Hi," : $"Hi {safeName},";
                intro = isOffer
                    ? "Thanks for reaching out to NVC Home4You. We've received your request and a member of our team will get back to you shortly."
                    : "Thanks for reaching out to NVC Home4You. We've received your question and a member of our team will get back to you shortly.";
                detailsHeading = "Here's a copy of what you sent us:";
                signoff = "— The NVC Home4You team";
                break;
        }

        var detailsBlock = string.IsNullOrWhiteSpace(details)
            ? ""
            : $@"<p style=""font-size:13px;color:#555;margin-top:22px"">{detailsHeading}</p>
  <div style=""font-size:13px;color:#333;background:#f6f7f9;border-radius:8px;padding:12px 14px;white-space:pre-wrap;word-break:break-word"">{detailsHtml}</div>";

        var html =
$@"<div style=""font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6;max-width:560px"">
  <p>{greeting}</p>
  <p>{intro}</p>
  {detailsBlock}
  <p style=""font-size:13px;color:#555;margin-top:22px"">{signoff}</p>
  <hr style=""border:none;border-top:1px solid #eee;margin:24px 0"" />
  <p style=""font-size:12px;color:#888"">NVC Home4You · nvc-home4you.eu</p>
</div>";

        return (subject, html);
    }

    // HTML-encodes text and turns bare http(s) URLs into clickable links.
    private static string LinkifyEncoded(string text)
    {
        var encoded = System.Net.WebUtility.HtmlEncode(text);
        return Regex.Replace(encoded, @"https?://[^\s<]+", m => $@"<a href=""{m.Value}"">{m.Value}</a>");
    }

    // Internal team notification (English) with the lead's contact details and submission.
    private (string subject, string html) BuildLeadNotification(bool isOffer, string name, string leadEmail, string? phone, string details)
    {
        var trimmedName = (name ?? "").Trim();
        var trimmedEmail = (leadEmail ?? "").Trim();
        var safeName = System.Net.WebUtility.HtmlEncode(trimmedName);
        var safeEmail = System.Net.WebUtility.HtmlEncode(trimmedEmail);
        var safePhone = System.Net.WebUtility.HtmlEncode((phone ?? "").Trim());
        var detailsHtml = LinkifyEncoded(details ?? "");

        // Bulgarian, unlike the customer-facing autoresponder: this one only ever goes to
        // the sales inbox, so it follows the team's language rather than the visitor's.
        var kind = isOffer ? "запитване за оферта" : "въпрос";

        var subject = $"Ново {kind}: {(string.IsNullOrEmpty(trimmedName) ? trimmedEmail : trimmedName)}";

        var phoneRow = string.IsNullOrEmpty(safePhone)
            ? ""
            : $@"<p style=""margin:2px 0""><strong>Телефон:</strong> {safePhone}</p>";

        var html =
$@"<div style=""font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;max-width:600px"">
  <p style=""font-size:15px""><strong>Ново {kind} от сайта</strong></p>
  <p style=""margin:2px 0""><strong>Име:</strong> {(string.IsNullOrEmpty(safeName) ? "—" : safeName)}</p>
  <p style=""margin:2px 0""><strong>Имейл:</strong> <a href=""mailto:{safeEmail}"">{safeEmail}</a></p>
  {phoneRow}
  <p style=""font-size:13px;color:#555;margin-top:16px"">Детайли:</p>
  <div style=""font-size:13px;color:#333;background:#f6f7f9;border-radius:8px;padding:12px 14px;white-space:pre-wrap;word-break:break-word"">{detailsHtml}</div>
  <hr style=""border:none;border-top:1px solid #eee;margin:20px 0"" />
  <p style=""font-size:12px;color:#888"">Отговорете на този имейл, за да пишете директно на клиента.</p>
</div>";

        return (subject, html);
    }
}
