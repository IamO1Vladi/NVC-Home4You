import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './HeroShowcase.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'

export default function HeroShowcase({
  slides = [],
  images = [],
  durationMs = 5600,
  size = 560,
  openLabel = 'Open',
  slidesLabel = 'Hero slides',
}) {
  const hostRef = useRef(null)
  const [idx, setIdx] = useState(0)

  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  const list = useMemo(() => {
    const base = slides.length ? slides : (images.length ? images : [
      { src: asset('home/hero/01.jpg'), alt: 'Showcase 1', to: '/modular-builds' },
      { src: asset('home/hero/02.jpg'), alt: 'Showcase 2', to: '/modular-houses' },
      { src: asset('home/hero/03.jpg'), alt: 'Showcase 3', to: '/steel-houses' },
      { src: asset('home/hero/04.jpg'), alt: 'Showcase 4', to: '/interiors' },
    ])
    return base.map((s) => ({ src: s.src, alt: s.alt || '', to: s.to, href: s.href }))
  }, [slides, images])

  const addPreload = (url) => {
    if (!url) return null
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = url
    document.head.appendChild(link)
    return link
  }

  useEffect(() => {
    const links = list.slice(0, 3).map((s) => addPreload(cdnImage(s.src, { width: 800 }))).filter(Boolean)
    return () => links.forEach((l) => { try { document.head.removeChild(l) } catch {} })
  }, [list])

  useEffect(() => {
    const next = list[(idx + 1) % list.length]?.src
    if (!next) return undefined
    const link = addPreload(cdnImage(next, { width: 800 }))
    const timer = setTimeout(() => { if (link) try { document.head.removeChild(link) } catch {} }, 8000)
    return () => clearTimeout(timer)
  }, [idx, list])

  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduceMotion || list.length < 2) return undefined
    let playing = true
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => { playing = entry.isIntersecting }, { threshold: 0.25 })
      : null
    if (io) io.observe(hostRef.current)

    const id = setInterval(() => {
      if (playing) setIdx((i) => (i + 1) % list.length)
    }, durationMs)

    return () => {
      clearInterval(id)
      io?.disconnect()
    }
  }, [list.length, durationMs, reduceMotion])

  useEffect(() => {
    if (reduceMotion) return undefined
    const el = hostRef.current
    if (!el) return undefined
    let raf = 0
    const tilt = el.querySelector('.hs-tilt')
    const onMove = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        tilt.style.transform = `rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`
      })
    }
    const onLeave = () => { tilt.style.transform = 'none' }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [reduceMotion])

  return (
    <div className="hs" ref={hostRef} style={{ ['--hs-size']: `${size}px`, ['--hs-interval']: `${durationMs}ms` }}>
      <div className="hs-frame">
        <div className="hs-tilt">
          <div className="hs-viewport">
            {list.map((s, i) => {
              const Img = (
                <img
                  src={cdnImage(s.src, { width: 800 })}
                  srcSet={cdnSrcSet(s.src, [560, 800, 1120])}
                  sizes="(max-width: 980px) 90vw, 560px"
                  alt={s.alt}
                  onError={(e) => { e.currentTarget.src = fallback }}
                  width="2200"
                  height="1400"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchpriority={i === idx ? 'high' : 'auto'}
                />
              )
              const aria = s.alt ? `${openLabel}: ${s.alt}` : openLabel

              return (
                <figure key={s.src || i} className={['hs-shot', i === idx && 'is-active'].filter(Boolean).join(' ')}>
                  {s.to ? (
                    <Link to={s.to} aria-label={aria}>{Img}</Link>
                  ) : s.href ? (
                    <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={aria}>{Img}</a>
                  ) : (
                    Img
                  )}
                </figure>
              )
            })}

            <div className="hs-sheen" aria-hidden="true" />
            <div className="hs-ui">
              <div className="hs-dots" role="tablist" aria-label={slidesLabel}>
                {list.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === idx}
                    // Numeric, deliberately: it needs no translation and "3 / 5" is what a
                    // dot IS. The strip itself carries the localized name.
                    aria-label={`${i + 1} / ${list.length}`}
                    className={['hs-dot', i === idx && 'is-active'].filter(Boolean).join(' ')}
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
