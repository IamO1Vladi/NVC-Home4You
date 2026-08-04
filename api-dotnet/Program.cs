using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

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
}
// Singleton so proxied image bytes survive across requests (it owns its own size-capped cache).
builder.Services.AddSingleton<Services.ImageCache>();
builder.Services.AddScoped<Services.GalleryService>();
builder.Services.AddScoped<Services.FormService>();
builder.Services.AddScoped<Services.CasesPageService>();
builder.Services.AddScoped<Services.ReviewService>();
builder.Services.AddScoped<Services.SavedConfigService>();
builder.Services.AddScoped<Services.EmailService>();

var app = builder.Build();

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

app.MapControllers();

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
    if (path.StartsWith("/internal/", StringComparison.OrdinalIgnoreCase))
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
