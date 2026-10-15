// The Box House configurator writes its current summary here so the global
// offer/question modals can prefill their message field with the configuration.
export const CONFIG_PREFILL_KEY = 'nvc_box_config_prefill_v1'

export function writeConfiguratorPrefill(data) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CONFIG_PREFILL_KEY, JSON.stringify(data))
  } catch {
    // ignore storage limitations (private mode, quota)
  }
}

// Returns the stored prefill only when `pathname` matches the page that wrote
// it, so configurator text never leaks into offers started elsewhere on the site.
export function readConfiguratorPrefill(pathname) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(CONFIG_PREFILL_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.sourcePath !== pathname) return null
    return data
  } catch {
    return null
  }
}

// The prefill an offer or question form opens with. The configurator's summary (or the
// delivery calculator's estimate) when this page saved one; otherwise only the lead source a
// page's own button passed, openOffer({ source: 'about-page' }), which GA and Meta then report
// as lead_source instead of 'site' (App.jsx reads offerPrefillData.source). Most buttons hand
// openOffer straight to onClick, so the argument is often a click event: that, and anything
// else without a plain string `source`, is no source at all.
export function enquiryPrefill(pathname, arg) {
  const saved = readConfiguratorPrefill(pathname)
  if (saved) return saved
  const isEvent = Boolean(arg && typeof arg === 'object' && ('nativeEvent' in arg || 'target' in arg))
  const source = !isEvent && typeof arg?.source === 'string' ? arg.source.trim() : ''
  return source ? { source } : null
}
