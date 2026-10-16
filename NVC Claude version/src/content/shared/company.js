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
  // Homes delivered, as the home page states it (owner, confirmed 2026-10-16). The About
  // page's tile reads it; the home page's hero fact and stats repeat it in words, and
  // AboutPage.test.jsx checks they say the same number.
  homesDelivered: 87,
}

// How a buyer pays for a container or a house, as the owner gave it on 2026-10-17: this share
// of the price when the order is placed, the rest after delivery; the assembly is paid once it
// is finished (the FAQ hub words that part). Numbers only. Partners pay the whole price in
// advance, by contract (partner.js); these figures do not change that.
export const PAYMENT_TERMS = {
  atOrderPercent: 60,
  afterDeliveryPercent: 40,
}

// Financing, as the owner gave it on 2026-10-17: up to this many euros, through this bank. The
// bank's name is written once per language, the way the bank writes it there.
export const FINANCING = {
  upToEuro: 50000,
  bank: { bg: 'УниКредит Булбанк', en: 'UniCredit Bulbank', el: 'UniCredit Bulbank' },
}

// The phone number the site publishes (the header, the closing card, the footer, the
// LocalBusiness markup). The admin reply composer signs with it for the people in
// AdminPipelinePage's WEBSITE_PHONE_SIGNERS; AdminPipelinePage.test.jsx checks it is the
// number the home content prints, so the two cannot drift.
export const WEBSITE_PHONE = { display: '+359 87 935 5269', tel: '+359879355269' }

// The team's photos, by the slug each person has in the about content (team.people[].slug).
// The page draws a monogram for anyone not listed here, so add a line only once the file is in
// public/about/team/: square, at least 400 px, WebP, e.g.
//   'vladimir-vladimirov': 'about/team/vladimir-vladimirov.webp',
// A listed file that fails to load falls back to the monogram too.
export const TEAM_PHOTOS = {
  // The owner's photos of 2026-10-15 (Nikolay's is a stand-in until he sends a better one),
  // cropped to 320 px squares for the round avatar.
  'vladimir-vladimirov': 'about/team/vladimir-vladimirov.webp',
  'tsvetelin-bonin': 'about/team/tsvetelin-bonin.webp',
  'nikolay-lekov': 'about/team/nikolay-lekov.webp',
}
