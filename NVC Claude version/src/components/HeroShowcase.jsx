// The hero's photographs: one full-bleed frame, one slow crossfade, nothing else.
//
// A plain stack of figures; the active one is visible, the rest are visibility:hidden so
// they take no click, no tab stop and no place in the reading order. The frame advances
// every `intervalMs` unless the visitor is hovering it, has focus inside the numerals (the
// parent passes `paused`), has clicked a numeral, the frame is off-screen, or the OS asks
// for reduced motion. The numerals and the caption live in Hero.jsx, which owns the index;
// this component only shows the photo for it and asks to move on.
//
// Images go through cdnImage/cdnSrcSet (the API resizer) with explicit sizes, and each one
// falls back through imageFallback so a dead Blob store marks the snapshot rather than
// looping requests. A per-slide `frame` from the content files sets the crop of a
// photograph whose subject sits off-centre.
import React, { useEffect, useRef, useState } from 'react'
import { cdnImage, cdnSrcSet, imageFallback } from '../lib/img.js'

const WIDTHS = [800, 1200, 1600, 2000]
const SIZES = '(max-width: 767px) 100vw, 78vw'

function frameStyle(frame) {
  if (!frame) return undefined
  const style = {}
  if (frame.position) {
    style.objectPosition = frame.position
    style.transformOrigin = frame.position
  }
  if (frame.scale && frame.scale !== 1) style.transform = `scale(${frame.scale})`
  return style
}

export default function HeroShowcase({
  slides = [],
  index = 0,
  onAdvance,
  intervalMs = 7000,
  paused = false,
}) {
  const hostRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(true)

  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  const reduceMotion = typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)

  useEffect(() => {
    const el = hostRef.current
    if (!el || !('IntersectionObserver' in window)) return undefined
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const playing = !reduceMotion && !paused && !hovered && visible && slides.length > 1
  useEffect(() => {
    if (!playing || typeof onAdvance !== 'function') return undefined
    const id = setInterval(() => onAdvance(), intervalMs)
    return () => clearInterval(id)
  }, [playing, intervalMs, onAdvance])

  if (!slides.length) return null

  return (
    <div
      className="hp-hero-media"
      ref={hostRef}
      aria-hidden="true"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {slides.map((s, i) => {
        const active = i === index
        return (
          <figure key={`${s.src}-${i}`} className={active ? 'hp-slide is-active' : 'hp-slide'}>
            <img
              src={cdnImage(s.src, { width: 1600 })}
              srcSet={cdnSrcSet(s.src, WIDTHS)}
              sizes={SIZES}
              alt=""
              width="1600"
              height="1000"
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              fetchpriority={i === 0 ? 'high' : 'auto'}
              onError={imageFallback(fallback)}
              style={frameStyle(s.frame)}
            />
          </figure>
        )
      })}
    </div>
  )
}
