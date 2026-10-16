// What the admin panel ("Снимки на сайта") says about each photo slot, and what the site shows
// in it while it is empty. ONLY THE PANEL AND THE TESTS IMPORT THIS FILE: it pulls in the door
// catalogue, the interiors media, the configurator catalogue and six content files, which no
// public page should download for the sake of a slot list. Pages use photoSlotNames.js.
//
// The default pictures are IMPORTED from where the pages take them, never retyped, so the panel
// cannot show one photo as "По подразбиране" while the page shows another. Each slot:
//   label        { bg, en }: unique across the panel (the buttons' accessible names and the
//                notices are built from it)
//   short        { bg, en }, optional: a shorter name for the notices, where the label already
//                quotes something (the hero slides' „води към „…““ would nest the quotes)
//   hint         { bg, en }: the shape that fits, the smallest sensible width, what must show
//   aspect       the frame the page crops to ('16:10', '4:3', '1:1', '4:5', '16:9'); the panel
//                warns, without refusing, about a photo of the other orientation, and draws its
//                thumbnail in this frame
//   crops        false where the page shows the owner's photo whole, at its own proportions
//                (the delivery page): then there is no "only its middle will show" to warn about
//   minWidth     px; the panel warns about a narrower photo
//   emptyKind    what the page shows while the slot is empty: 'image' (defaultImage), 'monogram'
//                (a team member's initials) or 'none' (the steel page: no photo at all)
//   defaultImage { url, thumb? } for 'image'; thumb is a smaller file of the same picture
//   monogram     the initials, for 'monogram'
//   empty        { bg, en }, optional: a sentence saying what the page shows while empty, where
//                the thumbnail alone would not say it (whose house, which case)
//
// Since 2026-10-17 it also holds what the panel says around the slots: the sub-headings of the
// rows a page's section is split into (the step pictures, each before/after pair), and, per
// page, the one line that says where the page's OTHER photos are changed (the gallery's in
// "Галерия", the delivered house's in "Проекти"), or that they are not changed from the admin.
import { INTERIORS_PAIR_SLOTS, PHOTO_SLOTS } from './photoSlotNames.js'
import { PAGE_PHOTO_DEFAULTS } from './homePhotos.js'
import { TEAM_PHOTOS } from '../content/shared/company.js'
import { ABOUT_PHOTO, FACTORY_PHOTO } from '../content/shared/aboutMedia.js'
import { INTERIORS_PAIRS, INTERIORS_PHOTOS } from '../content/shared/interiorsMedia.js'
import { DOORS_COVER } from '../content/shared/doorsCatalogue.js'
import { getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import bgHome from '../content/bg/home.js'
import enHome from '../content/en/home.js'
import bgAbout from '../content/bg/about.js'
import enAbout from '../content/en/about.js'
import bgModularBuilds from '../content/bg/modularBuilds.js'
import bgModularHouses from '../content/bg/modularHouses.js'
import bgPartner from '../content/bg/partner.js'
import enPartner from '../content/en/partner.js'
import bgSteel from '../content/bg/steelHouses.js'
import enSteel from '../content/en/steelHouses.js'
import bgInteriors from '../content/bg/interiors.js'
import enInteriors from '../content/en/interiors.js'

const BASE = import.meta.env.BASE_URL || '/'
const fromBase = (p) => `${BASE}${String(p).replace(/^\//, '')}`

/** The panel's section headings, one per group of photoSlotNames.js. */
export const PHOTO_SLOT_GROUP_HEADINGS = Object.freeze({
  home: { bg: 'Начална страница', en: 'Home page' },
  products: { bg: 'Продуктови страници', en: 'Product pages' },
  delivery: { bg: 'Доставка', en: 'Delivery' },
  partner: { bg: 'Партньори', en: 'Partners' },
  about: { bg: 'За нас', en: 'About us' },
  interiors: { bg: 'Вътрешни ремонти', en: 'Interiors' },
  doors: { bg: 'Интериорни врати', en: 'Internal doors' },
})

/** "Владимир Владимиров" -> "ВВ", as the About page draws a person without a photo. */
const initialsOf = (name) => String(name || '')
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0])
  .filter((_, i, all) => i === 0 || i === all.length - 1)
  .join('')
  .toUpperCase()

