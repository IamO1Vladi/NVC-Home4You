using System;
using System.Net;
using System.Net.Mail;
using System.Threading;
using System.Threading.Tasks;

namespace Services;

// Sends the "email me my configuration" message over SMTP. Defaults target
// Microsoft 365 (smtp.office365.com:587, STARTTLS). Uses the built-in
// System.Net.Mail client so no extra dependency is needed.
public class EmailService
{
    private readonly EnvConfig _env;
    public EmailService(EnvConfig env) { _env = env; }

    public bool IsConfigured => _env.EmailConfigured;

    public async Task SendConfigLinkAsync(string toEmail, string shortUrl, string? modelLabel, string? locale, CancellationToken ct = default)
    {
        var (subject, html) = BuildMessage(shortUrl, modelLabel, locale);

        using var message = new MailMessage
        {
            From = new MailAddress(_env.SmtpFrom, _env.SmtpFromName),
            Subject = subject,
            Body = html,
            IsBodyHtml = true,
        };
        message.To.Add(new MailAddress(toEmail));

        using var client = new SmtpClient(_env.SmtpHost, _env.SmtpPort)
        {
            EnableSsl = true, // STARTTLS on port 587
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Credentials = new NetworkCredential(_env.SmtpUser, _env.SmtpPassword),
        };

        await client.SendMailAsync(message, ct);
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
}
