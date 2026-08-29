import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './GlideServices.css'
import { paths } from '../routes/paths.js'

export default function GlideServices({ locale = 'en', content }) {
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  const slides = useMemo(() => (
    (content?.slides || []).map((slide) => ({
      ...slide,
      to: paths[slide.pathKey]?.[locale] || '/',
    }))
  ), [content, locale])

  const stripRef = useRef(null)
  const cardRefs = useRef([])
  const [idx, setIdx] = useState(0)
  const playing = useRef(true)

  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const centerIndex = (i) => {
    const strip = stripRef.current
    const card = cardRefs.current[i]
    if (!strip || !card) return
    const left = card.offsetLeft - (strip.clientWidth - card.clientWidth) / 2
    strip.scrollTo({ left, behavior: 'smooth' })
    setIdx(i)
  }

  useEffect(() => {
    if (reduceMotion || slides.length < 2) return undefined
    const id = setInterval(() => {
      if (playing.current) centerIndex((idx + 1) % slides.length)
    }, 3800)
    return () => clearInterval(id)
  }, [idx, slides.length, reduceMotion])

  useEffect(() => {
    const root = stripRef.current?.closest('.gl')
    if (!root) return undefined
    const stop = () => { playing.current = false }
    const start = () => { playing.current = true }

    root.addEventListener('mouseenter', stop)
    root.addEventListener('mouseleave', start)
    root.addEventListener('touchstart', stop, { passive: true })
    root.addEventListener('touchend', start)

    let io
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => {
        playing.current = entry.isIntersecting
      }, { threshold: 0.35 })
      io.observe(root)
    }

    return () => {
      root.removeEventListener('mouseenter', stop)
      root.removeEventListener('mouseleave', start)
      root.removeEventListener('touchstart', stop)
      root.removeEventListener('touchend', start)
      io?.disconnect()
    }
  }, [])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return undefined
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const mid = strip.scrollLeft + strip.clientWidth / 2
        let best = 0
        let bestDist = Infinity
        cardRefs.current.forEach((el, i) => {
          if (!el) return
          const center = el.offsetLeft + el.clientWidth / 2
          const d = Math.abs(center - mid)
          if (d < bestDist) {
            bestDist = d
            best = i
          }
        })
        setIdx(best)
      })
    }
    strip.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      strip.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const prev = () => centerIndex((idx - 1 + slides.length) % slides.length)
  const next = () => centerIndex((idx + 1) % slides.length)

  if (!content) return null

  return (
    <section className="gl" aria-roledescription="carousel" aria-label={content.ariaLabel}>
      <div className="container">
        <div className="gl-head">
          <p className="gl-sub">{content.subheading}</p>
        </div>
      </div>

      <div className="gl-bleed">
        <div className="gl-viewport">
          <div className="gl-strip" ref={stripRef}>
            {slides.map((slide, i) => (
              <Link
                key={slide.key}
                ref={(el) => { cardRefs.current[i] = el }}
                to={slide.to}
                className={['gl-card', i === idx && 'is-active'].filter(Boolean).join(' ')}
                aria-label={slide.title}
              >
                <img
                  src={slide.img}
                  alt=""
                  role="presentation"
                  onError={(e) => { e.currentTarget.src = fallback }}
                  width="1600"
                  height="1000"
                  loading="lazy"
                />
                <div className="gl-cap">
                  <div className="gl-h">{slide.title}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="gl-arrows">
            <button className="gl-arrow" onClick={prev} aria-label={content.prevAria}>‹</button>
            <button className="gl-arrow" onClick={next} aria-label={content.nextAria}>›</button>
          </div>

          <div className="gl-dots" role="tablist" aria-label={content.dotsAria}>
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === idx}
                aria-label={`${i + 1} / ${slides.length}`}
                className={['gl-dot', i === idx && 'is-active'].filter(Boolean).join(' ')}
                onClick={() => { centerIndex(i); playing.current = false }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