const bgSlides = bgHome?.home?.hero?.showcase?.slides || []
const enSlides = enHome?.home?.hero?.showcase?.slides || []
const bgTiles = bgHome?.home?.serviceTiles?.items || []
const bgPeople = bgAbout?.team?.people || []
const enPeople = enAbout?.team?.people || []
const boxModels = getBoxConfiguratorCatalog('bg')?.models || []

const image = (url, thumb) => ({ url, ...(thumb ? { thumb } : {}) })
const interiors = (photo) => image(photo.large, photo.small)

const LANDSCAPE_HINT = {
  bg: (aspect, px) => `Хоризонтална (${aspect}), поне ${px} px.`,
  en: (aspect, px) => `Landscape (${aspect}), at least ${px} px wide.`,
}
const hint = (bg, en) => ({ bg, en })

function heroPanel(n) {
  const bgSlide = bgSlides[n - 1] || {}
  const enSlide = enSlides[n - 1] || {}
  return {
    // The arrows move photos, never links: slide n always opens the page the content gives
    // position n, so the label names it.
    label: {
      bg: `Снимка ${n} · води към „${bgSlide.alt || '—'}“`,
      en: `Photo ${n} · links to “${enSlide.alt || '—'}”`,
    },
    short: { bg: `Снимка ${n} в началото`, en: `Photo ${n} at the top` },
    // From 768px the left part of the photo sits under page colour behind the heading, and
    // the crop is anchored right (HomePage.css .hp-hero-media, .hp-slide img); a phone shows
    // it above the words, nearly whole.
    hint: hint(
      'Широка (16:10), поне 1600 px. На компютър лявата част избледнява под заглавието — главното да е вдясно; на телефон се вижда почти цялата.',
      'Wide (16:10), at least 1600 px. On a computer the left part fades under the heading, so keep the subject on the right; a phone shows nearly all of it.',
    ),
    aspect: '16:10',
    minWidth: 1600,
    emptyKind: bgSlide.src ? 'image' : 'none',
    defaultImage: bgSlide.src ? image(bgSlide.src, firstCandidate(bgSlide.srcSet)) : null,
  }
}

/** A srcSet's first file, its smallest as the content writes them; undefined without one. */
function firstCandidate(srcSet) {
  const first = typeof srcSet === 'string' ? srcSet.split(',')[0].trim().split(/\s+/)[0] : ''
  return first || undefined
}

function modelPanel(key) {
  const model = boxModels.find((m) => m.key === key)
  const file = model?.standardHeroImage || model?.heroImage
  return {
    label: { bg: `${key} m²`, en: `${key} m²` },
    hint: hint(LANDSCAPE_HINT.bg('4:3', 1200), LANDSCAPE_HINT.en('4:3', 1200)),
    aspect: '4:3',
    minWidth: 1200,
    emptyKind: file ? 'image' : 'none',
    defaultImage: file ? image(fromBase(`box-config/${file}`)) : null,
  }
}

function teamPanel(slug) {
  const bgName = bgPeople.find((p) => p.slug === slug)?.name || slug
  const enName = enPeople.find((p) => p.slug === slug)?.name || bgName
  const file = TEAM_PHOTOS[slug]
  return {
    label: { bg: `Екип: ${bgName}`, en: `Team: ${enName}` },
    hint: hint(
      'Квадратна, лицето в средата, поне 400 px. Показва се в кръг.',
      'Square, face in the middle, at least 400 px. Shown in a circle.',
    ),
    aspect: '1:1',
    minWidth: 400,
    emptyKind: file ? 'image' : 'monogram',
    defaultImage: file ? image(fromBase(file)) : null,
    ...(file ? {} : { monogram: initialsOf(bgName) }),
  }
}

