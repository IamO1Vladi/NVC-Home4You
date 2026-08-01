// Auto-saves the Box House configurator's in-progress configuration to
// localStorage so a returning visitor can pick up where they left off.
// Unlike configPrefill (sessionStorage, per-tab handoff to the offer modal),
// this survives tab/browser restarts and drives the "Continue where you left
// off?" banner.
export const CONFIG_SAVE_KEY = 'nvc_box_config_saved_v1'

// Saved configurations older than this are treated as stale and ignored, so a
// visitor who returns weeks later starts fresh rather than resuming a config
// whose prices/options may have moved on (30 days).
export const CONFIG_SAVE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function saveConfig(config, stepIndex) {
  if (typeof window === 'undefined') return
  try {
    const payload = JSON.stringify({
      config,
      stepIndex: Number.isInteger(stepIndex) ? stepIndex : 0,
      updatedAt: Date.now(),
    })
    window.localStorage.setItem(CONFIG_SAVE_KEY, payload)
  } catch {
    // ignore storage limitations (private mode, quota)
  }
}

// Returns the saved configuration, or null when nothing valid/fresh is stored.
export function loadSavedConfig() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONFIG_SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data.config !== 'object' || data.config === null) return null
    if (
      typeof data.updatedAt === 'number' &&
      Date.now() - data.updatedAt > CONFIG_SAVE_TTL_MS
    ) {
      return null
    }
    return {
      config: data.config,
      stepIndex: Number.isInteger(data.stepIndex) ? data.stepIndex : 0,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export function clearSavedConfig() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CONFIG_SAVE_KEY)
  } catch {
    // ignore storage limitations (private mode, quota)
  }
}
