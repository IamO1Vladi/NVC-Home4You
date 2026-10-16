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
import { PHOTO_SLOTS } from './photoSlotNames.js'
import { PAGE_PHOTO_DEFAULTS } from './homePhotos.js'
import { TEAM_PHOTOS } from '../content/shared/company.js'
import { ABOUT_PHOTO, FACTORY_PHOTO } from '../content/shared/aboutMedia.js'
import { INTERIORS_PHOTOS } from '../content/shared/interiorsMedia.js'
import { DOORS_COVER } from '../content/shared/doorsCatalogue.js'
import { getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import bgHome from '../content/bg/home.js'
import enHome from '../content/en/home.js'
import bgAbout from '../content/bg/about.js'
import enAbout from '../content/en/about.js'
import bgModularBuilds from '../content/bg/modularBuilds.js'
import bgModularHouses from '../content/bg/modularHouses.js'

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
      'Широка (16:9; на компютър още по-широка, 21:9), поне 1600 px, главното в средата.',
      'Wide (16:9; wider still on a computer, 21:9), at least 1600 px, the subject in the middle.',
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
  return null
}

/**
 * The order the panel lists the slots in: each page's places top to bottom, as the page shows
 * them. The API's order only grows at the end, so it differs where a later slot sits higher on
 * its page (the home tiles above nothing else of theirs; Interiors' main photo and works photo
 * above the finished kitchen). photoSlots.test.js checks it names every slot exactly once.
 */
export const PANEL_ORDER = Object.freeze([
  'hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5',
  'model-37', 'model-58', 'model-73',
  'home-tile-modular-builds', 'home-tile-modular-houses', 'home-tile-steel-houses', 'home-tile-interiors',
  'page-modular-builds', 'page-modular-houses', 'page-steel-houses',
  'page-delivery',
  'page-partner',
  'about-hero',
  'about-team-vladimir-vladimirov', 'about-team-tsvetelin-bonin', 'about-team-nikolay-lekov',
  'about-team-radina-ivanova', 'about-team-vasil-vasilev', 'about-team-ivan-vasilev',
  'factory-floor',
  'interiors-hero', 'interiors-works', 'interiors-kitchen',
  'doors-hero',
])

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
