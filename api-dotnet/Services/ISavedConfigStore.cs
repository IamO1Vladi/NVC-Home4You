using System.Threading;
using System.Threading.Tasks;
using Models;

namespace Services;

/// <summary>
/// The seam between the Quickbase and SQL implementations of saved configurator links,
/// matching IReviewStore / IGalleryStore / ILeadStore.
///
/// Chosen per request by DATA_SOURCE_SAVEDCONFIGS, so the cutover is one App Setting and
/// instantly revertible — which matters more here than anywhere else in the migration,
/// because the codes are already in customers' inboxes.
/// </summary>
public interface ISavedConfigStore
{
    /// <summary>False when the backing store is not configured; endpoints answer 503.</summary>
    bool IsConfigured { get; }

    /// <summary>Persists a configuration and returns its freshly minted short code.</summary>
    Task<string> SaveAsync(SaveConfigRequest req, CancellationToken ct = default);

    /// <summary>The stored configuration for a code, or null if unknown.</summary>
    Task<SavedConfigDto?> GetAsync(string code, CancellationToken ct = default);

    /// <summary>The localized return path saved with a code, for the /c/{code} redirect.</summary>
    Task<string?> GetReturnPathAsync(string code, CancellationToken ct = default);
}
