using System;
using System.IO;
using System.Text.RegularExpressions;
using Xunit;

namespace ApiDotnet.Tests;

// The 301s for pages the site no longer has (retiredPages in Program.cs).
//
// The logistics page was retired on 2026-10-15 into the delivery page, each language to its
// own. A redirect that points at a slug paths.js no longer has is a 301 into a 404, which is
// worse than the 404 alone: the crawler is told the move is permanent. So these read both
// files as text, the way SpaFallbackRouteTests reads Program.cs, and check the two agree.
public class RetiredPagesTests
{
    private static DirectoryInfo RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "api-dotnet", "Program.cs")))
            dir = dir.Parent;

        Assert.NotNull(dir);
        return dir!;
    }

    private static string ProgramSource() =>
        File.ReadAllText(Path.Combine(RepoRoot().FullName, "api-dotnet", "Program.cs"));

    private static string PathsSource() =>
        File.ReadAllText(Path.Combine(RepoRoot().FullName, "NVC Claude version", "src", "routes", "paths.js"));

    private static string RetiredPagesBlock()
    {
        var source = ProgramSource();
        var start = source.IndexOf("var retiredPages", StringComparison.Ordinal);
        Assert.True(start >= 0, "retiredPages is gone from Program.cs");
        var end = source.IndexOf("};", start, StringComparison.Ordinal);
        return source[start..end];
    }

    [Theory]
    [InlineData("/bg/mejdunarodna-logistika", "/bg/dostavka-do-vratata")]
    [InlineData("/en/logistics", "/en/delivery")]
    [InlineData("/el/diethnis-efodiastiki", "/el/paradosi-sto-spiti")]
    public void The_logistics_page_goes_to_the_delivery_page_in_its_own_language(string from, string to)
    {
        Assert.Contains($"[\"{from}\"] = \"{to}\"", RetiredPagesBlock());
    }

    [Fact]
    public void Every_redirect_lands_on_a_page_the_spa_still_has_and_leaves_one_it_does_not()
    {
        var paths = PathsSource();

        foreach (Match m in Regex.Matches(RetiredPagesBlock(), "\\[\"(?<from>[^\"]+)\"\\] = \"(?<to>[^\"]+)\""))
        {
            var from = m.Groups["from"].Value;
            var to = m.Groups["to"].Value;

            // A bare locale root ("/bg") is the home page, which paths.js spells as a route too.
            Assert.Contains($"'{to}'", paths);
            Assert.DoesNotContain($"'{from}'", paths);
        }
    }
}
