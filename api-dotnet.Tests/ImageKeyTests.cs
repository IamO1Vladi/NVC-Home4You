using Services;
using Xunit;

namespace ApiDotnet.Tests;

// ImageKey is the identity used for the blob name, the memory cache entry and the public
// /api/img/{key} route — and the key is also what the Quickbase fallback appends to the
// realm host. That last part makes it attacker-reachable, so the rejection cases below
// matter as much as the happy path.
public class ImageKeyTests
{
    private const string Realm = "vladimirbuilder.quickbase.com";

    [Fact]
    public void An_absolute_up_url_normalises_to_its_path()
    {
        var key = ImageKey.TryNormalize($"https://{Realm}/up/bvk4n834b/g/rcy/eg/vb", Realm);

        Assert.Equal("up/bvk4n834b/g/rcy/eg/vb", key);
    }

    [Fact]
    public void The_decimal_files_shape_normalises_too()
    {
        // The other shape Quickbase hands out, straight from the attachment JSON. Both must
        // work without decoding base-36 — that's the reason the path itself is the key.
        var key = ImageKey.TryNormalize($"https://{Realm}/files/bvk4n834b/466/16/11", Realm);

        Assert.Equal("files/bvk4n834b/466/16/11", key);
    }

    [Fact]
    public void A_filename_suffix_is_kept()
    {
        // GalleryService builds /up/... URLs with the filename appended; it is part of the
        // path Quickbase serves, so it has to stay part of the key.
        var key = ImageKey.TryNormalize($"https://{Realm}/up/bvk4n834b/a/r466/e16/v11/logo3.jpg", Realm);

        Assert.Equal("up/bvk4n834b/a/r466/e16/v11/logo3.jpg", key);
    }

    [Fact]
    public void Normalisation_is_idempotent_through_our_own_url()
    {
        // The import command collects keys by reading the gallery/cases payloads. Once
        // IMAGES_VIA_APP is on those contain /api/img/{key}, so without unwrapping here the
        // importer would find nothing to migrate and report success.
        var once = ImageKey.TryNormalize($"https://{Realm}/up/bvk4n834b/g/rcy/eg/vb", Realm);
        var twice = ImageKey.TryNormalize($"/api/img/{once}", Realm);

        Assert.Equal(once, twice);
    }

    [Theory]
    [InlineData("/up/bvk4n834b/g/rcy/eg/vb")]
    [InlineData("up/bvk4n834b/g/rcy/eg/vb")]
    public void Relative_forms_are_accepted(string raw)
    {
        Assert.Equal("up/bvk4n834b/g/rcy/eg/vb", ImageKey.TryNormalize(raw, Realm));
    }

    [Fact]
    public void A_query_string_is_dropped_so_one_image_has_one_key()
    {
        // Otherwise a request token in the query forks the cache and blob entry per visitor.
        var key = ImageKey.TryNormalize($"https://{Realm}/up/bvk4n834b/g/rcy/eg/vb?t=abc123", Realm);

        Assert.Equal("up/bvk4n834b/g/rcy/eg/vb", key);
    }

    [Fact]
    public void A_url_on_another_host_is_rejected()
    {
        // The key is appended to the realm host by the fallback. If an arbitrary host could
        // become a key, /api/img/{key} would be a server-side request forgery.
        Assert.Null(ImageKey.TryNormalize("https://evil.test/up/x/g/rb/e4/vb", Realm));
    }

    [Fact]
    public void A_lookalike_host_is_rejected()
    {
        // Suffix matching without the leading dot would accept this.
        Assert.Null(ImageKey.TryNormalize("https://quickbase.com.evil.test/up/x/g/rb/e4/vb", Realm));
    }

    [Theory]
    [InlineData("up/../../etc/passwd")]
    [InlineData("files/x/../../../secret")]
    [InlineData("up/x//y")]
    public void Traversal_and_empty_segments_are_rejected(string raw)
    {
        Assert.Null(ImageKey.TryNormalize(raw, Realm));
        Assert.False(ImageKey.IsValid(raw));
    }

