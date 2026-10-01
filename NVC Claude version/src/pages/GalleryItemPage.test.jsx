import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import GalleryRoutes from '../routes/gallery/GalleryRoutes.jsx'
import elGallery from '../content/el/gallery.js'
import enGallery from '../content/en/gallery.js'

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
  coverUrl: 'https://img.example/cover.webp',
  images: ['https://img.example/cover.webp'],
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
})
