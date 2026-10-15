import React, { useMemo } from 'react'
import { resolveOpening, roomGroups, visibleWallSegments } from '../../lib/floorPlan.js'

// How large things look, in screen pixels: text, wall strokes and the dimension
// lines keep one size on screen whatever the zoom, so a 73 m² house fitted into the
// canvas reads as well as a zoomed-in bedroom. `pxPerM` is the drawing's current
// scale; everything below is converted to plan metres with it.
const PX = {
  name: 13,
  area: 12,
  minText: 9,
  outer: 4.5,
  user: 3,
  edge: 2,
  window: 1.6,
  door: 1.4,
  dim: 11,
}

// Text width estimate (no layout pass in SVG): average glyph ≈ 0.56 em.
const textWidthM = (s, fontM) => String(s).length * fontM * 0.56

/**
 * The rectangles of one open space that share a type, each set as ONE path: drawn under
 * the rooms, it gives their touching edges solid colour to blend into, so anti-aliasing
 * leaves no hairline seam across an L-shaped living room. [{ key, type, d }]
 */
export function openSpaceUnderlays(groups) {
  const out = []
  for (const g of groups) {
    if (g.rooms.length < 2) continue
    const byType = new Map()
    for (const r of g.rooms) byType.set(r.type, [...(byType.get(r.type) || []), r])
    for (const [type, rects] of byType) {
      if (rects.length < 2) continue
      out.push({ key: `${g.key}:${type}`, type, d: rects.map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}z`).join('') })
    }
  }
  return out
}

/**
 * The plan as a drawing, inside an <svg> the caller owns: the terrace, rooms
 * filled by type, the walls (none between rectangles of one open space), names
 * and m², doors and windows, and the outside dimensions. The canvas passes
 * pointer handlers and the selection; the print sheet passes neither.
 *
 * Colours come from CSS classes (fp-room--<type>, fp-wall--outer, …) so the light
 * and dark themes and the white print sheet are FloorPlanner.css's business.
 */
export default function PlanDrawing({
  model,
  plan,
  t,
  pxPerM = 60,
  terrace = null,
  terraceRect = null,
  idPrefix = 'fp',
  showDimensions = true,
  selectedRoomId = null,
  selectedWallId = null,
  selectedOpeningId = null,
  onRoomPointerDown,
  onWallPointerDown,
  onOpeningPointerDown,
  roomCursor,
  wallCursor,
  openingCursor,
  textOr = (path, fallback) => fallback,
}) {
  const m = (px) => px / pxPerM
  const segments = useMemo(() => visibleWallSegments(plan), [plan])
  const groups = useMemo(() => roomGroups(plan.rooms), [plan.rooms])
  const wallW = { outer: Math.max(0.1, m(PX.outer)), interior: Math.max(0.08, m(PX.user)), roomEdge: Math.max(0.05, m(PX.edge)) }

  return (
    <>
      <defs>
        <pattern id={`${idPrefix}-hatch`} patternUnits="userSpaceOnUse" width={0.18} height={0.18} patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.18" className="fp-hatch" strokeWidth={0.02} />
        </pattern>
        <pattern id={`${idPrefix}-deck`} patternUnits="userSpaceOnUse" width={0.14} height={1}>
          <rect x="0" y="0" width="0.14" height="1" className="fp-deck" />
          <line x1="0.135" y1="0" x2="0.135" y2="1" className="fp-deck-seam" strokeWidth={0.012} />
        </pattern>
      </defs>

      {/* The footprint's floor, under the rooms */}
      <rect x={0} y={0} width={model.widthM} height={model.depthM} className="fp-floor" />

      {terrace && terraceRect && <Terrace rect={terraceRect} option={terrace} idPrefix={idPrefix} t={t} m={m} />}

      <g aria-hidden="true" pointerEvents="none">
        {openSpaceUnderlays(groups).map((u) => (
          <path key={u.key} d={u.d} className={`fp-room-under fp-room--${u.type}`} />
        ))}
      </g>

      {/* Rooms (fill only) */}
      <g role="group" aria-label={textOr('planner.aria.rooms', 'rooms')}>
        {plan.rooms.map((r) => (
          <g key={r.id}>
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              data-room-id={r.id}
              className={`fp-room fp-room--${r.type}${r.locked ? ' is-locked' : ''}${selectedRoomId === r.id ? ' is-selected' : ''}`}
              onPointerDown={onRoomPointerDown ? (e) => onRoomPointerDown(r, e) : undefined}
              style={roomCursor ? { cursor: roomCursor(r) } : undefined}
            />
            {r.locked && <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={`url(#${idPrefix}-hatch)`} pointerEvents="none" />}
          </g>
        ))}
      </g>

      {/* Walls */}
      <g role="group" aria-label={textOr('planner.aria.walls', 'walls')}>
        {segments.map((seg) => {
          const isUser = seg.repKind === 'interior'
          const selected = isUser && selectedWallId === seg.repWallId
          return (
            <line
              key={seg.key}
              x1={seg.a.x}
              y1={seg.a.y}
              x2={seg.b.x}
              y2={seg.b.y}
              className={`fp-wall fp-wall--${seg.kind}${selected ? ' is-selected' : ''}`}
              strokeWidth={wallW[seg.kind] || wallW.roomEdge}
              strokeLinecap="square"
              onPointerDown={onWallPointerDown ? (e) => onWallPointerDown(seg, e) : undefined}
              style={wallCursor ? { cursor: wallCursor(seg) } : undefined}
            />
          )
        })}
      </g>

      {/* Room names and areas: one label per room, an open space counted once */}
      <g role="group" aria-label={textOr('planner.aria.labels', 'labels')} pointerEvents="none">
        {groups.map((g) => (
          <RoomLabel key={g.key} group={g} t={t} m={m} />
        ))}
      </g>

      {/* Openings */}
      <g role="group" aria-label={textOr('planner.aria.openings', 'openings')}>
        {plan.openings.map((o) => (
          <OpeningGlyph
            key={o.id}
            model={model}
            plan={plan}
            opening={o}
            m={m}
            // the opening is cut into the wall it is in: an outer wall's weight, or a
            // partition's -- not the outer weight everywhere, which left a dark block on
            // either side of every inside door in the dark theme
            gapW={String(o.host?.wallId || '').startsWith('outer_') ? wallW.outer * 1.15 : wallW.interior * 1.3}
            selected={selectedOpeningId === o.id}
            onPointerDown={onOpeningPointerDown ? (e) => onOpeningPointerDown(o, e) : undefined}
            cursor={openingCursor ? openingCursor(o) : undefined}
          />
        ))}
      </g>

      {showDimensions && <Dimensions model={model} t={t} m={m} />}
    </>
  )
}

