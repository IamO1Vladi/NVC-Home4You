// "From the port to your plot": four short silent clips of a real delivery, each with its
// caption as page text (an h3 and one sentence), so the story reads the same with the
// videos off, on a screen reader, or in the prerendered snapshot.
//
// THE VIDEO IS DECORATION AND IS TREATED AS SUCH. Each clip starts as its WebP poster in an
// <img> (lazy, decoding async, alt="" since the caption beside it says what it shows). Only
// in a browser that wants motion — no prefers-reduced-motion, no Save-Data — and only once
// the clip comes near the screen, a <video> is laid over the poster:
//   <video muted playsinline loop preload="none" poster aria-hidden> + <source type="video/mp4">
// with no autoplay attribute. An IntersectionObserver plays it while at least half of it is
// on screen and pauses it when it leaves. With reduced motion or Save-Data the <video> is
// never rendered, so not a byte of it is fetched. The box is a fixed 4:5, poster or video,
// so nothing below moves when one replaces the other.
//
// The files are public/delivery/journey-<id>.mp4 and .webp, made by scripts/delivery/clips.mjs
// (640 x 800, about half a megabyte each).
import React, { useEffect, useRef, useState } from 'react'

const BASE = import.meta.env.BASE_URL || '/'
export const clipSrc = (id) => `${BASE}delivery/journey-${id}.mp4`
export const posterSrc = (id) => `${BASE}delivery/journey-${id}.webp`

// How far ahead of the screen the <video> is mounted (it fetches nothing until play()).
const NEAR_MARGIN = '300px 0px'
// The share of a clip that must be on screen for it to play.
const PLAY_RATIO = 0.5

/** Whether this browser should get moving pictures at all. Never true on the server. */
export function wantsMotion() {
  if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  if (window.navigator?.connection?.saveData) return false
  return true
}

function Clip({ id, title, text, headingLevel = 3 }) {
  const boxRef = useRef(null)
  const videoRef = useRef(null)
  const [live, setLive] = useState(false)
  const Heading = `h${headingLevel}`

  // Mount the <video> when the clip nears the screen, and only where motion is wanted.
  useEffect(() => {
    const box = boxRef.current
    if (!box || !wantsMotion()) return undefined
    const near = new window.IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setLive(true)
        near.disconnect()
      }
    }, { rootMargin: NEAR_MARGIN })
    near.observe(box)
    return () => near.disconnect()
  }, [])

  // Play while half of it is on screen, pause when it is not.
  useEffect(() => {
    const video = videoRef.current
    if (!live || !video) return undefined
    const watch = new window.IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry.isIntersecting && entry.intersectionRatio >= PLAY_RATIO) {
        const played = video.play?.()
        if (played && typeof played.catch === 'function') played.catch(() => {})
      } else {
        video.pause?.()
      }
    }, { threshold: [0, PLAY_RATIO, 1] })
    watch.observe(video)
    return () => {
      watch.disconnect()
      video.pause?.()
    }
  }, [live])

  return (
    <li className="dl-clip">
      <div className="dl-clip-media" ref={boxRef}>
        <img src={posterSrc(id)} alt="" width="640" height="800" loading="lazy" decoding="async" />
        {live ? (
          <video
            ref={videoRef}
            muted
            playsInline
            loop
            preload="none"
            poster={posterSrc(id)}
            aria-hidden="true"
            tabIndex={-1}
            width="640"
            height="800"
          >
            <source src={clipSrc(id)} type="video/mp4" />
          </video>
        ) : null}
      </div>
      <Heading className="dl-clip-title">{title}</Heading>
      <p className="dl-clip-text">{text}</p>
    </li>
  )
}

/**
 * @param clips       [{ id: 'port'|'yard'|'truck'|'plot', title, text }], in the order they happen
 * @param labelledBy  the id of the words that name the row (not the section's own heading:
 *                    two landmarks with one name read as one)
 */
export default function JourneyClips({ clips = [], labelledBy }) {
  const list = (clips || []).filter((c) => c && c.id && c.title)
  // On a phone the row scrolls sideways and holds nothing focusable, so the row itself takes
  // focus: a keyboard can then scroll it with the arrow keys. Only while it does scroll: from
  // 900px it is a still grid of four, and a focus stop there would do nothing.
  const rowRef = useRef(null)
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const el = rowRef.current
    if (!el) return undefined
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth)
    measure()
    if (typeof window.ResizeObserver !== 'function') return undefined
    const observer = new window.ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [list.length])
  if (!list.length) return null
  return (
    <div
      ref={rowRef}
      className="dl-clips-row"
      tabIndex={scrolls ? 0 : undefined}
      role="region"
      aria-labelledby={labelledBy}
    >
      <ol className="dl-clips">
        {list.map((clip) => <Clip key={clip.id} {...clip} />)}
      </ol>
    </div>
  )
}
