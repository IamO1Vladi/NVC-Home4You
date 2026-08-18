using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Azure App Service terminates TLS at its front end and forwards to the app over plain
// HTTP, so without this the app believes every request is insecure. That breaks OIDC:
// the correlation/nonce cookies need SameSite=None to survive Microsoft's cross-site
// form_post callback, a browser rejects SameSite=None unless the cookie is also Secure,
// and the app won't set Secure on a connection it thinks is HTTP. Result is a failed
// correlation and a 500 on /signin-oidc.
builder.Services.Configure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto |
        Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor;
    // App Service's front end isn't in the default known-proxy list, and its address
    // isn't fixed, so the restriction has to be lifted for the headers to be honoured.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// CORS: allow Vite dev server on 5173 and localhost:5173
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:5173", "https://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()
));

builder.Services.AddControllers();
builder.Services.AddMemoryCache();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => {
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "NVC Home4You API", Version = "v1" });
});

builder.Services.AddHttpClient<Services.QuickbaseClient>(client => {
    client.BaseAddress = new Uri("https://api.quickbase.com/");
});

builder.Services.AddHttpClient<Services.QuickbaseApi>(client => {
    client.BaseAddress = new Uri("https://api.quickbase.com/");
});

builder.Services.AddSingleton<Services.EnvConfig>();

// SQL data layer (Quickbase -> Azure SQL migration). Registered only when a connection
// string is present, so environments without a database start exactly as before and
// every entity keeps resolving to Quickbase.
var sqlConnectionString = (builder.Configuration["SQL_CONNECTION_STRING"] ?? "").Trim();
if (!string.IsNullOrWhiteSpace(sqlConnectionString))
{
    // The audit log listens to every save (see AuditInterceptor). Registered before the
    // context so the resolver below can pull it out of the provider.
    //
    // ICurrentActor is how the interceptor learns who is acting. HttpCurrentActor returns
    // null outside a request, which is exactly right for the importers and the CLI: the
    // audit log records those as "system" rather than inventing a username.
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<Services.ICurrentActor, Services.HttpCurrentActor>();
    builder.Services.AddScoped<Services.AuditInterceptor>();

    builder.Services.AddDbContext<Data.AppDbContext>((serviceProvider, options) =>
        options
            .AddInterceptors(serviceProvider.GetRequiredService<Services.AuditInterceptor>())
            .UseSqlServer(sqlConnectionString, sql =>
        {
            // Serverless Azure SQL auto-pauses when idle and returns error 40613 for the
            // 30-60s it takes to resume. The default retry budget expires before then, so
            // the first request after a quiet period would fail. Retry longer instead.
            sql.EnableRetryOnFailure(
                maxRetryCount: 12,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null);
        }));

    // Registered inside this block because they depend on AppDbContext. Registering them
    // unconditionally makes startup fail outright in Development, where the DI container
    // validates every descriptor up front - so a machine without a connection string
    // couldn't even run the site.
    builder.Services.AddScoped<Services.ReviewImportService>();
    builder.Services.AddScoped<Services.SqlReviewService>();
    builder.Services.AddScoped<Services.ReviewModerationService>();
    builder.Services.AddScoped<Services.SqlGalleryService>();
    builder.Services.AddScoped<Services.SqlCasesPageService>();
    builder.Services.AddScoped<Services.SqlLeadService>();
    builder.Services.AddScoped<Services.LeadImportService>();
    builder.Services.AddScoped<Services.CrmLeadImportService>();
    builder.Services.AddScoped<Services.LeadDuplicateService>();
    builder.Services.AddScoped<Services.LeadAdminService>();
    builder.Services.AddScoped<Services.LeadService>();
    builder.Services.AddScoped<Services.LeadPipelineService>();
    builder.Services.AddScoped<Services.LeadMailService>();
    builder.Services.AddScoped<Services.LeadFollowUpService>();

    // Customers, the suppliers they were built by, and what passed between them.
    builder.Services.AddScoped<Services.AuditReadService>();
    builder.Services.AddScoped<Services.AuditArchiveService>();

    // Checks its own config and returns immediately when archiving is off, same shape
    // as LeadMailPoller — so "is this on?" lives in EnvConfig, in one place.
    builder.Services.AddHostedService<Services.AuditArchiveWorker>();
    builder.Services.AddScoped<Services.CustomerAdminService>();
    builder.Services.AddScoped<Services.FactoryAdminService>();
    builder.Services.AddScoped<Services.FactorySheetAdminService>();
    builder.Services.AddScoped<Services.SqlSavedConfigService>();
    builder.Services.AddScoped<Services.SavedConfigImportService>();

    // Owns its own container client rather than sharing the images one — see LeadFileStore
    // for why that separation is the point rather than an accident.
    builder.Services.AddSingleton<Services.LeadFileStore>();

    // Singleton so the Graph token is cached across every caller — the poller wakes every
    // two minutes and would otherwise mint a token each time.
    builder.Services.AddSingleton<Services.GraphTokens>();

    // Registered unconditionally; it checks its own config and returns immediately when
    // inbound mail is off, which keeps the "is this on?" decision in one place.
    builder.Services.AddHostedService<Services.LeadMailPoller>();
    builder.Services.AddScoped<Services.LeadDraftContextBuilder>();
    builder.Services.AddScoped<Services.LeadDraftService>();
}

