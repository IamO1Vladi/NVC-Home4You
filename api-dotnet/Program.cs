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
    builder.Services.AddDbContext<Data.AppDbContext>(options =>
        options.UseSqlServer(sqlConnectionString, sql =>
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

builder.Services.AddScoped<Services.SavedConfigService>();
builder.Services.AddScoped<Services.EmailService>();

// Only useful when there is somewhere to import into; the CLI says so rather than failing
// with a DI resolution error.
if (!string.IsNullOrWhiteSpace(blobConnectionString))
    builder.Services.AddScoped<Services.ImageImportService>();

// The gallery import writes rows AND blobs, so it needs both. Registered only when both are
// configured, so `import-gallery` reports which one is missing instead of throwing.
if (!string.IsNullOrWhiteSpace(blobConnectionString) && !string.IsNullOrWhiteSpace(sqlConnectionString))
    builder.Services.AddScoped<Services.GalleryImportService>();

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

    foreach (var p in r.Problems.Take(50)) Console.WriteLine($"  problem: {p}");
    if (r.Problems.Count > 50) Console.WriteLine($"  ... and {r.Problems.Count - 50} more.");

    return r.Problems.Count == 0 ? 0 : 2;
}

// `dotnet run -- import-images [--force]` / `-- verify-images`. Off HTTP for the same reason
// as the review importer: it rewrites storage and pulls hard on Quickbase.
if (args.Length > 0 && (args[0] == "import-images" || args[0] == "verify-images"))
{
    using var scope = app.Services.CreateScope();
    var images = scope.ServiceProvider.GetService<Services.ImageImportService>();
    if (images is null)
    {
        Console.Error.WriteLine("BLOB_CONNECTION_STRING is not configured, so there is no container to import into.");
        return 1;
    }

    if (args[0] == "import-images")
    {
        // Attachment versions are part of the key, so a changed image is a new key and
        // re-uploading an existing one is pure waste. --force is for repairing a container
        // whose contents are suspect.
        var force = args.Contains("--force");
        var r = await images.ImportAsync(force, CancellationToken.None);
        Console.WriteLine(
            $"Found {r.Found} image(s) -> uploaded {r.Uploaded}, already present {r.AlreadyPresent}, failed {r.Failed}.");
        foreach (var f in r.Failures.Take(50)) Console.WriteLine($"  failed: {f}");
        if (r.Failures.Count > 50) Console.WriteLine($"  ... and {r.Failures.Count - 50} more.");
        return r.Failed == 0 ? 0 : 2;
    }

    var v = await images.VerifyAsync(CancellationToken.None);
    Console.WriteLine($"Checked {v.Checked} referenced image(s); {v.InBlob} in Blob, {v.Missing.Count} missing.");
    foreach (var m in v.Missing.Take(50)) Console.WriteLine($"  missing: {m}");
    if (v.Missing.Count > 50) Console.WriteLine($"  ... and {v.Missing.Count - 50} more.");
    // Non-zero when anything is missing, so this can gate flipping IMAGES_VIA_APP.
    return v.Missing.Count == 0 ? 0 : 2;
}

// Must run before anything that inspects the scheme or writes cookies, so the rest of the
// pipeline sees the original https request rather than App Service's internal http hop.
app.UseForwardedHeaders();

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
app.MapGet("/c/{code}", async (string code, Services.SavedConfigService svc, CancellationToken ct) =>
{
    if (!svc.IsConfigured) return Results.Redirect("/");
    var returnPath = await svc.GetReturnPathAsync(code, ct);
    if (string.IsNullOrWhiteSpace(returnPath) || !returnPath.StartsWith('/'))
        return Results.Redirect("/");

    var sep = returnPath.Contains('?') ? '&' : '?';
    return Results.Redirect($"{returnPath}{sep}c={Uri.EscapeDataString(code)}");
});

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

    if (seoManifest.TryGetValue(path, out var tags))
    {
        if (start >= 0 && end > start)
            html = html[..(start + seoStart.Length)] + "\n    " + tags + "\n    " + html[end..];
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
