import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import GalleryRoutes from '../routes/gallery/GalleryRoutes.jsx'
import elGallery from '../content/el/gallery.js'
import enGallery from '../content/en/gallery.js'
import { paths } from '../routes/paths.js'
import { getRouteSeo } from '../seo/routeMeta.js'

// The gallery product page in the visitor's language (Greek audit, #11): the category under
// the title and in the Product JSON-LD used to be the API's raw key ("MODULAR" once CSS
// upper-cased it), the price was formatted the English way on /el ("€14,840", which a
// Greek reader can take for fourteen euros), and the Greek index announced itself to
// link previews as bg_BG.

const ITEM = {
  id: 7,
  slug: 'test-house',
  title: 'Modular house 37 m²',
  titleEl: 'Δομικό σπίτι 37 m²',
  description: '<p>A house.</p>',
  descriptionEl: '<p>Ένα σπίτι.</p>',
  price: 14840,
  currency: 'EUR',
  category: 'modular',
  // Site-relative, as /api/gallery serves them: an absolute fixture hid that the Product markup
  // published them relative.
  coverUrl: '/api/img/gallery/7/cover.webp',
  images: ['/api/img/gallery/7/cover.webp', '/api/img/gallery/7/inside.webp'],
}

const ROUTES = {
  el: { content: elGallery, base: '/el/gkaleri', home: 'https://nvc-home4you.eu/el' },
  en: { content: enGallery, base: '/en/gallery', home: 'https://nvc-home4you.eu/en' },
}

function renderGallery(locale, path) {
  const { content, base, home } = ROUTES[locale]
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path={`${base}/*`}
            element={<GalleryRoutes locale={locale} content={content} basePath={`https://nvc-home4you.eu${base}`} homeUrl={home} />}
          />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
}

function productJsonLd() {
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')]
  return scripts.map((s) => JSON.parse(s.textContent)).find((data) => data['@type'] === 'Product')
}

describe('gallery product page', () => {
  beforeEach(() => {
    // galleryUtils caches the first response for the session, so every test serves the
    // same list; this only matters for the first one.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [ITEM] }) }))
  })

  it('names the category in Greek under the title, not the API key', async () => {
    const { container } = renderGallery('el', '/el/gkaleri/test-house')

    expect(await screen.findByRole('heading', { name: 'Δομικό σπίτι 37 m²' })).toBeInTheDocument()
    expect(container.querySelector('.gdetail-kicker')).toHaveTextContent('Δομικό σπίτι')
    expect(container.querySelector('.gdetail-kicker')).not.toHaveTextContent(/modular/i)
  })

  it('formats a Greek price the Greek way', async () => {
    const { container } = renderGallery('el', '/el/gkaleri/test-house')

    await screen.findByRole('heading', { name: 'Δομικό σπίτι 37 m²' })
    expect(container.querySelector('.gdetail-price').textContent.replace(/\s/g, ' ')).toBe('Από 14.840 €')
  })

  it('keeps the English price exactly as it was', async () => {
    const { container } = renderGallery('en', '/en/gallery/test-house')

    await screen.findByRole('heading', { name: 'Modular house 37 m²' })
    expect(container.querySelector('.gdetail-price')).toHaveTextContent(`${enGallery.detail.pricePrefix}€14,840`)
    expect(container.querySelector('.gdetail-kicker')).toHaveTextContent('Modular house')
  })

  it('gives the Product JSON-LD the Greek category too', async () => {
    renderGallery('el', '/el/gkaleri/test-house')

    await screen.findByRole('heading', { name: 'Δομικό σπίτι 37 m²' })
    expect(productJsonLd().category).toBe('Δομικό σπίτι')
  })

  // The route gets the gallery's ABSOLUTE production URL as its base (the breadcrumbs' markup
  // needs it), and the back link used to be a <Link> to it: on any other host (the dev server,
  // a preview) it sent the visitor to production. It is the router path now.
  it.each([
    ['el', '/el/gkaleri/test-house', 'Δομικό σπίτι 37 m²'],
    ['en', '/en/gallery/test-house', 'Modular house 37 m²'],
  ])('%s: the back link is the relative gallery path', async (locale, path, title) => {
    const { container } = renderGallery(locale, path)

    await screen.findByRole('heading', { name: title })
    const back = container.querySelector('.gdetail-back')
    expect(back).toHaveAttribute('href', ROUTES[locale].base)
    expect(back.getAttribute('href')).not.toMatch(/^https?:/)
    // The breadcrumbs keep the absolute URL.
    const crumbs = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent)).find((d) => d['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.map((i) => i.item)).toContain(`https://nvc-home4you.eu${ROUTES[locale].base}`)
  })

  it.each([
    ['el', '/el/gkaleri/test-house', 'Δομικό σπίτι 37 m²', elGallery],
    ['en', '/en/gallery/test-house', 'Modular house 37 m²', enGallery],
  ])('%s: links on to its product page, its prices row and the Box delivery', async (locale, path, title, content) => {
    const { container } = renderGallery(locale, path)

    await screen.findByRole('heading', { name: title })
    const more = container.querySelector('.gdetail-more')
    expect(within(more).getByRole('heading', { name: content.detail.links.heading })).toBeInTheDocument()
    const links = within(more).getAllByRole('link')
    // Gallery id 7 here is a modular house the configurator does not build: no ?model= link.
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      paths.modularHouses[locale],
      `${paths.prices[locale]}#item-7`,
      `${paths.delivery[locale]}?product=box`,
    ])
    // Its prices row has no assembly figure (id 7 has none mapped), so the link does not say
    // "with assembly".
    expect(links.map((a) => a.textContent)).toEqual([
      content.detail.links.box,
      content.detail.links.pricesNoAssembly,
      content.detail.links.delivery,
    ])
  })
})

