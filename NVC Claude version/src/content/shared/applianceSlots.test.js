import { describe, it, expect } from 'vitest'
import { APPLIANCE_SLOTS } from './boxConfiguratorApplianceSlots.js'
import { getBoxConfiguratorCatalog } from './boxConfiguratorCatalog.js'

// Slot coordinates are hand-placed against the renders and nothing at runtime
// can notice one drifting off the worktop — so the SHAPE of the data is pinned
// here instead: every plan covered, every coordinate on the image, every
// kitchen run big enough for the rules the planner enforces.

const ALL_PLANS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
]

const onImage = (point) => point
  && Number.isFinite(point.x) && Number.isFinite(point.y)
  && point.x > 0 && point.x < 100 && point.y > 0 && point.y < 100

describe('APPLIANCE_SLOTS', () => {
  it('covers every buyer-selectable plan', () => {
    expect(Object.keys(APPLIANCE_SLOTS).sort()).toEqual([...ALL_PLANS].sort())
  })

  it.each(ALL_PLANS)('%s: coordinates sit inside the image and the run is usable', (key) => {
    const entry = APPLIANCE_SLOTS[key]
    expect(entry).toBeTruthy()
    expect(Array.isArray(entry.run)).toBe(true)
    entry.run.forEach((point) => expect(onImage(point)).toBe(true))
    // The bathroom is an option, not a placement — no coordinates stored.
    expect(entry.bath).toBeUndefined()

    if (entry.run.length > 0) {
      // 4-6 positions per the scope; at least 2 so the dishwasher's
      // sink-adjacency rule is satisfiable at all.
      expect(entry.run.length).toBeGreaterThanOrEqual(4)
      expect(entry.run.length).toBeLessThanOrEqual(6)
      expect(entry.sinkIndex).toBeGreaterThanOrEqual(0)
      expect(entry.sinkIndex).toBeLessThan(entry.run.length)
    } else {
      expect(entry.sinkIndex).toBe(-1)
    }

    // No two slots may collapse onto the same spot — each is one 60 cm module.
    for (let i = 0; i < entry.run.length; i += 1) {
      for (let j = i + 1; j < entry.run.length; j += 1) {
        const distance = Math.hypot(entry.run[i].x - entry.run[j].x, entry.run[i].y - entry.run[j].y)
        expect(distance).toBeGreaterThan(1)
      }
    }
  })
})

describe('catalog appliance wiring', () => {
  const catalog = getBoxConfiguratorCatalog('bg')

  it('hands every plan its slot table', () => {
    catalog.planOptions.forEach((plan) => {
      expect(plan.applianceSlots).toBe(APPLIANCE_SLOTS[plan.key])
    })
  })

  it('offers the seven placeables with the sink as the one required type', () => {
    const keys = catalog.applianceOptions.map((item) => item.key)
    expect(keys).toEqual(['sink', 'hob', 'oven', 'fridge', 'dishwasher-60', 'dishwasher-45', 'washer'])
    expect(catalog.applianceOptions.filter((item) => item.required).map((item) => item.key)).toEqual(['sink'])
  })

  it('models the two dishwasher sizes as one family, adjacent to the sink', () => {
    const dishwashers = catalog.applianceOptions.filter((item) => item.family === 'dishwasher')
    expect(dishwashers).toHaveLength(2)
    dishwashers.forEach((item) => expect(item.sinkAdjacent).toBe(true))
  })

  it('rides the hood on the hob and sends only the washer to the bathroom', () => {
    expect(catalog.applianceOptions.find((item) => item.key === 'hob')?.hood).toBe(true)
    expect(catalog.applianceOptions.filter((item) => item.allowBath).map((item) => item.key)).toEqual(['washer'])
  })

  it('pairs the hob and the oven as the one stackable column', () => {
    const stackers = catalog.applianceOptions.filter((item) => item.stacksWith)
    expect(stackers.map((item) => [item.key, item.stacksWith])).toEqual([
      ['hob', 'oven'],
      ['oven', 'hob'],
    ])
  })

  it('gives a blank window canvas only to the plans still drawn in the old artwork', () => {
    // A1–A3 got new renders on 2026-09-30, B and C on 2026-09-05. Their old blank canvases
    // show the OLD drawing, a different house from every other stage, and were deleted —
    // a plan that pointed at one would 404 its window stage.
    const canvases = Object.fromEntries(catalog.planOptions.map((plan) => [plan.key, plan.noWindowImage]))
    expect(Object.keys(canvases).filter((key) => canvases[key]).sort()).toEqual(['A4', 'A5', 'A6'])
    expect(canvases.A4).toBe('plan-A4-nowindows.webp')
  })

  it('the kitchen-extras section is gone entirely (owner, 2026-09-20)', () => {
    expect(catalog.kitchenExtraOptions).toBeUndefined()
  })

  it('uses the owner\'s Bulgarian label for the oven', () => {
    expect(catalog.applianceOptions.find((item) => item.key === 'oven')?.label).toBe('Вградена фурна')
  })
})
