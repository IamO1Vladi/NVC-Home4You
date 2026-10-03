import React from 'react'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { cdnImage, cdnSrcSet, DEFAULT_WIDTHS, IMAGE_RETRY_MS, imageFallback } from './img.js'

// The client half of ROADMAP #9. These run with VITE_CLOUDINARY_CLOUD unset — which is
// also how production runs, and the whole point: the srcsets the markup always carried
// are now answered by /api/img/{key}?w= instead of collapsing to the plain src.

const KEY = '/api/img/gallery/12/0af3b2c1d4e5f60718293a4b5c6d7e8f.webp'

describe('cdnImage', () => {
  it('appends a snapped ?w= to a first-party image URL', () => {
    // 600 is not a ladder rung; 640 is the next one up. The snap MUST match
    // ImageWidths.Snap in the API — ImageWidthsTests pins these same cases.
    expect(cdnImage(KEY, { width: 640 })).toBe(`${KEY}?w=640`)
    expect(cdnImage(KEY, { width: 600 })).toBe(`${KEY}?w=640`)
    expect(cdnImage(KEY, { width: 90 })).toBe(`${KEY}?w=120`)
  })

  it('serves the original past the top rung rather than pretending to upscale', () => {
    expect(cdnImage(KEY, { width: 2400 })).toBe(KEY)
  })

  it('leaves everything that is not ours to resize alone', () => {
    // Static /public assets have no resizer behind them; external URLs are not ours.
    expect(cdnImage('/box-config/plan-B4.webp', { width: 320 })).toBe('/box-config/plan-B4.webp')
    expect(cdnImage('https://example.com/x.jpg', { width: 320 })).toBe('https://example.com/x.jpg')
    expect(cdnImage('/modular-builds/card.svg', { width: 320 })).toBe('/modular-builds/card.svg')
  })

  it('a missing width means the original', () => {
    expect(cdnImage(KEY)).toBe(KEY)
    expect(cdnImage(KEY, {})).toBe(KEY)
  })
})

describe('cdnSrcSet', () => {
  it('emits one entry per distinct rung, and the descriptor names the width actually served', () => {
    // [400, 600, 800] snaps to [400, 640, 800] — and SAYS 640w, not 600w. A descriptor
    // that flatters the file makes the browser render it too small for the screen it
    // picked it for.
    expect(cdnSrcSet(KEY, [400, 600, 800])).toBe(
      `${KEY}?w=400 400w, ${KEY}?w=640 640w, ${KEY}?w=800 800w`)
  })

  it('dedupes widths that share a rung', () => {
    // 560 and 600 both land on 640; one entry, not two entries with one URL.
    expect(cdnSrcSet(KEY, [560, 600])).toBe(`${KEY}?w=640 640w`)
  })

  it('is undefined for anything unresizable, so React omits the attribute', () => {
    expect(cdnSrcSet('/box-config/plan-B4.webp')).toBeUndefined()
    expect(cdnSrcSet('https://example.com/x.jpg')).toBeUndefined()
    expect(cdnSrcSet('')).toBeUndefined()
  })

  it('the default ladder used across the site produces only rung-true entries', () => {
    const out = cdnSrcSet(KEY, DEFAULT_WIDTHS)
    for (const entry of out.split(', ')) {
      const m = entry.match(/\?w=(\d+) (\d+)w$/)
      expect(m, entry).toBeTruthy()
      expect(m[1]).toBe(m[2])
    }
  })
})

