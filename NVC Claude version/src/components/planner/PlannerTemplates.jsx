// "Start from a ready plan": the catalogue's own layouts (A1–A6, B1–B6, C1–C6) for the Box
// house size picked above them, and the three empty container shells on a quieter tab.
//
// Each card draws its plan from the template data (src/content/shared/plannerModels.js), not
// from the furnished catalogue render: the drawing is the plan the planner will load, with the
// bathroom exactly where normalizePlan puts it, so what the card shows and what opens can never
// differ. Rooms are tinted by type, the L-shaped day space is drawn as one room (its rectangles
// share a `space`, and the line between them is left out), and the included front deck is
// hatched in, so the plan reads like the house rather than like a grid of boxes.
//
// What a card's button does depends on the screen, which the page decides (`canEdit`):
// - from 900px the planner is on the page, so it opens the plan there (onOpen);
// - on a phone there is no planner, so it shows the plan large in a dialog, read-only, with
//   its rooms and their areas and a button that sends exactly that plan for an offer (onSend).
//
// Every card on a tab is drawn at one scale (the tab's largest plan sets it), with walls of
// one weight in screen pixels, so a 6 × 3 m container never looks like a house's size.
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import Modal from '../Modal.jsx'
import { isContainerShell, normalizePlan, planSummary } from '../../lib/floorPlan.js'
import {
  PLANNER_MODELS,
  getPlannerModel,
  templateInfo,
  templateToPlan,
  templatesForModel,
  terraceOptionsFor,
} from '../../content/shared/plannerModels.js'
import { usePlannerText } from './plannerText.js'

// ---------------------------------------------------------------- helpers (shared with the page)

/** Fills {name} placeholders; an unknown one is left as written, so a typo shows. */
export function fill(text, values = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (match, key) => (values[key] ?? match))
}

const LANG_TAGS = { bg: 'bg-BG', en: 'en-GB', el: 'el-GR' }

/** A number in the page's language: 30,9 in Bulgarian and Greek, 30.9 in English. */
export function fmtNumber(value, locale, digits = 1) {
  const n = Number(value) || 0
  try {
    return new Intl.NumberFormat(LANG_TAGS[locale] || 'en-GB', { maximumFractionDigits: digits }).format(n)
  } catch {
    return String(Math.round(n * 10 ** digits) / 10 ** digits)
  }
}

/**
 * ['37', '58', '73'] → "37, 58 и 73" / "37, 58 and 73" / "37, 58 και 73"; with
 * type 'disjunction', "37, 58 или 73" / "37, 58 or 73" / "37, 58 ή 73" (a house is one size).
 */
export function fmtList(items, locale, type = 'conjunction') {
  try {
    return new Intl.ListFormat(LANG_TAGS[locale] || 'en-GB', { style: 'long', type }).format(items)
  } catch {
    return items.join(', ')
  }
}

/** The bedrooms line of a card: "Без спалня", "1 спалня", "3 спални". */
export function bedroomsText(copy, n) {
  const forms = copy?.bedrooms || {}
  if (n === 0) return forms.zero || ''
  if (n === 1) return forms.one || ''
  return fill(forms.many, { n })
}

export const BOX_MODELS = PLANNER_MODELS.filter((m) => m.kind === 'box')
export const CONTAINER_MODELS = PLANNER_MODELS.filter((m) => m.kind !== 'box')
export const CONTAINERS_TAB = 'containers'

/** Every template the tab shows: one Box size, or all three container shells. */
export function templatesForTab(tab) {
  if (tab === CONTAINERS_TAB) return CONTAINER_MODELS.flatMap((m) => templatesForModel(m.key))
  return templatesForModel(tab)
}

// A template as the editor would hold it: normalizePlan adds the Box house's bathroom and its
// two locked doors and the walls, exactly as loading it into the planner does. Templates never
// change while the page is open, so each is worked out once.
const planCache = new Map()
export function templatePlan(template) {
  if (!planCache.has(template.key)) {
    const model = getPlannerModel(template.model)
    planCache.set(template.key, normalizePlan(model, templateToPlan(template)))
  }
  return planCache.get(template.key)
}

