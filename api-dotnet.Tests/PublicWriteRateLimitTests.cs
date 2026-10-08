using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.RateLimiting;
using Xunit;

namespace ApiDotnet.Tests;

// The per-visitor budget on the public write routes (#38), checked by reflection in the
// AdminEndpointAuthTests manner rather than by reading.
//
// Two things can go wrong with a rate limiter and neither shows up in a browser. A public
// write that nobody annotated is open to a script — it works perfectly for the one person
// testing it. And a READ that somebody annotated, or a controller-level attribute on a
// class that later grows a GET, shares a budget of ten with every visitor behind the same
// NAT: the homepage review feed would start answering 429 to an office. So the sweep runs
// both ways — every write in the list is limited, and no read anywhere is.
public class PublicWriteRateLimitTests
{
    private const string Policy = "public-write";

    private static IEnumerable<Type> Controllers =>
        typeof(OfferController).Assembly
            .GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

    private static IEnumerable<MethodInfo> Actions(Type controller) =>
        controller
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any());

    private static string? PolicyOn(MemberInfo member) =>
        member.GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName;

    private static bool IsGet(MethodInfo action) =>
        action.GetCustomAttribute<HttpGetAttribute>() is not null;

    private static string ProgramSource()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "api-dotnet", "Program.cs")))
            dir = dir.Parent;

        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine(dir!.FullName, "api-dotnet", "Program.cs"));
    }

    [Theory]
    [InlineData(typeof(OfferController))]
    [InlineData(typeof(QuestionController))]
    [InlineData(typeof(ConfigEmailController))]
    public void A_controller_that_only_writes_is_limited_as_a_whole(Type controller)
    {
        Assert.Equal(Policy, PolicyOn(controller));

        // The class-level attribute is only safe while the class has no read; the day one is
        // added, the attribute has to move down to the writes. This is what notices.
        Assert.Empty(Actions(controller).Where(IsGet).Select(a => a.Name));
    }

    [Theory]
    [InlineData(typeof(ConfigLinkController), nameof(ConfigLinkController.Create))]
    [InlineData(typeof(ReviewsController), nameof(ReviewsController.Post))]
    public void A_controller_that_mixes_reads_and_writes_limits_only_the_write(Type controller, string action)
    {
        var write = controller.GetMethod(action, BindingFlags.Public | BindingFlags.Instance)!;

        Assert.Equal(Policy, PolicyOn(write));
        Assert.NotNull(write.GetCustomAttribute<HttpPostAttribute>());
        Assert.Null(PolicyOn(controller));
    }

    [Fact]
    public void No_read_anywhere_is_limited()
    {
        // Including by inheritance from a class-level attribute: a GET on a limited class
        // is limited whether or not it says so itself.
        var limitedReads = new List<string>();

        foreach (var controller in Controllers)
        {
            foreach (var action in Actions(controller).Where(IsGet))
            {
                if (PolicyOn(action) is not null || PolicyOn(controller) is not null)
                    limitedReads.Add($"{controller.Name}.{action.Name}");
            }
        }

        Assert.Empty(limitedReads);
    }

    [Fact]
    public void Every_limited_action_names_the_one_policy_that_exists()
    {
        // An attribute naming a policy that was never registered is a 500 on first use,
        // which the panel would report as "the form is broken" rather than "a typo".
        var strays = new List<string>();

        foreach (var controller in Controllers)
        {
            if (PolicyOn(controller) is { } onClass && onClass != Policy)
                strays.Add($"{controller.Name} ({onClass})");

            foreach (var action in Actions(controller))
            {
                if (PolicyOn(action) is { } onAction && onAction != Policy)
                    strays.Add($"{controller.Name}.{action.Name} ({onAction})");
            }
        }

        Assert.Empty(strays);
    }

    [Fact]
    public void The_limiter_runs_after_forwarded_headers_and_before_the_endpoints()
    {
        // A text pin, like SpaFallbackRouteTests: the order of two middleware calls is the
        // whole correctness of the thing. Before UseForwardedHeaders, RemoteIpAddress is App
        // Service's front end for every request and the entire site shares one bucket of ten.
        var source = ProgramSource();

        var forwarded = source.IndexOf("app.UseForwardedHeaders();", StringComparison.Ordinal);
        var limiter = source.IndexOf("app.UseRateLimiter();", StringComparison.Ordinal);
        var endpoints = source.IndexOf("app.MapControllers();", StringComparison.Ordinal);

        Assert.True(forwarded >= 0, "UseForwardedHeaders has moved or been renamed");
        Assert.True(limiter >= 0, "UseRateLimiter is missing");
        Assert.True(endpoints >= 0, "MapControllers has moved or been renamed");
        Assert.True(forwarded < limiter, "UseRateLimiter must run AFTER UseForwardedHeaders");
        Assert.True(limiter < endpoints, "UseRateLimiter must run before the endpoints are mapped");
    }

    [Fact]
    public void The_policy_is_registered_under_the_name_the_attributes_use_and_answers_429()
    {
        // 429 and not 503: the SPA's backgroundSubmit retries a 429 with backoff, so a real
        // visitor who trips the limit sees "retrying" rather than a dead button.
        var source = ProgramSource();

        var start = source.IndexOf("builder.Services.AddRateLimiter(", StringComparison.Ordinal);
        Assert.True(start >= 0, "AddRateLimiter is missing");
        var block = source[start..];
        block = block[..block.IndexOf("});", StringComparison.Ordinal)];

        Assert.Contains($"\"{Policy}\"", block);
        Assert.Contains("StatusCodes.Status429TooManyRequests", block);
        Assert.Contains("context.Connection.RemoteIpAddress", block);
    }

    [Fact]
    public void The_sweep_actually_has_something_to_sweep()
    {
        // Guards the guard: three controllers and two actions carry the attribute today, and
        // an assembly scan that found none would pass every test above on an empty set.
        var carriers = Controllers.Count(c => PolicyOn(c) is not null)
                       + Controllers.SelectMany(Actions).Count(a => PolicyOn(a) is not null);

        Assert.True(carriers >= 5, $"only {carriers} members carry [EnableRateLimiting]");
    }
}
