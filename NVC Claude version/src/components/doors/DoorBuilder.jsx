// The doors page's builder (#izbor): type → model or lines → colour → frame → handle → trim →
// how many, the sizes, fitting and the town; then "Изпратете запитването" writes the choice into
// the page's own enquiry form (DoorsEnquiry) and takes the visitor there to add a name.
//
// It replaces the old visualiser, whose stock room renders showed doors NVC does not sell, whose
// "Брава" pictures were hinges and whose preview could stay invisible (an onLoad that had
// already fired for a cached image left it at opacity 0). Here the preview is a plain <img> of
// a real catalogue photo, always visible; a colour the catalogue has no photo of is shown as its
// printed sample beside the photo, and the caption says which colour the photo is — never a
// recoloured door.
//
// Every group is a fieldset of native radio buttons under a legend, so the keyboard (arrows
// within a group, Tab between groups) and screen readers get the platform's own radio group;
// the tiles are labels styled around them. The colour's two groups (the type's three standard
// colours and the 25 WPC colours on request) share one name, so they are one choice.
import React, { useId, useState } from 'react'
import { DOOR_FINISHES, DOOR_HANDLES, DOOR_TRIMS, FINISH_GROUP_NAMES } from '../../content/shared/doorsCatalogue.js'
import {
  BUILDER_TYPES,
  FRAME_WIDTHS_MM,
  STANDARD_FINISHES,
  chooseFinish,
  chooseModel,
  doorMessage,
  fill,
  formatNumber,
  hasModels,
  modelLabel,
  previewOf,
  quantityOf,
  trimOf,
} from './doorOptions.js'

const GROUP_ORDER = ['light', 'stone', 'dark', 'muted', 'solid', 'wood']

function Choice({ name, value, checked, onChange, className = '', children, label }) {
  return (
    <label className={`idp-opt ${className}`.trim()}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} aria-label={label} />
      <span className="idp-opt-face">{children}</span>
    </label>
  )
}

function Step({ n, legend, hint, hintId, children, className = '' }) {
  return (
    <fieldset className={`idp-step ${className}`.trim()} role="radiogroup" aria-describedby={hint ? hintId : undefined}>
      <legend className="idp-step-legend">
        <span className="idp-step-n" aria-hidden="true">{n}</span>
        {legend}
      </legend>
      {hint ? <p className="idp-step-hint" id={hintId}>{hint}</p> : null}
      {children}
    </fieldset>
  )
}

/**
 * @param locale     'bg' | 'en' | 'el'
 * @param content    the page content (range, colors, builder, message)
 * @param selection  the current choice (doorOptions.initialSelection's shape)
 * @param onChange   (next selection) => void
 * @param onSend     (message text) => void, after the quantity is checked
 */
