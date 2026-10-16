import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  HERO_KIND,
  MODEL_KIND,
  PAGE_KIND,
  PHOTO_KIND,
  PHOTO_SLOTS,
  PHOTO_SLOT_GROUPS,
  PHOTO_SLOT_NAMES,
  photoSlotOf,
  teamSlotName,
  tileSlotName,
} from './photoSlotNames.js'
import { PANEL_ORDER, PHOTO_SLOT_GROUP_HEADINGS, PHOTO_SLOT_PANEL, fitWarning } from './photoSlotDefaults.js'
import { MODEL_KEYS, PAGE_KEYS, PAGE_PHOTO_DEFAULTS } from './homePhotos.js'
import { TEAM_PHOTOS } from '../content/shared/company.js'
import { ABOUT_PHOTO, FACTORY_PHOTO } from '../content/shared/aboutMedia.js'
import { INTERIORS_PHOTOS } from '../content/shared/interiorsMedia.js'
import { DOORS_COVER } from '../content/shared/doorsCatalogue.js'
import { initials } from '../pages/AboutPage.jsx'
import bgHome from '../content/bg/home.js'
import enHome from '../content/en/home.js'
import elHome from '../content/el/home.js'
import bgAbout from '../content/bg/about.js'
import enAbout from '../content/en/about.js'
import elAbout from '../content/el/about.js'

// The photo slots of "Снимки на сайта". What is pinned: the SPA's list is the API's list, name
// for name, kind for kind, in the same order (the API's position is the upload folder and the
// hero slide number, so a slot is only ever appended); the first thirteen never move; every
// slot has its panel words and its default, and the default is a file the site really has;
// every person on the About page and every home tile has a slot; and the list pages import
// pulls in nothing heavy.

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
]

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
  it('is exactly these twenty-nine names, in this order', () => {
    expect(PHOTO_SLOT_NAMES).toEqual(ALL)
    expect(new Set(PHOTO_SLOT_NAMES).size).toBe(ALL.length)
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

  it('has five hero slides, three model cards, the five page photos the API serves under "pages", and sixteen page photos', () => {
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
    // jobs", not the doors.
    expect(PHOTO_SLOTS.filter((s) => !s.pickable).map((s) => s.name)).toEqual([
      ...ALL.filter((n) => n.startsWith('about-team-')),
      'factory-floor', 'interiors-kitchen', 'interiors-hero', 'interiors-works', 'doors-hero',
    ])
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

  it('lists every slot exactly once in the panel order, each group as one run', () => {
    expect([...PANEL_ORDER].sort()).toEqual([...PHOTO_SLOT_NAMES].sort())
    expect(new Set(PANEL_ORDER).size).toBe(PANEL_ORDER.length)
    const groups = PANEL_ORDER.map((name) => photoSlotOf(name).group)
    expect(groups.filter((g, i) => i === 0 || g !== groups[i - 1])).toEqual(PHOTO_SLOT_GROUPS)
    // Interiors top to bottom: the main photo, the works photo, then the finished kitchen.
    expect(PANEL_ORDER.filter((n) => n.startsWith('interiors-'))).toEqual(['interiors-hero', 'interiors-works', 'interiors-kitchen'])
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
    expect(PHOTO_SLOT_PANEL['hero-5'].label.bg).toBe('Снимка 5 · води към „Вътрешни ремонти“')
    expect(PHOTO_SLOT_PANEL['hero-5'].label.en).toBe('Photo 5 · links to “Interiors”')
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
  })

  it('points every default at a file the site has: under /public, or a gallery, case or content photo', () => {
    for (const name of PHOTO_SLOT_NAMES) {
      const image = PHOTO_SLOT_PANEL[name].defaultImage
      if (!image) continue
      for (const url of [image.url, image.thumb].filter(Boolean)) {
        if (isApiImage(url)) expect(url, name).toMatch(/^\/api\/img\/(content|gallery|cases)\/[^/?#]+(\/[^/?#]+)*\.webp$/)
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
