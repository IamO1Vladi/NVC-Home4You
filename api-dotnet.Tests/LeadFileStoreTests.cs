using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Configuration;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Attachment storage rules.
//
// These are the rules that keep a customer's contract from becoming a public URL, and a
// file a customer emailed us from becoming script running against an admin session. All of
// them fail silently if they regress — a wrongly-accepted file works fine right up until it
// doesn't — so they are pinned here rather than left to the code reading correctly.
public class LeadFileStoreTests
{
    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    // --- The container split -----------------------------------------------------------

    [Fact]
    public void Lead_files_never_default_into_the_public_images_container()
    {
        // /api/img is unauthenticated because it serves the public site. A default of
        // "images" here would publish every customer document by accident.
        var cfg = Config();

        Assert.Equal("lead-files", cfg.LeadFilesContainer);
        Assert.NotEqual(cfg.BlobImagesContainer, cfg.LeadFilesContainer);
    }

    [Fact]
    public void The_lead_files_container_is_overridable()
    {
        Assert.Equal("nvc-docs", Config(("BLOB_LEAD_FILES_CONTAINER", "nvc-docs")).LeadFilesContainer);
    }

    // --- Which files are accepted --------------------------------------------------------

    [Theory]
    [InlineData("survey.pdf", "application/pdf")]
    [InlineData("plot.JPG", "image/jpeg")]
    [InlineData("quote.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]
    [InlineData("plan.dwg", "application/acad")]
    public void The_things_customers_actually_send_are_accepted(string name, string expected)
    {
        Assert.True(LeadFileStore.IsAllowed(name, out var contentType));
        Assert.Equal(expected, contentType);
    }

    [Theory]
    [InlineData("payload.html")]      // would run in our origin if ever served inline
    [InlineData("logo.svg")]          // SVG carries script
    [InlineData("setup.exe")]
    [InlineData("script.js")]
    [InlineData("macro.docm")]
    [InlineData("noextension")]
    public void Anything_outside_the_allow_list_is_refused(string name)
    {
        // An allow-list, not a block-list: the useful set is small and known, and a
        // block-list is a game you lose one new extension at a time.
        Assert.False(LeadFileStore.IsAllowed(name, out _));
    }

    [Fact]
    public void An_extension_check_is_case_insensitive_because_phones_upload_screaming_names()
    {
        Assert.True(LeadFileStore.IsAllowed("IMG_0421.PNG", out var contentType));
        Assert.Equal("image/png", contentType);
    }

    // --- Key minting ----------------------------------------------------------------------

    [Fact]
    public void The_storage_key_is_never_built_from_the_customers_filename()
    {
        // The filename is untrusted input. As a key it invites traversal and collides the
        // moment two people both attach "scan.pdf".
        var key = LeadFileStore.MintKey(7, "../../etc/passwd.pdf");

        Assert.StartsWith("leads/7/", key);
        Assert.DoesNotContain("..", key);
        Assert.DoesNotContain("passwd", key);
        Assert.EndsWith(".pdf", key);
    }

    [Fact]
    public void Two_files_with_the_same_name_get_different_keys()
    {
        var a = LeadFileStore.MintKey(7, "scan.pdf");
        var b = LeadFileStore.MintKey(7, "scan.pdf");

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Keys_are_scoped_per_lead()
    {
        Assert.StartsWith("leads/12/", LeadFileStore.MintKey(12, "a.pdf"));
        Assert.StartsWith("leads/13/", LeadFileStore.MintKey(13, "a.pdf"));
    }

    [Fact]
    public void A_missing_or_absurd_extension_does_not_end_up_in_the_key()
    {
        Assert.DoesNotContain(".", LeadFileStore.MintKey(1, "noextension").Split('/').Last());

        // A "filename" that is one long fake extension must not become the key's tail.
        var silly = LeadFileStore.MintKey(1, "x." + new string('a', 200));
        Assert.DoesNotContain("aaaa", silly);
    }

    [Fact]
    public void Keys_are_lower_cased_so_they_survive_the_trip_from_a_windows_desktop()
    {
        Assert.EndsWith(".jpg", LeadFileStore.MintKey(1, "Holiday.JPG"));
    }

    // --- Size ceiling ---------------------------------------------------------------------

    [Fact]
    public void The_size_cap_is_below_what_mail_servers_accept()
    {
        // Refusing here gives a clear error; accepting would produce a send that bounces
        // at the far end, long after the salesperson thought it went.
        Assert.True(LeadFileStore.MaxBytes <= 25L * 1024 * 1024);
        Assert.True(LeadFileStore.MaxBytes >= 10L * 1024 * 1024);
    }

    [Fact]
    public void Storage_is_off_rather_than_broken_when_blob_is_not_configured()
    {
        var store = new LeadFileStore(
            Config(), Microsoft.Extensions.Logging.Abstractions.NullLogger<LeadFileStore>.Instance);

        Assert.False(store.IsConfigured);
    }
}
