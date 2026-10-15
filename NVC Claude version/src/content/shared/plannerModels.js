import { getBoxConfiguratorCatalog } from './boxConfiguratorCatalog.js'

// The floor planner's houses, read from the printed catalogue.
//
// WHAT IS HERE: the six models the planner offers (three Box houses, three
// containers), the Box houses' fixed bathroom and the doors and windows that come
// with the shell, the eighteen catalogue layouts A1–C6 as plans the editor can load,
// three container shells, and the terrace options for the 3D and the summary.
//
// WHERE THE NUMBERS COME FROM. The footprints are read from boxConfiguratorCatalog.js
// (`dimensionsOpen`), never retyped: the owner chose the catalogue's sizes over the
// planner's old measured ones (2026-10-15), so the planner and the product pages
// quote one house. Everything inside the footprint is transcribed in millimetres
// from the catalogue's dimensioned drawings — page 6 (37 m²), page 14 (58 m²),
// page 20 (73 m²) of the Box house brochure. The 18 layouts are furnished 3D renders
// without dimensions (pages 3, 12, 19, the same artwork as public/box-config/
// plan-*.webp), so their partitions are snapped to the drawings' lines; where a
// render has a wall no drawing dimensions, the value is read off the render and
// says so in a comment. Prices are never written here: terrace and variant prices
// are looked up in the catalogue at call time.
//
// COORDINATES are the planner's (src/lib/floorPlan.js): x runs across the side the
// house unfolds over (6260 mm: wing 2030 + core 2200 + wing 2030), y runs down its
// length from the back wall, which holds the bathroom, to the front wall, which holds
// the double entrance door and the terrace. Templates are written in millimetres so
// each figure can be checked against a drawing; templateToPlan() hands the editor
// metres in its own plan format.
//
// ONE SIMPLIFICATION, SAID OUT LOUD. In the drawings only the central module (the
// container that the wings fold out of) is the full catalogue length; the two wings
// are 440 mm shorter (5460 against 5900, 8560 against 9000, 11360 against 11800) and
// sit 220 mm in from each end. The planner draws one rectangle, so a room at either
// end of a wing gains those 220 mm. CORE_OVERHANG_MM keeps the real figure for the 3D.

// -------------------------- The shell, from the drawings ------------------------

/** Every Box house unfolds to the same width: a 2030 mm wing each side of a 2200 mm core. */
export const WING_MM = 2030
export const CORE_MM = 2200

/** How far the central module sticks out past the wings at the back and at the front. */
export const CORE_OVERHANG_MM = 220

// The bathroom is the same block in every model: it sits against the back wall in the
// core module, offset to the right, so that its right-hand wall is the partition the
// right-hand rooms hang off. Read off all three drawings: its left wall is 2460 mm from
// the left outer face, the partition 3780 mm (6260 − 100 outer wall − 2355 room − 25),
// which leaves the 1250 mm clear width the drawings print, plus its walls. The depth
// is 2200 mm clear on the 37 and 58 m² and 2900 mm on the 73 m², plus the back wall
// and its own front wall: 2400 and 3100 mm from the back outer face.
export const BATH_LEFT_MM = 2460
export const BATH_RIGHT_MM = 3780

// The drawing of each model, in millimetres. `chain` is the right wing's dimension
// chain turned into partition positions (220 overhang + the printed lengths), the
// only room lines the drawings dimension. Windows: W1 is 930 × 930 on every side,
// W2 the 500 × 500 bathroom window in the back wall of the core; their centres were
// measured off the drawings (± ~50 mm — the drawings print sizes, not positions).
// `bedroomDoors` are the D1 doors on the 3780 partition, also measured.
const DRAWINGS = {
  b37: {
    page: 6,
    bathClear: { w: 1250, h: 2200 },
    bathFrontMm: 2400,
    chain: [3380], // 220 + 3160; then 2300 to the wing's front face
    bedroomDoors: [2890, 3900],
    windows: {
      left: [1520, 4220],
      right: [1520, 4220],
      front: [1120, 5160],
      back: [3380],
    },
  },
  b57: {
    page: 14,
    bathClear: { w: 1250, h: 2200 },
    bathFrontMm: 2400,
    chain: [4500], // 220 + 4280; then 4280
    bedroomDoors: [3930, 5060],
    windows: {
      left: [2570, 6360],
      right: [2570, 6360],
      front: [1070, 5210],
      back: [3400],
    },
  },
  b73: {
    page: 20,
    bathClear: { w: 1250, h: 2900 },
    bathFrontMm: 3100,
    chain: [4845, 8175], // 220 + 4625; + 3330; then 3405
    bedroomDoors: [4270, 7610, 8760],
    windows: {
      left: [2480, 6320, 10150],
      right: [2140, 5890, 9760],
      front: [1070, 5170],
      back: [3390],
    },
  },
}

