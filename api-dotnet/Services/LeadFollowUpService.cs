using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Models;

namespace Services;

/// <summary>
/// The overdue follow-up report: who we promised to contact by now and have not.
///
/// The report itself is nothing but a query — LeadPipelineService.ListDueAsync. What lives
/// here is the part with judgement in it: turning that list into an email somebody reads on
/// a phone at eight in the morning and acts on.
///
/// EVERY LEAD IS A LINK, and the links are absolute. A report you have to go and look
/// something up from is a report that gets skimmed and closed; one where the name is the
/// way in gets worked through. That is also why the mail carries no detail beyond the line
/// each lead needs to be recognised — the panel holds the conversation, and duplicating it
/// into an inbox would put customer history in a place with none of the panel's protection.
/// </summary>
public class LeadFollowUpService
{
    private readonly LeadPipelineService _pipeline;
    private readonly EmailService _email;
    private readonly EnvConfig _env;
    private readonly ILogger<LeadFollowUpService> _log;

    public LeadFollowUpService(
        LeadPipelineService pipeline, EmailService email, EnvConfig env, ILogger<LeadFollowUpService> log)
    {
        _pipeline = pipeline;
        _email = email;
        _env = env;
        _log = log;
    }

    public bool IsConfigured => _email.IsConfigured;

    public enum ReportOutcome { Sent, NotConfigured, NoRecipients, NothingDue, Failed }

    public record ReportResult(ReportOutcome Outcome, int Count, IReadOnlyCollection<string> Recipients, string? Error)
    {
        public bool Ok => Outcome == ReportOutcome.Sent;
    }

    /// <summary>
    /// Sends the overdue list to whoever asked for it.
    ///
    /// <paramref name="baseUrl"/> is the panel's own origin, passed in from the request
    /// rather than configured: this app is reached on more than one hostname over its life
    /// (the App Service default, then the real domain), and a link built from a stale
    /// setting is a link that silently goes nowhere.
    /// </summary>
    public async Task<ReportResult> SendDueReportAsync(
        IReadOnlyCollection<string> recipients, string baseUrl, string? requestedBy, CancellationToken ct)
    {
        if (!IsConfigured)
            return new ReportResult(ReportOutcome.NotConfigured, 0, recipients, "Email is not configured.");

        if (recipients.Count == 0)
            return new ReportResult(ReportOutcome.NoRecipients, 0, recipients, "No valid email address to send to.");

        var due = await _pipeline.ListDueAsync(DateTimeOffset.UtcNow, ownerUpn: null, ct);

        // Nothing due is a real answer and worth reporting as one, but it is not worth an
        // email. Sending "you have 0 things to do" every morning is how a report becomes
        // something people filter out of their inbox, taking the useful ones with it.
        if (due.Count == 0)
            return new ReportResult(ReportOutcome.NothingDue, 0, recipients, null);

        var subject = $"NVC — {due.Count} {(due.Count == 1 ? "lead" : "leads")} за връзка / to follow up";
        var html = BuildHtml(due, baseUrl);

        var sent = await _email.TrySendInternalReportAsync(recipients, subject, html, ct);
        if (!sent)
        {
            _log.LogError("Follow-up report requested by {Upn} could not be sent", requestedBy ?? "(unknown)");
            return new ReportResult(ReportOutcome.Failed, due.Count, recipients, "The report was not sent.");
        }

        _log.LogInformation(
            "Follow-up report with {Count} lead(s) sent to {Recipients} for {Upn}",
            due.Count, string.Join(", ", recipients), requestedBy ?? "(unknown)");

        return new ReportResult(ReportOutcome.Sent, due.Count, recipients, null);
    }

    /// <summary>
    /// Who the report goes to when nobody said. Falls back to the sales list only when the
    /// signed-in person cannot be identified — pressing a button should not mail three
    /// colleagues unless that is what was typed in the box.
    /// </summary>
    public IReadOnlyCollection<string> DefaultRecipients(string? currentUpn) =>
        !string.IsNullOrWhiteSpace(currentUpn) && currentUpn!.Contains('@')
            ? new[] { currentUpn.Trim() }
            : EmailService.ParseRecipients(_env.LeadNotifyEmail);