// --- Admin sign-in (Microsoft Entra ID) -----------------------------------------------
// Registered only when client id, tenant id and secret are all present. If any is missing
// the admin controllers stay unreachable: [Authorize] with no authentication configured
// rejects every request, so the panel fails closed rather than opening unprotected.
var envCfg = new Services.EnvConfig(builder.Configuration);
var adminAuthReady = envCfg.AdminAuthConfigured && !string.IsNullOrWhiteSpace(sqlConnectionString);
if (adminAuthReady)
{
    builder.Services
        .AddAuthentication(Microsoft.AspNetCore.Authentication.OpenIdConnect.OpenIdConnectDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApp(options =>
        {
            options.Instance = "https://login.microsoftonline.com/";
            options.TenantId = envCfg.EntraTenantId;
            options.ClientId = envCfg.EntraClientId;
            options.ClientSecret = envCfg.EntraClientSecret;
            options.CallbackPath = "/signin-oidc";

            // Authorization code flow rather than Identity.Web's default of id_token.
            //
            // The default requires "ID tokens (used for implicit and hybrid flows)" to be
            // ticked on the app registration, and returns the token through the browser
            // (AADSTS700054 when it isn't enabled). Code flow exchanges a short-lived code
            // for tokens over a back channel using the client secret we already hold, so
            // no token ever passes through the browser and implicit grant stays off.
            options.ResponseType = Microsoft.IdentityModel.Protocols.OpenIdConnect.OpenIdConnectResponseType.Code;

            // Microsoft returns the login result as a cross-site POST (response_mode=
            // form_post). A SameSite=Lax cookie is not sent on a cross-site POST, so these
            // must be None — and None is only accepted alongside Secure.
            options.CorrelationCookie.SameSite = SameSiteMode.None;
            options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.Always;
            options.NonceCookie.SameSite = SameSiteMode.None;
            options.NonceCookie.SecurePolicy = CookieSecurePolicy.Always;
        });

    // An API must not answer a fetch() with a 302 to Microsoft. fetch follows redirects
    // automatically, login.microsoftonline.com sends no CORS headers, and the browser
    // blocks the read — so the SPA sees an opaque network failure instead of "sign in".
    // Interactive sign-in only works as a top-level navigation (see /admin/signin below),
    // so /api/* gets a plain 401 and the SPA decides what to do about it.
    builder.Services.Configure<Microsoft.AspNetCore.Authentication.OpenIdConnect.OpenIdConnectOptions>(
        Microsoft.AspNetCore.Authentication.OpenIdConnect.OpenIdConnectDefaults.AuthenticationScheme,
        options =>
        {
            // Chain rather than replace: Microsoft.Identity.Web installs its own handler
            // here and dropping it would break the auth flow.
            var previous = options.Events.OnRedirectToIdentityProvider;
            options.Events.OnRedirectToIdentityProvider = async ctx =>
            {
                if (ctx.Request.Path.StartsWithSegments("/api"))
                {
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    ctx.HandleResponse();
                    return;
                }
                if (previous is not null) await previous(ctx);
            };

            // A failed callback otherwise surfaces as a bare 500 with an empty body, which
            // says nothing about what went wrong and leaves the user stranded on
            // /signin-oidc. Send them back to the panel with the reason instead, and clear
            // the stale correlation cookies so a retry starts clean rather than piling up
            // another nonce pair on every attempt.
            options.Events.OnRemoteFailure = ctx =>
            {
                var reason = ctx.Failure?.Message ?? "unknown";
                foreach (var cookie in ctx.Request.Cookies.Keys)
                {
                    if (cookie.StartsWith(".AspNetCore.Correlation.", StringComparison.Ordinal) ||
                        cookie.StartsWith(".AspNetCore.OpenIdConnect.Nonce.", StringComparison.Ordinal))
                    {
                        ctx.Response.Cookies.Delete(cookie);
                    }
                }
                ctx.Response.Redirect($"/admin?authError={Uri.EscapeDataString(reason)}");
                ctx.HandleResponse();
                return Task.CompletedTask;
            };
        });
}
else
{
    // No Entra config: register a scheme that authenticates nobody, so the [Authorize]
    // challenge answers a clean 401 instead of throwing "no authenticationScheme was
    // specified" and surfacing a 500.
    builder.Services
        .AddAuthentication(Services.DisabledAdminAuthHandler.SchemeName)
        .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, Services.DisabledAdminAuthHandler>(
            Services.DisabledAdminAuthHandler.SchemeName, _ => { });
}

// The AdminOnly policy is always defined, even when Entra isn't configured. If it were
// only registered in the configured case, the admin endpoints would throw "policy not
// found" (a 500) instead of denying cleanly — safe, but indistinguishable from a bug.
// Unconfigured means deny-everything.
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        if (!adminAuthReady)
        {
            policy.RequireAssertion(_ => false);
            return;
        }

        policy.RequireAuthenticatedUser();

        // Signed in to the tenant is enough by default. When ADMIN_ALLOWED_USERS is set,
        // narrow it to those accounts so a new hire with an M365 mailbox doesn't silently
        // inherit access to live pricing and customer data.
        var allowed = envCfg.AdminAllowedUsers;
        if (allowed.Length > 0)
        {
            policy.RequireAssertion(ctx =>
            {
                var upn = ctx.User.FindFirst("preferred_username")?.Value
                          ?? ctx.User.Identity?.Name
                          ?? "";
                return allowed.Contains(upn.Trim().ToLowerInvariant());
            });
        }
    });
});
// Singleton so proxied image bytes survive across requests (it owns its own size-capped cache).
builder.Services.AddSingleton<Services.ImageCache>();

// --- Image storage (Quickbase -> Azure Blob) -------------------------------------------
// The Quickbase source is always registered: it is both today's behaviour and the fallback
// for any key not yet copied to Blob. The Blob source is registered only when a connection
// string is present, and ImageStore takes it as an optional dependency, so an environment
// without storage configured serves images exactly as it does now.
builder.Services.AddHttpClient<Services.QuickbaseImageSource>();
builder.Services.AddSingleton<Services.ImageUrls>();

// Converts uploads and imports to WebP. Stateless, so a singleton.
builder.Services.AddSingleton<Services.ImageProcessor>();

var blobConnectionString = (builder.Configuration["BLOB_CONNECTION_STRING"] ?? "").Trim();
if (!string.IsNullOrWhiteSpace(blobConnectionString))
{
    var containerName = (builder.Configuration["BLOB_IMAGES_CONTAINER"] ?? "").Trim();
    if (string.IsNullOrWhiteSpace(containerName)) containerName = "images";

    builder.Services.AddSingleton(_ =>
        new Azure.Storage.Blobs.BlobContainerClient(blobConnectionString, containerName));
    builder.Services.AddSingleton<Services.BlobImageSource>();
}

builder.Services.AddScoped<Services.ImageStore>(sp => new Services.ImageStore(
    sp.GetRequiredService<Services.ImageCache>(),
    sp.GetRequiredService<Services.QuickbaseImageSource>(),
    sp.GetService<Services.BlobImageSource>()));

builder.Services.AddScoped<Services.GalleryService>();

// Per-product <head> tags for the gallery detail pages, resolved per request because
// products are database rows rather than build-time routes. See GallerySeoService.
builder.Services.AddScoped<Services.GallerySeoService>();
builder.Services.AddScoped<Services.FormService>();
builder.Services.AddScoped<Services.CasesPageService>();
builder.Services.AddScoped<Services.ReviewService>();

// Read path for reviews, chosen per request by DATA_SOURCE_REVIEWS. DataSourceFor only
// returns Sql when a connection string is present, so SqlReviewService is guaranteed to
// be registered whenever this resolves to it.
builder.Services.AddScoped<Services.IReviewStore>(sp =>
    sp.GetRequiredService<Services.EnvConfig>().DataSourceFor("reviews") == Services.DataSource.Sql
        ? sp.GetRequiredService<Services.SqlReviewService>()
        : sp.GetRequiredService<Services.ReviewService>());
// Read path for the gallery, chosen per request by DATA_SOURCE_GALLERY. DataSourceFor only
// returns Sql when a connection string is present, so SqlGalleryService is guaranteed to be
// registered whenever this resolves to it.
builder.Services.AddScoped<Services.IGalleryStore>(sp =>
    sp.GetRequiredService<Services.EnvConfig>().DataSourceFor("gallery") == Services.DataSource.Sql
        ? sp.GetRequiredService<Services.SqlGalleryService>()
        : sp.GetRequiredService<Services.GalleryService>());

// Read path for the cases page, chosen per request by DATA_SOURCE_CASES.
builder.Services.AddScoped<Services.ICasesPageStore>(sp =>
    sp.GetRequiredService<Services.EnvConfig>().DataSourceFor("cases") == Services.DataSource.Sql
        ? sp.GetRequiredService<Services.SqlCasesPageService>()
        : sp.GetRequiredService<Services.CasesPageService>());

// Write path for leads, chosen per request by DATA_SOURCE_LEADS, and wrapped in
// DualWriteLeadStore when LEADS_DUAL_WRITE is on so the non-authoritative store is
// exercised under real traffic without being able to cost a lead. Both flags are inert
// without a connection string, so the default everywhere is Quickbase only — exactly
// what shipped before this seam existed.
builder.Services.AddScoped<Services.ILeadStore>(sp =>
{
    var env = sp.GetRequiredService<Services.EnvConfig>();
    var quickbase = sp.GetRequiredService<Services.FormService>();

    if (env.DataSourceFor("leads") != Services.DataSource.Sql)
    {
        return env.LeadsDualWrite
            ? new Services.DualWriteLeadStore(
                quickbase,
                sp.GetRequiredService<Services.SqlLeadService>(),
                sp.GetRequiredService<ILogger<Services.DualWriteLeadStore>>())
            : quickbase;
    }

    var sql = sp.GetRequiredService<Services.SqlLeadService>();
    return env.LeadsDualWrite
        ? new Services.DualWriteLeadStore(
            sql,
            quickbase,
            sp.GetRequiredService<ILogger<Services.DualWriteLeadStore>>())
        : sql;
});

