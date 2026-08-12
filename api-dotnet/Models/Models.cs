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

// Admin-only projection of a lead. Offers and questions are separate tables but one work
// queue, so they share a shape; Kind says which table a row came from and is required
// alongside Id to address it, because the two id sequences overlap.
public class AdminLeadDto
{
    public string Kind { get; set; } = "";
    public int Id { get; set; }
    public int? QuickbaseRecordId { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Message { get; set; } = "";
    public string ModelId { get; set; } = "";
    public string Locale { get; set; } = "";
    public bool ReachedOut { get; set; }
    public bool LeadCreated { get; set; }

    // The deal this enquiry became, if it has. Null means the queue offers "create a
    // deal"; a value means it offers "open it" instead — which is what stops someone
    // promoting the same enquiry twice and wondering why nothing happened.
    public int? DealId { get; set; }

    public string CreatedAt { get; set; } = "";
    public string? UpdatedAt { get; set; }
}

// One lead with its thread — the detail view behind the pipeline.
//
// Note the route naming: /api/admin/leads is the ENQUIRY queue (offers + questions, the
// Quickbase workflow), and this lives at /api/admin/pipeline. The two are genuinely
// different resources and the older route was there first; collapsing them would either
// break the existing page or overload one path with two shapes.
public class LeadDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Status { get; set; } = "";
    public string OwnerUpn { get; set; } = "";
    public string Locale { get; set; } = "";
    public string Country { get; set; } = "";
    public string CustomerAddress { get; set; } = "";
    public string BuildLocation { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public string NextStep { get; set; } = "";
    public string Notes { get; set; } = "";

    // The catalogue model, resolved. HouseId is the FK; HouseTitle saves the panel a
    // second round trip just to render a name.
    public int? HouseId { get; set; }
    public string HouseTitle { get; set; } = "";
    public string CustomModel { get; set; } = "";

    // Where it came from, so the panel can link back to the original enquiry. Both null
    // for a cold-call lead.
    public int? OfferId { get; set; }
    public int? QuestionId { get; set; }

    public string CreatedAt { get; set; } = "";
    public string? LastActivityAt { get; set; }

    public List<LeadActivityDto> Activities { get; set; } = new();
}

public class LeadActivityDto
{
    public int Id { get; set; }
    public string Type { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";

    // Empty means the customer — the panel renders the two sides differently, so this is
    // the field the whole chat layout hangs off.
    public string ActorUpn { get; set; } = "";
    public bool FromCustomer { get; set; }

    public string OccurredAt { get; set; } = "";
    public List<LeadAttachmentDto> Attachments { get; set; } = new();
}

public class LeadAttachmentDto
{
    public int Id { get; set; }
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long SizeBytes { get; set; }

    // Deliberately no blob key or public URL. Attachments are fetched through an
    // authenticated endpoint, because /api/img is unauthenticated and would make a
    // customer's survey or contract reachable by anyone who guessed the path.
    public string DownloadUrl { get; set; } = "";
}

// The pipeline board: one entry per lead, grouped by status in the UI.
public class LeadSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Status { get; set; } = "";
    public string OwnerUpn { get; set; } = "";
    public string ModelLabel { get; set; } = "";
    public string NextStep { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string? LastActivityAt { get; set; }
    public int ActivityCount { get; set; }
}

public class LeadCountsDto
{
    public int NotReachedOut { get; set; }
    public int ReachedOut { get; set; }
    public int Offers { get; set; }
    public int Questions { get; set; }
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
