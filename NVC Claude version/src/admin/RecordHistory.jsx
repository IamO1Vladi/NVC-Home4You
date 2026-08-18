import React from 'react'
import AdminModal from './AdminModal.jsx'
import AuditTrail from './AuditTrail.jsx'
import { adminGet } from './adminApi.js'

// "Who changed this?", asked from the record it is about.
//
// The global Audit page can answer this too, by filtering — but only if you leave the
// customer you are looking at, go to another section, and reconstruct which row you meant.
// The question arises HERE, so it is answered here, and the two views share AuditTrail so
// they can never tell different stories about the same entry.
//
// Fetched on open rather than with the record: most of the time nobody asks, and loading a
// history on every page view would be a query per record for a question nobody put.

const TEXT = {
  bg: {
    button: 'История',
    title: 'История на промените',
    subtitle: 'Кой какво е променил. Записва се автоматично.',
    close: 'Затвори',
    loading: 'Зареждане…',
    error: 'Историята не можа да се зареди.',
  },
  en: {
    button: 'History',
    title: 'Change history',
    subtitle: 'Who changed what. Recorded automatically.',
    close: 'Close',
    loading: 'Loading…',
    error: 'The history could not be loaded.',
  },
}

/**
 * A button that opens one record's history.
 *
 * entityType is the CLR type name the server records — "Customer", "House". It is passed in
 * rather than guessed from the URL, because the panel's routes and the database's tables are
 * not the same vocabulary and never have been.
 */
export default function RecordHistory({ entityType, entityId, lang = 'bg', label }) {
  const t = TEXT[lang] ?? TEXT.bg

  const [open, setOpen] = React.useState(false)
  const [entries, setEntries] = React.useState(null)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!open || !entityId) return
    let alive = true

    setEntries(null)
    setError('')
    adminGet(`/api/admin/audit/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`)
      .then((rows) => { if (alive) setEntries(Array.isArray(rows) ? rows : []) })
      .catch(() => { if (alive) setError(t.error) })

    return () => { alive = false }
  }, [open, entityType, entityId, t.error])

  // Nothing to show a history for yet — a record still being created has no id and no past.
  if (!entityId) return null

  return (
    <>
      <button type="button" className="btn ghost adm-history-btn" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 7.4V12l3 1.8" />
          <path d="M3.6 12a8.4 8.4 0 1 0 2.5-6" />
          <path d="M3.4 4.2v4.2h4.2" />
        </svg>
        <span>{t.button}</span>
      </button>

      <AdminModal
        open={open}
        title={t.title}
        subtitle={label ? `${label} · ${t.subtitle}` : t.subtitle}
        closeLabel={t.close}
        onClose={() => setOpen(false)}
        footer={(
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
            {t.close}
          </button>
        )}
      >
        {error ? <div className="adm-alert" role="alert">{error}</div> : null}
        {entries === null && !error
          ? <p className="adm-small adm-muted">{t.loading}</p>
          : <AuditTrail entries={entries ?? []} lang={lang} />}
      </AdminModal>
    </>
  )
}