const W1_MM = 930
const W2_MM = 500

// The bathroom door (D2) is about 700 mm, hung on the bathroom's right-hand wall and
// opening into the bathroom; its centre is 430 mm in from that wall. The entrance is
// a 1200 mm double door centred on the core, opening out onto the terrace.
const BATH_DOOR = { widthMm: 700, fromRightMm: 430 }
const FRONT_DOOR_MM = 1200

// The planner keys stay as they were (b57 is the 58 m² house; the key predates the
// catalogue's name for it), so plans saved in visitors' browsers still load.
const BOX_KEYS = { b37: '37', b57: '58', b73: '73' }

/** The catalogue key ('37' | '58' | '73') of a planner model key, or null. */
export function catalogueKeyFor(modelKey) {
  return BOX_KEYS[modelKey] || null
}

// '5900x6260x2500' → { lengthMm: 5900, widthMm: 6260 }
function parseOpen(dimensions) {
  const [lengthMm, widthMm] = String(dimensions || '').split('x').map(Number)
  return { lengthMm, widthMm }
}

const mm = (v) => Math.round(v) / 1000

function boxModel(key, catalogueModel) {
  const { lengthMm, widthMm } = parseOpen(catalogueModel.dimensionsOpen)
  const drawing = DRAWINGS[key]
  const bathFront = drawing.bathFrontMm
  return {
    key,
    kind: 'box',
    catalogueKey: catalogueModel.key,
    label: `Box house ${catalogueModel.area} m²`,
    area: catalogueModel.area,
    widthM: mm(widthMm),
    depthM: mm(lengthMm),
    widthMm,
    lengthMm,
    coreOverhangM: mm(CORE_OVERHANG_MM),
    drawingPage: drawing.page,
    // Read by fixedBathroomSpec() in src/lib/floorPlan.js in place of its old table.
    // w is right − left in metres, not mm(width): x + w must land on exactly the
    // partition the right-hand rooms start at, and 2.46 + 1.32 does not (floating point).
    bathroom: { x: mm(BATH_LEFT_MM), y: 0, w: mm(BATH_RIGHT_MM) - mm(BATH_LEFT_MM), h: mm(bathFront) },
    bathroomClearMm: { ...drawing.bathClear },
    // The bathroom's bottom wall runs right to left, so `at` counts from the right.
    bathroomDoor: {
      at: mm(BATH_DOOR.fromRightMm),
      widthM: mm(BATH_DOOR.widthMm),
      hinge: 'start',
      openTo: 'pos',
    },
    // outer_bottom runs right to left too; the door is centred on the core. It opens
    // outwards, which on outer_bottom is the negative side.
    frontDoor: {
      at: mm(widthMm / 2),
      widthM: mm(FRONT_DOOR_MM),
      hinge: 'start',
      openTo: 'neg',
      leaves: 2,
    },
  }
}

// The containers keep the planner's sizes, which are the gallery's stock units
// (6 × 3, 7 × 3, 8 × 3 m). They have no locked items: every unit has a shower room,
// but no drawing or photo says where it sits, so the planner leaves it to the visitor.
const CONTAINERS = [
  { key: 'c6x3', kind: 'container', label: 'Container 6×3', widthM: 6, depthM: 3 },
  { key: 'c7x3', kind: 'container', label: 'Container 7×3', widthM: 7, depthM: 3 },
  { key: 'c8x3', kind: 'container', label: 'Container 8×3', widthM: 8, depthM: 3 },
]

// The catalogue is read once: models don't change with the language, and the planner
// asks for them on every render.
const CATALOGUE_MODELS = getBoxConfiguratorCatalog('en').models

/**
 * The six planner models, in the shape src/lib/floorPlan.js expects
 * ({ key, kind, label, widthM, depthM } plus `bathroom`, `bathroomDoor` and
 * `frontDoor` on the Box houses). Containers first, as the planner has always
 * listed them; the page decides which one opens.
 */
export const PLANNER_MODELS = [
  ...CONTAINERS,
  ...Object.entries(BOX_KEYS).map(([key, catKey]) =>
    boxModel(key, CATALOGUE_MODELS.find((m) => m.key === catKey))
  ),
]

export function getPlannerModel(key) {
  return PLANNER_MODELS.find((m) => m.key === key) || null
}

