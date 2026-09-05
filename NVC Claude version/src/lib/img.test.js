import { describe, expect, it } from 'vitest'
import { cdnImage, cdnSrcSet, DEFAULT_WIDTHS } from './img.js'

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
