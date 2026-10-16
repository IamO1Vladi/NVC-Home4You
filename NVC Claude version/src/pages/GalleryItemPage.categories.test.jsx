import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import GalleryRoutes from '../routes/gallery/GalleryRoutes.jsx'
import bgGallery from '../content/bg/gallery.js'
import enGallery from '../content/en/gallery.js'
import { paths } from '../routes/paths.js'

// The gallery product page for the owner's two new sections (2026-10-17).
//
// - The space capsule is filed under "modular" today and moves to its own "capsule" category
//   once staff move it in the admin panel. Its page must read the same either way: its
//   category's name, its links (its own card on the Box houses page, its prices row, the Box
//   delivery) and an offer made to order. The two states are served side by side here as two
//   items with the same id and different slugs (galleryUtils caches the first list for the
//   visit, so one list serves the whole file).
// - "prefab" now holds the steel-frame projects already built. Every steel house is its own
//   project, priced per project (the owner), so such a page shows the project's price without
//   "from", or "priced per project" with none, links to the steel-frame houses page, and asks
//   for an offer for a house like it.

const base = (over) => ({
  currency: 'EUR',
  description: '<p>A house.</p>',
  descriptionBg: '<p>Къща.</p>',
  coverUrl: `/api/img/gallery/${over.id}/cover.webp`,
  images: [`/api/img/gallery/${over.id}/cover.webp`],
  ...over,
})

const CAPSULE_A = base({ id: 100015, slug: 'capsule-a', title: 'Space house', titleBg: 'Космическа къща – капсула', price: 55000, category: 'modular' })
const CAPSULE_B = base({ ...CAPSULE_A, slug: 'capsule-b', category: 'capsule' })
const PROJECT = base({ id: 100020, slug: 'project', title: 'Steel-frame house – Bansko', titleBg: 'Къща на метална конструкция – Банско', price: 42000, category: 'prefab' })
const PROJECT_NO_PRICE = base({ id: 100021, slug: 'project-no-price', title: 'Steel-frame house – Plovdiv', titleBg: 'Къща на метална конструкция – Пловдив', category: 'prefab' })

const ROUTES = {
  bg: { content: bgGallery, base: '/bg/galeriq', home: 'https://nvc-home4you.eu/bg' },
  en: { content: enGallery, base: '/en/gallery', home: 'https://nvc-home4you.eu/en' },
}

function renderItem(locale, slug, onRequestModel = vi.fn()) {
  const { content, base: path, home } = ROUTES[locale]
  const view = render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`${path}/${slug}`]}>
        <Routes>
          <Route
            path={`${path}/*`}
            element={<GalleryRoutes locale={locale} content={content} basePath={`https://nvc-home4you.eu${path}`} homeUrl={home} onRequestModel={onRequestModel} />}
          />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
  return { ...view, onRequestModel }
}

const productJsonLd = () => [...document.querySelectorAll('script[type="application/ld+json"]')]
  .map((s) => JSON.parse(s.textContent))
  .find((data) => data['@type'] === 'Product')

const moreLinks = (container) => within(container.querySelector('.gdetail-more')).getAllByRole('link')
  .map((a) => ({ to: a.getAttribute('href'), label: a.textContent }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ items: [CAPSULE_A, CAPSULE_B, PROJECT, PROJECT_NO_PRICE] }),
  }))
})