const TILE_LABELS = {
  modularBuilds: { bg: 'Плочка „Контейнерни модули“', en: 'Tile “Container units”' },
  modularHouses: { bg: 'Плочка „Модулни къщи“', en: 'Tile “Modular houses”' },
  steelHouses: { bg: 'Плочка „Сглобяеми къщи по проект“', en: 'Tile “Steel-frame prefab houses to your plan”' },
  interiors: { bg: 'Плочка „Вътрешни ремонти“', en: 'Tile “Interiors”' },
}

function tilePanel(tileKey) {
  const img = bgTiles.find((item) => item.key === tileKey)?.img
  return {
    label: TILE_LABELS[tileKey] || { bg: tileKey, en: tileKey },
    hint: hint(
      'Хоризонтална (16:10), поне 1600 px. Заглавието на плочката се чете върху долната ѝ част. На телефон се изрязва по-високо (4:3).',
      'Landscape (16:10), at least 1600 px. The tile’s title sits over its lower part. A phone crops it taller (4:3).',
    ),
    aspect: '16:10',
    minWidth: 1600,
    emptyKind: img ? 'image' : 'none',
    defaultImage: img ? image(img) : null,
  }
}

const PRODUCT_HINT = hint(
  'Хоризонтална (4:3), поне 1600 px. На телефон се изрязва по-широко (16:10).',
  'Landscape (4:3), at least 1600 px. A phone crops it wider (16:10).',
)

// The numbered steps' picture frame: ProcessSteps draws every step picture at 800 x 671 and
// ProductSteel.css crops it to aspect-ratio 800/671, on a phone under the step's words (full
// width) and on a computer in the large stage beside the list (about 620 px).
const STEP_FRAME = '800:671'

const stepsOf = (content) => content?.process?.steps || []
// "Визуализация …" / "A render …": a caption that calls the picture a render says nothing
// about what an owner's photo should show, so the hint leaves it out. (Such a caption has
// adminCaption '' today, so this only guards one added later without it.)
const callsItselfARender = (caption) => /визуализац|render|απεικόνιση/i.test(String(caption || ''))
const lowerFirst = (text) => (text ? `${text[0].toLowerCase()}${text.slice(1)}` : '')

function stepPanel(slot) {
  const partner = slot.steps === 'partner'
  const n = slot.stepNumber
  const bgStep = stepsOf(partner ? bgPartner : bgSteel)[n - 1] || {}
  const enStep = stepsOf(partner ? enPartner : enSteel)[n - 1] || {}
  const src = bgStep.image?.src
  // The caption that will sit under HIS photo: a step whose default caption fits only the
  // default (the steel page's render captions) has adminCaption for a photo, '' for none.
  const bgCaption = bgStep.image?.adminCaption ?? bgStep.image?.caption ?? ''
  const enCaption = enStep.image?.adminCaption ?? enStep.image?.caption ?? ''
  const size = { bg: 'Хоризонтална (около 6:5), поне 1200 px.', en: 'Landscape (about 6:5), at least 1200 px.' }
  return {
    // Named as the page numbers the step, and by its title: the panel groups it under its page.
    label: { bg: `Стъпка ${n} · „${bgStep.title || '—'}“`, en: `Step ${n} · “${enStep.title || '—'}”` },
    // The label quotes the title, so the notices use the page and the number instead.
    short: partner
      ? { bg: `Партньори, стъпка ${n}`, en: `Partners, step ${n}` }
      : { bg: `Сглобяеми къщи, стъпка ${n}`, en: `Steel-frame houses, step ${n}` },
    hint: partner
      // Each caption names a place, so the photo has to be of that place.
      ? hint(
        `${size.bg} Под нея пише „${bgCaption}“ — снимката трябва да показва точно това място.`,
        `${size.en} Its caption reads “${enCaption}”, so the photo must show that very place.`,
      )
      // The steps show one example house drawn at each stage; an owner's photo is a real project.
      : hint(
        `${size.bg} Само снимка от ваш истински проект на този етап.${bgCaption && !callsItselfARender(bgCaption) ? ` Под нея пише „${bgCaption}“.` : ''}`,
        `${size.en} Only a photo of a real project of yours at this stage.${enCaption && !callsItselfARender(enCaption) ? ` Its caption reads “${enCaption}”.` : ''}`,
      ),
    aspect: STEP_FRAME,
    minWidth: 1200,
    emptyKind: src ? 'image' : 'none',
    defaultImage: src ? image(src) : null,
    // The steel steps' pictures are renders, which a thumbnail alone does not say.
    ...(partner ? {} : {
      empty: {
        bg: 'Празно: визуализация (не снимка) на примерната къща на този етап.',
        en: 'Empty: a render (not a photo) of the example house at this stage.',
      },
    }),
  }
}

