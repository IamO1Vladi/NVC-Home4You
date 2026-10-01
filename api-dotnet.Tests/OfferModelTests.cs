using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Which gallery model an offer is about. Sales could not tell: the id was the only thing
// sent, it is not unique on live, and nothing showed it anywhere but as a bare number.
//
// The title and path come from an anonymous public form and land in a mail from our own
// sales system, so most of what is pinned here is what gets REFUSED — a link that could
// point off-site is a phishing mail with our name on it.
public class OfferModelTests
{
    private const string Site = "https://nvc-home4you.eu";

    // --- The link -----------------------------------------------------------------------

    [Theory]
    [InlineData("/en/gallery/space-house", "/en/gallery/", "space-house")]
    [InlineData("/bg/galeriq/космическа-къща", "/bg/galeriq/", "космическа-къща")]
    [InlineData("/el/gkaleri/σπίτι-τύπου-container", "/el/gkaleri/", "σπίτι-τύπου-container")]
    [InlineData("/bg/galeriq/къща-73-m2", "/bg/galeriq/", "къща-73-m2")]
    [InlineData("/en/gallery/15", "/en/gallery/", "15")]
    public void A_gallery_product_path_becomes_an_absolute_link_on_our_site(string path, string prefix, string slug)
    {
        Assert.Equal(Site + prefix + Uri.EscapeDataString(slug), OfferModel.UrlFor(path));
    }

    [Fact]
    public void An_already_encoded_slug_is_decoded_once_and_comes_out_the_same()
    {
        // A browser hands Cyrillic paths around percent-encoded, so either form may arrive.
        var raw = OfferModel.UrlFor("/bg/galeriq/къща-37-m2");
        var encoded = OfferModel.UrlFor("/bg/galeriq/" + Uri.EscapeDataString("къща-37-m2"));

        Assert.NotNull(raw);
        Assert.Equal(raw, encoded);
        Assert.Equal(Site + "/bg/galeriq/%D0%BA%D1%8A%D1%89%D0%B0-37-m2", raw);
    }

    [Fact]
    public void Surrounding_whitespace_is_forgiven()
    {
        Assert.Equal(Site + "/en/gallery/space-house", OfferModel.UrlFor("  /en/gallery/space-house \n"));
    }

