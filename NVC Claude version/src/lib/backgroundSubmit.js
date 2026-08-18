// Fire-and-forget form submission, with retries and a visible status.
//
// WHY THIS EXISTS. The offer and question modals used to stay open while the request ran,
// with the visitor staring at a button that appeared to do nothing on a slow connection.
// What people do to a button that appears to do nothing is press it again — which is how
// one enquiry arrives five times and the inbox reads like spam. So: the modal closes the
// moment Send is pressed, the request runs back here, a small banner reports on it, and a
// transient failure retries itself instead of asking the visitor to.
//
// A MODULE-LEVEL STORE, not React state, deliberately: the submission must survive the
// modal unmounting (that is the whole point) and must be reachable from any page — App's
// modals and the doors page both submit through here. The banner component subscribes.

/** Statuses the server could plausibly recover from on an identical retry. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

/**
 * Waits between attempts: 2s, 4s, 8s, 16s. Roughly exponential because the likely causes
 * — a phone in a dead spot, an App Service cold start, a transient 503 — all get MORE
 * likely to succeed with more distance, not less.
 */
export const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000]

export const MAX_ATTEMPTS = 5

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * POSTs JSON with up to `attempts` tries.
 *
 * Retries on network errors and on the statuses above. Any OTHER 4xx stops immediately:
 * the request itself is at fault, and re-sending identical bad input just hammers the
 * server five times to learn the same answer — the exact behaviour this module exists to
 * stop humans doing.
 *
 * Returns { ok, attempt, status } rather than throwing — the caller is a status banner,
 * and every outcome is a state to display, not an exception to handle.
 */
export async function sendWithRetry(url, payload, options = {}) {
  const {
    attempts = MAX_ATTEMPTS,
    delays = RETRY_DELAYS_MS,
    onAttempt,
    fetchImpl,
  } = options
  const doFetch = fetchImpl || ((u, init) => fetch(u, init))

  let lastStatus = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    onAttempt?.(attempt)
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) return { ok: true, attempt, status: res.status }

      lastStatus = res.status
      if (!RETRYABLE_STATUSES.has(res.status)) {
        return { ok: false, attempt, status: res.status, retriable: false }
      }
    } catch {
      // A network error: offline, DNS, aborted. The classic retryable case.
      lastStatus = null
    }

    if (attempt < attempts) {
      await sleep(delays[Math.min(attempt - 1, delays.length - 1)])
    }
  }

  return { ok: false, attempt: attempts, status: lastStatus, retriable: true }
}

// ---------------------------------------------------------------------------------------
// The store the banner renders.

let nextId = 1
let items = []
const listeners = new Set()

function emit() {
  for (const listener of listeners) listener(items)
}

function patch(id, changes) {
  items = items.map((item) => (item.id === id ? { ...item, ...changes } : item))
  emit()
}

/** The banner subscribes here. Returns the unsubscribe. */
export function subscribeSubmissions(listener) {
  listeners.add(listener)
  listener(items)
  return () => listeners.delete(listener)
}

export function dismissSubmission(id) {
  items = items.filter((item) => item.id !== id)
  emit()
}

/** Test hook: a clean slate between tests, never called by the app. */
export function _resetSubmissions() {
  items = []
  listeners.clear()
  // nextId deliberately NOT reset. A success schedules its own dismissal on a timer, and a
  // timer can outlive the test that started it — if ids restart at 1, that stale dismissal
  // deletes some LATER submission that reused the number. Globally unique ids make a stale
  // timer a no-op, which is also the honest model of how the store runs in the app.
}

/**
 * Starts a submission and returns immediately — the caller closes its modal and moves on.
 *
 * `labels` is the text the banner shows for THIS submission ({ sending, retrying, success,
 * error }), resolved by the caller in the visitor's language at enqueue time. The store
 * stays locale-blind on purpose: a submission outlives the page that started it, and the
 * language it was asked in is part of the submission, not of whatever page is on screen
 * when it finishes.
 *
 * `onSuccess` is where analytics live, so a tracked lead is always a lead that actually
 * reached the server — never one that died in retry.
 */
export function submitInBackground({ url, payload, labels, onSuccess, options = {} }) {
  const id = nextId++
  const { successTtlMs = 4000 } = options

  items = [...items, { id, status: 'sending', attempt: 1, labels, retry: null }]
  emit()

  const run = async () => {
    patch(id, { status: 'sending', retry: null })

    const result = await sendWithRetry(url, payload, {
      ...options,
      onAttempt: (attempt) => patch(id, {
        attempt,
        // Attempt one is just "sending" — a visitor should not read "attempt 1 of 5" on a
        // request that is going perfectly normally.
        status: attempt > 1 ? 'retrying' : 'sending',
      }),
    })

    if (result.ok) {
      patch(id, { status: 'success' })
      try { onSuccess?.() } catch { /* analytics must never break the flow */ }
      // Success needs acknowledging, not managing: it thanks and leaves.
      setTimeout(() => dismissSubmission(id), successTtlMs)
      return
    }

    // Spent all five attempts (or hit a non-retryable answer). The banner stays until the
    // visitor acts on it — auto-dismissing a FAILURE would silently lose their enquiry.
    patch(id, { status: 'error', retry: run })
  }

  run()
  return id
}
