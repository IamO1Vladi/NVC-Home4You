import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import DeliveryPage, { exampleRows, figures } from './DeliveryPage.jsx'
import bgContent from '../content/bg/delivery.js'
import enContent from '../content/en/delivery.js'
import elContent from '../content/el/delivery.js'
import { paths } from '../routes/paths.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import { euro } from '../lib/euro.js'
import { forgetHomePhotos } from '../lib/homePhotos.js'
import { getRouteSeo } from '../seo/routeMeta.js'

// The delivery page ("Доставка и монтаж", 2026-10-15). What these pin: the sections come in
// the order the plan gives; every figure on the page is the module's (deliveryRates.js,
// prices.js, the catalogue), none is left as a {placeholder}; the examples table prints only
// places with road km and prices them as the calculator does; the clips follow the media
// rules (no autoplay attribute, nothing loaded with reduced motion or Save-Data); the
// questions are also FAQ markup; the three languages render their own copy.
//
// The examples file is mocked so a test can empty it; the place table the calculator loads
// is never touched (the field is not focused here).

const EX = vi.hoisted(() => ({ rows: [] }))
vi.mock('../content/shared/deliveryPlaces/examples.json', () => ({ default: EX }))

const ROWS = [
  { id: 'sofia', country: 'BG', names: { bg: 'София', en: 'Sofia', el: 'Σόφια' }, km: 175, kmV: 442 },
  { id: 'varna', country: 'BG', names: { bg: 'Варна', en: 'Varna', el: 'Βάρνα' }, km: 620, kmV: 1 },
  { id: 'burgas', country: 'BG', names: { bg: 'Бургас', en: 'Burgas', el: 'Μπουργκάς' }, km: 570, kmV: 132 },
  { id: 'kariani', country: 'GR', names: { bg: 'Кариани', en: 'Kariani', el: 'Κάριανη' }, km: null, kmV: null },
]

const CONTENT = { bg: bgContent, en: enContent, el: elContent }
const { container: CONTAINER, box: BOX } = DELIVERY_RATES.products

const CASE = {
  id: '2',
  rating: 5,
  quote: 'The house looks great. I am now renting it out and have everything perfectly working.',
  images: ['/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp'],
}
let cases = [CASE]

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

// A controllable IntersectionObserver: each test says what is on screen.
let observers = []
class FakeObserver {
  constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; observers.push(this) }
  observe(el) { this.targets.push(el) }
  unobserve() {}
  disconnect() { this.targets = [] }
}
const fire = (predicate, entry) => act(() => {
  for (const o of observers.filter(predicate)) {
    for (const target of o.targets) o.callback([{ target, ...entry }], o)
  }
})
const nearObservers = (o) => Boolean(o.options?.rootMargin)
const playObservers = (o) => Array.isArray(o.options?.threshold)

