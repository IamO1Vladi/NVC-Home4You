// Builds the offline delivery-distance table: every city, town and village in Bulgaria and
// Greece with its one-way road km from the two bases, Marikostinovo (containers, Box houses)
// and Varna (Box houses). Output: src/content/shared/deliveryPlaces/{bg,gr,meta}.json, read
// by src/lib/deliveryPlaces.js.
//
// DATA AND LICENCE
//   Place names, coordinates, regions and the road network all come from OpenStreetMap,
//   © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0,
//   https://www.openstreetmap.org/copyright). The page that shows these distances must carry
//   that attribution. The derived table is a "produced work" of the OSM database.
//
// INPUTS (all kept OUTSIDE the repo, in one work directory, e.g. <scratch>/osrm/)
//   - Geofabrik extracts: bulgaria-latest.osm.pbf, greece-latest.osm.pbf
//     (https://download.geofabrik.de/europe/). There is no combined BG+GR extract and no
//     osmium on the build machine, so the two countries are routed as TWO separate graphs.
//   - The OSRM Docker image, pinned: ghcr.io/project-osrm/osrm-backend:v5.27.1 (override with
//     OSRM_IMAGE). `node build-distances.mjs osrm-commands --work <dir>` prints the exact
//     extract / partition / customize / serve commands. Car profile (/opt/car.lua), MLD.
//     Greece needs roughly 6–8 GB for osrm-extract: check `docker info` (Total Memory) first.
//   - The settlement lists come from the Overpass API (overpass-api.de), two queries per
//     country, cached in the work dir (`places` step). Re-runs reuse the cache.
//   - scripts/delivery/crossings.json: the four main road crossings.
//
// HOW TO RUN (from the repo root; paths are arguments, nothing is read from inside the
// downloaded data directories except by OSRM itself)
//   node scripts/delivery/build-distances.mjs osrm-commands --work <dir>   # then run them
//   node scripts/delivery/build-distances.mjs places --work <dir>          # Overpass → <dir>/places-*.json
//   node scripts/delivery/build-distances.mjs distances --work <dir> \
//        --bg-osrm http://localhost:5001 --gr-osrm http://localhost:5002 \
//        [--out src/content/shared/deliveryPlaces] [--budget-kb 350] [--version 2026-10-15]
//
// ROUTING RULES
//   - Car profile, ferries excluded (`exclude=ferry` on every request; car.lua declares ferry
//     as excludable). A place that is only reachable by ferry (Crete, most islands) gets
//     null = "on request".
//   - A place whose nearest road is more than --max-snap-m (default 2000 m) away also gets
//     null: an islet with no mapped road would otherwise "snap" across the sea.
//   - A place whose own nearest road is a small separate network (OSRM's "tiny component",
//     under 1000 nodes: Poros, Elafonisos, Trizonia...) is snapped by the table service to the
//     nearest road of the big network instead, which for a near-shore island is the mainland
//     across the channel. Each place's table snap is compared with its plain /nearest snap; a
//     place moved more than --max-jump-m (default 300 m) further gets null and is listed as a
//     "component jump" for review (a mainland village with a broken OSM road lands there too,
//     and "on request" is the safe answer for it).
//   - Distances use the OSRM table service (annotations=distance,duration) in batches; like
//     OSRM itself, the distance is that of the fastest route.
//
// CROSS-BORDER METHOD (Greek places)
//   Both bases are in Bulgaria. For a Greek place P and base B:
//       km(B, P) = km_BG(B → C.bg) + gap(C) + km_GR(C.gr → P), for the crossing C with the
//                  smallest total DURATION (the route a driver would take, as OSRM picks it
//                  within one graph; picking the shortest km could send a lorry over a slow
//                  mountain pass)
//   where C.bg / C.gr are the crossing point snapped in the BG / GR graph, km_BG and km_GR are
//   road km in each graph, and gap(C) is the straight line between the two snapped points
//   (normally well under a kilometre, the stretch the two extracts do not share). Crossings:
//   Kulata–Promachonas, Ilinden–Exochi, Makaza–Nymfaia, Kapitan Petko Voyvoda–Ormenio. Their
//   approximate points in crossings.json are first resolved to the OSM border_control posts
//   within 5 km (Overpass), then snapped; a snap further than 2 km from the point, or a gap
//   above 3 km, stops the run. A Bulgarian place takes the faster of the direct BG route and
//   base → crossing (BG) → crossing (GR) → place (BG): from Marikostinovo the Kardzhali and
//   Smolyan villages are quicker through Greece (Kulata, Egnatia, Makaza) than round by Plovdiv.
//
// OUTPUT FORMAT: see the header of src/lib/deliveryPlaces.js (column arrays, lat/lon as
// integers × 10000, km integers or null). If both chunks together exceed --budget-kb gzip,
// the script shrinks in documented steps (see SHRINK_STEPS) and reports which it applied; it
// never drops a place.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { BASES, PLACE_COLUMNS, haversineKm, normalize, romanize } from '../../src/lib/deliveryPlaces.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')

