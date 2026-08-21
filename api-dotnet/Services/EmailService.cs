using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.IO;
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

    private readonly GraphTokens _tokens;

    public EmailService(
        EnvConfig env, IHttpClientFactory httpFactory, ILogger<EmailService> logger, GraphTokens? tokens = null)
    {
        _env = env;
        _httpFactory = httpFactory;
        _logger = logger;

        // Optional so the existing signature-rendering tests, which never reach the
        // network, can keep constructing this with three arguments.
        _tokens = tokens ?? new GraphTokens(env, httpFactory);
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

    /// <summary>
    /// An internal report to our own people — the overdue follow-up list today, whatever
    /// else later.
    ///
    /// No Reply-To: there is no customer in this conversation, and pointing replies at one
    /// would send "thanks, got it" to somebody who never asked. Best-effort like the two
    /// above, because a mail failure must never take down the page that asked for it.
    /// </summary>
    public async Task<bool> TrySendInternalReportAsync(
        IReadOnlyCollection<string> toEmails, string subject, string html, CancellationToken ct = default)
    {
        if (!IsConfigured || toEmails.Count == 0) return false;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(20));
            await SendAsync(toEmails, subject, html, replyTo: null, timeout.Token);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Internal report email failed");
            return false;
        }
    }

    /// <summary>
    /// The same internal report, carrying one file.
    ///
    /// Added for the audit archive, where the attachment IS the point: the mail is the only
    /// copy of the history once the rows are pruned, so this returns false rather than
    /// throwing and the caller must treat false as "delete nothing".
    /// </summary>
    // Virtual so the archive's delete-after-send rule can be tested against a transport
    // that is made to fail on purpose. That path deletes audit history, so "it was not
    // sent, therefore nothing was removed" has to be provable rather than argued.
    public virtual async Task<bool> TrySendInternalReportWithAttachmentAsync(
        IReadOnlyCollection<string> toEmails, string subject, string html,
        string fileName, string contentType, byte[] content, CancellationToken ct = default)
    {
        if (!IsConfigured || toEmails.Count == 0 || content.Length == 0) return false;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            // Longer than the plain report's 20s: this one carries a file.
            timeout.CancelAfter(TimeSpan.FromMinutes(2));
            await SendAsync(toEmails, subject, html, replyTo: null,
                new Attached(fileName, contentType, content), timeout.Token);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Internal report email with attachment failed ({FileName})", fileName);
            return false;
        }
    }

    /// <summary>One file travelling with a message, small enough to hold in memory.</summary>
    private sealed record Attached(string FileName, string ContentType, byte[] Content);

    /// <summary>
    /// Whether a single string is an address we would be willing to send to.
    ///
    /// MailAddress does the parsing, and the round-trip comparison is the actual check: the
    /// parser happily accepts "Ivan &lt;ivan@example.com&gt;" and a trailing comment, so
    /// without it a display name typed into an email box would pass and then be stored as
    /// something no mail client will match the customer on. A regex was not written here for
    /// the usual reason — the ones people write reject real addresses and accept broken ones.
    ///
    /// IT IS NOT THE ONLY RULE IN THE CODEBASE, and pretending otherwise would mislead the
    /// next person to reach for it. This is the strict one, for a SINGLE address about to be
    /// stored against a person: the lead sheet's email box and the configurator's "email me
    /// my config". ParseRecipients directly below is deliberately lax, and CustomerAdminService
    /// and FactoryAdminService still ask only for an '@' — both because those columns already
    /// hold years of imported values no parser accepts, and tightening the rule under a box
    /// somebody resends untouched refuses edits nobody made. Sharpen one of them only with
    /// the stored data in hand.
    /// </summary>
    public static bool IsValidAddress(string? raw)
    {
        var trimmed = (raw ?? "").Trim();
        if (trimmed.Length == 0) return false;

        try
        {
            return new MailAddress(trimmed).Address == trimmed;
        }
        catch
        {
            // MailAddress reports malformed input by throwing, and "malformed" is exactly
            // the answer this method exists to give.
            return false;
        }
    }

    // Public because callers need to validate what a person typed into a "send this to"
    // box against the same rule the configured list is read with — two different notions
    // of "is that an address?" is how one of them ends up silently dropping recipients.
    //
    // Lax on purpose, and NOT the rule IsValidAddress above applies. This reads a list
    // somebody typed a moment ago and is about to watch the result of: a token that turns
    // out to be undeliverable comes back as a bounce they can see, whereas a token silently
    // dropped for failing a strict parse is a colleague who never got the report and nobody
    // ever finds out. The strict rule belongs where an address is STORED against a person
    // and read back months later by someone who was not there when it was typed.
    public static IReadOnlyCollection<string> ParseRecipients(string? raw) =>
        (raw ?? "")
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => x.Contains('@'))
            .Distinct()
            .ToArray();

    // Picks the configured transport (Graph preferred, SMTP fallback).
    private Task SendAsync(IReadOnlyCollection<string> toEmails, string subject, string html, string? replyTo, CancellationToken ct) =>
        SendAsync(toEmails, subject, html, replyTo, attachment: null, ct);

    private Task SendAsync(
        IReadOnlyCollection<string> toEmails, string subject, string html, string? replyTo,
        Attached? attachment, CancellationToken ct) =>
        _env.GraphConfigured
            ? SendViaGraphAsync(toEmails, subject, html, replyTo, attachment, ct)
            : SendViaSmtpAsync(toEmails, subject, html, replyTo, attachment, ct);

    private async Task SendViaSmtpAsync(IReadOnlyCollection<string> toEmails, string subject, string html, string? replyTo, Attached? attachment, CancellationToken ct)
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

        using var attachmentStream = attachment is null ? null : new MemoryStream(attachment.Content);
        if (attachment is not null && attachmentStream is not null)
            message.Attachments.Add(new Attachment(attachmentStream, attachment.FileName, attachment.ContentType));

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
    private async Task SendViaGraphAsync(IReadOnlyCollection<string> toEmails, string subject, string html, string? replyTo, Attached? attachment, CancellationToken ct)
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
        if (attachment is not null)
        {
            // Graph needs the type discriminator or it cannot tell a file from a reference
            // to one and rejects the whole message. Same shape LeadMailService uses.
            var files = new[]
            {
                new Dictionary<string, object>
                {
                    ["@odata.type"] = "#microsoft.graph.fileAttachment",
                    ["name"] = attachment.FileName,
                    ["contentType"] = attachment.ContentType,
                    ["contentBytes"] = Convert.ToBase64String(attachment.Content),
                },
            };

            messageObj = string.IsNullOrWhiteSpace(replyTo)
                ? new { subject, body = new { contentType = "HTML", content = html }, toRecipients, attachments = files }
                : new
                {
                    subject,
                    body = new { contentType = "HTML", content = html },
                    toRecipients,
                    replyTo = new[] { new { emailAddress = new { address = replyTo } } },
                    attachments = files,
                };
        }

        // saveToSentItems stays true when a file rides along: the archive mail is the only
        // copy of pruned history, so a record of it in Sent Items is worth having.
        var payload = new { message = messageObj, saveToSentItems = attachment is not null };

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

    // Now shared with LeadMailService and the inbound poller, and cached there — a second
    // copy of the token endpoint here would drift the moment either one changed.
    private Task<string> GetGraphTokenAsync(CancellationToken ct) => _tokens.GetAsync(ct);

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
{BuildSignature(loc)}
</div>";

        return (subject, html);
    }

    // Branded sign-off for the customer-facing email. Quickbase used to send this welcome
    // message; it is ours now, so it needs to look like it came from the company.
    //
    // The logo is referenced by URL rather than embedded: Gmail strips `data:` image URIs
    // outright, so an inlined logo would show as nothing in the client most customers use.
    // Table markup and inline styles are deliberate — Outlook ignores most modern CSS.
    // Every detail here is already published on the public site.
    private static string BuildSignature(string loc)
    {
        var (addressLine, phoneLabel, emailLabel, siteLabel) = loc switch
        {
            "bg" => ("Марикостиново, Петрич 2850, България", "Телефон", "Имейл", "Уебсайт"),
            "el" => ("Marikostinovo, Petrich 2850, Βουλγαρία", "Τηλέφωνο", "Email", "Ιστότοπος"),
            _ => ("Marikostinovo, Petrich 2850, Bulgaria", "Phone", "Email", "Website"),
        };

        return
$@"  <hr style=""border:none;border-top:1px solid #e6e8ec;margin:24px 0"" />
  <table cellpadding=""0"" cellspacing=""0"" border=""0"" style=""font-family:Arial,Helvetica,sans-serif"">
    <tr>
      <td style=""vertical-align:top;padding-right:14px"">
        <img src=""https://nvc-home4you.eu/logo3.jpg"" width=""56"" height=""56"" alt=""NVC Home4You""
             style=""display:block;width:56px;height:56px;border-radius:8px;border:0"" />
      </td>
      <td style=""vertical-align:top;font-size:12px;color:#555;line-height:1.55"">
        <div style=""font-size:14px;font-weight:bold;color:#1a1a1a"">NVC Home4You</div>
        <div style=""color:#888"">{addressLine}</div>
        <div style=""margin-top:6px"">
          {phoneLabel}: <a href=""tel:+359892456245"" style=""color:#2f6fd0;text-decoration:none"">+359 892 456 245</a><br />
          {emailLabel}: <a href=""mailto:contact@nvc-home4you.eu"" style=""color:#2f6fd0;text-decoration:none"">contact@nvc-home4you.eu</a><br />
          {siteLabel}: <a href=""https://nvc-home4you.eu"" style=""color:#2f6fd0;text-decoration:none"">nvc-home4you.eu</a>
        </div>
      </td>
    </tr>
  </table>";
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