builder.Services.AddScoped<Services.SavedConfigService>();

// Read/write path for saved configurator links, chosen per request by
// DATA_SOURCE_SAVEDCONFIGS. The SQL implementation falls back to Quickbase on a miss, so
// this flag can be flipped before the import has run — see SqlSavedConfigService, and note
// that these codes are already in customers' inboxes.
builder.Services.AddScoped<Services.ISavedConfigStore>(sp =>
    sp.GetRequiredService<Services.EnvConfig>().DataSourceFor("savedconfigs") == Services.DataSource.Sql
        ? sp.GetRequiredService<Services.SqlSavedConfigService>()
        : sp.GetRequiredService<Services.SavedConfigService>());
builder.Services.AddScoped<Services.EmailService>();

// Only useful when there is somewhere to import into; the CLI says so rather than failing
// with a DI resolution error.
if (!string.IsNullOrWhiteSpace(blobConnectionString))
{
    // Needs Blob but not SQL: these images belong to no database row.
    builder.Services.AddScoped<Services.ContentImageMigrator>();
}

// The gallery import writes rows AND blobs, so it needs both. Registered only when both are
// configured, so `import-gallery` reports which one is missing instead of throwing.
if (!string.IsNullOrWhiteSpace(blobConnectionString) && !string.IsNullOrWhiteSpace(sqlConnectionString))
{
    builder.Services.AddScoped<Services.GalleryImportService>();
    builder.Services.AddScoped<Services.CasesImportService>();

    // Admin write paths. They store images, so they need Blob as well as SQL — without both,
    // the controllers cannot resolve and the admin routes stay absent rather than half-working.
    builder.Services.AddScoped<Services.GalleryAdminService>();
    builder.Services.AddScoped<Services.CasesAdminService>();

    // Reads image keys from SQL and checks them against Blob, so it needs both.
    builder.Services.AddScoped<Services.MigrationVerifier>();
}

var app = builder.Build();

// --- Maintenance CLI ------------------------------------------------------------------
// `dotnet run -- import-reviews` / `-- compare-reviews`. Kept off HTTP on purpose: the app
// has no authentication yet, so an import endpoint would let anyone rewrite the table and
// hammer Quickbase. These run and exit without ever starting the web server.
if (args.Length > 0 && (args[0] == "import-reviews" || args[0] == "compare-reviews"))
{
    using var scope = app.Services.CreateScope();
    var importer = scope.ServiceProvider.GetService<Services.ReviewImportService>();
    if (importer is null)
    {
        Console.Error.WriteLine("SQL_CONNECTION_STRING is not configured, so there is no database to import into.");
        return 1;
    }

    if (args[0] == "import-reviews")
    {
        var r = await importer.ImportAsync(CancellationToken.None);
        Console.WriteLine($"Fetched {r.Fetched} from Quickbase -> inserted {r.Inserted}, updated {r.Updated}, skipped {r.Skipped}.");
        return 0;
    }

    var (compared, diffs) = await importer.CompareAsync(CancellationToken.None);
    Console.WriteLine($"Compared {compared} rows; {diffs.Count} difference(s).");
    foreach (var d in diffs.Take(50))
        Console.WriteLine($"  rid {d.QuickbaseRecordId} {d.Field}: quickbase=[{d.Quickbase}] sql=[{d.Sql}]");
    if (diffs.Count > 50) Console.WriteLine($"  ... and {diffs.Count - 50} more.");
    // Non-zero exit when they disagree, so this can gate a cutover in a script.
    return diffs.Count == 0 ? 0 : 2;
}

// `dotnet run -- import-leads [--dry-run]` / `-- compare-leads`. Copies the Quickbase
// offers and questions tables into SQL, carrying the two sales checkboxes as well as the
// intake fields. Idempotent — matched on Quickbase record id, so re-running updates in
// place. Quickbase remains the source of truth until DATA_SOURCE_LEADS says otherwise.
if (args.Length > 0 && (args[0] == "import-leads" || args[0] == "compare-leads"))
{
    using var scope = app.Services.CreateScope();
    var importer = scope.ServiceProvider.GetService<Services.LeadImportService>();
    if (importer is null)
    {
        Console.Error.WriteLine("SQL_CONNECTION_STRING is not configured, so there is no database to import into.");
        return 1;
    }

    if (args[0] == "import-leads")
    {
        var dryRun = args.Contains("--dry-run");
        if (dryRun) Console.WriteLine("DRY RUN — nothing will be written.");

        var offers = await importer.ImportOffersAsync(dryRun, CancellationToken.None);
        Console.WriteLine($"offers:    fetched {offers.Fetched} -> inserted {offers.Inserted}, updated {offers.Updated}, skipped {offers.Skipped}.");

        var questions = await importer.ImportQuestionsAsync(dryRun, CancellationToken.None);
        Console.WriteLine($"questions: fetched {questions.Fetched} -> inserted {questions.Inserted}, updated {questions.Updated}, skipped {questions.Skipped}.");
        return 0;
    }

    var (comparedLeads, leadDiffs) = await importer.CompareAsync(CancellationToken.None);
    Console.WriteLine($"Compared {comparedLeads} rows; {leadDiffs.Count} difference(s).");
    foreach (var d in leadDiffs.Take(50))
        Console.WriteLine($"  {d.Table} rid {d.QuickbaseRecordId} {d.Field}: quickbase=[{d.Quickbase}] sql=[{d.Sql}]");
    if (leadDiffs.Count > 50) Console.WriteLine($"  ... and {leadDiffs.Count - 50} more.");
    // Non-zero exit when they disagree, so this can gate the cutover in a script.
    return leadDiffs.Count == 0 ? 0 : 2;
}

// `dotnet run -- lead-schema`. Read-only: prints every field on both lead tables so the
// migration can be built against what Quickbase actually holds rather than the eight
// intake fields the app happens to write. Needs only QUICKBASE_REALM / QUICKBASE_TOKEN,
// touches no database, and changes nothing.
if (args.Length > 0 && args[0] == "lead-schema")
{
    using var scope = app.Services.CreateScope();
    var qb = scope.ServiceProvider.GetRequiredService<Services.QuickbaseApi>();
    var env = scope.ServiceProvider.GetRequiredService<Services.EnvConfig>();

    if (!qb.IsConfigured)
    {
        Console.Error.WriteLine("Quickbase is not configured (QUICKBASE_REALM / QUICKBASE_TOKEN).");
        return 1;
    }

    foreach (var (name, tableId) in new[] { ("OFFERS", env.TableOffer), ("QUESTIONS", env.TableQuestion) })
    {
        Console.WriteLine();
        if (string.IsNullOrWhiteSpace(tableId))
        {
            Console.WriteLine($"=== {name}: table id not configured, skipping ===");
            continue;
        }

        Console.WriteLine($"=== {name} ({tableId}) ===");
        var fields = await qb.GetFieldsAsync(tableId, CancellationToken.None);
        foreach (var f in fields.OrderBy(f => f.id))
        {
            var flags = string.Join(" ", new[]
            {
                f.required ? "required" : null,
                f.unique ? "unique" : null,
            }.Where(x => x is not null));
            Console.WriteLine($"  {f.id,4}  {f.fieldType,-16} {f.label}{(flags.Length > 0 ? $"  [{flags}]" : "")}");
        }
        Console.WriteLine($"  ({fields.Count} fields)");
    }

    return 0;
}

