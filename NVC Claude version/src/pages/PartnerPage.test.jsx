import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import PartnerPage, { figures, shown } from './PartnerPage.jsx'
import bgContent from '../content/bg/partner.js'
import enContent from '../content/en/partner.js'
import elContent from '../content/el/partner.js'
import { paths } from '../routes/paths.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { CONFIG_PREFILL_KEY } from '../lib/configPrefill.js'
import { HOME_PHOTOS_SEED_ID, fetchHomePhotos, forgetHomePhotos } from '../lib/homePhotos.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { FACTORY_PHOTO } from '../content/shared/aboutMedia.js'
import { euro } from '../lib/euro.js'
import { getRouteSeo } from '../seo/routeMeta.js'

// The partner page (2026-10-15). What these pin: the sections come in the plan's order; the
// two quantity thresholds are partnerTerms.js's (mocked here to other numbers, so a figure
// typed into the copy would show); the warranty, answered the same day, is drawn with every
// year from warranty.js (mocked the same way) and for containers and Box houses only, never the
// steel-frame houses; nothing waiting for the owner's answer is drawn or sent to Google;
// "factories" never appears, in any language, since the owner's rule is one factory; the cargo
// offer is a card with its question and no route map (removed 2026-10-16; that nothing asks for
// Leaflet is PartnerPage.map.test.jsx's); the FAQ markup is the questions shown, except the warranty,
// which the FAQ hub answers too and marks up (one question, marked up once per language).

const TERMS = vi.hoisted(() => ({ container: 7, box: 4 }))
vi.mock('../content/shared/partnerTerms.js', () => ({ PARTNER_MIN_UNITS: TERMS }))

// Not the real 15, 6, 6 and 2: a year typed into the copy would print the real one.
const YEARS = vi.hoisted(() => ({ structure: 17, panels: 9, joinery: 8, sanitary: 5 }))
vi.mock('../content/shared/warranty.js', () => ({ WARRANTY_YEARS: YEARS }))

// The gallery rows the product cards price from, without the gallery. The capsule's row is the
// cheapest on purpose: the Box houses' "from" is never the capsule's (2026-10-17).
const ROWS = vi.hoisted(() => ({ wagon: [{ total: 9800 }, { total: 8600 }], box: [{ house: 21000 }, { house: 15500 }, { house: 9000, capsule: true }] }))
vi.mock('../lib/productRows.js', async (importOriginal) => ({
  ...(await importOriginal()),
  useProductRows: () => ({ ...ROWS, loading: false, error: null, items: [], galleryPath: '/bg/galeriq' }),
}))

const CONTENT = { bg: bgContent, en: enContent, el: elContent }
const LOCALES = ['bg', 'en', 'el']
const { container: CONTAINER, box: BOX } = DELIVERY_RATES.products

const CASE = {
  id: '2',
  rating: 5,
  quote: 'The house looks great.',
  images: ['/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp'],
}
let cases = [CASE]
const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

// jsdom has neither; the journey drawing and the steps ask for them.
class FakeObserver {
  constructor(callback, options) { this.callback = callback; this.options = options; this.targets = [] }
  observe(el) { this.targets.push(el) }
  unobserve() {}
  disconnect() { this.targets = [] }
}

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
}

const openOffer = vi.fn()
const openQuestion = vi.fn()

