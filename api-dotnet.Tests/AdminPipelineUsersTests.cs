using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Controllers;
using Data;
using Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Who the owner dropdown offers (#38): the allow-list, the registry, and whoever already
// owns a lead — each inbox once.
//
// LeadPipelineTests pins the merge itself; this pins what the controller FEEDS it, which is
// where the registry was added. A representative is assignable from the day he is
// registered, not from the day his link first brings a lead, because "hand this customer to
// the person whose video they watched" is something sales will want before that day. Driven
// through the real controller, RepPipelineScopeTests' way, so the list read here is the one
// the panel reads and not one a test assembled to look like it.
public class AdminPipelineUsersTests
{
    private const string Admin = "vladi@nvc-home4you.eu";
    private const string Rep = "dtodorov@nvc-home4you.eu";

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"users-{Guid.NewGuid()}")
            .Options);

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    // The real services over the in-memory database with nothing configured, as in
    // RepPipelineScopeTests. Users reads the pipeline and the settings and nothing else, so
    // the rest is there only because the constructor asks for it.
    private static AdminPipelineController Controller(AppDbContext db, EnvConfig env, string upn)
    {
        var http = new StubHttpClientFactory();
        var files = new LeadFileStore(env, NullLogger<LeadFileStore>.Instance);
        var pipeline = new LeadPipelineService(db);
        var email = new EmailService(env, http, NullLogger<EmailService>.Instance);

        var controller = new AdminPipelineController(
            pipeline,
            new LeadService(db),
            new LeadDraftService(new LeadDraftContextBuilder(db), env, NullLogger<LeadDraftService>.Instance),
            new LeadMailService(db, env, http, new GraphTokens(env, http), files, NullLogger<LeadMailService>.Instance),
            new LeadFollowUpService(pipeline, email, env, NullLogger<LeadFollowUpService>.Instance),
            env,
            new CustomerAdminService(db));

        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("preferred_username", upn) }, "test")),
        };
        controller.ControllerContext = new ControllerContext { HttpContext = context };
        return controller;
    }

    private static async Task<List<string>> Users(AppDbContext db, EnvConfig env, string upn = Admin)
    {
        var result = Assert.IsType<OkObjectResult>(await Controller(db, env, upn).Users(CancellationToken.None));
        return Assert.IsType<List<string>>(result.Value);
    }

    [Fact]
    public async Task A_registered_representative_is_assignable_before_any_lead_is_his()
    {
        using var db = NewDb();
        var env = Config(
            ("ADMIN_ALLOWED_USERS", $"{Admin}, maria@nvc-home4you.eu"),
            ("REPRESENTATIVES", $"dtodorov={Rep}"));

        var users = await Users(db, env);

        Assert.Equal(new[] { Rep, "maria@nvc-home4you.eu", Admin }, users);
    }

    [Fact]
    public async Task A_representative_who_is_also_allow_listed_or_already_an_owner_is_listed_once()
    {
        // Three spellings of one inbox — the allow-list's, the registry's and the one a lead
        // was saved with — and the dropdown must show one entry, or the next save would
        // "reassign" a lead to the same person under a different casing.
        using var db = NewDb();
        db.Leads.Add(new Lead { Name = "Ivan", Status = LeadStatuses.New, OwnerUpn = "DTodorov@NVC-Home4You.eu" });
        await db.SaveChangesAsync();
        var env = Config(
            ("ADMIN_ALLOWED_USERS", $"{Admin}, Dtodorov@nvc-home4you.eu"),
            ("REPRESENTATIVES", "dtodorov=dTodorov@nvc-home4you.eu"));

        var users = await Users(db, env);

        Assert.Equal(2, users.Count);
        Assert.Single(users, u => string.Equals(u, Rep, StringComparison.OrdinalIgnoreCase));
        Assert.Contains(Admin, users);
    }

    [Fact]
    public async Task With_no_registry_the_list_is_what_it_was()
    {
        using var db = NewDb();

        Assert.Equal(new[] { Admin }, await Users(db, Config(("ADMIN_ALLOWED_USERS", Admin))));
    }

    [Fact]
    public async Task A_registry_alone_still_lists_its_representatives_beside_the_caller()
    {
        // No allow-list (the whole tenant is staff): the registry is merged all the same, and
        // the signed-in salesperson is there as always, so the dropdown is never empty.
        using var db = NewDb();
        var env = Config(("REPRESENTATIVES", $"dtodorov={Rep}; mpetrova=mpetrova@nvc-home4you.eu"));

        var users = await Users(db, env, upn: "sales@nvc-home4you.eu");

        Assert.Equal(new[] { Rep, "mpetrova@nvc-home4you.eu", "sales@nvc-home4you.eu" }, users);
    }
}
