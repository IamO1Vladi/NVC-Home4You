using System;
using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Data;

// Design-time factory for `dotnet ef` (migrations add / database update).
//
// Program.cs registers AppDbContext only when SQL_CONNECTION_STRING is set, which is
// deliberate — no database means the site quietly stays on Quickbase. But it makes EF's
// design-time host fail with an opaque "Unable to resolve service for DbContextOptions"
// message when the connection string is missing. This factory bypasses the web host so
// migrations work independently, and fails with an explanation instead of a riddle.
//
// Resolution order: --connection argument > SQL_CONNECTION_STRING env var > user-secrets
// > appsettings.json. The env var is first so a migration can be run against a specific
// database without touching stored config:
//
//   SQL_CONNECTION_STRING="Server=...;" dotnet ef database update
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddUserSecrets<AppDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = FromArgs(args) ?? config["SQL_CONNECTION_STRING"];

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "SQL_CONNECTION_STRING is not configured, so there is no database to migrate.\n" +
                "Set it one of these ways, from the api-dotnet directory:\n" +
                "  dotnet user-secrets set \"SQL_CONNECTION_STRING\" \"Server=...;\"\n" +
                "  SQL_CONNECTION_STRING=\"Server=...;\" dotnet ef database update\n" +
                "  dotnet ef database update -- --connection \"Server=...;\"");
        }

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure())
            .Options;

        return new AppDbContext(options);
    }

    // `dotnet ef database update -- --connection "..."` passes everything after `--`
    // through to the application, arriving here as args.
    private static string? FromArgs(string[] args)
    {
        for (var i = 0; i < args.Length - 1; i++)
            if (args[i].Equals("--connection", StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        return null;
    }
}
