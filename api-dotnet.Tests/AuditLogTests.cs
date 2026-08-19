using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The audit log.
//
// Everything here fails silently if it breaks: the panel works perfectly, saves succeed, and
// the history is simply wrong or absent — discovered on the one day somebody needs it, which
// is the day it is too late. The redaction test in particular is not a nicety: the log is a
// second copy of the data in a table with a much longer life, so anything that leaks into it
// leaks somewhere it can never be corrected.
public class AuditLogTests
{
    private sealed class StubActor : ICurrentActor
    {
        public StubActor(string? upn) => Upn = upn;
        public string? Upn { get; }
    }

    [Fact]
    public async Task Deleting_a_container_audits_its_money_lines_too()
    {
        // Review fix (2026-08-19): DeleteAsync used to leave the lots to the database
        // cascade, which deletes them OUTSIDE the change tracker — so the interceptor
        // never saw the money lines it exists to record. Loading them first puts each
        // deleted line in the log.
        using var db = NewDb();
        var cycle = new Data.Entities.BuyCycle { Label = "2024-2026" };
        var model = new Data.Entities.ProductModel { Name = "Expandable 58" };
        var shipment = new Data.Entities.Shipment { BuyCycle = cycle, Reference = "MSKU-1" };
        var lot = new Data.Entities.PurchaseLot
        {
            Shipment = shipment, ProductModel = model, Quantity = 3, UnitCost = 10_000m,
        };
        db.AddRange(cycle, model, shipment, lot);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        db.AuditEntries.RemoveRange(db.AuditEntries);
        await db.SaveChangesAsync();

        var (deleted, _) = await new Services.ShipmentAdminService(db).DeleteAsync(shipment.Id, default);
        Assert.True(deleted);

        var audited = db.AuditEntries.ToList();
        Assert.Contains(audited, a => a.EntityType == nameof(Data.Entities.Shipment) && a.Action == "deleted");
        Assert.Contains(audited, a => a.EntityType == nameof(Data.Entities.PurchaseLot) && a.Action == "deleted");
    }

