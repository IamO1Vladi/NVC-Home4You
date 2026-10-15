// A handful of places in the delivery table's real column format, for the calculator's tests.
// The km are illustrative, not measured, and some carry decimals on purpose so the rounding
// shows (the generated table stores whole km).
import { PLACE_COLUMNS, decodeChunk } from '../../lib/deliveryPlaces.js'

function chunk(c, regions, rows) {
  const data = Object.fromEntries(PLACE_COLUMNS.map((k) => [k, []]))
  for (const r of rows) {
    data.name.push(r.name)
    data.bg.push(r.bg || '')
    data.en.push(r.en || '')
    data.el.push(r.el || '')
    data.r.push(r.r ?? -1)
    data.t.push(r.t)
    data.lat.push(Math.round(r.lat * 10000))
    data.lon.push(Math.round(r.lon * 10000))
    data.km.push(r.km)
    data.kmV.push(r.kmV)
  }
  return { v: 'test', c, scale: 10000, regions, cols: PLACE_COLUMNS, data }
}

export const BG_CHUNK = chunk('BG', [['Бургас', 'Burgas'], ['София (столица)', 'Sofia City'], ['Благоевград', 'Blagoevgrad']], [
  { name: 'София', el: 'Σόφια', t: 3, r: 1, lat: 42.6977, lon: 23.3219, km: 173.6, kmV: 470 },
  // Varna is the closer base: 131 km against 390.
  { name: 'Бургас', el: 'Μπουργκάς', t: 3, r: 0, lat: 42.4977, lon: 27.471, km: 390, kmV: 131 },
  { name: 'Бургасово', t: 1, r: 0, lat: 42.4, lon: 27.3, km: 380, kmV: 140 },
  { name: 'Банско', el: 'Μπάνσκο', t: 2, r: 2, lat: 41.8383, lon: 23.4885, km: 96.4, kmV: 470 },
])

export const GR_CHUNK = chunk('GR', [['Π.Ε. Θεσσαλονίκης', 'Thessaloniki'], ['Π.Ε. Καβάλας', 'Kavala'], ['Π.Ε. Ηρακλείου', 'Heraklion']], [
  { name: 'Θεσσαλονίκη', bg: 'Солун', t: 3, r: 0, lat: 40.6403, lon: 22.9353, km: 105, kmV: 600 },
  { name: 'Παραλία Καριανής', bg: 'Паралия Кариани', t: 1, r: 1, lat: 40.7876, lon: 24.0907, km: 117, kmV: 590 },
  // An island the road network cannot reach: delivery on request.
  { name: 'Αρχάνες', bg: 'Арханес', t: 2, r: 2, lat: 35.237, lon: 25.16, km: null, kmV: null },
])

export function fixturePlaces() {
  return [...decodeChunk(BG_CHUNK), ...decodeChunk(GR_CHUNK)]
}