const OSRM_IMAGE = process.env.OSRM_IMAGE || 'ghcr.io/project-osrm/osrm-backend:v5.27.1'
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'nvc-home4you-delivery-table/1.0 (one-off build; contact via nvc-home4you site)'
const RANK = { city: 3, town: 2, village: 1 }
const COUNTRIES = {
  BG: { pbf: 'bulgaria-latest.osm.pbf', regionLevel: '6', expectRegions: [28, 28] },
  GR: { pbf: 'greece-latest.osm.pbf', regionLevel: '5', expectRegions: [70, 80] },
}

// ------------------------------------------------------------------------------------------
// CLI

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const opts = {}
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (!a.startsWith('--')) throw new Error(`Unexpected argument: ${a}`)
    const key = a.slice(2)
    const next = rest[i + 1]
    if (next === undefined || next.startsWith('--')) opts[key] = true
    else {
      opts[key] = next
      i++
    }
  }
  return { cmd, opts }
}

function need(opts, key) {
  if (!opts[key] || opts[key] === true) throw new Error(`--${key} is required`)
  return opts[key]
}

const log = (...a) => console.log(...a)

// ------------------------------------------------------------------------------------------
// OSRM setup commands (printed, not run: the operator runs them and watches memory)

function osrmCommands(opts) {
  const work = resolve(need(opts, 'work')).replace(/\\/g, '/')
  const lines = [
    `# Image: ${OSRM_IMAGE}`,
    `docker pull ${OSRM_IMAGE}`,
    `docker info --format "{{.MemTotal}}"   # Greece's extract wants ~6-8 GB`,
  ]
  const ports = { BG: 5001, GR: 5002 }
  for (const [cc, c] of Object.entries(COUNTRIES)) {
    const dir = `${work}/${cc.toLowerCase()}`
    const osrm = `/data/${c.pbf.replace('.osm.pbf', '.osrm')}`
    lines.push(
      '',
      `# ${cc}: put ${c.pbf} in ${dir}/`,
      `docker run --rm -t -v "${dir}:/data" ${OSRM_IMAGE} osrm-extract -p /opt/car.lua /data/${c.pbf}`,
      `docker run --rm -t -v "${dir}:/data" ${OSRM_IMAGE} osrm-partition ${osrm}`,
      `docker run --rm -t -v "${dir}:/data" ${OSRM_IMAGE} osrm-customize ${osrm}`,
      `docker run -d --name osrm-${cc.toLowerCase()} -p ${ports[cc]}:5000 -v "${dir}:/data" ${OSRM_IMAGE} ` +
        `osrm-routed --algorithm mld --max-table-size 10000 ${osrm}`,
    )
  }
  lines.push('', '# afterwards: docker rm -f osrm-bg osrm-gr')
  log(lines.join('\n'))
}

// ------------------------------------------------------------------------------------------
// Overpass

