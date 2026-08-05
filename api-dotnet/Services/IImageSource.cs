using System.Threading;
using System.Threading.Tasks;

namespace Services;

/// <summary>One image's bytes and the content type to serve them as.</summary>
public sealed record ImageBytes(byte[] Bytes, string ContentType);

// A place image bytes can be read from, keyed by ImageKey. Two implementations —
// BlobImageSource and QuickbaseImageSource — and ImageStore chains them so a key that has
// not been copied to Blob yet still resolves.
//
// Returning null for "not here" rather than throwing is what makes that chain cheap: a miss
// on Blob is the expected case throughout the migration, not an error.
public interface IImageSource
{
    Task<ImageBytes?> TryGetAsync(string key, CancellationToken ct);
}
