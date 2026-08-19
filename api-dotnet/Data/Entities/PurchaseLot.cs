using System;
using System.ComponentModel.DataAnnotations;

namespace Data.Entities;

// One line on a container: this many of that model, at this price each.
//
// The smallest unit of procurement, and the level at which "what did we actually pay for
// this house?" becomes answerable.
public class PurchaseLot
{
    public int Id { get; set; }

    // Both required. A lot is meaningless detached from the container it rode in or the
    // model it is of — unlike a Purchase, which can legitimately be recorded before anyone
    // knows the factory, there is no state of the world where a line item has no line.
    public int ShipmentId { get; set; }
    public Shipment? Shipment { get; set; }

    public int ProductModelId { get; set; }
    public ProductModel? ProductModel { get; set; }

    // Greater than zero, enforced in validation rather than by a check constraint: the panel
    // can say "how many?" where the database can only refuse the save.
    public int Quantity { get; set; }

    // USD, and A SNAPSHOT AT PURCHASE TIME — the single most important column in this table.
    //
    // It is prefilled from ProductModel.FactoryPrice and then belongs to this lot forever.
    // If it were read live from the model instead, a factory price correction next year would
    // silently reprice every container we ever bought, and last year's margin report would
    // change without anyone editing last year's data.
    //
    // Required: a lot with no unit cost contributes nothing to a landed cost, so it would be
    // a row that quietly makes the total wrong rather than one that is visibly incomplete.
    public decimal UnitCost { get; set; }

    // NOTE: no LineTotal column. It is Quantity * UnitCost — see Purchase.LeftToPay and
    // Shipment's missing GoodsCost for the same rule. Computed in the DTO.

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
    [MaxLength(320)] public string? UpdatedByUpn { get; set; }
}
