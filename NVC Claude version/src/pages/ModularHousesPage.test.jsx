import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import ModularHousesPage from './ModularHousesPage.jsx'
import bgContent from '../content/bg/modularHouses.js'
import enContent from '../content/en/modularHouses.js'
import elContent from '../content/el/modularHouses.js'
import { paths } from '../routes/paths.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { fetchHomePhotos, forgetHomePhotos } from '../lib/homePhotos.js'

// The modular houses page, built on the gallery rows.
//
// What these pin is what the audit found wrong on the old page and what the rebuild
// promises instead: every price on it comes from /api/gallery (and the assembly from
// prices.js), none is typed into the content; the 37, 58 and 73 m² cards open the
// configurator on that model; the capsule says only what its gallery entry says; nothing
// says 78 m² or leva; every card's price and lines are in the page, not behind a hover;
// and the English and Greek pages carry no Cyrillic.
//
// The gallery rows are shaped like the live /api/gallery items (2026-10-12), with the live
// prices and titles of every modular house and one container. The cases body is the live
// published case, cut down to what the page reads.

const CONTENT = { bg: bgContent, en: enContent, el: elContent }

const item = (id, category, price, title, titleBg, titleEl, cover) => ({
  id, category, price, currency: 'EUR', title, titleBg, titleEl,
  description: `<p>${title}</p>`, descriptionBg: `<p>${titleBg}</p>`, descriptionEl: `<p>${titleEl}</p>`,
  coverUrl: `/api/img/gallery/${cover}/cover.webp`, images: [`/api/img/gallery/${cover}/cover.webp`], catalogId: null,
})

const GALLERY = [
  item(13, 'wagon', 4300, 'Container House – 6000mm*3000mm', 'Жилищен фургон - 6000мм*3000мм', 'Σπίτι τύπου Container – 6000 mm × 3000 mm', 1),
  item(4, 'modular', 25500, 'Expandable house - 58m² with balcony and a double roof', 'Разгъваема къща – 58 м² с веранда и двоен покрив', 'Αναπτυσσόμενη κατοικία — 58 m² με βεράντα και διπλή στέγη', 4),
  item(15, 'modular', 28000, 'Expandable house - 73m² with balcony and a double roof', 'Разгъваема къща – 73 м² с веранда и двоен покрив', 'Αναπτυσσόμενη κατοικία — 73 m² με βεράντα και διπλή στέγη', 5),
  item(10, 'modular', 14000, 'Expandable House – 37 m²', 'Разгъваема Къща – 37 м²', 'Αναπτυσσόμενη κατοικία – 37 m²', 8),
  item(11, 'modular', 16700, 'Expandable House – 37 m² with balcony and a double roof', 'Разгъваема къща – 37 м² с веранда и двоен покрив', 'Αναπτυσσόμενη κατοικία – 37 m² με βεράντα και διπλή στέγη', 9),
  item(5, 'modular', 23000, 'Expandable House – 58 m²', 'Разгъваема Къща – 58 м²', 'Αναπτυσσόμενη κατοικία — 58 m²', 10),
  item(9, 'modular', 26500, 'Expandable House – 73 m²', 'Разгъваема Къща – 73 м²', 'Αναπτυσσόμενη κατοικία — 73 m²', 11),
  item(16, 'modular', 17800, 'Panoramic Box House – 37 m²', 'Панорамна Бокс къща – 37 м²', 'Πανοραμικό Box House – 37 m²', 12),
  item(17, 'modular', 32700, 'Two-storey expandable house - 74m²', 'Двуетажна разгъваема къща - 74м²', 'Διώροφη αναπτυσσόμενη κατοικία — 74 m²', 14),
  item(100015, 'modular', 55000, 'Space house', 'Космическа къща - капсула', 'Φουτουριστική κατοικία-κάψουλα', 15),
  item(100016, 'modular', 10500, 'Expandable House – 18 m²', 'Разгъваема Къща – 18 м²', 'Αναπτυσσόμενη κατοικία – 18 m²', 16),
]

