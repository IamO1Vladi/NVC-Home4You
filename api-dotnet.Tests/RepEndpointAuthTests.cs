using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Every representative endpoint is behind RepresentativeOnly, checked by reflection the way
// AdminEndpointAuthTests checks the admin ones.
//
// Two mistakes are worth a sweep here, and they pull in opposite directions. A route under
// api/rep with no policy at all is a customer conversation open to the world. A route under
// api/rep behind AdminOnly instead — the easy copy-paste from the controller this one was
// modelled on — is a panel the representative can never open, and nothing says so until he
// tries. Both pass every other test in this project.
public class RepEndpointAuthTests
{
    private static IEnumerable<Type> Controllers =>
        typeof(RepPipelineController).Assembly
            .GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

    private static string? RouteOf(Type controller) =>
        controller.GetCustomAttribute<RouteAttribute>()?.Template;

    private static bool IsRepRoute(Type controller) =>
        RouteOf(controller)?.StartsWith("api/rep", StringComparison.OrdinalIgnoreCase) == true;

    private static IEnumerable<MethodInfo> Actions(Type controller) =>
        controller
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any());

    [Fact]
    public void Every_rep_route_requires_the_RepresentativeOnly_policy()
    {
        var unprotected = Controllers
            .Where(IsRepRoute)
            .Where(c => c.GetCustomAttributes<AuthorizeAttribute>()
                         .All(a => a.Policy != RepresentativePolicy.Name))
            .Select(c => c.Name)
            .ToList();

        Assert.Empty(unprotected);
        Assert.Equal("RepresentativeOnly", RepresentativePolicy.Name);
    }

    [Fact]
    public void No_rep_route_is_behind_AdminOnly_instead()
    {
        // On the controller or on any action: an admin-gated action on the rep panel is
        // one the representative cannot use and the admin was never meant to.
        var misgated = new List<string>();

        foreach (var controller in Controllers.Where(IsRepRoute))
        {
            if (controller.GetCustomAttributes<AuthorizeAttribute>().Any(a => a.Policy == "AdminOnly"))
                misgated.Add(controller.Name);

            misgated.AddRange(Actions(controller)
                .Where(m => m.GetCustomAttributes<AuthorizeAttribute>().Any(a => a.Policy == "AdminOnly"))
                .Select(m => $"{controller.Name}.{m.Name}"));
        }

        Assert.Empty(misgated);
    }

    [Fact]
    public void No_rep_endpoint_opts_back_out_with_AllowAnonymous()
    {
        var opened = new List<string>();

        foreach (var controller in Controllers.Where(IsRepRoute))
        {
            if (controller.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
                opened.Add(controller.Name);

            opened.AddRange(Actions(controller)
                .Where(m => m.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
                .Select(m => $"{controller.Name}.{m.Name}"));
        }

        Assert.Empty(opened);
    }

    [Fact]
    public void An_absolute_action_route_under_api_rep_lives_on_a_rep_controller()
    {
        // /api/rep/me is declared with a leading slash, which escapes the controller's
        // prefix. That is fine on a RepresentativeOnly controller and a hole on any other,
        // so every absolute api/rep template anywhere has to sit on a protected one.
        var strays = new List<string>();

        foreach (var controller in Controllers)
        {
            foreach (var action in Actions(controller))
            {
                var absolute = action.GetCustomAttributes<HttpMethodAttribute>()
                    .Select(a => a.Template)
                    .Any(t => t is not null && t.StartsWith("/api/rep", StringComparison.OrdinalIgnoreCase));

                if (absolute && !IsRepRoute(controller))
                    strays.Add($"{controller.Name}.{action.Name}");
            }
        }

        Assert.Empty(strays);
    }

    [Fact]
    public void The_rep_panel_exposes_no_admin_only_operations()
    {
        // Named rather than swept: these are the actions a representative must not have,
        // whatever the shared SPA page happens to render. Users and promote and create
        // reach other people's data; owner is the one field that defines his scope; convert
        // and the due report are sales' decisions.
        var actions = Controllers.Where(IsRepRoute).SelectMany(Actions).Select(a => a.Name).ToList();

        Assert.DoesNotContain("Users", actions);
        Assert.DoesNotContain("Promote", actions);
        Assert.DoesNotContain("Create", actions);
        Assert.DoesNotContain("Convert", actions);
        Assert.DoesNotContain("SetOwner", actions);
        Assert.DoesNotContain("SendDueReport", actions);

        // And no template says so either, whatever the method is called.
        var templates = Controllers.Where(IsRepRoute).SelectMany(Actions)
            .SelectMany(a => a.GetCustomAttributes<HttpMethodAttribute>())
            .Select(a => a.Template ?? "")
            .ToList();

        Assert.DoesNotContain(templates, t => t.Contains("owner", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(templates, t => t.Contains("promote", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(templates, t => t.Contains("convert", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(templates, t => t.Contains("users", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(templates, t => t.Contains("report", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void The_sweep_actually_has_something_to_sweep()
    {
        // Guards the guard, as AdminEndpointAuthTests does: an assembly scan that found no
        // rep controller would pass every test above on an empty set.
        Assert.True(Controllers.Count(IsRepRoute) >= 1);
        Assert.Contains("api/rep/pipeline", Controllers.Where(IsRepRoute).Select(RouteOf));
    }
}