export default function DoorBuilder({ locale = 'bg', content, selection: sel, onChange, onSend, id = 'izbor' }) {
  const c = content
  const b = c.builder
  const uid = useId().replace(/:/g, '')
  const name = (key) => `idp-${uid}-${key}`
  const [qtyError, setQtyError] = useState(false)
  const [wideOpen, setWideOpen] = useState(false)

  const view = previewOf(sel, locale, c.colors)
  const type = view.type
  const finish = sel.finishes[type.key]
  const set = (patch) => onChange({ ...sel, ...patch })
  const lang = (o) => (o ? o[locale] || o.en : '')
  // "32 × 4,6 мм" in Bulgarian and Greek, "32 × 4.6 mm" in English.
  const trimSize = (t) => fill(b.trimValue, { w: formatNumber(t.widthMm, locale), h: formatNumber(t.heightMm, locale) })

  let n = 0
  const next = () => { n += 1; return n }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!quantityOf(sel.qty)) {
      setQtyError(true)
      e.currentTarget.querySelector(`#${name('qty')}`)?.focus?.()
      return
    }
    setQtyError(false)
    onSend(doorMessage(sel, locale, c))
  }

  const trim = trimOf(sel.trim)
  const summary = [
    [b.type, c.range.types[type.key].name],
    // The colour's dot too, so the compact bar a phone keeps in view still shows a WPC colour.
    [b.finish, <>{view.swatch ? <span className="idp-swatch idp-swatch--sm" style={{ '--sw': view.swatch }} aria-hidden="true" /> : null}{view.finishName}</>],
    [b.frame, sel.frame ? fill(b.frameValue, { mm: sel.frame }) : b.none],
    [b.handle, sel.handle || b.none],
    [b.trim, trim ? trim.code : b.none],
    [b.qty, quantityOf(sel.qty) ? String(quantityOf(sel.qty)) : '—'],
  ]

  return (
    <section className="idp-builder-sec" id={id} aria-labelledby={`${id}-title`}>
      <div className="hp-container">
        <div className="hp-head">
          <div>
            <h2 id={`${id}-title`}>{b.heading}</h2>
            <p className="hp-sub">{b.sub}</p>
          </div>
        </div>

        <div className="idp-builder">
          <aside className="idp-preview" aria-label={b.preview}>
            <div className="hp-card idp-preview-card">
              <figure className="idp-stage">
                {/* A plain image, always visible: no opacity tied to onLoad (the old page's
                    invisible-preview bug). The key swaps the element when the photo changes. */}
                <img
                  key={view.photo.src}
                  src={view.photo.src}
                  alt={fill(c.range.photoAlt, { name: c.range.types[type.key].name, colour: view.photoColour })}
                  width="280"
                  height="600"
                  decoding="async"
                />
                {view.sample || (!view.matches && view.swatch) ? (
                  <span className="idp-stage-sample" aria-hidden="true">
                    {view.sample
                      ? <img src={view.sample} alt="" width="80" height="128" />
                      : <span className="idp-swatch idp-swatch--lg" style={{ '--sw': view.swatch }} />}
                    <span>{view.finishName}</span>
                  </span>
                ) : null}
                <figcaption className="idp-stage-cap">{fill(b.photoCaption, { colour: view.photoColour })}</figcaption>
              </figure>
              {/* The live region is always there and only its words change: a region inserted
                  already holding its text is often not announced. Empty, CSS hides it. */}
              <p className="idp-stage-note" role="status">
                {!view.matches ? fill(b.swatchNote, { colour: view.finishName, photo: view.photoColour }) : ''}
              </p>
              <h3 className="idp-sum-h">{b.summary}</h3>
              <dl className="idp-sum">
                {summary.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </div>
          </aside>

          <form className="idp-steps" onSubmit={onSubmit} noValidate aria-labelledby={`${id}-title`}>
            <Step n={next()} legend={b.type}>
              <div className="idp-grid idp-grid--types">
                {BUILDER_TYPES.map((t) => {
                  const std = STANDARD_FINISHES[t.key][0]
                  return (
                    <Choice
                      key={t.key}
                      name={name('type')}
                      value={t.key}
                      checked={sel.type === t.key}
                      onChange={() => set({ type: t.key })}
                      className="idp-opt--type"
                    >
                      <img src={t.photos[std.photo].src} alt="" width="56" height="120" loading="lazy" decoding="async" />
                      <span className="idp-opt-name">{c.range.types[t.key].name}</span>
                    </Choice>
                  )
                })}
              </div>
            </Step>

            {type.variants ? (
              <Step n={next()} legend={b.variant}>
                <div className="idp-chips">
                  {type.variants.map((v) => (
                    <Choice key={v.key} name={name('variant')} value={v.key} checked={sel.variant === v.key} onChange={() => set({ variant: v.key })} className="idp-opt--chip">
                      {c.range.variants[v.key]}
                    </Choice>
                  ))}
                </div>
              </Step>
            ) : null}

            {hasModels(type) ? (
              <Step n={next()} legend={b.model} hint={b.modelHint} hintId={name('model-hint')}>
                <div className="idp-grid idp-grid--models">
                  {type.photos.map((photo, i) => (
                    <Choice
                      key={photo.src}
                      name={name('model')}
                      value={String(i)}
                      checked={view.index === i}
                      onChange={() => onChange(chooseModel(sel, i))}
                      className="idp-opt--model"
                      label={modelLabel(type, i, locale, c)}
                    >
                      <img src={photo.src} alt="" width="48" height="104" loading="lazy" decoding="async" />
                      <span className="idp-opt-code">{fill(b.modelLabel, { n: i + 1 })}</span>
                    </Choice>
                  ))}
                </div>
              </Step>
            ) : null}

            <Step n={next()} legend={b.finish}>
              <p className="idp-sub-legend">{b.finishStandard}</p>
              <div className="idp-chips">
                {STANDARD_FINISHES[type.key].map((f) => (
                  <Choice
                    key={f.key}
                    name={name('finish')}
                    value={`std:${f.key}`}
                    checked={finish?.kind === 'std' && finish.key === f.key}
                    onChange={() => onChange(chooseFinish(sel, { kind: 'std', key: f.key }))}
                    className="idp-opt--chip"
                  >
                    <span className="idp-swatch" style={{ '--sw': f.swatch }} aria-hidden="true" />
                    {c.colors[f.key]}
                  </Choice>
                ))}
              </div>
              <details
                className="idp-more"
                open={wideOpen || finish?.kind === 'wpc'}
                onToggle={(e) => setWideOpen(e.currentTarget.open)}
              >
                <summary>{b.finishWide}</summary>
                <p className="idp-step-hint">{b.finishWideHint}</p>
                {GROUP_ORDER.map((group) => (
                  <div key={group} className="idp-wpc-group">
                    <p className="idp-sub-legend">{lang(FINISH_GROUP_NAMES[group])}</p>
                    <div className="idp-grid idp-grid--wpc">
                      {DOOR_FINISHES.filter((f) => f.group === group).map((f) => (
                        <Choice
                          key={f.code}
                          name={name('finish')}
                          value={`wpc:${f.code}`}
                          checked={finish?.kind === 'wpc' && finish.code === f.code}
                          onChange={() => onChange(chooseFinish(sel, { kind: 'wpc', code: f.code }))}
                          className="idp-opt--wpc"
                          label={`${f.code}, ${b.finishWideTag}`}
                        >
                          <img src={f.src} alt="" width="40" height="64" loading="lazy" decoding="async" style={{ background: f.swatch }} />
                          <span className="idp-opt-code">{f.code.replace('BJX-', '')}</span>
                        </Choice>
                      ))}
                    </div>
                  </div>
                ))}
              </details>
            </Step>

            <Step n={next()} legend={b.frame} hint={b.frameHint} hintId={name('frame-hint')}>
              <div className="idp-chips">
                <Choice name={name('frame')} value="" checked={!sel.frame} onChange={() => set({ frame: '' })} className="idp-opt--chip">{b.none}</Choice>
                {FRAME_WIDTHS_MM.map((mm) => (
                  <Choice key={mm} name={name('frame')} value={String(mm)} checked={sel.frame === String(mm)} onChange={() => set({ frame: String(mm) })} className="idp-opt--chip">
                    {fill(b.frameValue, { mm })}
                  </Choice>
                ))}
              </div>
            </Step>

            <Step n={next()} legend={b.handle} hint={b.handleHint} hintId={name('handle-hint')}>
              <div className="idp-grid idp-grid--hw">
                <Choice name={name('handle')} value="" checked={!sel.handle} onChange={() => set({ handle: '' })} className="idp-opt--hw idp-opt--none">
                  <span className="idp-opt-name">{b.none}</span>
                </Choice>
                {DOOR_HANDLES.map((h) => (
                  <Choice
                    key={h.code}
                    name={name('handle')}
                    value={h.code}
                    checked={sel.handle === h.code}
                    onChange={() => set({ handle: h.code })}
                    className="idp-opt--hw"
                    label={`${h.code}: ${lang(h.look)}`}
                  >
                    <img src={h.src} alt="" width="96" height="80" loading="lazy" decoding="async" />
                    <span className="idp-opt-code">{h.code}</span>
                  </Choice>
                ))}
              </div>
            </Step>

            <Step n={next()} legend={b.trim} hint={b.trimHint} hintId={name('trim-hint')}>
              <div className="idp-grid idp-grid--hw">
                <Choice name={name('trim')} value="" checked={!sel.trim} onChange={() => set({ trim: '' })} className="idp-opt--hw idp-opt--none">
                  <span className="idp-opt-name">{b.none}</span>
                </Choice>
                {DOOR_TRIMS.map((t) => (
                  <Choice
                    key={t.code}
                    name={name('trim')}
                    value={t.code}
                    checked={sel.trim === t.code}
                    onChange={() => set({ trim: t.code })}
                    className="idp-opt--hw idp-opt--drawing"
                    label={`${t.code}, ${trimSize(t)}`}
                  >
                    <img src={t.src} alt="" width="96" height="80" loading="lazy" decoding="async" />
                    <span className="idp-opt-code">{t.code}</span>
                    <span className="idp-opt-meta">{trimSize(t)}</span>
                  </Choice>
                ))}
              </div>
            </Step>

            <fieldset className="idp-step">
              <legend className="idp-step-legend">
                <span className="idp-step-n" aria-hidden="true">{next()}</span>
                {b.details}
              </legend>
              <div className="idp-fields">
                <div className="pe-field">
                  <label className="pe-label" htmlFor={name('qty')}>{b.qty}<span aria-hidden="true"> *</span></label>
                  <input
                    id={name('qty')}
                    name="qty"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={5}
                    required
                    value={sel.qty}
                    onChange={(e) => { set({ qty: e.target.value }); if (qtyError) setQtyError(false) }}
                    aria-invalid={qtyError ? 'true' : undefined}
                    aria-describedby={[name('qty-hint'), qtyError ? name('qty-error') : null].filter(Boolean).join(' ')}
                  />
                  <p className="pe-hint" id={name('qty-hint')}>{b.qtyHint}</p>
                  {qtyError ? <p className="pe-error" id={name('qty-error')} role="alert">{b.qtyError}</p> : null}
                </div>
                <div className="pe-field">
                  <label className="pe-label" htmlFor={name('town')}>{b.town} <span className="pe-optional">({b.optional})</span></label>
                  <input id={name('town')} name="town" autoComplete="address-level2" maxLength={80} value={sel.town} onChange={(e) => set({ town: e.target.value })} />
                </div>
                <div className="pe-field idp-field-wide">
                  <label className="pe-label" htmlFor={name('sizes')}>{b.sizes} <span className="pe-optional">({b.optional})</span></label>
                  <textarea id={name('sizes')} name="sizes" rows={2} maxLength={400} placeholder={b.sizesPlaceholder} value={sel.sizes} onChange={(e) => set({ sizes: e.target.value })} />
                </div>
                <fieldset className="pe-group idp-field-wide" role="radiogroup">
                  <legend className="pe-label">{b.fitting} <span className="pe-optional">({b.optional})</span></legend>
                  <div className="pe-chips">
                    {[['yes', b.fittingYes], ['no', b.fittingNo]].map(([v, label]) => (
                      <label key={v} className="pe-chip">
                        <input type="radio" name={name('fitting')} value={v} checked={sel.fitting === v} onChange={() => set({ fitting: v })} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </fieldset>

            <div className="idp-send">
              <button type="submit" className="hp-btn">{b.send}</button>
              <p className="pe-hint">{b.sendHint}</p>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
