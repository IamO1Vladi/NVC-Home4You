import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import GalleryRoutes from '../routes/gallery/GalleryRoutes.jsx'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import enGallery from '../content/en/gallery.js'
import { getItemSlug } from './galleryUtils.js'
import { titleNodes } from './GalleryItemView.jsx'
import { displayTitle } from '../lib/productRows.js'
import { paths } from '../routes/paths.js'

// The gallery model's page and its modal, redesigned 2026-10-17 as one view
// (GalleryItemView.jsx): the card's own price, the key facts, similar models, photos with
// keyboard and full-screen navigation, one H1 on the page and a labelled h2 in the modal, and a
// modal that keeps focus inside it and hands it back to the card.

const D = enGallery.detail
const imgs = (id, n) => Array.from({ length: n }, (_, i) => `/api/img/gallery/${id}/${i}.webp`)
const item = (over) => ({
  currency: 'EUR',
  description: '<p>A house.</p>',
  coverUrl: `/api/img/gallery/${over.id}/0.webp`,
  images: imgs(over.id, 1),
  ...over,
})

// The admin's text starts with its own "Description" heading, as the live containers' does.
const CONTAINER = item({
  id: 13,
  title: 'Living container - 6000*3000mm',
  price: 4300,
  category: 'wagon',
  images: imgs(13, 3),
  description: '<p><strong>Description</strong></p><p>The price includes assembly and VAT.</p><h3>Specifications</h3><p>Frame: 2.3 mm</p>',
})
const C6 = item({ id: 6, title: 'Living container - 7000*3000mm', price: 4800, category: 'wagon' })
const C12 = item({ id: 12, title: 'Office container - 6000*3000mm', price: 4950, category: 'wagon' })
const C14 = item({ id: 14, title: 'Decor container - 6000*3000mm', price: 5200, category: 'wagon' })
const C8 = item({ id: 8, title: 'Container house - 8000*3000mm', price: 6500, category: 'wagon' })
const BOX = item({ id: 10, title: 'Expandable house - 37 m²', price: 14000, category: 'modular', images: imgs(10, 2) })
const BOX_NO_ASSEMBLY = item({ id: 99, title: 'Expandable house - 12 m²', price: 9000, category: 'modular' })
const CAPSULE = item({ id: 100015, title: 'Space house', price: 55000, category: 'modular' })
const PROJECT = item({ id: 100017, title: 'Alpine house', price: 44780, category: 'prefab' })
const PROJECT_NO_PRICE = item({ id: 100021, title: 'Steel house - Plovdiv', category: 'prefab' })

const ITEMS = [CONTAINER, BOX, C8, C14, CAPSULE, C12, BOX_NO_ASSEMBLY, C6, PROJECT, PROJECT_NO_PRICE]
const BASE = '/en/gallery'
const slug = (it) => getItemSlug(it, 'en')

function renderAt(path, actions = {}) {
  const openQuestion = actions.openQuestion || vi.fn()
  const onRequestModel = actions.onRequestModel || vi.fn()
  const view = render(
    <HelmetProvider>
      <ModalActionsProvider onOpenOffer={vi.fn()} onOpenQuestion={openQuestion} onRequestModel={onRequestModel}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path={`${BASE}/*`}
              element={<GalleryRoutes locale="en" content={enGallery} basePath={`https://nvc-home4you.eu${BASE}`} homeUrl="https://nvc-home4you.eu/en" onRequestModel={onRequestModel} />}
            />
          </Routes>
        </MemoryRouter>
      </ModalActionsProvider>
    </HelmetProvider>,
  )
  return { ...view, openQuestion, onRequestModel }
}

const cardLink = (it) => document.querySelector(`a.gl-link[href="${BASE}/${slug(it)}"]`)
const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() ?? null
const jsonLd = () => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))

async function openModal(user, it) {
  renderAt(BASE)
  await waitFor(() => expect(cardLink(it)).not.toBeNull())
  const link = cardLink(it)
  await user.click(link)
  await waitFor(() => expect(document.querySelector('.gmodal-portal .gi-title')).not.toBeNull())
  return link
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: ITEMS }) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

