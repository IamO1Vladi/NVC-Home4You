using System.Collections.Generic;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Covers the pure aggregation that powers GET /api/reviews/featured: average rounding,
// total count, and the "take N" slice. No Quickbase / HTTP involved.
public class BuildFeaturedTests
{
    private static PublicReviewDto Review(double rating, string? comment = "Great service") => new()
    {
        Id = System.Guid.NewGuid().ToString("N"),
        Name = "Test Customer",
        Rating = rating,
        Comment = comment,
    };

    [Fact]
    public void Empty_input_yields_zero_aggregate_and_no_items()
    {
        var result = ReviewService.BuildFeatured(new List<PublicReviewDto>(), 3);

        Assert.Equal(0, result.TotalCount);
        Assert.Equal(0, result.AverageRating);
        Assert.Empty(result.Items);
    }

    [Fact]
    public void Null_input_is_treated_as_empty()
    {
        var result = ReviewService.BuildFeatured(null!, 3);

        Assert.Equal(0, result.TotalCount);
        Assert.Equal(0, result.AverageRating);
        Assert.Empty(result.Items);
    }

    [Fact]
    public void Average_is_rounded_to_one_decimal()
    {
        // (5 + 4 + 4) / 3 = 4.333... -> 4.3
        var reviews = new List<PublicReviewDto> { Review(5), Review(4), Review(4) };

        var result = ReviewService.BuildFeatured(reviews, 10);

        Assert.Equal(4.3, result.AverageRating);
        Assert.Equal(3, result.TotalCount);
    }

    [Fact]
    public void Unrated_reviews_are_excluded_from_the_average_but_counted_in_total()
    {
        // Two rated (5, 3) average to 4.0; the zero-rated one still counts toward the total.
        var reviews = new List<PublicReviewDto> { Review(5), Review(3), Review(0) };

        var result = ReviewService.BuildFeatured(reviews, 10);

        Assert.Equal(4.0, result.AverageRating);
        Assert.Equal(3, result.TotalCount);
    }

    [Fact]
    public void All_unrated_yields_zero_average_without_dividing_by_zero()
    {
        var reviews = new List<PublicReviewDto> { Review(0), Review(0) };

        var result = ReviewService.BuildFeatured(reviews, 10);

        Assert.Equal(0, result.AverageRating);
        Assert.Equal(2, result.TotalCount);
    }

    [Fact]
    public void Take_limits_returned_items_but_not_total_count()
    {
        var reviews = new List<PublicReviewDto> { Review(5), Review(5), Review(5), Review(5) };

        var result = ReviewService.BuildFeatured(reviews, 2);

        Assert.Equal(2, result.Items.Count);
        Assert.Equal(4, result.TotalCount);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Non_positive_take_falls_back_to_three(int take)
    {
        var reviews = new List<PublicReviewDto>
        {
            Review(5), Review(5), Review(5), Review(5), Review(5),
        };

        var result = ReviewService.BuildFeatured(reviews, take);

        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public void Take_larger_than_input_returns_all_items()
    {
        var reviews = new List<PublicReviewDto> { Review(5), Review(4) };

        var result = ReviewService.BuildFeatured(reviews, 50);

        Assert.Equal(2, result.Items.Count);
    }
}
