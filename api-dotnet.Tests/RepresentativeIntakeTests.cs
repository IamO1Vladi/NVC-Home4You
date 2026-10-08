using System;
using System.Collections.Generic;
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

// An enquiry through a representative's link becomes that representative's lead the moment
// it arrives (#38), instead of waiting in the queue for someone to promote it.
//
// What is worth pinning is the set of rules around that promotion rather than the promotion
// itself, which LeadServiceTests already covers: who the lead belongs to and what its Source
// says, which enquiries are deliberately NOT promoted and why the mail will say so, what
// happens when the same customer already has an open lead — reported, never merged — and
// that none of it can ever reach the customer as an error, because by the time the intake
// runs the form has already said thank you.
public class RepresentativeIntakeTests
{
    private const string Conn = "Server=(localdb)\\MSSQLLocalDB;Database=X;Trusted_Connection=True";
    private const string Registry = "dtodorov=dtodorov@nvc-home4you.eu";
    private const string RepUpn = "dtodorov@nvc-home4you.eu";

    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"intake-{Guid.NewGuid()}")
            .Options);

    private static EnvConfig Config(params (string Key, string Value)[] settings)
    {
        var dict = new Dictionary<string, string?>();
        foreach (var (k, v) in settings) dict[k] = v;
        return new EnvConfig(new ConfigurationBuilder().AddInMemoryCollection(dict).Build());
    }

    // SQL authoritative for leads, and the registry set: the configuration the feature
    // ships under. Everything that is not this is one of the skipped cases below.
    private static EnvConfig SqlLeads() =>
        Config(("SQL_CONNECTION_STRING", Conn), ("DATA_SOURCE_LEADS", "sql"), ("REPRESENTATIVES", Registry));

    private static EnvConfig.Representative Rep(EnvConfig env) => env.FindRepresentativeBySlug("dtodorov")!;

    private static RepresentativeIntake Intake(AppDbContext db, EnvConfig env) =>
        new(env, new LeadService(db), new LeadDuplicateService(db), NullLogger<RepresentativeIntake>.Instance);

    // The row SqlLeadService would have written: the representative line already in the
    // message (RepresentativeLine), which is what the opening thread entry then carries.
    private static async Task<int> SeedOffer(
        AppDbContext db, string? email = "ivan@example.com", string? phone = "+359 88 123 4567")
    {
        var offer = new Offer
        {
            Name = "Ivan Petrov",
            Email = email,
            Phone = phone,
            Message = "Представител: dtodorov\n\nInterested in a 60m² modular house near Plovdiv.",
            Locale = "bg",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-1),
        };
        db.Offers.Add(offer);
        await db.SaveChangesAsync();
        return offer.Id;
    }

    private static Lead OpenLead(string? email = null, string? phone = null, string? owner = null, string status = LeadStatuses.Contacted) => new()
    {
        Name = "Someone already here",
        Email = email,
        Phone = phone,
        OwnerUpn = owner,
        Status = status,
        CreatedAt = DateTimeOffset.UtcNow.AddDays(-10),
        LastActivityAt = DateTimeOffset.UtcNow.AddDays(-2),
    };

    // --- The ordinary case ---------------------------------------------------------------

    [Fact]
    public async Task A_valid_enquiry_becomes_the_representatives_lead_at_once()
    {
        using var db = NewDb();
        var env = SqlLeads();
        var offerId = await SeedOffer(db);

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, offerId, Rep(env), "ivan@example.com", "+359 88 123 4567", CancellationToken.None);

        Assert.True(outcome.LeadCreated);
        Assert.Null(outcome.SkippedBecause);
        Assert.Null(outcome.DuplicateOfLeadId);

        var lead = await db.Leads.Include(l => l.Activities).SingleAsync();
        Assert.Equal(lead.Id, outcome.LeadId);
        // Owned by the representative, not by nobody: the rep panel lists only what he owns,
        // so an unowned lead would be invisible to the one person it was for.
        Assert.Equal(RepUpn, lead.OwnerUpn);
        Assert.Equal("Представител: dtodorov", lead.Source);
        Assert.Equal(offerId, lead.OfferId);
        Assert.Null(lead.QuestionId);
        Assert.Equal(LeadStatuses.New, lead.Status);

        // The queue stops offering it, exactly as the panel's own promote button does.
        Assert.True((await db.Offers.SingleAsync()).LeadCreated);

        // And the thread opens with the customer's words, attributed to them — the same
        // promotion the panel performs, so nothing about the lead says "made by a robot".
        var opening = Assert.Single(lead.Activities);
        Assert.Equal(LeadActivityTypes.EmailIn, opening.Type);
        Assert.Null(opening.ActorUpn);
        Assert.StartsWith("Представител: dtodorov", opening.Body);
    }

    [Fact]
    public async Task A_question_promotes_the_same_way_without_a_phone()
    {
        using var db = NewDb();
        var env = SqlLeads();
        db.Questions.Add(new Question { Name = "Maria", Email = "maria@example.com", Message = "Do you deliver to Greece?", Locale = "el" });
        await db.SaveChangesAsync();
        var questionId = db.Questions.Single().Id;

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindQuestion, questionId, Rep(env), "maria@example.com", null, CancellationToken.None);

        Assert.True(outcome.LeadCreated);
        var lead = await db.Leads.SingleAsync();
        Assert.Equal(questionId, lead.QuestionId);
        Assert.Null(lead.OfferId);
        Assert.Equal(RepUpn, lead.OwnerUpn);
        Assert.Equal("Представител: dtodorov", lead.Source);
        Assert.True((await db.Questions.SingleAsync()).LeadCreated);
    }

    [Fact]
    public void The_source_stamp_fits_its_column_for_the_longest_slug_the_registry_admits()
    {
        // Lead.Source is MaxLength(60) and a slug may be 40 characters: the prefix has to
        // leave room, or the first long slug would surface as a SqlException on a form that
        // already said thank you.
        var longest = new string('a', 40);
        var env = Config(("REPRESENTATIVES", $"{longest}=long@nvc-home4you.eu"));

        var source = RepresentativeIntake.SourceFor(env.FindRepresentativeBySlug(longest)!);

        Assert.StartsWith("Представител: ", source);
        Assert.True(source.Length <= 60, $"{source.Length} characters would not fit Lead.Source");
    }

    // --- The deliberate refusals ---------------------------------------------------------

    [Theory]
    [InlineData("asdf")]
    [InlineData("ivan@")]
    [InlineData("Ivan <ivan@example.com>")]
    [InlineData("")]
    [InlineData(null)]
    public async Task An_address_no_mail_server_would_accept_leaves_the_enquiry_in_the_queue(string? email)
    {
        // The strict rule, because a lead is a relationship that gets written to, and one on
        // "asdf" is a row nobody can ever contact. The enquiry itself still exists with the
        // rep's line in it; it simply waits for a person.
        using var db = NewDb();
        var env = SqlLeads();
        var offerId = await SeedOffer(db, email: email);

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, offerId, Rep(env), email, null, CancellationToken.None);

        Assert.False(outcome.LeadCreated);
        Assert.Equal("invalid-email", outcome.SkippedBecause);
        Assert.Null(outcome.LeadId);
        Assert.Equal(0, await db.Leads.CountAsync());
        Assert.False((await db.Offers.SingleAsync()).LeadCreated);
    }

    [Fact]
    public async Task Under_quickbase_the_record_id_is_not_ours_to_promote()
    {
        // With Quickbase authoritative the id the controller holds is a Quickbase record id,
        // and promoting whichever SQL row shares the number would hand a stranger's enquiry
        // to the representative. Both halves of "not SQL": the flag unset, and no database.
        using var db = NewDb();
        var offerId = await SeedOffer(db);

        foreach (var env in new[]
                 {
                     Config(("SQL_CONNECTION_STRING", Conn), ("REPRESENTATIVES", Registry)),
                     Config(("REPRESENTATIVES", Registry)),
                 })
        {
            var outcome = await Intake(db, env).TryPromoteAsync(
                LeadAdminService.KindOffer, offerId, Rep(env), "ivan@example.com", null, CancellationToken.None);

            Assert.False(outcome.LeadCreated);
            Assert.Equal("leads-not-sql", outcome.SkippedBecause);
        }

        Assert.Equal(0, await db.Leads.CountAsync());
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0L)]
    [InlineData(-1L)]
    [InlineData(long.MaxValue)]
    public async Task A_record_id_that_cannot_name_a_row_is_skipped(long? recordId)
    {
        using var db = NewDb();
        var env = SqlLeads();

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, recordId, Rep(env), "ivan@example.com", null, CancellationToken.None);

        Assert.False(outcome.LeadCreated);
        Assert.Equal("no-record-id", outcome.SkippedBecause);
    }

    [Fact]
    public async Task An_enquiry_that_is_not_in_the_table_is_reported_rather_than_invented()
    {
        using var db = NewDb();
        var env = SqlLeads();

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, 999, Rep(env), "ivan@example.com", null, CancellationToken.None);

        Assert.False(outcome.LeadCreated);
        Assert.Equal("enquiry-not-found", outcome.SkippedBecause);
        Assert.Equal(0, await db.Leads.CountAsync());
    }

    [Fact]
    public async Task The_same_enquiry_arriving_twice_keeps_the_first_lead_and_its_owner()
    {
        // A retried POST. The unique index already forbids a second lead on one enquiry;
        // this pins that the intake reports it as "already there" rather than as a new lead
        // the mail would then announce — and that it does not steal the lead from whoever
        // promoted it first.
        using var db = NewDb();
        var env = SqlLeads();
        var offerId = await SeedOffer(db);
        var bySales = await new LeadService(db).PromoteAsync(LeadAdminService.KindOffer, offerId, "sales@nvc-home4you.eu");

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, offerId, Rep(env), "ivan@example.com", null, CancellationToken.None);

        Assert.False(outcome.LeadCreated);
        Assert.Equal("already-promoted", outcome.SkippedBecause);
        Assert.Equal(bySales.Lead!.Id, outcome.LeadId);
        Assert.Equal(1, await db.Leads.CountAsync());
        Assert.Equal("sales@nvc-home4you.eu", (await db.Leads.SingleAsync()).OwnerUpn);
    }

    // --- A customer who is already here -----------------------------------------------

    [Fact]
    public async Task An_open_lead_on_the_same_address_is_named_rather_than_merged()
    {
        // The owner's decision, and the same one LeadDuplicateService makes: two leads for one
        // customer need a person to choose which survives. So the rep's lead is still made,
        // and the older one is named where that person will look — the thread and the mail.
        using var db = NewDb();
        var env = SqlLeads();
        db.Leads.Add(OpenLead(email: "IVAN@EXAMPLE.COM", owner: "maria@nvc-home4you.eu"));   // case differs
        await db.SaveChangesAsync();
        var existingId = db.Leads.Single().Id;
        var offerId = await SeedOffer(db);

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, offerId, Rep(env), "ivan@example.com", "+359 88 123 4567", CancellationToken.None);

        Assert.True(outcome.LeadCreated);
        Assert.Equal(existingId, outcome.DuplicateOfLeadId);
        Assert.Equal("maria@nvc-home4you.eu", outcome.DuplicateOwnerUpn);
        Assert.Equal(2, await db.Leads.CountAsync());

        var created = await db.Leads.Include(l => l.Activities).SingleAsync(l => l.Id == outcome.LeadId);
        Assert.Equal(RepUpn, created.OwnerUpn);

        // App-written, like the owner and status lines: StatusChange, no actor. Not a Note,
        // which the panel offers as something a person files.
        var warning = Assert.Single(created.Activities, a => a.Type == LeadActivityTypes.StatusChange);
        Assert.Null(warning.ActorUpn);
        Assert.Equal(
            $"Възможен дубликат: лийд #{existingId} (отговорник: maria@nvc-home4you.eu). Създаден от линк на представител dtodorov.",
            warning.Body);

        // The customer's words still open the thread; the warning comes after them.
        Assert.Equal(LeadActivityTypes.EmailIn, created.Activities.OrderBy(a => a.OccurredAt).First().Type);
    }

    [Fact]
    public async Task The_same_phone_written_differently_is_a_duplicate_too_and_an_unowned_one_says_so()
    {
        // +359 88 123 4567 and 0888 123 4567 are one number; the CRM holds both spellings.
        using var db = NewDb();
        var env = SqlLeads();
        db.Leads.Add(OpenLead(phone: "0888 123 4567", owner: null));
        await db.SaveChangesAsync();
        var existingId = db.Leads.Single().Id;
        var offerId = await SeedOffer(db, email: "other@example.com", phone: "+359 88 123 4567");

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, offerId, Rep(env), "other@example.com", "+359 88 123 4567", CancellationToken.None);

        Assert.True(outcome.LeadCreated);
        Assert.Equal(existingId, outcome.DuplicateOfLeadId);
        Assert.Null(outcome.DuplicateOwnerUpn);

        var warning = await db.LeadActivities.SingleAsync(a => a.Type == LeadActivityTypes.StatusChange);
        Assert.Contains("(отговорник: никой)", warning.Body);
    }

    [Fact]
    public async Task A_closed_lead_is_a_new_conversation_not_a_duplicate()
    {
        // A customer who was Lost last year and comes back through a representative.
        using var db = NewDb();
        var env = SqlLeads();
        db.Leads.Add(OpenLead(email: "ivan@example.com", owner: "maria@nvc-home4you.eu", status: LeadStatuses.Lost));
        await db.SaveChangesAsync();
        var offerId = await SeedOffer(db);

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, offerId, Rep(env), "ivan@example.com", null, CancellationToken.None);

        Assert.True(outcome.LeadCreated);
        Assert.Null(outcome.DuplicateOfLeadId);
        Assert.Null(outcome.DuplicateOwnerUpn);
        Assert.Equal(0, await db.LeadActivities.CountAsync(a => a.Type == LeadActivityTypes.StatusChange));
    }

    [Fact]
    public async Task The_most_recently_worked_open_lead_is_the_one_named()
    {
        // Two old open rows for one customer: the warning should point at the one somebody
        // is actually working, not the oldest.
        using var db = NewDb();
        var env = SqlLeads();
        var stale = OpenLead(email: "ivan@example.com", owner: "old@nvc-home4you.eu");
        stale.LastActivityAt = DateTimeOffset.UtcNow.AddDays(-200);
        var worked = OpenLead(email: "ivan@example.com", owner: "maria@nvc-home4you.eu");
        worked.LastActivityAt = DateTimeOffset.UtcNow.AddDays(-1);
        db.Leads.AddRange(stale, worked);
        await db.SaveChangesAsync();
        var offerId = await SeedOffer(db);

        var outcome = await Intake(db, env).TryPromoteAsync(
            LeadAdminService.KindOffer, offerId, Rep(env), "ivan@example.com", null, CancellationToken.None);

        Assert.Equal(worked.Id, outcome.DuplicateOfLeadId);
        Assert.Equal("maria@nvc-home4you.eu", outcome.DuplicateOwnerUpn);
    }

    // --- Nothing escapes ---------------------------------------------------------------

    [Fact]
    public async Task A_failure_inside_is_an_outcome_not_an_exception()
    {
        // The customer has been thanked and the enquiry is stored with the rep's name in
        // it; the worst case is a lead somebody promotes by hand tomorrow. A thrown exception
        // would turn that into a 500 on a form that already succeeded. A disposed context is
        // the cheapest way to make every database call throw.
        var db = NewDb();
        var env = SqlLeads();
        var offerId = await SeedOffer(db);
        var intake = Intake(db, env);
        db.Dispose();

        var outcome = await intake.TryPromoteAsync(
            LeadAdminService.KindOffer, offerId, Rep(env), "ivan@example.com", null, CancellationToken.None);

        Assert.False(outcome.LeadCreated);
        Assert.Equal("error", outcome.SkippedBecause);
        Assert.Null(outcome.LeadId);
    }

    [Fact]
    public async Task Without_a_database_the_stand_in_says_so_and_throws_nothing()
    {
        // Registered when SQL is not configured so the public form controllers still
        // construct; the enquiry lands in Quickbase with the rep's line in its message.
        var env = Config(("REPRESENTATIVES", Registry));

        var outcome = await new NullRepresentativeIntake().TryPromoteAsync(
            LeadAdminService.KindOffer, 1, Rep(env), "ivan@example.com", null, CancellationToken.None);

        Assert.False(outcome.LeadCreated);
        Assert.Equal("sql-not-configured", outcome.SkippedBecause);
    }
}
