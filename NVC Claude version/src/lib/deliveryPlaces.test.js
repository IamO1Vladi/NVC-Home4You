import { describe, expect, it } from 'vitest'
import {
  BASES,
  PLACE_COLUMNS,
  cyrillicToGreek,
  decodeChunk,
  displayName,
  displayRegion,
  distanceFor,
  haversineKm,
  loadPlaces,
  nearestPlace,
  greekToCyrillic,
  normalize,
  romanize,
  search,
} from './deliveryPlaces.js'

// Two layers. The behaviour tests run on a small hand-made chunk in the real column format, so
// they pin search, folding and the product rules whatever the data says. The data tests run on
// the generated table (src/content/shared/deliveryPlaces/*.json) and are skipped, loudly, until
// scripts/delivery/build-distances.mjs has produced it.

// ------------------------------------------------------------------------------------------
// Fixture (km values are illustrative, not measured)

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
  return { v: '2026-10-15', c, scale: 10000, regions, cols: PLACE_COLUMNS, data }
}

const BG = chunk('BG', [['Бургас', 'Burgas'], ['София (столица)', 'Sofia City'], ['Благоевград', 'Blagoevgrad'], ['Варна', 'Varna']], [
  { name: 'Бургас', el: 'Μπουργκάς', t: 3, r: 0, lat: 42.4977, lon: 27.4710, km: 390, kmV: 130 },
  { name: 'София', el: 'Σόφια', t: 3, r: 1, lat: 42.6977, lon: 23.3219, km: 178, kmV: 470 },
  { name: 'Черни връх', t: 1, r: 0, lat: 42.5390, lon: 27.2850, km: 380, kmV: 125 },
  { name: 'Марикостиново', t: 1, r: 2, lat: 41.4317, lon: 23.3381, km: 0, kmV: 520 },
  { name: 'Варна', el: 'Βάρνα', t: 3, r: 3, lat: 43.2141, lon: 27.9147, km: 520, kmV: 0 },
  { name: 'Бургасово', t: 1, r: 0, lat: 42.4, lon: 27.3, km: 380, kmV: 140 },
  { name: 'Кърджали', t: 3, lat: 41.6500, lon: 25.3700, km: 260, kmV: 330 },
  { name: 'Велико Търново', t: 3, lat: 43.0757, lon: 25.6172, km: 390, kmV: 230 },
])
const GR = chunk('GR', [['Π.Ε. Θεσσαλονίκης', 'Thessaloniki'], ['Π.Ε. Καβάλας', 'Kavala'], ['Π.Ε. Ηρακλείου', 'Heraklion']], [
  { name: 'Θεσσαλονίκη', bg: 'Солун', t: 3, r: 0, lat: 40.6403, lon: 22.9353, km: 105, kmV: 600 },
  { name: 'Παραλία Καριανής', t: 1, r: 1, lat: 40.7876, lon: 24.0907, km: 120, kmV: 590 },
  { name: 'Καριανή', t: 1, r: 1, lat: 40.7986, lon: 24.0717, km: 118, kmV: 588 },
  { name: 'Αρχάνες', t: 2, r: 2, lat: 35.2370, lon: 25.1600, km: null, kmV: null },
])

const PLACES = [...decodeChunk(BG), ...decodeChunk(GR)]
const byName = (n) => PLACES.find((p) => p.name === n)

// ------------------------------------------------------------------------------------------

describe('normalize', () => {
  it('folds Cyrillic, Greek and Latin spellings to one skeleton', () => {
    expect(normalize('Бургас')).toBe('burgas')
    expect(normalize('Burgas')).toBe('burgas')
    expect(normalize('Μπουργκάς')).toBe('burgas')
    expect(normalize('София')).toBe(normalize('Sofia'))
    expect(normalize('Σόφια')).toBe(normalize('Sofiya'))
    expect(normalize('Θεσσαλονίκη')).toBe(normalize('Thessaloniki'))
    expect(normalize('Ναύπλιο')).toBe(normalize('Nafplio'))
    expect(normalize('Αλεξανδρούπολη')).toBe(normalize('Alexandroupoli'))
    expect(normalize('Чепеларе')).toBe(normalize('Chepelare'))
    expect(normalize('Щъркелово')).toBe(normalize('Shtarkelovo'))
    expect(normalize('Райково')).toBe(normalize('Raykovo'))
  })

  it('makes the Bulgarian spelling of a Greek village a prefix of the Greek one', () => {
    expect(normalize('Παραλία Καριανής').startsWith(normalize('Паралия Кариани'))).toBe(true)
  })

  it('ignores case, accents and punctuation', () => {
    expect(normalize('  ÁGIOS-Nikólaos ')).toBe(normalize('Άγιος Νικόλαος'))
    expect(normalize('')).toBe('')
    expect(normalize(null)).toBe('')
  })
})

