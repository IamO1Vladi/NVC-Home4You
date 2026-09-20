// Slot logic for the kitchen-appliance layer (#28). Pure functions: the page
// owns the React state, this module owns the rules, so the rules are testable
// without mounting the 4000-line configurator.
//
// The model: a plan carries `applianceSlots` — an ordered `run` of counter
// positions along the kitchen worktop (k1..kN, one 60 cm module each). An
// appliance is stored as { id, kind, slot } and its coordinates are always
// DERIVED from the current plan's slot table, never stored — which is what
// makes a plan switch safe: "position 2 along the run" is meaningful on every
// layout, while a raw x/y from another render is not.
//
// The bathroom is the one slot with NO coordinates: there is only one possible
// spot for a washing machine in these bathrooms (owner, 2026-09-19), so
// "in the bathroom" is an option, not a placement — SLOT_BATH exists in the
// data model and the summaries, but never as a dot on the plan.

export const SLOT_BATH = 'bath'

export const runSlotKey = (index) => `k${index + 1}`

const runSlotIndex = (slotKey) => Number(String(slotKey).slice(1))

const familyOf = (type) => (type && (type.family || type.key)) || ''

const typesByKind = (types) => Object.fromEntries(types.map((t) => [t.key, t]))

/**
 * Which slots the given appliance kind may be placed into right now.
 * Slots occupied by OTHER appliance families are excluded (a slot is taken or
 * it isn't); the kind's own family is not, so placing again moves it — and a
 * slot held ONLY by the kind's stack partner stays eligible too, which is how
 * the hob lands on top of the placed oven (one column, hood above).
 * Sink-adjacent kinds (the dishwashers — plumbing, not preference) are limited
 * to the run slots either side of wherever the sink currently sits.
 */
export function eligibleSlots({ kind, types = [], appliances = [], planSlots }) {
  const byKind = typesByKind(types)
  const type = byKind[kind]
  if (!type) return []
  const run = planSlots?.run || []
  const family = familyOf(type)
  const occupied = new Set(
    appliances
      .filter((a) => {
        const aFamily = familyOf(byKind[a.kind])
        return aFamily !== family && aFamily !== (type.stacksWith || null)
      })
      .map((a) => a.slot)
  )
  const runKeys = run.map((_, i) => runSlotKey(i)).filter((k) => !occupied.has(k))
  if (type.sinkAdjacent) {
    const sink = appliances.find((a) => byKind[a.kind]?.required)
    if (!sink || sink.slot === SLOT_BATH) return []
    const sinkAt = runSlotIndex(sink.slot)
    return runKeys.filter((k) => Math.abs(runSlotIndex(k) - sinkAt) === 1)
  }
  if (type.allowBath && !occupied.has(SLOT_BATH)) {
    return [...runKeys, SLOT_BATH]
  }
  return runKeys
}

/**
 * Bring a placement list back into line with the rules and the current plan.
 * Idempotent, and returns the INPUT ARRAY REFERENCE when nothing changed, so a
 * React effect can call it on every change without looping.
 *
 * Rules enforced, in order:
 *  - unknown kinds and duplicate families drop (a 45 and a 60 dishwasher
 *    cannot coexist);
 *  - a slot that does not exist on this plan drops its occupant (a shared
 *    link from another layout, a shorter kitchen run);
 *  - one appliance per slot;
 *  - the sink is seeded whenever the plan has a kitchen run and none is
 *    placed — into the slot where the render draws it, else the first free
 *    one ("always present, must be placed" with no validation machinery);
 *  - a sink-adjacent kind survives only in a run slot directly beside the
 *    sink's current slot.
 */
export function reconcileAppliances({ appliances = [], types = [], planSlots }) {
  const byKind = typesByKind(types)
  const run = planSlots?.run || []
  const validRunKeys = new Set(run.map((_, i) => runSlotKey(i)))

  const kept = []
  const slotOccupants = new Map()
  const usedFamilies = new Set()
  for (const item of appliances) {
    const type = byKind[item.kind]
    if (!type) continue
    const family = familyOf(type)
    if (usedFamilies.has(family)) continue
    const slotExists = item.slot === SLOT_BATH
      ? Boolean(type.allowBath)
      : validRunKeys.has(item.slot)
    if (!slotExists) continue
    // One appliance per slot — except the stack pair, which shares one
    // column: the oven in the base cabinet, the hob on the worktop above.
    const occupants = slotOccupants.get(item.slot) || []
    const shareable = occupants.length === 1
      && item.slot !== SLOT_BATH
      && (type.stacksWith || null) === familyOf(byKind[occupants[0].kind])
    if (occupants.length > 0 && !shareable) continue
    kept.push(item)
    slotOccupants.set(item.slot, [...occupants, item])
    usedFamilies.add(family)
  }
  const usedSlots = new Set(slotOccupants.keys())

  const sinkType = types.find((t) => t.required)
  if (sinkType && run.length && !kept.some((a) => a.kind === sinkType.key)) {
    const drawnAt = Number.isInteger(planSlots?.sinkIndex) && planSlots.sinkIndex >= 0
      && planSlots.sinkIndex < run.length
      ? runSlotKey(planSlots.sinkIndex)
      : null
    const slot = drawnAt && !usedSlots.has(drawnAt)
      ? drawnAt
      : run.map((_, i) => runSlotKey(i)).find((k) => !usedSlots.has(k))
    if (slot) {
      kept.unshift({ id: `app-${sinkType.key}`, kind: sinkType.key, slot })
      usedSlots.add(slot)
    }
  }

  const sink = sinkType ? kept.find((a) => a.kind === sinkType.key) : null
  const result = kept.filter((item) => {
    const type = byKind[item.kind]
    if (!type?.sinkAdjacent) return true
    if (!sink || sink.slot === SLOT_BATH || item.slot === SLOT_BATH) return false
    return Math.abs(runSlotIndex(item.slot) - runSlotIndex(sink.slot)) === 1
  })

  const unchanged = result.length === appliances.length
    && result.every((item, i) => item === appliances[i])
  return unchanged ? appliances : result
}
