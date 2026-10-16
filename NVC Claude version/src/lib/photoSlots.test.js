import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  HERO_KIND,
  INTERIORS_PAIR_SLOTS,
  MODEL_KIND,
  PAGE_KIND,
  PARTNER_STEP_SLOTS,
  PHOTO_KIND,
  PHOTO_SLOTS,
  PHOTO_SLOT_GROUPS,
  PHOTO_SLOT_NAMES,
  STEEL_STEP_SLOTS,
  pairPartnerOf,
  photoSlotOf,
  teamSlotName,
  tileSlotName,
} from './photoSlotNames.js'
import {
  ADMIN_CASES_PATH,
  ADMIN_GALLERY_PATH,
  PANEL_ORDER,
  PHOTO_SLOT_GROUP_HEADINGS,
  PHOTO_SLOT_GROUP_NOTES,
  PHOTO_SLOT_PANEL,
  PHOTO_SLOT_ROW_HEADINGS,
  fitWarning,
  photoSlotRowOf,
} from './photoSlotDefaults.js'
import { MODEL_KEYS, PAGE_KEYS, PAGE_PHOTO_DEFAULTS } from './homePhotos.js'
import { TEAM_PHOTOS } from '../content/shared/company.js'
import { ABOUT_PHOTO, FACTORY_PHOTO } from '../content/shared/aboutMedia.js'
import { INTERIORS_PAIRS, INTERIORS_PHOTOS } from '../content/shared/interiorsMedia.js'
import { DOORS_COVER } from '../content/shared/doorsCatalogue.js'
import { initials } from '../pages/AboutPage.jsx'
import bgHome from '../content/bg/home.js'
import enHome from '../content/en/home.js'
import elHome from '../content/el/home.js'
import bgAbout from '../content/bg/about.js'
import enAbout from '../content/en/about.js'
import elAbout from '../content/el/about.js'
import bgPartner from '../content/bg/partner.js'
import enPartner from '../content/en/partner.js'
import elPartner from '../content/el/partner.js'
import bgSteel from '../content/bg/steelHouses.js'
import enSteel from '../content/en/steelHouses.js'
import elSteel from '../content/el/steelHouses.js'
import bgInteriors from '../content/bg/interiors.js'
import enInteriors from '../content/en/interiors.js'
import elInteriors from '../content/el/interiors.js'

// The photo slots of "Снимки на сайта". What is pinned: the SPA's list is the API's list, name
// for name, kind for kind, in the same order (the API's position is the upload folder and the
// hero slide number, so a slot is only ever appended); the first thirteen never move, nor the
// twenty-nine of phase 1; every slot has its panel words and its default, and the default is a
// file the site really has; every person on the About page and every home tile has a slot, and
// (2026-10-17) every Partner step but the factory's, every steel stage and every half of the
// Interiors pairs; every page's section says where its other photos are changed; and the list
// pages import pulls in nothing heavy.

const BASE = import.meta.env.BASE_URL || '/'
const PUBLIC = path.resolve(__dirname, '../../public')
const HOME_SLOT_CS = path.resolve(__dirname, '../../../api-dotnet/Data/Entities/HomeSlot.cs')

// The same literal list as api-dotnet.Tests/HomeSlotTests.cs, so a change on one side alone
// fails here as well as there.
const ALL = [
  'hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5',
  'model-37', 'model-58', 'model-73',
  'page-modular-builds', 'page-modular-houses', 'page-steel-houses', 'page-delivery', 'page-partner',
  'about-hero',
  'about-team-vladimir-vladimirov', 'about-team-tsvetelin-bonin', 'about-team-nikolay-lekov',
  'about-team-radina-ivanova', 'about-team-vasil-vasilev', 'about-team-ivan-vasilev',
  'factory-floor',
  'interiors-kitchen', 'interiors-hero', 'interiors-works',
  'doors-hero',
  'home-tile-modular-builds', 'home-tile-modular-houses', 'home-tile-steel-houses', 'home-tile-interiors',
  // 2026-10-17
  'partner-step-yard', 'partner-step-port', 'partner-step-plot',
  'interiors-bathroom-before', 'interiors-bathroom-after',
  'interiors-kitchen-before', 'interiors-kitchen-after',
  'steel-step-1', 'steel-step-2', 'steel-step-3', 'steel-step-4', 'steel-step-5',
]

// The twenty-nine of phase 1 (2026-10-16), live since deploy-2026-10-17: their positions are
// upload folders that hold the owner's photos.
const PHASE_1 = ALL.slice(0, 29)
const PHASE_2 = ALL.slice(29)

