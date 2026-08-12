using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// A file hanging off one entry in a lead's thread — a plan the customer sent, a quote
// we sent back, a photo of the plot.
//
// Attached to the ACTIVITY, not to the lead. An attachment without the message it came
// with loses most of its meaning: "here is the survey" and the survey belong together,
// and a flat per-lead file list would make a six-month thread an unordered pile with no
// way to tell which quote version was the one actually sent.
//
// The bytes live in Azure Blob, never in SQL — same split as HouseImage and CaseImage.
// This row is the metadata and the key; ImageStore/BlobImageSource own the object.
public class LeadAttachment
{
    public int Id { get; set; }

    public int LeadActivityId { get; set; }
    public LeadActivity? Activity { get; set; }

    // What the customer or salesperson called it. Shown in the UI, and used as the
    // filename when the file is sent out again over email.
    //
    // NOT part of the storage path. A customer-supplied filename is untrusted input:
    // used as a key it invites traversal ("../../") and collisions between two people
    // who both attached "scan.pdf". BlobKey below is minted by us.
    [Required]
    [MaxLength(400)] public string FileName { get; set; } = "";

    // The blob object key, minted as "leads/{leadId}/{guid}{ext}" — never derived from
    // FileName, for the reason above.
    [Required]
    [MaxLength(400)] public string BlobKey { get; set; } = "";

    // Sniffed and validated on upload rather than trusted from the browser, which sends
    // whatever it likes. Stored so a download can serve the right Content-Type instead
    // of forcing everything to octet-stream.
    [MaxLength(200)] public string? ContentType { get; set; }

    // Bytes. Needed to render a size in the UI without a round trip to Blob, and to
    // enforce the total-size ceiling when a reply carries several attachments — Graph
    // rejects a message whose attachments exceed its own limit, and finding that out at
    // send time means a lost draft.
    public long SizeBytes { get; set; }

    // Who put it there, as an Entra UPN. NULL MEANS THE CUSTOMER — same convention as
    // LeadActivity.ActorUpn, and it carries the same meaning: an inbound attachment has
    // no staff uploader.
    [MaxLength(320)] public string? UploadedByUpn { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
