using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Configuration;

namespace Services;

public class EnvConfig
{
    private readonly IConfiguration _cfg;
    public EnvConfig(IConfiguration cfg) { _cfg = cfg; }

    public string Realm => NormalizeRealm(_cfg["QUICKBASE_REALM"]);
    public string Token => (_cfg["QUICKBASE_TOKEN"] ?? "").Trim();
    public bool UsePublicAttachmentUrls => ParseBool(_cfg["QB_USE_PUBLIC_ATTACHMENT_URLS"], true);

    // Existing tables already used by your current site.
    public string TableHouses => _cfg["QB_TABLE_HOUSES"] ?? "";
    public string TableImages => _cfg["QB_TABLE_IMAGES"] ?? "";
    public string TableOffer => _cfg["QB_TABLE_OFFER"] ?? "";
    public string TableQuestion => _cfg["QB_TABLE_QUESTION"] ?? "";

    // New tables for the Cases & Reviews page.
    public string TableCases => _cfg["QB_TABLE_CASES"] ?? "";
    public string TableReviews => _cfg["QB_TABLE_REVIEWS"] ?? "";

    // Optional child table only if you want unlimited extra case photos.
    public string TableCaseImages => _cfg["QB_TABLE_CASE_IMAGES"] ?? "";

    // Existing gallery fields.
    public int F_HOUSE_RID => GetInt("FID_HOUSE_RID", 3);
    public int F_HOUSE_TITLE => GetInt("FID_HOUSE_TITLE", 6);
    public int F_HOUSE_PRICE => GetInt("FID_HOUSE_PRICE", 10);
    public int F_HOUSE_DESC => GetInt("FID_HOUSE_DESC", 7);
    public int F_HOUSE_CATEGORY => GetInt("FID_HOUSE_CATEGORY", 16);
    public int? F_HOUSE_TITLE_BG => GetOptionalInt("F_HOUSE_TITLE_B", 13);
    public int? F_HOUSE_DESC_BG => GetOptionalInt("FID_HOUSE_DESC_BG", 14);
    public int? F_HOUSE_TITLE_EL => GetOptionalInt("FID_HOUSE_TITLE_EL", 25);
    public int? F_HOUSE_DESC_EL => GetOptionalInt("FID_HOUSE_DESC_EL", 26);
    // Facebook/Meta catalogue item id used for Pixel content_ids (falls back to record id when empty).
    public int? F_HOUSE_CATALOG_ID => GetOptionalInt("FID_HOUSE_CATALOG_ID", 27);
    public int F_IMG_PARENT => GetInt("FID_IMG_PARENT", 6);
    public int F_IMG_URL => GetInt("FID_IMG_URL", 10);
    public int F_IMG_FILE => GetInt("FID_IMG_FILE", 9);

    // Existing offer/question fields.
    public int F_OFFER_NAME => GetInt("FID_OFFER_NAME", 7);
    public int F_OFFER_EMAIL => GetInt("FID_OFFER_EMAIL", 6);
    public int F_OFFER_PHONE => GetInt("FID_OFFER_PHONE", 9);
    public int F_OFFER_MESSAGE => GetInt("FID_OFFER_MESSAGE", 10);
    public int F_OFFER_MODEL_ID => GetInt("FID_OFFER_MODEL_ID", 11);

    public int F_Q_NAME => GetInt("FID_Q_NAME", 6);
    public int F_Q_EMAIL => GetInt("FID_Q_EMAIL", 7);
    public int F_Q_MESSAGE => GetInt("FID_Q_MESSAGE", 8);

