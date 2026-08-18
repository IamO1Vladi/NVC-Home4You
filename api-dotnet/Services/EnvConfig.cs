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
    // The key was "F_HOUSE_TITLE_B" — missing the FID_ prefix and truncated — so setting
    // FID_HOUSE_TITLE_BG had no effect and the default silently did the work. Harmless only
    // because the default happens to be right.
    public int? F_HOUSE_TITLE_BG => GetOptionalInt("FID_HOUSE_TITLE_BG", 13);
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

    // Sales workflow checkboxes. The app has never written these — sales ticks them by
    // hand in Quickbase — but the import has to carry them across or the migration would
    // drop the workflow state and hand back a list.
    //
    // The ids are NOT the same on both tables, which is the sort of thing that is only
    // discoverable by asking Quickbase: verified via `dotnet run -- lead-schema`
    // (2026-08-12), offers use 13/14 and questions use 9/10.
    public int F_OFFER_REACHED_OUT => GetInt("FID_OFFER_REACHED_OUT", 13);
    public int F_OFFER_LEAD_CREATED => GetInt("FID_OFFER_LEAD_CREATED", 14);
    public int F_Q_REACHED_OUT => GetInt("FID_Q_REACHED_OUT", 9);
    public int F_Q_LEAD_CREATED => GetInt("FID_Q_LEAD_CREATED", 10);

    // --- The Quickbase CRM "Lead" table -----------------------------------------------
    // A different table from the two above, and a different KIND of thing: offers and
    // questions are website form submissions, this is the sales relationship sheet the
    // team maintained by hand. It is what `import-crm-leads` reads into the Leads table.
    //
    // One-time import rather than a live source, so it has no DATA_SOURCE_ flag: after
    // the import the panel is authoritative and this table stops being read.
    //
    // Field ids verified against the live table with `qb-peek` on 2026-08-13. Defaults
    // are the real ids, so setting them is optional — but they are still readable from
    // configuration, because a Quickbase field id is exactly the sort of thing that
    // changes without anyone telling the repository.
    public string TableCrmLeads => _cfg["QB_TABLE_CRM_LEADS"] ?? "";

    public int F_CRM_FIRST_NAME => GetInt("FID_CRM_FIRST_NAME", 6);
    public int F_CRM_LAST_NAME => GetInt("FID_CRM_LAST_NAME", 7);
    public int F_CRM_EMAIL => GetInt("FID_CRM_EMAIL", 9);
    public int F_CRM_PHONE => GetInt("FID_CRM_PHONE", 10);
    public int F_CRM_PROJECT => GetInt("FID_CRM_PROJECT", 11);
    public int F_CRM_COUNTRY => GetInt("FID_CRM_COUNTRY", 12);
    public int F_CRM_SITE_ADDRESS => GetInt("FID_CRM_SITE_ADDRESS", 13);
    public int F_CRM_LANGUAGE => GetInt("FID_CRM_LANGUAGE", 20);
    public int F_CRM_CONTACT_METHOD => GetInt("FID_CRM_CONTACT_METHOD", 21);
    public int F_CRM_SOURCE => GetInt("FID_CRM_SOURCE", 22);
    public int F_CRM_INTEREST => GetInt("FID_CRM_INTEREST", 24);
    public int F_CRM_SIZE => GetInt("FID_CRM_SIZE", 25);
    public int F_CRM_BUDGET => GetInt("FID_CRM_BUDGET", 26);
    public int F_CRM_TIMELINE => GetInt("FID_CRM_TIMELINE", 27);
    public int F_CRM_NOTES => GetInt("FID_CRM_NOTES", 28);
    public int F_CRM_DELIVERY_REGION => GetInt("FID_CRM_DELIVERY_REGION", 29);
    public int F_CRM_STAGE => GetInt("FID_CRM_STAGE", 31);
    public int F_CRM_STATUS => GetInt("FID_CRM_STATUS", 32);
    public int F_CRM_OWNER => GetInt("FID_CRM_OWNER", 33);
    public int F_CRM_NEXT_FOLLOWUP => GetInt("FID_CRM_NEXT_FOLLOWUP", 38);
    public int F_CRM_LAST_CONTACT => GetInt("FID_CRM_LAST_CONTACT", 40);
    public int F_CRM_NEXT_STEP => GetInt("FID_CRM_NEXT_STEP", 41);
    public int F_CRM_CONVERTED => GetInt("FID_CRM_CONVERTED", 45);
    public int F_CRM_CONVERTED_AT => GetInt("FID_CRM_CONVERTED_AT", 46);
    public int F_CRM_LOST_REASON => GetInt("FID_CRM_LOST_REASON", 47);
    public int F_CRM_HOUSE => GetInt("FID_CRM_HOUSE", 52);

    // Built-in Quickbase fields, identical on both lead tables. Needed by the import to
    // key rows and preserve when each lead actually arrived.
    public int F_LEAD_CREATED_ON => GetInt("FID_LEAD_CREATED_ON", 1);   // Date Created
    public int F_LEAD_MODIFIED_ON => GetInt("FID_LEAD_MODIFIED_ON", 2); // Date Modified
    public int F_LEAD_RID => GetInt("FID_LEAD_RID", 3);                 // Record ID#

    // Cases table.
    //
    // These defaults were wrong — off by about +2 from field 9 onwards, and 35-38 for the
    // formula fields. They never bit because every FID_CASE_* is set in user-secrets and App
    // Service, and a set value wins. But GetInt falls back silently when a setting is missing
    // or blank, so ONE absent App Service setting meant reading a different Quickbase field
    // and serving wrong data with no error anywhere. Corrected against the live table so the
    // fallback is now merely redundant rather than dangerous.
    //
    // Removed as dead: SLUG, LOCALE, CURRENCY, DEAL_VALUE and PUBLISHED_AT. None is
    // referenced anywhere, and the first four are blank in configuration because the fields
    // do not exist on the table — so they were resolving to their (wrong) defaults, i.e. to
    // Company Name, Company Sector, Scope and Result.
    public int F_CASE_RID => GetInt("FID_CASE_RID", 3);
    public int F_CASE_PUBLISHED => GetInt("FID_CASE_PUBLISHED", 6);
    public int F_CASE_FEATURED => GetInt("FID_CASE_FEATURED", 7);
    public int F_CASE_SORT => GetInt("FID_CASE_SORT", 8);
    public int F_CASE_COMPANY_NAME => GetInt("FID_CASE_COMPANY_NAME", 9);
    public int F_CASE_COMPANY_SECTOR => GetInt("FID_CASE_COMPANY_SECTOR", 10);
    public int F_CASE_BUYER_NAME => GetInt("FID_CASE_BUYER_NAME", 11);
    public int F_CASE_BUYER_ROLE => GetInt("FID_CASE_BUYER_ROLE", 12);
    public int F_CASE_COUNTRY => GetInt("FID_CASE_COUNTRY", 13);
    public int F_CASE_CITY => GetInt("FID_CASE_CITY", 14);
    public int F_CASE_PUBLIC_LOCATION => GetInt("FID_CASE_PUBLIC_LOCATION", 15);
    public int F_CASE_CATEGORY => GetInt("FID_CASE_CATEGORY", 16);
    public int F_CASE_PRODUCT_NAME => GetInt("FID_CASE_PRODUCT_NAME", 17);
    public int F_CASE_PRODUCT_VARIANT => GetInt("FID_CASE_PRODUCT_VARIANT", 18);
    public int F_CASE_UNITS => GetInt("FID_CASE_UNITS", 19);
    public int F_CASE_YEAR => GetInt("FID_CASE_YEAR", 20);
    public int F_CASE_DELIVERED_AT => GetInt("FID_CASE_DELIVERED_AT", 21);
    public int F_CASE_SCOPE => GetInt("FID_CASE_SCOPE", 22);
    public int F_CASE_RESULT => GetInt("FID_CASE_RESULT", 23);
    public int F_CASE_QUOTE => GetInt("FID_CASE_QUOTE", 24);
    public int F_CASE_RATING => GetInt("FID_CASE_RATING", 25);
    public int F_CASE_LOGO_FILE => GetInt("FID_CASE_LOGO_FILE", 26);
    public int F_CASE_IMAGE_FILE => GetInt("FID_CASE_IMAGE_FILE", 27);
    public int F_CASE_VISIBILITY => GetInt("FID_CASE_VISIBILITY", 28);
    public int F_CASE_IS_PUBLIC => GetInt("FID_CASE_IS_PUBLIC", 29);
    public int F_CASE_PUBLIC_BUYER_LABEL => GetInt("FID_CASE_PUBLIC_BUYER_LABEL", 30);

    // Optional extra image attachment fields on the SAME cases table.
    public IReadOnlyList<int> CaseExtraImageFids => ParseCsvInts(_cfg["QB_CASE_EXTRA_IMAGE_FIDS"]);

    // Child image table. Note this is the SAME Quickbase table as the house images
    // (both bvguw9s2h) — one attachment field, distinguished only by which parent
    // relationship is populated: 6 links to a house, 12 links to a case.
    public int F_CASEIMG_RID => GetInt("FID_CASEIMG_RID", 3);
    public int F_CASEIMG_PARENT => GetInt("FID_CASEIMG_PARENT", 12);
    public int? F_CASEIMG_FILE => GetOptionalInt("FID_CASEIMG_FILE", 9);
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
    // Quickbase built-in "Date Modified" (fid 2 by convention, same as fid 1 = Date
    // Created). Used by the SQL import to fetch only rows changed since the last sync.
    public int? F_REVIEW_MODIFIED => GetOptionalInt("FID_REVIEW_MODIFIED", 2);

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
    // Who gets the internal "new lead" email. Comma- or semicolon-separated; see
    // EmailService.ParseRecipients.
    //
    // This default is load-bearing in a way it did not used to be: since the lead write
    // was hardened, a failed write only avoids becoming a lost lead because this
    // notification reached a human. If App Service sets LEAD_NOTIFY_EMAIL explicitly it
    // overrides this list, so the variable there has to be kept in step.
    public string LeadNotifyEmail => (_cfg["LEAD_NOTIFY_EMAIL"]
        ?? "nlekov@nvc-home4you.eu,vvladimirov@nvc-home4you.eu,tbonin@nvc-home4you.eu").Trim();

    // --- Audit log retention --------------------------------------------------------
    // The owner's decision (2026-08-18): entries older than six months are emailed to them
    // as a CSV and then removed. See AuditArchiveService for why the send has to succeed
    // before anything is deleted.

    /// <summary>
    /// OFF unless explicitly switched on. Deploying the archive job must not start deleting
    /// history by itself — the flag is the difference between a feature and an accident.
    /// </summary>
    public bool AuditArchiveEnabled =>
        string.Equals((_cfg["AUDIT_ARCHIVE_ENABLED"] ?? "").Trim(), "true", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Where the archive goes. Defaulted to the owner, who asked for it, but the service
    /// still refuses to run when this resolves to nothing rather than guessing.
    /// </summary>
    public string AuditArchiveTo =>
        (_cfg["AUDIT_ARCHIVE_TO"] ?? "vvladimirov@nvc-home4you.eu").Trim();

    /// <summary>
    /// How much history stays in the panel. Clamped at one month minimum: a
    /// misconfigured "0" would otherwise archive and delete everything written today.
    /// </summary>
    public int AuditRetentionMonths =>
        int.TryParse((_cfg["AUDIT_RETENTION_MONTHS"] ?? "").Trim(), out var months) && months >= 1
            ? months
            : 6;

    // --- AI-drafted replies ---------------------------------------------------------
    // Billed separately from any Claude subscription: this is an API key from
    // console.anthropic.com, and it joins the six-monthly renewal list.
    //
    // Unset means the draft button is simply absent, the same fail-closed shape as
    // AdminAuthConfigured and BlobConfigured. Drafting is an assist, so losing it must
    // never stop sales replying by hand.
    public string AnthropicApiKey => (_cfg["ANTHROPIC_API_KEY"] ?? "").Trim();

    public bool DraftsConfigured => !string.IsNullOrWhiteSpace(AnthropicApiKey) && SqlConfigured;

    // Effort is the cost dial, and drafting a reply from a thread is not the kind of
    // deep-reasoning work that wants a high setting — the model is summarising a
    // conversation and matching a tone, not solving anything. Medium is the starting
    // point; sweep it against real threads before paying for more.
    public string DraftEffort => (_cfg["DRAFT_EFFORT"] ?? "medium").Trim().ToLowerInvariant();

    // --- Inbound lead mail ------------------------------------------------------------
    // OFF by default, and deliberately a separate switch from GraphConfigured rather than
    // implied by it. Sending needs only Mail.Send; reading the mailbox needs Mail.Read
    // plus an Application Access Policy scoping the app to contact@ — without that policy
    // application permissions are tenant-wide and the app could read every mailbox in the
    // company. Turning this on before that policy exists is the mistake worth making
    // impossible to do by accident, so it takes an explicit opt-in.
    public bool InboundMailEnabled =>
        (_cfg["INBOUND_MAIL_ENABLED"] ?? "").Trim().Equals("true", StringComparison.OrdinalIgnoreCase);

    public bool InboundMailConfigured => InboundMailEnabled && GraphConfigured && SqlConfigured;

    // --- Lead attachments -------------------------------------------------------------
    // A DIFFERENT container from images, and it must stay that way. /api/img is
    // unauthenticated because it serves the public site, so anything sharing the images
    // container is reachable by anyone who guesses a path — which is fine for a house
    // photo and not fine for a customer's contract. Overridable, but the default is
    // deliberately not "images".
    public string LeadFilesContainer
    {
        get
        {
            var raw = (_cfg["BLOB_LEAD_FILES_CONTAINER"] ?? "").Trim();
            return string.IsNullOrWhiteSpace(raw) ? "lead-files" : raw;
        }
    }

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
    // Env var shape: DATA_SOURCE_<ENTITY>=sql (anything else, or unset, means quickbase).
    // The entity is the string passed in, NOT the table name: the gallery is selected by
    // DATA_SOURCE_GALLERY, not DATA_SOURCE_HOUSES. This example said HOUSES for a long time
    // and cost an afternoon — a prerender run read Quickbase prices while production served
    // SQL ones, and the flag that looked right did nothing.
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

    // Write every lead to both stores while only DATA_SOURCE_LEADS decides which one the
    // customer's response depends on. Independent of that flag on purpose: this one is
    // the safe half (a second write that can fail freely) and is what makes the soak in
    // ROADMAP-leads Phase 4 possible. Inert without SQL, like every flag above.
    public bool LeadsDualWrite =>
        SqlConfigured && (_cfg["LEADS_DUAL_WRITE"] ?? "").Trim().Equals("true", StringComparison.OrdinalIgnoreCase);

    // --- Image storage (Quickbase -> Azure Blob) --------------------------------------
    // These two switches are deliberately independent, because they carry very different
    // risk and are worth rolling out separately:
    //
    //   ImagesViaApp  - visible. Changes the URLs in every gallery/cases payload from
    //                   Quickbase's host to ours. Worth turning on by itself: even with no
    //                   Blob container at all, it moves images onto our origin and replaces
    //                   Quickbase's `max-age=7200, private` with a year of `immutable`.
    //   BlobConfigured - invisible. Decides only where the bytes are read from, and
    //                   ImageStore falls back to Quickbase per key, so turning it on before
    //                   the import has finished degrades to today's behaviour rather than
    //                   breaking an image.
    //
    // So the safe order is: import the bytes, set BLOB_CONNECTION_STRING, confirm
    // X-Image-Origin says Blob, then set IMAGES_VIA_APP=true.
    public string BlobConnectionString => (_cfg["BLOB_CONNECTION_STRING"] ?? "").Trim();

    public bool BlobConfigured => !string.IsNullOrWhiteSpace(BlobConnectionString);

    public string BlobImagesContainer
    {
        get
        {
            var raw = (_cfg["BLOB_IMAGES_CONTAINER"] ?? "").Trim();
            return string.IsNullOrWhiteSpace(raw) ? "images" : raw;
        }
    }

    // Whether gallery/cases payloads point at /api/img/... instead of straight at Quickbase.
    // Defaults to false: until it is set, image URLs are byte-for-byte what they are today.
    public bool ImagesViaApp =>
        (_cfg["IMAGES_VIA_APP"] ?? "").Trim().Equals("true", StringComparison.OrdinalIgnoreCase);

    // --- Admin sign-in (Microsoft Entra ID) -------------------------------------------
    // Staff authenticate with the M365 accounts they already have, so the app never stores
    // passwords. Client id and tenant id are not secrets (they appear in the sign-in URL);
    // only the client secret is, and it lives in App Service settings / user-secrets.
    public string EntraClientId => (_cfg["ENTRA_CLIENT_ID"] ?? "").Trim();
    public string EntraTenantId => (_cfg["ENTRA_TENANT_ID"] ?? "").Trim();
    public string EntraClientSecret => (_cfg["ENTRA_CLIENT_SECRET"] ?? "").Trim();

    // Admin routes are only wired up when sign-in can actually work. Without this the
    // panel would be reachable with no authentication at all, which is worse than absent.
    public bool AdminAuthConfigured =>
        !string.IsNullOrWhiteSpace(EntraClientId) &&
        !string.IsNullOrWhiteSpace(EntraTenantId) &&
        !string.IsNullOrWhiteSpace(EntraClientSecret);

    // Optional allow-list of who may reach the admin panel, as a comma-separated list of
    // UPNs/emails. Empty means "anyone in the tenant", which is fine for a small company
    // but should be narrowed once more accounts exist.
    public string[] AdminAllowedUsers =>
        (_cfg["ADMIN_ALLOWED_USERS"] ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(v => v.ToLowerInvariant())
            .ToArray();

    private static string NormalizeRealm(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        var value = raw.Trim().TrimEnd('/');
        if (value.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) value = value[8..];
        if (value.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) value = value[7..];
        return value.TrimEnd('/');
    }
}
