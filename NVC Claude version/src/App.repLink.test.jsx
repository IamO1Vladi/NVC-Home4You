import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { MotionGlobalConfig } from 'framer-motion'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { getHomeContent } from './content/home/index.js'
import { paths } from './routes/paths.js'
import { _resetSubmissions } from './lib/backgroundSubmit.js'
import { REP_KEY, loadRep } from './lib/repAttribution.js'

// A representative's link (ROADMAP #38), walked through the real App: /r/{slug} remembers
// the slug, and every enquiry the visitor then sends — from the page's own button, from
// another page later — carries it to the server, together with the honeypot field the
// server uses to drop bots. The server does the attribution; what the browser owes it is
// the slug on every request, and an empty honeypot on every human one.
//
// Same harness as App.galleryEnquiry.test.jsx: BrowserRouter on jsdom's own history, the
// offer form's own labels, and the request body captured from the fetch stub.

const BG = getHomeContent('bg')
const EN = getHomeContent('en')

// What the page says (RepresentativePage.jsx), in the two languages the tests read.
const PAGE = {
  bg: { offer: 'Поискай оферта', configurator: 'Отвори конфигуратора' },
  en: { offer: 'Request an offer', configurator: 'Open the configurator' },
}

// Lazy routes compile on first use, and the language settles a render after the path.
const SLOW = { timeout: 10000 }

