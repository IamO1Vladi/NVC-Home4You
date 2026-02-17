import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './HeroShowcase.css'

/**
 * HeroShowcase (linked + preloaded)
 * - slides: [{ src, alt, to?, href? }]
 *   - use `to` for internal routes (react-router Link)
 *   - use `href` for external URLs (<a target="_blank" …>)
 * - Preloads first 3 images + the “next” image on each tick
 * - Active image fetchpriority=high for faster LCP
 */
export default function HeroShowcase({
  slides = [],          // preferred: [{src, alt, to? | href?}]
  images = [],          // legacy: [{src, alt}] (no links)
  durationMs = 5600,
  size = 560,
}) {
  const hostRef = useRef(null)
  const [idx, setIdx] = useState(0)

  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  // Build slide list from either `slides` or `images`
  const list = useMemo(() => {
    const base = slides.length ? slides : (images.length ? images : [
      { src: asset('home/hero/01.jpg'), alt: 'Showcase 1', to: '/modular-builds' },
      { src: asset('home/hero/02.jpg'), alt: 'Showcase 2', to: '/modular-houses' },
      { src: asset('home/hero/03.jpg'), alt: 'Showcase 3', to: '/steel-houses' },
      { src: asset('home/hero/04.jpg'), alt: 'Showcase 4', to: '/interiors' },
    ])
    // Normalize objects
    return base.map(s => ({ src: s.src, alt: s.alt || '', to: s.to, href: s.href }))
  }, [slides, images])

  // --- Preload helpers -------------------------------------------------------
  const addPreload = (url) => {
    if (!url) return null
    const link = document.createElement('link')
    link.rel = 'preload'; link.as = 'image'; link.href = url
    document.head.appendChild(link)
    return link
  }

  // Preload first 3 hero images on mount
  useEffect(() => {
    const links = list.slice(0, 3).map(s => addPreload(s.src)).filter(Boolean)
    return () => links.forEach(l => { try{ document.head.removeChild(l) }catch{} })
  }, [list])

  // Preload the *next* image whenever we advance
  useEffect(() => {
    const next = list[(idx + 1) % list.length]?.src
    if (!next) return
    const l = addPreload(next)
    const t = setTimeout(() => { if (l) try{ document.head.removeChild(l) }catch{} }, 8000)
    return () => clearTimeout(t)
  }, [idx, list])

  // Respect Reduced Motion (+ pause when off‑screen)
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduceMotion || list.length < 2) return
    let playing = true
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => { playing = entry.isIntersecting }, { threshold: .25 })
      : null
    if (io) io.observe(hostRef.current)

    const id = setInterval(() => { if (playing) setIdx(i => (i + 1) % list.length) }, durationMs)
    return () => { clearInterval(id); io?.disconnect() }
  }, [list.length, durationMs, reduceMotion])

  // Subtle parallax tilt (desktop)
  useEffect(() => {
    if (reduceMotion) return
    const el = hostRef.current
    if (!el) return
    let raf = 0
    const tilt = el.querySelector('.hs-tilt')
    const onMove = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - .5
        const y = (e.clientY - r.top) / r.height - .5
        tilt.style.transform = `rotateX(${(-y*6).toFixed(2)}deg) rotateY(${(x*8).toFixed(2)}deg)`
      })
    }
    const onLeave = () => { tilt.style.transform = 'none' }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); cancelAnimationFrame(raf) }
  }, [reduceMotion])

  return (
    <div className="hs" ref={hostRef} style={{ ['--hs-size']: `${size}px`, ['--hs-interval']: `${durationMs}ms` }}>
      <div className="hs-frame">
        <div className="hs-tilt">
          <div className="hs-viewport">
            {list.map((s, i) => {
              const Img = (
                <img
                  src={s.src}
                  alt={s.alt}
                  onError={(e)=>{ e.currentTarget.src = fallback }}
                  width="2200" height="1400"
                  loading={i===0 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchpriority={i === idx ? 'high' : 'auto'} // ← faster LCP
                />
              )

              return (
                <figure key={s.src || i} className={['hs-shot', i===idx && 'is-active'].filter(Boolean).join(' ')}>
                  {/* Link wrapper (internal or external) */}
                  {s.to ? (
                    <Link to={s.to} aria-label={s.alt || 'Open'}>
                      {Img}
                    </Link>
                  ) : s.href ? (
                    <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.alt || 'Open'}>
                      {Img}
                    </a>
                  ) : (
                    Img
                  )}
                </figure>
              )
            })}

            {/* sheen + UI */}
            <div className="hs-sheen" aria-hidden="true" />
            <div className="hs-ui">
              <div className="hs-dots" role="tablist" aria-label="Hero slides">
                {list.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i===idx}
                    className={['hs-dot', i===idx && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => setIdx(i)}
                  />
                ))}
              </div>
              <div className="hs-progress"><span key={idx} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
