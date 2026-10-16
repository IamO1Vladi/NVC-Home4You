import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import PartnerPage from './PartnerPage.jsx'
import bgContent from '../content/bg/partner.js'
import enContent from '../content/en/partner.js'
import elContent from '../content/el/partner.js'
import { paths } from '../routes/paths.js'
import { forgetHomePhotos } from '../lib/homePhotos.js'

// The partner page has no map. Its route map (the old Leaflet widget: routes from Ho Chi Minh and
// Laem Chabang besides Shanghai, against "our factory in China", and a repeat of the hero's
// journey) was removed on 2026-10-16 at the owner's word. Leaflet stays a dependency, for the
// delivery calculator's map alone, so what this file pins is that nothing on the partner page
// asks for it: not with the page, not as the bottom of the page comes near the screen, not on a
// phone, not from the cargo card's question. A file of its own because asking for Leaflet here
// throws: a static import anywhere under PartnerPage fails this file outright, a lazy one is
// recorded in `asked`.

const asked = vi.hoisted(() => [])
vi.mock('leaflet', () => {
  asked.push('leaflet')
  throw new Error('the partner page asked for Leaflet')
})
vi.mock('react-leaflet', () => {
  asked.push('react-leaflet')
  throw new Error('the partner page asked for react-leaflet')
})

vi.mock('../lib/productRows.js', async (importOriginal) => ({
  ...(await importOriginal()),
  useProductRows: () => ({ wagon: [], box: [], loading: false, error: null, items: [], galleryPath: '/bg/galeriq' }),
}))

const CONTENT = { bg: bgContent, en: enContent, el: elContent }

let observers = []
class FakeObserver {
  constructor(callback) { this.callback = callback; this.targets = []; observers.push(this) }
  observe(el) { this.targets.push(el) }
  unobserve() {}
  disconnect() { this.targets = [] }
}

function stubMatchMedia(phone) {
  // Reduced motion, so the hero's journey stands still while every observer fires.
  vi.stubGlobal('matchMedia', (query) => ({
    matches: query.includes('prefers-reduced-motion') || (phone && query.includes('max-width')),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
}

const openQuestion = vi.fn()

beforeEach(() => {
  asked.length = 0
  observers = []
  forgetHomePhotos()
  window.sessionStorage.clear()
  openQuestion.mockClear()
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it.each([
  ['bg', false], ['en', false], ['el', false],
  ['bg', true], ['en', true], ['el', true],
])('never asks for Leaflet (%s, phone: %s)', async (locale, phone) => {
  stubMatchMedia(phone)
  const c = CONTENT[locale]
  const { container } = render(
    <MemoryRouter initialEntries={[paths.partner[locale]]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={openQuestion}>
        <PartnerPage locale={locale} content={c} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )

  // Everything the page watches comes into view, as a visitor scrolling to the bottom would.
  act(() => {
    for (const o of observers) {
      if (o.targets.length) o.callback(o.targets.map((target) => ({ target, isIntersecting: true })), o)
    }
  })
  const cargo = container.querySelector('#ptn-cargo')
  fireEvent.click(within(cargo).getByRole('button', { name: c.cargo.ask }))
  expect(openQuestion).toHaveBeenCalledTimes(1)
  await act(async () => {})
  await waitFor(() => expect(container.querySelector('#ptn-faq .pp-faq-item')).not.toBeNull())

  expect(asked).toEqual([])
  expect(container.querySelector('.leaflet-container, .ptn-map')).toBeNull()
  // The page around it is whole: the hero, the form, the questions, the cargo card.
  expect(container.querySelector('h1').textContent).toBe(c.hero.h1)
  expect(container.querySelector('section#zapitvane form')).not.toBeNull()
  expect(cargo.querySelector('.hp-card.ptn-cargo h2').textContent).toBe(c.cargo.heading)
})
