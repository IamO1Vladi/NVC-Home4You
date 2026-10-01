import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { euro, getBoxConfiguratorCatalog, HAND_MAINTAINED_ROWS } from './boxConfiguratorCatalog.js'
import * as GENERATED from './boxConfiguratorOptions.js'
import { EL_FINISH_NAMES, EL_FINISH_GROUPS, EL_CODE_WORDS } from './boxConfiguratorOptionsEl.js'

// The configurator in Greek (ROADMAP #11).
//
// Before this, the catalogue knew two languages and handed every non-bg visitor the English:
// ~200 option names, the layout subtitles, Cyrillic codes and en-GB prices on
// /el/diamorfotis-box-spitiou -- and from there in the PDF, the enquiry text and the Greek
// autoresponder. Nothing at runtime notices a Greek gap (the fallback is a readable English
// name), so the gaps are caught here: every row has Greek, every generated finish name has
// Greek, and the Greek catalogue as a whole contains no English words and no Cyrillic.
//
// The other half is that bg and en did NOT move. Their visible text is pinned per list below.

const el = getBoxConfiguratorCatalog('el')
const en = getBoxConfiguratorCatalog('en')

const GREEK = /[\u0370-\u03ff\u1f00-\u1fff]/
const CYRILLIC = /[\u0400-\u04ff]/
// A Latin word: three or more letters, at least some lowercase. Codes (D-001, ML9004B,
// HOPPE), plan names (A1), figures and units (600 mm, W/m²K, Kw 1.5) do not match.
const LATIN_WORD = /\b[A-Za-z]*[a-z]{3,}[A-Za-z]*\b/g
const latinWords = (text = '') => text.match(LATIN_WORD) || []
// Proper names printed on the swatch, kept in Latin script inside the Greek name.
const NAMES_KEPT_IN_LATIN = new Set(['Jazz', 'Arista'])

// The fields the page shows a visitor (plan cards, tiles, captions, summary, PDF).
const TEXT_KEYS = new Set(['label', 'subtitle', 'note', 'displayLabel', 'summaryLabel', 'group', 'code', 'marker', 'size'])

/** Every visible text field in a catalogue value, as [path, text]. */
function visibleText(value, path = '', out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => visibleText(item, `${path}[${i}]`, out))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string') {
        if (TEXT_KEYS.has(key)) out.push([`${path}.${key}`, item])
      } else {
        visibleText(item, `${path}.${key}`, out)
      }
    }
  }
  return out
}

const generatedRows = Object.values(GENERATED).flat()

describe('hand-maintained rows', () => {
  const rows = Object.entries(HAND_MAINTAINED_ROWS)
    .flatMap(([list, items]) => items.map((row) => [`${list} ${row.key}`, row]))

  it.each(rows)('%s has a Greek name', (_, row) => {
    expect(typeof row.el).toBe('string')
    expect(row.el.trim()).not.toBe('')
    expect(row.el).toMatch(GREEK)
    expect(row.el).not.toMatch(CYRILLIC)
  })

  it('gives Greek its own spec line wherever the spec has words in it', () => {
    for (const [name, row] of rows) {
      if (!latinWords(row.spec).length) continue
      expect(row.specEl, name).toMatch(GREEK)
      expect(latinWords(row.specEl), name).toEqual([])
    }
  })

  it('gives every marker a two-letter Greek one, distinct within its plan', () => {
    for (const list of [HAND_MAINTAINED_ROWS.APPLIANCE_TYPES, HAND_MAINTAINED_ROWS.GLAZING_UPGRADES]) {
      const byFamily = new Map()
      for (const row of list) {
        expect(row.markerEl, row.key).toMatch(/^[\u0391-\u03a9]{2}$/)
        byFamily.set(row.family || row.key, row.markerEl)
      }
      // The two dishwashers are one family and rightly share a badge; no two
      // different appliances (or openings) may.
      expect(new Set(byFamily.values()).size).toBe(byFamily.size)
    }
  })
})