// -------------------------- Templates --------------------------------------------
//
// A template is written as the rooms of the plan in millimetres:
//   { id, type, x, y, w, h, space?, kitchen? }
// and its interior doors as { room, side, pos, w? }: the door sits on that side of
// that room (top/right/bottom/left), centred at `pos` along the side — y for a left
// or right side, x for top or bottom — and opens into that room.
//
// The planner's rooms are rectangles and every room edge is drawn as a wall, but a
// catalogue living room is L-shaped around the bathroom. So an open space is split
// into rectangles that share a `space` id: the editor should not draw a wall between
// two rooms of one space, and should count them as one room in the summary. `kitchen`
// marks a room that holds the kitchen run — the catalogue's kitchens are open to the
// living room, never a room of their own.
//
// Room types are the planner's keys (living, bed, kitchen, bath, office, storage)
// plus `corridor` for the hall the A5/A6, B5/B6 and C5/C6 bedrooms open off.
//
// Windows are not listed per template: windowsFor() puts the drawing's windows in,
// drops one that a template's partition would cut, and gives any outside room left
// without a window one centred W1 — which is what the renders show.

const L = BATH_LEFT_MM // 2460: the bathroom's left wall, the line left-hand rooms stop at
const R = BATH_RIGHT_MM // 3780: the bathroom's right wall, the partition of the right-hand rooms
const W = 6260

// Shorthands for the rooms every layout repeats.
const room = (id, type, x0, y0, x1, y1, extra = {}) => ({ id, type, x: x0, y: y0, w: x1 - x0, h: y1 - y0, ...extra })
// The day space: the left wing plus the core in front of the bathroom.
const dayLeft = (D, extra = {}) => room('living', 'living', 0, 0, L, D, { space: 'day', kitchen: true, ...extra })
const dayCore = (bathFront, D) => room('living_core', 'living', L, bathFront, R, D, { space: 'day' })

// The right wing cut at the given y lines into bedrooms bed_r1, bed_r2, …
function rightBedrooms(D, cuts) {
  const ys = [0, ...cuts, D]
  return ys.slice(0, -1).map((y0, i) => room(`bed_r${i + 1}`, 'bed', R, y0, W, ys[i + 1]))
}
function leftBedrooms(cuts) {
  const ys = [0, ...cuts]
  return ys.slice(0, -1).map((y0, i) => room(`bed_l${i + 1}`, 'bed', 0, y0, L, ys[i + 1]))
}

const DOOR_MM = 800

// 37 m² — page 3 (renders), page 6 (drawing). Bathroom front 2400, D = 5900.
// A3 IS the drawing: the right wing cut at 3380, D1 doors at 2890 and 3900. The other
// five keep the drawing's lines: every partition across a wing is at 3380 (the renders
// put A2's, A4's and the A5/A6 left wing's at the same height as A3's), every bedroom
// door on the hall or living side at the drawing's D1 heights.
const A_D = 5900
const A_BF = 2400
const A_TEMPLATES = [
  {
    key: 'A1',
    rooms: [dayLeft(A_D), dayCore(A_BF, A_D), room('bed_r1', 'bed', R, 0, W, A_D)],
    doors: [{ room: 'bed_r1', side: 'left', pos: 2890 }],
  },
  {
    key: 'A2',
    rooms: [
      dayLeft(A_D),
      dayCore(A_BF, A_D),
      room('living_right', 'living', R, 3380, W, A_D, { space: 'day' }),
      room('bed_r1', 'bed', R, 0, W, 3380),
    ],
    doors: [{ room: 'bed_r1', side: 'left', pos: 2890 }],
  },
  {
    key: 'A3',
    rooms: [dayLeft(A_D), dayCore(A_BF, A_D), ...rightBedrooms(A_D, [3380])],
    doors: [
      { room: 'bed_r1', side: 'left', pos: 2890 },
      { room: 'bed_r2', side: 'left', pos: 3900 },
    ],
  },
  {
    key: 'A4',
    rooms: [
      ...leftBedrooms([3380]),
      room('living', 'living', 0, 3380, L, A_D, { space: 'day', kitchen: true }),
      dayCore(A_BF, A_D),
      ...rightBedrooms(A_D, [3380]),
    ],
    doors: [
      { room: 'bed_l1', side: 'right', pos: 2890 },
      { room: 'bed_r1', side: 'left', pos: 2890 },
      { room: 'bed_r2', side: 'left', pos: 3900 },
    ],
  },
  {
    key: 'A5',
    rooms: [
      // The workspace has the kitchen run in the render and a door of its own (the
      // configurator counts four interior doors for A5).
      room('office', 'office', 0, 0, L, 3380, { kitchen: true }),
      room('bed_l2', 'bed', 0, 3380, L, A_D),
      room('hall', 'corridor', L, A_BF, R, A_D),
      ...rightBedrooms(A_D, [3380]),
    ],
    doors: [
      { room: 'office', side: 'right', pos: 2890 },
      { room: 'bed_l2', side: 'right', pos: 3900 },
      { room: 'bed_r1', side: 'left', pos: 2890 },
      { room: 'bed_r2', side: 'left', pos: 3900 },
    ],
  },
  {
    key: 'A6',
    rooms: [...leftBedrooms([3380, A_D]), room('hall', 'corridor', L, A_BF, R, A_D), ...rightBedrooms(A_D, [3380])],
    doors: [
      { room: 'bed_l1', side: 'right', pos: 2890 },
      { room: 'bed_l2', side: 'right', pos: 3900 },
      { room: 'bed_r1', side: 'left', pos: 2890 },
      { room: 'bed_r2', side: 'left', pos: 3900 },
    ],
  },
]

