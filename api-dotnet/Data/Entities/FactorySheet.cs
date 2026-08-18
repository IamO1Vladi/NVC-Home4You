using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// The factory order sheet: the configuration we hand to the factory for one order — a floor
// plan with window and electrical markers on it, the client's configurator choices, and the
// notes that do not fit anywhere else.
//
// Until 2026-08-18 this lived at /internal/factory-sheet behind a password that shipped in
// the JS bundle, with the ONE copy of the data in ONE browser's localStorage. Clear the site
// data, use another machine, or hand the job to a colleague — and the sheet is gone. Moving
// it here buys real persistence, real sign-in, and an audit trail, for a document that tells
// a factory what to build.
public class FactorySheet
{
    public int Id { get; set; }

    // Who and what the order is for. All optional individually — a sheet often starts as
    // just a plan — but the service requires at least one, because a list full of untitled
    // rows is a list nobody can find anything in.
    [MaxLength(200)] public string? Client { get; set; }
    [MaxLength(200)] public string? Project { get; set; }
    [MaxLength(100)] public string? Reference { get; set; }

    // A DATE at midnight UTC, same convention as Purchase.PurchasedAt: orders are dated in
    // days, and a time component would make "which orders were in July?" depend on the
    // reader's timezone.
    public DateTimeOffset? SheetDate { get; set; }

    // Which language the sheet was written in — it decides the labels on the PRINTED page,
    // which is the artefact the factory actually receives.
    [MaxLength(5)] public string Lang { get; set; } = "bg";

    // The floor plan, as a data URL, downscaled by the panel before upload.
    //
    // A COLUMN, NOT A BLOB, and that is a considered trade rather than laziness: this is one
    // image per factory order — tens of rows a year — and the panel caps it around a quarter
    // of a megabyte before it ever leaves the browser. Wiring a second storage path
    // (container, upload endpoint, authenticated read route) for that volume buys nothing
    // but moving parts. The list query NEVER selects this column; if sheets ever start
    // carrying photo sets, that is the moment to move to LeadFileStore, not before.
    public string? PlanImage { get; set; }
    [MaxLength(260)] public string? PlanName { get; set; }

    // The markers and the spec rows, exactly as the panel sent them.
    //
    // Raw JSON, same reasoning as SavedConfig.ConfigJson: the server has no business
    // parsing the sheet's shape, and a schema change in the editor must not strand every
    // sheet written before it. The server treats these as opaque text and the panel owns
    // what they mean.
    public string WindowsJson { get; set; } = "[]";
    public string ContactsJson { get; set; } = "[]";
    public string SpecsJson { get; set; } = "[]";

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    // Entra UPN, the same free-text convention as everywhere else. This row also appears in
    // the audit log, which is where "who changed what" actually lives.
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }
}
