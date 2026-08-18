import React from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, UnauthorizedError } from '../admin/adminApi.js'
import AuditTrail, { auditText } from '../admin/AuditTrail.jsx'

// Who changed what, and when.
//
// The panel holds ЕГН, ЕИК, deposits and invoices; until the audit log existed it recorded
// only who touched a row LAST, which answers who is responsible for the current state and
// nothing else.
//
// READ ONLY, and visibly so: there is no control on this page that changes anything, because
// the API behind it has no write path at all. A history the panel can edit proves nothing.
//
// The per-record version of this lives in AuditTrail and is opened from the record itself —
// this page answers "what happened recently", that one answers "what happened to this".

const TEXT = {
  bg: {
    title: 'Одит',
    subtitle: 'Кой какво е променил. Записва се автоматично и не може да се редактира.',
    filterActor: 'Кой',
    filterEntity: 'Къде',
    filterAction: 'Какво',
    any: '— всички —',
    system: 'Системата',
    empty: 'Няма записи.',
    emptyFiltered: 'Няма записи, отговарящи на филтрите.',
    clear: 'Изчисти филтрите',
    more: 'Покажи още',
    showing: (n, total) => `${n} от ${total}`,
    readOnlyNote: 'Записите се създават автоматично при всяка промяна и не могат да бъдат променяни от панела.',
  },
  en: {
    title: 'Audit',
    subtitle: 'Who changed what. Recorded automatically, and not editable.',
    filterActor: 'Who',
    filterEntity: 'Where',
    filterAction: 'What',
    any: '— any —',
    system: 'System',
    empty: 'Nothing recorded yet.',
    emptyFiltered: 'No entries match the filters.',
    clear: 'Clear filters',
    more: 'Show more',
    showing: (n, total) => `${n} of ${total}`,
    readOnlyNote: 'Entries are written automatically on every change and cannot be altered from the panel.',
  },
}

const PAGE_SIZE = 50

export default function AdminAuditPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg
  const at = auditText(lang)

  const [params] = useSearchParams()

  const [entries, setEntries] = React.useState([])
  const [total, setTotal] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const [state, setState] = React.useState('loading')
  const [busy, setBusy] = React.useState(false)

  const [filters, setFilters] = React.useState({ actors: [], entityTypes: [], actions: [], hasSystem: false })
  // ?entity= lets a link from anywhere land pre-filtered — the per-record trail uses it for
  // its "see everything for this table" escape hatch.
  const [actor, setActor] = React.useState('')
  const [entityType, setEntityType] = React.useState(() => params.get('entity') || '')
  const [action, setAction] = React.useState('')

  const filtering = actor !== '' || entityType !== '' || action !== ''

  const query = React.useCallback((skip) => {
    const q = new URLSearchParams()
    if (actor) q.set('actor', actor)
    if (entityType) q.set('entityType', entityType)
    if (action) q.set('action', action)
    q.set('skip', String(skip))
    q.set('take', String(PAGE_SIZE))
    return `/api/admin/audit?${q}`
  }, [actor, entityType, action])

  // Refetches whenever a filter changes. The list is replaced rather than appended, so a
  // narrowed view never shows rows from the previous one.
  React.useEffect(() => {
    let alive = true
    setState('loading')
    adminGet(query(0))
      .then((page) => {
        if (!alive) return
        setEntries(page?.entries ?? [])
        setTotal(page?.total ?? 0)
        setHasMore(page?.hasMore ?? false)
        setState('ready')
      })
      .catch((err) => {
        if (!alive) return
        setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
      })
    return () => { alive = false }
  }, [query])

  React.useEffect(() => {
    let alive = true
    adminGet('/api/admin/audit/filters')
      .then((f) => { if (alive && f) setFilters(f) })
      .catch(() => { /* the dropdowns stay empty; the list still works */ })
    return () => { alive = false }
  }, [])

  const loadMore = async () => {
    setBusy(true)
    try {
      const page = await adminGet(query(entries.length))
      setEntries((current) => [...current, ...(page?.entries ?? [])])
      setHasMore(page?.hasMore ?? false)
      setTotal(page?.total ?? 0)
    } catch {
      /* leaves what is already on screen alone */
    } finally {
      setBusy(false)
    }
  }

  const clear = () => { setActor(''); setEntityType(''); setAction('') }

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="audit"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => setState('loading')}
    >
      <div className="adm-pipeline-toolbar">
        <label className="adm-filter">
          <span className="adm-small adm-muted">{t.filterActor}</span>
          <select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">{t.any}</option>
            {/* The importers and the CLI write with no actor. Without this the one category
                of change nobody performed is also the one nobody can look up. */}
            {filters.hasSystem ? <option value="system">{t.system}</option> : null}
            {(filters.actors ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label className="adm-filter">
          <span className="adm-small adm-muted">{t.filterEntity}</span>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">{t.any}</option>
            {(filters.entityTypes ?? []).map((x) => (
              <option key={x} value={x}>{at.entity(x)}</option>
            ))}
          </select>
        </label>

        <label className="adm-filter">
          <span className="adm-small adm-muted">{t.filterAction}</span>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{t.any}</option>
            {(filters.actions ?? []).map((x) => (
              <option key={x} value={x}>{at.action(x)}</option>
            ))}
          </select>
        </label>

        {filtering ? (
          <button type="button" className="adm-linkbtn" onClick={clear}>{t.clear}</button>
        ) : null}

        {total > 0 ? (
          <span className="adm-small adm-muted">{t.showing(entries.length, total)}</span>
        ) : null}
      </div>

      <p className="adm-small adm-muted adm-audit-note">{t.readOnlyNote}</p>

      {entries.length === 0 && state === 'ready' ? (
        <div className="adm-empty">
          <p>{filtering ? t.emptyFiltered : t.empty}</p>
          {filtering ? (
            <button type="button" className="adm-linkbtn" onClick={clear}>{t.clear}</button>
          ) : null}
        </div>
      ) : (
        <AuditTrail entries={entries} lang={lang} showEntity />
      )}

      {hasMore ? (
        <div className="adm-audit-more">
          <button type="button" className="btn ghost" onClick={loadMore} disabled={busy}>
            {t.more}
          </button>
        </div>
      ) : null}
    </AdminShell>
  )
}