describe('romanize', () => {
  it('gives readable Latin for Bulgarian and Greek names', () => {
    expect(romanize('София')).toBe('Sofia')
    expect(romanize('Райково')).toBe('Raykovo')
    expect(romanize('Гоце Делчев')).toBe('Gotse Delchev')
    expect(romanize('Παραλία Καριανής')).toBe('Paralia Karianis')
    expect(romanize('Θεσσαλονίκη')).toBe('Thessaloniki')
    expect(romanize('Ναύπλιο')).toBe('Nafplio')
  })
})

describe('display names', () => {
  it('shows the reader’s script, spelling the other country’s names out in it', () => {
    const burgas = byName('Бургас')
    expect(displayName(burgas, 'bg')).toBe('Бургас')
    expect(displayName(burgas, 'el')).toBe('Μπουργκάς')
    expect(displayName(burgas, 'en')).toBe('Burgas')
    const kariani = byName('Παραλία Καριανής')
    expect(displayName(kariani, 'el')).toBe('Παραλία Καριανής')
    expect(displayName(kariani, 'bg')).toBe('Паралия Карианис')
    expect(displayName(kariani, 'en')).toBe('Paralia Karianis')
    expect(displayName(byName('Θεσσαλονίκη'), 'bg')).toBe('Солун')
    expect(displayRegion(kariani, 'el')).toBe('Π.Ε. Καβάλας')
    // The other country's region in the reader's script, and Latin only in English.
    expect(displayRegion(kariani, 'bg')).toBe('Кавала')
    expect(displayRegion(kariani, 'en')).toBe('Kavala')
    expect(displayRegion(burgas, 'bg')).toBe('Бургас')
    expect(displayRegion(burgas, 'el')).toBe('Μπουργκάς')
  })

  it('spells Greek names in Cyrillic and Bulgarian ones in Greek', () => {
    expect(greekToCyrillic('Νέα Πέραμος')).toBe('Неа Перамос')
    expect(greekToCyrillic('Νέα Ηρακλείτσα')).toBe('Неа Ираклица')
    expect(greekToCyrillic('Κάριανη')).toBe('Кариани')
    expect(greekToCyrillic('Ελευθερούπολη')).toBe('Елефтеруполи')
    expect(greekToCyrillic('Γιαννιτσά')).toBe('Яница')
    expect(greekToCyrillic('Αγία Μαρίνα')).toBe('Агия Марина')
    expect(greekToCyrillic('Λαγκαδάς')).toBe('Лангадас')
    expect(cyrillicToGreek('Стара Кресна')).toBe('Σταρα Κρεσνα')
    expect(cyrillicToGreek('Ямбол')).toBe('Γιαμπολ')
    expect(cyrillicToGreek('Джебел')).toBe('Τζεμπελ')
  })
})

