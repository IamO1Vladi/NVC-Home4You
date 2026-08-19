using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace ApiDotnet.Tests;

// Every admin endpoint is behind AdminOnly, checked by reflection rather than by reading.
//
// The rule this pins is the one in HANDOFF.md: the panel holds ЕГН, ЕИК, addresses,
// invoices — and now what the business pays for its goods and marks them up by — so
// anything added near that data is AdminOnly with no anonymous read path.
//
// A checklist cannot enforce that, because the failure mode is a controller somebody adds
// next month without the attribute: it works perfectly in the panel, where the session is
// already signed in, and is open to the world. Nothing about it looks wrong until someone
// requests it while logged out. This test is the thing that notices.
public class AdminEndpointAuthTests
{
    private static IEnumerable<Type> Controllers =>
        typeof(global::Controllers.AdminFactoriesController).Assembly
            .GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

    private static string? RouteOf(Type controller) =>
        controller.GetCustomAttribute<RouteAttribute>()?.Template;

    private static bool IsAdminRoute(Type controller) =>
        RouteOf(controller)?.StartsWith("api/admin", StringComparison.OrdinalIgnoreCase) == true;

    [Fact]
    public void Every_admin_route_requires_the_AdminOnly_policy()
    {
        var unprotected = Controllers
            .Where(IsAdminRoute)
            .Where(c => c.GetCustomAttributes<AuthorizeAttribute>()
                         .All(a => a.Policy != "AdminOnly"))
            .Select(c => c.Name)
            .ToList();

        Assert.Empty(unprotected);
    }

    [Fact]
    public void No_admin_endpoint_opts_back_out_with_AllowAnonymous()
    {
        // A controller-level [Authorize] is undone by [AllowAnonymous] on a single action,
        // and that reads as a deliberate, local exception rather than as a hole. On these
        // routes there is no such thing as a harmless one.
        var opened = new List<string>();

        foreach (var controller in Controllers.Where(IsAdminRoute))
        {
            if (controller.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
                opened.Add(controller.Name);

            opened.AddRange(controller
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
                .Select(m => $"{controller.Name}.{m.Name}"));
        }

        Assert.Empty(opened);
    }

    [Fact]
    public void The_money_endpoints_are_among_the_protected_ones()
    {
        // Named explicitly so that deleting a controller cannot make the sweep above pass by
        // having nothing left to check. The billing routes that used to be listed here went
        // with the buy side (archived 2026-08-19); sales and customers stayed, and they are
        // the ones carrying revenue and ЕГН respectively.
        var routes = Controllers.Where(IsAdminRoute).Select(RouteOf).ToList();

        Assert.Contains("api/admin/sales", routes);
        Assert.Contains("api/admin/customers", routes);
        Assert.Contains("api/admin/audit", routes);
    }

    [Fact]
    public void The_sweep_actually_has_something_to_sweep()
    {
        // Guards the guard: if the assembly scan ever stopped finding controllers — a
        // renamed namespace, a moved project — every test above would pass on an empty set.
        Assert.True(Controllers.Count(IsAdminRoute) >= 9);
    }
}
