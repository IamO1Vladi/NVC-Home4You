import { adminSend, UnauthorizedError } from './adminApi.js'
import {
  RETRYABLE_STATUSES, announceSuccess, cancelSubmission, submitInBackground,
} from '../lib/backgroundSubmit.js'

// How a save from an admin dialog behaves — and why it is not quite what the public site does.
//
// The public modals close the instant Send is pressed and let lib/backgroundSubmit.js retry
// in peace. That was the right answer there: the failure being designed away was a visitor
// pressing Send five times at a button that appeared to do nothing, and every one of those
// requests was going to be accepted eventually.
//
// A save from the panel is not that. It can be REFUSED — a blank lead name, a malformed
// address, a quantity of zero — and backgroundSubmit deliberately never retries a 4xx,
// because re-sending identical bad input just asks the same question five times. So closing
// the dialog on the click would leave the person who typed it with a red banner, no form,
// and their text gone, on the records the business actually runs on.
//
// The rule, therefore: ONE attempt runs with the dialog still open, and what comes back
// decides who owns the request from there.
//
//   accepted     the dialog closes and the banner says so.
//   refused      the dialog STAYS OPEN with everything typed still in it, wearing the
//                server's own sentence. Nothing is retried; nothing is lost.
//   transient    a 5xx, a timeout, a laptop that lost the office wifi — the dialog closes
//                and backgroundSubmit takes it, exactly as on the public site, banner and
//                backoff and all. ONLY IF THE REQUEST IS SAFE TO SEND TWICE, which is the
//                whole of `repeatable` below.
//   unrepeatable the same failure on a request that is not safe to send twice. The dialog
//                stays open saying no answer came back, and a person decides — because
//                only a person can look at the board and see whether the row is there.
//
// The transient case re-sends from scratch rather than resuming, so a save that falls back
// costs one attempt plus the module's five. Which is fine: the alternative is a budget this
// file has to keep in step with that one forever, to save a single request on the path
// nobody is watching.
//
// 401 is not one of the four. An expired Entra session needs a sign-in prompt, not a retry
// button, so UnauthorizedError travels straight through to the page's own handler — and if
// the session expires later, mid-backoff, the banner says so rather than offering a retry
// that will answer 401 forever (see backgroundSubmit's `expired`).

/**
 * What the banner says about a save, in the language the panel is being used in.
 *
 * One dictionary for every screen rather than six keys copied into each page's TEXT: the
 * banner is chrome, it reads identically wherever it was triggered from, and a per-page
 * copy is a per-page chance for the two languages to drift apart.
 */
export const BANNER_TEXT = {
  bg: {
    sending: 'Запазване…',
    retrying: 'Нов опит',
    success: 'Запазено',
    // Names the loss, not the request. Somebody reading this closed the dialog a minute ago
    // and has moved on: what they need to know is that the typing is gone and the record
    // still says what it said.
    error: 'Запазването не успя. Промяната не е записана.',
    // Says exactly what is and is not known. The request went out and nothing came back, so
    // promising that nothing was written would be a guess — and the guess that costs a
    // second identical record is the expensive one.
    lost: 'Няма отговор от сървъра. Проверете дали записът е създаден, преди да опитате пак.',
    expired: 'Сесията изтече. Влезте отново — промяната не е записана.',
    retry: 'Опитай пак',
    close: 'Затвори',
  },
  en: {
    sending: 'Saving…',
    retrying: 'Retrying',
    success: 'Saved',
    error: 'The save did not go through. The change was not recorded.',
    lost: 'No answer came back from the server. Check whether the record was created before trying again.',
    expired: 'The session expired. Sign in again — the change was not recorded.',
    retry: 'Try again',
    close: 'Close',
  },
}

const OUTCOME = { saved: 'saved', invalid: 'invalid', lost: 'lost', background: 'background' }