// `dotnet run -- import-crm-leads [--dry-run]`. Copies the Quickbase CRM Lead table into
// the SQL Leads table. Idempotent on Quickbase record id, so it is safe to re-run.
//
// Distinct from `import-leads`, which carries website form submissions into Offers and
// Questions. That one moves an inbox; this one moves the relationship sheet.
// `dotnet run -- import-saved-configs [--dry-run]`
//
// The last table off Quickbase. Re-runnable: matched on QuickbaseRecordId, and a code that
// already exists in SQL is left alone rather than overwritten — after the cutover those are
// live rows saved natively, and a stale copy landing on one would break a link a customer
// is holding.
if (args.Length > 0 && args[0] == "import-saved-configs")
{
    using var scope = app.Services.CreateScope();
    var importer = scope.ServiceProvider.GetService<Services.SavedConfigImportService>();

    if (importer is null)
    {
        Console.Error.WriteLine("SQL is not configured (SQL_CONNECTION_STRING), so there is nothing to import into.");
        return 1;
    }

    var cfgDryRun = args.Contains("--dry-run");
    var cfgResult = await importer.ImportAsync(cfgDryRun, CancellationToken.None);

    Console.WriteLine(cfgDryRun ? "DRY RUN — nothing was written." : "Import complete.");
    Console.WriteLine($"  fetched from Quickbase : {cfgResult.Fetched}");
    Console.WriteLine($"  inserted               : {cfgResult.Created}");
    Console.WriteLine($"  updated in place       : {cfgResult.Updated}");
    Console.WriteLine($"  skipped                : {cfgResult.Skipped}");

    foreach (var problem in cfgResult.Problems) Console.WriteLine($"  ! {problem}");

    // A skipped row is not a failed run — it is usually a code already live in SQL — but a
    // run that imported nothing at all deserves a non-zero exit.
    return cfgResult.Fetched == 0 && cfgResult.Problems.Count > 0 ? 1 : 0;
}

// Runs the audit archive by hand: emails everything older than the retention window and
// then deletes it. --dry-run writes the CSV to disk instead, sending and deleting nothing,
// which is the way to see what a real run WOULD remove before letting it.
if (args.Length > 0 && args[0] == "archive-audit-log")
{
    using var auditScope = app.Services.CreateScope();
    var archive = auditScope.ServiceProvider.GetService<Services.AuditArchiveService>();

    if (archive is null)
    {
        Console.Error.WriteLine("SQL is not configured (SQL_CONNECTION_STRING), so there is no audit log.");
        return 1;
    }

    if (args.Contains("--dry-run"))
    {
        var db = auditScope.ServiceProvider.GetRequiredService<Data.AppDbContext>();
        var envCfgAudit = auditScope.ServiceProvider.GetRequiredService<Services.EnvConfig>();
        var auditCutoff = DateTimeOffset.UtcNow.AddMonths(-envCfgAudit.AuditRetentionMonths);

        var doomedRows = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
            db.AuditEntries.AsNoTracking()
              .Where(a => a.OccurredAt < auditCutoff)
              .OrderBy(a => a.OccurredAt).ThenBy(a => a.Id));

        Console.WriteLine($"DRY RUN — nothing was sent and nothing was deleted.");
        Console.WriteLine($"  retention      : {envCfgAudit.AuditRetentionMonths} months");
        Console.WriteLine($"  cutoff         : {auditCutoff.UtcDateTime:yyyy-MM-dd}");
        Console.WriteLine($"  would archive  : {doomedRows.Count} entries");
        Console.WriteLine($"  would send to  : {envCfgAudit.AuditArchiveTo}");

        if (doomedRows.Count > 0)
        {
            var outPath = System.IO.Path.Combine(
                System.IO.Directory.GetCurrentDirectory(),
                $"audit-archive-preview-{DateTime.UtcNow:yyyyMMddHHmmss}.csv");
            await System.IO.File.WriteAllBytesAsync(outPath, Services.AuditArchiveService.ToCsv(doomedRows));
            Console.WriteLine($"  preview written: {outPath}");
        }

        return 0;
    }

    // force: someone typing the command has decided, so the enabled flag — which exists to
    // stop the SCHEDULED job running on its own — does not block them.
    var auditResult = await archive.RunAsync(force: true, CancellationToken.None);

    Console.WriteLine(auditResult.Outcome switch
    {
        Services.AuditArchiveService.ArchiveOutcome.Archived =>
            $"Archived and deleted {auditResult.Count} entries. Sent as {auditResult.FileName} to {string.Join(", ", auditResult.Recipients)}.",
        Services.AuditArchiveService.ArchiveOutcome.NothingToArchive =>
            "Nothing is old enough to archive. Nothing was deleted.",
        Services.AuditArchiveService.ArchiveOutcome.NoRecipients =>
            $"NOT RUN: {auditResult.Error}",
        Services.AuditArchiveService.ArchiveOutcome.SendFailed =>
            $"FAILED: {auditResult.Error} ({auditResult.Count} entries are still in the table.)",
        _ => "Archiving is switched off.",
    });

    return auditResult.Ok ? 0 : 1;
}

if (args.Length > 0 && args[0] == "import-crm-leads")
{
    using var scope = app.Services.CreateScope();
    var importer = scope.ServiceProvider.GetService<Services.CrmLeadImportService>();

    if (importer is null)
    {
        Console.Error.WriteLine("SQL is not configured (SQL_CONNECTION_STRING), so there is nothing to import into.");
        return 1;
    }

    if (!importer.IsConfigured)
    {
        Console.Error.WriteLine(
            "Quickbase is not configured. Needs QUICKBASE_REALM, QUICKBASE_TOKEN and QB_TABLE_CRM_LEADS.");
        return 1;
    }

    var crmDryRun = args.Contains("--dry-run");
    var crmResult = await importer.ImportAsync(crmDryRun, CancellationToken.None);

    Console.WriteLine(crmDryRun ? "DRY RUN — nothing was written." : "Import complete.");
    Console.WriteLine($"  fetched from Quickbase : {crmResult.Fetched}");
    Console.WriteLine($"  inserted               : {crmResult.Inserted}");
    Console.WriteLine($"  updated in place       : {crmResult.Updated}");
    Console.WriteLine($"  skipped (unusable)     : {crmResult.Skipped}");
    Console.WriteLine($"  linked to a house      : {crmResult.LinkedToHouse}");
    Console.WriteLine($"  house link unresolved  : {crmResult.UnresolvedHouses}");
    Console.WriteLine($"  with a follow-up date  : {crmResult.WithFollowUp}");
    Console.WriteLine($"  with an owner          : {crmResult.WithOwner}");

    Console.WriteLine();
    Console.WriteLine("By stage:");
    foreach (var pair in crmResult.ByStatus.OrderByDescending(p => p.Value))
        Console.WriteLine($"  {pair.Value,5}  {pair.Key}");

    Console.WriteLine();
    Console.WriteLine("By category:");
    foreach (var pair in crmResult.ByCategory.OrderByDescending(p => p.Value))
        Console.WriteLine($"  {pair.Value,5}  {pair.Key}");

    if (crmResult.Warnings.Count > 0)
    {
        Console.WriteLine();
        Console.WriteLine($"Warnings ({crmResult.Warnings.Count}):");
        foreach (var warning in crmResult.Warnings.Take(40)) Console.WriteLine($"  {warning}");
        if (crmResult.Warnings.Count > 40) Console.WriteLine($"  … and {crmResult.Warnings.Count - 40} more");
    }

    return 0;
}