// 58 m² — page 12 (renders), page 14 (drawing). Bathroom front 2400, D = 9000.
// B2 IS the drawing (right wing cut at 4500, D1 doors at 3930 and 5060). The drawing
// dimensions no other line, so the rest are read off the renders and rounded:
//   B1's one bedroom ends at ~4000; three rooms in a wing are cut at 3380 (the 37's
//   line, which the renders land on within ~30 mm) and ~6050; B4's wing at ~3600 and
//   ~6100. A door sits 550 mm from the partition it is nearest, as every D1 does.
const B_D = 9000
const B_BF = 2400
const B_TEMPLATES = [
  {
    key: 'B1',
    rooms: [
      dayLeft(B_D),
      dayCore(B_BF, B_D),
      room('living_right', 'living', R, 4000, W, B_D, { space: 'day' }),
      room('bed_r1', 'bed', R, 0, W, 4000),
    ],
    doors: [{ room: 'bed_r1', side: 'left', pos: 3450 }],
  },
  {
    key: 'B2',
    rooms: [dayLeft(B_D), dayCore(B_BF, B_D), ...rightBedrooms(B_D, [4500])],
    doors: [
      { room: 'bed_r1', side: 'left', pos: 3930 },
      { room: 'bed_r2', side: 'left', pos: 5060 },
    ],
  },
  {
    key: 'B3',
    rooms: [dayLeft(B_D), dayCore(B_BF, B_D), ...rightBedrooms(B_D, [3380, 6050])],
    doors: [
      { room: 'bed_r1', side: 'left', pos: 2830 },
      { room: 'bed_r2', side: 'left', pos: 5500 },
      { room: 'bed_r3', side: 'left', pos: 6600 },
    ],
  },
  {
    key: 'B4',
    rooms: [
      ...leftBedrooms([3600]),
      room('living', 'living', 0, 3600, L, B_D, { space: 'day', kitchen: true }),
      dayCore(B_BF, B_D),
      ...rightBedrooms(B_D, [3600, 6100]),
    ],
    doors: [
      { room: 'bed_l1', side: 'right', pos: 3000 },
      { room: 'bed_r1', side: 'left', pos: 3000 },
      { room: 'bed_r2', side: 'left', pos: 4150 },
      { room: 'bed_r3', side: 'left', pos: 6650 },
    ],
  },
  {
    key: 'B5',
    rooms: [
      ...leftBedrooms([3380, 6050]),
      room('living', 'living', 0, 6050, L, B_D, { space: 'day', kitchen: true }),
      room('hall', 'corridor', L, B_BF, R, B_D, { space: 'day' }),
      ...rightBedrooms(B_D, [3380, 6050]),
    ],
    doors: [
      { room: 'bed_l1', side: 'right', pos: 2890 },
      { room: 'bed_l2', side: 'right', pos: 3930 },
      { room: 'bed_r1', side: 'left', pos: 2890 },
      { room: 'bed_r2', side: 'left', pos: 3930 },
      { room: 'bed_r3', side: 'left', pos: 6600 },
    ],
  },
  {
    key: 'B6',
    rooms: [
      ...leftBedrooms([3380, 6050, B_D]),
      room('hall', 'corridor', L, B_BF, R, B_D),
      ...rightBedrooms(B_D, [3380, 6050]),
    ],
    doors: [
      { room: 'bed_l1', side: 'right', pos: 2890 },
      { room: 'bed_l2', side: 'right', pos: 3930 },
      { room: 'bed_l3', side: 'right', pos: 6600 },
      { room: 'bed_r1', side: 'left', pos: 2890 },
      { room: 'bed_r2', side: 'left', pos: 3930 },
      { room: 'bed_r3', side: 'left', pos: 6600 },
    ],
  },
]

