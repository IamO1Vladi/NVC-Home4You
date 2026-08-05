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
            e.HasIndex(i => new { i.HouseId, i.ImageKey }).IsUnique();
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

            // Same guarantee as HouseImage: a re-run of the importer must not duplicate.
            e.HasIndex(i => new { i.CaseId, i.ImageKey }).IsUnique();

            e.HasIndex(i => i.QuickbaseRecordId)
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
    }
}