// `dotnet run -- find-duplicate-leads`. Read-only: leads that look like the same customer
// twice, which the CRM import made possible by creating 257 leads alongside the ones the
// panel had already promoted from website enquiries.
//
// Reports only. Merging means choosing which name, owner and stage survive and moving a
// conversation under a different row — decisions for somebody who knows the customer.
if (args.Length > 0 && args[0] == "find-duplicate-leads")
{
    using var scope = app.Services.CreateScope();
    var finder = scope.ServiceProvider.GetService<Services.LeadDuplicateService>();

    if (finder is null)
    {
        Console.Error.WriteLine("SQL is not configured (SQL_CONNECTION_STRING).");
        return 1;
    }

    var report = await finder.FindAsync(CancellationToken.None);

    static void PrintCluster(Services.LeadDuplicateService.Cluster cluster)
    {
        Console.WriteLine();
        Console.WriteLine($"--- same {cluster.Signal}: {cluster.Value} ---");
        foreach (var lead in cluster.Leads)
        {
            Console.WriteLine(
                $"  #{lead.Id,-5} {Truncate(lead.Name, 26),-26} {lead.Status,-12} " +
                $"{lead.CreatedAt:yyyy-MM-dd}  {lead.ActivityCount,2} msg  {lead.Origin}");
        }
    }

    static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..(max - 1)] + "…";

    Console.WriteLine($"Scanned {report.Scanned} leads.");
    Console.WriteLine();
    Console.WriteLine($"LIKELY DUPLICATES — same email or phone: {report.Strong.Count} group(s), " +
                      $"{report.DuplicateLeads} extra lead(s)");
    foreach (var cluster in report.Strong) PrintCluster(cluster);

    Console.WriteLine();
    Console.WriteLine($"WORTH A LOOK — same name only, no shared email or phone: {report.Weak.Count} group(s)");
    Console.WriteLine("  A shared name is a hint, not a finding. Check before merging anything here.");
    foreach (var cluster in report.Weak) PrintCluster(cluster);

    return 0;
}

// `dotnet run -- qb-peek <tableId> [rows]`. Read-only: every field on a table, then the
// raw values of the first few records.
//
// The schema alone is not enough to build an import against, and finding that out late is
// expensive. A "Text - Multiple Choice" field tells you nothing about whether its values
// are "New/Contacted/Won" or "Нов/Свързан/Спечелен"; a User field comes back as an object
// whose shape you have to see to map. Both are the kind of thing the handoff means by
// "gotchas found the hard way" — so this exists to find them in one call rather than in a
// half-finished import.
if (args.Length > 0 && args[0] == "qb-peek")
{
    using var scope = app.Services.CreateScope();
    var qb = scope.ServiceProvider.GetRequiredService<Services.QuickbaseApi>();

    if (!qb.IsConfigured)
    {
        Console.Error.WriteLine("Quickbase is not configured (QUICKBASE_REALM / QUICKBASE_TOKEN).");
        return 1;
    }

    var peekTable = args.Length > 1 ? args[1] : "";
    if (string.IsNullOrWhiteSpace(peekTable))
    {
        Console.Error.WriteLine("Usage: dotnet run -- qb-peek <tableId> [rows]");
        return 1;
    }

    var peekRows = args.Length > 2 && int.TryParse(args[2], out var n) ? Math.Clamp(n, 1, 20) : 3;

    var peekFields = await qb.GetFieldsAsync(peekTable, CancellationToken.None);
    Console.WriteLine($"=== {peekTable}: {peekFields.Count} fields ===");
    foreach (var f in peekFields.OrderBy(f => f.id))
        Console.WriteLine($"  {f.id,4}  {f.fieldType,-22} {f.label}");

    var peekResult = await qb.QueryPageAsync(
        peekTable, peekFields.Select(f => f.id), where: "", sortFid: 3, sortOrder: "DESC",
        skip: 0, top: peekRows, CancellationToken.None);

    var labels = peekFields.ToDictionary(f => f.id.ToString(), f => f.label ?? "");

    Console.WriteLine();
    Console.WriteLine($"=== newest {peekResult.data?.Count ?? 0} record(s) ===");
    foreach (var record in peekResult.data ?? new List<Models.QbRec>())
    {
        Console.WriteLine("---");
        foreach (var pair in record.OrderBy(p => int.TryParse(p.Key, out var k) ? k : 0))
        {
            var raw = pair.Value.value.GetRawText();
            if (raw is "null" or "\"\"") continue;      // empty fields are noise here
            var label = labels.TryGetValue(pair.Key, out var l) ? l : "";
            Console.WriteLine($"  {pair.Key,4} {label,-28} {raw}");
        }
    }

    return 0;
}

// `dotnet run -- qb-values <tableId> <fid,fid,...>`. Read-only: every distinct value of
// the given fields, with counts.
//
// The companion to qb-peek. A sample of three records shows you the SHAPE of a
// multiple-choice field; only the whole table shows you its VOCABULARY, and a status map
// built from three rows silently drops every value that happened not to be in them.
if (args.Length > 0 && args[0] == "qb-values")
{
    using var scope = app.Services.CreateScope();
    var qb = scope.ServiceProvider.GetRequiredService<Services.QuickbaseApi>();

    if (!qb.IsConfigured)
    {
        Console.Error.WriteLine("Quickbase is not configured (QUICKBASE_REALM / QUICKBASE_TOKEN).");
        return 1;
    }

    if (args.Length < 3)
    {
        Console.Error.WriteLine("Usage: dotnet run -- qb-values <tableId> <fid,fid,...>");
        return 1;
    }

    var valuesTable = args[1];
    var valueFids = args[2]
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(x => int.TryParse(x, out var fid) ? fid : 0)
        .Where(fid => fid > 0)
        .ToArray();

    var tally = valueFids.ToDictionary(fid => fid, _ => new Dictionary<string, int>(StringComparer.Ordinal));
    var scanned = 0;

    // Paged, for the reason QueryPageAsync exists: the 500-row cap is silent, and a
    // vocabulary built from the first 500 rows of a growing table is a vocabulary with
    // holes in it.
    for (var skip = 0; ; skip += 500)
    {
        var page = await qb.QueryPageAsync(
            valuesTable, valueFids.Append(3), where: "", sortFid: 3, sortOrder: "ASC",
            skip: skip, top: 500, CancellationToken.None);

        var batch = page.data ?? new List<Models.QbRec>();
        if (batch.Count == 0) break;
        scanned += batch.Count;

        foreach (var record in batch)
        {
            foreach (var fid in valueFids)
            {
                if (!record.TryGetElement(fid, out var element)) continue;
                var raw = element.GetRawText();
                if (raw is "null" or "\"\"") continue;
                tally[fid][raw] = tally[fid].TryGetValue(raw, out var count) ? count + 1 : 1;
            }
        }

        if (batch.Count < 500) break;
    }

    Console.WriteLine($"=== {valuesTable}: {scanned} records scanned ===");
    foreach (var fid in valueFids)
    {
        Console.WriteLine();
        Console.WriteLine($"--- field {fid} ({tally[fid].Count} distinct) ---");
        foreach (var pair in tally[fid].OrderByDescending(p => p.Value).Take(60))
            Console.WriteLine($"  {pair.Value,5}  {pair.Key}");
    }

    return 0;
}

