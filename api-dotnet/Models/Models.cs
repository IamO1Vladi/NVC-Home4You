using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Models;

public record OfferDto(string Name, string Email, string? Phone, string Project, string? ModelId, string? Locale = null);
public record QuestionDto(string Name, string Email, string Question, string? Locale = null);

// Outcome of writing a lead. Deliberately not an int?: a null record id used to mean both
// "Quickbase is not configured", "Quickbase rejected the record" and "it worked but told
// us nothing", and all three were reported to the customer as success.
public record LeadWriteResult(bool Ok, long? RecordId, string? Error)
{
    public static LeadWriteResult Succeeded(long recordId) => new(true, recordId, null);
    public static LeadWriteResult Failed(string error) => new(false, null, error);
}
public record ReviewDto(string Name, string? Company, string Email, string? Location, string? Product, string Comment, int Rating);

// "Save & resume" Phase 2 — short shareable configurator links.
// Config is stored as-is (opaque JSON) so the backend never needs the configurator schema.
public record SaveConfigRequest(JsonElement Config, string? ModelLabel, string? Locale, string? ReturnPath, string? Email);
public record SaveConfigResponse(string Code, string Url);
public record SavedConfigDto(JsonElement Config, string? ModelLabel, string? Locale);

// Phase 2b — "email me my config": stores the config (to get a short link) and emails it.
public record EmailConfigRequest(JsonElement Config, string Email, string? ModelLabel, string? Locale, string? ReturnPath);

public class GalleryItem {
  public long Id { get; set; }
  public string Title { get; set; } = "";
  public decimal? Price { get; set; }
  public string Currency { get; set; } = "EUR";
  public string Description { get; set; } = "";
  public string? CoverUrl { get; set; }
  public List<string> Images { get; set; } = new();
  public string? TitleBg { get; set; }
  public string? DescriptionBg { get; set; }
  public string? TitleEl { get; set; }
  public string? DescriptionEl { get; set; }
  public string? Category { get; set; }
  public string? CatalogId { get; set; }
}

public class CasesPageResponse {
  public CasesPageStats Stats { get; set; } = new();
  public List<PublicClientDto> Clients { get; set; } = new();
  public List<PublicCaseDto> Cases { get; set; } = new();
  public List<PublicReviewDto> Reviews { get; set; } = new();
}

public class CasesPageStats {
  public int PublishedCases { get; set; }
  public int ApprovedReviews { get; set; }
  public int CountriesServed { get; set; }
}

public class PublicClientDto {
  public string Id { get; set; } = "";
  public string Name { get; set; } = "";
  public string? Sector { get; set; }
  public string? Country { get; set; }
  public string? LogoUrl { get; set; }
}

public class PublicCaseDto {
  public string Id { get; set; } = "";
  public bool Featured { get; set; }
  public string CompanyName { get; set; } = "";
  public string? CompanyType { get; set; }
  public string? BuyerName { get; set; }
  public string? BuyerRole { get; set; }
  public string? Category { get; set; }
  public string? Product { get; set; }
  public string? Units { get; set; }
  public string? Location { get; set; }
  public string? Year { get; set; }
  public string? Scope { get; set; }
  public string? Result { get; set; }
  public string? Quote { get; set; }
  public double Rating { get; set; }
  public string? CompanyLogoUrl { get; set; }
  public string? ImageUrl { get; set; }
  public List<string> Images { get; set; } = new();
}

public class PublicReviewDto {
  public string Id { get; set; } = "";
  public string Status { get; set; } = "approved";
  public string Name { get; set; } = "";
  public string? Company { get; set; }
  public string? Product { get; set; }
  public string? Location { get; set; }
  public string? Comment { get; set; }
  public double Rating { get; set; }
  public string? CreatedAt { get; set; }
}

public class FeaturedReviewsResponse {
  public double AverageRating { get; set; }
  public int TotalCount { get; set; }
  public List<PublicReviewDto> Items { get; set; } = new();
}

public class QbValue
{
    public JsonElement value { get; set; }

    public string? AsString() => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number => value.GetRawText(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        JsonValueKind.Null => null,
        JsonValueKind.Undefined => null,
        _ => value.GetRawText()
    };
}

public class QbRec : Dictionary<string, QbValue>
{
    public string? Get(int fid) =>
        TryGetValue(fid.ToString(), out var v) ? v.AsString() : null;

    public bool TryGetElement(int fid, out JsonElement element)
    {
        if (TryGetValue(fid.ToString(), out var v))
        {
            element = v.value;
            return true;
        }

        element = default;
        return false;
    }
}

public class QbQueryResult
{
    public List<QbRec>? data { get; set; }
}

// One field's metadata from GET /v1/fields. Used by the lead-schema command to discover
// what the lead tables actually hold, rather than assuming it matches what we write.
public class QbField
{
    public int id { get; set; }
    public string? label { get; set; }
    public string? fieldType { get; set; }
    public bool required { get; set; }
    public bool unique { get; set; }
}

public class QbCreateResult
{
    public QbMeta? metadata { get; set; }
    public List<QbRec>? data { get; set; }

    // Quickbase answers 200 even when it accepted the request but rejected the record —
    // field validation, a bad value, a field id that changed underneath us. The only
    // signal is metadata.lineErrors, so "HTTP succeeded" is not "the record exists".
    public bool HasLineErrors => metadata?.lineErrors is { Count: > 0 };

    // Flattened for logging: "line 1: Incompatible value for field with ID 6".
    public string? DescribeLineErrors()
    {
        var errors = metadata?.lineErrors;
        if (errors is null || errors.Count == 0) return null;
        return string.Join("; ", errors.Select(kv => $"line {kv.Key}: {string.Join(", ", kv.Value)}"));
    }
}

public class QbMeta
{
    // Not part of Quickbase's documented response shape, but harmless to keep: it was
    // here first, and the record id is read from createdRecordIds/data as well.
    public int? firstRecordId { get; set; }

    // The documented way a POST /records reports what it created.
    public List<int>? createdRecordIds { get; set; }

    // Keyed by 1-based line number within the submitted `data` array; the value is the
    // list of reasons that record was rejected. Absent on a clean write.
    public Dictionary<string, List<string>>? lineErrors { get; set; }

    public int? totalNumberOfRecordsProcessed { get; set; }
}

// Admin-only projection of a review. Unlike PublicReviewDto it exposes every status and
// the submitter's email, because moderators need both to make a publish decision.
public class AdminReviewDto {
  public int Id { get; set; }
  public int? QuickbaseRecordId { get; set; }
  public string Status { get; set; } = "";
  public string Name { get; set; } = "";
  public string Company { get; set; } = "";
  public string Email { get; set; } = "";
  public string Location { get; set; } = "";
  public string Product { get; set; } = "";
  public string Comment { get; set; } = "";
  public double Rating { get; set; }
  public string CreatedAt { get; set; } = "";
  public string? UpdatedAt { get; set; }
}
