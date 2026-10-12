import { describe, expect, it } from 'vitest'
import { getRouteSeo, pageImage } from './routeMeta.js'
import { paths } from '../routes/paths.js'
import bgBuilds from '../content/bg/modularBuilds.js'
import enBuilds from '../content/en/modularBuilds.js'
import elBuilds from '../content/el/modularBuilds.js'
import bgHouses from '../content/bg/modularHouses.js'
import enHouses from '../content/en/modularHouses.js'
import elHouses from '../content/el/modularHouses.js'
import bgSteel from '../content/bg/steelHouses.js'
import enSteel from '../content/en/steelHouses.js'
import elSteel from '../content/el/steelHouses.js'

// The search snippet and share card of the three product pages.
//
// What these pin: one head query per page, carried by the title AND the page's H1; lengths a
// results page shows whole; no price (it would go stale the day an admin edits one) and, on
// the steel page, no figure at all (the owner, 2026-10-12: every steel-frame house is its own
// project); the full bg/en/el/x-default cluster with a self-canonical; and a share picture
// that is the page's own photo, with the alt the page gives it.

const SITE = 'https://nvc-home4you.eu'
const LOCALES = ['bg', 'en', 'el']
const CYRILLIC = /\p{Script=Cyrillic}/u

const PAGES = {
  modularBuilds: {
    content: { bg: bgBuilds, en: enBuilds, el: elBuilds },
    // The head term each locale's title and H1 share.
    head: { bg: 'контейнери за живеене', en: 'containers', el: 'κοντέινερ' },
    // The page's default hero photo, which the share card must be.
    photo: (c) => ({ url: c.hero.photo.url, alt: c.hero.photo.alt }),
  },
  modularHouses: {
    content: { bg: bgHouses, en: enHouses, el: elHouses },
    head: { bg: 'модулни къщи', en: 'modular houses', el: 'δομικά' },
    photo: (c) => ({ url: c.hero.photo.url, alt: c.hero.photo.alt }),
  },
  steelHouses: {
    content: { bg: bgSteel, en: enSteel, el: elSteel },
    head: { bg: 'сглобяеми къщи със стоманена конструкция', en: 'steel frame', el: 'μεταλλικό σκελετό' },
    // No hero photo of its own: the first process step's render, which the page shows. Never
    // one of the old example visualisations, which the owner does not want on this page.
    photo: (c) => ({ url: c.process.steps[0].image.src, alt: c.process.steps[0].image.alt }),
  },
}

const fold = (text) => String(text).toLowerCase().replace(/-/g, ' ')

describe.each(Object.keys(PAGES))('routeMeta for %s', (pageKey) => {
  const page = PAGES[pageKey]

  it.each(LOCALES)('%s: a title and description a results page shows whole', (locale) => {
    const seo = getRouteSeo(paths[pageKey][locale], locale)
    expect(seo.title.length).toBeLessThanOrEqual(60)
    expect(seo.title).toMatch(/\| NVC Home4You$/)
    expect(seo.description.length).toBeGreaterThanOrEqual(130)
    expect(seo.description.length).toBeLessThanOrEqual(160)
  })

  it.each(LOCALES)('%s: the title and the H1 carry the same head term', (locale) => {
    const seo = getRouteSeo(paths[pageKey][locale], locale)
    const term = page.head[locale]
    expect(fold(seo.title)).toContain(term)
    expect(fold(page.content[locale].hero.h1)).toContain(term)
  })

  it.each(LOCALES)('%s: no price, and no Cyrillic outside Bulgarian', (locale) => {
    const { title, description, imageAlt } = getRouteSeo(paths[pageKey][locale], locale)
    for (const text of [title, description]) {
      expect(text).not.toMatch(/€|EUR|лв|BGN/i)
      expect(text).not.toMatch(/\d[\d\s.,]{2,}\s*(?:€|евро|euro)/i)
    }
    if (locale !== 'bg') {
      expect(title).not.toMatch(CYRILLIC)
      expect(description).not.toMatch(CYRILLIC)
      expect(imageAlt).not.toMatch(CYRILLIC)
    }
  })

  it.each(LOCALES)('%s: a self-canonical and the full hreflang cluster', (locale) => {
    const seo = getRouteSeo(paths[pageKey][locale], locale)
    expect(seo.canonical).toBe(`${SITE}${paths[pageKey][locale]}`)
    expect(seo.url).toBe(seo.canonical)
    expect(seo.locale).toBe(locale)
    expect(Object.fromEntries(seo.hreflangs.map((h) => [h.hrefLang, h.href]))).toEqual({
      bg: `${SITE}${paths[pageKey].bg}`,
      en: `${SITE}${paths[pageKey].en}`,
      el: `${SITE}${paths[pageKey].el}`,
      'x-default': `${SITE}${paths[pageKey].en}`,
    })
  })

  it.each(LOCALES)('%s: the share picture is the page\'s own photo, with its alt', (locale) => {
    const seo = getRouteSeo(paths[pageKey][locale], locale)
    const photo = page.photo(page.content[locale])
    expect(seo.image).toBe(`${SITE}${photo.url}`)
    expect(seo.imageAlt).toBe(photo.alt)
    expect(seo.imageType).toBe('image/webp')
    expect(seo.imageWidth).toBeGreaterThan(600)
    expect(seo.imageHeight).toBeGreaterThan(600)
    expect(pageImage(pageKey, locale)).toMatchObject({ image: seo.image, imageAlt: seo.imageAlt })
  })
})

describe('the steel page states no figure', () => {
  // The old page's 20–90 m², 1–2 floors, up to 3 bedrooms and 2.1 mm; any digit at all would
  // be a fixed spec the owner has said there is none of.
  it.each(LOCALES)('%s: no digit in the title or the description', (locale) => {
    const { title, description } = getRouteSeo(paths.steelHouses[locale], locale)
    expect(`${title} ${description}`.replace('Home4You', '')).not.toMatch(/\d/)
  })
})

describe('pages without a share picture of their own', () => {
  it('keep the site default (no image props)', () => {
    const seo = getRouteSeo(paths.faq.bg, 'bg')
    expect(seo.image).toBeUndefined()
    expect(seo.imageType).toBeUndefined()
    expect(pageImage('faq', 'bg')).toEqual({})
  })
})

describe('the houses page names Bulgaria', () => {
  // The old page's title said "in Bulgaria" in all three languages, and "модулни къщи
  // България" is a query of its own; the page's own copy says where the houses go, so the
  // title is not alone in saying it.
  const BULGARIA = { bg: 'в България', en: 'in Bulgaria', el: 'στη Βουλγαρία' }
  const ARRIVAL = { bg: bgHouses, en: enHouses, el: elHouses }

  it.each(LOCALES)('%s: in the title and in the arrival copy', (locale) => {
    const { title } = getRouteSeo(paths.modularHouses[locale], locale)
    expect(title).toContain(BULGARIA[locale])
    expect(ARRIVAL[locale].arrival.paragraphs[0]).toMatch(/България|Bulgaria|Βουλγαρία/)
  })
})
