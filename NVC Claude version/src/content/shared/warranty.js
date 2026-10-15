// The warranty on containers and Box houses, in years per element, as the owner gave it on
// 2026-10-15 from the warranty annex of NVC's own Box-house sales contract; he said the same
// terms apply to containers. Numbers only: the partner page, the containers and Box pages and
// the FAQ word the terms in their own content files and fill the years from here, so a change
// is one line (warrantyFacts.test.js fails if a page types a figure of its own).
//
// Every term runs from the handover date and covers factory defects. Everything not listed is
// checked for factory conformity at the handover. Nothing here applies to the steel-frame
// houses, which are quoted per project: no page claims a warranty for them.
export const WARRANTY_YEARS = {
  // The steel structure, the load-bearing metal frame.
  structure: 15,
  // The thermal (sandwich) panels and panel elements.
  panels: 6,
  // The joinery (aluminium in the annex; the pages say only "joinery", since the containers'
  // windows are PVC): the profiles and the glazing.
  joinery: 6,
  // The sanitary ware and plumbing fittings in the bathroom and kitchen.
  sanitary: 2,
}
