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

    protected override void OnModelCreating(ModelBuilder b)
    {
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
