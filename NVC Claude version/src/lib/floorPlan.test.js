import { describe, it, expect } from 'vitest'
import { getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import { getTemplate, templateToPlan, terraceOptionsFor } from '../content/shared/plannerModels.js'
import {
  FIXED_BATHROOM_ID,
  LEGACY_FOOTPRINTS,
  decodePlanShare,
  encodePlanShare,
  fitViewBox,
  migratePlan,
  migrateStoredPlans,
  placeOpeningResult,
  roomGroups,
  stampFootprint,
  visibleWallSegments,
  MODELS,
  defaultViewBox,
  fixedBathroom,
  makeDefaultPlan,
  moveOpeningTo,
  normalizePlan,
  parseLayout,
  placeOpening,
  planSummary,
  resizeRoomRect,
  resolveOpening,
  roomOverlapsAny,
  snapRoomPosition,
  validatePlan,
  withResolvedRoomNames,
  zoomViewBox,
} from './floorPlan.js'

const model = (key) => MODELS.find((m) => m.key === key)
const C6 = model('c6x3') // 6 × 3 m container, no locked items
const B58 = model('b57') // Box house 58 m²: 6.26 × 9.0 m (catalogue), locked bathroom + 2 doors

const room = (id, x, y, w, h, extra = {}) => ({ id, type: 'living', label: null, x, y, w, h, finish: 'wood', locked: false, ...extra })

describe('the locked bathroom of a Box house', () => {
  it('a new Box plan starts with the bathroom where the catalogue drawing puts it, and its two doors', () => {
    const plan = makeDefaultPlan(B58)
    const bath = plan.rooms.find((r) => r.id === FIXED_BATHROOM_ID)

    // Page 14: the block's walls at 2460 and 3780 mm from the left face, 2400 mm deep.
    expect(bath).toMatchObject({ type: 'bath', locked: true, x: 2.46, y: 0, h: 2.4 })
    expect(bath.x + bath.w).toBe(3.78)
    expect(plan.openings.map((o) => [o.id, o.host.wallId, o.locked])).toEqual([
      ['entrance_fixed', 're_bathroom_fixed_bottom', true],
      ['entrance_front_fixed', 'outer_bottom', true],
    ])
  })

  it('a container has no locked bathroom', () => {
    expect(makeDefaultPlan(C6).rooms).toEqual([])
  })

  it('goes back to its place whatever a stored plan says, and other locked items are dropped', () => {
    const stored = {
      rooms: [
        { ...fixedBathroom(B58), x: 3, y: 5 },
        room('fake-lock', 0, 4, 2, 2, { locked: true }),
        room('r1', 0, 4, 2, 2),
      ],
      openings: [{ id: 'entrance_fixed', kind: 'door', locked: true, host: { type: 'wall', wallId: 'outer_left', at: 1 } }],
    }
    const plan = normalizePlan(B58, stored)

    expect(plan.rooms.map((r) => r.id)).toEqual([FIXED_BATHROOM_ID, 'r1'])
    expect(plan.rooms[0]).toEqual(fixedBathroom(B58))
    expect(plan.openings.find((o) => o.id === 'entrance_fixed').host.wallId).toBe('re_bathroom_fixed_bottom')
  })

  it('takes a model’s own bathroom rectangle when it carries one', () => {
    const custom = { ...B58, key: 'b58-catalogue', bathroom: { x: 2.2, y: 0, w: 2.2, h: 1.25 } }
    const bath = makeDefaultPlan(custom).rooms[0]

    expect(bath).toMatchObject({ id: FIXED_BATHROOM_ID, x: 2.2, y: 0, w: 2.2, h: 1.25, locked: true })
  })

  it('no room may overlap it, but a room may share its wall', () => {
    const plan = makeDefaultPlan(B58)
    const bath = plan.rooms[0]

    expect(roomOverlapsAny(plan.rooms, { x: bath.x + 0.2, y: 1, w: 2, h: 2 })).toBe(true)
    expect(roomOverlapsAny(plan.rooms, { x: bath.x + bath.w, y: 0, w: 1.5, h: 3 })).toBe(false)
    expect(roomOverlapsAny(plan.rooms, { x: 0, y: bath.h, w: 3, h: 2 })).toBe(false)
  })

  it('validatePlan reports a template room drawn over the bathroom', () => {
    const template = { rooms: [room('kitchen', 2, 1, 3, 2)], openings: [] }

    expect(validatePlan(B58, template)).toEqual([{ code: 'room-overlap', ids: [FIXED_BATHROOM_ID, 'kitchen'] }])
    expect(validatePlan(B58, { rooms: [room('kitchen', 0, 3, 3, 2)], openings: [] })).toEqual([])
  })
})

describe('normalizePlan on stored data', () => {
  it('clamps rooms into the footprint and regenerates outer and room-edge walls', () => {
    const plan = normalizePlan(C6, { rooms: [room('r1', 5, 2, 3, 3)], walls: [] })

    expect(plan.rooms[0]).toMatchObject({ x: 5, y: 2, w: 1, h: 1 })
    expect(plan.walls.filter((w) => w.kind === 'outer').map((w) => w.id)).toEqual([
      'outer_top',
      'outer_right',
      'outer_bottom',
      'outer_left',
    ])
    expect(plan.walls.filter((w) => w.kind === 'roomEdge').map((w) => w.id)).toEqual([
      're_r1_top',
      're_r1_right',
      're_r1_bottom',
      're_r1_left',
    ])
  })

  it('upgrades the old outer-wall host of a door to a wall host', () => {
    const plan = normalizePlan(C6, {
      rooms: [],
      openings: [{ id: 'd1', kind: 'door', host: { type: 'outer', wall: 'top', atM: 2 } }],
    })

    expect(plan.openings[0].host).toEqual({ type: 'wall', wallId: 'outer_top', at: 2 })
  })

  it('drops a window on an inside wall, and any opening on a wall that does not exist', () => {
    const plan = normalizePlan(C6, {
      rooms: [room('r1', 0, 0, 3, 3)],
      openings: [
        { id: 'w-in', kind: 'window', host: { type: 'wall', wallId: 're_r1_right', at: 1 } },
        { id: 'd-gone', kind: 'door', host: { type: 'wall', wallId: 're_nope_top', at: 1 } },
        { id: 'w-out', kind: 'window', host: { type: 'wall', wallId: 'outer_top', at: 4 } },
        { id: 'd-in', kind: 'door', host: { type: 'wall', wallId: 're_r1_right', at: 1 } },
      ],
    })

    expect(plan.openings.map((o) => o.id)).toEqual(['w-out', 'd-in'])
  })

  it('pushes two doors apart along one wall, and drops one that no longer fits', () => {
    const plan = normalizePlan(C6, {
      rooms: [],
      openings: [
        { id: 'a', kind: 'door', host: { type: 'wall', wallId: 'outer_left', at: 1.5 } },
        { id: 'b', kind: 'door', host: { type: 'wall', wallId: 'outer_left', at: 1.5 } },
        { id: 'c', kind: 'door', host: { type: 'wall', wallId: 'outer_left', at: 1.5 } },
        { id: 'd', kind: 'door', host: { type: 'wall', wallId: 'outer_left', at: 1.5 } },
      ],
    })
    // 3 m of wall holds three 0.9 m doors side by side, not four.
    const ats = plan.openings.map((o) => o.host.at)

    expect(plan.openings.map((o) => o.id)).toEqual(['a', 'b', 'c'])
    expect(ats[0]).toBeCloseTo(1.5)
    for (let i = 0; i < ats.length; i++) {
      for (let j = i + 1; j < ats.length; j++) expect(Math.abs(ats[i] - ats[j])).toBeGreaterThanOrEqual(0.9 - 1e-9)
    }
  })

  it('keeps an opening inside its wall', () => {
    const plan = normalizePlan(C6, { openings: [{ id: 'd', kind: 'door', host: { type: 'wall', wallId: 'outer_top', at: 99 } }] })
    const { a, b } = resolveOpening(C6, plan, plan.openings[0])

    expect(plan.openings[0].host.at).toBeCloseTo(6 - 0.45)
    expect(Math.max(a.x, b.x)).toBeLessThanOrEqual(6 + 1e-9)
  })

  it('is stable: normalizing twice changes nothing', () => {
    const once = normalizePlan(B58, { rooms: [room('r1', 0, 3, 3, 2)], openings: [] })
    expect(normalizePlan(B58, once)).toEqual(once)
  })

  it('room names that are only some locale’s default go back to null', () => {
    const plan = withResolvedRoomNames({
      rooms: [room('a', 0, 0, 1, 1, { type: 'bed', label: 'Спалня' }), room('b', 1, 0, 1, 1, { label: 'Our den' })],
    })
    expect(plan.rooms.map((r) => r.label)).toEqual([null, 'Our den'])
  })
})

describe('doors and windows stay on walls', () => {
  it('a window needs an outer wall; a click by an inside wall places nothing', () => {
    const plan = normalizePlan(C6, { rooms: [room('r1', 0, 0, 3, 3)] })

    expect(placeOpening(C6, plan, 'window', { x: 3.05, y: 1.5 })).toBeNull()
    expect(placeOpening(C6, plan, 'door', { x: 3.05, y: 1.5 }, 'd1')).toMatchObject({
      id: 'd1',
      kind: 'door',
      host: { type: 'wall', wallId: 're_r1_right' },
    })
  })

  it('a click on a room edge that lies on the footprint goes onto the outer wall', () => {
    const plan = normalizePlan(C6, { rooms: [room('r1', 0, 0, 3, 3)] })
    const w = placeOpening(C6, plan, 'window', { x: 1.5, y: 0.1 })

    expect(w.host.wallId).toBe('outer_top')
    expect(w.host.at).toBeCloseTo(1.5)
    expect(w).toMatchObject({ widthM: 0.96, heightM: 1.8 })
  })

  it('a door swings towards the side that was clicked', () => {
    const plan = normalizePlan(C6, {})
    // outer_top's normal points into the building (+y).
    expect(placeOpening(C6, plan, 'door', { x: 2, y: 0.1 }).openTo).toBe('pos')
    expect(placeOpening(C6, plan, 'door', { x: 2, y: -0.1 }).openTo).toBe('neg')
  })

  it('a dragged window slides along outer walls only and keeps clear of other openings', () => {
    const plan = normalizePlan(C6, {
      openings: [
        { id: 'w1', kind: 'window', widthM: 0.96, host: { type: 'wall', wallId: 'outer_top', at: 1 } },
        { id: 'd1', kind: 'door', widthM: 0.9, host: { type: 'wall', wallId: 'outer_top', at: 3 } },
      ],
    })
    const w1 = plan.openings[0]

    const onDoor = moveOpeningTo(C6, plan, w1, { x: 3, y: 0.05 }, { gridM: 0.1, snapGrid: true })
    expect(onDoor.wallId).toBe('outer_top')
    expect(Math.abs(onDoor.at - 3)).toBeGreaterThanOrEqual((0.96 + 0.9) / 2 - 1e-9)

    expect(moveOpeningTo(C6, plan, w1, { x: 3, y: 1.5 }, { gridM: 0.1, snapGrid: true })).toBeNull()
    expect(moveOpeningTo(C6, plan, w1, { x: 5.95, y: 1.53 }, { gridM: 0.1, snapGrid: true })).toEqual({ wallId: 'outer_right', at: 1.5 })
  })
})

describe('snapping and resizing', () => {
  it('a room moved near a wall snaps onto it, and never leaves the footprint', () => {
    const plan = normalizePlan(C6, {})

    const nearCorner = snapRoomPosition(C6, plan, 'r', 0.08, 0.95, 2, 2, 0.1)
    expect(nearCorner.x).toBe(0)
    expect(nearCorner.y).toBeCloseTo(1, 9)
    expect(snapRoomPosition(C6, plan, 'r', 0.5, 0.5, 2, 2, 0.1)).toEqual({ x: 0.5, y: 0.5 })
    expect(snapRoomPosition(C6, plan, 'r', 5, 0, 2, 2, 0.1)).toEqual({ x: 4, y: 0 })
  })

  it('a resize keeps the 0.6 m minimum and stays inside the model', () => {
    const plan = normalizePlan(C6, { rooms: [room('r1', 1, 1, 2, 1.5)] })
    const r0 = { x: 1, y: 1, w: 2, h: 1.5 }
    const opts = { gridM: 0.1, snapGrid: true, snapAlign: false }

    expect(resizeRoomRect(C6, plan, 'r1', r0, 'w', 5, 0, opts)).toEqual({ x: 2.4, y: 1, w: 0.6000000000000001, h: 1.5 })
    expect(resizeRoomRect(C6, plan, 'r1', r0, 'se', 10, 10, opts)).toEqual({ x: 1, y: 1, w: 5, h: 2 })
  })
})

describe('layouts, templates and the summary', () => {
  it('parseLayout reads a saved file, a bare plan, and refuses anything else', () => {
    const plan = { rooms: [], walls: [], openings: [] }

    expect(parseLayout({ kind: 'floorplanner-layout', modelKey: 'b73', plan }, MODELS, 'c6x3')).toEqual({ modelKey: 'b73', plan })
    expect(parseLayout({ modelKey: 'nope', plan }, MODELS, 'c6x3')).toEqual({ modelKey: 'c6x3', plan })
    expect(parseLayout(plan, MODELS, 'b57')).toEqual({ modelKey: 'b57', plan })
    expect(parseLayout({ hello: 1 }, MODELS, 'b57')).toBeNull()
  })

  it('planSummary gives the footprint and each room’s area in m²', () => {
    const plan = normalizePlan(B58, { rooms: [room('r1', 0, 3, 3, 2.5)] })

    expect(planSummary(B58, plan)).toEqual({
      modelKey: 'b57',
      widthM: 6.26,
      depthM: 9,
      footprintM2: 56.34,
      rooms: [
        { id: FIXED_BATHROOM_ID, type: 'bath', label: null, locked: true, areaM2: 3.17, parts: [FIXED_BATHROOM_ID], kitchen: false },
        { id: 'r1', type: 'living', label: null, locked: false, areaM2: 7.5, parts: ['r1'], kitchen: false },
      ],
      totalRoomsM2: 10.67,
      bedrooms: 0,
      doors: 2,
      windows: 0,
    })
  })
})

describe('view box', () => {
  it('zooming keeps the point under the cursor where it was', () => {
    const vb = defaultViewBox(C6)
    const anchor = { x: 1.3, y: 0.7 }
    const next = zoomViewBox(vb, C6, anchor, 0.89)

    expect((anchor.x - next.x) / next.w).toBeCloseTo((anchor.x - vb.x) / vb.w, 9)
    expect(next.w).toBeCloseTo(vb.w * 0.89, 9)
  })

  it('cannot zoom in past 0.15× the model', () => {
    let vb = defaultViewBox(C6)
    for (let i = 0; i < 80; i++) vb = zoomViewBox(vb, C6, { x: 3, y: 1.5 }, 0.5)
    expect(vb.w).toBeCloseTo(6 * 0.15)
  })
})

// ---------------------------------------------------------------------------------
// The redesign: catalogue models, open spaces, refusals with a reason, migration of
// stored plans onto the new footprints, share links.
// ---------------------------------------------------------------------------------

describe('the models are the catalogue’s', () => {
  it('each Box house has the brochure’s open size: width across the unfold, depth along the length', () => {
    const catalogue = getBoxConfiguratorCatalog('en').models
    for (const [key, cat] of [['b37', '37'], ['b57', '58'], ['b73', '73']]) {
      const [lengthMm, widthMm] = catalogue.find((m) => m.key === cat).dimensionsOpen.split('x').map(Number)
      expect(model(key)).toMatchObject({ kind: 'box', widthM: widthMm / 1000, depthM: lengthMm / 1000 })
    }
  })

  it('the entrance is the drawing’s double door, centred on the core and opening out', () => {
    const front = makeDefaultPlan(B58).openings.find((o) => o.id === 'entrance_front_fixed')
    expect(front).toMatchObject({ widthM: 1.2, leaves: 2, openTo: 'neg', host: { wallId: 'outer_bottom', at: 3.13 } })
  })

  it('knows the catalogue’s hall as a room type', () => {
    expect(withResolvedRoomNames({ rooms: [room('h', 0, 0, 1, 1, { type: 'corridor', label: 'Коридор' })] }).rooms[0].label).toBeNull()
  })
})

describe('open spaces: rectangles of one room', () => {
  const b2 = normalizePlan(B58, templateToPlan(getTemplate('B2')))

  it('are one room in the summary, with the summed area and the kitchen named', () => {
    const summary = planSummary(B58, b2)
    const day = summary.rooms.find((r) => r.parts.length > 1)
    expect(day).toMatchObject({ type: 'living', kitchen: true, parts: ['b2_living', 'b2_living_core'] })
    const parts = b2.rooms.filter((r) => day.parts.includes(r.id))
    expect(day.areaM2).toBeCloseTo(parts.reduce((sum, r) => sum + r.w * r.h, 0), 2)
    expect(summary.bedrooms).toBe(2)
    expect(roomGroups(b2.rooms)).toHaveLength(4) // bathroom, the day space, two bedrooms
  })

  it('draw no wall where their rectangles meet, and every other wall as before', () => {
    const segs = visibleWallSegments(b2)
    const onLine = (seg) => Math.abs(seg.a.x - 2.46) < 1e-6 && Math.abs(seg.b.x - 2.46) < 1e-6
    // Between the left wing and the core, below the bathroom: open.
    expect(segs.some((seg) => onLine(seg) && Math.min(seg.a.y, seg.b.y) >= 2.4 - 1e-6)).toBe(false)
    // The bathroom's own left wall is still drawn.
    expect(segs.some((seg) => onLine(seg) && Math.max(seg.a.y, seg.b.y) <= 2.4 + 1e-6)).toBe(true)
    // A plan with no spaces is untouched.
    const plain = normalizePlan(C6, { rooms: [room('a', 0, 0, 3, 3), room('b', 3, 0, 3, 3)] })
    expect(visibleWallSegments(plain)).toEqual(visibleWallSegments({ ...plain }))
  })
})

describe('a door or window that cannot be placed says why', () => {
  const plan = normalizePlan(C6, { rooms: [room('r1', 0, 0, 3, 3)] })

  it('a window by an inside wall', () => {
    expect(placeOpeningResult(C6, plan, 'window', { x: 3.05, y: 1.5 })).toEqual({ reason: 'window-interior' })
  })

  it('a click far from any wall', () => {
    expect(placeOpeningResult(C6, plan, 'door', { x: 4.5, y: 1.5 })).toEqual({ reason: 'no-wall' })
  })

  it('a wall with no room left', () => {
    const tiny = normalizePlan(C6, { rooms: [room('t', 0, 1, 0.6, 0.6)] })
    const first = placeOpeningResult(C6, tiny, 'door', { x: 0.62, y: 1.3 })
    expect(first.opening).toBeTruthy()
    const full = normalizePlan(C6, { ...tiny, openings: [...tiny.openings, first.opening] })
    expect(placeOpeningResult(C6, full, 'door', { x: 0.62, y: 1.3 }).reason).toBe('wall-full')
  })

  it('places as before when it can', () => {
    expect(placeOpeningResult(C6, plan, 'window', { x: 1.5, y: 0.05 }).opening).toMatchObject({ kind: 'window', host: { wallId: 'outer_top' } })
  })
})

describe('plans saved on the old footprints', () => {
  // A 58 m² plan as the planner stored it before the catalogue sizes: 6.41 m wide,
  // the bathroom 1.54 × 3 m and centred (2.435–3.975), no footprint stamp.
  const OLD = {
    rooms: [
      { id: 'bathroom_fixed', type: 'bath', label: null, x: 2.435, y: 0, w: 1.54, h: 3, finish: 'tile', locked: true },
      room('left', 0, 0, 2.435, 5),
      room('right', 3.975, 0, 2.435, 4), // ran to the old right wall, 6.41
      room('under', 2.435, 3, 1.54, 2), // under the old bathroom: clear of the new one too
      room('gone', 6.3, 6, 0.11, 2), // past the new right wall entirely
    ],
    walls: [],
    openings: [{ id: 'win', kind: 'window', host: { type: 'wall', wallId: 'outer_right', at: 6 } }],
  }

  it('keeps what fits, clips what runs past the new walls, drops what cannot fit', () => {
    expect(LEGACY_FOOTPRINTS.b57.widthM).toBeGreaterThan(B58.widthM)
    const { plan, clipped, dropped } = migratePlan(B58, OLD)
    const byId = Object.fromEntries(plan.rooms.map((r) => [r.id, r]))

    expect(plan.rooms.map((r) => r.id)).toEqual([FIXED_BATHROOM_ID, 'left', 'right', 'under'])
    expect(byId.right.x + byId.right.w).toBeCloseTo(6.26, 6)
    expect(clipped).toBe(1)
    expect(dropped).toBe(1)
    expect(validatePlan(B58, { ...plan, rooms: plan.rooms.filter((r) => !r.locked) })).toEqual([])
    expect(plan.openings.map((o) => o.id)).toContain('win')
  })

  it('trims a room the new bathroom now overlaps instead of losing it', () => {
    const { plan, clipped } = migratePlan(B58, { rooms: [room('core', 2.5, 2, 1, 3)] })
    expect(plan.rooms.find((r) => r.id === 'core')).toMatchObject({ y: 2.4, h: 2.6 })
    expect(clipped).toBe(1)
  })

  it('never throws on damaged data', () => {
    const junk = [
      null,
      'x',
      42,
      [],
      { rooms: 'no' },
      { rooms: [null, { id: 'n', x: 'a', y: 1, w: 2, h: 2 }, { x: 1, y: 3, w: 2, h: 2 }] },
      { openings: [{ kind: 'door' }, 7, { kind: 'window', host: { type: 'wall', wallId: 'outer_top', at: 'q' } }] },
    ]
    for (const plan of junk) expect(() => migratePlan(B58, plan)).not.toThrow()
    expect(migratePlan(B58, junk[5]).plan.rooms.filter((r) => !r.locked)).toHaveLength(1)
    expect(migrateStoredPlans('nonsense', MODELS)).toEqual({ plans: {}, notices: [] })
    const read = migrateStoredPlans({ b57: 'x', nope: {} }, MODELS)
    expect(Object.keys(read.plans)).toEqual(['b57'])
  })

  it('tells the visitor once: a plan stored with its footprint raises no notice', () => {
    const first = migrateStoredPlans({ b57: OLD, c6x3: { rooms: [room('a', 0, 0, 2, 2)] } }, MODELS)
    expect(first.notices).toEqual([{ modelKey: 'b57', clipped: 1, dropped: 1 }])

    const stored = Object.fromEntries(Object.entries(first.plans).map(([k, p]) => [k, stampFootprint(model(k), p)]))
    expect(migrateStoredPlans(stored, MODELS).notices).toEqual([])
  })
})

describe('share links', () => {
  it('a plan survives the #plan= round trip, without its fixed parts', () => {
    const plan = normalizePlan(B58, templateToPlan(getTemplate('B3')))
    const hash = '#plan=' + encodePlanShare({ modelKey: 'b57', plan, template: 'B3', terrace: 'extended' })
    const back = decodePlanShare(hash)

    expect(back).toMatchObject({ modelKey: 'b57', template: 'B3', terrace: 'extended' })
    const again = normalizePlan(B58, back.plan)
    // Millimetre precision: the same rooms, areas and openings, give or take float noise.
    expect(planSummary(B58, again)).toEqual(planSummary(B58, plan))
    const key = (p) => p.openings.map((o) => [o.id, o.kind, o.host.wallId, Math.round(o.host.at * 1000), o.code || null])
    expect(key(again)).toEqual(key(plan))
    expect(decodePlanShare('#cfg=abc')).toBeNull()
    expect(decodePlanShare('#plan=garbage')).toBeNull()
  })
})

it('the whole-plan view includes the terrace', () => {
  const deck = terraceOptionsFor('b57').find((o) => o.key === 'standard').rect
  const vb = fitViewBox(B58, [deck])
  expect(vb.y + vb.h).toBeGreaterThan(deck.y + deck.h)
  expect(vb.x).toBeLessThan(0)
})
