import { describe, expect, it } from 'vitest'
import { getRouteSeo, pageImage } from './routeMeta.js'
import { paths } from '../routes/paths.js'
import { DELIVERY_RATES } from '../content/shared/deliveryRates.js'
import bgBuilds from '../content/bg/modularBuilds.js'
import enBuilds from '../content/en/modularBuilds.js'
import elBuilds from '../content/el/modularBuilds.js'
import bgHouses from '../content/bg/modularHouses.js'
import enHouses from '../content/en/modularHouses.js'
import elHouses from '../content/el/modularHouses.js'
import bgSteel from '../content/bg/steelHouses.js'
import enSteel from '../content/en/steelHouses.js'
import elSteel from '../content/el/steelHouses.js'
import bgDelivery from '../content/bg/delivery.js'
import enDelivery from '../content/en/delivery.js'
import elDelivery from '../content/el/delivery.js'
import bgPartner from '../content/bg/partner.js'
import enPartner from '../content/en/partner.js'
import elPartner from '../content/el/partner.js'
import { PARTNER_MIN_UNITS } from '../content/shared/partnerTerms.js'
import { DELIVERED_CONTAINER, DELIVERED_CONTAINER_WIDE } from '../content/shared/deliveredMedia.js'

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
    // The page's default hero photo, which the share card must be: since 2026-10-17 the owner's
    // delivered container, whose 16:10 crop the card takes (a 1.91:1 card trims a 4:3 far more).
    photo: (c) => {
      expect(c.hero.photo.url).toBe(DELIVERED_CONTAINER.url)
      return { url: DELIVERED_CONTAINER_WIDE.url, alt: c.hero.photo.alt }
    },
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

describe('the containers snippet', () => {
  // The owner (2026-10-12): the other catalogue sizes are not in stock, but we can order
  // them, as the page's madeToOrder line says. Until 2026-10-16 the Bulgarian description
  // said "изработваме по поръчка", that we make them.
  it('bg: says the other sizes can be ordered, in the page\'s own words', () => {
    const { description } = getRouteSeo(paths.modularBuilds.bg, 'bg')
    expect(bgBuilds.units.madeToOrder).toContain('можем да ги поръчаме')
    expect(description).toContain('можем да ги поръчаме')
    expect(description).not.toMatch(/изработва/)
  })
})

describe('the delivery page', () => {
  // The one page that DOES print figures in its snippet: the per-km rates and the crane are
  // what people search for. They are composed from deliveryRates.js, so the snippet moves
  // with the rate, and every one is labelled without VAT (the owner, 2026-10-15).
  const { container: CONTAINER, box: BOX } = DELIVERY_RATES.products
  const TITLE = {
    bg: 'Доставка на контейнери и Бокс къщи — цена на км и кран | NVC Home4You',
    en: 'Container and Box House Delivery: Price per km | NVC Home4You',
    el: 'Παράδοση κοντέινερ και σπιτιών Box: τιμή ανά χλμ | NVC Home4You',
  }
  const FIGURES = {
    bg: [`${CONTAINER.perKm} €/км`, `около ${BOX.perKm} €/км`, `около ${BOX.crane.about} €`, 'без ДДС'],
    en: [`€${CONTAINER.perKm}/km`, `about €${BOX.perKm}/km`, `about €${BOX.crane.about}`, 'excl. VAT'],
    el: [`${CONTAINER.perKm} €/χλμ`, `περίπου ${BOX.perKm} €/χλμ`, `περίπου ${BOX.crane.about} €`, 'χωρίς ΦΠΑ'],
  }

  it.each(LOCALES)('%s: the title, and the figures from deliveryRates.js without VAT', (locale) => {
    const seo = getRouteSeo(paths.delivery[locale], locale)
    expect(seo.title).toBe(TITLE[locale])
    // Short enough that a results page keeps the brand.
    expect(seo.title.length).toBeLessThanOrEqual(70)
    expect(seo.title).toMatch(/\| NVC Home4You$/)
    for (const figure of FIGURES[locale]) expect(seo.description).toContain(figure)
    expect(seo.description.length).toBeLessThanOrEqual(160)
    if (locale !== 'bg') expect(`${seo.title} ${seo.description}`).not.toMatch(CYRILLIC)
  })

  it.each(LOCALES)('%s: the share picture is the page’s own crane photo, with its alt', (locale) => {
    const seo = getRouteSeo(paths.delivery[locale], locale)
    const content = { bg: bgDelivery, en: enDelivery, el: elDelivery }[locale]
    expect(seo.image).toBe(`${SITE}/delivery/crane-lift-1500.webp`)
    expect(seo.imageAlt).toBe(content.prepare.photoAlt)
    expect(seo.imageType).toBe('image/webp')
  })

  it.each(LOCALES)('%s: a self-canonical and the full hreflang cluster', (locale) => {
    const seo = getRouteSeo(paths.delivery[locale], locale)
    expect(seo.canonical).toBe(`${SITE}${paths.delivery[locale]}`)
    expect(seo.hreflangs.map((h) => h.hrefLang)).toEqual(['bg', 'en', 'el', 'x-default'])
  })

  it('the retired logistics URLs have no metadata of their own (they 301 to this page)', () => {
    expect(paths.logistics).toBeUndefined()
    for (const old of ['/bg/mejdunarodna-logistika', '/en/logistics', '/el/diethnis-efodiastiki']) {
      expect(getRouteSeo(old)).toBeNull()
    }
  })
})