/** The API's slot table, read from the C# source: [{ name, kind, key }] in its order. */
function apiSlotTable() {
  const source = fs.readFileSync(HOME_SLOT_CS, 'utf8')
  const block = /Def\[\]\s+Defs\s*=\s*\{([\s\S]*?)\n\s*\};/.exec(source)
  expect(block, 'HomeSlot.cs has a Defs table').not.toBeNull()
  const rows = []
  const def = /new\("([^"]+)",\s*(Hero|Model|Page|Photo)Kind(?:,\s*"([^"]*)")?\)/g
  for (let m = def.exec(block[1]); m; m = def.exec(block[1])) {
    rows.push({ name: m[1], kind: m[2].toLowerCase(), key: m[3] ?? null })
  }
  return rows
}

describe('the slot list', () => {
  it('is exactly these forty-one names, in this order', () => {
    expect(PHOTO_SLOT_NAMES).toEqual(ALL)
    expect(ALL).toHaveLength(41)
    expect(new Set(PHOTO_SLOT_NAMES).size).toBe(ALL.length)
  })

  it('never moves the twenty-nine of phase 1, and appends the twelve of 2026-10-17 after them', () => {
    expect(PHASE_1).toHaveLength(29)
    expect(PHASE_1.at(-1)).toBe('home-tile-interiors')
    expect(PHOTO_SLOT_NAMES.slice(0, 29)).toEqual(PHASE_1)
    expect(PHOTO_SLOT_NAMES.slice(29)).toEqual(PHASE_2)
    // home/{index}/: the folder each new slot's uploads land in.
    expect(PHASE_2.map((name) => PHOTO_SLOT_NAMES.indexOf(name) + 1)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41])
  })

  it("is the API's list, name for name, kind for kind and key for key (HomeSlot.cs)", () => {
    const api = apiSlotTable()
    expect(api.map((r) => r.name)).toEqual(PHOTO_SLOT_NAMES)
    for (const row of api) {
      const slot = photoSlotOf(row.name)
      expect(slot.kind, row.name).toBe(row.kind)
      const key = slot.modelKey ?? slot.pageKey ?? null
      expect(key, row.name).toBe(row.key)
    }
  })

  it('never moves the first thirteen: the hero slide numbers and the home/{index} folders depend on them', () => {
    expect(PHOTO_SLOT_NAMES.slice(0, 13)).toEqual([
      'hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5', 'model-37', 'model-58', 'model-73',
      'page-modular-builds', 'page-modular-houses', 'page-steel-houses', 'page-delivery', 'page-partner',
    ])
  })

  it('has five hero slides, three model cards, the five page photos the API serves under "pages", and twenty-eight page photos', () => {
    const ofKind = (kind) => PHOTO_SLOTS.filter((s) => s.kind === kind)
    expect(ofKind(HERO_KIND).map((s) => s.name)).toEqual(['hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5'])
    expect(ofKind(MODEL_KIND).map((s) => s.modelKey)).toEqual(MODEL_KEYS)
    expect(ofKind(PAGE_KIND).map((s) => s.pageKey)).toEqual(PAGE_KEYS)
    expect(ofKind(PHOTO_KIND).map((s) => s.name)).toEqual(ALL.slice(13))
  })

  it('gives every slot a known group and its flags, and every name fits the 40-character column', () => {
    for (const slot of PHOTO_SLOTS) {
      expect(PHOTO_SLOT_GROUPS, slot.name).toContain(slot.group)
      expect(typeof slot.decorative, slot.name).toBe('boolean')
      expect(typeof slot.pickable, slot.name).toBe('boolean')
      expect(typeof slot.retired, slot.name).toBe('boolean')
      expect(slot.name.length, slot.name).toBeLessThanOrEqual(40)
      expect(slot.name, slot.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
    // Every group has at least one slot that is shown.
    for (const group of PHOTO_SLOT_GROUPS) {
      expect(PHOTO_SLOTS.some((s) => s.group === group && !s.retired), group).toBe(true)
    }
    expect(photoSlotOf('tile-interiors')).toBeNull()
    expect(photoSlotOf(undefined)).toBeNull()
  })

  it('marks the hero slides, the team and the tiles decorative, and keeps the gallery picker off the places whose words a house photo would falsify', () => {
    const decorative = PHOTO_SLOTS.filter((s) => s.decorative).map((s) => s.name)
    expect(decorative).toEqual([
      'hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5',
      ...ALL.filter((n) => n.startsWith('about-team-')),
      ...ALL.filter((n) => n.startsWith('home-tile-')),
    ])
    // The gallery is houses: not the team, not the factory floor, not Interiors' "our team's own
    // jobs", not the doors; and none of the twelve of 2026-10-17 — the Partner steps are each
    // captioned with a place (our base, the port, the customer's), the pairs are the team's own
    // jobs, and the steel steps are one real project at each stage.
    expect(PHOTO_SLOTS.filter((s) => !s.pickable).map((s) => s.name)).toEqual([
      ...ALL.filter((n) => n.startsWith('about-team-')),
      'factory-floor', 'interiors-kitchen', 'interiors-hero', 'interiors-works', 'doors-hero',
      ...PHASE_2,
    ])
    // None of the twelve is decorative: each page describes its picture today, so the owner's
    // photo gets a description too.
    for (const name of PHASE_2) expect(photoSlotOf(name).decorative, name).toBe(false)
    // An upright phone portrait in a round avatar keeps the head.
    for (const name of ALL.filter((n) => n.startsWith('about-team-'))) expect(photoSlotOf(name).adminPosition).toBe('50% 30%')
  })

  it('imports nothing, so a page that reads it cannot pull the door catalogue or the content into its chunk', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'photoSlotNames.js'), 'utf8')
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\bimport\(/)
    expect(source).not.toMatch(/\brequire\(/)
  })
})