function RoomLabel({ group, t, m }) {
  const r = group.primary
  if (!r || r.w <= 0 || r.h <= 0) return null
  const name = t.groupName(group)
  const area = t.fmtM2(group.areaM2)
  // An open space's label sits in the middle of the whole space at the primary
  // rectangle's height: across the L of a living room, not squeezed into one leg.
  const cy = r.y + r.h / 2
  let x0 = r.x
  let x1 = r.x + r.w
  for (let grew = true; grew; ) {
    grew = false
    for (const p of group.rooms) {
      if (p.y > cy || p.y + p.h < cy) continue
      if (Math.abs(p.x + p.w - x0) < 1e-6) { x0 = p.x; grew = true }
      if (Math.abs(p.x - x1) < 1e-6) { x1 = p.x + p.w; grew = true }
    }
  }
  // Shrink to fit the room's width; drop the name before the area in a sliver.
  let nameM = m(PX.name)
  let areaM = m(PX.area)
  const room = (x1 - x0) * 0.9
  const fit = Math.min(1, room / Math.max(textWidthM(name, nameM), 1e-6), room / Math.max(textWidthM(area, areaM), 1e-6))
  nameM *= Math.max(fit, PX.minText / PX.name)
  areaM *= Math.max(fit, PX.minText / PX.area)
  const showName = textWidthM(name, nameM) <= room && nameM * 2.4 <= r.h
  const cx = (x0 + x1) / 2
  return (
    <text x={cx} y={cy} textAnchor="middle" className="fp-roomlabel" data-room={name}>
      {showName && (
        <tspan className="fp-label-name" x={cx} dy={-nameM * 0.15} fontSize={nameM}>
          {name}
        </tspan>
      )}
      <tspan className="fp-label-area" x={cx} dy={showName ? nameM * 1.2 : areaM * 0.35} fontSize={areaM}>
        {area}
      </tspan>
    </text>
  )
}

function Terrace({ rect, option, idPrefix, t, m }) {
  const label = t.ed('project.terrace')
  const sizeM = t.fmtDims((option.lengthMm || 0) / 1000, (option.depthMm || 0) / 1000)
  const fs = m(11)
  const vertical = rect.h > rect.w
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return (
    <g className="fp-terrace" pointerEvents="none">
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`url(#${idPrefix}-deck)`} />
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} className="fp-terrace-edge" strokeWidth={m(1.2)} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fs}
        className="fp-terrace-label"
        transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
      >
        {label} · {sizeM}
      </text>
    </g>
  )
}