/** The catalogue's standard deck for a Box model (included in the price), or null. */
export function standardTerrace(modelKey, locale) {
  return terraceOptionsFor(modelKey, locale).find((o) => o.included && o.rect) || null
}

/**
 * A template summarised exactly as the editor summarises a plan (PlannerEditor's
 * `summary`): planSummary() counts the rectangles of one open space as one room, and each
 * room is named with the editor's own words (t.groupName: "Дневна с кухня" for the living
 * room that holds the kitchen run). So a plan sent from a phone preview reads, in the offer,
 * exactly like the same plan sent from the editor. `text` is usePlannerText's result.
 */
export function templateSummary(template, text, locale) {
  const model = getPlannerModel(template.model)
  const plan = templatePlan(template)
  const terrace = model.kind === 'box' ? standardTerrace(template.model, locale) : null
  return {
    ...namedSummary(model, plan, text),
    template: template.key,
    templateEdited: false,
    terrace: terrace ? { key: terrace.key, label: terrace.label, price: terrace.price, included: terrace.included } : null,
  }
}

/**
 * planSummary() with every room named as the editor names it, and its rectangles (`rects`)
 * for placing a label. A container's single room is the whole unit, not a living room:
 * a container comes with a bathroom nobody has drawn yet, so calling the shell "Дневна"
 * would say more than anyone knows (templates.containerRoom).
 */
export function namedSummary(model, plan, text) {
  const base = planSummary(model, plan)
  const byId = new Map(plan.rooms.map((r) => [r.id, r]))
  const shell = isContainerShell(model, plan)
  return {
    ...base,
    rooms: base.rooms.map((r) => {
      const parts = r.parts.map((id) => byId.get(id)).filter(Boolean)
      const primary = parts.find((x) => x.label) || parts.find((x) => x.type === r.type) || parts[0]
      const typeName = text.groupName({ primary, type: r.type, kitchen: r.kitchen })
      const name = shell ? text.textOr('templates.containerRoom', typeName) : typeName
      return { ...r, name, rects: parts }
    }),
  }
}

/**
 * Where a room's name goes: the room's largest rectangle of its own type (B5's day space
 * is a living room and a hall, and its name belongs on the living room). [{ id, name, area, rect }]
 */
export function roomLabels(rooms, locale) {
  return rooms.map((r) => {
    const own = r.rects.filter((x) => x.type === r.type)
    const biggest = (own.length ? own : r.rects).reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a))
    return { id: r.id, name: r.name, area: fmtNumber(r.areaM2, locale), rect: biggest }
  })
}

/** The extent a plan is drawn over, its deck included: { x0, y0, x1, y1 } in metres. */
export function planExtent(model, terraceRect) {
  const t = terraceRect
  return {
    x0: Math.min(0, t ? t.x : 0),
    y0: 0,
    x1: Math.max(model.widthM, t ? t.x + t.w : model.widthM),
    y1: Math.max(model.depthM, t ? t.y + t.h : model.depthM),
  }
}

/** The size every card of a list is drawn at: the largest extent among them, { w, d }. */
export function sharedFrame(templates, locale) {
  let w = 0
  let d = 0
  for (const tpl of templates) {
    const model = getPlannerModel(tpl.model)
    const deck = model.kind === 'box' ? standardTerrace(tpl.model, locale)?.rect : null
    const e = planExtent(model, deck)
    w = Math.max(w, e.x1 - e.x0)
    d = Math.max(d, e.y1 - e.y0)
  }
  return { w, d }
}

/** "Дневна с кухня · 3 спални · Баня": the day space first, bedrooms as a count, the bathroom last. */
export function roomsLine(rooms, copy, roomTypeLabel) {
  const beds = rooms.filter((r) => r.type === 'bed').length
  const others = rooms.filter((r) => r.type !== 'bed' && r.type !== 'bath').map((r) => r.name)
  const bath = rooms.some((r) => r.type === 'bath') ? [roomTypeLabel('bath')] : []
  const parts = [...others.slice(0, 1), ...(beds ? [bedroomsText(copy, beds)] : []), ...others.slice(1), ...bath]
  return parts.join(' · ')
}

// ---------------------------------------------------------------- the plan drawing

