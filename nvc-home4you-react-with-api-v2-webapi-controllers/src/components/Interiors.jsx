import React from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import './Interiors.css'
import SEO from './SEO.jsx'

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={['ir-chip', active && 'is-active'].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function BeforeAfter({ before, after, altBefore, altAfter, initial = 50 }) {
  const [pct, setPct] = React.useState(initial) // 0–100
  const ref = React.useRef(null)
  const fallback = `${import.meta.env.BASE_URL}modular-builds/card.svg`

  const setFromClientX = (clientX) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const x = Math.min(Math.max(clientX - box.left, 0), box.width)
    setPct(Math.round((x / box.width) * 100))
  }

  const startDrag = (ev) => {
    ev.preventDefault()
    const move = (e) => setFromClientX((e.touches?.[0] || e).clientX)
    const stop = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchend', stop)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchend', stop)
  }
  
  return (
    <div className="ir-ba" ref={ref} aria-label="Before and after comparison">
      {/* Base (AFTER) — full size */}
      <img
        className="ir-ba-img ir-ba-after"
        src={after}
        alt={altAfter}
        onError={(e)=>{ e.currentTarget.src = fallback }}
      />

      {/* Top (BEFORE) — full size, clipped horizontally to pct */}
      <img
        className="ir-ba-img ir-ba-before"
        style={{ '--pct': `${pct}%` }}
        src={before}
        alt={altBefore}
        onError={(e)=>{ e.currentTarget.src = fallback }}
      />

      {/* Divider handle */}
      <div
        className="ir-ba-handle"
        style={{ left: `${pct}%` }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Reveal amount"
        tabIndex={0}
        onKeyDown={(e)=> {
          if (e.key === 'ArrowLeft')  setPct(p => Math.max(0, p - 5))
          if (e.key === 'ArrowRight') setPct(p => Math.min(100, p + 5))
        }}
      >
        <span className="ir-ba-line" />
        <span className="ir-ba-knob" />
      </div>

      {/* Range for accessibility & mouse-free control */}
      <input
        className="ir-ba-range"
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e)=>setPct(+e.target.value)}
        aria-label="Reveal amount (range)"
      />

      {/* Side labels */}
      <div className="ir-ba-tags">
        <span className="ir-tag">Before</span>
        <span className="ir-tag">After</span>
      </div>
    </div>
  )
}