// 73 m² — page 19 (renders), page 20 (drawing). Bathroom front 3100, D = 11800.
// C3 IS the drawing (right wing cut at 4845 and 8175, D1 doors at 4270, 7610, 8760),
// and C1's bedroom is the drawing's first room. The renders draw every wall ~0.25 m
// higher than the drawing (C3's land at ~4610 and ~7960), so render readings below
// are corrected by that much: C2's two bedrooms end at ~4400 and ~7800; three rooms
// in a wing (C4–C6) are cut at ~3900 and ~7650. A first-room door on either side of
// the bathroom has only the 800 mm between the bathroom's front (3100) and that cut,
// so it is centred there, at 3500.
const C_D = 11800
const C_BF = 3100
const C_TEMPLATES = [
  {
    key: 'C1',
    rooms: [
      dayLeft(C_D),
      dayCore(C_BF, C_D),
      room('living_right', 'living', R, 4845, W, C_D, { space: 'day' }),
      room('bed_r1', 'bed', R, 0, W, 4845),
    ],
    doors: [{ room: 'bed_r1', side: 'left', pos: 4270 }],
  },
  {
    key: 'C2',
    rooms: [
      dayLeft(C_D),
      dayCore(C_BF, C_D),
      ...rightBedrooms(7800, [4400]),
      // The render's workspace (a desk at the front of the right wing) is open to the
      // living room: no wall, no door.
      room('office', 'office', R, 7800, W, C_D, { space: 'day' }),
    ],
    doors: [
      { room: 'bed_r1', side: 'left', pos: 3850 },
      { room: 'bed_r2', side: 'left', pos: 4950 },
    ],
  },
  {
    key: 'C3',
    rooms: [dayLeft(C_D), dayCore(C_BF, C_D), ...rightBedrooms(C_D, [4845, 8175])],
    doors: [
      { room: 'bed_r1', side: 'left', pos: 4270 },
      { room: 'bed_r2', side: 'left', pos: 7610 },
      { room: 'bed_r3', side: 'left', pos: 8760 },
    ],
  },
  {
    key: 'C4',
    rooms: [
      ...leftBedrooms([3900]),
      room('living', 'living', 0, 3900, L, C_D, { space: 'day', kitchen: true }),
      dayCore(C_BF, C_D),
      ...rightBedrooms(C_D, [3900, 7650]),
    ],
    doors: [
      { room: 'bed_l1', side: 'right', pos: 3500 },
      { room: 'bed_r1', side: 'left', pos: 3500 },
      { room: 'bed_r2', side: 'left', pos: 4450 },
      { room: 'bed_r3', side: 'left', pos: 8200 },
    ],
  },
  {
    key: 'C5',
    rooms: [
      ...leftBedrooms([3900, 7650]),
      room('living', 'living', 0, 7650, L, C_D, { space: 'day', kitchen: true }),
      room('hall', 'corridor', L, C_BF, R, C_D, { space: 'day' }),
      ...rightBedrooms(C_D, [3900, 7650]),
    ],
    doors: [
      { room: 'bed_l1', side: 'right', pos: 3500 },
      { room: 'bed_l2', side: 'right', pos: 4450 },
      { room: 'bed_r1', side: 'left', pos: 3500 },
      { room: 'bed_r2', side: 'left', pos: 4450 },
      { room: 'bed_r3', side: 'left', pos: 8200 },
    ],
  },
  {
    key: 'C6',
    rooms: [
      ...leftBedrooms([3900, 7650, C_D]),
      room('hall', 'corridor', L, C_BF, R, C_D),
      ...rightBedrooms(C_D, [3900, 7650]),
    ],
    doors: [
      { room: 'bed_l1', side: 'right', pos: 3500 },
      { room: 'bed_l2', side: 'right', pos: 4450 },
      { room: 'bed_l3', side: 'right', pos: 8200 },
      { room: 'bed_r1', side: 'left', pos: 3500 },
      { room: 'bed_r2', side: 'left', pos: 4450 },
      { room: 'bed_r3', side: 'left', pos: 8200 },
    ],
  },
]

// The containers: the bare shell only. Every unit comes with a bathroom (toilet, basin
// and shower tray; src/content/*/modularBuilds.js), but nothing published shows where it
// sits, so a template that placed one would be inventing it. The words say so instead of
// calling the unit empty.
const CONTAINER_SUMMARY = {
  bg: 'Корпус с баня — поставете я сами',
  en: 'Shell with a bathroom: place it yourself',
  el: 'Κέλυφος με μπάνιο — τοποθετήστε το μόνοι σας',
}

