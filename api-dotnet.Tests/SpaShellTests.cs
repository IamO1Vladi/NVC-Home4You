using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Xunit;

namespace ApiDotnet.Tests;

// What the server's HTML shell says about its own language, before any JavaScript runs.
//
// index.html declares lang="en" for every URL, and only the prerendered pages carried their
// own. So a Greek product page or a Greek 404 told every client that does not run JS —
// crawlers, link unfurlers, a screen reader before hydration — that it was English, with an
// English "Page not found" for a title (Greek audit, #11). SpaShell is the fix; these pin it.
public class SpaShellTests
{
    private static string RepoFile(params string[] parts)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "api-dotnet", "Program.cs")))
            dir = dir.Parent;

        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine(new[] { dir!.FullName }.Concat(parts).ToArray()));
    }

    [Theory]
    [InlineData("/el", "el")]
    [InlineData("/el/gkaleri/domiko-spiti", "el")]
    [InlineData("/EL/Gkaleri/x", "el")]
    [InlineData("/el/no-such-page", "el")]
    [InlineData("/bg/galeriq/x", "bg")]
    [InlineData("/en", "en")]
    [InlineData("/", null)]
    [InlineData("/order/abcd123456", null)]
    [InlineData("/admin/orders", null)]
    [InlineData("/eleven", null)]
    [InlineData("/gallery", null)]
    [InlineData("", null)]
    public void The_locale_comes_from_the_path_prefix_and_nothing_else(string path, string? expected)
    {
        Assert.Equal(expected, SpaShell.LocaleOf(path));
    }

    [Fact]
    public void The_real_shell_is_declared_greek_on_a_greek_path()
    {
        // Against the actual index.html, so a change to its <html> tag cannot slip past.
        var shell = RepoFile("NVC Claude version", "index.html");

        var greek = SpaShell.WithLang(shell, "el");

        var htmlTag = Regex.Match(greek, @"<html\b[^>]*>", RegexOptions.IgnoreCase).Value;
        Assert.Contains("lang=\"el\"", htmlTag);
        Assert.DoesNotContain("lang=\"en\"", htmlTag);
        // Only the tag changes; the rest of the page is the same bytes.
        Assert.Equal(shell.Length + ("el".Length - "en".Length), greek.Length);
    }

    [Theory]
    [InlineData("<html lang=\"en\"><head></head></html>", "<html lang=\"bg\"><head></head></html>")]
    [InlineData("<html lang='en' class=\"x\">", "<html lang=\"bg\" class=\"x\">")]
    [InlineData("<html lang=en>", "<html lang=\"bg\">")]
    [InlineData("<html>", "<html lang=\"bg\">")]
    [InlineData("<html class=\"dark\">", "<html lang=\"bg\" class=\"dark\">")]
    // xml:lang is a different attribute; it is left alone and a real lang is added.
    [InlineData("<html xml:lang=\"en\">", "<html lang=\"bg\" xml:lang=\"en\">")]
    public void The_lang_attribute_is_replaced_or_added(string html, string expected)
    {
        Assert.Equal(expected, SpaShell.WithLang(html, "bg"));
    }

    [Fact]
    public void A_path_with_no_locale_keeps_the_shell_as_it_is()
    {
        // The bare domain, /order/ and the admin: the URL does not say, so nothing is claimed.
        const string html = "<html lang=\"en\"><body></body></html>";

        Assert.Same(html, SpaShell.WithLang(html, null));
    }

    [Theory]
    [InlineData("el", "<title>Η σελίδα δεν βρέθηκε | NVC Home4You</title>")]
    [InlineData("bg", "<title>Страницата не е намерена | NVC Home4You</title>")]
    [InlineData("en", "<title>Page not found | NVC Home4You</title>")]
    [InlineData(null, "<title>Page not found | NVC Home4You</title>")]
    public void A_404_is_titled_in_the_language_of_its_path(string? locale, string title)
    {
        var tags = SpaShell.NotFoundTags(locale);

        Assert.Contains(title, tags);
        // Every one of them still tells crawlers to drop it.
        Assert.Contains("noindex", tags);
    }

    [Fact]
    public void The_404_titles_are_the_ones_the_page_itself_shows()
    {
        // The tab title before React runs and the one after it must agree, so the server's
        // words are NotFoundPage.jsx's words.
        var page = RepoFile("NVC Claude version", "src", "pages", "NotFoundPage.jsx");

        Assert.Contains("title: 'Η σελίδα δεν βρέθηκε'", page);
        Assert.Contains("title: 'Страницата не е намерена'", page);
        Assert.Contains("title: 'Page not found'", page);
    }

    [Fact]
    public void Every_shell_the_fallback_writes_declares_the_path_language()
    {
        // "Every response" is the rule, and the way it breaks is a new branch that writes
        // the page directly. Program.cs is read as text for the reason SpaFallbackRouteTests
        // gives: the fallback is a closure over web-host state.
        var source = RepoFile("api-dotnet", "Program.cs");
        var fallback = source[source.IndexOf("app.MapFallback(", StringComparison.Ordinal)..];
        fallback = fallback[..fallback.IndexOf("app.Run();", StringComparison.Ordinal)];

        var writes = Regex.Matches(fallback, @"context\.Response\.WriteAsync\(").Count;
        var declared = Regex.Matches(fallback, @"context\.Response\.WriteAsync\(SpaShell\.WithLang\(").Count;

        Assert.True(writes > 0);
        Assert.Equal(writes, declared);
    }

    [Fact]
    public void The_tracking_page_is_titled_with_the_brand_not_as_an_internal_tool()
    {
        // The customer's own page used to share the admin's "NVC internal" title.
        var source = RepoFile("api-dotnet", "Program.cs");
        var branch = source[source.IndexOf("path.StartsWith(\"/order/\"", StringComparison.Ordinal)..];
        branch = branch[..branch.IndexOf("return;", StringComparison.Ordinal)];

        Assert.Contains("<title>NVC Home4You</title>", branch);
        Assert.Contains("path.StartsWith(\"/order/\", StringComparison.OrdinalIgnoreCase) ? orderTags : internalTags", branch);
    }
}
