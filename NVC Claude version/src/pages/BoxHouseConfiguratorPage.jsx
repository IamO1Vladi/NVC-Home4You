import React from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import { euro, getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import '../style/BoxHouseConfigurator.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { writeConfiguratorPrefill } from '../lib/configPrefill.js'

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
      {/* <div className="bhc-thumb-caption">
        <strong>{label || '-'}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div> */}
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

function NumberField({ label, value, onChange, min = 0, max = 99 }) {
  return (
    <label className="bhc-number-field">
      <span>{label}</span>
      <div className="bhc-number-box">
        <button type="button" onClick={() => onChange(Math.max(min, Number(value || 0) - 1))}>-</button>
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
    <div className={['bhc-msection', open && 'is-open'].filter(Boolean).join(' ')}>
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
            className={['bhc-window-dot', marker.isPanoramic && 'is-panoramic', removable && 'is-removable'].filter(Boolean).join(' ')}
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            onClick={removable ? (e) => { e.stopPropagation(); onRemove(marker.id) } : undefined}
            title={removable ? '✕' : undefined}
          >
            {marker.isPanoramic ? 'P' : index + 1}
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
    windowStyle: t.labels?.windowStyle || (isBg ? 'Тип прозорец' : 'Window style'),
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
    windowSize1000: t.labels?.windowSize1000 || (isBg ? '1000×950 (стандартен)' : '1000×950 (standard)'),
    windowSize1200: t.labels?.windowSize1200 || (isBg ? '1200×950 (+€500)' : '1200×950 (+€500)'),
    windowSize1400: t.labels?.windowSize1400 || (isBg ? '1400×950 (+€800)' : '1400×950 (+€800)'),
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
    uvPanel: t.labels?.uvPanel || (isBg ? 'UV опция' : 'UV option'),
    insideDoors: t.labels?.insideDoors || (isBg ? 'Вътрешни врати' : 'Inside doors'),
    insideDoorStyle: t.labels?.insideDoorStyle || (isBg ? 'Стил на вътрешните врати' : 'Inside door style'),
    insideDoorCount: t.labels?.insideDoorCount || (isBg ? 'Брой вътрешни врати' : 'Inside door count'),
    insideDoorPrice: t.labels?.insideDoorPrice || (isBg ? 'Вътрешни врати цена' : 'Inside doors price'),
    socketDescHint: t.labels?.socketDescHint || (isBg ? 'Добавете описание за всеки контакт' : 'Add a description for each socket'),
    socketNotesLabel: t.labels?.socketNotesLabel || (isBg ? 'Бележки за контактите' : 'Socket notes'),
    socketMarker: t.labels?.socketMarker || (isBg ? 'Контакт' : 'Socket'),
    noSockets: t.labels?.noSockets || (isBg ? 'Все още няма поставени контакти.' : 'No sockets placed yet.'),
    pdfPreparing: t.labels?.pdfPreparing || (isBg ? 'Подготвям PDF обобщението…' : 'Preparing PDF summary…'),
    pdfOpened: t.labels?.pdfOpened || (isBg ? 'PDF обобщението е отворено.' : 'PDF summary opened.'),
    pdfBlocked: t.labels?.pdfBlocked || (isBg ? 'Браузърът блокира прозореца за PDF.' : 'The browser blocked the PDF summary window.'),
    exportHint: t.labels?.exportHint || (isBg ? 'Експортът отваря print-ready обобщение и изчаква визуализациите да се заредят.' : 'The export opens a print-ready summary and waits for visuals to load.'),
    referenceBoards: t.labels?.referenceBoards || (isBg ? 'Референтни табла' : 'Reference boards'),
  }), [isBg, t.labels])

  const actions = React.useMemo(() => ({
    back: t.actions?.back || (isBg ? 'Назад' : 'Back'),
    next: t.actions?.next || (isBg ? 'Напред' : 'Next'),
    reset: t.actions?.reset || (isBg ? 'Ново начало' : 'Start over'),
    copy: t.actions?.copy || (isBg ? 'Копирай обобщението' : 'Copy summary'),
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

  const [stepIndex, setStepIndex] = React.useState(0)
  const [status, setStatus] = React.useState('')
  const [config, setConfig] = React.useState({
    model: initialModel?.key || '37',
    variant: 'standard',
    plan: initialPlan,
    windowFrame: catalog.windowFrameOptions[0]?.key || 'pvc',
    steelFrameColor: catalog.steelFrameColorOptions[0]?.key || 'black',
    windowStyle: catalog.windowStyleOptions[0]?.key || 'broken-bridge',
    exteriorDoor: catalog.exteriorDoorOptions[0]?.key || 'titanium-alloy-door',
    exteriorFinishFamily: initialExteriorFamily,
    exteriorFinish: initialExteriorFinish,
    deckingColor: catalog.deckingColorOptions[0]?.key || 'red-pine',
    heating: false,
    windowSize: '1000',
    windows: [],
    windowNotes: '',
    interiorPanelMode: 'white',
    interiorPanelColor: catalog.interiorPanelColorOptions[0]?.key || 'panel-red',
    uvPanel: catalog.uvPanelOptions[0]?.key || 'uv-001',
    floorFamily: 'spc',
    spcFloor: catalog.spcFloorOptions[0]?.key || 'spc-7005',
    pvcFloor: catalog.pvcFloorOptions[0]?.key || 'pvc-001',
    carbonCrystalFloor: catalog.carbonCrystalOptions[0]?.key || 'carbon-gf005',
    bathroom: catalog.bathroomOptions[0]?.key || 'E1',
    kitchen: catalog.kitchenOptions[0]?.key || 'F1',
    kitchenBench: catalog.kitchenBenchOptions[0]?.key || 'yl-4003',
    kitchenExtras: {
      furnace: false,
      washingMachine: false,
      dishwasherCabinet: false,
    },
    insideDoorStyle: catalog.insideDoorStyleOptions[0]?.key || 'inside-01',
    insideDoorCount: 0,
    sockets: [],
    socketNotes: '',
  })

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


  const scrollToPreview = React.useCallback((key) => {
    const node = previewRefs.current?.[key]
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
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
      setConfig((prev) => ({ ...prev, floorFamily: 'spc' }))
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
  const activeFloorOptions = activeFloorFamily === 'pvc'
    ? catalog.pvcFloorOptions
    : activeFloorFamily === 'carbon'
      ? catalog.carbonCrystalOptions
      : catalog.spcFloorOptions
  const activeFloorField = activeFloorFamily === 'pvc'
    ? 'pvcFloor'
    : activeFloorFamily === 'carbon'
      ? 'carbonCrystalFloor'
      : 'spcFloor'
  const activeFloorSelection = config[activeFloorField]

  React.useEffect(() => {
    if (!activeFloorOptions.some((item) => item.key === activeFloorSelection)) {
      setConfig((prev) => ({ ...prev, [activeFloorField]: activeFloorOptions[0]?.key || '' }))
    }
  }, [activeFloorField, activeFloorOptions, activeFloorSelection])

  React.useEffect(() => {
    setStatus('')
  }, [stepIndex])

  const selectedPlan = resolveSelected(planChoices, config.plan)
  const selectedBathroom = resolveSelected(catalog.bathroomOptions, config.bathroom)
  const selectedKitchen = resolveSelected(catalog.kitchenOptions, config.kitchen)
  const selectedFrame = resolveSelected(catalog.windowFrameOptions, config.windowFrame)
  const selectedSteelFrameColor = resolveSelected(catalog.steelFrameColorOptions, config.steelFrameColor)
  const selectedWindowStyle = resolveSelected(catalog.windowStyleOptions, config.windowStyle)
  const selectedDoor = resolveSelected(catalog.exteriorDoorOptions, config.exteriorDoor)
  const selectedExteriorFinish = resolveSelected(exteriorFinishOptions, config.exteriorFinish)
  const selectedDeckingColor = resolveSelected(catalog.deckingColorOptions, config.deckingColor)
  const selectedInteriorPanelColor = resolveSelected(catalog.interiorPanelColorOptions, config.interiorPanelColor)
  const selectedUvPanel = resolveSelected(catalog.uvPanelOptions, config.uvPanel)
  const selectedKitchenBench = resolveSelected(catalog.kitchenBenchOptions, config.kitchenBench)
  const selectedFloorOption = resolveSelected(activeFloorOptions, activeFloorSelection)
  const selectedInsideDoorStyle = resolveSelected(catalog.insideDoorStyleOptions, config.insideDoorStyle)

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
  const WINDOW_SIZE_PRICES = { '1000': 0, '1200': 500, '1400': 800 }
  const WINDOW_SIZE_DIMENSIONS = { '1000': '1000×950', '1200': '1200×950', '1400': '1400×950' }
  const windowSizeExtra = WINDOW_SIZE_PRICES[config.windowSize] || 0
  const windowSizeDimension = WINDOW_SIZE_DIMENSIONS[config.windowSize] || WINDOW_SIZE_DIMENSIONS['1000']
  const panoramicWindowCount = (config.windows || []).filter((w) => w.isPanoramic).length
  const panoramicUpgradePrice = panoramicWindowCount * 300
  const windowExtrasPrice = windowSizeExtra + panoramicUpgradePrice
  const windowSizeSummaryValue = windowSizeExtra
    ? `${windowSizeDimension} mm · +${euro(windowSizeExtra, locale)} ${labels.forAllWindows}`
    : `${windowSizeDimension} mm · ${labels.windowSizeIncluded}`
  const insideDoorPrice = Number(config.insideDoorCount || 0) * catalog.pricing.insideDoorPerDoor
  const knownTotal = knownBasePrice + interiorPanelsPrice + heatingPrice + windowExtrasPrice + insideDoorPrice

  const socketMarkerItems = React.useMemo(
    () => config.sockets.map((socket, index) => ({
      id: socket.id,
      label: `${labels.socketMarker} ${index + 1}`,
      description: socket.description || '',
      coords: `${Math.round(socket.x)}% / ${Math.round(socket.y)}%`,
    })),
    [config.sockets, labels.socketMarker]
  )

  const windowMarkerItems = React.useMemo(
    () => (config.windows || []).map((win, index) => ({
      id: win.id,
      label: `${labels.windowMarker} ${index + 1}`,
      isPanoramic: win.isPanoramic,
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
      `${labels.frame}: ${selectedFrame?.label || '-'}`,
      `${labels.steelFrameColor}: ${selectedSteelFrameColor?.label || '-'}`,
      `${labels.windowStyle}: ${selectedWindowStyle?.label || '-'}`,
      `${labels.exteriorDoor}: ${selectedDoor?.label || '-'}`,
      `${labels.outsidePanels}: ${selectedExteriorFinish?.label || '-'}`,
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
    selectedFrame,
    selectedSteelFrameColor,
    selectedInsideDoorStyle,
    selectedInteriorPanels,
    selectedKitchen,
    selectedKitchenBench,
    selectedKitchenExtras,
    selectedModel,
    selectedPlan,
    selectedWindowStyle,
    t.title,
    yesText,
  ])

  const modalPrefill = React.useMemo(() => ({
    source: 'box-configurator',
    sourcePath: typeof window !== 'undefined' ? window.location.pathname : '',
    modelId: selectedModel?.key || '',
    offerText: summaryLines,
    questionText: `${isBg ? 'Въпрос за следната конфигурация на Бокс къща:' : 'Question about the following box house configuration:'}\n\n${summaryLines}`,
    updatedAt: Date.now(),
  }), [isBg, selectedModel?.key, summaryLines])

  React.useEffect(() => {
    writeConfiguratorPrefill(modalPrefill)
  }, [modalPrefill])

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
    setConfig((prev) => ({
      ...prev,
      kitchenExtras: {
        ...prev.kitchenExtras,
        [key]: !prev.kitchenExtras[key],
      },
    }))
  }

  function resetAll() {
    setConfig({
      model: initialModel?.key || '37',
      variant: 'standard',
      plan: initialPlan,
      windowFrame: catalog.windowFrameOptions[0]?.key || 'pvc',
      steelFrameColor: catalog.steelFrameColorOptions[0]?.key || 'black',
      windowStyle: catalog.windowStyleOptions[0]?.key || 'broken-bridge',
      exteriorDoor: catalog.exteriorDoorOptions[0]?.key || 'titanium-alloy-door',
      exteriorFinishFamily: initialExteriorFamily,
      exteriorFinish: initialExteriorFinish,
      deckingColor: catalog.deckingColorOptions[0]?.key || 'red-pine',
      heating: false,
      windowSize: '1000',
      windows: [],
      windowNotes: '',
      interiorPanelMode: 'white',
      interiorPanelColor: catalog.interiorPanelColorOptions[0]?.key || 'panel-red',
      uvPanel: catalog.uvPanelOptions[0]?.key || 'uv-001',
      floorFamily: 'spc',
      spcFloor: catalog.spcFloorOptions[0]?.key || 'spc-7005',
      pvcFloor: catalog.pvcFloorOptions[0]?.key || 'pvc-001',
      carbonCrystalFloor: catalog.carbonCrystalOptions[0]?.key || 'carbon-gf005',
      bathroom: catalog.bathroomOptions[0]?.key || 'E1',
      kitchen: catalog.kitchenOptions[0]?.key || 'F1',
      kitchenBench: catalog.kitchenBenchOptions[0]?.key || 'yl-4003',
      kitchenExtras: { furnace: false, washingMachine: false, dishwasherCabinet: false },
      insideDoorStyle: catalog.insideDoorStyleOptions[0]?.key || 'inside-01',
      insideDoorCount: 0,
      sockets: [],
      socketNotes: '',
    })
    setStepIndex(0)
    setStatus('')
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryLines)
      setStatus(labels.copied)
    } catch {
      setStatus(labels.copyFailed)
    }
  }

  function addSocketMarker(point) {
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
    setConfig((prev) => ({
      ...prev,
      windows: [
        ...(prev.windows || []),
        { id: `w-${Date.now()}-${(prev.windows || []).length}`, x: point.x, y: point.y, isPanoramic: false },
      ],
    }))
  }

  function removeWindowMarker(id) {
    setConfig((prev) => ({
      ...prev,
      windows: (prev.windows || []).filter((w) => w.id !== id),
    }))
  }

  function toggleWindowPanoramic(id) {
    setConfig((prev) => ({
      ...prev,
      windows: (prev.windows || []).map((w) => w.id === id ? { ...w, isPanoramic: !w.isPanoramic } : w),
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

    const rows = [
      [labels.model, selectedModel?.label || '-'],
      [labels.variant, config.variant === 'balcony' ? labels.balcony : labels.standard],
      [labels.layout, `${selectedPlan?.label || ''}${selectedPlan?.subtitle ? ` - ${selectedPlan.subtitle}` : ''}`],
      [labels.frame, selectedFrame?.label || '-'],
      [labels.steelFrameColor, selectedSteelFrameColor?.label || '-'],
      [labels.windowStyle, selectedWindowStyle?.label || '-'],
      [labels.exteriorDoor, selectedDoor?.label || '-'],
      [labels.outsidePanels, selectedExteriorFinish?.label || '-'],
      ...(config.variant === 'balcony' ? [[labels.deckingColor, selectedDeckingColor?.label || '-']] : []),
      [labels.interiorPanels, selectedInteriorPanels?.label || labels.defaultWhitePanels],
      [labels.floorFinish, optionSummary(selectedFloorOption)],
      [labels.kitchenBench, optionSummary(selectedKitchenBench)],
      [labels.bathroom, selectedBathroom?.label || '-'],
      [labels.kitchen, selectedKitchen?.label || '-'],
      [labels.insideDoorStyle, selectedInsideDoorStyle?.label || '-'],
      [labels.insideDoorCount, String(config.insideDoorCount || 0)],
      [labels.kitchenExtras, selectedKitchenExtras.length ? selectedKitchenExtras.join(', ') : '-'],
    ]

    const priceRows = [
      [labels.basePrice, euro(knownBasePrice, locale)],
      [labels.internalWalls, interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : '-'],
      [labels.insideDoorPrice, insideDoorPrice ? euro(insideDoorPrice, locale) : '-'],
      [labels.heatingPrice, config.heating ? euro(heatingPrice, locale) : '-'],
      [`${labels.windowSize} · ${windowSizeDimension} mm (${labels.forAllWindows})`, windowSizeExtra ? euro(windowSizeExtra, locale) : labels.included],
      ...(panoramicWindowCount ? [[`${labels.panoramicUpgrades} · ${panoramicWindowCount}×€300`, euro(panoramicUpgradePrice, locale)]] : []),
      [labels.totalKnown, euro(knownTotal, locale)],
    ]

    const rowsHtml = rows
      .map(([label, value]) => `<div class="row"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value)}</div></div>`)
      .join('')

    const priceRowsHtml = priceRows
      .map(([label, value], index) => `<div class="row${index === priceRows.length - 1 ? ' row-total' : ''}"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value)}</div></div>`)
      .join('')

    const finishRows = [
      [labels.outsidePanels, selectedExteriorFinish?.label || '-'],
      [labels.windowStyle, selectedWindowStyle?.label || '-'],
      [labels.exteriorDoor, selectedDoor?.label || '-'],
      ...(config.variant === 'balcony' ? [[labels.deckingColor, selectedDeckingColor?.label || '-']] : []),
      [labels.steelFrameColor, selectedSteelFrameColor?.label || '-'],
      [labels.interiorPanels, selectedInteriorPanels?.label || labels.defaultWhitePanels],
      [labels.floorFinish, optionSummary(selectedFloorOption)],
      [labels.kitchenBench, optionSummary(selectedKitchenBench)],
      [labels.insideDoorStyle, selectedInsideDoorStyle?.label || '-'],
    ]

    const socketDots = config.sockets
      .map((socket, index) => `<span class="dot" style="left:${socket.x}%;top:${socket.y}%">${index + 1}</span>`)
      .join('')

    const socketLegendHtml = socketMarkerItems.length
      ? socketMarkerItems.map((item) => `<span class="chip chip-dark">${escapeHtml(`${item.label}${item.description ? ` — ${item.description}` : ''} • ${item.coords}`)}</span>`).join('')
      : `<div class="empty-note">${escapeHtml(labels.noSockets)}</div>`

    const windowDots = (config.windows || [])
      .map((win, index) => `<span class="dot dot-win${win.isPanoramic ? ' pano' : ''}" style="left:${win.x}%;top:${win.y}%">${win.isPanoramic ? 'P' : index + 1}</span>`)
      .join('')

    const windowSizeChip = `<span class="chip chip-dark">${escapeHtml(`${labels.windowSize}: ${windowSizeDimension} mm${windowSizeExtra ? ` (+${euro(windowSizeExtra, locale)} ${labels.forAllWindows})` : ''}`)}</span>`
    const windowLegendHtml = windowMarkerItems.length
      ? windowSizeChip + windowMarkerItems.map((item) => `<span class="chip chip-dark">${escapeHtml(`${item.label}${item.isPanoramic ? ' · P' : ''} • ${item.coords}`)}</span>`).join('')
      : windowSizeChip + `<div class="empty-note">${escapeHtml(labels.noWindows)}</div>`

    const referenceCards = [
      { title: labels.outsidePanels, image: asset(selectedExteriorFinish?.thumbImage || selectedExteriorFinish?.referenceImage || ''), caption: selectedExteriorFinish?.label || '-', swatch: selectedExteriorFinish?.swatch },
      { title: labels.windowStyle, image: asset(selectedWindowStyle?.thumbImage || selectedWindowStyle?.referenceImage || ''), caption: selectedWindowStyle?.label || '-' },
      { title: labels.exteriorDoor, image: asset(selectedDoor?.thumbImage || selectedDoor?.referenceImage || ''), caption: selectedDoor?.label || '-' },
      ...(config.variant === 'balcony' ? [{ title: labels.deckingColor, image: asset(selectedDeckingColor?.thumbImage || selectedDeckingColor?.referenceImage || ''), caption: selectedDeckingColor?.label || '-', swatch: selectedDeckingColor?.swatch }] : []),
      { title: labels.interiorPanels, image: asset(selectedInteriorPanels?.thumbImage || selectedInteriorPanels?.referenceImage || ''), caption: selectedInteriorPanels?.label || labels.defaultWhitePanels, swatch: selectedInteriorPanels?.swatch },
      { title: labels.floorFinish, image: asset(selectedFloorOption?.thumbImage || selectedFloorOption?.referenceImage || ''), caption: optionSummary(selectedFloorOption), swatch: selectedFloorOption?.swatch },
      { title: labels.kitchenBench, image: asset(selectedKitchenBench?.thumbImage || selectedKitchenBench?.referenceImage || ''), caption: optionSummary(selectedKitchenBench), swatch: selectedKitchenBench?.swatch },
      { title: labels.insideDoorStyle, image: asset(selectedInsideDoorStyle?.thumbImage || selectedInsideDoorStyle?.referenceImage || ''), caption: selectedInsideDoorStyle?.label || '-' },
    ].filter((item) => item.image || item.swatch)

    const referenceCardsHtml = referenceCards.length
      ? referenceCards.map((item) => `
        <div class="ref-card">
          <div class="ref-head">${escapeHtml(item.title)}</div>
          ${item.image ? `<img src="${item.image}" alt="" />` : `<div style="height:180px;background:linear-gradient(135deg,${item.swatch || '#d7dce4'},#ffffff);"></div>`}
          <div class="ref-cap">${escapeHtml(item.caption)}</div>
        </div>`).join('')
      : ''

    popup.document.open()
    popup.document.write(`<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(pdfText.title)}</title>
  <style>
    @page{size:A4;margin:12mm}
    :root{--ink:#111827;--muted:#4b5563;--accent:#2563eb;--line:#d1d5db;--bg:#f8fafc}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;padding:20px;font-family:Inter,Arial,sans-serif;color:var(--ink);background:var(--bg)}
    .sheet{max-width:1040px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:0 16px 42px rgba(15,23,42,.08)}
    .top{display:grid;grid-template-columns:1.05fr .95fr;gap:18px;align-items:start}
    .hero,.panel,.thumb,.ref-card{border:1px solid var(--line);border-radius:18px;background:#fff;overflow:hidden}
    .hero{background:#f4f7fb}
    .hero img{width:100%;height:350px;object-fit:cover;display:block}
    .hero-foot{padding:16px 18px;display:flex;justify-content:space-between;gap:12px;align-items:center}
    .title{font-size:30px;font-weight:900;line-height:1.05;margin:0}
    .sub{margin:8px 0 0;color:var(--muted)}
    .price{display:inline-flex;align-items:center;border-radius:999px;padding:10px 14px;background:linear-gradient(90deg,#14b8a6,#3b82f6);color:#fff;font-weight:900;white-space:nowrap}
    .panel{padding:18px}
    .panel h2{margin:0 0 12px;font-size:18px}
    .row{display:grid;grid-template-columns:190px 1fr;gap:12px;padding:8px 0;border-top:1px solid #eef2f7}
    .row:first-child{border-top:0;padding-top:0}
    .row-total .v{font-size:18px;font-weight:900}
    .k{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800}
    .v{font-weight:700;line-height:1.45}
    .overview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}
    .span-2{grid-column:span 2}
    .thumb-head,.ref-head{padding:12px 14px;font-weight:900;border-bottom:1px solid var(--line);background:#f8fafc}
    .thumb img{width:100%;height:220px;object-fit:cover;display:block}
    .thumb-foot{padding:12px 14px}
    .plan-shell{padding:14px;display:flex;justify-content:center;background:#fff}
    .plan-canvas{position:relative;width:100%;max-width:760px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}
    .plan-canvas img{width:100%;height:auto;display:block;background:#fff}
    .dot{position:absolute;transform:translate(-50%,-50%);min-width:26px;height:26px;padding:0 8px;border-radius:999px;display:grid;place-items:center;background:#111827;color:#fff;font-size:12px;font-weight:900;border:2px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.18)}
    .dot-win{background:#14b8a6}
    .dot-win.pano{background:linear-gradient(90deg,#14b8a6,#3b82f6)}
    .chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .chip{display:inline-flex;align-items:center;border-radius:999px;padding:8px 12px;background:#eff6ff;color:#1d4ed8;font-weight:800;font-size:12px}
    .chip-dark{background:#111827;color:#fff}
    .meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .meta-box{border:1px solid var(--line);border-radius:16px;padding:12px 14px;background:#f8fafc}
    .meta-box .k{display:block}
    .meta-box .v{margin-top:6px}
    .note{margin-top:12px;padding:12px 14px;border-radius:16px;background:#f8fafc;border:1px solid var(--line)}
    .note-k{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800}
    .note-v{margin-top:6px;line-height:1.55}
    .empty-note{color:var(--muted);font-size:13px;line-height:1.55}
    .ref-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
    .ref-card img{width:100%;height:180px;display:block;object-fit:cover;background:#fff}
    .ref-cap{padding:12px 14px;color:var(--muted);line-height:1.45;font-weight:700}
    .footer-note{margin-top:18px;color:var(--muted);font-size:13px;line-height:1.55}
    @media (max-width:900px){body{padding:12px}.sheet{padding:16px}.top,.overview,.meta-grid,.ref-grid{grid-template-columns:1fr}.span-2{grid-column:auto}.hero img{height:auto;max-height:none}}
    @media print{body{padding:0;background:#fff}.sheet{border:none;box-shadow:none;max-width:none}.hero,.panel,.thumb,.ref-card,.meta-box,.note{break-inside:avoid}}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div class="hero">
        <img src="${asset(selectedModelHeroImage)}" alt="" />
        <div class="hero-foot">
          <div>
            <h1 class="title">${escapeHtml(pdfText.title)}</h1>
            <div class="sub">${escapeHtml(pdfText.subtitle)}</div>
          </div>
          <div class="price">${escapeHtml(`${pdfText.knownTotal}: ${euro(knownTotal, locale)}`)}</div>
        </div>
      </div>
      <div class="panel">
        <h2>${escapeHtml(labels.summary)}</h2>
        ${rowsHtml}
      </div>
    </div>

    <div class="overview">
      <div class="thumb span-2">
        <div class="thumb-head">${escapeHtml(labels.windowScheme)}</div>
        <div class="plan-shell">
          <div class="plan-canvas">
            <img src="${asset(selectedPlan?.image || '')}" alt="" />
            ${windowDots}
          </div>
        </div>
        <div style="padding:14px 14px 16px">
          <div class="chips">${windowLegendHtml}</div>
          ${config.windowNotes ? `<div class="note"><div class="note-k">${escapeHtml(labels.windowNotesLabel)}</div><div class="note-v">${multilineHtml(config.windowNotes)}</div></div>` : ''}
        </div>
      </div>

      <div class="thumb span-2">
        <div class="thumb-head">${escapeHtml(labels.electricalScheme)}</div>
        <div class="plan-shell">
          <div class="plan-canvas">
            <img src="${asset(selectedPlan?.image || '')}" alt="" />
            ${socketDots}
          </div>
        </div>
        <div style="padding:14px 14px 16px">
          <div class="chips">${socketLegendHtml}</div>
          ${config.socketNotes ? `<div class="note"><div class="note-k">${escapeHtml(labels.socketNotesLabel)}</div><div class="note-v">${multilineHtml(config.socketNotes)}</div></div>` : ''}
        </div>
      </div>

      <div class="thumb">
        <div class="thumb-head">${escapeHtml(labels.bathroom)}</div>
        <img src="${asset(selectedBathroom?.image || '')}" alt="" />
        <div class="thumb-foot"><strong>${escapeHtml(selectedBathroom?.label || '-')}</strong></div>
      </div>
      <div class="thumb">
        <div class="thumb-head">${escapeHtml(labels.kitchen)}</div>
        <img src="${asset(selectedKitchen?.image || '')}" alt="" />
        <div class="thumb-foot"><strong>${escapeHtml(selectedKitchen?.label || '-')}</strong></div>
      </div>

      <div class="panel span-2">
        <h2>${escapeHtml(labels.finishBoard)}</h2>
        <div class="meta-grid">
          ${finishRows.map(([label, value]) => `<div class="meta-box"><span class="k">${escapeHtml(label)}</span><div class="v">${escapeHtml(value)}</div></div>`).join('')}
        </div>
        <div class="chips" style="margin-top:14px">
          ${selectedKitchenExtras.length ? selectedKitchenExtras.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('') : `<span class="chip">${escapeHtml(`${labels.kitchenExtras}: -`)}</span>`}
          <span class="chip">${escapeHtml(`${labels.heating}: ${config.heating ? euro(heatingPrice, locale) : noText}`)}</span>
          <span class="chip">${escapeHtml(`${labels.windowOpenings}: ${(config.windows || []).length}${panoramicWindowCount ? ` (${panoramicWindowCount} panoramic)` : ''}${windowExtrasPrice ? ` — ${euro(windowExtrasPrice, locale)}` : ''}`)}</span>
        </div>
        ${referenceCardsHtml ? `<div class="ref-grid">${referenceCardsHtml}</div>` : ''}
      </div>

      <div class="panel span-2">
        <h2>${escapeHtml(labels.priceBreakdown)}</h2>
        ${priceRowsHtml}
      </div>
    </div>

    <div class="footer-note">${escapeHtml(`${pdfText.generatedLabel}: ${new Date().toLocaleString(isBg ? 'bg-BG' : 'en-GB')}`)}<br/>${escapeHtml(pdfText.note)}<br/>${escapeHtml(isBg ? 'Ако прозорецът за печат не се отвори автоматично, натиснете Ctrl/Cmd + P.' : 'If the print dialog does not open automatically, press Ctrl/Cmd + P.')}</div>
  </div>
  <script>
    window.addEventListener('load', function () {
      var triggerPrint = function () {
        window.focus();
        window.print();
      };
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          setTimeout(triggerPrint, 180);
        });
      } else {
        setTimeout(triggerPrint, 180);
      }
    });
    window.addEventListener('afterprint', function () {
      setTimeout(function () { window.close(); }, 120);
    });
  </script>
</body>
</html>`)
    popup.document.close()
    popup.focus()
    setStatus(labels.pdfOpened)
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
        label: selectedExteriorFinish?.label || '-',
        swatch: selectedExteriorFinish?.swatch,
      },
      {
        key: 'windowStyle',
        title: labels.windowStyle,
        image: asset(selectedWindowStyle?.thumbImage || selectedWindowStyle?.previewImage || selectedWindowStyle?.referenceImage || ''),
        label: selectedWindowStyle?.label || '-',
      },
      {
        key: 'exteriorDoor',
        title: labels.exteriorDoor,
        image: asset(selectedDoor?.thumbImage || selectedDoor?.previewImage || selectedDoor?.referenceImage || ''),
        label: selectedDoor?.label || '-',
      },
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
              <div className="bhc-section-title">{labels.frame}</div>
              <div className="bhc-option-list">
                {catalog.windowFrameOptions.map((item) => (
                  <ChoiceCard
                    key={item.key}
                    active={config.windowFrame === item.key}
                    title={item.label}
                    subtitle={item.note}
                    onClick={() => setFieldAndFocus('windowFrame', item.key, 'housePreview')}
                  />
                ))}
              </div>
            </div>

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
              <div className="bhc-section-title">{labels.windowStyle}</div>
              <div className="bhc-code-grid">
                {catalog.windowStyleOptions.map((item) => (
                  <OptionTile
                    key={item.key}
                    active={config.windowStyle === item.key}
                    title={item.label}
                    onClick={() => setFieldAndFocus('windowStyle', item.key, 'windowStyle')}
                  />
                ))}
              </div>
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

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.outsidePanels}</div>
              <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--wide bhc-thumb-choice-grid--compact">
                {exteriorFinishOptions.map((item) => (
                  <ThumbChoiceButton
                    key={item.key}
                    active={config.exteriorFinish === item.key}
                    label={item.label}
                    image={asset(item.thumbImage || item.referenceImage || '')}
                    swatch={item.swatch}
                    onClick={() => setFieldAndFocus('exteriorFinish', item.key, 'outsidePanels')}
                    hideLabel
                  />
                ))}
              </div>
            </div>

            {config.variant === 'balcony' ? (
              <div className="bhc-group">
                <div className="bhc-section-title">{labels.deckingColor}</div>
                <div className="bhc-swatch-grid bhc-swatch-grid--4">
                  {catalog.deckingColorOptions.map((item) => (
                    <SwatchButton key={item.key} active={config.deckingColor === item.key} label={item.label} swatch={item.swatch} onClick={() => setFieldAndFocus('deckingColor', item.key, 'deckingColor')} />
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
              <WindowPlanStage image={asset(selectedPlan?.noWindowImage || selectedPlan?.image || '')} markers={config.windows || []} onAdd={addWindowMarker} onRemove={removeWindowMarker} interactive emptyText={labels.noWindows} />
              {(config.windows || []).length > 0 ? (
                <div className="bhc-window-list">
                  {(config.windows || []).map((win, index) => (
                    <div key={win.id} className="bhc-window-row">
                      <span className={['bhc-window-num', win.isPanoramic && 'is-panoramic'].filter(Boolean).join(' ')}>{index + 1}</span>
                      <span className="bhc-window-label">{labels.windowMarker} {index + 1}</span>
                      <button type="button" className={['bhc-window-panoramic-btn', win.isPanoramic && 'is-active'].filter(Boolean).join(' ')} onClick={() => toggleWindowPanoramic(win.id)} title={win.isPanoramic ? labels.panoramicActive : labels.makePanoramic}>
                        {win.isPanoramic ? labels.panoramicActive : labels.makePanoramic}
                      </button>
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
                    <span>{labels.panoramicUpgrades} · {panoramicWindowCount}×€300</span>
                    <span>+{euro(panoramicUpgradePrice, locale)}</span>
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
            <div className="bhc-preview-stage bhc-preview-stage--house" ref={(node) => { previewRefs.current.housePreview = node }}>
              <img src={cdnImage(asset(selectedModelHeroImage), { width: 1000 })} srcSet={cdnSrcSet(asset(selectedModelHeroImage), [500, 750, 1000, 1400])} sizes="(max-width: 900px) 90vw, 600px" alt="" decoding="async" />
              <div className="bhc-preview-tags">
                <span className="bhc-chip">{selectedExteriorFinish?.label || '-'}</span>
                <span className="bhc-chip">{selectedWindowStyle?.label || '-'}</span>
                <span className="bhc-chip">{selectedDoor?.label || '-'}</span>
                {config.variant === 'balcony' ? <span className="bhc-chip">{selectedDeckingColor?.label || '-'}</span> : null}
              </div>
            </div>
            <div className="bhc-preview-stage bhc-preview-stage--grid bhc-preview-stage--materials">
              {exteriorPreviewCards.map((card) => (
                <div key={card.key} ref={(node) => { previewRefs.current[card.key] = node }}>
                  <MaterialPreviewCard
                    title={card.title}
                    image={card.image}
                    label={card.label}
                    swatch={card.swatch}
                  />
                </div>
              ))}
            </div>
            <div className="bhc-picked-list">
              <SummaryRow label={labels.variant} value={config.variant === 'balcony' ? labels.balcony : labels.standard} />
              <SummaryRow label={labels.basePrice} value={euro(knownBasePrice, locale)} strong />
              <SummaryRow label={labels.outsidePanels} value={selectedExteriorFinish?.label || '-'} />
              <SummaryRow label={labels.windowStyle} value={selectedWindowStyle?.label || '-'} />
              <SummaryRow label={labels.exteriorDoor} value={selectedDoor?.label || '-'} />
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
                  <div className="bhc-swatch-grid bhc-swatch-grid--4">
                    {catalog.interiorPanelColorOptions.map((item) => (
                      <SwatchButton key={item.key} active={config.interiorPanelColor === item.key} label={item.label} swatch={item.swatch} onClick={() => setFieldAndFocus('interiorPanelColor', item.key, 'interiorPanels')} />
                    ))}
                  </div>
                </>
              ) : null}
              {config.interiorPanelMode === 'uv' ? (
                <>
                  <div className="bhc-subhead">{labels.uvPanel}</div>
                  <div className="bhc-swatch-grid bhc-swatch-grid--4">
                    {catalog.uvPanelOptions.map((item) => (
                      <SwatchButton key={item.key} active={config.uvPanel === item.key} label={optionDisplay(item)} swatch={item.swatch} onClick={() => setFieldAndFocus('uvPanel', item.key, 'interiorPanels')} />
                    ))}
                  </div>
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
                    <button type="button" className={['bhc-toggle', activeFloorFamily === 'spc' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('floorFamily', 'spc', 'floorFinish')}>SPC</button>
                    <button type="button" className={['bhc-toggle', activeFloorFamily === 'pvc' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setFieldAndFocus('floorFamily', 'pvc', 'floorFinish')}>PVC</button>
                  </>
                ) : null}
                {config.heating ? (
                  <button type="button" className="bhc-toggle is-active" disabled>Carbon Crystal</button>
                ) : null}
              </div>
              {config.heating ? <div className="bhc-small-note">{isBg ? 'При избрано долно отопление и изолация Carbon Crystal остава единствената подова опция.' : 'When bottom insulation and heating are selected, Carbon Crystal becomes the only floor family.'}</div> : null}
              <div className="bhc-subhead">{labels.floorFinish}</div>
              <div className="bhc-swatch-grid bhc-swatch-grid--scroll bhc-swatch-grid--compact">
                {activeFloorOptions.map((item) => (
                  <SwatchButton
                    key={item.key}
                    active={activeFloorSelection === item.key}
                    label={optionDisplay(item, item.label || '-')}
                    swatch={item.swatch || selectedFloorOption?.swatch || '#cbd5e1'}
                    onClick={() => setFieldAndFocus(activeFloorField, item.key, 'floorFinish')}
                  />
                ))}
              </div>
            </div>

            <div className="bhc-group">
              <div className="bhc-section-title">{labels.kitchenBench}</div>
              <div className="bhc-swatch-grid bhc-swatch-grid--scroll bhc-swatch-grid--compact">
                {catalog.kitchenBenchOptions.map((item) => (
                  <SwatchButton
                    key={item.key}
                    active={config.kitchenBench === item.key}
                    label={optionDisplay(item, item.label || '-')}
                    swatch={item.swatch || selectedKitchenBench?.swatch || '#cbd5e1'}
                    onClick={() => setFieldAndFocus('kitchenBench', item.key, 'kitchenBench')}
                  />
                ))}
              </div>
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
              <div className="bhc-section-title">{labels.kitchen}</div>
              <div className="bhc-card-grid bhc-card-grid--compact">
                {catalog.kitchenOptions.map((item) => (
                  <ChoiceCard key={item.key} active={config.kitchen === item.key} title={item.label} image={asset(item.image)} onClick={() => setFieldAndFocus('kitchen', item.key, 'kitchen')} />
                ))}
              </div>
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
                    label={item.label}
                    image={asset(item.thumbImage || item.referenceImage || '')}
                    onClick={() => setFieldAndFocus('insideDoorStyle', item.key, 'insideDoorStyle')}
                  />
                ))}
              </div>
              <div className="bhc-number-grid">
                <NumberField label={labels.insideDoorCount} value={config.insideDoorCount} onChange={(value) => setFieldAndFocus('insideDoorCount', value, 'insideDoorStyle')} max={24} />
              </div>
              <div className="bhc-inline-price">{labels.insideDoorPrice}: {insideDoorPrice ? euro(insideDoorPrice, locale) : '-'}</div>
            </div>
          </div>

          <div className="bhc-side-panel bhc-side-panel--sticky">
            <div className="bhc-section-title">{labels.overview}</div>
            <div className="bhc-preview-stage bhc-preview-stage--split">
              <div ref={(node) => { previewRefs.current.bathroom = node }}>
                <MaterialPreviewCard title={labels.bathroom} image={asset(selectedBathroom?.image || '')} label={selectedBathroom?.label || '-'} />
              </div>
              <div ref={(node) => { previewRefs.current.kitchen = node }}>
                <MaterialPreviewCard title={labels.kitchen} image={asset(selectedKitchen?.image || '')} label={selectedKitchen?.label || '-'} />
              </div>
            </div>
            <div className="bhc-preview-stage bhc-preview-stage--split bhc-preview-stage--materials">
              <div ref={(node) => { previewRefs.current.floorFinish = node }}>
                <MaterialPreviewCard
                  title={labels.floorFinish}
                  image={asset(selectedFloorOption?.thumbImage || selectedFloorOption?.referenceImage || '')}
                  label={optionDisplay(selectedFloorOption)}
                  subtitle={optionSummary(selectedFloorOption)}
                  swatch={selectedFloorOption?.swatch}
                />
              </div>
              <div ref={(node) => { previewRefs.current.kitchenBench = node }}>
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
              <div ref={(node) => { previewRefs.current.interiorPanels = node }}>
                <MaterialPreviewCard
                  title={labels.interiorPanels}
                  image={asset(selectedInteriorPanels?.thumbImage || selectedInteriorPanels?.referenceImage || '')}
                  label={selectedInteriorPanels?.label || labels.defaultWhitePanels}
                  swatch={selectedInteriorPanels?.swatch}
                />
              </div>
              <div ref={(node) => { previewRefs.current.insideDoorStyle = node }}>
                <MaterialPreviewCard
                  title={labels.insideDoorStyle}
                  image={asset(selectedInsideDoorStyle?.thumbImage || selectedInsideDoorStyle?.referenceImage || '')}
                  label={selectedInsideDoorStyle?.label || '-'}
                  subtitle={`${labels.insideDoorCount}: ${config.insideDoorCount || 0}`}
                />
              </div>
            </div>
            <div className="bhc-picked-list">
              <SummaryRow label={labels.interiorPanels} value={selectedInteriorPanels?.label || labels.defaultWhitePanels} />
              <SummaryRow label={labels.floorFinish} value={optionDisplay(selectedFloorOption)} />
              <SummaryRow label={labels.kitchenBench} value={optionDisplay(selectedKitchenBench)} />
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
      { key: 'outsidePanels', title: labels.outsidePanels, image: asset(selectedExteriorFinish?.thumbImage || selectedExteriorFinish?.referenceImage || ''), caption: selectedExteriorFinish?.label || '-', swatch: selectedExteriorFinish?.swatch },
      { key: 'windowStyle', title: labels.windowStyle, image: asset(selectedWindowStyle?.thumbImage || selectedWindowStyle?.referenceImage || ''), caption: selectedWindowStyle?.label || '-' },
      { key: 'exteriorDoor', title: labels.exteriorDoor, image: asset(selectedDoor?.thumbImage || selectedDoor?.referenceImage || ''), caption: selectedDoor?.label || '-' },
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
              <button className="btn ghost" type="button" onClick={handleOpenQuestion}>{actions.question}</button>
            </div>
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
              <SummaryRow label={labels.frame} value={selectedFrame?.label || '-'} />
              <SummaryRow label={labels.steelFrameColor} value={selectedSteelFrameColor?.label || '-'} />
              <SummaryRow label={labels.windowStyle} value={selectedWindowStyle?.label || '-'} />
              <SummaryRow label={labels.exteriorDoor} value={selectedDoor?.label || '-'} />
              <SummaryRow label={labels.outsidePanels} value={selectedExteriorFinish?.label || '-'} />
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
                  <span key={item.id} className="bhc-mini-chip">{item.label}{item.isPanoramic ? ' · P' : ''} • {item.coords}</span>
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
                  <div className="bhc-meta-k">{labels.windowStyle}</div>
                  <div className="bhc-meta-v">{selectedWindowStyle?.label || '-'}</div>
                </div>
                <div className="bhc-meta-card">
                  <div className="bhc-meta-k">{labels.exteriorDoor}</div>
                  <div className="bhc-meta-v">{selectedDoor?.label || '-'}</div>
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
                <SummaryRow label={labels.basePrice} value={euro(knownBasePrice, locale)} />
                <SummaryRow label={labels.internalWalls} value={interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : '-'} />
                <SummaryRow label={labels.insideDoorPrice} value={insideDoorPrice ? euro(insideDoorPrice, locale) : '-'} />
                <SummaryRow label={labels.heatingPrice} value={config.heating ? euro(heatingPrice, locale) : '-'} />
                <SummaryRow label={`${labels.windowSize} · ${windowSizeDimension} mm (${labels.forAllWindows})`} value={windowSizeExtra ? euro(windowSizeExtra, locale) : labels.included} />
                {panoramicWindowCount ? <SummaryRow label={`${labels.panoramicUpgrades} · ${panoramicWindowCount}×€300`} value={euro(panoramicUpgradePrice, locale)} /> : null}
                <SummaryRow label={labels.totalKnown} value={euro(knownTotal, locale)} strong />
              </div>
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
    const previewChips = [selectedExteriorFinish?.label || '-', selectedWindowStyle?.label || '-', selectedDoor?.label || '-']
    if (config.variant === 'balcony') previewChips.push(selectedDeckingColor?.label || '-')

    return (
      <div className="bhc-mobile-shell">
        <MobileHeroPreview image={asset(selectedModelHeroImage)} title={selectedModel?.label || '-'} subtitle={config.variant === 'balcony' ? labels.balcony : labels.standard} chips={previewChips} />

        <MobileSection
          id="panels"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.outsidePanels}
          value={selectedExteriorFinish?.label || '-'}
          thumb={asset(selectedExteriorFinish?.thumbImage || selectedExteriorFinish?.referenceImage || '')}
          swatch={selectedExteriorFinish?.swatch}
        >
          <div className="bhc-thumb-choice-grid bhc-thumb-choice-grid--wide">
            {exteriorFinishOptions.map((item) => (
              <ThumbChoiceButton
                key={item.key}
                active={config.exteriorFinish === item.key}
                label={item.label}
                image={asset(item.thumbImage || item.referenceImage || '')}
                swatch={item.swatch}
                onClick={() => setField('exteriorFinish', item.key)}
              />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="windowStyle"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.windowStyle}
          value={selectedWindowStyle?.label || '-'}
          thumb={asset(selectedWindowStyle?.thumbImage || selectedWindowStyle?.referenceImage || '')}
        >
          <div className="bhc-code-grid">
            {catalog.windowStyleOptions.map((item) => (
              <OptionTile key={item.key} active={config.windowStyle === item.key} title={item.label} onClick={() => setField('windowStyle', item.key)} />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="exteriorDoor"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.exteriorDoor}
          value={selectedDoor?.label || '-'}
          thumb={asset(selectedDoor?.thumbImage || selectedDoor?.referenceImage || '')}
        >
          <div className="bhc-code-grid">
            {catalog.exteriorDoorOptions.map((item) => (
              <OptionTile key={item.key} active={config.exteriorDoor === item.key} title={item.label} onClick={() => setField('exteriorDoor', item.key)} />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="frame"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.frame}
          value={selectedFrame?.label || '-'}
        >
          <div className="bhc-option-list">
            {catalog.windowFrameOptions.map((item) => (
              <ChoiceCard key={item.key} active={config.windowFrame === item.key} title={item.label} subtitle={item.note} onClick={() => setField('windowFrame', item.key)} />
            ))}
          </div>
        </MobileSection>

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
            <div className="bhc-swatch-grid bhc-swatch-grid--compact">
              {catalog.deckingColorOptions.map((item) => (
                <SwatchButton key={item.key} active={config.deckingColor === item.key} label={item.label} swatch={item.swatch} onClick={() => setField('deckingColor', item.key)} />
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
          <WindowPlanStage image={asset(selectedPlan?.noWindowImage || selectedPlan?.image || '')} markers={config.windows || []} onAdd={addWindowMarker} onRemove={removeWindowMarker} interactive emptyText={labels.noWindows} />
          {(config.windows || []).length > 0 ? (
            <div className="bhc-window-list">
              {(config.windows || []).map((win, index) => (
                <div key={win.id} className="bhc-window-row">
                  <span className={['bhc-window-num', win.isPanoramic && 'is-panoramic'].filter(Boolean).join(' ')}>{index + 1}</span>
                  <span className="bhc-window-label">{labels.windowMarker} {index + 1}</span>
                  <button type="button" className={['bhc-window-panoramic-btn', win.isPanoramic && 'is-active'].filter(Boolean).join(' ')} onClick={() => toggleWindowPanoramic(win.id)} title={win.isPanoramic ? labels.panoramicActive : labels.makePanoramic}>
                    {win.isPanoramic ? labels.panoramicActive : labels.makePanoramic}
                  </button>
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
                <span>{labels.panoramicUpgrades} · {panoramicWindowCount}×€300</span>
                <span>+{euro(panoramicUpgradePrice, locale)}</span>
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
              <div className="bhc-swatch-grid bhc-swatch-grid--compact">
                {catalog.interiorPanelColorOptions.map((item) => (
                  <SwatchButton key={item.key} active={config.interiorPanelColor === item.key} label={item.label} swatch={item.swatch} onClick={() => setField('interiorPanelColor', item.key)} />
                ))}
              </div>
            </>
          ) : null}
          {config.interiorPanelMode === 'uv' ? (
            <>
              <div className="bhc-subhead">{labels.uvPanel}</div>
              <div className="bhc-swatch-grid bhc-swatch-grid--compact">
                {catalog.uvPanelOptions.map((item) => (
                  <SwatchButton key={item.key} active={config.uvPanel === item.key} label={optionDisplay(item)} swatch={item.swatch} onClick={() => setField('uvPanel', item.key)} />
                ))}
              </div>
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
                <button type="button" className={['bhc-toggle', activeFloorFamily === 'spc' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('floorFamily', 'spc')}>SPC</button>
                <button type="button" className={['bhc-toggle', activeFloorFamily === 'pvc' && 'is-active'].filter(Boolean).join(' ')} onClick={() => setField('floorFamily', 'pvc')}>PVC</button>
              </>
            ) : null}
            {config.heating ? <button type="button" className="bhc-toggle is-active" disabled>Carbon Crystal</button> : null}
          </div>
          {config.heating ? <div className="bhc-small-note">{isBg ? 'При избрано отопление Carbon Crystal остава единствената подова опция.' : 'With heating selected, Carbon Crystal remains the only floor option.'}</div> : null}
          <div className="bhc-subhead">{labels.floorFinish}</div>
          <div className="bhc-swatch-grid bhc-swatch-grid--compact">
            {activeFloorOptions.map((item) => (
              <SwatchButton key={item.key} active={activeFloorSelection === item.key} label={optionDisplay(item, item.label || '-')} swatch={item.swatch || selectedFloorOption?.swatch || '#cbd5e1'} onClick={() => setField(activeFloorField, item.key)} />
            ))}
          </div>
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
          <div className="bhc-swatch-grid bhc-swatch-grid--compact">
            {catalog.kitchenBenchOptions.map((item) => (
              <SwatchButton key={item.key} active={config.kitchenBench === item.key} label={optionDisplay(item, item.label || '-')} swatch={item.swatch || selectedKitchenBench?.swatch || '#cbd5e1'} onClick={() => setField('kitchenBench', item.key)} />
            ))}
          </div>
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
              <ChoiceCard key={item.key} active={config.bathroom === item.key} title={item.label} image={asset(item.image)} onClick={() => setField('bathroom', item.key)} />
            ))}
          </div>
        </MobileSection>

        <MobileSection
          id="kitchen"
          openId={openSection}
          onToggle={toggleSection}
          title={labels.kitchen}
          value={selectedKitchen?.label || '-'}
          thumb={asset(selectedKitchen?.image || '')}
        >
          <div className="bhc-card-grid bhc-card-grid--compact">
            {catalog.kitchenOptions.map((item) => (
              <ChoiceCard key={item.key} active={config.kitchen === item.key} title={item.label} image={asset(item.image)} onClick={() => setField('kitchen', item.key)} />
            ))}
          </div>
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
                label={item.label}
                image={asset(item.thumbImage || item.referenceImage || '')}
                onClick={() => setField('insideDoorStyle', item.key)}
              />
            ))}
          </div>
          <div className="bhc-number-grid">
            <NumberField label={labels.insideDoorCount} value={config.insideDoorCount} onChange={(value) => setField('insideDoorCount', value)} max={24} />
          </div>
          <div className="bhc-inline-price">{labels.insideDoorPrice}: {insideDoorPrice ? euro(insideDoorPrice, locale) : '-'}</div>
        </MobileSection>
      </div>
    )
  }

  function renderSocketsStepMobile() {
    return (
      <div className="bhc-mobile-shell">
        <div className="bhc-side-panel bhc-side-panel--full">
          <div className="bhc-msocket-head">
            <div className="bhc-section-title">{labels.sockets}</div>
            <span className="bhc-msocket-count">{labels.socketCount}: {config.sockets.length}</span>
          </div>
          <div className="bhc-hint">{labels.socketsHint}</div>
          <SocketPlanStage image={asset(selectedPlan?.image || '')} markers={config.sockets} onAdd={addSocketMarker} onRemove={removeSocketMarker} interactive emptyText={labels.noSockets} />
        </div>

        <div className="bhc-side-panel">
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
        </div>
      </div>
    )
  }

  function renderSummaryStepMobile() {
    const finishPreviewCards = [
      { key: 'outsidePanels', title: labels.outsidePanels, image: asset(selectedExteriorFinish?.thumbImage || selectedExteriorFinish?.referenceImage || ''), caption: selectedExteriorFinish?.label || '-', swatch: selectedExteriorFinish?.swatch },
      { key: 'windowStyle', title: labels.windowStyle, image: asset(selectedWindowStyle?.thumbImage || selectedWindowStyle?.referenceImage || ''), caption: selectedWindowStyle?.label || '-' },
      { key: 'exteriorDoor', title: labels.exteriorDoor, image: asset(selectedDoor?.thumbImage || selectedDoor?.referenceImage || ''), caption: selectedDoor?.label || '-' },
      ...(config.variant === 'balcony' ? [{ key: 'deckingColor', title: labels.deckingColor, image: asset(selectedDeckingColor?.thumbImage || selectedDeckingColor?.referenceImage || ''), caption: selectedDeckingColor?.label || '-', swatch: selectedDeckingColor?.swatch }] : []),
      { key: 'interiorPanels', title: labels.interiorPanels, image: asset(selectedInteriorPanels?.thumbImage || selectedInteriorPanels?.referenceImage || ''), caption: selectedInteriorPanels?.label || labels.defaultWhitePanels, swatch: selectedInteriorPanels?.swatch },
      { key: 'floorFinish', title: labels.floorFinish, image: asset(selectedFloorOption?.thumbImage || selectedFloorOption?.referenceImage || ''), caption: optionSummary(selectedFloorOption), swatch: selectedFloorOption?.swatch },
      { key: 'kitchenBench', title: labels.kitchenBench, image: asset(selectedKitchenBench?.thumbImage || selectedKitchenBench?.referenceImage || ''), caption: optionSummary(selectedKitchenBench), swatch: selectedKitchenBench?.swatch },
      { key: 'insideDoorStyle', title: labels.insideDoorStyle, image: asset(selectedInsideDoorStyle?.thumbImage || selectedInsideDoorStyle?.referenceImage || ''), caption: selectedInsideDoorStyle?.label || '-' },
      { key: 'bathroom', title: labels.bathroom, image: asset(selectedBathroom?.image || ''), caption: selectedBathroom?.label || '-' },
      { key: 'kitchen', title: labels.kitchen, image: asset(selectedKitchen?.image || ''), caption: selectedKitchen?.label || '-' },
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
          <button className="btn ghost" type="button" onClick={handleOpenQuestion}>{actions.question}</button>
        </div>

        <MobileSection id="overview" openId={openSection} onToggle={toggleSection} title={labels.summary} value={euro(knownTotal, locale)}>
          <div className="bhc-detail-list">
            <SummaryRow label={labels.model} value={selectedModel?.label || '-'} />
            <SummaryRow label={labels.variant} value={config.variant === 'balcony' ? labels.balcony : labels.standard} />
            <SummaryRow label={labels.layout} value={`${selectedPlan?.label || ''}${selectedPlan?.subtitle ? ` · ${selectedPlan.subtitle}` : ''}`} />
            <SummaryRow label={labels.frame} value={selectedFrame?.label || '-'} />
            <SummaryRow label={labels.windowStyle} value={selectedWindowStyle?.label || '-'} />
            <SummaryRow label={labels.exteriorDoor} value={selectedDoor?.label || '-'} />
            <SummaryRow label={labels.outsidePanels} value={selectedExteriorFinish?.label || '-'} />
            {config.variant === 'balcony' ? <SummaryRow label={labels.deckingColor} value={selectedDeckingColor?.label || '-'} /> : null}
            <SummaryRow label={labels.interiorPanels} value={selectedInteriorPanels?.label || labels.defaultWhitePanels} />
            <SummaryRow label={labels.floorFinish} value={optionSummary(selectedFloorOption)} />
            <SummaryRow label={labels.kitchenBench} value={optionSummary(selectedKitchenBench)} />
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
              <span key={item.id} className="bhc-mini-chip">{item.label}{item.isPanoramic ? ' · P' : ''} • {item.coords}</span>
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
            <SummaryRow label={labels.basePrice} value={euro(knownBasePrice, locale)} />
            <SummaryRow label={labels.internalWalls} value={interiorPanelsPrice ? euro(interiorPanelsPrice, locale) : '-'} />
            <SummaryRow label={labels.insideDoorPrice} value={insideDoorPrice ? euro(insideDoorPrice, locale) : '-'} />
            <SummaryRow label={labels.heatingPrice} value={config.heating ? euro(heatingPrice, locale) : '-'} />
            <SummaryRow label={`${labels.windowSize} · ${windowSizeDimension} mm (${labels.forAllWindows})`} value={windowSizeExtra ? euro(windowSizeExtra, locale) : labels.included} />
            {panoramicWindowCount ? <SummaryRow label={`${labels.panoramicUpgrades} · ${panoramicWindowCount}×€300`} value={euro(panoramicUpgradePrice, locale)} /> : null}
            <SummaryRow label={labels.totalKnown} value={euro(knownTotal, locale)} strong />
          </div>
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

  return (
    <main className={['bhc-page', isMobileShell && 'bhc-page--mobile'].filter(Boolean).join(' ')}>
      {renderHeroSection()}

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
