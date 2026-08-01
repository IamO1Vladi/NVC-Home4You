import LZString from 'lz-string'

// The configurator serialises its config object into a compact, URL-safe token
// so a visitor can share or bookmark an exact configuration. We use lz-string's
// EncodedURIComponent variant and carry it in the URL *hash* (#cfg=...) so the
// payload never reaches the server/logs and doesn't interfere with path routing.
export const SHARE_HASH_KEY = 'cfg'

export function encodeConfig(config) {
  try {
    return LZString.compressToEncodedURIComponent(JSON.stringify(config))
  } catch {
    return ''
  }
}

export function decodeConfig(encoded) {
  if (!encoded || typeof encoded !== 'string') return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const parsed = JSON.parse(json)
    // Guard against non-object payloads (arrays, primitives) so callers can
    // safely spread the result over their config object.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

// Builds an absolute shareable URL for the given config.
export function buildShareUrl(config, { origin = '', pathname = '' } = {}) {
  const encoded = encodeConfig(config)
  if (!encoded) return `${origin}${pathname}`
  return `${origin}${pathname}#${SHARE_HASH_KEY}=${encoded}`
}

// Extracts and decodes a shared config from a location hash (e.g. "#cfg=..."),
// or null when the hash carries no valid shared config. Parsed by hand rather
// than with URLSearchParams because lz-string output can contain '+', which
// form-decoding would turn into a space and corrupt the payload.
export function readSharedConfigFromHash(hash = '') {
  if (typeof hash !== 'string' || !hash) return null
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  const prefix = `${SHARE_HASH_KEY}=`
  const segment = clean.split('&').find((part) => part.startsWith(prefix))
  if (!segment) return null
  return decodeConfig(segment.slice(prefix.length))
}

// --- Phase 2: short server-side share links ----------------------------------
// A /c/{code} link is far shorter than the #cfg= hash and lets us later add
// "email me my config". The server stores the config behind a random short code.
export const SHORT_LINK_QUERY_KEY = 'c'

// Reads the short-link code from a location search string (e.g. "?c=Ab3xK9pQ").
// Codes are the alphanumeric alphabet the backend mints, so anything else is
// rejected rather than sent to the API.
export function readShortCodeFromSearch(search = '') {
  if (typeof search !== 'string' || !search) return null
  try {
    const code = new URLSearchParams(search).get(SHORT_LINK_QUERY_KEY)
    if (!code || !/^[A-Za-z0-9]{4,32}$/.test(code)) return null
    return code
  } catch {
    return null
  }
}

// Creates a short link for the given config by saving it server-side. Returns the
// absolute short URL on success, or null when the API is unavailable / disabled so
// callers can fall back to the self-contained #cfg= hash link.
export async function createShortLink(config, { apiBase = '', returnPath = '', modelLabel = '', locale = '' } = {}) {
  if (typeof fetch !== 'function' || !config) return null
  try {
    const res = await fetch(`${apiBase}/api/config-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, modelLabel, locale, returnPath }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.url === 'string' && data.url ? data.url : null
  } catch {
    return null
  }
}

// Resolves a short-link code back to its stored config object, or null if the
// code is unknown / the request fails.
export async function resolveShortLink(code, { apiBase = '' } = {}) {
  if (typeof fetch !== 'function' || !code) return null
  try {
    const res = await fetch(`${apiBase}/api/config-link/${encodeURIComponent(code)}`)
    if (!res.ok) return null
    const data = await res.json()
    const parsed = data?.config
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

// Basic email shape check for client-side UX (the server validates authoritatively).
export function isLikelyEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// Phase 2b: asks the server to save the config and email its short link to the
// visitor. Returns true on success, false otherwise (feature disabled, bad email,
// or delivery failure) so the UI can show a friendly message.
export async function emailMyConfig(config, email, { apiBase = '', modelLabel = '', locale = '', returnPath = '' } = {}) {
  if (typeof fetch !== 'function' || !config || !isLikelyEmail(email)) return false
  try {
    const res = await fetch(`${apiBase}/api/config-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, email: email.trim(), modelLabel, locale, returnPath }),
    })
    return res.ok
  } catch {
    return false
  }
}
