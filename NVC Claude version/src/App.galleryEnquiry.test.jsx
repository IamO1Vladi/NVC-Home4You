import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { MotionGlobalConfig } from 'framer-motion'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { getHomeContent } from './content/home/index.js'
import bgGallery from './content/bg/gallery.js'
import enGallery from './content/en/gallery.js'
import { paths } from './routes/paths.js'
import { _resetSubmissions } from './lib/backgroundSubmit.js'

// Sales could not tell which house a gallery "request an offer" enquiry was about
// (owner, 2026-10-02). Three things stood in the way, and this file walks the real App
// through each of them:
//
// - The product MODAL closes itself with navigate(-1) right after opening the offer form,
//   and App cleared the selected model on every pathname change, so the form posted an
//   empty modelId for nearly every enquiry made from the gallery.
// - Even when the id arrived it was not enough: on live an admin-created house and a
//   Quickbase one share public id 15. So the two items served below are id-twins with
//   different names, and the enquiry has to name the one that was actually opened, in
//   Bulgarian (staff read Bulgarian), with its Bulgarian page.
// - The product modal's cleanup unlocked the page scroll underneath the offer form that
//   had just locked it.
//
// BrowserRouter on jsdom's own history, deliberately not a MemoryRouter: jsdom runs
// history.go() a task later and fires popstate after it, as a browser does, so the product
// modal's navigate(-1) lands AFTER the offer form has opened. That ordering is the bug. A
// MemoryRouter navigates synchronously and folds both into one render, which hides the
// scroll half of it entirely.

const TWIN_QUICKBASE = {
  id: 15,
  title: 'Expandable house 73 m²',
  titleBg: 'Разгъваема къща 73 м²',
  description: '<p>Expandable.</p>',
  category: 'modular',
  catalogId: 'qb-15',
  coverUrl: 'https://img.example/expandable.webp',
  images: ['https://img.example/expandable.webp'],
}

// Listed second, so anything that looks the model up by id finds the other one.
const TWIN_ADMIN = {
  id: 15,
  title: 'Space house',
  titleBg: 'Космическа къща',
  description: '<p>A capsule.</p>',
  category: 'modular',
  coverUrl: 'https://img.example/space.webp',
  images: ['https://img.example/space.webp'],
}

const SPACE_HOUSE = {
  modelId: '15',
  modelTitle: 'Космическа къща',
  modelPath: '/bg/galeriq/космическа-къща',
}

const BG = getHomeContent('bg')
const EN = getHomeContent('en')

// Lazy routes compile on first use, and the language settles a render after the path.
const SLOW = { timeout: 10000 }

const json = (body) => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

let offers = []

beforeAll(() => {
  // The modals' enter and exit animations would otherwise keep a closed form in the DOM
  // for a moment, next to the one the test opens after it.
  MotionGlobalConfig.skipAnimations = true
})

afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})