export default function Interiors(){
  const { t } = useI18n()
  const { openOffer, openQuestion } = useModalActions()
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const whyImg = (name) => asset(`interiors/${name}`)

  const [tab, setTab] = React.useState('bath') // 'bath' | 'kitchen'

  // Scope chips (non-binding complexity & timeline)
  const [scope, setScope] = React.useState({
    demo: false, plumbing: false, electrical: false,
    premiumTiles: false, customCab: false, underfloor: false,
     grout: false, accessories: false, finish: false
  })

  const score = React.useMemo(() => {
    let s = 1
    if (scope.demo) s += 2
    if (scope.plumbing) s += 3
    if (scope.electrical) s += 2
    if (scope.premiumTiles) s += 2
    if (scope.customCab) s += 3
    if (scope.underfloor) s += 2
    return s
  }, [scope])

  const complexity = score >= 8 ? t('interiors.calc.high') : score >= 5 ? t('interiors.calc.med') : t('interiors.calc.low')
  const timeline = score >= 8 ? t('interiors.calc.tlHigh') : score >= 5 ? t('interiors.calc.tlMed') : t('interiors.calc.tlLow')

  const img = (name) => asset(`interiors/${name}`)
  const bathBefore = 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc2/eg/vb'
  const bathAfter  = 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc4/eg/vb'
  const kitBefore  = 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc3/eg/vb'
  const kitAfter   = 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcz/eg/vb'

  return (
    <main className="ir">

        <SEO
            title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
            description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
            image="../../public/logo3"
            url="https://nvc-home4you.eu/interiors"
            hreflangs={[
            { hrefLang:'bg', href:'https://nvc-home4you.eu/interiors' },
            { hrefLang:'en', href:'https://nvc-home4you.eu/interiors' }
            ]}/>
      {/* HERO */}
      <section className="ir-hero">
        <div className="container ir-hero-grid">
          <div>
            <h1 className="ir-title">{t('interiors.title')}</h1>
            <p className="ir-lead">{t('interiors.lead')}</p>
            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>{t('nav.getOffer')}</button>
              <button className="btn ghost" onClick={openQuestion}>{t('nav.askQuestion')}</button>
            </div>
          </div>
          <aside className="ir-card">
            <div className="ir-card-h">{t('interiors.quick.h')}</div>
            <ul className="ir-card-list">
              <li>{t('interiors.quick.schedule')}</li>
              <li>{t('interiors.quick.pricing')}</li>
              <li>{t('interiors.quick.contract')}</li>
            </ul>
            <a className="ir-card-link" href={`${asset('modular-builds/modular-builds.pdf')}#page=4`} target="_blank" rel="noopener noreferrer">
              {t('interiors.quick.viewPdf')}
            </a>
          </aside>
        </div>
      </section>

      {/* TABS */}
      <section>
        <div className="container">
          <div className="ir-tabs" role="tablist" aria-label={t('interiors.tabs.label')}>
            <button className={['ir-tab', tab==='bath' && 'is-active'].filter(Boolean).join(' ')} role="tab" aria-selected={tab==='bath'} onClick={()=>setTab('bath')}>
              {t('interiors.tabs.bath')}
            </button>
            <button className={['ir-tab', tab==='kitchen' && 'is-active'].filter(Boolean).join(' ')} role="tab" aria-selected={tab==='kitchen'} onClick={()=>setTab('kitchen')}>
              {t('interiors.tabs.kitchen')}
            </button>
          </div>

          {/* TAB PANES */}
          {tab === 'bath' ? (
            <div className="ir-pane">
              <h2 className="ir-h2">{t('interiors.bath.h')}</h2>
              <p className="ir-muted">{t('interiors.bath.p')}</p>
              <div className="ir-grid">
                <div className="ir-col">
                  <div className="ir-sub">{t('interiors.config.h')}</div>
                  <div className="ir-chiprow">
                    <Chip active={scope.demo} onClick={()=>setScope(s=>({ ...s, demo: !s.demo }))}>{t('interiors.config.demo')}</Chip>
                    <Chip active={scope.plumbing} onClick={()=>setScope(s=>({ ...s, plumbing: !s.plumbing }))}>{t('interiors.config.plumbing')}</Chip>
                    <Chip active={scope.electrical} onClick={()=>setScope(s=>({ ...s, electrical: !s.electrical }))}>{t('interiors.config.electrical')}</Chip>
                    <Chip active={scope.premiumTiles} onClick={()=>setScope(s=>({ ...s, premiumTiles: !s.premiumTiles }))}>{t('interiors.config.tiles')}</Chip>
                    <Chip active={scope.underfloor} onClick={()=>setScope(s=>({ ...s, underfloor: !s.underfloor }))}>{t('interiors.config.underfloor')}</Chip>
                    <Chip active={scope.grout} onClick={()=>setScope(s=>({ ...s, grout: !s.grout }))}>{t('interiors.config.grout')}</Chip>
                    <Chip active={scope.accessories} onClick={()=>setScope(s=>({ ...s, accessories: !s.accessories }))}>{t('interiors.config.accessories')}</Chip>
                  </div>
                  <div className="ir-result">
                    <div><strong>{t('interiors.calc.complexity')}</strong>: {complexity}</div>
                    <div><strong>{t('interiors.calc.timeline')}</strong>: {timeline}</div>
                    <div className="row mt-3">
                      <button className="btn" onClick={openOffer}>{t('interiors.calc.cta')}</button>
                    </div>
                  </div>
                </div>
                <div className="ir-col">
                  <BeforeAfter
                    before={bathBefore}
                    after={bathAfter}
                    altBefore={t('interiors.bath.altBefore')}
                    altAfter={t('interiors.bath.altAfter')}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="ir-pane">
              <h2 className="ir-h2">{t('interiors.kitchen.h')}</h2>
              <p className="ir-muted">{t('interiors.kitchen.p')}</p>
              <div className="ir-grid">
                <div className="ir-col">
                  <div className="ir-sub">{t('interiors.config.h')}</div>
                  <div className="ir-chiprow">
                    <Chip active={scope.demo} onClick={()=>setScope(s=>({ ...s, demo: !s.demo }))}>{t('interiors.config.kitchen.design')}</Chip>
                    <Chip active={scope.electrical} onClick={()=>setScope(s=>({ ...s, electrical: !s.electrical }))}>{t('interiors.config.kitchen.sitePrep')}</Chip>
                    <Chip active={scope.customCab} onClick={()=>setScope(s=>({ ...s, customCab: !s.customCab }))}>{t('interiors.config.kitchen.utils')}</Chip>
                    <Chip active={scope.plumbing} onClick={()=>setScope(s=>({ ...s, plumbing: !s.plumbing }))}>{t('interiors.config.kitchen.install')}</Chip>
                     <Chip active={scope.finish} onClick={()=>setScope(s=>({ ...s, finish: !s.finish }))}>{t('interiors.config.kitchen.finish')}</Chip>
                  </div>
                  <div className="ir-result">
                    <div><strong>{t('interiors.calc.complexity')}</strong>: {complexity}</div>
                    <div><strong>{t('interiors.calc.timeline')}</strong>: {timeline}</div>
                    <div className="row mt-3">
                      <button className="btn" onClick={openOffer}>{t('interiors.calc.cta')}</button>
                    </div>
                  </div>
                </div>
                <div className="ir-col">
                  <BeforeAfter
                    before={kitBefore}
                    after={kitAfter}
                    altBefore={t('interiors.kitchen.altBefore')}
                    altAfter={t('interiors.kitchen.altAfter')}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* WHY US (small) */}
      <section>
        <div className="container ir-why">
          <div className="ir-why-h">{t('interiors.why.h')}</div>
          <ul className="ir-why-list">
            <li>{t('interiors.why.item1')}</li>
            <li>{t('interiors.why.item2')}</li>
            <li>{t('interiors.why.item3')}</li>
          </ul>
        </div>
      </section>
    </main>
  )
}