const EPS = 1e-6
const near = (a, b) => Math.abs(a - b) < 1e-4

// The line two rectangles share, if they touch along a side: { v, c, a, b }, where v is a
// vertical line at x = c running from y = a to b (or horizontal at y = c).
function sharedEdge(p, q) {
  for (const [x1, x2] of [[p.x + p.w, q.x], [q.x + q.w, p.x]]) {
    if (near(x1, x2)) {
      const a = Math.max(p.y, q.y)
      const b = Math.min(p.y + p.h, q.y + q.h)
      if (b - a > EPS) return { v: true, c: x1, a, b }
    }
  }
  for (const [y1, y2] of [[p.y + p.h, q.y], [q.y + q.h, p.y]]) {
    if (near(y1, y2)) {
      const a = Math.max(p.x, q.x)
      const b = Math.min(p.x + p.w, q.x + q.w)
      if (b - a > EPS) return { v: false, c: y1, a, b }
    }
  }
  return null
}

function subtract(seg, cuts) {
  let pieces = [[seg.a, seg.b]]
  for (const cut of cuts) {
    pieces = pieces.flatMap(([a, b]) => {
      if (cut.b <= a + EPS || cut.a >= b - EPS) return [[a, b]]
      const out = []
      if (cut.a > a + EPS) out.push([a, cut.a])
      if (cut.b < b - EPS) out.push([cut.b, b])
      return out
    })
  }
  return pieces.map(([a, b]) => ({ ...seg, a, b }))
}

/**
 * The interior partitions of a plan, as line segments: every room's sides, less the outer
 * walls (drawn on their own, thicker) and less the lines inside one open space.
 */
export function partitionSegments(rooms, model) {
  const open = []
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const p = rooms[i]
      const q = rooms[j]
      if (!p.space || p.space !== q.space) continue
      const edge = sharedEdge(p, q)
      if (edge) open.push(edge)
    }
  }
  const seen = new Set()
  const out = []
  for (const r of rooms) {
    const sides = [
      { v: false, c: r.y, a: r.x, b: r.x + r.w },
      { v: false, c: r.y + r.h, a: r.x, b: r.x + r.w },
      { v: true, c: r.x, a: r.y, b: r.y + r.h },
      { v: true, c: r.x + r.w, a: r.y, b: r.y + r.h },
    ]
    for (const side of sides) {
      const outer = side.v ? near(side.c, 0) || near(side.c, model.widthM) : near(side.c, 0) || near(side.c, model.depthM)
      if (outer) continue
      for (const piece of subtract(side, open.filter((o) => o.v === side.v && near(o.c, side.c)))) {
        const key = [piece.v ? 'v' : 'h', piece.c, piece.a, piece.b].map((n) => (typeof n === 'number' ? n.toFixed(3) : n)).join(':')
        if (seen.has(key) || piece.b - piece.a < 0.01) continue
        seen.add(key)
        out.push(piece)
      }
    }
  }
  return out
}

// Where an opening sits: its two ends and the wall's direction, from the wall it is hosted on.
function openingGeometry(walls, opening) {
  const wall = walls.find((w) => w.id === opening.host?.wallId)
  if (!wall) return null
  const dx = wall.b.x - wall.a.x
  const dy = wall.b.y - wall.a.y
  const len = Math.hypot(dx, dy)
  if (!len) return null
  const ux = dx / len
  const uy = dy / len
  const width = Number(opening.widthM) || (opening.kind === 'window' ? 0.96 : 0.9)
  const at = Number(opening.host.at) || 0
  const cx = wall.a.x + ux * at
  const cy = wall.a.y + uy * at
  return {
    outer: wall.kind === 'outer',
    x1: cx - (ux * width) / 2,
    y1: cy - (uy * width) / 2,
    x2: cx + (ux * width) / 2,
    y2: cy + (uy * width) / 2,
    ux,
    uy,
    width,
  }
}

const TYPE_CLASS = new Set(['living', 'bed', 'kitchen', 'bath', 'office', 'storage', 'corridor'])

/**
 * The rectangles of one open space that share a type, each set as ONE path: drawn under
 * the rooms, it gives their touching edges solid colour to blend into, so anti-aliasing
 * leaves no hairline seam across an L-shaped living room. [{ key, type, d }]
 */