    /// <summary>
    /// The email. Deliberately a table of plain rows rather than anything designed: it is
    /// read on a phone, forwarded, and printed, and every one of those goes better with
    /// less.
    /// </summary>
    private static string BuildHtml(IReadOnlyList<LeadSummaryDto> due, string baseUrl)
    {
        var root = baseUrl.TrimEnd('/');
        var sb = new StringBuilder();

        sb.Append(
            """
            <div style="font-family:Segoe UI,Arial,sans-serif;color:#1b2530;max-width:640px">
            """);

        sb.Append(CultureInfo.InvariantCulture,
            $"""
             <h2 style="margin:0 0 4px;font-size:19px">За връзка днес / Due today</h2>
             <p style="margin:0 0 18px;color:#5a6572;font-size:14px">
               {due.Count} {(due.Count == 1 ? "лийд е" : "лийда са")} с изтекла дата за следващ контакт.
             </p>
             """);

        sb.Append("""<table style="border-collapse:collapse;width:100%;font-size:14px">""");

        foreach (var lead in due)
        {
            var overdue = DaysOverdue(lead.NextContactAt);
            var whenLabel = overdue switch
            {
                <= 0 => "днес / today",
                1 => "1 ден закъснение / 1 day late",
                _ => $"{overdue} дни закъснение / {overdue} days late",
            };

            // Colour carries the same thing the words do, never on its own: the row is
            // legible in a client that strips styles, and to anyone who does not separate
            // red from grey.
            var tone = overdue > 0 ? "#b4232a" : "#5a6572";

            sb.Append(CultureInfo.InvariantCulture,
                $"""
                 <tr>
                   <td style="padding:10px 0;border-bottom:1px solid #e3e8ee">
                     <a href="{root}/admin/pipeline?lead={lead.Id}"
                        style="font-weight:600;font-size:15px;color:#1b5e8f;text-decoration:none">{Escape(lead.Name)}</a>
                     <div style="color:{tone};font-size:13px;margin-top:2px">{Escape(whenLabel)}</div>
                     {DetailLine(lead)}
                   </td>
                 </tr>
                 """);
        }

        sb.Append("</table>");

        sb.Append(CultureInfo.InvariantCulture,
            $"""
             <p style="margin:22px 0 0">
               <a href="{root}/admin/pipeline?view=due"
                  style="display:inline-block;padding:11px 18px;background:#1b5e8f;color:#fff;
                         border-radius:8px;text-decoration:none;font-weight:600">
                 Отвори целия списък / Open the full list
               </a>
             </p>
             <p style="margin:16px 0 0;color:#8a93a0;font-size:12px">
               Изпратено от административния панел на NVC-HOME4YOU.
             </p>
             </div>
             """);

        return sb.ToString();
    }

    // The one line that lets someone recognise a lead without opening it: what they want,
    // whose it is, and what was supposed to happen. Anything absent is simply left out
    // rather than rendered as an empty label.
    private static string DetailLine(LeadSummaryDto lead)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(lead.ModelLabel)) parts.Add(Escape(lead.ModelLabel));
        if (!string.IsNullOrWhiteSpace(lead.Status)) parts.Add(Escape(lead.Status));
        if (!string.IsNullOrWhiteSpace(lead.OwnerUpn)) parts.Add(Escape(lead.OwnerUpn));

        var meta = parts.Count == 0
            ? ""
            : $"""<div style="color:#5a6572;font-size:13px;margin-top:2px">{string.Join(" · ", parts)}</div>""";

        var step = string.IsNullOrWhiteSpace(lead.NextStep)
            ? ""
            : $"""<div style="font-size:13px;margin-top:4px">{Escape(lead.NextStep)}</div>""";

        return meta + step;
    }

    private static int DaysOverdue(string? iso)
    {
        if (!DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var due))
        {
            return 0;
        }

        return (int)(DateTimeOffset.UtcNow.UtcDateTime.Date - due.UtcDateTime.Date).TotalDays;
    }

    // Customer names and free-text next steps go straight into an HTML document. An
    // apostrophe or an ampersand in a name is the common case; a tag in one is not, and
    // this is the reason it stays that way.
    private static string Escape(string value) => WebUtility.HtmlEncode(value);
}
