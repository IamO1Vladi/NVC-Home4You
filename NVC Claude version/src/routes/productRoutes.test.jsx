import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import { paths } from './paths.js'
import { getRouteSeo } from '../seo/routeMeta.js'
import { ORGANIZATION_ID } from '../components/StructuredData.jsx'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { forgetHomePhotos } from '../lib/homePhotos.js'
import { productQuestions, hubTopicPath } from '../lib/productQuestions.js'
import bgModularBuilds from '../content/bg/modularBuilds.js'
import enModularBuilds from '../content/en/modularBuilds.js'
import elModularBuilds from '../content/el/modularBuilds.js'
import bgModularHouses from '../content/bg/modularHouses.js'
import enModularHouses from '../content/en/modularHouses.js'
import elModularHouses from '../content/el/modularHouses.js'
import bgSteelHouses from '../content/bg/steelHouses.js'
import enSteelHouses from '../content/en/steelHouses.js'
import elSteelHouses from '../content/el/steelHouses.js'
import bgDoors from '../content/bg/internalDoors.js'
import enDoors from '../content/en/internalDoors.js'
import elDoors from '../content/el/internalDoors.js'
import BgModularBuildsRoute from './bg/BgModularBuildsRoute.jsx'
import EnModularBuildsRoute from './en/EnModularBuildsRoute.jsx'
import ElModularBuildsRoute from './el/ElModularBuildsRoute.jsx'
import BgModularHousesRoute from './bg/BgModularHousesRoute.jsx'
import EnModularHousesRoute from './en/EnModularHousesRoute.jsx'
import ElModularHousesRoute from './el/ElModularHousesRoute.jsx'
import BgSteelHousesRoute from './bg/BgSteelHousesRoute.jsx'
import EnSteelHousesRoute from './en/EnSteelHousesRoute.jsx'
import ElSteelHousesRoute from './el/ElSteelHousesRoute.jsx'

// The nine product routes as a crawler reads them once the /api calls settle, which is what
// the prerender snapshots: the head (title, description, canonical, the hreflang cluster, the
// share picture), the structured data, the heading outline and the internal links.
//
// What these pin: every route's head comes from routeMeta.js; breadcrumbs on all nine; Product
// markup on the containers and the houses only, each price the very figure printed on that
// product's card; on the steel page a Service provided by the site's Organization and no
// Product markup; FAQPage markup on all three, of the page's own questions only (since
// 2026-10-17: the containers page shows the doors page's container question, marked up there);
// one H1 and no skipped heading level; and links to the prices page, the gallery and the other
// two product pages, none of them to a path the router lacks.

const ROUTES = {
  modularBuilds: { bg: BgModularBuildsRoute, en: EnModularBuildsRoute, el: ElModularBuildsRoute },
  modularHouses: { bg: BgModularHousesRoute, en: EnModularHousesRoute, el: ElModularHousesRoute },
  steelHouses: { bg: BgSteelHousesRoute, en: EnSteelHousesRoute, el: ElSteelHousesRoute },
}
const LOCALES = ['bg', 'en', 'el']
const CONTENT = {
  modularBuilds: { bg: bgModularBuilds, en: enModularBuilds, el: elModularBuilds },
  modularHouses: { bg: bgModularHouses, en: enModularHouses, el: elModularHouses },
  steelHouses: { bg: bgSteelHouses, en: enSteelHouses, el: elSteelHouses },
}
const DOORS = { bg: bgDoors, en: enDoors, el: elDoors }
const SITE = 'https://nvc-home4you.eu'

const item = (id, category, price, title, cover) => ({
  id, category, price, currency: 'EUR', title, titleBg: title, titleEl: title,
  description: `<p>${title}</p>`, descriptionBg: `<p>${title}</p>`, descriptionEl: `<p>${title}</p>`,
  coverUrl: `/api/img/gallery/${cover}/cover.webp`, images: [`/api/img/gallery/${cover}/cover.webp`], catalogId: null,
})

// Prices that are no live figure, so only a price read from these rows can print them.
const GALLERY = [
  item(13, 'wagon', 4317, 'Container 6x3', 1),
  item(6, 'wagon', 4817, 'Container 7x3', 2),
  item(8, 'wagon', 6517, 'Container 8x3 pitched', 3),
  item(100016, 'modular', 10517, 'Expandable House 18', 16),
  item(10, 'modular', 14017, 'Expandable House 37', 8),
  item(5, 'modular', 23017, 'Expandable House 58', 10),
  item(9, 'modular', 26517, 'Expandable House 73', 11),
  item(100015, 'modular', 55017, 'Capsule', 15),
]

function stubFetch() {
  return vi.fn((url) => {
    const href = String(url)
    if (href.includes('/api/gallery')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: GALLERY }) })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })
}

function renderRoute(pageKey, locale) {
  const Route = ROUTES[pageKey][locale]
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[paths[pageKey][locale]]}>
        <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}} onRequestModel={() => {}}>
          <Route />
        </ModalActionsProvider>
      </MemoryRouter>
    </HelmetProvider>,
  )
}

