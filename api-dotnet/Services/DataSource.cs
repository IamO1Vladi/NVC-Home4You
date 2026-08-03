namespace Services;

// Which backing store a given entity is served from. Chosen per entity by
// EnvConfig.DataSourceFor(...) so the Quickbase -> SQL migration can be cut over one
// table at a time, and reverted by flipping a single environment variable.
public enum DataSource
{
    Quickbase,
    Sql,
}
