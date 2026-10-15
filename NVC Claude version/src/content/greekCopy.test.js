import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import * as elAbout from './el/about.js'
import * as elCases from './el/cases.js'
import * as elDelivery from './el/delivery.js'
import * as elFaq from './el/faq.js'
import * as elFloorPlanner from './el/floorPlanner.js'
import * as elHome from './el/home.js'
import * as elInteriors from './el/interiors.js'
import * as elInternalDoors from './el/internalDoors.js'
import * as elModularBuilds from './el/modularBuilds.js'
import * as elModularHouses from './el/modularHouses.js'
import * as elPartner from './el/partner.js'
import * as elPrivacy from './el/privacy.js'
import * as elSteelHouses from './el/steelHouses.js'

import bgHome from './bg/home.js'
import enHome from './en/home.js'
import bgModularHouses from './bg/modularHouses.js'
import enModularHouses from './en/modularHouses.js'
import bgPartner from './bg/partner.js'
import enPartner from './en/partner.js'
import { routeMapControls, routeMapDestinations } from './shared/routeMap.js'

// ROADMAP #11, the Greek audit: English and Bulgarian-in-Latin words that sat inside the
// Greek copy outside the configurator. Each pattern below was a real string on a /el page
// (or in its meta, breadcrumb or assistive text). A Greek page reads every one of them; nobody
// on the team reads Greek fluently enough to notice one creeping back in review.

const EL_FILES = {
  'el/about.js': elAbout,
  'el/cases.js': elCases,
  'el/delivery.js': elDelivery,
  'el/faq.js': elFaq,
  'el/floorPlanner.js': elFloorPlanner,
  'el/home.js': elHome,
  'el/interiors.js': elInteriors,
  'el/internalDoors.js': elInternalDoors,
  'el/modularBuilds.js': elModularBuilds,
  'el/modularHouses.js': elModularHouses,
  'el/partner.js': elPartner,
  'el/privacy.js': elPrivacy,
  'el/steelHouses.js': elSteelHouses,
}

// Keys whose values are identifiers, paths or URLs, never shown as words.
const CODE_KEYS = new Set(['key', 'pathKey', 'id', 'url', 'src', 'img', 'image', 'href', 'fallback', 'brochureSlug', 'heroImage'])