    private static AppDbContext NewDb(string? actor = "vladi@nvc-home4you.eu") =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"audit-{Guid.NewGuid()}")
            .AddInterceptors(new AuditInterceptor(
                new StubActor(actor), NullLogger<AuditInterceptor>.Instance))
            .Options);

    private static List<JsonElement> Changes(AuditEntry entry) =>
        JsonDocument.Parse(entry.ChangesJson).RootElement.EnumerateArray().ToList();

    private static JsonElement Field(AuditEntry entry, string name) =>
        Changes(entry).Single(c => c.GetProperty("Field").GetString() == name);

    private static string? From(JsonElement change) =>
        change.GetProperty("From").ValueKind == JsonValueKind.Null ? null : change.GetProperty("From").GetString();

    private static string? To(JsonElement change) =>
        change.GetProperty("To").ValueKind == JsonValueKind.Null ? null : change.GetProperty("To").GetString();

    // --- The guarantee the whole table exists for --------------------------------------

    [Fact]
    public async Task An_edit_records_who_what_and_the_values_on_both_sides()
    {
        using var db = NewDb("maria@nvc-home4you.eu");
        db.Customers.Add(new Customer { Name = "Стройко ООД", Phone = "0888111222" });
        await db.SaveChangesAsync();

        var customer = await db.Customers.FirstAsync();
        customer.Phone = "0888999000";
        await db.SaveChangesAsync();

        var edit = await db.AuditEntries.SingleAsync(a => a.Action == AuditActions.Updated);

        Assert.Equal("maria@nvc-home4you.eu", edit.ActorUpn);
        Assert.Equal(nameof(Customer), edit.EntityType);
        Assert.Equal(customer.Id.ToString(), edit.EntityId);
        Assert.Equal("Стройко ООД", edit.Summary);

        var phone = Field(edit, nameof(Customer.Phone));
        Assert.Equal("0888111222", From(phone));
        Assert.Equal("0888999000", To(phone));
    }

    // --- Redaction ----------------------------------------------------------------------

    [Fact]
    public async Task An_egn_never_reaches_the_audit_log()
    {
        // THE test. Customer.cs calls this "the most sensitive value in this database" and
        // CustomerAdminService keeps it out of search on purpose; copying it into a log that
        // outlives the row would quietly undo all of that.
        const string egn = "7501011000";
        const string corrected = "8001152342";

        using var db = NewDb();
        db.Customers.Add(new Customer { Name = "Иван Петров", PersonalId = egn });
        await db.SaveChangesAsync();

        var customer = await db.Customers.FirstAsync();
        customer.PersonalId = corrected;
        await db.SaveChangesAsync();

        customer.PersonalId = null;
        await db.SaveChangesAsync();

        // Not one entry, not one column: the whole table is searched for either number.
        var everything = await db.AuditEntries.ToListAsync();
        var serialised = string.Join("\n", everything.Select(a =>
            $"{a.EntityType} {a.EntityId} {a.Action} {a.Summary} {a.ChangesJson}"));

        Assert.DoesNotContain(egn, serialised);
        Assert.DoesNotContain(corrected, serialised);

        // ...and it still recorded that the field changed, which is the audit question.
        var edits = everything.Where(a => a.Action == AuditActions.Updated).ToList();
        Assert.Equal(2, edits.Count);
        Assert.All(edits, e => Assert.Contains(nameof(Customer.PersonalId), e.ChangesJson));
    }

    [Fact]
    public async Task A_redacted_field_says_whether_it_was_set_cleared_or_replaced()
    {
        using var db = NewDb();
        db.Customers.Add(new Customer { Name = "Иван" });
        await db.SaveChangesAsync();
        var customer = await db.Customers.FirstAsync();

        customer.PersonalId = "7501011000";
        await db.SaveChangesAsync();
        customer.PersonalId = "8001152342";
        await db.SaveChangesAsync();
        customer.PersonalId = null;
        await db.SaveChangesAsync();

        var edits = await db.AuditEntries
            .Where(a => a.Action == AuditActions.Updated)
            .OrderBy(a => a.Id)
            .ToListAsync();

        Assert.Equal(AuditRedaction.RedactedSet, To(Field(edits[0], nameof(Customer.PersonalId))));
        Assert.Equal(AuditRedaction.RedactedChanged, To(Field(edits[1], nameof(Customer.PersonalId))));
        Assert.Equal(AuditRedaction.RedactedCleared, To(Field(edits[2], nameof(Customer.PersonalId))));
    }

    [Fact]
    public void An_eik_is_deliberately_not_redacted()
    {
        // It identifies a company in a public register and the panel already searches on it.
        // Redacting it would cost information for no privacy gained.
        Assert.False(AuditRedaction.IsSensitive(nameof(Customer), nameof(Customer.Eik)));
        Assert.True(AuditRedaction.IsSensitive(nameof(Customer), nameof(Customer.PersonalId)));
    }

    [Theory]
    [InlineData("PersonalId")]
    [InlineData("personalId")]
    [InlineData("CustomerEgn")]
    [InlineData("ApiKey")]
    [InlineData("PasswordHash")]
    [InlineData("AccessToken")]
    public void The_name_heuristic_catches_a_sensitive_column_nobody_listed(string property)
    {
        // A denylist fails open for the field somebody forgets. This is the safety net —
        // it will not catch a badly named column, but an audit log should lean towards
        // recording too little rather than leaking.
        Assert.True(AuditRedaction.IsSensitive("SomeFutureTable", property));
    }

    // --- Creation and deletion -----------------------------------------------------------

    [Fact]
    public async Task A_new_row_is_recorded_against_its_real_id_not_zero()
    {
        // The reason the interceptor works in two phases: before the INSERT runs there is no
        // id, so a single-phase implementation files every creation under 0.
        using var db = NewDb();
        db.Factories.Add(new Factory { Name = "Bursa Prefab", Country = "Türkiye" });
        await db.SaveChangesAsync();

        var factory = await db.Factories.FirstAsync();
        var created = await db.AuditEntries.SingleAsync(a => a.EntityType == nameof(Factory));

        Assert.Equal(AuditActions.Created, created.Action);
        Assert.Equal(factory.Id.ToString(), created.EntityId);
        Assert.NotEqual("0", created.EntityId);
        Assert.True(factory.Id > 0);
        Assert.Equal("Bursa Prefab", created.Summary);

        // The snapshot says what appeared, and skips the columns that were left empty.
        Assert.Equal("Bursa Prefab", To(Field(created, nameof(Factory.Name))));
        Assert.DoesNotContain(nameof(Factory.ContactEmail), created.ChangesJson);
    }

    [Fact]
    public async Task A_deletion_leaves_a_tombstone_saying_what_was_lost()
    {
        // The entry that matters most, and the reason this table has no foreign keys: it
        // has to outlive the row it describes.
        using var db = NewDb();
        db.Customers.Add(new Customer { Name = "Стройко ООД", Eik = "831919995" });
        await db.SaveChangesAsync();

        var customer = await db.Customers.FirstAsync();
        var id = customer.Id;
        db.Customers.Remove(customer);
        await db.SaveChangesAsync();

        var deleted = await db.AuditEntries.SingleAsync(a => a.Action == AuditActions.Deleted);

        Assert.Equal(id.ToString(), deleted.EntityId);
        Assert.Equal("Стройко ООД", deleted.Summary);
        // The values are on the FROM side: they existed, and now they do not.
        Assert.Equal("831919995", From(Field(deleted, nameof(Customer.Eik))));
        Assert.Null(To(Field(deleted, nameof(Customer.Eik))));
    }

    // --- What is NOT recorded ------------------------------------------------------------

    [Fact]
    public async Task A_save_that_changed_nothing_writes_no_entry()
    {
        // EF reports a property as modified whenever it was assigned, even to the value it
        // already held. Recording those would fill the log with entries saying nothing.
        using var db = NewDb();
        db.Customers.Add(new Customer { Name = "Иван", Phone = "0888111222" });
        await db.SaveChangesAsync();

        var customer = await db.Customers.FirstAsync();
        customer.Phone = "0888111222";
        await db.SaveChangesAsync();

        Assert.Empty(await db.AuditEntries.Where(a => a.Action == AuditActions.Updated).ToListAsync());
    }

    [Fact]
    public async Task The_lead_conversation_is_not_duplicated_into_the_audit_log()
    {
        // LeadActivity is already an append-only thread that records its own actor. Auditing
        // it would store a second copy of every customer conversation to learn nothing.
        using var db = NewDb();
        var lead = new Lead { Name = "Ivan" };
        db.Leads.Add(lead);
        await db.SaveChangesAsync();

        db.LeadActivities.Add(new LeadActivity
        {
            LeadId = lead.Id,
            Type = LeadActivityTypes.Note,
            Body = "Customer asked about delivery to Greece.",
            OccurredAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        Assert.Empty(await db.AuditEntries.Where(a => a.EntityType == nameof(LeadActivity)).ToListAsync());
        // ...while the lead itself IS audited.
        Assert.NotEmpty(await db.AuditEntries.Where(a => a.EntityType == nameof(Lead)).ToListAsync());
    }

    [Fact]
    public async Task The_audit_log_does_not_audit_itself()
    {
        using var db = NewDb();
        db.Factories.Add(new Factory { Name = "Bursa Prefab" });
        await db.SaveChangesAsync();

        Assert.Empty(await db.AuditEntries.Where(a => a.EntityType == nameof(AuditEntry)).ToListAsync());
        Assert.Single(await db.AuditEntries.ToListAsync());
    }

    // --- Attribution ---------------------------------------------------------------------

    [Fact]
    public async Task A_write_with_nobody_signed_in_is_recorded_as_the_system()
    {
        // The importers, the mail poller and the CLI commands. Null is the honest answer;
        // inventing a username would put a lie in the one table that exists to be believed.
        using var db = NewDb(actor: null);
        db.Factories.Add(new Factory { Name = "Imported Works" });
        await db.SaveChangesAsync();

        var entry = await db.AuditEntries.SingleAsync();
        Assert.Null(entry.ActorUpn);
    }

    // --- Volume control -------------------------------------------------------------------

    [Fact]
    public async Task A_very_long_value_is_truncated_rather_than_stored_whole()
    {
        using var db = NewDb();
        db.Customers.Add(new Customer { Name = "Иван" });
        await db.SaveChangesAsync();

        var customer = await db.Customers.FirstAsync();
        customer.Notes = new string('x', 5000);
        await db.SaveChangesAsync();

        var edit = await db.AuditEntries.SingleAsync(a => a.Action == AuditActions.Updated);
        var notes = To(Field(edit, nameof(Customer.Notes)));

        Assert.NotNull(notes);
        Assert.True(notes!.Length <= AuditRedaction.MaxValueChars + 1, $"was {notes.Length} chars");
        Assert.EndsWith("…", notes);
    }

    [Fact]
    public async Task Several_rows_changed_in_one_save_each_get_their_own_entry()
    {
        using var db = NewDb();
        db.Factories.AddRange(
            new Factory { Name = "First" },
            new Factory { Name = "Second" });
        await db.SaveChangesAsync();

        var entries = await db.AuditEntries.Where(a => a.EntityType == nameof(Factory)).ToListAsync();

        Assert.Equal(2, entries.Count);
        Assert.Equal(new[] { "First", "Second" }, entries.Select(e => e.Summary).OrderBy(s => s));
        // Distinct ids, so each entry points at the row it describes.
        Assert.Equal(2, entries.Select(e => e.EntityId).Distinct().Count());
    }
}
