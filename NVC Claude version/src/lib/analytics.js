// Thin wrapper around the GTM dataLayer. All funnel/conversion events go through
// here so event names stay greppable and pushes are safe during SSR/prerender.
// GTM decides (via consent mode) whether any tag actually fires on these pushes.
export function trackEvent(event, params = {}) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...params })
}
