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
import { forgetHomePhotos } from '../lib/homePhotos.js'
import { euro } from '../lib/euro.js'
import { getRouteSeo } from '../seo/routeMeta.js'

// The partner page (2026-10-15). What these pin: the sections come in the plan's order; the
// two quantity thresholds are partnerTerms.js's (mocked here to other numbers, so a figure
// typed into the copy would show); the warranty, answered the same day, is drawn with every
// year from warranty.js (mocked the same way) and for containers and Box houses only, never the
// steel-frame houses; nothing waiting for the owner's answer is drawn or sent to Google;
// "factories" never appears, in any language, since the owner's rule is one factory; the route
// map is not loaded with the page; the FAQ markup is the questions shown.

const TERMS = vi.hoisted(() => ({ container: 7, box: 4 }))
vi.mock('../content/shared/partnerTerms.js', () => ({ PARTNER_MIN_UNITS: TERMS }))

// Not the real 15, 6, 6 and 2: a year typed into the copy would print the real one.
const YEARS = vi.hoisted(() => ({ structure: 17, panels: 9, joinery: 8, sanitary: 5 }))
vi.mock('../content/shared/warranty.js', () => ({ WARRANTY_YEARS: YEARS }))

// The gallery rows the product cards price from, without the gallery.
const ROWS = vi.hoisted(() => ({ wagon: [{ total: 9800 }, { total: 8600 }], box: [{ house: 21000 }, { house: 15500 }] }))
vi.mock('../lib/productRows.js', async (importOriginal) => ({
  ...(await importOriginal()),
  useProductRows: () => ({ ...ROWS, loading: false, error: null, items: [], galleryPath: '/bg/galeriq' }),
}))

// jsdom has no vector renderer for Leaflet's route lines.
vi.mock('react-leaflet', async (importOriginal) => ({
  ...(await importOriginal()),
  Polyline: () => null,
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

let observers = []
class FakeObserver {
  constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; observers.push(this) }
  observe(el) { this.targets.push(el) }
  unobserve() {}
  disconnect() { this.targets = [] }
}
const mapObservers = () => observers.filter((o) => o.options?.rootMargin === '400px 0px' && o.targets.length)

function setPhone(phone) {
  vi.stubGlobal('matchMedia', (query) => ({
    matches: phone && query.includes('max-width: 767px'),
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
  observers = []
  forgetHomePhotos()
  window.sessionStorage.clear()
  openOffer.mockClear()
  openQuestion.mockClear()
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  setPhone(false)
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
    const question = [...container.querySelectorAll('.dl-faq-item')].find((d) => WARRANTY_WORD[locale].test(d.querySelector('summary').textContent))
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
    const asking = [...container.querySelectorAll('.dl-faq-item')].filter((d) => WARRANTY_WORD[locale].test(d.textContent))
    expect(asking).toEqual([question])

    // And Google gets the same question and answer.
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const faq = ld.find((b) => b['@type'] === 'FAQPage')
    expect(faq.mainEntity.find((e) => e.name === question.querySelector('summary').textContent).acceptedAnswer.text).toBe(answer)
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
    const shown = [...container.querySelectorAll('.dl-faq-item')].map((d) => ({
      q: d.querySelector('summary').textContent,
      a: d.querySelector('p').textContent,
    }))
    expect(shown).toHaveLength(bgContent.faq.items.filter((item) => !item.pending).length)
    expect(faq.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }))).toEqual(shown)
    expect(blocks.some((b) => JSON.stringify(b).includes('"Offer"'))).toBe(false)
  })

  describe('the route map', () => {
    it('is not loaded with the page, only once its section nears the screen', async () => {
      const { container } = renderPage('bg')
      await ready(container)
      expect(container.querySelector('.leaflet-container, .wr-card')).toBeNull()
      expect(screen.getByRole('button', { name: bgContent.cargo.show })).toBeInTheDocument()

      const near = mapObservers()
      expect(near).toHaveLength(1)
      act(() => { near[0].callback([{ target: near[0].targets[0], isIntersecting: true }], near[0]) })
      expect(await within(container.querySelector('#ptn-cargo')).findByRole('button', { name: bgContent.logisticsWorld.modeSea }, { timeout: 4000 })).toBeInTheDocument()
      expect(container.querySelector('.leaflet-container')).not.toBeNull()
    })

    it('on a phone waits for a tap', async () => {
      setPhone(true)
      const { container } = renderPage('bg')
      await ready(container)
      expect(mapObservers()).toHaveLength(0)
      expect(container.querySelector('.leaflet-container')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: bgContent.cargo.show }))
      expect(await within(container.querySelector('#ptn-cargo')).findByRole('button', { name: bgContent.logisticsWorld.modeSea }, { timeout: 4000 })).toBeInTheDocument()
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
    expect(cards).toHaveLength(3)
    expect(cards[0]).toContain(flat(euro(8600, 'bg')))
    expect(cards[1]).toContain(flat(euro(15500, 'bg')))
    expect(cards[2]).not.toMatch(/€/)
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