function setMotion({ reduced = false, saveData = false } = {}) {
  vi.stubGlobal('matchMedia', (query) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
  Object.defineProperty(window.navigator, 'connection', { value: { saveData }, configurable: true })
}

beforeEach(() => {
  EX.rows = ROWS
  cases = [CASE]
  observers = []
  forgetHomePhotos()
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  setMotion()
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/api/cases-page')) return json({ cases, reviews: [] })
    return Promise.resolve({ ok: false, status: 404 })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete window.navigator.connection
})

function renderPage(locale = 'bg', search = '') {
  return render(
    <MemoryRouter initialEntries={[`${paths.delivery[locale]}${search}`]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        <DeliveryPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

async function ready(container) {
  await waitFor(() => expect(container.querySelector('#dl-proof-title')).not.toBeNull())
}

// Intl writes a no-break space inside "1 240 €"; compare with the spaces made alike.
const flat = (s) => String(s ?? '').replace(/\s/g, ' ')

describe('DeliveryPage', () => {
  it('puts the sections in the planned order', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const order = [...container.querySelectorAll('h1, h2')].map((h) => (h.classList.contains('dc-title') ? 'dc-title' : h.id))
    const at = (id) => order.indexOf(id)
    const ids = ['dl-hero-title', 'dl-included-title', 'dl-examples-title', 'dl-journey-title', 'dl-prepare-title', 'dl-proof-title', 'dl-faq-title', 'dl-siblings-title', 'hp-final-title']
    for (const id of ids) expect(at(id), id).toBeGreaterThanOrEqual(0)
    expect(ids.map(at)).toEqual([...ids.map(at)].sort((a, b) => a - b))
    // The calculator sits in the hero, before the first section heading.
    expect(at('dc-title')).toBeGreaterThan(at('dl-hero-title'))
    expect(at('dc-title')).toBeLessThan(at('dl-included-title'))
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    // Headings never skip a level.
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]))
    levels.forEach((level, i) => { if (i) expect(level - levels[i - 1]).toBeLessThanOrEqual(1) })
  })

  it.each(['bg', 'en', 'el'])('prints every figure from the modules and leaves no placeholder (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const text = flat(container.querySelector('main').textContent)
    const money = (v) => flat(euro(v, locale))
    for (const figure of [
      money(CONTAINER.perKm), money(BOX.perKm), money(BOX.crane.about), money(CONTAINER.crane.about),
      money(CONTAINER.noCrane.travelMax), CONTAINER.noCrane.nights,
      `${LEAD_TIMES.containerInStockDays} `, `${LEAD_TIMES.boxProductionDays} `, LEAD_TIMES.boxToAddressMonths,
      flat(figures(locale).assembly),
    ]) expect(text).toContain(figure)
    expect(text).not.toMatch(/\{\w+\}/)
    // The hero's three ticks, composed from the module.
    const ticks = [...container.querySelectorAll('.pp-hero .hp-facts li')].map((li) => flat(li.textContent))
    expect(ticks).toHaveLength(3)
    expect(ticks[0]).toContain(money(CONTAINER.perKm))
    expect(ticks[1]).toContain(money(BOX.perKm))
    expect(ticks[1]).toContain(money(BOX.crane.about))
  })

  it('reads the Box sizes on the truck from the catalogue', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const table = within(container).getByRole('table', { name: bgContent.journey.truck.heading })
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => flat(tr.textContent))
    const { models } = getBoxConfiguratorCatalog('bg')
    expect(rows).toHaveLength(models.length)
    models.forEach((model, i) => {
      const [l, w, h] = model.dimensionsFolded.split('x').map((mm) => new Intl.NumberFormat('bg-BG', { maximumFractionDigits: 2 }).format(mm / 1000))
      expect(rows[i]).toContain(`${l} × ${w} × ${h}`)
      expect(rows[i]).toContain(flat(new Intl.NumberFormat('bg-BG').format(model.weight)))
    })
  })

  describe('example prices', () => {
    it('prints only places with road km, priced as the calculator prices them', async () => {
      const { container } = renderPage('bg')
      await ready(container)
      const table = container.querySelector('table.dl-examples')
      const rows = [...table.querySelectorAll('tbody tr')]
      expect(rows.map((tr) => flat(tr.querySelector('th').textContent))).toEqual(['София · 175 км', 'Варна · 620 км', 'Бургас · 570 км'])
      const sofia = flat(rows[0].textContent)
      expect(sofia).toContain(flat(euro(175 * 2 * CONTAINER.perKm, 'bg')))
      expect(sofia).toContain(flat(euro(Math.round((175 * 2 * BOX.perKm) / 10) * 10, 'bg')))
      expect(sofia).toContain(flat(euro(BOX.crane.about, 'bg')))
      // Burgas: the Box house is counted from Varna, and the cell says so.
      const burgas = flat(rows[2].textContent)
      expect(burgas).toContain(flat(euro(Math.round((132 * 2 * BOX.perKm) / 10) * 10, 'bg')))
      expect(burgas).toMatch(/от Варна/)
      // Varna itself: no transport worth printing, only the crane.
      expect(flat(rows[1].textContent)).not.toMatch(/около 0/)
    })

    it('hides the whole section when no place has km', async () => {
      EX.rows = ROWS.map((row) => ({ ...row, km: null, kmV: null }))
      const { container } = renderPage('bg')
      await ready(container)
      expect(container.querySelector('#dl-examples-title')).toBeNull()
      expect(exampleRows('bg', bgContent, EX.rows)).toEqual([])
    })
  })

  describe('the clips', () => {
    const clips = () => [...document.querySelectorAll('.dl-clip')]

    it('show posters first, then a muted looping video with no autoplay, played only in view', async () => {
      const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
      const { container } = renderPage('bg')
      await ready(container)

      expect(clips().map((li) => li.querySelector('h3').textContent)).toEqual(bgContent.journey.clips.map((c) => c.title))
      for (const li of clips()) {
        const poster = li.querySelector('img')
        expect(poster.getAttribute('loading')).toBe('lazy')
        expect(poster.getAttribute('alt')).toBe('')
        expect(li.querySelector('video')).toBeNull()
      }

      fire(nearObservers, { isIntersecting: true, intersectionRatio: 0.1 })
      const videos = container.querySelectorAll('.dl-clip video')
      expect(videos).toHaveLength(4)
      const ids = bgContent.journey.clips.map((c) => c.id)
      videos.forEach((video, i) => {
        expect(video.muted).toBe(true)
        expect(video.hasAttribute('playsinline')).toBe(true)
        expect(video.hasAttribute('loop')).toBe(true)
        expect(video.getAttribute('preload')).toBe('none')
        expect(video.hasAttribute('autoplay')).toBe(false)
        expect(video.getAttribute('aria-hidden')).toBe('true')
        expect(video.getAttribute('poster')).toMatch(new RegExp(`delivery/journey-${ids[i]}\\.webp$`))
        const source = video.querySelector('source')
        expect(source.getAttribute('type')).toBe('video/mp4')
        expect(source.getAttribute('src')).toMatch(new RegExp(`delivery/journey-${ids[i]}\\.mp4$`))
      })

      fire(playObservers, { isIntersecting: true, intersectionRatio: 0.8 })
      expect(play).toHaveBeenCalledTimes(4)
      fire(playObservers, { isIntersecting: false, intersectionRatio: 0 })
      expect(pause).toHaveBeenCalled()
    })

    it.each([
      ['prefers reduced motion', { reduced: true }],
      ['asks to save data', { saveData: true }],
    ])('never load a video when the visitor %s', async (_, motion) => {
      setMotion(motion)
      const { container } = renderPage('bg')
      await ready(container)
      fire(() => true, { isIntersecting: true, intersectionRatio: 1 })
      expect(container.querySelectorAll('.dl-clip video, .dl-clip source')).toHaveLength(0)
      expect(container.querySelectorAll('.dl-clip img')).toHaveLength(4)
      expect(observers.filter(nearObservers)).toHaveLength(0)
    })
  })

  it('publishes the six questions as FAQ markup with the answers it shows', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const faq = blocks.find((b) => b['@type'] === 'FAQPage')
    expect(faq.mainEntity).toHaveLength(6)
    const shown = [...container.querySelectorAll('.dl-faq-item')].map((d) => ({
      q: d.querySelector('summary').textContent,
      a: d.querySelector('p').textContent,
    }))
    expect(faq.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }))).toEqual(shown)
    expect(flat(faq.mainEntity[1].acceptedAnswer.text)).toContain(flat(euro(BOX.crane.about, 'bg')))
    // No price markup for an estimate.
    expect(blocks.some((b) => JSON.stringify(b).includes('"Offer"'))).toBe(false)
  })

  it('presets the calculator from ?product=', async () => {
    const { container } = renderPage('bg', '?product=box')
    await ready(container)
    const checked = container.querySelector('.dc input[type="radio"]:checked')
    expect(checked.closest('label').textContent).toBe(bgContent.calculator.products.box)
  })

  it('leaves the proof out while the case is unpublished', async () => {
    cases = []
    const { container } = renderPage('bg')
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/cases-page')))
    await act(async () => {})
    expect(container.querySelector('#dl-proof-title')).toBeNull()
  })

  it.each(['en', 'el'])('renders the %s page in its own language', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    expect(container.querySelector('h1').textContent).toBe(CONTENT[locale].hero.h1)
    expect(container.querySelector('main').textContent).not.toMatch(/[А-Яа-я]/)
    expect(container.querySelector('#hp-final-title').textContent).toBe(CONTENT[locale].finalTitle)
  })

  it('links the products and prices in this language', async () => {
    const { container } = renderPage('el')
    await ready(container)
    const hrefs = [...container.querySelectorAll('.pp-sib')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([paths.modularBuilds.el, paths.modularHouses.el, paths.steelHouses.el, paths.prices.el])
  })

  it.each(['bg', 'en', 'el'])('takes its title and the three hreflangs from routeMeta (%s)', (locale) => {
    const seo = getRouteSeo(paths.delivery[locale], locale)
    expect(seo.url).toBe(`https://nvc-home4you.eu${paths.delivery[locale]}`)
    const langs = seo.hreflangs.map((h) => h.hrefLang)
    for (const lang of ['bg', 'en', 'el']) expect(langs).toContain(lang)
    // The content file has no seo block of its own any more.
    expect(CONTENT[locale].seo).toBeUndefined()
  })
})
