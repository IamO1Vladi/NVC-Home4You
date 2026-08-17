namespace Services;

/// <summary>
/// Text normalisation shared by the admin write paths.
///
/// One method, its own file, because both CustomerAdminService and FactoryAdminService need
/// it and having one reach into the other for it would imply a dependency that does not
/// exist.
/// </summary>
public static class AdminText
{
    /// <summary>
    /// Trims, and turns whitespace-only into null.
    ///
    /// An empty string and a null both mean "not filled in", and storing both makes every
    /// later "is this set?" check wrong half the time — a customer with Email = "" is
    /// emailable according to the database and not according to anything else.
    /// </summary>
    public static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