const json = (body, code = 200) => Promise.resolve({
  ok: code >= 200 && code < 300,
  status: code,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

let offers = []
let questions = []

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
  questions = []
  _resetSubmissions()
  localStorage.removeItem(REP_KEY)
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
  vi.stubGlobal('fetch', vi.fn((url, init) => {
    const u = String(url)
    if (u.endsWith('/api/offer')) {
      offers.push(JSON.parse(init.body))
      return json({ ok: true })
    }
    if (u.endsWith('/api/question')) {
      questions.push(JSON.parse(init.body))
      return json({ ok: true })
    }
    // The representatives' panel asks its API the moment it mounts. This visitor is signed
    // out, so the answer is 401 and the panel shows its sign-in card — the same as /admin.
    if (u.includes('/api/rep/') || u.includes('/api/admin/')) return json({}, 401)
    return json({})
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  // The language and the representative are remembered in localStorage, so they would
  // carry into the next test.
  localStorage.removeItem('lang')
  localStorage.removeItem(REP_KEY)
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

/** The representative page's own primary button, once the lazy route has rendered. */
const findOfferButton = (copy) => screen.findByRole('button', { name: copy.offer }, SLOW)

describe('a representative link', () => {
  it('remembers the slug and sends it with an offer requested from the page', async () => {
    const user = userEvent.setup()
    renderAppAt('/r/dtodorov?lang=bg')

    // ?lang=bg is applied as the site language: the page, and the form it opens, read Bulgarian.
    const offerButton = await findOfferButton(PAGE.bg)
    expect(screen.getByRole('link', { name: PAGE.bg.configurator })).toHaveAttribute('href', paths.boxConfigurator.bg)
    expect(loadRep()).toBe('dtodorov')

    await user.click(offerButton)
    await fillAndSend(user, BG)

    await waitFor(() => expect(offers).toHaveLength(1))
    expect(offers[0]).toMatchObject({
      name: 'Ivan Petrov',
      email: 'ivan@example.com',
      locale: 'bg',
      rep: 'dtodorov',
      website: '',
    })
  }, 30000)

  it('stores nothing for a slug the registry could never hold, and still offers the form', async () => {
    renderAppAt('/r/not a slug!')

    await findOfferButton(PAGE.en)
    expect(screen.getByRole('link', { name: PAGE.en.configurator })).toHaveAttribute('href', paths.boxConfigurator.en)
    expect(localStorage.getItem(REP_KEY)).toBeNull()
    expect(loadRep()).toBeNull()
  }, 30000)

  it('still carries the slug on an offer made later, from the configurator the page links to', async () => {
    const user = userEvent.setup()
    renderAppAt('/r/dtodorov?lang=bg')

    await user.click(await screen.findByRole('link', { name: PAGE.bg.configurator }, SLOW))
    await waitFor(() => expect(currentPath()).toBe(paths.boxConfigurator.bg))

    // The configurator opens the same site-wide form the header does (useModalActions), so
    // the header's button on the configurator route is the same path an enquiry takes.
    await user.click((await screen.findAllByRole('button', { name: BG.header.nav.quote }, SLOW))[0])
    await fillAndSend(user, BG)

    await waitFor(() => expect(offers).toHaveLength(1))
    expect(offers[0]).toMatchObject({ rep: 'dtodorov', website: '' })
  }, 30000)

  it('carries the slug on a question too, asked from the homepage after the visit', async () => {
    const user = userEvent.setup()
    renderAppAt('/r/dtodorov?lang=bg')
    await findOfferButton(PAGE.bg)

    // The visitor moves on to the homepage, as a browser does: a new history entry and the
    // popstate BrowserRouter listens for.
    act(() => {
      window.history.pushState(null, '', paths.home.bg)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await user.click((await screen.findAllByRole('button', { name: BG.home.hero.secondaryCta }, SLOW))[0])

    const dialog = screen.getByRole('dialog', { name: BG.forms.question.title })
    await user.type(within(dialog).getByPlaceholderText(BG.forms.question.fields.name), 'Ivan Petrov')
    await user.type(within(dialog).getByPlaceholderText(BG.forms.question.fields.email), 'ivan@example.com')
    await user.type(within(dialog).getByPlaceholderText(BG.forms.question.fields.question), 'How long is delivery?')
    await user.click(within(dialog).getByRole('button', { name: BG.forms.question.submit }))

    await waitFor(() => expect(questions).toHaveLength(1))
    expect(questions[0]).toMatchObject({ locale: 'bg', rep: 'dtodorov', website: '' })
  }, 30000)

  it('keeps the honeypot out of reach of a visitor, and sends whatever a bot puts in it', async () => {
    const user = userEvent.setup()
    renderAppAt('/r/dtodorov?lang=bg')

    await user.click(await findOfferButton(PAGE.bg))
    const dialog = offerDialog(BG)

    // No human can reach it: off-screen, out of the tab order, hidden from assistive tech,
    // and never display:none (the better bots skip fields the browser would not render).
    const trap = dialog.querySelector('input[name="website"]')
    expect(trap).not.toBeNull()
    expect(trap.tabIndex).toBe(-1)
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(trap.closest('[aria-hidden="true"]').style.display).not.toBe('none')
    expect(within(dialog).queryByRole('textbox', { name: /website/i })).toBeNull()

    // A form-filler fills every field it finds.
    fireEvent.change(trap, { target: { value: 'http://spam.example' } })
    await fillAndSend(user, BG)

    await waitFor(() => expect(offers).toHaveLength(1))
    expect(offers[0]).toMatchObject({ rep: 'dtodorov', website: 'http://spam.example' })
  }, 30000)

  it('sends no slug when the visit was not through a link', async () => {
    const user = userEvent.setup()
    renderAppAt(paths.prices.en)

    await user.click((await screen.findAllByRole('button', { name: EN.header.nav.quote }, SLOW))[0])
    await fillAndSend(user, EN)

    await waitFor(() => expect(offers).toHaveLength(1))
    expect(offers[0]).toMatchObject({ rep: '', website: '' })
  }, 30000)

  it('renders the representatives panel (/rep/) without the marketing chrome, like /admin', async () => {
    renderAppAt('/rep/leads')

    // Signed out, so what the panel shows is its sign-in card — and around it the header
    // and its offer button are staff-side absent.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Необходим е вход' })).toBeInTheDocument(), SLOW)
    expect(screen.queryByRole('button', { name: EN.header.nav.quote })).toBeNull()
    expect(screen.queryByRole('button', { name: BG.header.nav.quote })).toBeNull()
  }, 30000)
})
