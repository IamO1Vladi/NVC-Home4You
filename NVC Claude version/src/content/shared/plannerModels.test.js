import { describe, it, expect } from 'vitest'
import { getBoxConfiguratorCatalog } from './boxConfiguratorCatalog.js'
import {
  PLANNER_MODELS,
  PLAN_TEMPLATES,
  SHELL_DRAWINGS,
  BATH_LEFT_MM,
  BATH_RIGHT_MM,
  getPlannerModel,
  templatesForModel,
  templateToPlan,
  templateInfo,
  bedroomCount,
  windowsFor,
  terraceOptionsFor,
  houseVariantPrices,
  templateDisplayName,
} from './plannerModels.js'
import { normalizePlan, validatePlan, FIXED_BATHROOM_ID } from '../../lib/floorPlan.js'

const catalogue = getBoxConfiguratorCatalog('en')
const boxTemplates = PLAN_TEMPLATES.filter((t) => getPlannerModel(t.model)?.kind === 'box')

// The bathroom as a template room, in millimetres, so the geometry checks below can
// treat it like any other rectangle of the plan.
function bathMm(model) {
  return {
    id: 'bath',
    type: 'bath',
    x: Math.round(model.bathroom.x * 1000),
    y: 0,
    w: Math.round(model.bathroom.w * 1000),
    h: Math.round(model.bathroom.h * 1000),
  }
}

function allRoomsMm(t) {
  const model = getPlannerModel(t.model)
  return model.kind === 'box' ? [bathMm(model), ...t.rooms] : t.rooms
}

const overlaps = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)

describe('planner models', () => {
  it('keeps every planner key, so saved plans still load', () => {
    expect(PLANNER_MODELS.map((m) => m.key)).toEqual(['c6x3', 'c7x3', 'c8x3', 'b37', 'b57', 'b73'])
  })

  it('reads the Box footprints from the catalogue, the 6260 side across', () => {
    for (const [key, cat] of [['b37', '37'], ['b57', '58'], ['b73', '73']]) {
      const model = getPlannerModel(key)
      const [length, width] = catalogue.models.find((m) => m.key === cat).dimensionsOpen.split('x').map(Number)
      expect(model.widthM).toBe(width / 1000)
      expect(model.depthM).toBe(length / 1000)
      expect(model.catalogueKey).toBe(cat)
    }
    expect(getPlannerModel('b37')).toMatchObject({ widthM: 6.26, depthM: 5.9 })
    expect(getPlannerModel('b57')).toMatchObject({ widthM: 6.26, depthM: 9 })
    expect(getPlannerModel('b73')).toMatchObject({ widthM: 6.26, depthM: 11.8 })
  })

  it('puts the bathroom against the back wall, inside the core module, as the drawings do', () => {
    for (const key of ['b37', 'b57', 'b73']) {
      const { bathroom } = getPlannerModel(key)
      expect(bathroom.y).toBe(0)
      expect(bathroom.x).toBeGreaterThanOrEqual(2.03)
      expect(bathroom.x + bathroom.w).toBeLessThanOrEqual(4.23)
      // 1250 mm clear plus its walls
      expect(bathroom.w).toBeGreaterThan(1.25)
      expect(bathroom.w).toBeLessThan(1.4)
    }
    expect(getPlannerModel('b37').bathroom.h).toBe(2.4)
    expect(getPlannerModel('b57').bathroom.h).toBe(2.4)
    expect(getPlannerModel('b73').bathroom.h).toBe(3.1)
  })

  it('gives src/lib/floorPlan.js a bathroom it places exactly there', () => {
    for (const key of ['b37', 'b57', 'b73']) {
      const model = getPlannerModel(key)
      const plan = normalizePlan(model, { rooms: [], walls: [], openings: [] })
      const bath = plan.rooms.find((r) => r.id === FIXED_BATHROOM_ID)
      expect(bath).toMatchObject(model.bathroom)
      const front = plan.openings.find((o) => o.id === 'entrance_front_fixed')
      expect(front.host).toMatchObject({ wallId: 'outer_bottom', at: 3.13 })
      expect(front.widthM).toBe(1.2)
      const bathDoor = plan.openings.find((o) => o.id === 'entrance_fixed')
      expect(bathDoor.host.wallId).toBe(`re_${FIXED_BATHROOM_ID}_bottom`)
    }
  })
})