function Dimensions({ model, t, m }) {
  const fs = m(PX.dim)
  const off = Math.max(0.32, m(26))
  const tick = m(5)
  const sw = m(1)
  const W = model.widthM
  const D = model.depthM
  return (
    <g className="fp-dims" pointerEvents="none" aria-hidden="true">
      <line x1={0} y1={-off} x2={W} y2={-off} strokeWidth={sw} />
      <line x1={0} y1={-off - tick} x2={0} y2={-off + tick} strokeWidth={sw} />
      <line x1={W} y1={-off - tick} x2={W} y2={-off + tick} strokeWidth={sw} />
      <text x={W / 2} y={-off - m(5)} textAnchor="middle" fontSize={fs}>
        {t.fmtM(W)}
      </text>
      <line x1={-off} y1={0} x2={-off} y2={D} strokeWidth={sw} />
      <line x1={-off - tick} y1={0} x2={-off + tick} y2={0} strokeWidth={sw} />
      <line x1={-off - tick} y1={D} x2={-off + tick} y2={D} strokeWidth={sw} />
      <text x={-off - m(5)} y={D / 2} textAnchor="middle" fontSize={fs} transform={`rotate(-90 ${-off - m(5)} ${D / 2})`}>
        {t.fmtM(D)}
      </text>
    </g>
  )
}

function OpeningGlyph({ model, plan, opening, m, gapW, selected, onPointerDown, cursor }) {
  const { geom, widthM, a, b } = resolveOpening(model, plan, opening)
  const cls = `fp-opening fp-opening--${opening.kind}${opening.locked ? ' is-locked' : ''}${selected ? ' is-selected' : ''}`
  const handlers = onPointerDown
    ? {
        onPointerDown: (e) => {
          e.stopPropagation()
          onPointerDown(e)
        },
      }
    : {}
  const style = cursor ? { cursor } : undefined
  // A wide invisible stroke makes a thin glyph easy to hit.
  const hit = onPointerDown ? (
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={Math.max(0.3, m(14))} />
  ) : null

  if (opening.kind === 'window') {
    return (
      <g className={cls} {...handlers} style={style} data-opening-id={opening.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="fp-gap" strokeWidth={gapW} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="fp-window-glass" strokeWidth={Math.max(0.03, m(PX.window))} />
        <line
          x1={a.x + geom.n.x * gapW * 0.42}
          y1={a.y + geom.n.y * gapW * 0.42}
          x2={b.x + geom.n.x * gapW * 0.42}
          y2={b.y + geom.n.y * gapW * 0.42}
          className="fp-window-glass"
          strokeWidth={Math.max(0.02, m(1))}
        />
        <line
          x1={a.x - geom.n.x * gapW * 0.42}
          y1={a.y - geom.n.y * gapW * 0.42}
          x2={b.x - geom.n.x * gapW * 0.42}
          y2={b.y - geom.n.y * gapW * 0.42}
          className="fp-window-glass"
          strokeWidth={Math.max(0.02, m(1))}
        />
        {hit}
      </g>
    )
  }

  const sw = Math.max(0.025, m(PX.door))
  const openToPos = (opening.openTo || 'pos') === 'pos'
  const on = openToPos ? geom.n : { x: -geom.n.x, y: -geom.n.y }
  // One leaf hung at a jamb, swinging `len` metres out towards `on`.
  const leaf = (hinge, other, len) => {
    const leafEnd = { x: hinge.x + on.x * len, y: hinge.y + on.y * len }
    const tx = other.x - hinge.x
    const ty = other.y - hinge.y
    const cross = tx * on.y - ty * on.x
    const sweep = cross > 0 ? 1 : 0
    const tip = { x: hinge.x + (tx / Math.hypot(tx, ty)) * len, y: hinge.y + (ty / Math.hypot(tx, ty)) * len }
    return (
      <>
        <line x1={hinge.x} y1={hinge.y} x2={leafEnd.x} y2={leafEnd.y} className="fp-door-leaf" strokeWidth={sw * 1.4} />
        <path d={`M ${tip.x} ${tip.y} A ${len} ${len} 0 0 ${sweep} ${leafEnd.x} ${leafEnd.y}`} className="fp-door-arc" strokeWidth={sw} />
      </>
    )
  }

  const hingeAtA = (opening.hinge || 'start') === 'start'
  return (
    <g className={cls} {...handlers} style={style} data-opening-id={opening.id}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="fp-gap" strokeWidth={gapW} />
      {opening.leaves === 2 ? (
        <>
          {leaf(a, b, widthM / 2)}
          {leaf(b, a, widthM / 2)}
        </>
      ) : hingeAtA ? (
        leaf(a, b, widthM)
      ) : (
        leaf(b, a, widthM)
      )}
      {hit}
    </g>
  )
}
