using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The public brochures (ROADMAP #16). Two things carry the whole design and both live
// here: the slug is an address that never changes, and the panel must be unable to 404 a
// page the site links — twelve prerendered snapshots hard-code these URLs, and the
// freshness guard only watches /assets/ files, so nothing else would ever notice.
public class PublicDocumentTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"pubdoc-{Guid.NewGuid()}")
            .Options);

    private static PublicDocument Doc(string slug, string lang, bool active = true) => new()
    {
        Slug = slug,
        Lang = lang,
        Title = slug,
        FileName = $"{slug}-{lang}.pdf",
        BlobKey = $"brochures/{Guid.NewGuid():N}.pdf",
        SizeBytes = 1234,
        ContentType = "application/pdf",
        IsActive = active,
    };

    // --- The slug: ASCII, or it is the old problem at a new address ---------------------

    [Fact]
    public void The_slug_shape_is_ascii_lowercase_and_nothing_else()
    {
        Assert.True(PublicDocumentSlugs.IsValidSlug("villa-office"));
        Assert.True(PublicDocumentSlugs.IsValidSlug("box-house"));
        Assert.True(PublicDocumentSlugs.IsValidSlug("a1"));

        // The file names these slugs replace — Cyrillic, spaces, typographic quotes —
        // must be impossible to smuggle back in as addresses.
        Assert.False(PublicDocumentSlugs.IsValidSlug("Вила-Офис"));
        Assert.False(PublicDocumentSlugs.IsValidSlug("villa office"));
        Assert.False(PublicDocumentSlugs.IsValidSlug("Villa-Office"));
        Assert.False(PublicDocumentSlugs.IsValidSlug("villa_office"));
        Assert.False(PublicDocumentSlugs.IsValidSlug("-villa"));
        Assert.False(PublicDocumentSlugs.IsValidSlug("villa-"));
        Assert.False(PublicDocumentSlugs.IsValidSlug("villa--office"));
        Assert.False(PublicDocumentSlugs.IsValidSlug(""));
        Assert.False(PublicDocumentSlugs.IsValidSlug(null));
        Assert.False(PublicDocumentSlugs.IsValidSlug(new string('a', 81)));
    }

    [Fact]
    public void Every_wired_slug_passes_its_own_validation()
    {
        // The list the site depends on must never contain a slug the write paths refuse.
        foreach (var slug in PublicDocumentSlugs.Wired)
            Assert.True(PublicDocumentSlugs.IsValidSlug(slug));
    }

    // --- The blob key: brochures/ or nothing --------------------------------------------

    [Fact]
    public void Only_keys_under_the_brochures_prefix_are_readable()
    {
        // The container is shared with the public images and the route is
        // unauthenticated — the prefix check is what keeps a mis-set row from turning
        // the brochure route into a reader of anything else.
        Assert.True(PublicDocumentStore.IsValidKey($"brochures/{Guid.NewGuid():N}.pdf"));
        Assert.True(PublicDocumentStore.IsValidKey(PublicDocumentStore.MintKey()));

        Assert.False(PublicDocumentStore.IsValidKey("leads/7/scan.pdf"));
        Assert.False(PublicDocumentStore.IsValidKey("customers/3/invoice.pdf"));
        Assert.False(PublicDocumentStore.IsValidKey("brochures/../customers/3/invoice.pdf"));
        Assert.False(PublicDocumentStore.IsValidKey("brochures/catalogue.exe"));
        Assert.False(PublicDocumentStore.IsValidKey(""));
        Assert.False(PublicDocumentStore.IsValidKey(null));
    }

    // --- Resolution: requested language, then bg, then whatever exists ------------------

    [Fact]
    public async Task A_translated_edition_is_served_to_its_own_language()
    {
        using var db = NewDb();
        db.PublicDocuments.AddRange(Doc("villa-office", "bg"), Doc("villa-office", "el"));
        await db.SaveChangesAsync();

        var hit = await new PublicDocumentService(db).ResolveAsync("villa-office", "el", CancellationToken.None);

        Assert.Equal("el", hit!.Lang);
    }

    [Fact]
    public async Task A_missing_translation_falls_back_to_bulgarian_not_to_404()
    {
        // The Greek visitor gets a real catalogue from day one, and starts getting the
        // Greek edition the moment it is uploaded — with no code change and no page edit.
        using var db = NewDb();
        db.PublicDocuments.Add(Doc("villa-office", "bg"));
        await db.SaveChangesAsync();

        var hit = await new PublicDocumentService(db).ResolveAsync("villa-office", "el", CancellationToken.None);

        Assert.Equal("bg", hit!.Lang);
    }

    [Fact]
    public async Task With_no_bulgarian_edition_whatever_exists_is_served()
    {
        using var db = NewDb();
        db.PublicDocuments.Add(Doc("villa-office", "en"));
        await db.SaveChangesAsync();

        var hit = await new PublicDocumentService(db).ResolveAsync("villa-office", "el", CancellationToken.None);

        Assert.Equal("en", hit!.Lang);
    }

    [Fact]
    public async Task A_retired_edition_is_not_served_and_not_fallen_back_to()
    {
        using var db = NewDb();
        db.PublicDocuments.AddRange(Doc("villa-office", "el", active: false), Doc("villa-office", "bg"));
        await db.SaveChangesAsync();

        var hit = await new PublicDocumentService(db).ResolveAsync("villa-office", "el", CancellationToken.None);

        Assert.Equal("bg", hit!.Lang);
    }

    [Fact]
    public async Task An_unknown_or_malformed_slug_resolves_to_nothing()
    {
        using var db = NewDb();
        var svc = new PublicDocumentService(db);

        Assert.Null(await svc.ResolveAsync("no-such-doc", "bg", CancellationToken.None));
        Assert.Null(await svc.ResolveAsync("Вила-Офис", "bg", CancellationToken.None));
    }

    // --- Uploads: the one door, and where it does not open ------------------------------

    [Fact]
    public async Task Uploading_into_an_empty_slot_of_a_wired_slug_creates_the_edition()
    {
        using var db = NewDb();

        var result = await new PublicDocumentService(db).RecordUploadAsync(
            "villa-office", "el", "brochures/abc.pdf", "Вила-Офис-EL.pdf", 999, "maria@x.eu", CancellationToken.None);

        Assert.True(result.Ok);
        var row = await db.PublicDocuments.SingleAsync();
        Assert.Equal("el", row.Lang);
        Assert.True(row.IsActive);
        Assert.Equal("maria@x.eu", row.UpdatedByUpn);
    }

    [Fact]
    public async Task Replacing_repoints_the_row_and_the_address_survives()
    {
        using var db = NewDb();
        var original = Doc("villa-office", "bg");
        db.PublicDocuments.Add(original);
        await db.SaveChangesAsync();
        var oldKey = original.BlobKey;

        var result = await new PublicDocumentService(db).RecordUploadAsync(
            "villa-office", "bg", "brochures/new.pdf", "Вила-Офис-2027.pdf", 555, null, CancellationToken.None);

        Assert.True(result.Ok);
        var row = await db.PublicDocuments.SingleAsync();
        Assert.NotEqual(oldKey, row.BlobKey);           // new bytes...
        Assert.Equal("villa-office", row.Slug);          // ...same address
        Assert.Equal("Вила-Офис-2027.pdf", row.FileName);
    }

    [Fact]
    public async Task Replacing_a_retired_edition_revives_it()
    {
        // Nobody replaces a catalogue they mean to keep hidden.
        using var db = NewDb();
        db.PublicDocuments.Add(Doc("villa-office", "bg", active: false));
        await db.SaveChangesAsync();

        await new PublicDocumentService(db).RecordUploadAsync(
            "villa-office", "bg", "brochures/new.pdf", "x.pdf", 1, null, CancellationToken.None);

        Assert.True((await db.PublicDocuments.SingleAsync()).IsActive);
    }

    [Fact]
    public async Task A_slug_no_page_references_is_refused_which_is_the_missing_add_button()
    {
        // There is nowhere to put a contract, a stray scan, or anything else the public
        // site does not link — the same control ImagesController gets from its key check.
        using var db = NewDb();

        var result = await new PublicDocumentService(db).RecordUploadAsync(
            "leaked-contract", "bg", "brochures/x.pdf", "contract.pdf", 1, null, CancellationToken.None);

        Assert.Equal(PublicDocumentService.Outcome.Refused, result.Outcome);
        Assert.Empty(await db.PublicDocuments.ToListAsync());
    }

    [Fact]
    public async Task A_language_the_site_does_not_speak_is_refused()
    {
        using var db = NewDb();

        var result = await new PublicDocumentService(db).RecordUploadAsync(
            "villa-office", "de", "brochures/x.pdf", "x.pdf", 1, null, CancellationToken.None);

        Assert.Equal(PublicDocumentService.Outcome.Refused, result.Outcome);
    }

    // --- Retiring: reversible, and refused where it would 404 a live page ---------------

    [Fact]
    public async Task Retiring_the_last_working_edition_of_a_wired_slug_is_refused()
    {
        // THE rule the design exists for. IsActive = false does not remove the button on
        // the page that links this — it turns the button into a 404 that no test, no
        // guard and no publish would ever notice.
        using var db = NewDb();
        db.PublicDocuments.Add(Doc("villa-office", "bg"));
        await db.SaveChangesAsync();

        var result = await new PublicDocumentService(db)
            .SetActiveAsync("villa-office", "bg", active: false, null, CancellationToken.None);

        Assert.Equal(PublicDocumentService.Outcome.Refused, result.Outcome);
        Assert.True((await db.PublicDocuments.SingleAsync()).IsActive);
    }

    [Fact]
    public async Task Retiring_a_translation_is_fine_while_another_edition_stands()
    {
        // The public route falls back, so the page keeps working — this is "not translated
        // yet", which is a true state, not an outage.
        using var db = NewDb();
        db.PublicDocuments.AddRange(Doc("villa-office", "bg"), Doc("villa-office", "el"));
        await db.SaveChangesAsync();

        var result = await new PublicDocumentService(db)
            .SetActiveAsync("villa-office", "el", active: false, null, CancellationToken.None);

        Assert.True(result.Ok);
    }

    [Fact]
    public async Task A_document_nothing_links_can_be_retired_and_deleted()
    {
        using var db = NewDb();
        db.PublicDocuments.Add(Doc("some-future-doc", "bg"));
        await db.SaveChangesAsync();

        var svc = new PublicDocumentService(db);
        Assert.True((await svc.SetActiveAsync("some-future-doc", "bg", false, null, CancellationToken.None)).Ok);
        Assert.True((await svc.DeleteAsync("some-future-doc", "bg", CancellationToken.None)).Ok);
        Assert.Empty(await db.PublicDocuments.ToListAsync());
    }

    [Fact]
    public async Task Deleting_anything_under_a_wired_slug_is_refused_outright()
    {
        using var db = NewDb();
        db.PublicDocuments.AddRange(Doc("villa-office", "bg"), Doc("villa-office", "el"));
        await db.SaveChangesAsync();

        var result = await new PublicDocumentService(db).DeleteAsync("villa-office", "el", CancellationToken.None);

        Assert.Equal(PublicDocumentService.Outcome.Refused, result.Outcome);
        Assert.Equal(2, (await db.PublicDocuments.ToListAsync()).Count);
    }

    // --- The importer: runs once, then the panel owns the rows --------------------------

    private static PublicDocumentStore UnconfiguredStore()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
        return new PublicDocumentStore(new EnvConfig(cfg), NullLogger<PublicDocumentStore>.Instance);
    }

    [Fact]
    public void The_importer_covers_exactly_the_wired_slugs()
    {
        // The two lists describe the same six documents from two sides — the site's and
        // the import's — and nothing but this stops them drifting apart.
        Assert.Equal(
            PublicDocumentSlugs.Wired.OrderBy(s => s, StringComparer.Ordinal),
            PublicDocumentImportService.TheSix.Select(s => s.Slug).OrderBy(s => s, StringComparer.Ordinal));
    }

    [Fact]
    public async Task A_dry_run_reports_what_it_would_do_and_writes_nothing()
    {
        using var db = NewDb();
        var dir = Path.Combine(Path.GetTempPath(), $"brochures-{Guid.NewGuid():N}");
        Directory.CreateDirectory(dir);
        try
        {
            // Two of six present: both reported importable, four missing named as problems.
            foreach (var s in PublicDocumentImportService.TheSix.Take(2))
                await File.WriteAllBytesAsync(Path.Combine(dir, s.FileName), new byte[] { 1 });

            var result = await new PublicDocumentImportService(db, UnconfiguredStore())
                .ImportAsync(dir, dryRun: true, CancellationToken.None);

            Assert.Equal(2, result.Imported);
            Assert.Equal(4, result.Problems.Count);
            Assert.Empty(await db.PublicDocuments.ToListAsync());
        }
        finally
        {
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task A_slug_already_in_sql_is_skipped_never_overwritten()
    {
        // After the cutover the panel owns these rows. Someone may have replaced a
        // catalogue since the import — a re-run must not quietly restore last season's.
        using var db = NewDb();
        foreach (var s in PublicDocumentImportService.TheSix)
            db.PublicDocuments.Add(Doc(s.Slug, "bg"));
        await db.SaveChangesAsync();
        var keysBefore = (await db.PublicDocuments.ToListAsync()).Select(d => d.BlobKey).ToHashSet();

        // Not a dry run — the skip must hold on the real path, which is why it never
        // reaches the (unconfigured) store.
        var result = await new PublicDocumentImportService(db, UnconfiguredStore())
            .ImportAsync(Path.GetTempPath(), dryRun: false, CancellationToken.None);

        Assert.Equal(0, result.Imported);
        Assert.Equal(6, result.Skipped);
        Assert.Equal(keysBefore, (await db.PublicDocuments.ToListAsync()).Select(d => d.BlobKey).ToHashSet());
    }

    // --- The paper trail ----------------------------------------------------------------

    [Fact]
    public void Replacing_a_brochure_is_an_audited_act()
    {
        // Replacement history for free: "which catalogue was live in July?" is the audit
        // log's question to answer, not a reason to keep superseded blobs findable.
        Assert.True(AuditedEntities.IsAudited(nameof(PublicDocument)));
    }
}
