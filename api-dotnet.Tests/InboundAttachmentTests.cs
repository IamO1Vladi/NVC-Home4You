using System.Text.Json;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The rules that decide whether a customer's file makes it off an inbound email and into
// the thread — pinned as data, because the first version of this logic silently dropped
// every real attachment for weeks and nothing at runtime said so. Each case here is a
// real shape mail produces, not a hypothetical.
public class InboundAttachmentTests
{
    private static LeadMailPoller.InboundFileDecision Decide(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return LeadMailPoller.DecideInboundFile(doc.RootElement);
    }

    [Fact]
    public void An_ordinary_pdf_attachment_is_kept()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAA1",
          "name": "plot-survey.pdf", "contentType": "application/pdf",
          "size": 2000000, "isInline": false }
        """);

        Assert.True(d.Keep);
        Assert.Equal("AAA1", d.Id);
        Assert.Equal("plot-survey.pdf", d.FileName);
        Assert.Equal("application/pdf", d.ContentType);
        Assert.Equal(2000000, d.SizeHint);
    }

    [Fact]
    public void A_forwarded_email_is_not_a_file_and_not_a_loss_worth_logging()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.itemAttachment", "id": "AAA2",
          "name": "FW: our offer", "size": 40000 }
        """);

        Assert.False(d.Keep);
        Assert.Null(d.Reason);
    }

    [Fact]
    public void A_onedrive_link_is_not_a_file()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.referenceAttachment", "id": "AAA3",
          "name": "photos", "size": 0 }
        """);

        Assert.False(d.Keep);
    }

    [Fact]
    public void A_missing_type_discriminator_does_not_cost_the_file()
    {
        // Graph omitting the annotation must degrade to "try it", never to "drop it":
        // the $value download fails harmlessly for the exotic kinds.
        var d = Decide("""
        { "id": "AAA4", "name": "bank-confirmation.pdf", "size": 90000 }
        """);

        Assert.True(d.Keep);
        Assert.Equal("application/pdf", d.ContentType);
    }

    [Fact]
    public void The_signature_logo_is_skipped()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAA5",
          "name": "image001.png", "size": 18000, "isInline": true }
        """);

        Assert.False(d.Keep);
        Assert.Contains("signature", d.Reason);
    }

    [Fact]
    public void A_phone_photo_pasted_into_the_body_is_kept()
    {
        // The way most customers send a photo IS an inline image — skipping all inline
        // parts is how this feature shipped without existing.
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAA6",
          "name": "IMG_4211.jpeg", "size": 3500000, "isInline": true }
        """);

        Assert.True(d.Keep);
    }

    [Fact]
    public void An_inline_image_exactly_on_the_noise_line_is_kept()
    {
        var d = Decide($$"""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAA7",
          "name": "scan.png", "size": {{LeadMailPoller.InlineImageNoiseBytes}}, "isInline": true }
        """);

        Assert.True(d.Keep);
    }

    [Fact]
    public void An_apple_mail_pdf_marked_inline_is_kept_however_small()
    {
        // Apple Mail stamps genuine attachments as inline. The noise line applies to
        // images only — a 40 KB PDF is a signed offer, not a logo.
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAA8",
          "name": "oferta-signed.pdf", "size": 40000, "isInline": true }
        """);

        Assert.True(d.Keep);
    }

    [Fact]
    public void An_executable_is_refused_at_the_same_gate_as_uploads()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAA9",
          "name": "invoice.exe", "size": 300000 }
        """);

        Assert.False(d.Keep);
        Assert.Equal("type not accepted", d.Reason);
    }

    [Fact]
    public void An_oversize_file_is_skipped_with_its_size_named()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAB1",
          "name": "video-walkthrough.zip", "size": 30000000 }
        """);

        Assert.False(d.Keep);
        Assert.Contains("over the limit", d.Reason);
    }

    [Fact]
    public void The_listing_gate_allows_for_mime_inflation()
    {
        // Graph's size counts the base64-encoded part — a real ~18.7 MB file lists as
        // ~25 MB. Gating the inflated number against the raw 20 MB cap was quietly
        // lowering the inbound ceiling to ~15 MB; the raw cap is enforced on the
        // download's Content-Length instead.
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAB4",
          "name": "full-catalogue.pdf", "size": 25000000 }
        """);

        Assert.True(d.Keep);
    }

    [Fact]
    public void A_windows_path_is_stripped_even_where_backslash_is_not_the_separator()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAB5",
          "name": "C:\\Users\\ivan\\Desktop\\scan.pdf", "size": 50000 }
        """);

        Assert.True(d.Keep);
        Assert.Equal("scan.pdf", d.FileName);
    }

    [Fact]
    public void A_mac_pasted_tiff_is_kept()
    {
        // Apple Mail on macOS converts pasted images to TIFF. Inline and well above the
        // signature-noise line, so both new rules have to hold for this one file.
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAB6",
          "name": "PastedGraphic-1.tiff", "size": 800000, "isInline": true }
        """);

        Assert.True(d.Keep);
        Assert.Equal("image/tiff", d.ContentType);
    }

    [Fact]
    public void A_path_in_the_senders_name_is_stripped_to_its_filename()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAB2",
          "name": "../secret/scan.pdf", "size": 50000 }
        """);

        Assert.True(d.Keep);
        Assert.Equal("scan.pdf", d.FileName);
    }

    [Fact]
    public void A_nameless_attachment_is_skipped()
    {
        var d = Decide("""
        { "@odata.type": "#microsoft.graph.fileAttachment", "id": "AAB3", "size": 50000 }
        """);

        Assert.False(d.Keep);
    }

}
