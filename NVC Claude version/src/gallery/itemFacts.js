// What a gallery model's page says about it beyond its own text (2026-10-17): which of the
// site's four product lines it belongs to, its key facts, and the models like it.
//
// EVERY FIGURE COMES FROM ITS MODULE, never from here and never from a content file:
//   - lead times: shared/deliveryRates.js LEAD_TIMES (the owner, 2026-10-15 and 2026-10-17);
//   - the warranty: shared/warranty.js WARRANTY_YEARS (containers, Box houses and the capsule;
//     nothing for a steel-frame house, whose warranty depends on the project);
//   - assembly: the prices table's own row (shared/prices.js buildPriceSections): a container's
//     price includes it, a Box house's figure is the row's (or boxAssemblyGross by its id when
//     it has no price and so no row), the capsule arrives ready, and the crew is
//     BOX_ASSEMBLY_CREW;
//   - the delivery calculator link: the product the calculator is preset to, as itemLinks.js
//     sends it (?product=container|box|project).
// The words are the gallery content's detail.facts, filled in here.
import { BOX_ASSEMBLY_CREW, boxAssemblyGross, isCapsuleItem } from '../content/shared/prices.js'
import { LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'
import { paths } from '../routes/paths.js'
import { euro } from '../lib/euro.js'
import { catFromItemCategory, isPrefabItem } from './galleryUtils.js'

const fill = (pattern, values = {}) => Object.entries(values).reduce(
  (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
  String(pattern ?? ''),
)

/**
 * The product line a model belongs to, in the gallery index's filter ids: 'wagon' (the
 * containers), 'modular' (the Box houses), 'capsule' or 'prefab' (a steel-frame project), or
 * null (garage, or nothing the site sells as a line).
 *
 * The capsule is a capsule whichever category it is filed under (isCapsuleItem: its own
 * category, or the Space capsule's id while it is still filed under modular), so its page
 * reads the same before and after staff move it.
 */
export function itemKind(item) {
  if (!item) return null
  if (isPrefabItem(item)) return 'prefab'
  if (isCapsuleItem(item)) return 'capsule'
  const codes = catFromItemCategory(item.category)
  if (codes.includes('wagon')) return 'wagon'
  if (codes.includes('modular')) return 'modular'
  return null
}

const DELIVERY_PRODUCT = { wagon: 'container', modular: 'box', capsule: 'box', prefab: 'project' }

/**
 * The key facts for one model: [{ key, label, value, note?, link? }] in reading order, each
 * value a phrase from `copy` (detail.facts) with its figure filled in from its module. `entry`
 * is the model's row in the prices table (GalleryCard priceEntry), which says whether a Box
 * house's assembly figure is known. A model of no line (garage) has none.
 */
export function itemFacts(item, entry, copy, locale = 'en') {
  const kind = itemKind(item)
  if (!kind || !copy) return []
  const at = (key) => paths[key]?.[locale] || paths[key]?.en
  const facts = []
  const deliveryTo = `${at('delivery')}?product=${DELIVERY_PRODUCT[kind]}`

  if (kind === 'wagon') {
    facts.push({ key: 'lead', label: copy.lead, value: fill(copy.containerLead, { days: LEAD_TIMES.containerInStockDays }), note: copy.containerLeadNote })
  } else if (kind === 'modular') {
    facts.push({ key: 'lead', label: copy.lead, value: fill(copy.boxLead, { months: LEAD_TIMES.boxToAddressMonths }), note: fill(copy.boxLeadNote, { production: LEAD_TIMES.boxProductionDays }) })
  } else if (kind === 'capsule') {
    // The capsule's lead time is the Box houses' to the address (the owner, 2026-10-17); its
    // production time was not given separately, so none is stated.
    facts.push({ key: 'lead', label: copy.lead, value: fill(copy.boxLead, { months: LEAD_TIMES.boxToAddressMonths }), note: copy.capsuleLeadNote })
  } else {
    facts.push({ key: 'lead', label: copy.lead, value: copy.perProject })
  }

  if (kind === 'prefab') {
    facts.push({ key: 'warranty', label: copy.warranty, value: copy.perProject })
  } else {
    facts.push({ key: 'warranty', label: copy.warranty, value: fill(copy.warrantyYears, { years: WARRANTY_YEARS.structure }), note: copy.warrantyNote })
  }

  if (kind === 'wagon') {
    facts.push({ key: 'assembly', label: copy.assembly, value: copy.assemblyIncluded })
  } else if (kind === 'capsule') {
    facts.push({ key: 'assembly', label: copy.assembly, value: copy.assemblyNone, note: copy.assemblyNoneNote })
  } else if (kind === 'modular') {
    // The prices table's row where the model has one; by its id where it has none (the table
    // leaves out a model with no price, whose assembly figure prices.js may still have).
    const gross = entry?.kind === 'box' ? entry.row.assemblyGross : boxAssemblyGross(item.id)
    facts.push(gross != null
      ? { key: 'assembly', label: copy.assembly, value: fill(copy.assemblyPrice, { price: euro(gross, locale) }), note: fill(copy.assemblyCrew, { workers: BOX_ASSEMBLY_CREW.workers, days: BOX_ASSEMBLY_CREW.days }) }
      : { key: 'assembly', label: copy.assembly, value: copy.assemblyOnRequest })
  } else {
    facts.push({ key: 'assembly', label: copy.assembly, value: copy.perProject })
  }

  facts.push(kind === 'prefab'
    ? { key: 'delivery', label: copy.delivery, value: copy.deliveryProject, link: { to: deliveryTo, label: copy.deliveryProjectLink } }
    : { key: 'delivery', label: copy.delivery, link: { to: deliveryTo, label: copy.deliveryLink } })

  // A link's arrow stays on the line of its last word in a narrow cell.
  for (const fact of facts) if (fact.link?.label) fact.link.label = fact.link.label.replace(/ →$/, '\u00a0→')
  return facts.filter((fact) => fact.label && (fact.value || fact.link?.label))
}

/**
 * Up to `max` other models of the same line, the closest in price first (then in the gallery's
 * order), for "Подобни модели". None for a model of no line, and none when its line has no
 * other model. "Other" is by identity, not id: two items can share an id.
 */
export function similarItems(items, item, max = 3) {
  const kind = itemKind(item)
  if (!kind) return []
  const price = Number(item?.price) > 0 ? Number(item.price) : null
  return (items || [])
    .map((other, index) => ({ other, index }))
    .filter(({ other }) => other && other !== item && itemKind(other) === kind)
    .map(({ other, index }) => {
      const p = Number(other.price) > 0 ? Number(other.price) : null
      const distance = price == null || p == null ? Number.POSITIVE_INFINITY : Math.abs(p - price)
      return { other, index, distance }
    })
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, max)
    .map(({ other }) => other)
}

const norm = (text) => String(text ?? '')
  .replace(/[\u00a0\s]+/g, ' ')
  .replace(/[:.\s]+$/, '')
  .trim()
  .toLowerCase()

const isEmptyBlock = (el) => !el.querySelector('img, video, iframe, picture, svg, table')
  && String(el.textContent ?? '').replace(/[\u00a0\s\u200b]+/g, '') === ''

/**
 * The gallery's (already sanitised) rich text, tidied for reading on the item page. Display
 * only: the words, their order and the sanitising stay as they are.
 *
 * - The admin's own "Описание" heading at the top (a first block that says only the section's
 *   name, `title`) goes, as the page already heads the section with it: it read twice.
 * - Empty blocks go: the editor's "<p>&nbsp;</p>" spacers and empty headings opened big gaps.
 * - A copy pasted with the description's own wrapper (<div class="gdetail-richtext">) loses
 *   the wrapper, which nested a second set of the section's margins.
 * - Headings sit under the section's heading: the text's highest heading becomes `minLevel`
 *   (h3 on the page, under its h2 "Описание"; h4 in the modal) and the others keep their steps
 *   below it, so no level is skipped (the Box houses' h4s were straight under the page's h2).
 *   A "heading" that is a whole paragraph (over 120 characters) is a paragraph.
 */
export function tidyDescription(html, { title = '', minLevel = 3 } = {}) {
  if (!html || typeof DOMParser === 'undefined') return html || ''
  let doc
  try {
    doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  } catch {
    return html
  }
  const body = doc.body

  for (const wrapper of [...body.querySelectorAll('div.gdetail-richtext')]) {
    wrapper.replaceWith(...wrapper.childNodes)
  }

  for (const el of [...body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div')].reverse()) {
    if (el.isConnected && isEmptyBlock(el)) el.remove()
  }

  const first = body.firstElementChild
  if (first && title && norm(first.textContent) === norm(title)) first.remove()

  const levelOf = (heading) => Number(heading.tagName.slice(1))
  const isParagraph = (heading) => String(heading.textContent ?? '').replace(/\s+/g, ' ').trim().length > 120
  const headings = [...body.querySelectorAll('h1, h2, h3, h4, h5, h6')]
  const kept = headings.filter((heading) => !isParagraph(heading)).map(levelOf)
  const shift = kept.length ? minLevel - Math.min(...kept) : 0
  for (const heading of headings) {
    const level = levelOf(heading)
    let tag = null
    if (isParagraph(heading)) tag = 'p'
    else {
      const to = Math.min(6, Math.max(minLevel, level + shift))
      if (to !== level) tag = `h${to}`
    }
    if (!tag) continue
    const next = doc.createElement(tag)
    for (const attr of [...heading.attributes]) next.setAttribute(attr.name, attr.value)
    next.append(...heading.childNodes)
    heading.replaceWith(next)
  }

  // Leading and trailing line breaks inside a block (and the blank "&nbsp;" after one) are only
  // extra lines.
  const blank = (node) => node && (node.nodeName === 'BR'
    || (node.nodeType === 3 && String(node.textContent).replace(/[\u00a0\s\u200b]+/g, '') === ''))
  for (const block of [...body.querySelectorAll('p, li, h3, h4, h5, h6')]) {
    while (blank(block.firstChild)) block.firstChild.remove()
    while (blank(block.lastChild)) block.lastChild.remove()
  }

  return body.innerHTML
}