beforeEach(() => {
  offers = []
  _resetSubmissions()
  document.body.style.overflow = ''
  // ThemeProvider and the header ask for media queries; jsdom has no matchMedia.
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })))
  vi.stubGlobal('scrollTo', vi.fn())
  // The index keys its cards by id, so the twins trip React's duplicate-key warning on every
  // render. The API stopped serving twins in #35 (an admin-created house is 100000 + its SQL
  // id now), but they stay here on purpose: the enquiry must name its model by title and
  // page, never by looking the id up, and two items sharing an id is how that is proven.
  const consoleError = console.error
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('Encountered two children with the same key')) return
    consoleError(...args)
  })
  vi.stubGlobal('fetch', vi.fn((url, init) => {
    const u = String(url)
    if (u.endsWith('/api/gallery')) return json({ items: [TWIN_QUICKBASE, TWIN_ADMIN] })
    if (u.endsWith('/api/offer')) {
      offers.push(JSON.parse(init.body))
      return json({ ok: true })
    }
    return json({})
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  // The language is remembered in localStorage, so it would carry into the next test.
  localStorage.removeItem('lang')
})

/** Renders the App with `entries` as the browser history, the last one current. */
function renderAppAt(...entries) {
  const [first, ...rest] = entries
  window.history.replaceState(null, '', first)
  rest.forEach((entry) => window.history.pushState(null, '', entry))
  return render(
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>,
  )
}

const currentPath = () => decodeURIComponent(window.location.pathname)

const offerDialog = (ui) => screen.getByRole('dialog', { name: ui.forms.offer.title })

async function fillAndSend(user, ui) {
  const dialog = offerDialog(ui)
  await user.type(within(dialog).getByPlaceholderText(ui.forms.offer.fields.name), 'Ivan Petrov')
  await user.type(within(dialog).getByPlaceholderText(ui.forms.offer.fields.email), 'ivan@example.com')
  await user.type(within(dialog).getByPlaceholderText(ui.forms.offer.fields.project), 'For a plot near Sofia.')
  await user.click(within(dialog).getByRole('button', { name: ui.forms.offer.submit }))
}

/**
 * From the Bulgarian gallery index: open the Space house card (the modal, the way nearly
 * every visitor reaches a model) and request an offer. Resolves once the product modal's
 * own back navigation has landed, which is the moment the model used to be lost.
 */
async function requestFromGalleryModal(user) {
  await user.click(await screen.findByRole('link', { name: /Космическа къща/ }, SLOW))
  await user.click(await screen.findByRole('button', { name: bgGallery.detail.requestCta }, SLOW))
  await waitFor(() => expect(currentPath()).toBe(paths.gallery.bg))
  await waitFor(() => expect(document.querySelector('.gmodal-portal')).toBeNull())
}

describe('a gallery offer request', () => {
  it('names the model opened in the gallery modal by its Bulgarian title and page, not its id-twin', async () => {
    const user = userEvent.setup()
    renderAppAt(paths.gallery.bg)

    await requestFromGalleryModal(user)

    expect(offerDialog(BG)).toHaveTextContent('Модел: Космическа къща')
    await fillAndSend(user, BG)

    await waitFor(() => expect(offers).toHaveLength(1))
    expect(offers[0]).toMatchObject({ ...SPACE_HOUSE, locale: 'bg' })
  }, 30000)

  it('does the same from the product page opened directly, in Bulgarian whatever the visitor reads', async () => {
    const user = userEvent.setup()
    renderAppAt(`${paths.gallery.en}/space-house`)

    await user.click(await screen.findByRole('button', { name: enGallery.detail.requestCta }, SLOW))

    // The visitor sees the model in their own language; the lead carries the Bulgarian one.
    expect(offerDialog(EN)).toHaveTextContent('Model: Space house')
    await fillAndSend(user, EN)

    await waitFor(() => expect(offers).toHaveLength(1))
    expect(offers[0]).toMatchObject({ ...SPACE_HOUSE, locale: 'en' })
  }, 30000)

  it('leaves no model on the generic offers made after it, on the same page or another', async () => {
    const user = userEvent.setup()
    renderAppAt(paths.gallery.bg)

    await requestFromGalleryModal(user)
    await fillAndSend(user, BG)
    await waitFor(() => expect(offers).toHaveLength(1))
    expect(offers[0]).toMatchObject(SPACE_HOUSE)

    // The same page first: nothing has navigated or closed the form since the send, so
    // only the send itself can have let go of the model.
    await user.click(screen.getAllByRole('button', { name: BG.header.nav.quote })[0])
    expect(offerDialog(BG)).not.toHaveTextContent('Модел')
    await user.click(within(offerDialog(BG)).getByRole('button', { name: BG.common.close }))

    await user.click(screen.getAllByRole('link', { name: BG.header.nav.prices })[0])
    await waitFor(() => expect(currentPath()).toBe(paths.prices.bg))
    await user.click(screen.getAllByRole('button', { name: BG.header.nav.quote })[0])

    expect(offerDialog(BG)).not.toHaveTextContent('Модел')
    await fillAndSend(user, BG)

    await waitFor(() => expect(offers).toHaveLength(2))
    expect(offers[1]).toMatchObject({ modelId: '', modelTitle: '', modelPath: '' })
  }, 30000)

  it('keeps the model when the visitor goes back with the form still open', async () => {
    const user = userEvent.setup()
    renderAppAt(paths.prices.bg, paths.gallery.bg)

    await requestFromGalleryModal(user)
    act(() => window.history.back())
    await waitFor(() => expect(currentPath()).toBe(paths.prices.bg))

    expect(offerDialog(BG)).toHaveTextContent('Модел: Космическа къща')
    await fillAndSend(user, BG)

    await waitFor(() => expect(offers).toHaveLength(1))
    expect(offers[0]).toMatchObject(SPACE_HOUSE)
  }, 30000)

  it('keeps the page locked behind the offer form the gallery modal handed over to', async () => {
    const user = userEvent.setup()
    renderAppAt(paths.gallery.bg)

    await requestFromGalleryModal(user)
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(within(offerDialog(BG)).getByRole('button', { name: BG.common.close }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: BG.forms.offer.title })).toBeNull())
    expect(document.body.style.overflow).toBe('')
  }, 30000)

  it('hands keyboard focus back to the gallery card when the offer form closes', async () => {
    // The form returns focus to whatever had it when it opened. That used to be the request
    // button inside the product modal, which navigate(-1) unmounts a moment later, so
    // closing the form dropped a keyboard user at the top of the page.
    const user = userEvent.setup()
    renderAppAt(paths.gallery.bg)

    const card = await screen.findByRole('link', { name: /Космическа къща/ }, SLOW)
    card.focus()
    await user.keyboard('{Enter}')
    const request = await screen.findByRole('button', { name: bgGallery.detail.requestCta }, SLOW)
    request.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(document.querySelector('.gmodal-portal')).toBeNull())

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: BG.forms.offer.title })).toBeNull())
    expect(card.isConnected).toBe(true)
    expect(document.activeElement).toBe(card)
  }, 30000)
})