const pairOf = (content, pairKey) => (content?.jobs?.pairs || []).find((p) => p.key === pairKey) || {}

function pairPanel(slot) {
  const bgPair = pairOf(bgInteriors, slot.pairKey)
  const enPair = pairOf(enInteriors, slot.pairKey)
  const bgSide = bgPair[slot.pairSide] || {}
  const enSide = enPair[slot.pairSide] || {}
  const media = INTERIORS_PAIRS[slot.pairKey]?.[slot.pairSide]
  return {
    // The room and the tag the page prints on this half ("Баня — „Преди“").
    label: { bg: `${bgPair.title || slot.pairKey} — „${bgSide.label || slot.pairSide}“`, en: `${enPair.title || slot.pairKey} — “${enSide.label || slot.pairSide}”` },
    short: {
      bg: `${bgPair.title || slot.pairKey} — ${lowerFirst(bgSide.label || slot.pairSide)}`,
      en: `${enPair.title || slot.pairKey} — ${lowerFirst(enSide.label || slot.pairSide)}`,
    },
    // Interiors.css .ir-pair-fig img: aspect-ratio 4/5; two side by side, 300 px each on a
    // computer, half the screen on a phone (InteriorsPage PairImage, up to 800 px files).
    hint: hint(
      'Вертикална (4:5), поне 800 px. Само снимка от ваш обект, а двете снимки на двойката — от едно и също помещение.',
      'Upright (4:5), at least 800 px. Only a photo of your own job, and both photos of the pair of the same room.',
    ),
    aspect: '4:5',
    minWidth: 800,
    emptyKind: media ? 'image' : 'none',
    defaultImage: media ? image(media.src, media.small) : null,
  }
}

