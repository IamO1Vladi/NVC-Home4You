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

/**
 * The cheapest house WITHOUT its assembly, VAT included — the home page's "from" figure.
 * The owner wants the home page to quote the house alone (2026-10-12); it is also the base
 * price the configurator opens on, so a visitor who taps a card sees the same number twice.
 * The prices page keeps the finished total above.
 */
export function startingHousePrice(locale = 'en') {
  return Math.min(...getPriceRows(locale).map((row) => row.standard.house))
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
//
// The ids below are Quickbase record ids, which imported houses keep. A house created in
// the admin panel is served as 100000 + its SQL id (#35, HousePublicIds.cs), so the Space
// house is 100015. Until #35 it was served as 15 too, and this table gave it the 73 m²
// house's assembly cost.

/**
 * Box-house assembly, EXCLUDING VAT — same basis as ASSEMBLY_NET above.
 * Confirmed with the client 2026-08-15; the 18 m² house's on 2026-10-17 (until then it was
 * "on request" on the prices page, the Box page and the FAQ).
 */
const BOX_ASSEMBLY_NET_BY_ID = {
  100016: 1000, // Разгъваема Къща – 18 м² (owner, 2026-10-17)
  10: 700,    // Разгъваема Къща – 37 м²
  11: 1300,   // Разгъваема къща – 37 м² с веранда и двоен покрив
  16: 1900,   // Панорамна Бокс къща – 37 м²
  5: 850,     // Разгъваема Къща – 58 м²
  4: 1600,    // Разгъваема Къща – 58 м² с веранда и двоен покрив
  9: 1000,    // Разгъваема Къща – 73 м²
  15: 1900,   // Разгъваема Къща – 73 м² с веранда и двоен покрив
  17: 3000,   // Двуетажна разгъваема къща – 74 м²
}

/** The Space capsule (served as 100000 + its SQL id, like every house added in the admin panel). */
export const CAPSULE_ID = 100015

/**
 * Houses filed with the Box houses that have NO assembly: they arrive ready (owner, 2026-10-17,
 * the Space capsule, served as 100015). Their row says so instead of "on request", and their
 * total is their price. Delivery, the crane, the lead time and the warranty are the Box houses'.
 * A model filed under the capsule category arrives ready too (isCapsuleItem), so the capsule
 * reads the same before and after staff move it out of "modular".
 */
const ARRIVES_READY_IDS = new Set([CAPSULE_ID])

/** A Box house's assembly cost without VAT, by gallery id; null where it is not known. */
export function boxAssemblyNet(id) {
  return BOX_ASSEMBLY_NET_BY_ID[id] ?? null
}

/** A Box house's assembly cost WITH VAT, by gallery id; null where it is not known. */
export function boxAssemblyGross(id) {
  const net = boxAssemblyNet(id)
  return net == null ? null : addVat(net)
}

/** The cheapest Box-house assembly, without VAT, across every house that has one. */
export function boxAssemblyFromNet() {
  return Math.min(...Object.values(BOX_ASSEMBLY_NET_BY_ID))
}

/**
 * Who assembles a Box house and how long it takes (owner, 2026-10-17): this many of our own
 * workers, on site, in this many days. The capsule needs none (ARRIVES_READY_IDS).
 */
export const BOX_ASSEMBLY_CREW = { workers: 2, days: '3–4' }

/**
 * A steel-frame house's architectural project, when we draw it up (owner, 2026-10-17). Full
 * documentation is a paid service; this is the project's price. Nothing else about steel-frame
 * houses has a figure: they are quoted per project.
 */
export const ARCHITECT_PROJECT_EUR = 1000

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

/**
 * The ids of the prices page's two sections, which other pages link to: the delivery
 * calculator's Box result and the Box page's "prices with assembly" go to #prices-box.
 */
export const PRICE_SECTION_IDS = { box: 'prices-box', wagon: 'prices-wagon' }

/** Categories, as /api/gallery labels them. Matched case-insensitively against either. */
const CATEGORY_LABELS = {
  modular: ['модулна къща', 'modular house', 'modular', 'δομικό σπίτι'],
  // Its own gallery category since 2026-10-17 (the owner's "space capsules" section). Until
  // staff move it there, the capsule is filed under modular and found by its id instead.
  // The plural chip names too, which galleryUtils catFromItemCategory also reads as capsule,
  // so the two never disagree on one.
  capsule: ['capsule', 'космическа капсула', 'space capsule', 'κάψουλα χώρου', 'космически капсули', 'space capsules'],
  wagon: ['фургон', 'wagon', 'wagon / site cabin', 'δομική μονάδα'],
}

const inCategory = (item, group) =>
  CATEGORY_LABELS[group].includes(String(item?.category || '').trim().toLowerCase())

/**
 * The Box houses' section holds the Box houses and the capsule, whichever category the capsule
 * is filed under: it is sold like a Box house (the same delivery, crane, lead time and
 * warranty, owner 2026-10-17), so its row stays on the prices page and the Box houses page.
 * The prefab category (steel-frame projects, priced per project) is in neither section.
 */
const inBoxSection = (item) => inCategory(item, 'modular') || inCategory(item, 'capsule')

/**
 * Whether a gallery item is the capsule: filed under the capsule category, or the Space
 * capsule by its id while it is still filed under modular. Both, so the site reads the same
 * before and after staff move it.
 */
export function isCapsuleItem(item) {
  return inCategory(item, 'capsule') || Number(item?.id) === CAPSULE_ID
}

/**
 * Turns /api/gallery into the two priced sections the page renders.
 *
 * An item with no assembly cost mapped is still listed — with its price and no breakdown —
 * rather than dropped. A product missing from the price list because nobody updated a
 * constant is worse than one that says "assembly on request".
 *
 * A house that arrives ready (ARRIVES_READY_IDS) has no assembly figure either, but it is not
 * "on request": `arrivesReady` is true and its price is its finished total.
 */
export function buildPriceSections(items = []) {
  const rows = (items || []).filter((i) => i && Number(i.price) > 0)

  const box = rows
    .filter(inBoxSection)
    .map((i) => {
      const capsule = isCapsuleItem(i)
      const arrivesReady = ARRIVES_READY_IDS.has(Number(i.id)) || inCategory(i, 'capsule')
      const assemblyNet = arrivesReady ? null : boxAssemblyNet(i.id)
      const assemblyGross = assemblyNet == null ? null : addVat(assemblyNet)
      return {
        id: i.id,
        item: i,
        house: Number(i.price),
        assemblyNet,
        assemblyGross,
        total: assemblyGross == null ? Number(i.price) : Number(i.price) + assemblyGross,
        assemblyIncluded: false,
        arrivesReady,
        capsule,
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

/**
 * The Box section's rows without the capsule: what a "Box houses from" figure is taken over.
 * The capsule is a different product at a different price, in either category.
 */
export function boxHouseRows(box = []) {
  return (box || []).filter((row) => !row.capsule)
}
