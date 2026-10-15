// What the doors page's builder offers, and the message it writes from a choice.
//
// Every option is read from the owner's catalogue (src/content/shared/doorsCatalogue.js)
// except two things the owner told us to keep from the page as it was ("follow the CURRENT
// information; the catalogue is a little old", 2026-10-15):
// - the frame widths, 70–180 mm (the catalogue's frames are BT100–BT300; the difference is
//   listed for the owner, and the page shows neither code nor drawing against a width);
// - the three standard colours of each type, with the old page's names. Each is tied here to
//   the catalogue photo that shows it, so choosing one shows a real door, never a recolour.
// The 25 WPC colours (BJX-01 … BJX-25) are the wider range, on request.
import {
  DOOR_TYPES,
  DOOR_FINISHES,
  DOOR_TRIMS,
} from '../../content/shared/doorsCatalogue.js'

// The old page's order: decorative lines first.
export const TYPE_ORDER = ['decor-lines', 'wallpaper', 'metal-lines', 'glass']
export const BUILDER_TYPES = TYPE_ORDER.map((key) => DOOR_TYPES.find((t) => t.key === key))

// The owner-confirmed frame widths (the old page's), in millimetres.
export const FRAME_WIDTHS_MM = [70, 90, 100, 120, 140, 160, 180]

// The three standard colours per type: the old page's colour keys and swatches, each with the
// index of the catalogue photo of that type that shows it.
export const STANDARD_FINISHES = {
  'decor-lines': [
    { key: 'white', swatch: '#D0D0CC', photo: 0 },
    { key: 'charcoal', swatch: '#53534E', photo: 1 },
    { key: 'sage', swatch: '#9EAB98', photo: 2 },
  ],
  wallpaper: [
    { key: 'light', swatch: '#C3BCB1', photo: 0 },
    { key: 'smoked', swatch: '#81796A', photo: 1 },
    { key: 'dark', swatch: '#3A2F22', photo: 2 },
  ],
  'metal-lines': [
    { key: 'grey', swatch: '#7E7973', photo: 2 },
    { key: 'oak', swatch: '#C19C62', photo: 4 },
    { key: 'darkWood', swatch: '#44403C', photo: 5 },
  ],
  glass: [
    { key: 'warmWhite', swatch: '#DFD9D0', photo: 1 },
    { key: 'grey', swatch: '#C2BFB9', photo: 5 },
    { key: 'black', swatch: '#2A2A2A', photo: 2 },
  ],
}

/** A type shows its catalogue models as a choice when it has more photos than colours. */
export const hasModels = (type) => (type?.photos?.length || 0) > (STANDARD_FINISHES[type?.key]?.length || 0)

export const typeOf = (key) => BUILDER_TYPES.find((t) => t.key === key) || BUILDER_TYPES[0]
export const trimOf = (code) => DOOR_TRIMS.find((t) => t.code === code) || null
export const wpcOf = (code) => DOOR_FINISHES.find((f) => f.code === code) || null

/** The first choice the builder shows: the first type in its first standard colour. */
export function initialSelection() {
  const finishes = {}
  const photos = {}
  for (const type of BUILDER_TYPES) {
    const first = STANDARD_FINISHES[type.key][0]
    finishes[type.key] = { kind: 'std', key: first.key }
    photos[type.key] = first.photo
  }
  return {
    type: TYPE_ORDER[0],
    variant: 'narrow',
    finishes,
    photos,
    frame: '',
    handle: '',
    trim: '',
    qty: '',
    sizes: '',
    fitting: '',
    town: '',
  }
}

/** Picking a standard colour also shows its photo. */
export function chooseFinish(sel, finish) {
  const next = { ...sel, finishes: { ...sel.finishes, [sel.type]: finish } }
  if (finish.kind === 'std') {
    const std = STANDARD_FINISHES[sel.type].find((f) => f.key === finish.key)
    if (std) next.photos = { ...sel.photos, [sel.type]: std.photo }
  }
  return next
}

/** Picking a model shows it; when it is a standard colour's photo, that colour is chosen too. */
export function chooseModel(sel, index) {
  const next = { ...sel, photos: { ...sel.photos, [sel.type]: index } }
  const std = STANDARD_FINISHES[sel.type].find((f) => f.photo === index)
  if (std) next.finishes = { ...sel.finishes, [sel.type]: { kind: 'std', key: std.key } }
  return next
}

/**
 * A catalogue photo's colour, in the visitor's language. When the photo is one of the type's
 * standard colours' photos, it is that colour's name as the page prints it on the chip (the
 * owner's names), so the chip, the caption, the alt text and the enquiry never disagree.
 */
