using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Services;

namespace Controllers;

// The rules both pipeline panels apply to what arrives on the wire: the admin's
// (AdminPipelineController, AdminPipelineFilesController) and the representative's
// (RepPipelineController, #38).
//
// One copy, because the two controllers accept the same request shapes on purpose — the SPA
// page is shared — and a rule that lived in each would drift the first time somebody fixed
// one of them. Everything here is static and pure: it reads a request and returns the
// sentences to refuse it with, and never touches a store. The refusals are English, like
// every other one in the panel's API (see CustomerAdminService.Validate): the SPA translates
// stable KEYS for stored values, and validation messages have always travelled as prose.
//
// Internal, and tested through reflection like the controllers' own private statics were
// before they moved here (AdminValidationTests).
internal static class PipelineRules
{
    /// <summary>
    /// Everything wrong with the customer's own details on a field edit.
    ///
    /// These three are here at all because a name or an address mistyped at enquiry time was
    /// previously uncorrectable: the offer behind the lead is an immutable event and must
    /// keep saying what the form said, so the lead row is the only place the correction can
    /// go, and this endpoint did not accept it.
    ///
    /// ABSENT AND EMPTY ARE DIFFERENT here, exactly as they are for every other field on
    /// this endpoint: null is "this save is not about that box, leave it alone", and a blank
    /// string is "clear it". Collapsing the two would make the panel wipe a phone number
    /// every time somebody saved a note from a form that does not carry one.
    /// </summary>
    /// <param name="storedEmail">
    /// What is in the column now. The panel resends every field on every save, so the email
    /// box arrives on a save that was about the follow-up date — and this column has never
    /// been validated on the way in (see LeadService.StoredEmailAsync). Comparing against it
    /// is what keeps a pre-existing bad address blocking an attempt to change it rather than
    /// every other edit on the row.
    /// </param>
    public static List<string> ValidateContact(AdminPipelineController.FieldsChange body, string? storedEmail)
    {
        var errors = new List<string>();

        // Blank is a real edit for the other two and an impossible one for this: the column
        // is NOT NULL, and every list on the board is a column of names — a nameless row is
        // one nobody can find again to fix. So it is refused rather than stored or quietly
        // ignored, because a save that reports success and keeps the old name is how someone
        // walks away believing they renamed a lead.
        if (body.Name is not null && string.IsNullOrWhiteSpace(body.Name))
            errors.Add("A lead has to keep a name.");
        else if (body.Name is not null && body.Name.Trim().Length > 200)
            errors.Add("That name is too long.");

        // Only when there is something to check, and only when it is not what is already
        // there. Clearing an address is legitimate — plenty of leads arrive by phone with
        // nothing but a number — so an empty box means "no email", not "a malformed one";
        // and an untouched box means this save is not about the email at all, whatever
        // happens to be sitting in it.
        //
        // That second half is not defensive tidiness. The imported book is full of addresses
        // no parser accepts, the panel resends the box on every save, and without the
        // comparison the lead most likely to need a note or a follow-up date — an imported
        // one nobody has cleaned up — is the one lead on which nothing can be saved at all,
        // over a field the person never opened.
        var emailChanged = !string.Equals(
            (body.Email ?? "").Trim(), (storedEmail ?? "").Trim(), StringComparison.Ordinal);

        if (emailChanged && !string.IsNullOrWhiteSpace(body.Email))
        {
            // The same rule the config-email endpoint sends to; see EmailService for why it
            // is a parser and not a regex. Refused rather than stored, because an address
            // the mail transport will reject is one whose failure surfaces days later, in a
            // reply that never arrived.
            if (!EmailService.IsValidAddress(body.Email))
                errors.Add("That does not look like an email address.");
            else if (body.Email.Trim().Length > 320)
                errors.Add("That email address is too long.");
        }

        if (!string.IsNullOrWhiteSpace(body.Phone) && body.Phone.Trim().Length > 64)
            errors.Add("That phone number is too long.");

        return errors;
    }

    /// <summary>
    /// The CC box, split but NOT judged — every non-empty token survives, so that
    /// ValidateCc below gets to refuse the bad ones by name. ParseRecipients is not used
    /// here on purpose: its '@' filter would swallow exactly the token this box mistypes
    /// most — an address whose '@' became a dot — and the reply would go out with that
    /// person quietly missing, which is the very failure the strict rule exists to stop.
    /// </summary>
    public static List<string> SplitCc(string? raw) =>
        (raw ?? "")
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            // Case-insensitively, unlike ParseRecipients: capitals are not identity in an
            // address, and Arch@ и arch@ copied twice is the same person emailed twice.
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    /// <summary>
    /// Everything wrong with the CC list on a reply, checked BEFORE anything is sent.
    ///
    /// STRICT where ParseRecipients is lax, and deliberately so: the due-report's "to" box
    /// mails a colleague who watches the result arrive, while a CC here is stored against
    /// the thread and sent alongside the customer's copy — a mistyped one is a bounce the
    /// customer may see and a record that names someone who was never told. So every token
    /// meets IsValidAddress, and the refusal names the token, because "one of your
    /// addresses is wrong" out of five is not a sentence anyone can act on.
    /// </summary>
    public static List<string> ValidateCc(IReadOnlyList<string> recipients)
    {
        var errors = new List<string>();

        foreach (var address in recipients)
        {
            if (!EmailService.IsValidAddress(address))
                errors.Add($"'{address}' does not look like an email address.");
        }

        // The joined list is what LeadActivity.CcRecipients stores, so its ceiling is the
        // column's — refused here as a sentence rather than surfacing as a 500 after the
        // mail has already gone out, which is the one order of events with no way back.
        if (string.Join(", ", recipients).Length > 500)
            errors.Add("That is too many CC addresses for one reply.");

        return errors;
    }

