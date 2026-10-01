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
import { EL_FINISH_NAMES, EL_FINISH_GROUPS, EL_CODE_WORDS } from './boxConfiguratorOptionsEl'
import { APPLIANCE_SLOTS } from './boxConfiguratorApplianceSlots'

// Everything here follows the NVC-HOME4YOU 2026 catalogue. Options the
// catalogue marks as a surcharge without printing a figure carry
// `onRequest: true`: they stay selectable and appear in the summary as a
// quotation line instead of moving the running total.

// Greek falls back to the English when a row has no `el` yet, so a missing
// translation shows a readable name rather than an empty tile.
const byLocale = (locale, en, bg, el) => {
  if (locale === 'bg') return bg
  if (locale === 'el') return el ?? en
  return en
}

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

// Greek visitors see the Cyrillic codes (БД-01, ВР-03, Б1, К7, М-01) in Latin
// letters: Б and Д do not read in Greek at all, and В, Р, М, К pass for Greek
// letters that are not the ones meant. Same table as the thumbnail slugs, so a
// Greek "BD-03" names the very file bd-03.webp. bg keeps the printed Cyrillic;
// en keeps what it has always shown.
const latinCode = (code = '') => EL_CODE_WORDS[code]
  ?? [...code].map((ch) => (TRANSLIT[ch] ? TRANSLIT[ch].toUpperCase() : ch)).join('')
const codeFor = (code, locale) => (locale === 'el' ? latinCode(code) : code)

const INTERNAL_WALLS_BASE_37 = 1300
const scaleInternalWallsPrice = (area) => Math.round((INTERNAL_WALLS_BASE_37 * area) / 37)

// el-GR prints "14.840 €". en-GB's "€14,840" would put a comma where Greek
// writes its DECIMAL separator, so the Greek reader sees fourteen euros.
const EURO_NUMBER_LOCALES = { bg: 'bg-BG', el: 'el-GR' }

