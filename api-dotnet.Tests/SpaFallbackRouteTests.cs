using System;
using System.IO;
using System.Linq;
using Xunit;

namespace ApiDotnet.Tests;

// Which URL shapes the server agrees to serve the SPA shell for.
//
// THIS EXISTS BECAUSE IT HAPPENED TWICE. A route can be perfectly registered in App.jsx and
// still be a 404 in production, because the server decides separately whether a path is a
// page — from the SEO manifest, plus a short hand-maintained list of shapes the manifest
// cannot know. Miss that list and you get a page that works when you click to it and fails
// when you open it directly, which is the one case nobody tests by hand:
//
//   - the Services page (2026-08-18): registered in paths.js, never routed → soft 404.
//   - order tracking (2026-08-20): routed in App.jsx, unknown to the server → every
//     customer's tracking link answered a real HTTP 404 with a "Page not found" title
//     while React rendered the real page underneath. Found by probing production
//     minutes after the feature shipped.
//
// Program.cs is read as text rather than exercised: the fallback is a closure over web-host
// state, and what actually goes wrong is somebody adding a route and not adding it here —
// which a text check catches exactly as well as a running server would.
public class SpaFallbackRouteTests
{
    private static string ProgramSource()
    {
        // Walk up from the test assembly to the repo, then into the API project.
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "api-dotnet", "Program.cs")))
            dir = dir.Parent;

        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine(dir!.FullName, "api-dotnet", "Program.cs"));
    }

    [Fact]
    public void The_unlisted_page_branch_covers_order_tracking()
    {
        // The customer's tracking URL carries an unguessable code, so it can never appear in
        // the SEO manifest — it has to be recognised by shape or it is a 404.
        var source = ProgramSource();

        Assert.Contains("path.StartsWith(\"/order/\"", source);
    }

    [Fact]
    public void Order_tracking_is_served_noindex()
    {
        // Not tidiness: a tracking URL that reaches a search index is a tracking URL that
        // reaches everyone. The SPA sets noindex too, but crawlers that do not run JS only
        // ever see what the server put in the shell.
        var source = ProgramSource();

        var branch = source[source.IndexOf("path.StartsWith(\"/order/\"", StringComparison.Ordinal)..];
        var tags = branch[..Math.Min(900, branch.Length)];

        Assert.Contains("noindex", tags);
    }

    [Fact]
    public void The_internal_tools_still_share_that_branch()
    {
        // Guards the guard: if this branch were ever narrowed to /order/ alone, the admin
        // panel would start 404-ing on refresh — and the symptom would look unrelated.
        var source = ProgramSource();

        Assert.Contains("path.StartsWith(\"/internal/\"", source);
        Assert.Contains("path.StartsWith(\"/admin/\"", source);
    }

    [Fact]
    public void The_unlisted_page_branch_covers_the_representatives_panel_and_link()
    {
        // Two more shapes the manifest cannot know (#38): /rep/… is the representatives'
        // panel, /r/{slug} a representative's landing page — the one that goes in a video,
        // so a direct open is the ONLY way anyone ever reaches it. And bare /rep, which the
        // SPA redirects to /rep/leads, the way bare /admin is already served.
        var source = ProgramSource();

        Assert.Contains("path.StartsWith(\"/rep/\"", source);
        Assert.Contains("path.Equals(\"/rep\"", source);
        Assert.Contains("path.StartsWith(\"/r/\"", source);
    }

    [Fact]
    public void A_representatives_link_is_the_customers_page_and_the_panel_an_internal_one()
    {
        // Which shell each gets: /r/ is customer-facing like /order/, so it carries the
        // brand title; /rep/ is a staff-side tool and says "NVC internal". Both noindex.
        var source = ProgramSource();

        var start = source.IndexOf("var unlistedTags =", StringComparison.Ordinal);
        Assert.True(start >= 0, "the shell choice has moved or been renamed");
        var expression = source[start..source.IndexOf(';', start)];

        Assert.Contains("path.StartsWith(\"/r/\", StringComparison.OrdinalIgnoreCase) ? orderTags", expression);
        // The /order/ half verbatim: SpaShellTests pins this exact text too.
        Assert.Contains("path.StartsWith(\"/order/\", StringComparison.OrdinalIgnoreCase) ? orderTags : internalTags", expression);
        Assert.DoesNotContain("/rep", expression);

        var branch = source[source.IndexOf("path.StartsWith(\"/rep/\"", StringComparison.Ordinal)..];
        Assert.Contains("noindex", branch[..Math.Min(900, branch.Length)]);
    }

    [Fact]
    public void An_unknown_url_still_answers_a_real_404()
    {
        // The other half of the bargain. Serving the shell with a 200 for everything is a
        // soft 404 for every dead link ever shared, which is what this code was written to
        // stop — so the unknown-URL branch has to survive every widening of the one above.
        var source = ProgramSource();

        Assert.Contains("else if (!IsKnownSpaRoute(path))", source);
        Assert.Contains("StatusCodes.Status404NotFound", source);
    }

    [Fact]
    public void A_product_url_at_a_stale_address_is_a_301_that_keeps_its_query()
    {
        // Which stale addresses resolve, and where to, is GalleryRetiredSlugTests'; this pins
        // what the server does with the answer. Permanent, because Google keeps a temporarily
        // redirected URL indexed. The query string, because shared and ad links carry
        // fbclid / utm_* / gclid. And the return, because Redirect() only sets headers: fall
        // through and the 404 written just below overwrites the 301.
        //
        // A text check, like the rest of this file — it pins the shape, and would still pass
        // if somebody wrapped the lookup in a condition that never runs.
        var source = ProgramSource();

        var start = source.IndexOf("Outcome.ProductNotFound", StringComparison.Ordinal);
        Assert.True(start >= 0, "the product-not-found branch has moved or been renamed");
        var branch = source[start..];
        branch = branch[..branch.IndexOf("StatusCodes.Status404NotFound", StringComparison.Ordinal)];

        Assert.Contains("seo.TryResolveLegacyAsync(path", branch);
        Assert.Matches(
            @"context\.Response\.Redirect\(moved \+ context\.Request\.QueryString, permanent: true\);\s*return;",
            branch);
    }

    [Fact]
    public void The_retired_page_redirects_keep_their_query_too()
    {
        var source = ProgramSource();

        Assert.Contains("Results.Redirect(target + ctx.Request.QueryString, permanent: true)", source);
    }
}
