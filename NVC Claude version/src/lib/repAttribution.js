// Remembers which representative's link a visitor arrived through (ROADMAP #38), so the
// enquiry they send later — from the offer modal, the configurator or the doors page,
// today or next month — is attributed to that representative and lands as their lead.
//
// Modelled on configPersistence: localStorage, JSON, a TTL, and no exception ever leaves
// this file (private mode, quota, a tampered value). The slug is remembered, not the
// representative: the server owns the registry and resolves the slug on every enquiry, so
// a link whose representative has since been removed simply attributes nothing.
//
// Last touch wins. A visitor who follows two representatives' links is credited to the
// one they followed most recently — the video they just watched — rather than the first,
// and there is no reason to let a stale first visit outrank that.
export const REP_KEY = 'nvc_rep_v1'

// How long a visit through the link keeps attributing enquiries (30 days, the owner's
// number). Past that the visitor is treated as having found us on their own.
export const REP_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Mirrors the server's slug rule (EnvConfig.REPRESENTATIVES). Case-insensitive here and
// lower-cased on save, so /r/DTodorov attributes the same as /r/dtodorov; anything the
// server would never register is not worth storing.
export const REP_SLUG_RE = /^[a-z0-9][a-z0-9._-]{1,39}$/i

export function isValidRepSlug(slug) {
  return typeof slug === 'string' && REP_SLUG_RE.test(slug)
}

export function saveRep(slug) {
  if (typeof window === 'undefined') return
  if (!isValidRepSlug(slug)) return
  try {
    const payload = JSON.stringify({ slug: slug.toLowerCase(), savedAt: Date.now() })
    window.localStorage.setItem(REP_KEY, payload)
  } catch {
    // ignore storage limitations (private mode, quota)
  }
}

// Returns the remembered slug, or null when nothing valid and fresh is stored. Every bad
// shape (missing, not JSON, not an object, no timestamp, invalid slug) reads as null rather
// than as a half-trusted value: the slug goes into a request body, so only a slug that
// passes the same rule the server applies ever leaves here.
export function loadRep() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(REP_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    if (!isValidRepSlug(data.slug)) return null
    if (typeof data.savedAt !== 'number' || Date.now() - data.savedAt > REP_TTL_MS) return null
    return data.slug.toLowerCase()
  } catch {
    return null
  }
}

export function clearRep() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(REP_KEY)
  } catch {
    // ignore storage limitations (private mode, quota)
  }
}
