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
}
