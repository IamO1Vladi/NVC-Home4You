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
