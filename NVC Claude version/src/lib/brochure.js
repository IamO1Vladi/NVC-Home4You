// The product brochures, addressed the same way from every page that links one.
//
// Since stage 4 of #16 the address is the API route, not a static file: the content files
// name a SLUG ('villa-office'), and the bytes live in Azure Blob behind
// /api/brochures/{slug}.pdf. The old Cyrillic file names — spaces, typographic quotes and
// all — are gone from the URLs entirely, which is what they were exactly wrong for.
// Replacing a catalogue in the admin panel changes what this address serves without
// changing the address, so nothing here ever needs to know a brochure was updated.

// The route prefix is a deployment fact, not a fact about a brochure, so the content files
// carry the bare slug and this constant owns the path — the same division of labour the
// static folder had.
const BROCHURE_API = 'api/brochures/'

/**
 * The href for a brochure named in a content file, opened at `page` in `lang`.
 *
 * `lang` rides in the query and the API falls back requested → bg → whatever exists, so a
 * missing translation serves the Bulgarian edition rather than a 404. DO NOT lean on that
 * by omitting the argument: a page that drops it serves Bulgarian to every visitor forever
 * and nothing at runtime will ever say so. The href tests pin ?lang= into every link
 * precisely so that omission fails a test instead of shipping.
 */
export function brochureUrl(slug, page = 1, lang) {
  const query = lang ? `?lang=${lang}` : ''
  return `${import.meta.env.BASE_URL}${BROCHURE_API}${slug}.pdf${query}#page=${page}`
}
