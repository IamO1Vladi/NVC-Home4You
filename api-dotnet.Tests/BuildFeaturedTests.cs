using System.Collections.Generic;
using Models;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// Covers the pure aggregation that powers GET /api/reviews/featured: average rounding,
// total count, and the "take N" slice. No Quickbase / HTTP involved.
public class BuildFeaturedTests
{
    private static PublicReviewDto Review(double rating, string? comment = "Great service", string? product = null) => new()
    {
        Id = System.Guid.NewGuid().ToString("N"),
        Name = "Test Customer",
        Rating = rating,
        Comment = comment,
        Product = product,
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

    // A product page quotes that product's rating and count, not the site's: the filter runs
    // before the aggregate, not after it.
    [Fact]
    public void Product_narrows_the_items_and_the_aggregate()
    {
        var reviews = new List<PublicReviewDto>
        {
            Review(5, product: "modularBuilds"),
            Review(1, product: "modularHouses"),
            Review(4, product: "modularBuilds"),
            Review(2, product: "steelHouses"),
        };

        var result = ReviewService.BuildFeatured(reviews, 10, "modularBuilds");

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(4.5, result.AverageRating);
        Assert.All(result.Items, r => Assert.Equal("modularBuilds", r.Product));
    }

    [Fact]
    public void Product_filter_happens_before_take()
    {
        // Three newer reviews of another product would fill a "take 2" slice taken first.
        var reviews = new List<PublicReviewDto>
        {
            Review(5, product: "modularHouses"),
            Review(5, product: "modularHouses"),
            Review(5, product: "modularHouses"),
            Review(4, product: "modularBuilds"),
            Review(3, product: "modularBuilds"),
        };

        var result = ReviewService.BuildFeatured(reviews, 2, "modularBuilds");

        Assert.Equal(2, result.Items.Count);
        Assert.All(result.Items, r => Assert.Equal("modularBuilds", r.Product));
    }

    [Fact]
    public void Product_match_is_exact()
    {
        // An older review holds free text, and a key differing only in case is another key.
        var reviews = new List<PublicReviewDto>
        {
            Review(5, product: "Modular house"),
            Review(5, product: "modularbuilds"),
            Review(5, product: null),
        };

        var result = ReviewService.BuildFeatured(reviews, 10, "modularBuilds");

        Assert.Equal(0, result.TotalCount);
        Assert.Empty(result.Items);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void No_product_keeps_the_whole_set(string? product)
    {
        var reviews = new List<PublicReviewDto>
        {
            Review(5, product: "modularBuilds"),
            Review(3, product: "modularHouses"),
        };

        var result = ReviewService.BuildFeatured(reviews, 10, product);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(4.0, result.AverageRating);
    }
}
