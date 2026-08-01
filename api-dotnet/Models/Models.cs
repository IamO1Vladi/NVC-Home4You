using System.Text.Json;

namespace Models;

public record OfferDto(string Name, string Email, string? Phone, string Project, string? ModelId);
public record QuestionDto(string Name, string Email, string Question);
public record ReviewDto(string Name, string? Company, string Email, string? Location, string? Product, string Comment, int Rating);

// "Save & resume" Phase 2 — short shareable configurator links.
// Config is stored as-is (opaque JSON) so the backend never needs the configurator schema.
public record SaveConfigRequest(JsonElement Config, string? ModelLabel, string? Locale, string? ReturnPath, string? Email);
public record SaveConfigResponse(string Code, string Url);
public record SavedConfigDto(JsonElement Config, string? ModelLabel, string? Locale);

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

public class QbCreateResult
{
    public QbMeta? metadata { get; set; }
    public List<QbRec>? data { get; set; }
}

public class QbMeta
{
    public int? firstRecordId { get; set; }
}