export function euro(value, locale = 'en') {
  return new Intl.NumberFormat(EURO_NUMBER_LOCALES[locale] || 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

const STEEL_FRAME_COLORS = [
  { key: 'black', en: 'Black', bg: 'Черно', el: 'Μαύρο', swatch: '#22262b', thumb: 'thumbs/frame-colours/black.webp' },
  { key: 'matte-white', en: 'Matte white', bg: 'Матово бяло', el: 'Ματ λευκό', swatch: '#f2f3ee', thumb: 'thumbs/frame-colours/matte-white.webp' },
  { key: 'light-grey', en: 'Light grey', bg: 'Светло сиво', el: 'Ανοιχτό γκρι', swatch: '#b6b9b7', thumb: 'thumbs/frame-colours/light-grey.webp' },
  { key: 'dark-grey', en: 'Dark grey', bg: 'Тъмно сиво', el: 'Σκούρο γκρι', swatch: '#5a5f61', thumb: 'thumbs/frame-colours/dark-grey.webp' },
  { key: 'brown', en: 'Brown', bg: 'Кафяво', el: 'Καφέ', swatch: '#5b3a2a', thumb: 'thumbs/frame-colours/brown.webp' },
]

// Every window type in the catalogue, in one list. The first three are the
// base glazings from p.20; the last three are the upgraded profile systems
// from p.21. They are all just window types as far as the buyer is concerned,
// so they share a single choice -- but they don't share a colour range:
// the base glazings come in black / white / grey, the upgraded systems in the
// nine catalogue decors. `colourSet` says which palette a type unlocks.
//
// `spec` is the line under the name. Where it holds words ("class", "max",
// "leaves") Greek gets `specEl`; bg has always shown the English spec, and
// still does -- translating it is a Bulgarian copy decision, not part of the
// Greek work. Greek also writes a decimal COMMA (U 2,0 · Kw 1,5), so every
// spec with a decimal has a specEl too, even when it is otherwise all figures.
const WINDOW_TYPES = [
  { key: 'pvc-double', code: 'W-PVC-DOUBLE', en: 'PVC, double glazing', bg: 'PVC, двоен стъклопакет', el: 'PVC, διπλά τζάμια', spec: 'U 2.0 W/m²K · 1100 × 950', specEl: 'U 2,0 W/m²K · 1100 × 950', price: 0, colourSet: 'basic' },
  { key: 'alu-double', code: 'W-ALU-DOUBLE', en: 'Aluminium, double glazing', bg: 'Алуминий, двоен стъклопакет', el: 'Αλουμίνιο, διπλά τζάμια', spec: 'U 1.7–2.0 W/m²K · 1100 × 950', specEl: 'U 1,7–2,0 W/m²K · 1100 × 950', price: 0, colourSet: 'basic' },
  { key: 'alu-triple', code: 'W-ALU-TRIPLE', en: 'Aluminium, triple glazing', bg: 'Алуминий, троен стъклопакет', el: 'Αλουμίνιο, τριπλά τζάμια', spec: 'U 1.5–1.8 W/m²K · 1200 × 950', specEl: 'U 1,5–1,8 W/m²K · 1200 × 950', price: 200, colourSet: 'basic' },
  { key: 'ws-65', code: 'WS-65', en: '65 mm · double glazing', bg: '65 мм · двоен стъклопакет', el: '65 mm · διπλά τζάμια', spec: 'Kw 1.5 · class B · ROTO · HOPPE', specEl: 'Kw 1,5 · κλάση B · ROTO · HOPPE', price: 250, colourSet: 'decor' },
  { key: 'ws-70', code: 'WS-70', en: '70 mm · triple glazing', bg: '70 мм · троен стъклопакет', el: '70 mm · τριπλά τζάμια', spec: 'Kw 1.3 · class A · ROTO · HOPPE', specEl: 'Kw 1,3 · κλάση A · ROTO · HOPPE', price: 290, colourSet: 'decor' },
  { key: 'ws-80', code: 'WS-80', en: 'ZEW 80MD⁺ · 80 mm passive', bg: 'ZEW 80MD⁺ · 80 мм пасивен', el: 'ZEW 80MD⁺ · 80 mm παθητικού τύπου', spec: 'Kw 1.0 · class A · MACO · HOPPE · RC2', specEl: 'Kw 1,0 · κλάση A · MACO · HOPPE · RC2', price: 350, colourSet: 'decor' },
]

// The three colours the base glazings ship in (catalogue p.8).
const WINDOW_BASIC_COLOURS = [
  { key: 'window-black', en: 'Black', bg: 'Черно', el: 'Μαύρο', swatch: '#22262b' },
  { key: 'window-white', en: 'White', bg: 'Бяло', el: 'Λευκό', swatch: '#f2f3ee' },
  { key: 'window-grey', en: 'Grey', bg: 'Сиво', el: 'Γκρι', swatch: '#8d9499' },
]

// `marker` is the badge on the plan dot and in the PDF legend: English
// initials, which bg shows too. Greek gets the first two letters of its own
// name (ΠΑνοραμικό, ΣΥρόμενη, ΠΤυσσόμενη) -- one letter each would make the
// panoramic window and the bi-folding door both Π.
const GLAZING_UPGRADES = [
  { key: 'gz-panorama', code: 'GZ-PANORAMA', en: 'Panoramic fixed glass', bg: 'Панорамно стъкло', el: 'Πανοραμικό σταθερό τζάμι', spec: 'max 2000 × 1000 · U 1.5–2.0 W/m²K', specEl: 'έως 2000 × 1000 · U 1,5–2,0 W/m²K', price: 300, unit: 'window', marker: 'P', markerEl: 'ΠΑ' },
  { key: 'gz-sliding', code: 'GZ-SLIDING', en: 'Sliding door', bg: 'Плъзгаща врата', el: 'Συρόμενη πόρτα', spec: '2000 × 1800 · 900 mm leaves', specEl: '2000 × 1800 · φύλλα 900 mm', price: 430, unit: 'door', marker: 'S', markerEl: 'ΣΥ' },
  { key: 'gz-bifold', code: 'GZ-BIFOLD', en: 'Bi-folding door', bg: '“Bi-folding” врата', el: 'Πτυσσόμενη πόρτα', spec: '2100 × 1900 · U 1.8–2.0 W/m²K', specEl: '2100 × 1900 · U 1,8–2,0 W/m²K', price: 900, unit: 'door', marker: 'B', markerEl: 'ΠΤ' },
]

const BATHROOM_DOORS = [
  { key: 'bd-01', code: 'БД-01', en: 'Frosted grey glass, white frame', bg: 'Матово сиво стъкло, бяла каса', el: 'Γκρι ματ τζάμι, λευκή κάσα', price: 0 },
  { key: 'bd-02', code: 'БД-02', en: 'Frosted grey glass, black frame', bg: 'Матово сиво стъкло, черна каса', el: 'Γκρι ματ τζάμι, μαύρη κάσα', price: 0 },
  { key: 'bd-03', code: 'БД-03', en: 'Reeded glass, white frame', bg: 'Рифелно стъкло, бяла каса', el: 'Ραβδωτό τζάμι, λευκή κάσα', price: 100 },
  { key: 'bd-04', code: 'БД-04', en: 'Reeded glass, walnut frame', bg: 'Рифелно стъкло, каса орех', el: 'Ραβδωτό τζάμι, κάσα καρυδιά', price: 100 },
  { key: 'bd-05', code: 'БД-05', en: 'Frosted grey glass, dark walnut frame', bg: 'Матово сиво стъкло, каса тъмен орех', el: 'Γκρι ματ τζάμι, κάσα σκούρα καρυδιά', price: 100 },
  { key: 'bd-06', code: 'БД-06', en: 'Frosted grey glass, walnut frame', bg: 'Матово сиво стъкло, каса орех', el: 'Γκρι ματ τζάμι, κάσα καρυδιά', price: 100 },
]

// Named from the catalogue artwork -- the codes alone tell a buyer nothing.
const INTERIOR_DOORS = [
  { key: 'vr-01', code: 'ВР-01', en: 'Plain white', bg: 'Гладка бяла', el: 'Απλή λευκή', price: 0 },
  { key: 'vr-02', code: 'ВР-02', en: 'White with inlay line', bg: 'Бяла с вертикална вложка', el: 'Λευκή με ένθετη γραμμή', price: 100 },
  { key: 'vr-03', code: 'ВР-03', en: 'Light oak', bg: 'Светъл дъб', el: 'Ανοιχτόχρωμη δρυς', price: 100 },
  { key: 'vr-04', code: 'ВР-04', en: 'Panelled walnut', bg: 'Орех с касетки', el: 'Καρυδιά με ταμπλάδες', price: 100 },
  { key: 'vr-05', code: 'ВР-05', en: 'Black with gold inlay', bg: 'Черна със златна вложка', el: 'Μαύρη με χρυσό ένθετο', price: 100 },
]

const EXTERIOR_DOORS = [
  { key: 'v-01', code: 'В-01', en: 'Solid metal door', bg: 'Плътна метална врата', el: 'Συμπαγής μεταλλική πόρτα', price: 0 },
  { key: 'v-02', code: 'В-02', en: 'Double glazed door', bg: 'Двойна остъклена врата', el: 'Δίφυλλη τζαμόπορτα', price: 0 },
]

const ARMOURED_DOORS = [
  { key: 'bv-01', code: 'БВ-01', en: 'Graphite, gold inlay', bg: 'Графит със златна вложка', el: 'Γραφίτης, χρυσό ένθετο' },
  { key: 'bv-02', code: 'БВ-02', en: 'Black with oak panel', bg: 'Черна с дъбов панел', el: 'Μαύρη με δρύινο πάνελ' },
  { key: 'bv-03', code: 'БВ-03', en: 'Embossed anthracite', bg: 'Релефна антрацит', el: 'Ανάγλυφη ανθρακί' },
  { key: 'bv-04', code: 'БВ-04', en: 'Textured graphite', bg: 'Структурна графит', el: 'Γραφίτης με υφή' },
  { key: 'bv-05', code: 'БВ-05', en: 'Grey with red inlay', bg: 'Сива с червена вложка', el: 'Γκρι με κόκκινο ένθετο' },
].map((item) => ({ ...item, price: 150 }))

// Four included units, six more against a surcharge the catalogue does not
// price. Names describe the finish -- the mill codes mean nothing to a buyer.
const VANITY_UNITS = [
  { key: 'bv-01', code: 'X1117', en: 'Navy ribbed', bg: 'Тъмносин рифелен', el: 'Σκούρο μπλε ραβδωτό', width: '600 mm', price: 0 },
  { key: 'bv-02', code: 'X1117', en: 'Cream ribbed', bg: 'Кремав рифелен', el: 'Κρεμ ραβδωτό', width: '600 mm', price: 0 },
  { key: 'bv-03', code: 'X1270-60/70', en: 'Black with side tower', bg: 'Черен с страничен шкаф', el: 'Μαύρο με πλαϊνή κολόνα', width: '600 / 700 mm', price: 0 },
  { key: 'bv-04', code: 'X1270-60/70', en: 'White with side tower', bg: 'Бял с страничен шкаф', el: 'Λευκό με πλαϊνή κολόνα', width: '600 / 700 mm', price: 0 },
  { key: 'bv-05', code: 'X1271', en: 'Cream arched, open shelf', bg: 'Кремав с арки и рафт', el: 'Κρεμ με καμάρες, ανοιχτό ράφι', width: '900 / 1000 / 1100 / 1200 mm', onRequest: true },
  { key: 'bv-06', code: 'X1270', en: 'Black, tall mirror cabinet', bg: 'Черен с висок огледален шкаф', el: 'Μαύρο, ψηλό ντουλάπι με καθρέφτη', width: '900 / 1000 / 1100 / 1200 mm', onRequest: true },
  { key: 'bv-07', code: 'X1272', en: 'Taupe, four drawers', bg: 'Тауп с четири чекмеджета', el: 'Γκριζομπέζ, τέσσερα συρτάρια', width: '900 / 1000 / 1100 / 1200 mm', onRequest: true },
  { key: 'bv-08', code: 'X1212', en: 'Cream arched, wide', bg: 'Кремав с арки, широк', el: 'Κρεμ με καμάρες, φαρδύ', width: '900 / 1000 mm', onRequest: true },
  { key: 'bv-09', code: 'X1117', en: 'Navy ribbed, wide', bg: 'Тъмносин рифелен, широк', el: 'Σκούρο μπλε ραβδωτό, φαρδύ', width: '900 / 1000 mm', onRequest: true },
  { key: 'bv-10', code: 'X1117', en: 'Cream ribbed, wide', bg: 'Кремав рифелен, широк', el: 'Κρεμ ραβδωτό, φαρδύ', width: '900 / 1000 mm', onRequest: true },
]

const KITCHEN_SINKS = [
  { key: 'ks-1', code: 'KS-1', en: 'Double bowl, stainless steel', bg: 'Двойна мивка, неръждаема стомана', el: 'Διπλή γούρνα, ανοξείδωτη', price: 0 },
  { key: 'ks-2', code: 'KS-2', en: 'Single bowl, stainless steel', bg: 'Единична мивка, неръждаема стомана', el: 'Μονή γούρνα, ανοξείδωτη', price: 0 },
  { key: 'ks-3', code: 'KS-3', en: 'Double bowl, black', bg: 'Двойна мивка, черна', el: 'Διπλή γούρνα, μαύρη', price: 100 },
  { key: 'ks-4', code: 'KS-4', en: 'Single bowl, black', bg: 'Единична мивка, черна', el: 'Μονή γούρνα, μαύρη', price: 50 },
]

// The placeable kitchen appliances (#28, owner 2026-09-19). NVC does not sell
// or charge for any of these — buyers plan WHERE each unit goes so the kitchen
// is built to fit, and preparing for them (electrics, plumbing) is included.
// The one appliance NVC does sell, the sink, is priced in its own step
// (KITCHEN_SINKS above); its marker here is position only, which is why no row
// carries a price. Footprints are the standard EU built-in modules — 60 cm,
// with the 45 cm slim dishwasher as the second size — so no dimensions were
// owed by the owner. The hood is deliberately NOT its own row: it sits above
// wherever the hob goes, so one hob placement covers both. The hob and the
// oven may also SHARE one slot (`stacksWith`) — the classic column of oven in
// the base cabinet with the hob on the worktop above it (owner, 2026-09-20).
//
// `marker` is the badge on the plan dot, the picker and the PDF legend --
// English initials, shown to bg as well. Greek gets its own two letters, from
// the Greek name: ΝεΡοχύτης, ΕΣτίες, ΦούΡνος, ΨΥγείο, Πλυντήριο Πιάτων,
// Πλυντήριο Ρούχων.
const APPLIANCE_TYPES = [
  { key: 'sink', en: 'Sink', bg: 'Мивка', el: 'Νεροχύτης', marker: 'SI', markerEl: 'ΝΡ', required: true },
  { key: 'hob', en: 'Built-in hob', bg: 'Вградени котлони (плот)', el: 'Εντοιχιζόμενες εστίες', marker: 'HB', markerEl: 'ΕΣ', size: '60 cm', hood: true, stacksWith: 'oven' },
  { key: 'oven', en: 'Built-in oven', bg: 'Вградена фурна', el: 'Εντοιχιζόμενος φούρνος', marker: 'OV', markerEl: 'ΦΡ', size: '60 cm', stacksWith: 'hob' },
  { key: 'fridge', en: 'Fridge', bg: 'Хладилник', el: 'Ψυγείο', marker: 'FR', markerEl: 'ΨΥ', size: '60 cm' },
  { key: 'dishwasher-60', en: 'Dishwasher · 60 cm', bg: 'Съдомиялна · 60 см', el: 'Πλυντήριο πιάτων · 60 cm', marker: 'DW', markerEl: 'ΠΠ', size: '60 cm', family: 'dishwasher', sinkAdjacent: true },
  { key: 'dishwasher-45', en: 'Slim dishwasher · 45 cm', bg: 'Съдомиялна · 45 см', el: 'Στενό πλυντήριο πιάτων · 45 cm', marker: 'DW', markerEl: 'ΠΠ', size: '45 cm', family: 'dishwasher', sinkAdjacent: true },
  { key: 'washer', en: 'Washing machine', bg: 'Пералня', el: 'Πλυντήριο ρούχων', marker: 'WM', markerEl: 'ΠΡ', size: '60 cm', allowBath: true },
]

// Terrace sizes. The standard short-side deck is in the base price; the
// long-side decks are offered per model, so each carries its own model key.
const TERRACE_OPTIONS = [
  { key: 'standard', en: 'Standard · short side', bg: 'Стандарт · къса страна', el: 'Στάνταρ · μικρή πλευρά', size: '6230 × 2000 mm', price: 0 },
  { key: 'extended', en: 'Extended · short side', bg: 'Разширена · къса страна', el: 'Επεκτεταμένη · μικρή πλευρά', size: '6230 × 3000 mm', price: 800 },
  { key: 'long-58', en: 'Long side · 58 m²', bg: 'Дълга страна · 58 м²', el: 'Μεγάλη πλευρά · 58 m²', size: '9000 × 2000 mm', price: 2500, models: ['58'] },
  { key: 'long-73', en: 'Long side · 73 m²', bg: 'Дълга страна · 73 м²', el: 'Μεγάλη πλευρά · 73 m²', size: '11800 × 2000 mm', price: 3000, models: ['73'] },
]

const CARBON_CRYSTAL_OPTIONS = [
  { key: 'carbon-gf005', code: 'GF005', en: 'Golden oak', bg: 'Златист дъб', el: 'Χρυσαφένια δρυς', swatch: '#9f9885', thumb: 'thumbs/carbon/carbon-gf005.webp' },
  { key: 'carbon-gf002', code: 'GF002', en: 'Light grey', bg: 'Светло сиво', el: 'Ανοιχτό γκρι', swatch: '#aaaaa2', thumb: 'thumbs/carbon/carbon-gf002.webp' },
  { key: 'carbon-wl6603', code: 'WL6603', en: 'Espresso brown', bg: 'Еспресо кафяво', el: 'Καφέ εσπρέσο', swatch: '#695f53', thumb: 'thumbs/carbon/carbon-wl6603.webp' },
  { key: 'carbon-wl6608', code: 'WL6608', en: 'Stone grey', bg: 'Каменно сиво', el: 'Γκρι πέτρας', swatch: '#aaa19c', thumb: 'thumbs/carbon/carbon-wl6608.webp' },
  { key: 'carbon-wl6607', code: 'WL6607', en: 'Golden oak 2', bg: 'Златист дъб 2', el: 'Χρυσαφένια δρυς 2', swatch: '#b5ad9c', thumb: 'thumbs/carbon/carbon-wl6607.webp' },
  { key: 'carbon-wl5601', code: 'WL5601', en: 'Light grey 2', bg: 'Светло сиво 2', el: 'Ανοιχτό γκρι 2', swatch: '#c7c1bf', thumb: 'thumbs/carbon/carbon-wl5601.webp' },
]

// Every hand-maintained row list, for the test that holds each row to having
// all three languages. Not read by the page.
export const HAND_MAINTAINED_ROWS = {
  STEEL_FRAME_COLORS,
  WINDOW_TYPES,
  WINDOW_BASIC_COLOURS,
  GLAZING_UPGRADES,
  BATHROOM_DOORS,
  INTERIOR_DOORS,
  EXTERIOR_DOORS,
  ARMOURED_DOORS,
  VANITY_UNITS,
  KITCHEN_SINKS,
  APPLIANCE_TYPES,
  TERRACE_OPTIONS,
  CARBON_CRYSTAL_OPTIONS,
}

// A generated row's name and series heading in the visitor's language. The
// generated file has no Greek, so el looks the row up by its Bulgarian name in
// boxConfiguratorOptionsEl.js -- the key the generator's own English map uses
// -- and falls back to the English for a finish not in that map yet. A hand-
// maintained row (the carbon floors) carries its `el` directly.
function finishName(item, locale) {
  if (locale === 'el') return item.el ?? EL_FINISH_NAMES[item.bg] ?? item.en ?? ''
  return item.bg && locale === 'bg' ? item.bg : item.en || ''
}

function finishGroup(item, locale) {
  if (locale === 'el') return EL_FINISH_GROUPS[item.groupBg] || item.groupEn || ''
  return (locale === 'bg' ? item.groupBg : item.groupEn) || ''
}

/** Turn a generated row into the shape the configurator renders. */
function codedOption(item, locale, extra = {}) {
  const code = codeFor(item.code, locale)
  return {
    key: item.key,
    code,
    label: code,
    summaryLabel: code,
    displayLabel: finishName(item, locale),
    swatch: item.swatch || '',
    thumbImage: item.thumb || '',
    group: finishGroup(item, locale),
    ...extra,
  }
}

/** Group generated rows by their catalogue series heading. */
function groupBySeries(rows, locale) {
  const groups = []
  rows.forEach((item) => {
    const label = finishGroup(item, locale)
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
  const t = (en, bg, el) => byLocale(locale, en, bg, el)
  const pick = (item) => t(item.en, item.bg, item.el)

  const models = [
    {
      key: '37',
      label: t('37 m²', '37 м²', '37 m²'),
      area: 37,
      dimensionsOpen: '5900x6260x2500',
      dimensionsFolded: '5900x2260x2500',
      // en has always carried the Cyrillic мм here (no page prints it today); Greek gets mm.
      frameThickness: t('3.0 мм', '3.0 мм', '3.0 mm'),
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
      label: t('58 m²', '58 м²', '58 m²'),
      area: 58,
      dimensionsOpen: '9000x6260x2500',
      dimensionsFolded: '9000x2260x2500',
      frameThickness: t('3.5 мм', '3.5 мм', '3.5 mm'),
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
      label: t('73 m²', '73 м²', '73 m²'),
      area: 73,
      dimensionsOpen: '11800x6260x2500',
      dimensionsFolded: '11800x2260x2500',
      frameThickness: t('4.0 мм', '4.0 мм', '4.0 mm'),
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
    A1: t('Living room and kitchen + 1 bedroom', 'Хол и кухня + 1 спалня', 'Σαλόνι και κουζίνα + 1 υπνοδωμάτιο'),
    A2: t('Compact 1 bedroom', 'Компактна 1 спалня', 'Συμπαγής διάταξη, 1 υπνοδωμάτιο'),
    A3: t('2 bedrooms + living room and kitchen', '2 спални + хол и кухня', '2 υπνοδωμάτια + σαλόνι και κουζίνα'),
    A4: t('3 bedrooms', '3 спални', '3 υπνοδωμάτια'),
    A5: t('3 bedrooms + workspace', '3 спални + работен кът', '3 υπνοδωμάτια + χώρος εργασίας'),
    A6: t('4 bedrooms', '4 спални', '4 υπνοδωμάτια'),
    B1: t('Living room and kitchen + 1 bedroom', 'Хол и кухня + 1 спалня', 'Σαλόνι και κουζίνα + 1 υπνοδωμάτιο'),
    B2: t('Living room and kitchen + 2 bedrooms', 'Хол и кухня + 2 спални', 'Σαλόνι και κουζίνα + 2 υπνοδωμάτια'),
    B3: t('Living room and kitchen + 3 bedrooms', 'Хол и кухня + 3 спални', 'Σαλόνι και κουζίνα + 3 υπνοδωμάτια'),
    B4: t('Living room and kitchen + 4 bedrooms', 'Хол и кухня + 4 спални', 'Σαλόνι και κουζίνα + 4 υπνοδωμάτια'),
    B5: t('5 bedrooms', '5 спални', '5 υπνοδωμάτια'),
    B6: t('6 bedrooms', '6 спални', '6 υπνοδωμάτια'),
    C1: t('Living room, kitchen and dining + 1 bedroom', 'Хол, кухня и трапезария + 1 спалня', 'Σαλόνι, κουζίνα και τραπεζαρία + 1 υπνοδωμάτιο'),
    C2: t('Living room, kitchen and workspace + 2 bedrooms', 'Хол, кухня и работен кът + 2 спални', 'Σαλόνι, κουζίνα και χώρος εργασίας + 2 υπνοδωμάτια'),
    C3: t('Living room and kitchen + 3 bedrooms', 'Хол и кухня + 3 спални', 'Σαλόνι και κουζίνα + 3 υπνοδωμάτια'),
    C4: t('Living room and kitchen + 4 bedrooms', 'Хол и кухня + 4 спални', 'Σαλόνι και κουζίνα + 4 υπνοδωμάτια'),
    C5: t('5 bedrooms', '5 спални', '5 υπνοδωμάτια'),
    C6: t('6 bedrooms', '6 спални', '6 υπνοδωμάτια'),
  }

  const planWallFactor = {
    A1: 0.72, A2: 0.78, A3: 0.9, A4: 1.05, A5: 1.18, A6: 1.28,
    B1: 0.86, B2: 0.98, B3: 1.1, B4: 1.16, B5: 1.26, B6: 1.36,
    C1: 0.95, C2: 1.05, C3: 1.15, C4: 1.22, C5: 1.32, C6: 1.42,
  }

  // Interior doors each layout needs: one per bedroom, plus one for a separate
  // workspace. The bathroom is not counted -- it takes a БД door of its own.
  //
  // C5 and C6 said 4 and 5 here (and in planMeta above) while their renders showed 5 and
  // 6 bedrooms; the owner settled it 2026-09-05: the renders are right. The wall factors
  // below needed no change -- they already stepped in lockstep with the B-series ladder,
  // priced for the real room counts all along.
  const planDoorCount = {
    A1: 1, A2: 1, A3: 2, A4: 3, A5: 4, A6: 4,
    B1: 1, B2: 2, B3: 3, B4: 4, B5: 5, B6: 6,
    C1: 1, C2: 3, C3: 3, C4: 4, C5: 5, C6: 6,
  }

  // The plans still drawn in the old artwork, and so still carrying the blank canvas
  // made from it. A plan leaves this list the day it gets a new render.
  const BLANK_WINDOW_CANVASES = new Set(['A4', 'A5', 'A6'])

  const planOptions = Object.keys(planMeta).map((key) => ({
    key,
    label: key,
    subtitle: planMeta[key],
    image: `plan-${key}.webp`,
    // Blank-wall version of the same plan, used as the canvas when the buyer clicks to
    // place their own windows (so existing windows don't confuse them). A4–A6 ONLY now:
    // the B and C plans got new furnished renders on 2026-09-05 and A1–A3 on 2026-09-30,
    // and each time the new render took over the window stage too — the old blank canvas
    // shows the OLD drawing, a different house from the one on every other stage. Every
    // stage falls back to `image` when this is absent, which is exactly what absent means
    // here. If windows-drawn-on-the-render proves confusing in practice, the fix is a
    // windowless export of the same renders, not a revert to the old artwork.
    noWindowImage: BLANK_WINDOW_CANVASES.has(key) ? `plan-${key}-nowindows.webp` : undefined,
    wallFactor: planWallFactor[key] || 1,
    doorCount: planDoorCount[key] || 0,
    // Appliance slot coordinates are hand-placed against the furnished render
    // (`image`), the artwork the appliance stage always shows — so the
    // A-series' separate no-windows canvas never enters this feature. A plan
    // with no entry simply doesn't offer the appliance step.
    applianceSlots: APPLIANCE_SLOTS[key] || null,
  }))

  // Nine fully equipped variants, all included -- confirmed by the client.
  // The catalogue left the code field blank, so Б1..Б9 are ours, following the
  // К7 / К8 convention the kitchen pages already use. Greek reads them B1..B9
  // and K1..K8 (see latinCode) -- so a Greek "B1" is both a bathroom and a 58 m²
  // layout, told apart only by the row it sits in. The subtitle agrees in gender
  // with the room: το μπάνιο, η κουζίνα.
  const bathroomOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
    const code = codeFor(`Б${n}`, locale)
    return {
      key: `BA-${n}`,
      code,
      label: code,
      summaryLabel: code,
      subtitle: t('Fully equipped', 'Напълно оборудвана', 'Πλήρως εξοπλισμένο'),
      image: `thumbs/bathroom/ba-${n}.webp`,
      price: 0,
    }
  })

  // Variants 6 and 9 don't exist -- confirmed by the client. К7 and К8 are the
  // catalogue's own codes; К1..К5 follow the same convention.
  const kitchenOptions = [
    { n: 1, price: 0 }, { n: 2, price: 0 }, { n: 3, price: 0 },
    { n: 4, price: 0 }, { n: 5, price: 0 },
    { n: 7, price: 350 }, { n: 8, price: 400 },
  ].map(({ n, price }) => {
    const code = codeFor(`К${n}`, locale)
    return {
      key: `K-${n}`,
      code,
      label: code,
      summaryLabel: code,
      subtitle: t('Fully equipped', 'Напълно оборудвана', 'Πλήρως εξοπλισμένη'),
      image: `thumbs/kitchen/k-${n}.webp`,
      price,
    }
  })

  const windowTypeOptions = WINDOW_TYPES.map((item) => ({
    key: item.key,
    label: pick(item),
    note: t(item.spec, item.spec, item.specEl),
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
    label: t(`Decor ${i + 1}`, `Декор ${i + 1}`, `Ντεκόρ ${i + 1}`),
    thumbImage: `thumbs/windows/wc-${i + 1}.webp`,
    onRequest: true,
  }))

  const glazingUpgradeOptions = GLAZING_UPGRADES.map((item) => ({
    key: item.key,
    label: pick(item),
    note: t(item.spec, item.spec, item.specEl),
    price: item.price,
    unit: item.unit,
    marker: t(item.marker, item.marker, item.markerEl),
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
    code: codeFor(item.code, locale),
    label: pick(item),
    summaryLabel: codeFor(item.code, locale),
    displayLabel: codeFor(item.code, locale),
    price: item.price,
    thumbImage: `thumbs/exterior-doors/${thumbSlug(item.code)}.webp`,
  }))

  const armouredDoorOptions = ARMOURED_DOORS.map((item) => ({
    key: item.key,
    code: codeFor(item.code, locale),
    label: pick(item),
    summaryLabel: codeFor(item.code, locale),
    displayLabel: codeFor(item.code, locale),
    price: item.price,
    thumbImage: `thumbs/armoured-doors/${thumbSlug(item.code)}.webp`,
  }))

  const insideDoorStyleOptions = INTERIOR_DOORS.map((item) => ({
    key: item.key,
    code: codeFor(item.code, locale),
    label: pick(item),
    summaryLabel: codeFor(item.code, locale),
    displayLabel: codeFor(item.code, locale),
    price: item.price,
    thumbImage: `thumbs/interior-doors/${thumbSlug(item.code)}.webp`,
  }))

  const bathroomDoorOptions = BATHROOM_DOORS.map((item) => ({
    key: item.key,
    code: codeFor(item.code, locale),
    label: pick(item),
    summaryLabel: codeFor(item.code, locale),
    displayLabel: codeFor(item.code, locale),
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
    label: t(`Layout ${n}`, `Вариант ${n}`, `Παραλλαγή ${n}`),
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
    displayLabel: t(item.finish, { gloss: 'гланц', matte: 'мат', metallic: 'металик' }[item.finish],
      { gloss: 'γυαλιστερό', matte: 'ματ', metallic: 'μεταλλικό' }[item.finish]),
    swatch: item.swatch,
    group: t({ gloss: 'Gloss', matte: 'Matte', metallic: 'Metallic' }[item.finish],
      { gloss: 'Гланц', matte: 'Мат', metallic: 'Металик' }[item.finish],
      { gloss: 'Γυαλιστερό', matte: 'Ματ', metallic: 'Μεταλλικό' }[item.finish]),
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

  // The kitchen-extras checkbox section is GONE (owner, 2026-09-20): the
  // washing machine and dishwasher became placeable appliances the day before,
  // and the owner then retired the section wholesale, furnace cabinet
  // included. Old saved configs still carry a `kitchenExtras` object in their
  // JSON; nothing reads it any more, so it rides along inert.
  const applianceOptions = APPLIANCE_TYPES.map((item) => ({
    key: item.key,
    label: pick(item),
    marker: t(item.marker, item.marker, item.markerEl),
    size: item.size || '',
    required: Boolean(item.required),
    family: item.family || item.key,
    sinkAdjacent: Boolean(item.sinkAdjacent),
    allowBath: Boolean(item.allowBath),
    hood: Boolean(item.hood),
    stacksWith: item.stacksWith || '',
  }))

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
    applianceOptions,
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