/**
 * Whether this answer is one the editor has to stay open for. Both of them put a sentence
 * in front of the person who typed it and leave everything they typed where it is; the pages
 * have no reason to tell them apart, and every page asking the same two-part question is two
 * pages that can come to disagree about it.
 */
export const keepsTheEditorOpen = (answer) =>
  answer.outcome === OUTCOME.invalid || answer.outcome === OUTCOME.lost

/**
 * The background save each record has outstanding, so a newer save can supersede it. Keyed
 * by url because that IS the record: two saves of the same lead go to the same address, and
 * two different leads never do.
 */
const inFlight = new Map()

/** Whose save it was, appended to the banner line when the caller can name it. */
const about = (line, subject) => (subject ? `${line} · ${subject}` : line)

/**
 * Runs one save and reports which of the three worlds it landed in.
 *
 * Returns `{ outcome: 'saved', result }` — the parsed response body, which the immediate
 * attempt is the only place that can hand back — or `{ outcome: 'invalid', message }` with
 * the server's reason, or `{ outcome: 'lost', message }` when a request that cannot be
 * repeated got no answer, or `{ outcome: 'background' }` once the retries have it. Throws
 * only UnauthorizedError, so a page's existing catch keeps working unchanged. Pages branch
 * on keepsTheEditorOpen rather than on the names.
 *
 * `subject` names the record on the banner: a failure that surfaces thirty seconds after
 * the dialog closed has to say WHICH save it was, or it is a riddle.
 *
 * `onLateSuccess` fires only when a backgrounded save eventually lands — the caller already
 * handles the immediate one and is holding the response body while it does. It is where the
 * list reload belongs, so a row that arrived late still appears without a manual refresh.
 *
 * `repeatable` says whether sending this request a second time is harmless. A PUT writes the
 * same fields onto the same row, so it is; a POST to a create endpoint makes a SECOND record
 * every time, so it is not — and a create whose answer was lost on the way back is exactly
 * the request the retries would duplicate. The default reads the method, and the one caller
 * whose POST is really an update says so.
 */
export async function adminSave({
  url,
  method = 'POST',
  body,
  lang = 'bg',
  subject = '',
  labels,
  onLateSuccess,
  repeatable = method !== 'POST',
  options = {},
}) {
  const text = { ...(BANNER_TEXT[lang] ?? BANNER_TEXT.bg), ...labels }

  // Whatever is still being retried for this record no longer speaks for anybody: this call
  // is a later version of the same row, and the older body landing last would write the
  // correction away again — with a green banner over it. See cancelSubmission.
  const outstanding = inFlight.get(url)
  if (outstanding !== undefined) {
    cancelSubmission(outstanding)
    inFlight.delete(url)
  }

  try {
    const result = await adminSend(url, method, body)
    announceSuccess({ ...text, success: about(text.success, subject) })
    return { outcome: OUTCOME.saved, result }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err

    // A status the server chose and will choose again: the input is the problem, and the
    // only useful thing to do with it is put it back in front of the person who typed it.
    if (err?.status !== undefined && !RETRYABLE_STATUSES.has(err.status)) {
      return { outcome: OUTCOME.invalid, message: err.message }
    }

    // No status at all means the request never got an answer — offline, DNS, a dropped
    // connection — which is the case the retries were written for. Unless nobody can say
    // whether it arrived AND arriving twice would cost a duplicate record, in which case the
    // one thing not to do is send it four more times.
    if (!repeatable) return { outcome: OUTCOME.lost, message: text.lost }

    const id = submitInBackground({
      url,
      payload: body,
      labels: {
        ...text,
        success: about(text.success, subject),
        error: about(text.error, subject),
        expired: about(text.expired, subject),
      },
      onSuccess: () => {
        // Landed, so there is nothing left for a later save to supersede.
        inFlight.delete(url)
        onLateSuccess?.()
      },
      options: { ...options, method },
    })
    inFlight.set(url, id)
    return { outcome: OUTCOME.background }
  }
}