    [Theory]
    // Absolute URLs, even our own: the path is rebuilt on our base, never echoed.
    [InlineData("https://nvc-home4you.eu/bg/galeriq/kashta")]
    [InlineData("https://evil.example/bg/galeriq/kashta")]
    [InlineData("http://evil.example")]
    // Protocol-relative and scheme tricks.
    [InlineData("//evil.example/bg/galeriq/kashta")]
    [InlineData("/bg/galeriq//evil.example")]
    [InlineData("javascript:alert(1)")]
    [InlineData("/bg/galeriq/javascript:alert(1)")]
    [InlineData("data:text/html,hi")]
    // Other pages of our own site.
    [InlineData("/bg/kontakti")]
    [InlineData("/bg/galeriq")]
    [InlineData("/bg/")]
    [InlineData("/bg/galeriqX/kashta")]
    // An empty slug, or more than one segment.
    [InlineData("/bg/galeriq/")]
    [InlineData("/bg/galeriq/kashta/")]
    [InlineData("/bg/galeriq/kashta/evil")]
    [InlineData("/bg/galeriq/../../evil")]
    [InlineData("/bg/galeriq/kashta%2Fevil")]
    // Query strings and fragments.
    [InlineData("/bg/galeriq/kashta?next=https://evil.example")]
    [InlineData("/bg/galeriq/kashta#top")]
    [InlineData("/bg/galeriq/kashta%3Fx")]
    // Backslashes, which some browsers read as slashes.
    [InlineData("/bg/galeriq/kashta\\evil")]
    [InlineData("\\\\evil.example\\bg\\galeriq\\kashta")]
    [InlineData("/bg/galeriq/kashta%5Cevil")]
    // Decoded only once: a double-encoded slash is still a '%' after one pass.
    [InlineData("/bg/galeriq/kashta%252Fevil")]
    // Whitespace and control characters smuggled inside the slug.
    [InlineData("/bg/galeriq/kashta evil")]
    [InlineData("/bg/galeriq/kashta%0A")]
    [InlineData("/bg/galeriq/kashta%00")]
    // Not the shape a slug ever has.
    [InlineData("/bg/galeriq/-kashta")]
    [InlineData("/bg/galeriq/kashta--x")]
    [InlineData("/bg/galeriq/%ZZ")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Anything_that_is_not_one_of_our_product_pages_gets_no_link(string? path)
    {
        Assert.Null(OfferModel.UrlFor(path));
    }

    [Fact]
    public void An_absurdly_long_slug_gets_no_link()
    {
        Assert.NotNull(OfferModel.UrlFor("/en/gallery/" + new string('a', OfferModel.MaxSlugLength)));
        Assert.Null(OfferModel.UrlFor("/en/gallery/" + new string('a', OfferModel.MaxSlugLength + 1)));
    }

    // --- The title ----------------------------------------------------------------------

    [Theory]
    [InlineData("Космическа къща", "Космическа къща")]
    [InlineData("  Космическа къща  ", "Космическа къща")]
    [InlineData("Space\r\nhouse", "Space house")]
    [InlineData("Space\t\t house\u0007 73", "Space house 73")]
    [InlineData("Space\u2028house", "Space house")]
    [InlineData("Space\u202Ehouse", "Spacehouse")]       // a right-to-left override is removed, not spaced
    [InlineData("Spa\u200Bce house", "Space house")]     // so is a zero-width space
    public void A_title_is_flattened_to_one_clean_line(string raw, string expected)
    {
        Assert.Equal(expected, OfferModel.CleanText(raw, OfferModel.MaxTitleLength));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \r\n\t ")]
    [InlineData("\u202E\u200B")]
    public void A_title_with_nothing_readable_in_it_is_no_title(string? raw)
    {
        Assert.Null(OfferModel.CleanText(raw, OfferModel.MaxTitleLength));
    }

    [Fact]
    public void Invisible_astral_formatting_is_removed_too()
    {
        // Unicode tag characters (U+E0020-E007F) are Format code points outside the BMP:
        // a char-by-char check saw only their surrogate halves and let hidden text through.
        var hidden = string.Concat("ignore".Select(c => char.ConvertFromUtf32(0xE0000 + c)));

        Assert.Equal("Space house", OfferModel.CleanText("Space " + hidden + "house", OfferModel.MaxTitleLength));
        Assert.Null(OfferModel.CleanText(hidden, OfferModel.MaxTitleLength));
    }

    [Fact]
    public void A_title_is_capped()
    {
        var title = OfferModel.CleanText(new string('к', 500), OfferModel.MaxTitleLength);

        Assert.Equal(OfferModel.MaxTitleLength, title!.Length);
    }

    [Fact]
    public void The_cap_never_splits_a_surrogate_pair()
    {
        // 199 letters then an emoji: cutting at 200 would keep half of it.
        var raw = new string('a', OfferModel.MaxTitleLength - 1) + "😀 tail";

        var title = OfferModel.CleanText(raw, OfferModel.MaxTitleLength)!;

        Assert.Equal(OfferModel.MaxTitleLength - 1, title.Length);
        Assert.False(char.IsHighSurrogate(title[^1]));
    }

    // --- The whole description ----------------------------------------------------------

    [Fact]
    public void An_enquiry_that_names_no_model_has_no_description()
    {
        Assert.Null(OfferModel.From(null, null, null));
        Assert.Null(OfferModel.From(" ", "", "/bg/galeriq/kashta"));
        Assert.Null(OfferModel.From(new OfferDto("A", "a@example.com", null, "hi", null)));
    }

    [Fact]
    public void A_gallery_enquiry_carries_id_title_and_link()
    {
        var model = OfferModel.From("15", "Космическа къща", "/bg/galeriq/космическа-къща")!;

        Assert.Equal("15", model.Id);
        Assert.Equal("Космическа къща", model.Title);
        Assert.Equal(Site + "/bg/galeriq/" + Uri.EscapeDataString("космическа-къща"), model.Url);
    }

    [Fact]
    public void An_id_alone_is_still_described_so_the_old_information_is_kept()
    {
        var model = OfferModel.From("15", null, null)!;

        Assert.Equal("15", model.Id);
        Assert.Null(model.Title);
        Assert.Null(model.Url);
        Assert.Null(model.MessageLine);
    }

    [Fact]
    public void A_link_without_a_title_is_dropped()
    {
        Assert.Null(OfferModel.From("15", null, "/bg/galeriq/kashta")!.Url);
    }

    [Fact]
    public void A_bad_path_costs_the_link_but_not_the_title()
    {
        var model = OfferModel.From("15", "Космическа къща", "https://evil.example/bg/galeriq/kashta")!;

        Assert.Equal("Космическа къща", model.Title);
        Assert.Null(model.Url);
        Assert.Equal("Модел от сайта: Космическа къща", model.MessageLine);
    }

    [Fact]
    public void The_id_is_cleaned_and_capped_to_the_column_it_is_stored_in()
    {
        var model = OfferModel.From("1\r\n5" + new string('9', 200), null, null)!;

        Assert.StartsWith("1 5", model.Id);
        Assert.Equal(OfferModel.MaxIdLength, model.Id!.Length);
    }

    [Fact]
    public void The_message_line_goes_first_with_a_blank_line_before_the_customers_text()
    {
        var model = OfferModel.From("15", "Космическа къща", "/en/gallery/space-house");

        Assert.Equal(
            "Модел от сайта: Космическа къща — https://nvc-home4you.eu/en/gallery/space-house\n\nDelivery to Varna?",
            OfferModel.WithModelLine(model, "  Delivery to Varna?  "));
        Assert.Equal(
            "Модел от сайта: Космическа къща — https://nvc-home4you.eu/en/gallery/space-house",
            OfferModel.WithModelLine(model, "   "));
    }

    [Fact]
    public void The_stored_line_shows_a_Cyrillic_link_readable_while_the_href_stays_escaped()
    {
        var model = OfferModel.From("15", "Космическа къща", "/bg/galeriq/космическа-къща")!;

        // Escaped, it was 154 characters of %D0%.. that pushed the customer's words out of
        // the Enquiries preview; nothing renders the stored text as a link anyway.
        Assert.Equal("Модел от сайта: Космическа къща — https://nvc-home4you.eu/bg/galeriq/космическа-къща", model.MessageLine);
        Assert.Equal(Site + "/bg/galeriq/" + Uri.EscapeDataString("космическа-къща"), model.Url);
    }

    [Fact]
    public void Without_a_title_the_message_is_left_exactly_as_sent()
    {
        Assert.Equal("  hi  ", OfferModel.WithModelLine(OfferModel.From("15", null, null), "  hi  "));
        Assert.Equal("  hi  ", OfferModel.WithModelLine(null, "  hi  "));
        Assert.Null(OfferModel.WithModelLine(null, null));
    }

    // --- The payload --------------------------------------------------------------------

    [Fact]
    public void The_two_new_fields_bind_from_camel_case_json()
    {
        // The options MVC itself reads request bodies with, so this is the binding the
        // controller actually gets rather than a lookalike.
        var options = new Microsoft.AspNetCore.Mvc.JsonOptions().JsonSerializerOptions;
        const string json = """
            {"name":"Ivan","email":"ivan@example.com","phone":"","project":"Hi","modelId":"15","locale":"bg",
             "modelTitle":"Космическа къща","modelPath":"/bg/galeriq/космическа-къща"}
            """;

        var dto = JsonSerializer.Deserialize<OfferDto>(json, options)!;

        Assert.Equal("15", dto.ModelId);
        Assert.Equal("Космическа къща", dto.ModelTitle);
        Assert.Equal("/bg/galeriq/космическа-къща", dto.ModelPath);
    }

    [Fact]
    public void A_payload_without_them_still_binds_as_before()
    {
        // Every non-gallery enquiry, and any page that was open before this shipped.
        var options = new Microsoft.AspNetCore.Mvc.JsonOptions().JsonSerializerOptions;
        const string json = """{"name":"Ivan","email":"ivan@example.com","phone":"","project":"Hi","modelId":"","locale":"en"}""";

        var dto = JsonSerializer.Deserialize<OfferDto>(json, options)!;

        Assert.Equal("Hi", dto.Project);
        Assert.Equal("en", dto.Locale);
        Assert.Null(dto.ModelTitle);
        Assert.Null(dto.ModelPath);
        Assert.Null(OfferModel.From(dto));
    }
}

// The sales notification is where the model has to be readable at a glance: it is the
// first thing anyone sees of a new enquiry, and the one place a link can be clicked.
public class OfferNotificationModelTests
{
    // BuildLeadNotification is private and has no seam, like BuildAutoresponder; see
    // AutoresponderSignatureTests for why reflection is the cheaper route.
    private static (string Subject, string Html) Render(OfferModel? model, bool isOffer = true)
    {
        var env = new EnvConfig(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>()).Build());
        var service = new EmailService(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance);

        var method = typeof(EmailService).GetMethod("BuildLeadNotification",
            BindingFlags.Instance | BindingFlags.NonPublic)!;
        var result = method.Invoke(service,
            new object?[] { isOffer, "Ivan", "ivan@example.com", "+359 88 000 0000", "Delivery to Varna?", model })!;

        var type = result.GetType();
        return (
            (string)type.GetField("Item1")!.GetValue(result)!,
            (string)type.GetField("Item2")!.GetValue(result)!);
    }

    [Fact]
    public void The_model_is_named_and_linked_with_its_id_beside_it()
    {
        var model = OfferModel.From("15", "Космическа къща", "/bg/galeriq/космическа-къща");
        var href = "https://nvc-home4you.eu/bg/galeriq/" + Uri.EscapeDataString("космическа-къща");

        var (_, html) = Render(model);

        Assert.Contains("<strong>Модел:</strong>", html);
        Assert.Contains($@"<a href=""{href}"">Космическа къща</a>", html);
        Assert.Contains("(№15)", html);
        // Above the details, where it is read first.
        Assert.True(html.IndexOf("Модел:", StringComparison.Ordinal) < html.IndexOf("Детайли:", StringComparison.Ordinal));
    }

    [Fact]
    public void The_subject_keeps_its_prefix_and_gains_the_title()
    {
        // Mail rules in the sales inbox may key on the prefix, so it must not move.
        var (subject, _) = Render(OfferModel.From("15", "Космическа къща", "/bg/galeriq/kashta"));

        Assert.Equal("Ново запитване за оферта: Ivan — Космическа къща", subject);
    }

    [Fact]
    public void With_only_an_id_the_number_is_still_shown()
    {
        var (subject, html) = Render(OfferModel.From("15", null, null));

        Assert.Contains("<strong>Модел:</strong> №15", html);
        Assert.DoesNotContain("<a href=\"https://nvc-home4you.eu", html);
        Assert.Equal("Ново запитване за оферта: Ivan", subject);
    }

    [Fact]
    public void A_title_without_a_valid_link_is_plain_text()
    {
        var (_, html) = Render(OfferModel.From("15", "Космическа къща", "https://evil.example/x"));

        Assert.Contains("<strong>Модел:</strong> Космическа къща <span", html);
        Assert.DoesNotContain("evil.example", html);
    }

    [Fact]
    public void Without_a_model_the_notification_is_unchanged()
    {
        var (subject, html) = Render(model: null);

        Assert.DoesNotContain("Модел:", html);
        Assert.Equal("Ново запитване за оферта: Ivan", subject);
        Assert.Contains("Delivery to Varna?", html);
    }

    [Fact]
    public void A_hostile_title_and_id_are_encoded_and_cannot_break_the_subject()
    {
        var model = OfferModel.From(
            "15\"><img src=x onerror=alert(1)>",
            "<script>alert('x')</script> \"Space\" & house\r\nBcc: victim@example.com",
            "/en/gallery/space-house");

        var (subject, html) = Render(model);

        Assert.DoesNotContain("<script>", html);
        Assert.DoesNotContain("<img", html);
        Assert.Contains("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &quot;Space&quot; &amp; house Bcc: victim@example.com", html);
        Assert.Contains("(№15&quot;&gt;&lt;img src=x onerror=alert(1)&gt;)", html);
        // The link is still ours, untouched by the title.
        Assert.Contains(@"<a href=""https://nvc-home4you.eu/en/gallery/space-house"">", html);
        // One line: a header cannot be smuggled in through the title.
        Assert.DoesNotContain("\r", subject);
        Assert.DoesNotContain("\n", subject);
    }
}