// `dotnet run -- import-cases [--dry-run]`. Same shape as import-gallery.
if (args.Length > 0 && args[0] == "import-cases")
{
    using var scope = app.Services.CreateScope();
    var importer = scope.ServiceProvider.GetService<Services.CasesImportService>();
    if (importer is null)
    {
        Console.Error.WriteLine(
            "import-cases needs both SQL_CONNECTION_STRING and BLOB_CONNECTION_STRING; " +
            "it writes rows and image bytes together.");
        return 1;
    }

    var dryRun = args.Contains("--dry-run");
    var r = await importer.ImportAsync(dryRun, CancellationToken.None);

    Console.WriteLine(dryRun ? "DRY RUN — nothing was written." : "Import complete.");
    Console.WriteLine($"Cases:  {r.CasesFetched} fetched -> {r.CasesInserted} inserted, {r.CasesUpdated} updated.");
    Console.WriteLine($"Images: {r.ImagesUploaded} uploaded, {r.ImagesAlreadyPresent} already present.");

    foreach (var p in r.Problems.Take(50)) Console.WriteLine($"  problem: {p}");
    if (r.Problems.Count > 50) Console.WriteLine($"  ... and {r.Problems.Count - 50} more.");

    return r.Problems.Count == 0 ? 0 : 2;
}

// `dotnet run -- migrate-content-images <src-path> [--dry-run]`.
// Rewrites the image URLs hard-coded in the frontend source. One-shot, and the hard gate on
// retiring Quickbase: these are the majority of the site's photographs and the API never
// sees them, so nothing else in the migration touches them.
if (args.Length > 0 && args[0] == "migrate-content-images")
{
    using var scope = app.Services.CreateScope();
    var migrator = scope.ServiceProvider.GetService<Services.ContentImageMigrator>();
    if (migrator is null)
    {
        Console.Error.WriteLine("BLOB_CONNECTION_STRING is not configured.");
        return 1;
    }

    var path = args.Skip(1).FirstOrDefault(a => !a.StartsWith("--"))
               ?? Path.Combine("..", "NVC Claude version", "src");
    var dryRun = args.Contains("--dry-run");

    var r = await migrator.MigrateAsync(Path.GetFullPath(path), dryRun, CancellationToken.None);

    Console.WriteLine(dryRun ? "DRY RUN — nothing was written." : "Migration complete.");
    Console.WriteLine($"Scanned {r.FilesScanned} source file(s); found {r.UniqueUrls} unique Quickbase image URL(s).");
    Console.WriteLine($"Blob:   {r.Uploaded} uploaded, {r.AlreadyInBlob} already present.");
    Console.WriteLine($"Source: {r.ReferencesReplaced} reference(s) rewritten across {r.FilesRewritten} file(s).");
    if (r.BytesSaved > 0) Console.WriteLine($"WebP conversion saved {r.BytesSaved / 1024 / 1024.0:F1} MB.");

    foreach (var p in r.Problems.Take(50)) Console.WriteLine($"  problem: {p}");
    if (r.Problems.Count > 50) Console.WriteLine($"  ... and {r.Problems.Count - 50} more.");

    return r.Problems.Count == 0 ? 0 : 2;
}

// `dotnet run -- ensure-image-container`. One-off setup for a new environment.
if (args.Length > 0 && args[0] == "ensure-image-container")
{
    using var scope = app.Services.CreateScope();
    var blob = scope.ServiceProvider.GetService<Services.BlobImageSource>();
    if (blob is null)
    {
        Console.Error.WriteLine("BLOB_CONNECTION_STRING is not configured.");
        return 1;
    }

    var created = await blob.EnsureContainerAsync(CancellationToken.None);
    Console.WriteLine(created
        ? $"Created container '{blob.ContainerName}'."
        : $"Container '{blob.ContainerName}' already exists.");
    return 0;
}

// `dotnet run -- import-gallery [--dry-run]`. Copies the Quickbase houses table into SQL and
// their attachments into Blob. Off HTTP for the same reason as the other importers.
if (args.Length > 0 && args[0] == "import-gallery")
{
    using var scope = app.Services.CreateScope();
    var importer = scope.ServiceProvider.GetService<Services.GalleryImportService>();
    if (importer is null)
    {
        Console.Error.WriteLine(
            "import-gallery needs both SQL_CONNECTION_STRING and BLOB_CONNECTION_STRING; " +
            "it writes rows and image bytes together.");
        return 1;
    }

    // --dry-run reads Quickbase and reports what would happen without writing a row or a
    // blob. Worth having because the category check below refuses the whole run, and you
    // want to find that out before it has uploaded half the images.
    var dryRun = args.Contains("--dry-run");

    var r = await importer.ImportAsync(dryRun, CancellationToken.None);

    Console.WriteLine(dryRun ? "DRY RUN — nothing was written." : "Import complete.");
    Console.WriteLine(
        $"Houses: {r.HousesFetched} fetched -> {r.HousesInserted} inserted, {r.HousesUpdated} updated.");
    Console.WriteLine(
        $"Images: {r.ImagesUploaded} uploaded, {r.ImagesAlreadyPresent} already present.");
    if (r.BytesSavedByConversion > 0)
        Console.WriteLine($"WebP conversion saved {r.BytesSavedByConversion / 1024 / 1024.0:F1} MB.");

    foreach (var p in r.Problems.Take(50)) Console.WriteLine($"  problem: {p}");
    if (r.Problems.Count > 50) Console.WriteLine($"  ... and {r.Problems.Count - 50} more.");

    return r.Problems.Count == 0 ? 0 : 2;
}

// `dotnet run -- verify-images [<frontend-src-path>]`. The gate before flipping the flags:
// is every image the site will ask for actually in the container?
if (args.Length > 0 && args[0] == "verify-images")
{
    using var scope = app.Services.CreateScope();
    var verifier = scope.ServiceProvider.GetService<Services.MigrationVerifier>();
    if (verifier is null)
    {
        Console.Error.WriteLine("verify-images needs both SQL_CONNECTION_STRING and BLOB_CONNECTION_STRING.");
        return 1;
    }

    var srcPath = args.Skip(1).FirstOrDefault(a => !a.StartsWith("--"))
                  ?? Path.Combine("..", "NVC Claude version", "src");

    var report = await verifier.VerifyAsync(Path.GetFullPath(srcPath), CancellationToken.None);

    // The container is named because "0 missing" against the WRONG container reads exactly
    // like success against the right one.
    Console.WriteLine($"Container: {report.Container}");
    foreach (var section in report.Sections)
    {
        Console.WriteLine($"  {section.Name,-14} {section.Present}/{section.Checked} present, {section.Missing.Count} missing");
        foreach (var m in section.Missing.Take(20)) Console.WriteLine($"      missing: {m}");
        if (section.Missing.Count > 20) Console.WriteLine($"      ... and {section.Missing.Count - 20} more.");
    }

    Console.WriteLine(report.TotalMissing == 0
        ? "OK — every referenced image is in Blob."
        : $"{report.TotalMissing} image(s) missing. Do NOT flip the flags yet.");

    return report.TotalMissing == 0 ? 0 : 2;
}

// Must run before anything that inspects the scheme or writes cookies, so the rest of the
// pipeline sees the original https request rather than App Service's internal http hop.
app.UseForwardedHeaders();

// HSTS, set by hand rather than via app.UseHsts().
//
// UseHsts() skips any request it considers insecure, and behind App Service's reverse
// proxy the inbound hop is plain http — so the header silently never shipped. Written
// directly, gated on the scheme UseForwardedHeaders has just corrected, it does.
//
// One year, subdomains included, and deliberately NOT preload: preload is a one-way door
// (removal from the browser list takes months), and it is not ours to commit to from a
// code change.
app.Use(async (context, next) =>
{
    if (context.Request.IsHttps)
    {
        context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    }

    await next();
});

