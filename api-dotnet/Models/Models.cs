using System.Text.Json;

namespace Models;

public record OfferDto(string Name, string Email, string? Phone, string Project, string? ModelId);
public record QuestionDto(string Name, string Email, string Question);

public class GalleryItem {
  public long Id { get; set; }
  public string Title { get; set; } = "";
  public decimal? Price { get; set; }
  public string Currency { get; set; } = "EUR";
  public string Description { get; set; } = "";
  public string? CoverUrl { get; set; }
  public List<string> Images { get; set; } = new();
}

// Quickbase shapes
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
        _ => value.GetRawText()
    };
}
public class QbRec : Dictionary<string, QbValue>
{
    public string? Get(int fid) =>
        TryGetValue(fid.ToString(), out var v) ? v.AsString() : null;
}
public class QbQueryResult { public List<QbRec>? data { get; set; } }
public class QbCreateResult {
  public QbMeta? metadata { get; set; }
  public List<QbRec>? data { get; set; }
}
public class QbMeta { public int? firstRecordId { get; set; } }
