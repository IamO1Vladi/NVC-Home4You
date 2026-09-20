import { describe, it, expect } from 'vitest'
import { SLOT_BATH, runSlotKey, eligibleSlots, reconcileAppliances } from './appliancePlanner.js'

// The real types from the catalog, reduced to the fields the planner reads.
const TYPES = [
  { key: 'sink', required: true },
  { key: 'hob', family: 'hob', stacksWith: 'oven' },
  { key: 'oven', family: 'oven', stacksWith: 'hob' },
  { key: 'fridge', family: 'fridge' },
  { key: 'dishwasher-60', family: 'dishwasher', sinkAdjacent: true },
  { key: 'dishwasher-45', family: 'dishwasher', sinkAdjacent: true },
  { key: 'washer', family: 'washer', allowBath: true },
]

// A five-slot run with the sink drawn at position 2 (index 1). The bathroom
// carries no coordinates: SLOT_BATH is an option, not a point on the plan.
const PLAN = {
  run: [
    { x: 10, y: 40 }, { x: 16, y: 40 }, { x: 22, y: 40 }, { x: 28, y: 40 }, { x: 34, y: 40 },
  ],
  sinkIndex: 1,
}

const NO_KITCHEN = { run: [], sinkIndex: -1 }

const app = (kind, slot) => ({ id: `app-${kind}`, kind, slot })

describe('reconcileAppliances', () => {
  it('seeds the mandatory sink into the slot the render draws it in', () => {
    const out = reconcileAppliances({ appliances: [], types: TYPES, planSlots: PLAN })
    expect(out).toEqual([app('sink', 'k2')])
  })

  it('does not seed a sink on a plan with no kitchen run', () => {
    const out = reconcileAppliances({ appliances: [], types: TYPES, planSlots: NO_KITCHEN })
    expect(out).toEqual([])
  })

  it('returns the input reference when nothing changes, so the page effect can no-op', () => {
    const placed = [app('sink', 'k2'), app('fridge', 'k1')]
    expect(reconcileAppliances({ appliances: placed, types: TYPES, planSlots: PLAN })).toBe(placed)
  })

  it('drops appliances whose slot does not exist on this plan, but re-seeds the sink', () => {
    const fromLongerRun = [app('sink', 'k6'), app('fridge', 'k5')]
    const out = reconcileAppliances({ appliances: fromLongerRun, types: TYPES, planSlots: PLAN })
    expect(out).toEqual([app('sink', 'k2'), app('fridge', 'k5')])
  })

  it('keeps only one of the two dishwasher sizes', () => {
    const both = [app('sink', 'k2'), app('dishwasher-60', 'k3'), app('dishwasher-45', 'k1')]
    const out = reconcileAppliances({ appliances: both, types: TYPES, planSlots: PLAN })
    expect(out.filter((a) => a.kind.startsWith('dishwasher'))).toEqual([app('dishwasher-60', 'k3')])
  })

  it('drops a dishwasher that is not directly beside the sink', () => {
    const stranded = [app('sink', 'k2'), app('dishwasher-45', 'k5')]
    const out = reconcileAppliances({ appliances: stranded, types: TYPES, planSlots: PLAN })
    expect(out).toEqual([app('sink', 'k2')])
  })

  it('accepts the washing machine in the bath slot and refuses anything else there', () => {
    const mixed = [app('sink', 'k2'), app('washer', SLOT_BATH), app('fridge', SLOT_BATH)]
    const out = reconcileAppliances({ appliances: mixed, types: TYPES, planSlots: PLAN })
    expect(out).toContainEqual(app('washer', SLOT_BATH))
    expect(out.some((a) => a.kind === 'fridge')).toBe(false)
  })

  it('keeps the bathroom washing machine even on a plan with no kitchen', () => {
    const only = [app('washer', SLOT_BATH)]
    expect(reconcileAppliances({ appliances: only, types: TYPES, planSlots: NO_KITCHEN })).toBe(only)
  })

  it('never puts two appliances in one slot — except the stack pair', () => {
    const clash = [app('sink', 'k2'), app('fridge', 'k4'), app('oven', 'k4')]
    const out = reconcileAppliances({ appliances: clash, types: TYPES, planSlots: PLAN })
    expect(out).toEqual([app('sink', 'k2'), app('fridge', 'k4')])
  })

  it('lets the hob and the oven share one slot — the stacked column', () => {
    const stacked = [app('sink', 'k2'), app('oven', 'k4'), app('hob', 'k4')]
    expect(reconcileAppliances({ appliances: stacked, types: TYPES, planSlots: PLAN })).toBe(stacked)
  })

  it('refuses a third occupant on the stacked column', () => {
    const crowded = [app('sink', 'k2'), app('oven', 'k4'), app('hob', 'k4'), app('fridge', 'k4')]
    const out = reconcileAppliances({ appliances: crowded, types: TYPES, planSlots: PLAN })
    expect(out.filter((a) => a.slot === 'k4').map((a) => a.kind)).toEqual(['oven', 'hob'])
  })

  it('is idempotent', () => {
    const messy = [app('dishwasher-45', 'k9'), app('washer', SLOT_BATH), app('oven', 'k2'), app('sink', 'k5')]
    const once = reconcileAppliances({ appliances: messy, types: TYPES, planSlots: PLAN })
    expect(reconcileAppliances({ appliances: once, types: TYPES, planSlots: PLAN })).toBe(once)
  })
})

