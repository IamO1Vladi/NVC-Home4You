using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Azure.Storage.Blobs;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The id a case, and the client derived from it, goes by in public. Cases were served as
// `QuickbaseRecordId ?? Id`, the scheme that put two houses on "15" live (#35). The import
// numbers cases 1, 2, 3… in Quickbase's sort order, whatever their Quickbase ids, so a case
// made in the admin panel can get an imported case's Quickbase id as its SQL id. Live,
// 2026-10-02, served one case ("2") and no collision; these tests keep it that way.
//
// What is pinned: the two ranges cannot meet, an imported case keeps its number, and the
// one road into the Quickbase range is guarded — in ImportAsync itself, not only the helper.
public class CasePublicIdsTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"case-public-ids-{Guid.NewGuid()}")
            .Options);

    private static EnvConfig NewEnv() =>
        new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["QUICKBASE_REALM"] = "example.quickbase.com",
            ["QUICKBASE_TOKEN"] = "token",
            ["QB_TABLE_CASES"] = "cases",
        }).Build());

    private sealed class NoReviews : IReviewStore
    {
        public Task<List<PublicReviewDto>> GetApprovedReviewsAsync(CancellationToken ct) => Task.FromResult(new List<PublicReviewDto>());
        public Task<FeaturedReviewsResponse> GetFeaturedAsync(int take, CancellationToken ct) => throw new NotSupportedException();
        public Task<long> CreatePendingReviewAsync(ReviewDto dto, CancellationToken ct) => throw new NotSupportedException();
    }

    private static SqlCasesPageService Page(AppDbContext db, EnvConfig env) =>
        new(db, new MemoryCache(new MemoryCacheOptions()), new NoReviews(), new ImageUrls(env));

    // The real importer, reading a canned Quickbase cases table. Nothing here can reach Blob:
    // the rows carry no attachments.
    private static (CasesImportService Importer, StubHandler Quickbase) Importer(AppDbContext db, EnvConfig env, string casesTable)
    {
        var quickbase = new StubHandler(casesTable);
        var api = new QuickbaseApi(new HttpClient(quickbase) { BaseAddress = new Uri("https://api.quickbase.com/") }, env);
        var cases = new CasesPageService(api, env, new MemoryCache(new MemoryCacheOptions()), new NoReviews(), new ImageUrls(env));

        var importer = new CasesImportService(
            cases,
            new QuickbaseImageSource(new HttpClient(new StubHandler()), env, NullLogger<QuickbaseImageSource>.Instance),
            new BlobImageSource(new BlobContainerClient(new Uri("https://example.blob.core.windows.net/images")), NullLogger<BlobImageSource>.Instance),
            new ImageProcessor(NullLogger<ImageProcessor>.Instance),
            db,
            env);

        return (importer, quickbase);
    }

    // One Quickbase case row: 3 record id, 6 publish, 8 sort order, 9 company, 17 product.
    private static string Row(long rid, int sort, string company, bool published = true) =>
        $$"""{ "3": { "value": {{rid}} }, "6": { "value": {{(published ? "true" : "false")}} }, "8": { "value": {{sort}} }, "9": { "value": "{{company}}" }, "17": { "value": "Box House" } }""";

    private static string Table(params string[] rows) => $$"""{ "data": [ {{string.Join(", ", rows)}} ] }""";

    [Fact]
    public void An_imported_case_keeps_its_quickbase_id()
    {
        // Live's one case is "2"; if it was imported, that is its Quickbase id and it stays.
        Assert.Equal("2", CasePublicIds.For(2, 1));
    }

    [Fact]
    public void An_admin_created_case_is_served_above_the_offset()
    {
        Assert.Equal("100004", CasePublicIds.For(null, 4));
    }

    [Fact]
    public void The_two_ranges_cannot_meet()
    {
        Assert.True(CasePublicIds.FitsQuickbaseRange(CasePublicIds.AdminOffset - 1));
        Assert.False(CasePublicIds.FitsQuickbaseRange(CasePublicIds.AdminOffset));
        Assert.True(long.Parse(CasePublicIds.For(null, 1)) > CasePublicIds.AdminOffset - 1);

        // One rule across the site: houses and cases split their public ids at the same number.
        Assert.Equal(HousePublicIds.AdminOffset, CasePublicIds.AdminOffset);
    }

    [Fact]
    public async Task A_panel_case_whose_sql_id_is_an_imported_quickbase_id_is_served_apart()
    {
        using var db = NewDb();
        var env = NewEnv();

        // Three Quickbase cases, imported in sort order: Quickbase 4, 2 and 3.
        var (importer, _) = Importer(db, env, Table(
            Row(4, sort: 1, company: "Acme"),
            Row(2, sort: 2, company: ""),
            Row(3, sort: 3, company: "Draft Ltd", published: false)));

        var result = await importer.ImportAsync(dryRun: false, CancellationToken.None);
        Assert.Empty(result.Problems);
        Assert.Equal(3, result.CasesInserted);

        // The premise: the import does not number cases by their Quickbase ids, so SQL id 4
        // is free, and the next case made in the panel takes it.
        Assert.DoesNotContain(await db.Cases.Select(c => c.Id).ToListAsync(), id => id == 4);
        db.Cases.Add(new Case { Id = 4, IsPublished = true, CompanyName = "Beta", ProductName = "Box House" });
        await db.SaveChangesAsync();

        var page = await Page(db, env).GetAsync(CancellationToken.None);

        Assert.Equal(3, page.Cases.Count);
        Assert.Equal(page.Cases.Count, page.Cases.Select(c => c.Id).Distinct().Count());
        Assert.Equal("Acme", page.Cases.Single(c => c.Id == "4").CompanyName);
        Assert.Equal("Beta", page.Cases.Single(c => c.Id == "100004").CompanyName);
        Assert.Equal("", page.Cases.Single(c => c.Id == "2").CompanyName);

        // Clients carry their first case's id, so they were twins too.
        Assert.Equal(2, page.Clients.Count);
        Assert.Equal("4", page.Clients.Single(c => c.Name == "Acme").Id);
        Assert.Equal("100004", page.Clients.Single(c => c.Name == "Beta").Id);
    }

    [Fact]
    public void The_import_refuses_a_quickbase_id_in_the_admin_range()
    {
        CaseImportRow RowFor(long rid, string company, string? product = null) => new(
            rid, true, false, null, false, 0, company, null, null, null, null, null, null,
            product, null, null, null, null, null, null, null, null, null, null, new List<string>());

        var problems = CasesImportService.OutOfRange(new[]
        {
            RowFor(2, ""),
            RowFor(99_999, "Last one that fits"),
            RowFor(100_004, "", product: "Would be served as a panel case"),
        });

        var problem = Assert.Single(problems);
        Assert.Contains("100004", problem);
        // A private individual's case has no company, so the product names it.
        Assert.Contains("Would be served as a panel case", problem);
    }

    [Fact]
    public async Task A_refused_import_writes_nothing()
    {
        using var db = NewDb();
        var (importer, quickbase) = Importer(db, NewEnv(), Table(
            Row(4, sort: 1, company: "Acme"),
            Row(100_004, sort: 2, company: "Too high")));

        var result = await importer.ImportAsync(dryRun: false, CancellationToken.None);

        Assert.Contains("100004", Assert.Single(result.Problems));
        Assert.Equal(2, result.CasesFetched);
        Assert.Equal(0, result.CasesInserted);
        Assert.Empty(db.Cases);
        Assert.Equal(1, quickbase.Calls);   // the cases table, and nothing after it
    }
}