async function overpass(query, cacheFile) {
  if (cacheFile && existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'))
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: 'data=' + encodeURIComponent(query),
    })
    if (res.ok) {
      const text = await res.text()
      const json = JSON.parse(text)
      if (cacheFile) writeFileSync(cacheFile, text)
      return json
    }
    const wait = 30 * attempt
    log(`  Overpass answered ${res.status}; waiting ${wait}s (attempt ${attempt}/4)`)
    await new Promise((r) => setTimeout(r, wait * 1000))
  }
  throw new Error('Overpass kept refusing; try later or set OVERPASS_URL to a mirror')
}

const PLACE_FILTER = '["place"~"^(city|town|village)$"]["name"]'

function placesQuery(cc) {
  return `[out:json][timeout:900];
area["ISO3166-1"="${cc}"]["admin_level"="2"]->.c;
node(area.c)${PLACE_FILTER}->.n;
.n out body;
(way(area.c)${PLACE_FILTER}; relation(area.c)${PLACE_FILTER}["boundary"!~"."];)->.w;
.w out tags center;`
}

function regionsQuery(cc, level) {
  return `[out:json][timeout:900];
area["ISO3166-1"="${cc}"]["admin_level"="2"]->.c;
rel(area.c)["boundary"="administrative"]["admin_level"="${level}"];
foreach->.r(
  .r out tags;
  .r map_to_area->.a;
  (node(area.a)${PLACE_FILTER}; way(area.a)${PLACE_FILTER};);
  out ids;
);`
}

function latinName(tags) {
  return tags['name:en'] || tags.int_name || tags['name:latin'] || tags['name:bg-Latn'] || tags['name:el-Latn'] || ''
}

function regionLabel(cc, tags) {
  let native = tags.name || ''
  let latin = tags['name:en'] || tags.int_name || ''
  if (cc === 'BG') {
    native = native.replace(/^област\s+/i, '').trim()
    latin = latin.replace(/\s+(Province|Oblast|Region)$/i, '').replace(/^(Province|Oblast) of\s+/i, '').trim()
    // Sofia Province surrounds the capital but is not it: without the word, the English
    // region reads "Sofia" next to "Sofia-City".
    if (native === 'Софийска') latin = 'Sofia Province'
  } else {
    native = native.replace(/^Περιφερειακή Ενότητα\s+/i, 'Π.Ε. ').trim()
    latin = latin.replace(/^Regional [Uu]nit of\s+/, '').replace(/\s+Regional [Uu]nit$/, '').trim()
  }
  return [native, latin || romanize(native.replace(/^Π\.Ε\.\s+/, ''))]
}

