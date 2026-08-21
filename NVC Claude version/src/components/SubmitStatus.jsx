import React from 'react'
import { subscribeSubmissions, dismissSubmission, MAX_ATTEMPTS } from '../lib/backgroundSubmit.js'
import './SubmitStatus.css'

// The little top-right banner that reports on submissions running in the background.
//
// One banner per in-flight submission, stacked. Each carries its own text, resolved in the
// visitor's language when it was enqueued — see backgroundSubmit.js for why the store is
// locale-blind.
//
// The rules per status:
//   sending   spinner, no buttons — nothing to decide yet.
//   retrying  the same, plus which attempt this is, so a long wait reads as effort
//             rather than as a hang.
//   success   green tick, dismisses itself — it thanks and leaves.
//   error     stays until acted on. All five attempts failed, and auto-dismissing THAT
//             would silently lose the visitor's enquiry. Offers retry and close — except
//             when the item is marked `expired`, where the session ran out mid-retry and
//             the only honest thing on offer is signing in again.
//
// aria-live="polite" on the container: screen readers hear the outcome without the modal —
// which announced results before — having to stay open for it.

function Item({ item }) {
  const { labels = {}, status, attempt } = item

  return (
    <div className={`submit-status-item is-${status}`} role="status">
      <span className="submit-status-icon" aria-hidden="true">
        {status === 'success' ? '✓' : status === 'error' ? '!' : <span className="submit-status-spinner" />}
      </span>

      <span className="submit-status-text">
        {status === 'sending' && labels.sending}
        {status === 'retrying' && `${labels.retrying} (${attempt}/${MAX_ATTEMPTS})`}
        {status === 'success' && labels.success}
        {status === 'error' && (item.expired ? labels.expired || labels.error : labels.error)}
      </span>

      {status === 'error' ? (
        <span className="submit-status-actions">
          {item.retry ? (
            <button type="button" onClick={item.retry}>{labels.retry}</button>
          ) : null}
          <button
            type="button"
            className="submit-status-x"
            aria-label={labels.close}
            onClick={() => dismissSubmission(item.id)}
          >
            ✕
          </button>
        </span>
      ) : null}
    </div>
  )
}

export default function SubmitStatus() {
  const [items, setItems] = React.useState([])

  React.useEffect(() => subscribeSubmissions(setItems), [])

  if (items.length === 0) return null

  return (
    <div className="submit-status" aria-live="polite">
      {items.map((item) => <Item key={item.id} item={item} />)}
    </div>
  )
}