export function openSpaceUnderlays(rooms) {
  const sets = new Map()
  for (const r of rooms) {
    if (!r.space) continue
    const key = `${r.space}:${r.type}`
    sets.set(key, [...(sets.get(key) || []), r])
  }
  return [...sets.entries()]
    .filter(([, rects]) => rects.length > 1)
    .map(([key, rects]) => ({ key, type: rects[0].type, d: rects.map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}z`).join('') }))
}

// Room names on a plan stay readable however small the plan is drawn: at least this many
// screen pixels (the area a little smaller), and a name wider than its room is left out --
// the list under the plan has every name -- rather than run over the walls.
const LABEL_MIN_PX = { name: 11, area: 10 }
const LABEL_BASE_M = { name: 0.3, area: 0.27 }
const GLYPH_EM = 0.6 // average glyph width, generous for Cyrillic and Greek
const LABEL_PAD_M = 0.1

// The drawing's scale on screen, in pixels per metre, once it is laid out: 0 until then
// (and in a test's DOM, which lays nothing out).
function useRenderedScale(ref, vbW, vbH, enabled) {
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return undefined
    const measure = () => {
      const box = el.getBoundingClientRect?.()
      if (box && box.width > 0 && box.height > 0) setScale(Math.min(box.width / vbW, box.height / vbH))
    }
    measure()
    if (typeof ResizeObserver !== 'function') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, vbW, vbH, enabled])
  return scale
}

/** How one room's label is set at `scale` px per metre: { nameM, areaM, showName, showArea }. */
export function fitLabel(label, scale) {
  const px = (n) => (scale > 0 ? n / scale : 0)
  const nameM = Math.max(LABEL_BASE_M.name, px(LABEL_MIN_PX.name))
  const areaM = Math.max(LABEL_BASE_M.area, px(LABEL_MIN_PX.area))
  const width = label.rect.w - 2 * LABEL_PAD_M
  const height = label.rect.h - 2 * LABEL_PAD_M
  const wide = (text, size) => String(text).length * size * GLYPH_EM
  const showArea = wide(label.area, areaM) <= width && areaM * 1.2 <= height
  const showName = showArea && wide(label.name, nameM) <= width && (nameM + areaM) * 1.25 <= height
  return { nameM, areaM, showName, showArea }
}

/**
 * A plan drawn the way the catalogue draws one: tinted rooms, thick outer walls, thin
 * partitions, gaps for doors and windows, the included deck hatched in front.
 *
 * @param model    a planner model (src/content/shared/plannerModels.js)
 * @param plan     a normalized plan { rooms, walls, openings }
 * @param terrace  an optional { rect: { x, y, w, h } } in plan metres
 * @param labels   optional [{ id, name, area, rect }]: written in the middle of each room
 * @param title    the accessible name; without one the drawing is decorative
 * @param detailed draws door swings as well as the gaps (the large preview)
 */
export function PlanDrawing({ model, plan, terrace, labels, title, detailed = false, frame = null, className = '' }) {
  const rawId = useId()
  const hatchId = `fpp-hatch-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const svgRef = useRef(null)
  const W = model.widthM
  const D = model.depthM
  const t = terrace?.rect
  const pad = 0.3
  const ext = planExtent(model, t)
  // With a `frame` ({ w, d }: the largest extent of the plans drawn beside this one) the
  // view is that size, centred on this plan, so every card of a tab shares one scale.
  const fw = Math.max(ext.x1 - ext.x0, frame?.w || 0)
  const fd = Math.max(ext.y1 - ext.y0, frame?.d || 0)
  const x0 = (ext.x0 + ext.x1) / 2 - fw / 2 - pad
  const y0 = (ext.y0 + ext.y1) / 2 - fd / 2 - pad
  const x1 = x0 + fw + 2 * pad
  const y1 = y0 + fd + 2 * pad
  const scale = useRenderedScale(svgRef, x1 - x0, y1 - y0, Boolean(labels?.length))
  const segments = useMemo(() => partitionSegments(plan.rooms, model), [plan.rooms, model])
  const underlays = useMemo(() => openSpaceUnderlays(plan.rooms), [plan.rooms])
  const openings = useMemo(
    () => plan.openings.map((o) => ({ o, g: openingGeometry(plan.walls, o) })).filter((x) => x.g),
    [plan.openings, plan.walls]
  )

  return (
    <svg
      ref={svgRef}
      className={`fpp-plan ${className}`}
      viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
      preserveAspectRatio="xMidYMid meet"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {t ? (
        <>
          <defs>
            <pattern id={hatchId} width="0.3" height="0.3" patternUnits="userSpaceOnUse">
              <rect width="0.3" height="0.3" className="fpp-deck" />
              <path d="M0.15 0 V0.3" className="fpp-deck-line" />
            </pattern>
          </defs>
          <rect x={t.x} y={t.y} width={t.w} height={t.h} fill={`url(#${hatchId})`} className="fpp-deck-edge" />
        </>
      ) : null}

      {/* An open space's rectangles of one type, once more as one shape underneath, so
          their touching edges blend into solid colour instead of a hairline seam. */}
      {underlays.map((u) => (
        <path key={u.key} d={u.d} className={`fpp-room-under fpp-room--${TYPE_CLASS.has(u.type) ? u.type : 'living'}`} />
      ))}

      {plan.rooms.map((r) => (
        <rect
          key={r.id}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          className={`fpp-room fpp-room--${TYPE_CLASS.has(r.type) ? r.type : 'living'}`}
        />
      ))}

      {segments.map((s, i) =>
        s.v ? (
          <line key={i} x1={s.c} y1={s.a} x2={s.c} y2={s.b} className="fpp-partition" />
        ) : (
          <line key={i} x1={s.a} y1={s.c} x2={s.b} y2={s.c} className="fpp-partition" />
        )
      )}

      <rect x={0} y={0} width={W} height={D} className="fpp-outer" />

      {openings.map(({ o, g }) => (
        <g key={o.id} className={o.kind === 'window' ? 'fpp-window' : 'fpp-door'}>
          <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} className={g.outer ? 'fpp-gap fpp-gap--outer' : 'fpp-gap'} />
          {o.kind === 'window' ? <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} className="fpp-glass" /> : null}
          {o.kind === 'door' && detailed && !(o.locked && g.outer) ? <DoorSwing o={o} g={g} /> : null}
        </g>
      ))}

      {labels?.length
        ? labels.map((l) => {
            const cx = l.rect.x + l.rect.w / 2
            const cy = l.rect.y + l.rect.h / 2
            const fit = fitLabel(l, scale)
            if (!fit.showArea) return null
            return (
              <text key={l.id} x={cx} y={cy} className="fpp-label" textAnchor="middle" data-label={l.name}>
                {fit.showName ? (
                  <tspan x={cx} dy={-fit.nameM * 0.2} fontSize={fit.nameM}>{l.name}</tspan>
                ) : null}
                <tspan
                  x={cx}
                  dy={fit.showName ? fit.nameM * 1.15 : fit.areaM * 0.35}
                  fontSize={fit.areaM}
                  className="fpp-label-area"
                >
                  {l.area}
                </tspan>
              </text>
            )
          })
        : null}
    </svg>
  )
}

