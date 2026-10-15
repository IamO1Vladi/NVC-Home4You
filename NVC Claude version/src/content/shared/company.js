// The company's own particulars, as the owner gave them on 2026-10-15. The About page prints
// the VAT number from here, its AboutPage markup carries all three, and the Organization that
// index.html publishes on every page repeats them in raw HTML (AboutPage.test.jsx checks the
// two agree). The privacy page names the controller in words, with the same number.
export const COMPANY = {
  name: 'NVC Home4You',
  legalName: 'NVC Home4You',
  vatID: 'BG113592898',
  // Started as a logistics firm in 2021; containers from 2024, Box houses from 2025 and
  // steel-frame houses from 2026 (the About page's timeline).
  foundingYear: 2021,
}

// The team's photos, by the slug each person has in the about content (team.people[].slug).
// The page draws a monogram for anyone not listed here, so add a line only once the file is in
// public/about/team/: square, at least 400 px, WebP, e.g.
//   'vladimir-vladimirov': 'about/team/vladimir-vladimirov.webp',
// A listed file that fails to load falls back to the monogram too.
export const TEAM_PHOTOS = {}
