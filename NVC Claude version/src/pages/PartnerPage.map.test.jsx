import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import PartnerPage from './PartnerPage.jsx'
import bgContent from '../content/bg/partner.js'
import { paths } from '../routes/paths.js'
import { forgetHomePhotos } from '../lib/homePhotos.js'

// The route map's chunk failing to load (a phone losing the network, or a page left open across
// a publish, which rehashes every chunk) must cost the map alone, not the page and the form
// above it. A file of its own: React.lazy keeps the first answer for good, so the working map
// in PartnerPage.test.jsx and this failing one cannot share a module registry.

vi.mock('../components/LogisticsWorld.jsx', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

vi.mock('../lib/productRows.js', async (importOriginal) => ({
  ...(await importOriginal()),
  useProductRows: () => ({ wagon: [], box: [], loading: false, error: null, items: [], galleryPath: '/bg/galeriq' }),
}))

beforeEach(() => {
  forgetHomePhotos()
  window.sessionStorage.clear()
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('matchMedia', (query) => ({
    matches: query.includes('max-width: 767px'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })))
  // React reports the caught error; it is the expected one here.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('keeps the page and its form when the map cannot load', async () => {
  const { container } = render(
    <MemoryRouter initialEntries={[paths.partner.bg]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        <PartnerPage locale="bg" content={bgContent} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: bgContent.cargo.show }))

  expect(await screen.findByText(bgContent.cargo.unavailable, {}, { timeout: 4000 })).toBeInTheDocument()
  expect(container.querySelector('section#zapitvane form')).not.toBeNull()
  expect(container.querySelector('#ptn-faq .pp-faq-item')).not.toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: bgContent.hero.h1 })).toBeInTheDocument()
})
