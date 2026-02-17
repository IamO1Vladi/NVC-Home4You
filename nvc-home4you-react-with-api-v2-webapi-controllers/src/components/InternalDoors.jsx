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

function ColorPicker({
  options,
  value,
  onChange,
  pillBg = 'rgba(255,255,255,.75)',
  ariaLabel = 'Door colour',
}) {
  const refs = React.useRef([])

  const move = (dir) => {
    const idx = Math.max(0, options.findIndex((o) => o.key === value))
    const next = (idx + dir + options.length) % options.length
    const nextKey = options[next]?.key
    if (!nextKey) return
    onChange(nextKey)
    // focus after state update flush
    window.requestAnimationFrame(() => refs.current[next]?.focus())
  }

  return (
    <div
      className="id-picker"
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
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  const options = React.useMemo(
    () => [
      {
        key: 'white',
        label: txt('internalDoors.colors.white', 'White'),
        swatch: '#D1D5DB',
        pillBg: 'rgba(255,255,255,.78)',
        img: '../../public/internal-doors/door-white.png',
      },
      {
        key: 'charcoal',
        label: txt('internalDoors.colors.charcoal', 'Charcoal'),
        swatch: '#4B5563',
        pillBg: 'rgba(31,41,55,.72)',
        img: '../../public/internal-doors/door-charcoal.png',
      },
      {
        key: 'sage',
        label: txt('internalDoors.colors.sage', 'Sage'),
        swatch: '#A3B18A',
        pillBg: 'rgba(163,177,138,.70)',
        img: '../../public/internal-doors/door-sage.png',
      },
    ],
    [txt]
  )

  const [color, setColor] = React.useState(options[0]?.key || 'white')
  const selected = options.find((o) => o.key === color) || options[0]

  // Fade-in on every image swap
  const [loaded, setLoaded] = React.useState(true)
  React.useEffect(() => {
    setLoaded(false)
  }, [color])

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
                'Modern, durable internal doors with curated finishes. Preview colour options instantly and request an offer.'
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

      {/* COLOUR PREVIEW */}
      <section>
        <div className="container">
          <div className="id-pane">
            <h2 className="id-h2">{txt('internalDoors.preview.h', 'Preview colours')}</h2>
            <p className="id-muted">{txt('internalDoors.preview.p', 'Tap a swatch to change the door finish.')}</p>

            <div className="id-grid">
              <div className="id-col">
                <div className="id-sub">{txt('internalDoors.details.h', 'What’s included')}</div>
                <ul className="id-list">
                  <li>{txt('internalDoors.details.li1', 'Door leaf + frame (standard or concealed)')}</li>
                  <li>{txt('internalDoors.details.li2', 'Hinges, handle set, lock, and seals')}</li>
                  <li>{txt('internalDoors.details.li3', 'Finish packs: matte, satin, or wood textures')}</li>
                </ul>

                <div className="id-sub mt-6">{txt('internalDoors.selected.h', 'Selected finish')}</div>
                <div className="id-selected">
                  <span className="id-swatch" style={{ '--sw': selected?.swatch }} aria-hidden="true" />
                  <div>
                    <div className="id-selected-name">{selected?.label}</div>
                    <div className="id-selected-meta">{txt('internalDoors.selected.meta', 'More colours available on request.')}</div>
                  </div>
                </div>

                <div className="row mt-6">
                  <button className="btn" onClick={openOffer}>
                    {txt('internalDoors.cta', 'Request a doors quote')}
                  </button>
                </div>
              </div>

              <div className="id-col">
                <div className="id-preview" aria-label="Door preview">
                  <img
                    className={['id-preview-img', loaded && 'is-loaded'].filter(Boolean).join(' ')}
                    src={selected?.img}
                    alt={txt('internalDoors.preview.alt', 'Internal door preview')}
                    onLoad={() => setLoaded(true)}
                    onError={(e) => {
                      e.currentTarget.src = fallback
                    }}
                  />

                  <ColorPicker
                    options={options}
                    value={color}
                    onChange={setColor}
                    pillBg={selected?.pillBg}
                    ariaLabel={txt('internalDoors.preview.aria', 'Door colour')}
                  />

                  <div className="id-preview-badge">{selected?.label}</div>
                </div>

                <div className="id-hint">{txt('internalDoors.hint', 'Tip: Add more presets by extending the “options” array.')}</div>
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
