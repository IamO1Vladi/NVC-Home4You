using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// The catalogue at FACTORY COST — what we pay for a thing, as opposed to what we sell it for.
//
// THE ONE RULE THIS TABLE EXISTS TO KEEP: retail lives on the gallery row (House.Price) and
// cost lives here, linked by HouseId. There is exactly one place each number is written.
//
// The alternative — a second free-standing price list — is the 73 m² incident, where two
// stores disagreed on one price for weeks and the site showed whichever answered first.
// A model that is a catalogue house therefore carries no retail price of its own; it points
// at the gallery row and the dashboard reads retail through the link.
public class ProductModel
{
    public int Id { get; set; }

    // Quickbase Record ID# (3) — idempotent import, as on Shipment.
    public long? QuickbaseRecordId { get; set; }

    [Required]
    [MaxLength(200)] public string Name { get; set; } = "";

    // Same loose key set as Purchase.CategoryKey — mostly gallery categories, plus the
    // containers, materials and interiors the gallery has no filter for. See
    // PurchaseCategories for the full reasoning; it is shared deliberately so that "what did
    // we buy" and "what did we sell" can be grouped the same way.
    [MaxLength(60)] public string? CategoryKey { get; set; }

    // The id-link to the gallery, when this is a catalogue model. A real foreign key, so the
    // link follows the house when its title is corrected — exactly as on Lead and Purchase.
    //
    // NULL for materials, fittings and anything else the gallery does not list, which is a
    // large share of the rows here: we buy plenty that we never put in a photograph.
    public int? HouseId { get; set; }
    public House? House { get; set; }

    // The current factory price, USD. A REFERENCE, not a historical record: it prefills the
    // unit cost on a new lot and is never read again afterwards.
    //
    // Editing it must not — and cannot — rewrite what past containers cost, because a lot
    // snapshots its own UnitCost at purchase time. See PurchaseLot.UnitCost, which is the
    // other half of this decision and the one that makes it safe to keep this column
    // current.
    public decimal? FactoryPrice { get; set; }

    // Soft-retire, same as Factory: a model we no longer buy drops out of the dropdown on
    // new lots and keeps every lot that already names it.
    public bool IsActive { get; set; } = true;

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }

    public List<PurchaseLot> Lots { get; set; } = new();
}