// The slots whose panel entry is not made by one of the builders above.
const FIXED = {
  'page-modular-builds': {
    label: { bg: 'Контейнерни модули', en: 'Container units' },
    hint: PRODUCT_HINT,
    aspect: '4:3',
    minWidth: 1600,
    emptyKind: 'image',
    defaultImage: image(bgModularBuilds.hero.photo.url, firstCandidate(bgModularBuilds.hero.photo.srcSet)),
    empty: {
      bg: 'Празно: контейнер, доставен на парцела на клиент.',
      en: "Empty: a container delivered to a customer's plot.",
    },
  },
  'page-modular-houses': {
    label: { bg: 'Модулни къщи', en: 'Modular houses' },
    hint: PRODUCT_HINT,
    aspect: '4:3',
    minWidth: 1600,
    emptyKind: 'image',
    defaultImage: image(bgModularHouses.hero.photo.url),
    empty: {
      bg: 'Празно: снимката на къщата в Паралия Кариани (58 м²) от „Казуси и отзиви“.',
      en: 'Empty: the Paralia Kariani house (58 m²) from Cases & Reviews.',
    },
  },
  'page-steel-houses': {
    label: { bg: 'Сглобяеми къщи по проект', en: 'Steel-frame prefab houses to your plan' },
    hint: PRODUCT_HINT,
    aspect: '4:3',
    minWidth: 1600,
    emptyKind: 'none',
    defaultImage: null,
    empty: { bg: 'Празно: страницата е без снимка.', en: 'Empty: the page has no photo.' },
  },
  'page-delivery': {
    label: { bg: 'Доставка и монтаж', en: 'Delivery and assembly' },
    // The owner's photo is a plain <img> at its own proportions (DeliveryPage.jsx PreparePhoto);
    // the 4:5 phone crop belongs to the default photo only.
    hint: hint(
      'Хоризонтална (4:3), поне 1500 px. Показва се цяла, без изрязване: вертикална снимка излиза висока.',
      'Landscape (4:3), at least 1500 px. Shown whole, not cropped: an upright photo comes out tall.',
    ),
    aspect: '4:3',
    crops: false,
    minWidth: 1500,
    emptyKind: 'image',
    defaultImage: image(PAGE_PHOTO_DEFAULTS.delivery.url),
    empty: { bg: 'Празно: кран вдига модул от камиона.', en: 'Empty: a crane lifting a unit off the truck.' },
  },
  'page-partner': {
    label: { bg: 'Партньори — снимка', en: 'Partners — photo' },
    hint: hint(
      'Вертикална (4:5), поне 1000 px. Показва се до „Накратко“ на широк екран.',
      'Upright (4:5), at least 1000 px. Shown beside “In short” on a wide screen.',
    ),
    aspect: '4:5',
    minWidth: 1000,
    emptyKind: 'image',
    defaultImage: image(PAGE_PHOTO_DEFAULTS.partner.url),
    empty: {
      bg: 'Празно: кран вдига модул от камиона (снимката на доставката).',
      en: "Empty: a crane lifting a unit off the truck (the delivery page's photo).",
    },
  },
  'about-hero': {
    label: { bg: 'За нас — главна снимка', en: 'About us — main photo' },
    // The product pages' hero (ProductHero), so their crops too.
    hint: PRODUCT_HINT,
    aspect: '4:3',
    minWidth: 1600,
    emptyKind: 'image',
    defaultImage: image(ABOUT_PHOTO.url, fromBase('delivery/crane-lift-800.webp')),
  },
  'factory-floor': {
    label: { bg: 'Фабриката в Китай', en: 'The factory in China' },
    hint: hint(
      'Широка (16:9; на компютър още по-широка, 21:9), поне 1600 px, главното в средата. Показва се и на „Партньори“ (стъпка 2), изрязана почти квадратна (около 6:5).',
      'Wide (16:9; wider still on a computer, 21:9), at least 1600 px, the subject in the middle. It also shows on Partners (step 2), cut almost square (about 6:5).',
    ),
    aspect: '16:9',
    minWidth: 1600,
    emptyKind: 'image',
    defaultImage: image(FACTORY_PHOTO.url, FACTORY_PHOTO.small),
  },
  'interiors-kitchen': {
    // Named as the page shows it: under „Наши ремонти“, titled „Кухнята след монтажа“.
    label: {
      bg: 'Наши ремонти — „Кухнята след монтажа“ (широката снимка)',
      en: 'Our renovations — “The kitchen after fitting” (the wide photo)',
    },
    hint: hint(
      'Хоризонтална (16:10), поне 1200 px. Мястото за снимка на готова кухня. Само снимка от ваш обект — страницата я представя като работа на екипа.',
      'Landscape (16:10), at least 1200 px. The place for a photo of a finished kitchen. Only a photo of your own job — the page presents it as the team’s work.',
    ),
    aspect: '16:10',
    minWidth: 1200,
    emptyKind: 'image',
    defaultImage: interiors(INTERIORS_PHOTOS.kitchen),
  },
  'interiors-hero': {
    label: { bg: 'Вътрешни ремонти — главна снимка', en: 'Interiors — main photo' },
    hint: hint(
      'Вертикална (4:5), поне 1200 px. На телефон се изрязва хоризонтално (4:3). Само снимка от ваш обект — страницата я представя като работа на екипа.',
      'Upright (4:5), at least 1200 px. A phone crops it landscape (4:3). Only a photo of your own job — the page presents it as the team’s work.',
    ),
    aspect: '4:5',
    minWidth: 1200,
    emptyKind: 'image',
    defaultImage: interiors(INTERIORS_PHOTOS.bathBlack),
  },
  'interiors-works': {
    label: { bg: 'Снимка до „Какво правим“ (работа в процес)', en: 'Photo beside “What we do” (work in progress)' },
    hint: hint(
      'Вертикална (4:5), поне 1200 px. На телефон се изрязва хоризонтално (4:3). Само снимка от ваш обект — страницата я представя като работа на екипа.',
      'Upright (4:5), at least 1200 px. A phone crops it landscape (4:3). Only a photo of your own job — the page presents it as the team’s work.',
    ),
    aspect: '4:5',
    minWidth: 1200,
    emptyKind: 'image',
    defaultImage: interiors(INTERIORS_PHOTOS.kitchenFitting),
  },
  'doors-hero': {
    label: { bg: 'Врати — главна снимка', en: 'Doors — main photo' },
    hint: hint(
      'Хоризонтална (4:3), поне 1600 px. На телефон се изрязва по-широко (16:10). Най-добре врати, монтирани от екипа.',
      'Landscape (4:3), at least 1600 px. A phone crops it wider (16:10). Best: doors the team has fitted.',
    ),
    aspect: '4:3',
    minWidth: 1600,
    emptyKind: 'image',
    defaultImage: image(DOORS_COVER.src),
  },
}

