using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// IMAGES_VIA_APP is the visible half of the image migration: it changes the URLs in every
// gallery and cases payload. These tests pin the two properties that make it safe to flip —
// off means byte-for-byte today's output, and anything unrecognised is passed through rather
// than dropped, so a stray field value can never become a missing image.
public class ImageUrlsTests
{
    private const string Realm = "vladimirbuilder.quickbase.com";
    private const string QbUrl = "https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcy/eg/vb";

    private static ImageUrls Urls(bool viaApp)
    {
        var dict = new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = Realm,
            ["IMAGES_VIA_APP"] = viaApp ? "true" : "false",
        };
        return new ImageUrls(new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build()));
    }

    [Fact]
    public void Off_by_default_leaves_urls_untouched()
    {
        Assert.False(Urls(viaApp: false).ViaApp);
        Assert.Equal(QbUrl, Urls(viaApp: false).ForResponse(QbUrl));
    }

    [Fact]
    public void On_it_rewrites_to_our_own_route()
    {
        Assert.Equal("/api/img/up/bvk4n834b/g/rcy/eg/vb", Urls(viaApp: true).ForResponse(QbUrl));
    }

    [Fact]
    public void A_url_we_cannot_serve_is_passed_through_unchanged()
    {
        // A field holding some other host's URL still has to render. Dropping it would turn a
        // data oddity into a visibly broken page.
        const string other = "https://example.test/some-image.png";

        Assert.Equal(other, Urls(viaApp: true).ForResponse(other));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Empty_values_survive_the_round_trip(string? raw)
    {
        Assert.Equal(raw, Urls(viaApp: true).ForResponse(raw));
    }

    [Fact]
    public void Rewriting_is_idempotent()
    {
        // The gallery payload is cached; if a rewritten URL were ever fed back through, it
        // must not become /api/img/api/img/...
        var urls = Urls(viaApp: true);
        var once = urls.ForResponse(QbUrl);

        Assert.Equal(once, urls.ForResponse(once));
    }
}
