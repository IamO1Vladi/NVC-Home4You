using System.Threading;
using Controllers;
using Microsoft.AspNetCore.Mvc;
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
}
