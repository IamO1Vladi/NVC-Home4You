import { getBoxConfiguratorCatalog } from './boxConfiguratorCatalog.js'

// What a finished box house actually costs, assembled.
//
// The prices page exists because the gallery cannot answer the question people search for.
// The gallery shows a unit price on fourteen separate pages, none of which mention that the
// unit still has to be put up — so a visitor reads "€26,500" and still does not know what
// they would pay. Competitors all rank for "сглобяеми къщи цени" with a single comparison
// table; this is ours, and it wins on being honest about what is NOT in the number.
//
// UNIT PRICES ARE IMPORTED, NEVER RETYPED. basePrice and balconyPrice come from
// boxConfiguratorCatalog.js, which is the hand-authored layer over the printed catalogue and
// what the configurator quotes from. A second copy here would drift the first time an
// edition changes, and the two surfaces would quote different prices for the same house.

/** Bulgarian standard rate. */
export const VAT_RATE = 0.2

/**
 * THE TWO SIDES OF THIS TABLE ARE QUOTED ON DIFFERENT BASES. Read this before touching it.
 *
 *   - House prices in the catalogue ALREADY INCLUDE VAT.
 *   - Assembly costs below are quoted EXCLUDING VAT.
 *
 * Confirmed with the client 2026-08-15, correcting a first version of this page that treated
 * both as net and applied 20% to the sum — which charged VAT twice on the house and
 * overstated every total by roughly €2,400. That is the kind of error that is invisible on
 * screen and turns up in a signed contract, which is why the bases are spelled out here and
 * pinned in prices.test.js rather than left implicit in a multiplication.
 */
const ASSEMBLY_NET = {
  37: { standard: 700, balcony: 1300 },
  58: { standard: 850, balcony: 1600 },
  73: { standard: 1000, balcony: 1900 },
}

const addVat = (net) => Math.round(net * (1 + VAT_RATE))

/**
 * One priced variant.
 *
 * `house` arrives gross and is passed through untouched; only the assembly is grossed up.
 * The total is therefore gross + gross, never gross × 1.2.
 */
function line(houseGross, assemblyNet) {
  const assemblyGross = addVat(assemblyNet)
  return {
    house: houseGross,
    assemblyNet,
    assemblyGross,
    total: houseGross + assemblyGross,
  }
}

/**
 * One row per model, each with a standard and a roof-and-veranda variant.
 *
 * Totals are computed rather than stored, for the same reason Purchase has no LeftToPay
 * column: a written-down total is a second copy of a fact that can disagree with the two
 * numbers above it, and the copy is the one people read.
 */
export function getPriceRows(locale = 'en') {
  const { models } = getBoxConfiguratorCatalog(locale)

  return models.map((model) => ({
    key: model.key,
    label: model.label,
    area: model.area,
    standard: line(model.basePrice, ASSEMBLY_NET[model.key].standard),
    balcony: line(model.balconyPrice, ASSEMBLY_NET[model.key].balcony),
  }))
}

/** The cheapest finished house, VAT included — the "from" figure in the copy and the title. */
export function startingPrice(locale = 'en') {
  return Math.min(...getPriceRows(locale).map((row) => row.standard.total))
}

// --- The full catalogue, priced -------------------------------------------------------
//
// Everything below drives the sectioned prices page off /api/gallery rather than a second
// list of products written down here. That is deliberate and it is the lesson from the 73 m²
// discrepancy: the gallery said €25,500 and the configurator catalogue said €26,500 for the
// same house, so the site quoted two prices for one product depending on which page you
// landed on. One source for the price, the title and the photograph; this file adds only the
// thing the gallery does not know, which is what assembly costs.
//
// Keyed by GALLERY ID, not by title. Titles get edited in the admin panel — "Разгъваема Къща
// – 37 м²" gaining a word would silently drop its assembly cost and quietly change a
// published price. Ids do not move.

/**
 * Box-house assembly, EXCLUDING VAT — same basis as ASSEMBLY_NET above.
 * Confirmed with the client 2026-08-15.
 */
const BOX_ASSEMBLY_NET_BY_ID = {
  10: 700,    // Разгъваема Къща – 37 м²
  11: 1300,   // Разгъваема къща – 37 м² с веранда и двоен покрив
  16: 1900,   // Панорамна Бокс къща – 37 м²
  5: 850,     // Разгъваема Къща – 58 м²
  4: 1600,    // Разгъваема Къща – 58 м² с веранда и двоен покрив
  9: 1000,    // Разгъваема Къща – 73 м²
  15: 1900,   // Разгъваема Къща – 73 м² с веранда и двоен покрив
  17: 3000,   // Двуетажна разгъваема къща – 74 м²
}

/**
 * Wagons work the other way round, and this is the trap to remember.
 *
 * A wagon's gallery price is INCLUSIVE of VAT **and already contains its assembly**, so the
 * figure is not "add this on" — it is "of the price you see, this much is assembly". The
 * house line is therefore the price MINUS this, not plus. Treating it like the box-house
 * assembly would overstate every wagon by €1,000.
 *
 * Gross, because the total it comes out of is gross.
 */
export const WAGON_ASSEMBLY_GROSS = 1000

/** Categories, as /api/gallery labels them. Matched case-insensitively against either. */
const CATEGORY_LABELS = {
  box: ['модулна къща', 'modular house', 'modular', 'δομικό σπίτι'],
  wagon: ['фургон', 'wagon', 'wagon / site cabin', 'δομική μονάδα'],
}

const inCategory = (item, group) =>
  CATEGORY_LABELS[group].includes(String(item?.category || '').trim().toLowerCase())

/**
 * Turns /api/gallery into the two priced sections the page renders.
 *
 * An item with no assembly cost mapped is still listed — with its price and no breakdown —
 * rather than dropped. A product missing from the price list because nobody updated a
 * constant is worse than one that says "assembly on request".
 */
export function buildPriceSections(items = []) {
  const rows = (items || []).filter((i) => i && Number(i.price) > 0)

  const box = rows
    .filter((i) => inCategory(i, 'box'))
    .map((i) => {
      const assemblyNet = BOX_ASSEMBLY_NET_BY_ID[i.id]
      const assemblyGross = assemblyNet == null ? null : addVat(assemblyNet)
      return {
        id: i.id,
        item: i,
        house: Number(i.price),
        assemblyNet: assemblyNet ?? null,
        assemblyGross,
        total: assemblyGross == null ? Number(i.price) : Number(i.price) + assemblyGross,
        assemblyIncluded: false,
      }
    })
    .sort((a, b) => a.total - b.total)

  const wagon = rows
    .filter((i) => inCategory(i, 'wagon'))
    .map((i) => ({
      id: i.id,
      item: i,
      // Subtracted, not added — see WAGON_ASSEMBLY_GROSS.
      house: Number(i.price) - WAGON_ASSEMBLY_GROSS,
      assemblyNet: null,
      assemblyGross: WAGON_ASSEMBLY_GROSS,
      total: Number(i.price),
      assemblyIncluded: true,
    }))
    .sort((a, b) => a.total - b.total)

  return { box, wagon }
}
