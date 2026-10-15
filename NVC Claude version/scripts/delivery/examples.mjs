// Writes src/content/shared/deliveryPlaces/examples.json: the six places of the delivery page's
// "Примерни цени" table, with their road km, read out of the big place chunks.
//
// WHY A SEPARATE FILE: the table is part of the prerendered page and must not pull in the
// ~740 kB of bg.json + gr.json that the calculator loads only when someone types. This one is
// a few hundred bytes, and the page prices it with the calculator's own arithmetic
// (deliveryQuote.js quoteFor), so the table and the calculator cannot disagree.
//
// RUN after every rebuild of the chunks (scripts/delivery/build-distances.mjs):
//
//   node scripts/delivery/examples.mjs
//
// Each row is picked by native name + country (+ type when a name repeats); the first
// candidate found wins. A place missing from the chunks is written with km and kmV null, and
// the page leaves that row out (and the whole section, when no row has a number). Exit code 1
// if a place is missing, so a rebuild that loses one is noticed.
//
// Shape: { v, rows: [{ id, country, names: { bg, en, el }, native, km, kmV }] }
//   km   one-way road km from Marikostinovo; kmV from Varna (a Box house uses the closer)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeChunk, displayName } from '../../src/lib/deliveryPlaces.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(here, '..', '..', 'src', 'content', 'shared', 'deliveryPlaces')

// `names` overrides the chunk's own display name for a locale: the place is ours to name in a
// table, and the chunk's Greek "Πύργος" for Бургас is the historical name, not the one a
// Greek reader uses today. Paralia Kariani (the published case) is not in the OSM extract as
// its own settlement; until it is, the row is the village of Kariani it belongs to and says so.
const EXAMPLES = [
  { id: 'sofia', country: 'BG', candidates: [{ native: 'София', type: 'city' }] },
  { id: 'plovdiv', country: 'BG', candidates: [{ native: 'Пловдив', type: 'city' }] },
  { id: 'varna', country: 'BG', candidates: [{ native: 'Варна', type: 'city' }] },
  { id: 'burgas', country: 'BG', candidates: [{ native: 'Бургас', type: 'city', names: { el: 'Μπουργκάς' } }] },
  { id: 'thessaloniki', country: 'GR', candidates: [{ native: 'Θεσσαλονίκη', type: 'city' }] },
  {
    id: 'kariani',
    country: 'GR',
    candidates: [
      { native: 'Παραλία Καριανής', names: { bg: 'Паралия Кариани', en: 'Paralia Kariani' } },
      { native: 'Κάριανη', names: { bg: 'Кариани', en: 'Kariani' } },
    ],
  },
]

function readChunk(file) {
  const p = path.join(dir, file)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const chunks = { BG: readChunk('bg.json'), GR: readChunk('gr.json') }
const places = {
  BG: chunks.BG ? decodeChunk(chunks.BG) : [],
  GR: chunks.GR ? decodeChunk(chunks.GR) : [],
}
const version = chunks.BG?.v || chunks.GR?.v || null

const missing = []
const rows = EXAMPLES.map(({ id, country, candidates }) => {
  for (const c of candidates) {
    const hit = places[country].find((p) => p.name === c.native && (!c.type || p.type === c.type))
    if (!hit) continue
    const names = Object.fromEntries(['bg', 'en', 'el'].map((l) => [l, c.names?.[l] || displayName(hit, l)]))
    return { id, country, names, native: hit.name, km: hit.km.marikostinovo, kmV: hit.km.varna }
  }
  missing.push(id)
  const first = candidates[0]
  return { id, country, names: { bg: '', en: '', el: '', ...first.names }, native: first.native, km: null, kmV: null }
})

const out = path.join(dir, 'examples.json')
fs.writeFileSync(out, `${JSON.stringify({ v: version, rows }, null, 2)}\n`)
for (const r of rows) console.log(r.id.padEnd(13), r.native.padEnd(18), String(r.km).padStart(5), String(r.kmV).padStart(5))
console.log(`wrote ${path.relative(process.cwd(), out)}`)
if (missing.length) {
  console.error(`missing from the chunks: ${missing.join(', ')}`)
  process.exit(1)
}
