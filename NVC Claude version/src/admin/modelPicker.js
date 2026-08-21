// Resolving "what they want / what they bought" from one box into two columns.
//
// Shared by the leads sheet and the customer sheet, which used to disagree about this: the
// leads page had a dropdown of catalogue models AND a free-text box, so the same answer
// lived in two places and neither was reliably the one with it. Both screens now show a
// single combobox — the models for the chosen category are offered as suggestions, and
// anything else can simply be typed.
//
// The two COLUMNS behind it stay separate, which is the part worth keeping. HouseId is a
// real foreign key: it is what makes "how many leads for the Nova 60?" a join rather than a
// string match, what lets the AI drafter quote the right price, and what keeps the record
// correct when a model is renamed. CustomModel holds the cases the catalogue has no row for
// — a custom modular build, a materials order, "two wagons joined".

/**
 * Turns what somebody typed into { modelText, houseId, customModel }.
 *
 * Exact title match, not fuzzy, and deliberately so: prefix matching would link "Nova 6" to
 * the Nova 60, which is a wrong foreign key that nothing downstream can detect. Both screens
 * show which of the two outcomes happened underneath the box, so the resolution is visible
 * rather than magic.
 *
 * @param text          what is in the box
 * @param categoryKey   the chosen category; a model only counts if it belongs to it
 * @param houses        the catalogue, as /api/admin/gallery serves it
 */
export function resolveModel(text, categoryKey, houses) {
  const wanted = (text || '').trim()
  const match = wanted
    ? (houses || []).find((h) => (
        h.categoryKey === categoryKey
        && (h.title || '').trim().toLowerCase() === wanted.toLowerCase()
      ))
    : null

  return match
    // 0 rather than '' for "no model": the server reads 0 as an explicit clear, and an
    // empty string would arrive as null, which means "leave it alone".
    ? { modelText: text, houseId: match.id, customModel: '' }
    : { modelText: text, houseId: 0, customModel: wanted }
}

/** The catalogue models that may be suggested for a category. */
export function modelsFor(houses, categoryKey, allowedCategories) {
  if (allowedCategories && !allowedCategories.includes(categoryKey)) return []
  return (houses || []).filter((h) => h.categoryKey === categoryKey)
}

/**
 * What to pass as `allowedCategories` until the server has answered.
 *
 * The server owns the real answer — /api/admin/customers/categories serves it as
 * withGalleryModels, out of PurchaseCategories — because it changes when the catalogue does
 * and not when this file does. This is only what the two sheets fall back to while that
 * request is in flight or if it fails, since a model box that will not render because one
 * request hiccuped is worse than one working from a slightly stale rule.
 *
 * It lives HERE, beside modelsFor, because it is the argument modelsFor takes and both
 * sheets ask it of the same catalogue. A copy per page is how the leads sheet and the
 * customer sheet ended up disagreeing with each other and with the server at once — and the
 * disagreement is invisible until the day the request fails, which is the day it matters.
 */
export const WITH_GALLERY_MODELS_FALLBACK = ['wagon', 'modular']
