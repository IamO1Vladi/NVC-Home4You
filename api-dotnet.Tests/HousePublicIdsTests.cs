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
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The id a house goes by in public (#35). Live, 2026-10-02: the admin-created Space house
// (SQL 15) and the imported 73 m² house (Quickbase 15) were both served as "15", so a lead
// about one linked to the other, the prices page gave the Space house the 73 m² house's
// assembly cost, and React keys, skus and the prerender price check all saw one item twice.
//
// What is pinned: the two ranges cannot meet, the numbers already out in the world (every
// imported house's) do not move, and the one road into the Quickbase range is guarded.
public class HousePublicIdsTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"house-public-ids-{Guid.NewGuid()}")
            .Options);

    private static ImageUrls NewUrls()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "vladimirbuilder.quickbase.com",
        }).Build();
        return new ImageUrls(new EnvConfig(cfg));
    }

    // The live catalogue's shape on 2026-10-02: fourteen houses imported in Quickbase order,
    // so SQL ids 1–14 against Quickbase ids 4–17, then one house made in the admin panel.
    private static readonly long[] LiveQuickbaseIds = { 13, 6, 8, 14, 7, 4, 15, 10, 11, 5, 9, 16, 12, 17 };

    private static void SeedLiveCatalogue(AppDbContext db)
    {
        var sqlId = 1;
        foreach (var qb in LiveQuickbaseIds)
        {
            db.Houses.Add(new House
            {
                Id = sqlId, QuickbaseRecordId = qb, SortOrder = sqlId,
                Title = qb == 15 ? "Expandable house - 73m² with balcony and a double roof" : $"Imported {qb}",
                CategoryKey = HouseCategories.Modular,
            });
            sqlId++;
        }
        db.Houses.Add(new House
        {
            Id = 15, QuickbaseRecordId = null, SortOrder = 15,
            Title = "Space house", TitleBg = "Космическа къща - капсула", CategoryKey = HouseCategories.Modular,
        });
    }

    [Fact]
    public void An_imported_house_keeps_its_quickbase_id()
    {
        // Stored enquiries and prices.js's assembly table hold these numbers; moving them
        // would quietly change a published price.
        Assert.Equal(15, HousePublicIds.For(15, 7));
    }

    [Fact]
    public void An_admin_created_house_is_served_above_the_offset()
    {
        Assert.Equal(100_015, HousePublicIds.For(null, 15));
        Assert.Equal(15, HousePublicIds.AdminHouseId(100_015));
    }

    [Fact]
    public void The_two_ranges_cannot_meet()
    {
        // The smallest admin id is above the largest Quickbase id the import accepts.
        Assert.True(HousePublicIds.FitsQuickbaseRange(HousePublicIds.AdminOffset - 1));
        Assert.False(HousePublicIds.FitsQuickbaseRange(HousePublicIds.AdminOffset));
        Assert.True(HousePublicIds.For(null, 1) > HousePublicIds.AdminOffset - 1);
    }

    [Theory]
    [InlineData(15)]                          // a Quickbase id, or an old bare SQL id
    [InlineData(100_000)]                     // the offset itself: SQL ids start at 1
    [InlineData(0)]
    [InlineData(-5)]
    public void A_number_outside_the_admin_range_names_no_admin_house(long publicId)
    {
        Assert.Null(HousePublicIds.AdminHouseId(publicId));
    }

    [Fact]
    public void An_admin_range_number_too_large_for_a_sql_key_does_not_wrap()
    {
        // Offset + 2^32 + 1 would wrap to SQL id 1 under an unchecked cast.
        Assert.Null(HousePublicIds.AdminHouseId(HousePublicIds.AdminOffset + 4_294_967_297));
    }

    [Fact]
    public async Task The_live_catalogue_is_served_without_a_shared_id()
    {
        using var db = NewDb();
        SeedLiveCatalogue(db);
        await db.SaveChangesAsync();

        var items = await new SqlGalleryService(db, new MemoryCache(new MemoryCacheOptions()), NewUrls())
            .GetAsync(CancellationToken.None);

        Assert.Equal(15, items.Count);
        Assert.Equal(items.Count, items.Select(i => i.Id).Distinct().Count());

        // The 73 m² house still answers to 15, as everything already stored expects.
        Assert.Equal("Expandable house - 73m² with balcony and a double roof", items.Single(i => i.Id == 15).Title);
        Assert.Equal("Space house", items.Single(i => i.Id == 100_015).Title);

        // Every imported house kept the number it had.
        Assert.Equal(LiveQuickbaseIds.OrderBy(x => x), items.Where(i => i.Id < HousePublicIds.AdminOffset).Select(i => i.Id).OrderBy(x => x));
    }

    [Fact]
    public void The_import_refuses_a_quickbase_id_in_the_admin_range()
    {
        var items = new List<GalleryItem>
        {
            new() { Id = 17, Title = "Two-storey" },
            new() { Id = 99_999, Title = "Last one that fits" },
            new() { Id = 100_015, Title = "Would be served as the Space house" },
        };

        var problems = GalleryImportService.OutOfRange(items);

        var problem = Assert.Single(problems);
        Assert.Contains("100015", problem);
        Assert.Contains("Would be served as the Space house", problem);
    }

    [Fact]
    public void The_live_quickbase_ids_all_fit()
    {
        var items = LiveQuickbaseIds.Select(id => new GalleryItem { Id = id, Title = $"House {id}" });

        Assert.Empty(GalleryImportService.OutOfRange(items));
    }
}
