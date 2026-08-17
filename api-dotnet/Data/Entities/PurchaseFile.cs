using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace Data.Entities;

// What a file hanging off a purchase IS. Two slots on the form, one column here.
//
// A Kind column rather than eight columns on Purchase (FileName/BlobKey/ContentType/Size,
// twice). The column version cannot hold a corrected invoice without losing the one it
// replaces, and adding a third document later would mean another migration and four more
// columns; this way it is a new key.
public static class PurchaseFileKinds
{
    // Проформа фактура — the one issued against the deposit.
    public const string PrepaidInvoice = "prepaid-invoice";

    // Финална фактура — issued on completion.
    public const string FinalInvoice = "final-invoice";

    // Anything else worth keeping with the deal: a signed contract, a delivery note.
    public const string Other = "other";

    public static readonly IReadOnlyList<string> All =
        new[] { PrepaidInvoice, FinalInvoice, Other };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);
}

// A document belonging to one purchase — the proforma, the final invoice, the contract.
//
// The bytes live in Azure Blob, never in SQL; this row is the metadata and the key. Same
// split as LeadAttachment, and the same PRIVATE container: an invoice carries a name, an
// address and an ЕГН, so it must never be reachable through /api/img, which is
// unauthenticated by design.
public class PurchaseFile
{
    public int Id { get; set; }

    public int PurchaseId { get; set; }
    public Purchase? Purchase { get; set; }

    // See PurchaseFileKinds. Not an enum, for the usual reason.
    [Required]
    [MaxLength(30)] public string Kind { get; set; } = PurchaseFileKinds.Other;

    // What the uploader called it. Shown in the panel and used as the download filename.
    //
    // NOT part of the storage path — a browser-supplied filename is untrusted input, and as
    // a key it invites traversal and collides the moment two people both upload
    // "faktura.pdf". BlobKey is minted by us.
    [Required]
    [MaxLength(400)] public string FileName { get; set; } = "";

    [Required]
    [MaxLength(400)] public string BlobKey { get; set; } = "";

    // Resolved from the extension allow-list on upload, not trusted from the browser.
    [MaxLength(200)] public string? ContentType { get; set; }

    public long SizeBytes { get; set; }

    // Entra UPN of whoever uploaded it. Unlike LeadAttachment this is never null in
    // practice — a customer cannot reach this table — but it stays nullable so an imported
    // document has somewhere to be.
    [MaxLength(320)] public string? UploadedByUpn { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
