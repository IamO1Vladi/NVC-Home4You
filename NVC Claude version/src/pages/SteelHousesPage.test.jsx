import React from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import SteelHousesPage from './SteelHousesPage.jsx'
import { paths } from '../routes/paths.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { getHomeContent } from '../content/home/index.js'
import { fetchHomePhotos, forgetHomePhotos } from '../lib/homePhotos.js'
import { dictionaries } from '../i18n/translations.js'

import bg from '../content/bg/steelHouses.js'
import en from '../content/en/steelHouses.js'
import el from '../content/el/steelHouses.js'

// The steel-frame page after the rebuild: what it says, where its figures come from, the five
// steps with the pictures that belong to them, and the things the audit and the owner removed
// that must not creep back (fixed sizes for a line where every house is custom, a 78 m² house
// that does not exist, prices in leva, a carousel or a ticker, the old example gallery,
// content shown only on hover).
//
// The gallery rows below are shaped like /api/gallery's, with the live prices of the models
// the sibling cards draw on. The cheapest container (6×3, €4,300) is deliberately not first,
// and the cheapest house (18 m², €10,500) has no assembly mapped, so the cards prove they
// take the lowest container TOTAL and the lowest house PRICE rather than the first row.

const GALLERY = [
  { id: 6, category: 'wagon', price: 4800, currency: 'EUR', title: 'Container House – 7000mm*3000mm', titleBg: 'Жилищен фургон - 7000мм*3000мм', titleEl: 'Σπίτι τύπου Container – 7000 mm × 3000 mm', description: '<p>Container house.</p>', descriptionBg: '<p>Жилищен фургон.</p>', descriptionEl: '<p>Σπίτι τύπου Container.</p>', coverUrl: '/api/img/gallery/2/a.webp', images: [], catalogId: null },
  { id: 13, category: 'wagon', price: 4300, currency: 'EUR', title: 'Container House – 6000mm*3000mm', titleBg: 'Жилищен фургон - 6000мм*3000мм', titleEl: 'Σπίτι τύπου Container – 6000 mm × 3000 mm', description: '<p>Container house.</p>', descriptionBg: '<p>Жилищен фургон.</p>', descriptionEl: '<p>Σπίτι τύπου Container.</p>', coverUrl: '/api/img/gallery/1/a.webp', images: [], catalogId: null },
  { id: 8, category: 'wagon', price: 6500, currency: 'EUR', title: 'Container House – 8000*3000mm with pitched roof', titleBg: 'Контейнерна къща – 8000*3000мм с двускатен покрив', titleEl: 'Σπίτι τύπου Container – 8000 × 3000 mm με δίρριχτη στέγη', description: '', descriptionBg: '', descriptionEl: '', coverUrl: '/api/img/gallery/3/a.webp', images: [], catalogId: null },
  { id: 10, category: 'modular', price: 14000, currency: 'EUR', title: 'Expandable House – 37 m²', titleBg: 'Разгъваема Къща – 37 м²', titleEl: 'Αναπτυσσόμενη κατοικία – 37 m²', description: '', descriptionBg: '', descriptionEl: '', coverUrl: '/api/img/gallery/8/a.webp', images: [], catalogId: null },
  { id: 100015, category: 'modular', price: 55000, currency: 'EUR', title: 'Space house', titleBg: 'Космическа къща - капсула', titleEl: 'Φουτουριστική κατοικία-κάψουλα', description: '', descriptionBg: '', descriptionEl: '', coverUrl: '/api/img/gallery/15/a.webp', images: [], catalogId: null },
  { id: 100016, category: 'modular', price: 10500, currency: 'EUR', title: 'Expandable House – 18 m²', titleBg: 'Разгъваема Къща – 18 м²', titleEl: 'Αναπτυσσόμενη κατοικία – 18 m²', description: '', descriptionBg: '', descriptionEl: '', coverUrl: '/api/img/gallery/16/a.webp', images: [], catalogId: null },
]

