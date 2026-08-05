using System;
using System.Collections.Generic;

namespace Services;

// One Quickbase case as the importer sees it: raw stored fields plus resolved attachment
// URLs, with none of the public page's filtering or formula application.
//
// Publish, IsPublicFlag and VisibilityStatus are carried separately rather than pre-combined,
// because collapsing them is the importer's job (CaseFormulas.IsPublicDuringImport) and
// doing it here would hide which of the three actually made a case visible.
public sealed record CaseImportRow(
    long QuickbaseRecordId,
    bool Publish,
    bool IsPublicFlag,
    string? VisibilityStatus,
    bool Featured,
    int SortOrder,
    string CompanyName,
    string? CompanySector,
    string? BuyerName,
    string? BuyerRole,
    string? Country,
    string? City,
    string? CategoryKey,
    string? ProductName,
    string? ProductVariant,
    int? UnitsQty,
    int? Year,
    DateTimeOffset? DeliveredAt,
    string? Scope,
    string? Result,
    string? PublicQuote,
    double? RatingSnapshot,
    string? CompanyLogoUrl,
    string? CoverImageUrl,
    List<string> ImageUrls);
