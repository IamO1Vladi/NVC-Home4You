import { describe, expect, it } from 'vitest'

import bgHome from './bg/home.js'
import enHome from './en/home.js'
import elHome from './el/home.js'
import bgModularBuilds from './bg/modularBuilds.js'
import enModularBuilds from './en/modularBuilds.js'
import elModularBuilds from './el/modularBuilds.js'
import bgModularHouses from './bg/modularHouses.js'
import enModularHouses from './en/modularHouses.js'
import elModularHouses from './el/modularHouses.js'
import bgSteelHouses from './bg/steelHouses.js'
import enSteelHouses from './en/steelHouses.js'
import elSteelHouses from './el/steelHouses.js'

// The words that point at the three product pages from elsewhere, and the few lines on those
// pages that once promised more than the site does. Each case below was a real mismatch found
// in review of the product-page redesign (2026-10-12).

const LOCALES = {
  bg: { home: bgHome, builds: bgModularBuilds, houses: bgModularHouses, steel: bgSteelHouses },
  en: { home: enHome, builds: enModularBuilds, houses: enModularHouses, steel: enSteelHouses },
  el: { home: elHome, builds: elModularBuilds, houses: elModularHouses, steel: elSteelHouses },
}

describe.each(Object.entries(LOCALES))('%s product copy', (locale, c) => {
  it('names the steel page on the home hero the way the other pages do', () => {
    // The hero caption reads the slide's alt; the sibling cards carry the page's name.
    const steelName = c.houses.siblings.steel.label
    const slides = c.home.home.hero.showcase.slides.filter((s) => s.pathKey === 'steelHouses')
    expect(slides.length).toBeGreaterThan(0)
    for (const s of slides) expect(s.label || s.alt).toBe(steelName)
  })

  it('gives the modular houses tile the same 18–74 m² range as the page', () => {
    const tile = c.home.home.serviceTiles.items.find((t) => t.key === 'modularHouses')
    expect(tile.title).toContain('18–74')
    expect(`${tile.title} ${tile.desc}`).not.toMatch(/37/)
    expect(tile.desc).toMatch(/18/)
    expect(tile.desc).toMatch(/74/)
  })

  it('has the steel hero button ask for a quote, since the offer form takes no files', () => {
    expect(c.steel.hero.cta).not.toMatch(/скица|sketch|σκαρίφημα/i)
    // Files still have somewhere to go.
    expect(c.steel.how.filesLead).toBeTruthy()
  })

  it('says nothing about connecting the expandable house to the utilities', () => {
    // The owner (2026-10-12): do not mention utility connections for the Box houses at all,
    // neither that we connect them nor that the house is "ready to be connected".
    const text = c.houses.arrival.paragraphs.join(' ')
    expect(text).not.toMatch(/свързва|свързване|канализац|водопровод|connect|sewer|σύνδεση|συνδέεται|αποχέτευ|ύδρευ/i)
  })

  it('says the customer pays for the crane wherever the containers page offers one', () => {
    // The owner (2026-10-12): a crane is the customer's choice and the customer's cost. The
    // hero fact is the short form of the assembly section's sentence and says so too.
    const fact = c.builds.hero.facts.find((f) => /кран|crane|γερανό/i.test(f))
    expect(fact).toMatch(/за ваша сметка|at your cost|με δικά σας έξοδα/)
    expect(c.builds.assembly.crane).toMatch(/за ваша сметка|you pay for|με δικά σας έξοδα/)
  })

  it('has a generic alt for an admin photo on the containers page', () => {
    expect(c.builds.hero.adminAlt).toBeTruthy()
    expect(c.builds.hero.adminAlt).not.toBe(c.builds.hero.photo.alt)
  })
})

describe('bg containers page wording', () => {
  it('addresses the visitor formally on the sibling link, like the other two pages', () => {
    expect(bgModularBuilds.siblings.go).toBe(bgModularHouses.siblings.go)
    expect(bgModularBuilds.siblings.go).toBe(bgSteelHouses.ready.go)
  })

  it('words the price load error in natural order', () => {
    expect(bgModularBuilds.units.loadError).toBe('Не успяхме да заредим цените.')
  })
})