const CONTENT = { bg, en, el }
const CYRILLIC = /[Ѐ-ӿ]/

// What /api/home/photos answers; null is a 404 (an empty or not-yet-migrated slot table).
let photosBody = null

function respond(url) {
  if (String(url).includes('/api/home/photos')) {
    return photosBody
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(photosBody) })
      : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  }
  if (String(url).includes('/api/gallery')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: GALLERY }) })
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
}

function renderPage(locale, handlers = {}) {
  return render(
    <MemoryRouter initialEntries={[paths.steelHouses[locale]]}>
      <ModalActionsProvider onOpenOffer={handlers.onOpenOffer || (() => {})} onOpenQuestion={handlers.onOpenQuestion || (() => {})}>
        <SteelHousesPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

/** Renders the page and waits until the sibling cards carry the gallery's prices. */
async function renderLoaded(locale, handlers) {
  const view = renderPage(locale, handlers)
  await waitFor(() => expect(view.container.querySelectorAll('.pp-sib-price')).toHaveLength(2))
  // Let the photo request (which may settle after the gallery) finish as well.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return view
}

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(respond))
})

afterEach(() => {
  photosBody = null
  // A photo answer kept from this test would be on the first render of the next one.
  forgetHomePhotos()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

// The owner's pictures: five stages of one example house. And the old page's seven example
// visualisations, which the owner (2026-10-12) said explicitly not to bring back.
const STAGE_PICTURES = ['rcn', 'rcj', 'rw', 'rck', 'rcm']
const EXAMPLE_PICTURES = ['r4', 'r7', 'rbw', 'rbt', 'rb3', 'rr', 'ri']
const pictureKey = (src) => String(src).match(/bvk4n834b-([a-z0-9]+)-eg-vb/)?.[1]

// Fixed figures the owner said a custom house does not have (2026-10-12): an area range, a
// number of floors or bedrooms, a profile thickness, a fixed insulation.
const FIXED_FIGURES = /20\s*[–-]\s*90|\b2[.,]1\s*(mm|мм)|\b100\s*(mm|мм)|(до|up to|έως)\s*3\b|\b1\s*(или|or|ή)\s*2\b/i

describe.each(['bg', 'en', 'el'])('SteelHousesPage (%s)', (locale) => {
  const c = CONTENT[locale]

  it('has one H1, the page title, and headings that never skip a level', async () => {
    const { container, unmount } = await renderLoaded(locale)

    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent(c.hero.h1)

    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]))
    expect(levels[0]).toBe(1)
    levels.forEach((level, i) => {
      if (i > 0) expect(level).toBeLessThanOrEqual(levels[i - 1] + 1)
    })
    unmount()
  })

  it('prices the two ready lines from the gallery rows, not from the copy', async () => {
    const { container, unmount } = await renderLoaded(locale)

    const prices = [...container.querySelectorAll('.pp-sib-price')].map((p) => p.textContent)
    // The cheapest container total (assembly included) and the cheapest house price alone.
    expect(prices).toEqual([
      `${c.ready.from} ${euro(4300, locale)} ${c.ready.containers.basis}`,
      `${c.ready.from} ${euro(10500, locale)} ${c.ready.houses.basis}`,
    ])

    // And no figure is typed into the content file, nor a price in its title or lead.
    const copy = JSON.stringify(c)
    expect(copy).not.toMatch(/€|EUR|евро|ευρώ/i)
    expect(copy).not.toMatch(/\b\d{1,3}[ ., ]?\d{3}\b/)
    unmount()
  })

  it('links to the two priced pages and the prices page, and opens the offer form', async () => {
    const onOpenOffer = vi.fn()
    const { container, unmount } = await renderLoaded(locale, { onOpenOffer })

    const sibs = [...container.querySelectorAll('a.pp-sib')]
    expect(sibs.map((a) => a.getAttribute('href'))).toEqual([paths.modularBuilds[locale], paths.modularHouses[locale]])
    expect(sibs[0]).toHaveTextContent(c.ready.containers.label)
    expect(sibs[1]).toHaveTextContent(c.ready.houses.label)

    expect(screen.getByRole('link', { name: c.price.link })).toHaveAttribute('href', paths.prices[locale])
    // The gallery link says what is there (the ready models), since no steel house is.
    expect(screen.getByRole('link', { name: c.price.galleryLink })).toHaveAttribute('href', paths.gallery[locale])

    // The primary action is a button in the hero that opens the form; the phone is a real
    // tel: link.
    const offer = screen.getByRole('button', { name: c.hero.cta })
    expect(container.querySelector('.pp-hero').contains(offer)).toBe(true)
    fireEvent.click(offer)
    expect(onOpenOffer).toHaveBeenCalledTimes(1)
    const phone = getHomeContent(locale).home.localBusiness.telephone
    expect(screen.getByRole('link', { name: c.hero.call })).toHaveAttribute('href', `tel:${phone}`)
    unmount()
  })

  it('says what a project decides as one short list, with no fixed figure, and both ways of working', async () => {
    const { container, unmount } = await renderLoaded(locale)

    // In the hero, under its own heading: the six things as one real list, one sentence for
    // all of them (not six rows saying "по проект"), and the frame on its own line.
    const card = screen.getByRole('group', { name: c.decide.title })
    expect(container.querySelector('.pp-hero').contains(card)).toBe(true)
    expect(within(card).getByRole('heading', { level: 2, name: c.decide.title })).toBeInTheDocument()
    expect(within(card).getAllByRole('listitem').map((li) => li.textContent)).toEqual(c.decide.items)
    expect(card).toHaveTextContent(c.decide.note)
    expect(card).toHaveTextContent(`${c.decide.frameLabel}: ${c.decide.frame}`)
    expect(container.querySelector('table')).toBeNull()
    // Nothing in it and no sentence on the page states a size, a count or a thickness.
    expect(card.textContent).not.toMatch(/\d/)
    expect(container.textContent).not.toMatch(FIXED_FIGURES)
    expect(JSON.stringify(c)).not.toMatch(FIXED_FIGURES)

    for (const route of c.how.routes) {
      expect(screen.getByRole('heading', { level: 3, name: route.h })).toBeInTheDocument()
      expect(screen.getByText(route.p)).toBeInTheDocument()
    }
    unmount()
  })

  it('lists the five steps in order, each with its title, words and its own picture', async () => {
    const { container, unmount } = await renderLoaded(locale)

    const section = screen.getByRole('region', { name: c.process.h2 })
    const steps = section.querySelectorAll('ol.pp-steps > li')
    expect(steps).toHaveLength(5)
    c.process.steps.forEach((step, i) => {
      const item = steps[i]
      expect(item.querySelector('h3')).toHaveTextContent(step.title)
      expect(item).toHaveTextContent(step.text)
      const img = item.querySelector('figure img')
      expect(pictureKey(img.getAttribute('src'))).toBe(STAGE_PICTURES[i])
      expect(img).toHaveAttribute('alt', step.image.alt)
      expect(item.querySelector('figcaption')).toHaveTextContent(step.image.caption)
    })
    // Not a ticker: nothing to play or pause.
    expect(container.querySelector('.pp-process button')).toBeNull()
    unmount()
  })

  it('links the delivery step, and only that one, to the delivery page set to a project', async () => {
    const { unmount } = await renderLoaded(locale)

    const section = screen.getByRole('region', { name: c.process.h2 })
    const steps = [...section.querySelectorAll('ol.pp-steps > li')]
    const linked = steps.filter((item) => item.querySelector('a'))
    expect(linked).toHaveLength(1)
    const step = c.process.steps.find((s) => s.link)
    expect(linked[0].querySelector('h3')).toHaveTextContent(step.title)
    const link = within(linked[0]).getByRole('link', { name: step.link.label })
    expect(link).toHaveAttribute('href', `${paths.delivery[locale]}?product=project`)
    unmount()
  })

  it('does not bring back the example gallery: none of its seven pictures, no grid, no lightbox', async () => {
    const { container, unmount } = await renderLoaded(locale)

    const keys = [...container.querySelectorAll('img')].map((img) => pictureKey(img.getAttribute('src')))
    expect(keys.filter((key) => EXAMPLE_PICTURES.includes(key))).toEqual([])
    expect(container.querySelector('.pp-gal, dialog, .pp-lightbox')).toBeNull()
    expect(c.gallery).toBeUndefined()
    // Nor in the copy, where a picture path could wait for someone to render it again.
    const copy = JSON.stringify(c)
    for (const key of EXAMPLE_PICTURES) expect(copy).not.toContain(`bvk4n834b-${key}-eg-vb`)
    unmount()
  })

  it('has no 78 m² house, no leva, no carousel and nothing hidden behind hover', async () => {
    const { container, unmount } = await renderLoaded(locale)
    const text = container.textContent

    expect(text).not.toMatch(/78\s*(m²|м²|m2|кв)/i)
    expect(text).not.toMatch(/BGN|лв\.?\b|λέβα/i)
    expect(JSON.stringify(c)).not.toMatch(/BGN|лв/)

    // No admin photo, so no hero photo: the hero is the copy and the card. The pictures on
    // the page are the five stages, each once, and nothing else.
    expect(container.querySelector('.pp-hero img')).toBeNull()
    const keys = [...container.querySelectorAll('img')].map((img) => pictureKey(img.getAttribute('src')))
    expect(keys).toEqual(STAGE_PICTURES)

    // Everything is in the page as rendered: no carousel, no tooltips, no hidden panels, no
    // disclosure widgets but the questions (2026-10-17), and no Product markup for a line that
    // has no price: its one block is the questions' FAQPage, every one of them the page's own.
    expect(container.querySelector('[aria-roledescription]')).toBeNull()
    expect(container.querySelector('[title]')).toBeNull()
    expect(container.querySelector('[hidden]')).toBeNull()
    const details = [...container.querySelectorAll('details')]
    expect(details.map((d) => d.id)).toEqual(c.faq.items.map((item) => `q-${item.id}`))
    for (const d of details) expect(d.closest('#questions .pp-faq')).not.toBeNull()
    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map((el) => JSON.parse(el.textContent))
    expect(blocks.map((b) => b['@type'])).toEqual(['FAQPage'])
    expect(blocks[0].mainEntity.map((e) => e.name)).toEqual(c.faq.items.map((item) => item.q))
    unmount()
  })

  it('uses the admin photo when one is set, with the page alt when its own is empty', async () => {
    photosBody = { hero: [], models: {}, pages: { modularBuilds: null, modularHouses: null, steelHouses: { url: '/api/img/home/steel-1.webp', alt: '' } } }
    const { container, unmount } = renderPage(locale)

    await waitFor(() => expect(container.querySelector('.pp-hero-media img')).not.toBeNull())
    const img = container.querySelector('.pp-hero-media img')
    expect(img.getAttribute('src')).toContain('/api/img/home/steel-1.webp')
    expect(img).toHaveAttribute('alt', c.hero.photoAlt)
    // The card stays in the hero beside it.
    expect(container.querySelector('.pp-hero .pp-decide')).not.toBeNull()
    unmount()
  })

  it('uses the admin\'s own alt on the Bulgarian page only, since it is typed in Bulgarian', async () => {
    photosBody = { hero: [], models: {}, pages: { steelHouses: { url: '/api/img/home/steel-1.webp', alt: 'Стоманена къща' } } }
    const { container, unmount } = renderPage(locale)
    await waitFor(() => expect(container.querySelector('.pp-hero-media img')).not.toBeNull())
    expect(container.querySelector('.pp-hero-media img')).toHaveAttribute('alt', locale === 'bg' ? 'Стоманена къща' : c.hero.photoAlt)
    unmount()
  })

  it('draws no photo while the answer is on its way, and the admin\'s from the first render once one is kept', async () => {
    photosBody = { hero: [], models: {}, pages: { steelHouses: { url: '/api/img/home/steel-1.webp', alt: '' } } }
    // Nothing kept: the first render holds the photo back rather than insert it later.
    const first = renderPage(locale)
    expect(first.container.querySelector('.pp-hero-media')).toBeNull()
    await waitFor(() => expect(first.container.querySelector('.pp-hero-media img')).not.toBeNull())
    first.unmount()

    // Kept (from the snapshot's <head>, or an earlier answer): there from the start.
    await fetchHomePhotos()
    const second = renderPage(locale)
    expect(second.container.querySelector('.pp-hero-media img').getAttribute('src')).toContain('/api/img/home/steel-1.webp')
    second.unmount()
  })
})