    // Cases table. These defaults match the field IDs you already shared.
    public int F_CASE_RID => GetInt("FID_CASE_RID", 3);
    public int F_CASE_PUBLISHED => GetInt("FID_CASE_PUBLISHED", 6);
    public int F_CASE_FEATURED => GetInt("FID_CASE_FEATURED", 7);
    public int F_CASE_SORT => GetInt("FID_CASE_SORT", 8);
    public int F_CASE_SLUG => GetInt("FID_CASE_SLUG", 9);
    public int F_CASE_LOCALE => GetInt("FID_CASE_LOCALE", 10);
    public int F_CASE_COMPANY_NAME => GetInt("FID_CASE_COMPANY_NAME", 11);
    public int F_CASE_COMPANY_SECTOR => GetInt("FID_CASE_COMPANY_SECTOR", 12);
    public int F_CASE_BUYER_NAME => GetInt("FID_CASE_BUYER_NAME", 13);
    public int F_CASE_BUYER_ROLE => GetInt("FID_CASE_BUYER_ROLE", 14);
    public int F_CASE_COUNTRY => GetInt("FID_CASE_COUNTRY", 15);
    public int F_CASE_CITY => GetInt("FID_CASE_CITY", 16);
    public int F_CASE_PUBLIC_LOCATION => GetInt("FID_CASE_PUBLIC_LOCATION", 17);
    public int F_CASE_CATEGORY => GetInt("FID_CASE_CATEGORY", 18);
    public int F_CASE_PRODUCT_NAME => GetInt("FID_CASE_PRODUCT_NAME", 19);
    public int F_CASE_PRODUCT_VARIANT => GetInt("FID_CASE_PRODUCT_VARIANT", 20);
    public int F_CASE_UNITS => GetInt("FID_CASE_UNITS", 21);
    public int F_CASE_CURRENCY => GetInt("FID_CASE_CURRENCY", 22);
    public int F_CASE_DEAL_VALUE => GetInt("FID_CASE_DEAL_VALUE", 23);
    public int F_CASE_YEAR => GetInt("FID_CASE_YEAR", 24);
    public int F_CASE_DELIVERED_AT => GetInt("FID_CASE_DELIVERED_AT", 25);
    public int F_CASE_SCOPE => GetInt("FID_CASE_SCOPE", 26);
    public int F_CASE_RESULT => GetInt("FID_CASE_RESULT", 27);
    public int F_CASE_QUOTE => GetInt("FID_CASE_QUOTE", 28);
    public int F_CASE_RATING => GetInt("FID_CASE_RATING", 29);
    public int F_CASE_LOGO_FILE => GetInt("FID_CASE_LOGO_FILE", 30);
    public int F_CASE_IMAGE_FILE => GetInt("FID_CASE_IMAGE_FILE", 31);
    public int F_CASE_VISIBILITY => GetInt("FID_CASE_VISIBILITY", 35);
    public int F_CASE_PUBLISHED_AT => GetInt("FID_CASE_PUBLISHED_AT", 36);
    public int F_CASE_IS_PUBLIC => GetInt("FID_CASE_IS_PUBLIC", 37);
    public int F_CASE_PUBLIC_BUYER_LABEL => GetInt("FID_CASE_PUBLIC_BUYER_LABEL", 38);

    // Optional extra image attachment fields on the SAME cases table.
    public IReadOnlyList<int> CaseExtraImageFids => ParseCsvInts(_cfg["QB_CASE_EXTRA_IMAGE_FIDS"]);

    // Optional child image table.
    public int F_CASEIMG_RID => GetInt("FID_CASEIMG_RID", 3);
    public int F_CASEIMG_PARENT => GetInt("FID_CASEIMG_PARENT", 6);
    public int? F_CASEIMG_FILE => GetOptionalInt("FID_CASEIMG_FILE");
    public int? F_CASEIMG_URL => GetOptionalInt("FID_CASEIMG_URL");
    public int? F_CASEIMG_SORT => GetOptionalInt("FID_CASEIMG_SORT");

