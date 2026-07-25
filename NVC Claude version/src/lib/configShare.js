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
