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
    public DbSet<SavedConfig> SavedConfigs => Set<SavedConfig>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();
    public DbSet<FactorySheet> FactorySheets => Set<FactorySheet>();

    // Billing and procurement (ROADMAP #21) — the buy side. No public read path, so no
    // DATA_SOURCE_* flag and no fallback chain: these tables are the only copy from the
    // day the importer runs.
    public DbSet<BuyCycle> BuyCycles => Set<BuyCycle>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
    public DbSet<ProductModel> ProductModels => Set<ProductModel>();
    public DbSet<PurchaseLot> PurchaseLots => Set<PurchaseLot>();
    public DbSet<OperatingExpense> OperatingExpenses => Set<OperatingExpense>();
    public DbSet<Target> Targets => Set<Target>();

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

        b.Entity<PurchaseFile>(e =>
        {
            e.HasOne(f => f.Purchase)
             .WithMany(p => p.Files)
             .HasForeignKey(f => f.PurchaseId)
             .OnDelete(DeleteBehavior.Cascade);

            // The form renders the two invoice slots side by side, so the read is always
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

        // --- Billing and procurement (ROADMAP #21) ------------------------------------
        //
        // The shape: BuyCycle 1-* Shipment 1-* PurchaseLot *-1 ProductModel ?-1 House.
        // Money is decimal(18,2) as everywhere; the FX rate is the one exception at (18,6),
        // because a rate is quoted to more places than a price is.
        //
        // Nothing here stores a total. Every sum lives in LandedCost.

        b.Entity<BuyCycle>(e =>
        {
            // The dropdown on a new shipment: open cycles, newest first. That pair is the
            // query that runs every time somebody records a container.
            e.HasIndex(c => new { c.IsClosed, c.StartDate });

            // decimal(9,4): 2.7000 and 0.2000 today. Not (18,2) — a rate rounded to two
            // places is a different rate, and these multiply every figure on the dashboard.
            e.Property(c => c.MarkupCoefficient).HasPrecision(9, 4);
            e.Property(c => c.BorderVatRate).HasPrecision(9, 4);
        });

        b.Entity<Shipment>(e =>
        {
            // "This cycle, its containers, in the order they landed" — the cycle page.
            e.HasIndex(s => new { s.BuyCycleId, s.ArrivedAt });

            // "What have we bought from this factory?", now answerable from the buy side
            // as well as the sales side. Filtered, like Purchase.FactoryId, because plenty
            // of shipments are recorded before the factory is known.
            e.HasIndex(s => s.FactoryId).HasFilter("[FactoryId] IS NOT NULL");

            e.Property(s => s.FreightCost).HasPrecision(18, 2);
            e.Property(s => s.CustomsDuty).HasPrecision(18, 2);
            e.Property(s => s.ImportVatPaid).HasPrecision(18, 2);
            e.Property(s => s.OtherCosts).HasPrecision(18, 2);
            e.Property(s => s.UsdToEurRate).HasPrecision(18, 6);

            // Restrict, not Cascade. Deleting a buy cycle must never take a year of
            // procurement history with it — a cycle that is over gets IsClosed, which is
            // what that flag is for. Same call as Purchase.Factory.
            e.HasOne(s => s.BuyCycle)
             .WithMany(c => c.Shipments)
             .HasForeignKey(s => s.BuyCycleId)
             .OnDelete(DeleteBehavior.Restrict);

            // Restrict for the reason the factory table exists: removing a supplier we no
            // longer use must not delete the record of what they shipped us.
            e.HasOne(s => s.Factory)
             .WithMany()
             .HasForeignKey(s => s.FactoryId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ProductModel>(e =>
        {
            // The dropdown on a new lot: active models, alphabetical. Mirrors Factory.
            e.HasIndex(m => new { m.IsActive, m.Name });

            // "What does this catalogue house cost us?" — the join the margin report walks.
            e.HasIndex(m => m.HouseId).HasFilter("[HouseId] IS NOT NULL");

            e.Property(m => m.FactoryPrice).HasPrecision(18, 2);

            // Restrict, same as Purchase.House and Lead.House: retiring a house from the
            // gallery must not delete what we paid for the ones already in the yard.
            e.HasOne(m => m.House)
             .WithMany()
             .HasForeignKey(m => m.HouseId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<PurchaseLot>(e =>
        {
            // Every read is "this shipment, its lines".
            e.HasIndex(l => l.ShipmentId);

            // "Every container this model has ever come in", which is how a factory price
            // gets sanity-checked against what we actually paid.
            e.HasIndex(l => l.ProductModelId);

            e.Property(l => l.UnitCost).HasPrecision(18, 2);

            // Cascade, and this is the one Cascade in these tables. A lot has no meaning
            // apart from the container it rode in, and deleting a shipment is already the
            // deliberate, confirmed act — the same reasoning as Purchase -> Customer.
            e.HasOne(l => l.Shipment)
             .WithMany(s => s.Lots)
             .HasForeignKey(l => l.ShipmentId)
             .OnDelete(DeleteBehavior.Cascade);

            // Restrict: retiring a model must not rewrite what past containers held. The
            // model is deactivated instead, and the admin service says so with a count.
            e.HasOne(l => l.ProductModel)
             .WithMany(m => m.Lots)
             .HasForeignKey(l => l.ProductModelId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<OperatingExpense>(e =>
        {
            // The monthly rollup, and the list screen, both read by date.
            e.HasIndex(x => x.SpentAt);

            // "Marketing, this quarter" — the breakdown the dashboard renders.
            e.HasIndex(x => new { x.CategoryKey, x.SpentAt });

            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.VatAmount).HasPrecision(18, 2);
        });

        b.Entity<Target>(e =>
        {
            e.Property(t => t.TargetValue).HasPrecision(18, 2);

            // THE ONE HARD UNIQUENESS CONSTRAINT IN THESE TABLES, and unlike Factory.Name or
            // Customer.Eik it is enforced rather than warned about. Two revenue targets for
            // the same month leaves the dashboard choosing one, and there is no correct way
            // to choose — so the second one is refused and the first is edited in place.
            //
            // SQL Server treats NULLs as equal inside a unique index, which is exactly what
            // is wanted here: a yearly target has a null Month and a null BuyCycleId, and
            // two of those for the same metric and year SHOULD collide.
            //
            // HENCE HasFilter(null), WHICH IS LOAD-BEARING — do not remove it as redundant.
            // EF's SQL Server provider adds "WHERE [Year] IS NOT NULL AND [Month] IS NOT
            // NULL AND [BuyCycleId] IS NOT NULL" to any unique index over nullable columns,
            // and EVERY row here is null in at least one of the three — a monthly target has
            // no cycle, a cycle target has no year. The filtered index would therefore be
            // unique over the empty set: present in the schema, enforcing nothing, and
            // discovered only when the dashboard shows two different revenue targets for
            // one month.
            e.HasIndex(t => new { t.PeriodType, t.MetricKey, t.Year, t.Month, t.BuyCycleId })
             .IsUnique()
             .HasFilter(null);

            // Restrict, consistently with Shipment: a cycle with targets against it is
            // closed, not deleted.
            e.HasOne(t => t.BuyCycle)
             .WithMany()
             .HasForeignKey(t => t.BuyCycleId)
             .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
