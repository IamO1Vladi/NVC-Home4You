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
//
// THE ADMIN PANEL SHARES THE STORE BUT NOT THE POLICY. Its editors save records the
// business runs on, and those saves can be REFUSED — a blank name, a quantity of zero —
// which is the one outcome closing the dialog would make unrecoverable: no form, no text,
// and a banner reporting a failure nothing retries. So the panel keeps its dialog open for
// the first attempt and only hands the request down here once the server has proved the
// problem is transient. See admin/adminSave.js; what it borrows is this file's retry
// budget, its store and its banner, so both halves of the product report in one voice.

/**
 * Statuses the server could plausibly recover from on an identical retry.
 *
 * Exported because the panel has to make the same judgement one attempt EARLIER than this
 * loop does — before it decides whether to close the dialog. Two lists of retryable codes
 * would be two lists to keep in step forever, and the day they disagreed the panel would
 * throw away someone's typing on a 503.
 */
export const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

/**
 * Waits between attempts: 2s, 4s, 8s, 16s. Roughly exponential because the likely causes
 * — a phone in a dead spot, an App Service cold start, a transient 503 — all get MORE
 * likely to succeed with more distance, not less.
 */
export const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000]

export const MAX_ATTEMPTS = 5

let retryDelays = RETRY_DELAYS_MS

/**
 * Test hook: shorten the backoff, so a test can watch all five attempts happen without
 * sitting through half a minute of them. Never called by the app.
 *
 * It exists because the callers that matter most here — the admin dialogs — reach the retry
 * loop from inside a React page, several layers away from any `options` argument. Without
 * this, a test of "the server was down and the banner said so" either runs for thirty
 * seconds or leaves a live retry loop firing requests into whichever test comes next.
 * Called with nothing, it puts the real delays back.
 */
export function _setRetryDelays(delays) {
  retryDelays = delays ?? RETRY_DELAYS_MS
}

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
    delays = retryDelays,
    // The public forms all POST to a create endpoint. An edit in the panel is a PUT to the
    // record it edits, and it is exactly as safe to repeat — more so, since writing the same
    // fields twice lands on the same row rather than making a second one.
    method = 'POST',
    onAttempt,
    fetchImpl,
    // Asked before every attempt, because most of this loop's life is spent asleep. A
    // submission that has been superseded has to stop THERE rather than wake up and land on
    // top of the save that replaced it — see cancelSubmission.
    isCancelled,
  } = options
  const doFetch = fetchImpl || ((u, init) => fetch(u, init))

  let lastStatus = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (isCancelled?.()) return { ok: false, attempt, status: lastStatus, cancelled: true }
    onAttempt?.(attempt)
    try {
      const res = await doFetch(url, {
        method,
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
const cancelled = new Set()

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

/**
 * Abandons a submission that no longer speaks for anybody: it leaves the banner and its
 * retries stop where they are, at the next attempt or the next wake-up.
 *
 * The case is a SECOND save of the same record while the first is still being retried. The
 * older body is not merely redundant by then, it is wrong — it is the state the person has
 * just corrected — and a retry that wins the race writes it back over the correction with a
 * green banner on top. So the newer save supersedes the older one; see admin/adminSave.js,
 * which is the only caller, because the public forms create one enquiry each and none of
 * them is a later version of another.
 */
export function cancelSubmission(id) {
  cancelled.add(id)
  dismissSubmission(id)
}

/** Test hook: a clean slate between tests, never called by the app. */
export function _resetSubmissions() {
  items = []
  listeners.clear()
  cancelled.clear()
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
      isCancelled: () => cancelled.has(id),
      onAttempt: (attempt) => patch(id, {
        attempt,
        // Attempt one is just "sending" — a visitor should not read "attempt 1 of 5" on a
        // request that is going perfectly normally.
        status: attempt > 1 ? 'retrying' : 'sending',
      }),
    })

    // Superseded. cancelSubmission already took the banner away, and saying anything else
    // about a body nobody wants written would be worse than saying nothing.
    if (result.cancelled) return

    if (result.ok) {
      patch(id, { status: 'success' })
      try { onSuccess?.() } catch { /* analytics must never break the flow */ }
      // Success needs acknowledging, not managing: it thanks and leaves.
      setTimeout(() => dismissSubmission(id), successTtlMs)
      return
    }

    // Spent all five attempts (or hit a non-retryable answer). The banner stays until the
    // visitor acts on it — auto-dismissing a FAILURE would silently lose their enquiry.
    //
    // A 401 is the one failure a retry button cannot help with: the session expired mid
    // backoff, every further attempt answers the same, and a person who keeps pressing
    // "Try again" is being invited to do the one thing that cannot work. It says so
    // instead, and the panel's next request is what puts the sign-in screen up. Only the
    // admin panel can meet one — the public endpoints take no session at all.
    const expired = result.status === 401
    patch(id, { status: 'error', expired, retry: expired ? null : run })
  }

  run()
  return id
}

/**
 * Puts an ALREADY-LANDED submission on the banner: no request, no retries, just the green
 * line the public forms end on.
 *
 * The panel needs this because its saves are confirmed while the dialog is still open — by
 * the time there is anything to announce, the write is done and there is nothing left to
 * manage. Reporting it through this store rather than growing a second banner is the whole
 * point: one strip of text in the top-right corner, whichever half of the product wrote it,
 * and one place that decides how long a success is worth looking at.
 */
export function announceSuccess(labels, { successTtlMs = 4000 } = {}) {
  const id = nextId++
  items = [...items, { id, status: 'success', attempt: 1, labels, retry: null }]
  emit()
  setTimeout(() => dismissSubmission(id), successTtlMs)
  return id
}
