import React from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import './InternalDoors.css'

function useText() {
  const { t } = useI18n()
  return React.useCallback(
    (key, fallback) => {
      const v = t(key)
      return typeof v === 'string' ? v : fallback
    },
    [t]
  )
}

function TypeTabs({ items, value, onChange, ariaLabel = 'Door type' }) {
  return (
    <div className="id-type-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((it) => {
        const active = it.key === value
        return (
          <button
            key={it.key}
            type="button"
            className={['id-type-tab', active && 'is-active'].filter(Boolean).join(' ')}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function ColorPicker({
  options,
  value,
  onChange,
  pillBg = 'rgba(255,255,255,.75)',
  ariaLabel = 'Finish',
  position = 'bottom-right', // 'top-right' | 'bottom-right'
}) {
  const refs = React.useRef([])

  const move = (dir) => {
    const idx = Math.max(0, options.findIndex((o) => o.key === value))
    const next = (idx + dir + options.length) % options.length
    const nextKey = options[next]?.key
    if (!nextKey) return
    onChange(nextKey)
    window.requestAnimationFrame(() => refs.current[next]?.focus())
  }

  return (
    <div
      className={['id-picker', position === 'bottom-right' && 'is-bottom'].filter(Boolean).join(' ')}
      style={{ '--pill': pillBg }}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt, i) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            className={['id-dot', active && 'is-active'].filter(Boolean).join(' ')}
            style={{ '--dot': opt.swatch }}
            onClick={() => onChange(opt.key)}
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                move(-1)
              }
              if (e.key === 'ArrowRight') {
                e.preventDefault()
                move(1)
              }
            }}
          />
        )
      })}
    </div>
  )
}

