import React from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import Modal from '../components/Modal.jsx'
import '../style/InternalDoors.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'

import { submitInBackground } from '../lib/backgroundSubmit.js'

const API_BASE = import.meta.env.VITE_API_BASE || ''

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

function ColorPicker({ options, value, onChange, pillBg = 'rgba(255,255,255,.75)', ariaLabel = 'Finish', position = 'bottom-right' }) {
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

function ThumbGrid({ options, value, onChange, ariaLabel, fallbackSrc }) {
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
    <div className="id-opt-grid" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt, i) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            className={['id-opt', active && 'is-active'].filter(Boolean).join(' ')}
            onClick={() => onChange(opt.key)}
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(-1)
              }
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(1)
              }
            }}
          >
            <img
              className="id-opt-img"
              src={cdnImage(opt.img, { width: 240 })}
              srcSet={cdnSrcSet(opt.img, [120, 240, 360])}
              sizes="120px"
              alt=""
              loading="lazy"
              onError={(e) => {
                if (fallbackSrc) e.currentTarget.src = fallbackSrc
              }}
            />
            <div className="id-opt-label">{opt.label}</div>
            {opt.meta ? <div className="id-opt-meta">{opt.meta}</div> : null}
          </button>
        )
      })}
    </div>
  )
}

function ConfigGroup({ title, hint, options, value, onChange, ariaLabel, fallbackSrc }) {
  const selected = options.find((o) => o.key === value) || options[0]

  return (
    <div className="id-group">
      <div className="id-group-h">{title}</div>
      {hint ? <div className="id-group-sub">{hint}</div> : null}

      <div className="id-choice">
        <div className="id-choice-preview" aria-label={`${title}: ${selected?.label || ''}`}>
          <img
            className="id-choice-img"
            src={cdnImage(selected?.img, { width: 600 })}
            srcSet={cdnSrcSet(selected?.img, [300, 450, 600, 900])}
            sizes="(max-width: 760px) 60vw, 360px"
            alt=""
            loading="lazy"
            onError={(e) => {
              if (fallbackSrc) e.currentTarget.src = fallbackSrc
            }}
          />
          <div className="id-choice-name">{selected?.label}</div>
        </div>

        <ThumbGrid
          options={options}
          value={value}
          onChange={onChange}
          ariaLabel={ariaLabel || title}
          fallbackSrc={fallbackSrc}
        />
      </div>
    </div>
  )
}

