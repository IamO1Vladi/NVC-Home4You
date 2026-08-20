using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace Data.Entities;

// What a file hanging off a purchase IS. Four slots on the form, one column here.
//
// A customer pays TWICE (owner, 2026-08-20): the капаро first, then the final payment. Each
// of those two payments produces a проформа asking for the money and then a фактура once it
// has arrived, so one sale carries four documents and not two.
//
// A Kind column rather than sixteen columns on Purchase (FileName/BlobKey/ContentType/Size,
// four times). The column version cannot hold a corrected invoice without losing the one it
// replaces, and the day the paperwork grows a fifth step would mean another migration and
// four more columns; this way it is a new key.
public static class PurchaseFileKinds
{
    // Проформа за капарото — what the customer is asked to pay to hold the build.
    public const string DepositProforma = "deposit-proforma";

    // Фактура за капарото — issued once that money has come in.
    public const string DepositInvoice = "deposit-invoice";

    // Проформа за финалното плащане — the balance, asked for before the house ships.
    public const string FinalProforma = "final-proforma";

    // Финална фактура — issued on completion.
    public const string FinalInvoice = "final-invoice";

    // Anything else worth keeping with the deal: a signed contract, a delivery note.
    public const string Other = "other";

    // What IsValid answers from, and the only thing this list is read for — nothing hands it
    // to the panel the way /customers/categories hands over the category list, so the sheet
    // keeps a second copy of these keys in DOCUMENT_GROUPS. Both copies have to move
    // together, in opposite ways: a key the sheet offers and this list does not is a 400 on
    // upload, and a key added only here is a document nobody can file.
    //
    // Every one of the five is drawn somewhere. Four have a slot of their own; 'other' has
    // the fifth AND is the sheet's catch-all, so it also collects a file whose kind this
    // list has never held — one renamed by a migration the database has not been given yet,
    // or filed by an older build. Nothing in the table renders in no slot, which matters
    // more than it sounds: a document that appears nowhere is indistinguishable from a
    // deleted one, and the natural answer to a deleted invoice is to upload it again.
    //
    // Kept in the order the paperwork actually happens in, because a reader arriving at this
    // list should be able to see the shape of a sale in it. 'other' sits last as the one that
    // belongs to no payment. Reordering here moves nothing on screen.
    public static readonly IReadOnlyList<string> All =
        new[] { DepositProforma, DepositInvoice, FinalProforma, FinalInvoice, Other };

    public static bool IsValid(string? key) => key is not null && All.Contains(key);
}

// A document belonging to one purchase — a proforma, an invoice, the contract.
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