    [Theory]
    [InlineData("admin/secrets")]
    [InlineData("api/admin/reviews")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Anything_outside_the_attachment_paths_is_rejected(string? raw)
    {
        // Only /files/ and /up/ are attachment paths. Without this the fallback could be
        // pointed at any path on the Quickbase realm, authenticated as our app.
        Assert.Null(ImageKey.TryNormalize(raw, Realm));
    }

    // The real gallery payload is almost entirely URLs like this one: percent-encoded spaces
    // and Cyrillic in the attachment name. The key is stored decoded because ASP.NET decodes
    // route values before the controller sees them — an encoded key would never match the key
    // an incoming request produces, and every one of these images would miss Blob and quietly
    // fall back to Quickbase forever.
    private const string EncodedRealUrl =
        "https://vladimirbuilder.quickbase.com/up/bvguw9s2h/a/r41/e9/v1/" +
        "Copy%20of%20%D0%9E%D1%84%D0%B5%D1%80%D1%82%D0%B0%20%D0%B7%D0%B0%2060%D0%BC2%282%29.jpg";

    private const string DecodedKey =
        "up/bvguw9s2h/a/r41/e9/v1/Copy of Оферта за 60м2(2).jpg";

    [Fact]
    public void An_encoded_attachment_name_normalises_to_the_decoded_key()
    {
        Assert.Equal(DecodedKey, ImageKey.TryNormalize(EncodedRealUrl, Realm));
    }

    [Fact]
    public void The_key_round_trips_back_to_the_original_quickbase_url()
    {
        // If this drifts, the fallback requests a URL Quickbase does not have and every
        // unmigrated image 404s.
        //
        // Compared as decoded paths, not as literal strings: Uri leaves sub-delims such as
        // '(' unescaped where Quickbase's own URL writes %28. Checked against the live host —
        // both spellings return the same 99,708-byte image — so the encodings are equivalent
        // and pinning the exact bytes of the URL would be pinning a detail of Uri, not a
        // property we depend on.
        var key = ImageKey.TryNormalize(EncodedRealUrl, Realm)!;
        var url = ImageKey.ToQuickbaseUrl(key, Realm);

        Assert.NotNull(url);
        Assert.Equal(
            Uri.UnescapeDataString(new Uri(EncodedRealUrl).AbsolutePath),
            Uri.UnescapeDataString(url!.AbsolutePath));
        Assert.Equal(new Uri(EncodedRealUrl).Host, url.Host);
    }

    [Fact]
    public void The_public_path_round_trips_through_url_decoding()
    {
        // ToPublicPath is what lands in the payload; ASP.NET decodes it back into a route
        // value. That decoded value has to be the key again, or the request misses.
        var key = ImageKey.TryNormalize(EncodedRealUrl, Realm)!;
        var publicPath = ImageKey.ToPublicPath(key);

        Assert.StartsWith("/api/img/", publicPath);
        Assert.DoesNotContain(' ', publicPath);

        var asRouteValue = Uri.UnescapeDataString(publicPath["/api/img/".Length..]);
        Assert.Equal(key, asRouteValue);
    }

    [Fact]
    public void Encoded_traversal_is_rejected_after_decoding()
    {
        // %2e%2e only becomes ".." once decoded, so validating the raw string would pass it.
        Assert.Null(ImageKey.TryNormalize("up/%2e%2e/%2e%2e/etc/passwd", Realm));
    }

    [Theory]
    [InlineData("up/x\\..\\y")]
    [InlineData("up/x:stream")]
    [InlineData("files/")]
    [InlineData("up/")]
    public void Separator_tricks_and_bare_roots_are_rejected(string raw)
    {
        Assert.False(ImageKey.IsValid(raw));
    }

    [Fact]
    public void An_uploaded_key_is_valid_but_has_no_quickbase_origin()
    {
        // Admin uploads exist only in Blob. Asking Quickbase for one would be a round trip
        // that can only 404, on every request, for every image the admin panel ever adds.
        const string key = "uploads/gallery/0f8fad5bd9cb469fa16570867728950e.webp";

        Assert.True(ImageKey.IsValid(key));
        Assert.False(ImageKey.HasQuickbaseOrigin(key));
        Assert.Null(ImageKey.ToQuickbaseUrl(key, Realm));
    }

    [Fact]
    public void Quickbase_keys_still_report_an_origin()
    {
        Assert.True(ImageKey.HasQuickbaseOrigin("up/bvk4n834b/g/rcy/eg/vb"));
        Assert.True(ImageKey.HasQuickbaseOrigin("files/bvk4n834b/466/16/11"));
    }

    [Fact]
    public void An_upload_key_ignores_the_supplied_filename()
    {
        // The uploader controls this string. Carrying it through would be a traversal vector
        // and a collision source; only a known-safe extension survives.
        var key = ImageKey.NewUploadKey("gallery", "../../etc/passwd.jpg");

        Assert.StartsWith("uploads/gallery/", key);
        Assert.EndsWith(".jpg", key);
        Assert.DoesNotContain("..", key);
        Assert.DoesNotContain("passwd", key);
        Assert.True(ImageKey.IsValid(key));
    }

    [Theory]
    [InlineData("photo.svg")]   // scriptable
    [InlineData("payload.html")]
    [InlineData("archive.zip")]
    [InlineData(null)]
    public void An_unexpected_upload_extension_is_not_carried_over(string? name)
    {
        var key = ImageKey.NewUploadKey("gallery", name);

        Assert.EndsWith(".bin", key);
        Assert.True(ImageKey.IsValid(key));
    }

    [Fact]
    public void Upload_keys_are_unique_per_call()
    {
        // Two people uploading "photo.jpg" to the same house must not overwrite each other.
        Assert.NotEqual(
            ImageKey.NewUploadKey("gallery", "photo.jpg"),
            ImageKey.NewUploadKey("gallery", "photo.jpg"));
    }

    [Fact]
    public void An_unsafe_upload_scope_is_reduced_to_something_safe()
    {
        var key = ImageKey.NewUploadKey("../gallery/../..", "photo.jpg");

        Assert.True(ImageKey.IsValid(key));
        Assert.DoesNotContain("..", key);
    }

    [Fact]
    public void A_sibling_quickbase_host_is_accepted()
    {
        // Attachments are sometimes served from a different subdomain than the realm.
        Assert.Equal(
            "up/x/g/rb/e4/vb",
            ImageKey.TryNormalize("https://other.quickbase.com/up/x/g/rb/e4/vb", Realm));
    }
}
