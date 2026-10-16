import React from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import SlotImg, { SLOT_IMG_WIDTHS } from './SlotImg.jsx'
import { cdnImage, cdnSrcSet, imageFallback } from '../lib/img.js'

// The image of a slot the owner can fill from the panel. What is pinned: an EMPTY slot (null,
// or undefined while the answer is on its way) renders the page's own <img> to the attribute,
// with nothing added; a FILLED one shows the owner's photo through the resizer, with its own
// alt and a centred crop, and falls back to the page's default picture when it fails to load.

const htmlOf = (ui) => render(ui).container.innerHTML

// A plain figure: no srcSet, no sizes, no onError, so an empty slot can be seen adding none. (The
// About factory figure's shape until 2026-10-17; it has its own 600/1200 srcSet now, which
// AboutPage.test.jsx pins.)
const FACTORY = {
  src: '/factory/factory-hall-1200.webp',
  alt: 'Цехът на фабриката',
  width: 1200,
  height: 891,
  loading: 'lazy',
  decoding: 'async',
}

// Today's home tile: resized, with sizes and a fallback of its own.
const TILE = {
  src: cdnImage('/api/img/content/bvk4n834b-rce-eg-vb.webp', { width: 1200 }),
  srcSet: cdnSrcSet('/api/img/content/bvk4n834b-rce-eg-vb.webp', [640, 800, 1200, 1600]),
  sizes: '(max-width: 899px) 100vw, (max-width: 1239px) 50vw, 590px',
  alt: '',
  width: '1600',
  height: '1000',
  loading: 'lazy',
  decoding: 'async',
  className: 'tile-img',
  style: { objectPosition: '50% 70%' },
}

const ADMIN = { url: '/api/img/home/21/floor.webp', alt: 'Нашият цех' }

describe('SlotImg, empty', () => {
  it("renders exactly the page's own <img>, adding no srcset, sizes or handler (null and undefined alike)", () => {
    for (const admin of [null, undefined, { url: '' }, { alt: 'no url' }]) {
      expect(htmlOf(<SlotImg admin={admin} adminAlt="x" fallbacks={['/card.svg']} {...FACTORY} />)).toBe(htmlOf(<img {...FACTORY} />))
      expect(htmlOf(<SlotImg admin={admin} {...TILE} />)).toBe(htmlOf(<img {...TILE} />))
    }
    const img = render(<SlotImg admin={null} {...FACTORY} />).container.querySelector('img')
    expect(img).not.toHaveAttribute('srcset')
    expect(img).not.toHaveAttribute('sizes')
    expect(img).not.toHaveAttribute('style')
  })

  it("keeps the page's own onError, and only that", () => {
    const onError = imageFallback('/modular-builds/card.svg')
    const img = render(<SlotImg admin={undefined} {...TILE} onError={onError} />).container.querySelector('img')
    fireEvent.error(img)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('/modular-builds/card.svg')
  })
})

describe('SlotImg, filled', () => {
  it("shows the owner's photo through the resizer, keeping the page's box and its other attributes", () => {
    const img = render(<SlotImg admin={ADMIN} adminAlt="Нашият цех" adminSizes="(max-width: 899px) 100vw, 800px" {...FACTORY} />)
      .container.querySelector('img')
    expect(img.getAttribute('src')).toBe(cdnImage(ADMIN.url, { width: 1200 }))
    expect(img.getAttribute('src')).toContain('?w=')
    expect(img.getAttribute('srcset')).toBe(cdnSrcSet(ADMIN.url, SLOT_IMG_WIDTHS))
    expect(img.getAttribute('sizes')).toBe('(max-width: 899px) 100vw, 800px')
    expect(img).toHaveAttribute('alt', 'Нашият цех')
    expect(img).toHaveAttribute('width', '1200')
    expect(img).toHaveAttribute('height', '891')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('decoding', 'async')
  })

  it("never reuses the default's alt, srcset or crop: alt is adminAlt or empty, the crop the centre", () => {
    const img = render(<SlotImg admin={ADMIN} {...TILE} />).container.querySelector('img')
    expect(img).toHaveAttribute('alt', '')
    expect(img.getAttribute('srcset')).not.toContain('bvk4n834b-rce')
    // The page's sizes is kept when no adminSizes is given; the class too.
    expect(img.getAttribute('sizes')).toBe(TILE.sizes)
    expect(img).toHaveClass('tile-img')
    expect(img.style.objectPosition).toBe('50% 50%')

    const factory = render(<SlotImg admin={ADMIN} {...FACTORY} />).container.querySelector('img')
    expect(factory).toHaveAttribute('alt', '')
  })

  it('crops where the slot asks, and takes the widths it is given', () => {
    const img = render(
      <SlotImg admin={ADMIN} adminPosition="50% 30%" adminWidth={160} adminWidths={[160, 240, 320]} adminSizes="72px" src="/about/team/x.webp" alt="" />,
    ).container.querySelector('img')
    expect(img.style.objectPosition).toBe('50% 30%')
    expect(img.getAttribute('src')).toBe(cdnImage(ADMIN.url, { width: 160 }))
    expect(img.getAttribute('srcset')).toBe(cdnSrcSet(ADMIN.url, [160, 240, 320]))
    expect(img.getAttribute('sizes')).toBe('72px')
  })

  it("falls back to the page's default picture, then to the fallbacks, when the owner's file fails", () => {
    const img = render(<SlotImg admin={ADMIN} fallbacks={['/modular-builds/card.svg']} {...TILE} />).container.querySelector('img')
    const adminSrc = img.getAttribute('src')

    // One retry of the owner's photo first (imageFallback's rule), then the default.
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(adminSrc)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(TILE.src)
    expect(img).not.toHaveAttribute('srcset')
    expect(img.dataset.imgFallback).toBe(TILE.src)

    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('/modular-builds/card.svg')
    fireEvent.error(img)
    expect(img.dataset.imgFailed).toBe('/modular-builds/card.svg')
  })

  it('falls back to a default under /public just the same', () => {
    const img = render(<SlotImg admin={ADMIN} {...FACTORY} />).container.querySelector('img')
    fireEvent.error(img)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(FACTORY.src)
  })

  it("gives the page's default its own crop back once it falls back to it", () => {
    // No inline crop on the page (a stylesheet crops the default, like Partner.css's 50% 62%):
    // the owner's centre crop is kept through the retry, then dropped with his photo.
    const plain = render(<SlotImg admin={ADMIN} {...FACTORY} />).container.querySelector('img')
    fireEvent.error(plain)
    expect(plain.style.objectPosition).toBe('50% 50%')
    fireEvent.error(plain)
    expect(plain.getAttribute('src')).toBe(FACTORY.src)
    expect(plain.style.objectPosition).toBe('')

    // The page's own inline crop comes back as it wrote it.
    const tile = render(<SlotImg admin={ADMIN} {...TILE} />).container.querySelector('img')
    expect(tile.style.objectPosition).toBe('50% 50%')
    fireEvent.error(tile)
    fireEvent.error(tile)
    expect(tile.getAttribute('src')).toBe(TILE.src)
    expect(tile.style.objectPosition).toBe('50% 70%')
  })
})
