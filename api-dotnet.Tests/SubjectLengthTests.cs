using System;
using Data.Entities;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// LeadActivities.Subject is nvarchar(400), and SQL Server refuses an overlong value outright.
// Found in the 2026-10-15 review of the reply-recording fix: an inbound subject past 400
// would fail the poller's whole tick on every retry, stalling all inbound filing, and "Re: "
// on a 397–400-character subject would send a reply and then fail to record it.
public class SubjectLengthTests
{
    [Fact]
    public void A_subject_that_fits_is_left_alone()
    {
        Assert.Equal("Re: оферта", LeadActivity.FitSubject("Re: оферта"));
        Assert.Null(LeadActivity.FitSubject(null));

        var exactly = new string('я', LeadActivity.SubjectMaxLength);
        Assert.Same(exactly, LeadActivity.FitSubject(exactly));
    }

    [Fact]
    public void An_overlong_subject_is_cut_to_the_column_not_refused()
    {
        var fitted = LeadActivity.FitSubject("Re: " + new string('x', LeadActivity.SubjectMaxLength));

        Assert.Equal(LeadActivity.SubjectMaxLength, fitted!.Length);
        Assert.StartsWith("Re: x", fitted);
    }

    [Fact]
    public void The_poller_files_a_customer_message_with_an_overlong_subject()
    {
        var subject = new string('S', 1000);

        var activity = LeadMailPoller.InboundActivity(
            new LeadMailPoller.Placement(42, ByConversation: true), "conv-1", "AAMk-long",
            subject, "<p>Hello</p>", "ivan@example.com", DateTimeOffset.Parse("2026-10-15T08:30:00Z"));

        Assert.Equal(LeadActivity.SubjectMaxLength, activity.Subject!.Length);
        Assert.Equal(subject[..LeadActivity.SubjectMaxLength], activity.Subject);
    }
}