    /// <summary>
    /// Everything wrong with the files on a reply, checked BEFORE anything is sent.
    ///
    /// Order matters here: an oversized file discovered by Graph mid-send costs the reply
    /// someone typed as well as the attachment, because there is no draft left to go back
    /// to. Refusing up front turns that into a sentence they can act on.
    /// </summary>
    public static List<string> ValidateAttachments(IEnumerable<IFormFile> files)
    {
        var errors = new List<string>();
        long total = 0;

        foreach (var file in files)
        {
            if (file.Length == 0) continue;

            // Path components stripped: the browser chose this string, and it is a label
            // rather than a location.
            var fileName = System.IO.Path.GetFileName(file.FileName ?? "");
            if (string.IsNullOrWhiteSpace(fileName))
            {
                errors.Add("One of the files has no name.");
                continue;
            }

            // Allow-listed by extension, exactly as on the upload endpoint. The browser's
            // content type is ignored: it is trivially spoofed and tells us nothing.
            if (!LeadFileStore.IsAllowed(fileName, out _))
                errors.Add($"'{System.IO.Path.GetExtension(fileName)}' files are not accepted.");

            total += file.Length;
        }

        // The total, not just each file: Exchange judges the message, so two 15 MB drawings
        // pass every per-file check and still could not go out together (see MaxEmailBytes).
        if (total > LeadFileStore.MaxEmailBytes)
        {
            errors.Add(
                $"Files sent with a reply can total at most {LeadFileStore.MaxEmailBytes / (1024 * 1024)} MB. " +
                "Attach bigger ones with a note instead, or send a link.");
        }

        return errors;
    }

    /// <summary>
    /// The files on a reply, read whole into memory for LeadMailService — after
    /// ValidateAttachments has passed them, so nothing here is judged again. Empty picks
    /// are skipped exactly as the validation skipped them.
    /// </summary>
    public static async Task<List<LeadMailService.OutgoingFile>> ReadAttachmentsAsync(
        IEnumerable<IFormFile> files, CancellationToken ct)
    {
        var attachments = new List<LeadMailService.OutgoingFile>();
        foreach (var file in files)
        {
            if (file.Length == 0) continue;

            var fileName = System.IO.Path.GetFileName(file.FileName);
            LeadFileStore.IsAllowed(fileName, out var contentType);

            using var stream = new System.IO.MemoryStream();
            await file.CopyToAsync(stream, ct);
            attachments.Add(new LeadMailService.OutgoingFile(fileName, contentType, stream.ToArray()));
        }

        return attachments;
    }

    /// <summary>
    /// Why a single uploaded file is refused, or null when it may be stored — in which case
    /// <paramref name="fileName"/> is the browser's name with any path stripped and
    /// <paramref name="contentType"/> is ours, from the extension. The first failing rule
    /// is the one reported: these are checked in the order a person can act on them.
    /// </summary>
    public static string? UploadRefusal(IFormFile? file, out string fileName, out string contentType)
    {
        fileName = "";
        contentType = "";

        if (file is null || file.Length == 0)
            return "No file was uploaded.";

        if (file.Length > LeadFileStore.MaxBytes)
            return $"Files must be under {LeadFileStore.MaxBytes / (1024 * 1024)} MB.";

        // The browser's filename is the only thing we trust it for, and only as a label —
        // strip any path it carries so a crafted name cannot influence anything downstream.
        fileName = System.IO.Path.GetFileName(file.FileName ?? "");
        if (string.IsNullOrWhiteSpace(fileName))
            return "The file has no name.";

        // Allow-list by extension. The browser-supplied content type is ignored entirely:
        // it is trivially spoofed and tells us nothing we should act on.
        if (!LeadFileStore.IsAllowed(fileName, out contentType))
            return $"'{System.IO.Path.GetExtension(fileName)}' files are not accepted.";

        return null;
    }

    /// <summary>
    /// When a hand-logged activity happened, off the wire. Null when nothing readable was
    /// sent, which the service then reads as "now".
    /// </summary>
    public static DateTimeOffset? ParseOccurredAt(string? raw)
    {
        if (!string.IsNullOrWhiteSpace(raw) && DateTimeOffset.TryParse(raw, out var parsed))
            return parsed;

        return null;
    }
}
