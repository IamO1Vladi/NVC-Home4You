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
    //
    // ASP.NET puts a DIFFERENT shape in the same field: ValidationProblemDetails.errors is
    // an object keyed by whatever failed, and it is what comes back when a body cannot be
    // bound at all — a fractional number where an int was expected, say, which happens
    // before a single one of our own rules gets to run. Read only for the array, that
    // answer degrades to a bare status code, and the panel tells somebody their save failed
    // without naming one of the fields they could go and fix.
    let detail = ''
    try {
      const body = await res.json()
      if (Array.isArray(body?.errors)) detail = body.errors.join(' ')
      else if (body?.errors && typeof body.errors === 'object') {
        detail = Object.values(body.errors).flat().join(' ')
      }
    } catch {
      /* not JSON; fall through to the status text */
    }
    // The code rides along with the sentence. A save that is refused and a save that hit a
    // server having a bad minute read almost identically as prose, and the panel owes them
    // opposite answers — keep the dialog open on the first, hand the request to the retries
    // on the second (adminSave.js). A network failure never reaches this branch at all, and
    // the status it therefore does NOT carry is how the caller recognises one.
    const error = new Error(detail || `Request failed (${res.status})`)
    error.status = res.status
    throw error
  }

  if (res.status === 204) return null

  // The success body is parsed inside its own try for the same reason the code above is
  // attached to the error: a truncated 200 throws a SyntaxError, which carries no status,
  // and a status-less error is precisely how adminSave recognises a request that never got
  // an answer. It would hand a write the server has ALREADY COMMITTED to the retries.
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    const error = new Error(`The server answered ${res.status}, but the answer could not be read.`)
    error.status = res.status
    throw error
  }
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