describe('the partner page', () => {
  // The quantity thresholds are the snippet's figures, read from partnerTerms.js so a change
  // there moves the snippet; nothing else is a number (no price, no percentage).
  const CONTENT = { bg: bgPartner, en: enPartner, el: elPartner }

  it.each(LOCALES)('%s: lengths a results page shows whole, and the thresholds from partnerTerms.js', (locale) => {
    const seo = getRouteSeo(paths.partner[locale], locale)
    expect(seo.title.length).toBeLessThanOrEqual(70)
    expect(seo.title).toMatch(/\| NVC Home4You$/)
    expect(seo.description.length).toBeLessThanOrEqual(160)
    expect(seo.description).toContain(String(PARTNER_MIN_UNITS.container))
    expect(seo.description).toContain(String(PARTNER_MIN_UNITS.box))
    if (locale !== 'bg') expect(`${seo.title} ${seo.description}`).not.toMatch(CYRILLIC)
  })

  it.each(LOCALES)('%s: the share picture is the hero’s crane photo, with the hero’s alt', (locale) => {
    const seo = getRouteSeo(paths.partner[locale], locale)
    expect(seo.image).toBe(`${SITE}/delivery/crane-lift-1500.webp`)
    expect(seo.imageAlt).toBe(CONTENT[locale].hero.photoAlt)
  })

  it.each(LOCALES)('%s: a self-canonical and the full hreflang cluster', (locale) => {
    const seo = getRouteSeo(paths.partner[locale], locale)
    expect(seo.canonical).toBe(`${SITE}${paths.partner[locale]}`)
    expect(seo.hreflangs.map((h) => h.hrefLang)).toEqual(['bg', 'en', 'el', 'x-default'])
  })
})

describe('every page, in every language', () => {
  // Since 2026-10-16 every public route reads its head from here (seoUrls.test.js pins that), so
  // these hold for what each page ships, the server's manifest and the prerendered snapshot alike.
  const ALL = Object.entries(paths).flatMap(([pageKey, localized]) =>
    Object.entries(localized).map(([locale, path]) => ({ pageKey, locale, path })))

  it.each(ALL)('$pageKey.$locale: a title and description a results page shows whole', ({ locale, path }) => {
    const seo = getRouteSeo(path, locale)
    expect(seo).not.toBeNull()
    expect(seo.title).toMatch(/\| NVC Home4You$/)
    expect(seo.title.length).toBeLessThanOrEqual(70)
    expect(seo.description.length).toBeGreaterThanOrEqual(130)
    expect(seo.description.length).toBeLessThanOrEqual(160)
    expect(seo.canonical).toBe(`${SITE}${path}`)
    expect(seo.hreflangs.map((h) => h.hrefLang)).toEqual(['bg', 'en', 'el', 'x-default'])
    if (locale !== 'bg') expect(`${seo.title} ${seo.description}`).not.toMatch(CYRILLIC)
  })

  it.each(LOCALES)('%s: no two pages share a title or a description', (locale) => {
    const heads = Object.values(paths).map((localized) => getRouteSeo(localized[locale], locale))
    expect(new Set(heads.map((h) => h.title)).size).toBe(heads.length)
    expect(new Set(heads.map((h) => h.description)).size).toBe(heads.length)
  })
})