const jsonLd = (container) => [...container.querySelectorAll('script[type="application/ld+json"]')]
  .map((el) => JSON.parse(el.textContent))

const meta = (selector) => document.head.querySelector(selector)?.getAttribute('content')

/** Every registered path, to check the page links to nothing the router does not have. */
const REGISTERED = new Set(Object.values(paths).flatMap((localized) => Object.values(localized)))

beforeEach(() => {
  forgetHomePhotos()
  vi.stubGlobal('fetch', stubFetch())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe.each(Object.keys(ROUTES))('%s routes', (pageKey) => {
  it.each(LOCALES)('%s: the head comes from routeMeta, with the page\'s own share picture', async (locale) => {
    const seo = getRouteSeo(paths[pageKey][locale], locale)
    renderRoute(pageKey, locale)

    await waitFor(() => expect(document.title).toBe(seo.title))
    expect(meta('meta[name="description"]')).toBe(seo.description)
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(`${SITE}${paths[pageKey][locale]}`)

    const alternates = Object.fromEntries(
      [...document.head.querySelectorAll('link[rel="alternate"]')].map((el) => [el.getAttribute('hreflang'), el.getAttribute('href')]),
    )
    expect(alternates).toEqual({
      bg: `${SITE}${paths[pageKey].bg}`,
      en: `${SITE}${paths[pageKey].en}`,
      el: `${SITE}${paths[pageKey].el}`,
      'x-default': `${SITE}${paths[pageKey].en}`,
    })

    expect(meta('meta[property="og:image"]')).toBe(seo.image)
    expect(meta('meta[property="og:image:type"]')).toBe('image/webp')
    expect(meta('meta[property="og:image:width"]')).toBe(String(seo.imageWidth))
    expect(meta('meta[property="og:image:height"]')).toBe(String(seo.imageHeight))
    expect(meta('meta[property="og:image:alt"]')).toBe(seo.imageAlt)
    expect(meta('meta[name="twitter:image"]')).toBe(seo.image)
    expect(meta('meta[name="twitter:image:alt"]')).toBe(seo.imageAlt)
  })

  it.each(LOCALES)('%s: breadcrumbs, and Product markup only beside visible prices', async (locale) => {
    const { container } = renderRoute(pageKey, locale)
    if (pageKey !== 'steelHouses') {
      await waitFor(() => expect(container.querySelector('.pp-unit')).not.toBeNull())
    }
    const blocks = jsonLd(container)

    const crumbs = blocks.find((block) => block['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement).toHaveLength(2)
    expect(crumbs.itemListElement[0].item).toBe(`${SITE}/${locale}`)
    expect(crumbs.itemListElement[1]).toMatchObject({ position: 2, item: `${SITE}${paths[pageKey][locale]}` })
    expect(crumbs.itemListElement[1].name).toBeTruthy()

    // One FAQPage, of the page's own questions only, as the page prints them.
    const faqs = blocks.filter((block) => block['@type'] === 'FAQPage')
    expect(faqs).toHaveLength(1)
    const own = productQuestions(pageKey, CONTENT[pageKey][locale], locale, { doors: DOORS[locale] }).filter((q) => q.markup)
    expect(faqs[0].mainEntity.map((e) => [e.name, e.acceptedAnswer.text])).toEqual(own.map((q) => [q.question, q.answer]))
    expect(faqs[0].mainEntity.map((e) => e.name)).not.toContain(DOORS[locale].faq.items.find((i) => i.id === 'doors-for-containers').q)

    const list = blocks.find((block) => block['@type'] === 'ItemList')
    if (pageKey === 'steelHouses') {
      expect(list).toBeUndefined()
      return
    }

    expect(list.url).toBe(`${SITE}${paths[pageKey][locale]}`)
    expect(list.itemListElement.length).toBeGreaterThan(0)
    for (const { item: product } of list.itemListElement) {
      expect(product['@type']).toBe('Product')
      expect(product.offers.priceCurrency).toBe('EUR')
      expect(product.offers.seller['@id']).toBe(ORGANIZATION_ID)
      expect(product.image[0]).toMatch(/^https:\/\/nvc-home4you\.eu\/api\/img\//)
      // The card this product was built from prints the same figure.
      const id = String(product.sku).replace(/^gal-/, '')
      const card = container.querySelector(`#item-${id}`)
      if (card) {
        expect(card.textContent).toContain(euro(product.offers.price, locale))
      } else {
        // A variant row is printed as a line of its base model's card, not a card of its own.
        expect(container.querySelector('#sizes').textContent).toContain(euro(product.offers.price, locale))
      }
    }
  })

  it.each(LOCALES)('%s: one H1 and no skipped heading level', async (locale) => {
    const { container } = renderRoute(pageKey, locale)
    if (pageKey !== 'steelHouses') {
      await waitFor(() => expect(container.querySelector('.pp-unit')).not.toBeNull())
    }
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]))
    expect(levels.filter((level) => level === 1)).toHaveLength(1)
    expect(levels[0]).toBe(1)
    levels.forEach((level, i) => {
      if (i > 0) expect(level, `h${levels[i - 1]} then h${level}`).toBeLessThanOrEqual(levels[i - 1] + 1)
    })
  })

  it.each(LOCALES)('%s: links to the prices, the gallery and the other two pages, and to no unregistered path', async (locale) => {
    const { container } = renderRoute(pageKey, locale)
    if (pageKey !== 'steelHouses') {
      await waitFor(() => expect(container.querySelector('.pp-unit')).not.toBeNull())
    }
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    const internal = hrefs.filter((href) => href.startsWith('/'))
    const bare = internal.map((href) => href.split(/[?#]/)[0])

    expect(bare).toContain(paths.prices[locale])
    expect(bare).toContain(paths.gallery[locale])
    for (const other of Object.keys(ROUTES).filter((key) => key !== pageKey)) {
      expect(bare).toContain(paths[other][locale])
    }

    const galleryPrefix = `${paths.gallery[locale]}/`
    const unknown = bare.filter((href) => !REGISTERED.has(href) && !href.startsWith(galleryPrefix) && !href.startsWith('/api/'))
    expect(unknown).toEqual([])
  })
})

describe('the steel route', () => {
  it.each(LOCALES)('%s: describes the line as a Service provided by the site\'s Organization', async (locale) => {
    const seo = getRouteSeo(paths.steelHouses[locale], locale)
    const { container } = renderRoute('steelHouses', locale)
    const service = jsonLd(container).find((block) => block['@type'] === 'Service')

    expect(service).toMatchObject({
      '@id': `${seo.url}#service`,
      url: seo.url,
      description: seo.description,
      image: [seo.image],
      areaServed: ['BG', 'EU'],
      provider: { '@type': 'Organization', '@id': ORGANIZATION_ID },
    })
    expect(service.name).toBeTruthy()
    expect(service.serviceType).toBeTruthy()
    expect(service.offers).toBeUndefined()
    if (locale !== 'bg') expect(JSON.stringify(service)).not.toMatch(/\p{Script=Cyrillic}/u)
  })
})

// The Questions section each product page gained on 2026-10-17 (Stage 2): the page's own
// questions in the FAQ list style, the containers page's with the doors page's container
// question too, a link to the hub's topic under them, and the section placed before the
// closing card. In the page's words, every figure filled, and none of what the owner ruled out.
describe.each(Object.keys(ROUTES))('%s: the Questions section', (pageKey) => {
  const FORBIDDEN = {
    // The new office opens in February 2027: nothing before it does.
    office: /Драгичево|Dragichevo|Ντραγκίτσεβο/i,
    // Heating and air conditioning were not answered.
    heating: /отоплен|климатик|heating|air.?condition|θέρμανσ|κλιματισ/i,
    // ONE factory, ours, never suppliers.
    plural: /фабрики|доставчи|factories|supplier|εργοστάσια(?![\p{L}])|εργοστασίων|προμηθευτ/iu,
    // Never who connects a container or a Box house to the utilities.
    utilities: /свързва|свързване|канализац|водопровод|connect|sewer|σύνδεση|συνδέεται|αποχέτευ|ύδρευ/i,
  }

  it.each(LOCALES)('%s: before the closing card, every question in it, and a link to the hub topic', async (locale) => {
    const c = CONTENT[pageKey][locale]
    const { container } = renderRoute(pageKey, locale)
    if (pageKey !== 'steelHouses') {
      await waitFor(() => expect(container.querySelector('.pp-unit')).not.toBeNull())
    }
    const section = container.querySelector('section#questions')
    expect(section).not.toBeNull()
    expect(section.querySelector('h2').textContent).toBe(c.faq.heading)
    // After everything but the sibling cards, which, like on the delivery and doors pages, sit
    // between the questions and the closing card.
    const sections = [...container.querySelector('main').children]
    const at = sections.indexOf(section)
    expect(sections[at + 1].matches('.pp-siblings')).toBe(true)
    expect(sections[at + 2].id).toBe('final-cta')

    const expected = productQuestions(pageKey, c, locale, { doors: DOORS[locale] })
    const details = [...section.querySelectorAll('details.pp-faq-item')]
    expect(details.map((d) => d.id)).toEqual(expected.map((q) => `q-${q.id}`))
    expect(details.map((d) => [d.querySelector('summary').textContent, d.querySelector('p').textContent]))
      .toEqual(expected.map((q) => [q.question, q.answer]))
    if (pageKey === 'modularBuilds') expect(details.map((d) => d.id)).toContain('q-doors-for-containers')
    expect(section.textContent).not.toMatch(/\{\w+\}/)

    const more = section.querySelector('.pp-links a')
    expect(more.getAttribute('href')).toBe(hubTopicPath(pageKey, locale))
    expect(more.getAttribute('href')).toBe(`${paths.faq[locale]}#t-${{ modularBuilds: 'containers', modularHouses: 'box', steelHouses: 'steel' }[pageKey]}`)
    expect(more.textContent).toBe(c.faq.more)

    for (const [rule, pattern] of Object.entries(FORBIDDEN)) expect(section.textContent, rule).not.toMatch(pattern)
  })
})
