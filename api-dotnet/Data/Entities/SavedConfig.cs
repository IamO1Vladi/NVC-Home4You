using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// A configurator configuration behind a short share code — the thing `/c/{code}` resolves.
//
// THE LAST TABLE ON QUICKBASE, and the one with the sharpest edge: **these codes are already
// in customers' inboxes**, sent by the autoresponder since PR #8. A code that stops
// resolving is a customer clicking a link we sent them and getting a 404, with no way to
// find out it happened. So the migration is additive and the read path falls back to
// Quickbase for anything not found here — see SqlSavedConfigService.
//
// WRITE-ONCE. Nothing ever updates a row: SaveAsync creates it and the code resolves to the
// same configuration forever. That is what makes the 12-hour cache safe, and it is also why
// there is no UpdatedAt.
public class SavedConfig
{
    public int Id { get; set; }

    // The short code from the URL. Base62 minus visually ambiguous characters, 8 chars
    // (12 after five collisions) — see SavedConfigService.CodeAlphabet.
    //
    // Unique, and this is the one constraint that genuinely matters: two rows sharing a
    // code means a customer's link resolves to somebody else's house.
    [Required]
    [MaxLength(32)] public string Code { get; set; } = "";

    // The configuration, stored as opaque JSON exactly as the browser sent it. NVARCHAR(MAX)
    // and deliberately never parsed here: the server has no business knowing the
    // configurator's schema, and a schema change must not be able to strand saved links.
    [Required]
    public string ConfigJson { get; set; } = "";

    // Shown in the resume banner and in the email — "Bulgarian, 58 m² with veranda" — so the
    // customer recognises which of their saved configurations they are opening.
    [MaxLength(200)] public string? ModelLabel { get; set; }

    [MaxLength(10)] public string? Locale { get; set; }

    // Where the code sends the browser. Localized, so a Bulgarian customer's link returns
    // them to the Bulgarian configurator rather than the English one.
    [MaxLength(400)] public string? ReturnPath { get; set; }

    // Only present when the customer used "email me my config". Kept because it is the only
    // record that the link was sent to somebody, which matters if one ever has to be
    // reissued.
    [MaxLength(320)] public string? Email { get; set; }

    // The Quickbase row this was imported from, if it was. Null for configs saved after the
    // cutover. Same idempotent-import guarantee as every other migrated table: a second run
    // updates in place rather than duplicating a code.
    public int? QuickbaseRecordId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