async function buildPlaces(opts) {
  const work = resolve(need(opts, 'work'))
  mkdirSync(work, { recursive: true })
  for (const [cc, conf] of Object.entries(COUNTRIES)) {
    const level = opts[`${cc.toLowerCase()}-region-level`] || conf.regionLevel
    log(`${cc}: places (Overpass)`)
    const placesRaw = await overpass(placesQuery(cc), join(work, `overpass-places-${cc.toLowerCase()}.json`))
    log(`${cc}: regions at admin_level=${level} (Overpass)`)
    const regionsRaw = await overpass(regionsQuery(cc, level), join(work, `overpass-regions-${cc.toLowerCase()}-${level}.json`))

    // Region membership: the foreach prints each region's tags, then the ids inside it.
    const regions = []
    const regionOf = new Map()
    let current = -1
    for (const el of regionsRaw.elements) {
      if (el.type === 'relation' && el.tags) {
        regions.push({ id: el.id, tags: el.tags, count: 0 })
        current = regions.length - 1
      } else if (current >= 0) {
        const key = `${el.type}/${el.id}`
        if (!regionOf.has(key)) {
          regionOf.set(key, current)
          regions[current].count++
        }
      }
    }

    // Places: nodes first; a place mapped as an area is kept only when no node of the same
    // name lies within 3 km (otherwise it is the same village twice).
    const nodes = []
    const areas = []
    for (const el of placesRaw.elements) {
      const t = el.tags || {}
      if (!RANK[t.place] || !t.name) continue
      const lat = el.lat ?? el.center?.lat
      const lon = el.lon ?? el.center?.lon
      if (lat == null || lon == null) continue
      const row = {
        osm: `${el.type}/${el.id}`,
        name: t.name.trim(),
        bg: (t['name:bg'] || '').trim(),
        en: latinName(t).trim(),
        el: (t['name:el'] || '').trim(),
        place: t.place,
        lat,
        lon,
        region: regionOf.has(`${el.type}/${el.id}`) ? regionOf.get(`${el.type}/${el.id}`) : -1,
      }
      ;(el.type === 'node' ? nodes : areas).push(row)
    }
    const byKey = new Map()
    for (const n of nodes) {
      const k = normalize(n.name)
      if (!byKey.has(k)) byKey.set(k, [])
      byKey.get(k).push(n)
    }
    let droppedDupes = 0
    const kept = [...nodes]
    for (const a of areas) {
      const twins = byKey.get(normalize(a.name)) || []
      if (twins.some((n) => haversineKm(n.lat, n.lon, a.lat, a.lon) < 3)) droppedDupes++
      else kept.push(a)
    }

    const usedRegions = regions.filter((r) => r.count > 0)
    const [lo, hi] = conf.expectRegions
    if (usedRegions.length < lo || usedRegions.length > hi) {
      log(`  WARNING: ${usedRegions.length} regions at admin_level=${level}, expected ${lo}-${hi}. ` +
        `Re-run with --${cc.toLowerCase()}-region-level N if that is the wrong level.`)
    }
    // Keep only regions that hold at least one place (rel(area) also returns the neighbours'
    // regions that share a border way), and renumber.
    const newIndex = new Map(usedRegions.map((r) => [regions.indexOf(r), 0]))
    ;[...newIndex.keys()].forEach((oldI, newI) => newIndex.set(oldI, newI))
    for (const p of kept) p.region = newIndex.has(p.region) ? newIndex.get(p.region) : -1
    const noRegion = kept.filter((p) => p.region < 0).length
    const regionTable = usedRegions.map((r) => regionLabel(cc, r.tags))
    const out = { country: cc, regionLevel: level, regions: regionTable, places: kept }
    writeFileSync(join(work, `places-${cc.toLowerCase()}.json`), JSON.stringify(out))
    const byType = kept.reduce((m, p) => ((m[p.place] = (m[p.place] || 0) + 1), m), {})
    log(`  ${kept.length} places ${JSON.stringify(byType)}; ${droppedDupes} area duplicates of a node dropped; ` +
      `${noRegion} without a region; ${usedRegions.length} regions`)
  }
}

// ------------------------------------------------------------------------------------------
// OSRM

