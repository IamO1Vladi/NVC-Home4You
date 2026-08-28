using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Data;

// The SQL side of the Quickbase -> Azure SQL migration. Entities are added one table at
// a time; nothing here is read by the site until the matching DATA_SOURCE_* flag is set
// to "sql" (see EnvConfig.DataSourceFor).
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<House> Houses => Set<House>();
    public DbSet<HouseImage> HouseImages => Set<HouseImage>();
    public DbSet<Case> Cases => Set<Case>();
    public DbSet<CaseImage> CaseImages => Set<CaseImage>();
    public DbSet<Offer> Offers => Set<Offer>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadActivity> LeadActivities => Set<LeadActivity>();
    public DbSet<LeadAttachment> LeadAttachments => Set<LeadAttachment>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Factory> Factories => Set<Factory>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<PurchaseFile> PurchaseFiles => Set<PurchaseFile>();
    public DbSet<OrderStatusEvent> OrderStatusEvents => Set<OrderStatusEvent>();
    public DbSet<SavedConfig> SavedConfigs => Set<SavedConfig>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();
    public DbSet<FactorySheet> FactorySheets => Set<FactorySheet>();
    public DbSet<PublicDocument> PublicDocuments => Set<PublicDocument>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AuditEntry>(e =>
        {
            // The two questions the log is asked, and nothing else: "what happened to THIS
            // record" and "what happened recently". Both are covered by an index because
            // this table only grows, and the second one is the panel's default view.
            e.HasIndex(a => new { a.EntityType, a.EntityId, a.OccurredAt });
            e.HasIndex(a => a.OccurredAt);

            // No foreign keys, on purpose. An audit entry outlives the row it describes —
            // the entry saying a customer was DELETED is the one that matters most, and a
            // foreign key would either forbid the delete or cascade the evidence away.
        });

        b.Entity<House>(e =>
        {
            // The gallery reads published rows in sort order; that pair is the whole query.
            e.HasIndex(h => new { h.IsPublished, h.SortOrder });

            // Same idempotent-import guarantee as Review: unique where present, so admin-
            // created houses (which have no Quickbase id) are not forced to collide on null.
            e.HasIndex(h => h.QuickbaseRecordId)
             .IsUnique()
             .HasFilter("[QuickbaseRecordId] IS NOT NULL");

            e.Property(h => h.Price).HasPrecision(18, 2);
        });

        b.Entity<HouseImage>(e =>
        {
            e.HasOne(i => i.House)
             .WithMany(h => h.Images)
             .HasForeignKey(i => i.HouseId)
             // Deleting a house through the admin panel should take its image rows with it.
             // The blob objects are a separate concern — see GalleryAdminService, which
             // deletes rows but deliberately leaves the bytes.
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(i => new { i.HouseId, i.SortOrder });

            // The same Quickbase attachment must not be imported onto one house twice; a
            // re-run of the importer would otherwise duplicate every image.
            //
            // Filtered because SQL Server treats NULLs as equal in a unique index, so without
            // it a house could hold only ONE admin-uploaded image (they all have a null
            // SourceKey) — the second insert would fail with a constraint violation.
            e.HasIndex(i => new { i.HouseId, i.SourceKey })
             .IsUnique()
             .HasFilter("[SourceKey] IS NOT NULL");
        });

        b.Entity<Case>(e =>
        {
            // The cases page reads published rows in sort order, and pulls featured ones out
            // for the top of the page.
            e.HasIndex(c => new { c.IsPublished, c.SortOrder });
            e.HasIndex(c => new { c.IsPublished, c.Featured });

            e.HasIndex(c => c.QuickbaseRecordId)
             .IsUnique()
             .HasFilter("[QuickbaseRecordId] IS NOT NULL");
        });

        b.Entity<CaseImage>(e =>
        {
            e.HasOne(i => i.Case)
             .WithMany(c => c.Images)
             .HasForeignKey(i => i.CaseId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(i => new { i.CaseId, i.SortOrder });

            // Same guarantee, and the same NULL-filter reason, as HouseImage.
            e.HasIndex(i => new { i.CaseId, i.SourceKey })
             .IsUnique()
             .HasFilter("[SourceKey] IS NOT NULL");

            e.HasIndex(i => i.QuickbaseRecordId)
             .IsUnique()
             .HasFilter("[QuickbaseRecordId] IS NOT NULL");
        });

        // Leads. Both tables get the same treatment, and it differs from the content
        // tables in one way that matters: the natural query is "newest first", because a
        // lead list is a work queue rather than a catalogue.
        b.Entity<Offer>(e =>
        {
            e.HasIndex(o => o.CreatedAt);

            // Sales filters on "not yet contacted", which is the whole point of the flag.
            e.HasIndex(o => new { o.ReachedOut, o.CreatedAt });

            // Filtered to the archived rows, because they are the minority and the only
            // query that wants them asks for exactly them. The working queue's extra
            // "and not archived" predicate rides on the index above.
            e.HasIndex(o => o.ArchivedAt).HasFilter("[ArchivedAt] IS NOT NULL");

            // Same idempotent-import guarantee as everywhere else: unique where present,
            // filtered so rows created natively in SQL (which have no Quickbase id) do
            // not all collide on NULL.
            e.HasIndex(o => o.QuickbaseRecordId)
             .IsUnique()
             .HasFilter("[QuickbaseRecordId] IS NOT NULL");
        });

        b.Entity<Question>(e =>
        {
            e.HasIndex(q => q.CreatedAt);
            e.HasIndex(q => new { q.ReachedOut, q.CreatedAt });
            e.HasIndex(q => q.ArchivedAt).HasFilter("[ArchivedAt] IS NOT NULL");

            e.HasIndex(q => q.QuickbaseRecordId)
             .IsUnique()
             .HasFilter("[QuickbaseRecordId] IS NOT NULL");
        });

        b.Entity<Lead>(e =>
        {
            // The pipeline view groups by status and sorts within it; the owner filter
            // ("mine") is the other thing sales does every day.
            e.HasIndex(l => new { l.Status, l.LastActivityAt });
            e.HasIndex(l => new { l.OwnerUpn, l.Status });

            // The overdue report: "which leads were due before now?". Filtered because
            // most leads carry no follow-up date at all, and an index over a column that
            // is mostly NULL is mostly wasted pages.
            e.HasIndex(l => l.NextContactAt).HasFilter("[NextContactAt] IS NOT NULL");

            // What makes the CRM import re-runnable. Same filtered-unique shape as every
            // other imported table: unique where present, so leads created in the panel
            // (which have no Quickbase id) do not all collide on NULL.
            e.HasIndex(l => l.QuickbaseRecordId)
             .IsUnique()
             .HasFilter("[QuickbaseRecordId] IS NOT NULL");

            // One enquiry produces at most one lead. Without this, a double-clicked
            // "create lead" button quietly makes two, and the second one starts collecting
            // its own half of the conversation — the kind of split history nobody notices
            // until they are looking at a thread with pieces missing.
            //
            // Filtered for the usual reason: SQL Server treats NULLs as equal in a unique
            // index, so an unfiltered one would allow exactly ONE lead with no offer
            // origin, and every cold-call lead after the first would fail to insert.
            e.HasIndex(l => l.OfferId)
             .IsUnique()
             .HasFilter("[OfferId] IS NOT NULL");

            e.HasIndex(l => l.QuestionId)
             .IsUnique()
             .HasFilter("[QuestionId] IS NOT NULL");

            // Restrict, not Cascade: deleting a house must not silently delete the sales
            // history of everyone who ever asked about it. A house that has leads against
            // it needs those repointed first, and the admin panel should say so rather
            // than the database taking the decision.
            e.HasOne(l => l.House)
             .WithMany()
             .HasForeignKey(l => l.HouseId)
             .OnDelete(DeleteBehavior.Restrict);

            // Same reasoning, more sharply: the offer is the evidence the lead exists at
            // all. SetNull would leave a lead claiming a website origin it can no longer
            // point at.
            e.HasOne(l => l.Offer)
             .WithMany()
             .HasForeignKey(l => l.OfferId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(l => l.Question)
             .WithMany()
             .HasForeignKey(l => l.QuestionId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<LeadActivity>(e =>
        {
            // Deleting a lead takes its thread with it — unlike the FKs above, the
            // activities have no meaning without the lead they hang off.
            e.HasOne(a => a.Lead)
             .WithMany(l => l.Activities)
             .HasForeignKey(a => a.LeadId)
             .OnDelete(DeleteBehavior.Cascade);

            // The thread, in order. Every read of this table is "one lead, oldest first".
            e.HasIndex(a => new { a.LeadId, a.OccurredAt });

            // How inbound mail will find its way home (phase 2). Not unique: every message
            // in a thread shares the conversation id — that is the entire point of it.
            e.HasIndex(a => a.ConversationId)
             .HasFilter("[ConversationId] IS NOT NULL");

            // One mailbox message becomes at most one activity. This is the constraint
            // the inbound poller leans on: it has no memory between runs, so a restart
            // replays whatever the mailbox still holds, and without this every replay
            // would duplicate the thread. Filtered because hand-logged notes have no
            // message id and must not all collide on NULL.
            e.HasIndex(a => a.ExternalMessageId)
             .IsUnique()
             .HasFilter("[ExternalMessageId] IS NOT NULL");
        });

        b.Entity<LeadAttachment>(e =>
        {
            // Cascade, like the thread itself: an attachment row has no meaning without
            // the message it hung off. The blob object is a separate concern and is
            // deliberately NOT deleted here — same decision as GalleryAdminService, which
            // removes rows and leaves the bytes.
            e.HasOne(a => a.Activity)
             .WithMany(x => x.Attachments)
             .HasForeignKey(a => a.LeadActivityId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(a => a.LeadActivityId);

            // One blob object backs exactly one attachment row, so a re-submitted upload
            // cannot quietly create a second row pointing at the same bytes — which would
            // make deleting one of them orphan the other.
            e.HasIndex(a => a.BlobKey).IsUnique();
        });

        // Customers, factories and what passed between them. The shape to keep in mind:
        // Customer and Factory never touch each other directly — Purchase is the join, and
        // it is where every transactional fact lives.
        b.Entity<Factory>(e =>
        {
            // The dropdown on a purchase: active suppliers, alphabetical. That pair is the
            // whole query, and it runs on every customer form that opens.
            e.HasIndex(f => new { f.IsActive, f.Name });

            // Two factories with the same name is a data-entry mistake every time — the
            // point of this table is one spelling per supplier — but it is NOT enforced in
            // the database. Two genuinely different suppliers can share a name across
            // countries, and a unique index would make that unrecordable. The admin service
            // warns on a duplicate name instead and lets a person decide.
        });

        b.Entity<Customer>(e =>
        {
            // The customer list is "most recent first", which is how a work list reads.
            e.HasIndex(c => c.CreatedAt);

            // Finding a company by its ЕИК is a real lookup — an accountant rings with a
            // number and no name. Filtered because most rows are individuals and carry
            // none, so an unfiltered index would be mostly empty pages.
            //
            // NOT unique, deliberately: one company legitimately appears twice if it buys
            // through two different branches, and more importantly a unique index here
            // turns a typo into a save that fails with no way to tell which existing row
            // it collided with. The panel warns on a duplicate instead.
            e.HasIndex(c => c.Eik).HasFilter("[Eik] IS NOT NULL");

            // NO INDEX ON PersonalId, on purpose. It is the most sensitive column in the
            // database and nothing in the app looks a customer up by ЕГН — it is written
            // onto an invoice and read back on one screen. An index would exist only to
            // make a query nobody should be running fast.

            // Restrict, not Cascade: deleting a lead must never take a paying customer with
            // it. Same decision as Lead.OfferId — the sales record outranks the tidy-up.
            e.HasOne(c => c.Lead)
             .WithMany()
             .HasForeignKey(c => c.LeadId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Purchase>(e =>
        {
            // Every read of this table is "one customer, their purchases, newest first".
            e.HasIndex(p => new { p.CustomerId, p.PurchasedAt });

            // "What have we bought from this factory?" — the question the factory table
            // exists to make askable.
            e.HasIndex(p => p.FactoryId).HasFilter("[FactoryId] IS NOT NULL");

            e.Property(p => p.DepositPaid).HasPrecision(18, 2);
            e.Property(p => p.FinalPrice).HasPrecision(18, 2);

            // Absorbed from the archived Sale table (2026-08-19).
            e.Property(p => p.PaymentFees).HasPrecision(18, 2);
            e.Property(p => p.TransportCost).HasPrecision(18, 2);
            e.Property(p => p.InstallationCost).HasPrecision(18, 2);
            e.Property(p => p.OtherCosts).HasPrecision(18, 2);

            // Order tracking (#27). THE constraint on the public side: two orders sharing a
            // reference means one customer opens another's tracking page. Unique rather
            // than merely indexed, so a collision fails the insert instead of silently
            // creating an ambiguity — the same guarantee, and the same reasoning, as
            // SavedConfig.Code. Filtered because most purchases never mint one.
            e.HasIndex(p => p.PublicReference)
             .IsUnique()
             .HasFilter("[PublicReference] IS NOT NULL");

            // The orders board reads "everything not yet delivered, soonest first".
            e.HasIndex(p => new { p.Status, p.ExpectedReadyAt });

            // Moving an order is a read-modify-write: OrderTrackingService reads the current
            // status, decides whether this is a REAL move, and only then appends a history
            // row. Two people pressing the next-step button on the same order — or one person
            // double-clicking it — each load the same old status, each conclude they are
            // moving it, and each append an event. The duplicate the append rule exists to
            // prevent gets written anyway, and the board then names the wrong person as the
            // one who moved it.
            //
            // Making Status the token puts it in the UPDATE's WHERE clause, so the second
            // write finds no row and throws instead of quietly winning. No column and no
            // schema change: the value already in the row is the version. A rowversion would
            // do the same job but would also make two unrelated edits to one purchase collide
            // on the customer's sheet, which is a different screen with a different problem.
            e.Property(p => p.Status).IsConcurrencyToken();

            // Cascade: a purchase has no meaning without the customer who made it, and
            // deleting a customer is already the deliberate, confirmed act (see
            // CustomerAdminService, which refuses to do it silently).
            e.HasOne(p => p.Customer)
             .WithMany(c => c.Purchases)
             .HasForeignKey(p => p.CustomerId)
             .OnDelete(DeleteBehavior.Cascade);

            // Restrict, and this is the constraint that makes the factory table worth
            // having. Cascade would delete a customer's purchase history because somebody
            // removed a supplier they no longer use; SetNull would leave a sale claiming a
            // factory it can no longer name. A factory with purchases against it is
            // deactivated, not deleted — the panel says so rather than the database
            // deciding.
            e.HasOne(p => p.Factory)
             .WithMany(f => f.Purchases)
             .HasForeignKey(p => p.FactoryId)
             .OnDelete(DeleteBehavior.Restrict);

            // Same reasoning as Lead.HouseId: deleting a house must not silently delete the
            // record of everyone who bought one.
            e.HasOne(p => p.House)
             .WithMany()
             .HasForeignKey(p => p.HouseId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<OrderStatusEvent>(e =>
        {
            // Cascade, and this is the one deletion the table permits: a history of an order
            // that no longer exists describes nothing. Same shape as LeadActivity hanging off
            // its lead — and, like it, the rows are otherwise never touched after insert.
            e.HasOne(x => x.Purchase)
             .WithMany()
             .HasForeignKey(x => x.PurchaseId)
             .OnDelete(DeleteBehavior.Cascade);

            // Every read of this table is "one order, in order" — the customer's timeline
            // oldest first, the board's "when was this last touched?" newest first. Both
            // walk this index; nothing queries it any other way.
            e.HasIndex(x => new { x.PurchaseId, x.ChangedAt });
        });

        b.Entity<PurchaseFile>(e =>
        {
            e.HasOne(f => f.Purchase)
             .WithMany(p => p.Files)
             .HasForeignKey(f => f.PurchaseId)
             .OnDelete(DeleteBehavior.Cascade);

            // The form renders four document slots — a проформа and a фактура for each of
            // the two payments — plus a bucket for everything else, so the read is always
            // "this purchase, grouped by kind".
            e.HasIndex(f => new { f.PurchaseId, f.Kind });

            // One blob object backs exactly one row, so a re-submitted upload cannot make a
            // second row over the same bytes — which would mean deleting one orphans the
            // other. Same guarantee as LeadAttachment.
            e.HasIndex(f => f.BlobKey).IsUnique();
        });

        b.Entity<SavedConfig>(e =>
        {
            // THE constraint on this table. Every read is "resolve this code", and two rows
            // sharing one means a customer's saved link opens somebody else's configuration.
            // Unique rather than merely indexed, so a collision fails the insert instead of
            // silently creating an ambiguity — SavedConfigService retries on collision, and
            // this is what makes that retry meaningful.
            e.HasIndex(c => c.Code).IsUnique();

            // Same idempotent-import guarantee as every other migrated table: unique where
            // present, filtered so configs saved natively in SQL (which have no Quickbase
            // id) do not all collide on NULL.
            e.HasIndex(c => c.QuickbaseRecordId)
             .IsUnique()
             .HasFilter("[QuickbaseRecordId] IS NOT NULL");
        });

        b.Entity<Review>(e =>
        {
            // The public reviews list filters on status and orders by date, so index the
            // pair rather than the columns separately.
            e.HasIndex(r => new { r.Status, r.CreatedAt });

            // Import maps Quickbase record ids 1:1; the filter keeps the uniqueness
            // guarantee without blocking rows created natively in SQL (which have none).
            e.HasIndex(r => r.QuickbaseRecordId)
             .IsUnique()
             .HasFilter("[QuickbaseRecordId] IS NOT NULL");
        });

        b.Entity<PublicDocument>(e =>
        {
            // A brochure is a slug with up to three language editions behind it, so the
            // unique key is the pair (owner, 2026-08-20: the owner supplies the EN and EL
            // PDFs themselves). Unique rather than merely indexed for the same reason as
            // SavedConfig.Code: every public read is "resolve slug + lang", and two rows
            // answering one address would serve a coin-flip of a catalogue. The importer's
            // idempotency also rides on this — a re-run updates rather than duplicates.
            e.HasIndex(d => new { d.Slug, d.Lang }).IsUnique();
        });

    }
}
