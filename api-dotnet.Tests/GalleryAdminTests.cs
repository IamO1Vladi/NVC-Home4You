using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The admin panel becomes the ONLY way to edit the gallery once Quickbase is retired, so
// these pin the behaviour the UI depends on — ordering, publishing, and the rules that stop
// a house reaching the site in a state where it cannot be found.
public class GalleryAdminTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"gallery-admin-{Guid.NewGuid()}")
            .Options);

    private static IMemoryCache NewCache() => new MemoryCache(new MemoryCacheOptions());

    private static ImageUrls NewUrls()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
        }).Build();
        return new ImageUrls(new EnvConfig(cfg));
    }

    // Blob is not exercised here; these tests cover the row behaviour. Image upload is
    // covered end to end separately, since it needs real bytes and a container.
    private static GalleryAdminService NewService(AppDbContext db) =>
        new(db, blob: null!, new ImageProcessor(NullLogger<ImageProcessor>.Instance), NewUrls(), NewCache());

    private static HouseInput ValidInput(string title = "Box House") => new()
    {
        Title = title,
        CategoryKey = HouseCategories.Modular,
        Price = 24990m,
        IsPublished = true,
    };

    [Fact]
    public async Task A_created_house_is_readable_back()
    {
        using var db = NewDb();
        var svc = NewService(db);

        var created = await svc.CreateAsync(ValidInput(), "ivan@example.com", CancellationToken.None);

        Assert.True(created.Id > 0);
        Assert.Equal("Box House", created.Title);
        Assert.Equal(HouseCategories.Modular, created.CategoryKey);
        Assert.Equal("EUR", created.Currency);
        // Recorded so "who changed this price" has an answer.
        Assert.Equal("ivan@example.com", created.LastModifiedBy);
        // No Quickbase id: this house never existed there.
        Assert.Null(created.QuickbaseRecordId);
    }

    [Fact]
    public async Task New_houses_are_appended_rather_than_displacing_the_existing_order()
    {
        using var db = NewDb();
        var svc = NewService(db);

        var first = await svc.CreateAsync(ValidInput("A"), null, CancellationToken.None);
        var second = await svc.CreateAsync(ValidInput("B"), null, CancellationToken.None);
        var third = await svc.CreateAsync(ValidInput("C"), null, CancellationToken.None);

        Assert.True(second.SortOrder > first.SortOrder);
        Assert.True(third.SortOrder > second.SortOrder);
    }

    [Fact]
    public async Task An_update_changes_only_what_was_sent()
    {
        using var db = NewDb();
        var svc = NewService(db);
        var created = await svc.CreateAsync(ValidInput(), null, CancellationToken.None);

        var input = ValidInput("Renamed");
        input.Price = 31000m;
        input.CategoryKey = HouseCategories.Garage;

        var updated = await svc.UpdateAsync(created.Id, input, "maria@example.com", CancellationToken.None);

        Assert.NotNull(updated);
        Assert.Equal("Renamed", updated!.Title);
        Assert.Equal(31000m, updated.Price);
        Assert.Equal(HouseCategories.Garage, updated.CategoryKey);
        Assert.Equal("maria@example.com", updated.LastModifiedBy);
        // Position is not moved by an edit that says nothing about it.
        Assert.Equal(created.SortOrder, updated.SortOrder);
    }

    [Fact]
    public async Task Updating_a_missing_house_reports_failure()
    {
        using var db = NewDb();

        Assert.Null(await NewService(db).UpdateAsync(4242, ValidInput(), null, CancellationToken.None));
    }

    [Fact]
    public async Task An_unpublished_house_is_kept_but_hidden_from_the_public_read_path()
    {
        using var db = NewDb();
        var svc = NewService(db);

        var input = ValidInput("Draft");
        input.IsPublished = false;
        var created = await svc.CreateAsync(input, null, CancellationToken.None);

        // Still listed for the editor — the panel is where drafts get finished.
        var all = await svc.ListAsync(CancellationToken.None);
        Assert.Contains(all, h => h.Id == created.Id);

        // But excluded from what the site serves.
        var published = await new SqlGalleryService(db, NewCache(), NewUrls())
            .GetAsync(CancellationToken.None);
        Assert.DoesNotContain(published, h => h.Title == "Draft");
    }

    [Fact]
    public async Task Deleting_a_house_removes_its_image_rows_too()
    {
        using var db = NewDb();
        var svc = NewService(db);
        var created = await svc.CreateAsync(ValidInput(), null, CancellationToken.None);

        db.HouseImages.Add(new HouseImage { HouseId = created.Id, ImageKey = "gallery/1/a.webp" });
        await db.SaveChangesAsync();

        Assert.True(await svc.DeleteAsync(created.Id, CancellationToken.None));
        Assert.Empty(db.Houses.ToList());
        // Cascade, so no orphaned rows pointing at a house that no longer exists.
        Assert.Empty(db.HouseImages.ToList());
    }

    [Fact]
    public async Task Deleting_a_missing_house_reports_failure()
    {
        using var db = NewDb();
        Assert.False(await NewService(db).DeleteAsync(999, CancellationToken.None));
    }

    [Fact]
    public async Task Reordering_images_applies_the_given_order()
    {
        using var db = NewDb();
        var svc = NewService(db);
        var house = await svc.CreateAsync(ValidInput(), null, CancellationToken.None);

        var a = new HouseImage { HouseId = house.Id, ImageKey = "gallery/1/a.webp", SortOrder = 0 };
        var b = new HouseImage { HouseId = house.Id, ImageKey = "gallery/1/b.webp", SortOrder = 1 };
        var c = new HouseImage { HouseId = house.Id, ImageKey = "gallery/1/c.webp", SortOrder = 2 };
        db.HouseImages.AddRange(a, b, c);
        await db.SaveChangesAsync();

        await svc.ReorderImagesAsync(house.Id, new[] { c.Id, a.Id, b.Id }, CancellationToken.None);

        var reloaded = await svc.GetAsync(house.Id, CancellationToken.None);
        Assert.Equal(
            new[] { "gallery/1/c.webp", "gallery/1/a.webp", "gallery/1/b.webp" },
            reloaded!.Images.Select(i => i.ImageKey).ToArray());
    }

    [Fact]
    public async Task A_partial_reorder_does_not_scramble_the_images_it_omits()
    {
        // The UI may send only what it dragged. Unlisted images must keep a stable position
        // after the listed ones rather than all collapsing onto 0.
        using var db = NewDb();
        var svc = NewService(db);
        var house = await svc.CreateAsync(ValidInput(), null, CancellationToken.None);

        var a = new HouseImage { HouseId = house.Id, ImageKey = "gallery/1/a.webp", SortOrder = 0 };
        var b = new HouseImage { HouseId = house.Id, ImageKey = "gallery/1/b.webp", SortOrder = 1 };
        var c = new HouseImage { HouseId = house.Id, ImageKey = "gallery/1/c.webp", SortOrder = 2 };
        db.HouseImages.AddRange(a, b, c);
        await db.SaveChangesAsync();

        await svc.ReorderImagesAsync(house.Id, new[] { c.Id }, CancellationToken.None);

        var reloaded = await svc.GetAsync(house.Id, CancellationToken.None);
        var keys = reloaded!.Images.Select(i => i.ImageKey).ToArray();

        Assert.Equal("gallery/1/c.webp", keys[0]);
        Assert.Equal(3, keys.Length);
        Assert.Equal(3, keys.Distinct().Count());
    }

    [Fact]
    public async Task Image_urls_are_resolved_for_the_editor()
    {
        // The panel shows thumbnails, so it needs a usable URL rather than a storage key.
        using var db = NewDb();
        var svc = NewService(db);
        var house = await svc.CreateAsync(ValidInput(), null, CancellationToken.None);

        db.HouseImages.Add(new HouseImage { HouseId = house.Id, ImageKey = "gallery/1/a.webp" });
        await db.SaveChangesAsync();

        var reloaded = await svc.GetAsync(house.Id, CancellationToken.None);

        Assert.Equal("/api/img/gallery/1/a.webp", reloaded!.Images.Single().Url);
    }
}
