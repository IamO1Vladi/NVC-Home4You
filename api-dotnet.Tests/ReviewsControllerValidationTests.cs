using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Services;
using Models;
using Xunit;

namespace ApiDotnet.Tests;

// The POST validation guards run before the service is ever touched, so we can exercise
// them with a controller whose service dependency is never invoked.
public class ReviewsControllerValidationTests
{
    private static ReviewsController NewController() => new(store: null!);

    private static ReviewDto Valid(
        string name = "Jane Doe",
        string email = "jane@example.com",
        string comment = "Excellent build quality.",
        int rating = 5) =>
        new(name, Company: null, Email: email, Location: null, Product: null, Comment: comment, Rating: rating);

    [Fact]
    public async Task Null_body_is_rejected()
    {
        var result = await NewController().Post(null, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Missing_name_is_rejected(string name)
    {
        var result = await NewController().Post(Valid(name: name), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Missing_email_is_rejected(string email)
    {
        var result = await NewController().Post(Valid(email: email), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Missing_comment_is_rejected(string comment)
    {
        var result = await NewController().Post(Valid(comment: comment), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(-1)]
    [InlineData(100)]
    public async Task Out_of_range_rating_is_rejected(int rating)
    {
        var result = await NewController().Post(Valid(rating: rating), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    // GET featured, through the store's own GetFeaturedAsync so the filter that a product
    // page relies on is the one the endpoint actually runs.
    private sealed class ListStore : IReviewStore
    {
        public List<PublicReviewDto> Approved { get; } = new()
        {
            new() { Id = "1", Name = "Ivan", Rating = 5, Product = "modularBuilds" },
            new() { Id = "2", Name = "Maria", Rating = 1, Product = "modularHouses" },
            new() { Id = "3", Name = "Petar", Rating = 4, Product = "modularBuilds" },
        };

        public int Reads { get; private set; }

        public Task<List<PublicReviewDto>> GetApprovedReviewsAsync(CancellationToken ct)
        {
            Reads++;
            return Task.FromResult(Approved);
        }

        public Task<long> CreatePendingReviewAsync(ReviewDto dto, CancellationToken ct) => throw new NotSupportedException();
    }

    private static ReviewsController FeaturedController(IReviewStore store) => new(store)
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
    };

    [Fact]
    public async Task Featured_without_a_product_covers_every_review()
    {
        var result = await FeaturedController(new ListStore()).Featured(12, null, CancellationToken.None);

        var dto = Assert.IsType<FeaturedReviewsResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal(3, dto.TotalCount);
        Assert.Equal(3.3, dto.AverageRating);
    }

    [Fact]
    public async Task Featured_with_a_product_counts_only_that_product()
    {
        var result = await FeaturedController(new ListStore()).Featured(12, " modularBuilds ", CancellationToken.None);

        var dto = Assert.IsType<FeaturedReviewsResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal(2, dto.TotalCount);
        Assert.Equal(4.5, dto.AverageRating);
        Assert.Equal(new[] { "Ivan", "Petar" }, dto.Items.ConvertAll(r => r.Name));
    }

    [Theory]
    [InlineData("modular builds")]
    [InlineData("modularBuilds'--")]
    [InlineData("<script>")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    public async Task Featured_refuses_a_product_that_cannot_be_a_key(string product)
    {
        var store = new ListStore();

        var result = await FeaturedController(store).Featured(3, product, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, store.Reads);
    }
}