const CASE = {
  id: '2',
  rating: 5,
  quote: 'The house looks great. I am now renting it out and have everything perfectly working.',
  imageUrl: '/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp',
  images: [
    '/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp',
    '/api/img/cases/1/268f1b6801134d16ab11f700ac46faf5.webp',
    '/api/img/cases/1/c046179db4c24cbd864abbc7b195f9e5.webp',
    '/api/img/cases/1/5f6e02eabc11410c89ab824cb2496488.webp',
  ],
}

let cases = [CASE]
let homePhotos = null

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

beforeEach(() => {
  cases = [CASE]
  homePhotos = null
  // A photo answer kept from the test before would be on the first render of this one.
  forgetHomePhotos()
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/api/gallery')) return json({ items: GALLERY })
    if (u.includes('/api/cases-page')) return json({ cases, reviews: [] })
    if (u.includes('/api/home/photos')) return homePhotos ? json(homePhotos) : Promise.resolve({ ok: false, status: 404 })
    return Promise.resolve({ ok: false, status: 404 })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPage(locale, { onRequestModel = () => {} } = {}) {
  return render(
    <MemoryRouter initialEntries={[paths.modularHouses[locale]]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}} onRequestModel={onRequestModel}>
        <ModularHousesPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

// Wait for the gallery rows (the 18 m² card) and the published case (its quote).
async function ready(container) {
  await waitFor(() => expect(container.querySelector('#item-100016')).not.toBeNull())
  await waitFor(() => expect(container.textContent).toContain(CASE.quote))
}

// Intl writes a no-break space inside "10 500 €"; compare with the spaces made alike.
const flat = (s) => String(s).replace(/\s/g, ' ')

/** Every string in a content object. */
function strings(value, at = '') {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}

describe('ModularHousesPage', () => {
  it.each(['bg', 'en', 'el'])('has one H1, the page\'s own (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe(CONTENT[locale].hero.h1)
    // Headings in order: no h3 before the first h2, nothing skipped.
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]))
    levels.forEach((level, i) => { if (i) expect(level - levels[i - 1]).toBeLessThanOrEqual(1) })
  })

  it.each(['bg', 'en', 'el'])('quotes the cheapest house without its assembly in the hero, from the rows (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const hero = container.querySelector('.pp-price')
    // 10,500 is the 18 m² house; the capsule (55,000) and every total with assembly are not it.
    expect(flat(hero.textContent)).toContain(flat(euro(10500, locale)))
    expect(flat(hero.textContent)).toContain(CONTENT[locale].hero.basis)
  })

  it('prints each size card\'s house price, its assembly with VAT and its veranda variant (bg)', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const card = (id) => container.querySelector(`#item-${id}`)
    const text = (id) => flat(card(id).textContent)

    // 37 m²: 14,000 + 700 net assembly × 1.2 = 840; variant 16,700 + 1,300 × 1.2 = 1,560.
    expect(text(10)).toContain(flat(euro(14000, 'bg')))
    expect(text(10)).toContain(flat(`+ монтаж ${euro(840, 'bg')} с ДДС`))
    expect(text(10)).toContain(flat(euro(16700, 'bg')))
    expect(text(10)).toContain(flat(euro(1560, 'bg')))
    expect(text(5)).toContain(flat(euro(1020, 'bg')))
    expect(text(9)).toContain(flat(euro(1200, 'bg')))
    expect(text(16)).toContain(flat(euro(2280, 'bg')))
    expect(text(17)).toContain(flat(euro(3600, 'bg')))

    // The 18 m² house's assembly is not known yet: it says so instead of a number.
    expect(text(100016)).toContain(flat(euro(10500, 'bg')))
    expect(text(100016)).toContain(bgContent.sizes.assemblyOnRequest)

    // The variant line links to the variant's own gallery page.
    const variant = within(card(10)).getByRole('link', { name: /веранда/ })
    expect(variant.getAttribute('href')).toMatch(/^\/bg\/galeriq\//)

    // The variants are lines of their size's card, not cards of their own.
    expect(card(11)).toBeNull()
    expect(card(4)).toBeNull()
    expect(card(15)).toBeNull()
  })

  it.each(['bg', 'en', 'el'])('opens the configurator on 37, 58 and 73, and asks about the others (%s)', async (locale) => {
    const asked = []
    const { container } = renderPage(locale, { onRequestModel: (model) => asked.push(model) })
    await ready(container)
    const c = CONTENT[locale]

    for (const [id, model] of [[10, '37'], [5, '58'], [9, '73']]) {
      const link = within(container.querySelector(`#item-${id}`)).getByRole('link', { name: new RegExp(c.sizes.build) })
      expect(link.getAttribute('href')).toBe(`${paths.boxConfigurator[locale]}?model=${model}`)
    }

    for (const id of [100016, 16, 17, 100015]) {
      const cardEl = container.querySelector(`#item-${id}`)
      const ask = within(cardEl).getByRole('button', { name: new RegExp(c.sizes.ask) })
      ask.click()
      const details = within(cardEl).getByRole('link', { name: new RegExp(c.sizes.more.replace('→', '').trim()) })
      expect(details.getAttribute('href').startsWith(`${paths.gallery[locale]}/`)).toBe(true)
    }
    expect(asked.map((m) => m.id)).toEqual([100016, 16, 17, 100015])
    expect(asked.every((m) => m.path.startsWith('/bg/galeriq/'))).toBe(true)
  })

  it.each(['bg', 'en', 'el'])('gives the capsule one wide card with only the gallery\'s facts (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const capsule = container.querySelector('#item-100015')
    expect(capsule.classList.contains('pp-unit--wide')).toBe(true)
    expect(flat(capsule.textContent)).toContain(flat(euro(55000, locale)))
    expect(capsule.textContent).toContain(CONTENT[locale].capsule.basis)
    for (const line of CONTENT[locale].capsule.lines) expect(capsule.textContent).toContain(line)
    // The old card's borrowed specs.
    expect(capsule.textContent).not.toMatch(/40–100|150\/200|SPC/)
  })

  it('compares Box house and capsule in a real table, with prices from the rows (bg)', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const table = container.querySelector('table.pp-spec')
    expect(table.getAttribute('aria-labelledby')).toBe('mh-compare-title')
    expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(3)
    expect(table.querySelectorAll('th[scope="row"]')).toHaveLength(bgContent.compare.rows.length + 1)
    expect(flat(table.textContent)).toContain(flat(euro(10500, 'bg')))
    expect(flat(table.textContent)).toContain(flat(euro(55000, 'bg')))
    expect(table.textContent).not.toMatch(/Структура|50\/75\/100/)
  })

  it.each(['bg', 'en', 'el'])('says what the price leaves out in the prices page\'s own words (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const copy = getPricesCopy(locale)
    for (const line of [...copy.included, ...copy.excluded, copy.foundationNote]) {
      expect(container.textContent).toContain(line)
    }
  })

  it.each(['bg', 'en', 'el'])('says what delivery and the crane cost, without VAT, how long the house takes, and links the estimator (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const BOX = DELIVERY_RATES.products.box
    const arrival = CONTENT[locale].arrival
    const line = arrival.delivery
      .replace('{rate}', euro(BOX.perKm, locale))
      .replace('{crane}', euro(BOX.crane.about, locale))
      .replace('{production}', LEAD_TIMES.boxProductionDays)
      .replace('{months}', LEAD_TIMES.boxToAddressMonths)
    const section = container.querySelector('[aria-labelledby="mh-arrival-title"]')
    expect(flat(section.textContent)).toContain(flat(line))
    expect(line).toContain({ bg: 'без ДДС', en: 'exclude VAT', el: 'ΦΠΑ' }[locale])
    expect(line).not.toMatch(/\{\w+\}/)
    const link = within(section).getByRole('link', { name: arrival.deliveryLink })
    expect(link.getAttribute('href')).toBe(paths.delivery[locale])
  })

  it('reads the Box delivery figures from deliveryRates.js', async () => {
    // Changed in the module for one render: a figure typed anywhere else could not follow.
    const BOX = DELIVERY_RATES.products.box
    const saved = JSON.parse(JSON.stringify(BOX))
    Object.assign(BOX, { perKm: 9, crane: { required: true, about: 777, canBeMore: true } })
    try {
      const { container } = renderPage('bg')
      await ready(container)
      const section = flat(container.querySelector('[aria-labelledby="mh-arrival-title"]').textContent)
      expect(section).toContain(flat('около ' + euro(9, 'bg') + ' на километър'))
      expect(section).toContain(flat('около ' + euro(777, 'bg')))
    } finally {
      Object.assign(BOX, saved)
    }
  })

  it.each(['bg', 'en', 'el'])('says nothing about 78 m², leva or BGN (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const text = flat(container.textContent)
    expect(text).not.toMatch(/78\s?(m²|м²|м2|m2)/)
    expect(text).not.toMatch(/BGN|лв\.?(\s|$)|λέβα/)
    for (const script of container.querySelectorAll('script[type="application/ld+json"]')) {
      expect(script.textContent).not.toContain('BGN')
    }
  })

  it.each(['bg', 'en', 'el'])('types no price into the content file (%s)', (locale) => {
    const hits = strings(CONTENT[locale])
      .filter(([, s]) => /€|EUR|BGN|лв|\d[\d\s.,]{2,}\s?(€|евро|euro|ευρώ)/i.test(s))
      .map(([at, s]) => `${at}: ${s}`)
    expect(hits).toEqual([])
    // And no figure the gallery owns appears as text: the live prices of every house.
    const all = strings(CONTENT[locale]).map(([, s]) => s.replace(/\s/g, '')).join('|')
    for (const price of [10500, 14000, 16700, 23000, 25500, 26500, 28000, 17800, 32700, 55000, 4300]) {
      expect(all).not.toMatch(new RegExp(`\\b${String(price).replace(/(\d{2})(\d{3})$/, '$1[ .,]?$2')}\\b`))
    }
  })

  it.each(['bg', 'en', 'el'])('shows every card\'s price and lines in the page, not behind a hover (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    // Six sizes and the capsule.
    expect(container.querySelectorAll('.pp-unit')).toHaveLength(7)
    for (const cardEl of container.querySelectorAll('.pp-unit')) {
      const price = cardEl.querySelector('.pp-unit-price')
      expect(price).not.toBeNull()
      // Nothing that carries the facts is hidden from anyone.
      for (const el of [price, ...cardEl.querySelectorAll('.pp-unit-lines li, .pp-unit-diff')]) {
        expect(el.closest('[hidden],[aria-hidden="true"]')).toBeNull()
      }
    }
    // The page has no hover handlers and loads no stylesheet of its own any more.
    const source = fs.readFileSync(path.resolve(__dirname, 'ModularHousesPage.jsx'), 'utf8')
    expect(source).not.toMatch(/onMouse(Enter|Over|Leave)|:hover/)
    expect(source).not.toMatch(/ModularHouses\.css/)
  })

  it('uses the published case: its quote marked as English on the Bulgarian page, its photos', async () => {
    const { container } = renderPage('bg')
    await ready(container)
    const quote = [...container.querySelectorAll('p')].find((p) => p.textContent.includes(CASE.quote))
    expect(quote.getAttribute('lang')).toBe('en')
    const photos = [...container.querySelectorAll('.pp-photos img')]
    expect(photos.map((img) => img.getAttribute('alt'))).toEqual(bgContent.proof.photos.map((p) => p.alt))
    // The hero shows the case's house, with the chip that says where it stands.
    expect(container.querySelector('.pp-hero-media img').getAttribute('src')).toContain('0ed68fb76fbe4876a9905da7d043216d')
    expect(container.querySelector('.pp-hero-chip').textContent).toBe(bgContent.case.line)
  })

  it('leaves the quote unmarked on the English page', async () => {
    const { container } = renderPage('en')
    await ready(container)
    const quote = [...container.querySelectorAll('p')].find((p) => p.textContent.includes(CASE.quote))
    expect(quote.hasAttribute('lang')).toBe(false)
  })

  it('draws no proof card once the case is unpublished', async () => {
    cases = []
    const { container } = renderPage('bg')
    await waitFor(() => expect(container.querySelector('#item-100016')).not.toBeNull())
    await new Promise((r) => setTimeout(r, 0))
    expect(container.querySelector('#mh-proof-title')).toBeNull()
    expect(container.textContent).not.toContain(CASE.quote)
  })

  it('shows the admin\'s photo when the slot is set, without the chip', async () => {
    homePhotos = { hero: [], models: {}, pages: { modularHouses: { url: '/api/img/home/page-houses.webp', alt: '' } } }
    const { container } = renderPage('bg')
    await waitFor(() => expect(container.querySelector('.pp-hero-media img').getAttribute('src')).toContain('page-houses'))
    expect(container.querySelector('.pp-hero-media img').getAttribute('alt')).toBe(bgContent.hero.adminAlt)
    expect(container.querySelector('.pp-hero-chip')).toBeNull()
  })

  it.each(['bg', 'en', 'el'])('uses the admin\'s own alt on the Bulgarian page only, since it is typed in Bulgarian (%s)', async (locale) => {
    homePhotos = { hero: [], models: {}, pages: { modularHouses: { url: '/api/img/home/page-houses.webp', alt: 'Къщата на клиента' } } }
    const { container } = renderPage(locale)
    await waitFor(() => expect(container.querySelector('.pp-hero-media img').getAttribute('src')).toContain('page-houses'))
    expect(container.querySelector('.pp-hero-media img').getAttribute('alt')).toBe(locale === 'bg' ? 'Къщата на клиента' : CONTENT[locale].hero.adminAlt)
  })

  it('opens on the admin\'s photo from the first render once an answer is kept', async () => {
    homePhotos = { hero: [], models: {}, pages: { modularHouses: { url: '/api/img/home/page-houses.webp', alt: '' } } }
    await fetchHomePhotos()
    const { container } = renderPage('bg')
    // No waiting: the case photo is never drawn first and swapped out.
    expect(container.querySelector('.pp-hero-media img').getAttribute('src')).toContain('page-houses')
  })

  it.each(['bg', 'en', 'el'])('links the other two product pages, the containers with their live price (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const sibs = container.querySelector('.pp-sibs')
    const links = [...sibs.querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual([paths.modularBuilds[locale], paths.steelHouses[locale]])
    expect(flat(links[0].textContent)).toContain(flat(euro(4300, locale)))
  })

  it.each(['bg', 'en', 'el'])('publishes Product markup in EUR for the houses it shows (%s)', async (locale) => {
    const { container } = renderPage(locale)
    await ready(container)
    const lists = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent))
      .filter((d) => d['@type'] === 'ItemList')
    expect(lists).toHaveLength(1)
    const offers = lists[0].itemListElement.map((e) => e.item.offers)
    expect(offers.every((o) => o.priceCurrency === 'EUR')).toBe(true)
    // The house price the card shows, never a total; the container is not on this page.
    expect(offers.map((o) => o.price).sort((a, b) => a - b))
      .toEqual([10500, 14000, 16700, 17800, 23000, 25500, 26500, 28000, 32700, 55000])
  })

  it.each(['en', 'el'])('has no Cyrillic in the %s content or on the rendered page', async (locale) => {
    const cyrillic = strings(CONTENT[locale]).filter(([, s]) => /[Ѐ-ӿ]/.test(s))
    expect(cyrillic).toEqual([])
    const { container } = renderPage(locale)
    await ready(container)
    const words = container.querySelector('main').textContent.match(/\S*[Ѐ-ӿ]\S*/g) || []
    expect(words).toEqual([])
  })
})
