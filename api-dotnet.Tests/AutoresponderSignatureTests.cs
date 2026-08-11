using System.Collections.Generic;
using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

internal sealed class StubHttpClientFactory : System.Net.Http.IHttpClientFactory
{
    public System.Net.Http.HttpClient CreateClient(string name) => new();
}

// The welcome email used to come from Quickbase. It is ours now, so it has to look like
// it came from the company rather than from a form handler.
public class AutoresponderSignatureTests
{
    // BuildAutoresponder is private and has no seam; reflection is cheaper here than
    // widening the API just to look at a string.
    private static (string Subject, string Html) Render(bool isOffer, string locale)
    {
        var env = new EnvConfig(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>()).Build());
        // Nothing is sent, so the transport is never touched — only the template is read.
        var service = new EmailService(env, new StubHttpClientFactory(), NullLogger<EmailService>.Instance);

        var method = typeof(EmailService).GetMethod("BuildAutoresponder",
            BindingFlags.Instance | BindingFlags.NonPublic)!;
        var result = method.Invoke(service, new object?[] { "Ivan", isOffer, "A test enquiry", locale })!;

        var type = result.GetType();
        return (
            (string)type.GetField("Item1")!.GetValue(result)!,
            (string)type.GetField("Item2")!.GetValue(result)!);
    }

    [Theory]
    [InlineData("bg")]
    [InlineData("en")]
    [InlineData("el")]
    public void Every_locale_gets_the_signature(string locale)
    {
        var (_, html) = Render(isOffer: true, locale);

        Assert.Contains("NVC Home4You", html);
        Assert.Contains("contact@nvc-home4you.eu", html);
        Assert.Contains("+359 892 456 245", html);
        Assert.Contains("nvc-home4you.eu", html);
    }

    [Fact]
    public void The_logo_is_linked_rather_than_embedded()
    {
        // Gmail strips `data:` image URIs, so an inlined logo renders as nothing in the
        // client most customers use. It must stay an absolute https URL.
        var (_, html) = Render(isOffer: true, "en");

        Assert.Contains("https://nvc-home4you.eu/logo3.jpg", html);
        Assert.DoesNotContain("data:image", html);
    }

    [Fact]
    public void The_logo_carries_explicit_dimensions_and_alt_text()
    {
        // Without width/height the 1080x1080 source renders full-size in clients that
        // ignore CSS; without alt text it is a blank gap when images are blocked, which
        // is the default in Outlook.
        var (_, html) = Render(isOffer: true, "en");

        Assert.Contains(@"width=""56""", html);
        Assert.Contains(@"height=""56""", html);
        Assert.Contains(@"alt=""NVC Home4You""", html);
    }

    [Fact]
    public void The_address_is_localised_with_the_rest_of_the_email()
    {
        var (_, bg) = Render(isOffer: true, "bg");
        var (_, en) = Render(isOffer: true, "en");

        Assert.Contains("Марикостиново", bg);
        Assert.Contains("Телефон:", bg);
        Assert.Contains("Marikostinovo", en);
        Assert.Contains("Phone:", en);
    }

    [Fact]
    public void An_unknown_locale_falls_back_to_english_rather_than_breaking()
    {
        var (subject, html) = Render(isOffer: true, "fr");

        Assert.Contains("NVC Home4You", subject);
        Assert.Contains("Marikostinovo", html);
    }

    [Fact]
    public void The_email_is_not_just_an_image()
    {
        // An image-only email is a spam signal. There must be real text around it.
        var (_, html) = Render(isOffer: false, "en");

        Assert.Contains("Thanks for reaching out", html);
        Assert.Contains("A test enquiry", html);
    }
}