describe('search', () => {
  it('puts the Bulgarian city Burgas first for "Бургас", Greek and Latin spellings alike', () => {
    for (const q of ['Бургас', 'Burgas', 'Μπουργκάς', 'burgas', 'БУРГАС']) {
      const r = search(q, PLACES, { locale: 'bg' })
      expect(r[0].place.name, q).toBe('Бургас')
      expect(r[0].tier).toBe(3)
    }
  })

  it('ranks exact > prefix > word-prefix', () => {
    const r = search('Бурга', PLACES)
    expect(r.map((x) => x.place.name)).toEqual(['Бургас', 'Бургасово'])
    const w = search('Кариан', PLACES)
    // "Καριανή" is a prefix hit; "Παραλία Καριανής" only matches on its second word.
    expect(w.map((x) => x.place.name)).toEqual(['Καριανή', 'Παραλία Καριανής'])
    expect(w[0].tier).toBeGreaterThan(w[1].tier)
  })

  it('finds Παραλία Καριανής from the Bulgarian spelling', () => {
    expect(search('Паралия Кариани', PLACES)[0].place.name).toBe('Παραλία Καριανής')
    expect(search('paralia kariani', PLACES)[0].place.name).toBe('Παραλία Καριανής')
  })

  it('finds the town in a pasted street address', () => {
    expect(search('София, бул. Черни връх 1', PLACES)[0].place.name).toBe('София')
    expect(search('ул. Александровска 12, 8000 Бургас, България', PLACES)[0].place.name).toBe('Бургас')
    expect(search('Οδός Τσιμισκή 5, Θεσσαλονίκη', PLACES)[0].place.name).toBe('Θεσσαλονίκη')
  })

  it('ranks the town above a same-named street, and reads addresses without commas', () => {
    // Черни връх is both a village in the fixture and the boulevard in the address.
    expect(search('бул. Черни връх 1, Бургасово', PLACES)[0].place.name).toBe('Бургасово')
    expect(search('Бургас ул. Александровска 12', PLACES)[0].place.name).toBe('Бургас')
    expect(search('Θεσσαλονίκη Τσιμισκή 5', PLACES)[0].place.name).toBe('Θεσσαλονίκη')
  })

  it('drops address words whose folded form differs from their spelling', () => {
    // "street" folds to "stret", "площад" to "plostad", "Πλατεία" to "platia", "Greece" to "greke".
    expect(search('Burgas Street', PLACES)[0].place.name).toBe('Бургас')
    expect(search('площад Бургас', PLACES)[0].place.name).toBe('Бургас')
    expect(search('Πλατεία Αριστοτέλους 1, Θεσσαλονίκη 546 24, Ελλάδα', PLACES)[0].place.name).toBe('Θεσσαλονίκη')
    expect(search('Thessaloniki Greece', PLACES)[0].place.name).toBe('Θεσσαλονίκη')
    expect(search('Thessaloniki Hellas', PLACES)[0].place.name).toBe('Θεσσαλονίκη')
  })

  it('accepts the older Latin spellings of ъ and дж', () => {
    for (const q of ['Kardzhali', 'Kardjali', 'Kurdzhali', 'Кърджали']) {
      expect(search(q, PLACES)[0]?.place.name, q).toBe('Кърджали')
    }
    for (const q of ['Veliko Tarnovo', 'Veliko Turnovo', 'Turnovo']) {
      expect(search(q, PLACES)[0]?.place.name, q).toBe('Велико Търново')
    }
  })

  it('returns display names for the locale and respects the limit', () => {
    const r = search('Солун', PLACES, { locale: 'en', limit: 1 })
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Thessaloniki')
    expect(search('', PLACES)).toEqual([])
    expect(search('zzzz', PLACES)).toEqual([])
  })
})

describe('nearestPlace', () => {
  it('maps a tap to the nearest place', () => {
    const r = nearestPlace(42.69, 23.33, PLACES)
    expect(r.place.name).toBe('София')
    expect(r.km).toBeLessThan(2)
    expect(nearestPlace(42.69, 23.33, PLACES, { maxKm: 0.1 })).toBeNull()
    expect(nearestPlace(42, 23, [])).toBeNull()
  })
})

describe('distanceFor', () => {
  it('uses the nearer base for Box houses and Marikostinovo for containers and projects', () => {
    const burgas = byName('Бургас')
    expect(distanceFor(burgas, 'box')).toEqual({ km: 130, base: 'varna' })
    expect(distanceFor(burgas, 'container')).toEqual({ km: 390, base: 'marikostinovo' })
    expect(distanceFor(burgas, 'project')).toEqual({ km: 390, base: 'marikostinovo' })
    expect(distanceFor(byName('София'), 'box')).toEqual({ km: 178, base: 'marikostinovo' })
  })

  it('returns null km ("on request") for a ferry-only place', () => {
    const archanes = byName('Αρχάνες')
    expect(distanceFor(archanes, 'box')).toEqual({ km: null, base: null })
    expect(distanceFor(archanes, 'container')).toEqual({ km: null, base: null })
  })
})

