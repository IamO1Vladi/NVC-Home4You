import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import * as elCases from './el/cases.js'
import * as elDelivery from './el/delivery.js'
import * as elFaq from './el/faq.js'
import * as elFloorPlanner from './el/floorPlanner.js'
import * as elHome from './el/home.js'
import * as elInteriors from './el/interiors.js'
import * as elInternalDoors from './el/internalDoors.js'
import * as elLogistics from './el/logistics.js'
import * as elModularBuilds from './el/modularBuilds.js'
import * as elModularHouses from './el/modularHouses.js'
import * as elPartner from './el/partner.js'
import * as elPrivacy from './el/privacy.js'

import bgHome from './bg/home.js'
import enHome from './en/home.js'
import bgModularHouses from './bg/modularHouses.js'
import enModularHouses from './en/modularHouses.js'
import * as bgLogistics from './bg/logistics.js'
import * as enLogistics from './en/logistics.js'
import bgPartner from './bg/partner.js'
import enPartner from './en/partner.js'

// ROADMAP #11, the Greek audit: English and Bulgarian-in-Latin words that sat inside the
// Greek copy outside the configurator. Each pattern below was a real string on a /el page
// (or in its meta, breadcrumb or assistive text). A Greek page reads every one of them; nobody
// on the team reads Greek fluently enough to notice one creeping back in review.

const EL_FILES = {
  'el/cases.js': elCases,
  'el/delivery.js': elDelivery,
  'el/faq.js': elFaq,
  'el/floorPlanner.js': elFloorPlanner,
  'el/home.js': elHome,
  'el/interiors.js': elInteriors,
  'el/internalDoors.js': elInternalDoors,
  'el/logistics.js': elLogistics,
  'el/modularBuilds.js': elModularBuilds,
  'el/modularHouses.js': elModularHouses,
  'el/partner.js': elPartner,
  'el/privacy.js': elPrivacy,
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

  it('names the logistics page the way its own title does', () => {
    // The page is titled «Διεθνής εφοδιαστική»; the menu link and the breadcrumb said
    // "Logistics", and the breadcrumb is what Google shows in the result.
    const pageTitle = elLogistics.default.hero.title
    expect(pageTitle).toBe('Διεθνής εφοδιαστική')
    expect(elLogistics.default.breadcrumbs[1].name).toBe(pageTitle)
    const link = elHome.default.header.servicesMenu.columns
      .flatMap((c) => c.items)
      .find((item) => item.pathKey === 'logistics')
    expect(link.label).toBe(pageTitle)
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
  const el = elLogistics.routeMapDestinations
  const en = enLogistics.routeMapDestinations

  it('el names the same places as en, and every one in Greek script', () => {
    for (const kind of KINDS) {
      expect(Object.keys(el[kind])).toEqual(Object.keys(en[kind]))
      for (const name of Object.values(el[kind])) expect(name).toMatch(/[Α-Ωα-ωάέήίόύώ]/)
    }
  })

  it('keeps the IATA codes in the Greek airport names', () => {
    for (const [id, name] of Object.entries(en.air)) {
      const code = name.match(/\(([A-Z]{3})\)/)[1]
      expect(el.air[id]).toContain(`(${code})`)
    }
  })

  it('bg keeps exactly the names it showed before, and both pages share one list per locale', () => {
    expect(bgLogistics.routeMapDestinations).toEqual(en)
    expect(bgLogistics.default.map.world.destinations).toBe(bgLogistics.routeMapDestinations)
    expect(bgPartner.logisticsWorld.destinations).toBe(bgLogistics.routeMapDestinations)
    expect(enPartner.logisticsWorld.destinations).toBe(en)
    expect(elPartner.default.logisticsWorld.destinations).toBe(el)
    expect(elPartner.default.logisticsWorld.mapControls).toBe(elLogistics.routeMapControls)
  })
})

describe('modular houses comparison table', () => {
  it('reads the expandable sizes from content, with a Latin m, in every locale', () => {
    // The cell was hardcoded "37м2 / 58м2 / 78м2" with a Cyrillic м on all three sites.
    // 78 (not 73) is deliberate until the owner says otherwise.
    for (const content of [elModularHouses.default, enModularHouses, bgModularHouses]) {
      expect(content.table.sizeExpandable).toBe('37 m² / 58 m² / 78 m²')
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
