using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Models;

namespace Controllers;

// Both lead endpoints answer the same three-way question, so it lives in one place.
//
// The status code is the only thing the frontend reads (it checks res.ok and ignores the
// body), so it has to carry the meaning:
//
//   write landed                        -> 200. Normal case.
//   write failed, sales emailed         -> 200. The lead reached a human, which is what
//                                         actually matters. Telling the customer to try
//                                         again would just produce a duplicate enquiry
//                                         against a Quickbase field that is still broken.
//   write failed, sales not emailed     -> 502. Nothing captured it anywhere. This is the
//                                         case that used to return 200 and silently lose
//                                         the lead; an apology the customer can act on is
//                                         better than a thank-you that means nothing.
internal static class LeadResponse
{
    public static IActionResult For(
        ControllerBase controller,
        ILogger logger,
        string kind,
        string? leadEmail,
        LeadWriteResult write,
        bool salesNotified)
    {
        if (write.Ok)
            return controller.Ok(new { recordId = write.RecordId, stored = true });

        if (salesNotified)
        {
            logger.LogError(
                "A {Kind} from {Email} was not stored ({Error}), but the sales notification email sent, so the lead is not lost. Fix the store.",
                kind, leadEmail, write.Error);
            return controller.Ok(new { recordId = (long?)null, stored = false });
        }

        logger.LogError(
            "A {Kind} from {Email} was LOST: the write failed ({Error}) and the sales notification email did not send.",
            kind, leadEmail, write.Error);

        return controller.StatusCode(
            StatusCodes.Status502BadGateway,
            new { error = "We could not record your enquiry. Please try again or call us.", stored = false });
    }

    // Whether the honeypot caught something. The field is off-screen and unlabelled in the
    // SPA, so a human cannot reach it; a value in it is a bot that filled every box it found.
    public static bool HoneypotTripped(string? website) => !string.IsNullOrWhiteSpace(website);

    // The answer a tripped honeypot gets: the success shape above, byte for byte in what
    // matters, with nothing stored and nothing emailed. A 4xx here would be a signal — a bot
    // operator who learns which field gave them away simply stops filling it — so the decoy
    // must be indistinguishable from the real thing to anyone reading the status code.
    //
    // Logged at Information, not Warning: it is the system working, and an alert that fires
    // on every spam attempt is one that gets muted. Only the address's domain is kept, which
    // is enough to see a wave and is not a person.
    public static IActionResult Decoy(ControllerBase controller, ILogger logger, string kind, string? leadEmail)
    {
        logger.LogInformation(
            "A {Kind} tripped the honeypot (sender domain {Domain}); nothing stored, nothing sent.",
            kind, EmailDomain(leadEmail));

        // A plausible id rather than null: the real success always carries one, so a null
        // here would be the one tell the status code was chosen to avoid.
        return controller.Ok(new { recordId = (long?)Random.Shared.Next(1000, 100000), stored = true });
    }

    private static string EmailDomain(string? email)
    {
        var at = email?.LastIndexOf('@') ?? -1;
        return at < 0 ? "(none)" : email![(at + 1)..].Trim();
    }
}