describe('the capsule\'s page, before and after staff move it', () => {
  it.each([
    ['bg', 'capsule-a', 'Модулна къща'],
    ['bg', 'capsule-b', 'Космическа капсула'],
    ['en', 'capsule-a', 'Modular house'],
    ['en', 'capsule-b', 'Space capsule'],
  ])('%s %s: names its category and links to its own card on the Box houses page', async (locale, slug, category) => {
    const { content } = ROUTES[locale]
    const title = locale === 'bg' ? CAPSULE_A.titleBg : CAPSULE_A.title
    const { container } = renderItem(locale, slug)

    await screen.findByRole('heading', { level: 1, name: title })
    expect(container.querySelector('.gdetail-kicker')).toHaveTextContent(category)
    expect(moreLinks(container)).toEqual([
      { to: `${paths.modularHouses[locale]}#item-100015`, label: content.detail.links.capsule },
      { to: `${paths.prices[locale]}#item-100015`, label: content.detail.links.pricesNoAssembly },
      { to: `${paths.delivery[locale]}?product=box`, label: content.detail.links.delivery },
    ])
    // Its price reads as before: a model's price, from.
    expect(container.querySelector('.gdetail-price')).toHaveTextContent(content.detail.pricePrefix.trim())
    expect(screen.getByRole('button', { name: content.detail.requestCta })).toBeInTheDocument()

    const product = productJsonLd()
    expect(product.category).toBe(category)
    expect(product.offers.availability).toBe('https://schema.org/MadeToOrder')
  })

  it('asks for an offer for the capsule itself, not for one like it', async () => {
    const { onRequestModel } = renderItem('bg', 'capsule-b')
    fireEvent.click(await screen.findByRole('button', { name: bgGallery.detail.requestCta }))
    expect(onRequestModel).toHaveBeenCalledTimes(1)
    expect(onRequestModel.mock.calls[0][0]).not.toHaveProperty('like')
    expect(onRequestModel.mock.calls[0][0]).toMatchObject({ id: 100015, titleBg: CAPSULE_A.titleBg })
  })
})

describe('a steel-frame project\'s page (prefab)', () => {
  it.each(['bg', 'en'])('%s: shows the project\'s price, without "from", as this project\'s', async (locale) => {
    const { content } = ROUTES[locale]
    const { container } = renderItem(locale, 'project')

    await screen.findByRole('heading', { level: 1, name: locale === 'bg' ? PROJECT.titleBg : PROJECT.title })
    const price = container.querySelector('.gdetail-price').textContent.replace(/\s/g, ' ')
    expect(price).toBe(content.detail.projectPrice.replace('{price}', locale === 'bg' ? '42 000 €' : '€42,000'))
    expect(price.startsWith(content.detail.pricePrefix)).toBe(false)
    expect(container.querySelector('.gdetail-kicker')).toHaveTextContent(content.filters.categories.prefab)
  })

  it.each(['bg', 'en'])('%s: links to the steel-frame houses page and the project delivery, and to no prices row', async (locale) => {
    const { content } = ROUTES[locale]
    const { container } = renderItem(locale, 'project')

    await screen.findByRole('heading', { level: 1 })
    expect(moreLinks(container)).toEqual([
      { to: paths.steelHouses[locale], label: content.detail.links.steel },
      { to: `${paths.delivery[locale]}?product=project`, label: content.detail.links.deliveryProject },
    ])
  })

  it('with no price: priced per project, and no offer in the markup', async () => {
    const { container } = renderItem('bg', 'project-no-price')

    await screen.findByRole('heading', { level: 1, name: PROJECT_NO_PRICE.titleBg })
    expect(container.querySelector('.gdetail-price')).toHaveTextContent(bgGallery.detail.priceByProject)
    expect(container.querySelector('.gdetail-price')).not.toHaveTextContent(bgGallery.detail.priceOnRequest)
    expect(productJsonLd().offers).toBeUndefined()
  })

  it('gives a priced project no offer in the markup: its price is that one project\'s, a house like it is priced per project', async () => {
    const { container } = renderItem('en', 'project')
    await screen.findByRole('heading', { level: 1, name: PROJECT.title })
    // The page still shows the project's price; only the markup leaves it out.
    expect(container.querySelector('.gdetail-price')).toHaveTextContent('€42,000')
    const product = productJsonLd()
    expect(product.category).toBe(enGallery.filters.categories.prefab)
    expect(product.offers).toBeUndefined()
  })

  it.each(['bg', 'en'])('%s: asks for an offer for a house like it, naming the project for staff', async (locale) => {
    const { content } = ROUTES[locale]
    const { onRequestModel } = renderItem(locale, 'project')

    fireEvent.click(await screen.findByRole('button', { name: content.detail.requestLikeCta }))
    expect(onRequestModel).toHaveBeenCalledTimes(1)
    expect(onRequestModel.mock.calls[0][0]).toMatchObject({
      id: 100020,
      like: true,
      titleBg: PROJECT.titleBg,
      path: `${paths.gallery.bg}/project`,
    })
  })
})
