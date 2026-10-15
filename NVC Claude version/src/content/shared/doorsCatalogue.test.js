import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  DOOR_FEATURES,
  DOORS_COVER,
  DOOR_TYPES,
  SLIDING_DOORS,
  DOOR_FINISHES,
  DOOR_FRAMES,
  DOOR_TRIMS,
  DOOR_HANDLES,
  DOOR_HARDWARE,
  WALL_PANELS,
} from './doorsCatalogue.js'

const PUBLIC = path.resolve(__dirname, '../../../public')
const DIR = '/internal-doors/catalogue/'
const ALL = { DOOR_FEATURES, DOORS_COVER, DOOR_TYPES, SLIDING_DOORS, DOOR_FINISHES, DOOR_FRAMES, DOOR_TRIMS, DOOR_HANDLES, DOOR_HARDWARE, WALL_PANELS }

/** Every value in the data, with its dotted path. */
function walk(value, at, out) {
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${at}[${i}]`, out))
  else if (value && typeof value === 'object') {
    out.push([at, value])
    for (const [k, v] of Object.entries(value)) walk(v, `${at}.${k}`, out)
  } else out.push([at, value])
  return out
}
const entries = walk(ALL, '', [])
const imagePaths = entries.filter(([, v]) => typeof v === 'string' && v.startsWith(DIR)).map(([, v]) => v)

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? filesUnder(path.join(dir, d.name)) : [path.join(dir, d.name)],
  )
}

describe('the door catalogue data', () => {
  it('points only at images that exist, and every exported image is used', () => {
    expect(imagePaths.length).toBeGreaterThan(150)
    for (const p of imagePaths) expect(fs.existsSync(path.join(PUBLIC, p)), p).toBe(true)
    const used = new Set(imagePaths)
    const onDisk = filesUnder(path.join(PUBLIC, DIR)).map((f) => '/' + path.relative(PUBLIC, f).split(path.sep).join('/'))
    expect(onDisk.filter((f) => !used.has(f))).toEqual([])
  })

  it('keeps the image folder within its weight budget', () => {
    const bytes = filesUnder(path.join(PUBLIC, DIR)).reduce((n, f) => n + fs.statSync(f).size, 0)
    expect(bytes).toBeLessThan(2.5 * 1024 * 1024)
  })

  it('has every visitor-facing word in bg, en and el', () => {
    const texts = entries.filter(([, v]) => v && typeof v === 'object' && 'bg' in v)
    expect(texts.length).toBeGreaterThan(50)
    for (const [at, t] of texts) {
      for (const loc of ['bg', 'en', 'el']) expect(typeof t[loc] === 'string' && t[loc].trim().length > 0, `${at}.${loc}`).toBe(true)
      expect(t.el, `${at}.el`).toMatch(/[Ͱ-Ͽ]/)
      expect(t.bg, `${at}.bg`).toMatch(/[Ѐ-ӿ]|^(PET|WPC)/)
    }
  })

  it('never carries a price', () => {
    for (const [at] of entries) expect(at).not.toMatch(/price|eur|cost/i)
    for (const [, v] of entries) if (typeof v === 'string') expect(v).not.toMatch(/€|\d\s*лв|\bEUR\b|\bBGN\b/)
  })

  it('has unique codes across the whole range', () => {
    const codes = [
      ...DOOR_FINISHES, ...DOOR_FRAMES, ...DOOR_TRIMS, ...DOOR_HANDLES, ...WALL_PANELS.sizes, ...WALL_PANELS.accessories,
    ].map((x) => x.code)
    expect(new Set(codes).size).toBe(codes.length)
    const keys = [...DOOR_TYPES.map((t) => t.key), SLIDING_DOORS.key]
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('lists the 25 WPC finishes BJX-01 … BJX-25, each with a colour', () => {
    expect(DOOR_FINISHES.map((f) => f.code)).toEqual(Array.from({ length: 25 }, (_, i) => `BJX-${String(i + 1).padStart(2, '0')}`))
    for (const f of DOOR_FINISHES) expect(f.swatch).toMatch(/^#[0-9a-f]{6}$/)
    expect(WALL_PANELS.finishes.wpc.codes).toEqual(DOOR_FINISHES.map((f) => f.code))
  })

  it('lists the seven frames of page 11 with the widths printed there', () => {
    expect(DOOR_FRAMES.map((f) => [f.code, f.widthMm])).toEqual([
      ['BT100', 103], ['BT140', 143], ['BT180', 183], ['BT220', 223], ['BT250', 253], ['BT270', 273], ['BT300', 303],
    ])
    for (const f of DOOR_FRAMES) expect([f.thicknessMm, f.slotMm]).toEqual([31, 50])
  })

  it('has the catalogue counts: 14 trims, 15 handles, 3 stops, 5 hinges, 6 sliding styles, 6 panel sizes, 22 accessories', () => {
    expect(DOOR_TRIMS).toHaveLength(14)
    expect(DOOR_HANDLES.map((h) => h.code)).toEqual(Array.from({ length: 15 }, (_, i) => `BSL-${i + 1}`))
    expect(DOOR_HARDWARE.stops).toHaveLength(3)
    expect(DOOR_HARDWARE.hinges).toHaveLength(5)
    expect(SLIDING_DOORS.styles).toHaveLength(6)
    expect(WALL_PANELS.sizes.map((s) => s.code)).toEqual(['BQ300V', 'BQ300P', 'BQ400V', 'BQ400P', 'BQ600V', 'BQ600P'])
    expect(WALL_PANELS.accessories).toHaveLength(22)
    expect(WALL_PANELS.finishes.pet.items).toHaveLength(8)
    expect(WALL_PANELS.finishes.melamine.items).toHaveLength(8)
  })

  it('has the four hinged door types with photos, a room and a drawing each, plus sliding doors', () => {
    expect(DOOR_TYPES.map((t) => t.key)).toEqual(['wallpaper', 'decor-lines', 'metal-lines', 'glass'])
    for (const t of DOOR_TYPES) {
      expect(t.photos.length, t.key).toBeGreaterThanOrEqual(3)
      const shows = t.variants ?? [t]
      for (const v of shows) {
        expect(v.room, t.key).toMatch(/\/rooms\//)
        expect(v.drawing, t.key).toMatch(/\/drawings\//)
      }
    }
    expect(DOOR_FEATURES.map((f) => f.key)).toEqual(['water', 'fire', 'eco', 'termite'])
  })
})