describe('the people and the tiles', () => {
  const slugsOf = (content) => (content?.team?.people || []).map((p) => p.slug)

  it('gives every person on the About page, in all three languages, a slot that is not retired', () => {
    for (const content of [bgAbout, enAbout, elAbout]) {
      const slugs = slugsOf(content)
      expect(slugs.length).toBeGreaterThan(0)
      for (const slug of slugs) {
        const slot = photoSlotOf(teamSlotName(slug))
        expect(slot, slug).not.toBeNull()
        expect(slot.retired, slug).toBe(false)
        expect(slot.teamSlug).toBe(slug)
      }
    }
  })

  it('has no team slot shown in the panel for somebody the page does not show', () => {
    const shown = PHOTO_SLOTS.filter((s) => s.teamSlug && !s.retired).map((s) => s.teamSlug)
    expect(shown.sort()).toEqual([...slugsOf(bgAbout)].sort())
  })

  it('gives every "Какво правим" tile on home a slot, and every tile slot a tile', () => {
    for (const content of [bgHome, enHome, elHome]) {
      const keys = content.home.serviceTiles.items.map((item) => item.key)
      for (const key of keys) expect(tileSlotName(key), key).toBe(`home-tile-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`)
      expect(PHOTO_SLOTS.filter((s) => s.tileKey).map((s) => s.tileKey)).toEqual(keys)
    }
    expect(tileSlotName('nope')).toBeNull()
  })
})

// The twelve of 2026-10-17, checked against the pages they belong to: as many slots as the page
// has places, in its order, each place's default the same file in every language.
describe('the steps and the pairs', () => {
  const imagesOf = (content) => (content?.process?.steps || []).map((step) => step.image?.src)

  it("gives each of the Partner page's four steps its picture's slot, step 2 reusing the factory floor", () => {
    for (const content of [bgPartner, enPartner, elPartner]) expect(content.process.steps).toHaveLength(PARTNER_STEP_SLOTS.length)
    expect(PARTNER_STEP_SLOTS).toEqual(['partner-step-yard', 'factory-floor', 'partner-step-port', 'partner-step-plot'])
    // Step 2 shows the very file About's factory floor shows, so it is that slot, not a copy.
    expect(bgPartner.process.steps[1].image.src).toBe(FACTORY_PHOTO.url)
    expect(PHOTO_SLOTS.filter((s) => s.steps === 'partner').map((s) => [s.name, s.stepNumber, s.group])).toEqual([
      ['partner-step-yard', 1, 'partner'],
      ['partner-step-port', 3, 'partner'],
      ['partner-step-plot', 4, 'partner'],
    ])
    for (const slot of PHOTO_SLOTS.filter((s) => s.steps === 'partner')) expect(PARTNER_STEP_SLOTS[slot.stepNumber - 1]).toBe(slot.name)
    expect(imagesOf(enPartner)).toEqual(imagesOf(bgPartner))
    expect(imagesOf(elPartner)).toEqual(imagesOf(bgPartner))
  })

  it("gives each of the steel page's five stages a slot, in page order", () => {
    for (const content of [bgSteel, enSteel, elSteel]) expect(content.process.steps).toHaveLength(5)
    expect(STEEL_STEP_SLOTS).toEqual(['steel-step-1', 'steel-step-2', 'steel-step-3', 'steel-step-4', 'steel-step-5'])
    STEEL_STEP_SLOTS.forEach((name, i) => {
      const slot = photoSlotOf(name)
      expect(slot.stepNumber).toBe(i + 1)
      expect(slot.steps).toBe('steel')
      // Grouped with the steel page's main photo, under the product pages.
      expect(slot.group).toBe('products')
    })
    expect(imagesOf(enSteel)).toEqual(imagesOf(bgSteel))
    expect(imagesOf(elSteel)).toEqual(imagesOf(bgSteel))
  })

  it("gives each half of the Interiors page's two before/after pairs a slot, and knows each half's other half", () => {
    const keysOf = (content) => content.jobs.pairs.map((p) => p.key)
    for (const content of [bgInteriors, enInteriors, elInteriors]) expect(keysOf(content)).toEqual(Object.keys(INTERIORS_PAIR_SLOTS))
    expect(Object.keys(INTERIORS_PAIRS)).toEqual(Object.keys(INTERIORS_PAIR_SLOTS))
    expect(INTERIORS_PAIR_SLOTS).toEqual({
      bathroom: { before: 'interiors-bathroom-before', after: 'interiors-bathroom-after' },
      kitchen: { before: 'interiors-kitchen-before', after: 'interiors-kitchen-after' },
    })
    for (const [pairKey, names] of Object.entries(INTERIORS_PAIR_SLOTS)) {
      for (const side of ['before', 'after']) {
        const slot = photoSlotOf(names[side])
        expect(slot.pairKey).toBe(pairKey)
        expect(slot.pairSide).toBe(side)
        expect(slot.group).toBe('interiors')
      }
      expect(pairPartnerOf(names.before)).toBe(names.after)
      expect(pairPartnerOf(names.after)).toBe(names.before)
    }
    expect(pairPartnerOf('interiors-kitchen')).toBeNull()
    expect(pairPartnerOf('nope')).toBeNull()
  })
})