describe('the price block is the gallery card\'s', () => {
  it.each([
    ['a container', CONTAINER, null],
    ['a Box house with its assembly figure', BOX, '+ assembly €840 incl. VAT'],
    ['a Box house the prices table has no assembly for', BOX_NO_ASSEMBLY, null],
    ['the capsule', CAPSULE, null],
    ['a priced steel-frame project', PROJECT, null],
    ['a steel-frame project with no price', PROJECT_NO_PRICE, null],
  ])('%s: the same figure and the same words as its card, and no "From"', async (_, it, extra) => {
    const index = renderAt(BASE)
    await waitFor(() => expect(cardLink(it)).not.toBeNull())
    const card = cardLink(it).closest('article')
    const cardPrice = text(card.querySelector('.gl-price'))
    const cardBasis = text(card.querySelector('.gl-basis'))
    index.unmount()

    const { container } = renderAt(`${BASE}/${slug(it)}`)
    await screen.findByRole('heading', { level: 1 })
    expect(text(container.querySelector('.gi-price'))).toBe(cardPrice)
    expect(text(container.querySelector('.gi-basis'))).toBe(cardBasis)
    expect(text(container.querySelector('.gi-extra'))).toBe(extra)
    expect(container.querySelector('.gi-cost')).not.toHaveTextContent(/^From/)
  })

  it('reads the words the cards use: a container\'s includes assembly, the capsule arrives ready, a project is that project\'s', async () => {
    const { container, unmount } = renderAt(`${BASE}/${slug(CONTAINER)}`)
    await screen.findByRole('heading', { level: 1 })
    expect(text(container.querySelector('.gi-cost'))).toBe(`€4,300 ${enGallery.card.basis.wagon}`)
    unmount()
    const capsule = renderAt(`${BASE}/${slug(CAPSULE)}`)
    await screen.findByRole('heading', { level: 1 })
    expect(text(capsule.container.querySelector('.gi-cost'))).toBe(`€55,000 ${enGallery.card.basis.ready}`)
    capsule.unmount()
    const project = renderAt(`${BASE}/${slug(PROJECT_NO_PRICE)}`)
    await screen.findByRole('heading', { level: 1 })
    expect(text(project.container.querySelector('.gi-cost'))).toBe(enGallery.card.basis.projectOnRequest)
  })
})

