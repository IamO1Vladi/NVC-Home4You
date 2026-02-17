import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import './SteelHouses.css'
import ProcessTicker from './ProcessTicker.jsx'
import SEO from './SEO.jsx'

export default function SteelHouses(){
  const { t } = useI18n()
  const { openOffer, openQuestion } = useModalActions()

  const asset = (f) => `${import.meta.env.BASE_URL}${f}`
  const stepMedia = [
  { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rw/eg/vb', alt: t('steel.steps.s1') },
  { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcj/eg/vb', alt: t('steel.steps.s2') },
  { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rck/eg/vb', alt: t('steel.steps.s3') },
  { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcm/eg/vb', alt: t('steel.steps.s4') },
  { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcn/eg/vb', alt: t('steel.steps.s5') },
 ]
  const pdf = `${asset('modular-builds/modular-builds.pdf')}#page=3`

  // --- Slider state ---
  const slides = useMemo(() => ([
    'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rr/eg/vb',
    'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r4/eg/vb',
    'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r7/eg/vb',
    'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/ri/eg/vb',
    'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbt/eg/vb',
    'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbw/eg/vb',
    'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rb3/eg/vb',
  ]), [])
  const [active, setActive] = useState(0)
  const stripRef = useRef(null)

  const toIndex = (i) => {
    const el = stripRef.current
    if(!el) return
    const idx = Math.max(0, Math.min(slides.length-1, i))
    const x = idx * el.clientWidth
    el.scrollTo({ left: x, behavior: 'smooth' })
    setActive(idx)
  }

  const onPrev = () => toIndex(active - 1)
  const onNext = () => toIndex(active + 1)

  useEffect(() => {
    const el = stripRef.current
    if(!el) return
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth)
      setActive(i)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main className="sh-page">

  <SEO
      title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
      description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
      image="../../public/logo3"
      url="https://nvc-home4you.eu/steel-houses"
      hreflangs={[
      { hrefLang:'bg', href:'https://nvc-home4you.eu/steel-houses' },
      { hrefLang:'en', href:'https://nvc-home4you.eu/steel-houses' }
      ]}/>

      {/* ===== HERO ===== */}
      <section className="sh-hero">
        <div className="container sh-hero-grid">
          <div className="sh-hero-left">
            <h1 className="sh-title">{t('steel.title')}</h1>
            <p className="sh-lead">{t('steel.lead')}</p>

            <div className="sh-spec-band">
              <div className="sh-spec">
                <div className="sh-spec-h">{t('steel.spec.areaH')}</div>
                <div className="sh-spec-v">20–90 m²</div>
              </div>
              <div className="sh-spec">
                <div className="sh-spec-h">{t('steel.spec.floorsH')}</div>
                <div className="sh-spec-v">1–2</div>
              </div>
              <div className="sh-spec">
                <div className="sh-spec-h">{t('steel.spec.bedroomsH')}</div>
                <div className="sh-spec-v">{t('steel.spec.bedroomsNumber')}</div>
              </div>
              <div className="sh-spec">
                <div className="sh-spec-h">{t('steel.spec.frameH')}</div>
                <div className="sh-spec-v">{t('steel.spec.frameTick')}</div>
              </div>
            </div>

            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>{t('nav.getOffer')}</button>
              <a className="btn ghost" href={pdf} target="_blank" rel="noopener noreferrer">
                {t('steel.viewBrochure')}
              </a>
            </div>
          </div>

          {/* Floating spec card */}
          <aside className="sh-card">
            <div className="sh-card-h">{t('steel.quick.h')}</div>
            <ul className="sh-card-list">
              <li>{t('steel.quick.facade')}</li>
              <li>{t('steel.quick.roof')}</li>
              <li>{t('steel.quick.insul')}</li>
              <li>{t('steel.quick.interiors')}</li>
            </ul>
            <button className="btn small" onClick={openQuestion}>{t('nav.askQuestion')}</button>
          </aside>
        </div>
      </section>

      {/* ===== PROCESS TIMELINE ===== */}
      <section>
  <div className="container">
    <ProcessTicker
      title={t('steel.steps.h')}
      steps={[
        t('steel.steps.s1'),
        t('steel.steps.s2'),
        t('steel.steps.s3'),
        t('steel.steps.s4'),
        t('steel.steps.s5'),
      ]}
       media={stepMedia}
      intervalMs={2400}
    />
  </div>
</section>


      {/* ===== LOGISTICS BAND ===== */}
      {/*
      <section className="sh-logi">
        <div className="container sh-logi-grid">
          <div>
            <div className="sh-logi-h">{t('steel.logi.h')}</div>
            <p className="sh-logi-p">{t('steel.logi.p')}</p>
            <ul className="sh-logi-list">
              <li>{t('steel.logi.modes')}</li>
              <li>{t('steel.logi.terms')}</li>
              <li>{t('steel.logi.customs')}</li>
            </ul>
          </div>
          <div className="sh-logi-cta">
            <button className="btn" onClick={openOffer}>{t('steel.logi.cta')}</button>
          </div>
        </div>
      </section>
*/}
      {/* ===== IMAGE SLIDER ===== */}
      <section>
        <div className="container">
          <div className="sh-gallery-h">{t('steel.gallery.h')}</div>

          <div className="sh-slider" aria-roledescription="carousel" aria-label={t('steel.gallery.h')}>
            <div className="sh-strip" ref={stripRef}>
              {slides.map((src, i) => (
                <figure className="sh-slide" key={i}>
                  <img
                    src={src}
                    alt={t('steel.gallery.alt', { idx: i+1 })}
                    onError={(e)=>{ e.currentTarget.src = asset('modular-builds/card.svg') }}
                    width="1600" height="1000" loading="lazy"
                  />
                </figure>
              ))}
            </div>

            <div className="sh-slider-ctrls">
              <button className="sh-arrow" onClick={onPrev} aria-label={t('steel.gallery.prev')} disabled={active===0}>‹</button>
              <div className="sh-dots" role="tablist">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i===active}
                    aria-label={t('steel.gallery.goto', { idx: i+1 })}
                    className={['sh-dot', i===active && 'is-active'].filter(Boolean).join(' ')}
                    onClick={()=>toIndex(i)}
                  />
                ))}
              </div>
              <button className="sh-arrow" onClick={onNext} aria-label={t('steel.gallery.next')} disabled={active===slides.length-1}>›</button>
            </div>

            <div className="sh-count" aria-live="polite">{active+1}/{slides.length}</div>
          </div>

          <div className="row mt-6" style={{justifyContent:'center'}}>
            <button className="btn" onClick={openOffer}>{t('nav.getOffer')}</button>
            <button className="btn ghost" onClick={openQuestion}>{t('nav.askQuestion')}</button>
          </div>
        </div>
      </section>
    </main>
  )
}
