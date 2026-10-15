import { houseVariantPrices, templateDisplayName } from '../../content/shared/plannerModels.js'

// What the planner hands the site's offer form. The form (App.jsx) reads the
// configurator's prefill store when it opens and puts `offerText` in the message,
// so the planner writes the same shape there (writeConfiguratorPrefill) with its
// own `source`, and with this page's path: the store only prefills a form opened
// on the page that wrote it, so the plan never leaks into another page's enquiry.

/**
 * The plan as the lines a salesperson reads in the lead: model, catalogue layout,
 * footprint, terrace, each room with its m², totals and a link that reopens it.
 * `summary` is PlannerEditor's summary (rooms carry their display `name`).
 */
export function buildPlannerOfferText({ summary, model, t, shareUrl = '' }) {
  const { ed, modelLabel, fmtM2, fmtOutside, fmtPrice, locale } = t
  const lines = [ed('offerText.heading'), '']
  lines.push(`${ed('offerText.model')}: ${modelLabel(model)}`)
  if (summary.template) {
    // A catalogue layout by its key; a container shell by its name ("Корпус 6 × 3 м"),
    // since it is not a catalogue layout and its key means nothing to the reader.
    const { name, catalogue } = templateDisplayName(summary.template, locale)
    const label = catalogue ? ed('offerText.template') : ed('offerText.templateShell')
    lines.push(`${label}: ${name}${summary.templateEdited ? ` (${ed('offerText.edited')})` : ''}`)
  }
  lines.push(`${ed('offerText.outside')}: ${fmtOutside(summary.widthM, summary.depthM)} (${fmtM2(summary.footprintM2)})`)
  if (summary.terrace) {
    const { label, included, price } = summary.terrace
    const cost = included ? ed('project.included') : ed('project.surcharge', { price: fmtPrice(price) })
    lines.push(`${ed('offerText.terrace')}: ${label} (${cost})`)
  }
  if (summary.rooms.length) {
    lines.push('', `${ed('offerText.rooms')}:`)
    for (const r of summary.rooms) {
      lines.push(`– ${r.name}${r.locked ? ` (${ed('offerText.fixed')})` : ''}: ${fmtM2(r.areaM2)}`)
    }
    lines.push(`${ed('offerText.total')}: ${fmtM2(summary.totalRoomsM2)}`)
  }
  lines.push(ed('offerText.counts', { doors: summary.doors, windows: summary.windows }))
  if (shareUrl) lines.push('', `${ed('offerText.link')}:`, shareUrl)
  return lines.join('\n')
}

/**
 * The prefill object for writeConfiguratorPrefill (src/lib/configPrefill.js).
 * `knownTotal` is the catalogue price of the house as drawn (the standard house
 * plus the terrace's surcharge), for the lead_value the offer's analytics send;
 * 0 for a container, which has no catalogue price.
 */
export function buildPlannerPrefill({ summary, model, t, sourcePath, shareUrl = '' }) {
  const offerText = buildPlannerOfferText({ summary, model, t, shareUrl })
  const prices = houseVariantPrices(model.key)
  const knownTotal = prices ? prices.standard + (summary.terrace?.price || 0) : 0
  return {
    source: 'floor-planner',
    sourcePath,
    // No modelId, as in the configurator: the offer's model field links a Houses
    // record, and a planner model is not one. The model is named in the text.
    modelLabel: t.modelLabel(model),
    knownTotal,
    offerText,
    questionText: offerText,
    updatedAt: Date.now(),
  }
}