function panelFor(slot) {
  if (FIXED[slot.name]) return FIXED[slot.name]
  if (slot.kind === 'hero') return heroPanel(Number(slot.name.slice('hero-'.length)))
  if (slot.kind === 'model') return modelPanel(slot.modelKey)
  if (slot.teamSlug) return teamPanel(slot.teamSlug)
  if (slot.tileKey) return tilePanel(slot.tileKey)
  if (slot.steps) return stepPanel(slot)
  if (slot.pairKey) return pairPanel(slot)
  return null
}

/**
 * The order the panel lists the slots in: each page's places top to bottom, as the page shows
 * them. The API's order only grows at the end, so it differs where a later slot sits higher on
 * its page (the home tiles above nothing else of theirs; Interiors' main photo and works photo
 * above the finished kitchen; the steel steps under the steel page's main photo, in the
 * product pages' group). photoSlots.test.js checks it names every slot exactly once.
 */
export const PANEL_ORDER = Object.freeze([
  'hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5',
  'model-37', 'model-58', 'model-73',
  'home-tile-modular-builds', 'home-tile-modular-houses', 'home-tile-steel-houses', 'home-tile-interiors',
  'page-modular-builds', 'page-modular-houses', 'page-steel-houses',
  'steel-step-1', 'steel-step-2', 'steel-step-3', 'steel-step-4', 'steel-step-5',
  'page-delivery',
  'page-partner',
  'partner-step-yard', 'partner-step-port', 'partner-step-plot',
  'about-hero',
  'about-team-vladimir-vladimirov', 'about-team-tsvetelin-bonin', 'about-team-nikolay-lekov',
  'about-team-radina-ivanova', 'about-team-vasil-vasilev', 'about-team-ivan-vasilev',
  'factory-floor',
  'interiors-hero', 'interiors-works', 'interiors-kitchen',
  'interiors-bathroom-before', 'interiors-bathroom-after',
  'interiors-kitchen-before', 'interiors-kitchen-after',
  'doors-hero',
])

/**
 * The row of its page's section a slot is drawn in. The home page has three (the slides, the
 * model cards, the tiles), each its own strip on the page; the numbered steps of the Partner
 * and steel pages are a row of their own under the page's main photo; each Interiors
 * before/after pair is its own row, so its two halves are seen, and explained, together;
 * everything else is the section's 'main' row.
 */
