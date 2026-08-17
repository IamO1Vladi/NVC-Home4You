using System;
using System.Linq;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Finding the same customer twice.
//
// The CRM import created 257 leads beside the ones the panel had already promoted from
// website enquiries, and nothing in the schema notices an overlap — the filtered unique
// indexes stop one ENQUIRY becoming two leads, which is a different problem.
//
// The risk here runs both ways and both ways are bad: a missed duplicate means two people
// working the same customer without knowing, and a false one invites somebody to merge two
// real customers into one. So the strong signals have to catch the spellings that actually
// occur, and the weak one has to stay clearly labelled as a hint.
public class LeadDuplicateTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"dupes-{Guid.NewGuid()}")
            .Options);

    private static Lead Lead(string name, string? email = null, string? phone = null) => new()
    {
        Name = name,
        Email = email,
        Phone = phone,
        Status = LeadStatuses.Contacted,
        CreatedAt = DateTimeOffset.UtcNow.AddDays(-10),
    };

    [Fact]
    public async Task Two_leads_on_one_address_are_reported()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            Lead("Ivan Petrov", "ivan@x.bg"),
            Lead("И. Петров", "IVAN@X.BG"));       // case and spelling both differ
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        var cluster = Assert.Single(report.Strong);
        Assert.Equal("email", cluster.Signal);
        Assert.Equal(2, cluster.Leads.Count);
        Assert.Equal(1, report.DuplicateLeads);
    }

    [Fact]
    public async Task The_same_phone_written_two_ways_still_matches()
    {
        // +359 88 123 4567 and 0888 123 456 are the same number, and the CRM holds both
        // spellings. Comparing the raw strings would miss most real duplicates, which is
        // the entire point of the report.
        using var db = NewDb();
        db.Leads.AddRange(
            Lead("Ivan", phone: "+359 88 123 4567"),
            Lead("Ivan P", phone: "088 812 34567"));
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        var cluster = Assert.Single(report.Strong);
        Assert.Equal("phone", cluster.Signal);
    }

    [Fact]
    public async Task A_pair_that_shares_both_is_reported_once()
    {
        // The same customer with both fields filled in matches on email AND phone.
        // Reporting it twice makes the list look worse than it is.
        using var db = NewDb();
        db.Leads.AddRange(
            Lead("Ivan", "ivan@x.bg", "+359881234567"),
            Lead("Ivan P", "ivan@x.bg", "0881234567"));
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        Assert.Single(report.Strong);
    }

    [Fact]
    public async Task A_short_number_fragment_pairs_nobody()
    {
        // "123" is something somebody typed, not a phone number. Matching on it would
        // pair unrelated customers and cost the report its credibility.
        using var db = NewDb();
        db.Leads.AddRange(Lead("A", phone: "123"), Lead("B", phone: "123"));
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        Assert.Empty(report.Strong);
    }

    [Fact]
    public async Task A_shared_name_is_a_hint_and_is_kept_apart_from_the_findings()
    {
        // "Иван Петров" is not rare. It belongs in the report, but never where somebody
        // merging through the strong list would sweep it up by accident.
        using var db = NewDb();
        db.Leads.AddRange(
            Lead("Иван Петров", "one@x.bg"),
            Lead("иван  петров", "two@x.bg"));       // spacing and case differ
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        Assert.Empty(report.Strong);
        var cluster = Assert.Single(report.Weak);
        Assert.Equal("name", cluster.Signal);
    }

    [Fact]
    public async Task A_name_already_caught_by_email_is_not_repeated_as_a_hint()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            Lead("Ivan Petrov", "ivan@x.bg"),
            Lead("Ivan Petrov", "ivan@x.bg"));
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        Assert.Single(report.Strong);
        Assert.Empty(report.Weak);
    }

    [Fact]
    public async Task A_one_word_name_suggests_nothing_on_its_own()
    {
        // Half the imported rows are called things like "няма" ("none"). Pairing those
        // would bury the real findings under noise.
        using var db = NewDb();
        db.Leads.AddRange(Lead("няма"), Lead("няма"), Lead("Vladi"), Lead("Vladi"));
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        Assert.Empty(report.Weak);
    }

    [Fact]
    public async Task Leads_with_nothing_in_common_are_left_alone()
    {
        using var db = NewDb();
        db.Leads.AddRange(
            Lead("Ivan Petrov", "ivan@x.bg", "+359881111111"),
            Lead("Maria Dimitrova", "maria@x.bg", "+359882222222"));
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        Assert.Empty(report.Strong);
        Assert.Empty(report.Weak);
        Assert.Equal(2, report.Scanned);
    }

    [Fact]
    public async Task Each_cluster_says_where_its_leads_came_from()
    {
        // The decision this report exists to support is "which of these do I keep?", and
        // origin is most of the answer: a lead with a website enquiry behind it has
        // evidence attached, a hand-imported one may not.
        using var db = NewDb();
        var offer = new Offer { Name = "Ivan", Email = "ivan@x.bg" };
        db.Offers.Add(offer);
        await db.SaveChangesAsync();

        var promoted = Lead("Ivan Petrov", "ivan@x.bg");
        promoted.OfferId = offer.Id;
        var imported = Lead("Ivan P", "ivan@x.bg");
        imported.QuickbaseRecordId = 137;
        db.Leads.AddRange(promoted, imported);
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        var origins = report.Strong.Single().Leads.Select(l => l.Origin).ToList();
        Assert.Contains(origins, o => o.Contains("offer"));
        Assert.Contains(origins, o => o.Contains("imported") && o.Contains("137"));
    }

    [Fact]
    public async Task The_oldest_lead_in_a_cluster_is_listed_first()
    {
        // Whichever record has the longest history is usually the one to keep, and it
        // reads as the original with the copies under it.
        using var db = NewDb();
        var older = Lead("Ivan", "ivan@x.bg");
        older.CreatedAt = DateTimeOffset.UtcNow.AddDays(-100);
        var newer = Lead("Ivan again", "ivan@x.bg");
        newer.CreatedAt = DateTimeOffset.UtcNow.AddDays(-2);
        db.Leads.AddRange(newer, older);
        await db.SaveChangesAsync();

        var report = await new LeadDuplicateService(db).FindAsync();

        Assert.Equal("Ivan", report.Strong.Single().Leads.First().Name);
    }
}
