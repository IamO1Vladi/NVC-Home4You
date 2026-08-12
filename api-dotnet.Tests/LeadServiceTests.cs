using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The relationship layer: turning an enquiry into a lead, and keeping the thread honest.
//
// What is worth testing here is not that EF saves rows. It is the handful of decisions that
// are expensive to get wrong and invisible when they are: a lead attached to the wrong
// house, a thread that starts with our voice instead of the customer's, a double-click that
// splits one conversation into two, and a late-logged call that makes an active lead look
// abandoned.
public class LeadServiceTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"leadsvc-{Guid.NewGuid()}")
            .Options);

    // --- Promotion ------------------------------------------------------------------

    [Fact]
    public async Task Promoting_an_offer_carries_the_enquiry_across_and_opens_the_thread()
    {
        using var db = NewDb();
        var enquiredAt = DateTimeOffset.UtcNow.AddDays(-9);
        db.Offers.Add(new Offer
        {
            Id = 1,
            Name = "Ivan Petrov",
            Email = "ivan@example.com",
            Phone = "+359 88 123 4567",
            Message = "Interested in a 60m² modular house for a plot near Plovdiv.",
            Locale = "bg",
            CreatedAt = enquiredAt,
        });
        await db.SaveChangesAsync();

        var result = await new LeadService(db).PromoteAsync("offer", 1, "sales@nvc-home4you.eu");

        Assert.Equal(LeadService.PromotionOutcome.Created, result.Outcome);
        var lead = result.Lead!;
        Assert.Equal("Ivan Petrov", lead.Name);
        Assert.Equal("ivan@example.com", lead.Email);
        Assert.Equal("+359 88 123 4567", lead.Phone);
        Assert.Equal("bg", lead.Locale);
        Assert.Equal(LeadStatuses.New, lead.Status);
        Assert.Equal(1, lead.OfferId);
        Assert.Null(lead.QuestionId);

        // The customer's own words open the history, attributed to them.
        var opening = Assert.Single(lead.Activities);
        Assert.Equal(LeadActivityTypes.EmailIn, opening.Type);
        Assert.Contains("Plovdiv", opening.Body);
        Assert.Null(opening.ActorUpn);          // null actor == the customer
    }

    [Fact]
    public async Task A_lead_is_dated_from_when_the_customer_asked_not_when_sales_opened_it()
    {
        // Otherwise every lead looks brand new on the day it was promoted, and "how long did
        // we sit on this?" stops being answerable — which is the one thing the queue exists
        // to show.
        using var db = NewDb();
        var threeWeeksAgo = DateTimeOffset.UtcNow.AddDays(-21);
        db.Offers.Add(new Offer { Id = 1, Name = "Old", Message = "Hello", CreatedAt = threeWeeksAgo });
        await db.SaveChangesAsync();

        var lead = (await new LeadService(db).PromoteAsync("offer", 1, "s@x.eu")).Lead!;

        Assert.Equal(threeWeeksAgo, lead.CreatedAt);
        Assert.Equal(threeWeeksAgo, lead.LastActivityAt);
    }

    [Fact]
    public async Task Promoting_the_same_enquiry_twice_returns_the_first_lead()
    {
        // A double-clicked button must not split one conversation into two leads, each
        // collecting half the history.
        using var db = NewDb();
        db.Offers.Add(new Offer { Id = 1, Name = "Ivan", Message = "Hi" });
        await db.SaveChangesAsync();
        var svc = new LeadService(db);

        var first = await svc.PromoteAsync("offer", 1, "a@x.eu");
        var second = await svc.PromoteAsync("offer", 1, "b@x.eu");

        Assert.Equal(LeadService.PromotionOutcome.Created, first.Outcome);
        Assert.Equal(LeadService.PromotionOutcome.AlreadyExisted, second.Outcome);
        Assert.Equal(first.Lead!.Id, second.Lead!.Id);
        Assert.Equal(1, await db.Leads.CountAsync());
        Assert.Equal("a@x.eu", second.Lead.OwnerUpn);   // the second promoter did not steal it
    }

    [Fact]
    public async Task Promoting_marks_the_enquiry_so_the_queue_stops_offering_it()
    {
        // LeadCreated was a hand-ticked Quickbase checkbox meaning exactly this. Promotion
        // is what makes it automatic.
        using var db = NewDb();
        db.Offers.Add(new Offer { Id = 1, Name = "Ivan", Message = "Hi", LeadCreated = false });
        await db.SaveChangesAsync();

        await new LeadService(db).PromoteAsync("offer", 1, "s@x.eu");

        var offer = await db.Offers.SingleAsync();
        Assert.True(offer.LeadCreated);
        Assert.NotNull(offer.UpdatedAt);
    }

    [Fact]
    public async Task A_question_becomes_a_lead_without_inventing_a_phone_or_a_model()
    {
        // The question form collects neither; empty strings would claim the customer left
        // them blank rather than never being asked.
        using var db = NewDb();
        db.Questions.Add(new Question { Id = 1, Name = "Maria", Email = "m@x.com", Message = "Do you deliver to Greece?", Locale = "el" });
        await db.SaveChangesAsync();

        var lead = (await new LeadService(db).PromoteAsync("question", 1, "s@x.eu")).Lead!;

        Assert.Equal(1, lead.QuestionId);
        Assert.Null(lead.OfferId);
        Assert.Null(lead.Phone);
        Assert.Null(lead.HouseId);
        Assert.Null(lead.CustomModel);
        Assert.Equal("el", lead.Locale);
    }

    [Fact]
    public async Task An_offer_and_a_question_with_the_same_id_promote_to_different_leads()
    {
        // The two id sequences overlap; kind is what tells them apart.
        using var db = NewDb();
        db.Offers.Add(new Offer { Id = 1, Name = "The offer", Message = "A" });
        db.Questions.Add(new Question { Id = 1, Name = "The question", Message = "B" });
        await db.SaveChangesAsync();
        var svc = new LeadService(db);

        var fromOffer = (await svc.PromoteAsync("offer", 1, "s@x.eu")).Lead!;
        var fromQuestion = (await svc.PromoteAsync("question", 1, "s@x.eu")).Lead!;

        Assert.NotEqual(fromOffer.Id, fromQuestion.Id);
        Assert.Equal("The offer", fromOffer.Name);
        Assert.Equal("The question", fromQuestion.Name);
    }

    [Fact]
    public async Task Promoting_something_that_does_not_exist_reports_failure()
    {
        using var db = NewDb();
        var svc = new LeadService(db);

        Assert.Equal(LeadService.PromotionOutcome.NotFound, (await svc.PromoteAsync("offer", 999, null)).Outcome);
        Assert.Equal(LeadService.PromotionOutcome.NotFound, (await svc.PromoteAsync("wombat", 1, null)).Outcome);
    }

    [Fact]
    public async Task An_enquiry_with_no_message_still_becomes_a_lead_with_an_empty_thread()
    {
        // A blank message is not a reason to refuse the lead — the phone number is the point.
        using var db = NewDb();
        db.Offers.Add(new Offer { Id = 1, Name = "Ivan", Phone = "+359", Message = null });
        await db.SaveChangesAsync();

        var lead = (await new LeadService(db).PromoteAsync("offer", 1, "s@x.eu")).Lead!;

        Assert.Empty(lead.Activities);
        Assert.Null(lead.LastActivityAt);
    }

    // --- The model split: a real FK, or free text -------------------------------------

    [Fact]
    public async Task A_gallery_enquiry_links_to_the_house_by_its_public_quickbase_id()
    {
        // SqlGalleryService serves a house's public id as `QuickbaseRecordId ?? Id`, so the
        // model id an offer carries is the QUICKBASE id for any imported house. Matching on
        // the SQL primary key instead would attach the lead to a different building.
        using var db = NewDb();
        db.Houses.AddRange(
            new House { Id = 7, QuickbaseRecordId = 42, Title = "Nova 60", CategoryKey = HouseCategories.Modular },
            new House { Id = 42, QuickbaseRecordId = 99, Title = "Wrong house", CategoryKey = HouseCategories.Prefab });
        db.Offers.Add(new Offer { Id = 1, Name = "Ivan", Message = "This one please", ModelId = "42" });
        await db.SaveChangesAsync();

        var lead = (await new LeadService(db).PromoteAsync("offer", 1, "s@x.eu")).Lead!;

        Assert.Equal(7, lead.HouseId);      // the house whose PUBLIC id is 42
    }

    [Fact]
    public async Task An_admin_created_house_is_matched_by_its_sql_id_because_that_is_what_the_gallery_serves()
    {
        // Houses created in the admin panel have no Quickbase id, so the gallery addresses
        // them by SQL id — and only those.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 5, QuickbaseRecordId = null, Title = "Studio", CategoryKey = HouseCategories.Prefab });
        db.Offers.Add(new Offer { Id = 1, Name = "Ivan", Message = "Hi", ModelId = "5" });
        await db.SaveChangesAsync();

        var lead = (await new LeadService(db).PromoteAsync("offer", 1, "s@x.eu")).Lead!;

        Assert.Equal(5, lead.HouseId);
    }

    [Fact]
    public async Task A_sql_id_that_belongs_to_an_imported_house_is_not_matched()
    {
        // House 5 has a Quickbase id, so the gallery never addresses it as "5". An offer
        // carrying "5" means some other house — or none. Guessing would be worse than null.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 5, QuickbaseRecordId = 300, Title = "Imported", CategoryKey = HouseCategories.Prefab });
        db.Offers.Add(new Offer { Id = 1, Name = "Ivan", Message = "Hi", ModelId = "5" });
        await db.SaveChangesAsync();

        var lead = (await new LeadService(db).PromoteAsync("offer", 1, "s@x.eu")).Lead!;

        Assert.Null(lead.HouseId);
    }

    [Fact]
    public async Task A_configurator_enquiry_has_no_model_id_and_links_to_no_house()
    {
        // The configurator deliberately sends no modelId — its models are square metres,
        // not catalogue records. The chosen configuration is named in the message instead.
        using var db = NewDb();
        db.Offers.Add(new Offer { Id = 1, Name = "Ivan", Message = "Box house 37m², balcony variant", ModelId = null });
        await db.SaveChangesAsync();

        var lead = (await new LeadService(db).PromoteAsync("offer", 1, "s@x.eu")).Lead!;

        Assert.Null(lead.HouseId);
        Assert.Contains("37m²", lead.Activities.Single().Body);
    }

    [Fact]
    public async Task A_model_id_too_large_for_a_sql_key_does_not_wrap_onto_a_real_house()
    {
        // An unchecked cast from long to int wraps, and a wrapped value can land on a real,
        // unrelated house.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 1, QuickbaseRecordId = null, Title = "Real house", CategoryKey = HouseCategories.Prefab });
        db.Offers.Add(new Offer { Id = 1, Name = "Ivan", Message = "Hi", ModelId = "4294967297" });   // 2^32 + 1 -> wraps to 1
        await db.SaveChangesAsync();

        var lead = (await new LeadService(db).PromoteAsync("offer", 1, "s@x.eu")).Lead!;

        Assert.Null(lead.HouseId);
    }

    [Fact]
    public async Task A_lead_can_hold_a_catalogue_model_and_a_custom_one_at_once()
    {
        // "The Nova 60, but 2m longer" is a real enquiry, and Quickbase's single combined
        // field is what made that unrepresentable.
        using var db = NewDb();
        db.Houses.Add(new House { Id = 3, Title = "Nova 60", CategoryKey = HouseCategories.Modular });
        await db.SaveChangesAsync();

        var lead = await new LeadService(db).CreateAsync(new Lead
        {
            Name = "Georgi",
            HouseId = 3,
            CustomModel = "Nova 60 stretched by 2m, extra window on the south wall",
        });

        var saved = await db.Leads.SingleAsync(l => l.Id == lead.Id);
        Assert.Equal(3, saved.HouseId);
        Assert.Contains("stretched", saved.CustomModel);
    }

    // --- Cold-call leads --------------------------------------------------------------

    [Fact]
    public async Task A_lead_can_exist_with_no_website_origin_at_all()
    {
        // The phone call and the trade fair. Requiring an origin would mean fabricating an
        // offer to hold a real customer.
        using var db = NewDb();

        var lead = await new LeadService(db).CreateAsync(new Lead
        {
            Name = "Trade fair contact",
            Phone = "+359 88 000 0000",
            CustomModel = "Two-bedroom modular, ~80m²",
            Country = "Bulgaria",
        });

        Assert.Null(lead.OfferId);
        Assert.Null(lead.QuestionId);
        Assert.Equal(LeadStatuses.New, lead.Status);
    }

    [Fact]
    public async Task Several_cold_call_leads_can_coexist()
    {
        // The unique indexes on the origin ids are filtered precisely so a second lead with
        // no origin is not a constraint violation. In-memory does not enforce the filter, so
        // this documents the intent that the migration encodes.
        using var db = NewDb();
        var svc = new LeadService(db);

        await svc.CreateAsync(new Lead { Name = "First" });
        await svc.CreateAsync(new Lead { Name = "Second" });

        Assert.Equal(2, await db.Leads.CountAsync());
    }

    [Fact]
    public async Task A_lead_created_with_a_nonsense_status_falls_back_to_new()
    {
        using var db = NewDb();

        var lead = await new LeadService(db).CreateAsync(new Lead { Name = "X", Status = "wombat" });

        Assert.Equal(LeadStatuses.New, lead.Status);
    }

    // --- The thread -------------------------------------------------------------------

    [Fact]
    public async Task Logging_a_call_appends_to_the_thread_and_marks_the_lead_active()
    {
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        var activity = await svc.AddActivityAsync(
            lead.Id, LeadActivityTypes.Call, null, "Talked through delivery to the plot.", "sales@nvc-home4you.eu");

        Assert.NotNull(activity);
        var saved = await db.Leads.SingleAsync(l => l.Id == lead.Id);
        Assert.NotNull(saved.LastActivityAt);
        Assert.NotNull(saved.UpdatedAt);
    }

    [Fact]
    public async Task A_call_logged_late_does_not_drag_the_lead_back_up_the_quiet_list()
    {
        // The pipeline sorts on "quietest first". A call typed in this morning but dated to
        // last week must not make a lead we spoke to yesterday look neglected.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        var yesterday = DateTimeOffset.UtcNow.AddDays(-1);
        var lastWeek = DateTimeOffset.UtcNow.AddDays(-7);
        await svc.AddActivityAsync(lead.Id, LeadActivityTypes.Call, null, "Recent call", "s@x.eu", occurredAt: yesterday);
        await svc.AddActivityAsync(lead.Id, LeadActivityTypes.Note, null, "Forgot to log this one", "s@x.eu", occurredAt: lastWeek);

        var saved = await db.Leads.SingleAsync(l => l.Id == lead.Id);
        Assert.Equal(yesterday, saved.LastActivityAt);   // not dragged back to last week
    }

    [Fact]
    public async Task The_thread_reads_oldest_first()
    {
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        await svc.AddActivityAsync(lead.Id, LeadActivityTypes.Note, null, "Third", "s@x.eu", occurredAt: DateTimeOffset.UtcNow.AddDays(-1));
        await svc.AddActivityAsync(lead.Id, LeadActivityTypes.Note, null, "First", "s@x.eu", occurredAt: DateTimeOffset.UtcNow.AddDays(-9));
        await svc.AddActivityAsync(lead.Id, LeadActivityTypes.Note, null, "Second", "s@x.eu", occurredAt: DateTimeOffset.UtcNow.AddDays(-5));

        var loaded = await svc.GetAsync(lead.Id);

        Assert.Equal(new[] { "First", "Second", "Third" }, loaded!.Activities.Select(a => a.Body).ToArray());
    }

    [Fact]
    public async Task An_outbound_email_stores_the_conversation_id_so_replies_can_find_it_later()
    {
        // Free to store on the way out, impossible to reconstruct afterwards. Without it a
        // thread sent today can never be matched to the reply that arrives tomorrow.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        await svc.AddActivityAsync(
            lead.Id, LeadActivityTypes.EmailOut, "Your quote", "Please find attached…", "sales@nvc-home4you.eu",
            conversationId: "AAQkAGI2...");

        var saved = await db.LeadActivities.SingleAsync();
        Assert.Equal("AAQkAGI2...", saved.ConversationId);
    }

    [Fact]
    public async Task An_activity_on_a_missing_lead_is_refused_rather_than_orphaned()
    {
        using var db = NewDb();

        var result = await new LeadService(db).AddActivityAsync(999, LeadActivityTypes.Note, null, "Hi", "s@x.eu");

        Assert.Null(result);
        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }

    [Fact]
    public async Task An_unknown_activity_type_is_refused()
    {
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        Assert.Null(await svc.AddActivityAsync(lead.Id, "carrier_pigeon", null, "Hi", "s@x.eu"));
        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }

    // --- Status ------------------------------------------------------------------------

    [Fact]
    public async Task Moving_the_status_records_both_ends_in_the_thread()
    {
        // "Moved to Quoted" alone loses whether that was progress or a lead falling back.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        var ok = await svc.SetStatusAsync(lead.Id, LeadStatuses.Quoted, "sales@nvc-home4you.eu");

        Assert.True(ok);
        Assert.Equal(LeadStatuses.Quoted, (await db.Leads.SingleAsync()).Status);
        var entry = await db.LeadActivities.SingleAsync();
        Assert.Equal(LeadActivityTypes.StatusChange, entry.Type);
        Assert.Equal("new → quoted", entry.Body);
        Assert.Equal("sales@nvc-home4you.eu", entry.ActorUpn);
    }

    [Fact]
    public async Task Re_saving_the_status_it_already_has_is_not_an_event()
    {
        // A detail page that posts the whole form on every save would otherwise fill the
        // thread with "moved to Quoted" from Quoted.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan", Status = LeadStatuses.Quoted });

        var ok = await svc.SetStatusAsync(lead.Id, LeadStatuses.Quoted, "s@x.eu");

        Assert.True(ok);
        Assert.Equal(0, await db.LeadActivities.CountAsync());
    }

    [Fact]
    public async Task An_invalid_status_is_refused_rather_than_stored()
    {
        // Nothing in SQL enforces the ladder, so this is the only thing that does. A status
        // outside the set makes a lead invisible in every pipeline column.
        using var db = NewDb();
        var svc = new LeadService(db);
        var lead = await svc.CreateAsync(new Lead { Name = "Ivan" });

        Assert.False(await svc.SetStatusAsync(lead.Id, "nearly_won", "s@x.eu"));
        Assert.Equal(LeadStatuses.New, (await db.Leads.SingleAsync()).Status);
    }

    [Fact]
    public void Won_and_lost_are_both_terminal_and_neither_counts_as_open()
    {
        Assert.True(LeadStatuses.IsOpen(LeadStatuses.Negotiating));
        Assert.False(LeadStatuses.IsOpen(LeadStatuses.Won));
        Assert.False(LeadStatuses.IsOpen(LeadStatuses.Lost));
        Assert.True(LeadStatuses.IsValid(LeadStatuses.Lost));
    }

    [Fact]
    public void A_status_row_cannot_be_filed_by_hand()
    {
        // The app writes it as a side effect of a real status change; letting someone post
        // one directly would put a claim in the history the Status column does not back up.
        Assert.True(LeadActivityTypes.IsValid(LeadActivityTypes.StatusChange));
        Assert.False(LeadActivityTypes.IsManuallyLoggable(LeadActivityTypes.StatusChange));
        Assert.True(LeadActivityTypes.IsManuallyLoggable(LeadActivityTypes.Call));
    }
}
