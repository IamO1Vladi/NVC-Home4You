import {
  FACADE_PANEL_OPTIONS,
  VINYL_FLOOR_OPTIONS,
  HERRINGBONE_FLOOR_OPTIONS,
  UV_PANEL_OPTIONS,
  KITCHEN_BENCH_OPTIONS,
  INTERIOR_PANEL_OPTIONS,
  KITCHEN_PET_COLOUR_OPTIONS,
  DECKING_OPTIONS,
} from './boxConfiguratorOptions'

// Everything here follows the NVC-HOME4YOU 2026 catalogue. Options the
// catalogue marks as a surcharge without printing a figure carry
// `onRequest: true`: they stay selectable and appear in the summary as a
// quotation line instead of moving the running total.

const byLocale = (locale, en, bg) => (locale === 'bg' ? bg : en)

// Thumbnails are stored under an ASCII slug of the catalogue code, because
// Cyrillic codes (БД-01, ВР-02, В-01) make brittle URLs. The printed code
// still shows on the label -- only the filename is transliterated.
const TRANSLIT = { Б: 'b', Д: 'd', В: 'v', Р: 'r', М: 'm', К: 'k', Т: 't' }
const thumbSlug = (code = '') => [...code]
  .map((ch) => TRANSLIT[ch] || ch)
  .join('')
  .replace(/[^A-Za-z0-9._-]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase()
const INTERNAL_WALLS_BASE_37 = 1300
const scaleInternalWallsPrice = (area) => Math.round((INTERNAL_WALLS_BASE_37 * area) / 37)

export function euro(value, locale = 'en') {
  return new Intl.NumberFormat(locale === 'bg' ? 'bg-BG' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

const STEEL_FRAME_COLORS = [
  { key: 'black', en: 'Black', bg: 'Черно', swatch: '#22262b', thumb: 'thumbs/frame-colours/black.webp' },
  { key: 'matte-white', en: 'Matte white', bg: 'Матово бяло', swatch: '#f2f3ee', thumb: 'thumbs/frame-colours/matte-white.webp' },
  { key: 'light-grey', en: 'Light grey', bg: 'Светло сиво', swatch: '#b6b9b7', thumb: 'thumbs/frame-colours/light-grey.webp' },
  { key: 'dark-grey', en: 'Dark grey', bg: 'Тъмно сиво', swatch: '#5a5f61', thumb: 'thumbs/frame-colours/dark-grey.webp' },
  { key: 'brown', en: 'Brown', bg: 'Кафяво', swatch: '#5b3a2a', thumb: 'thumbs/frame-colours/brown.webp' },
]

// Every window type in the catalogue, in one list. The first three are the
// base glazings from p.20; the last three are the upgraded profile systems
// from p.21. They are all just window types as far as the buyer is concerned,
// so they share a single choice -- but they don't share a colour range:
// the base glazings come in black / white / grey, the upgraded systems in the
// nine catalogue decors. `colourSet` says which palette a type unlocks.
const WINDOW_TYPES = [
  { key: 'pvc-double', code: 'W-PVC-DOUBLE', en: 'PVC, double glazing', bg: 'PVC, двоен стъклопакет', spec: 'U 2.0 W/m²K · 1100 × 950', price: 0, colourSet: 'basic' },
  { key: 'alu-double', code: 'W-ALU-DOUBLE', en: 'Aluminium, double glazing', bg: 'Алуминий, двоен стъклопакет', spec: 'U 1.7–2.0 W/m²K · 1100 × 950', price: 0, colourSet: 'basic' },
  { key: 'alu-triple', code: 'W-ALU-TRIPLE', en: 'Aluminium, triple glazing', bg: 'Алуминий, троен стъклопакет', spec: 'U 1.5–1.8 W/m²K · 1200 × 950', price: 200, colourSet: 'basic' },
  { key: 'ws-65', code: 'WS-65', en: '65 mm · double glazing', bg: '65 мм · двоен стъклопакет', spec: 'Kw 1.5 · class B · ROTO · HOPPE', price: 250, colourSet: 'decor' },
  { key: 'ws-70', code: 'WS-70', en: '70 mm · triple glazing', bg: '70 мм · троен стъклопакет', spec: 'Kw 1.3 · class A · ROTO · HOPPE', price: 290, colourSet: 'decor' },
  { key: 'ws-80', code: 'WS-80', en: 'ZEW 80MD⁺ · 80 mm passive', bg: 'ZEW 80MD⁺ · 80 мм пасивен', spec: 'Kw 1.0 · class A · MACO · HOPPE · RC2', price: 350, colourSet: 'decor' },
]

// The three colours the base glazings ship in (catalogue p.8).
const WINDOW_BASIC_COLOURS = [
  { key: 'window-black', en: 'Black', bg: 'Черно', swatch: '#22262b' },
  { key: 'window-white', en: 'White', bg: 'Бяло', swatch: '#f2f3ee' },
  { key: 'window-grey', en: 'Grey', bg: 'Сиво', swatch: '#8d9499' },
]

const GLAZING_UPGRADES = [
  { key: 'gz-panorama', code: 'GZ-PANORAMA', en: 'Panoramic fixed glass', bg: 'Панорамно стъкло', spec: 'max 2000 × 1000 · U 1.5–2.0 W/m²K', price: 300, unit: 'window', marker: 'P' },
  { key: 'gz-sliding', code: 'GZ-SLIDING', en: 'Sliding door', bg: 'Плъзгаща врата', spec: '2000 × 1800 · 900 mm leaves', price: 430, unit: 'door', marker: 'S' },
  { key: 'gz-bifold', code: 'GZ-BIFOLD', en: 'Bi-folding door', bg: '“Bi-folding” врата', spec: '2100 × 1900 · U 1.8–2.0 W/m²K', price: 900, unit: 'door', marker: 'B' },
]

const BATHROOM_DOORS = [
  { key: 'bd-01', code: 'БД-01', en: 'Frosted grey glass, white frame', bg: 'Матово сиво стъкло, бяла каса', price: 0 },
  { key: 'bd-02', code: 'БД-02', en: 'Frosted grey glass, black frame', bg: 'Матово сиво стъкло, черна каса', price: 0 },
  { key: 'bd-03', code: 'БД-03', en: 'Reeded glass, white frame', bg: 'Рифелно стъкло, бяла каса', price: 100 },
  { key: 'bd-04', code: 'БД-04', en: 'Reeded glass, walnut frame', bg: 'Рифелно стъкло, каса орех', price: 100 },
  { key: 'bd-05', code: 'БД-05', en: 'Frosted grey glass, dark walnut frame', bg: 'Матово сиво стъкло, каса тъмен орех', price: 100 },
  { key: 'bd-06', code: 'БД-06', en: 'Frosted grey glass, walnut frame', bg: 'Матово сиво стъкло, каса орех', price: 100 },
]

// Named from the catalogue artwork -- the codes alone tell a buyer nothing.
const INTERIOR_DOORS = [
  { key: 'vr-01', code: 'ВР-01', en: 'Plain white', bg: 'Гладка бяла', price: 0 },
  { key: 'vr-02', code: 'ВР-02', en: 'White with inlay line', bg: 'Бяла с вертикална вложка', price: 100 },
  { key: 'vr-03', code: 'ВР-03', en: 'Light oak', bg: 'Светъл дъб', price: 100 },
  { key: 'vr-04', code: 'ВР-04', en: 'Panelled walnut', bg: 'Орех с касетки', price: 100 },
  { key: 'vr-05', code: 'ВР-05', en: 'Black with gold inlay', bg: 'Черна със златна вложка', price: 100 },
]

const EXTERIOR_DOORS = [
  { key: 'v-01', code: 'В-01', en: 'Solid metal door', bg: 'Плътна метална врата', price: 0 },
  { key: 'v-02', code: 'В-02', en: 'Double glazed door', bg: 'Двойна остъклена врата', price: 0 },
]

const ARMOURED_DOORS = [
  { key: 'bv-01', code: 'БВ-01', en: 'Graphite, gold inlay', bg: 'Графит със златна вложка' },
  { key: 'bv-02', code: 'БВ-02', en: 'Black with oak panel', bg: 'Черна с дъбов панел' },
  { key: 'bv-03', code: 'БВ-03', en: 'Embossed anthracite', bg: 'Релефна антрацит' },
  { key: 'bv-04', code: 'БВ-04', en: 'Textured graphite', bg: 'Структурна графит' },
  { key: 'bv-05', code: 'БВ-05', en: 'Grey with red inlay', bg: 'Сива с червена вложка' },
].map((item) => ({ ...item, price: 150 }))

// Four included units, six more against a surcharge the catalogue does not
// price. Names describe the finish -- the mill codes mean nothing to a buyer.
const VANITY_UNITS = [
  { key: 'bv-01', code: 'X1117', en: 'Navy ribbed', bg: 'Тъмносин рифелен', width: '600 mm', price: 0 },
  { key: 'bv-02', code: 'X1117', en: 'Cream ribbed', bg: 'Кремав рифелен', width: '600 mm', price: 0 },
  { key: 'bv-03', code: 'X1270-60/70', en: 'Black with side tower', bg: 'Черен с страничен шкаф', width: '600 / 700 mm', price: 0 },
  { key: 'bv-04', code: 'X1270-60/70', en: 'White with side tower', bg: 'Бял с страничен шкаф', width: '600 / 700 mm', price: 0 },
  { key: 'bv-05', code: 'X1271', en: 'Cream arched, open shelf', bg: 'Кремав с арки и рафт', width: '900 / 1000 / 1100 / 1200 mm', onRequest: true },
  { key: 'bv-06', code: 'X1270', en: 'Black, tall mirror cabinet', bg: 'Черен с висок огледален шкаф', width: '900 / 1000 / 1100 / 1200 mm', onRequest: true },
  { key: 'bv-07', code: 'X1272', en: 'Taupe, four drawers', bg: 'Тауп с четири чекмеджета', width: '900 / 1000 / 1100 / 1200 mm', onRequest: true },
  { key: 'bv-08', code: 'X1212', en: 'Cream arched, wide', bg: 'Кремав с арки, широк', width: '900 / 1000 mm', onRequest: true },
  { key: 'bv-09', code: 'X1117', en: 'Navy ribbed, wide', bg: 'Тъмносин рифелен, широк', width: '900 / 1000 mm', onRequest: true },
  { key: 'bv-10', code: 'X1117', en: 'Cream ribbed, wide', bg: 'Кремав рифелен, широк', width: '900 / 1000 mm', onRequest: true },
]

const KITCHEN_SINKS = [
  { key: 'ks-1', code: 'KS-1', en: 'Double bowl, stainless steel', bg: 'Двойна мивка, неръждаема стомана', price: 0 },
  { key: 'ks-2', code: 'KS-2', en: 'Single bowl, stainless steel', bg: 'Единична мивка, неръждаема стомана', price: 0 },
  { key: 'ks-3', code: 'KS-3', en: 'Double bowl, black', bg: 'Двойна мивка, черна', price: 100 },
  { key: 'ks-4', code: 'KS-4', en: 'Single bowl, black', bg: 'Единична мивка, черна', price: 50 },
]

// Terrace sizes. The standard short-side deck is in the base price; the
// long-side decks are offered per model, so each carries its own model key.
const TERRACE_OPTIONS = [
  { key: 'standard', en: 'Standard · short side', bg: 'Стандарт · къса страна', size: '6230 × 2000 mm', price: 0 },
  { key: 'extended', en: 'Extended · short side', bg: 'Разширена · къса страна', size: '6230 × 3000 mm', price: 800 },
  { key: 'long-58', en: 'Long side · 58 m²', bg: 'Дълга страна · 58 м²', size: '9000 × 2000 mm', price: 2500, models: ['58'] },
  { key: 'long-73', en: 'Long side · 73 m²', bg: 'Дълга страна · 73 м²', size: '11800 × 2000 mm', price: 3000, models: ['73'] },
]

const CARBON_CRYSTAL_OPTIONS = [
  { key: 'carbon-gf005', code: 'GF005', en: 'Golden oak', bg: 'Златист дъб', swatch: '#9f9885', thumb: 'thumbs/carbon/carbon-gf005.webp' },
  { key: 'carbon-gf002', code: 'GF002', en: 'Light grey', bg: 'Светло сиво', swatch: '#aaaaa2', thumb: 'thumbs/carbon/carbon-gf002.webp' },
  { key: 'carbon-wl6603', code: 'WL6603', en: 'Espresso brown', bg: 'Еспресо кафяво', swatch: '#695f53', thumb: 'thumbs/carbon/carbon-wl6603.webp' },
  { key: 'carbon-wl6608', code: 'WL6608', en: 'Stone grey', bg: 'Каменно сиво', swatch: '#aaa19c', thumb: 'thumbs/carbon/carbon-wl6608.webp' },
  { key: 'carbon-wl6607', code: 'WL6607', en: 'Golden oak 2', bg: 'Златист дъб 2', swatch: '#b5ad9c', thumb: 'thumbs/carbon/carbon-wl6607.webp' },
  { key: 'carbon-wl5601', code: 'WL5601', en: 'Light grey 2', bg: 'Светло сиво 2', swatch: '#c7c1bf', thumb: 'thumbs/carbon/carbon-wl5601.webp' },
]

/** Turn a generated row into the shape the configurator renders. */
function codedOption(item, locale, extra = {}) {
  const name = item.bg && locale === 'bg' ? item.bg : item.en || ''
  return {
    key: item.key,
    code: item.code,
    label: item.code,
    summaryLabel: item.code,
    displayLabel: name,
    swatch: item.swatch || '',
    thumbImage: item.thumb || '',
    group: (locale === 'bg' ? item.groupBg : item.groupEn) || '',
    ...extra,
  }
}

/** Group generated rows by their catalogue series heading. */
function groupBySeries(rows, locale) {
  const groups = []
  rows.forEach((item) => {
    const label = (locale === 'bg' ? item.groupBg : item.groupEn) || ''
    let group = groups.find((g) => g.label === label)
    if (!group) {
      group = { key: `series-${groups.length + 1}`, label, options: [] }
      groups.push(group)
    }
    group.options.push(codedOption(item, locale))
  })
  return groups
}

export function getBoxConfiguratorCatalog(locale = 'en') {
  const t = (en, bg) => byLocale(locale, en, bg)
  const pick = (item) => t(item.en, item.bg)

  const models = [
    {
      key: '37',
      label: t('37 m²', '37 м²'),
      area: 37,
      dimensionsOpen: '5900x6260x2500',
      dimensionsFolded: '5900x2260x2500',
      frameThickness: '3.0 мм',
      weight: 6000,
      basePrice: 14000,
      balconyPrice: 16700,
      internalWallsPrice: scaleInternalWallsPrice(37),
      heroImage: 'models/model-37-standard.webp',
      standardHeroImage: 'models/model-37-standard.webp',
      balconyHeroImage: 'models/model-37-balcony.webp',
      overviewImage: 'models/model-37-overview.webp',
      standardOverviewImage: 'models/model-37-overview.webp',
      balconyOverviewImage: 'models/model-37-overview.webp',
      plans: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
    },
    {
      key: '58',
      label: t('58 m²', '58 м²'),
      area: 58,
      dimensionsOpen: '9000x6260x2500',
      dimensionsFolded: '9000x2260x2500',
      frameThickness: '3.5 мм',
      weight: 9800,
      basePrice: 23000,
      balconyPrice: 25500,
      internalWallsPrice: scaleInternalWallsPrice(58),
      heroImage: 'models/model-58-standard.webp',
      standardHeroImage: 'models/model-58-standard.webp',
      balconyHeroImage: 'models/model-58-balcony.webp',
      overviewImage: 'models/model-58-overview.webp',
      standardOverviewImage: 'models/model-58-overview.webp',
      balconyOverviewImage: 'models/model-58-overview.webp',
      plans: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
    },
    {
      key: '73',
      label: t('73 m²', '73 м²'),
      area: 73,
      dimensionsOpen: '11800x6260x2500',
      dimensionsFolded: '11800x2260x2500',
      frameThickness: '4.0 мм',
      weight: 12000,
      basePrice: 26500,
      balconyPrice: 28000,
      internalWallsPrice: scaleInternalWallsPrice(73),
      heroImage: 'models/model-73-standard.webp',
      standardHeroImage: 'models/model-73-standard.webp',
      balconyHeroImage: 'models/model-73-balcony.webp',
      overviewImage: 'models/model-73-overview.webp',
      standardOverviewImage: 'models/model-73-overview.webp',
      balconyOverviewImage: 'models/model-73-overview.webp',
      plans: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
    },
  ]

  const planMeta = {
    A1: t('Living room and kitchen + 1 bedroom', 'Хол и кухня + 1 спалня'),
    A2: t('Compact 1 bedroom', 'Компактна 1 спалня'),
    A3: t('2 bedrooms + living room and kitchen', '2 спални + хол и кухня'),
    A4: t('3 bedrooms', '3 спални'),
    A5: t('3 bedrooms + workspace', '3 спални + работен кът'),
    A6: t('4 bedrooms', '4 спални'),
    B1: t('Living room and kitchen + 1 bedroom', 'Хол и кухня + 1 спалня'),
    B2: t('Living room and kitchen + 2 bedrooms', 'Хол и кухня + 2 спални'),
    B3: t('Living room and kitchen + 3 bedrooms', 'Хол и кухня + 3 спални'),
    B4: t('Living room and kitchen + 4 bedrooms', 'Хол и кухня + 4 спални'),
    B5: t('5 bedrooms', '5 спални'),
    B6: t('6 bedrooms', '6 спални'),
    C1: t('Living room, kitchen and dining + 1 bedroom', 'Хол, кухня и трапезария + 1 спалня'),
    C2: t('Living room, kitchen and workspace + 2 bedrooms', 'Хол, кухня и работен кът + 2 спални'),
    C3: t('Living room and kitchen + 3 bedrooms', 'Хол и кухня + 3 спални'),
    C4: t('Living room and kitchen + 4 bedrooms', 'Хол и кухня + 4 спални'),
    C5: t('4 bedrooms', '4 спални'),
    C6: t('5 bedrooms', '5 спални'),
  }

  const planWallFactor = {
    A1: 0.72, A2: 0.78, A3: 0.9, A4: 1.05, A5: 1.18, A6: 1.28,
    B1: 0.86, B2: 0.98, B3: 1.1, B4: 1.16, B5: 1.26, B6: 1.36,
    C1: 0.95, C2: 1.05, C3: 1.15, C4: 1.22, C5: 1.32, C6: 1.42,
  }

  // Interior doors each layout needs: one per bedroom, plus one for a separate
  // workspace. The bathroom is not counted -- it takes a БД door of its own.
  const planDoorCount = {
    A1: 1, A2: 1, A3: 2, A4: 3, A5: 4, A6: 4,
    B1: 1, B2: 2, B3: 3, B4: 4, B5: 5, B6: 6,
    C1: 1, C2: 3, C3: 3, C4: 4, C5: 4, C6: 5,
  }

  const planOptions = Object.keys(planMeta).map((key) => ({
    key,
    label: key,
    subtitle: planMeta[key],
    image: `plan-${key}.webp`,
    // Blank-wall version of the same plan, used as the canvas when the buyer
    // clicks to place their own windows (so existing windows don't confuse them).
    noWindowImage: `plan-${key}-nowindows.webp`,
    wallFactor: planWallFactor[key] || 1,
    doorCount: planDoorCount[key] || 0,
  }))

  // Nine fully equipped variants, all included -- confirmed by the client.
  // The catalogue left the code field blank, so Б1..Б9 are ours, following the
  // К7 / К8 convention the kitchen pages already use.
  const bathroomOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    key: `BA-${n}`,
    code: `Б${n}`,
    label: `Б${n}`,
    summaryLabel: `Б${n}`,
    subtitle: t('Fully equipped', 'Напълно оборудвана'),
    image: `thumbs/bathroom/ba-${n}.webp`,
    price: 0,
  }))

  // Variants 6 and 9 don't exist -- confirmed by the client. К7 and К8 are the
  // catalogue's own codes; К1..К5 follow the same convention.
  const kitchenOptions = [
    { n: 1, price: 0 }, { n: 2, price: 0 }, { n: 3, price: 0 },
    { n: 4, price: 0 }, { n: 5, price: 0 },
    { n: 7, price: 350 }, { n: 8, price: 400 },
  ].map(({ n, price }) => ({
    key: `K-${n}`,
    code: `К${n}`,
    label: `К${n}`,
    summaryLabel: `К${n}`,
    subtitle: t('Fully equipped', 'Напълно оборудвана'),
    image: `thumbs/kitchen/k-${n}.webp`,
    price,
  }))

  const windowTypeOptions = WINDOW_TYPES.map((item) => ({
    key: item.key,
    label: pick(item),
    note: item.spec,
    price: item.price,
    colourSet: item.colourSet,
    thumbImage: `thumbs/windows/${thumbSlug(item.code)}.webp`,
  }))

  const windowBasicColourOptions = WINDOW_BASIC_COLOURS.map((item) => ({
    key: item.key,
    label: pick(item),
    swatch: item.swatch,
  }))

  // Nine profile decors for the upgraded systems; the catalogue says the colour
  // price is added to the chosen system but never prints it.
  const windowDecorOptions = Array.from({ length: 9 }, (_, i) => ({
    key: `wc-${i + 1}`,
    label: t(`Decor ${i + 1}`, `Декор ${i + 1}`),
    thumbImage: `thumbs/windows/wc-${i + 1}.webp`,
    onRequest: true,
  }))

  const glazingUpgradeOptions = GLAZING_UPGRADES.map((item) => ({
    key: item.key,
    label: pick(item),
    note: item.spec,
    price: item.price,
    unit: item.unit,
    marker: item.marker,
    thumbImage: `thumbs/windows/${thumbSlug(item.code)}.webp`,
  }))

  const steelFrameColorOptions = STEEL_FRAME_COLORS.map((item) => ({
    key: item.key,
    label: pick(item),
    swatch: item.swatch,
    thumbImage: item.thumb,
  }))

  const exteriorDoorOptions = EXTERIOR_DOORS.map((item) => ({
    key: item.key,
    code: item.code,
    label: pick(item),
    summaryLabel: item.code,
    displayLabel: item.code,
    price: item.price,
    thumbImage: `thumbs/exterior-doors/${thumbSlug(item.code)}.webp`,
  }))

  const armouredDoorOptions = ARMOURED_DOORS.map((item) => ({
    key: item.key,
    code: item.code,
    label: pick(item),
    summaryLabel: item.code,
    displayLabel: item.code,
    price: item.price,
    thumbImage: `thumbs/armoured-doors/${thumbSlug(item.code)}.webp`,
  }))

  const insideDoorStyleOptions = INTERIOR_DOORS.map((item) => ({
    key: item.key,
    code: item.code,
    label: pick(item),
    summaryLabel: item.code,
    displayLabel: item.code,
    price: item.price,
    thumbImage: `thumbs/interior-doors/${thumbSlug(item.code)}.webp`,
  }))

  const bathroomDoorOptions = BATHROOM_DOORS.map((item) => ({
    key: item.key,
    code: item.code,
    label: pick(item),
    summaryLabel: item.code,
    displayLabel: item.code,
    price: item.price,
    thumbImage: `thumbs/bathroom-doors/${thumbSlug(item.code)}.webp`,
  }))

  const vanityOptions = VANITY_UNITS.map((item, index) => ({
    key: item.key,
    code: item.code,
    label: pick(item),
    summaryLabel: item.code,
    displayLabel: item.width,
    price: item.price || 0,
    onRequest: Boolean(item.onRequest),
    thumbImage: `thumbs/vanity/bv-${String(index + 1).padStart(2, '0')}.webp`,
  }))

  // Standard bottom unit is 600 mm; lengths to 1200 mm are made to order.
  const vanitySizeOptions = [1, 2, 3].map((n) => ({
    key: `bvs-${n}`,
    label: t(`Layout ${n}`, `Вариант ${n}`),
    thumbImage: `thumbs/vanity/bvs-${n}.webp`,
    onRequest: true,
  }))

  const kitchenSinkOptions = KITCHEN_SINKS.map((item) => ({
    key: item.key,
    label: pick(item),
    price: item.price,
    thumbImage: `thumbs/kitchen-sinks/${thumbSlug(item.code)}.webp`,
  }))

  const kitchenPetColourOptions = KITCHEN_PET_COLOUR_OPTIONS.map((item) => ({
    key: item.key,
    code: item.code,
    label: item.code,
    summaryLabel: item.code,
    displayLabel: t(item.finish, { gloss: 'гланц', matte: 'мат', metallic: 'металик' }[item.finish]),
    swatch: item.swatch,
    group: t({ gloss: 'Gloss', matte: 'Matte', metallic: 'Metallic' }[item.finish],
      { gloss: 'Гланц', matte: 'Мат', metallic: 'Металик' }[item.finish]),
    onRequest: true,
  }))

  const terraceOptions = TERRACE_OPTIONS.map((item) => ({
    key: item.key,
    label: pick(item),
    note: item.size,
    price: item.price,
    models: item.models || null,
  }))

  const exteriorFinishGroups = groupBySeries(FACADE_PANEL_OPTIONS, locale)
  // The catalogue leads its UV grid with UV-001..UV-005; the rest are mill
  // codes in no meaningful order, so keep the named ones first.
  const uvPanelOptions = [...UV_PANEL_OPTIONS]
    .sort((a, b) => (b.code.startsWith('UV-') ? 1 : 0) - (a.code.startsWith('UV-') ? 1 : 0))
    .map((item) => codedOption(item, locale))
  const kitchenBenchOptions = KITCHEN_BENCH_OPTIONS.map((item) => codedOption(item, locale))
  const deckingColorOptions = DECKING_OPTIONS.map((item) => codedOption(item, locale))
  const vinylFloorOptions = VINYL_FLOOR_OPTIONS.map((item) => codedOption(item, locale))
  const herringboneFloorOptions = HERRINGBONE_FLOOR_OPTIONS.map((item) =>
    codedOption(item, locale, { onRequest: true }))
  const carbonCrystalOptions = CARBON_CRYSTAL_OPTIONS.map((item) =>
    codedOption({ ...item, thumb: item.thumb }, locale))
  const interiorPanelColorOptions = INTERIOR_PANEL_OPTIONS.map((item) =>
    codedOption(item, locale, { onRequest: true }))

  const kitchenExtraOptions = [
    { key: 'furnace', label: t('Furnace cabinet', 'Шкаф за бойлер / котле') },
    { key: 'washingMachine', label: t('Washing machine slot', 'Ниша за пералня') },
    { key: 'dishwasherCabinet', label: t('Dishwasher cabinet', 'Шкаф за съдомиялна') },
  ]

  const pricing = {
    heatingPerM2: 38,
    internalWallsBase37: INTERNAL_WALLS_BASE_37,
    // Opening size upgrade, charged once for the whole house.
    windowSizeUpgrade: { 1000: 0, 1200: 500, 1400: 800 },
    // Catalogue window pricing, applied to buyer-placed openings.
    frenchWindowOpenable: 300,
    frenchWindowFixed: 300,
    insideDoorPerDoor: 100,
    bathroomDoorSurcharge: 100,
    armouredDoorSurcharge: 150,
  }

  const references = {
    specs: 'ref-page-11.webp',
  }

  return {
    models,
    planOptions,
    bathroomOptions,
    bathroomDoorOptions,
    vanityOptions,
    vanitySizeOptions,
    kitchenOptions,
    kitchenSinkOptions,
    kitchenPetColourOptions,
    kitchenBenchOptions,
    kitchenExtraOptions,
    windowTypeOptions,
    windowBasicColourOptions,
    windowDecorOptions,
    glazingUpgradeOptions,
    steelFrameColorOptions,
    exteriorDoorOptions,
    armouredDoorOptions,
    insideDoorStyleOptions,
    exteriorFinishGroups,
    deckingColorOptions,
    terraceOptions,
    interiorPanelColorOptions,
    uvPanelOptions,
    vinylFloorOptions,
    herringboneFloorOptions,
    carbonCrystalOptions,
    pricing,
    references,
  }
}