describe('generated finishes (boxConfiguratorOptions.js has no Greek of its own)', () => {
  const bgNames = [...new Set(generatedRows.map((row) => row.bg).filter(Boolean))]
  const bgGroups = [...new Set(generatedRows.map((row) => row.groupBg).filter(Boolean))]

  // A failure here after a catalogue regeneration means a new finish or series: add its
  // Greek to boxConfiguratorOptionsEl.js, keyed by the Bulgarian the catalogue prints.
  it.each(bgNames)('the finish "%s" has a Greek name', (name) => {
    expect(EL_FINISH_NAMES[name]).toMatch(GREEK)
    expect(EL_FINISH_NAMES[name]).not.toMatch(CYRILLIC)
  })

  it.each(bgGroups)('the series "%s" has a Greek heading', (group) => {
    expect(EL_FINISH_GROUPS[group]).toMatch(GREEK)
    expect(EL_FINISH_GROUPS[group]).not.toMatch(CYRILLIC)
  })

  it('carries no Greek for a finish or series the catalogue no longer has', () => {
    expect(Object.keys(EL_FINISH_NAMES).filter((name) => !bgNames.includes(name))).toEqual([])
    expect(Object.keys(EL_FINISH_GROUPS).filter((group) => !bgGroups.includes(group))).toEqual([])
    const codes = generatedRows.map((row) => row.code)
    expect(Object.keys(EL_CODE_WORDS).filter((code) => !codes.includes(code))).toEqual([])
  })
})