export default function InternalDoors() {
  const { openOffer, openQuestion } = useModalActions()
  const txt = useText()
  const asset = React.useCallback((p) => `${import.meta.env.BASE_URL}${p}`, [])
  const fallback = asset('modular-builds/card.svg')

  // TYPE 1: Standard doors (living room scene)
  const standardOptions = React.useMemo(
    () => [
      {
        key: 'white',
        label: txt('internalDoors.colors.white', 'White'),
        swatch: '#D1D5DB',
        pillBg: 'rgba(255,255,255,.78)',
        img: asset('internal-doors/door-white.png'),
      },
      {
        key: 'charcoal',
        label: txt('internalDoors.colors.charcoal', 'Charcoal'),
        swatch: '#4B5563',
        pillBg: 'rgba(31,41,55,.72)',
        img: asset('internal-doors/door-charcoal.png'),
      },
      {
        key: 'sage',
        label: txt('internalDoors.colors.sage', 'Sage'),
        swatch: '#A3B18A',
        pillBg: 'rgba(163,177,138,.70)',
        img: asset('internal-doors/door-sage.png'),
      },
    ],
    [txt, asset]
  )

  // TYPE 2: Decorative panels / concealed door scene
  const panelOptions = React.useMemo(
    () => [
      {
        key: 'panelLight',
        label: txt('internalDoors.panels.light', 'Light'),
        swatch: '#B8B1A6',
        pillBg: 'rgba(255,255,255,.70)',
        img: asset('internal-doors/panels-light.png'),
      },
      {
        key: 'panelSmoked',
        label: txt('internalDoors.panels.smoked', 'Smoked'),
        swatch: '#6A6358',
        pillBg: 'rgba(17,24,39,.62)',
        img: asset('internal-doors/panels-mid.png'),
      },
      {
        key: 'panelDark',
        label: txt('internalDoors.panels.dark', 'Dark'),
        swatch: '#1F1B14',
        pillBg: 'rgba(17,24,39,.62)',
        img: asset('internal-doors/panels-dark.png'),
      },
    ],
    [txt, asset]
  )

  const typeItems = React.useMemo(
    () => [
      { key: 'standard', label: txt('internalDoors.types.standard', 'Standard doors') },
      { key: 'panels', label: txt('internalDoors.types.panels', 'Decorative panels') },
    ],
    [txt]
  )

  const typeCopy = React.useMemo(
    () => ({
      standard: {
        desc: txt(
          'internalDoors.types.standardDesc',
          'Classic internal doors in curated painted finishes — ideal for bedrooms, bathrooms and offices.'
        ),
        features: [
          txt('internalDoors.types.standardFeat1', 'Door leaf + frame (standard or concealed)'),
          txt('internalDoors.types.standardFeat2', 'Solid / hollow core options'),
          txt('internalDoors.types.standardFeat3', 'Hardware sets: hinges, handle, lock, seals'),
        ],
        tag: txt('internalDoors.types.standardTag', 'Standard door'),
      },
      panels: {
        desc: txt(
          'internalDoors.types.panelsDesc',
          'Decorative wall panels with an integrated door — perfect for feature walls and hidden/flush openings.'
        ),
        features: [
          txt('internalDoors.types.panelsFeat1', 'Wall panel system with integrated door leaf'),
          txt('internalDoors.types.panelsFeat2', 'Flush / concealed frame options'),
          txt('internalDoors.types.panelsFeat3', 'Matched finish across door + surrounding panels'),
        ],
        tag: txt('internalDoors.types.panelsTag', 'Decorative panels'),
      },
    }),
    [txt]
  )

  // Door type state
  const [typeKey, setTypeKey] = React.useState('standard')

  // Keep a selected finish per type (so switching type keeps the last choice)
  // Default panels to DARK so "switching type" goes straight to the dark scene.
  const [finishByType, setFinishByType] = React.useState(() => ({
    standard: standardOptions[0]?.key || 'white',
    panels: panelOptions.find((o) => o.key === 'panelDark')?.key || panelOptions[0]?.key || 'panelDark',
  }))

  // In case options change and a key disappears, recover gracefully
  React.useEffect(() => {
    setFinishByType((prev) => {
      const next = { ...prev }
      if (!standardOptions.some((o) => o.key === next.standard)) next.standard = standardOptions[0]?.key || 'white'
      if (!panelOptions.some((o) => o.key === next.panels))
        next.panels = panelOptions.find((o) => o.key === 'panelDark')?.key || panelOptions[0]?.key || 'panelDark'
      return next
    })
  }, [standardOptions, panelOptions])

  const activeOptions = typeKey === 'standard' ? standardOptions : panelOptions
  const activeFinishKey = finishByType[typeKey]
  const selected = activeOptions.find((o) => o.key === activeFinishKey) || activeOptions[0]
  const activeImg = selected?.img

  const setActiveFinishKey = (k) => setFinishByType((prev) => ({ ...prev, [typeKey]: k }))

  // Fade-in on every src swap (type or colour)
  const [loaded, setLoaded] = React.useState(true)
  React.useEffect(() => {
    setLoaded(false)
  }, [activeImg])

  return (
    <main className="id">
      {/* HERO */}
      <section className="id-hero">
        <div className="container id-hero-grid">
          <div>
            <h1 className="id-title">{txt('internalDoors.title', 'Internal doors')}</h1>
            <p className="id-lead">
              {txt(
                'internalDoors.lead',
                'Modern internal doors with curated finishes. Switch door type and preview colour presets instantly.'
              )}
            </p>
            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>
                {txt('nav.getOffer', 'Get an Offer')}
              </button>
              <button className="btn ghost" onClick={openQuestion}>
                {txt('nav.askQuestion', 'Ask a Question')}
              </button>
            </div>
          </div>

          <aside className="id-card">
            <div className="id-card-h">{txt('internalDoors.quick.h', 'Quick facts')}</div>
            <ul className="id-card-list">
              <li>{txt('internalDoors.quick.item1', 'Standard + made-to-measure sizes')}</li>
              <li>{txt('internalDoors.quick.item2', 'Solid / hollow core options')}</li>
              <li>{txt('internalDoors.quick.item3', 'Soft-close & modern hardware')}</li>
            </ul>
            <div className="id-card-note">{txt('internalDoors.quick.note', 'Ask for fire rating and acoustic specs.')}</div>
          </aside>
        </div>
      </section>

      {/* CONFIG + PREVIEW (Image LEFT, Info RIGHT) */}
      <section>
        <div className="container id-wide">
          <div className="id-pane">
            <h2 className="id-h2">{txt('internalDoors.preview.h', 'Choose your door')}</h2>
            <p className="id-muted">
              {txt(
                'internalDoors.preview.p2',
                'Use the Door Type toggle to swap styles. Then use the swatches on the image to change the finish.'
              )}
            </p>

            <div className="id-showcase" aria-label="Internal doors preview and configuration">
              {/* LEFT: big image */}
              <div className="id-showcase-media">
                <div className="id-preview id-preview--tall" aria-label="Door preview">
                  <img
                    className={['id-preview-img', loaded && 'is-loaded'].filter(Boolean).join(' ')}
                    src={activeImg}
                    alt={txt('internalDoors.preview.alt', 'Internal door preview')}
                    onLoad={() => setLoaded(true)}
                    onError={(e) => {
                      e.currentTarget.src = fallback
                    }}
                  />

                  <div className="id-preview-tag">{typeCopy[typeKey]?.tag}</div>

                  <ColorPicker
                    options={activeOptions}
                    value={activeFinishKey}
                    onChange={setActiveFinishKey}
                    pillBg={selected?.pillBg}
                    ariaLabel={typeKey === 'standard' ? txt('internalDoors.preview.ariaDoor', 'Door colour') : txt('internalDoors.preview.ariaPanel', 'Panel finish')}
                    position="bottom-right"
                  />

                  <div className="id-preview-badge">{selected?.label}</div>
                </div>
              </div>

              {/* RIGHT: info + type selector */}
              <div className="id-showcase-info">
                <div className="id-sub">{txt('internalDoors.types.h', 'Door type')}</div>
                <TypeTabs
                  items={typeItems}
                  value={typeKey}
                  onChange={(k) => setTypeKey(k)}
                  ariaLabel={txt('internalDoors.types.aria', 'Door type')}
                />
                <p className="id-type-desc">{typeCopy[typeKey]?.desc}</p>

                <div className="id-sub mt-6">{txt('internalDoors.details.h', 'What’s included')}</div>
                <ul className="id-list">
                  {(typeCopy[typeKey]?.features || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>

                <div className="id-sub mt-6">{txt('internalDoors.selected.h', 'Selected finish')}</div>
                <div className="id-selected">
                  <span className="id-swatch" style={{ '--sw': selected?.swatch }} aria-hidden="true" />
                  <div>
                    <div className="id-selected-name">{selected?.label}</div>
                    <div className="id-selected-meta">
                      {txt('internalDoors.selected.meta', 'More colours available on request.')}
                    </div>
                  </div>
                </div>

                <div className="row mt-6">
                  <button className="btn" onClick={openOffer}>
                    {txt('internalDoors.cta', 'Request a doors quote')}
                  </button>
                </div>

                <div className="id-hint">
                  {txt('internalDoors.hint2', 'Tip: Add more door types by introducing a new options array and extending typeItems/typeCopy.')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section>
        <div className="container id-why">
          <div className="id-why-h">{txt('internalDoors.why.h', 'Why source doors through us')}</div>
          <ul className="id-why-list">
            <li>{txt('internalDoors.why.li1', 'Matched finishes across floors, panels, and furniture packs.')}</li>
            <li>{txt('internalDoors.why.li2', 'Lead time coordination with delivery & installation.')}</li>
            <li>{txt('internalDoors.why.li3', 'Clear specs: hinges, locks, fire rating, acoustics.')}</li>
          </ul>
        </div>
      </section>
    </main>
  )
}