describe('the page', () => {
  it('has one H1, the cleaned title the card shows, the line\'s chip, breadcrumbs and the back link', async () => {
    const { container } = renderAt(`${BASE}/${slug(CONTAINER)}`)
    const h1 = await screen.findByRole('heading', { level: 1 })
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(text(h1)).toBe(text({ textContent: displayTitle(CONTAINER.title) }))
    expect(container.querySelector('.gi-chip')).toHaveTextContent(enGallery.filters.shown.wagon)

    const crumbs = screen.getByRole('navigation', { name: D.breadcrumbsAria })
    const links = within(crumbs).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/en', BASE])
    expect(within(crumbs).getByText(text({ textContent: displayTitle(CONTAINER.title) }), { normalizer: (s) => s.replace(/\s+/g, ' ').trim() }).closest('li')).toHaveAttribute('aria-current', 'page')
    expect(container.querySelector('.gdetail-back')).toHaveAttribute('href', BASE)
  })

  it('shows the key facts with the right calculator link', async () => {
    const { container } = renderAt(`${BASE}/${slug(CONTAINER)}`)
    await screen.findByRole('heading', { level: 1 })
    const facts = [...container.querySelectorAll('.gi-fact')].map((f) => f.getAttribute('data-fact'))
    expect(facts).toEqual(['lead', 'warranty', 'assembly', 'delivery'])
    const link = within(container.querySelector('[data-fact="delivery"]')).getByRole('link')
    expect(link).toHaveAttribute('href', `${paths.delivery.en}?product=container`)
  })

  it('heads the description once: the text\'s own "Description" goes, the page\'s h2 stays', async () => {
    const { container } = renderAt(`${BASE}/${slug(CONTAINER)}`)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByText(D.descriptionTitle)).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: D.descriptionTitle })).toBeInTheDocument()
    expect(container.querySelector('.gdetail-richtext').firstElementChild).toHaveTextContent('The price includes assembly and VAT.')
    // The text's own h3 sits under the page's h2.
    expect(screen.getByRole('heading', { level: 3, name: 'Specifications' })).toBeInTheDocument()
  })

  it('lists up to three similar models of the same line, the closest in price first, never itself', async () => {
    const { container } = renderAt(`${BASE}/${slug(CONTAINER)}`)
    await screen.findByRole('heading', { level: 1 })
    const similar = screen.getByRole('region', { name: D.similar.heading })
    const hrefs = within(similar).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([C6, C12, C14].map((it) => `${BASE}/${slug(it)}`))
    expect(container.querySelector('.gdetail-more')).not.toContainElement(similar)
  })

  it.each([['the capsule', CAPSULE], ['a Box house beside it', BOX]])('keeps %s out of the other line\'s similar models', async (_, it) => {
    renderAt(`${BASE}/${slug(it)}`)
    await screen.findByRole('heading', { level: 1 })
    const region = screen.queryByRole('region', { name: D.similar.heading })
    if (it === CAPSULE) expect(region).toBeNull()
    else expect(within(region).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([`${BASE}/${slug(BOX_NO_ASSEMBLY)}`])
  })

  it('asks a question with the site\'s question form', async () => {
    const user = userEvent.setup()
    const { openQuestion } = renderAt(`${BASE}/${slug(CONTAINER)}`)
    await user.click(await screen.findByRole('button', { name: D.askCta }))
    expect(openQuestion).toHaveBeenCalledTimes(1)
  })

  it('keeps its markup: the Product named as the card, the breadcrumbs as they were', async () => {
    renderAt(`${BASE}/${slug(CONTAINER)}`)
    await screen.findByRole('heading', { level: 1 })
    const product = jsonLd().find((d) => d['@type'] === 'Product')
    expect(product.name).toBe(displayTitle(CONTAINER.title))
    expect(product.sku).toBe('gal-13')
    expect(product.offers).toMatchObject({ price: 4300, availability: 'https://schema.org/InStock' })
    const crumbs = jsonLd().find((d) => d['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual([enGallery.breadcrumbs.home, enGallery.breadcrumbs.gallery, CONTAINER.title])
  })
})

describe('the title', () => {
  const plain = (nodes) => render(<h1>{titleNodes(nodes)}</h1>).container.querySelector('h1')

  it('keeps each dash with the word before it and a hyphenated word whole, and reads as the title', () => {
    const title = 'Κατοικία τύπου A-Frame — 58 τ.μ.'
    const h1 = plain(title)
    expect(h1.textContent).toBe(title)
    expect([...h1.querySelectorAll('.gi-keep')].map((s) => s.textContent)).toEqual(['A-Frame —'])
  })

  it('wraps a hyphenated word with no dash in the title, and leaves a plain title as it is', () => {
    const h1 = plain('Alpine A-Frame house')
    expect(h1.textContent).toBe('Alpine A-Frame house')
    expect([...h1.querySelectorAll('.gi-keep')].map((s) => s.textContent)).toEqual(['A-Frame'])
    expect(titleNodes('Space house')).toBe('Space house')
  })

  it('handles several dashes, en and em', () => {
    const title = 'Container – 6000мм × 3000мм — Office'
    const h1 = plain(title)
    expect(h1.textContent).toBe(title)
    expect([...h1.querySelectorAll('.gi-keep')].map((s) => s.textContent)).toEqual(['Container –', '3000мм —'])
  })
})

describe('the photos', () => {
  it('move with the arrow keys from a thumbnail, focus following, and with previous and next', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(`${BASE}/${slug(CONTAINER)}`)
    await screen.findByRole('heading', { level: 1 })
    const thumbs = screen.getAllByRole('button', { name: new RegExp(`^${D.imageThumb} \\d$`) })
    expect(thumbs).toHaveLength(3)
    expect(thumbs[0]).toHaveAttribute('aria-current', 'true')

    thumbs[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(thumbs[1]).toHaveAttribute('aria-current', 'true')
    expect(document.activeElement).toBe(thumbs[1])
    expect(container.querySelector('.gi-count')).toHaveTextContent('2 / 3')
    expect(container.querySelector('.gi-photo').getAttribute('src')).toContain('/api/img/gallery/13/1.webp')

    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(thumbs[2]).toHaveAttribute('aria-current', 'true')

    await user.click(screen.getByRole('button', { name: D.photos.next }))
    expect(thumbs[0]).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: D.photos.prev }))
    expect(thumbs[2]).toHaveAttribute('aria-current', 'true')
  })

  it('swipe left shows the next photo', async () => {
    const { container } = renderAt(`${BASE}/${slug(CONTAINER)}`)
    await screen.findByRole('heading', { level: 1 })
    const stage = container.querySelector('.gi-stage')
    fireEvent.touchStart(stage, { touches: [{ clientX: 300, clientY: 200 }] })
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 200, clientY: 210 }] })
    expect(container.querySelector('.gi-count')).toHaveTextContent('2 / 3')
  })

  it('open full screen; Esc closes it and focus goes back to the button', async () => {
    const user = userEvent.setup()
    renderAt(`${BASE}/${slug(CONTAINER)}`)
    await screen.findByRole('heading', { level: 1 })
    const open = screen.getByRole('button', { name: D.photos.open })
    await user.click(open)
    const viewer = screen.getByRole('dialog', { name: `${CONTAINER.title}: photos` })
    expect(document.activeElement).toBe(within(viewer).getByRole('button', { name: D.closeLabel }))
    await user.keyboard('{ArrowRight}')
    expect(viewer).toHaveTextContent('2 / 3')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: `${CONTAINER.title}: photos` })).toBeNull()
    expect(document.activeElement).toBe(open)
  })

  it('one photo: no thumbnails, no previous or next, still a full-screen view', async () => {
    renderAt(`${BASE}/${slug(PROJECT)}`)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: D.photos.next })).toBeNull()
    expect(screen.queryAllByRole('button', { name: new RegExp(`^${D.imageThumb} `) })).toHaveLength(0)
    expect(screen.getByRole('button', { name: D.photos.open })).toBeInTheDocument()
  })
})