describe('the Greek catalogue', () => {
  const elText = visibleText(el)
  const enText = new Map(visibleText(en))

  it('has the same shape as the English one', () => {
    // The page reads the same fields in every language; Greek only changes the words.
    expect(elText.map(([path]) => path)).toEqual([...enText.keys()])
  })

  it('contains no Cyrillic anywhere', () => {
    const strings = []
    const walk = (value, path) => {
      if (typeof value === 'string') strings.push([path, value])
      else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, `${path}.${k}`))
    }
    walk(el, '')
    expect(strings.filter(([, text]) => CYRILLIC.test(text))).toEqual([])
  })

  it('contains no English words, apart from proper names printed on the swatch', () => {
    const leaks = elText
      .map(([path, text]) => [path, latinWords(text).filter((w) => !NAMES_KEPT_IN_LATIN.has(w))])
      .filter(([, words]) => words.length)
    expect(leaks).toEqual([])
  })

  it('shows no label identical to the English one except codes, figures and units', () => {
    // What may legitimately read the same in both: catalogue codes (D-001, UV-003, X1117,
    // T-05), plan names (A1-C6), PET colour numbers, and sizes or specs made only of figures
    // and units (37 m², 600 mm, U 2.0 W/m²K · 1100 × 950). None of those contains a word.
    const same = elText.filter(([path, text]) => text && enText.get(path) === text)
    expect(same.filter(([, text]) => latinWords(text).length)).toEqual([])
  })

  it('names the layouts in Greek', () => {
    const plan = (key) => el.planOptions.find((p) => p.key === key).subtitle
    expect(plan('A1')).toBe('Σαλόνι και κουζίνα + 1 υπνοδωμάτιο')
    expect(plan('C2')).toBe('Σαλόνι, κουζίνα και χώρος εργασίας + 2 υπνοδωμάτια')
    expect(el.planOptions.every((p) => GREEK.test(p.subtitle))).toBe(true)
  })

  it('agrees "fully equipped" with the room: το μπάνιο, η κουζίνα', () => {
    expect(new Set(el.bathroomOptions.map((o) => o.subtitle))).toEqual(new Set(['Πλήρως εξοπλισμένο']))
    expect(new Set(el.kitchenOptions.map((o) => o.subtitle))).toEqual(new Set(['Πλήρως εξοπλισμένη']))
  })

  it('reads Cyrillic catalogue codes in Latin letters, matching their thumbnails', () => {
    expect(el.bathroomOptions.map((o) => o.code)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'])
    expect(el.kitchenOptions.map((o) => o.code)).toEqual(['K1', 'K2', 'K3', 'K4', 'K5', 'K7', 'K8'])
    expect(el.bathroomDoorOptions.map((o) => o.summaryLabel)).toEqual(['BD-01', 'BD-02', 'BD-03', 'BD-04', 'BD-05', 'BD-06'])
    expect(el.insideDoorStyleOptions[0].code).toBe('VR-01')
    expect(el.exteriorDoorOptions[1].displayLabel).toBe('V-02')
    expect(el.armouredDoorOptions[4].code).toBe('BV-05')
    expect(el.kitchenBenchOptions[0]).toMatchObject({ code: 'M-01', label: 'M-01', displayLabel: 'Ασημένιος δράκος', group: 'Μάρμαρο' })
    // The Greek code is the thumbnail's own slug, upper-cased: one reference, not two.
    for (const option of [...el.bathroomDoorOptions, ...el.insideDoorStyleOptions, ...el.exteriorDoorOptions, ...el.armouredDoorOptions]) {
      expect(option.thumbImage).toMatch(new RegExp(`/${option.code.toLowerCase()}\\.webp$`))
    }
  })

  it('labels the terrazzo UV panel in Greek, not with the Bulgarian word printed as its code', () => {
    const terrazzo = el.uvPanelOptions.find((o) => o.thumbImage.endsWith('/t-r.webp'))
    expect(terrazzo).toMatchObject({ code: 'Τεράτσο', label: 'Τεράτσο', summaryLabel: 'Τεράτσο' })
  })

  it('translates the generated finishes and their series', () => {
    const d001 = el.exteriorFinishGroups.flatMap((g) => g.options).find((o) => o.key === 'd-001')
    expect(d001).toMatchObject({ code: 'D-001', displayLabel: 'Παλαιωμένο γκρι', group: 'Επτά τούβλα' })
    expect(el.exteriorFinishGroups.map((g) => g.label)).toContain('Σοβάς ψεκασμού · κεντρικό λοξότμητο αυλάκι')
    expect(el.vinylFloorOptions.find((o) => o.code === '9013').group).toBe('Σειρά 9000 · Πέτρα και μάρμαρο')
    expect(el.interiorPanelColorOptions[0].group).toBe('Λεία και ματ')
    expect(el.kitchenPetColourOptions.map((o) => o.group)).toEqual(
      expect.arrayContaining(['Γυαλιστερό', 'Ματ', 'Μεταλλικό']))
  })

  it('falls back to English for a finish the Greek map does not know yet', async () => {
    // What a regeneration that adds a decor looks like until it gets its line in
    // boxConfiguratorOptionsEl.js: an English name, never an empty tile or the Bulgarian.
    vi.resetModules()
    vi.doMock('./boxConfiguratorOptionsEl.js', () => ({ EL_FINISH_NAMES: {}, EL_FINISH_GROUPS: {}, EL_CODE_WORDS: {} }))
    try {
      const { getBoxConfiguratorCatalog: withoutGreek } = await import('./boxConfiguratorCatalog.js')
      const d001 = withoutGreek('el').exteriorFinishGroups[0].options[0]
      expect(d001).toMatchObject({ code: 'D-001', displayLabel: 'Antique grey', group: 'Seven brick' })
    } finally {
      vi.doUnmock('./boxConfiguratorOptionsEl.js')
      vi.resetModules()
    }
  })

  it('gives the appliance and opening badges Greek letters', () => {
    expect(el.applianceOptions.map((o) => o.marker)).toEqual(['ΝΡ', 'ΕΣ', 'ΦΡ', 'ΨΥ', 'ΠΠ', 'ΠΠ', 'ΠΡ'])
    expect(el.glazingUpgradeOptions.map((o) => o.marker)).toEqual(['ΠΑ', 'ΣΥ', 'ΠΤ'])
  })
})

describe('euro()', () => {
  it('formats Greek prices the Greek way', () => {
    // "€14,840" reads as fourteen euros to a Greek reader: the comma is the decimal mark.
    expect(euro(14840, 'el')).toBe('14.840\u00a0€')
    expect(euro(1000, 'el')).toBe('1.000\u00a0€')
  })

  it('leaves Bulgarian and English exactly as they were', () => {
    expect(euro(14840, 'bg')).toBe('14\u00a0840\u00a0€')
    expect(euro(1000, 'bg')).toBe('1000\u00a0€')
    expect(euro(14840, 'en')).toBe('€14,840')
    expect(euro(14840)).toBe('€14,840')
  })
})

