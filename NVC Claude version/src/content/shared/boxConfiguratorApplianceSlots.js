// Hand-placed appliance slot coordinates (#28), one entry per floor plan.
//
// Every number is a PERCENT of the furnished render (`plan-<key>.webp`) — the
// same coordinate frame the socket and window markers use — so the dots line
// up identically in the working step, the summary and the print PDF at any
// rendered size. `run` is the ordered line of 60 cm counter positions along
// the kitchen worktop (k1..kN, one appliance each); `sinkIndex` is the run
// position where the render draws the sink, which is where the mandatory sink
// marker starts. The bathroom deliberately has NO coordinates: there is only
// one possible washing-machine spot in these bathrooms (owner, 2026-09-19),
// so "in the bathroom" is a toggle in the UI, never a dot on the plan.
//
// An empty `run` is a real fact, not missing data: that plan has no kitchen
// (A6 is four bedrooms around a hallway), and the configurator then offers
// only the bathroom washing machine.
//
// Placed 2026-09-19/20 by reading each render and verifying every set against
// the image a second time. When a plan render is redrawn, its coordinates must
// be re-checked — nothing at runtime can notice a slot drifting off the
// worktop.

export const APPLIANCE_SLOTS = {
  // A1–A3 re-placed 2026-09-30 against the owner's new renders — each is now an L: a run
  // along the top wall, then a leg down the bathroom wall. Each set was then re-checked by
  // an independent reader drawing its own grid from the raw render; the blind corner square
  // is skipped on all three, as on the B and C runs.
  //
  // A1: sink drawn at position 3 — the hob is drawn at position 1; position 4 is the leg.
  // Position 5 (owner, 2026-10-03: "under number 4, for a fridge for example") is the tall
  // cream unit that closes the leg against the bathroom wall: a full-height housing, not
  // worktop, centred on its top face like every other dot. Placed by two blind readers of
  // the raw render, who agreed on it to the decimal. Appended, so positions 1–4 and every
  // saved configuration that uses them keep their numbers.
  A1: {
    run: [{ x: 18.5, y: 14.3 }, { x: 26.6, y: 14.3 }, { x: 34, y: 14.3 }, { x: 40.3, y: 22.3 }, { x: 40.3, y: 30.4 }],
    sinkIndex: 2,
  },
  // A2: sink drawn at position 4, on the leg — the hob is drawn at position 1, over an oven.
  A2: {
    run: [{ x: 18.5, y: 13.4 }, { x: 24.6, y: 13.4 }, { x: 26.8, y: 19.6 }, { x: 27.1, y: 25.3 }, { x: 26.5, y: 30.7 }],
    sinkIndex: 3,
  },
  // A3: sink drawn at position 2 — the hob is drawn at position 4, on the leg.
  A3: {
    run: [{ x: 15.5, y: 10.5 }, { x: 22.2, y: 10.4 }, { x: 28, y: 10.5 }, { x: 32.2, y: 18.5 }, { x: 32.2, y: 24 }],
    sinkIndex: 1,
  },
  // A4: sink drawn at position 4 — the hob is drawn at position 3.
  A4: {
    run: [{ x: 12.1, y: 51.4 }, { x: 11.9, y: 57 }, { x: 11.7, y: 62.7 }, { x: 11.2, y: 71 }, { x: 9.8, y: 79.9 }],
    sinkIndex: 3,
  },
  // A5: sink drawn at position 3 — the hob is drawn at position 4.
  A5: {
    run: [{ x: 13.1, y: 17.2 }, { x: 19.1, y: 17.1 }, { x: 25.2, y: 16.9 }, { x: 31.4, y: 16.8 }],
    sinkIndex: 2,
  },
  // A6 has no kitchen — bedrooms and a bathroom only.
  A6: { run: [], sinkIndex: -1 },
  // B1: sink drawn at position 2 — the hob is drawn at position 5.
  B1: {
    run: [{ x: 23.5, y: 30.3 }, { x: 23.5, y: 25.2 }, { x: 23.5, y: 20 }, { x: 26.9, y: 18.2 }, { x: 31.1, y: 18.3 }, { x: 35.6, y: 18.2 }],
    sinkIndex: 1,
  },
  // B2: sink drawn at position 2 — the hob is drawn at position 5.
  B2: {
    run: [{ x: 20, y: 29.9 }, { x: 20, y: 24.4 }, { x: 19.9, y: 16.5 }, { x: 24.3, y: 16.4 }, { x: 28.4, y: 16.4 }, { x: 33.2, y: 16.4 }],
    sinkIndex: 1,
  },
  // B3: sink drawn at position 2 — the hob is drawn at position 4.
  B3: {
    run: [{ x: 23.1, y: 30.7 }, { x: 23.1, y: 25.1 }, { x: 23.1, y: 19.1 }, { x: 30.5, y: 17.5 }, { x: 34.9, y: 17 }, { x: 39.2, y: 14.5 }],
    sinkIndex: 1,
  },
  // B4: sink drawn at position 5 — the hob is drawn at position 2.
  B4: {
    run: [{ x: 24.2, y: 58.4 }, { x: 23.9, y: 53.8 }, { x: 24.1, y: 48.6 }, { x: 28, y: 44.1 }, { x: 32.6, y: 44.1 }, { x: 38.2, y: 44.1 }],
    sinkIndex: 4,
  },
  // B5: sink drawn at position 2 — the hob is drawn at position 6.
  B5: {
    run: [{ x: 26, y: 77.4 }, { x: 26, y: 73.3 }, { x: 26.4, y: 69.9 }, { x: 30.6, y: 68.4 }, { x: 34, y: 68.4 }, { x: 37.4, y: 68.4 }],
    sinkIndex: 1,
  },
  // B6 has no kitchen — bedrooms and a bathroom only.
  B6: { run: [], sinkIndex: -1 },
  // C1: sink drawn at position 2 — no hob is drawn on this render.
  C1: {
    run: [{ x: 23.6, y: 12.2 }, { x: 30.5, y: 12.3 }, { x: 36.1, y: 12.2 }, { x: 40.4, y: 18.5 }, { x: 40.4, y: 23.2 }],
    sinkIndex: 1,
  },
  // C2: sink drawn at position 3 — no hob is drawn on this render.
  C2: {
    run: [{ x: 13.6, y: 13.8 }, { x: 19.5, y: 13.8 }, { x: 25.5, y: 13.8 }, { x: 31.4, y: 13.8 }, { x: 36.5, y: 18.1 }, { x: 36.5, y: 24.2 }],
    sinkIndex: 2,
  },
  // C3: sink drawn at position 2 — no hob is drawn on this render.
  C3: {
    run: [{ x: 29.3, y: 12 }, { x: 34.8, y: 12.1 }, { x: 39.2, y: 12.1 }, { x: 41.5, y: 18.1 }, { x: 41.6, y: 24.1 }],
    sinkIndex: 1,
  },
  // C4: sink drawn at position 3 — the hob is drawn at position 6.
  C4: {
    run: [{ x: 41, y: 37.6 }, { x: 36.4, y: 37.7 }, { x: 31.4, y: 37.8 }, { x: 26.6, y: 37.8 }, { x: 22.8, y: 43.2 }, { x: 22.7, y: 47.3 }],
    sinkIndex: 2,
  },
  // C5 has no kitchen — bedrooms and a bathroom only.
  C5: { run: [], sinkIndex: -1 },
  // C6 has no kitchen — bedrooms and a bathroom only.
  C6: { run: [], sinkIndex: -1 },
}