// What a shell is called wherever a template's name reaches the screen (the editor's
// project card, the loaded notice, the print sheet, the offer): not a catalogue layout,
// so not a key like A1, and never its internal key 'c6x3-shell'.
const SHELL_NAME = {
  bg: 'Корпус {size}\u00a0м',
  en: 'Shell {size}\u00a0m',
  el: 'Κέλυφος {size}\u00a0m',
}
const CONTAINER_TEMPLATES = CONTAINERS.map((m) => ({
  key: `${m.key}-shell`,
  label: `${m.widthM} × ${m.depthM}`,
  summary: CONTAINER_SUMMARY,
  rooms: [room('room', 'living', 0, 0, m.widthM * 1000, m.depthM * 1000)],
  doors: [],
}))

const withModel = (list, model, page) => list.map((t) => ({ ...t, model, page, label: t.key }))

/**
 * All templates, raw (millimetres). Each: { key, model, page?, label, rooms, doors,
 * summary? } — the Box layouts take their summary line from the catalogue (see
 * templateInfo), the containers carry their own.
 */
export const PLAN_TEMPLATES = [
  ...withModel(A_TEMPLATES, 'b37', 3),
  ...withModel(B_TEMPLATES, 'b57', 12),
  ...withModel(C_TEMPLATES, 'b73', 19),
  ...CONTAINER_TEMPLATES.map((t, i) => ({ ...t, model: CONTAINERS[i].key })),
]

export function getTemplate(key) {
  return PLAN_TEMPLATES.find((t) => t.key === key) || null
}

/**
 * The name a template goes by on screen and in the offer, in the visitor's language:
 * { name, catalogue }. A Box layout is the catalogue's own key ('A1'…'C6', catalogue:
 * true); a container shell is "Shell 6 × 3 m" (catalogue: false), since it is not one of
 * the catalogue's layouts. Takes a template or its key; an unknown key comes back as is.
 */
export function templateDisplayName(templateOrKey, locale = 'en') {
  const template = typeof templateOrKey === 'string' ? getTemplate(templateOrKey) : templateOrKey
  if (!template) return { name: String(templateOrKey ?? ''), catalogue: true }
  const model = getPlannerModel(template.model)
  if (model?.kind === 'box') return { name: template.key, catalogue: true }
  const size = `${model?.widthM ?? ''}\u00a0×\u00a0${model?.depthM ?? ''}`
  return { name: (SHELL_NAME[locale] || SHELL_NAME.en).replace('{size}', size), catalogue: false }
}

export function templatesForModel(modelKey) {
  return PLAN_TEMPLATES.filter((t) => t.model === modelKey)
}

/** Bedrooms in a template: rooms of type `bed`. */
export function bedroomCount(template) {
  return (template?.rooms || []).filter((r) => r.type === 'bed').length
}

/**
 * What a template card shows, in the visitor's language:
 * { key, label, model, bedrooms, summary, page, image, areaM2 }.
 * `summary` is the catalogue's own line for the layout (planMeta in
 * boxConfiguratorCatalog.js), `image` the render under public/box-config/.
 */
export function templateInfo(template, locale = 'en') {
  const model = getPlannerModel(template.model)
  let summary = template.summary?.[locale] ?? template.summary?.en ?? ''
  let image = null
  if (model?.kind === 'box') {
    const plan = getBoxConfiguratorCatalog(locale).planOptions.find((p) => p.key === template.key)
    summary = plan?.subtitle || summary
    image = plan ? `box-config/${plan.image}` : null
  }
  return {
    key: template.key,
    label: template.label,
    model: template.model,
    bedrooms: bedroomCount(template),
    summary,
    page: template.page ?? null,
    image,
    areaM2: model?.kind === 'box' ? model.area : round2(model.widthM * model.depthM),
  }
}

const round2 = (v) => Math.round(v * 100) / 100

// -------------------------- Windows ----------------------------------------------