beforeEach(() => {
  cases = [CASE]
  forgetHomePhotos()
  window.sessionStorage.clear()
  openOffer.mockClear()
  openQuestion.mockClear()
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  stubMatchMedia()
  vi.stubGlobal('fetch', vi.fn((url) => {
    if (String(url).includes('/api/cases-page')) return json({ cases, reviews: [] })
    return Promise.resolve({ ok: false, status: 404 })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPage(locale = 'bg', hash = '') {
  return render(
    <MemoryRouter initialEntries={[`${paths.partner[locale]}${hash}`]}>
      <ModalActionsProvider onOpenOffer={openOffer} onOpenQuestion={openQuestion}>
        <PartnerPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

async function ready(container) {
  await waitFor(() => expect(container.querySelector('.ptn-case')).not.toBeNull())
}

const flat = (s) => String(s ?? '').replace(/\s/g, ' ')

/** Every string in a content module, keys and paths aside. */
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out))
  return out
}

describe('PartnerPage', () => {
  it('puts the sections in the planned order', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const order = [...container.querySelectorAll('h1, h2')].map((h) => h.id)
    const ids = [
      'ptn-hero-title', 'ptn-doors-title', 'ptn-terms-title', 'ptn-products-title', 'ptn-process-title',
      'ptn-split-title', 'ptn-proof-title', 'zapitvane-title', 'ptn-faq-title', 'ptn-cargo-title', 'hp-final-title',
    ]
    expect(order).toEqual(ids)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    // Headings never skip a level.
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]))
    levels.forEach((level, i) => { if (i) expect(level - levels[i - 1]).toBeLessThanOrEqual(1) })
    // The form is where the page's links point.
    expect(container.querySelector('section#zapitvane form')).not.toBeNull()
  })

  it.each(LOCALES)('reads both thresholds from partnerTerms.js and leaves no placeholder (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const main = container.querySelector('main')
    const text = flat(main.textContent)
    expect(text).not.toMatch(/\{\w+\}/)

    const ticks = [...main.querySelectorAll('.pp-hero .hp-facts li')].map((li) => li.textContent)
    expect(ticks[0]).toContain(`${TERMS.container}`)
    expect(ticks[0]).toContain(`${TERMS.box}`)
    const price = main.querySelector('[data-term="price"] dd').textContent
    expect(price).toContain(`${TERMS.container}`)
    expect(price).toContain(`${TERMS.box}`)
    // The real thresholds (6 and 3) are nowhere in the copy as typed figures.
    expect(price).not.toMatch(/\b6\b|\b3\b/)

    const money = (v) => flat(euro(v, locale))
    for (const figure of [money(CONTAINER.perKm), money(BOX.perKm), money(BOX.crane.about), `${LEAD_TIMES.containerInStockDays} `, `${LEAD_TIMES.boxProductionDays} `, LEAD_TIMES.boxToAddressMonths, CONTAINER.noCrane.nights, money(CONTAINER.noCrane.travelMax)]) {
      expect(text).toContain(figure)
    }
    expect(figures(locale).containerMin).toBe(TERMS.container)
  })

  // The warranty was the one pending row and question until the owner answered it (2026-10-15).
  const WARRANTY_WORD = { bg: /гаранц/i, en: /warrant/i, el: /εγγύησ/i }
  const SCOPE = { bg: [/Контейнер/i, /Бокс къщ/i], en: [/Container/i, /Box houses/i], el: [/κοντέινερ/i, /σπίτια Box/i] }
  // The steel-frame houses by the names the page gives them; "steel structure" alone is a
  // warranted element of a container or a Box house.
  const STEEL_HOUSE = { bg: /сглобяем|по проект/i, en: /steel-frame|to a plan|to your plan/i, el: /μεταλλικά σπίτια|σε σχέδιο/i }

  it.each(LOCALES)('draws the warranty with every year from warranty.js, for containers and Box houses only (%s)', async (locale) => {
    const c = CONTENT[locale]
    expect(c.terms.rows.filter((row) => row.pending)).toEqual([])
    expect(c.faq.items.filter((item) => item.pending)).toEqual([])

    const { container } = renderPage(locale)
    await ready(container)
    const terms = [...container.querySelectorAll('.ptn-terms dt')].map((dt) => dt.textContent)
    expect(terms).toHaveLength(c.terms.rows.length)

    const row = container.querySelector('[data-term="warranty"] dd').textContent
    const question = [...container.querySelectorAll('.pp-faq-item')].find((d) => WARRANTY_WORD[locale].test(d.querySelector('summary').textContent))
    expect(question).toBeDefined()
    const answer = question.querySelector('p').textContent
    for (const text of [row, answer]) {
      for (const years of Object.values(YEARS)) expect(text).toMatch(new RegExp(`(?<!\\d)${years}(?!\\d)`))
      // The real figures, typed, would show here.
      expect(text).not.toMatch(/(?<!\d)(15|6|2)(?!\d)/)
      expect(text).not.toMatch(/\{\w+\}/)
      expect(text).not.toMatch(STEEL_HOUSE[locale])
    }
    for (const scope of SCOPE[locale]) {
      expect(row).toMatch(scope)
      expect(question.querySelector('summary').textContent).toMatch(scope)
    }

    // The steel-frame houses' row says nothing of a warranty, and only the one question does.
    expect(container.querySelector('[data-term="steel"] dd').textContent).not.toMatch(WARRANTY_WORD[locale])
    const asking = [...container.querySelectorAll('.pp-faq-item')].filter((d) => WARRANTY_WORD[locale].test(d.textContent))
    expect(asking).toEqual([question])

    // Shown here, but marked up on the FAQ hub, which answers the same question (id
    // 'warranty'); the page's markup carries the rest of its questions but the customs and the
    // lead time, which the hub and the delivery page mark up.
    expect(question.id).toBe('q-warranty')
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const faq = ld.find((b) => b['@type'] === 'FAQPage')
    expect(faq.mainEntity.map((e) => e.name)).not.toContain(question.querySelector('summary').textContent)
    expect(faq.mainEntity.length).toBe(c.faq.items.length - 3)
  })

  it('still never draws a row or a question marked as waiting for the owner', () => {
    expect(shown([{ key: 'a' }, { key: 'b', pending: true }, null])).toEqual([{ key: 'a' }])
  })

  it('says "our factory", never factories, in any language', async () => {
    const PLURAL = { bg: /фабрики/i, en: /factories/i, el: /εργοστάσια|εργοστασίων/i }
    for (const locale of LOCALES) {
      expect(strings(CONTENT[locale]).filter((s) => PLURAL[locale].test(s))).toEqual([])
      const seo = getRouteSeo(paths.partner[locale], locale)
      expect(`${seo.title} ${seo.description}`).not.toMatch(PLURAL[locale])
      const { container, unmount } = renderPage(locale)
      await ready(container)
      expect(container.querySelector('main').textContent).not.toMatch(PLURAL[locale])
      unmount()
    }
    // And it does say "our factory in China", in the singular.
    expect(bgContent.hero.lead).toContain('нашата фабрика в Китай')
    expect(enContent.hero.lead).toContain('our factory in China')
    expect(elContent.hero.lead).toContain('εργοστάσιό μας στην Κίνα')
  })

  it('publishes the questions it shows as FAQ markup, and no price markup', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const faq = blocks.find((b) => b['@type'] === 'FAQPage')
    const shown = [...container.querySelectorAll('.pp-faq-item')].map((d) => ({
      q: d.querySelector('summary').textContent,
      a: d.querySelector('p').textContent,
    }))
    expect(shown).toHaveLength(bgContent.faq.items.filter((item) => !item.pending).length)
    // Every question it shows but the three another page marks up: the customs and the warranty
    // (the FAQ hub's) and the lead time (the delivery page's).
    const elsewhere = bgContent.faq.items.filter((item) => item.markup).map((item) => item.id)
    expect(elsewhere).toEqual(['partner-customs', 'partner-lead-time', 'warranty'])
    const handed = bgContent.faq.items.filter((item) => item.markup).map((item) => item.q)
    expect(faq.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }))).toEqual(shown.filter((item) => !handed.includes(item.q)))
    expect(blocks.some((b) => JSON.stringify(b).includes('"Offer"'))).toBe(false)
  })

  describe('the cargo card', () => {
    // The route map that stood here (routes from Ho Chi Minh and Laem Chabang, against "our
    // factory in China") was removed on 2026-10-16: the offer is the heading, the line and the
    // question, in one card, and nothing else.
    it.each(LOCALES)('is one card: the heading, the line and the question, no map (%s)', async (locale) => {
      const c = CONTENT[locale]
      const { container } = renderPage(locale)
      await ready(container)
      const section = container.querySelector('#ptn-cargo')
      const card = section.querySelector('.hp-card.ptn-cargo')
      expect(card).not.toBeNull()
      expect(within(card).getByRole('heading', { level: 2, name: c.cargo.heading })).toHaveAttribute('id', 'ptn-cargo-title')
      expect(card.querySelector('.ptn-cargo-text p').textContent).toBe(c.cargo.text)
      expect(within(section).getAllByRole('button').map((b) => b.textContent)).toEqual([c.cargo.ask])
      expect(container.querySelector('.leaflet-container, .ptn-map, .wr-card')).toBeNull()
      expect(Object.keys(c.cargo).sort()).toEqual(['ask', 'heading', 'text'])
      expect(c.logisticsWorld).toBeUndefined()
      // Not a destination of the old map anywhere on the page.
      expect(container.querySelector('main').textContent).not.toMatch(/Ho Chi Minh|Хо Ши Мин|Χο Τσι Μινχ|Laem Chabang|Лаем Чабанг|Λάεμ Τσαμπάνγκ/)
    })

    it('asks its question tagged as cargo, then tags the page again', async () => {
      const { container } = renderPage('bg')
      await ready(container)
      let seen = null
      openQuestion.mockImplementation(() => { seen = JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY)) })
      fireEvent.click(screen.getByRole('button', { name: bgContent.cargo.ask }))
      expect(openQuestion).toHaveBeenCalledTimes(1)
      expect(seen).toMatchObject({ source: 'partner-cargo', sourcePath: paths.partner.bg, questionText: bgContent.prefill.cargo })
      expect(JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY)).source).toBe('partner-page')
    })
  })

  it('tags the header\'s offer and question forms opened on this page', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    expect(JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY))).toMatchObject({
      source: 'partner-page',
      sourcePath: paths.partner.bg,
      offerText: 'Партньорско запитване — от страницата за партньори',
      questionText: 'Партньорско запитване — от страницата за партньори',
    })
  })

  it('a door\'s button presets the form\'s role', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const form = container.querySelector('#zapitvane form')
    fireEvent.click(screen.getByRole('button', { name: bgContent.doors.own.button }))
    expect(within(form).getByLabelText(bgContent.form.role.options.ownSite)).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: bgContent.doors.resell.button }))
    expect(within(form).getByLabelText(bgContent.form.role.options.reseller)).toBeChecked()
  })

  it('prices the product cards from the gallery rows', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const cards = [...container.querySelectorAll('#ptn-products .pp-sib')].map((a) => flat(a.textContent))
    // Containers, Box houses, steel, and since 2026-10-16 the internal doors (sold in bulk, no price).
    expect(cards).toHaveLength(4)
    expect(cards[0]).toContain(flat(euro(8600, 'bg')))
    expect(cards[1]).toContain(flat(euro(15500, 'bg')))
    expect(cards[1]).not.toContain(flat(euro(9000, 'bg')))
    expect(cards[2]).not.toMatch(/€/)
    expect(cards[3]).not.toMatch(/€/)
  })

  it('shows the delivered case only while it is published, and the reviews always', async () => {
    cases = []
    const { container } = renderPage('bg')
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/cases-page')))
    await act(async () => {})
    expect(container.querySelector('.ptn-case')).toBeNull()
    // The steps already show the delivery photos; the delivery page's clips are not repeated.
    expect(container.querySelectorAll('.dl-clip')).toHaveLength(0)
    expect(within(container.querySelector('#ptn-proof')).getByRole('link', { name: bgContent.proof.reviews })).toHaveAttribute('href', paths.cases.bg)
  })

  it('draws the journey in the hero, the words first, and nothing of it waits on a script', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const hero = container.querySelector('.pp-hero')
    const grid = hero.querySelector('.pp-hero-grid')
    // Copy first, then the drawing (on a phone they stack in this order).
    expect([...grid.children].map((el) => el.className)).toEqual(['pp-hero-copy', 'pp-hero-aside ptn-journey'])
    expect(within(hero).getByRole('img', { name: bgContent.journey.summary })).toBeInTheDocument()
    expect(hero.querySelector('.pj-cap').textContent).toContain(bgContent.journey.captions.factory)
    for (const name of bgContent.journey.steps) expect(hero.querySelector('.pj-steps').textContent).toContain(name)
    expect(within(hero).getByRole('button', { name: bgContent.journey.modes.sea })).toHaveAttribute('aria-pressed', 'true')
    // No photo in the hero any more, and nothing hidden until a script reveals it: the
    // drawing's world is fully opaque and no label carries a style.
    expect(hero.querySelector('img')).toBeNull()
    const hidden = /opacity:\s*0(?![.\d])|display:\s*none|visibility:\s*hidden/
    for (const el of [hero.querySelector('[data-k="w"]'), ...hero.querySelectorAll('.pj-cap, .pj-cap *, .pj-steps, .pj-ctl, .pj-ctl *')]) {
      expect(el.getAttribute('style') || '').not.toMatch(hidden)
    }
  })

  it('puts the crane photo beside „Накратко", with its 800px crop, lazy (it is not shown below 1100px)', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    expect(container.querySelectorAll('main img[src*="crane-lift"]')).toHaveLength(1)
    const img = container.querySelector('#ptn-terms .ptn-glance > .ptn-photo img')
    expect(img).toHaveAttribute('src', '/delivery/crane-lift-800.webp')
    expect(img.getAttribute('srcset')).toContain('/delivery/crane-lift-1500.webp 1500w')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).not.toHaveAttribute('fetchpriority')
    expect(img).toHaveAttribute('alt', bgContent.hero.photoAlt)
    // The table and its note are the other column.
    const text = container.querySelector('#ptn-terms .ptn-glance > .ptn-glance-text')
    expect(text.querySelector('dl.ptn-terms')).not.toBeNull()
    expect(text.querySelector('.pp-note')).not.toBeNull()
    expect(container.innerHTML).not.toContain('partner/hero.png')
  })

  it('puts the admin page photo in the same place', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/api/cases-page')) return json({ cases, reviews: [] })
      if (String(url).includes('/api/home/photos')) return json({ hero: [], models: {}, pages: { partner: { url: '/api/img/home/abc.webp', alt: 'Склад' } } })
      return Promise.resolve({ ok: false, status: 404 })
    }))
    const { container } = renderPage('bg')
    await ready(container)
    await waitFor(() => expect(container.querySelector('#ptn-terms .ptn-photo img').getAttribute('src')).toContain('abc'))
    expect(container.querySelector('.pp-hero img')).toBeNull()
  })
})

