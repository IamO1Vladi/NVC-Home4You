import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ServiceTiles from './ServiceTiles.jsx'
import bgHome from '../content/bg/home.js'
import enHome from '../content/en/home.js'
import elHome from '../content/el/home.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { HOME_PHOTOS_SEED_ID, fetchHomePhotos, forgetHomePhotos } from '../lib/homePhotos.js'
import { tileSlotName } from '../lib/photoSlotNames.js'

// The home page's four "Какво правим" tiles, whose photos the owner can change in "Снимки на
// сайта" (home-tile-*). What is pinned: while a slot is empty the tile's <img> is exactly the
// one it always was, attribute for attribute; a filled slot shows the owner's photo through the
// resizer, still decorative, and falls back to the content's photo and then to the card
// placeholder; a kept answer paints it in the first render.

const HOME = { bg: bgHome.home, en: enHome.home, el: elHome.home }
const LOCALES = ['bg', 'en', 'el']
const PHOTOS_URL = '/api/home/photos'
const CARD = '/modular-builds/card.svg'
const ADMIN = { url: '/api/img/home/29/kitchen.webp', alt: 'Кухнята ни' }

/** fetch that answers the photos call with `body` (null: a 404) and anything else with {}. */
function answer(body) {
  return vi.fn((url) => {
    if (String(url).includes(PHOTOS_URL)) {
      return Promise.resolve(body
        ? { ok: true, status: 200, json: () => Promise.resolve(body) }
        : { ok: false, status: 404, json: () => Promise.resolve({}) })
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
  })
}

const withSlots = (slots) => ({ hero: [], models: {}, pages: {}, slots })

function renderTiles(locale = 'bg') {
  return render(
    <MemoryRouter>
      <ServiceTiles locale={locale} content={HOME[locale].serviceTiles} />
    </MemoryRouter>,
  )
}

const tileImgs = (container) => [...container.querySelectorAll('.hp-tile img')]
const photosCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes(PHOTOS_URL))

/** Today's tile <img>, as ServiceTiles drew it before the slots. */
function expectDefaultTile(img, item) {
  expect(img.getAttribute('src')).toBe(cdnImage(item.img, { width: 1200 }))
  expect(img.getAttribute('srcset')).toBe(cdnSrcSet(item.img, [640, 800, 1200, 1600]))
  expect(img.getAttribute('sizes')).toBe('(max-width: 899px) 100vw, (max-width: 1239px) 50vw, 590px')
  expect(img.getAttribute('alt')).toBe('')
  expect(img.getAttribute('width')).toBe('1600')
  expect(img.getAttribute('height')).toBe('1000')
  expect(img.getAttribute('loading')).toBe('lazy')
  expect(img.getAttribute('decoding')).toBe('async')
  expect(img.hasAttribute('style')).toBe(false)
  expect([...img.attributes].map((a) => a.name).sort()).toEqual(['alt', 'decoding', 'height', 'loading', 'sizes', 'src', 'srcset', 'width'])
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  forgetHomePhotos()
})

describe('ServiceTiles photo slots', () => {
  it('every tile has its slot, by the tile\'s key', () => {
    for (const locale of LOCALES) {
      expect(HOME[locale].serviceTiles.items.map((item) => tileSlotName(item.key))).toEqual([
        'home-tile-modular-builds', 'home-tile-modular-houses', 'home-tile-steel-houses', 'home-tile-interiors',
      ])
    }
  })

  it.each(LOCALES)('%s: empty slots draw today\'s tiles exactly, whatever the API answers', async (locale) => {
    const items = HOME[locale].serviceTiles.items
    for (const body of [null, {}, withSlots({}), { hero: [], models: {}, pages: {} }]) {
      vi.stubGlobal('fetch', answer(body))
      const { container, unmount } = renderTiles(locale)
      // Before the answer, and after it.
      tileImgs(container).forEach((img, i) => expectDefaultTile(img, items[i]))
      await waitFor(() => expect(photosCalls()).toHaveLength(1))
      await act(async () => {})
      tileImgs(container).forEach((img, i) => expectDefaultTile(img, items[i]))
      unmount()
      forgetHomePhotos()
    }
  })

  it.each(LOCALES)('%s: a filled slot shows the owner\'s photo through the resizer, still decorative; the others keep theirs', async (locale) => {
    const items = HOME[locale].serviceTiles.items
    vi.stubGlobal('fetch', answer(withSlots({ 'home-tile-interiors': ADMIN })))
    const { container } = renderTiles(locale)
    await waitFor(() => expect(tileImgs(container)[3].getAttribute('src')).toContain('/api/img/home/29/kitchen.webp'))

    const img = tileImgs(container)[3]
    expect(img.getAttribute('src')).toBe(cdnImage(ADMIN.url, { width: 1200 }))
    expect(img.getAttribute('src')).toContain('?w=')
    expect(img.getAttribute('srcset')).toBe(cdnSrcSet(ADMIN.url, [640, 800, 1200, 1600]))
    expect(img.getAttribute('sizes')).toBe('(max-width: 899px) 100vw, (max-width: 1239px) 50vw, 590px')
    // The tile's title says where it goes; the owner's description is not read out here.
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('width')).toBe('1600')
    expect(img.getAttribute('height')).toBe('1000')
    expect(img.style.objectPosition).toBe('50% 50%')
    tileImgs(container).slice(0, 3).forEach((other, i) => expectDefaultTile(other, items[i]))
  })

  it('falls back to the tile\'s own photo, then to the card placeholder, if the owner\'s fails to load', async () => {
    const item = HOME.bg.serviceTiles.items[0]
    vi.stubGlobal('fetch', answer(withSlots({ 'home-tile-modular-builds': ADMIN })))
    const { container } = renderTiles('bg')
    await waitFor(() => expect(tileImgs(container)[0].getAttribute('src')).toContain('/api/img/home/29/'))
    const img = tileImgs(container)[0]
    // One retry of the owner's photo, then the content's.
    fireEvent.error(img)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(cdnImage(item.img, { width: 1200 }))
    expect(img.hasAttribute('srcset')).toBe(false)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(CARD)
  })

  it('paints a kept answer in the first render (the snapshot\'s <head> copy)', async () => {
    vi.stubGlobal('fetch', answer(withSlots({ 'home-tile-steel-houses': ADMIN })))
    await fetchHomePhotos()
    expect(document.getElementById(HOME_PHOTOS_SEED_ID)).not.toBeNull()

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { container } = renderTiles('bg')
    // No waiting: the first render already has it.
    expect(tileImgs(container)[2].getAttribute('src')).toBe(cdnImage(ADMIN.url, { width: 1200 }))
    expectDefaultTile(tileImgs(container)[1], HOME.bg.serviceTiles.items[1])
  })
})
