using System;
using System.Collections.Generic;
using System.Text.Json;
using Data.Entities;
using Microsoft.Extensions.Configuration;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// The judgement calls in the CRM lead import.
//
// The copying is not the risky part; the mapping is. Quickbase carries nine Bulgarian
// stages plus a separate Open/Closed flag, and we have six stages of which Won and Lost
// ARE closed. Every reconciliation of that is a decision, and a wrong one shows up months
// later as a customer sitting in the wrong column with nothing to trace it back to.
//
// The stage vocabulary below is the real one, read off the live table with
// `dotnet run -- qb-values bvucxewvr 31,32` on 2026-08-13.
public class CrmLeadImportTests
{
    private static EnvConfig Config() =>
        new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build());

    // Quickbase answers with {"6": {"value": ...}}, so the tests speak the same shape the
    // importer reads rather than a convenient stand-in for it.
    private static QbRec Row(params (int Fid, object? Value)[] fields)
    {
        var payload = new Dictionary<string, object?>();
        foreach (var (fid, value) in fields)
            payload[fid.ToString()] = new Dictionary<string, object?> { ["value"] = value };

        return JsonSerializer.Deserialize<QbRec>(JsonSerializer.Serialize(payload))!;
    }

    // --- Stages ------------------------------------------------------------------------

    [Theory]
    [InlineData("Първи Контакт", LeadStatuses.New)]
    [InlineData("Опитали сме за контакт", LeadStatuses.Contacted)]
    [InlineData("Свързали сме се", LeadStatuses.Contacted)]
    [InlineData("Пратена е оферта", LeadStatuses.Quoted)]
    [InlineData("В комуникация за сделка", LeadStatuses.Negotiating)]
    [InlineData("Готова сделка!", LeadStatuses.Won)]
    [InlineData("Загубна сделка!", LeadStatuses.Lost)]
    public void Every_stage_in_the_live_table_maps_to_one_of_ours(string stage, string expected)
    {
        var (status, _) = CrmLeadImportService.MapStatus(
            Row((31, stage), (32, "Open")), Config());

        Assert.Equal(expected, status);
    }

    [Fact]
    public void Waiting_for_a_quote_is_not_the_same_as_having_sent_one()
    {
        // "Чакат Оферта" is "they are waiting for a quote" — we owe them one and have not
        // sent it. Reading it as Quoted would make the pipeline claim work nobody did.
        var (status, _) = CrmLeadImportService.MapStatus(
            Row((31, "Чакат Оферта"), (32, "Open")), Config());

        Assert.Equal(LeadStatuses.Contacted, status);
    }

    [Fact]
    public void A_tried_but_failed_contact_still_counts_as_further_along_than_untouched()
    {
        // "Опитали сме за контакт" is an attempt rather than a conversation, but a lead
        // somebody has chased is not in the same state as one nobody has opened.
        var (status, _) = CrmLeadImportService.MapStatus(
            Row((31, "Опитали сме за контакт"), (32, "Open")), Config());

        Assert.NotEqual(LeadStatuses.New, status);
    }

    [Fact]
    public void Quickbases_own_typo_is_mapped_as_spelled()
    {
        // "Пред сдекла" is in the live table 2 times. What is in the table is what the
        // import has to read, however it is spelled.
        Assert.Equal(LeadStatuses.Negotiating, CrmLeadImportService.StageMap["Пред сдекла"]);
    }

    [Fact]
    public void An_unrecognised_stage_becomes_New_rather_than_being_dropped()
    {
        var (status, _) = CrmLeadImportService.MapStatus(
            Row((31, "Something nobody has seen"), (32, "Open")), Config());

        Assert.Equal(LeadStatuses.New, status);
    }

    // --- Open / Closed ------------------------------------------------------------------

    [Fact]
    public void Closed_and_not_won_means_lost()
    {
        // Half the live table is Closed while still sitting on a mid-pipeline stage —
        // leads the team gave up on, most with a Lost Reason of "No response". Leaving
        // them Open would drop 120 dead leads onto the working board on day one.
        var (status, closedAt) = CrmLeadImportService.MapStatus(
            Row((31, "Свързали сме се"), (32, "Closed"), (2, "2026-05-04T09:00:00Z")), Config());

        Assert.Equal(LeadStatuses.Lost, status);
        Assert.NotNull(closedAt);
    }

    [Fact]
    public void Converted_wins_over_whatever_the_stage_says()
    {
        // Converted is a fact about the outcome; a stage is somebody's note about
        // progress. Where they disagree, the fact wins.
        var (status, _) = CrmLeadImportService.MapStatus(
            Row((31, "Свързали сме се"), (32, "Closed"), (45, true)), Config());

        Assert.Equal(LeadStatuses.Won, status);
    }

    [Fact]
    public void A_closed_lead_always_carries_a_closing_date()
    {
        // ClosedAt is what the archive rule runs on. A null never archives, so the board
        // would keep every finished lead in view forever.
        var (_, closedAt) = CrmLeadImportService.MapStatus(
            Row((31, "Готова сделка!"), (32, "Closed")), Config());

        Assert.NotNull(closedAt);
    }

    [Fact]
    public void The_conversion_date_is_preferred_over_the_last_edit()
    {
        var (_, closedAt) = CrmLeadImportService.MapStatus(
            Row((31, "Готова сделка!"), (46, "2026-03-01T10:00:00Z"), (2, "2026-07-19T12:00:00Z")),
            Config());

        Assert.Equal(2026, closedAt!.Value.Year);
        Assert.Equal(3, closedAt.Value.Month);
    }

    [Fact]
    public void An_open_lead_carries_no_closing_date()
    {
        var (status, closedAt) = CrmLeadImportService.MapStatus(
            Row((31, "Свързали сме се"), (32, "Open")), Config());

        Assert.True(LeadStatuses.IsOpen(status));
        Assert.Null(closedAt);
    }

    // --- Interest, and whether it leads anywhere ----------------------------------------

    [Theory]
    [InlineData("Сглобяема къща", HouseCategories.Prefab)]
    [InlineData("Модулна / Контейнерна къща", HouseCategories.Modular)]
    [InlineData("Modular Houses", HouseCategories.Modular)]
    [InlineData("Modular Builds", HouseCategories.Modular)]
    public void A_product_line_the_gallery_filters_on_becomes_that_category(string interest, string expected)
    {
        Assert.Equal(expected, CrmLeadImportService.MapInterestCategory(new[] { interest }));
    }

    [Theory]
    [InlineData("Бокс къща")]
    [InlineData("Контейнер")]
    [InlineData("Logistics")]
    [InlineData("Interiors")]
    public void A_product_line_the_gallery_has_no_filter_for_is_kept_verbatim(string interest)
    {
        // Not forced into a gallery key, which would file it under a category it does not
        // belong to, and not dropped, which would lose what the customer asked for. Kept
        // as itself — and the panel then knows not to offer a model list for it.
        var category = CrmLeadImportService.MapInterestCategory(new[] { interest });

        Assert.Equal(interest, category);
        Assert.False(HouseCategories.IsValid(category));
    }

    [Fact]
    public void A_gallery_category_wins_over_one_the_gallery_cannot_show()
    {
        // Both are ticked on 5 live records. The gallery one is the more useful answer,
        // because it is the one that leads to a list of models.
        var category = CrmLeadImportService.MapInterestCategory(
            new[] { "Бокс къща", "Modular Houses" });

        Assert.Equal(HouseCategories.Modular, category);
    }

    [Fact]
    public void No_interest_at_all_leaves_the_category_empty()
    {
        // Rather than a guess that then shows a model dropdown for a category nobody chose.
        Assert.Null(CrmLeadImportService.MapInterestCategory(Array.Empty<string>()));
    }
}
