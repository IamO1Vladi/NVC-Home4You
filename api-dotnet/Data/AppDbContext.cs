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

    protected override void OnModelCreating(ModelBuilder b)
    {
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
    }
}
