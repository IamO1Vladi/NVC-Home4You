using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

/// <summary>What the panel sends when creating or updating a factory.</summary>
public sealed class FactoryInput
{
    public string Name { get; set; } = "";
    public string? Country { get; set; }
    public string? City { get; set; }
    public string? Address { get; set; }
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? Website { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// A factory as the panel sees it.
///
/// PurchaseCount is carried because the one thing a person needs to know before touching a
/// supplier row is how much history hangs off it — it is what turns "Delete" being refused
/// into something predictable rather than a surprise.
/// </summary>
public sealed record FactoryDto(
    int Id,
    string Name,
    string? Country,
    string? City,
    string? Address,
    string? ContactName,
    string? ContactPhone,
    string? ContactEmail,
    string? Website,
    string? Notes,
    bool IsActive,
    int PurchaseCount,
    string? UpdatedAt,
    string? UpdatedByUpn);

// CRUD for the supplier directory. Small on purpose — see Factory.
public sealed class FactoryAdminService
{
    private readonly AppDbContext _db;

    public FactoryAdminService(AppDbContext db) => _db = db;

    /// <summary>
    /// Every factory, active first, then alphabetical.
    ///
    /// Inactive ones are listed rather than hidden: this is the screen where a supplier gets
    /// reactivated, and a row you cannot see is a row you cannot fix. The purchase form is
    /// where the inactive ones drop out.
    /// </summary>
    public async Task<List<FactoryDto>> ListAsync(CancellationToken ct)
    {
        return await _db.Factories
            .AsNoTracking()
            .OrderByDescending(f => f.IsActive)
            .ThenBy(f => f.Name)
            .Select(f => new FactoryDto(
                f.Id, f.Name, f.Country, f.City, f.Address,
                f.ContactName, f.ContactPhone, f.ContactEmail, f.Website, f.Notes,
                f.IsActive,
                f.Purchases.Count,
                f.UpdatedAt == null ? null : f.UpdatedAt!.Value.ToString("o"),
                f.UpdatedByUpn))
            .ToListAsync(ct);
    }

    public async Task<FactoryDto?> GetAsync(int id, CancellationToken ct) =>
        (await ListAsync(ct)).FirstOrDefault(f => f.Id == id);

    public async Task<FactoryDto> CreateAsync(FactoryInput input, string? actor, CancellationToken ct)
    {
        var factory = new Factory { CreatedAt = DateTimeOffset.UtcNow };
        Apply(factory, input, actor);

        _db.Factories.Add(factory);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(factory.Id, ct))!;
    }

    public async Task<FactoryDto?> UpdateAsync(int id, FactoryInput input, string? actor, CancellationToken ct)
    {
        var factory = await _db.Factories.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (factory is null) return null;

        Apply(factory, input, actor);
        await _db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public enum DeleteOutcome { Deleted, NotFound, InUse }

    /// <summary>
    /// Removes a factory, but only one nothing points at.
    ///
    /// Refused rather than cascaded, and refused HERE rather than left to the database: the
    /// FK would throw a DbUpdateException that the panel can only render as "something went
    /// wrong". Counting first means the answer is "12 purchases name this factory —
    /// deactivate it instead", which is the action the person actually wants.
    /// </summary>
    public async Task<(DeleteOutcome Outcome, int PurchaseCount)> DeleteAsync(int id, CancellationToken ct)
    {
        var factory = await _db.Factories.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (factory is null) return (DeleteOutcome.NotFound, 0);

        var used = await _db.Purchases.CountAsync(p => p.FactoryId == id, ct);
        if (used > 0) return (DeleteOutcome.InUse, used);

        _db.Factories.Remove(factory);
        await _db.SaveChangesAsync(ct);
        return (DeleteOutcome.Deleted, 0);
    }

    /// <summary>
    /// Everything wrong with a submitted factory.
    ///
    /// Only the name is required. A supplier who is currently just a name and a phone number
    /// scribbled down is still worth recording — demanding an address would mean the row
    /// does not get created and the name goes back to being spelled three ways.
    /// </summary>
    public static List<string> Validate(FactoryInput? input)
    {
        var errors = new List<string>();
        if (input is null) { errors.Add("Nothing to save."); return errors; }

        if (string.IsNullOrWhiteSpace(input.Name)) errors.Add("A name is required.");
        else if (input.Name.Trim().Length > 200) errors.Add("That name is too long.");

        if (!string.IsNullOrWhiteSpace(input.ContactEmail) && !input.ContactEmail.Contains('@'))
            errors.Add("That does not look like an email address.");

        return errors;
    }

    /// <summary>
    /// Other factories already carrying this name, so the panel can ask "did you mean the
    /// existing one?" rather than either refusing the save or silently making a second row.
    ///
    /// A warning, never a block: two genuinely different suppliers can share a name across
    /// countries, and the database has no unique index here for exactly that reason.
    /// </summary>
    public async Task<bool> NameExistsAsync(string name, int? exceptId, CancellationToken ct)
    {
        var trimmed = (name ?? "").Trim();
        if (trimmed.Length == 0) return false;

        return await _db.Factories.AnyAsync(
            f => f.Id != (exceptId ?? 0) && f.Name == trimmed, ct);
    }

    private static void Apply(Factory factory, FactoryInput input, string? actor)
    {
        factory.Name = input.Name.Trim();
        factory.Country = Clean(input.Country);
        factory.City = Clean(input.City);
        factory.Address = Clean(input.Address);
        factory.ContactName = Clean(input.ContactName);
        factory.ContactPhone = Clean(input.ContactPhone);
        factory.ContactEmail = Clean(input.ContactEmail);
        factory.Website = Clean(input.Website);
        factory.Notes = Clean(input.Notes);
        factory.IsActive = input.IsActive;
        factory.UpdatedAt = DateTimeOffset.UtcNow;
        factory.UpdatedByUpn = actor;
    }

    // Whitespace-only in means null out. An empty string and a null both mean "not filled
    // in", and storing both makes every later "is this set?" check wrong half the time.
    internal static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