// 2026-10-16: the price term links the single-unit prices, the product cards add the internal
// doors (a bulk product too), and the delivered case links its own card on the cases page.
describe('PartnerPage onward links', () => {
  it.each(LOCALES)('%s: prices from the price term, the doors card, and the case card', async (locale) => {
    const c = CONTENT[locale]
    const { container } = renderPage(locale)
    await ready(container)
    const price = container.querySelector('[data-term="price"]')
    const priceRow = c.terms.rows.find((r) => r.key === 'price')
    expect(within(price).getByRole('link', { name: priceRow.link.label })).toHaveAttribute('href', paths.prices[locale])
    const cards = [...container.querySelectorAll('#ptn-products .pp-sib')]
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(
      ['modularBuilds', 'modularHouses', 'steelHouses', 'doors'].map((key) => paths[key][locale]),
    )
    expect(cards[3]).toHaveTextContent(c.products.doors.label)
    expect(within(container).getByRole('link', { name: c.proof.more })).toHaveAttribute('href', `${paths.cases[locale]}#case-${c.proof.case.id}`)
  })
})

// "Как работим" as slots of "Снимки на сайта" (2026-10-17): steps 1, 3 and 4 are
// partner-step-yard / -port / -plot, step 2 is About's factory-floor. An empty slot draws today's
// photo to the attribute; a filled one is the owner's, cropped from its centre, and the
// captions, which name the place, stay.
describe('PartnerPage step photos from the panel', () => {
  const STEP_SLOTS = ['partner-step-yard', 'factory-floor', 'partner-step-port', 'partner-step-plot']
  // Uploads land in home/{position}/: yard 30, factory-floor 21, port 31, plot 32.
  const POSITION = { 'partner-step-yard': 30, 'factory-floor': 21, 'partner-step-port': 31, 'partner-step-plot': 32 }
  const OWNER = (name) => ({ url: `/api/img/home/${POSITION[name]}/${name}.webp`, alt: `Снимка на собственика: ${name}` })
  const ALL = Object.fromEntries(STEP_SLOTS.map((name) => [name, OWNER(name)]))
  const STEP_WIDTHS = [480, 640, 800, 1200]

  const stepFigs = (container) => [...container.querySelectorAll('#ptn-process .pp-step-fig')]
  const stepImgs = (container) => stepFigs(container).map((fig) => fig.querySelector('img'))
  const stageImgs = (container) => [...container.querySelectorAll('#ptn-process .pp-stage-fig img')]
  const attrs = (img) => [...img.attributes].map((a) => `${a.name}=${a.value}`).sort()
  const photosCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes('/api/home/photos'))

  /** fetch as the suite's, with the photos call answered with `body` (null: 404). */
  function answer(body) {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/api/cases-page')) return json({ cases, reviews: [] })
      if (String(url).includes('/api/home/photos')) return body ? json(body) : Promise.resolve({ ok: false, status: 404 })
      return Promise.resolve({ ok: false, status: 404 })
    }))
  }
  const withSlots = (slots) => ({ hero: [], models: {}, pages: {}, slots })
  // The stage: the wide-screen layout.
  const wideScreen = () => vi.stubGlobal('matchMedia', (query) => ({
    matches: query === '(min-width: 900px)', media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }))

  function expectToday(container, locale) {
    const c = CONTENT[locale]
    const figs = stepFigs(container)
    expect(figs).toHaveLength(4)
    c.process.steps.forEach((step, i) => {
      // A static file: no srcset, no style, nothing but today's attributes.
      expect(attrs(figs[i].querySelector('img'))).toEqual([
        `alt=${step.image.alt}`, 'decoding=async', 'height=671', 'loading=lazy',
        'sizes=(max-width: 899px) 100vw, 640px', `src=${step.image.src}`, 'width=800',
      ])
      expect(figs[i].querySelector('figcaption').textContent).toBe(step.image.caption)
    })
    stageImgs(container).forEach((img, i) => {
      expect(attrs(img)).toEqual([
        `alt=${c.process.steps[i].image.alt}`, 'decoding=async', 'height=671', 'loading=lazy',
        'sizes=(min-width: 1200px) 620px, 52vw', `src=${c.process.steps[i].image.src}`, 'width=800',
      ])
    })
  }

  it.each(LOCALES)('%s: with the step slots empty, the four photos are today\'s, whatever the API answers', async (locale) => {
    for (const wide of [false, true]) {
      if (wide) wideScreen()
      for (const body of [null, {}, withSlots({}), { hero: [], models: {}, pages: {} }]) {
        answer(body)
        const { container, unmount } = renderPage(locale)
        expectToday(container, locale)
        expect(stageImgs(container)).toHaveLength(wide ? 4 : 0)
        await waitFor(() => expect(photosCalls().length).toBeGreaterThan(0))
        await act(async () => {})
        expectToday(container, locale)
        unmount()
        forgetHomePhotos()
      }
    }
  })

  it('step 2 is About\'s factory photo: the same file while empty, and the factory-floor slot once filled', async () => {
    // The default is the very file the factory-floor slot shows on About.
    for (const c of Object.values(CONTENT)) expect(c.process.steps[1].image.src).toBe(FACTORY_PHOTO.url)
    answer(withSlots({ 'factory-floor': OWNER('factory-floor') }))
    const { container } = renderPage('bg')
    await waitFor(() => expect(stepImgs(container)[1].getAttribute('src')).toContain(OWNER('factory-floor').url))
    // Steps 1, 3 and 4 have slots of their own, still empty: today's photos.
    for (const i of [0, 2, 3]) {
      expect(stepImgs(container)[i].getAttribute('src')).toBe(bgContent.process.steps[i].image.src)
      expect(stepImgs(container)[i].getAttribute('style')).toBeNull()
    }
  })

  it.each(LOCALES)('%s: the owner\'s photos in all four steps, under the steps and on the stage', async (locale) => {
    const c = CONTENT[locale]
    wideScreen()
    answer(withSlots(ALL))
    const { container } = renderPage(locale)
    await waitFor(() => expect(stepImgs(container)[0].getAttribute('src')).toContain(OWNER('partner-step-yard').url))
    c.process.steps.forEach((step, i) => {
      const owner = OWNER(STEP_SLOTS[i])
      for (const [img, width] of [[stepImgs(container)[i], 800], [stageImgs(container)[i], 1200]]) {
        expect(img.getAttribute('src')).toBe(cdnImage(owner.url, { width }))
        expect(img.getAttribute('srcset')).toBe(cdnSrcSet(owner.url, STEP_WIDTHS))
        expect(img.getAttribute('alt')).toBe(locale === 'bg' ? owner.alt : step.image.adminAlt)
        // Inline, so it beats Partner.css's 50% 62%, set for the default photos.
        expect(img.style.objectPosition).toBe('50% 50%')
      }
      // The caption names the place the photo shows, so it stays.
      expect(stepFigs(container)[i].querySelector('figcaption').textContent).toBe(step.image.caption)
    })
  })

  it('a blank description in the panel gives the page\'s general words, never the default photo\'s', async () => {
    answer(withSlots({ 'partner-step-port': { ...OWNER('partner-step-port'), alt: '' } }))
    const { container } = renderPage('bg')
    await waitFor(() => expect(stepImgs(container)[2].getAttribute('src')).toContain(OWNER('partner-step-port').url))
    expect(stepImgs(container)[2].getAttribute('alt')).toBe(bgContent.process.steps[2].image.adminAlt)
  })

  it('falls back to today\'s photo should the owner\'s fail to load', async () => {
    answer(withSlots({ 'partner-step-plot': OWNER('partner-step-plot') }))
    const { container } = renderPage('bg')
    await waitFor(() => expect(stepImgs(container)[3].getAttribute('src')).toContain(OWNER('partner-step-plot').url))
    const img = stepImgs(container)[3]
    fireEvent.error(img)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(bgContent.process.steps[3].image.src)
    expect(img.dataset.imgFallback).toBe(bgContent.process.steps[3].image.src)
  })

  it('opens on the owner\'s photos from the first render once an answer is kept', async () => {
    answer(withSlots({ 'partner-step-yard': OWNER('partner-step-yard'), 'factory-floor': OWNER('factory-floor') }))
    await fetchHomePhotos()
    expect(document.getElementById(HOME_PHOTOS_SEED_ID)).not.toBeNull()
    const { container } = renderPage('bg')
    // No waiting: the very first render has them.
    expect(stepImgs(container)[0].getAttribute('src')).toBe(cdnImage(OWNER('partner-step-yard').url, { width: 800 }))
    expect(stepImgs(container)[1].getAttribute('src')).toBe(cdnImage(OWNER('factory-floor').url, { width: 800 }))
    expect(stepImgs(container)[2].getAttribute('src')).toBe(bgContent.process.steps[2].image.src)
  })

  it.each(LOCALES)('%s: every step has general words for an owner\'s photo', (locale) => {
    for (const step of CONTENT[locale].process.steps) {
      expect(step.image.adminAlt).toBeTruthy()
      expect(step.image.adminAlt).not.toBe(step.image.alt)
      // The figure's caption stays under his photo: the alt must not make a screen reader
      // hear the same words twice.
      expect(step.image.adminAlt).not.toBe(step.image.caption)
    }
  })

  it('gives the default back its own crop should the owner\'s photo fail to load', async () => {
    answer(withSlots({ 'partner-step-port': OWNER('partner-step-port') }))
    const { container } = renderPage('bg')
    await waitFor(() => expect(stepImgs(container)[2].getAttribute('src')).toContain(OWNER('partner-step-port').url))
    const img = stepImgs(container)[2]
    expect(img.style.objectPosition).toBe('50% 50%')
    fireEvent.error(img)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(cdnImage(bgContent.process.steps[2].image.src, { width: 800 }))
    // Partner.css crops the default (50% 62%); no inline crop is left to beat it.
    expect(img.style.objectPosition).toBe('')
  })
})