    // Reviews table. Change these if your review table uses different field IDs.
    public int F_REVIEW_RID => GetInt("FID_REVIEW_RID", 3);
    public int F_REVIEW_NAME => GetInt("FID_REVIEW_NAME", 6);
    public int F_REVIEW_COMPANY => GetInt("FID_REVIEW_COMPANY", 7);
    public int F_REVIEW_EMAIL => GetInt("FID_REVIEW_EMAIL", 8);
    public int F_REVIEW_LOCATION => GetInt("FID_REVIEW_LOCATION", 9);
    public int F_REVIEW_PRODUCT => GetInt("FID_REVIEW_PRODUCT", 10);
    public int F_REVIEW_RATING => GetInt("FID_REVIEW_RATING", 11);
    public int F_REVIEW_COMMENT => GetInt("FID_REVIEW_COMMENT", 12);
    public int F_REVIEW_STATUS => GetInt("FID_REVIEW_STATUS", 13);
    public int? F_REVIEW_CREATED => GetOptionalInt("FID_REVIEW_CREATED", 1);

    public string ReviewApprovedValue => (_cfg["QB_REVIEW_APPROVED"] ?? "approved").Trim();
    public string ReviewPendingValue => (_cfg["QB_REVIEW_PENDING"] ?? "pending").Trim();

    // Saved configurator links ("Save & resume" Phase 2). A Quickbase table that maps
    // a short share code to a serialized configurator config so /c/{code} can resolve
    // it. Leave QB_TABLE_SAVED_CONFIGS unset to disable the feature (endpoints 503).
    public string TableSavedConfigs => _cfg["QB_TABLE_SAVED_CONFIGS"] ?? "";
    public bool SavedConfigsConfigured => !string.IsNullOrWhiteSpace(TableSavedConfigs);

    public int F_SAVEDCFG_RID    => GetInt("FID_SAVEDCFG_RID", 3);
    public int F_SAVEDCFG_CODE   => GetInt("FID_SAVEDCFG_CODE", 6);
    public int F_SAVEDCFG_JSON   => GetInt("FID_SAVEDCFG_JSON", 7);
    public int F_SAVEDCFG_MODEL  => GetInt("FID_SAVEDCFG_MODEL", 8);
    public int F_SAVEDCFG_LOCALE => GetInt("FID_SAVEDCFG_LOCALE", 9);
    public int F_SAVEDCFG_PATH   => GetInt("FID_SAVEDCFG_PATH", 10);
    // Optional fields — opt-in via env var. When FID_SAVEDCFG_EMAIL is unset the
    // recipient's address is emailed but NOT stored (avoids writing a field that may
    // not exist on the table, and keeps stored PII to a minimum). Set it to the
    // Email field's id if you want the address saved alongside the config.
    public int? F_SAVEDCFG_EMAIL => GetOptionalInt("FID_SAVEDCFG_EMAIL");
    public int? F_SAVEDCFG_HITS  => GetOptionalInt("FID_SAVEDCFG_HITS");

    // SMTP for the Phase 2b "email me my config" flow. Defaults target Microsoft 365
    // (smtp.office365.com:587, STARTTLS). Leave SMTP_USER/SMTP_PASSWORD unset to
    // disable the feature (endpoint 503s; the frontend hides the email option).
    public string SmtpHost => (_cfg["SMTP_HOST"] ?? "smtp.office365.com").Trim();
    public int SmtpPort => GetInt("SMTP_PORT", 587);
    public string SmtpUser => (_cfg["SMTP_USER"] ?? "").Trim();
    public string SmtpPassword => _cfg["SMTP_PASSWORD"] ?? "";
    public string SmtpFrom => (_cfg["SMTP_FROM"] ?? _cfg["SMTP_USER"] ?? "").Trim();
    public string SmtpFromName => (_cfg["SMTP_FROM_NAME"] ?? "NVC Home4You").Trim();
    public bool SmtpConfigured =>
        !string.IsNullOrWhiteSpace(SmtpHost) &&
        !string.IsNullOrWhiteSpace(SmtpUser) &&
        !string.IsNullOrWhiteSpace(SmtpPassword) &&
        !string.IsNullOrWhiteSpace(SmtpFrom);