describe('the home snippet', () => {
  // The Bulgarian title the live snapshot already ranks with, word for word; the English and
  // Greek ones no longer lead with the page keys ("Modular builds", "Δομικές κατασκευές").
  it('bg: keeps the title it shipped with', () => {
    expect(getRouteSeo(paths.home.bg, 'bg').title).toBe('Контейнери за живеене, модулни и сглобяеми къщи | NVC Home4You')
  })

  it.each(['en', 'el'])('%s: names no page key', (locale) => {
    const { title, description } = getRouteSeo(paths.home[locale], locale)
    expect(`${title} ${description}`).not.toMatch(/modular builds|δομικές κατασκευές/i)
  })
})

describe('the gallery snippet', () => {
  // The priced catalogue in its four lines (the index's chips, 2026-10-17): the containers, the
  // Box houses, the space capsule and the steel-frame houses. The content files' old copy
  // promised garages (there are none) and "its own URL and detail page".
  it.each(LOCALES)('%s: no garages and no developer talk', (locale) => {
    const { title, description } = getRouteSeo(paths.gallery[locale], locale)
    expect(`${title} ${description}`).not.toMatch(/гараж|garage|γκαράζ|\bURL\b|завършени|completed|ολοκληρωμένα/i)
    expect(title).toMatch(/Box|Бокс/)
  })

  // The owner (2026-10-17): the head names the project houses and the space capsules too. Within
  // 70 characters the brand stays and "Галерия" goes; the H1 keeps it (GalleryIndexPage.test.jsx).
  const TITLE = {
    bg: 'Контейнери, Бокс къщи, капсули и сглобяеми къщи с цени | NVC Home4You',
    en: 'Container, Box, Capsule and Steel-Frame Houses: Prices | NVC Home4You',
    el: 'Κοντέινερ, κάψουλες, Box και μεταλλικά σπίτια με τιμές | NVC Home4You',
  }
  // Each line in the words the site uses for it, and the prices the page is searched for.
  const LINES = {
    bg: ['контейнери', 'бокс къщи', 'капсул', 'сглобяеми къщи', 'цени'],
    en: ['container', 'box', 'capsule', 'steel-frame houses', 'prices'],
    el: ['κοντέινερ', 'box', 'κάψουλ', 'μεταλλικά σπίτια', 'τιμές'],
  }
  // A house like a project is priced per project, as its card says ("Цена по проект"): the
  // description names that rather than promising every house a fixed price.
  const PER_PROJECT = { bg: 'сглобяеми къщи с цена по проект', en: 'steel-frame houses priced per project', el: 'μεταλλικά σπίτια με τιμή ανά έργο' }

  it.each(LOCALES)('%s: the title names all four lines and the prices', (locale) => {
    const { title, description } = getRouteSeo(paths.gallery[locale], locale)
    expect(title).toBe(TITLE[locale])
    for (const word of LINES[locale]) expect(title.toLowerCase()).toContain(word)
    for (const word of LINES[locale].slice(0, 4)) expect(description.toLowerCase()).toContain(word)
  })

  it.each(LOCALES)('%s: prices with VAT, and the project houses priced per project', (locale) => {
    const { description } = getRouteSeo(paths.gallery[locale], locale)
    expect(description).toMatch(/с ДДС|incl\. VAT|με ΦΠΑ/)
    expect(description).toContain(PER_PROJECT[locale])
    expect(description).not.toMatch(/всички наши модели|every model|όλα τα μοντέλα/i)
  })
})

describe('the cases snippet', () => {
  // Reviews and published cases, which the page shows whatever is published next; not the
  // company buyers (none is published), the logistics or the interiors the old copy promised.
  it.each(LOCALES)('%s: promises only what the page shows', (locale) => {
    const { description } = getRouteSeo(paths.cases[locale], locale)
    expect(description).not.toMatch(/логистик|logistic|εφοδιαστ|фирмени клиенти|buyer compan|εταιρείες-πελάτες|интериор|interior|εσωτερικ/i)
    expect(description).toMatch(/1/)
    expect(description).toMatch(/5/)
  })
})