// The stretches of one outer wall that each room — or each open space, since a
// window may span two rectangles of one space — has against it: [{ from, to, ids }].
function wallSpans(rooms, side, model) {
  const Wd = model.widthMm ?? model.widthM * 1000
  const Dd = model.lengthMm ?? model.depthM * 1000
  const touching = rooms.filter((r) =>
    side === 'left' ? r.x === 0
      : side === 'right' ? r.x + r.w === Wd
        : side === 'front' ? r.y + r.h === Dd
          : r.y === 0
  )
  const along = (r) => (side === 'left' || side === 'right' ? [r.y, r.y + r.h] : [r.x, r.x + r.w])
  const spans = touching.map((r) => ({ from: along(r)[0], to: along(r)[1], space: r.space || r.id, ids: [r.id] }))
    .sort((a, b) => a.from - b.from)
  const merged = []
  for (const s of spans) {
    const last = merged[merged.length - 1]
    if (last && last.space === s.space && Math.abs(last.to - s.from) < 1) {
      last.to = s.to
      last.ids.push(...s.ids)
    } else merged.push({ ...s })
  }
  return merged
}

const MIN_WINDOW_ROOM_MM = 1500
const WINDOW_MARGIN_MM = 100

/**
 * The windows of a Box house plan, in millimetres: [{ side, pos, w, h, code }].
 * The drawing's windows stay where a room is under all of their width; any outside
 * room (or open space) left without one — and not holding the front door — gets a
 * W1 in its middle. The back wall keeps only the bathroom's W2.
 */
export function windowsFor(modelKey, rooms) {
  const model = getPlannerModel(modelKey)
  const drawing = DRAWINGS[modelKey]
  if (!model || !drawing) return []
  const out = []
  const frontDoor = [model.widthMm / 2 - FRONT_DOOR_MM / 2, model.widthMm / 2 + FRONT_DOOR_MM / 2]
  for (const side of ['left', 'right', 'front']) {
    const spans = wallSpans(rooms, side, model)
    const kept = new Set()
    for (const pos of drawing.windows[side]) {
      const span = spans.find((s) => pos - W1_MM / 2 >= s.from + WINDOW_MARGIN_MM && pos + W1_MM / 2 <= s.to - WINDOW_MARGIN_MM)
      if (!span) continue
      kept.add(span)
      out.push({ side, pos, w: W1_MM, h: W1_MM, code: 'W1' })
    }
    for (const s of spans) {
      if (kept.has(s) || s.to - s.from < MIN_WINDOW_ROOM_MM) continue
      if (side === 'front' && s.from < frontDoor[1] && s.to > frontDoor[0]) continue
      out.push({ side, pos: Math.round((s.from + s.to) / 2), w: W1_MM, h: W1_MM, code: 'W1' })
    }
  }
  for (const pos of drawing.windows.back) out.push({ side: 'back', pos, w: W2_MM, h: W2_MM, code: 'W2' })
  return out.sort((a, b) => a.side.localeCompare(b.side) || a.pos - b.pos)
}

// -------------------------- Into the planner's format -----------------------------

const OUTER_WALL = { left: 'outer_left', right: 'outer_right', front: 'outer_bottom', back: 'outer_top' }
const EDGE = { top: 'top', right: 'right', bottom: 'bottom', left: 'left' }

// Where along a wall the planner measures `at` from: each wall runs from its `a`
// end (see outerWalls / roomEdgeWallsForRoom in src/lib/floorPlan.js), and the
// planner's walls run clockwise, so bottom and left sides count backwards.
function outerAt(side, pos, model) {
  if (side === 'left') return model.lengthMm - pos // outer_left runs bottom → top
  if (side === 'front') return model.widthMm - pos // outer_bottom runs right → left
  return pos // outer_right top → bottom, outer_top left → right
}

function edgeAt(r, side, pos) {
  if (side === 'top') return pos - r.x
  if (side === 'right') return pos - r.y
  if (side === 'bottom') return r.x + r.w - pos
  return r.y + r.h - pos
}

/**
 * A template as a plan the editor can load: { rooms, walls, openings } in metres,
 * in the planner's own format. Room ids are prefixed with the template key so two
 * templates never share one. The Box houses' bathroom and its two doors are NOT in
 * the result: normalizePlan puts them in, from the model, as for every plan. Walls
 * are left empty for the same reason — normalizePlan draws the outer walls and an
 * edge wall for every room, and the doors below are hosted on those edge walls.
 */