describe('eligibleSlots', () => {
  const placed = [app('sink', 'k2'), app('fridge', 'k1')]

  it('offers free run slots only, for a run-only appliance', () => {
    const out = eligibleSlots({ kind: 'oven', types: TYPES, appliances: placed, planSlots: PLAN })
    expect(out).toEqual(['k3', 'k4', 'k5'])
  })

  it('limits the dishwashers to the slots either side of the sink', () => {
    const out = eligibleSlots({ kind: 'dishwasher-60', types: TYPES, appliances: placed, planSlots: PLAN })
    expect(out).toEqual(['k3'])
  })

  it('offers no dishwasher slot at all when there is no sink', () => {
    const out = eligibleSlots({ kind: 'dishwasher-45', types: TYPES, appliances: [], planSlots: PLAN })
    expect(out).toEqual([])
  })

  it('adds the bath slot for the washing machine', () => {
    const out = eligibleSlots({ kind: 'washer', types: TYPES, appliances: placed, planSlots: PLAN })
    expect(out).toEqual(['k3', 'k4', 'k5', SLOT_BATH])
  })

  it('lets an appliance move: its own current slot stays eligible', () => {
    const out = eligibleSlots({ kind: 'fridge', types: TYPES, appliances: placed, planSlots: PLAN })
    expect(out).toContain('k1')
  })

  it('keeps the oven\'s slot eligible for the hob — the stack gesture', () => {
    const withOven = [...placed, app('oven', 'k4')]
    const out = eligibleSlots({ kind: 'hob', types: TYPES, appliances: withOven, planSlots: PLAN })
    expect(out).toContain('k4')
    // and a non-partner still cannot land there
    const fridgeOut = eligibleSlots({ kind: 'washer', types: TYPES, appliances: withOven, planSlots: PLAN })
    expect(fridgeOut).not.toContain('k4')
  })

  it('offers the sink every free run slot but never the bath', () => {
    const out = eligibleSlots({ kind: 'sink', types: TYPES, appliances: placed, planSlots: PLAN })
    expect(out).toEqual(['k2', 'k3', 'k4', 'k5'])
  })
})

describe('runSlotKey', () => {
  it('numbers slots from 1', () => {
    expect(runSlotKey(0)).toBe('k1')
    expect(runSlotKey(4)).toBe('k5')
  })
})