describe('plan templates', () => {
  it('has the 18 catalogue layouts on their models, and one shell per container', () => {
    expect(templatesForModel('b37').map((t) => t.key)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'])
    expect(templatesForModel('b57').map((t) => t.key)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6'])
    expect(templatesForModel('b73').map((t) => t.key)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
    for (const key of ['c6x3', 'c7x3', 'c8x3']) expect(templatesForModel(key)).toHaveLength(1)
    // every catalogue plan has a template
    expect(catalogue.planOptions.map((p) => p.key).sort()).toEqual(boxTemplates.map((t) => t.key).sort())
  })

  it.each(PLAN_TEMPLATES.map((t) => [t.key, t]))('%s fills its footprint exactly, with no overlaps', (_key, t) => {
    const model = getPlannerModel(t.model)
    const rooms = allRoomsMm(t)
    const W = Math.round(model.widthM * 1000)
    const D = Math.round(model.depthM * 1000)
    for (const r of rooms) {
      expect(r.w).toBeGreaterThanOrEqual(600)
      expect(r.h).toBeGreaterThanOrEqual(600)
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(W)
      expect(r.y + r.h).toBeLessThanOrEqual(D)
    }
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        expect(overlaps(rooms[i], rooms[j]), `${rooms[i].id} / ${rooms[j].id}`).toBe(false)
      }
    }
    const sum = rooms.reduce((s, r) => s + r.w * r.h, 0)
    expect(sum).toBe(W * D)
  })

  it.each(boxTemplates.map((t) => [t.key, t]))('%s loads into the planner exactly as written', (_key, t) => {
    const model = getPlannerModel(t.model)
    const plan = templateToPlan(t)
    expect(validatePlan(model, plan)).toEqual([])
    const norm = normalizePlan(model, plan)
    // the template's own doors and windows all survive, plus the two locked doors
    expect(norm.openings).toHaveLength(plan.openings.length + 2)
    expect(norm.rooms.find((r) => r.id === FIXED_BATHROOM_ID)).toMatchObject(model.bathroom)
  })

  it.each(boxTemplates.map((t) => [t.key, t]))('%s: every interior door opens off a room, never off the bathroom', (_key, t) => {
    const rooms = allRoomsMm(t)
    const at = (x, y) => rooms.find((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h)
    for (const d of t.doors) {
      const r = t.rooms.find((x) => x.id === d.room)
      const half = (d.w ?? 800) / 2
      // the door lies wholly along its side
      const [from, to] = d.side === 'left' || d.side === 'right' ? [r.y, r.y + r.h] : [r.x, r.x + r.w]
      expect(d.pos - half).toBeGreaterThanOrEqual(from)
      expect(d.pos + half).toBeLessThanOrEqual(to)
      // and both of its ends open onto a room that is not the bathroom
      for (const p of [d.pos - half + 10, d.pos + half - 10]) {
        const out = { left: [r.x - 10, p], right: [r.x + r.w + 10, p], top: [p, r.y - 10], bottom: [p, r.y + r.h + 10] }[d.side]
        const other = at(...out)
        expect(other, `${d.room} door`).toBeTruthy()
        expect(other.type).not.toBe('bath')
        expect(other.type).not.toBe('bed')
      }
    }
  })

  it.each(boxTemplates.map((t) => [t.key, t]))('%s has a door into every bedroom and the bedroom count of its catalogue line', (_key, t) => {
    const beds = t.rooms.filter((r) => r.type === 'bed')
    for (const b of beds) expect(t.doors.some((d) => d.room === b.id), b.id).toBe(true)
    const subtitle = catalogue.planOptions.find((p) => p.key === t.key).subtitle
    const n = Number((subtitle.match(/(\d+) bedroom/) || [])[1])
    expect(bedroomCount(t)).toBe(n)
  })

  it('keeps the drawings themselves: A3, B2 and C3 are pages 6, 14 and 20', () => {
    const cuts = (t) => t.rooms.filter((r) => r.x === BATH_RIGHT_MM && r.y > 0).map((r) => r.y)
    expect(cuts(PLAN_TEMPLATES.find((t) => t.key === 'A3'))).toEqual(SHELL_DRAWINGS.b37.chain)
    expect(cuts(PLAN_TEMPLATES.find((t) => t.key === 'B2'))).toEqual(SHELL_DRAWINGS.b57.chain)
    expect(cuts(PLAN_TEMPLATES.find((t) => t.key === 'C3'))).toEqual(SHELL_DRAWINGS.b73.chain)
    expect(PLAN_TEMPLATES.find((t) => t.key === 'A3').doors.map((d) => d.pos)).toEqual(SHELL_DRAWINGS.b37.bedroomDoors)
    expect(PLAN_TEMPLATES.find((t) => t.key === 'B2').doors.map((d) => d.pos)).toEqual(SHELL_DRAWINGS.b57.bedroomDoors)
    expect(PLAN_TEMPLATES.find((t) => t.key === 'C3').doors.map((d) => d.pos)).toEqual(SHELL_DRAWINGS.b73.bedroomDoors)
  })

  it('puts left-hand rooms against the bathroom wall and right-hand rooms against its partition', () => {
    for (const t of boxTemplates) {
      for (const r of t.rooms) {
        const edges = [r.x, r.x + r.w]
        for (const e of edges) expect([0, BATH_LEFT_MM, BATH_RIGHT_MM, 6260]).toContain(e)
      }
    }
  })

  it('has plausible room areas', () => {
    for (const t of boxTemplates) {
      for (const r of t.rooms.filter((x) => x.type === 'bed')) {
        const m2 = (r.w * r.h) / 1e6
        expect(m2, `${t.key} ${r.id}`).toBeGreaterThan(5.5)
        expect(m2, `${t.key} ${r.id}`).toBeLessThan(15)
      }
    }
  })
})

describe('windows', () => {
  it('keeps the drawing windows where the drawing is the layout', () => {
    expect(windowsFor('b37', PLAN_TEMPLATES.find((t) => t.key === 'A3').rooms).map((w) => [w.side, w.pos])).toEqual([
      ['back', 3380], ['front', 1120], ['front', 5160], ['left', 1520], ['left', 4220], ['right', 1520], ['right', 4220],
    ])
  })

  it('gives every bedroom a window, and none to the hall', () => {
    for (const t of boxTemplates) {
      const wins = windowsFor(t.model, t.rooms)
      for (const r of t.rooms.filter((x) => x.type === 'bed')) {
        const has = wins.some((w) =>
          (w.side === 'left' && r.x === 0 && w.pos > r.y && w.pos < r.y + r.h)
          || (w.side === 'right' && r.x + r.w === 6260 && w.pos > r.y && w.pos < r.y + r.h)
          || (w.side === 'front' && r.y + r.h === getPlannerModel(t.model).lengthMm && w.pos > r.x && w.pos < r.x + r.w))
        expect(has, `${t.key} ${r.id}`).toBe(true)
      }
    }
  })
})

describe('template cards', () => {
  it('takes the catalogue line and render for a Box layout, in the visitor language', () => {
    const t = PLAN_TEMPLATES.find((x) => x.key === 'B3')
    expect(templateInfo(t, 'bg')).toMatchObject({ key: 'B3', bedrooms: 3, page: 12, image: 'box-config/plan-B3.webp', areaM2: 58 })
    expect(templateInfo(t, 'bg').summary).toBe(getBoxConfiguratorCatalog('bg').planOptions.find((p) => p.key === 'B3').subtitle)
    expect(templateInfo(t, 'el').summary).toBe(getBoxConfiguratorCatalog('el').planOptions.find((p) => p.key === 'B3').subtitle)
  })

  it('has a line in all three languages for the container shells', () => {
    for (const t of PLAN_TEMPLATES.filter((x) => x.model.startsWith('c'))) {
      for (const locale of ['bg', 'en', 'el']) expect(templateInfo(t, locale).summary).toBeTruthy()
      expect(templateInfo(t, 'en').image).toBeNull()
    }
  })

  it('never calls a container empty: every unit comes with a bathroom', () => {
    const shell = PLAN_TEMPLATES.find((x) => x.key === 'c6x3-shell')
    expect(templateInfo(shell, 'en').summary).toBe('Shell with a bathroom: place it yourself')
    expect(templateInfo(shell, 'bg').summary).not.toMatch(/празен/i)
    expect(templateInfo(shell, 'el').summary).not.toMatch(/άδεια/i)
  })

  it('names a template for the screen: a catalogue key, or a shell by its size', () => {
    expect(templateDisplayName('B3', 'bg')).toEqual({ name: 'B3', catalogue: true })
    expect(templateDisplayName(PLAN_TEMPLATES.find((x) => x.key === 'A1'), 'en')).toEqual({ name: 'A1', catalogue: true })
    expect(templateDisplayName('c6x3-shell', 'bg')).toEqual({ name: 'Корпус 6\u00a0×\u00a03\u00a0м', catalogue: false })
    expect(templateDisplayName('c8x3-shell', 'en')).toEqual({ name: 'Shell 8\u00a0×\u00a03\u00a0m', catalogue: false })
    expect(templateDisplayName('c7x3-shell', 'el').name).toBe('Κέλυφος 7\u00a0×\u00a03\u00a0m')
  })
})

describe('terraces and the roof-and-veranda house', () => {
  it('offers each model the catalogue terraces it can have, priced by the catalogue', () => {
    const rows = getBoxConfiguratorCatalog('en').terraceOptions
    expect(terraceOptionsFor('b37').map((o) => o.key)).toEqual(['standard', 'extended'])
    expect(terraceOptionsFor('b57').map((o) => o.key)).toEqual(['standard', 'extended', 'long-58'])
    expect(terraceOptionsFor('b73').map((o) => o.key)).toEqual(['standard', 'extended', 'long-73'])
    for (const o of terraceOptionsFor('b73')) expect(o.price).toBe(rows.find((r) => r.key === o.key).price)
    expect(terraceOptionsFor('c6x3')).toEqual([])
  })

  it('places the standard deck on the front, 2 m deep from the wings', () => {
    const [std] = terraceOptionsFor('b57')
    expect(std).toMatchObject({ key: 'standard', included: true, side: 'front', lengthMm: 6230, depthMm: 2000 })
    expect(std.rect).toEqual({ x: 0.015, y: 8.78, w: 6.23, h: 2 })
    const long = terraceOptionsFor('b73').find((o) => o.key === 'long-73')
    expect(long).toMatchObject({ side: 'right', lengthMm: 11800, depthMm: 2000 })
    expect(long.rect).toEqual({ x: 6.26, y: 0, w: 2, h: 11.8 })
  })

  it('reads both house prices from the catalogue', () => {
    for (const [key, cat] of [['b37', '37'], ['b57', '58'], ['b73', '73']]) {
      const m = catalogue.models.find((x) => x.key === cat)
      expect(houseVariantPrices(key)).toEqual({ standard: m.basePrice, roofAndVeranda: m.balconyPrice })
    }
    expect(houseVariantPrices('c8x3')).toBeNull()
  })
})
