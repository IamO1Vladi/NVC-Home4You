using System.Collections.Generic;
using System.Text.Json;
using Models;
using Xunit;

namespace ApiDotnet.Tests;

// The failure this whole change exists to prevent: Quickbase answers 200 when it accepts
// the request but rejects the record, so "HTTP succeeded" never meant "the lead exists".
// Before this, metadata.lineErrors was not even modelled, so the reason was discarded
// during deserialization and the failure left nothing in a log to find afterwards.
public class LeadWriteFailureTests
{
    private static QbCreateResult Parse(string json) =>
        JsonSerializer.Deserialize<QbCreateResult>(json)!;

    [Fact]
    public void A_rejected_record_is_recognised_even_though_the_request_returned_200()
    {
        // Shape taken from Quickbase's POST /records response: lineErrors lives inside
        // metadata, keyed by the 1-based line number in the submitted data array.
        var res = Parse("""
        {
          "metadata": {
            "lineErrors": { "1": ["Incompatible value for field with ID \"6\"."] },
            "createdRecordIds": [],
            "totalNumberOfRecordsProcessed": 1
          },
          "data": []
        }
        """);

        Assert.True(res.HasLineErrors);
        Assert.Contains("field with ID", res.DescribeLineErrors());
        Assert.Contains("line 1", res.DescribeLineErrors());
    }

    [Fact]
    public void The_reason_survives_deserialization_for_every_rejected_line()
    {
        var res = Parse("""
        {
          "metadata": {
            "lineErrors": { "1": ["Bad email.", "Missing name."], "2": ["Bad phone."] }
          }
        }
        """);

        var described = res.DescribeLineErrors()!;
        Assert.Contains("Bad email.", described);
        Assert.Contains("Missing name.", described);
        Assert.Contains("Bad phone.", described);
    }

    [Fact]
    public void A_clean_write_reports_no_errors()
    {
        var res = Parse("""
        { "metadata": { "createdRecordIds": [4231], "totalNumberOfRecordsProcessed": 1 } }
        """);

        Assert.False(res.HasLineErrors);
        Assert.Null(res.DescribeLineErrors());
        Assert.Equal(4231, res.metadata!.createdRecordIds![0]);
    }

    [Fact]
    public void An_empty_lineErrors_object_is_not_a_failure()
    {
        var res = Parse("""{ "metadata": { "lineErrors": {} } }""");

        Assert.False(res.HasLineErrors);
    }

    [Fact]
    public void A_missing_metadata_block_is_not_mistaken_for_a_failure()
    {
        // Absence of lineErrors is not evidence of rejection; the record id check is what
        // catches this case, and it must not be short-circuited by a false positive here.
        var res = Parse("""{ "data": [] }""");

        Assert.False(res.HasLineErrors);
        Assert.Null(res.DescribeLineErrors());
    }
}

// LeadWriteResult replaced an int? whose null meant three different things at once:
// "not configured", "rejected", and "worked but told us nothing" — all reported to the
// customer as success.
public class LeadWriteResultTests
{
    [Fact]
    public void Success_carries_the_record_id_and_no_error()
    {
        var result = LeadWriteResult.Succeeded(99);

        Assert.True(result.Ok);
        Assert.Equal(99, result.RecordId);
        Assert.Null(result.Error);
    }

    [Fact]
    public void Failure_carries_a_reason_and_no_record_id()
    {
        var result = LeadWriteResult.Failed("Quickbase rejected the record.");

        Assert.False(result.Ok);
        Assert.Null(result.RecordId);
        Assert.Equal("Quickbase rejected the record.", result.Error);
    }
}