// What the panel says about each slot and what it shows while the slot is empty.

const isApiImage = (url) => url.startsWith('/api/img/')
const onDisk = (url) => {
  expect(url.startsWith(BASE), url).toBe(true)
  return fs.existsSync(path.join(PUBLIC, url.slice(BASE.length)))
}

describe('the panel entries', () => {
  it('has one for every slot, with both languages, a frame, a width and what an empty slot shows', () => {
    expect(Object.keys(PHOTO_SLOT_PANEL)).toEqual(PHOTO_SLOT_NAMES)
    for (const name of PHOTO_SLOT_NAMES) {
      const panel = PHOTO_SLOT_PANEL[name]
      expect(panel, name).toBeTruthy()
      for (const lang of ['bg', 'en']) {
        expect(panel.label[lang], `${name} label ${lang}`).toMatch(/\S/)
        expect(panel.hint[lang], `${name} hint ${lang}`).toMatch(/\S/)
      }
      expect(panel.aspect, name).toMatch(/^\d+:\d+$/)
      expect(panel.minWidth, name).toBeGreaterThan(0)
      expect(['image', 'monogram', 'none'], name).toContain(panel.emptyKind)
      if (panel.emptyKind === 'image') expect(panel.defaultImage?.url, name).toMatch(/\S/)
      else expect(panel.defaultImage, name).toBeNull()
      if (panel.emptyKind === 'monogram') expect(panel.monogram, name).toMatch(/\S/)
    }
  })

  it('labels every slot differently, in each language, so every button and notice names one place', () => {
    for (const lang of ['bg', 'en']) {
      const labels = PHOTO_SLOT_NAMES.map((name) => PHOTO_SLOT_PANEL[name].label[lang])
      const repeated = labels.filter((label, i) => labels.indexOf(label) !== i)
      expect(repeated, lang).toEqual([])
    }
    expect(PHOTO_SLOT_PANEL['about-hero'].label.bg).toBe('За нас — главна снимка')
    expect(PHOTO_SLOT_PANEL['doors-hero'].label.bg).toBe('Врати — главна снимка')
  })

  it('lists every slot exactly once in the panel order, each group as one run and each row of a group as one run', () => {
    expect([...PANEL_ORDER].sort()).toEqual([...PHOTO_SLOT_NAMES].sort())
    expect(new Set(PANEL_ORDER).size).toBe(PANEL_ORDER.length)
    const groups = PANEL_ORDER.map((name) => photoSlotOf(name).group)
    expect(groups.filter((g, i) => i === 0 || g !== groups[i - 1])).toEqual(PHOTO_SLOT_GROUPS)
    const rows = PANEL_ORDER.map((name) => `${photoSlotOf(name).group}/${photoSlotRowOf(photoSlotOf(name))}`)
    const runs = rows.filter((r, i) => i === 0 || r !== rows[i - 1])
    expect(new Set(runs).size, runs.join(' ')).toBe(runs.length)
    // Interiors top to bottom: the main photo, the works photo, the finished kitchen, then the
    // pairs under "Преди и след", each "before" beside its "after".
    expect(PANEL_ORDER.filter((n) => n.startsWith('interiors-'))).toEqual([
      'interiors-hero', 'interiors-works', 'interiors-kitchen',
      'interiors-bathroom-before', 'interiors-bathroom-after', 'interiors-kitchen-before', 'interiors-kitchen-after',
    ])
    // The steel steps right under the steel page's main photo; Partner's steps under its photo.
    const at = (name) => PANEL_ORDER.indexOf(name)
    expect(PANEL_ORDER.slice(at('page-steel-houses') + 1, at('page-steel-houses') + 6)).toEqual(STEEL_STEP_SLOTS)
    expect(PANEL_ORDER.slice(at('page-partner'), at('page-partner') + 4)).toEqual(['page-partner', 'partner-step-yard', 'partner-step-port', 'partner-step-plot'])
  })

  it('splits a section into rows: the home strips, the main photos, the numbered steps, each pair on its own', () => {
    const rowsOf = (group) => [...new Set(PANEL_ORDER.filter((n) => photoSlotOf(n).group === group).map((n) => photoSlotRowOf(photoSlotOf(n))))]
    expect(rowsOf('home')).toEqual(['hero', 'models', 'tiles'])
    expect(rowsOf('products')).toEqual(['main', 'steel-steps'])
    expect(rowsOf('delivery')).toEqual(['main'])
    expect(rowsOf('partner')).toEqual(['main', 'partner-steps'])
    expect(rowsOf('about')).toEqual(['main'])
    expect(rowsOf('interiors')).toEqual(['main', 'pair-bathroom', 'pair-kitchen'])
    expect(rowsOf('doors')).toEqual(['main'])
    expect(photoSlotRowOf(null)).toBe('main')
    // Every row beyond the home strips has its heading, in both languages, from the page's words.
    expect(PHOTO_SLOT_ROW_HEADINGS['steel-steps'].bg).toBe('Сглобяеми къщи по проект — стъпките „Как протича проектът“')
    expect(PHOTO_SLOT_ROW_HEADINGS['partner-steps'].bg).toBe('Стъпките „Как работим“')
    expect(PHOTO_SLOT_ROW_HEADINGS['pair-bathroom'].bg).toBe('Преди и след — Баня')
    expect(PHOTO_SLOT_ROW_HEADINGS['pair-kitchen'].bg).toBe('Преди и след — Кухня')
    for (const key of ['steel-steps', 'partner-steps', 'pair-bathroom', 'pair-kitchen']) expect(PHOTO_SLOT_ROW_HEADINGS[key].en, key).toMatch(/\S/)
  })

  it('names each step and each half of a pair as the page does, and in the notices by its page and number', () => {
    expect(PHOTO_SLOT_PANEL['partner-step-yard'].label.bg).toBe('Стъпка 1 · „Запитване“')
    expect(PHOTO_SLOT_PANEL['partner-step-port'].label.bg).toBe('Стъпка 3 · „От склада или от нашата фабрика“')
    expect(PHOTO_SLOT_PANEL['partner-step-plot'].label.bg).toBe('Стъпка 4 · „Доставка“')
    expect(PHOTO_SLOT_PANEL['partner-step-plot'].short.bg).toBe('Партньори, стъпка 4')
    STEEL_STEP_SLOTS.forEach((name, i) => {
      expect(PHOTO_SLOT_PANEL[name].label.bg).toBe(`Стъпка ${i + 1} · „${bgSteel.process.steps[i].title}“`)
      expect(PHOTO_SLOT_PANEL[name].label.en).toBe(`Step ${i + 1} · “${enSteel.process.steps[i].title}”`)
      expect(PHOTO_SLOT_PANEL[name].short.bg).toBe(`Сглобяеми къщи, стъпка ${i + 1}`)
    })
    expect(PHOTO_SLOT_PANEL['interiors-bathroom-before'].label.bg).toBe('Баня — „Преди“')
    expect(PHOTO_SLOT_PANEL['interiors-bathroom-after'].label.bg).toBe('Баня — „След“')
    expect(PHOTO_SLOT_PANEL['interiors-kitchen-before'].label.bg).toBe('Кухня — „По време на монтажа“')
    expect(PHOTO_SLOT_PANEL['interiors-kitchen-after'].label.bg).toBe('Кухня — „Готово“')
    expect(PHOTO_SLOT_PANEL['interiors-kitchen-before'].short.bg).toBe('Кухня — по време на монтажа')
    expect(PHOTO_SLOT_PANEL['interiors-bathroom-after'].label.en).toBe('Bathroom — “After”')
  })

  it("frames the steps and the pairs as the pages' CSS does, and says what each must show", () => {
    for (const name of [...PARTNER_STEP_SLOTS.filter((n) => n !== 'factory-floor'), ...STEEL_STEP_SLOTS]) {
      // ProcessSteps' width/height (800 x 671) and ProductSteel.css aspect-ratio:800/671.
      expect(PHOTO_SLOT_PANEL[name].aspect, name).toBe('800:671')
      expect(PHOTO_SLOT_PANEL[name].minWidth, name).toBe(1200)
    }
    for (const names of Object.values(INTERIORS_PAIR_SLOTS)) {
      for (const name of [names.before, names.after]) {
        // Interiors.css .ir-pair-fig img: aspect-ratio 4/5.
        expect(PHOTO_SLOT_PANEL[name].aspect, name).toBe('4:5')
        expect(PHOTO_SLOT_PANEL[name].hint.bg).toMatch(/едно и също помещение/)
      }
    }
    // A Partner step's caption names a place, and the hint quotes it.
    expect(PHOTO_SLOT_PANEL['partner-step-yard'].hint.bg).toContain('„Нашата база в Марикостиново“')
    expect(PHOTO_SLOT_PANEL['partner-step-port'].hint.bg).toContain('„На пристанището“')
    expect(PHOTO_SLOT_PANEL['partner-step-plot'].hint.bg).toContain('„При клиента“')
    expect(PHOTO_SLOT_PANEL['partner-step-plot'].hint.en).toContain('“At the client\'s”')
    // A steel step asks for a real project; a caption that calls the picture a render is not
    // quoted as what the photo should show.
    for (const name of STEEL_STEP_SLOTS) expect(PHOTO_SLOT_PANEL[name].hint.bg, name).toMatch(/ваш истински проект/)
    expect(bgSteel.process.steps[0].image.caption).toMatch(/^Визуализация/)
    expect(PHOTO_SLOT_PANEL['steel-step-1'].hint.bg).not.toMatch(/Визуализация/)
    expect(PHOTO_SLOT_PANEL['steel-step-1'].hint.en).not.toMatch(/render/i)
    expect(PHOTO_SLOT_PANEL['steel-step-2'].hint.bg).toContain(`„${bgSteel.process.steps[1].image.caption}“`)
    // Step 5's default caption names the render's canopies; the hint quotes the words that will
    // sit under his photo instead.
    expect(PHOTO_SLOT_PANEL['steel-step-5'].hint.bg).toContain(`„${bgSteel.process.steps[4].image.adminCaption}“`)
    expect(PHOTO_SLOT_PANEL['steel-step-5'].hint.bg).not.toMatch(/козирки/)
    // The factory photo is also Partner step 2, cut to the steps' frame there.
    expect(PHOTO_SLOT_PANEL['factory-floor'].hint.bg).toMatch(/„Партньори“ \(стъпка 2\).*около 6:5/)
    expect(PHOTO_SLOT_PANEL['factory-floor'].hint.en).toMatch(/Partners \(step 2\).*about 6:5/)
    expect(PHOTO_SLOT_PANEL['steel-step-5'].empty.bg).toMatch(/визуализация \(не снимка\)/)
  })

  it("says, on every page's section, where its other photos are changed, linking the Gallery and Cases screens", () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../App.jsx'), 'utf8')
    for (const route of [ADMIN_GALLERY_PATH, ADMIN_CASES_PATH]) expect(app, route).toContain(`<Route path="${route}"`)
    expect(Object.keys(PHOTO_SLOT_GROUP_NOTES)).toEqual(PHOTO_SLOT_GROUPS)
    const linksOf = (parts) => parts.filter((p) => typeof p !== 'string')
    const textOf = (parts) => parts.map((p) => (typeof p === 'string' ? p : p.label)).join('')
    for (const group of PHOTO_SLOT_GROUPS) {
      for (const lang of ['bg', 'en']) {
        const parts = PHOTO_SLOT_GROUP_NOTES[group][lang]
        expect(Array.isArray(parts), `${group} ${lang}`).toBe(true)
        expect(textOf(parts), `${group} ${lang}`).toMatch(/\S/)
        for (const link of linksOf(parts)) expect([ADMIN_GALLERY_PATH, ADMIN_CASES_PATH], `${group} ${lang}`).toContain(link.to)
      }
    }
    const targets = (group) => linksOf(PHOTO_SLOT_GROUP_NOTES[group].bg).map((l) => `${l.label} ${l.to}`)
    expect(targets('home')).toEqual(['Галерия /admin/gallery', 'Проекти /admin/cases'])
    expect(targets('products')).toEqual(['Галерия /admin/gallery', 'Проекти /admin/cases'])
    for (const group of ['delivery', 'partner', 'about']) {
      expect(targets(group), group).toEqual(['Проекти /admin/cases'])
      expect(textOf(PHOTO_SLOT_GROUP_NOTES[group].bg)).toBe('Снимката на къщата в Паралия Кариани е от проекта ѝ в Проекти — там може само да се премахне; друга на нейно място се слага при обновяване на сайта.')
    }
    // Interiors' videos and the doors' catalogue pictures have no admin screen: said, unlinked.
    expect(targets('interiors')).toEqual([])
    expect(textOf(PHOTO_SLOT_GROUP_NOTES.interiors.bg)).toMatch(/^Видеата на страницата не се сменят оттук/)
    expect(targets('doors')).toEqual([])
    expect(textOf(PHOTO_SLOT_GROUP_NOTES.doors.bg)).toMatch(/каталога NVC-1 и не се сменят оттук/)
  })

  it('heads every group, in both languages, with the page names the panel uses', () => {
    expect(PHOTO_SLOT_GROUPS.map((g) => PHOTO_SLOT_GROUP_HEADINGS[g].bg)).toEqual([
      'Начална страница', 'Продуктови страници', 'Доставка', 'Партньори', 'За нас', 'Вътрешни ремонти', 'Интериорни врати',
    ])
    for (const g of PHOTO_SLOT_GROUPS) expect(PHOTO_SLOT_GROUP_HEADINGS[g].en, g).toMatch(/\S/)
  })

  it('names, on each hero slide, the page that slide links to (the arrows move photos, not links)', () => {
    const slides = bgHome.home.hero.showcase.slides
    expect(slides).toHaveLength(5)
    slides.forEach((slide, i) => {
      expect(PHOTO_SLOT_PANEL[`hero-${i + 1}`].label.bg).toBe(`Снимка ${i + 1} · води към „${slide.alt}“`)
    })
    // Slide 5 links to the delivery page since 2026-10-17 (its default photo is the crane lift).
    expect(slides[4].pathKey).toBe('delivery')
    expect(PHOTO_SLOT_PANEL['hero-5'].label.bg).toBe('Снимка 5 · води към „Доставка и монтаж“')
    expect(PHOTO_SLOT_PANEL['hero-5'].label.en).toBe('Photo 5 · links to “Delivery and assembly”')
  })

  it('shows as the default exactly what the pages show while the slot is empty', () => {
    const def = (name) => PHOTO_SLOT_PANEL[name].defaultImage?.url ?? null
    // The home slides and tiles: the content's photos, the same in every language.
    bgHome.home.hero.showcase.slides.forEach((slide, i) => {
      expect(def(`hero-${i + 1}`)).toBe(slide.src)
      expect(enHome.home.hero.showcase.slides[i].src).toBe(slide.src)
      expect(elHome.home.hero.showcase.slides[i].src).toBe(slide.src)
    })
    bgHome.home.serviceTiles.items.forEach((item, i) => {
      expect(def(tileSlotName(item.key))).toBe(item.img)
      expect(enHome.home.serviceTiles.items[i].img).toBe(item.img)
      expect(elHome.home.serviceTiles.items[i].img).toBe(item.img)
    })
    expect(def('model-37')).toBe(`${BASE}box-config/models/model-37-standard.webp`)
    expect(def('page-steel-houses')).toBeNull()
    expect(def('page-delivery')).toBe(PAGE_PHOTO_DEFAULTS.delivery.url)
    expect(def('page-partner')).toBe(PAGE_PHOTO_DEFAULTS.partner.url)
    expect(def('about-hero')).toBe(ABOUT_PHOTO.url)
    expect(def('factory-floor')).toBe(FACTORY_PHOTO.url)
    expect(def('interiors-kitchen')).toBe(INTERIORS_PHOTOS.kitchen.large)
    expect(def('interiors-hero')).toBe(INTERIORS_PHOTOS.bathBlack.large)
    expect(def('interiors-works')).toBe(INTERIORS_PHOTOS.kitchenFitting.large)
    expect(def('doors-hero')).toBe(DOORS_COVER.src)
    // 2026-10-17: each step's picture as the content gives it (the same file in every language,
    // pinned above), and each half of a pair as interiorsMedia.js does.
    expect(def('partner-step-yard')).toBe(bgPartner.process.steps[0].image.src)
    expect(def('partner-step-port')).toBe(bgPartner.process.steps[2].image.src)
    expect(def('partner-step-plot')).toBe(bgPartner.process.steps[3].image.src)
    expect(def('partner-step-yard')).toBe('/delivery/journey-yard.webp')
    STEEL_STEP_SLOTS.forEach((name, i) => expect(def(name), name).toBe(bgSteel.process.steps[i].image.src))
    for (const [pairKey, names] of Object.entries(INTERIORS_PAIR_SLOTS)) {
      expect(def(names.before), names.before).toBe(INTERIORS_PAIRS[pairKey].before.src)
      expect(def(names.after), names.after).toBe(INTERIORS_PAIRS[pairKey].after.src)
    }
    // The kitchen pair's static crops come with their 600 px copies as the thumbnails.
    expect(PHOTO_SLOT_PANEL['interiors-kitchen-before'].defaultImage.thumb).toBe(INTERIORS_PHOTOS.kitchenProgress.small)
  })

  it('points every default at a file the site has: under /public, or a gallery, case or content photo', () => {
    for (const name of PHOTO_SLOT_NAMES) {
      const image = PHOTO_SLOT_PANEL[name].defaultImage
      if (!image) continue
      for (const url of [image.url, image.thumb].filter(Boolean)) {
        // The steel page's third step is the one content picture still a JPEG.
        if (isApiImage(url)) expect(url, name).toMatch(/^\/api\/img\/(content|gallery|cases)\/[^/?#]+(\/[^/?#]+)*\.(webp|jpe?g)$/)
        else expect(onDisk(url), `${name}: ${url}`).toBe(true)
      }
    }
  })

  it("puts the base path in front of a team photo's path, as the About page does", () => {
    const listed = Object.keys(TEAM_PHOTOS)
    expect(listed.length).toBeGreaterThan(0)
    for (const slug of listed) {
      const url = PHOTO_SLOT_PANEL[teamSlotName(slug)].defaultImage.url
      expect(url).toBe(`${BASE}${String(TEAM_PHOTOS[slug]).replace(/^\//, '')}`)
      expect(url).not.toMatch(/\/\//)
      expect(onDisk(url), url).toBe(true)
    }
  })

  it("shows the initials, as the About page draws them, for a person without a photo, and says to remove rather than restore", () => {
    for (const person of bgAbout.team.people) {
      const panel = PHOTO_SLOT_PANEL[teamSlotName(person.slug)]
      if (TEAM_PHOTOS[person.slug]) {
        expect(panel.emptyKind, person.slug).toBe('image')
      } else {
        expect(panel.emptyKind, person.slug).toBe('monogram')
        expect(panel.monogram, person.slug).toBe(initials(person.name))
      }
      expect(panel.label.bg).toBe(`Екип: ${person.name}`)
      expect(panel.hint.bg.toLowerCase()).toContain('квадратна, лицето в средата')
    }
    expect(PHOTO_SLOT_PANEL['about-team-radina-ivanova'].monogram).toBe('РИ')
  })
})

describe('fitWarning', () => {
  it('says nothing about a photo that fits', () => {
    expect(fitWarning('hero-1', { width: 2400, height: 1500 })).toBe('')
    expect(fitWarning('about-team-radina-ivanova', { width: 800, height: 800 })).toBe('')
    expect(fitWarning('interiors-hero', { width: 1536, height: 2048 })).toBe('')
  })

  it('warns about a photo narrower than the place wants', () => {
    expect(fitWarning('hero-1', { width: 1024, height: 640 })).toMatch(/1024 px.*1600 px/)
    expect(fitWarning('hero-1', { width: 1024, height: 640 }, 'en')).toMatch(/1024 px wide.*1600 px/)
  })

  it('warns about a photo turned the other way from its place', () => {
    expect(fitWarning('doors-hero', { width: 1536, height: 2048 })).toMatch(/вертикална, а мястото е хоризонтално/)
    expect(fitWarning('interiors-works', { width: 2048, height: 1536 })).toMatch(/хоризонтална, а мястото е вертикално/)
    expect(fitWarning('about-team-vasil-vasilev', { width: 1536, height: 2048 })).toMatch(/не е квадратна/)
    // The steps' frame is landscape (800:671), the pairs' upright (4:5).
    expect(fitWarning('steel-step-2', { width: 1536, height: 2048 })).toMatch(/вертикална, а мястото е хоризонтално/)
    expect(fitWarning('partner-step-port', { width: 2048, height: 1536 })).toBe('')
    expect(fitWarning('interiors-bathroom-after', { width: 2048, height: 1536 })).toMatch(/хоризонтална, а мястото е вертикално/)
    expect(fitWarning('interiors-bathroom-after', { width: 1536, height: 2048 })).toBe('')
  })

  it('where the page shows the photo whole, warns only that an upright one comes out tall', () => {
    expect(PHOTO_SLOT_PANEL['page-delivery'].crops).toBe(false)
    expect(fitWarning('page-delivery', { width: 1536, height: 2048 })).toBe('Снимката е вертикална — ще се покаже цяла, но висока.')
    expect(fitWarning('page-delivery', { width: 1536, height: 2048 }, 'en')).toBe('The photo is upright — it will show whole, but tall.')
    expect(fitWarning('page-delivery', { width: 2048, height: 1536 })).toBe('')
    // Still warns about a narrow one.
    expect(fitWarning('page-delivery', { width: 1024, height: 768 })).toMatch(/1024 px.*1500 px/)
    expect(fitWarning('page-delivery', { width: 1024, height: 768 })).not.toMatch(/средата/)
  })

  it('stays quiet when it cannot tell', () => {
    expect(fitWarning('nope', { width: 10, height: 10 })).toBe('')
    expect(fitWarning('hero-1', null)).toBe('')
    expect(fitWarning('hero-1', { width: 0, height: 0 })).toBe('')
  })
})
