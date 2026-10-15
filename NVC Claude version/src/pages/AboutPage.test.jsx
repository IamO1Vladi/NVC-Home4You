import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import AboutPage, { ABOUT_LEAD_SOURCE, ABOUT_PHOTO } from './AboutPage.jsx'
import bgContent from '../content/bg/about.js'
import enContent from '../content/en/about.js'
import elContent from '../content/el/about.js'
import BgAboutRoute from '../routes/bg/BgAboutRoute.jsx'
import EnAboutRoute from '../routes/en/EnAboutRoute.jsx'
import ElAboutRoute from '../routes/el/ElAboutRoute.jsx'
import { paths } from '../routes/paths.js'
import { LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'
import { getRouteSeo } from '../seo/routeMeta.js'
import { ORGANIZATION_ID } from '../components/StructuredData.jsx'

// The About page as rebuilt on 2026-10-15. What these pin, in every language:
// - the sections in their order, one H1 naming the brand, no skipped heading level;
// - none of the old false or unbacked figures ("40+ suppliers", "6 countries", "8 weeks"), and
//   no founding year, homes count or company number, which wait for the owner;
// - every figure from its module (LEAD_TIMES, WARRANTY_YEARS) or the live reviews, none typed
//   in the content, and the review tile hidden rather than zero when the reviews do not answer;
// - nothing in content.pending ever on the page;
// - one factory, ours, in China; no suppliers;
// - only the owner's own photos (the crane lift, the delivery clips, the factory floor, the case);
// - links to Cases, FAQ, Gallery, Delivery and Prices, and the lead source on both buttons;
// - the route's head from routeMeta.js, its breadcrumbs and AboutPage markup.

const CONTENT = { bg: bgContent, en: enContent, el: elContent }
const ROUTES = { bg: BgAboutRoute, en: EnAboutRoute, el: ElAboutRoute }
const LOCALES = ['bg', 'en', 'el']
const SITE = 'https://nvc-home4you.eu'
// Factories in the plural, in the three languages (a word boundary does not see Greek letters, hence the lookahead).
const PLURAL_FACTORY = /фабрики|factories|εργοστάσια(?![\p{L}])/iu

const CASE = {
  id: '2',
  rating: 5,
  year: '2026',
  quote: 'The house looks great. I am now renting it out and have everything perfectly working.',
  images: ['/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp'],
}
// Figures no module holds, so only the feed can print them.
const REVIEWS = {
  averageRating: 4.73,
  totalCount: 17,
  items: [{ id: 1, name: 'Мария', rating: 5, comment: 'Много сме доволни.', product: 'modularHouses' }],
}

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
let feed = { reviews: true, cases: true }
let caseBody = CASE
let reviewsBody = REVIEWS

class FakeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  feed = { reviews: true, cases: true }
  caseBody = CASE
  reviewsBody = REVIEWS
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.stubGlobal('matchMedia', (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/api/cases-page') && feed.cases) return json({ cases: [caseBody], reviews: [] })
    if (u.includes('/api/reviews/featured') && feed.reviews) return json(reviewsBody)
    return Promise.resolve({ ok: false, status: 503 })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPage(locale = 'bg', actions = {}) {
  return render(
    <MemoryRouter initialEntries={[paths.about[locale]]}>
      <ModalActionsProvider onOpenOffer={actions.offer || (() => {})} onOpenQuestion={actions.question || (() => {})}>
        <AboutPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

/** Rendered with both feeds answered: the case card and the reviews are on the page. */
async function ready(locale, actions) {
  const view = renderPage(locale, actions)
  await waitFor(() => expect(view.container.querySelector('[data-fact="reviews"]')).not.toBeNull())
  await waitFor(() => expect(view.container.querySelector('.ab-proof')).not.toBeNull())
  await waitFor(() => expect(view.container.querySelector('.testimonials')).not.toBeNull())
  return view
}

// Spaces of every kind read as one; the word joiners that hold "3–4" together read as nothing.
const flat = (s) => String(s ?? '').replace(/⁠/g, '').replace(/\s/g, ' ')
const mainText = (container) => flat(container.querySelector('main').textContent)

/** Every [dotted path, string] in a value. */
function strings(value, at = '') {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}

describe('AboutPage', () => {
  it.each(LOCALES)('%s: the sections in order, one H1 with the brand, no skipped heading level', async (locale) => {
    const { container } = await ready(locale)
    const ids = ['ab-hero-title', 'ab-facts-title', 'ab-who-title', 'ab-journey-title', 'ab-writing-title', 'warranty-title', 'ab-siblings-title', 'hp-final-title']
    const order = [...container.querySelectorAll('h1, h2')].map((h) => h.id)
    for (const id of ids) expect(order.indexOf(id), id).toBeGreaterThanOrEqual(0)
    expect(ids.map((id) => order.indexOf(id))).toEqual([...ids.map((id) => order.indexOf(id))].sort((a, b) => a - b))
    // The reviews come between the warranty and the next pages.
    const reviews = container.querySelector('.testimonials')
    expect(container.querySelector('#warranty').compareDocumentPosition(reviews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(reviews.compareDocumentPosition(container.querySelector('#ab-siblings')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const h1 = container.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toContain('NVC Home4You')
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]))
    levels.forEach((level, i) => { if (i) expect(level - levels[i - 1]).toBeLessThanOrEqual(1) })
  })

  it.each(LOCALES)('%s: none of the old figures, no founding year, no homes count, no company number', async (locale) => {
    const { container } = await ready(locale)
    const text = mainText(container)
    expect(text).not.toMatch(/40\+/)
    expect(text).not.toMatch(/\b6\s*(държави|countries|χώρες)/i)
    expect(text).not.toMatch(/\b8\s*(седмици|weeks|εβδομάδες)/i)
    expect(text).not.toMatch(/Обслужвани държави|Countries served|Χώρες που εξυπηρετούμε/i)
    expect(text).not.toMatch(/Средно време|lead time|Μέσος χρόνος/i)
    for (const year of ['2019', '2021', '2022', '2024']) expect(text).not.toContain(year)
    // (The phone number, +359 87 ..., is the one 87 the page may carry.)
    expect(text).not.toMatch(/87\s*(доставени|дома|homes|σπίτια)/i)
    expect(text).not.toMatch(/ЕИК|EIK|ΕΙΚ|VAT number|ДДС номер|БУЛСТАТ/i)
    // Nor a team, until the page shows people.
    expect(text).not.toMatch(/екип|\bteam\b|ομάδα/i)
  })

  it.each(LOCALES)('%s: one factory, ours, in China, and no suppliers', async (locale) => {
    const { container } = await ready(locale)
    const text = mainText(container)
    expect(text).toContain({ bg: 'нашата фабрика в Китай', en: 'our factory in China', el: 'εργοστάσιό μας στην Κίνα' }[locale])
    expect(text).not.toMatch(PLURAL_FACTORY)
    expect(text).not.toMatch(/доставчи|supplier|προμηθευτ/i)
    // And in the content file, pending questions included.
    const all = strings(CONTENT[locale]).map(([, s]) => s).join('\n')
    expect(all).not.toMatch(PLURAL_FACTORY)
    expect(all).not.toMatch(/доставчи|supplier|προμηθευτ/i)
  })

  it.each(LOCALES)('%s: every figure from its module or the reviews feed, no placeholder left', async (locale) => {
    const { container } = await ready(locale)
    const tile = (key) => flat(container.querySelector(`[data-fact="${key}"]`)?.textContent)
    expect(tile('container')).toContain(String(LEAD_TIMES.containerInStockDays))
    expect(tile('production')).toContain(String(LEAD_TIMES.boxProductionDays))
    expect(tile('toAddress')).toContain(String(LEAD_TIMES.boxToAddressMonths))
    expect(tile('warranty')).toContain(String(WARRANTY_YEARS.structure))
    // The 15 years are the structure's: the tile says so.
    expect(tile('warranty')).toMatch(/конструкц|structure|σκελετ/i)
    expect(tile('reviews')).toContain('4.7')
    expect(tile('reviews')).toContain('17')
    expect(mainText(container)).not.toMatch(/\{\w+\}/)
    // The warranty table carries every year from the module.
    const rows = [...container.querySelectorAll('[data-warranty]')].map((row) => row.dataset.warranty)
    expect(rows).toEqual(Object.keys(WARRANTY_YEARS))
  })

  it.each(LOCALES)('%s: types no figure in the facts it prints', (locale) => {
    for (const [at, text] of strings(CONTENT[locale].facts.tiles)) {
      // "out of 5" is the rating scale, not a figure of ours.
      const bare = text.replace(/\{\w+\}/g, '').replace(/(от|out of|από) 5/g, '')
      expect(bare, at).not.toMatch(/\d/)
    }
    for (const row of CONTENT[locale].warranty.rows) expect(row.text).toMatch(/^\{years\}\D*$/)
  })

  it('hides the review tile, never a zero, when the reviews do not answer', async () => {
    feed.reviews = false
    const { container } = renderPage('bg')
    await waitFor(() => expect(container.querySelector('.ab-proof')).not.toBeNull())
    expect(container.querySelector('[data-fact="reviews"]')).toBeNull()
    expect(container.querySelectorAll('[data-fact]')).toHaveLength(4)
    expect(container.querySelector('.testimonials')).toBeNull()
    expect(mainText(container)).not.toMatch(/\b0\.0\b|— от/)
  })

  it('hides the review tile when the feed has a single review ("1 verified reviews")', async () => {
    reviewsBody = { ...REVIEWS, totalCount: 1 }
    const { container } = renderPage('bg')
    await waitFor(() => expect(container.querySelector('.testimonials')).not.toBeNull())
    expect(container.querySelector('[data-fact="reviews"]')).toBeNull()
    expect(container.querySelectorAll('[data-fact]')).toHaveLength(4)
  })

  it.each(LOCALES)('%s: the case line carries the year of the published case, not a typed one', async (locale) => {
    caseBody = { ...CASE, year: '2031' }
    const { container } = renderPage(locale)
    await waitFor(() => expect(container.querySelector('.ab-proof')).not.toBeNull())
    const line = flat(container.querySelector('.ab-proof .cs-review-name').textContent)
    expect(line).toMatch(/· 2031$/)
    expect(CONTENT[locale].proof.case.line).not.toMatch(/20\d\d/)
  })

  it.each(LOCALES)('%s: claims no more than the owner gave: no "in writing" heading, no yard named, Box assembly priced apart', async (locale) => {
    const { container } = await ready(locale)
    expect(flat(container.querySelector('#ab-writing-title').textContent)).not.toMatch(/черно на бяло|in writing|γραπτώς/i)
    const term = (key) => flat(container.querySelector(`[data-term="${key}"]`).textContent)
    expect(term('unloading')).not.toMatch(/Марикостиново|Marikostinovo|Μαρικοστίνοβο/)
    expect(term('prices')).toMatch({ bg: /Бокс къщите са с ДДС, а монтажът е отделно/, en: /assembly priced separately/, el: /συναρμολόγηση τιμολογείται χωριστά/ }[locale])
  })

  it('leaves out the case card when the case is not published', async () => {
    feed.cases = false
    const { container } = renderPage('bg')
    await waitFor(() => expect(container.querySelector('[data-fact="reviews"]')).not.toBeNull())
    expect(container.querySelector('.ab-proof')).toBeNull()
    expect(mainText(container)).not.toContain('Паралия Кариани')
  })

  it.each(LOCALES)('%s: nothing that waits for the owner is ever on the page', async (locale) => {
    const { container } = await ready(locale)
    const pending = strings(CONTENT[locale].pending)
    expect(pending.length).toBeGreaterThanOrEqual(18)
    const text = mainText(container)
    for (const [at, s] of pending) expect(text, at).not.toContain(flat(s))
    // No opening hours in the body copy: only the closing card shows them, as on every page.
    const body = [...container.querySelectorAll('main > section')].filter((s) => s.id !== 'final-cta')
    for (const section of body) expect(section.textContent).not.toMatch(/\d{2}:\d{2}/)
    // No yard visits, no CE or QC promise.
    expect(text).not.toMatch(/по уговорка|by appointment|κατόπιν ραντεβού|контрол на качеството|проверка на качеството|quality check|έλεγχος ποιότητας/i)
    expect(text).not.toMatch(/\bCE\b/)
  })

  it.each(LOCALES)('%s: only the owner\'s own photos', async (locale) => {
    const { container } = await ready(locale)
    const srcs = [...container.querySelectorAll('main img')].map((img) => img.getAttribute('src'))
    expect(srcs.length).toBeGreaterThanOrEqual(6)
    for (const src of srcs) expect(src).toMatch(/^\/(delivery\/|partner\/factory-floor\.webp$|api\/img\/cases\/)/)
    expect(srcs).toContain(ABOUT_PHOTO.url)
    expect(srcs).toContain('/partner/factory-floor.webp')
    for (const img of container.querySelectorAll('main img')) {
      if (!img.closest('.dl-clip-media')) expect(img.getAttribute('alt'), img.getAttribute('src')).toBeTruthy()
    }
  })

  it.each(LOCALES)('%s: links on to Cases, FAQ, Gallery, Delivery and Prices', async (locale) => {
    const { container } = await ready(locale)
    const hrefs = [...container.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href'))
    for (const key of ['cases', 'faq', 'gallery', 'delivery', 'prices']) expect(hrefs, key).toContain(paths[key][locale])
    expect(hrefs.some((h) => h.startsWith('tel:'))).toBe(true)
    expect(hrefs.some((h) => h.startsWith('mailto:'))).toBe(true)
    const siblings = within(container.querySelector('#ab-siblings'))
    expect(siblings.getAllByRole('link')).toHaveLength(4)
  })

  it('opens the offer and the question forms with the page\'s lead source', async () => {
    const offer = vi.fn()
    const question = vi.fn()
    const { container } = await ready('bg', { offer, question })
    const hero = within(container.querySelector('.pp-hero'))
    fireEvent.click(hero.getByRole('button', { name: bgContent.hero.offer }))
    const closing = within(container.querySelector('#final-cta'))
    fireEvent.click(closing.getAllByRole('button')[0])
    fireEvent.click(closing.getAllByRole('button')[1])
    expect(offer).toHaveBeenCalledTimes(2)
    expect(offer).toHaveBeenNthCalledWith(1, { source: ABOUT_LEAD_SOURCE })
    expect(offer).toHaveBeenNthCalledWith(2, { source: ABOUT_LEAD_SOURCE })
    expect(question).toHaveBeenCalledWith({ source: ABOUT_LEAD_SOURCE })
    expect(ABOUT_LEAD_SOURCE).toBe('about-page')
  })

  it('does not animate on load and bakes in no date', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'AboutPage.jsx'), 'utf8')
    expect(source).not.toMatch(/from ['"]framer-motion['"]/)
    expect(source).not.toMatch(/new Date\(|getFullYear\(/)
  })

  it('the three languages carry the same shape', () => {
    const shape = (value) => (Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
        : typeof value)
    expect(shape(enContent)).toEqual(shape(bgContent))
    expect(shape(elContent)).toEqual(shape(bgContent))
  })
})

describe('the About routes', () => {
  function renderRoute(locale) {
    const Route = ROUTES[locale]
    const helmet = {}
    const view = render(
      <HelmetProvider context={helmet}>
        <MemoryRouter initialEntries={[paths.about[locale]]}>
          <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
            <Route />
          </ModalActionsProvider>
        </MemoryRouter>
      </HelmetProvider>,
    )
    return view
  }

  it.each(LOCALES)('%s: the head from routeMeta.js, without the old "team" promise', (locale) => {
    const seo = getRouteSeo(paths.about[locale], locale)
    expect(seo.title.length).toBeLessThanOrEqual(70)
    expect(seo.description.length).toBeGreaterThanOrEqual(130)
    expect(seo.description.length).toBeLessThanOrEqual(160)
    expect(seo.description).toContain(String(WARRANTY_YEARS.structure))
    expect(`${seo.title} ${seo.description}`).not.toMatch(/екип|майсторство|team|craftsmanship|ομάδα|μαστοριά|20(19|21|22)|\b87\b/i)
    expect(seo.canonical).toBe(`${SITE}${paths.about[locale]}`)
    expect(Object.fromEntries(seo.hreflangs.map((h) => [h.hrefLang, h.href]))).toEqual({
      bg: `${SITE}${paths.about.bg}`,
      en: `${SITE}${paths.about.en}`,
      el: `${SITE}${paths.about.el}`,
      'x-default': `${SITE}${paths.about.en}`,
    })
    expect(seo.image).toBe(`${SITE}${ABOUT_PHOTO.url}`)
    expect(seo.imageAlt).toBe(CONTENT[locale].hero.photoAlt)
  })

  it.each(LOCALES)('%s: breadcrumbs and an AboutPage of the site\'s Organization, with no unconfirmed field', async (locale) => {
    const { container } = renderRoute(locale)
    await waitFor(() => expect(container.querySelector('h1')).not.toBeNull())
    const data = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual([CONTENT[locale].home, CONTENT[locale].breadcrumb])
    expect(crumbs.itemListElement[1].item).toBe(`${SITE}${paths.about[locale]}`)
    const about = data.find((d) => d['@type'] === 'AboutPage')
    expect(about.url).toBe(`${SITE}${paths.about[locale]}`)
    expect(about.inLanguage).toBe(locale)
    expect(about.mainEntity['@id']).toBe(ORGANIZATION_ID)
    expect(about.primaryImageOfPage.url).toBe(`${SITE}${ABOUT_PHOTO.url}`)
    const raw = JSON.stringify(about)
    for (const field of ['foundingDate', 'legalName', 'taxID', 'vatID', 'numberOfEmployees', 'aggregateRating', 'openingHours']) {
      expect(raw).not.toContain(field)
    }
  })
})