export function photoColourOf(type, index, locale, colors = {}) {
  const std = STANDARD_FINISHES[type?.key]?.find((f) => f.photo === index)
  if (std && colors[std.key]) return colors[std.key]
  const photo = type?.photos?.[index]
  return photo ? photo.colour[locale] || photo.colour.en : ''
}

/** A number as the visitor's language writes it: 4,6 in Bulgarian and Greek, 4.6 in English. */
export const formatNumber = (n, locale) => new Intl.NumberFormat(locale).format(n)

/** What the preview shows for a selection: the photo, its colour, and whether they agree. */
export function previewOf(sel, locale, colors) {
  const type = typeOf(sel.type)
  const index = sel.photos[type.key] ?? 0
  const photo = type.photos[index] || type.photos[0]
  const finish = sel.finishes[type.key]
  const std = finish?.kind === 'std' ? STANDARD_FINISHES[type.key].find((f) => f.key === finish.key) : null
  const wpc = finish?.kind === 'wpc' ? wpcOf(finish.code) : null
  const finishName = std ? colors[std.key] : wpc?.code || ''
  const matches = Boolean(std && std.photo === index)
  return {
    type,
    index,
    photo,
    photoColour: photoColourOf(type, type.photos[index] ? index : 0, locale, colors),
    finishName,
    swatch: std?.swatch || wpc?.swatch || null,
    sample: wpc?.src || null,
    matches,
  }
}

const fill = (pattern, values = {}) => String(pattern ?? '').replace(/\{(\w+)\}/g, (m, k) => (values[k] == null ? m : String(values[k])))

/**
 * The model's label: "Модел 4 · Бяло, с хоризонтална и вертикална линия (стр. 6 от каталога)".
 * The catalogue prints no model codes, so the number is the page's; the photo's colour, its
 * shape and the catalogue page make it one door staff can find in the PDF.
 *
 * @param c  the page content (builder, colors)
 */
export function modelLabel(type, index, locale, c) {
  const photo = type.photos[index]
  if (!photo) return ''
  const colour = photoColourOf(type, index, locale, c.colors)
  const detail = photo.detail ? photo.detail[locale] || photo.detail.en : ''
  const page = fill(c.builder.pageRef, { p: photo.page })
  return `${fill(c.builder.modelLabel, { n: index + 1 })} · ${colour}${detail ? `, ${detail}` : ''} (${page})`
}

/**
 * The enquiry text for a selection, in the visitor's language, one line per choice. It has no
 * heading of its own: the server puts its Bulgarian line ("Запитване за врати") above it for
 * staff, and a second, near-identical heading only made them read the same thing twice.
 *
 * @param sel     the builder's selection
 * @param locale  'bg' | 'en' | 'el'
 * @param c       the page content (range, colors, builder, message)
 */
export function doorMessage(sel, locale, c) {
  const m = c.message
  const type = typeOf(sel.type)
  const lines = []
  lines.push(`${m.type}: ${c.range.types[type.key].name}`)
  if (type.variants) lines.push(`${m.variant}: ${c.range.variants[sel.variant] || c.range.variants.narrow}`)
  if (hasModels(type)) lines.push(`${m.model}: ${modelLabel(type, sel.photos[type.key] ?? 0, locale, c)}`)

  const finish = sel.finishes[type.key]
  if (finish?.kind === 'wpc') lines.push(`${m.finish}: ${finish.code} (${m.wide})`)
  else lines.push(`${m.finish}: ${c.colors[finish?.key] || ''} (${m.standard})`)

  lines.push(`${m.frame}: ${sel.frame ? fill(c.builder.frameValue, { mm: sel.frame }) : m.none}`)
  lines.push(`${m.handle}: ${sel.handle || m.none}`)
  const trim = trimOf(sel.trim)
  lines.push(`${m.trim}: ${trim ? `${trim.code} (${fill(c.builder.trimValue, { w: formatNumber(trim.widthMm, locale), h: formatNumber(trim.heightMm, locale) })})` : m.none}`)

  lines.push(`${m.qty}: ${String(sel.qty).trim()}`)
  if (String(sel.sizes).trim()) lines.push(`${m.sizes}: ${String(sel.sizes).trim()}`)
  if (sel.fitting === 'yes') lines.push(`${m.fitting}: ${c.builder.fittingYes}`)
  if (sel.fitting === 'no') lines.push(`${m.fitting}: ${c.builder.fittingNo}`)
  if (String(sel.town).trim()) lines.push(`${m.town}: ${String(sel.town).trim()}`)
  return lines.join('\n')
}

/** A whole number of doors, 1 or more, or null. */
export function quantityOf(value) {
  const text = String(value ?? '').trim()
  if (!/^\d{1,5}$/.test(text)) return null
  const n = Number(text)
  return n >= 1 ? n : null
}

export { fill }