describe.each(['en', 'el'])('no Cyrillic on the %s page', (locale) => {
  it('in the content file or the rendered page', async () => {
    expect(JSON.stringify(CONTENT[locale])).not.toMatch(CYRILLIC)
    const { container, unmount } = await renderLoaded(locale)
    expect(container.textContent).not.toMatch(CYRILLIC)
    unmount()
  })
})

describe('the three locales', () => {
  it('say the same things: same keys, same number of items, routes, steps and pictures', () => {
    const shape = (value) => (Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, shape(value[k])]))
        : typeof value)
    expect(shape(en)).toEqual(shape(bg))
    expect(shape(el)).toEqual(shape(bg))
  })

  it('show the same pictures in the same order, so a caption cannot sit on another picture', () => {
    for (const c of [bg, en, el]) {
      expect(c.process.steps.map((s) => pictureKey(s.image.src))).toEqual(STAGE_PICTURES)
    }
  })

  it('leave no old steel figures in the site dictionaries either', () => {
    // The old page's words (2.1 mm steel, up to 5 bedrooms, fixed facade and insulation)
    // lived in translations.js long after nothing read them, and shipped in the main bundle.
    for (const dict of Object.values(dictionaries)) {
      expect(dict.steel).toBeUndefined()
      expect(JSON.stringify(dict)).not.toMatch(/\b2[.,]1\s*(mm|мм)|up to 5|до 5/i)
    }
  })

  it('names the Bulgarian page as the plan says', () => {
    expect(bg.hero.h1).toBe('Сглобяеми къщи със стоманена конструкция')
    expect(bg.hero.eyebrow).toBe('По ваш проект')
    expect(bg.hero.cta).toBe('Поискайте оферта по проект')
    // The frame is the one constant, and galvanised is what the site has always said.
    expect(bg.decide.frameLabel).toBe('Конструкция')
    expect(bg.decide.frame).toContain('поцинкована')
    expect(bg.process.steps.map((s) => s.title)).toEqual([
      'Проектиране и разпределение',
      'Конструктивни чертежи и детайли',
      'Производство и довършителни работи',
      'Доставка и митница',
      'Монтаж на място и предаване',
    ])
    expect(JSON.stringify(bg)).not.toMatch(/обков/)
    // No stray Latin in the Bulgarian words: every string but the picture paths, the route keys
    // links name their page by, the sections they open and the questions' ids.
    const words = (value) => (typeof value === 'string'
      ? [value]
      : Object.entries(value || {}).flatMap(([key, v]) => (['src', 'pathKey', 'id', 'hash'].includes(key) ? [] : words(v))))
    expect(words(bg).filter((text) => /[A-Za-z]{2,}/.test(text.replace(/\{\w+\}/g, '')))).toEqual([])
  })
})