export function photoSlotRowOf(slot) {
  if (!slot) return 'main'
  if (slot.kind === 'hero') return 'hero'
  if (slot.kind === 'model') return 'models'
  if (slot.tileKey) return 'tiles'
  if (slot.steps) return `${slot.steps}-steps`
  if (slot.pairKey) return `pair-${slot.pairKey}`
  return 'main'
}

const bgPairs = bgInteriors?.jobs?.pairsHeading || 'Преди и след'
const enPairs = enInteriors?.jobs?.pairsHeading || 'Before and after'

/**
 * The sub-headings of the rows photoSlotRowOf names beyond the home page's (whose words are the
 * panel's own): the steps under the heading the page gives them, each pair under the page's
 * "Преди и след" and its room.
 */
export const PHOTO_SLOT_ROW_HEADINGS = Object.freeze({
  'steel-steps': {
    bg: `Сглобяеми къщи по проект — стъпките „${bgSteel?.process?.h2 || 'Как протича проектът'}“`,
    en: `Steel-frame houses — the steps “${enSteel?.process?.h2 || 'How a project goes'}”`,
  },
  'partner-steps': {
    bg: `Стъпките „${bgPartner?.process?.heading || 'Как работим'}“`,
    en: `The steps “${enPartner?.process?.heading || 'How we work'}”`,
  },
  ...Object.fromEntries(Object.keys(INTERIORS_PAIR_SLOTS).map((pairKey) => [`pair-${pairKey}`, {
    bg: `${bgPairs} — ${pairOf(bgInteriors, pairKey).title || pairKey}`,
    en: `${enPairs} — ${pairOf(enInteriors, pairKey).title || pairKey}`,
  }])),
})

// The admin screens where the photos this panel does not hold are changed.
export const ADMIN_GALLERY_PATH = '/admin/gallery'
export const ADMIN_CASES_PATH = '/admin/cases'
const GALLERY = { bg: { to: ADMIN_GALLERY_PATH, label: 'Галерия' }, en: { to: ADMIN_GALLERY_PATH, label: 'Gallery' } }
const CASES = { bg: { to: ADMIN_CASES_PATH, label: 'Проекти' }, en: { to: ADMIN_CASES_PATH, label: 'Cases' } }
// The pages show the case's photo by its fixed address (content files), and only while the
// published case still holds it: removing it in "Проекти" hides it here, but a photo added
// there never takes its place. The line says exactly that much.
const caseLine = {
  bg: ['Снимката на къщата в Паралия Кариани е от проекта ѝ в ', CASES.bg, ' — там може само да се премахне; друга на нейно място се слага при обновяване на сайта.'],
  en: ['The photo of the house in Paralia Kariani is from its case in ', CASES.en, ' — there it can only be removed; a different one goes in its place with a site update.'],
}

/**
 * Per page, the one line under its heading that says where the page's OTHER photos are
 * changed: a list of words and links ({ to, label }, the admin screen's menu name). What each
 * says was read off the page: the product pages' unit and model cards and the containers'
 * photos beside the table are gallery photos (useProductRows), and the delivered house in
 * Paralia Kariani (case 2) is a case's photos on the Box, delivery, partner and About pages
 * (usePublishedCase). The home page has no photo outside this panel, so its line points at the
 * pages that are nothing but gallery and case photos. Interiors' other pictures are its video
 * clips and the doors page's the catalogue's photos and drawings: no admin screen holds them.
 */