describe('bg and en did not move', () => {
  // A fingerprint of every visible text field, per list, taken from the catalogue as it was
  // BEFORE the Greek work (and checked field by field against a full dump of that version).
  // A failure names the list. If the change to bg or en is deliberate, replace that line
  // with the value the failure prints.
  const PINNED = {
    bg: {
      models: '6e8b3d5a395e10c0',
      planOptions: '99ee5cf1139c74ea',
      bathroomOptions: '9dda31dd63ca7ad4',
      bathroomDoorOptions: 'ee3b9bc96927e80d',
      vanityOptions: '485f7dadc2bf68db',
      vanitySizeOptions: 'b7f473d4c972b1ec',
      kitchenOptions: 'f849c859720c871a',
      kitchenSinkOptions: '622ea7fc50aa4faf',
      kitchenPetColourOptions: '8ce162627bb37e80',
      kitchenBenchOptions: '8c0fe8e488432e19',
      applianceOptions: '3a5fd9e2c7daaa54',
      windowTypeOptions: '4f56adf8a952ecdd',
      windowBasicColourOptions: '1d6911c0555313ad',
      windowDecorOptions: '3b9a7b896cfe3d0e',
      glazingUpgradeOptions: 'a6bb155099547e69',
      steelFrameColorOptions: 'fb694b1062c8ac94',
      exteriorDoorOptions: '8f4a69baf8453911',
      armouredDoorOptions: 'df9d383856f3d866',
      insideDoorStyleOptions: '321a569ba5f1b60a',
      exteriorFinishGroups: '54818c897dc415ef',
      deckingColorOptions: '10d511134612508b',
      terraceOptions: 'e4c6a02d51b88d27',
      interiorPanelColorOptions: 'a16a6b6cb919ec21',
      uvPanelOptions: 'b392f61fdf301613',
      vinylFloorOptions: '8e5e015474c1c147',
      herringboneFloorOptions: '31163da9b5220306',
      carbonCrystalOptions: 'd06a1e8554d2f6f1',
    },
    en: {
      models: '2b2e89149a10a0f0',
      planOptions: '1d0eef3f109898fe',
      bathroomOptions: 'dc82be58c7111ea3',
      bathroomDoorOptions: 'b0badc15e0d1229e',
      vanityOptions: '7138005080de8086',
      vanitySizeOptions: '5bfa12844a9f9734',
      kitchenOptions: '730bd02070be7920',
      kitchenSinkOptions: 'da46b478264c24a4',
      kitchenPetColourOptions: '2a89329169c21e53',
      kitchenBenchOptions: '1a73f3a22cf9060a',
      applianceOptions: '95a825c7139d47a4',
      windowTypeOptions: '4d6ed49e914a36fb',
      windowBasicColourOptions: '32cda568e90114d2',
      windowDecorOptions: '1a1a014d5e02b030',
      glazingUpgradeOptions: '642f3f61e79b9b3c',
      steelFrameColorOptions: '64bf65d48a261dbe',
      exteriorDoorOptions: '3d2ae504d400613b',
      armouredDoorOptions: 'f11f0d355cd7417c',
      insideDoorStyleOptions: 'eef1d87ecef78a5e',
      exteriorFinishGroups: '99ed1182c0d5d8d6',
      deckingColorOptions: '10d511134612508b',
      terraceOptions: 'e0b29d6ca56cc453',
      interiorPanelColorOptions: 'edad3521f6c889be',
      uvPanelOptions: 'b392f61fdf301613',
      vinylFloorOptions: 'aca951c2d7a2cfc0',
      herringboneFloorOptions: '5cf30861edd62eba',
      carbonCrystalOptions: 'bdcbf60e4135905e',
    },
  }

  const fingerprint = (value) => createHash('sha256')
    .update(visibleText(value).map(([path, text]) => `${path}=${text}`).join('\n'))
    .digest('hex')
    .slice(0, 16)

  for (const locale of ['bg', 'en']) {
    it(`${locale}: every list reads as before`, () => {
      const catalog = getBoxConfiguratorCatalog(locale)
      const actual = Object.fromEntries(Object.keys(catalog)
        .filter((list) => visibleText(catalog[list]).length)
        .map((list) => [list, fingerprint(catalog[list])]))
      expect(actual).toEqual(PINNED[locale])
    })
  }
})