// ROADMAP #33. The handler every failing <img> uses. The bug it ends: setting src on an
// image that has a srcset re-selects the same failing candidate, so the error fires again,
// forever (13,412 requests in 15 s on /bg, 2026-09-30). What it keeps, on purpose, of what
// that loop did by accident: one retry, so a one-off failure heals; and a mark on every
// fallback, so the prerender can refuse a page showing one.
describe('imageFallback', () => {
  const KEY_SRCSET = `${KEY}?w=400 400w, ${KEY}?w=800 800w`
  const FALLBACK = '/modular-builds/card.svg'

  // A detached <img> whose attribute writes are counted, with the event shape React passes.
  function failingImage({ src = `${KEY}?w=800`, srcset = KEY_SRCSET } = {}) {
    const img = document.createElement('img')
    img.setAttribute('src', src)
    if (srcset) {
      img.setAttribute('srcset', srcset)
      img.setAttribute('sizes', '100vw')
    }
    const writes = []
    const original = img.setAttribute.bind(img)
    img.setAttribute = (name, value) => {
      if (!name.startsWith('data-')) writes.push([name, value])
      original(name, value)
    }
    return { img, writes, fail: (handler) => handler({ currentTarget: img }) }
  }

  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('first retries the image itself, once, a moment later, keeping its srcset', () => {
    const { img, writes, fail } = failingImage()
    fail(imageFallback(FALLBACK))

    // Nothing yet: a one-off failure deserves a second try before the placeholder.
    expect(writes).toEqual([])
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    expect(writes).toEqual([['src', `${KEY}?w=800`]])
    expect(img.getAttribute('srcset')).toBe(KEY_SRCSET)
    expect(img.hasAttribute('data-img-fallback')).toBe(false)
  })

  it('a retry that loads leaves the real image there, srcset and all', () => {
    // The case the old loop healed by accident. A load fires no error, so nothing else runs.
    const { img, fail } = failingImage()
    fail(imageFallback(FALLBACK))
    vi.advanceTimersByTime(IMAGE_RETRY_MS)

    expect(img.getAttribute('src')).toBe(`${KEY}?w=800`)
    expect(img.getAttribute('srcset')).toBe(KEY_SRCSET)
    expect(img.getAttribute('sizes')).toBe('100vw')
  })

  it('when the retry fails too: drops srcset, keeps sizes, takes the fallback and marks it', () => {
    const { img, fail } = failingImage()
    const onError = imageFallback(FALLBACK)
    fail(onError)
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    fail(onError)

    expect(img.getAttribute('src')).toBe(FALLBACK)
    expect(img.hasAttribute('srcset')).toBe(false)
    // Kept: inert without a srcset, and React would not put it back on the next image.
    expect(img.getAttribute('sizes')).toBe('100vw')
    // What the prerender looks for.
    expect(img.dataset.imgFallback).toBe(FALLBACK)
  })

  it('fired over and over — the fallback failing too — is one retry, one fallback, then nothing', () => {
    const { img, writes, fail } = failingImage()
    const onError = imageFallback(FALLBACK)
    fail(onError)
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    for (let i = 0; i < 10; i++) {
      fail(onError)
      vi.advanceTimersByTime(IMAGE_RETRY_MS)
    }
    expect(writes).toEqual([['src', `${KEY}?w=800`], ['src', FALLBACK]])
    expect(img.getAttribute('src')).toBe(FALLBACK)
  })

  it('a retry due after React moved the node to another image does not drag it back', () => {
    const { img, writes, fail } = failingImage()
    fail(imageFallback(FALLBACK))
    img.setAttribute('src', '/api/img/gallery/13/other.webp?w=800') // React, mid-wait
    writes.length = 0
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    expect(writes).toEqual([])
    expect(img.getAttribute('src')).toBe('/api/img/gallery/13/other.webp?w=800')
  })

  it('walks a chain one step per error after the retry, and stops at its end', () => {
    const { img, writes, fail } = failingImage({ src: '/internal-doors/clear.webp', srcset: null })
    const onError = imageFallback('/decor-lines-white.webp', FALLBACK)
    fail(onError)
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    fail(onError)
    expect(img.getAttribute('src')).toBe('/decor-lines-white.webp')
    fail(onError)
    expect(img.getAttribute('src')).toBe(FALLBACK)
    fail(onError)
    fail(onError)
    vi.runAllTimers()
    expect(writes.map(([, v]) => v)).toEqual(['/internal-doors/clear.webp', '/decor-lines-white.webp', FALLBACK])
  })

  it('ignores missing and repeated entries, so the chain cannot cycle', () => {
    // [A, B, A] would bounce between A and B for ever if repeats were kept.
    const { writes, fail } = failingImage({ src: '/x.webp', srcset: null })
    const onError = imageFallback('/a.webp', undefined, '', '/b.webp', '/a.webp', null)
    for (let i = 0; i < 8; i++) {
      fail(onError)
      vi.advanceTimersByTime(IMAGE_RETRY_MS)
    }
    expect(writes.map(([, v]) => v)).toEqual(['/x.webp', '/a.webp', '/b.webp'])
  })

  it('an image whose own src is the fallback, failing, is left alone', () => {
    const { writes, fail } = failingImage({ src: FALLBACK, srcset: null })
    fail(imageFallback(FALLBACK))
    vi.runAllTimers()
    expect(writes).toEqual([])
  })

  it('with nothing to fall back to, it retries once and then does nothing', () => {
    const { img, writes, fail } = failingImage()
    const onError = imageFallback(undefined)
    fail(onError)
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    fail(onError)
    vi.runAllTimers()
    expect(writes).toEqual([['src', `${KEY}?w=800`]])
    expect(img.getAttribute('srcset')).toBe(KEY_SRCSET)
    // Marked as given up, so the prerender neither waits on it nor ships it as fine.
    expect(img.dataset.imgFailed).toBe(`${KEY}?w=800`)
  })

  it('a chain run to its end marks the last failure as given up', () => {
    const { img, fail } = failingImage({ src: '/x.webp', srcset: null })
    const onError = imageFallback(FALLBACK)
    fail(onError)
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    fail(onError)                 // retry failed: on to the fallback
    expect(img.dataset.imgFailed).toBeUndefined()
    fail(onError)                 // the fallback failed too
    expect(img.dataset.imgFailed).toBe(FALLBACK)
  })

  it('in React: retry, then one fallback; a new image in the same node gets its own retry, chain and sizes', () => {
    // The reused-node case (InteriorsPage's before/after): React swaps src and srcSet in place.
    // createElement rather than JSX: this file is .js, which the build does not parse as JSX.
    const Pic = ({ src }) => React.createElement('img', {
      alt: 'pic',
      src: cdnImage(src, { width: 800 }),
      srcSet: cdnSrcSet(src, [400, 800]),
      sizes: '(max-width: 900px) 100vw, 860px',
      onError: imageFallback(FALLBACK),
    })
    const { rerender } = render(React.createElement(Pic, { src: KEY }))
    const img = screen.getByAltText('pic')
    expect(img.getAttribute('srcset')).toContain('?w=400')

    fireEvent.error(img)
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(FALLBACK)
    expect(img.hasAttribute('srcset')).toBe(false)

    const other = '/api/img/gallery/13/ffeeddccbbaa99887766554433221100.webp'
    rerender(React.createElement(Pic, { src: other }))
    expect(img.getAttribute('src')).toBe(`${other}?w=800`)
    expect(img.getAttribute('srcset')).toContain(`${other}?w=400`)
    expect(img.getAttribute('sizes')).toBe('(max-width: 900px) 100vw, 860px')

    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(`${other}?w=800`) // its own retry first
    vi.advanceTimersByTime(IMAGE_RETRY_MS)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(FALLBACK)
  })
})