// A door leaf and its quarter circle. 'pos' opens to the wall's left-hand normal, which for a
// room's side is into that room (src/lib/floorPlan.js); the hinge is at the end nearer the
// wall's start unless the door says 'end'.
function DoorSwing({ o, g }) {
  const sign = o.openTo === 'neg' ? -1 : 1
  const nx = -g.uy * sign
  const ny = g.ux * sign
  const hingeAtStart = o.hinge !== 'end'
  const hx = hingeAtStart ? g.x1 : g.x2
  const hy = hingeAtStart ? g.y1 : g.y2
  const fx = hingeAtStart ? g.x2 : g.x1
  const fy = hingeAtStart ? g.y2 : g.y1
  const lx = hx + nx * g.width
  const ly = hy + ny * g.width
  // Which way round the arc goes: the sign of the turn from the leaf back to the wall.
  const cross = (lx - hx) * (fy - hy) - (ly - hy) * (fx - hx)
  const sweep = cross > 0 ? 1 : 0
  return (
    <>
      <line x1={hx} y1={hy} x2={lx} y2={ly} className="fpp-leaf" />
      <path d={`M ${lx} ${ly} A ${g.width} ${g.width} 0 0 ${sweep} ${fx} ${fy}`} className="fpp-swing" />
    </>
  )
}

