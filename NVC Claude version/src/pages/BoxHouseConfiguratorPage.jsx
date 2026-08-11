import React from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import { euro, getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import '../style/BoxHouseConfigurator.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { writeConfiguratorPrefill } from '../lib/configPrefill.js'
import { trackEvent } from '../lib/analytics.js'
import { saveConfig, loadSavedConfig, clearSavedConfig } from '../lib/configPersistence.js'
import { buildShareUrl, readSharedConfigFromHash, readShortCodeFromSearch, createShortLink, resolveShortLink, emailMyConfig, isLikelyEmail } from '../lib/configShare.js'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const STEP_KEYS = ['model', 'layout', 'exterior', 'interior', 'sockets', 'summary']

// Which accordion section opens first when a step is shown on mobile.
const MOBILE_DEFAULT_SECTION = {
  model: 'model',
  layout: 'layout',
  exterior: 'panels',
  interior: 'panels',
  sockets: 'place',
  summary: 'overview',
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function multilineHtml(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br/>')
}

function StepRail({ steps, activeIndex, onGo }) {
  return (
    <div className="bhc-rail" role="tablist" aria-label="Configurator steps">
      {steps.map((step, index) => {
        const active = index === activeIndex
        const complete = index < activeIndex
        return (
          <button
            key={step.key}
            type="button"
            className={['bhc-rail-step', active && 'is-active', complete && 'is-complete'].filter(Boolean).join(' ')}
            onClick={() => onGo(index)}
            role="tab"
            aria-selected={active}
          >
            <span className="bhc-rail-num">{index + 1}</span>
            <span className="bhc-rail-label">{step.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ChoiceCard({ active, title, subtitle, image, onClick, badge, note }) {
  return (
    <button type="button" className={['bhc-card', active && 'is-active'].filter(Boolean).join(' ')} onClick={onClick}>
      {image ? (
        <div className="bhc-card-media">
          <img src={cdnImage(image, { width: 600 })} srcSet={cdnSrcSet(image, [300, 450, 600, 900])} sizes="(max-width: 700px) 45vw, 300px" alt="" loading="lazy" decoding="async" />
          {badge ? <span className="bhc-card-badge">{badge}</span> : null}
        </div>
      ) : null}
      <div className="bhc-card-body">
        <div className="bhc-card-title">{title}</div>
        {subtitle ? <div className="bhc-card-subtitle">{subtitle}</div> : null}
        {note ? <div className="bhc-card-note">{note}</div> : null}
        {/* Without artwork the badge has no media strip to sit on, so the
            price would silently disappear -- show it inline instead. */}
        {badge && !image ? <div className="bhc-card-inline-badge">{badge}</div> : null}
      </div>
    </button>
  )
}

function MaterialPreviewCard({ title, image, label, swatch, subtitle }) {
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    setFailed(false)
  }, [image])

  const showImage = Boolean(image) && !failed

  return (
    <div className="bhc-selection-card bhc-selection-card--material">
      <div className="bhc-selection-card-head">{title}</div>
      {showImage ? (
        <img src={cdnImage(image, { width: 500 })} srcSet={cdnSrcSet(image, [250, 400, 500, 700])} sizes="(max-width: 700px) 45vw, 280px" alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="bhc-selection-card-placeholder" style={{ '--sw': swatch || '#d7dce4' }} aria-hidden="true" />
      )}
      <div className="bhc-selection-card-caption">
        <strong>{label || '-'}</strong>
        {/* Coded options with no descriptive name would otherwise print the
            same string twice. */}
        {subtitle && subtitle !== label ? <span>{subtitle}</span> : null}
      </div>
    </div>
  )
}

function SwatchButton({ active, label, swatch, onClick }) {
  return (
    <button type="button" className={['bhc-swatch-btn', active && 'is-active'].filter(Boolean).join(' ')} onClick={onClick}>
      <span className="bhc-swatch-dot" style={{ '--sw': swatch }} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

function ThumbChoiceButton({ active, label, image, swatch, onClick, hideLabel = false }) {
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    setFailed(false)
  }, [image])

  const showImage = Boolean(image) && !failed

  return (
    <button
      type="button"
      className={['bhc-thumb-btn', active && 'is-active', hideLabel && 'is-image-only'].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <span className="bhc-thumb-btn-media">
        {showImage ? <img src={cdnImage(image, { width: 200 })} srcSet={cdnSrcSet(image, [120, 200, 300])} sizes="100px" alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="bhc-thumb-btn-fill" style={{ '--sw': swatch }} aria-hidden="true" />}
      </span>
      {!hideLabel ? <span className="bhc-thumb-btn-label">{label}</span> : null}
    </button>
  )
}

// A long decor list, shown a manageable slice at a time.
//
// Where the catalogue groups its decors into series the picker offers those as
// a category select; where it doesn't, it shows a first page with a "show all".
// Either way the buyer never faces 135 tiles at once.
function GroupedOptionGrid({
  options,
  value,
  onSelect,
  categoryLabel,
  showAllLabel,
  gridClassName = 'bhc-thumb-choice-grid',
  pageSize = 12,
  renderOption,
}) {
  const groups = React.useMemo(() => {
    const out = []
    options.forEach((item) => {
      const label = item.group || ''
      let group = out.find((g) => g.label === label)
      if (!group) {
        group = { label, options: [] }
        out.push(group)
      }
      group.options.push(item)
    })
    return out
  }, [options])

  const grouped = groups.length > 1
  const groupOfValue = React.useMemo(
    () => groups.findIndex((g) => g.options.some((item) => item.key === value)),
    [groups, value]
  )

  const [activeIndex, setActiveIndex] = React.useState(() => Math.max(0, groupOfValue))
  const [expanded, setExpanded] = React.useState(false)

  // Follow the selection when it changes from elsewhere (a reset, a shared
  // link), so the picker opens on the group holding the current pick. Keyed on
  // the value rather than the derived index, or browsing to another category
  // would immediately snap back to wherever the current selection lives.
  const lastValue = React.useRef(value)
  React.useEffect(() => {
    if (lastValue.current === value) return
    lastValue.current = value
    if (groupOfValue >= 0) setActiveIndex(groupOfValue)
  }, [value, groupOfValue])

  React.useEffect(() => { setExpanded(false) }, [activeIndex])

  const active = groups[Math.min(activeIndex, groups.length - 1)] || { options: [] }
  const all = active.options
  const hidden = Math.max(0, all.length - pageSize)
  const visible = expanded || !hidden ? all : all.slice(0, pageSize)

  return (
    <>
      {grouped ? (
        <label className="bhc-series-picker">
          <span className="bhc-series-picker-label">{categoryLabel}</span>
          <select
            className="bhc-select"
            value={String(activeIndex)}
            onChange={(event) => setActiveIndex(Number(event.target.value))}
          >
            {groups.map((group, index) => (
              <option key={group.label || index} value={index}>
                {group.label || '—'} ({group.options.length})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className={gridClassName}>
        {visible.map((item) => renderOption(item))}
      </div>
      {hidden && !expanded ? (
        <button type="button" className="bhc-show-all" onClick={() => setExpanded(true)}>
          {showAllLabel.replace('{n}', String(all.length))}
        </button>
      ) : null}
    </>
  )
}

function NumberField({ label, value, onChange, min = 0, max = 99 }) {
  return (
    <label className="bhc-number-field">
      <span>{label}</span>
      <div className="bhc-number-box">
        <button type="button" onClick={() => onChange(Math.max(min, Number(value || 0) - 1))}>−</button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value || 0))))}
        />
        <button type="button" onClick={() => onChange(Math.min(max, Number(value || 0) + 1))}>+</button>
      </div>
    </label>
  )
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className="bhc-summary-row">
      <span>{label}</span>
      <span className={strong ? 'is-strong' : ''}>{value}</span>
    </div>
  )
}

function MobileOverviewTray({ title, image, children }) {
  return (
    <div className="bhc-mobile-tray bhc-mobile-only">
      <div className="bhc-mobile-tray-head">{title}</div>
      <div className={['bhc-mobile-tray-body', image && 'has-image'].filter(Boolean).join(' ')}>
        {image ? <img className="bhc-mobile-tray-image" src={cdnImage(image, { width: 500 })} srcSet={cdnSrcSet(image, [250, 400, 500, 700])} sizes="(max-width: 700px) 90vw, 400px" alt="" decoding="async" /> : null}
        <div className="bhc-mobile-tray-content">{children}</div>
      </div>
    </div>
  )
}

function MobileMiniChoice({ title, image, label, subtitle, swatch }) {
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    setFailed(false)
  }, [image])

  const showImage = Boolean(image) && !failed

  return (
    <div className="bhc-mobile-choice">
      <div className="bhc-mobile-choice-head">{title}</div>
      {showImage ? (
        <img className="bhc-mobile-choice-image" src={cdnImage(image, { width: 300 })} srcSet={cdnSrcSet(image, [160, 240, 300])} sizes="150px" alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="bhc-mobile-choice-image bhc-mobile-choice-image--swatch" style={{ '--sw': swatch || '#d7dce4' }} aria-hidden="true" />
      )}
      <div className="bhc-mobile-choice-copy">
        <strong>{label || '-'}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
    </div>
  )
}

function OptionTile({ active, title, subtitle, onClick, swatch, badge }) {
  return (
    <button type="button" className={['bhc-option-tile', active && 'is-active'].filter(Boolean).join(' ')} onClick={onClick}>
      <div className="bhc-option-head">
        <div className="bhc-option-main">
          {swatch ? <span className="bhc-swatch-dot" style={{ '--sw': swatch }} aria-hidden="true" /> : null}
          <span className="bhc-option-title">{title}</span>
        </div>
        {badge ? <span className="bhc-option-badge">{badge}</span> : null}
      </div>
      {subtitle ? <div className="bhc-option-subtitle">{subtitle}</div> : null}
    </button>
  )
}


function MobileDisclosure({ title, summary, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className={['bhc-mobile-disclosure', open && 'is-open'].filter(Boolean).join(' ')}>
      <button type="button" className="bhc-mobile-disclosure-btn" onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
        <span className="bhc-mobile-disclosure-copy">
          <span className="bhc-mobile-disclosure-title">{title}</span>
          {summary ? <span className="bhc-mobile-disclosure-summary">{summary}</span> : null}
        </span>
        <span className="bhc-mobile-disclosure-icon" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="bhc-mobile-disclosure-body">{children}</div> : null}
    </div>
  )
}

function MobileHeroPreview({ image, title, subtitle, chips = [], contain = false }) {
  return (
    <div className="bhc-mobile-hero-card">
      {image ? <img className={['bhc-mobile-hero-image', contain && 'bhc-mobile-hero-image--contain'].filter(Boolean).join(' ')} src={cdnImage(image, { width: 700 })} srcSet={cdnSrcSet(image, [360, 540, 700, 960])} sizes="(max-width: 700px) 100vw, 600px" alt="" loading="lazy" decoding="async" /> : null}
      <div className="bhc-mobile-hero-copy">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {chips.length ? (
          <div className="bhc-mobile-chip-row">
            {chips.filter(Boolean).map((chip) => <span key={chip} className="bhc-mini-chip">{chip}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Compact progress header for the mobile wizard (replaces the wide desktop step rail).
function MobileStepper({ steps, activeIndex, onGo, stepWord }) {
  return (
    <div className="bhc-mstepper">
      <div className="bhc-mstepper-top">
        <span className="bhc-mstepper-count">{stepWord} {activeIndex + 1} / {steps.length}</span>
        <span className="bhc-mstepper-name">{steps[activeIndex]?.label}</span>
      </div>
      <div className="bhc-mstepper-track" role="tablist" aria-label="Configurator steps">
        {steps.map((step, index) => (
          <button
            key={step.key}
            type="button"
            className={['bhc-mstepper-seg', index === activeIndex && 'is-active', index < activeIndex && 'is-done'].filter(Boolean).join(' ')}
            onClick={() => onGo(index)}
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`${stepWord} ${index + 1}: ${step.label}`}
          />
        ))}
      </div>
    </div>
  )
}

// Accordion decision row. Collapsed it shows the current pick (thumb/swatch + value);
// expanded it reveals the options. Controlled so only one section is open at a time.
function MobileSection({ id, openId, onToggle, title, value, thumb, swatch, badge, children }) {
  const open = openId === id
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    setFailed(false)
  }, [thumb])

  const showThumb = Boolean(thumb) && !failed

  return (
    <div className={['bhc-msection', open && 'is-open'].filter(Boolean).join(' ')} data-section-id={id}>
      <button type="button" className="bhc-msection-head" onClick={() => onToggle(id)} aria-expanded={open}>
        {showThumb ? (
          <img className="bhc-msection-thumb" src={cdnImage(thumb, { width: 160 })} alt="" loading="lazy" onError={() => setFailed(true)} />
        ) : swatch ? (
          <span className="bhc-msection-thumb bhc-msection-thumb--swatch" style={{ '--sw': swatch }} aria-hidden="true" />
        ) : null}
        <span className="bhc-msection-copy">
          <span className="bhc-msection-title">{title}</span>
          {value ? <span className="bhc-msection-value">{value}</span> : null}
        </span>
        {badge ? <span className="bhc-msection-badge">{badge}</span> : null}
        <span className="bhc-msection-chevron" aria-hidden="true" />
      </button>
      {open ? <div className="bhc-msection-body">{children}</div> : null}
    </div>
  )
}

// Full-screen editor for the floor-plan steps.
//
// Inside a phone accordion the plan renders about 240px square, which is far
// too small to place a marker accurately. This gives the plan the whole
// viewport, keeps its controls under it, and hands back to the section on close.
function PlanEditorModal({ open, title, hint, onClose, doneLabel, children }) {
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="bhc-plan-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bhc-plan-modal-head">
        <div className="bhc-plan-modal-copy">
          <strong>{title}</strong>
          {hint ? <span>{hint}</span> : null}
        </div>
        <button type="button" className="bhc-plan-modal-close" onClick={onClose} aria-label={doneLabel}>✕</button>
      </div>
      <div className="bhc-plan-modal-body">{children}</div>
      <div className="bhc-plan-modal-foot">
        <button type="button" className="btn" onClick={onClose}>{doneLabel}</button>
      </div>
    </div>
  )
}

function SocketPlanStage({ image, markers = [], onAdd, onRemove, interactive = false, className = '', emptyText = '' }) {
  function handleClick(event) {
    if (!interactive || !onAdd) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    onAdd({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  const removable = interactive && Boolean(onRemove)

  return (
    <div className={['bhc-socket-stage', interactive && 'is-interactive', className].filter(Boolean).join(' ')}>
      <div
        className="bhc-plan-canvas"
        onClick={handleClick}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
      >
        {image ? <img src={cdnImage(image, { width: 1000 })} srcSet={cdnSrcSet(image, [500, 750, 1000, 1400])} sizes="(max-width: 900px) 90vw, 600px" alt="" decoding="async" /> : null}
        {markers.map((marker, index) => (
          <span
            key={marker.id || `marker-${index}`}
            className={['bhc-socket-dot', removable && 'is-removable'].filter(Boolean).join(' ')}
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            onClick={removable ? (e) => { e.stopPropagation(); onRemove(marker.id) } : undefined}
            title={marker.description || undefined}
          >
            {index + 1}
          </span>
        ))}
      </div>
      {!image && emptyText ? <div className="bhc-small-note">{emptyText}</div> : null}
    </div>
  )
}

function WindowPlanStage({ image, markers = [], onAdd, onRemove, interactive = false, className = '', emptyText = '' }) {
  function handleCanvasClick(event) {
    if (!interactive || !onAdd) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    onAdd({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  const removable = interactive && Boolean(onRemove)

  return (
    <div className={['bhc-socket-stage bhc-window-stage', interactive && 'is-interactive', className].filter(Boolean).join(' ')}>
      <div
        className="bhc-plan-canvas"
        onClick={handleCanvasClick}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
      >
        {image ? <img src={cdnImage(image, { width: 1000 })} srcSet={cdnSrcSet(image, [500, 750, 1000, 1400])} sizes="(max-width: 900px) 90vw, 600px" alt="" decoding="async" /> : null}
        {markers.map((marker, index) => (
          <span
            key={marker.id || `window-${index}`}
            className={['bhc-window-dot', marker.kind && marker.kind !== 'standard' && 'is-panoramic', removable && 'is-removable'].filter(Boolean).join(' ')}
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            onClick={removable ? (e) => { e.stopPropagation(); onRemove(marker.id) } : undefined}
            title={removable ? '✕' : undefined}
          >
            {marker.badge || index + 1}
          </span>
        ))}
      </div>
      {!image && emptyText ? <div className="bhc-small-note">{emptyText}</div> : null}
    </div>
  )
}

function resolveSelected(options, key) {
  return options.find((item) => item.key === key) || options[0] || null
}

function optionDisplay(item, fallback = '-') {
  return item?.displayLabel || item?.display || item?.label || fallback
}

function optionSummary(item, fallback = '-') {
  return item?.summaryLabel || item?.label || item?.code || fallback
}

function normalizeAssetPath(value, baseUrl) {
  if (!value) return ''
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value
  const clean = String(value).replace(/^\/+/, '')
  if (clean.startsWith('box-config/')) return `${baseUrl}${clean}`
  return `${baseUrl}box-config/${clean}`
}

export default function BoxHouseConfiguratorPage({ content }) {
  const { openOffer, openQuestion } = useModalActions()
  const locale = content?.locale || 'en'
  const isBg = locale === 'bg'
  const t = content?.page || {}
  const catalog = React.useMemo(() => getBoxConfiguratorCatalog(locale), [locale])
  const baseUrl = import.meta.env.BASE_URL || '/'
  const asset = React.useCallback((name) => normalizeAssetPath(name, baseUrl), [baseUrl])

  const labels = React.useMemo(() => ({
    model: t.labels?.model || (isBg ? 'Модел' : 'Model'),
    variant: t.labels?.variant || (isBg ? 'Вариант' : 'Variant'),
    standard: t.labels?.standard || (isBg ? 'Стандартен' : 'Standard'),
    balcony: t.labels?.balcony || (isBg ? 'С балкон и покрив над терасата' : 'Balcony + full roof over terrace'),
    basePrice: t.labels?.basePrice || (isBg ? 'Базова цена' : 'Base price'),
    layout: t.labels?.layout || (isBg ? 'Разпределение' : 'Layout'),
    exterior: t.labels?.exterior || (isBg ? 'Екстериор' : 'Exterior'),
    interior: t.labels?.interior || (isBg ? 'Интериор' : 'Interior'),
    sockets: t.labels?.sockets || (isBg ? 'Контакти' : 'Sockets'),
    summary: t.labels?.summary || (isBg ? 'Обобщение' : 'Summary'),
    frame: t.labels?.frame || (isBg ? 'Материал на дограмата' : 'Window frame material'),
    windowSystem: t.labels?.windowStyle || (isBg ? 'Тип прозорец' : 'Window style'),
    exteriorDoor: t.labels?.exteriorDoor || (isBg ? 'Външна врата' : 'Exterior door'),
    outsidePanels: t.labels?.outsidePanels || (isBg ? 'Външни панели' : 'Outside panels'),
    steelFrameColor: t.labels?.steelFrameColor || (isBg ? 'Цвят на стоманената рамка' : 'Steel frame colour'),
    exteriorFinishFamily: t.labels?.exteriorFinishFamily || (isBg ? 'Фамилия фасадно покритие' : 'Exterior finish family'),
    exteriorFinish: t.labels?.exteriorFinish || (isBg ? 'Фасадно покритие' : 'Exterior finish'),
    deckingColor: t.labels?.deckingColor || (isBg ? 'Цвят на декинга' : 'Decking colour'),
    wallColor: t.labels?.wallColor || (isBg ? 'Цвят на стените' : 'Wall colour'),
    floorFinish: t.labels?.floorFinish || (isBg ? 'Подова настилка' : 'Floor finish'),
    floorFamily: t.labels?.floorFamily || (isBg ? 'Фамилия подова настилка' : 'Floor finish family'),
    bathroom: t.labels?.bathroom || (isBg ? 'Баня' : 'Bathroom'),
    kitchen: t.labels?.kitchen || (isBg ? 'Кухня' : 'Kitchen'),
    kitchenExtras: t.labels?.kitchenExtras || (isBg ? 'Кухненски добавки' : 'Kitchen extras'),
    kitchenBench: t.labels?.kitchenBench || (isBg ? 'Цвят на кухненския плот' : 'Kitchen bench colour'),
    windowOpenings: t.labels?.windowOpenings || (isBg ? 'Прозоречни отвори' : 'Window openings'),
    windowSize: t.labels?.windowSize || (isBg ? 'Размер на прозорците' : 'Window size'),
    windowSize1000: t.labels?.windowSize1000 || (isBg ? '1100×950 (стандартен)' : '1100×950 (standard)'),
    windowSize1200: t.labels?.windowSize1200 || '1200×950 (+€500)',
    windowSize1400: t.labels?.windowSize1400 || '1400×950 (+€800)',
    windowPanoramic: t.labels?.windowPanoramic || (isBg ? 'Панорамен / Френски (+€300)' : 'Panoramic / French (+€300)'),
    makePanoramic: t.labels?.makePanoramic || (isBg ? 'Кликни за панорамен (+€300)' : 'Click to make panoramic (+€300)'),
    panoramicActive: t.labels?.panoramicActive || (isBg ? 'Панорамен ✓ (+€300)' : 'Panoramic ✓ (+€300)'),
    windowMarker: t.labels?.windowMarker || (isBg ? 'Прозорец' : 'Window'),
    windowNotes: t.labels?.windowNotes || (isBg ? 'Бележки за прозорците' : 'Window notes'),
    windowNotesPlaceholder: t.labels?.windowNotesPlaceholder || (isBg ? 'Пример: допълнителни прозорци в спалнята, панорамни към терасата' : 'Example: extra windows on bedroom side, panoramic towards terrace'),
    windowNotesLabel: t.labels?.windowNotesLabel || (isBg ? 'Бележки за прозорците' : 'Window notes'),
    noWindows: t.labels?.noWindows || (isBg ? 'Няма поставени прозорци. Кликнете върху плана, за да добавите.' : 'No windows placed yet. Click the floor plan to add.'),
    windowCount: t.labels?.windowCount || (isBg ? 'Поставени прозорци' : 'Windows placed'),
    windowExtrasLabel: t.labels?.windowExtrasLabel || (isBg ? 'Допълнителна цена прозорци' : 'Window extras'),
    addWindowHint: t.labels?.addWindowHint || (isBg ? 'Кликнете върху плана, за да добавите прозорец. Кликнете маркер, за да го премахнете. После използвайте „Кликни за панорамен“ за всеки прозорец, който искате панорамен / френски.' : 'Click the floor plan to add a window. Click a marker to remove it. Then use “Click to make panoramic” on any window you want as panoramic / French.'),
    windowSizeNote: t.labels?.windowSizeNote || (isBg ? 'Избраният размер важи за всички прозорци в къщата. Надстройте отделни прозорци до панорамни / френски по-долу (+€300 за брой).' : 'The selected size applies to every window in the house. Upgrade single windows to panoramic / French below (+€300 each).'),
    forAllWindows: t.labels?.forAllWindows || (isBg ? 'за всички прозорци' : 'for all windows'),
    windowSizeIncluded: t.labels?.windowSizeIncluded || (isBg ? 'стандартен размер, всички прозорци' : 'standard size, all windows'),
    panoramicUpgrades: t.labels?.panoramicUpgrades || (isBg ? 'Панорамни / френски надстройки' : 'Panoramic / French upgrades'),
    heating: t.labels?.heating || (isBg ? 'Долна изолация + зонално отопление' : 'Bottom insulation + zone heating'),
    heatingPrice: t.labels?.heatingPrice || (isBg ? 'Пакет отопление' : 'Heating package'),
    area: t.labels?.area || (isBg ? 'Площ' : 'Area'),
    dimensionsOpen: t.labels?.dimensionsOpen || (isBg ? 'Размер разгъната' : 'Open size'),
    dimensionsFolded: t.labels?.dimensionsFolded || (isBg ? 'Размер сгъната' : 'Folded size'),
    totalKnown: t.labels?.totalKnown || (isBg ? 'Известна обща стойност' : 'Known total'),
    pricingFootnote: t.labels?.pricingFootnote || (isBg ? 'Окабеляване за контакти и индивидуални ел. работи остават за офериране след преглед.' : 'Socket routing and custom electrical work stay as quote-on-review items.'),
    socketsHint: t.labels?.socketsHint || (isBg ? 'Кликнете върху плана, за да добавите контакт. Кликнете маркер, за да го премахнете.' : 'Click the floor plan to add a socket. Click a marker to remove it.'),
    socketCount: t.labels?.socketCount || (isBg ? 'Брой контакти' : 'Socket count'),
    socketNotes: t.labels?.socketNotes || (isBg ? 'Бележки за контактите' : 'Socket notes'),
    socketNotesPlaceholder: t.labels?.socketNotesPlaceholder || (isBg ? 'Пример: повече контакти в кухненската зона, ТВ стена, два външни контакта на терасата' : 'Example: more sockets in kitchen work zone, TV wall, two exterior sockets on terrace'),
    reference: t.labels?.reference || (isBg ? 'Каталожна референция' : 'Catalogue reference'),
    included: t.labels?.included || (isBg ? 'Включено стандартно' : 'Included as standard'),
    notes: t.labels?.notes || (isBg ? 'Бележки' : 'Notes'),
    plan: t.labels?.plan || (isBg ? 'План' : 'Plan'),
    overview: t.labels?.overview || (isBg ? 'Преглед' : 'Overview'),
    copied: t.labels?.copied || (isBg ? 'Конфигурацията е копирана.' : 'Configuration copied to clipboard.'),
    copyFailed: t.labels?.copyFailed || (isBg ? 'Копирането не беше успешно.' : 'Clipboard copy failed.'),
    linkCopied: t.labels?.linkCopied || (isBg ? 'Връзката към конфигурацията е копирана.' : 'Configuration link copied to clipboard.'),
    linkShared: t.labels?.linkShared || (isBg ? 'Връзката е споделена.' : 'Link shared.'),
    linkFailed: t.labels?.linkFailed || (isBg ? 'Създаването на връзка не беше успешно.' : 'Could not create the share link.'),
    electricalScheme: t.labels?.electricalScheme || (isBg ? 'Електрическа схема' : 'Electrical scheme'),
    windowScheme: t.labels?.windowScheme || (isBg ? 'Схема на прозорците' : 'Window scheme'),
    finishBoard: t.labels?.finishBoard || (isBg ? 'Финиши и бележки' : 'Finishes and notes'),
    priceBreakdown: t.labels?.priceBreakdown || (isBg ? 'Разбивка на цената' : 'Price breakdown'),
    internalWalls: t.labels?.internalWalls || (isBg ? 'Вътрешни стени' : 'Internal walls'),
    interiorPanels: t.labels?.interiorPanels || (isBg ? 'Вътрешни панели' : 'Interior panels'),
    defaultWhitePanels: t.labels?.defaultWhitePanels || (isBg ? 'Стандартни бели панели' : 'Standard white panels'),
    colouredPanels: t.labels?.colouredPanels || (isBg ? 'Цветни панели' : 'Coloured panels'),
    uvPanels: t.labels?.uvPanels || (isBg ? 'UV панели' : 'UV panels'),
    interiorPanelColour: t.labels?.interiorPanelColour || (isBg ? 'Цвят на вътрешните панели' : 'Interior panel colour'),
    bathroomUvPanel: t.labels?.bathroomUvPanel || (isBg ? 'UV панели за банята' : 'Bathroom UV panels'),
    bathroomUvPanelHint: t.labels?.bathroomUvPanelHint || (isBg ? 'Включени в оборудването на банята.' : 'Included with the bathroom fit-out.'),
    wallUvPanel: t.labels?.wallUvPanel || (isBg ? 'UV панели за стените' : 'Wall UV panels'),
    uvPanel: t.labels?.uvPanel || (isBg ? 'UV опция' : 'UV option'),
    // Catalogue categories added with the 2026 edition.
    bathroomDoor: t.labels?.bathroomDoor || (isBg ? 'Врата за баня' : 'Bathroom door'),
    vanity: t.labels?.vanity || (isBg ? 'Мебели за баня' : 'Bathroom furniture'),
    kitchenSink: t.labels?.kitchenSink || (isBg ? 'Кухненска мивка' : 'Kitchen sink'),
    kitchenPetColour: t.labels?.kitchenPetColour || (isBg ? 'Цвят на кухненските шкафове' : 'Kitchen cabinet colour'),
    windowColour: t.labels?.windowColour || (isBg ? 'Цвят на профила' : 'Profile colour'),
    windowSystemLabel: t.labels?.windowSystemLabel || (isBg ? 'Профилна система' : 'Profile system'),
    windowTypeLabel: t.labels?.windowTypeLabel || (isBg ? 'Вид дограма' : 'Glazing type'),
    terrace: t.labels?.terrace || (isBg ? 'Тераса' : 'Terrace'),
    armouredDoor: t.labels?.armouredDoor || (isBg ? 'Блиндирана врата' : 'Armoured door'),
    openingType: t.labels?.openingType || (isBg ? 'Вид отвор' : 'Opening type'),
    openingTypeHint: t.labels?.openingTypeHint || (isBg ? 'Изберете вид, след което кликнете върху плана, за да го поставите.' : 'Pick a type, then click the plan to place it.'),
    standardWindow: t.labels?.standardWindow || (isBg ? 'Стандартен прозорец' : 'Standard window'),
    standardGlazing: t.labels?.standardGlazing || (isBg ? 'Стандартна дограма' : 'Standard glazing'),
    glazingUpgrades: t.labels?.glazingUpgrades || (isBg ? 'Неотваряемо остъкляване и плъзгащи' : 'Fixed glazing and sliding doors'),
    glazingUpgradesHint: t.labels?.glazingUpgradesHint || (isBg
      ? 'Всяко от тях замества стандартен отвор. Максималната ширина зависи от носещата рамка на модела.'
      : 'Each of these replaces a standard opening. Maximum width depends on the model’s load-bearing frame.'),
    none: t.labels?.none || (isBg ? 'Без' : 'None'),
    onRequest: t.labels?.onRequest || (isBg ? 'по запитване' : 'price on request'),
    quotationItems: t.labels?.quotationItems || (isBg ? 'За офериране' : 'Quoted separately'),
    perWindow: t.labels?.perWindow || (isBg ? 'на прозорец' : 'per window'),
    perDoor: t.labels?.perDoor || (isBg ? 'на врата' : 'per door'),
    insideDoors: t.labels?.insideDoors || (isBg ? 'Вътрешни врати' : 'Inside doors'),
    insideDoorStyle: t.labels?.insideDoorStyle || (isBg ? 'Стил на вътрешните врати' : 'Inside door style'),
    insideDoorCount: t.labels?.insideDoorCount || (isBg ? 'Брой вътрешни врати' : 'Inside door count'),
    insideDoorPrice: t.labels?.insideDoorPrice || (isBg ? 'Вътрешни врати цена' : 'Inside doors price'),
    insideDoorCountHint: t.labels?.insideDoorCountHint || (isBg
      ? 'Разпределение {plan} се нуждае от {n} {doorWord}. '
      : 'Layout {plan} needs {n} interior {doorWord}. '),
    doorWordOne: t.labels?.doorWordOne || (isBg ? 'вътрешна врата' : 'door'),
    doorWordMany: t.labels?.doorWordMany || (isBg ? 'вътрешни врати' : 'doors'),
    includedShort: t.labels?.includedShort || (isBg ? 'Включено' : locale === 'el' ? 'Περιλαμβάνεται' : 'Included'),
    showAllOptions: t.labels?.showAllOptions || (isBg ? 'Покажи всички {n}' : 'Show all {n}'),
    pdfHouse: t.labels?.pdfHouse || (isBg ? 'Къща' : locale === 'el' ? 'Σπίτι' : 'House'),
    pdfExterior: t.labels?.pdfExterior || (isBg ? 'Екстериор' : locale === 'el' ? 'Εξωτερικό' : 'Exterior'),
    pdfInterior: t.labels?.pdfInterior || (isBg ? 'Интериор' : locale === 'el' ? 'Εσωτερικό' : 'Interior'),
    openPlanEditor: t.labels?.openPlanEditor || (isBg ? 'Отвори на цял екран' : 'Open full screen'),
    planEditorDone: t.labels?.planEditorDone || (isBg ? 'Готово' : 'Done'),
    resetToLayout: t.labels?.resetToLayout || (isBg ? 'Върни към разпределението' : 'Reset to layout'),
    socketDescHint: t.labels?.socketDescHint || (isBg ? 'Добавете описание за всеки контакт' : 'Add a description for each socket'),
    socketNotesLabel: t.labels?.socketNotesLabel || (isBg ? 'Бележки за контактите' : 'Socket notes'),
    socketMarker: t.labels?.socketMarker || (isBg ? 'Контакт' : 'Socket'),
    noSockets: t.labels?.noSockets || (isBg ? 'Все още няма поставени контакти.' : 'No sockets placed yet.'),
    pdfPreparing: t.labels?.pdfPreparing || (isBg ? 'Подготвям PDF обобщението…' : 'Preparing PDF summary…'),
    pdfOpened: t.labels?.pdfOpened || (isBg ? 'PDF обобщението е отворено.' : 'PDF summary opened.'),
    pdfBlocked: t.labels?.pdfBlocked || (isBg ? 'Браузърът блокира прозореца за PDF.' : 'The browser blocked the PDF summary window.'),
    exportHint: t.labels?.exportHint || (isBg ? 'Експортът отваря print-ready обобщение и изчаква визуализациите да се заредят.' : 'The export opens a print-ready summary and waits for visuals to load.'),
    referenceBoards: t.labels?.referenceBoards || (isBg ? 'Референтни табла' : 'Reference boards'),
    emailPrompt: t.labels?.emailPrompt || (isBg ? 'Изпрати ми я по имейл' : locale === 'el' ? 'Στείλε μου το με email' : 'Email it to me'),
    emailPlaceholder: t.labels?.emailPlaceholder || 'you@example.com',
    emailSending: t.labels?.emailSending || (isBg ? 'Изпращане…' : locale === 'el' ? 'Αποστολή…' : 'Sending…'),
    emailSent: t.labels?.emailSent || (isBg ? 'Готово! Проверете пощата си.' : locale === 'el' ? 'Έγινε! Ελέγξτε το email σας.' : 'Sent! Check your inbox.'),
    emailInvalid: t.labels?.emailInvalid || (isBg ? 'Моля, въведете валиден имейл.' : locale === 'el' ? 'Παρακαλώ εισάγετε έγκυρο email.' : 'Please enter a valid email.'),
    emailFailed: t.labels?.emailFailed || (isBg ? 'Изпращането не бе успешно. Опитайте пак.' : locale === 'el' ? 'Η αποστολή απέτυχε. Δοκιμάστε ξανά.' : 'Could not send the email. Please try again.'),
  }), [isBg, locale, t.labels])

  const actions = React.useMemo(() => ({
    back: t.actions?.back || (isBg ? 'Назад' : 'Back'),
    next: t.actions?.next || (isBg ? 'Напред' : 'Next'),
    reset: t.actions?.reset || (isBg ? 'Ново начало' : 'Start over'),
    copy: t.actions?.copy || (isBg ? 'Копирай обобщението' : 'Copy summary'),
    shareLink: t.actions?.shareLink || (isBg ? 'Копирай връзка' : 'Copy link'),
    export: t.actions?.export || (isBg ? 'Експорт PDF' : 'Export PDF'),
    offer: t.actions?.offer || (isBg ? 'Поискай оферта' : 'Request an offer'),
    question: t.actions?.question || (isBg ? 'Задай въпрос' : 'Ask a question'),
    clearSockets: t.actions?.clearSockets || (isBg ? 'Изчисти контактите' : 'Clear sockets'),
    removeLastSocket: t.actions?.removeLastSocket || (isBg ? 'Премахни последния контакт' : 'Remove last socket'),
    clearWindows: t.actions?.clearWindows || (isBg ? 'Изчисти прозорците' : 'Clear windows'),
    removeLastWindow: t.actions?.removeLastWindow || (isBg ? 'Премахни последния прозорец' : 'Remove last window'),
  }), [isBg, t.actions])

  const hints = React.useMemo(() => ({
    model: t.hints?.model || (isBg ? 'Базовите цени са взети от каталога. Изберете стандартен вариант или версията с балкон и покрив над терасата.' : 'Base prices come from the catalogue. Choose standard or the balcony version with the full sloped roof over the terrace.'),
    layout: t.hints?.layout || (isBg ? 'Каталогът вече съдържа готови разпределения за всяко размерно семейство.' : 'The catalogue already includes ready-made room layouts for each size family.'),
    exterior: t.hints?.exterior || (isBg ? 'Материалът на дограмата, външната врата, фасадното покритие и цветът на декинга са избори от каталога. Панорамните прозорци и отоплението остават платени опции.' : 'Frame material, exterior door, exterior finish and decking colour are now catalogue-driven. Panoramic windows and the heating package remain the paid options.'),
    interior: t.hints?.interior || (isBg ? 'Тук се събират вътрешните панели, UV вариантите, подовите настилки, кухненските плотове, банята, кухнята и вътрешните врати.' : 'This step now includes interior panels, UV options, floor families, kitchen bench colours, bathroom, kitchen and inside doors.'),
    sockets: t.hints?.sockets || (isBg ? 'Маркерите се поставят спрямо самото изображение на плана, за да съвпадат еднакво в работната стъпка и в обобщението.' : 'Markers are now placed relative to the plan image itself so the socket scheme matches both the working step and the summary.'),
    summary: t.hints?.summary || (isBg ? 'Тази стъпка събира известната цена, избраните визуализации, схемата на контактите и каталожните референции на едно място.' : 'This stage collects the known total, selected visuals, socket scheme and catalogue references in one place.'),
  }), [isBg, t.hints])

  const pdfText = React.useMemo(() => ({
    title: t.pdf?.title || (isBg ? 'Конфигурация на NVC Бокс къща' : 'NVC Box house configuration'),
    subtitle: t.pdf?.subtitle || (isBg ? 'Подготвена от интерактивния конфигуратор' : 'Prepared from the interactive configurator'),
    knownTotal: t.pdf?.knownTotal || labels.totalKnown,
    generatedLabel: t.pdf?.generatedLabel || (isBg ? 'Генерирано на' : 'Generated on'),
    note: t.pdf?.note || (isBg ? 'Надценките за прозорци (размер + панорамен ъпгрейд), вътрешните панели и вътрешните врати са включени в известната обща стойност. Електрическите работи по контактите остават за офериране.' : 'Window extras (size upgrade + panoramic upgrade), interior panel upgrades and inside doors are included in the known total. Socket works remain quotation items.'),
  }), [isBg, labels.totalKnown, t.pdf])

  const initialModel = catalog.models[0]
  const initialPlan = initialModel?.plans?.[0] || ''
  const initialExteriorFamily = catalog.exteriorFinishGroups[0]?.key || 'steel'
  const initialExteriorFinish = catalog.exteriorFinishGroups[0]?.options?.[0]?.key || ''

  // Canonical pristine configuration. Kept as one factory so the initial state,
  // resetAll() and the resume-banner "is this meaningful progress?" check all
  // share a single definition instead of separate copies drifting apart.
  const buildDefaultConfig = () => ({
    model: initialModel?.key || '37',
    variant: 'standard',
    plan: initialPlan,
    windowType: catalog.windowTypeOptions[0]?.key || 'pvc-double',
    steelFrameColor: catalog.steelFrameColorOptions[0]?.key || 'black',
    windowColour: catalog.windowBasicColourOptions[0]?.key || '',
    exteriorDoor: catalog.exteriorDoorOptions[0]?.key || 'v-01',
    armouredDoor: '',
    exteriorFinishFamily: initialExteriorFamily,
    exteriorFinish: initialExteriorFinish,
    terrace: catalog.terraceOptions[0]?.key || 'standard',
    deckingColor: catalog.deckingColorOptions[0]?.key || 't-01',
    heating: false,
    windowSize: '1000',
    nextWindowKind: 'standard',
    windows: [],
    windowNotes: '',
    interiorPanelMode: 'white',
    interiorPanelColor: catalog.interiorPanelColorOptions[0]?.key || 'ip-01',
    uvPanel: catalog.uvPanelOptions[0]?.key || '',
    bathroomUvPanel: catalog.uvPanelOptions[0]?.key || '',
    floorFamily: 'vinyl',
    vinylFloor: catalog.vinylFloorOptions[0]?.key || 'floor-7005',
    herringboneFloor: catalog.herringboneFloorOptions[0]?.key || 'yg5716',
    carbonCrystalFloor: catalog.carbonCrystalOptions[0]?.key || 'carbon-gf005',
    bathroom: catalog.bathroomOptions[0]?.key || 'BA-1',
    bathroomDoor: catalog.bathroomDoorOptions[0]?.key || 'bd-01',
    vanity: catalog.vanityOptions[0]?.key || 'bv-01',
    kitchen: catalog.kitchenOptions[0]?.key || 'K-1',
    kitchenBench: catalog.kitchenBenchOptions[0]?.key || '',
    kitchenSink: catalog.kitchenSinkOptions[0]?.key || 'ks-1',
    kitchenPetColour: '',
    kitchenExtras: {
      furnace: false,
      washingMachine: false,
      dishwasherCabinet: false,
    },
    insideDoorStyle: catalog.insideDoorStyleOptions[0]?.key || 'vr-01',
    insideDoorCount: catalog.planOptions.find((p) => p.key === initialPlan)?.doorCount || 0,
    sockets: [],
    socketNotes: '',
  })

  // A shared link (#cfg=...) carries an exact configuration; read it once at
  // mount. It takes precedence over both the pristine default and any saved
  // config, so opening someone's shared link shows their configuration.
  const sharedFromUrl = React.useMemo(
    () => (typeof window === 'undefined' ? null : readSharedConfigFromHash(window.location.hash)),
    []
  )

  // A short share link (/c/{code} → ?c=code) references a server-stored config we
  // must fetch. Capture the code once at mount; the effect below hydrates from it.
  const shortCodeFromUrl = React.useMemo(
    () => (typeof window === 'undefined' ? null : readShortCodeFromSearch(window.location.search)),
    []
  )

  // Overlay an incoming (shared/saved) config onto a fresh default so any keys
  // missing from an older/partial payload fall back to sensible values.
  const mergeIntoDefaults = (incoming) => {
    const base = buildDefaultConfig()
    if (!incoming) return base
    return {
      ...base,
      ...incoming,
      kitchenExtras: { ...base.kitchenExtras, ...(incoming.kitchenExtras || {}) },
    }
  }

  const [stepIndex, setStepIndex] = React.useState(0)
  const [status, setStatus] = React.useState('')
  // "Email me my config" (Phase 2b): idle | sending | sent | invalid | error
  const [emailValue, setEmailValue] = React.useState('')
  const [emailState, setEmailState] = React.useState('idle')
  const [config, setConfig] = React.useState(() => mergeIntoDefaults(sharedFromUrl))
  // Read any previously auto-saved configuration once, at mount, before the
  // auto-save effect below can overwrite it. Drives the resume banner — but a
  // shared link wins, so the banner is suppressed when one is present.
  const [resumeCandidate, setResumeCandidate] = React.useState(() =>
    (sharedFromUrl || shortCodeFromUrl) ? null : loadSavedConfig()
  )

  // Debounced auto-save of the in-progress configuration. Skipped while the
  // resume banner is still pending so we don't clobber the saved config the
  // visitor hasn't decided on yet.
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (resumeCandidate) return undefined
    const id = window.setTimeout(() => saveConfig(config, stepIndex), 400)
    return () => window.clearTimeout(id)
  }, [config, stepIndex, resumeCandidate])

  // If the visitor ignores the resume banner and just starts configuring, treat
  // that as an implicit "keep editing": dismiss the banner so auto-save re-arms
  // and persists their new work. We compare against the mount-time references
  // rather than a boolean "have I run" flag because StrictMode double-invokes
  // effects with identical references — a reference compare correctly reports
  // "no real change" on that second invocation. (Resume/start-fresh clear
  // resumeCandidate first, so this is a no-op on those paths.)
  const initialConfigRef = React.useRef(null)
  React.useEffect(() => {
    if (initialConfigRef.current === null) {
      initialConfigRef.current = { config, stepIndex }
      return
    }
    const { config: config0, stepIndex: stepIndex0 } = initialConfigRef.current
    if (resumeCandidate && (config !== config0 || stepIndex !== stepIndex0)) {
      setResumeCandidate(null)
    }
  }, [config, stepIndex, resumeCandidate])

  // Once a shared config has seeded the initial state, strip #cfg from the URL:
  // further edits are auto-saved to localStorage, so a reload should resume the
  // (possibly edited) session rather than snap back to the original shared link.
  React.useEffect(() => {
    if (!sharedFromUrl) return
    if (typeof window === 'undefined' || !window.history?.replaceState) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [sharedFromUrl])

  // Hydrate from a short share link (?c=code): fetch the stored config, overlay it,
  // then strip ?c from the URL so a reload resumes the (possibly edited) session
  // rather than snapping back to the original link. If the fetch fails (unknown
  // code / API down) we simply leave the fresh default in place.
  React.useEffect(() => {
    if (!shortCodeFromUrl) return undefined
    let cancelled = false
    resolveShortLink(shortCodeFromUrl, { apiBase: API_BASE }).then((incoming) => {
      if (cancelled) return
      if (incoming) setConfig(mergeIntoDefaults(incoming))
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const url = new URL(window.location.href)
        url.searchParams.delete('c')
        window.history.replaceState(null, '', url.pathname + url.search + url.hash)
      }
    })
    return () => { cancelled = true }
  }, [shortCodeFromUrl])

  const handleResumeSaved = React.useCallback(() => {
    if (!resumeCandidate) return
    setConfig((prev) => ({
      ...prev,
      ...resumeCandidate.config,
      // Backfill nested/added keys from defaults so an older saved shape can't
      // leave a sub-object partially undefined.
      kitchenExtras: { ...prev.kitchenExtras, ...(resumeCandidate.config.kitchenExtras || {}) },
    }))
    setStepIndex(Number.isInteger(resumeCandidate.stepIndex) ? resumeCandidate.stepIndex : 0)
    setResumeCandidate(null)
  }, [resumeCandidate])

  const handleStartFresh = React.useCallback(() => {
    clearSavedConfig()
    setResumeCandidate(null)
  }, [])

  const previewRefs = React.useRef({})
  const previewTimerRef = React.useRef(null)
  const [isMobileShell, setIsMobileShell] = React.useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(max-width: 860px)').matches
  })
  const [openSection, setOpenSection] = React.useState('model')

  const toggleSection = React.useCallback((id) => {
    setOpenSection((current) => (current === id ? null : id))
  }, [])


  const stepWord = isBg ? 'Стъпка' : locale === 'el' ? 'Βήμα' : 'Step'


  const optionPageSize = isMobileShell ? 8 : 18
  const [planEditor, setPlanEditor] = React.useState('')

  const scrollToPreview = React.useCallback((key) => {
    // A preview that remounted between steps leaves a detached node in the ref
    // map. It is still truthy, and scrollIntoView on it silently does nothing,
    // so require a connected node and fall back to a DOM lookup.
    const cached = previewRefs.current?.[key]
    const node = cached && cached.isConnected
      ? cached
      : (typeof document === 'undefined' ? null : document.querySelector(`[data-preview="${key}"]`))
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [])

  React.useEffect(() => () => {
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current)
  }, [])
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(max-width: 860px)')
    const onChange = () => setIsMobileShell(!!mq.matches)
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
    if (!isMobileShell) return
    setOpenSection(MOBILE_DEFAULT_SECTION[STEP_KEYS[stepIndex]] || null)
  }, [isMobileShell, stepIndex])

  // On the configurator page the generic global mobile quote dock is replaced by the
  // in-page sticky price/nav bar, so hide the dock while this page is mounted.
  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined
    document.body.classList.add('bhc-config-active')
    return () => document.body.classList.remove('bhc-config-active')
  }, [])

  const stepMeta = t.steps || STEP_KEYS.map((key) => ({ key, label: key }))

  const selectedModel = React.useMemo(
    () => catalog.models.find((item) => item.key === config.model) || catalog.models[0],
    [catalog.models, config.model]
  )

  const planChoices = React.useMemo(
    () => catalog.planOptions.filter((plan) => selectedModel?.plans?.includes(plan.key)),
    [catalog.planOptions, selectedModel]
  )

  React.useEffect(() => {
    if (!planChoices.some((item) => item.key === config.plan)) {
      setConfig((prev) => ({ ...prev, plan: planChoices[0]?.key || '' }))
    }
  }, [config.plan, planChoices])

  React.useEffect(() => {
    if (config.heating && config.floorFamily !== 'carbon') {
      setConfig((prev) => ({ ...prev, floorFamily: 'carbon' }))
      return
    }
    if (!config.heating && config.floorFamily === 'carbon') {
      setConfig((prev) => ({ ...prev, floorFamily: 'vinyl' }))
    }
  }, [config.floorFamily, config.heating])

  const exteriorFinishGroup = React.useMemo(
    () => catalog.exteriorFinishGroups.find((group) => group.key === config.exteriorFinishFamily) || catalog.exteriorFinishGroups[0],
    [catalog.exteriorFinishGroups, config.exteriorFinishFamily]
  )

  const exteriorFinishOptions = exteriorFinishGroup?.options || []

  React.useEffect(() => {
    if (!exteriorFinishOptions.some((item) => item.key === config.exteriorFinish)) {
      setConfig((prev) => ({ ...prev, exteriorFinish: exteriorFinishOptions[0]?.key || '' }))
    }
  }, [config.exteriorFinish, exteriorFinishOptions])

  const activeFloorFamily = config.heating ? 'carbon' : config.floorFamily
  const activeFloorOptions = activeFloorFamily === 'herringbone'
    ? catalog.herringboneFloorOptions
    : activeFloorFamily === 'carbon'
      ? catalog.carbonCrystalOptions
      : catalog.vinylFloorOptions
  const activeFloorField = activeFloorFamily === 'herringbone'
    ? 'herringboneFloor'
    : activeFloorFamily === 'carbon'
      ? 'carbonCrystalFloor'
      : 'vinylFloor'
  const activeFloorSelection = config[activeFloorField]

  React.useEffect(() => {
    if (!activeFloorOptions.some((item) => item.key === activeFloorSelection)) {
      setConfig((prev) => ({ ...prev, [activeFloorField]: activeFloorOptions[0]?.key || '' }))
    }
  }, [activeFloorField, activeFloorOptions, activeFloorSelection])

  React.useEffect(() => {
    setStatus('')
  }, [stepIndex])

  // Land at the start of a step the first time it is opened -- at the stage
  // where the choices begin, not the page masthead above it. Coming back to a
  // step the buyer has already worked through keeps their scroll position.
  const seenSteps = React.useRef(new Set([stepIndex]))
  React.useEffect(() => {
    if (seenSteps.current.has(stepIndex)) return
    seenSteps.current.add(stepIndex)
    if (typeof document === 'undefined') return
    const stage = document.querySelector('.bhc-stage')
    if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [stepIndex])

  const selectedPlan = resolveSelected(planChoices, config.plan)
  const selectedBathroom = resolveSelected(catalog.bathroomOptions, config.bathroom)
  const selectedKitchen = resolveSelected(catalog.kitchenOptions, config.kitchen)
  const selectedWindowType = resolveSelected(catalog.windowTypeOptions, config.windowType)
  const selectedSteelFrameColor = resolveSelected(catalog.steelFrameColorOptions, config.steelFrameColor)
  // Which colour range the chosen window type unlocks: the base glazings come
  // in black / white / grey, the upgraded systems in the nine catalogue decors.
  const windowColourOptions = selectedWindowType?.colourSet === 'decor'
    ? catalog.windowDecorOptions
    : catalog.windowBasicColourOptions
  const selectedDoor = resolveSelected(catalog.exteriorDoorOptions, config.exteriorDoor)
  const selectedExteriorFinish = resolveSelected(exteriorFinishOptions, config.exteriorFinish)
  const selectedExteriorFinishCaption = [selectedExteriorFinish?.code, selectedExteriorFinish?.displayLabel]
    .filter(Boolean).join(' · ') || '-'

  // What a chosen option costs, in words: a figure, "included", or the
  // quotation note for the ones the catalogue never prices.
  const priceNote = React.useCallback((option) => {
    if (!option) return ''
    if (option.onRequest) return labels.onRequest
    return option.price ? `+${euro(option.price, locale)}` : labels.included
  }, [labels.onRequest, labels.included, locale])
  const selectedDeckingColor = resolveSelected(catalog.deckingColorOptions, config.deckingColor)
  const selectedInteriorPanelColor = resolveSelected(catalog.interiorPanelColorOptions, config.interiorPanelColor)
  const selectedUvPanel = resolveSelected(catalog.uvPanelOptions, config.uvPanel)
  const selectedBathroomUvPanel = resolveSelected(catalog.uvPanelOptions, config.bathroomUvPanel)
  const selectedKitchenBench = resolveSelected(catalog.kitchenBenchOptions, config.kitchenBench)
  const selectedFloorOption = resolveSelected(activeFloorOptions, activeFloorSelection)
  const selectedFloor = selectedFloorOption
  const selectedInsideDoorStyle = resolveSelected(catalog.insideDoorStyleOptions, config.insideDoorStyle)
  const selectedBathroomDoor = resolveSelected(catalog.bathroomDoorOptions, config.bathroomDoor)
  const selectedVanity = resolveSelected(catalog.vanityOptions, config.vanity)
  const selectedKitchenSink = resolveSelected(catalog.kitchenSinkOptions, config.kitchenSink)
  const selectedTerrace = resolveSelected(catalog.terraceOptions, config.terrace)
  // These four are optional upgrades -- an empty selection means "not taken",
  // so they must not fall back to the first option the way the others do.
  const selectedWindowColour = windowColourOptions.find((item) => item.key === config.windowColour) || null

  // Switching window type switches the colour range with it, so a colour
  // carried over from the other range has to be dropped.
  React.useEffect(() => {
    if (config.windowColour && !windowColourOptions.some((item) => item.key === config.windowColour)) {
      setConfig((prev) => ({ ...prev, windowColour: windowColourOptions[0]?.key || '' }))
    }
  }, [config.windowColour, windowColourOptions])

  // Armoured leaves are only offered on the solid single door.
  React.useEffect(() => {
    if (config.armouredDoor && config.exteriorDoor !== 'v-01') {
      setConfig((prev) => ({ ...prev, armouredDoor: '' }))
    }
  }, [config.armouredDoor, config.exteriorDoor])

  // The terrace belongs to the balcony variant; drop any upgrade when the
  // buyer goes back to standard so it can't be billed invisibly.
  React.useEffect(() => {
    if (config.variant !== 'balcony' && config.terrace !== 'standard') {
      setConfig((prev) => ({ ...prev, terrace: 'standard' }))
    }
  }, [config.variant, config.terrace])

  // How many interior doors the chosen layout implies.
  const planDoorCount = selectedPlan?.doorCount || 0

  // Follow the layout when it changes, but leave a hand-edited count alone --
  // hence keying off the plan rather than the count.
  const lastPlanForDoors = React.useRef(config.plan)
  React.useEffect(() => {
    if (lastPlanForDoors.current === config.plan) return
    lastPlanForDoors.current = config.plan
    setConfig((prev) => ({ ...prev, insideDoorCount: planDoorCount }))
  }, [config.plan, planDoorCount])
  const selectedKitchenPetColour = catalog.kitchenPetColourOptions.find((item) => item.key === config.kitchenPetColour) || null
  const selectedArmouredDoor = catalog.armouredDoorOptions.find((item) => item.key === config.armouredDoor) || null

  // The armoured leaf replaces the standard entrance door rather than adding
  // to it, so every summary reads back whichever one is actually fitted.
  const entranceDoor = selectedArmouredDoor || selectedDoor
  const entranceDoorLabel = entranceDoor
    ? [entranceDoor.label, entranceDoor.summaryLabel].filter(Boolean).join(' · ')
    : '-'

  const selectedKitchenExtras = React.useMemo(
    () => Object.entries(config.kitchenExtras)
      .filter(([, value]) => value)
      .map(([key]) => catalog.kitchenExtraOptions.find((item) => item.key === key)?.label)
      .filter(Boolean),
    [catalog.kitchenExtraOptions, config.kitchenExtras]
  )

  const selectedInteriorPanels = config.interiorPanelMode === 'white'
    ? {
        label: labels.defaultWhitePanels,
        swatch: '#f3f3ef',
        thumbImage: '',
        referenceImage: '',
      }
    : config.interiorPanelMode === 'uv'
      ? selectedUvPanel
      : selectedInteriorPanelColor

  const selectedPlanWallFactor = selectedPlan?.wallFactor || 1
  const selectedModelHeroImage = config.variant === 'balcony'
    ? (selectedModel?.balconyHeroImage || selectedModel?.heroImage || '')
    : (selectedModel?.standardHeroImage || selectedModel?.heroImage || '')
  const selectedModelOverviewImage = config.variant === 'balcony'
    ? (selectedModel?.balconyOverviewImage || selectedModel?.overviewImage || selectedModel?.heroImage || '')
    : (selectedModel?.standardOverviewImage || selectedModel?.overviewImage || selectedModel?.heroImage || '')

  const yesText = isBg ? 'Да' : 'Yes'
  const noText = isBg ? 'Не' : 'No'

  const internalWallsPrice = Math.round((selectedModel?.internalWallsPrice || 0) * selectedPlanWallFactor)
  const interiorPanelsPrice = config.interiorPanelMode === 'white' ? 0 : internalWallsPrice
  const knownBasePrice = config.variant === 'balcony' ? selectedModel?.balconyPrice || 0 : selectedModel?.basePrice || 0
  const heatingPrice = config.heating ? (selectedModel?.area || 0) * catalog.pricing.heatingPerM2 : 0

  // The catalogue prices glazing per window, so the per-window upgrades bill
  // against the openings the buyer has actually placed on the plan.
  const placedWindowCount = (config.windows || []).length
  const WINDOW_SIZE_DIMENSIONS = { '1000': '1100×950', '1200': '1200×950', '1400': '1400×950' }
  const windowSizeDimension = WINDOW_SIZE_DIMENSIONS[config.windowSize] || WINDOW_SIZE_DIMENSIONS['1000']
  const windowSizeExtra = catalog.pricing.windowSizeUpgrade[config.windowSize] || 0
  const windowTypePrice = (selectedWindowType?.price || 0) * placedWindowCount
  // Fixed and sliding units replace a standard opening, so each is priced on
  // the opening it occupies rather than counted separately.
  const glazingByKey = React.useMemo(
    () => Object.fromEntries(catalog.glazingUpgradeOptions.map((item) => [item.key, item])),
    [catalog.glazingUpgradeOptions]
  )
  const upgradedWindows = (config.windows || []).filter((w) => w.kind && w.kind !== 'standard')
  const panoramicWindowCount = upgradedWindows.length
  const glazingUpgradePrice = upgradedWindows.reduce(
    (sum, w) => sum + (glazingByKey[w.kind]?.price || 0), 0)
  const windowExtrasPrice = windowTypePrice + windowSizeExtra + glazingUpgradePrice
  const windowSizeSummaryValue = `${windowSizeDimension} mm · ${labels.windowSizeIncluded}`

  const terracePrice = selectedTerrace?.price || 0
  const bathroomDoorPrice = selectedBathroomDoor?.price || 0
  const kitchenVariantPrice = selectedKitchen?.price || 0
  const kitchenSinkPrice = selectedKitchenSink?.price || 0
  const armouredDoorPrice = selectedArmouredDoor?.price || 0
  // ВР-01 is in the base price; the other four are charged per door, so the
  // cost follows the door count the chosen layout implies.
  const insideDoorPrice = Number(config.insideDoorCount || 0) * (selectedInsideDoorStyle?.price || 0)
  const knownTotal = knownBasePrice + interiorPanelsPrice + heatingPrice + windowExtrasPrice
    + terracePrice + bathroomDoorPrice + kitchenVariantPrice + kitchenSinkPrice
    + armouredDoorPrice + insideDoorPrice

  // One breakdown for the desktop summary, the mobile summary and the PDF, so
  // the listed lines always add up to the known total. Zero-priced optional
  // lines are dropped rather than printed as dashes.
  const priceBreakdownRows = [
    [labels.basePrice, euro(knownBasePrice, locale), true],
    [labels.internalWalls, euro(interiorPanelsPrice, locale), interiorPanelsPrice > 0],
    [`${labels.terrace} · ${selectedTerrace?.label || ''}`, euro(terracePrice, locale), config.variant === 'balcony' && terracePrice > 0],
    [`${labels.windowTypeLabel} · ${placedWindowCount}× ${selectedWindowType?.label || ''}`, euro(windowTypePrice, locale), windowTypePrice > 0],
    [`${labels.windowSize} · ${windowSizeDimension} mm (${labels.forAllWindows})`, euro(windowSizeExtra, locale), windowSizeExtra > 0],
    [`${labels.panoramicUpgrades} · ${panoramicWindowCount}`, euro(glazingUpgradePrice, locale), glazingUpgradePrice > 0],
    [`${labels.armouredDoor} · ${selectedArmouredDoor?.summaryLabel || ''}`, euro(armouredDoorPrice, locale), armouredDoorPrice > 0],
    [`${labels.bathroomDoor} · ${selectedBathroomDoor?.summaryLabel || ''}`, euro(bathroomDoorPrice, locale), bathroomDoorPrice > 0],
    [`${labels.kitchen} · ${selectedKitchen?.summaryLabel || ''}`, euro(kitchenVariantPrice, locale), kitchenVariantPrice > 0],
    [`${labels.kitchenSink}`, euro(kitchenSinkPrice, locale), kitchenSinkPrice > 0],
    [`${labels.insideDoorPrice} · ${config.insideDoorCount || 0}× ${selectedInsideDoorStyle?.summaryLabel || ''}`, euro(insideDoorPrice, locale), insideDoorPrice > 0],
    [labels.heatingPrice, euro(heatingPrice, locale), Boolean(config.heating)],
    [labels.totalKnown, euro(knownTotal, locale), true],
  ].filter(([, , show]) => show).map(([label, value]) => [label, value])

  // Catalogue options marked as a surcharge without a printed figure. They
  // stay selectable and surface as quotation lines rather than moving the total.
  const quotationItems = React.useMemo(() => {
    const picks = [
      // Coloured wall panels are only on order while that mode is chosen.
      [labels.interiorPanels, config.interiorPanelMode === 'coloured' ? selectedInteriorPanelColor : null],
      [labels.vanity, selectedVanity],
      [labels.kitchenPetColour, selectedKitchenPetColour],
      [labels.windowColour, selectedWindowColour],
      [labels.floorFinish, activeFloorFamily === 'herringbone' ? selectedFloor : null],
    ]
    return picks
      .filter(([, option]) => option && option.onRequest)
      .map(([label, option]) => ({ label, value: option.summaryLabel || option.label }))
  }, [labels, config.interiorPanelMode, selectedInteriorPanelColor, selectedVanity,
    selectedKitchenPetColour, selectedWindowColour, activeFloorFamily, selectedFloor])

  const socketMarkerItems = React.useMemo(
    () => config.sockets.map((socket, index) => ({
      id: socket.id,
      label: `${labels.socketMarker} ${index + 1}`,
      description: socket.description || '',
      coords: `${Math.round(socket.x)}% / ${Math.round(socket.y)}%`,
    })),
    [config.sockets, labels.socketMarker]
  )

  // Markers carry their upgrade letter so the plan can distinguish panoramic,
  // sliding and bi-folding openings at a glance.
  const windowStageMarkers = React.useMemo(
    () => (config.windows || []).map((win) => ({
      ...win,
      badge: glazingByKey[win.kind]?.marker || '',
    })),
    [config.windows, glazingByKey]
  )

  const windowMarkerItems = React.useMemo(
    () => (config.windows || []).map((win, index) => ({
      id: win.id,
      label: `${labels.windowMarker} ${index + 1}`,
      kind: win.kind || 'standard',
      badge: glazingByKey[win.kind]?.marker || '',
      coords: `${Math.round(win.x)}% / ${Math.round(win.y)}%`,
    })),
    [config.windows, labels.windowMarker]
  )

  const summaryLines = React.useMemo(() => {
    const lines = [
      t.title || (isBg ? 'Конфигурация на Бокс къща' : 'Box house configuration'),
      `${labels.model}: ${selectedModel?.label || '-'}`,
      `${labels.variant}: ${config.variant === 'balcony' ? labels.balcony : labels.standard}`,
      `${labels.layout}: ${selectedPlan?.label || ''}${selectedPlan?.subtitle ? ` - ${selectedPlan.subtitle}` : ''}`,
      `${labels.frame}: ${selectedWindowType?.label || '-'}`,
      `${labels.steelFrameColor}: ${selectedSteelFrameColor?.label || '-'}`,
      `${labels.windowColour}: ${selectedWindowColour?.label || '-'}`,
      `${labels.exteriorDoor}: ${entranceDoorLabel}`,
      `${labels.outsidePanels}: ${selectedExteriorFinishCaption}`,
      ...(config.variant === 'balcony' ? [`${labels.deckingColor}: ${selectedDeckingColor?.label || '-'}`] : []),
      `${labels.interiorPanels}: ${selectedInteriorPanels?.label || labels.defaultWhitePanels}`,
      `${labels.floorFinish}: ${optionSummary(selectedFloorOption)}`,
      `${labels.kitchenBench}: ${optionSummary(selectedKitchenBench)}`,
      `${labels.bathroom}: ${selectedBathroom?.label || '-'}`,
      `${labels.kitchen}: ${selectedKitchen?.label || '-'}`,
      `${labels.insideDoorStyle}: ${selectedInsideDoorStyle?.label || '-'}`,
      `${labels.insideDoorCount}: ${config.insideDoorCount || 0}`,
      `${labels.kitchenExtras}: ${selectedKitchenExtras.length ? selectedKitchenExtras.join(', ') : '-'}`,
      `${labels.internalWalls}: ${interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : noText}`,
      `${labels.insideDoorPrice}: ${insideDoorPrice ? euro(insideDoorPrice, locale) : '-'}`,
      `${labels.heating}: ${config.heating ? `${yesText} (${euro(heatingPrice, locale)})` : noText}`,
      `${labels.windowOpenings}: ${(config.windows || []).length}${panoramicWindowCount ? ` (${panoramicWindowCount} panoramic)` : ''}${windowExtrasPrice ? ` — ${euro(windowExtrasPrice, locale)}` : ''}`,
      config.windowNotes ? `${labels.windowNotesLabel}: ${config.windowNotes}` : '',
      `${labels.socketCount}: ${config.sockets.length}`,
      config.socketNotes ? `${labels.socketNotesLabel}: ${config.socketNotes}` : '',
      `${labels.totalKnown}: ${euro(knownTotal, locale)}`,
      `${labels.pricingFootnote}`,
    ]
    return lines.filter(Boolean).join('\n')
  }, [
    config.heating,
    config.insideDoorCount,
    config.socketNotes,
    config.sockets.length,
    config.variant,
    config.windowNotes,
    config.windows,
    heatingPrice,
    insideDoorPrice,
    interiorPanelsPrice,
    isBg,
    knownTotal,
    labels,
    locale,
    noText,
    panoramicWindowCount,
    windowExtrasPrice,
    selectedBathroom,
    selectedDeckingColor,
    selectedDoor,
    selectedExteriorFinish,
    selectedFloorOption,
    selectedWindowType,
    selectedSteelFrameColor,
    selectedInsideDoorStyle,
    selectedInteriorPanels,
    selectedKitchen,
    selectedKitchenBench,
    selectedKitchenExtras,
    selectedModel,
    selectedPlan,
    selectedWindowColour,
    t.title,
    yesText,
  ])

  const modalPrefill = React.useMemo(() => {
    // Append a shareable link so the exact configuration lands in Quickbase with
    // the lead — the team can open it in one click instead of rebuilding it.
    const shareUrl = buildShareUrl(config, {
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    })
    const shareLabel = isBg
      ? 'Отвори тази конфигурация'
      : locale === 'el'
      ? 'Άνοιξε αυτή τη διαμόρφωση'
      : 'Open this configuration'
    const offerText = `${summaryLines}\n\n${shareLabel}:\n${shareUrl}`
    return {
      source: 'box-configurator',
      sourcePath: typeof window !== 'undefined' ? window.location.pathname : '',
      // No modelId here on purpose. The offer's model field is a relationship to a
      // Houses record, and a configurator model ('37'/'58'/'73' — square metres) is not
      // one; writing it would link the lead to whichever house happens to hold that
      // record id. The chosen model is already named in the summary text below.
      // Kept for the funnel analytics: App.jsx reads modelLabel/knownTotal off the
      // prefill to enrich request_quote_success with model_label and lead_value.
      modelLabel: selectedModel?.label || '',
      knownTotal,
      offerText,
      questionText: `${isBg ? 'Въпрос за следната конфигурация на Бокс къща:' : 'Question about the following box house configuration:'}\n\n${offerText}`,
      updatedAt: Date.now(),
    }
  }, [isBg, locale, config, knownTotal, selectedModel?.key, selectedModel?.label, summaryLines])

  React.useEffect(() => {
    writeConfiguratorPrefill(modalPrefill)
  }, [modalPrefill])

  // ---- Funnel analytics -------------------------------------------------
  // start = first real interaction (config change or step navigation), once
  // per visit; step = every step arrival; complete = first arrival at summary.
  const trackStartedRef = React.useRef(false)
  const trackCompleteRef = React.useRef(false)
  const trackPrevStepRef = React.useRef(0)

  const markConfiguratorStarted = React.useCallback(() => {
    if (trackStartedRef.current) return
    trackStartedRef.current = true
    trackEvent('configurator_start', { model_label: selectedModel?.label || '' })
  }, [selectedModel?.label])

  React.useEffect(() => {
    if (trackPrevStepRef.current === stepIndex) return
    trackPrevStepRef.current = stepIndex
    markConfiguratorStarted()
    const key = STEP_KEYS[stepIndex]
    trackEvent('configurator_step', {
      step_index: stepIndex + 1,
      step_key: key,
      step_name: stepMeta[stepIndex]?.label || key,
    })
    if (key === 'summary' && !trackCompleteRef.current) {
      trackCompleteRef.current = true
      trackEvent('configurator_complete', {
        model_label: selectedModel?.label || '',
        lead_value: knownTotal,
        currency: 'EUR',
      })
    }
  }, [stepIndex, stepMeta, markConfiguratorStarted, selectedModel?.label, knownTotal])

  const handleOpenOffer = React.useCallback(() => {
    writeConfiguratorPrefill(modalPrefill)
    try {
      if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(summaryLines)
    } catch {
      // ignore clipboard limitations
    }
    openOffer()
  }, [modalPrefill, openOffer, summaryLines])

  const handleOpenQuestion = React.useCallback(() => {
    writeConfiguratorPrefill(modalPrefill)
    try {
      if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(summaryLines)
    } catch {
      // ignore clipboard limitations
    }
    openQuestion()
  }, [modalPrefill, openQuestion, summaryLines])

  function setField(field, value) {
    markConfiguratorStarted()
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  function setFieldAndFocus(field, value, previewKey) {
    setField(field, value)
    if (!previewKey) return
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current)
    previewTimerRef.current = window.setTimeout(() => {
      scrollToPreview(previewKey)
    }, 90)
  }

  function toggleKitchenExtra(key) {
    markConfiguratorStarted()
    setConfig((prev) => ({
      ...prev,
      kitchenExtras: {
        ...prev.kitchenExtras,
        [key]: !prev.kitchenExtras[key],
      },
    }))
  }

  function resetAll() {
    setConfig(buildDefaultConfig())
    setStepIndex(0)
    setStatus('')
    clearSavedConfig()
    setResumeCandidate(null)
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryLines)
      setStatus(labels.copied)
      trackEvent('configurator_copy_summary', {
        model_label: selectedModel?.label || '',
        lead_value: knownTotal,
        currency: 'EUR',
      })
    } catch {
      setStatus(labels.copyFailed)
    }
  }

  async function shareConfigLink() {
    if (typeof window === 'undefined') return
    // Prefer a short server-side link; fall back to the self-contained #cfg= hash
    // link when the API is unavailable / disabled so sharing always works offline.
    const shortUrl = await createShortLink(config, {
      apiBase: API_BASE,
      returnPath: window.location.pathname,
      modelLabel: selectedModel?.label || '',
      locale,
    })
    const url = shortUrl || buildShareUrl(config, {
      origin: window.location.origin,
      pathname: window.location.pathname,
    })
    // On mobile, prefer the native share sheet when the browser supports it.
    if (isMobileShell && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: t.title || 'NVC Home4You', url })
        setStatus(labels.linkShared)
        return
      } catch (err) {
        if (err && err.name === 'AbortError') return // visitor dismissed the sheet
        // any other failure falls through to the clipboard path
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus(labels.linkCopied)
    } catch {
      setStatus(labels.linkFailed)
    }
  }

  async function handleEmailConfig(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    if (!isLikelyEmail(emailValue)) {
      setEmailState('invalid')
      return
    }
    setEmailState('sending')
    const ok = await emailMyConfig(config, emailValue, {
      apiBase: API_BASE,
      modelLabel: selectedModel?.label || '',
      locale,
      returnPath: typeof window !== 'undefined' ? window.location.pathname : '',
    })
    setEmailState(ok ? 'sent' : 'error')
  }

  function addSocketMarker(point) {
    markConfiguratorStarted()
    setConfig((prev) => ({
      ...prev,
      sockets: [
        ...prev.sockets,
        { id: `${Date.now()}-${prev.sockets.length}`, x: point.x, y: point.y, description: '' },
      ],
    }))
  }

  function updateSocketDescription(id, description) {
    setConfig((prev) => ({
      ...prev,
      sockets: prev.sockets.map((s) => s.id === id ? { ...s, description } : s),
    }))
  }

  function removeSocketMarker(id) {
    setConfig((prev) => ({
      ...prev,
      sockets: prev.sockets.filter((s) => s.id !== id),
    }))
  }

  function addWindowMarker(point) {
    markConfiguratorStarted()
    setConfig((prev) => ({
      ...prev,
      windows: [
        ...(prev.windows || []),
        { id: `w-${Date.now()}-${(prev.windows || []).length}`, x: point.x, y: point.y, kind: prev.nextWindowKind || 'standard' },
      ],
    }))
  }

  function removeWindowMarker(id) {
    setConfig((prev) => ({
      ...prev,
      windows: (prev.windows || []).filter((w) => w.id !== id),
    }))
  }

  // Each opening is a standard window unless the buyer upgrades it to one of
  // the catalogue's fixed or sliding units.
  function setWindowKind(id, kind) {
    setConfig((prev) => ({
      ...prev,
      windows: (prev.windows || []).map((w) => (w.id === id ? { ...w, kind } : w)),
    }))
  }

  function exportPdf() {
    setStatus(labels.pdfPreparing)

    const popup = window.open('', 'nvc-box-config-print', 'width=1120,height=1500')
    if (!popup) {
      setStatus(labels.pdfBlocked)
      return
    }

    try {
      popup.opener = null
    } catch {
      // ignore
    }

    const dash = '\u2014'
    const val = (value) => (value === 0 || value ? String(value) : dash)
    // Coded finishes read as "M-01 · Silver dragon": the code alone means
    // nothing to a buyer, the name alone means nothing to the factory.
    const coded = (option) => [option?.summaryLabel, option?.displayLabel]
      .filter(Boolean).join(' · ') || dash

    // Spec rows, grouped the way the configurator steps are. Optional rows drop
    // out entirely rather than printing a dash, so the sheet stays dense.
    const specGroups = [
      [labels.pdfHouse, [
        [labels.model, selectedModel?.label],
        [labels.variant, config.variant === 'balcony' ? labels.balcony : labels.standard],
        [labels.layout, `${selectedPlan?.label || ''}${selectedPlan?.subtitle ? ` ${dash} ${selectedPlan.subtitle}` : ''}`],
        [labels.area, selectedModel?.area ? `${selectedModel.area} m²` : ''],
        [labels.dimensionsOpen, selectedModel?.dimensionsOpen],
        [labels.dimensionsFolded, selectedModel?.dimensionsFolded],
      ]],
      [labels.pdfExterior, [
        [labels.windowTypeLabel, selectedWindowType?.label],
        [labels.windowColour, selectedWindowColour?.label],
        [labels.steelFrameColor, selectedSteelFrameColor?.label],
        [labels.outsidePanels, selectedExteriorFinishCaption],
        [labels.exteriorDoor, entranceDoorLabel],
        ...(config.variant === 'balcony' ? [
          [labels.terrace, `${selectedTerrace?.label || ''}${terracePrice ? ` (+${euro(terracePrice, locale)})` : ''}`],
          [labels.deckingColor, selectedDeckingColor?.label],
        ] : []),
        [labels.windowSize, `${windowSizeDimension} mm`],
        [labels.heating, config.heating ? euro(heatingPrice, locale) : noText],
      ]],
      [labels.pdfInterior, [
        [labels.interiorPanels, selectedInteriorPanels?.label || labels.defaultWhitePanels],
        ...(config.interiorPanelMode === 'uv' ? [[labels.wallUvPanel, coded(selectedUvPanel)]] : []),
        [labels.floorFinish, coded(selectedFloorOption)],
        [labels.insideDoorStyle, `${selectedInsideDoorStyle?.label || ''} \u00d7 ${config.insideDoorCount || 0}`],
        [labels.bathroom, selectedBathroom?.label],
        [labels.bathroomUvPanel, coded(selectedBathroomUvPanel)],
        [labels.bathroomDoor, selectedBathroomDoor?.label],
        [labels.vanity, selectedVanity?.label],
        [labels.kitchen, selectedKitchen?.label],
        [labels.kitchenBench, coded(selectedKitchenBench)],
        [labels.kitchenSink, selectedKitchenSink?.label],
        ...(selectedKitchenPetColour ? [[labels.kitchenPetColour, selectedKitchenPetColour.code]] : []),
        [labels.kitchenExtras, selectedKitchenExtras.length ? selectedKitchenExtras.join(', ') : dash],
      ]],
    ]

    const specHtml = specGroups.map(([heading, rows]) => `
      <section class="block">
        <h2>${escapeHtml(heading)}</h2>
        <dl class="spec">
          ${rows
            .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
            .map(([label, value]) => `<div class="srow"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(val(value))}</dd></div>`)
            .join('')}
        </dl>
      </section>`).join('')

    const priceHtml = priceBreakdownRows
      .map(([label, value], index) => `<div class="prow${index === priceBreakdownRows.length - 1 ? ' ptotal' : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`)
      .join('')

    const quotationHtml = quotationItems.length
      ? `<div class="quote">
          <h3>${escapeHtml(labels.quotationItems)}</h3>
          ${quotationItems.map((item) => `<div class="prow"><span>${escapeHtml(item.label)}</span><span>${escapeHtml(`${item.value} · ${labels.onRequest}`)}</span></div>`).join('')}
        </div>`
      : ''

    const markerDots = (items, kind) => items
      .map((marker, index) => {
        const badge = kind === 'window' ? (glazingByKey[marker.kind]?.marker || index + 1) : index + 1
        const upgraded = kind === 'window' && marker.kind && marker.kind !== 'standard'
        return `<span class="dot${upgraded ? ' up' : ''}" style="left:${marker.x}%;top:${marker.y}%">${escapeHtml(String(badge))}</span>`
      })
      .join('')

    const legend = (items) => items.length
      ? `<ol class="legend">${items.join('')}</ol>`
      : ''

    const windowLegend = legend(windowMarkerItems.map((item) => {
      const kindLabel = glazingByKey[item.kind]?.label || labels.standardWindow
      return `<li><b>${escapeHtml(item.badge || String(windowMarkerItems.indexOf(item) + 1))}</b> ${escapeHtml(kindLabel)} <span>${escapeHtml(item.coords)}</span></li>`
    }))

    const socketLegend = legend(socketMarkerItems.map((item, index) => `<li><b>${index + 1}</b> ${escapeHtml(item.description || labels.socketMarker)} <span>${escapeHtml(item.coords)}</span></li>`))

    const planBlock = (title, image, dots, legendHtml, emptyText, note, noteLabel) => `
      <section class="block plan-block">
        <h2>${escapeHtml(title)}</h2>
        <div class="plan">
          <img src="${image}" alt="" />
          ${dots}
        </div>
        ${legendHtml || `<p class="muted">${escapeHtml(emptyText)}</p>`}
        ${note ? `<div class="note"><b>${escapeHtml(noteLabel)}</b><p>${multilineHtml(note)}</p></div>` : ''}
      </section>`

    const swatchCards = [
      [labels.outsidePanels, selectedExteriorFinish, selectedExteriorFinishCaption],
      [labels.windowColour, selectedWindowColour, selectedWindowColour?.label],
      [labels.exteriorDoor, entranceDoor, entranceDoorLabel],
      ...(config.variant === 'balcony' ? [[labels.deckingColor, selectedDeckingColor, selectedDeckingColor?.label]] : []),
      [labels.interiorPanels, selectedInteriorPanels, selectedInteriorPanels?.label || labels.defaultWhitePanels],
      [labels.floorFinish, selectedFloorOption, coded(selectedFloorOption)],
      [labels.kitchenBench, selectedKitchenBench, coded(selectedKitchenBench)],
      [labels.bathroomUvPanel, selectedBathroomUvPanel, coded(selectedBathroomUvPanel)],
      [labels.bathroomDoor, selectedBathroomDoor, selectedBathroomDoor?.label],
      [labels.vanity, selectedVanity, selectedVanity?.label],
      [labels.kitchenSink, selectedKitchenSink, selectedKitchenSink?.label],
      [labels.insideDoorStyle, selectedInsideDoorStyle, selectedInsideDoorStyle?.label],
    ]
      .filter(([, option]) => option && (option.thumbImage || option.swatch))
      .map(([title, option, caption]) => `
        <figure class="swatch">
          ${option.thumbImage
            ? `<img src="${asset(option.thumbImage)}" alt="" />`
            : `<span class="chip-fill" style="background:${option.swatch || '#e2e8f0'}"></span>`}
          <figcaption><b>${escapeHtml(title)}</b>${escapeHtml(caption || dash)}</figcaption>
        </figure>`)
      .join('')

    const roomCards = [
      [labels.bathroom, selectedBathroom?.image, selectedBathroom?.label],
      [labels.kitchen, selectedKitchen?.image, selectedKitchen?.label],
    ]
      .filter(([, image]) => image)
      .map(([title, image, caption]) => `
        <figure class="room">
          <img src="${asset(image)}" alt="" />
          <figcaption><b>${escapeHtml(title)}</b>${escapeHtml(caption || dash)}</figcaption>
        </figure>`)
      .join('')

    popup.document.open()
    popup.document.write(`<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(pdfText.title)}</title>
  <style>
    /* Laid out for A4 first: measurements are in mm and pt so what the buyer
       sees on paper matches the preview, rather than a screen layout scaled
       down at print time. */
    @page { size: A4 portrait; margin: 14mm 12mm 16mm; }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    body {
      margin: 0;
      padding: 14mm 12mm;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.45;
      color: #111827;
      background: #f1f5f9;
    }

    .doc { max-width: 186mm; margin: 0 auto; background: #fff; padding: 10mm; border-radius: 4mm; box-shadow: 0 4mm 12mm rgba(15,23,42,.12); }

    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8mm;
      padding-bottom: 4mm;
      border-bottom: 0.8mm solid #111827;
    }

    .brand { font-size: 8pt; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #6b7280; }
    h1 { margin: 1mm 0 0; font-size: 17pt; line-height: 1.15; }
    header .sub { margin: 1mm 0 0; color: #6b7280; font-size: 8.5pt; }

    .total { text-align: right; white-space: nowrap; }
    .total span { display: block; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: #6b7280; font-weight: 800; }
    .total strong { font-size: 16pt; }

    h2 {
      margin: 0 0 2mm;
      font-size: 9pt;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: #374151;
      border-bottom: 0.3mm solid #d1d5db;
      padding-bottom: 1.4mm;
    }

    .block { margin-top: 6mm; break-inside: avoid; }

    /* Two columns of label/value pairs -- roughly halves the page count. */
    .spec { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; margin: 0; }
    .srow { display: grid; grid-template-columns: 32mm 1fr; gap: 3mm; padding: 1.3mm 0; border-bottom: 0.2mm dotted #d1d5db; break-inside: avoid; }
    .srow dt { margin: 0; color: #6b7280; font-size: 8pt; font-weight: 700; }
    .srow dd { margin: 0; font-weight: 600; }

    .prow { display: flex; justify-content: space-between; gap: 6mm; padding: 1.6mm 0; border-bottom: 0.2mm dotted #d1d5db; break-inside: avoid; }
    .prow span:last-child { font-weight: 700; white-space: nowrap; }
    .ptotal { border-bottom: 0; border-top: 0.5mm solid #111827; margin-top: 1mm; padding-top: 2.4mm; font-size: 12pt; }
    .ptotal span { font-weight: 900; }

    .quote { margin-top: 4mm; padding: 3mm 4mm; background: #f8fafc; border: 0.2mm solid #e2e8f0; border-radius: 2mm; }
    .quote h3 { margin: 0 0 1mm; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: #6b7280; }

    .plans { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
    .plan { position: relative; border: 0.2mm solid #d1d5db; border-radius: 2mm; overflow: hidden; background: #fff; }
    .plan img { width: 100%; display: block; }

    .dot {
      position: absolute;
      transform: translate(-50%, -50%);
      min-width: 5mm;
      height: 5mm;
      padding: 0 1mm;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #111827;
      color: #fff;
      font-size: 7pt;
      font-weight: 900;
      border: 0.4mm solid #fff;
    }
    .dot.up { background: #2563eb; }

    .legend { margin: 2.5mm 0 0; padding: 0; list-style: none; columns: 2; column-gap: 6mm; font-size: 8pt; }
    .legend li { break-inside: avoid; padding: 0.6mm 0; color: #374151; }
    .legend b { display: inline-grid; place-items: center; min-width: 4.4mm; height: 4.4mm; margin-right: 1.5mm; border-radius: 999px; background: #111827; color: #fff; font-size: 6.5pt; }
    .legend span { color: #9ca3af; }

    .note { margin-top: 3mm; padding: 2.5mm 3mm; background: #f8fafc; border-left: 0.8mm solid #cbd5e1; }
    .note b { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: .1em; color: #6b7280; }
    .note p { margin: 1mm 0 0; }

    .swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
    .swatch, .room { margin: 0; border: 0.2mm solid #d1d5db; border-radius: 2mm; overflow: hidden; break-inside: avoid; }
    /* Contain, not cover: these are material samples, and cropping a decor
       misrepresents it. */
    .swatch img { width: 100%; height: 22mm; object-fit: contain; display: block; background: #fff; }
    .chip-fill { display: block; height: 22mm; }
    .swatch figcaption, .room figcaption { padding: 2mm; font-size: 7.5pt; line-height: 1.35; border-top: 0.2mm solid #e5e7eb; }
    .swatch figcaption b, .room figcaption b { display: block; font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; }

    .rooms { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
    .room img { width: 100%; height: 46mm; object-fit: cover; display: block; }

    .muted { color: #6b7280; font-size: 8.5pt; }

    footer { margin-top: 8mm; padding-top: 3mm; border-top: 0.2mm solid #d1d5db; color: #6b7280; font-size: 7.5pt; line-height: 1.5; }

    @media print {
      body { padding: 0; background: #fff; }
      .doc { max-width: none; padding: 0; border-radius: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="doc">
    <header>
      <div>
        <div class="brand">NVC-HOME4YOU</div>
        <h1>${escapeHtml(pdfText.title)}</h1>
        <p class="sub">${escapeHtml(pdfText.subtitle)}</p>
      </div>
      <div class="total">
        <span>${escapeHtml(pdfText.knownTotal)}</span>
        <strong>${escapeHtml(euro(knownTotal, locale))}</strong>
      </div>
    </header>

    ${specHtml}

    <section class="block">
      <h2>${escapeHtml(labels.priceBreakdown)}</h2>
      ${priceHtml}
      ${quotationHtml}
    </section>

    <section class="block">
      <h2>${escapeHtml(labels.referenceBoards)}</h2>
      <div class="swatches">${swatchCards}</div>
    </section>

    ${roomCards ? `<section class="block"><div class="rooms">${roomCards}</div></section>` : ''}

    <div class="plans">
      ${planBlock(labels.windowScheme, asset(selectedPlan?.image || ''), markerDots(config.windows || [], 'window'), windowLegend, labels.noWindows, config.windowNotes, labels.windowNotesLabel)}
      ${planBlock(labels.electricalScheme, asset(selectedPlan?.image || ''), markerDots(config.sockets, 'socket'), socketLegend, labels.noSockets, config.socketNotes, labels.socketNotesLabel)}
    </div>

    <footer>
      ${escapeHtml(`${pdfText.generatedLabel}: ${new Date().toLocaleString(isBg ? 'bg-BG' : 'en-GB')}`)}<br />
      ${escapeHtml(pdfText.note)}
    </footer>
  </div>
  <script>
    // Print only once the artwork has actually decoded, or the sheet comes out
    // with empty boxes where the plans and swatches should be.
    (function () {
      var done = false
      function go() {
        if (done) return
        done = true
        window.focus()
        window.print()
      }
      function ready() {
        var images = Array.prototype.slice.call(document.images)
        var pending = images.filter(function (img) { return !img.complete })
        var waits = pending.map(function (img) {
          return new Promise(function (resolve) {
            img.addEventListener('load', resolve, { once: true })
            img.addEventListener('error', resolve, { once: true })
          })
        })
        if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready)
        Promise.all(waits).then(function () { setTimeout(go, 150) })
        setTimeout(go, 6000)
      }
      if (document.readyState === 'complete') ready()
      else window.addEventListener('load', ready)
    })()
    window.addEventListener('afterprint', function () {
      setTimeout(function () { window.close() }, 120)
    })
  </script>
</body>
</html>`)
    popup.document.close()
    popup.focus()
    setStatus(labels.pdfOpened)
    trackEvent('configurator_pdf_export', {
      model_label: selectedModel?.label || '',
      lead_value: knownTotal,
      currency: 'EUR',
    })
  }

  function renderModelStep() {
    return (
      <div className="bhc-grid bhc-grid--2">
        <div>
          <div className="bhc-section-title">{labels.model}</div>
          <div className="bhc-card-grid bhc-card-grid--models">
            {catalog.models.map((model) => {
              const modelImage = config.variant === 'balcony'
                ? (model.balconyHeroImage || model.heroImage)
                : (model.standardHeroImage || model.heroImage)

              return (
                <ChoiceCard
                  key={model.key}
                  active={config.model === model.key}
                  title={model.label}
                  subtitle={`${labels.area}: ${model.area} m²`}
                  image={asset(modelImage)}
                  badge={euro(config.variant === 'balcony' ? model.balconyPrice : model.basePrice, locale)}
                  note={`${labels.dimensionsOpen}: ${model.dimensionsOpen}`}
                  onClick={() => setFieldAndFocus('model', model.key, 'modelPreview')}
                />
              )
            })}
          </div>
        </div>
        <div className="bhc-side-panel" ref={(node) => { previewRefs.current.modelPreview = node }}>
          <div className="bhc-section-title">{labels.variant}</div>
          <div className="bhc-toggle-row">
            <button type="button" className={['bhc-toggle', config.variant === 'standard' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('variant', 'standard', 'modelPreview')}>
              {labels.standard}
            </button>
            <button type="button" className={['bhc-toggle', config.variant === 'balcony' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('variant', 'balcony', 'modelPreview')}>
              {labels.balcony}
            </button>
          </div>
          <div className="bhc-hint">{hints.model}</div>
          <div className="bhc-detail-list">
            <SummaryRow label={labels.basePrice} value={euro(knownBasePrice, locale)} strong />
            <SummaryRow label={labels.dimensionsOpen} value={selectedModel?.dimensionsOpen || '-'} />
            <SummaryRow label={labels.dimensionsFolded} value={selectedModel?.dimensionsFolded || '-'} />
          </div>
          <img className="bhc-reference" src={cdnImage(asset(selectedModelOverviewImage), { width: 900 })} srcSet={cdnSrcSet(asset(selectedModelOverviewImage), [450, 700, 900, 1200])} sizes="(max-width: 900px) 90vw, 560px" alt="" decoding="async" />
        </div>
      </div>
    )
  }

  function renderLayoutStep() {
    return (
      <div className="bhc-grid bhc-grid--2">
        <div>
          <div className="bhc-section-title">{labels.layout}</div>
          <div className="bhc-card-grid bhc-card-grid--plans">
            {planChoices.map((plan) => (
              <ChoiceCard
                key={plan.key}
                active={config.plan === plan.key}
                title={plan.label}
                subtitle={plan.subtitle}
                image={asset(plan.image)}
                onClick={() => setFieldAndFocus('plan', plan.key, 'planPreview')}
              />
            ))}
          </div>
        </div>
        <div className="bhc-side-panel" ref={(node) => { previewRefs.current.planPreview = node }}>
          <div className="bhc-section-title">{labels.plan}</div>
          <div className="bhc-plan-stage">
            <img src={cdnImage(asset(selectedPlan?.image || ''), { width: 900 })} srcSet={cdnSrcSet(asset(selectedPlan?.image || ''), [450, 700, 900, 1200])} sizes="(max-width: 900px) 90vw, 560px" alt="" decoding="async" />
          </div>
          <div className="bhc-hint">{hints.layout}</div>
        </div>
      </div>
    )
  }

  function renderExteriorStep() {
    const exteriorPreviewCards = [
      {
        key: 'outsidePanels',
        title: labels.outsidePanels,
        image: asset(selectedExteriorFinish?.thumbImage || selectedExteriorFinish?.previewImage || selectedExteriorFinish?.referenceImage || ''),
        label: selectedExteriorFinishCaption,
        swatch: selectedExteriorFinish?.swatch,
      },
      {
        key: 'windowType',
        title: labels.windowTypeLabel,
        image: asset(selectedWindowType?.thumbImage || ''),
        label: selectedWindowType?.label || '-',
        note: priceNote(selectedWindowType),
      },
      {
        key: 'windowColour',
        title: labels.windowColour,
        image: asset(selectedWindowColour?.thumbImage || ''),
        label: selectedWindowColour?.label || '-',
        swatch: selectedWindowColour?.swatch,
      },
      {
        key: 'steelFrameColor',
        title: labels.steelFrameColor,
        image: asset(selectedSteelFrameColor?.thumbImage || ''),
        label: selectedSteelFrameColor?.label || '-',
        swatch: selectedSteelFrameColor?.swatch,
      },
      {
        key: 'exteriorDoor',
        title: labels.exteriorDoor,
        image: asset(entranceDoor?.thumbImage || ''),
        label: entranceDoorLabel,
        note: selectedArmouredDoor ? priceNote(selectedArmouredDoor) : '',
      },
      ...(config.variant !== 'balcony' ? [] : [{
        key: 'terrace',
        title: labels.terrace,
        image: '',
        label: selectedTerrace?.label || '-',
        note: [selectedTerrace?.note, priceNote(selectedTerrace)].filter(Boolean).join(' · '),
      }]),
      ...(config.variant === 'balcony' ? [{
        key: 'deckingColor',
        title: labels.deckingColor,
        image: asset(selectedDeckingColor?.thumbImage || selectedDeckingColor?.previewImage || selectedDeckingColor?.referenceImage || ''),
        label: selectedDeckingColor?.label || '-',
        swatch: selectedDeckingColor?.swatch,
      }] : []),
    ]

    return (
      <>
        <MobileOverviewTray title={labels.overview} image={asset(selectedModelHeroImage)}>
          <div className="bhc-mobile-tray-grid">
            {exteriorPreviewCards.map((card) => (
              <MobileMiniChoice
                key={card.key}
                title={card.title}
                image={card.image}
                label={card.label}
                swatch={card.swatch}
              />
            ))}
          </div>
        </MobileOverviewTray>

        <div className="bhc-grid bhc-grid--2 bhc-grid--stack-mobile">
          <div className="bhc-stack">
            <div className="bhc-group">
              <div className="bhc-section-title">{labels.windowTypeLabel}</div>
              <div className="bhc-window-type-grid">
                {catalog.windowTypeOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={['bhc-window-type', config.windowType === item.key && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => setFieldAndFocus('windowType', item.key, 'windowType')}
                  >
                    <img src={cdnImage(asset(item.thumbImage), { width: 160 })} alt="" loading="lazy" />
                    <span className="bhc-window-type-text">
                      <strong>{item.label}</strong>
                      <em>{item.note}</em>
                      <span className="bhc-window-type-price">
                        {item.price ? `+${euro(item.price, locale)} / ${labels.perWindow}` : labels.includedShort}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* The terrace only exists on the balcony variant. */}
            {config.variant === 'balcony' ? (
              <div className="bhc-group">
                <div className="bhc-section-title">{labels.terrace}</div>
                <div className="bhc-option-list">
                  {catalog.terraceOptions.map((item) => (
                    <ChoiceCard
                      key={item.key}
                      active={config.terrace === item.key}
                      title={item.label}
                      subtitle={item.note}
                      badge={item.price ? `+${euro(item.price, locale)}` : labels.includedShort}
                      onClick={() => setFieldAndFocus('terrace', item.key, 'terrace')}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.steelFrameColor}</div>
              <div className="bhc-swatch-grid bhc-swatch-grid--3">
                {catalog.steelFrameColorOptions.map((item) => (
                  <SwatchButton
                    key={item.key}
                    active={config.steelFrameColor === item.key}
                    label={item.label}
                    swatch={item.swatch}
                    onClick={() => setFieldAndFocus('steelFrameColor', item.key, 'housePreview')}
                  />
                ))}
              </div>
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.windowColour}</div>
              {selectedWindowType?.colourSet === 'decor' ? (
                <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact">
                  {windowColourOptions.map((item) => (
                    <ThumbChoiceButton
                      key={item.key}
                      active={config.windowColour === item.key}
                      label={item.label}
                      image={asset(item.thumbImage)}
                      onClick={() => setFieldAndFocus('windowColour', item.key, 'windowColour')}
                    />
                  ))}
                </div>
              ) : (
                <div className="bhc-swatch-grid bhc-swatch-grid--3">
                  {windowColourOptions.map((item) => (
                    <SwatchButton
                      key={item.key}
                      active={config.windowColour === item.key}
                      label={item.label}
                      swatch={item.swatch}
                      onClick={() => setFieldAndFocus('windowColour', item.key, 'windowColour')}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.exteriorDoor}</div>
              <div className="bhc-code-grid">
                {catalog.exteriorDoorOptions.map((item) => (
                  <OptionTile
                    key={item.key}
                    active={config.exteriorDoor === item.key}
                    title={item.label}
                    onClick={() => setFieldAndFocus('exteriorDoor', item.key, 'exteriorDoor')}
                  />
                ))}
              </div>
            </div>

            {/* Armoured leaves are only made for the solid single door. */}
            {config.exteriorDoor === 'v-01' ? (
              <div className="bhc-group">
                <div className="bhc-section-title">{labels.armouredDoor}</div>
                <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact">
                  <OptionTile
                    active={!config.armouredDoor}
                    title={labels.none}
                    onClick={() => setFieldAndFocus('armouredDoor', '', 'armouredDoor')}
                  />
                  {catalog.armouredDoorOptions.map((item) => (
                    <ThumbChoiceButton
                      key={item.key}
                      active={config.armouredDoor === item.key}
                      label={`${item.label} · +${euro(item.price, locale)}`}
                      image={asset(item.thumbImage)}
                      onClick={() => setFieldAndFocus('armouredDoor', item.key, 'armouredDoor')}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.outsidePanels}</div>
              {/* 135 decors across 18 catalogue series -- shown one series at a
                  time, or the grid is unusable. */}
              <label className="bhc-series-picker">
                <span className="bhc-series-picker-label">{labels.exteriorFinishFamily}</span>
                <select
                  className="bhc-select"
                  value={exteriorFinishGroup?.key || ''}
                  onChange={(event) => setField('exteriorFinishFamily', event.target.value)}
                >
                  {catalog.exteriorFinishGroups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.label} ({group.options.length})
                    </option>
                  ))}
                </select>
              </label>
              <div className="bhc-series-range">
                {exteriorFinishOptions[0]?.code} — {exteriorFinishOptions[exteriorFinishOptions.length - 1]?.code}
              </div>
              <GroupedOptionGrid
                options={exteriorFinishOptions}
                value={config.exteriorFinish}
                categoryLabel={labels.exteriorFinishFamily}
                showAllLabel={labels.showAllOptions}
                pageSize={optionPageSize}
                gridClassName="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact"
                renderOption={(item) => (
                  <ThumbChoiceButton
                    key={item.key}
                    active={config.exteriorFinish === item.key}
                    label={item.code}
                    image={asset(item.thumbImage || item.referenceImage || '')}
                    swatch={item.swatch}
                    onClick={() => setFieldAndFocus('exteriorFinish', item.key, 'outsidePanels')}
                  />
                )}
              />
            </div>

            {config.variant === 'balcony' ? (
              <div className="bhc-group">
                <div className="bhc-section-title">{labels.deckingColor}</div>
                <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact">
                  {catalog.deckingColorOptions.map((item) => (
                    <ThumbChoiceButton key={item.key} active={config.deckingColor === item.key} label={item.code} image={asset(item.thumbImage)} swatch={item.swatch} onClick={() => setFieldAndFocus('deckingColor', item.key, 'deckingColor')} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.windowOpenings}</div>
              <div className="bhc-hint">{labels.addWindowHint}</div>
              <div className="bhc-subhead">{labels.windowSize}</div>
              <div className="bhc-toggle-row bhc-toggle-row--3">
                <button type="button" className={['bhc-toggle', config.windowSize === '1000' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('windowSize', '1000')}>{labels.windowSize1000}</button>
                <button type="button" className={['bhc-toggle', config.windowSize === '1200' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('windowSize', '1200')}>{labels.windowSize1200}</button>
                <button type="button" className={['bhc-toggle', config.windowSize === '1400' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('windowSize', '1400')}>{labels.windowSize1400}</button>
              </div>
              <p className="bhc-window-size-note">{labels.windowSizeNote}</p>

              {/* What the next click on the plan places. Kept up here with the
                  size so buyers actually see the fixed and sliding units. */}
              <div className="bhc-subhead">{labels.openingType}</div>
              <div className="bhc-window-type-grid bhc-window-type-grid--kinds">
                <button
                  type="button"
                  className={['bhc-window-type', config.nextWindowKind === 'standard' && 'is-active'].filter(Boolean).join(' ')}
                  onClick={() => setField('nextWindowKind', 'standard')}
                >
                  <span className="bhc-window-type-text">
                    <strong>{labels.standardWindow}</strong>
                    <em>{windowSizeDimension} mm</em>
                    <span className="bhc-window-type-price">{labels.included}</span>
                  </span>
                </button>
                {catalog.glazingUpgradeOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={['bhc-window-type', config.nextWindowKind === item.key && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => setField('nextWindowKind', item.key)}
                  >
                    <img src={cdnImage(asset(item.thumbImage), { width: 160 })} alt="" loading="lazy" />
                    <span className="bhc-window-type-text">
                      <strong>{item.label}</strong>
                      <em>{item.note}</em>
                      <span className="bhc-window-type-price">
                        +{euro(item.price, locale)} / {item.unit === 'door' ? labels.perDoor : labels.perWindow}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="bhc-hint">{labels.openingTypeHint}</div>

              <WindowPlanStage image={asset(selectedPlan?.noWindowImage || selectedPlan?.image || '')} markers={windowStageMarkers} onAdd={addWindowMarker} onRemove={removeWindowMarker} interactive emptyText={labels.noWindows} />
              {(config.windows || []).length > 0 ? (
                <div className="bhc-window-list">
                  {/* Each opening is a standard window until upgraded to one of
                      the catalogue's fixed or sliding units. */}
                  {(config.windows || []).map((win, index) => (
                    <div key={win.id} className="bhc-window-row bhc-window-row--kinds">
                      <span className={['bhc-window-num', win.kind && win.kind !== 'standard' && 'is-panoramic'].filter(Boolean).join(' ')}>{index + 1}</span>
                      <select
                        className="bhc-select bhc-select--inline"
                        value={win.kind || 'standard'}
                        onChange={(event) => setWindowKind(win.id, event.target.value)}
                      >
                        <option value="standard">{labels.standardWindow}</option>
                        {catalog.glazingUpgradeOptions.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label} +{euro(item.price, locale)}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="bhc-window-remove-btn" onClick={() => removeWindowMarker(win.id)}>✕</button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="bhc-action-row bhc-action-row--stack">
                <button className="btn ghost" type="button" onClick={() => setField('windows', [])}>{actions.clearWindows}</button>
                <button className="btn ghost" type="button" onClick={() => setField('windows', (config.windows || []).slice(0, -1))}>{actions.removeLastWindow}</button>
              </div>

              <div className="bhc-window-price-box">
                <div className="bhc-window-price-row">
                  <span>{labels.windowSize} · {windowSizeDimension} mm <em>({labels.forAllWindows})</em></span>
                  <span>{windowSizeExtra ? `+${euro(windowSizeExtra, locale)}` : labels.windowSizeIncluded}</span>
                </div>
                {panoramicWindowCount ? (
                  <div className="bhc-window-price-row">
                    <span>{labels.panoramicUpgrades} · {panoramicWindowCount}</span>
                    <span>+{euro(glazingUpgradePrice, locale)}</span>
                  </div>
                ) : null}
                <div className="bhc-window-price-row bhc-window-price-row--total">
                  <span>{labels.windowExtrasLabel}</span>
                  <span>{windowExtrasPrice ? euro(windowExtrasPrice, locale) : '—'}</span>
                </div>
              </div>
              <textarea value={config.windowNotes} onChange={(e) => setField('windowNotes', e.target.value)} placeholder={labels.windowNotesPlaceholder} rows={3} />
            </div>

            <div className="bhc-group">
              <label className="bhc-check">
                <input type="checkbox" checked={config.heating} onChange={(e) => setField('heating', e.target.checked)} />
                <span>{labels.heating}</span>
              </label>
              <div className="bhc-inline-price">{labels.heatingPrice}: {euro(catalog.pricing.heatingPerM2 * (selectedModel?.area || 0), locale)}</div>
            </div>
          </div>

          <div className="bhc-side-panel bhc-side-panel--sticky">
            <div className="bhc-section-title">{labels.overview}</div>
            <div className="bhc-preview-stage bhc-preview-stage--house" data-preview="housePreview" ref={(node) => { previewRefs.current.housePreview = node }}>
              <img src={cdnImage(asset(selectedModelHeroImage), { width: 1000 })} srcSet={cdnSrcSet(asset(selectedModelHeroImage), [500, 750, 1000, 1400])} sizes="(max-width: 900px) 90vw, 600px" alt="" decoding="async" />
              <div className="bhc-preview-tags">
                <span className="bhc-chip">{selectedExteriorFinish?.label || '-'}</span>
                <span className="bhc-chip">{selectedWindowColour?.label || '-'}</span>
                <span className="bhc-chip">{selectedDoor?.label || '-'}</span>
                {config.variant === 'balcony' ? <span className="bhc-chip">{selectedDeckingColor?.label || '-'}</span> : null}
              </div>
            </div>
            <div className="bhc-preview-stage bhc-preview-stage--grid bhc-preview-stage--materials">
              {exteriorPreviewCards.map((card) => (
                <div key={card.key} data-preview={card.key} ref={(node) => { previewRefs.current[card.key] = node }}>
                  <MaterialPreviewCard
                    title={card.title}
                    image={card.image}
                    label={card.label}
                    subtitle={card.note}
                    swatch={card.swatch}
                  />
                </div>
              ))}
            </div>
            <div className="bhc-picked-list">
              <SummaryRow label={labels.variant} value={config.variant === 'balcony' ? labels.balcony : labels.standard} />
              <SummaryRow label={labels.basePrice} value={euro(knownBasePrice, locale)} strong />
              <SummaryRow label={labels.outsidePanels} value={selectedExteriorFinishCaption} />
              <SummaryRow label={labels.windowTypeLabel} value={selectedWindowType?.label || '-'} />
              <SummaryRow label={labels.windowColour} value={selectedWindowColour?.label || '-'} />
              {config.variant === 'balcony' ? <SummaryRow label={labels.terrace} value={`${selectedTerrace?.label || '-'}${terracePrice ? ` · ${euro(terracePrice, locale)}` : ''}`} /> : null}
              <SummaryRow label={labels.exteriorDoor} value={entranceDoorLabel} />
              {config.variant === 'balcony' ? <SummaryRow label={labels.deckingColor} value={selectedDeckingColor?.label || '-'} /> : null}
              <SummaryRow label={labels.steelFrameColor} value={selectedSteelFrameColor?.label || '-'} />
              <SummaryRow label={labels.windowOpenings} value={`${(config.windows || []).length}${panoramicWindowCount ? ` (${panoramicWindowCount}P)` : ''}`} />
              <SummaryRow label={labels.windowSize} value={windowSizeSummaryValue} />
              <SummaryRow label={labels.windowExtrasLabel} value={windowExtrasPrice ? euro(windowExtrasPrice, locale) : '-'} />
              <SummaryRow label={labels.heatingPrice} value={config.heating ? euro(heatingPrice, locale) : '-'} />
            </div>
            <div className="bhc-hint">{hints.exterior}</div>
          </div>
        </div>
      </>
    )
  }

  function renderInteriorStep() {
    const interiorPreviewCards = [
      {
        key: 'bathroom',
        title: labels.bathroom,
        image: asset(selectedBathroom?.image || ''),
        label: selectedBathroom?.label || '-',
        subtitle: selectedBathroom?.subtitle || labels.bathroom,
      },
      {
        key: 'kitchen',
        title: labels.kitchen,
        image: asset(selectedKitchen?.image || ''),
        label: selectedKitchen?.label || '-',
        subtitle: selectedKitchen?.subtitle || labels.kitchen,
      },
      {
        key: 'floorFinish',
        title: labels.floorFinish,
        image: asset(selectedFloorOption?.thumbImage || selectedFloorOption?.referenceImage || ''),
        label: optionDisplay(selectedFloorOption),
        subtitle: optionSummary(selectedFloorOption),
        swatch: selectedFloorOption?.swatch,
      },
      {
        key: 'kitchenBench',
        title: labels.kitchenBench,
        image: asset(selectedKitchenBench?.thumbImage || selectedKitchenBench?.referenceImage || ''),
        label: optionDisplay(selectedKitchenBench),
        subtitle: optionSummary(selectedKitchenBench),
        swatch: selectedKitchenBench?.swatch,
      },
      {
        key: 'interiorPanels',
        title: labels.interiorPanels,
        image: asset(selectedInteriorPanels?.thumbImage || selectedInteriorPanels?.referenceImage || ''),
        label: selectedInteriorPanels?.label || labels.defaultWhitePanels,
        swatch: selectedInteriorPanels?.swatch,
      },
      {
        key: 'insideDoorStyle',
        title: labels.insideDoorStyle,
        image: asset(selectedInsideDoorStyle?.thumbImage || selectedInsideDoorStyle?.referenceImage || ''),
        label: selectedInsideDoorStyle?.label || '-',
        subtitle: `${config.insideDoorCount || 0}`,
      },
    ]

    return (
      <>
        <div className="bhc-mobile-only">
          <div className="bhc-mobile-tray">
            <div className="bhc-mobile-tray-head">{labels.overview}</div>
            <div className="bhc-mobile-tray-grid">
              {interiorPreviewCards.map((card) => (
                <MobileMiniChoice
                  key={card.key}
                  title={card.title}
                  image={card.image}
                  label={card.label}
                  subtitle={card.subtitle}
                  swatch={card.swatch}
                />
              ))}
            </div>
            <div className="bhc-mobile-mini-list">
              <div><strong>{labels.interiorPanels}:</strong> {selectedInteriorPanels?.label || labels.defaultWhitePanels}</div>
              <div><strong>{labels.insideDoorStyle}:</strong> {selectedInsideDoorStyle?.label || '-'} · {config.insideDoorCount || 0}</div>
              <div><strong>{labels.internalWalls}:</strong> {interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : noText}</div>
            </div>
          </div>
        </div>

        <div className="bhc-grid bhc-grid--2 bhc-grid--stack-mobile">
          <div className="bhc-stack">
            <div className="bhc-group">
              <div className="bhc-section-title">{labels.interiorPanels}</div>
              <div className="bhc-toggle-row bhc-toggle-row--3">
                <button type="button" className={['bhc-toggle', config.interiorPanelMode === 'white' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('interiorPanelMode', 'white', 'interiorPanels')}>
                  {labels.defaultWhitePanels}
                </button>
                <button type="button" className={['bhc-toggle', config.interiorPanelMode === 'coloured' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('interiorPanelMode', 'coloured', 'interiorPanels')}>
                  {labels.colouredPanels}
                </button>
                <button type="button" className={['bhc-toggle', config.interiorPanelMode === 'uv' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('interiorPanelMode', 'uv', 'interiorPanels')}>
                  {labels.uvPanels}
                </button>
              </div>
              {config.interiorPanelMode === 'coloured' ? (
                <>
                  <div className="bhc-subhead">{labels.interiorPanelColour}</div>
                  <GroupedOptionGrid
                    options={catalog.interiorPanelColorOptions}
                    value={config.interiorPanelColor}
                    categoryLabel={labels.interiorPanelColour}
                    showAllLabel={labels.showAllOptions}
                    pageSize={optionPageSize}
                    gridClassName="bhc-swatch-grid bhc-swatch-grid--4"
                    renderOption={(item) => (
                      <SwatchButton key={item.key} active={config.interiorPanelColor === item.key} label={item.label} swatch={item.swatch} onClick={() => setFieldAndFocus('interiorPanelColor', item.key, 'interiorPanels')} />
                    )}
                  />
                </>
              ) : null}
              {config.interiorPanelMode === 'uv' ? (
                <>
                  <div className="bhc-subhead">{labels.uvPanel}</div>
                  <GroupedOptionGrid
                    options={catalog.uvPanelOptions}
                    value={config.uvPanel}
                    categoryLabel={labels.wallUvPanel}
                    showAllLabel={labels.showAllOptions}
                    pageSize={optionPageSize}
                    gridClassName="bhc-swatch-grid bhc-swatch-grid--4"
                    renderOption={(item) => (
                      <SwatchButton key={item.key} active={config.uvPanel === item.key} label={optionDisplay(item)} swatch={item.swatch} onClick={() => setFieldAndFocus('uvPanel', item.key, 'interiorPanels')} />
                    )}
                  />
                </>
              ) : null}
              <div className="bhc-inline-price">{labels.internalWalls}: {interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : noText}</div>
              <div className="bhc-hint">{isBg ? 'Цената за вътрешните панели вече се изчислява според избраното разпределение на помещенията. При стандартното бяло изпълнение не се добавя панелен пакет.' : 'Interior panel pricing now scales with the selected room layout. Standard white panels do not add an extra panel package.'}</div>
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.floorFamily}</div>
              <div className="bhc-toggle-row bhc-toggle-row--3">
                {!config.heating ? (
                  <>
                    <button type="button" className={['bhc-toggle', activeFloorFamily === 'vinyl' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('floorFamily', 'vinyl', 'floorFinish')}>{isBg ? 'Винил' : 'Vinyl'}</button>
                    <button type="button" className={['bhc-toggle', activeFloorFamily === 'herringbone' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('floorFamily', 'herringbone', 'floorFinish')}>{isBg ? 'Рибена кост' : 'Herringbone'}</button>
                  </>
                ) : null}
                {config.heating ? (
                  <button type="button" className="bhc-toggle is-active" disabled>Carbon Crystal</button>
                ) : null}
              </div>
              {config.heating ? <div className="bhc-small-note">{isBg ? 'При избрано долно отопление и изолация Carbon Crystal остава единствената подова опция.' : 'When bottom insulation and heating are selected, Carbon Crystal becomes the only floor family.'}</div> : null}
              <div className="bhc-subhead">{labels.floorFinish}</div>
              <GroupedOptionGrid
                options={activeFloorOptions}
                value={activeFloorSelection}
                categoryLabel={labels.floorFamily}
                showAllLabel={labels.showAllOptions}
                pageSize={optionPageSize}
                gridClassName="bhc-swatch-grid bhc-swatch-grid--compact"
                renderOption={(item) => (
                  <SwatchButton
                    key={item.key}
                    active={activeFloorSelection === item.key}
                    label={optionDisplay(item, item.label || '-')}
                    swatch={item.swatch || '#cbd5e1'}
                    onClick={() => setFieldAndFocus(activeFloorField, item.key, 'floorFinish')}
                  />
                )}
              />
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.kitchenBench}</div>
              <GroupedOptionGrid
                options={catalog.kitchenBenchOptions}
                value={config.kitchenBench}
                categoryLabel={labels.kitchenBench}
                showAllLabel={labels.showAllOptions}
                pageSize={optionPageSize}
                gridClassName="bhc-swatch-grid bhc-swatch-grid--compact"
                renderOption={(item) => (
                  <SwatchButton
                    key={item.key}
                    active={config.kitchenBench === item.key}
                    label={optionDisplay(item, item.label || '-')}
                    swatch={item.swatch || '#cbd5e1'}
                    onClick={() => setFieldAndFocus('kitchenBench', item.key, 'kitchenBench')}
                  />
                )}
              />
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.bathroom}</div>
              <div className="bhc-card-grid bhc-card-grid--compact">
                {catalog.bathroomOptions.map((item) => (
                  <ChoiceCard key={item.key} active={config.bathroom === item.key} title={item.label} image={asset(item.image)} onClick={() => setFieldAndFocus('bathroom', item.key, 'bathroom')} />
                ))}
              </div>
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.bathroomDoor}</div>
              <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact">
                {catalog.bathroomDoorOptions.map((item) => (
                  <ThumbChoiceButton
                    key={item.key}
                    active={config.bathroomDoor === item.key}
                    label={item.price ? `${item.label} · +${euro(item.price, locale)}` : item.label}
                    image={asset(item.thumbImage)}
                    onClick={() => setFieldAndFocus('bathroomDoor', item.key, 'bathroomDoor')}
                  />
                ))}
              </div>
            </div>

            {/* The catalogue fits UV panels in the bathroom as standard and
                offers the same decors for the living-area walls, so the two
                are chosen separately. */}
            <div className="bhc-group">
              <div className="bhc-section-title">{labels.bathroomUvPanel}</div>
              <div className="bhc-hint">{labels.bathroomUvPanelHint}</div>
              <GroupedOptionGrid
                options={catalog.uvPanelOptions}
                value={config.bathroomUvPanel}
                categoryLabel={labels.bathroomUvPanel}
                showAllLabel={labels.showAllOptions}
                pageSize={optionPageSize}
                gridClassName="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact"
                renderOption={(item) => (
                  <ThumbChoiceButton
                    key={item.key}
                    active={config.bathroomUvPanel === item.key}
                    label={item.code}
                    image={asset(item.thumbImage)}
                    swatch={item.swatch}
                    onClick={() => setFieldAndFocus('bathroomUvPanel', item.key, 'bathroomUvPanel')}
                  />
                )}
              />
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.vanity}</div>
              <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact">
                {catalog.vanityOptions.map((item) => (
                  <ThumbChoiceButton
                    key={item.key}
                    active={config.vanity === item.key}
                    label={item.onRequest ? `${item.label} · ${labels.onRequest}` : item.label}
                    image={asset(item.thumbImage)}
                    onClick={() => setFieldAndFocus('vanity', item.key, 'vanity')}
                  />
                ))}
              </div>
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.kitchen}</div>
              <div className="bhc-card-grid bhc-card-grid--compact">
                {catalog.kitchenOptions.map((item) => (
                  <ChoiceCard
                    key={item.key}
                    active={config.kitchen === item.key}
                    title={item.label}
                    image={asset(item.image)}
                    badge={item.price ? `+${euro(item.price, locale)}` : labels.includedShort}
                    onClick={() => setFieldAndFocus('kitchen', item.key, 'kitchen')}
                  />
                ))}
              </div>
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.kitchenSink}</div>
              <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact">
                {catalog.kitchenSinkOptions.map((item) => (
                  <ThumbChoiceButton
                    key={item.key}
                    active={config.kitchenSink === item.key}
                    label={item.price ? `${item.label} · +${euro(item.price, locale)}` : item.label}
                    image={asset(item.thumbImage)}
                    onClick={() => setFieldAndFocus('kitchenSink', item.key, 'kitchenSink')}
                  />
                ))}
              </div>
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.kitchenPetColour}</div>
              <div className="bhc-swatch-grid bhc-swatch-grid--3">
                <SwatchButton
                  active={!config.kitchenPetColour}
                  label={labels.none}
                  swatch="transparent"
                  onClick={() => setFieldAndFocus('kitchenPetColour', '', 'kitchenPetColour')}
                />
              </div>
              <GroupedOptionGrid
                options={catalog.kitchenPetColourOptions}
                value={config.kitchenPetColour}
                categoryLabel={labels.kitchenPetColour}
                showAllLabel={labels.showAllOptions}
                pageSize={optionPageSize}
                gridClassName="bhc-swatch-grid bhc-swatch-grid--3"
                renderOption={(item) => (
                  <SwatchButton
                    key={item.key}
                    active={config.kitchenPetColour === item.key}
                    label={item.code}
                    swatch={item.swatch}
                    onClick={() => setFieldAndFocus('kitchenPetColour', item.key, 'kitchenPetColour')}
                  />
                )}
              />
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.kitchenExtras}</div>
              <div className="bhc-pill-grid">
                {catalog.kitchenExtraOptions.map((item) => (
                  <button key={item.key} type="button" className={['bhc-pill', config.kitchenExtras[item.key] && 'is-active'].filter(Boolean).join(' ')} onClick={() => toggleKitchenExtra(item.key)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.insideDoors}</div>
              <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--wide">
                {catalog.insideDoorStyleOptions.map((item) => (
                  <ThumbChoiceButton
                    key={item.key}
                    active={config.insideDoorStyle === item.key}
                    label={item.price ? `${item.label} · +${euro(item.price, locale)}` : item.label}
                    image={asset(item.thumbImage || item.referenceImage || '')}
                    onClick={() => setFieldAndFocus('insideDoorStyle', item.key, 'insideDoorStyle')}
                  />
                ))}
              </div>
              <div className="bhc-number-grid">
                <NumberField label={labels.insideDoorCount} value={config.insideDoorCount} onChange={(value) => setFieldAndFocus('insideDoorCount', value, 'insideDoorStyle')} max={24} />
              </div>
              <div className="bhc-hint">
                {labels.insideDoorCountHint
                  .replace('{plan}', selectedPlan?.key || '-')
                  .replace('{n}', String(planDoorCount))
                  .replace('{doorWord}', planDoorCount === 1 ? labels.doorWordOne : labels.doorWordMany)}
                {Number(config.insideDoorCount) !== planDoorCount ? (
                  <button type="button" className="bhc-linkish" onClick={() => setField('insideDoorCount', planDoorCount)}>
                    {labels.resetToLayout}
                  </button>
                ) : null}
              </div>
              <div className="bhc-inline-price">
                {labels.insideDoorPrice}: {insideDoorPrice ? euro(insideDoorPrice, locale) : labels.included}
              </div>
            </div>
          </div>

          <div className="bhc-side-panel bhc-side-panel--sticky">
            <div className="bhc-section-title">{labels.overview}</div>
            <div className="bhc-preview-stage bhc-preview-stage--split">
              <div data-preview="bathroom" ref={(node) => { previewRefs.current.bathroom = node }}>
                <MaterialPreviewCard title={labels.bathroom} image={asset(selectedBathroom?.image || '')} label={selectedBathroom?.label || '-'} />
              </div>
              <div data-preview="kitchen" ref={(node) => { previewRefs.current.kitchen = node }}>
                <MaterialPreviewCard title={labels.kitchen} image={asset(selectedKitchen?.image || '')} label={selectedKitchen?.label || '-'} />
              </div>
            </div>
            <div className="bhc-preview-stage bhc-preview-stage--split bhc-preview-stage--materials">
              <div data-preview="floorFinish" ref={(node) => { previewRefs.current.floorFinish = node }}>
                <MaterialPreviewCard
                  title={labels.floorFinish}
                  image={asset(selectedFloorOption?.thumbImage || selectedFloorOption?.referenceImage || '')}
                  label={optionDisplay(selectedFloorOption)}
                  subtitle={optionSummary(selectedFloorOption)}
                  swatch={selectedFloorOption?.swatch}
                />
              </div>
              <div data-preview="kitchenBench" ref={(node) => { previewRefs.current.kitchenBench = node }}>
                <MaterialPreviewCard
                  title={labels.kitchenBench}
                  image={asset(selectedKitchenBench?.thumbImage || selectedKitchenBench?.referenceImage || '')}
                  label={optionDisplay(selectedKitchenBench)}
                  subtitle={optionSummary(selectedKitchenBench)}
                  swatch={selectedKitchenBench?.swatch}
                />
              </div>
            </div>
            <div className="bhc-preview-stage bhc-preview-stage--split bhc-preview-stage--materials">
              <div data-preview="interiorPanels" ref={(node) => { previewRefs.current.interiorPanels = node }}>
                <MaterialPreviewCard
                  title={labels.interiorPanels}
                  image={asset(selectedInteriorPanels?.thumbImage || selectedInteriorPanels?.referenceImage || '')}
                  label={selectedInteriorPanels?.label || labels.defaultWhitePanels}
                  swatch={selectedInteriorPanels?.swatch}
                />
              </div>
              <div data-preview="insideDoorStyle" ref={(node) => { previewRefs.current.insideDoorStyle = node }}>
                <MaterialPreviewCard
                  title={labels.insideDoorStyle}
                  image={asset(selectedInsideDoorStyle?.thumbImage || selectedInsideDoorStyle?.referenceImage || '')}
                  label={selectedInsideDoorStyle?.label || '-'}
                  subtitle={`${labels.insideDoorCount}: ${config.insideDoorCount || 0}`}
                />
              </div>
            </div>
            <div className="bhc-preview-stage bhc-preview-stage--split bhc-preview-stage--materials">
              <div data-preview="bathroomDoor" ref={(node) => { previewRefs.current.bathroomDoor = node }}>
                <MaterialPreviewCard
                  title={labels.bathroomDoor}
                  image={asset(selectedBathroomDoor?.thumbImage || '')}
                  label={selectedBathroomDoor?.code || '-'}
                  subtitle={priceNote(selectedBathroomDoor)}
                />
              </div>
              <div data-preview="vanity" ref={(node) => { previewRefs.current.vanity = node }}>
                <MaterialPreviewCard
                  title={labels.vanity}
                  image={asset(selectedVanity?.thumbImage || '')}
                  label={selectedVanity?.label || '-'}
                  subtitle={priceNote(selectedVanity)}
                />
              </div>
            </div>
            <div className="bhc-preview-stage bhc-preview-stage--split bhc-preview-stage--materials">
              <div data-preview="kitchenSink" ref={(node) => { previewRefs.current.kitchenSink = node }}>
                <MaterialPreviewCard
                  title={labels.kitchenSink}
                  image={asset(selectedKitchenSink?.thumbImage || '')}
                  label={selectedKitchenSink?.label || '-'}
                  subtitle={priceNote(selectedKitchenSink)}
                />
              </div>
              <div data-preview="bathroomUvPanel" ref={(node) => { previewRefs.current.bathroomUvPanel = node }}>
                <MaterialPreviewCard
                  title={labels.bathroomUvPanel}
                  image={asset(selectedBathroomUvPanel?.thumbImage || '')}
                  label={optionDisplay(selectedBathroomUvPanel)}
                  swatch={selectedBathroomUvPanel?.swatch}
                />
              </div>
            </div>
            <div className="bhc-preview-stage bhc-preview-stage--split bhc-preview-stage--materials">
              {/* Wall UV panels only exist while that panel mode is chosen. */}
              {config.interiorPanelMode === 'uv' ? (
                <div data-preview="uvPanel" ref={(node) => { previewRefs.current.uvPanel = node }}>
                  <MaterialPreviewCard
                    title={labels.wallUvPanel}
                    image={asset(selectedUvPanel?.thumbImage || '')}
                    label={optionDisplay(selectedUvPanel)}
                    swatch={selectedUvPanel?.swatch}
                  />
                </div>
              ) : null}
              <div data-preview="kitchenPetColour" ref={(node) => { previewRefs.current.kitchenPetColour = node }}>
                <MaterialPreviewCard
                  title={labels.kitchenPetColour}
                  image=""
                  label={selectedKitchenPetColour?.code || labels.none}
                  subtitle={selectedKitchenPetColour ? labels.onRequest : ''}
                  swatch={selectedKitchenPetColour?.swatch}
                />
              </div>
            </div>
            <div className="bhc-picked-list">
              <SummaryRow label={labels.interiorPanels} value={selectedInteriorPanels?.label || labels.defaultWhitePanels} />
              <SummaryRow label={labels.floorFinish} value={optionDisplay(selectedFloorOption)} />
              <SummaryRow label={labels.kitchenBench} value={optionDisplay(selectedKitchenBench)} />
              <SummaryRow label={labels.bathroomUvPanel} value={optionDisplay(selectedBathroomUvPanel)} />
              {config.interiorPanelMode === 'uv' ? <SummaryRow label={labels.wallUvPanel} value={optionDisplay(selectedUvPanel)} /> : null}
              <SummaryRow label={labels.bathroomDoor} value={selectedBathroomDoor?.code || '-'} />
              <SummaryRow label={labels.vanity} value={selectedVanity?.label || '-'} />
              <SummaryRow label={labels.kitchenSink} value={selectedKitchenSink?.label || '-'} />
              <SummaryRow label={labels.insideDoorStyle} value={selectedInsideDoorStyle?.label || '-'} />
              <SummaryRow label={labels.insideDoorPrice} value={insideDoorPrice ? euro(insideDoorPrice, locale) : '-'} />
              <SummaryRow label={labels.internalWalls} value={interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : noText} strong />
            </div>
            <div className="bhc-hint">{hints.interior}</div>
          </div>
        </div>
      </>
    )
  }

  function renderSocketsStep() {
    return (
      <>
        <MobileOverviewTray title={labels.electricalScheme} image={asset(selectedPlan?.image || '')}>
          <div className="bhc-mobile-mini-list">
            <div><strong>{labels.layout}:</strong> {selectedPlan?.label || '-'}{selectedPlan?.subtitle ? ` - ${selectedPlan.subtitle}` : ''}</div>
            <div><strong>{labels.socketCount}:</strong> {String(config.sockets.length)}</div>
            {config.socketNotes ? <div><strong>{labels.socketNotesLabel}:</strong> {config.socketNotes}</div> : null}
          </div>
        </MobileOverviewTray>

        <div className="bhc-grid bhc-grid--2">
        <div className="bhc-side-panel bhc-side-panel--full">
          <div className="bhc-section-title">{labels.sockets}</div>
          <div className="bhc-hint">{labels.socketsHint}</div>
          <SocketPlanStage image={asset(selectedPlan?.image || '')} markers={config.sockets} onAdd={addSocketMarker} onRemove={removeSocketMarker} interactive emptyText={labels.noSockets} />
        </div>
        <div className="bhc-side-panel">
          <div className="bhc-detail-list">
            <SummaryRow label={labels.socketCount} value={String(config.sockets.length)} strong />
            <SummaryRow label={labels.layout} value={`${selectedPlan?.label || ''}${selectedPlan?.subtitle ? ` - ${selectedPlan.subtitle}` : ''}`} />
          </div>
          {config.sockets.length > 0 ? (
            <div className="bhc-window-list bhc-socket-list">
              <div className="bhc-subhead">{labels.socketDescHint}</div>
              {config.sockets.map((socket, index) => (
                <div key={socket.id} className="bhc-window-row bhc-socket-row">
                  <span className="bhc-window-num bhc-socket-num">{index + 1}</span>
                  <input
                    className="bhc-socket-desc-input"
                    type="text"
                    placeholder={isBg ? `Контакт ${index + 1} — за какво ще се ползва?` : `Socket ${index + 1} — what's it for?`}
                    value={socket.description || ''}
                    onChange={(e) => updateSocketDescription(socket.id, e.target.value)}
                  />
                  <button type="button" className="bhc-window-remove-btn" onClick={() => removeSocketMarker(socket.id)} aria-label={isBg ? 'Премахни контакт' : 'Remove socket'}>✕</button>
                </div>
              ))}
            </div>
          ) : <div className="bhc-small-note">{labels.noSockets}</div>}
          <textarea value={config.socketNotes} onChange={(e) => setField('socketNotes', e.target.value)} placeholder={labels.socketNotesPlaceholder} rows={4} />
          <div className="bhc-action-row bhc-action-row--stack">
            <button className="btn ghost" type="button" onClick={() => setField('sockets', [])}>{actions.clearSockets}</button>
            <button className="btn ghost" type="button" onClick={() => setField('sockets', config.sockets.slice(0, -1))}>{actions.removeLastSocket}</button>
          </div>
          <div className="bhc-hint">{hints.sockets}</div>
        </div>
      </div>
      </>
    )
  }

  function renderSummaryStep() {
    const finishPreviewCards = [
      { key: 'outsidePanels', title: labels.outsidePanels, image: asset(selectedExteriorFinish?.thumbImage || selectedExteriorFinish?.referenceImage || ''), caption: selectedExteriorFinishCaption, swatch: selectedExteriorFinish?.swatch },
      { key: 'windowColour', title: labels.windowColour, image: asset(selectedWindowColour?.thumbImage || ''), swatch: selectedWindowColour?.swatch, caption: selectedWindowColour?.label || '-' },
      { key: 'exteriorDoor', title: labels.exteriorDoor, image: asset(entranceDoor?.thumbImage || ''), caption: entranceDoorLabel },
      ...(config.variant === 'balcony' ? [{ key: 'deckingColor', title: labels.deckingColor, image: asset(selectedDeckingColor?.thumbImage || selectedDeckingColor?.referenceImage || ''), caption: selectedDeckingColor?.label || '-', swatch: selectedDeckingColor?.swatch }] : []),
      { key: 'interiorPanels', title: labels.interiorPanels, image: asset(selectedInteriorPanels?.thumbImage || selectedInteriorPanels?.referenceImage || ''), caption: selectedInteriorPanels?.label || labels.defaultWhitePanels, swatch: selectedInteriorPanels?.swatch },
      { key: 'floorFinish', title: labels.floorFinish, image: asset(selectedFloorOption?.thumbImage || selectedFloorOption?.referenceImage || ''), caption: optionSummary(selectedFloorOption), swatch: selectedFloorOption?.swatch },
      { key: 'kitchenBench', title: labels.kitchenBench, image: asset(selectedKitchenBench?.thumbImage || selectedKitchenBench?.referenceImage || ''), caption: optionSummary(selectedKitchenBench), swatch: selectedKitchenBench?.swatch },
      { key: 'insideDoorStyle', title: labels.insideDoorStyle, image: asset(selectedInsideDoorStyle?.thumbImage || selectedInsideDoorStyle?.referenceImage || ''), caption: selectedInsideDoorStyle?.label || '-' },
    ].filter((item) => item.image || item.swatch)

    return (
      <div className="bhc-summary-stage">
        <div className="bhc-summary-hero">
          <img src={cdnImage(asset(selectedModelHeroImage), { width: 1000 })} srcSet={cdnSrcSet(asset(selectedModelHeroImage), [500, 750, 1000, 1400])} sizes="(max-width: 900px) 90vw, 600px" alt="" decoding="async" />
          <div className="bhc-summary-hero-copy">
            <div className="bhc-section-title">{labels.summary}</div>
            <h2>{selectedModel?.label} - {config.variant === 'balcony' ? labels.balcony : labels.standard}</h2>
            <div className="bhc-summary-price">{labels.totalKnown}: {euro(knownTotal, locale)}</div>
            <p>{hints.summary}</p>
            <div className="bhc-offer-cta">
              <button className="btn bhc-offer-btn" type="button" onClick={handleOpenOffer}>{actions.offer}</button>
              <p className="bhc-offer-hint">{isBg ? 'Изпратете конфигурацията и получете персонализирана оферта за вашата Бокс къща.' : 'Send your configuration and get a personalised quote for your Box house.'}</p>
            </div>
            <div className="bhc-summary-actions">
              <button className="btn ghost" type="button" onClick={exportPdf}>{actions.export}</button>
              <button className="btn ghost" type="button" onClick={copySummary}>{actions.copy}</button>
              <button className="btn ghost" type="button" onClick={shareConfigLink}>{actions.shareLink}</button>
              <button className="btn ghost" type="button" onClick={handleOpenQuestion}>{actions.question}</button>
            </div>
            <form className="bhc-email-row" onSubmit={handleEmailConfig}>
              <input
                type="email"
                className="bhc-email-input"
                placeholder={labels.emailPlaceholder}
                value={emailValue}
                onChange={(e) => { setEmailValue(e.target.value); if (emailState !== 'idle') setEmailState('idle') }}
                aria-label={labels.emailPrompt}
                autoComplete="email"
              />
              <button className="btn ghost" type="submit" disabled={emailState === 'sending'}>
                {emailState === 'sending' ? labels.emailSending : labels.emailPrompt}
              </button>
            </form>
            {emailState === 'sent' && <div className="bhc-email-status bhc-email-status--ok">{labels.emailSent}</div>}
            {emailState === 'invalid' && <div className="bhc-email-status bhc-email-status--err">{labels.emailInvalid}</div>}
            {emailState === 'error' && <div className="bhc-email-status bhc-email-status--err">{labels.emailFailed}</div>}
            <div className="bhc-small-note">{labels.exportHint}</div>
          </div>
        </div>

        <div className="bhc-summary-grid">
          <div className="bhc-side-panel bhc-side-panel--sticky">
            <div className="bhc-section-title">{labels.summary}</div>
            <div className="bhc-detail-list">
              <SummaryRow label={labels.model} value={selectedModel?.label || '-'} />
              <SummaryRow label={labels.variant} value={config.variant === 'balcony' ? labels.balcony : labels.standard} />
              <SummaryRow label={labels.layout} value={`${selectedPlan?.label || ''}${selectedPlan?.subtitle ? ` - ${selectedPlan.subtitle}` : ''}`} />
              <SummaryRow label={labels.frame} value={selectedWindowType?.label || '-'} />
              <SummaryRow label={labels.steelFrameColor} value={selectedSteelFrameColor?.label || '-'} />
              <SummaryRow label={labels.windowColour} value={selectedWindowColour?.label || '-'} />
              <SummaryRow label={labels.exteriorDoor} value={entranceDoorLabel} />
              <SummaryRow label={labels.outsidePanels} value={selectedExteriorFinishCaption} />
              {config.variant === 'balcony' ? <SummaryRow label={labels.deckingColor} value={selectedDeckingColor?.label || '-'} /> : null}
              <SummaryRow label={labels.interiorPanels} value={selectedInteriorPanels?.label || labels.defaultWhitePanels} />
              <SummaryRow label={labels.floorFinish} value={optionSummary(selectedFloorOption)} />
              <SummaryRow label={labels.kitchenBench} value={optionSummary(selectedKitchenBench)} />
              <SummaryRow label={labels.bathroom} value={selectedBathroom?.label || '-'} />
              <SummaryRow label={labels.kitchen} value={selectedKitchen?.label || '-'} />
              <SummaryRow label={labels.insideDoorStyle} value={selectedInsideDoorStyle?.label || '-'} />
              <SummaryRow label={labels.insideDoorCount} value={String(config.insideDoorCount || 0)} />
              <SummaryRow label={labels.kitchenExtras} value={selectedKitchenExtras.length ? selectedKitchenExtras.join(', ') : '-'} />
              <SummaryRow label={labels.internalWalls} value={interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : noText} />
              <SummaryRow label={labels.insideDoorPrice} value={insideDoorPrice ? euro(insideDoorPrice, locale) : '-'} />
              <SummaryRow label={labels.heating} value={config.heating ? `${yesText} (${euro(heatingPrice, locale)})` : noText} />
              <SummaryRow label={labels.windowOpenings} value={`${(config.windows || []).length}${panoramicWindowCount ? ` (${panoramicWindowCount} panoramic)` : ''}`} />
              <SummaryRow label={labels.windowSize} value={windowSizeSummaryValue} />
              <SummaryRow label={labels.windowExtrasLabel} value={windowExtrasPrice ? euro(windowExtrasPrice, locale) : '-'} />
              <SummaryRow label={labels.socketCount} value={String(config.sockets.length)} />
              <SummaryRow label={labels.totalKnown} value={euro(knownTotal, locale)} strong />
            </div>
            <div className="bhc-small-note">{labels.pricingFootnote}</div>
          </div>

          <div className="bhc-summary-board">
            <div className="bhc-side-panel bhc-side-panel--span-2">
              <div className="bhc-section-title">{labels.windowScheme}</div>
              <WindowPlanStage image={asset(selectedPlan?.noWindowImage || selectedPlan?.image || '')} markers={config.windows || []} className="bhc-socket-stage--summary bhc-window-stage--summary" emptyText={labels.noWindows} />
              <div className="bhc-chip-cloud">
                <span className="bhc-mini-chip">{labels.windowSize}: {windowSizeDimension} mm{windowSizeExtra ? ` (+${euro(windowSizeExtra, locale)} ${labels.forAllWindows})` : ''}</span>
                {windowMarkerItems.length ? windowMarkerItems.map((item) => (
                  <span key={item.id} className="bhc-mini-chip">{item.label}{item.badge ? ` · ${item.badge}` : ''} • {item.coords}</span>
                )) : <div className="bhc-small-note">{labels.noWindows}</div>}
              </div>
              {config.windowNotes ? (
                <div className="bhc-note-box">
                  <div className="bhc-note-title">{labels.windowNotesLabel}</div>
                  <div>{config.windowNotes}</div>
                </div>
              ) : null}
            </div>

            <div className="bhc-side-panel bhc-side-panel--span-2">
              <div className="bhc-section-title">{labels.electricalScheme}</div>
              <SocketPlanStage image={asset(selectedPlan?.image || '')} markers={config.sockets} className="bhc-socket-stage--summary" emptyText={labels.noSockets} />
              <div className="bhc-chip-cloud">
                {socketMarkerItems.length ? socketMarkerItems.map((item) => (
                  <span key={item.id} className="bhc-mini-chip">{item.label}{item.description ? ` — ${item.description}` : ''} • {item.coords}</span>
                )) : <div className="bhc-small-note">{labels.noSockets}</div>}
              </div>
              {config.socketNotes ? (
                <div className="bhc-note-box">
                  <div className="bhc-note-title">{labels.socketNotesLabel}</div>
                  <div>{config.socketNotes}</div>
                </div>
              ) : null}
            </div>

            <div className="bhc-side-panel bhc-summary-choice-panel">
              <div className="bhc-section-title">{labels.bathroom}</div>
              <div className="bhc-summary-choice-card">
                <img className="bhc-reference" src={cdnImage(asset(selectedBathroom?.image || ''), { width: 700 })} srcSet={cdnSrcSet(asset(selectedBathroom?.image || ''), [350, 525, 700, 1000])} sizes="(max-width: 900px) 90vw, 460px" alt="" decoding="async" />
                <div className="bhc-choice-caption"><strong>{selectedBathroom?.label || '-'}</strong><span>{selectedBathroom?.subtitle || labels.bathroom}</span></div>
              </div>
            </div>
            <div className="bhc-side-panel bhc-summary-choice-panel">
              <div className="bhc-section-title">{labels.kitchen}</div>
              <div className="bhc-summary-choice-card">
                <img className="bhc-reference" src={cdnImage(asset(selectedKitchen?.image || ''), { width: 700 })} srcSet={cdnSrcSet(asset(selectedKitchen?.image || ''), [350, 525, 700, 1000])} sizes="(max-width: 900px) 90vw, 460px" alt="" decoding="async" />
                <div className="bhc-choice-caption"><strong>{selectedKitchen?.label || '-'}</strong><span>{selectedKitchen?.subtitle || labels.kitchen}</span></div>
              </div>
            </div>

            <div className="bhc-side-panel bhc-side-panel--span-2">
              <div className="bhc-section-title">{labels.finishBoard}</div>
              <div className="bhc-meta-grid">
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.outsidePanels}</div>
                  <div className="bhc-meta-v">{selectedExteriorFinish?.label || '-'}</div>
                </div>
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.windowColour}</div>
                  <div className="bhc-meta-v">{selectedWindowColour?.label || '-'}</div>
                </div>
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.exteriorDoor}</div>
                  <div className="bhc-meta-v">{entranceDoorLabel}</div>
                </div>
                {config.variant === 'balcony' ? (
                  <div className="bhc-meta-card">
                    <div className="bhc-meta-k">{labels.deckingColor}</div>
                    <div className="bhc-meta-v">{selectedDeckingColor?.label || '-'}</div>
                  </div>
                ) : null}
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.steelFrameColor}</div>
                  <div className="bhc-meta-v">{selectedSteelFrameColor?.label || '-'}</div>
                </div>
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.interiorPanels}</div>
                  <div className="bhc-meta-v">{selectedInteriorPanels?.label || labels.defaultWhitePanels}</div>
                </div>
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.floorFinish}</div>
                  <div className="bhc-meta-v">{optionSummary(selectedFloorOption)}</div>
                </div>
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.kitchenBench}</div>
                  <div className="bhc-meta-v">{optionSummary(selectedKitchenBench)}</div>
                </div>
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.insideDoorStyle}</div>
                  <div className="bhc-meta-v">{selectedInsideDoorStyle?.label || '-'} · {config.insideDoorCount || 0}</div>
                </div>
              </div>
              <div className="bhc-chip-cloud">
                {selectedKitchenExtras.length ? selectedKitchenExtras.map((label) => (
                  <span key={label} className="bhc-mini-chip">{label}</span>
                )) : <span className="bhc-mini-chip">{labels.kitchenExtras}: -</span>}
                <span className="bhc-mini-chip">{labels.heating}: {config.heating ? euro(heatingPrice, locale) : noText}</span>
                <span className="bhc-mini-chip">{labels.windowSize}: {windowSizeDimension} mm{windowSizeExtra ? ` (+${euro(windowSizeExtra, locale)} ${labels.forAllWindows})` : ''}</span>
                <span className="bhc-mini-chip">{labels.windowOpenings}: {(config.windows || []).length}{panoramicWindowCount ? ` (${panoramicWindowCount}P)` : ''}{windowExtrasPrice ? ` — ${euro(windowExtrasPrice, locale)}` : ''}</span>
              </div>
              {config.windowNotes ? (
                <div className="bhc-note-box">
                  <div className="bhc-note-title">{labels.windowNotesLabel}</div>
                  <div>{config.windowNotes}</div>
                </div>
              ) : null}
              {finishPreviewCards.length ? (
                <div className="bhc-reference-board-grid">
                  {finishPreviewCards.map((item) => (
                    <MaterialPreviewCard
                      key={`${item.key}-${item.caption}`}
                      title={item.title}
                      image={item.image}
                      label={item.caption}
                      swatch={item.swatch}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="bhc-side-panel bhc-side-panel--span-2">
              <div className="bhc-section-title">{labels.priceBreakdown}</div>
              <div className="bhc-detail-list">
                {priceBreakdownRows.map(([label, value], index) => (
                  <SummaryRow key={label} label={label} value={value} strong={index === priceBreakdownRows.length - 1} />
                ))}
              </div>
              {quotationItems.length ? (
                <div className="bhc-detail-list">
                  <div className="bhc-subhead">{labels.quotationItems}</div>
                  {quotationItems.map((item) => (
                    <SummaryRow key={item.label} label={item.label} value={`${item.value} · ${labels.onRequest}`} />
                  ))}
                </div>
              ) : null}
              <div className="bhc-small-note">{labels.pricingFootnote}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }


  function renderHeroSection() {
    if (!isMobileShell) {
      return (
        <section className="bhc-hero">
          <div className="container">
            <div className="bhc-hero-copy">
              <h1 className="bhc-title">{t.title}</h1>
              <p className="bhc-lead">{t.lead}</p>
              <div className="row mt-6">
                <button className="btn" onClick={handleOpenOffer}>{actions.offer}</button>
                <button className="btn ghost" onClick={handleOpenQuestion}>{actions.question}</button>
                <button className="btn ghost" onClick={resetAll}>{actions.reset}</button>
              </div>
            </div>
            <div className="bhc-spec-panel">
              <div className="bhc-section-title">{labels.included}</div>
              <ul className="bhc-bullets">
                {(t.included || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
              <img className="bhc-reference" src={cdnImage(asset(catalog.references.specs), { width: 900 })} srcSet={cdnSrcSet(asset(catalog.references.specs), [450, 700, 900, 1200])} sizes="(max-width: 900px) 90vw, 560px" alt="" decoding="async" />
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="bhc-hero bhc-hero--mobile">
        <div className="container">
          <div className="bhc-hero-copy bhc-hero-copy--mobile">
            <h1 className="bhc-title">{t.title}</h1>
            <p className="bhc-lead">{t.lead}</p>
            <div className="row mt-6">
              <button className="btn" onClick={handleOpenOffer}>{actions.offer}</button>
              <button className="btn ghost" onClick={handleOpenQuestion}>{actions.question}</button>
              <button className="btn ghost" onClick={resetAll}>{actions.reset}</button>
            </div>
          </div>
          <MobileDisclosure title={labels.included} summary={isBg ? 'Покажи стандартното изпълнение' : 'Show standard specification'}>
            <ul className="bhc-bullets">
              {(t.included || []).map((item) => <li key={item}>{item}</li>)}
            </ul>
            <img className="bhc-reference" src={cdnImage(asset(catalog.references.specs), { width: 900 })} srcSet={cdnSrcSet(asset(catalog.references.specs), [450, 700, 900, 1200])} sizes="(max-width: 900px) 90vw, 560px" alt="" decoding="async" />
          </MobileDisclosure>
        </div>
      </section>
    )
  }

  function renderStageHead() {
    if (!isMobileShell) {
      return (
        <div className="bhc-stage-head">
          <div>
            <h2>{stepMeta[stepIndex]?.label}</h2>
            <p>{hints[stepKey]}</p>
          </div>
          <div className="bhc-stage-price">{labels.totalKnown}: <strong>{euro(knownTotal, locale)}</strong></div>
        </div>
      )
    }

    return (
      <div className="bhc-stage-head bhc-stage-head--mobile">
        <div className="bhc-mobile-stage-copy">
          <div className="bhc-mobile-stage-step">{isBg ? 'Стъпка' : 'Step'} {stepIndex + 1} / {STEP_KEYS.length}</div>
          <h2>{stepMeta[stepIndex]?.label}</h2>
          <p>{hints[stepKey]}</p>
        </div>
        <div className="bhc-stage-price">{labels.totalKnown}: <strong>{euro(knownTotal, locale)}</strong></div>
      </div>
    )
  }

  function renderModelStepMobile() {
    return (
      <div className="bhc-mobile-shell">
        <MobileHeroPreview
          image={asset(selectedModelHeroImage)}
          title={selectedModel?.label || '-'}
          subtitle={config.variant === 'balcony' ? labels.balcony : labels.standard}
          chips={[`${labels.area}: ${selectedModel?.area} m²`, euro(knownBasePrice, locale)]}
        />

        <MobileSection
          id="model"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.model}
          value={`${selectedModel?.label || '-'} · ${selectedModel?.area} m²`}
          thumb={asset(selectedModelHeroImage)}
        >
          <div className="bhc-card-grid bhc-card-grid--compact">
            {catalog.models.map((model) => {
              const modelImage = config.variant === 'balcony'
                ? (model.balconyHeroImage || model.heroImage)
                : (model.standardHeroImage || model.heroImage)

              return (
                <ChoiceCard
                  key={model.key}
                  active={config.model === model.key}
                  title={model.label}
                  subtitle={`${labels.area}: ${model.area} m²`}
                  image={asset(modelImage)}
                  badge={euro(config.variant === 'balcony' ? model.balconyPrice : model.basePrice, locale)}
                  onClick={() => setField('model', model.key)}
                />
              )
            })}
          </div>
        </MobileSection>

        <MobileSection
          id="variant"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.variant}
          value={config.variant === 'balcony' ? labels.balcony : labels.standard}
          badge={euro(knownBasePrice, locale)}
        >
          <div className="bhc-toggle-row">
            <button type="button" className={['bhc-toggle', config.variant === 'standard' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('variant', 'standard')}>
              {labels.standard}
            </button>
            <button type="button" className={['bhc-toggle', config.variant === 'balcony' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('variant', 'balcony')}>
              {labels.balcony}
            </button>
          </div>
          <div className="bhc-detail-list">
            <SummaryRow label={labels.basePrice} value={euro(knownBasePrice, locale)} strong />
            <SummaryRow label={labels.dimensionsOpen} value={selectedModel?.dimensionsOpen || '-'} />
            <SummaryRow label={labels.dimensionsFolded} value={selectedModel?.dimensionsFolded || '-'} />
          </div>
        </MobileSection>
      </div>
    )
  }

  function renderLayoutStepMobile() {
    return (
      <div className="bhc-mobile-shell">
        <MobileHeroPreview
          image={asset(selectedPlan?.image || '')}
          title={selectedPlan?.label || '-'}
          subtitle={selectedPlan?.subtitle || labels.layout}
          contain
        />

        <MobileSection
          id="layout"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.layout}
          value={`${selectedPlan?.label || '-'}${selectedPlan?.subtitle ? ` · ${selectedPlan.subtitle}` : ''}`}
          thumb={asset(selectedPlan?.image || '')}
        >
          <div className="bhc-card-grid bhc-card-grid--compact">
            {planChoices.map((plan) => (
              <ChoiceCard
                key={plan.key}
                active={config.plan === plan.key}
                title={plan.label}
                subtitle={plan.subtitle}
                image={asset(plan.image)}
                onClick={() => setField('plan', plan.key)}
              />
            ))}
          </div>
        </MobileSection>
      </div>
    )
  }

  function renderExteriorStepMobile() {
    // Shared between the inline summary and the full-screen editor.
    const windowListRows = (config.windows || []).length > 0 ? (
      <div className="bhc-window-list">
        {(config.windows || []).map((win, index) => (
          <div key={win.id} className="bhc-window-row">
            <span className={['bhc-window-num', win.kind && win.kind !== 'standard' && 'is-panoramic'].filter(Boolean).join(' ')}>{index + 1}</span>
            <span className="bhc-window-label">{labels.windowMarker} {index + 1}</span>
            <select className="bhc-select bhc-select--inline" value={win.kind || 'standard'} onChange={(e) => setWindowKind(win.id, e.target.value)}>
              <option value="standard">{labels.standardWindow}</option>
              {catalog.glazingUpgradeOptions.map((item) => (
                <option key={item.key} value={item.key}>{item.label} +{euro(item.price, locale)}</option>
              ))}
            </select>
            <button type="button" className="bhc-window-remove-btn" onClick={() => removeWindowMarker(win.id)}>✕</button>
          </div>
        ))}
      </div>
    ) : null

    const windowPlanModal = (
      <PlanEditorModal
        open={planEditor === 'windows'}
        title={labels.windowOpenings}
        hint={labels.openingTypeHint}
        doneLabel={labels.planEditorDone}
        onClose={() => setPlanEditor('')}
      >
        <div className="bhc-plan-modal-kinds">
          <button
            type="button"
            className={['bhc-plan-kind', config.nextWindowKind === 'standard' && 'is-active'].filter(Boolean).join(' ')}
            onClick={() => setField('nextWindowKind', 'standard')}
          >
            {labels.standardWindow}
          </button>
          {catalog.glazingUpgradeOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={['bhc-plan-kind', config.nextWindowKind === item.key && 'is-active'].filter(Boolean).join(' ')}
              onClick={() => setField('nextWindowKind', item.key)}
            >
              {item.label} <em>+{euro(item.price, locale)}</em>
            </button>
          ))}
        </div>
        <WindowPlanStage
          image={asset(selectedPlan?.noWindowImage || selectedPlan?.image || '')}
          markers={windowStageMarkers}
          onAdd={addWindowMarker}
          onRemove={removeWindowMarker}
          interactive
          className="bhc-plan-stage--modal"
          emptyText={labels.noWindows}
        />
        {windowListRows}
        <div className="bhc-action-row bhc-action-row--stack">
          <button className="btn ghost" type="button" onClick={() => setField('windows', [])}>{actions.clearWindows}</button>
          <button className="btn ghost" type="button" onClick={() => setField('windows', (config.windows || []).slice(0, -1))}>{actions.removeLastWindow}</button>
        </div>
      </PlanEditorModal>
    )

    const previewChips = [selectedExteriorFinish?.label || '-', selectedWindowColour?.label || '-', selectedDoor?.label || '-']
    if (config.variant === 'balcony') previewChips.push(selectedDeckingColor?.label || '-')

    return (
      <div className="bhc-mobile-shell">
        <MobileHeroPreview image={asset(selectedModelHeroImage)} title={selectedModel?.label || '-'} subtitle={config.variant === 'balcony' ? labels.balcony : labels.standard} chips={previewChips} />

        <MobileSection
          id="panels"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.outsidePanels}
          value={selectedExteriorFinishCaption}
          thumb={asset(selectedExteriorFinish?.thumbImage || selectedExteriorFinish?.referenceImage || '')}
          swatch={selectedExteriorFinish?.swatch}
        >
          <label className="bhc-series-picker">
            <span className="bhc-series-picker-label">{labels.exteriorFinishFamily}</span>
            <select
              className="bhc-select"
              value={exteriorFinishGroup?.key || ''}
              onChange={(event) => setField('exteriorFinishFamily', event.target.value)}
            >
              {catalog.exteriorFinishGroups.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.label} ({group.options.length})
                </option>
              ))}
            </select>
          </label>
          <GroupedOptionGrid
            options={exteriorFinishOptions}
            value={config.exteriorFinish}
            categoryLabel={labels.exteriorFinishFamily}
            showAllLabel={labels.showAllOptions}
            pageSize={optionPageSize}
            gridClassName="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact"
            renderOption={(item) => (
              <ThumbChoiceButton
                key={item.key}
                active={config.exteriorFinish === item.key}
                label={item.code}
                image={asset(item.thumbImage || item.referenceImage || '')}
                swatch={item.swatch}
                onClick={() => setField('exteriorFinish', item.key)}
              />
            )}
          />
        </MobileSection>

        <MobileSection
          id="frame"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.windowTypeLabel}
          value={selectedWindowType?.label || '-'}
          badge={selectedWindowType?.price ? `+${euro(selectedWindowType.price, locale)}` : labels.includedShort}
          thumb={asset(selectedWindowType?.thumbImage || '')}
        >
          <div className="bhc-window-type-grid">
            {catalog.windowTypeOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                className={['bhc-window-type', config.windowType === item.key && 'is-active'].filter(Boolean).join(' ')}
                onClick={() => setField('windowType', item.key)}
              >
                <img src={cdnImage(asset(item.thumbImage), { width: 160 })} alt="" loading="lazy" />
                <span className="bhc-window-type-text">
                  <strong>{item.label}</strong>
                  <em>{item.note}</em>
                  <span className="bhc-window-type-price">
                    {item.price ? `+${euro(item.price, locale)} / ${labels.perWindow}` : labels.includedShort}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="windowColour"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.windowColour}
          value={selectedWindowColour?.label || '-'}
          thumb={asset(selectedWindowColour?.thumbImage || '')}
          swatch={selectedWindowColour?.swatch}
        >
          {selectedWindowType?.colourSet === 'decor' ? (
            <div className="bhc-thumb-choice-grid">
              {windowColourOptions.map((item) => (
                <ThumbChoiceButton key={item.key} active={config.windowColour === item.key} label={item.label} image={asset(item.thumbImage)} onClick={() => setField('windowColour', item.key)} />
              ))}
            </div>
          ) : (
            <div className="bhc-swatch-grid bhc-swatch-grid--compact">
              {windowColourOptions.map((item) => (
                <SwatchButton key={item.key} active={config.windowColour === item.key} label={item.label} swatch={item.swatch} onClick={() => setField('windowColour', item.key)} />
              ))}
            </div>
          )}
        </MobileSection>

        <MobileSection
          id="exteriorDoor"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.exteriorDoor}
          value={entranceDoorLabel}
          thumb={asset(entranceDoor?.thumbImage || '')}
        >
          <div className="bhc-thumb-choice-grid">
            {catalog.exteriorDoorOptions.map((item) => (
              <ThumbChoiceButton key={item.key} active={config.exteriorDoor === item.key} label={item.label} image={asset(item.thumbImage)} onClick={() => setField('exteriorDoor', item.key)} />
            ))}
          </div>
          {/* Armoured leaves are only made for the solid single door. */}
          {config.exteriorDoor === 'v-01' ? (
            <>
              <div className="bhc-subhead">{labels.armouredDoor}</div>
              <div className="bhc-thumb-choice-grid">
                <OptionTile active={!config.armouredDoor} title={labels.none} onClick={() => setField('armouredDoor', '')} />
                {catalog.armouredDoorOptions.map((item) => (
                  <ThumbChoiceButton
                    key={item.key}
                    active={config.armouredDoor === item.key}
                    label={`${item.label} · +${euro(item.price, locale)}`}
                    image={asset(item.thumbImage)}
                    onClick={() => setField('armouredDoor', item.key)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </MobileSection>

        {/* The terrace only exists on the balcony variant. */}
        {config.variant === 'balcony' ? (
          <MobileSection
            id="terrace"
            openId={openSection}
            onToggle={toggleSection}
            title={labels.terrace}
            value={selectedTerrace?.label || '-'}
            badge={terracePrice ? `+${euro(terracePrice, locale)}` : labels.includedShort}
          >
            <div className="bhc-option-list">
              {catalog.terraceOptions.map((item) => (
                <ChoiceCard
                  key={item.key}
                  active={config.terrace === item.key}
                  title={item.label}
                  subtitle={item.note}
                  badge={item.price ? `+${euro(item.price, locale)}` : labels.includedShort}
                  onClick={() => setField('terrace', item.key)}
                />
              ))}
            </div>
          </MobileSection>
        ) : null}

        <MobileSection
          id="steelColor"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.steelFrameColor}
          value={selectedSteelFrameColor?.label || '-'}
          swatch={selectedSteelFrameColor?.swatch}
        >
          <div className="bhc-swatch-grid bhc-swatch-grid--compact">
            {catalog.steelFrameColorOptions.map((item) => (
              <SwatchButton
                key={item.key}
                active={config.steelFrameColor === item.key}
                label={item.label}
                swatch={item.swatch}
                onClick={() => setField('steelFrameColor', item.key)}
              />
            ))}
          </div>
        </MobileSection>

        {config.variant === 'balcony' ? (
          <MobileSection
            id="decking"
            openId={openSection}
            onToggle={toggleSection}
            title={labels.deckingColor}
            value={selectedDeckingColor?.label || '-'}
            swatch={selectedDeckingColor?.swatch}
          >
            <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact">
              {catalog.deckingColorOptions.map((item) => (
                <ThumbChoiceButton key={item.key} active={config.deckingColor === item.key} label={item.code} image={asset(item.thumbImage)} swatch={item.swatch} onClick={() => setField('deckingColor', item.key)} />
              ))}
            </div>
          </MobileSection>
        ) : null}

        <MobileSection
          id="windows"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.windowOpenings}
          value={`${(config.windows || []).length} · ${windowSizeDimension} mm${windowExtrasPrice ? ` · +${euro(windowExtrasPrice, locale)}` : ''}`}
        >
          <div className="bhc-hint">{labels.addWindowHint}</div>
          <div className="bhc-subhead">{labels.windowSize}</div>
          <div className="bhc-toggle-row bhc-toggle-row--3">
            <button type="button" className={['bhc-toggle', config.windowSize === '1000' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('windowSize', '1000')}>{labels.windowSize1000}</button>
            <button type="button" className={['bhc-toggle', config.windowSize === '1200' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('windowSize', '1200')}>{labels.windowSize1200}</button>
            <button type="button" className={['bhc-toggle', config.windowSize === '1400' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('windowSize', '1400')}>{labels.windowSize1400}</button>
          </div>
          <p className="bhc-window-size-note">{labels.windowSizeNote}</p>
          <div className="bhc-subhead">{labels.openingType}</div>
          <div className="bhc-window-type-grid bhc-window-type-grid--kinds">
            <button
              type="button"
              className={['bhc-window-type', config.nextWindowKind === 'standard' && 'is-active'].filter(Boolean).join(' ')}
              onClick={() => setField('nextWindowKind', 'standard')}
            >
              <span className="bhc-window-type-text">
                <strong>{labels.standardWindow}</strong>
                <em>{windowSizeDimension} mm</em>
                <span className="bhc-window-type-price">{labels.included}</span>
              </span>
            </button>
            {catalog.glazingUpgradeOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                className={['bhc-window-type', config.nextWindowKind === item.key && 'is-active'].filter(Boolean).join(' ')}
                onClick={() => setField('nextWindowKind', item.key)}
              >
                <img src={cdnImage(asset(item.thumbImage), { width: 160 })} alt="" loading="lazy" />
                <span className="bhc-window-type-text">
                  <strong>{item.label}</strong>
                  <em>{item.note}</em>
                  <span className="bhc-window-type-price">
                    +{euro(item.price, locale)} / {item.unit === 'door' ? labels.perDoor : labels.perWindow}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="bhc-hint">{labels.openingTypeHint}</div>

          {/* The plan is unusable at accordion width, so placing happens
              full-screen; this stays as a read-only picture of the result. */}
          <button type="button" className="btn bhc-plan-open-btn" onClick={() => setPlanEditor('windows')}>
            {labels.openPlanEditor}
          </button>
          <WindowPlanStage image={asset(selectedPlan?.noWindowImage || selectedPlan?.image || '')} markers={windowStageMarkers} emptyText={labels.noWindows} />
          {windowListRows}
          <div className="bhc-action-row bhc-action-row--stack">
            <button className="btn ghost" type="button" onClick={() => setField('windows', [])}>{actions.clearWindows}</button>
            <button className="btn ghost" type="button" onClick={() => setField('windows', (config.windows || []).slice(0, -1))}>{actions.removeLastWindow}</button>
          </div>
          <div className="bhc-window-price-box">
            <div className="bhc-window-price-row">
              <span>{labels.windowSize} · {windowSizeDimension} mm <em>({labels.forAllWindows})</em></span>
              <span>{windowSizeExtra ? `+${euro(windowSizeExtra, locale)}` : labels.windowSizeIncluded}</span>
            </div>
            {panoramicWindowCount ? (
              <div className="bhc-window-price-row">
                <span>{labels.panoramicUpgrades} · {panoramicWindowCount}</span>
                <span>+{euro(glazingUpgradePrice, locale)}</span>
              </div>
            ) : null}
            <div className="bhc-window-price-row bhc-window-price-row--total">
              <span>{labels.windowExtrasLabel}</span>
              <span>{windowExtrasPrice ? euro(windowExtrasPrice, locale) : '—'}</span>
            </div>
          </div>
          <textarea value={config.windowNotes} onChange={(e) => setField('windowNotes', e.target.value)} placeholder={labels.windowNotesPlaceholder} rows={3} />
        </MobileSection>

        <MobileSection
          id="heating"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.heating}
          value={config.heating ? `${yesText} · ${euro(heatingPrice, locale)}` : noText}
        >
          <label className="bhc-check">
            <input type="checkbox" checked={config.heating} onChange={(e) => setField('heating', e.target.checked)} />
            <span>{labels.heating}</span>
          </label>
          <div className="bhc-inline-price">{labels.heatingPrice}: {euro(catalog.pricing.heatingPerM2 * (selectedModel?.area || 0), locale)}</div>
          <div className="bhc-hint">{hints.exterior}</div>
        </MobileSection>

        {windowPlanModal}
      </div>
    )
  }

  function renderInteriorStepMobile() {
    return (
      <div className="bhc-mobile-shell">
        <MobileHeroPreview
          image={asset(selectedKitchen?.image || selectedBathroom?.image || '')}
          title={selectedInteriorPanels?.label || labels.defaultWhitePanels}
          subtitle={`${optionDisplay(selectedFloorOption)} · ${optionDisplay(selectedKitchenBench)}`}
          chips={[selectedBathroom?.label || '-', selectedKitchen?.label || '-']}
        />

        <MobileSection
          id="panels"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.interiorPanels}
          value={`${selectedInteriorPanels?.label || labels.defaultWhitePanels}${interiorPanelsPrice ? ` · ${euro(interiorPanelsPrice, locale)}` : ''}`}
          thumb={asset(selectedInteriorPanels?.thumbImage || selectedInteriorPanels?.referenceImage || '')}
          swatch={selectedInteriorPanels?.swatch}
        >
          <div className="bhc-toggle-row bhc-toggle-row--3">
            <button type="button" className={['bhc-toggle', config.interiorPanelMode === 'white' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('interiorPanelMode', 'white')}>
              {labels.defaultWhitePanels}
            </button>
            <button type="button" className={['bhc-toggle', config.interiorPanelMode === 'coloured' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('interiorPanelMode', 'coloured')}>
              {labels.colouredPanels}
            </button>
            <button type="button" className={['bhc-toggle', config.interiorPanelMode === 'uv' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('interiorPanelMode', 'uv')}>
              {labels.uvPanels}
            </button>
          </div>
          {config.interiorPanelMode === 'coloured' ? (
            <>
              <div className="bhc-subhead">{labels.interiorPanelColour}</div>
              <GroupedOptionGrid
                options={catalog.interiorPanelColorOptions}
                value={config.interiorPanelColor}
                categoryLabel={labels.interiorPanelColour}
                showAllLabel={labels.showAllOptions}
                pageSize={optionPageSize}
                gridClassName="bhc-swatch-grid bhc-swatch-grid--compact"
                renderOption={(item) => (
                  <SwatchButton key={item.key} active={config.interiorPanelColor === item.key} label={item.label} swatch={item.swatch} onClick={() => setField('interiorPanelColor', item.key)} />
                )}
              />
            </>
          ) : null}
          {config.interiorPanelMode === 'uv' ? (
            <>
              <div className="bhc-subhead">{labels.wallUvPanel}</div>
              <GroupedOptionGrid
                options={catalog.uvPanelOptions}
                value={config.uvPanel}
                categoryLabel={labels.wallUvPanel}
                showAllLabel={labels.showAllOptions}
                pageSize={optionPageSize}
                gridClassName="bhc-thumb-choice-grid"
                renderOption={(item) => (
                  <ThumbChoiceButton key={item.key} active={config.uvPanel === item.key} label={item.code} image={asset(item.thumbImage)} swatch={item.swatch} onClick={() => setField('uvPanel', item.key)} />
                )}
              />
            </>
          ) : null}
          <div className="bhc-inline-price">{labels.internalWalls}: {interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : noText}</div>
        </MobileSection>

        <MobileSection
          id="floor"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.floorFinish}
          value={optionDisplay(selectedFloorOption)}
          thumb={asset(selectedFloorOption?.thumbImage || selectedFloorOption?.referenceImage || '')}
          swatch={selectedFloorOption?.swatch}
        >
          <div className="bhc-section-title">{labels.floorFamily}</div>
          <div className="bhc-toggle-row bhc-toggle-row--3">
            {!config.heating ? (
              <>
                <button type="button" className={['bhc-toggle', activeFloorFamily === 'vinyl' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('floorFamily', 'vinyl')}>{isBg ? 'Винил' : 'Vinyl'}</button>
                <button type="button" className={['bhc-toggle', activeFloorFamily === 'herringbone' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('floorFamily', 'herringbone')}>{isBg ? 'Рибена кост' : 'Herringbone'}</button>
              </>
            ) : null}
            {config.heating ? <button type="button" className="bhc-toggle is-active" disabled>Carbon Crystal</button> : null}
          </div>
          {config.heating ? <div className="bhc-small-note">{isBg ? 'При избрано отопление Carbon Crystal остава единствената подова опция.' : 'With heating selected, Carbon Crystal remains the only floor option.'}</div> : null}
          <div className="bhc-subhead">{labels.floorFinish}</div>
          <GroupedOptionGrid
            options={activeFloorOptions}
            value={activeFloorSelection}
            categoryLabel={labels.floorFamily}
            showAllLabel={labels.showAllOptions}
            pageSize={optionPageSize}
            gridClassName="bhc-swatch-grid bhc-swatch-grid--compact"
            renderOption={(item) => (
              <SwatchButton key={item.key} active={activeFloorSelection === item.key} label={optionDisplay(item, item.label || '-')} swatch={item.swatch || '#cbd5e1'} onClick={() => setField(activeFloorField, item.key)} />
            )}
          />
        </MobileSection>

        <MobileSection
          id="bench"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.kitchenBench}
          value={optionDisplay(selectedKitchenBench)}
          thumb={asset(selectedKitchenBench?.thumbImage || selectedKitchenBench?.referenceImage || '')}
          swatch={selectedKitchenBench?.swatch}
        >
          <GroupedOptionGrid
            options={catalog.kitchenBenchOptions}
            value={config.kitchenBench}
            categoryLabel={labels.kitchenBench}
            showAllLabel={labels.showAllOptions}
            pageSize={optionPageSize}
            gridClassName="bhc-swatch-grid bhc-swatch-grid--compact"
            renderOption={(item) => (
              <SwatchButton key={item.key} active={config.kitchenBench === item.key} label={optionDisplay(item, item.label || '-')} swatch={item.swatch || '#cbd5e1'} onClick={() => setField('kitchenBench', item.key)} />
            )}
          />
        </MobileSection>

        <MobileSection
          id="bathroom"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.bathroom}
          value={selectedBathroom?.label || '-'}
          thumb={asset(selectedBathroom?.image || '')}
        >
          <div className="bhc-card-grid bhc-card-grid--compact">
            {catalog.bathroomOptions.map((item) => (
              <ChoiceCard key={item.key} active={config.bathroom === item.key} title={item.label} image={asset(item.image)} badge={labels.includedShort} onClick={() => setField('bathroom', item.key)} />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="bathroomUv"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.bathroomUvPanel}
          value={optionDisplay(selectedBathroomUvPanel)}
          thumb={asset(selectedBathroomUvPanel?.thumbImage || '')}
          swatch={selectedBathroomUvPanel?.swatch}
        >
          <div className="bhc-hint">{labels.bathroomUvPanelHint}</div>
          <GroupedOptionGrid
            options={catalog.uvPanelOptions}
            value={config.bathroomUvPanel}
            categoryLabel={labels.bathroomUvPanel}
            showAllLabel={labels.showAllOptions}
            pageSize={optionPageSize}
            gridClassName="bhc-thumb-choice-grid bhc-thumb-choice-grid--compact"
            renderOption={(item) => (
              <ThumbChoiceButton key={item.key} active={config.bathroomUvPanel === item.key} label={item.code} image={asset(item.thumbImage)} swatch={item.swatch} onClick={() => setField('bathroomUvPanel', item.key)} />
            )}
          />
        </MobileSection>

        <MobileSection
          id="bathroomDoor"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.bathroomDoor}
          value={selectedBathroomDoor?.label || '-'}
          badge={bathroomDoorPrice ? `+${euro(bathroomDoorPrice, locale)}` : labels.includedShort}
          thumb={asset(selectedBathroomDoor?.thumbImage || '')}
        >
          <div className="bhc-thumb-choice-grid">
            {catalog.bathroomDoorOptions.map((item) => (
              <ThumbChoiceButton
                key={item.key}
                active={config.bathroomDoor === item.key}
                label={item.price ? `${item.label} · +${euro(item.price, locale)}` : item.label}
                image={asset(item.thumbImage)}
                onClick={() => setField('bathroomDoor', item.key)}
              />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="vanity"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.vanity}
          value={selectedVanity?.label || '-'}
          badge={selectedVanity?.onRequest ? labels.onRequest : labels.includedShort}
          thumb={asset(selectedVanity?.thumbImage || '')}
        >
          <div className="bhc-thumb-choice-grid">
            {catalog.vanityOptions.map((item) => (
              <ThumbChoiceButton
                key={item.key}
                active={config.vanity === item.key}
                label={item.onRequest ? `${item.label} · ${labels.onRequest}` : item.label}
                image={asset(item.thumbImage)}
                onClick={() => setField('vanity', item.key)}
              />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="kitchen"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.kitchen}
          value={selectedKitchen?.label || '-'}
          badge={kitchenVariantPrice ? `+${euro(kitchenVariantPrice, locale)}` : labels.includedShort}
          thumb={asset(selectedKitchen?.image || '')}
        >
          <div className="bhc-card-grid bhc-card-grid--compact">
            {catalog.kitchenOptions.map((item) => (
              <ChoiceCard
                key={item.key}
                active={config.kitchen === item.key}
                title={item.label}
                image={asset(item.image)}
                badge={item.price ? `+${euro(item.price, locale)}` : labels.includedShort}
                onClick={() => setField('kitchen', item.key)}
              />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="kitchenSink"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.kitchenSink}
          value={selectedKitchenSink?.label || '-'}
          badge={kitchenSinkPrice ? `+${euro(kitchenSinkPrice, locale)}` : labels.includedShort}
          thumb={asset(selectedKitchenSink?.thumbImage || '')}
        >
          <div className="bhc-thumb-choice-grid">
            {catalog.kitchenSinkOptions.map((item) => (
              <ThumbChoiceButton
                key={item.key}
                active={config.kitchenSink === item.key}
                label={item.price ? `${item.label} · +${euro(item.price, locale)}` : item.label}
                image={asset(item.thumbImage)}
                onClick={() => setField('kitchenSink', item.key)}
              />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="petColour"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.kitchenPetColour}
          value={selectedKitchenPetColour ? `${selectedKitchenPetColour.code} · ${labels.onRequest}` : labels.none}
          swatch={selectedKitchenPetColour?.swatch}
        >
          <div className="bhc-swatch-grid bhc-swatch-grid--compact">
            <SwatchButton active={!config.kitchenPetColour} label={labels.none} swatch="transparent" onClick={() => setField('kitchenPetColour', '')} />
          </div>
          <GroupedOptionGrid
            options={catalog.kitchenPetColourOptions}
            value={config.kitchenPetColour}
            categoryLabel={labels.kitchenPetColour}
            showAllLabel={labels.showAllOptions}
            pageSize={optionPageSize}
            gridClassName="bhc-swatch-grid bhc-swatch-grid--compact"
            renderOption={(item) => (
              <SwatchButton key={item.key} active={config.kitchenPetColour === item.key} label={item.code} swatch={item.swatch} onClick={() => setField('kitchenPetColour', item.key)} />
            )}
          />
        </MobileSection>

        <MobileSection
          id="extras"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.kitchenExtras}
          value={selectedKitchenExtras.length ? selectedKitchenExtras.join(', ') : '-'}
        >
          <div className="bhc-pill-grid">
            {catalog.kitchenExtraOptions.map((item) => (
              <button key={item.key} type="button" className={['bhc-pill', config.kitchenExtras[item.key] && 'is-active'].filter(Boolean).join(' ')} onClick={() => toggleKitchenExtra(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="doors"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.insideDoors}
          value={`${selectedInsideDoorStyle?.label || '-'} · ${config.insideDoorCount || 0}${insideDoorPrice ? ` · ${euro(insideDoorPrice, locale)}` : ''}`}
          thumb={asset(selectedInsideDoorStyle?.thumbImage || selectedInsideDoorStyle?.referenceImage || '')}
        >
          <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--wide">
            {catalog.insideDoorStyleOptions.map((item) => (
              <ThumbChoiceButton
                key={item.key}
                active={config.insideDoorStyle === item.key}
                label={item.price ? `${item.label} · +${euro(item.price, locale)}` : item.label}
                image={asset(item.thumbImage || item.referenceImage || '')}
                onClick={() => setField('insideDoorStyle', item.key)}
              />
            ))}
          </div>
          <div className="bhc-number-grid">
            <NumberField label={labels.insideDoorCount} value={config.insideDoorCount} onChange={(value) => setField('insideDoorCount', value)} max={24} />
          </div>
          <div className="bhc-hint">
            {labels.insideDoorCountHint
              .replace('{plan}', selectedPlan?.key || '-')
              .replace('{n}', String(planDoorCount))
              .replace('{doorWord}', planDoorCount === 1 ? labels.doorWordOne : labels.doorWordMany)}
            {Number(config.insideDoorCount) !== planDoorCount ? (
              <button type="button" className="bhc-linkish" onClick={() => setField('insideDoorCount', planDoorCount)}>
                {labels.resetToLayout}
              </button>
            ) : null}
          </div>
          <div className="bhc-inline-price">{labels.insideDoorPrice}: {insideDoorPrice ? euro(insideDoorPrice, locale) : labels.included}</div>
        </MobileSection>
      </div>
    )
  }

  function renderSocketsStepMobile() {
    // Shared between the inline list and the full-screen editor.
    const socketRows = config.sockets.length > 0 ? (
      <div className="bhc-window-list bhc-socket-list">
        <div className="bhc-subhead">{labels.socketDescHint}</div>
        {config.sockets.map((socket, index) => (
          <div key={socket.id} className="bhc-window-row bhc-socket-row">
            <span className="bhc-window-num bhc-socket-num">{index + 1}</span>
            <input
              className="bhc-socket-desc-input"
              type="text"
              placeholder={isBg ? `Контакт ${index + 1} — за какво ще се ползва?` : `Socket ${index + 1} — what's it for?`}
              value={socket.description || ''}
              onChange={(e) => updateSocketDescription(socket.id, e.target.value)}
            />
            <button type="button" className="bhc-window-remove-btn" onClick={() => removeSocketMarker(socket.id)} aria-label={isBg ? 'Премахни контакт' : 'Remove socket'}>✕</button>
          </div>
        ))}
      </div>
    ) : <div className="bhc-small-note">{labels.noSockets}</div>

    return (
      <div className="bhc-mobile-shell">
        <div className="bhc-side-panel bhc-side-panel--full">
          <div className="bhc-msocket-head">
            <div className="bhc-section-title">{labels.sockets}</div>
            <span className="bhc-msocket-count">{labels.socketCount}: {config.sockets.length}</span>
          </div>
          <div className="bhc-hint">{labels.socketsHint}</div>
          {/* Placing a socket needs a bigger target than the column allows. */}
          <button type="button" className="btn bhc-plan-open-btn" onClick={() => setPlanEditor('sockets')}>
            {labels.openPlanEditor}
          </button>
          <SocketPlanStage image={asset(selectedPlan?.image || '')} markers={config.sockets} emptyText={labels.noSockets} />
        </div>

        <div className="bhc-side-panel">
          {socketRows}
          <textarea value={config.socketNotes} onChange={(e) => setField('socketNotes', e.target.value)} placeholder={labels.socketNotesPlaceholder} rows={4} />
          <div className="bhc-action-row bhc-action-row--stack">
            <button className="btn ghost" type="button" onClick={() => setField('sockets', [])}>{actions.clearSockets}</button>
            <button className="btn ghost" type="button" onClick={() => setField('sockets', config.sockets.slice(0, -1))}>{actions.removeLastSocket}</button>
          </div>
        </div>

        <PlanEditorModal
          open={planEditor === 'sockets'}
          title={labels.sockets}
          hint={labels.socketsHint}
          doneLabel={labels.planEditorDone}
          onClose={() => setPlanEditor('')}
        >
          <SocketPlanStage
            image={asset(selectedPlan?.image || '')}
            markers={config.sockets}
            onAdd={addSocketMarker}
            onRemove={removeSocketMarker}
            interactive
            className="bhc-plan-stage--modal"
            emptyText={labels.noSockets}
          />
          {socketRows}
          <div className="bhc-action-row bhc-action-row--stack">
            <button className="btn ghost" type="button" onClick={() => setField('sockets', [])}>{actions.clearSockets}</button>
            <button className="btn ghost" type="button" onClick={() => setField('sockets', config.sockets.slice(0, -1))}>{actions.removeLastSocket}</button>
          </div>
        </PlanEditorModal>
      </div>
    )
  }

  function renderSummaryStepMobile() {
    const finishPreviewCards = [
      { key: 'outsidePanels', title: labels.outsidePanels, image: asset(selectedExteriorFinish?.thumbImage || selectedExteriorFinish?.referenceImage || ''), caption: selectedExteriorFinishCaption, swatch: selectedExteriorFinish?.swatch },
      { key: 'windowColour', title: labels.windowColour, image: asset(selectedWindowColour?.thumbImage || ''), swatch: selectedWindowColour?.swatch, caption: selectedWindowColour?.label || '-' },
      { key: 'exteriorDoor', title: labels.exteriorDoor, image: asset(entranceDoor?.thumbImage || ''), caption: entranceDoorLabel },
      ...(config.variant === 'balcony' ? [{ key: 'deckingColor', title: labels.deckingColor, image: asset(selectedDeckingColor?.thumbImage || selectedDeckingColor?.referenceImage || ''), caption: selectedDeckingColor?.label || '-', swatch: selectedDeckingColor?.swatch }] : []),
      { key: 'interiorPanels', title: labels.interiorPanels, image: asset(selectedInteriorPanels?.thumbImage || selectedInteriorPanels?.referenceImage || ''), caption: selectedInteriorPanels?.label || labels.defaultWhitePanels, swatch: selectedInteriorPanels?.swatch },
      { key: 'floorFinish', title: labels.floorFinish, image: asset(selectedFloorOption?.thumbImage || selectedFloorOption?.referenceImage || ''), caption: optionSummary(selectedFloorOption), swatch: selectedFloorOption?.swatch },
      { key: 'kitchenBench', title: labels.kitchenBench, image: asset(selectedKitchenBench?.thumbImage || selectedKitchenBench?.referenceImage || ''), caption: optionSummary(selectedKitchenBench), swatch: selectedKitchenBench?.swatch },
      { key: 'insideDoorStyle', title: labels.insideDoorStyle, image: asset(selectedInsideDoorStyle?.thumbImage || selectedInsideDoorStyle?.referenceImage || ''), caption: selectedInsideDoorStyle?.label || '-' },
      { key: 'bathroom', title: labels.bathroom, image: asset(selectedBathroom?.image || ''), caption: selectedBathroom?.label || '-' },
      { key: 'bathroomUvPanel', title: labels.bathroomUvPanel, image: asset(selectedBathroomUvPanel?.thumbImage || ''), caption: optionDisplay(selectedBathroomUvPanel), swatch: selectedBathroomUvPanel?.swatch },
      { key: 'bathroomDoor', title: labels.bathroomDoor, image: asset(selectedBathroomDoor?.thumbImage || ''), caption: selectedBathroomDoor?.label || '-' },
      { key: 'vanity', title: labels.vanity, image: asset(selectedVanity?.thumbImage || ''), caption: selectedVanity?.label || '-' },
      { key: 'kitchen', title: labels.kitchen, image: asset(selectedKitchen?.image || ''), caption: selectedKitchen?.label || '-' },
      { key: 'kitchenSink', title: labels.kitchenSink, image: asset(selectedKitchenSink?.thumbImage || ''), caption: selectedKitchenSink?.label || '-' },
    ].filter((item) => item.image || item.swatch)

    return (
      <div className="bhc-mobile-shell">
        <MobileHeroPreview
          image={asset(selectedModelHeroImage)}
          title={`${selectedModel?.label || '-'} · ${config.variant === 'balcony' ? labels.balcony : labels.standard}`}
          subtitle={labels.totalKnown}
          chips={[euro(knownTotal, locale)]}
        />

        <div className="bhc-mobile-action-grid">
          <button className="btn ghost" type="button" onClick={exportPdf}>{actions.export}</button>
          <button className="btn ghost" type="button" onClick={copySummary}>{actions.copy}</button>
          <button className="btn ghost" type="button" onClick={shareConfigLink}>{actions.shareLink}</button>
          <button className="btn ghost" type="button" onClick={handleOpenQuestion}>{actions.question}</button>
        </div>
        <form className="bhc-email-row" onSubmit={handleEmailConfig}>
          <input
            type="email"
            className="bhc-email-input"
            placeholder={labels.emailPlaceholder}
            value={emailValue}
            onChange={(e) => { setEmailValue(e.target.value); if (emailState !== 'idle') setEmailState('idle') }}
            aria-label={labels.emailPrompt}
            autoComplete="email"
          />
          <button className="btn ghost" type="submit" disabled={emailState === 'sending'}>
            {emailState === 'sending' ? labels.emailSending : labels.emailPrompt}
          </button>
        </form>
        {emailState === 'sent' && <div className="bhc-email-status bhc-email-status--ok">{labels.emailSent}</div>}
        {emailState === 'invalid' && <div className="bhc-email-status bhc-email-status--err">{labels.emailInvalid}</div>}
        {emailState === 'error' && <div className="bhc-email-status bhc-email-status--err">{labels.emailFailed}</div>}

        <MobileSection id="overview" openId={openSection} onToggle={toggleSection} title={labels.summary} value={euro(knownTotal, locale)}>
          <div className="bhc-detail-list">
            <SummaryRow label={labels.model} value={selectedModel?.label || '-'} />
            <SummaryRow label={labels.variant} value={config.variant === 'balcony' ? labels.balcony : labels.standard} />
            <SummaryRow label={labels.layout} value={`${selectedPlan?.label || ''}${selectedPlan?.subtitle ? ` · ${selectedPlan.subtitle}` : ''}`} />
            <SummaryRow label={labels.windowTypeLabel} value={selectedWindowType?.label || '-'} />
            <SummaryRow label={labels.windowColour} value={selectedWindowColour?.label || '-'} />
            <SummaryRow label={labels.exteriorDoor} value={entranceDoorLabel} />
            <SummaryRow label={labels.outsidePanels} value={selectedExteriorFinishCaption} />
            {config.variant === 'balcony' ? <SummaryRow label={labels.terrace} value={`${selectedTerrace?.label || '-'}${terracePrice ? ` · ${euro(terracePrice, locale)}` : ''}`} /> : null}
            {config.variant === 'balcony' ? <SummaryRow label={labels.deckingColor} value={selectedDeckingColor?.label || '-'} /> : null}
            <SummaryRow label={labels.interiorPanels} value={selectedInteriorPanels?.label || labels.defaultWhitePanels} />
            <SummaryRow label={labels.floorFinish} value={optionSummary(selectedFloorOption)} />
            <SummaryRow label={labels.kitchenBench} value={optionSummary(selectedKitchenBench)} />
            <SummaryRow label={labels.bathroom} value={selectedBathroom?.label || '-'} />
            <SummaryRow label={labels.bathroomUvPanel} value={optionDisplay(selectedBathroomUvPanel)} />
            <SummaryRow label={labels.bathroomDoor} value={selectedBathroomDoor?.label || '-'} />
            <SummaryRow label={labels.vanity} value={selectedVanity?.label || '-'} />
            <SummaryRow label={labels.kitchen} value={selectedKitchen?.label || '-'} />
            <SummaryRow label={labels.kitchenSink} value={selectedKitchenSink?.label || '-'} />
            {selectedKitchenPetColour ? <SummaryRow label={labels.kitchenPetColour} value={`${selectedKitchenPetColour.code} · ${labels.onRequest}`} /> : null}
            <SummaryRow label={labels.kitchenExtras} value={selectedKitchenExtras.length ? selectedKitchenExtras.join(', ') : '-'} />
            <SummaryRow label={labels.totalKnown} value={euro(knownTotal, locale)} strong />
          </div>
        </MobileSection>

        <MobileSection id="visuals" openId={openSection} onToggle={toggleSection} title={labels.referenceBoards} value={`${finishPreviewCards.length}`}>
          <div className="bhc-reference-board-grid">
            {finishPreviewCards.map((item) => (
              <MaterialPreviewCard key={`${item.key}-${item.caption}`} title={item.title} image={item.image} label={item.caption} swatch={item.swatch} />
            ))}
          </div>
        </MobileSection>

        <MobileSection id="schemes" openId={openSection} onToggle={toggleSection} title={locale === 'bg' ? 'Схеми' : locale === 'el' ? 'Σχέδια' : 'Schemes'} value={`${(config.windows || []).length} · ${config.sockets.length}`}>
          <div className="bhc-section-title">{labels.windowScheme}</div>
          <WindowPlanStage image={asset(selectedPlan?.noWindowImage || selectedPlan?.image || '')} markers={config.windows || []} className="bhc-socket-stage--summary bhc-window-stage--summary" emptyText={labels.noWindows} />
          <div className="bhc-chip-cloud">
            <span className="bhc-mini-chip">{labels.windowSize}: {windowSizeDimension} mm{windowSizeExtra ? ` (+${euro(windowSizeExtra, locale)} ${labels.forAllWindows})` : ''}</span>
            {windowMarkerItems.length ? windowMarkerItems.map((item) => (
              <span key={item.id} className="bhc-mini-chip">{item.label}{item.badge ? ` · ${item.badge}` : ''} • {item.coords}</span>
            )) : <div className="bhc-small-note">{labels.noWindows}</div>}
          </div>
          {config.windowNotes ? (
            <div className="bhc-note-box">
              <div className="bhc-note-title">{labels.windowNotesLabel}</div>
              <div>{config.windowNotes}</div>
            </div>
          ) : null}
          <div className="bhc-section-title bhc-scheme-divider">{labels.electricalScheme}</div>
          <SocketPlanStage image={asset(selectedPlan?.image || '')} markers={config.sockets} className="bhc-socket-stage--summary" emptyText={labels.noSockets} />
          <div className="bhc-chip-cloud">
            {socketMarkerItems.length ? socketMarkerItems.map((item) => (
              <span key={item.id} className="bhc-mini-chip">{item.label}{item.description ? ` — ${item.description}` : ''} • {item.coords}</span>
            )) : <div className="bhc-small-note">{labels.noSockets}</div>}
          </div>
          {config.socketNotes ? (
            <div className="bhc-note-box">
              <div className="bhc-note-title">{labels.socketNotesLabel}</div>
              <div>{config.socketNotes}</div>
            </div>
          ) : null}
        </MobileSection>

        <MobileSection id="price" openId={openSection} onToggle={toggleSection} title={labels.priceBreakdown} value={euro(knownTotal, locale)} badge={euro(knownTotal, locale)}>
          <div className="bhc-detail-list">
            {priceBreakdownRows.map(([label, value], index) => (
              <SummaryRow key={label} label={label} value={value} strong={index === priceBreakdownRows.length - 1} />
            ))}
          </div>
          {quotationItems.length ? (
            <div className="bhc-detail-list">
              <div className="bhc-subhead">{labels.quotationItems}</div>
              {quotationItems.map((item) => (
                <SummaryRow key={item.label} label={item.label} value={`${item.value} · ${labels.onRequest}`} />
              ))}
            </div>
          ) : null}
          <div className="bhc-small-note">{labels.pricingFootnote}</div>
        </MobileSection>
      </div>
    )
  }

  const stepKey = STEP_KEYS[stepIndex]
  const stepBody = isMobileShell
    ? {
        model: renderModelStepMobile(),
        layout: renderLayoutStepMobile(),
        exterior: renderExteriorStepMobile(),
        interior: renderInteriorStepMobile(),
        sockets: renderSocketsStepMobile(),
        summary: renderSummaryStepMobile(),
      }[stepKey]
    : {
        model: renderModelStep(),
        layout: renderLayoutStep(),
        exterior: renderExteriorStep(),
        interior: renderInteriorStep(),
        sockets: renderSocketsStep(),
        summary: renderSummaryStep(),
      }[stepKey]

  const resumeText = {
    title: isBg
      ? 'Да продължим откъдето спряхте?'
      : locale === 'el'
      ? 'Συνέχεια από εκεί που σταματήσατε;'
      : 'Continue where you left off?',
    body: isBg
      ? 'Запазихме конфигурацията, върху която работехте в този браузър.'
      : locale === 'el'
      ? 'Αποθηκεύσαμε τη διαμόρφωση στην οποία εργαζόσασταν σε αυτό το πρόγραμμα περιήγησης.'
      : 'We saved the configuration you were working on in this browser.',
    resume: isBg ? 'Продължи' : locale === 'el' ? 'Συνέχεια' : 'Continue',
    fresh: isBg ? 'Започни отначало' : locale === 'el' ? 'Ξεκινήστε από την αρχή' : 'Start fresh',
  }

  // Only surface the resume banner when the saved config is real progress
  // (past the first step, or diverged from the pristine defaults) so a fresh
  // visitor who never touched anything isn't nagged.
  let showResumeBanner = false
  if (resumeCandidate) {
    if ((resumeCandidate.stepIndex || 0) > 0) {
      showResumeBanner = true
    } else {
      try {
        showResumeBanner =
          JSON.stringify(resumeCandidate.config) !== JSON.stringify(buildDefaultConfig())
      } catch {
        showResumeBanner = true
      }
    }
  }

  return (
    <main className={['bhc-page', isMobileShell && 'bhc-page--mobile'].filter(Boolean).join(' ')}>
      {renderHeroSection()}

      {showResumeBanner ? (
        <div className="container bhc-resume-wrap">
          <div className="bhc-resume" role="region" aria-label={resumeText.title}>
            <div className="bhc-resume-copy">
              <span className="bhc-resume-title">{resumeText.title}</span>
              <span className="bhc-resume-body">{resumeText.body}</span>
            </div>
            <div className="bhc-resume-actions">
              <button className="btn" type="button" onClick={handleResumeSaved}>{resumeText.resume}</button>
              <button className="btn ghost" type="button" onClick={handleStartFresh}>{resumeText.fresh}</button>
            </div>
          </div>
        </div>
      ) : null}

      <section>
        <div className="container">
          {isMobileShell ? (
            <MobileStepper steps={stepMeta} activeIndex={stepIndex} onGo={setStepIndex} stepWord={stepWord} />
          ) : (
            <StepRail steps={stepMeta} activeIndex={stepIndex} onGo={setStepIndex} />
          )}

          <div className="bhc-stage">
            {!isMobileShell ? renderStageHead() : null}

            {stepBody}

            {!isMobileShell ? (
              <div className="bhc-bottom-bar">
                <div className="bhc-status">{status || '\u00A0'}</div>
                <div className="bhc-action-row">
                  <button className="btn ghost" type="button" onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))} disabled={stepIndex === 0}>{actions.back}</button>
                  {stepIndex < STEP_KEYS.length - 1 ? (
                    <button className="btn" type="button" onClick={() => setStepIndex((prev) => Math.min(STEP_KEYS.length - 1, prev + 1))}>{actions.next}</button>
                  ) : (
                    <button className="btn" type="button" onClick={exportPdf}>{actions.export}</button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isMobileShell ? (
        <div className="bhc-mnav">
          {status ? <div className="bhc-mnav-status">{status}</div> : null}
          <div className="bhc-mnav-inner">
            <div className="bhc-mnav-price">
              <span className="bhc-mnav-price-label">{labels.totalKnown}</span>
              <span className="bhc-mnav-price-value">{euro(knownTotal, locale)}</span>
            </div>
            <div className="bhc-mnav-actions">
              <button
                className="btn ghost bhc-mnav-back"
                type="button"
                onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                disabled={stepIndex === 0}
              >
                {actions.back}
              </button>
              {stepIndex < STEP_KEYS.length - 1 ? (
                <button className="btn bhc-mnav-next" type="button" onClick={() => setStepIndex((prev) => Math.min(STEP_KEYS.length - 1, prev + 1))}>
                  {actions.next}
                </button>
              ) : (
                <button className="btn bhc-mnav-next bhc-offer-btn" type="button" onClick={handleOpenOffer}>
                  {actions.offer}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
