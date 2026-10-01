// Prerender's data check: does the local app serve the same catalogue prices as the live
// site? (scripts/prerender.mjs has the story of why that check exists.)
//
// Items are matched by public id. An id that appears more than once in EITHER catalogue
// cannot be matched — a Map keeps whichever copy came last and compares it against an
// arbitrary partner — so it is set aside and named instead of compared. That is not a
// hypothetical: live served the admin-created Space house and the imported 73 m² house
// both as 15 until #35, and the first release after #35 compares a local catalogue where
// they are 15 and 100015 against a live one where both are still 15. Compared naively,
// "15" read €28,000 locally and €55,000 live, a difference that is only the renumbering,
// and the release would have refused to prerender.
//
// Pure, and in src/lib rather than in the script, so vitest can reach it.

function indexById(items) {
  const prices = new Map()
  const repeated = new Set()
  for (const item of items || []) {
    if (item?.id == null) continue
    const id = String(item.id)
    if (prices.has(id)) repeated.add(id)
    prices.set(id, Number(item.price) || 0)
  }
  return { prices, repeated }
}

export function compareCataloguePrices(localItems, liveItems) {
  const local = indexById(localItems)
  const live = indexById(liveItems)
  const ambiguous = [...new Set([...local.repeated, ...live.repeated])].sort()

  const differences = []
  let compared = 0
  for (const [id, price] of live.prices) {
    if (ambiguous.includes(id) || !local.prices.has(id)) continue
    compared++
    if (local.prices.get(id) !== price) {
      differences.push({ id, local: local.prices.get(id), live: price })
    }
  }

  return { differences, ambiguous, compared, localCount: local.prices.size }
}
