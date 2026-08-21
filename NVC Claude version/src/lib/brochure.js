// The product brochures, addressed the same way from every page that links one.
//
// Two conventions were disagreeing before this file existed. ModularBuildsPage percent-encoded
// the file name and ModularHousesPage did not, so one PDF had two spellings on the same site;
// and the content files were split between a bare file name and a 'modular-builds/'-prefixed
// path, so there was no single string you could grep for to find every brochure. Both matter
// because these PDFs are due to move behind an API route (#16), and a migration driven by
// editing the content directory would have missed whichever half it did not know about.

// Where the bytes happen to sit is a fact about the deployment, not about the brochure, so the
// content files name the FILE and this constant owns the folder. When the PDFs move behind the
// API route the edit is one line here rather than two dozen across three languages. (The folder
// itself outlives them: card.svg in it is the broken-image fallback nine components reach for.)
const BROCHURE_DIR = 'modular-builds/'

/**
 * The href for a brochure named in a content file, opened at `page`.
 *
 * The names are Cyrillic, with spaces and typographic quotes. Un-encoded they still resolve —
 * the browser escapes the address on its way out and the server decodes the path before it
 * matches — so this is a fix with nothing behind it to break. It is worth making anyway: the
 * raw spelling leaks into whatever copies the href, and one URL with two spellings is exactly
 * what a later migration reads as two different documents.
 */
export function brochureUrl(file, page = 1) {
  return `${import.meta.env.BASE_URL}${BROCHURE_DIR}${encodeURIComponent(file)}#page=${page}`
}