/** Every [dotted path, string] in a module's exports, default and named. */
function strings(mod) {
  const out = []
  const walk = (value, at) => {
    if (typeof value === 'string') out.push([at, value])
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${at}[${i}]`))
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (!CODE_KEYS.has(k)) walk(v, at ? `${at}.${k}` : k)
      }
    }
  }
  for (const [name, value] of Object.entries(mod)) walk(value, name)
  return out
}

const LEAKS = [
  /\blogistics\b/i,
  /\bretail\b/i,
  /\bspace capsules?\b/i,
  /\blaminate\b/i,
  /\bpremium\b/i,
  /\bflush\b/i,
  /\bmicrocement\b/i,
  /\bhero\b/i,
  // As the phrase itself. The privacy page's "τοπική αποθήκευση (local storage)" is a gloss
  // after the Greek term, naming the technology the way a cookie policy should, and stays.
  /(?<!\()\blocal storage\b/i,
  /\bEmail\b/, // the capitalised field label; the lowercase loanword "email" is normal Greek
  /\b(Marikostinovo|Petrich|Blagoevgrad|Cherni|Vrah|Blvd|Prof\.|Tsvetan|Lazarov|Laem|Chabang)\b/,
]

describe('Greek copy outside the configurator', () => {
  it.each(Object.keys(EL_FILES))('%s has none of the English or Latin-script words the audit found', (file) => {
    const hits = strings(EL_FILES[file])
      .filter(([, text]) => LEAKS.some((re) => re.test(text)))
      .map(([at, text]) => `${at}: ${text}`)
    expect(hits).toEqual([])
  })

  it.each(Object.keys(EL_FILES))('%s spells no word in a mix of Greek and Latin letters', (file) => {
    // Greek ο and Latin o look the same; a transliterated name typed with one of each
    // ("Λαζάρoβ") reads fine and breaks search, sorting and screen readers.
    const mixed = strings(EL_FILES[file]).flatMap(([at, text]) =>
      (text.match(/[A-Za-zͰ-Ͽἀ-῿]+/g) || [])
        .filter((word) => /[A-Za-z]/.test(word) && /[Ͱ-Ͽἀ-῿]/.test(word))
        .map((word) => `${at}: ${word}`),
    )
    expect(mixed).toEqual([])
  })

  it('names the delivery menu column and link in Greek', () => {
    // The column was «Εφοδιαστική & Εργοτάξιο» with a link to the international logistics
    // page, which was retired into the delivery page on 2026-10-15.
    const column = elHome.default.header.servicesMenu.columns.find((c) =>
      c.items.some((item) => item.pathKey === 'delivery'))
    expect(column.title).toBe('Παράδοση')
    expect(column.items).toEqual([{ pathKey: 'delivery', label: 'Παράδοση και συναρμολόγηση' }])
    for (const home of [elHome.default, enHome, bgHome]) {
      const keys = home.header.servicesMenu.columns.flatMap((c) => c.items.map((item) => item.pathKey))
      expect(keys).not.toContain('logistics')
    }
  })
})

describe('header Planning dropdown', () => {
  it('every locale names it, so the component needs no fallback', () => {
    expect(elHome.default.header.nav.plannerGroup).toBe('Σχεδιασμός')
    expect(enHome.header.nav.plannerGroup).toBe('Planning')
    expect(bgHome.header.nav.plannerGroup).toBe('Планиране')
  })
})

describe('route map destinations', () => {
  const KINDS = ['sea', 'air', 'rail']
  const { el, en, bg } = routeMapDestinations

  it('el names the same places as en, and every one in Greek script', () => {
    for (const kind of KINDS) {
      expect(Object.keys(el[kind])).toEqual(Object.keys(en[kind]))
      for (const name of Object.values(el[kind])) expect(name).toMatch(/[Α-Ωα-ωάέήίόύώ]/)
    }
  })

  it('keeps the IATA codes in the Greek airport names', () => {
    for (const [id, name] of Object.entries(en.air)) {
      const code = name.match(/(([A-Z]{3}))/)[1]
      expect(el.air[id]).toContain(`(${code})`)
    }
  })

  it('bg keeps exactly the names it showed before, and the partner page reads the shared lists', () => {
    expect(bg).toEqual(en)
    expect(bgPartner.logisticsWorld.destinations).toBe(bg)
    expect(enPartner.logisticsWorld.destinations).toBe(en)
    expect(elPartner.default.logisticsWorld.destinations).toBe(el)
    expect(elPartner.default.logisticsWorld.mapControls).toBe(routeMapControls.el)
  })
})

describe('modular houses comparison table', () => {
  // The old cell was hardcoded "37м2 / 58м2 / 78м2", with a Cyrillic м on all three sites
  // and a 78 m² model that does not exist. The rebuilt table states the gallery's range: Box
  // houses from 18 to 74 m² (the two-storey one) and the 38 m² capsule.
  it('states the gallery sizes, with a Latin m in English and Greek', () => {
    for (const content of [elModularHouses.default, enModularHouses]) {
      expect(content.compare.rows[0].values).toEqual(['18–74 m²', '38 m²'])
    }
    expect(bgModularHouses.compare.rows[0].values).toEqual(['18–74 м²', '38 м²'])
  })

  it('never names a 78 m² house in any language', () => {
    for (const content of [elModularHouses.default, enModularHouses, bgModularHouses]) {
      expect(JSON.stringify(content)).not.toMatch(/78\s*[mм]/)
    }
  })
})

describe('image error placeholder', () => {
  it('card.svg carries no words, since it stands in on every language', () => {
    const svg = fs.readFileSync(path.resolve(__dirname, '../../public/modular-builds/card.svg'), 'utf8')
    expect(svg).not.toMatch(/<text\b/)
    expect(svg).toMatch(/<svg\b/)
  })
})