export function templateToPlan(template) {
  const model = getPlannerModel(template.model)
  const prefix = template.key.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const id = (roomId) => `${prefix}_${roomId}`

  const rooms = template.rooms.map((r) => ({
    id: id(r.id),
    type: r.type,
    label: null,
    x: mm(r.x),
    y: mm(r.y),
    // far edge minus near edge, so neighbours meet exactly (see the bathroom above)
    w: mm(r.x + r.w) - mm(r.x),
    h: mm(r.y + r.h) - mm(r.y),
    finish: 'wood',
    ...(r.space ? { space: id(r.space) } : {}),
    ...(r.kitchen ? { kitchen: true } : {}),
  }))

  const openings = []
  for (const d of template.doors || []) {
    const r = template.rooms.find((x) => x.id === d.room)
    if (!r) throw new Error(`Template ${template.key}: door on unknown room ${d.room}`)
    openings.push({
      id: id(`door_${d.room}`),
      kind: 'door',
      widthM: mm(d.w ?? DOOR_MM),
      host: { type: 'wall', wallId: `re_${id(d.room)}_${EDGE[d.side]}`, at: mm(edgeAt(r, d.side, d.pos)) },
      hinge: 'start',
      openTo: 'pos', // edge walls face into their room: the door opens into it
      locked: false,
    })
  }

  if (model?.kind === 'box') {
    windowsFor(template.model, template.rooms).forEach((w, i) => {
      openings.push({
        id: id(`window_${i + 1}`),
        kind: 'window',
        widthM: mm(w.w),
        heightM: mm(w.h),
        host: { type: 'wall', wallId: OUTER_WALL[w.side], at: mm(outerAt(w.side, w.pos, model)) },
        hinge: 'start',
        openTo: 'pos',
        locked: false,
        code: w.code,
      })
    })
  }

  return { rooms, walls: [], openings }
}

/**
 * The same template as a layout object, ready for parseLayout() or a download:
 * { kind: 'floorplanner-layout', version: 1, modelKey, template, plan }.
 */
export function templateLayout(template) {
  return {
    kind: 'floorplanner-layout',
    version: 1,
    modelKey: template.model,
    template: template.key,
    plan: templateToPlan(template),
  }
}

// -------------------------- Terraces and the roof-and-veranda house ---------------

// Where each catalogue terrace goes (page 57): the standard and extended decks on the
// short, front side across the full width; the long-side decks along the right-hand
// long side. Sizes are parsed from the catalogue row's `note` ("6230 × 2000 mm"), so
// a new edition changes them in one place. The deck starts at the wings' front face,
// i.e. CORE_OVERHANG_MM inside the planner's front line, as on the drawings.
const TERRACE_SIDE = { standard: 'front', extended: 'front', 'long-58': 'right', 'long-73': 'right' }

function parseSize(note) {
  const m = String(note || '').match(/(\d+)\s*[×x]\s*(\d+)/)
  return m ? { lengthMm: Number(m[1]), depthMm: Number(m[2]) } : null
}

/**
 * The terrace options a Box model can have, in the visitor's language:
 * [{ key, label, price, included, side, lengthMm, depthMm, rect }]. `price` is the
 * catalogue's surcharge (0 for the standard deck, which is in the base price);
 * `rect` is the deck in planner metres — y beyond depthM on the front, x beyond
 * widthM on the right — for the 3D and the summary drawing.
 */
export function terraceOptionsFor(modelKey, locale = 'en') {
  const model = getPlannerModel(modelKey)
  if (model?.kind !== 'box') return []
  const overhang = CORE_OVERHANG_MM
  return getBoxConfiguratorCatalog(locale).terraceOptions
    .filter((o) => !o.models || o.models.includes(model.catalogueKey))
    .map((o) => {
      const size = parseSize(o.note)
      const side = TERRACE_SIDE[o.key] || 'front'
      const rect = !size ? null
        : side === 'front'
          ? { x: mm((model.widthMm - size.lengthMm) / 2), y: mm(model.lengthMm - overhang), w: mm(size.lengthMm), h: mm(size.depthMm) }
          : { x: model.widthM, y: mm((model.lengthMm - size.lengthMm) / 2), w: mm(size.depthMm), h: mm(size.lengthMm) }
      return {
        key: o.key,
        label: o.label,
        price: o.price,
        included: o.price === 0,
        side,
        lengthMm: size?.lengthMm ?? null,
        depthMm: size?.depthMm ?? null,
        rect,
      }
    })
}

/**
 * The two ways each Box house is sold: as it unfolds (flat roof, the standard deck),
 * and "с покрив и веранда" — the same house under a double-pitched roof with a covered
 * veranda (catalogue photos on pages 5, 11 and 18). Prices are the catalogue's house
 * prices, VAT included, without assembly: { standard, roofAndVeranda }.
 */
export function houseVariantPrices(modelKey) {
  const model = getPlannerModel(modelKey)
  if (model?.kind !== 'box') return null
  const cat = CATALOGUE_MODELS.find((m) => m.key === model.catalogueKey)
  return { standard: cat.basePrice, roofAndVeranda: cat.balconyPrice }
}

/** For tests and the visual check: the drawing data the shell was built from. */
export const SHELL_DRAWINGS = DRAWINGS
