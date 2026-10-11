using System;
using System.Collections.Generic;
using System.Linq;
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
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// What a representative can reach through his panel (#38): his own leads, and nothing else.
//
// The policy decides whether the door opens; these decide what is behind it. The controller
// is driven directly with a ClaimsPrincipal carrying preferred_username, the way the token
// arrives, against an in-memory database holding three leads — his, a colleague's and an
// unassigned one — because the whole feature is the difference between those three.
//
// Every refusal is a 404. A 403 would confirm the id exists, the ids are sequential, and
// "how many leads does the company have" is not his to learn.
public class RepPipelineScopeTests
{
    private const string Rep = "dtodorov@nvc-home4you.eu";
    private const string Colleague = "maria@nvc-home4you.eu";
    private static readonly CancellationToken Ct = CancellationToken.None;

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"repscope-{Guid.NewGuid()}")
            .Options);

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    private static EnvConfig Registry() => Config(("REPRESENTATIVES", $"dtodorov={Rep}"));

    // The real services over the in-memory database, with nothing configured: no blob
    // container, no Graph, no drafts. None of them is reached before the ownership check,
    // which is the point being made.
    private static RepPipelineController Controller(AppDbContext db, string? upn = Rep, string? query = null)
    {
        var env = Registry();
        var http = new StubHttpClientFactory();
        var files = new LeadFileStore(env, NullLogger<LeadFileStore>.Instance);

        var controller = new RepPipelineController(
            db,
            new LeadPipelineService(db),
            new LeadService(db),
            new LeadDraftService(new LeadDraftContextBuilder(db), env, NullLogger<LeadDraftService>.Instance),
            new LeadMailService(db, env, http, new GraphTokens(env, http), files, NullLogger<LeadMailService>.Instance),
            files,
            env);

        var context = new DefaultHttpContext();
        if (upn is not null)
            context.User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("preferred_username", upn) }, "test"));
        if (query is not null)
            context.Request.QueryString = new QueryString(query);
        controller.ControllerContext = new ControllerContext { HttpContext = context };
        return controller;
    }

    private static Lead Lead(string name, string? owner, DateTimeOffset? due = null) => new()
    {
        Name = name,
        OwnerUpn = owner,
        Status = LeadStatuses.New,
        Email = "customer@example.com",
        NextContactAt = due,
        CreatedAt = DateTimeOffset.UtcNow.AddDays(-5),
    };

    private static async Task<(int Mine, int Theirs, int Nobodys)> Seed(AppDbContext db)
    {
        var overdue = DateTimeOffset.UtcNow.AddDays(-1);
        var mine = Lead("Mine", Rep, due: overdue);
        var theirs = Lead("Theirs", Colleague, due: overdue);
        var nobodys = Lead("Nobody's", null, due: overdue);
        db.Leads.AddRange(mine, theirs, nobodys);
        await db.SaveChangesAsync();
        return (mine.Id, theirs.Id, nobodys.Id);
    }

    private static async Task<int> SeedAttachment(AppDbContext db, int leadId)
    {
        var entry = new LeadActivity { LeadId = leadId, Type = LeadActivityTypes.Note, Body = "survey", ActorUpn = Colleague };
        db.LeadActivities.Add(entry);
        await db.SaveChangesAsync();
        var file = new LeadAttachment { LeadActivityId = entry.Id, FileName = "survey.pdf", BlobKey = $"leads/{leadId}/x.pdf", SizeBytes = 10 };
        db.LeadAttachments.Add(file);
        await db.SaveChangesAsync();
        return file.Id;
    }

    private static List<LeadSummaryDto> Board(IActionResult result) =>
        Assert.IsType<List<LeadSummaryDto>>(Assert.IsType<OkObjectResult>(result).Value);

    // --- The board -------------------------------------------------------------------

    [Fact]
    public async Task The_board_holds_only_the_callers_leads_whatever_the_query_says()
    {
        // ?owner= is not a parameter here, and pretending to be a colleague on the query
        // string changes nothing; the unassigned lead is not his either.
        using var db = NewDb();
        await Seed(db);

        var board = Board(await Controller(db, query: $"?owner={Colleague}").List(status: null, due: false, Ct));

        var only = Assert.Single(board);
        Assert.Equal("Mine", only.Name);
        Assert.Equal(Rep, only.OwnerUpn);
    }

    [Fact]
    public async Task The_due_view_is_scoped_the_same_way()
    {
        using var db = NewDb();
        await Seed(db);

        var due = Board(await Controller(db, query: "?owner=mine").List(status: null, due: true, Ct));

        Assert.Equal("Mine", Assert.Single(due).Name);
    }

    [Fact]
    public async Task The_board_filters_on_the_registrys_spelling_of_the_caller()
    {
        // The intake wrote the registry's lower-cased UPN into OwnerUpn; the token's casing
        // is Entra's. The board must find his leads whichever way the token spells him.
        using var db = NewDb();
        await Seed(db);

        var board = Board(await Controller(db, upn: "DTodorov@NVC-Home4You.eu").List(status: null, due: false, Ct));

        Assert.Equal("Mine", Assert.Single(board).Name);
    }

    [Fact]
    public async Task A_caller_outside_the_registry_sees_nothing_even_when_signed_in()
    {
        // The policy has already refused them by the time a request reaches the controller;
        // this pins the belt to that brace — an admin who is not a representative gets no
        // board and no lead, however the controller came to be called.
        using var db = NewDb();
        var (mine, _, _) = await Seed(db);
        var admin = Controller(db, upn: "vladi@nvc-home4you.eu");

        Assert.IsType<ForbidResult>(await admin.List(status: null, due: false, Ct));
        Assert.IsType<NotFoundResult>(await admin.Get(mine, Ct));
    }

    // --- One lead ----------------------------------------------------------------------

    [Fact]
    public async Task The_callers_own_lead_answers_as_the_admin_route_would()
    {
        using var db = NewDb();
        var (mine, _, _) = await Seed(db);
        var controller = Controller(db);

        var detail = Assert.IsType<LeadDetailDto>(Assert.IsType<OkObjectResult>(await controller.Get(mine, Ct)).Value);
        Assert.Equal(mine, detail.Id);
        Assert.Equal("no-store", controller.Response.Headers["Cache-Control"].ToString());

        Assert.IsType<OkObjectResult>(await controller.SetStatus(mine, new AdminPipelineController.StatusChange(LeadStatuses.Contacted), Ct));
        Assert.IsType<OkObjectResult>(await controller.SetFields(mine, Fields(nextStep: "Call back Tuesday"), Ct));
        Assert.IsType<OkObjectResult>(await controller.AddActivity(
            mine, new AdminPipelineController.NewActivity(LeadActivityTypes.Call, null, "Spoke about the plot.", null), Ct));

        var saved = await db.Leads.Include(l => l.Activities).SingleAsync(l => l.Id == mine);
        Assert.Equal(LeadStatuses.Contacted, saved.Status);
        Assert.Equal("Call back Tuesday", saved.NextStep);

        // Every write is attributed to the representative himself, so the thread and the
        // audit log name him the way they name a salesperson.
        Assert.All(saved.Activities, a => Assert.Equal(Rep, a.ActorUpn));
        Assert.Contains(saved.Activities, a => a.Type == LeadActivityTypes.StatusChange);
        Assert.Contains(saved.Activities, a => a.Type == LeadActivityTypes.Call);
    }

    [Fact]
    public async Task Another_owners_lead_is_a_404_on_every_endpoint_and_nothing_is_written()
    {
        using var db = NewDb();
        var (_, theirs, nobodys) = await Seed(db);
        var controller = Controller(db);

        foreach (var id in new[] { theirs, nobodys, 999 })
        {
            Assert.IsType<NotFoundResult>(await controller.Get(id, Ct));
            Assert.IsType<NotFoundResult>(await controller.SetStatus(id, new AdminPipelineController.StatusChange(LeadStatuses.Won), Ct));
            Assert.IsType<NotFoundResult>(await controller.SetFields(id, Fields(nextStep: "Hijacked"), Ct));
            Assert.IsType<NotFoundResult>(await controller.AddActivity(
                id, new AdminPipelineController.NewActivity(LeadActivityTypes.Note, null, "Hijacked", null), Ct));
            Assert.IsType<NotFoundResult>(await controller.Draft(id, new AdminPipelineController.DraftRequest("be brief"), Ct));
            Assert.IsType<NotFoundResult>(await controller.Reply(id, "Re:", "Hello", null, null, Ct));
            Assert.IsType<NotFoundResult>(await controller.Upload(id, null!, null, Ct));
        }

        // Refused BEFORE anything is judged or written: a 404, not a 400 for the empty
        // upload, and no row touched.
        var untouched = await db.Leads.Include(l => l.Activities).ToListAsync();
        Assert.Equal(3, untouched.Count);
        Assert.All(untouched, l =>
        {
            Assert.Equal(LeadStatuses.New, l.Status);
            Assert.Null(l.NextStep);
            Assert.Empty(l.Activities);
        });
    }

    [Fact]
    public async Task The_refusal_comes_before_the_request_is_judged()
    {
        // A malformed request on somebody else's lead is still a 404 — a 400 would say the
        // lead was found and only the payload was wrong.
        using var db = NewDb();
        var (mine, theirs, _) = await Seed(db);
        var controller = Controller(db);

        Assert.IsType<NotFoundResult>(await controller.SetStatus(theirs, new AdminPipelineController.StatusChange("wombat"), Ct));
        Assert.IsType<NotFoundResult>(await controller.AddActivity(
            theirs, new AdminPipelineController.NewActivity(LeadActivityTypes.Note, null, "", null), Ct));

        // And on his own lead the same payloads are judged exactly as the admin's would be.
        Assert.IsType<BadRequestObjectResult>(await controller.SetStatus(mine, new AdminPipelineController.StatusChange("wombat"), Ct));
        Assert.IsType<BadRequestObjectResult>(await controller.AddActivity(
            mine, new AdminPipelineController.NewActivity(LeadActivityTypes.Note, null, "", null), Ct));
    }

    // --- Attachments ---------------------------------------------------------------------

    [Fact]
    public async Task An_attachment_on_another_owners_lead_can_be_neither_downloaded_nor_deleted()
    {
        // Two hops away from the lead — file, thread entry, lead — and still his colleague's.
        using var db = NewDb();
        var (_, theirs, _) = await Seed(db);
        var fileId = await SeedAttachment(db, theirs);
        var controller = Controller(db);

        Assert.IsType<NotFoundResult>(await controller.Download(fileId, Ct));
        Assert.IsType<NotFoundResult>(await controller.Delete(fileId, Ct));
        Assert.IsType<NotFoundResult>(await controller.Delete(999, Ct));

        Assert.Equal(1, await db.LeadAttachments.CountAsync());
    }

    [Fact]
    public async Task An_attachment_on_his_own_lead_can_be_deleted()
    {
        // The positive half of the ownership walk. Download is not provable here — with no
        // blob container every download is a 404 — so the delete stands in for both.
        using var db = NewDb();
        var (mine, _, _) = await Seed(db);
        var fileId = await SeedAttachment(db, mine);

        Assert.IsType<NoContentResult>(await Controller(db).Delete(fileId, Ct));

        Assert.Equal(0, await db.LeadAttachments.CountAsync());
    }

    [Fact]
    public async Task The_lead_detail_links_attachments_through_this_panel_not_the_admins()
    {
        // The SPA page is shared, and it follows whatever DownloadUrl says. A link into the
        // admin route would answer the representative 403 — a broken paperclip in a thread
        // he is allowed to read.
        using var db = NewDb();
        var (mine, _, _) = await Seed(db);
        await SeedAttachment(db, mine);

        var detail = Assert.IsType<LeadDetailDto>(Assert.IsType<OkObjectResult>(await Controller(db).Get(mine, Ct)).Value);

        var file = Assert.Single(Assert.Single(detail.Activities).Attachments);
        Assert.StartsWith(RepPipelineController.AttachmentsPath + "/", file.DownloadUrl);
        Assert.DoesNotContain("/api/admin/", file.DownloadUrl);
    }

    // --- Who am I ------------------------------------------------------------------------

    [Fact]
    public void Me_names_the_caller_and_says_which_panel_this_is()
    {
        using var db = NewDb();

        var value = Assert.IsType<OkObjectResult>(Controller(db).Me()).Value!;

        Assert.Equal(Rep, value.GetType().GetProperty("email")!.GetValue(value));
        Assert.Equal("representative", value.GetType().GetProperty("role")!.GetValue(value));
    }

    // Only the one field under test matters, and a positional record cannot be
    // half-constructed; the other twelve are named once, here.
    private static AdminPipelineController.FieldsChange Fields(string? nextStep = null) =>
        new(nextStep, null, null, null, null, null, null, null, null, null, null, null, null);
}
