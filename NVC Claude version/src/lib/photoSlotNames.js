// The photo slots of "Снимки на сайта" (/admin/home-photos): every place on the public site
// whose photo the owner can change from the admin panel, by the name the API stores it under.
//
// THIS FILE IMPORTS NOTHING, ON PURPOSE. Pages import it (the home page's tiles, the About
// page's team), and a page's chunk carries everything this file pulls in. The words and the
// default picture of each slot are only the panel's business, so they live in
// photoSlotDefaults.js, which imports the door catalogue, the interiors media and the content
// files, and which only the admin panel and the tests import. Keep it that way: one import here
// would put all of that into the home page's download.
//
// THE ORDER IS THE API'S, AND IT ONLY GROWS AT THE END. api-dotnet/Data/Entities/HomeSlot.cs
// lists the same names in the same order (photoSlots.test.js reads that file and compares).
// A slot's 1-based position there is the folder its uploads land in (home/{index}/…) and, for
// a hero slide, its slide number, so a new slot is appended and an old one is never removed:
// a place that goes away (a team member who leaves) is marked `retired` here, the panel stops
// showing it, and the name stays in both lists so nothing after it moves.
//
// Each slot:
//   name          the API's name
//   kind          'hero' (a home slide), 'model' (a model card on home), 'page' (a page's main
//                 photo, served under "pages" by route key) or 'photo' (served under "slots" by
//                 name; the sixteen of 2026-10-16)
//   group         the page it belongs to, which is how the panel groups it (PHOTO_SLOT_GROUPS)
//   decorative    the page draws it with alt="" (the words beside it say what it is), so the
//                 panel asks for no description
//   pickable      the panel offers "От галерията" (false where a gallery house photo would make
//                 the page's words untrue: the team, the factory floor, Interiors' three photos
//                 ("our team's own jobs"), the doors' main photo)
//   retired       the place is gone from the site; the panel hides the slot
//   adminPosition where to crop an uploaded photo, when not from the centre (the team's round
//                 avatars: an upright phone portrait keeps the head)
//   modelKey / pageKey / tileKey / teamSlug   the key the page knows the slot by

export const HERO_KIND = 'hero'
export const MODEL_KIND = 'model'
export const PAGE_KIND = 'page'
export const PHOTO_KIND = 'photo'

/** The panel's groups, in the order its sections appear: one per page of the site. */
export const PHOTO_SLOT_GROUPS = Object.freeze(['home', 'products', 'delivery', 'partner', 'about', 'interiors', 'doors'])

export const TEAM_SLOT_PREFIX = 'about-team-'
export const TILE_SLOT_PREFIX = 'home-tile-'

const slot = (name, kind, group, more = {}) => Object.freeze({
  name,
  kind,
  group,
  decorative: false,
  pickable: true,
  retired: false,
  ...more,
})

const hero = (n) => slot(`hero-${n}`, HERO_KIND, 'home', { decorative: true })
const model = (key) => slot(`model-${key}`, MODEL_KIND, 'home', { modelKey: key })
const team = (slug) => slot(`${TEAM_SLOT_PREFIX}${slug}`, PHOTO_KIND, 'about', {
  decorative: true,
  pickable: false,
  teamSlug: slug,
  adminPosition: '50% 30%',
})
const tile = (suffix, tileKey) => slot(`${TILE_SLOT_PREFIX}${suffix}`, PHOTO_KIND, 'home', { decorative: true, tileKey })

export const PHOTO_SLOTS = Object.freeze([
  // 1-5: the home page's hero slides, as the slideshow plays them.
  hero(1), hero(2), hero(3), hero(4), hero(5),
  // 6-8: the model cards in the home page's prices strip.
  model('37'), model('58'), model('73'),
  // 9-13: the main photo of the three product pages, then of Delivery and of Partner.
  slot('page-modular-builds', PAGE_KIND, 'products', { pageKey: 'modularBuilds' }),
  slot('page-modular-houses', PAGE_KIND, 'products', { pageKey: 'modularHouses' }),
  slot('page-steel-houses', PAGE_KIND, 'products', { pageKey: 'steelHouses' }),
  slot('page-delivery', PAGE_KIND, 'delivery', { pageKey: 'delivery' }),
  slot('page-partner', PAGE_KIND, 'partner', { pageKey: 'partner' }),
  // 14-29 (2026-10-16): About's main photo, its six people and the factory floor; Interiors'
  // finished kitchen, main photo and works photo; the doors page's main photo; the four
  // "Какво правим" tiles on home.
  slot('about-hero', PHOTO_KIND, 'about'),
  team('vladimir-vladimirov'),
  team('tsvetelin-bonin'),
  team('nikolay-lekov'),
  team('radina-ivanova'),
  team('vasil-vasilev'),
  team('ivan-vasilev'),
  slot('factory-floor', PHOTO_KIND, 'about', { pickable: false }),
  slot('interiors-kitchen', PHOTO_KIND, 'interiors', { pickable: false }),
  slot('interiors-hero', PHOTO_KIND, 'interiors', { pickable: false }),
  slot('interiors-works', PHOTO_KIND, 'interiors', { pickable: false }),
  slot('doors-hero', PHOTO_KIND, 'doors', { pickable: false }),
  tile('modular-builds', 'modularBuilds'),
  tile('modular-houses', 'modularHouses'),
  tile('steel-houses', 'steelHouses'),
  tile('interiors', 'interiors'),
])

/** Every name, in the API's order. */
export const PHOTO_SLOT_NAMES = Object.freeze(PHOTO_SLOTS.map((s) => s.name))

const BY_NAME = new Map(PHOTO_SLOTS.map((s) => [s.name, s]))

/** The slot called `name`, or null for a name this list does not know. */
export const photoSlotOf = (name) => BY_NAME.get(name) ?? null

/** A team member's slot name, by the slug the about content gives them. */
export const teamSlotName = (slug) => `${TEAM_SLOT_PREFIX}${slug}`

/** The slot name of a home "Какво правим" tile, by the tile's key; null for a tile without one. */
export const tileSlotName = (tileKey) => PHOTO_SLOTS.find((s) => s.tileKey === tileKey)?.name ?? null
