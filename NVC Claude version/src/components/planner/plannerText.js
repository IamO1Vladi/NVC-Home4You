import { useCallback, useMemo } from 'react'
import { FINISHES, ROOM_TYPES } from '../../lib/floorPlan.js'
import { EDITOR_LOCALES, EDITOR_TEXT } from './editorContent.js'

// Number formats per page language: a Bulgarian or Greek page writes 6,26, not 6.26.
const NUMBER_LOCALES = { bg: 'bg-BG', en: 'en-GB', el: 'el-GR' }

// The page's language, when the shell does not pass it: read off the content
// object's own unit for metres, which differs in all three.
function guessLocale(content) {
  const unit = content?.planner?.unitM
  if (unit === 'м') return 'bg'
  if (unit === 'μ') return 'el'
  return 'en'
}

// The planner's copy lives in src/content/{bg,en,el}/floorPlanner.js under
// `planner.*`. bg lacks a few keys en and el have (redoShortcut, aria.*), and those
// keep the English this page has always shown, so every lookup carries its
// English fallback rather than failing to the key's path. The redesigned editor's
// own strings are in editorContent.js and are read with `ed`; a content file can
// override any of them under `planner.editor.*`.
export function usePlannerText(content, localeProp) {
  const locale = EDITOR_LOCALES.includes(localeProp) ? localeProp : guessLocale(content)

  const txt = useCallback((path, params) => {
    const parts = String(path || '').split('.')
    let cur = content
    for (const p of parts) cur = cur && typeof cur === 'object' ? cur[p] : undefined
    if (typeof cur === 'string') {
      return params
        ? Object.keys(params).reduce((acc, k) => acc.replaceAll(`{${k}}`, params[k]), cur)
        : cur
    }
    return cur
  }, [content])

  return useMemo(() => {
    // Content first, else the English fallback.
    const textOr = (path, fallback) => {
      const value = txt(path)
      return typeof value === 'string' ? value : fallback
    }

    const dig = (obj, path) => String(path).split('.').reduce((cur, p) => (cur && typeof cur === 'object' ? cur[p] : undefined), obj)
    const fill = (s, params) =>
      params ? Object.keys(params).reduce((acc, k) => acc.replaceAll(`{${k}}`, String(params[k])), s) : s
    // The editor's own words: the page's override, this language, then English.
    const edMaybe = (path) =>
      [txt(`planner.editor.${path}`), dig(EDITOR_TEXT[locale], path), dig(EDITOR_TEXT.en, path)].find(
        (v) => typeof v === 'string'
      ) ?? null
    const ed = (path, params) => fill(edMaybe(path) ?? path, params)

    const modelLabel = (m) => textOr(`planner.models.${m.key}`, m.label)
    const finishLabel = (k) => textOr(`planner.finishes.${k}`, FINISHES.find((x) => x.key === k)?.label || k)
    const roomTypeLabel = (k) =>
      textOr(`planner.roomTypes.${k}`, null) ?? edMaybe(`roomTypes.${k}`) ?? ROOM_TYPES.find((x) => x.key === k)?.label ?? k
    // A room shows its typed name, or its type's name in this page's language.
    const roomName = (r) => r.label || roomTypeLabel(r.type)
    // A room group (an open space, or one room): the open living room that holds the
    // kitchen run is "Living room with kitchen" unless the visitor named it.
    const groupName = (g) => {
      if (g.primary?.label) return g.primary.label
      if (g.type === 'living' && g.kitchen) return ed('livingKitchen')
      return roomTypeLabel(g.type)
    }

    const unitCm = textOr('planner.unitCm', 'cm')
    const unitM = textOr('planner.unitM', 'm')
    const unitM2 = locale === 'bg' ? 'м²' : 'm²'
    const fmtCm = (m) => `${Math.round(m * 100)} ${unitCm}`
    const fmtSizeCm = (w, h) => `${fmtCm(w)} × ${fmtCm(h)}`
    const fmtLenCm = (m) => `${fmtCm(m)}`

    const numberFormat = new Intl.NumberFormat(NUMBER_LOCALES[locale], { maximumFractionDigits: 2, minimumFractionDigits: 0 })
    const fixed2 = new Intl.NumberFormat(NUMBER_LOCALES[locale], { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    const fmtNum = (v) => numberFormat.format(v)
    // Units are joined to their number with a no-break space, as everywhere on the site.
    const fmtM2 = (v) => `${numberFormat.format(v)} ${unitM2}`
    const fmtM = (v) => `${fixed2.format(v)} ${unitM}`
    // A size never breaks across lines: no-break spaces round the × as well.
    const fmtDims = (w, d) => `${fixed2.format(w)} × ${fixed2.format(d)} ${unitM}`
    // A house's outside size the way the catalogue writes it, length × width (9,00 × 6,26 м
    // for the 58 m² house, 6,00 × 3,00 м for a 6 × 3 container): the longer side first,
    // whichever of the plan's axes it lies on, so the editor, the offer, the print sheet
    // and the 3D's caption all give the sides in one order.
    const fmtOutside = (w, d) => fmtDims(Math.max(w, d), Math.min(w, d))
    const priceFormat = new Intl.NumberFormat(NUMBER_LOCALES[locale], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    const fmtPrice = (v) => priceFormat.format(v)

    const toolLabel = (k) =>
      k === 'erase'
        ? ed('tool.erase')
        : textOr(`planner.tool.${k}`, { room: 'Room', wall: 'Wall', door: 'Door', window: 'Window', select: 'Select', pan: 'Pan' }[k] || k)

    return {
      locale,
      txt,
      textOr,
      ed,
      modelLabel,
      finishLabel,
      roomTypeLabel,
      roomName,
      groupName,
      unitCm,
      unitM,
      unitM2,
      fmtCm,
      fmtSizeCm,
      fmtLenCm,
      fmtNum,
      fmtM2,
      fmtM,
      fmtDims,
      fmtOutside,
      fmtPrice,
      toolLabel,
    }
  }, [txt, locale])
}