    // Microsoft Graph (OAuth2 client-credentials) transport — preferred over SMTP,
    // whose Basic Auth Microsoft 365 has deprecated. When these are set, email is
    // sent via Graph /sendMail instead of SMTP. Needs an Azure AD app registration
    // with the application permission Mail.Send (admin-consented).
    public string GraphTenantId => (_cfg["GRAPH_TENANT_ID"] ?? "").Trim();
    public string GraphClientId => (_cfg["GRAPH_CLIENT_ID"] ?? "").Trim();
    public string GraphClientSecret => _cfg["GRAPH_CLIENT_SECRET"] ?? "";
    // Mailbox to send as (UPN/email). Falls back to SMTP_FROM / SMTP_USER.
    public string GraphSender => (_cfg["GRAPH_SENDER"] ?? _cfg["SMTP_FROM"] ?? _cfg["SMTP_USER"] ?? "").Trim();
    public bool GraphConfigured =>
        !string.IsNullOrWhiteSpace(GraphTenantId) &&
        !string.IsNullOrWhiteSpace(GraphClientId) &&
        !string.IsNullOrWhiteSpace(GraphClientSecret) &&
        !string.IsNullOrWhiteSpace(GraphSender);

    // Email works if either transport is configured (Graph preferred).
    public bool EmailConfigured => GraphConfigured || SmtpConfigured;

    // Internal "new lead" notification recipient(s), comma/semicolon separated.
    // Defaults to the sales inbox; override via env to add/redirect recipients.
    public string LeadNotifyEmail => (_cfg["LEAD_NOTIFY_EMAIL"] ?? "nlekov@nvc-home4you.eu").Trim();

    private int GetInt(string key, int defaultValue) =>
        int.TryParse(_cfg[key], out var value) && value > 0 ? value : defaultValue;

    private int? GetOptionalInt(string key, int? defaultValue = null)
    {
        if (int.TryParse(_cfg[key], out var value) && value > 0) return value;
        return defaultValue;
    }

    private static bool ParseBool(string? raw, bool defaultValue)
    {
        if (string.IsNullOrWhiteSpace(raw)) return defaultValue;
        var value = raw.Trim().ToLowerInvariant();
        return value is "true" or "1" or "yes" or "on";
    }

    private static IReadOnlyList<int> ParseCsvInts(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Array.Empty<int>();

        return raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(value => int.TryParse(value, out var fid) ? fid : 0)
            .Where(fid => fid > 0)
            .Distinct()
            .ToArray();
    }

    // --- SQL migration (Quickbase -> Azure SQL) --------------------------------------
    // Connection string for the SQL data layer. Empty until a database is provisioned,
    // which is the safe default: every DataSourceFor() below then reports Quickbase.
    // Set via Azure App Settings in deployed environments, user-secrets locally.
    public string SqlConnectionString => (_cfg["SQL_CONNECTION_STRING"] ?? "").Trim();

    public bool SqlConfigured => !string.IsNullOrWhiteSpace(SqlConnectionString);

    // Per-entity switch so tables can be cut over one at a time and reverted instantly.
    // Env var shape: DATA_SOURCE_HOUSES=sql (anything else, or unset, means quickbase).
    // Falls back to Quickbase whenever SQL isn't configured, so a half-set flag can
    // never take the site down.
    public DataSource DataSourceFor(string entity)
    {
        if (!SqlConfigured) return DataSource.Quickbase;
        var raw = (_cfg[$"DATA_SOURCE_{entity.ToUpperInvariant()}"] ?? "").Trim();
        return raw.Equals("sql", StringComparison.OrdinalIgnoreCase)
            ? DataSource.Sql
            : DataSource.Quickbase;
    }

    private static string NormalizeRealm(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        var value = raw.Trim().TrimEnd('/');
        if (value.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) value = value[8..];
        if (value.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) value = value[7..];
        return value.TrimEnd('/');
    }
}