export default function InternalDoorsPage({ content }) {
  const { openOffer, openQuestion } = useModalActions()
  const asset = React.useCallback((p) => `${import.meta.env.BASE_URL}${p}`, [])
  const fallback = asset('modular-builds/card.svg')

  const decorLinesOptions = React.useMemo(
    () => [
      { key: 'white', label: content.colors.white, swatch: '#D0D0CC', pillBg: 'rgba(255,255,255,.78)', img: asset('internal-doors/decor-lines-white.webp') },
      { key: 'charcoal', label: content.colors.charcoal, swatch: '#53534E', pillBg: 'rgba(17,24,39,.62)', img: asset('internal-doors/decor-lines-charcoal.webp') },
      { key: 'sage', label: content.colors.sage, swatch: '#9EAB98', pillBg: 'rgba(158,171,152,.65)', img: asset('internal-doors/decor-lines-sage.webp') },
    ],
    [content.colors, asset]
  )

  const wallpaperOptions = React.useMemo(
    () => [
      { key: 'panelLight', label: content.panels.light, swatch: '#C3BCB1', pillBg: 'rgba(255,255,255,.70)', img: asset('internal-doors/wallpaper-light.webp') },
      { key: 'panelSmoked', label: content.panels.smoked, swatch: '#81796A', pillBg: 'rgba(17,24,39,.55)', img: asset('internal-doors/wallpaper-smoked.webp') },
      { key: 'panelDark', label: content.panels.dark, swatch: '#221D11', pillBg: 'rgba(17,24,39,.62)', img: asset('internal-doors/wallpaper-dark.webp') },
    ],
    [content.panels, asset]
  )

  const metalLinesOptions = React.useMemo(
    () => [
      { key: 'grey', label: content.colors.grey, swatch: '#7E7973', pillBg: 'rgba(255,255,255,.72)', img: asset('internal-doors/metal-lines-grey.webp') },
      { key: 'oak', label: content.colors.oak, swatch: '#C19C62', pillBg: 'rgba(193,156,98,.55)', img: asset('internal-doors/metal-lines-oak.webp') },
      { key: 'darkWood', label: content.colors.darkWood, swatch: '#44403C', pillBg: 'rgba(17,24,39,.62)', img: asset('internal-doors/metal-lines-dark.webp') },
    ],
    [content.colors, asset]
  )

  const glassOptions = React.useMemo(
    () => [
      { key: 'warmWhite', label: content.colors.warmWhite, swatch: '#DFD9D0', pillBg: 'rgba(255,255,255,.78)', img: asset('internal-doors/glass-warm-white.webp') },
      { key: 'grey', label: content.colors.grey, swatch: '#C2BFB9', pillBg: 'rgba(255,255,255,.70)', img: asset('internal-doors/glass-grey.webp') },
      { key: 'black', label: content.colors.black, swatch: '#1C170C', pillBg: 'rgba(17,24,39,.62)', img: asset('internal-doors/glass-black.webp') },
    ],
    [content.colors, asset]
  )

  const optionsByType = React.useMemo(
    () => ({
      decorLines: decorLinesOptions,
      wallpaper: wallpaperOptions,
      metalLines: metalLinesOptions,
      glass: glassOptions,
    }),
    [decorLinesOptions, wallpaperOptions, metalLinesOptions, glassOptions]
  )

  const typeItems = React.useMemo(
    () => [
      { key: 'decorLines', label: content.types.decorLines.label },
      { key: 'wallpaper', label: content.types.wallpaper.label },
      { key: 'metalLines', label: content.types.metalLines.label },
      { key: 'glass', label: content.types.glass.label },
    ],
    [content.types]
  )

  const typeCopy = React.useMemo(
    () => ({
      decorLines: { desc: content.types.decorLines.desc, features: content.types.decorLines.features, tag: content.types.decorLines.tag },
      wallpaper: { desc: content.types.wallpaper.desc, features: content.types.wallpaper.features, tag: content.types.wallpaper.tag },
      metalLines: { desc: content.types.metalLines.desc, features: content.types.metalLines.features, tag: content.types.metalLines.tag },
      glass: { desc: content.types.glass.desc, features: content.types.glass.features, tag: content.types.glass.tag },
    }),
    [content.types]
  )

  const [typeKey, setTypeKey] = React.useState('decorLines')
  const [finishByType, setFinishByType] = React.useState(() => ({
    decorLines: decorLinesOptions[0]?.key || 'white',
    wallpaper: wallpaperOptions.find((o) => o.key === 'panelDark')?.key || wallpaperOptions[0]?.key || 'panelDark',
    metalLines: metalLinesOptions[0]?.key || 'grey',
    glass: glassOptions[0]?.key || 'warmWhite',
  }))

  React.useEffect(() => {
    setFinishByType((prev) => {
      const next = { ...prev }
      Object.entries(optionsByType).forEach(([tk, opts]) => {
        const cur = next[tk]
        const ok = opts.some((o) => o.key === cur)
        if (!ok) {
          if (tk === 'wallpaper') next[tk] = opts.find((o) => o.key === 'panelDark')?.key || opts[0]?.key
          else next[tk] = opts[0]?.key
        }
      })
      return next
    })
  }, [optionsByType])

  const activeOptions = optionsByType[typeKey] || decorLinesOptions
  const activeFinishKey = finishByType[typeKey]
  const selected = activeOptions.find((o) => o.key === activeFinishKey) || activeOptions[0]
  const activeImg = selected?.img
  const setActiveFinishKey = (k) => setFinishByType((prev) => ({ ...prev, [typeKey]: k }))

  const frameOptions = React.useMemo(
    () => Object.entries(content.hardware.frame.options).map(([key, label]) => ({ key, label, img: asset(`internal-doors/hardware/frame-${key}.webp`) })),
    [content.hardware.frame.options, asset]
  )
  const handleOptions = React.useMemo(
    () => Object.entries(content.hardware.handle.options).map(([key, label]) => ({ key, label, img: asset(`internal-doors/hardware/handle-${key.replace('h', '')}.webp`) })),
    [content.hardware.handle.options, asset]
  )
  const trimOptions = React.useMemo(
    () => Object.entries(content.hardware.trim.options).map(([key, label]) => ({ key, label, img: asset(`internal-doors/hardware/trim-${key.replace('p', '')}.webp`) })),
    [content.hardware.trim.options, asset]
  )
  const lockOptions = React.useMemo(
    () => Object.entries(content.hardware.lock.options).map(([key, label]) => ({ key, label, img: asset(`internal-doors/hardware/lock-${key.replace('l', '')}.webp`) })),
    [content.hardware.lock.options, asset]
  )

  const [frameKey, setFrameKey] = React.useState(frameOptions[0]?.key || '70')
  const [handleKey, setHandleKey] = React.useState(handleOptions[0]?.key || 'h1')
  const [trimKey, setTrimKey] = React.useState(trimOptions[0]?.key || 'p1')
  const [lockKey, setLockKey] = React.useState(lockOptions[0]?.key || 'l1')

  const frameSelected = frameOptions.find((o) => o.key === frameKey) || frameOptions[0]
  const handleSelected = handleOptions.find((o) => o.key === handleKey) || handleOptions[0]
  const trimSelected = trimOptions.find((o) => o.key === trimKey) || trimOptions[0]
  const lockSelected = lockOptions.find((o) => o.key === lockKey) || lockOptions[0]

  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [projectDraft, setProjectDraft] = React.useState('')

  const typeLabel = typeItems.find((i) => i.key === typeKey)?.label || typeKey

  const makeProjectText = React.useCallback(() => {
    const lines = []
    lines.push(content.review.autoIntro)
    lines.push('')
    lines.push(`${content.types.h}: ${typeLabel}`)
    lines.push(`${content.review.labels.finish}: ${selected?.label || '—'}`)
    lines.push(`${content.hardware.summary.frame}: ${frameSelected?.label || '—'}`)
    lines.push(`${content.hardware.summary.handle}: ${handleSelected?.label || '—'}`)
    lines.push(`${content.hardware.summary.trim}: ${trimSelected?.label || '—'}`)
    lines.push(`${content.hardware.summary.lock}: ${lockSelected?.label || '—'}`)
    lines.push('')
    lines.push(`${content.review.fields.qty}:`)
    lines.push(`${content.review.fields.size}:`)
    lines.push(`${content.review.fields.addr}:`)
    lines.push(`${content.review.fields.notes}:`)
    return lines.join('\n')
  }, [content, typeLabel, selected?.label, frameSelected?.label, handleSelected?.label, trimSelected?.label, lockSelected?.label])

  const reviewItems = React.useMemo(
    () => [
      {
        key: 'door',
        label: content.review.labels.door,
        value: `${typeLabel}${selected?.label ? ` · ${selected.label}` : ''}`,
        img: activeImg,
        alt: content.preview.alt,
        fit: 'contain',
        swatch: selected?.swatch,
      },
      { key: 'frame', label: content.hardware.summary.frame, value: frameSelected?.label || '—', img: frameSelected?.img, alt: frameSelected?.label || '' },
      { key: 'handle', label: content.hardware.summary.handle, value: handleSelected?.label || '—', img: handleSelected?.img, alt: handleSelected?.label || '' },
      { key: 'trim', label: content.hardware.summary.trim, value: trimSelected?.label || '—', img: trimSelected?.img, alt: trimSelected?.label || '' },
      { key: 'lock', label: content.hardware.summary.lock, value: lockSelected?.label || '—', img: lockSelected?.img, alt: lockSelected?.label || '' },
    ],
    [content, typeLabel, selected, activeImg, frameSelected, handleSelected, trimSelected, lockSelected]
  )

  const openReview = () => {
    setReviewSent(false)
    setReviewError('')
    setProjectDraft(makeProjectText())
    setReviewOpen(true)
  }

  // Fire-and-forget, same as the site-wide offer/question modals (owner, 2026-08-18):
  // the modal closes on Send and the top-right banner owns the request from there — with
  // retries, so a phone in a dead spot is not the visitor's problem to notice.
  const submitReview = React.useCallback((e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      phone: fd.get('phone') || '',
      project: fd.get('project') || '',
      modelId: '',
    }
    if (!payload.name || !payload.email) return

    setReviewOpen(false)
    submitInBackground({
      url: API_BASE + '/api/offer',
      payload,
      labels: {
        sending: content.review.sending,
        retrying: content.review.sending,
        success: content.review.sent.h,
        error: content.review.error,
        retry: content.forms.submit,
        close: content.common.close,
      },
      // Success-only, like every other tracked event: a counted lead is one that arrived.
      onSuccess: () => {
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
          window.fbq('track', 'Lead', {
            content_name: 'Internal doors review request',
            content_category: 'Internal doors',
          })
        }
      },
    })
  }, [content.review, content.forms.submit, content.common.close])

  const [loaded, setLoaded] = React.useState(true)
  React.useEffect(() => {
    setLoaded(false)
  }, [activeImg])

  const heroHotspots = React.useMemo(
    () => [
      { id: 'fire', title: content.hero.fire.h, body: content.hero.fire.p },
      { id: 'sound', title: content.hero.sound.h, body: content.hero.sound.p },
      { id: 'water', title: content.hero.water.h, body: content.hero.water.p },
      {
        id: 'coat',
        title: content.hero.coating.h,
        body: content.hero.coating.p,
        swatches: ['#E7E5E4', '#111827', '#C7A56B', '#D1D5DB', '#A3B18A', '#6B7280', '#F5F5F4'],
      },
      { id: 'kit', title: content.hero.kit.h, body: content.hero.kit.p },
      { id: 'wpc', title: content.hero.wpc.h, body: content.hero.wpc.p },
    ],
    [content.hero]
  )

  const [openHotspot, setOpenHotspot] = React.useState(null)
  const [isNarrow, setIsNarrow] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(max-width: 960px)')
    const onChange = () => setIsNarrow(!!mq.matches)
    onChange()
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  React.useEffect(() => {
    if (!isNarrow || !openHotspot) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [openHotspot, isNarrow])

  const openHotspotData = React.useMemo(
    () => heroHotspots.find((h) => h.id === openHotspot) || null,
    [heroHotspots, openHotspot]
  )

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenHotspot(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="id">
      <section className="id-intro">
        <div className="container id-wide">
          <div className="id-intro-head">
            <h1 className="id-title">{content.title}</h1>
            <p className="id-lead">{content.lead}</p>

            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>{content.common.getOffer}</button>
              <button className="btn ghost" onClick={openQuestion}>{content.common.askQuestion}</button>
            </div>
          </div>

          <div className="id-intro-banner" aria-label={content.heroBanner.aria}>
            <div className="id-intro-media" onClick={() => setOpenHotspot(null)}>
              <img
                className="id-intro-bg"
                src={asset('internal-doors/clear.webp')}
                alt=""
                aria-hidden="true"
                loading="eager"
                onError={(e) => {
                  const img = e.currentTarget
                  const step = Number(img.dataset.step || '0')
                  if (step === 0) {
                    img.dataset.step = '1'
                    img.src = asset('clear.webp')
                    return
                  }
                  img.onerror = null
                  img.src = activeImg || fallback
                }}
              />
              <div className="id-intro-shade" aria-hidden="true" />

              <div className="id-intro-overlay" role="presentation">
                {heroHotspots.map((h) => {
                  const isOpen = openHotspot === h.id
                  return (
                    <div
                      key={h.id}
                      className={['id-hotspot', `id-hotspot--${h.id}`, isOpen && 'is-open'].filter(Boolean).join(' ')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="id-bubble"
                        onClick={() => setOpenHotspot((cur) => (cur === h.id ? null : h.id))}
                        aria-expanded={isOpen}
                        aria-controls={`id-pop-${h.id}`}
                        aria-label={h.title}
                        title={h.title}
                      >
                        <span className="id-bubble-label">{h.title}</span>
                      </button>

                      {isOpen && !isNarrow && (
                        <div id={`id-pop-${h.id}`} className="id-pop" role="dialog" aria-label={h.title}>
                          <button type="button" className="id-pop-close" aria-label={content.common.close} onClick={() => setOpenHotspot(null)}>✕</button>
                          <div className="id-pop-h">{h.title}</div>
                          <div className="id-pop-p">{h.body}</div>

                          {h.id === 'coat' && Array.isArray(h.swatches) && (
                            <div className="id-intro-swatches" aria-label={content.hero.coating.aria}>
                              {h.swatches.map((c) => (
                                <span key={c} className="id-intro-swatch" style={{ '--sw': c }} aria-hidden="true" />
                              ))}
                            </div>
                          )}

                          {h.id === 'kit' && (
                            <div className="id-pop-media">
                              <img
                                src={asset('internal-doors/kit.webp')}
                                alt={content.hero.kit.mediaAlt}
                                loading="lazy"
                                onError={(e) => {
                                  const img = e.currentTarget
                                  const step = Number(img.dataset.step || '0')
                                  if (step === 0) {
                                    img.dataset.step = '1'
                                    img.src = asset('kit.webp')
                                    return
                                  }
                                  img.onerror = null
                                  img.src = fallback
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {isNarrow && openHotspotData && (
            <div className="id-hotmodal" role="dialog" aria-modal="true" aria-label={openHotspotData.title} onClick={() => setOpenHotspot(null)}>
              <div className="id-hotsheet" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="id-hotsheet-close" aria-label={content.common.close} onClick={() => setOpenHotspot(null)}>✕</button>
                <div id={`id-pop-${openHotspotData.id}`}>
                  <div className="id-hotsheet-h">{openHotspotData.title}</div>
                  <div className="id-hotsheet-p">{openHotspotData.body}</div>

                  {openHotspotData.id === 'coat' && Array.isArray(openHotspotData.swatches) && (
                    <div className="id-intro-swatches" aria-label={content.hero.coating.aria}>
                      {openHotspotData.swatches.map((c) => (
                        <span key={c} className="id-intro-swatch" style={{ '--sw': c }} aria-hidden="true" />
                      ))}
                    </div>
                  )}

                  {openHotspotData.id === 'kit' && (
                    <div className="id-sheet-media">
                      <img
                        src={asset('internal-doors/kit.webp')}
                        alt={content.hero.kit.mediaAlt}
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget
                          const step = Number(img.dataset.step || '0')
                          if (step === 0) {
                            img.dataset.step = '1'
                            img.src = asset('kit.webp')
                            return
                          }
                          img.onerror = null
                          img.src = fallback
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="container id-wide">
          <div className="id-pane">
            <h2 className="id-h2">{content.preview.h}</h2>
            <p className="id-muted">{content.preview.p2}</p>

            <div className="id-showcase" aria-label={content.preview.sectionAria}>
              <div className="id-showcase-media">
                <div className="id-preview id-preview--tall" aria-label={content.preview.imageAria}>
                  <img
                    className={['id-preview-img', loaded && 'is-loaded'].filter(Boolean).join(' ')}
                    src={cdnImage(activeImg, { width: 900 })}
                    srcSet={cdnSrcSet(activeImg, [450, 700, 900, 1200])}
                    sizes="(max-width: 900px) 90vw, 560px"
                    alt={content.preview.alt}
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
                    ariaLabel={typeKey === 'wallpaper' ? content.preview.ariaPanel : content.preview.ariaDoor}
                    position="bottom-right"
                  />

                  <div className="id-preview-badge">{selected?.label}</div>
                </div>
              </div>

              <div className="id-showcase-controls">
                <div className="id-sub">{content.types.h}</div>
                <TypeTabs items={typeItems} value={typeKey} onChange={(k) => setTypeKey(k)} ariaLabel={content.types.aria} />
                <p className="id-type-desc">{typeCopy[typeKey]?.desc}</p>
              </div>

              <div className="id-showcase-details">
                <div className="id-sub">{content.details.h}</div>
                <ul className="id-list">
                  {(typeCopy[typeKey]?.features || []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>

                <div className="id-sub mt-6">{content.selected.h}</div>
                <div className="id-selected">
                  <span className="id-swatch" style={{ '--sw': selected?.swatch }} aria-hidden="true" />
                  <div>
                    <div className="id-selected-name">{selected?.label}</div>
                    <div className="id-selected-meta">{content.selected.meta}</div>
                  </div>
                </div>

                <div className="row mt-6">
                  <button className="btn" onClick={openOffer}>{content.cta}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container id-wide">
          <div className="id-hw">
            <h2 className="id-h2">{content.hardware.h}</h2>
            <p className="id-muted">{content.hardware.p}</p>

            <div className="id-hw-grid">
              <ConfigGroup title={content.hardware.frame.h} hint={content.hardware.frame.hint} options={frameOptions} value={frameKey} onChange={setFrameKey} ariaLabel={content.hardware.frame.aria} fallbackSrc={fallback} />
              <ConfigGroup title={content.hardware.handle.h} hint={content.hardware.handle.hint} options={handleOptions} value={handleKey} onChange={setHandleKey} ariaLabel={content.hardware.handle.aria} fallbackSrc={fallback} />
              <ConfigGroup title={content.hardware.trim.h} hint={content.hardware.trim.hint} options={trimOptions} value={trimKey} onChange={setTrimKey} ariaLabel={content.hardware.trim.aria} fallbackSrc={fallback} />
              <ConfigGroup title={content.hardware.lock.h} hint={content.hardware.lock.hint} options={lockOptions} value={lockKey} onChange={setLockKey} ariaLabel={content.hardware.lock.aria} fallbackSrc={fallback} />
            </div>

            <div className="id-hw-summary" aria-label={content.hardware.summaryAria}>
              <div className="id-hw-pill">{content.hardware.summary.frame}: <strong>{frameSelected?.label}</strong></div>
              <div className="id-hw-pill">{content.hardware.summary.handle}: <strong>{handleSelected?.label}</strong></div>
              <div className="id-hw-pill">{content.hardware.summary.trim}: <strong>{trimSelected?.label}</strong></div>
              <div className="id-hw-pill">{content.hardware.summary.lock}: <strong>{lockSelected?.label}</strong></div>
            </div>

            <div className="row mt-6">
              <button className="btn" onClick={openReview}>{content.review.cta}</button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container id-why">
          <div className="id-why-h">{content.why.h}</div>
          <ul className="id-why-list">
            {content.why.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title={content.review.title} closeLabel={content.common.close}>
        {/* No in-modal outcome screen any more: the modal closes on Send, and the
            top-right banner owns the request from there (see submitReview). */}
        <form className="grid" style={{ gap: 10 }} onSubmit={submitReview}>
            <div className="id-review-grid" aria-label={content.review.summaryAria}>
              {reviewItems.map((it) => (
                <div className="id-review-item" key={it.key}>
                  <div className={['id-review-thumb', it.fit === 'contain' && 'is-contain'].filter(Boolean).join(' ')}>
                    {it.img ? (
                      <img
                        src={cdnImage(it.img, { width: 160 })}
                        srcSet={cdnSrcSet(it.img, [120, 160, 240])}
                        sizes="80px"
                        alt={it.alt || it.label || ''}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = fallback
                        }}
                      />
                    ) : (
                      <span className="id-review-thumb-fallback" aria-hidden="true">—</span>
                    )}
                  </div>

                  <div className="id-review-meta">
                    <div className="id-review-k">{it.label}</div>
                    <div className="id-review-v">{it.value}</div>
                  </div>

                  {it.swatch && <span className="id-review-swatch" style={{ '--sw': it.swatch }} aria-hidden="true" />}
                </div>
              ))}
            </div>

            <input name="name" required placeholder={content.forms.name} autoComplete="name" />
            <input name="email" type="email" required placeholder={content.forms.email} autoComplete="email" />
            <input name="phone" placeholder={content.forms.phone} autoComplete="tel" />
            <textarea name="project" rows="6" required placeholder={content.forms.project} value={projectDraft} onChange={(e) => setProjectDraft(e.target.value)} />

            <button className="btn" type="submit">{content.forms.submit}</button>

            <div className="id-review-note">{content.review.note}</div>
        </form>
      </Modal>
    </main>
  )
}
