using Services;
using Xunit;

namespace ApiDotnet.Tests;

// www.nvc-home4you.eu reaches App Service but has no hostname bound, so it fails its TLS
// handshake today. These pin the redirect that canonicalises it once the certificate exists.
public class CanonicalHostTests
{
    [Fact]
    public void Www_redirects_to_the_bare_domain()
    {
        Assert.Equal(
            "https://nvc-home4you.eu/bg/ceni",
            CanonicalHost.RedirectTarget("https", "www.nvc-home4you.eu", "/bg/ceni"));
    }

    [Fact]
    public void The_apex_is_left_alone()
    {
        Assert.Null(CanonicalHost.RedirectTarget("https", "nvc-home4you.eu", "/bg"));
    }

    // The redirect sits early in the pipeline, so getting this wrong would bounce every
    // local request to a host that does not exist.
    [Theory]
    [InlineData("localhost:5178")]
    [InlineData("localhost")]
    [InlineData("127.0.0.1:5173")]
    public void Local_development_hosts_are_left_alone(string host)
    {
        Assert.Null(CanonicalHost.RedirectTarget("http", host, "/"));
    }

    // A host that merely starts with the letters "www" is not a www subdomain.
    [Theory]
    [InlineData("wwwnvc-home4you.eu")]
    [InlineData("www2.nvc-home4you.eu")]
    [InlineData("wwww.nvc-home4you.eu")]
    public void Only_a_real_www_label_is_stripped(string host)
    {
        Assert.Null(CanonicalHost.RedirectTarget("https", host, "/"));
    }

    [Fact]
    public void The_www_label_is_matched_case_insensitively()
    {
        Assert.Equal(
            "https://nvc-home4you.eu/",
            CanonicalHost.RedirectTarget("https", "WWW.nvc-home4you.eu", "/"));
    }

    // The query string carries the configurator's whole state and a saved-config code.
    // Dropping it would land the visitor on a blank configurator rather than their own.
    [Fact]
    public void Path_and_query_survive_the_redirect()
    {
        Assert.Equal(
            "https://nvc-home4you.eu/bg/konfigurator-box-kyshti?model=73&c=Ab3xK9mp",
            CanonicalHost.RedirectTarget(
                "https", "www.nvc-home4you.eu", "/bg/konfigurator-box-kyshti?model=73&c=Ab3xK9mp"));
    }

    // Non-ASCII paths are the norm here — every gallery URL is Cyrillic. They must pass
    // through byte-for-byte rather than being re-encoded into something that 404s.
    [Fact]
    public void A_cyrillic_path_passes_through_untouched()
    {
        Assert.Equal(
            "https://nvc-home4you.eu/bg/galeriq/разгъваема-къща-73-м2",
            CanonicalHost.RedirectTarget(
                "https", "www.nvc-home4you.eu", "/bg/galeriq/разгъваема-къща-73-м2"));
    }

    // A port on the request has to survive, or a redirect on a non-standard port lands on
    // the wrong service entirely.
    [Fact]
    public void A_port_is_preserved()
    {
        Assert.Equal(
            "http://nvc-home4you.eu:5178/bg",
            CanonicalHost.RedirectTarget("http", "www.nvc-home4you.eu:5178", "/bg"));
    }

    // Stripping the prefix must never produce a Location with an empty host, which browsers
    // resolve in surprising ways. Better to serve the request than to redirect nowhere.
    [Theory]
    [InlineData("www.")]
    [InlineData("www.:8080")]
    public void A_host_that_is_only_the_prefix_is_not_redirected(string host)
    {
        Assert.Null(CanonicalHost.RedirectTarget("https", host, "/"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_missing_host_is_not_redirected(string? host)
    {
        Assert.Null(CanonicalHost.RedirectTarget("https", host, "/"));
    }

    // Scheme is read after UseForwardedHeaders. If that ever regresses the scheme to http,
    // this at least keeps the redirect on the scheme it was actually given rather than
    // hardcoding one.
    [Fact]
    public void The_request_scheme_is_carried_through()
    {
        Assert.Equal(
            "http://nvc-home4you.eu/bg",
            CanonicalHost.RedirectTarget("http", "www.nvc-home4you.eu", "/bg"));
    }
}