// The pattern must not come back. Every onError attribute on an element in the source is
// either imageFallback(...) or on the list below, whatever its handler is spelled like: the
// loop was written as e.currentTarget.src =, as e.target.src =, and as img.src = after
// const img = e.currentTarget, and a guard keyed on one spelling would miss the others.
describe('no hand-rolled image fallbacks', () => {
  const srcRoot = resolve(__dirname, '..')
  const files = readdirSync(srcRoot, { recursive: true })
    .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f))
    .map((f) => join(srcRoot, f))

  // Handlers that do not touch the image: they swap it out of the render instead.
  const ALLOWED = new Set(['() => setFailed(true)'])

  // The expression inside onError={...}, by brace matching (string contents are not
  // special-cased; no handler here puts a brace inside a string).
  function handlers(text) {
    const out = []
    let from = 0
    for (;;) {
      const at = text.indexOf('onError={', from)
      if (at === -1) return out
      let depth = 1
      let i = at + 'onError={'.length
      for (; i < text.length && depth > 0; i++) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
      }
      out.push(text.slice(at + 'onError={'.length, i - 1).trim())
      from = i
    }
  }

  it('scans the source tree and finds the handlers', () => {
    expect(files.length).toBeGreaterThan(50)
    const all = files.flatMap((f) => handlers(readFileSync(f, 'utf8')))
    expect(all.length).toBeGreaterThan(15)
  })

  it('every onError is imageFallback(...) or a listed non-image handler', () => {
    const offenders = []
    for (const file of files) {
      if (file.endsWith(join('lib', 'img.js'))) continue
      for (const h of handlers(readFileSync(file, 'utf8'))) {
        if (h.startsWith('imageFallback(') || ALLOWED.has(h)) continue
        offenders.push(`${relative(srcRoot, file)}: onError={${h.slice(0, 60)}}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the brace matcher sees through the spellings the loop was written in', () => {
    const sample = [
      'onError={(e) => { e.target.src = fallback }}',
      'onError={({ target }) => { target.src = x }}',
      'onError={(e) => { const img = e.currentTarget; img.src = fallback }}',
    ].join('\n')
    expect(handlers(sample)).toEqual([
      '(e) => { e.target.src = fallback }',
      '({ target }) => { target.src = x }',
      '(e) => { const img = e.currentTarget; img.src = fallback }',
    ])
  })
})

// scripts/prerender.mjs waits out this retry before it checks a page's images, and cannot
// import the constant (img.js reads import.meta.env, which only Vite provides).
describe('the prerender and imageFallback agree on the retry delay', () => {
  it('prerender.mjs carries the same IMAGE_RETRY_MS', () => {
    const script = readFileSync(resolve(__dirname, '../../scripts/prerender.mjs'), 'utf8')
    const m = script.match(/const IMAGE_RETRY_MS = (\d+)/)
    expect(m, 'IMAGE_RETRY_MS not found in prerender.mjs').toBeTruthy()
    expect(Number(m[1])).toBe(IMAGE_RETRY_MS)
  })
})