// ---------------------------------------------------------------- the section

/**
 * @param content      the route's floorPlanner content (templates.*, planner.roomTypes)
 * @param locale       'bg' | 'en' | 'el'
 * @param tab          'b37' | 'b57' | 'b73' | 'containers', with onTabChange (controlled)
 * @param canEdit      true when the planner is on the page: the card opens the plan there
 * @param onOpen       (template) => void, the card's action when canEdit
 * @param onSend       (template, summary) => void, the preview's "send for an offer"; summary
 *                     is templateSummary(), in the editor's summary shape
 */
export default function PlannerTemplates({ content, locale = 'bg', tab, onTabChange, canEdit = true, onOpen, onSend }) {
  const copy = content?.templates || {}
  const text = usePlannerText(content, locale)
  const [preview, setPreview] = useState(null)
  const tabRefs = useRef([])

  const tabs = [
    ...BOX_MODELS.map((m) => ({ key: m.key, label: fill(copy.tabBox, { area: m.area }) })),
    { key: CONTAINERS_TAB, label: copy.tabContainers, quiet: true },
  ]
  const activeIndex = Math.max(0, tabs.findIndex((x) => x.key === tab))
  const active = tabs[activeIndex].key
  const list = templatesForTab(active)
  const frame = useMemo(() => sharedFrame(templatesForTab(active), locale), [active, locale])

  // Arrow keys move along the tabs, as a tab list should (WAI-ARIA, automatic activation).
  const onTabKeyDown = (ev) => {
    const step = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0
    const to = ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : step ? (activeIndex + step + tabs.length) % tabs.length : -1
    if (to < 0) return
    ev.preventDefault()
    onTabChange?.(tabs[to].key)
    tabRefs.current[to]?.focus()
  }

  const panelId = 'fpp-templates-panel'
  const previewModel = preview ? getPlannerModel(preview.model) : null
  const previewInfo = preview ? templateInfo(preview, locale) : null
  const previewPlan = preview ? templatePlan(preview) : null
  const previewSummary = preview ? templateSummary(preview, text, locale) : null
  const previewRooms = previewSummary ? previewSummary.rooms : []
  const previewTerrace = preview ? standardTerrace(preview.model, locale) : null
  const area = (m2) => fill(copy.approx, { area: fmtNumber(m2, locale) })

  return (
    <section id="templates" className="fpp-templates" aria-labelledby="fpp-templates-title">
      <div className="hp-container">
        <div className="hp-head">
          <div>
            {copy.eyebrow ? <span className="hp-eyebrow">{copy.eyebrow}</span> : null}
            <h2 id="fpp-templates-title">{copy.title}</h2>
            <p className="hp-sub">{canEdit ? copy.sub : copy.subPhone || copy.sub}</p>
          </div>
        </div>

        <div className="fpp-tabs" role="tablist" aria-label={copy.tabsLabel}>
          {tabs.map((x, i) => (
            <button
              key={x.key}
              ref={(el) => { tabRefs.current[i] = el }}
              type="button"
              role="tab"
              id={`fpp-tab-${x.key}`}
              aria-selected={x.key === active}
              aria-controls={panelId}
              tabIndex={x.key === active ? 0 : -1}
              className={`fpp-tab${x.quiet ? ' fpp-tab--quiet' : ''}`}
              onClick={() => onTabChange?.(x.key)}
              onKeyDown={onTabKeyDown}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div id={panelId} role="tabpanel" aria-labelledby={`fpp-tab-${active}`} className="fpp-panel">
          {active === CONTAINERS_TAB && copy.containersNote ? (
            // without the planner on the page, "draw it yourself" is not on offer
            <p className="fpp-note">{canEdit ? copy.containersNote : copy.containersNotePhone || copy.containersNote}</p>
          ) : null}
          <ul className="fpp-cards">
            {list.map((tpl) => {
              const info = templateInfo(tpl, locale)
              const model = getPlannerModel(tpl.model)
              const plan = templatePlan(tpl)
              const summary = templateSummary(tpl, text, locale)
              const isBox = model.kind === 'box'
              const heading = isBox ? info.summary : `${text.modelLabel(model)}`
              const area = fill(copy.tabBox, { area: isBox ? info.areaM2 : fmtNumber(info.areaM2, locale) })
              return (
                <li key={tpl.key}>
                  <article className="hp-card fpp-card" aria-labelledby={`fpp-card-${tpl.key}`}>
                    <div className="fpp-card-plan">
                      <PlanDrawing model={model} plan={plan} terrace={isBox ? standardTerrace(tpl.model, locale) : null} frame={frame} />
                    </div>
                    <div className="fpp-card-body">
                      <span className="fpp-card-key">{isBox ? `${info.key} · ${area}` : area}</span>
                      <h3 id={`fpp-card-${tpl.key}`}>{heading}</h3>
                      <p className="fpp-card-rooms">
                        {isBox ? roomsLine(summary.rooms, copy, text.roomTypeLabel) : canEdit ? info.summary : copy.containerPhone || info.summary}
                      </p>
                    </div>
                    <div className="fpp-card-actions">
                      {canEdit ? (
                        <button
                          type="button"
                          className="hp-btn ghost"
                          aria-label={fill(copy.openAria, { key: isBox ? info.key : heading })}
                          onClick={() => onOpen?.(tpl)}
                        >
                          {copy.open}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="hp-btn ghost"
                          aria-label={fill(copy.viewAria, { key: isBox ? info.key : heading })}
                          onClick={() => setPreview(tpl)}
                        >
                          {copy.view}
                        </button>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        closeLabel={copy.close}
        title={
          preview
            ? previewModel.kind === 'box'
              ? fill(copy.previewTitle, { key: previewInfo.key, area: previewInfo.areaM2 })
              : text.modelLabel(previewModel)
            : null
        }
      >
        {preview ? (
          <div className="fpp-preview">
            {previewModel.kind === 'box' ? <p className="fpp-preview-sum">{previewInfo.summary}</p> : null}
            <div className="fpp-preview-plan">
              <PlanDrawing
                model={previewModel}
                plan={previewPlan}
                terrace={previewTerrace}
                detailed
                title={fill(copy.planAlt, {
                  key: previewModel.kind === 'box' ? previewInfo.key : text.modelLabel(previewModel),
                  summary: previewInfo.summary,
                })}
                // each room by the name the list below and the offer give it
                labels={roomLabels(previewRooms, locale)}
              />
            </div>
            <ul className="fpp-rooms">
              {previewRooms.map((r) => (
                <li key={r.id}>
                  <span className={`fpp-swatch fpp-swatch--${TYPE_CLASS.has(r.type) ? r.type : 'living'}`} aria-hidden="true" />
                  <span className="fpp-rooms-name">{r.locked && copy.bathFixed ? copy.bathFixed : r.name}</span>
                  <span className="fpp-rooms-area">{area(r.areaM2)}</span>
                </li>
              ))}
              {previewTerrace ? (
                <li>
                  <span className="fpp-swatch fpp-swatch--deck" aria-hidden="true" />
                  <span className="fpp-rooms-name">
                    {fill(copy.terrace, {
                      size: `${fmtNumber(previewTerrace.lengthMm / 1000, locale, 2)}\u00a0×\u00a0${fmtNumber(previewTerrace.depthMm / 1000, locale, 2)}`,
                    })}
                  </span>
                  <span className="fpp-rooms-area">{area((previewTerrace.lengthMm * previewTerrace.depthMm) / 1e6)}</span>
                </li>
              ) : null}
            </ul>
            <p className="fpp-note">{copy.areaNote}</p>
            <div className="fpp-preview-foot">
              <button
                type="button"
                className="hp-btn fpp-preview-send"
                onClick={() => {
                  const tpl = preview
                  setPreview(null)
                  onSend?.(tpl, previewSummary)
                }}
              >
                {copy.send}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
