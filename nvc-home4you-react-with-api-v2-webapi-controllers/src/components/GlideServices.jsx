import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext.jsx'
import './GlideServices.css'

/**
 * Glide-like, mobile-first services slider (no document auto-scroll)
 * - Centers active card by scrolling the HORIZONTAL strip only
 * - Native swipe (no touch handlers), vertical page scroll still works
 * - Autoplay + pause on hover/touch/off-screen
 */
export default function GlideServices(){
  const { t } = useI18n()
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  const slides = useMemo(() => ([
    { key: 'steelHouse0', to: '/steel-houses',  title: t('nav.gliderService.steelHouse'), img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdd/eg/vb' },
    { key: 'steelHouse3', to: '/steel-houses',  title: t('nav.gliderService.steelHouse'), img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rde/eg/vb' },
    { key: 'modularHouse0',     to: '/modular-houses', title: t('nav.gliderService.modularHouse'), img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdf/eg/vb' },
    { key: 'steelHouse1', to: '/steel-houses',  title: t('nav.gliderService.steelHouse'), img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcf/eg/vb' },
    { key: 'steelHouse2', to: '/steel-houses',  title: t('nav.gliderService.steelHouse'), img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rm/eg/vb' },
    { key: 'modularHouse1',   to: '/modular-houses',    title: t('nav.gliderService.modularHouse'),   img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rb9/eg/vb' },
    { key: 'modularHouse2',     to: '/modular-houses',       title: t('nav.gliderService.modularHouse'),     img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r2/eg/vb' },
    { key: 'modularHouse3',     to: '/modular-houses',       title: t('nav.gliderService.modularHouse'),     img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rq/eg/vb' },
    { key: 'steelHouse3',     to: '/steel-houses',       title: t('nav.gliderService.steelHouse'),     img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rr/eg/vb' },
    { key: 'steelHouse4',     to: '/steel-houses',       title: t('nav.gliderService.steelHouse'),     img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r4/eg/vb' },
  ]), [t])

  const stripRef = useRef(null)
  const cardRefs = useRef([])
  const [idx, setIdx] = useState(0)
  const playing = useRef(true)

  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // ✅ Center a card by scrolling the HORIZONTAL strip (never the page)
  const centerIndex = (i) => {
    const strip = stripRef.current
    const card  = cardRefs.current[i]
    if (!strip || !card) return
    const left = card.offsetLeft - (strip.clientWidth - card.clientWidth) / 2
    strip.scrollTo({ left, behavior: 'smooth' }) // horizontal only
    setIdx(i)
  }

  // Autoplay without affecting page scroll
  useEffect(() => {
    if (reduceMotion) return
    const id = setInterval(() => {
      if (playing.current) centerIndex((idx + 1) % slides.length)
    }, 3800)
    return () => clearInterval(id)
  }, [idx, slides.length, reduceMotion])

  // Pause on hover / touch and when the section is off-screen
  useEffect(() => {
    const root = stripRef.current?.closest('.gl')
    if (!root) return
    const stop = () => { playing.current = false }
    const start = () => { playing.current = true }

    root.addEventListener('mouseenter', stop)
    root.addEventListener('mouseleave', start)
    root.addEventListener('touchstart', stop, { passive: true })
    root.addEventListener('touchend', start)

    let io
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([entry]) => { playing.current = entry.isIntersecting },
        { threshold: 0.35 }
      )
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

  // Track the active index by looking for the card closest to the strip center
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const mid = strip.scrollLeft + strip.clientWidth / 2
        let best = 0, bestDist = Infinity
        cardRefs.current.forEach((el, i) => {
          if (!el) return
          const center = el.offsetLeft + el.clientWidth / 2
          const d = Math.abs(center - mid)
          if (d < bestDist) { bestDist = d; best = i }
        })
        setIdx(best)
      })
    }
    strip.addEventListener('scroll', onScroll, { passive: true })
    return () => { strip.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const prev = () => centerIndex((idx - 1 + slides.length) % slides.length)
  const next = () => centerIndex((idx + 1) % slides.length)

  return (
    <section className="gl" aria-roledescription="carousel" aria-label={t('home?.services?.h') || 'Our services'}>
      <div className="container">
        <div className="gl-head">        
          <p className="gl-sub">{t('home.services.sliderHelpText') || 'Swipe or tap any card to open the page'}</p>
        </div>
      </div>

      {/* Full-bleed viewport */}
      <div className="gl-bleed">
        <div className="gl-viewport">
          {/* Native swipe; vertical page scroll still works */}
          <div className="gl-strip" ref={stripRef}>
            {slides.map((s, i) => (
              <Link
                key={s.key}
                ref={(el) => (cardRefs.current[i] = el)}
                to={s.to}
                className={['gl-card', i === idx && 'is-active'].filter(Boolean).join(' ')}
                aria-label={s.title}
              >
                <img
                  src={s.img}
                  alt={s.title}
                  onError={(e)=>{ e.currentTarget.src = fallback }}
                  width="1600" height="1000" loading="lazy"
                />
                <div className="gl-cap">
                  <div className="gl-kicker">{/*Service*/}</div>
                  <div className="gl-h">{s.title}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="gl-arrows">
            <button className="gl-arrow" onClick={prev} aria-label="Previous slide">‹</button>
            <button className="gl-arrow" onClick={next} aria-label="Next slide">›</button>
          </div>

          <div className="gl-dots" role="tablist" aria-label="Slide navigation">
            {slides.map((_, i)=>(
              <button
                key={i}
                role="tab"
                aria-selected={i===idx}
                className={['gl-dot', i===idx && 'is-active'].filter(Boolean).join(' ')}
                onClick={() => { centerIndex(i); playing.current = false }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