// Canonical host — www.* to the bare domain. See Services/CanonicalHost.cs; it is inert
// until www is bound in App Service and given its own certificate.
//
// Placed after the HSTS block on purpose, so the redirect response carries the header too
// and www is pinned to https alongside the apex.
//
// 301 for GET/HEAD, 308 for everything else. The distinction is not pedantry: 301 lets a
// client re-issue a POST as GET, which would turn a form submission on www into a lead that
// silently never arrived — the exact failure this project has been bitten by before. 308
// preserves the method and body, and Google treats both alike for canonicalisation.
app.Use(async (context, next) =>
{
    var target = Services.CanonicalHost.RedirectTarget(
        context.Request.Scheme,
        context.Request.Host.Value,
        context.Request.Path + context.Request.QueryString);

    if (target is null)
    {
        await next();
        return;
    }

    context.Response.StatusCode =
        HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)
            ? StatusCodes.Status301MovedPermanently
            : StatusCodes.Status308PermanentRedirect;
    context.Response.Headers.Location = target;
});

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI(c => {
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "NVC Home4You API v1");
    c.RoutePrefix = "swagger";
});
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;
        if (ctx.Context.Request.Path.StartsWithSegments("/assets"))
        {
            // Vite emits content-hashed filenames into /assets — the URL changes
            // whenever the bytes change, so these are safe to cache for a year.
            headers.CacheControl = "public, max-age=31536000, immutable";
        }
        else if (ctx.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase))
        {
            // The HTML entry point must always revalidate so new deploys go live immediately.
            headers.CacheControl = "no-cache";
        }
        else if (ctx.File.Name.Equals("sitemap.xml", StringComparison.OrdinalIgnoreCase)
              || ctx.File.Name.Equals("robots.txt", StringComparison.OrdinalIgnoreCase))
        {
            // Crawler-facing files, and the "other static assets" default below is wrong for
            // them in two ways.
            //
            // A WEEK IS TOO LONG. These change on every deploy that adds a route, and a stale
            // sitemap is a set of pages Google is not told about. Worse, if a crawler or any
            // intermediary ever caches a bad response, max-age=604800 holds that failure for
            // seven days — which is exactly the shape of a sitemap error that will not clear.
            //
            // AND text/xml WITHOUT A CHARSET means us-ascii per RFC 3023, so a strict parser
            // is entitled to ignore the <?xml encoding?> declaration. Harmless while every
            // URL is transliterated ASCII; the moment a Cyrillic or Greek slug reaches this
            // file it stops being harmless, and the failure would be a sitemap that silently
            // stops parsing. Stated explicitly rather than left to the file extension.
            //
            // /sitemap-gallery.xml does not pass through here at all — SitemapController
            // serves it, already as application/xml with an explicit charset and a 600s
            // cache. This brings the static one into line with the one that works.
            headers.CacheControl = "public, max-age=600";

            if (ctx.File.Name.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
                ctx.Context.Response.ContentType = "application/xml; charset=utf-8";
        }
        else
        {
            // Other static assets (images, PDFs, icons) use non-hashed names, so
            // cache a week and let ETag/Last-Modified revalidate after that.
            headers.CacheControl = "public, max-age=604800";
        }
    }
});

if (adminAuthReady)
{
    app.UseAuthentication();
    app.UseAuthorization();
}

app.MapControllers();

// --- Admin sign-in / sign-out ---------------------------------------------------------
// These are deliberately outside /api: they must be reached by a full page navigation, not
// fetch. A browser can follow the redirect to Microsoft and back; fetch cannot, because
// login.microsoftonline.com sends no CORS headers.
if (adminAuthReady)
{
    app.MapGet("/admin/signin", (string? returnUrl) =>
        Results.Challenge(
            new Microsoft.AspNetCore.Authentication.AuthenticationProperties
            {
                // Only local paths, so the endpoint can't be used as an open redirector.
                RedirectUri = !string.IsNullOrWhiteSpace(returnUrl) && returnUrl.StartsWith('/') && !returnUrl.StartsWith("//")
                    ? returnUrl
                    : "/admin",
            },
            new[] { Microsoft.AspNetCore.Authentication.OpenIdConnect.OpenIdConnectDefaults.AuthenticationScheme }));

    app.MapGet("/admin/signout", () =>
        Results.SignOut(
            new Microsoft.AspNetCore.Authentication.AuthenticationProperties { RedirectUri = "/" },
            new[]
            {
                Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationDefaults.AuthenticationScheme,
                Microsoft.AspNetCore.Authentication.OpenIdConnect.OpenIdConnectDefaults.AuthenticationScheme,
            }));
}

// --- Short "save & resume" share links (/c/{code}) -----------------------------------
// A shared configurator link is minted as /c/{code}. Resolve the code to the localized
// configurator path it was saved from and 302 there with ?c={code}; the SPA reads the
// query param and fetches the full config from /api/config-link/{code} to hydrate.
// Falls back to the site root when the code is unknown.
app.MapGet("/c/{code}", async (string code, Services.ISavedConfigStore svc, CancellationToken ct) =>
{
    if (!svc.IsConfigured) return Results.Redirect("/");
    var returnPath = await svc.GetReturnPathAsync(code, ct);
    if (string.IsNullOrWhiteSpace(returnPath) || !returnPath.StartsWith('/'))
        return Results.Redirect("/");

    var sep = returnPath.Contains('?') ? '&' : '?';
    return Results.Redirect($"{returnPath}{sep}c={Uri.EscapeDataString(code)}");
});

// --- Retired pages -------------------------------------------------------------------
// The services page (/uslugi, /services, /ypiresies) was legacy from early development,
// linked from nowhere, and removed on 2026-08-17. Its three URLs had been in the sitemap
// since 14 Aug, so they are 301'd rather than left to 404 — a redirect drops them from the
// index cleanly and keeps any signal they had picked up.
//
// Server-side and permanent, unlike the client-side <Navigate> redirects in App.jsx. Those
// exist to send a bare path to the visitor's CURRENT locale, which only the browser knows.
// Here the locale is in the slug itself, so there is nothing to decide at runtime and a real
// 301 is available — which is what a crawler needs to stop asking.
//
// /uslugi in particular was serving the SPA's "Page not found" body under an HTTP 200: a
// soft 404, advertised in the sitemap, because paths.js registered the path while App.jsx
// never registered a route for it.
var retiredPages = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["/uslugi"] = "/bg",
    ["/services"] = "/en",
    ["/ypiresies"] = "/el",
};

foreach (var (from, to) in retiredPages)
{
    var target = to;
    app.MapGet(from, () => Results.Redirect(target, permanent: true));
}

// --- Server-side SEO tag injection for SPA routes ------------------------------------
// The HTML shell (index.html) is identical for every route, so per-route <title>,
// description, Open Graph, canonical and hreflang tags normally appear only after React
// runs — which crawlers and social scrapers that don't execute JS never see. Here we
// splice the correct block (generated at build time from src/seo/routeMeta.js into
// wwwroot/seo-manifest.json) between the <!--SEO-START--> / <!--SEO-END--> markers.
const string seoStart = "<!--SEO-START-->";
const string seoEnd = "<!--SEO-END-->";

var webRoot = app.Environment.WebRootPath ?? "";
var indexPath = Path.Combine(webRoot, "index.html");
var indexHtml = File.Exists(indexPath) ? await File.ReadAllTextAsync(indexPath) : "";