async function osrmGet(base, path) {
  const url = `${base.replace(/\/$/, '')}${path}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (json.code !== 'Ok') throw new Error(`${json.code}: ${json.message || ''}`)
      return json
    } catch (err) {
      if (attempt === 3) throw new Error(`OSRM ${base} failed: ${err.message}`)
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
}

const coord = ([lat, lon]) => `${lon.toFixed(6)},${lat.toFixed(6)}`

async function snap(base, latlon) {
  const j = await osrmGet(base, `/nearest/v1/driving/${coord(latlon)}?number=1&exclude=ferry`)
  const w = j.waypoints[0]
  return { at: [w.location[1], w.location[0]], snapM: w.distance, road: w.name || '' }
}

// Plain nearest-road distance in metres for each point (any component), a few requests at a time.
async function nearestM(base, points, parallel = 16) {
  const out = new Array(points.length)
  let next = 0
  const worker = async () => {
    while (next < points.length) {
      const i = next++
      out[i] = (await snap(base, points[i])).snapM
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, points.length) }, worker))
  return out
}

// sources × destinations road metres, plus each destination's snap distance.
async function table(base, sources, destinations) {
  const coords = [...sources, ...destinations].map(coord).join(';')
  const src = sources.map((_, i) => i).join(';')
  const dst = destinations.map((_, i) => i + sources.length).join(';')
  const j = await osrmGet(
    base,
    `/table/v1/driving/${coords}?sources=${src}&destinations=${dst}&annotations=distance,duration&exclude=ferry`,
  )
  return { distances: j.distances, durations: j.durations, destSnapM: j.destinations.map((d) => d.distance) }
}

async function resolveCrossings(crossings, work) {
  const around = crossings
    .map((c) => `node(around:5000,${c.at[0]},${c.at[1]})["barrier"="border_control"];`)
    .join('\n')
  const raw = await overpass(`[out:json][timeout:120];(\n${around}\n);out body;`, join(work, 'overpass-border-posts.json'))
  return crossings.map((c) => {
    const posts = raw.elements.filter((e) => haversineKm(e.lat, e.lon, c.at[0], c.at[1]) <= 5)
    if (posts.length === 0) return { ...c, point: c.at, posts: [] }
    const lat = posts.reduce((s, e) => s + e.lat, 0) / posts.length
    const lon = posts.reduce((s, e) => s + e.lon, 0) / posts.length
    return { ...c, point: [lat, lon], posts: posts.map((e) => [e.lat, e.lon, e.tags?.name || '']) }
  })
}

// ------------------------------------------------------------------------------------------
// Packing

// Shrink steps, applied in order only while both chunks together exceed the gzip budget.
// None of them removes a place; each removes a name variant the library can regenerate or
// fall back from.
const SHRINK_STEPS = [
  { id: 'cross-names-villages', what: 'name:el on Bulgarian villages and name:bg on Greek villages (towns and cities keep them)' },
  { id: 'latin-villages', what: 'Latin names of villages (the page romanises the native name instead)' },
  { id: 'coords-3dp', what: 'lat/lon rounded to 3 decimals (~100 m) instead of 4' },
]

function packChunk(cc, version, regions, rows, shrink) {
  const scale = shrink.has('coords-3dp') ? 1000 : 10000
  const data = Object.fromEntries(PLACE_COLUMNS.map((k) => [k, []]))
  for (const p of rows) {
    const village = p.place === 'village'
    let bg = p.bg && p.bg !== p.name ? p.bg : ''
    let el = p.el && p.el !== p.name ? p.el : ''
    let en = p.en && p.en !== romanize(p.name) ? p.en : ''
    if (village && shrink.has('cross-names-villages')) {
      if (cc === 'BG') el = ''
      else bg = ''
    }
    if (village && shrink.has('latin-villages')) en = ''
    data.name.push(p.name)
    data.bg.push(bg)
    data.en.push(en)
    data.el.push(el)
    data.r.push(p.region)
    data.t.push(RANK[p.place])
    data.lat.push(Math.round(p.lat * scale))
    data.lon.push(Math.round(p.lon * scale))
    data.km.push(p.km)
    data.kmV.push(p.kmV)
  }
  return { v: version, c: cc, scale, regions, cols: PLACE_COLUMNS, data }
}

function sizes(obj) {
  const text = JSON.stringify(obj)
  return { text, raw: Buffer.byteLength(text), gzip: gzipSync(text, { level: 9 }).length }
}

// ------------------------------------------------------------------------------------------
// Distances

async function buildDistances(opts) {
  const work = resolve(need(opts, 'work'))
  const bgOsrm = need(opts, 'bg-osrm')
  const grOsrm = need(opts, 'gr-osrm')
  const outDir = resolve(repoRoot, opts.out || 'src/content/shared/deliveryPlaces')
  const version = opts.version || new Date().toISOString().slice(0, 10)
  const budget = Number(opts['budget-kb'] || 350) * 1024
  const maxSnapM = Number(opts['max-snap-m'] || 2000)
  const maxJumpM = Number(opts['max-jump-m'] || 300)
  const batch = Number(opts.batch || 400)
  const crossingsFile = resolve(repoRoot, opts.crossings || 'scripts/delivery/crossings.json')

  const bg = JSON.parse(readFileSync(join(work, 'places-bg.json'), 'utf8'))
  const gr = JSON.parse(readFileSync(join(work, 'places-gr.json'), 'utf8'))
  const baseIds = ['marikostinovo', 'varna']
  const baseLL = baseIds.map((b) => [BASES[b].lat, BASES[b].lon])

  // Sanity: the bases snap onto a road in the BG graph; a Crete point is unreachable.
  for (const b of baseIds) {
    const s = await snap(bgOsrm, [BASES[b].lat, BASES[b].lon])
    log(`base ${b}: snapped ${s.snapM.toFixed(0)} m to "${s.road}"`)
    if (s.snapM > 1000) throw new Error(`base ${b} is ${s.snapM} m from a road — wrong graph?`)
  }

  // Crossings: resolve → snap in both graphs → validate.
  const crossings = await resolveCrossings(JSON.parse(readFileSync(crossingsFile, 'utf8')).crossings, work)
  for (const c of crossings) {
    c.bgSnap = await snap(bgOsrm, c.point)
    c.grSnap = await snap(grOsrm, c.point)
    c.gapKm = haversineKm(c.bgSnap.at[0], c.bgSnap.at[1], c.grSnap.at[0], c.grSnap.at[1])
    log(`crossing ${c.latin}: ${c.posts.length} border posts → [${c.point.map((x) => x.toFixed(4))}]; ` +
      `BG snap ${c.bgSnap.snapM.toFixed(0)} m "${c.bgSnap.road}", GR snap ${c.grSnap.snapM.toFixed(0)} m ` +
      `"${c.grSnap.road}", gap ${c.gapKm.toFixed(2)} km`)
    if (c.bgSnap.snapM > 2000 || c.grSnap.snapM > 2000 || c.gapKm > 3) {
      throw new Error(`crossing ${c.id} does not resolve cleanly; fix its "at" in ${crossingsFile}`)
    }
  }

  // Bulgaria: bases → crossings and bases → every BG place, in the BG graph.
  const legBG = await table(bgOsrm, baseLL, crossings.map((c) => c.bgSnap.at))
  const unroutable = []
  const tooFar = []
  const jumps = []
  // true when the table moved this place off its own (tiny) road network; listed, then nulled.
  const jumped = (cc, p, tableM, ownM) => {
    if (tableM - ownM <= maxJumpM) return false
    jumps.push(`${cc} ${p.name} [${p.lat.toFixed(4)},${p.lon.toFixed(4)}] nearest road ${ownM.toFixed(0)} m, routed from ${tableM.toFixed(0)} m`)
    return true
  }
  // A Bulgarian place may also be quicker to reach THROUGH Greece: from Marikostinovo the
  // Kardzhali and Smolyan villages are a Kulata → Egnatia → Makaza drive, while the BG graph
  // alone sends the lorry round by Sofia and Plovdiv (460-530 km instead of ~350). So each
  // base also gets base → crossing ci (BG) + ci → cj (GR) + cj → place (BG), and the faster
  // of that and the direct BG route wins, by duration as everywhere else here.
  const crossBG = crossings.map((c) => c.bgSnap.at)
  const grBetween = await table(grOsrm, crossings.map((c) => c.grSnap.at), crossings.map((c) => c.grSnap.at))
  const gapM = crossings.map((c) => c.gapKm * 1000)
  let viaGreece = 0
  const bestBG = (b, t, back, j) => {
    let pick = t.distances[b][j] == null || t.durations[b][j] == null
      ? null
      : { dur: t.durations[b][j], m: t.distances[b][j], via: false }
    crossings.forEach((_, ci) => crossings.forEach((__, cj) => {
      if (ci === cj) return
      const parts = [
        [legBG.durations[b][ci], legBG.distances[b][ci]],
        [grBetween.durations[ci][cj], grBetween.distances[ci][cj]],
        [back.durations[cj][j], back.distances[cj][j]],
      ]
      if (parts.some(([d, m]) => d == null || m == null)) return
      const dur = parts.reduce((s, [d]) => s + d, 0)
      if (pick == null || dur < pick.dur) {
        pick = { dur, m: parts.reduce((s, [, m]) => s + m, 0) + gapM[ci] + gapM[cj], via: true }
      }
    }))
    return pick
  }
  for (let i = 0; i < bg.places.length; i += batch) {
    const chunk = bg.places.slice(i, i + batch)
    const pts = chunk.map((p) => [p.lat, p.lon])
    const t = await table(bgOsrm, baseLL, pts)
    const back = await table(bgOsrm, crossBG, pts)
    const own = await nearestM(bgOsrm, pts)
    chunk.forEach((p, j) => {
      const far = t.destSnapM[j] > maxSnapM
      const off = !far && jumped('BG', p, t.destSnapM[j], own[j])
      const [m, v] = [0, 1].map((b) => bestBG(b, t, back, j))
      if (!far && !off && (m?.via || v?.via)) viaGreece++
      p.km = far || off || m == null ? null : Math.round(m.m / 1000)
      p.kmV = far || off || v == null ? null : Math.round(v.m / 1000)
      if (far) tooFar.push(`BG ${p.name} (${t.destSnapM[j].toFixed(0)} m)`)
      else if (!off && p.km == null) unroutable.push(`BG ${p.name}`)
    })
    process.stdout.write(`\rBG ${Math.min(i + batch, bg.places.length)}/${bg.places.length}`)
  }
  log('')

  // Greece: crossings → every GR place in the GR graph, then the min over crossings.
  const crossGR = crossings.map((c) => c.grSnap.at)
  const crossingUse = crossings.map(() => 0)
  for (let i = 0; i < gr.places.length; i += batch) {
    const chunk = gr.places.slice(i, i + batch)
    const pts = chunk.map((p) => [p.lat, p.lon])
    const t = await table(grOsrm, crossGR, pts)
    const own = await nearestM(grOsrm, pts)
    chunk.forEach((p, j) => {
      const far = t.destSnapM[j] > maxSnapM
      const off = !far && jumped('GR', p, t.destSnapM[j], own[j])
      const best = baseIds.map((_, b) => {
        let pick = null
        crossings.forEach((c, ci) => {
          const a = legBG.distances[b][ci]
          const z = t.distances[ci][j]
          const ad = legBG.durations[b][ci]
          const zd = t.durations[ci][j]
          if (a == null || z == null || ad == null || zd == null) return
          const dur = ad + zd
          if (pick == null || dur < pick.dur) pick = { dur, m: a + c.gapKm * 1000 + z, ci }
        })
        if (pick && !far && !off) crossingUse[pick.ci]++
        return far || off || pick == null ? null : Math.round(pick.m / 1000)
      })
      p.km = best[0]
      p.kmV = best[1]
      if (far) tooFar.push(`GR ${p.name} (${t.destSnapM[j].toFixed(0)} m)`)
      else if (!off && p.km == null) unroutable.push(`GR ${p.name}`)
    })
    process.stdout.write(`\rGR ${Math.min(i + batch, gr.places.length)}/${gr.places.length}`)
  }
  log('')

  // Stable, gzip-friendly order: by region, then by name.
  const order = (a, b) => a.region - b.region || a.name.localeCompare(b.name, 'bg')
  bg.places.sort(order)
  gr.places.sort(order)

  // Pack, measure, shrink if needed.
  const applied = new Set()
  let packed
  for (let step = 0; ; step++) {
    const bgChunk = packChunk('BG', version, bg.regions, bg.places, applied)
    const grChunk = packChunk('GR', version, gr.regions, gr.places, applied)
    packed = { bg: sizes(bgChunk), gr: sizes(grChunk) }
    const total = packed.bg.gzip + packed.gr.gzip
    log(`sizes${applied.size ? ` after [${[...applied].join(', ')}]` : ''}: ` +
      `bg ${kb(packed.bg.raw)} raw / ${kb(packed.bg.gzip)} gzip, gr ${kb(packed.gr.raw)} raw / ${kb(packed.gr.gzip)} gzip, ` +
      `total ${kb(total)} gzip (budget ${kb(budget)})`)
    if (total <= budget) break
    if (step >= SHRINK_STEPS.length) {
      log(`  WARNING: still over the ${kb(budget)} budget after every shrink step; writing it anyway. ` +
        'Decide with the owner before shipping (the page loads it lazily, but it is still a download).')
      break
    }
    applied.add(SHRINK_STEPS[step].id)
    log(`  over budget → shrinking: drop ${SHRINK_STEPS[step].what}`)
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'bg.json'), packed.bg.text)
  writeFileSync(join(outDir, 'gr.json'), packed.gr.text)
  const meta = {
    v: version,
    source: 'OpenStreetMap (Geofabrik extracts, Overpass API), routed with OSRM car profile, ferries excluded',
    attribution: '© OpenStreetMap contributors (ODbL)',
    bases: BASES,
    cols: PLACE_COLUMNS,
    scale: applied.has('coords-3dp') ? 1000 : 10000,
    shrink: SHRINK_STEPS.filter((s) => applied.has(s.id)).map((s) => s.what),
    crossings: crossings.map((c) => ({ id: c.id, latin: c.latin, bg: c.bgSnap.at, gr: c.grSnap.at, gapKm: +c.gapKm.toFixed(2) })),
    counts: { BG: bg.places.length, GR: gr.places.length, unroutable: unroutable.length + tooFar.length + jumps.length },
    bytes: { bg: { raw: packed.bg.raw, gzip: packed.bg.gzip }, gr: { raw: packed.gr.raw, gzip: packed.gr.gzip } },
  }
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')

  // Report.
  log(`\nBG ${bg.places.length}, GR ${gr.places.length}; unroutable ${unroutable.length}, ` +
    `no road within ${maxSnapM} m ${tooFar.length}, component jumps over ${maxJumpM} m ${jumps.length}`)
  log(`  BG places faster through Greece from at least one base: ${viaGreece}`)
  log(`  GR place-base pairs per crossing: ${crossings.map((c, ci) => `${c.latin} ${crossingUse[ci]}`).join(', ')}`)
  writeFileSync(join(work, 'unroutable.txt'), [
    ...unroutable,
    ...tooFar.map((s) => `${s} [no road nearby]`),
    ...jumps.map((s) => `${s} [component jump: review; island or broken OSM road]`),
  ].join('\n'))
  log(`  lists in ${join(work, 'unroutable.txt')}`)
  const outliers = []
  for (const p of [...bg.places, ...gr.places]) {
    for (const [b, km] of [['marikostinovo', p.km], ['varna', p.kmV]]) {
      if (km == null) continue
      const line = haversineKm(BASES[b].lat, BASES[b].lon, p.lat, p.lon)
      if (km < line - 3 || (line >= 20 && km > 2.5 * line)) outliers.push(`${p.name} from ${b}: road ${km}, line ${line.toFixed(0)}`)
    }
  }
  writeFileSync(join(work, 'outliers.txt'), outliers.join('\n'))
  log(`  ${outliers.length} ratio outliers → ${join(work, 'outliers.txt')}`)
  for (const name of ['София', 'Θεσσαλονίκη', 'Παραλία Καριανής', 'Бургас', 'Варна', 'Пловдив', 'Καβάλα', 'Αλεξανδρούπολη', 'Гоце Делчев', 'Ιωάννινα']) {
    const p = [...bg.places, ...gr.places].filter((x) => x.name === name).sort((a, b) => RANK[b.place] - RANK[a.place])[0]
    if (!p) continue
    const lm = haversineKm(BASES.marikostinovo.lat, BASES.marikostinovo.lon, p.lat, p.lon)
    const lv = haversineKm(BASES.varna.lat, BASES.varna.lon, p.lat, p.lon)
    log(`  ${name}: Marikostinovo ${p.km} km (line ${lm.toFixed(0)}), Varna ${p.kmV} km (line ${lv.toFixed(0)})`)
  }
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`

// ------------------------------------------------------------------------------------------

const { cmd, opts } = parseArgs(process.argv.slice(2))
const commands = { 'osrm-commands': osrmCommands, places: buildPlaces, distances: buildDistances }
if (!commands[cmd]) {
  console.error('usage: node scripts/delivery/build-distances.mjs <osrm-commands|places|distances> --work <dir> [...]\n' +
    'See the header of this file.')
  process.exit(2)
}
try {
  await commands[cmd](opts)
} catch (err) {
  console.error(`\n${err.message}`)
  process.exit(1)
}
