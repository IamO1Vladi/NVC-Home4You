using Data.Entities;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The import mapping rules (ROADMAP #21).
//
// Everything here encodes one sentence from the owner — "Quickbase was poorly built, so we
// made workarounds" — into arithmetic: the EUR entries convert BACK to USD through each
// shipment's own rate, an explicit EUR override outranks the USD column it bypassed, and
// the Bulgarian type labels map onto the same category keys the sales side uses.
public class BillingImportTests
{
    // --- Currency: undoing the workaround -----------------------------------------------

    [Fact]
    public void Eur_converts_back_to_usd_through_the_shipments_own_rate()
    {
        // €920 at 0.92 EUR/USD is the $1,000 that was actually paid.
        Assert.Equal(1_000m, BillingImportService.ToUsd(920m, 0.92m));
    }

    [Fact]
    public void No_rate_means_no_conversion_not_a_guess()
    {
        // A missing or zero FX cannot be papered over with today's rate — the shipment
        // imports with empty costs and the report says so.
        Assert.Null(BillingImportService.ToUsd(920m, null));
        Assert.Null(BillingImportService.ToUsd(920m, 0m));
        Assert.Null(BillingImportService.ToUsd(null, 0.92m));
    }

    [Fact]
    public void Conversion_rounds_to_cents_away_from_zero()
    {
        // 100 / 0.93 = 107.5268… — money lands on two decimals, predictably.
        Assert.Equal(107.53m, BillingImportService.ToUsd(100m, 0.93m));
    }

    // --- Unit cost: the override chain, as QB itself resolved it ------------------------

    [Fact]
    public void The_usd_column_wins_when_no_eur_override_was_typed()
    {
        Assert.Equal(9_000m, BillingImportService.ResolveUnitCostUsd(9_000m, null, 0.92m));
        Assert.Equal(9_000m, BillingImportService.ResolveUnitCostUsd(9_000m, 0m, 0.92m));
    }

    [Fact]
    public void An_eur_override_outranks_the_usd_column_it_bypassed()
    {
        // QB's own formula: an EUR override short-circuits the USD path entirely, so the
        // USD column may hold a value reality never used. €9,200 at 0.92 → $10,000.
        Assert.Equal(10_000m, BillingImportService.ResolveUnitCostUsd(9_000m, 9_200m, 0.92m));
    }

    [Fact]
    public void An_unconvertible_eur_override_falls_back_to_the_usd_figure_qb_used()
    {
        // Review fix (2026-08-19): with no FX on the shipment the override cannot convert,
        // and the first draft resolved to null → an imported UnitCost of 0 — a CLAIM that
        // deflates every downstream sum. QB's own USD figure is merely approximate; zero
        // is wrong. Only when both sources are absent is there truly nothing to resolve.
        Assert.Equal(9_000m, BillingImportService.ResolveUnitCostUsd(9_000m, 9_200m, null));
        Assert.Equal(9_000m, BillingImportService.ResolveUnitCostUsd(9_000m, 9_200m, 0m));
        Assert.Null(BillingImportService.ResolveUnitCostUsd(null, 9_200m, null));
    }

    // --- Record ids: the ".0" that broke the first dry-run -------------------------------

    [Theory]
    [InlineData("2", 2L)]
    [InlineData("2.0", 2L)]     // how QB actually serialises numeric reference fields
    [InlineData("19", 19L)]
    public void A_record_id_parses_with_or_without_quickbases_trailing_zero(string raw, long expected)
    {
        Assert.Equal(expected, BillingImportService.RidOf(raw));
    }

    [Theory]
    [InlineData("2.5")]         // genuinely fractional — not a record id, refuse
    [InlineData("0")]
    [InlineData("-3")]
    [InlineData("")]
    [InlineData(null)]
    public void A_non_id_value_resolves_to_nothing(string? raw)
    {
        Assert.Null(BillingImportService.RidOf(raw));
    }

    // --- The type map --------------------------------------------------------------------

    [Theory]
    [InlineData("Контейнери", "container")]
    [InlineData("Бокс къщи", "prefab")]
    [InlineData("Модулни Къщи", "modular")]
    [InlineData("Гаражи", "garage")]
    [InlineData("Друго", "other")]
    public void Every_quickbase_model_type_lands_on_a_sales_side_key(string qb, string expected)
    {
        var key = BillingImportService.MapModelType(qb);

        Assert.Equal(expected, key);
        // The same key set sales uses — see PurchaseCategories — so "what we bought" and
        // "what we sold" group identically after the import.
        Assert.True(PurchaseCategories.IsValid(key));
    }

    [Fact]
    public void An_unknown_type_maps_to_nothing_and_is_reported_not_guessed()
    {
        Assert.Null(BillingImportService.MapModelType("Хеликоптери"));
        Assert.Null(BillingImportService.MapModelType(""));
        Assert.Null(BillingImportService.MapModelType(null));
    }

    // --- The expense categories: every live QB label resolves ---------------------------

    [Fact]
    public void Every_quickbase_expense_label_maps_onto_exactly_one_key()
    {
        // The list was read from the live table (2026-08-19); if a label here stops
        // resolving, 81 historical rows start landing in "uncategorised" silently.
        foreach (var (key, label) in ExpenseCategories.QuickbaseLabels)
        {
            Assert.Equal(key, ExpenseCategories.FromQuickbaseLabel(label));
        }
    }

    [Theory]
    [InlineData("Влади", "draw-vladi")]
    [InlineData("Цецо", "draw-ceco")]
    [InlineData("Ники", "draw-niki")]
    [InlineData("  Claude AI  ", "claude-ai")]
    [InlineData("НОТАРИУС", "notary")]
    public void The_label_lookup_survives_spacing_and_case(string label, string expected)
    {
        Assert.Equal(expected, ExpenseCategories.FromQuickbaseLabel(label));
    }

    [Fact]
    public void An_unknown_label_resolves_to_null_never_to_other()
    {
        // "other" is a category a person chose; an unmapped import row is a problem to
        // report, and conflating the two would bury the report line that says so.
        Assert.Null(ExpenseCategories.FromQuickbaseLabel("Нещо ново"));
        Assert.Null(ExpenseCategories.FromQuickbaseLabel(""));
        Assert.Null(ExpenseCategories.FromQuickbaseLabel(null));
    }
}