describe('loadPlaces', () => {
  it('decodes chunks from loaders in parallel, BG first', async () => {
    const places = await loadPlaces({
      loaders: { 'gr.json': async () => GR, 'bg.json': async () => ({ default: BG }) },
    })
    expect(places).toHaveLength(PLACES.length)
    expect(places[0].country).toBe('BG')
    expect(places.at(-1).country).toBe('GR')
  })

  it('says how to build the data when a chunk is missing', async () => {
    await expect(loadPlaces({ loaders: { 'bg.json': async () => BG } })).rejects.toThrow(/build-distances/)
  })
})

// ------------------------------------------------------------------------------------------
// The generated table

const real = await loadPlaces().catch(() => null)
if (!real) {
  console.warn('deliveryPlaces: generated data not found — data tests skipped. Run scripts/delivery/build-distances.mjs.')
}

describe.skipIf(!real)('generated data', () => {
  const places = real || []
  const find = (name, country) =>
    places.filter((p) => p.name === name && (!country || p.country === country)).sort((a, b) => b.rank - a.rank)[0]
  const line = (base, p) => haversineKm(BASES[base].lat, BASES[base].lon, p.lat, p.lon)

  it('has both countries and every row well-formed', () => {
    expect(places.filter((p) => p.country === 'BG').length).toBeGreaterThan(4000)
    expect(places.filter((p) => p.country === 'GR').length).toBeGreaterThan(5000)
    for (const p of places) {
      expect(typeof p.name === 'string' && p.name.length > 0).toBe(true)
      expect([1, 2, 3]).toContain(p.rank)
      expect(p.lat).toBeGreaterThan(34.5)
      expect(p.lat).toBeLessThan(44.3)
      expect(p.lon).toBeGreaterThan(19.3)
      expect(p.lon).toBeLessThan(29.7)
      for (const km of [p.km.marikostinovo, p.km.varna]) {
        expect(km === null || (Number.isInteger(km) && km >= 0)).toBe(true)
      }
      expect(p.keys.length).toBeGreaterThan(0)
    }
  })

  it('road km is at least the straight line and at most 3.6× it', () => {
    const outliers = []
    for (const p of places) {
      for (const base of ['marikostinovo', 'varna']) {
        const km = p.km[base]
        if (km == null) continue
        const l = line(base, p)
        // 3 km slack below (rounding, snapping to the nearest road); the ceiling only where the
        // straight line is long enough for a ratio to mean something. 3.6×, not less: distances
        // follow the FASTEST route, and from Marikostinovo the villages north of Chepelare
        // (Хвойна, Забърдо, Орехово…) are quicker round by the Sofia–Plovdiv motorway (~380 km)
        // than over the Rhodope passes (~210 km, an hour slower), which is what a lorry with a
        // house on it would do too. Measured 2026-10-15: the worst is Забърдо at 3.57×.
        if (km < l - 3 || (l >= 20 && km > 3.6 * l)) outliers.push(`${p.name} ${base} ${km} vs ${l.toFixed(0)}`)
      }
    }
    if (outliers.length) console.warn(`deliveryPlaces outliers (${outliers.length}):\n${outliers.slice(0, 50).join('\n')}`)
    expect(outliers).toEqual([])
  })

  it('pins plausible distances', () => {
    const sofia = find('София', 'BG')
    expect(sofia.km.marikostinovo).toBeGreaterThanOrEqual(165)
    expect(sofia.km.marikostinovo).toBeLessThanOrEqual(190)
    const thess = find('Θεσσαλονίκη', 'GR')
    expect(thess.km.marikostinovo).toBeGreaterThanOrEqual(90)
    expect(thess.km.marikostinovo).toBeLessThanOrEqual(120)
    // Paralia Kariani, the published case, is not a place of its own in OSM: the beach belongs
    // to the village of Kariani (Κάριανη, Kavala).
    const kariani = find('Κάριανη', 'GR')
    expect(kariani.km.marikostinovo).toBeGreaterThanOrEqual(105)
    expect(kariani.km.marikostinovo).toBeLessThanOrEqual(135)
    const varna = find('Варна', 'BG')
    expect(varna.km.varna).toBeGreaterThanOrEqual(0)
    expect(varna.km.varna).toBeLessThanOrEqual(5)
    const burgas = find('Бургас', 'BG')
    expect(burgas.km.varna).toBeLessThan(burgas.km.marikostinovo)
    expect(distanceFor(burgas, 'box').base).toBe('varna')
  })

  it('finds Burgas, Thessaloniki and Paralia Kariani in any script', () => {
    for (const q of ['Бургас', 'Burgas', 'Μπουργκάς']) {
      const top = search(q, places)[0].place
      expect(top.country, q).toBe('BG')
      expect(top.name, q).toBe('Бургас')
    }
    for (const q of ['Θεσσαλονίκη', 'Thessaloniki', 'Солун']) {
      expect(search(q, places)[0].place.name, q).toBe('Θεσσαλονίκη')
    }
    expect(search('Паралия Кариани', places)[0].place.name).toBe('Κάριανη')
    expect(search('Paralia Kariani', places)[0].place.name).toBe('Κάριανη')
    // The case's Greek name is the genitive: "the beach of Kariani".
    expect(search('Παραλία Καριανής', places)[0].place.name).toBe('Κάριανη')
    expect(search('София, бул. Черни връх 1', places)[0].place.name).toBe('София')
  })

  it('names Burgas for a Greek reader as Μπουργκάς, not OSM’s historical Πύργος', () => {
    const burgas = find('Бургас', 'BG')
    expect(displayName(burgas, 'el')).toBe('Μπουργκάς')
    expect(search('Πύργος', places, { limit: 20 }).some((x) => x.place === burgas)).toBe(true)
  })

  it('names Greek places for a Bulgarian reader as they are said today, not OSM’s old names', () => {
    // OSM's name:bg here is Кале чифлик, Долна Локвица, Седес, Леригово, Гюмурджина, Дедеагач.
    const bgName = (q) => search(q, places, { locale: 'bg' })[0]?.name
    expect(bgName('Неа Перамос')).toBe('Неа Перамос')
    expect(bgName('Офринио')).toBe('Офринио')
    expect(bgName('Терми')).toBe('Терми')
    expect(bgName('Арнеа')).toBe('Арнеа')
    expect(bgName('Комотини')).toBe('Комотини')
    expect(bgName('Александруполис')).toBe('Александруполис')
    // The old name still finds the place.
    expect(search('Дедеагач', places, { locale: 'bg' })[0].name).toBe('Александруполис')
    // The case's village, as the page's example table writes it.
    expect(displayName(find('Κάριανη', 'GR'), 'bg')).toBe('Кариани')
    expect(displayName(find('Θεσσαλονίκη', 'GR'), 'bg')).toBe('Солун')
  })

  it('names Bulgarian places for a Greek reader in Greek, OSM’s misspellings fixed', () => {
    expect(displayName(find('Марикостиново', 'BG'), 'el')).toBe('Μαρικοστίνοβο')
    expect(displayName(find('Крумовград', 'BG'), 'el')).toBe('Κρούμοβγκραντ')
    expect(displayName(find('Царево', 'BG'), 'el')).toBe('Τσάρεβο')
    expect(displayName(find('Стара Кресна', 'BG'), 'el')).toBe('Σταρα Κρεσνα')
  })

  it('never shows a Latin region on the Bulgarian or Greek page', () => {
    for (const place of places) {
      for (const locale of ['bg', 'el']) expect(displayRegion(place, locale), place.name).not.toMatch(/[A-Za-z]/)
    }
  })

  // A place within this many km of a point, by name (the table has many same-named villages).
  const near = (name, lat, lon, km = 3) =>
    places.filter((p) => p.name === name && haversineKm(lat, lon, p.lat, p.lon) <= km)

  it('gives ferry-only islands no distance, near-shore ones included', () => {
    // Bounding boxes that hold only island land (no mainland village inside).
    const boxes = {
      Corfu: [39.35, 39.8, 19.6, 20.0],
      Thasos: [40.52, 40.81, 24.5, 24.8],
      'Kefalonia+Ithaca': [38.0, 38.5, 20.3, 20.8],
      Lesvos: [38.95, 39.4, 25.8, 26.65],
      Samothraki: [40.4, 40.52, 25.4, 25.7],
      Rhodes: [35.85, 36.47, 27.68, 28.25],
    }
    for (const [island, [la1, la2, lo1, lo2]] of Object.entries(boxes)) {
      const on = places.filter((p) => p.country === 'GR' && p.lat > la1 && p.lat < la2 && p.lon > lo1 && p.lon < lo2)
      expect(on.length, island).toBeGreaterThan(3)
      for (const p of on) expect(distanceFor(p, 'box').km, `${island}: ${p.name}`).toBeNull()
    }
    // Islands a few hundred metres to 2 km off the mainland: the trap is OSRM falling back from
    // the island's small road network to the mainland road across the channel.
    for (const [name, lat, lon] of [
      ['Πόρος', 37.4990, 23.4545], ['Σαλαμίνα', 37.9640, 23.4990], ['Αίγινα', 37.7470, 23.4280],
      ['Ύδρα', 37.3500, 23.4650], ['Σπέτσες', 37.2630, 23.1580], ['Ελαφόνησος', 36.4870, 22.9720],
      ['Τριζόνια', 38.3660, 22.0730], ['Σκιάθος', 39.1620, 23.4900],
    ]) {
      for (const p of near(name, lat, lon)) expect(distanceFor(p, 'box').km, name).toBeNull()
    }
  })

  it('routes over bridges and causeways (Lefkada, Euboea, Rio-Antirrio, the Peloponnese)', () => {
    for (const [name, lat, lon] of [
      ['Λευκάδα', 38.8310, 20.7070], ['Χαλκίδα', 38.4630, 23.5990], ['Πάτρα', 38.2460, 21.7350],
      ['Ναύπλιο', 37.5670, 22.8020], ['Καλαμάτα', 37.0390, 22.1140], ['Ναύπακτος', 38.3920, 21.8280],
    ]) {
      const hit = near(name, lat, lon)
      expect(hit.length, name).toBeGreaterThan(0)
      expect(hit[0].km.marikostinovo, name).not.toBeNull()
    }
  })

  // Sanity bounds from the map, deliberately wide: they catch a wrong crossing, a wrong base or
  // a ferry leg, not a few km of routing difference. [name, country, base, min, max]
  it.each([
    ['Петрич', 'BG', 'marikostinovo', 8, 30],
    ['Сандански', 'BG', 'marikostinovo', 15, 45],
    ['Пловдив', 'BG', 'marikostinovo', 220, 350],
    ['Бургас', 'BG', 'varna', 115, 150],
    ['Созопол', 'BG', 'varna', 140, 190],
    ['Балчик', 'BG', 'varna', 35, 65],
    ['Варна', 'BG', 'marikostinovo', 500, 680],
    ['Καβάλα', 'GR', 'marikostinovo', 120, 210],
    ['Αλεξανδρούπολη', 'GR', 'marikostinovo', 270, 400],
    ['Νέος Μαρμαράς', 'GR', 'marikostinovo', 180, 290],
    ['Ιωάννινα', 'GR', 'marikostinovo', 320, 440],
    ['Αθήνα', 'GR', 'marikostinovo', 550, 700],
    ['Καλαμάτα', 'GR', 'marikostinovo', 740, 950],
    ['Ορμένιο', 'GR', 'varna', 230, 380],
  ])('%s (%s) from %s is %i-%i km', (name, cc, base, lo, hi) => {
    const p = find(name, cc)
    expect(p, name).toBeTruthy()
    expect(p.km[base]).toBeGreaterThanOrEqual(lo)
    expect(p.km[base]).toBeLessThanOrEqual(hi)
  })

  it('gives a Crete village no distance (ferry only)', () => {
    const crete = places.filter((p) => p.country === 'GR' && p.lat < 35.7 && p.lat > 34.8 && p.lon > 23.4 && p.lon < 26.4)
    expect(crete.length).toBeGreaterThan(100)
    for (const p of crete) expect(distanceFor(p, 'box').km).toBeNull()
  })
})
