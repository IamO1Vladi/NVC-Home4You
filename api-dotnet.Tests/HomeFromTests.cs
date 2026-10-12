using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The "from" figures GET /api/home/photos carries since 2026-10-12, for the home hero's first
// sentence. The owner's rule: the hero quotes the cheapest thing sold, which is the cheapest
// container (€4,300 with VAT and assembly that day), and the figure must be the gallery's own
// so it can never disagree with the card it points at. Three things carry that and all live
// here: the minimum is taken over exactly the rows /api/gallery serves, from either store; a
// price edit shows on the hero as soon as it shows in the gallery; and when the figure cannot
// be known the answer says unknown (null), never zero, so the SPA prints its lead without one.
public class HomeFromTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"home-from-{Guid.NewGuid()}")
            .Options);

    private static ImageUrls NewUrls()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
        }).Build();
        return new ImageUrls(new EnvConfig(cfg));
    }

    // A store whose rows a test can change between reads, the way a gallery edit (and the
    // eviction GalleryAdminService does after it) changes what the real store returns.
    private sealed class FakeStore : IGalleryStore
    {
        public List<GalleryItem> Items { get; } = new();
        public Exception? Fail { get; set; }

        public Task<IReadOnlyList<GalleryItem>> GetAsync(CancellationToken ct = default) =>
            Fail is null
                ? Task.FromResult<IReadOnlyList<GalleryItem>>(Items.ToArray())
                : Task.FromException<IReadOnlyList<GalleryItem>>(Fail);
    }

    private static HomePhotoService Svc(AppDbContext db, IGalleryStore? gallery, IMemoryCache? cache = null) =>
        new(db, NewUrls(), cache ?? new MemoryCache(new MemoryCacheOptions()), gallery: gallery);

    private static GalleryItem Item(string? category, decimal? price, string currency = "EUR") =>
        new() { Title = "x", Category = category, Price = price, Currency = currency };

    // --- The minimum ------------------------------------------------------------------

    [Fact]
    public void The_figure_is_the_cheapest_priced_row_per_category()
    {
        // Prices as the live gallery had them on 2026-10-12: the 6×3 container at €4,300
        // (its assembly in it), the 18 m² Box house at €10,500 (the house alone).
        var from = HomeFromDto.Of(new[]
        {
            Item("wagon", 6500m),
            Item("wagon", 4300m),
            Item("wagon", 4800m),
            Item("modular", 14000m),
            Item("modular", 10500m),
            Item("prefab", 900m),     // not a category the hero quotes
            Item("garage", 1200m),
        });

        Assert.Equal(4300m, from.Wagon);
        Assert.Equal(10500m, from.Modular);
    }

    [Fact]
    public void The_quickbase_store_s_labels_count_the_same_as_the_sql_store_s_keys()
    {
        // SQL sends "wagon"; Quickbase sends what it stored, "Фургон" or "Wagon / site cabin".
        var from = HomeFromDto.Of(new[]
        {
            Item("Фургон", 5200m),
            Item("Wagon / site cabin", 4900m),
            Item("Модулна къща", 11000m),
            Item("Modular house", 12000m),
        });

        Assert.Equal(4900m, from.Wagon);
        Assert.Equal(11000m, from.Modular);
    }

    [Fact]
    public void A_row_without_a_usable_euro_price_is_skipped_not_quoted()
    {
        var from = HomeFromDto.Of(new[]
        {
            Item("wagon", null),
            Item("wagon", 0m),
            Item("wagon", -1m),
            Item("wagon", 100m, currency: "BGN"),
            Item("wagon", 4300m, currency: "eur"),
            Item(null, 50m),
            Item("unheard of", 60m),
        });

        Assert.Equal(4300m, from.Wagon);
        Assert.Null(from.Modular);
    }

    [Fact]
    public void Nothing_to_read_is_unknown_not_zero()
    {
        Assert.Equal(HomeFromDto.Unknown, HomeFromDto.Of(null));
        Assert.Equal(HomeFromDto.Unknown, HomeFromDto.Of(Array.Empty<GalleryItem>()));
        Assert.Null(HomeFromDto.Unknown.Wagon);
        Assert.Null(HomeFromDto.Unknown.Modular);
    }

    // --- The public read --------------------------------------------------------------

    [Fact]
    public async Task The_public_read_carries_the_gallery_s_figures_beside_the_photos()
    {
        using var db = NewDb();
        var gallery = new FakeStore();
        gallery.Items.AddRange(new[] { Item("wagon", 4300m), Item("modular", 10500m) });

        var dto = await Svc(db, gallery).ReadPublicAsync(CancellationToken.None);

        Assert.Equal(new HomeFromDto(4300m, 10500m), dto.From);
        // The photos are unaffected: the empty shape, every key present.
        Assert.Empty(dto.Hero);
        Assert.Equal(new[] { "37", "58", "73" }, dto.Models.Keys);
    }

    [Fact]
    public async Task A_price_edit_shows_on_the_next_read_although_the_photos_are_cached()
    {
        // The photos sit in this service's ten-minute entry; the figures must not, or a price
        // staff just lowered would show in the gallery and not on the hero for ten minutes.
        using var db = NewDb();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var gallery = new FakeStore();
        gallery.Items.Add(Item("wagon", 4300m));
        var svc = Svc(db, gallery, cache);

        Assert.Equal(4300m, (await svc.ReadPublicAsync(default)).From.Wagon);
        Assert.True(cache.TryGetValue(HomePhotoService.CacheKey, out _));

        gallery.Items.Clear();
        gallery.Items.Add(Item("wagon", 3900m));

        Assert.Equal(3900m, (await svc.ReadPublicAsync(default)).From.Wagon);
    }

    [Fact]
    public async Task A_failing_gallery_costs_the_figure_not_the_photos()
    {
        using var db = NewDb();
        db.HomeSlots.Add(new Data.Entities.HomeSlot { Name = "hero-1", ImageKey = "home/1/abc.webp" });
        await db.SaveChangesAsync();
        var gallery = new FakeStore { Fail = new InvalidOperationException("Quickbase is down") };

        var dto = await Svc(db, gallery).ReadPublicAsync(CancellationToken.None);

        Assert.Equal(HomeFromDto.Unknown, dto.From);
        Assert.Single(dto.Hero);
    }

    [Fact]
    public async Task Without_a_gallery_store_the_figures_are_unknown()
    {
        using var db = NewDb();
        var dto = await Svc(db, gallery: null).ReadPublicAsync(CancellationToken.None);
        Assert.Equal(HomeFromDto.Unknown, dto.From);
    }

    [Fact]
    public void The_empty_shape_says_unknown_too()
    {
        // What the public route answers on a machine with no database at all.
        Assert.Equal(HomeFromDto.Unknown, HomePhotosDto.Empty().From);
    }

    // --- The wire ---------------------------------------------------------------------

    [Fact]
    public void The_body_names_the_figures_as_the_spa_reads_them()
    {
        // homePhotos.js reads body.from.wagon; ASP.NET writes camelCase, as here.
        var dto = HomePhotosDto.Empty() with { From = new HomeFromDto(4300m, null) };
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(dto, new JsonSerializerOptions(JsonSerializerDefaults.Web)));

        var from = json.RootElement.GetProperty("from");
        Assert.Equal(4300m, from.GetProperty("wagon").GetDecimal());
        Assert.Equal(JsonValueKind.Null, from.GetProperty("modular").ValueKind);
    }

    // --- The wiring -------------------------------------------------------------------

    [Fact]
    public async Task Built_from_a_container_the_service_takes_the_gallery_store_it_is_given()
    {
        // The gallery is an optional constructor parameter. The container must still fill it
        // when IGalleryStore is registered (Program.cs always registers it), or the site would
        // quietly answer "from" as unknown for ever.
        var gallery = new FakeStore();
        gallery.Items.Add(Item("wagon", 4300m));

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase($"home-from-di-{Guid.NewGuid()}"));
        services.AddSingleton(NewUrls());
        services.AddSingleton<IMemoryCache>(new MemoryCache(new MemoryCacheOptions()));
        services.AddLogging();
        services.AddSingleton<IGalleryStore>(gallery);
        services.AddScoped<HomePhotoService>();

        using var sp = services.BuildServiceProvider(
            new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
        using var scope = sp.CreateScope();

        var dto = await scope.ServiceProvider.GetRequiredService<HomePhotoService>().ReadPublicAsync(default);
        Assert.Equal(4300m, dto.From.Wagon);
    }
}