describe('the modal', () => {
  it('is a dialog labelled by the model\'s h2; the index keeps the one H1; focus starts on the heading', async () => {
    const user = userEvent.setup()
    await openModal(user, CONTAINER)
    const dialog = document.querySelector('.gmodal-portal')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const heading = document.getElementById(dialog.getAttribute('aria-labelledby'))
    expect(heading.tagName).toBe('H2')
    expect(text(heading)).toBe(text({ textContent: displayTitle(CONTAINER.title) }))
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(document.querySelector('h1')).not.toBeNull()
    expect(dialog.contains(document.querySelector('h1'))).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(heading))
    // The modal's chip is in its head, the actions in its footer; no Product markup.
    expect(dialog.querySelector('.gmodal-head .gi-chip')).toHaveTextContent(enGallery.filters.shown.wagon)
    expect(within(dialog.querySelector('.gmodal-foot')).getByRole('button', { name: D.requestCta })).toBeInTheDocument()
    expect(jsonLd().some((d) => d['@type'] === 'Product')).toBe(false)
  })

  it('keeps Tab and Shift+Tab inside it', async () => {
    const user = userEvent.setup()
    await openModal(user, CONTAINER)
    const card = document.querySelector('.gmodal-card')
    const nodes = [...card.querySelectorAll('a[href], button')]
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    last.focus()
    await user.tab()
    expect(document.activeElement).toBe(first)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(last)
    for (let i = 0; i < nodes.length + 2; i += 1) {
      await user.tab()
      expect(card.contains(document.activeElement)).toBe(true)
    }
  })

  it('keeps Shift+Tab and Tab inside it from the sheet itself (a click on its text focuses the sheet)', async () => {
    const user = userEvent.setup()
    await openModal(user, CONTAINER)
    const card = document.querySelector('.gmodal-card')
    card.focus()
    await user.tab({ shift: true })
    expect(card.contains(document.activeElement) && document.activeElement !== card).toBe(true)
    card.focus()
    await user.tab()
    expect(card.contains(document.activeElement) && document.activeElement !== card).toBe(true)
  })

  it('Esc closes it and focus goes back to the card', async () => {
    const user = userEvent.setup()
    const link = await openModal(user, CONTAINER)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.querySelector('.gmodal-portal')).toBeNull())
    expect(document.activeElement).toBe(link)
    expect(document.body.style.overflow).toBe('')
  })

  it('a click on the backdrop, or the close button, closes it', async () => {
    const user = userEvent.setup()
    const link = await openModal(user, CONTAINER)
    fireEvent.click(document.querySelector('.gmodal-backdrop'))
    await waitFor(() => expect(document.querySelector('.gmodal-portal')).toBeNull())
    expect(document.activeElement).toBe(link)

    await user.click(link)
    await waitFor(() => expect(document.querySelector('.gmodal-portal .gi-title')).not.toBeNull())
    await user.click(screen.getByRole('button', { name: D.closeLabel }))
    await waitFor(() => expect(document.querySelector('.gmodal-portal')).toBeNull())
  })

  it('Esc in the full-screen view closes only that view', async () => {
    const user = userEvent.setup()
    await openModal(user, CONTAINER)
    await user.click(within(document.querySelector('.gmodal-portal')).getByRole('button', { name: D.photos.open }))
    expect(screen.getByRole('dialog', { name: `${CONTAINER.title}: photos` })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: `${CONTAINER.title}: photos` })).toBeNull()
    expect(document.querySelector('.gmodal-portal')).not.toBeNull()
  })

  it('a similar model opens in the same modal, over the same list', async () => {
    const user = userEvent.setup()
    await openModal(user, CONTAINER)
    const region = within(document.querySelector('.gmodal-portal')).getByRole('region', { name: D.similar.heading })
    await user.click(within(region).getAllByRole('link')[0])
    await waitFor(() => expect(text(document.querySelector('.gmodal-portal .gi-title'))).toBe(text({ textContent: displayTitle(C6.title) })))
    // Still one H1, the index's, behind it.
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('.gmodal-portal .gi-title')))
  })

  it('the question form opens and the modal closes, as for an offer', async () => {
    const user = userEvent.setup()
    const openQuestion = vi.fn()
    renderAt(BASE, { openQuestion })
    await waitFor(() => expect(cardLink(BOX)).not.toBeNull())
    await user.click(cardLink(BOX))
    await user.click(await screen.findByRole('button', { name: D.askCta }))
    expect(openQuestion).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.querySelector('.gmodal-portal')).toBeNull())
    await act(async () => {})
  })
})
