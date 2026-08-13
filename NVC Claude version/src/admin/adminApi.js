// Fetch helpers for the admin panel.
//
// Every call can come back 401 when the Entra session expires, and that is a different
// problem from a server error: it needs a sign-in prompt, not a retry button. Rather than
// have each page remember to check for it, these throw a tagged error the shell recognises.

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized')
    this.name = 'UnauthorizedError'
  }
}

async function handle(res) {
  if (res.status === 401) throw new UnauthorizedError()

  if (!res.ok) {
    // The API reports validation failures as { errors: [...] }. Surfacing those verbatim is
    // the point — "Category is required" is actionable, "Request failed" is not.
    let detail = ''
    try {
      const body = await res.json()
      if (Array.isArray(body?.errors)) detail = body.errors.join(' ')
    } catch {
      /* not JSON; fall through to the status text */
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }

  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const adminGet = (url) => fetch(url, { headers: { Accept: 'application/json' } }).then(handle)

export const adminSend = (url, method, body) =>
  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handle)

export const adminDelete = (url) => fetch(url, { method: 'DELETE' }).then(handle)

// For endpoints that take text and files in ONE request — the lead reply, where sending
// the message and its attachments separately would let one succeed and the other fail.
// No Content-Type header, for the same reason as adminUpload below.
export const adminSendForm = (url, form) =>
  fetch(url, { method: 'POST', headers: { Accept: 'application/json' }, body: form }).then(handle)

// Multipart, so no Content-Type header — the browser has to set the multipart boundary
// itself, and setting it by hand produces a request the server cannot parse.
export function adminUpload(url, file, fields = {}) {
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') form.append(key, value)
  }
  return fetch(url, { method: 'POST', body: form }).then(handle)
}
