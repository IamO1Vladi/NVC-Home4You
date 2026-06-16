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
builder.Services.AddScoped<Services.GalleryService>();
builder.Services.AddScoped<Services.FormService>();
builder.Services.AddScoped<Services.CasesPageService>();
builder.Services.AddScoped<Services.ReviewService>();

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

app.MapFallback(async context =>
{
    context.Response.ContentType = "text/html; charset=utf-8";
    context.Response.Headers.CacheControl = "no-cache";

    // Normalize the request path to match manifest keys (drop trailing slash; keys are lower-case ASCII).
    var path = context.Request.Path.Value ?? "/";
    if (path.Length > 1 && path.EndsWith('/'))
        path = path.TrimEnd('/');

    var html = indexHtml;
    if (seoManifest.TryGetValue(path, out var tags))
    {
        var start = html.IndexOf(seoStart, StringComparison.Ordinal);
        var end = html.IndexOf(seoEnd, StringComparison.Ordinal);
        if (start >= 0 && end > start)
            html = html[..(start + seoStart.Length)] + "\n    " + tags + "\n    " + html[end..];
    }

    await context.Response.WriteAsync(html);
});

app.Run();
