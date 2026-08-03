using System.Text;
using System.Threading;
using Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Services;
using Xunit;

namespace ApiDotnet.Tests;

// On a cache hit the controller returns without touching Quickbase, so these can run with
// a null QuickbaseClient — the same approach as ReviewsControllerValidationTests.
// This is the payoff of Phase 0: proving the response actually carries the headers that
// stop the browser re-requesting immutable image bytes.
public class FilesControllerCacheTests
{
    private const string Path = "v1/files/bxyz/42/7/1";

    private static FilesController NewController(ImageCache images)
    {
        var controller = new FilesController(qb: null!, images);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    [Fact]
    public async Task Cache_hit_serves_bytes_without_calling_quickbase()
    {
        using var images = new ImageCache();
        var payload = Encoding.UTF8.GetBytes("fake-image-bytes");
        images.Set(Path, payload, "image/webp");

        // qb is null: if the controller tried to reach Quickbase this would throw.
        var result = await NewController(images).Get("bxyz", 42, 7, 1, CancellationToken.None);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal(payload, file.FileContents);
        Assert.Equal("image/webp", file.ContentType);
    }

    [Fact]
    public async Task Response_is_marked_public_immutable_for_a_year()
    {
        using var images = new ImageCache();
        images.Set(Path, Encoding.UTF8.GetBytes("bytes"), "image/png");

        var controller = NewController(images);
        await controller.Get("bxyz", 42, 7, 1, CancellationToken.None);

        var cacheControl = controller.Response.Headers["Cache-Control"].ToString();
        Assert.Contains("public", cacheControl);
        Assert.Contains("immutable", cacheControl);
        Assert.Contains("max-age=31536000", cacheControl); // 365 days
    }
}