export const PHOTO_SLOT_GROUP_NOTES = Object.freeze({
  // The PAGES "Галерия" and "Цени", by name: the home page's own price strip ("Цени") holds the
  // model cards, whose photos ARE this panel's.
  home: {
    bg: ['Снимките на страниците „Галерия“ и „Цени“ се сменят в ', GALLERY.bg, ', а тези на „Казуси и отзиви“ — в ', CASES.bg, '.'],
    en: ['The photos on the “Gallery” and “Prices” pages are changed in ', GALLERY.en, ', and those on “Cases & Reviews” in ', CASES.en, '.'],
  },
  products: {
    bg: ['Останалите снимки на моделите се сменят в ', GALLERY.bg, '; тези от къщата в Паралия Кариани са от проекта ѝ в ', CASES.bg, ' и там могат само да се премахнат.'],
    en: ['The other photos of the models are changed in ', GALLERY.en, '; those of the house in Paralia Kariani are from its case in ', CASES.en, ' and can only be removed there.'],
  },
  delivery: caseLine,
  partner: caseLine,
  about: caseLine,
  interiors: {
    bg: ['Видеата на страницата не се сменят оттук — новите клипове се слагат при обновяване на сайта.'],
    en: ['The page’s videos are not changed here — new clips go in with a site update.'],
  },
  doors: {
    bg: ['Снимките и чертежите на вратите са от каталога NVC-1 и не се сменят оттук.'],
    en: ['The doors’ photos and drawings are the NVC-1 catalogue’s and are not changed here.'],
  },
})

/** The panel's entry for every slot of photoSlotNames.js, by name. */
export const PHOTO_SLOT_PANEL = Object.freeze(Object.fromEntries(
  PHOTO_SLOTS.map((slot) => [slot.name, Object.freeze(panelFor(slot))]),
))

/**
 * What to tell the owner about a photo before it goes up, or '' when it fits: narrower than the
 * slot wants, or the other way round from the slot's frame (a portrait in a landscape slot shows
 * only its middle band), or, where the page shows the photo whole (`crops: false`), upright in a
 * landscape place. A warning, never a refusal: the page crops whatever it is given.
 * `size` is { width, height } as the browser decoded it (EXIF rotation applied).
 */
export function fitWarning(name, size, lang = 'bg') {
  const panel = PHOTO_SLOT_PANEL[name]
  const w = Number(size?.width)
  const h = Number(size?.height)
  if (!panel || !(w > 0) || !(h > 0)) return ''
  const bg = lang !== 'en'
  const notes = []
  if (panel.minWidth && w < panel.minWidth) {
    notes.push(bg
      ? `Снимката е ${w} px широка, а за това място е добре да е поне ${panel.minWidth} px — може да изглежда размазана.`
      : `The photo is ${w} px wide; this place wants at least ${panel.minWidth} px, so it may look soft.`)
  }
  const [aw, ah] = String(panel.aspect || '').split(':').map(Number)
  const frame = aw > 0 && ah > 0 ? aw / ah : null
  const ratio = w / h
  if (panel.crops === false) {
    // Shown whole: nothing is cut, but an upright photo makes a tall block on the page.
    if (frame !== null && frame > 1.05 && ratio < 0.95) {
      notes.push(bg
        ? 'Снимката е вертикална — ще се покаже цяла, но висока.'
        : 'The photo is upright — it will show whole, but tall.')
    }
  } else if (frame !== null) {
    if (frame > 1.05 && ratio < 0.95) {
      notes.push(bg
        ? 'Снимката е вертикална, а мястото е хоризонтално — ще се вижда само средата ѝ.'
        : 'The photo is upright and this place is landscape, so only its middle will show.')
    } else if (frame < 0.95 && ratio > 1.05) {
      notes.push(bg
        ? 'Снимката е хоризонтална, а мястото е вертикално — ще се вижда само средата ѝ.'
        : 'The photo is landscape and this place is upright, so only its middle will show.')
    } else if (frame >= 0.95 && frame <= 1.05 && (ratio < 0.8 || ratio > 1.25)) {
      notes.push(bg
        ? 'Снимката не е квадратна — ще се покаже квадратна част от нея.'
        : 'The photo is not square, so only a square part of it will show.')
    }
  }
  return notes.join(' ')
}