// Prerendered page snapshots, produced by `npm run prerender` (scripts/prerender.mjs).
//
// The head injection below fixed <head>; this fixes <body>. Without it every URL answers
// with an empty <div id="root">, so a crawler that does not execute JavaScript sees no
// content at all — measured at 0 characters against 4,819-19,392 for every competitor.
//
// Loaded into memory once at startup rather than read per request: it is ~50 files that
// only change on deploy, and touching the disk on every page view to serve them would be a
// worse trade than the few MB.
//
// Read from OUTSIDE wwwroot on purpose. In the web root the static-file middleware would
// serve each snapshot a second time at /prerendered/..., duplicating every page at a URL
// nothing canonicals away.
var prerendered = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
var prerenderDir = Path.Combine(app.Environment.ContentRootPath, "prerendered");
if (Directory.Exists(prerenderDir))
{
    foreach (var file in Directory.EnumerateFiles(prerenderDir, "*.html", SearchOption.AllDirectories))
    {
        // "<dir>/bg/modulni-kysthi.html" -> "/bg/modulni-kysthi"; "_root.html" -> "/"
        var rel = Path.GetRelativePath(prerenderDir, file)
            .Replace(Path.DirectorySeparatorChar, '/');
        rel = rel[..^".html".Length];

        var key = rel == "_root" ? "/" : "/" + rel;
        prerendered[key] = await File.ReadAllTextAsync(file);
    }
}

var seoManifest = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
var manifestPath = Path.Combine(webRoot, "seo-manifest.json");
if (File.Exists(manifestPath))
{
    var parsed = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(
        await File.ReadAllTextAsync(manifestPath));
    if (parsed != null)
        seoManifest = new Dictionary<string, string>(parsed, StringComparer.OrdinalIgnoreCase);
}

// Valid SPA routes that are NOT in the SEO manifest, so we don't mistake them for 404s:
// the language-less redirect aliases handled client-side by <Navigate> in App.jsx, and the
// dynamic gallery detail pages (/<locale>/gallery/<item>). Keep in sync with src/App.jsx.
var bareRedirects = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "/modular-builds", "/modular-houses", "/faq", "/about", "/steel-houses", "/gallery",
};
var galleryPrefixes = new[] { "/bg/galeriq/", "/en/gallery/", "/el/gkaleri/" };

bool IsKnownSpaRoute(string p)
{
    if (p == "/") return true;
    if (seoManifest.ContainsKey(p)) return true;
    if (bareRedirects.Contains(p)) return true;
    foreach (var prefix in galleryPrefixes)
        if (p.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true;
    return false;
}

app.MapFallback(async context =>
{
    context.Response.ContentType = "text/html; charset=utf-8";
    context.Response.Headers.CacheControl = "no-cache";

    // Normalize the request path to match manifest keys (drop trailing slash; keys are lower-case ASCII).
    var path = context.Request.Path.Value ?? "/";
    if (path.Length > 1 && path.EndsWith('/'))
        path = path.TrimEnd('/');

    var html = indexHtml;
    var start = html.IndexOf(seoStart, StringComparison.Ordinal);
    var end = html.IndexOf(seoEnd, StringComparison.Ordinal);

    // Hidden internal tools (e.g. /internal/factory-sheet): serve the SPA shell with a
    // 200 and a noindex tag so direct links / refresh work, while keeping them out of
    // search results. They are not linked anywhere and are password-gated in the SPA.
    if (path.StartsWith("/internal/", StringComparison.OrdinalIgnoreCase) ||
        path.Equals("/admin", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/admin/", StringComparison.OrdinalIgnoreCase))
    {
        const string internalTags =
            "<title>NVC internal</title>\n    <meta name=\"robots\" content=\"noindex,nofollow\" />";
        if (start >= 0 && end > start)
            html = html[..(start + seoStart.Length)] + "\n    " + internalTags + "\n    " + html[end..];
        await context.Response.WriteAsync(html);
        return;
    }

    // A prerendered snapshot already carries both the injected head tags and the rendered
    // body, so it is served as-is. Same bytes to everyone — serving a crawler something a
    // visitor does not get is cloaking, and the whole point of the snapshot is that it IS
    // the real page.
    //
    // The bypass header exists for one caller: the prerender script itself. Without it the
    // generator navigates to a server that answers with the PREVIOUS snapshot and dutifully
    // re-saves it, so the files feed on themselves and silently stop reflecting code
    // changes — a fixed URL stays broken in the output forever, with a successful-looking
    // run every time. Skipping the cache only falls back to the ordinary SPA shell, so
    // there is nothing here worth abusing.
    var bypassSnapshot = context.Request.Headers.ContainsKey("X-Prerender-Bypass");

    if (!bypassSnapshot && prerendered.TryGetValue(path, out var snapshot))
    {
        await context.Response.WriteAsync(snapshot);
        return;
    }

    if (seoManifest.TryGetValue(path, out var tags))
    {
        if (start >= 0 && end > start)
            html = html[..(start + seoStart.Length)] + "\n    " + tags + "\n    " + html[end..];
    }
    else if (Services.GallerySlugs.TryParsePath(path, out _, out _))
    {
        // Gallery product pages. Not in the manifest and they cannot be — products are
        // database rows that staff rename through the admin panel, so build-time tags
        // would be stale the first time somebody edits a title. Resolved per request
        // instead, off the 10-minute cache GalleryService already keeps.
        //
        // Without this branch the default shell block survives, and that block canonicals
        // to "/" — which told Google every product page was a duplicate of the homepage
        // while sitemap-gallery.xml submitted all of them.
        var seo = context.RequestServices.GetRequiredService<Services.GallerySeoService>();
        var (outcome, productTags) = await seo.TryBuildAsync(path, context.RequestAborted);

        if (outcome == Services.GallerySeoService.Outcome.Resolved && start >= 0 && end > start)
        {
            html = html[..(start + seoStart.Length)] + "\n    " + productTags + "\n    " + html[end..];
        }
        else if (outcome == Services.GallerySeoService.Outcome.ProductNotFound)
        {
            // Before calling it a 404: it may be a URL minted under the old slug algorithm,
            // which decomposed accents into hyphens (see the NFKC note in GallerySlugs).
            // Those are real products at a stale address, so they get a 301 to the corrected
            // one rather than the 404 they would otherwise now return.
            var moved = await seo.TryResolveLegacyAsync(path, context.RequestAborted);
            if (moved is not null)
            {
                context.Response.Redirect(moved, permanent: true);
                return;
            }

            // A product-shaped URL naming a product that does not exist — a retired model
            // or a typo. Previously served as 200 with homepage metadata, which is a soft
            // 404 for every dead product link ever shared.
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            const string goneTags =
                "<title>Page not found | NVC Home4You</title>\n    <meta name=\"robots\" content=\"noindex,follow\" />";
            if (start >= 0 && end > start)
                html = html[..(start + seoStart.Length)] + "\n    " + goneTags + "\n    " + html[end..];
        }
    }
    else if (!IsKnownSpaRoute(path))
    {
        // Unknown URL: return a real HTTP 404 instead of a soft 404 (HTTP 200 + blank shell),
        // and mark the shell noindex so crawlers that don't run JS won't index it. React still
        // renders the localized NotFound page into the same shell for users.
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        const string notFoundTags =
            "<title>Page not found | NVC Home4You</title>\n    <meta name=\"robots\" content=\"noindex,follow\" />";
        if (start >= 0 && end > start)
            html = html[..(start + seoStart.Length)] + "\n    " + notFoundTags + "\n    " + html[end..];
    }

    await context.Response.WriteAsync(html);
});

app.Run();
return 0;
