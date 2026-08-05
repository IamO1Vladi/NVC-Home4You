using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// How a stored ImageKey becomes a URL. This is where the SQL read path and the Blob move
// meet, and where the flag's scope has to be exactly right: IMAGES_VIA_APP decides whether we
// proxy QUICKBASE images, not whether our own are reachable at all.
public class ImageUrlResolutionTests
{
    private const string Realm = "vladimirbuilder.quickbase.com";

    private static ImageUrls Urls(bool viaApp)
    {
        var dict = new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = Realm,
            ["IMAGES_VIA_APP"] = viaApp ? "true" : "false",
        };
        return new ImageUrls(new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build()));
    }

    private const string OwnedKey = "gallery/13/0f8fad5bd9cb469fa16570867728950e.webp";
    private const string QuickbaseKey = "up/bvk4n834b/g/rcy/eg/vb";

    [Fact]
    public void An_owned_key_resolves_to_our_route_even_with_the_flag_off()
    {
        // The important one. Images we own exist only in Blob, so /api/img is the only URL
        // that reaches them. If the flag could suppress this, serving the gallery from SQL
        // with IMAGES_VIA_APP unset would emit raw storage keys and break every picture.
        Assert.Equal("/api/img/" + OwnedKey, Urls(viaApp: false).ForKey(OwnedKey));
        Assert.Equal("/api/img/" + OwnedKey, Urls(viaApp: true).ForKey(OwnedKey));
    }

    [Fact]
    public void A_quickbase_key_honours_the_flag()
    {
        // Still on Quickbase's host when the flag is off, so turning it off genuinely rolls
        // back — including for rows imported before the Blob move.
        Assert.Equal(
            $"https://{Realm}/{QuickbaseKey}",
            Urls(viaApp: false).ForKey(QuickbaseKey));

        Assert.Equal("/api/img/" + QuickbaseKey, Urls(viaApp: true).ForKey(QuickbaseKey));
    }

    [Fact]
    public void An_owned_url_in_a_quickbase_payload_is_also_always_rewritten()
    {
        Assert.Equal("/api/img/" + OwnedKey, Urls(viaApp: false).ForResponse("/api/img/" + OwnedKey));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not a key")]
    [InlineData("../../etc/passwd")]
    public void An_unusable_key_yields_no_url(string? key)
    {
        // Null rather than a broken URL: the read path drops it, so a bad row costs one
        // missing image rather than a broken <img> on the page.
        Assert.Null(Urls(viaApp: true).ForKey(key));
    }
}
