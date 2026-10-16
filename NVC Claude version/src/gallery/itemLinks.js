// Where a gallery product page links on to (2026-10-16). Until then its only link was "back to
// the gallery", so a crawler or a visitor who landed on a model from search had nowhere to go
// but back: not to the page that explains the product, not to its price with assembly, not to
// the configurator or the delivery calculator.
//
// Every target is one that exists, checked here rather than assumed:
//   - the product page, by the item's gallery category: wagon -> the containers page, modular
//     -> the Box houses page, prefab (a steel-frame project already built, 2026-10-17) -> the
//     steel-frame houses page. The capsule, filed under modular or under its own capsule
//     category, links to its own card on the Box houses page (#item-<id>, UnitCard's anchor),
//     where it is sold. Garage links nowhere.
//   - its card on the prices page, #item-<id>: PricesPage gives every row of buildPriceSections
//     that id, so the same call decides whether the row is there (a priced wagon or Box house).
//     "With assembly" only where the row has an assembly figure: not for the capsule, which
//     arrives ready and has none (owner, 2026-10-17).
//   - the configurator on its model, ?model=37|58|73, which BoxHouseConfiguratorPage reads and
//     checks against its catalogue: only the gallery houses that ARE those models, the standard
//     and the veranda-and-double-roof house of each size (the configurator builds both; the
//     same ids ModularHousesPage's size cards use). Never the panoramic, two-storey, 18 m² or
//     capsule houses, which it cannot build.
//   - the delivery calculator preset to the product, ?product=container|box|project, which
//     DeliveryPage reads. The capsule's is the Box houses' (owner, 2026-10-17: the same rate,
//     crane and lead time); a steel-frame project's is "project", the calculator's own.
import { paths } from '../routes/paths.js'
import { buildPriceSections, CAPSULE_ID, isCapsuleItem } from '../content/shared/prices.js'
import { getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import { catFromItemCategory } from './galleryUtils.js'

/** Gallery id -> configurator model key, for the houses the configurator can build. */
export const CONFIGURATOR_MODEL_BY_ID = {
  10: '37', // Разгъваема къща – 37 м²
  11: '37', // Разгъваема къща – 37 м² с веранда и двоен покрив
  5: '58', // Разгъваема къща – 58 м²
  4: '58', // Разгъваема къща – 58 м² с веранда и двоен покрив
  9: '73', // Разгъваема къща – 73 м²
  15: '73', // Разгъваема къща – 73 м² с веранда и двоен покрив
}

// The Space capsule's id lives in shared/prices.js beside the rule that it arrives ready.
export { CAPSULE_ID }

const PRODUCT_PAGE = { wagon: 'modularBuilds', modular: 'modularHouses', capsule: 'modularHouses', prefab: 'steelHouses' }
const PAGE_LINK = { modularBuilds: 'containers', modularHouses: 'box', steelHouses: 'steel' }
const DELIVERY_PRODUCT = { wagon: 'container', modular: 'box', capsule: 'box', prefab: 'project' }

/**
 * The links for one gallery item, in reading order: [{ key, to, label }], router paths in this
 * locale. `copy` is the gallery content's detail.links; a link with no words is left out.
 */
export function galleryItemLinks(item, locale = 'en', copy = {}) {
  if (!item) return []
  const at = (key) => paths[key]?.[locale] || paths[key]?.en
  const kind = catFromItemCategory(item.category).find((code) => PRODUCT_PAGE[code]) || null
  const links = []

  if (kind) {
    const page = PRODUCT_PAGE[kind]
    // The capsule's own card on the Box houses page, in either of its categories.
    const capsule = page === 'modularHouses' && isCapsuleItem(item)
    links.push({
      key: 'product',
      to: capsule ? `${at(page)}#item-${item.id}` : at(page),
      label: (capsule && copy.capsule) || copy[PAGE_LINK[page]],
    })
  }

  const { box, wagon } = buildPriceSections([item])
  const row = box[0] || wagon[0]
  if (row) {
    const label = row.assemblyGross == null ? copy.pricesNoAssembly || copy.prices : copy.prices
    links.push({ key: 'prices', to: `${at('prices')}#item-${item.id}`, label })
  }

  const model = CONFIGURATOR_MODEL_BY_ID[item.id]
  const { models } = getBoxConfiguratorCatalog(locale)
  if (model && kind === 'modular' && models.some((m) => m.key === model)) {
    links.push({ key: 'configurator', to: `${at('boxConfigurator')}?model=${model}`, label: copy.configurator })
  }

  if (kind) {
    // The calculator works out no figure for a house to a plan (its delivery is quoted with the
    // project), so a steel-frame project's link does not promise one.
    const label = (DELIVERY_PRODUCT[kind] === 'project' && copy.deliveryProject) || copy.delivery
    links.push({ key: 'delivery', to: `${at('delivery')}?product=${DELIVERY_PRODUCT[kind]}`, label })
  }

  return links.filter((link) => link.to && link.label)
}

/** A router path from a gallery base that may be absolute ("https://…/bg/galeriq" -> "/bg/galeriq"). */
export function routerPath(href) {
  const value = String(href || '')
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value
  try {
    const url = new URL(value)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
}