describe('gallery product page: head, outline and markup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [ITEM] }) }))
  })

  const head = (selector) => document.head.querySelector(selector)

  it('labels the description with an h2, between the h1 and the description\'s own h3s', async () => {
    renderGallery('en', '/en/gallery/test-house')

    await screen.findByRole('heading', { level: 1, name: 'Modular house 37 m²' })
    expect(screen.getByRole('heading', { level: 2, name: enGallery.detail.descriptionTitle })).toBeInTheDocument()
  })

  it('heads the page as the product: its canonical, og:type product and its own photo', async () => {
    renderGallery('en', '/en/gallery/test-house')

    await screen.findByRole('heading', { level: 1, name: 'Modular house 37 m²' })
    await waitFor(() => expect(head('meta[property="og:type"]')).toHaveAttribute('content', 'product'))
    expect(head('link[rel="canonical"]')).toHaveAttribute('href', 'https://nvc-home4you.eu/en/gallery/test-house')
    expect(head('meta[name="robots"]').getAttribute('content')).toMatch(/^index/)
    expect(head('meta[property="og:image"]')).toHaveAttribute('content', 'https://nvc-home4you.eu/api/img/gallery/7/cover.webp')
    // Its size is not known here, so none is claimed.
    expect(head('meta[property="og:image:width"]')).toBeNull()
    expect(head('meta[name="description"]')).toHaveAttribute('content', 'A house.')
  })

  it('marks it up as made to order, with absolute photos and the gal-<id> sku the product pages use', async () => {
    renderGallery('en', '/en/gallery/test-house')

    await screen.findByRole('heading', { level: 1, name: 'Modular house 37 m²' })
    const product = productJsonLd()
    expect(product.sku).toBe('gal-7')
    expect(product.offers.availability).toBe('https://schema.org/MadeToOrder')
    expect(product.image).toEqual([
      'https://nvc-home4you.eu/api/img/gallery/7/cover.webp',
      'https://nvc-home4you.eu/api/img/gallery/7/inside.webp',
    ])
  })

  it('a model the gallery does not hold is noindex', async () => {
    renderGallery('en', '/en/gallery/no-such-house')

    await screen.findByRole('heading', { level: 1, name: enGallery.detail.notFoundTitle })
    await waitFor(() => expect(head('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow'))
    expect(head('link[rel="canonical"]')).toBeNull()
  })
})

describe('gallery index', () => {
  it('declares the Greek Open Graph locale and offers the Greek alternate', async () => {
    renderGallery('el', '/el/gkaleri')

    await waitFor(() =>
      expect(document.head.querySelector('meta[property="og:locale"]')).toHaveAttribute('content', 'el_GR'),
    )
    expect(document.head.querySelector('link[rel="alternate"][hreflang="el"]'))
      .toHaveAttribute('href', 'https://nvc-home4you.eu/el/gkaleri')
  })

  // routeMeta.js's head, as on every other route: the x-default the route's own list left out,
  // and the bare gallery URL as the canonical whatever the query (a filter, a tracking tag).
  it('canonicals a filtered or tagged URL to the bare gallery, with the full hreflang cluster', async () => {
    renderGallery('en', '/en/gallery?cat=wagon&utm_source=fb')

    await waitFor(() =>
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://nvc-home4you.eu/en/gallery'),
    )
    expect(document.head.querySelector('meta[property="og:url"]')).toHaveAttribute('content', 'https://nvc-home4you.eu/en/gallery')
    expect(document.head.querySelector('link[rel="alternate"][hreflang="x-default"]'))
      .toHaveAttribute('href', 'https://nvc-home4you.eu/en/gallery')
    expect(document.title).toBe(getRouteSeo(paths.gallery.en, 'en').title)
  })
})
