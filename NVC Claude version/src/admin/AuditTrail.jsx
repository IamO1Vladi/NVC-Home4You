import React from 'react'

// The audit log, rendered.
//
// ONE COMPONENT for both places it appears — the Audit page and the per-record history —
// because the version people reach for when they have a real question is exactly the one
// that must not be a simplified copy. The only difference is whether each row names which
// record it is about, which the per-record view already knows.

const TEXT = {
  bg: {
    system: 'Системата',
    actions: { created: 'създаде', updated: 'промени', deleted: 'изтри' },
    noChanges: 'без промени по полетата',
    from: 'от',
    to: 'на',
    empty: '(празно)',
    set: 'попълнено',
    cleared: 'изчистено',
    changed: 'променено',
    redactedNote: 'Стойността не се записва.',
    historyEmpty: 'Няма записана история за този запис.',
  },
  en: {
    system: 'System',
    actions: { created: 'created', updated: 'changed', deleted: 'deleted' },
    noChanges: 'no field changes',
    from: 'from',
    to: 'to',
    empty: '(empty)',
    set: 'filled in',
    cleared: 'cleared',
    changed: 'changed',
    redactedNote: 'The value itself is never recorded.',
    historyEmpty: 'Nothing recorded for this record yet.',
  },
}

// The entity names as staff say them, rather than as the database spells them. Falls back to
// the raw type so a table added later still renders something truthful.
const ENTITY_LABELS = {
  bg: {
    Customer: 'Клиент', Purchase: 'Покупка', PurchaseFile: 'Документ',
    House: 'Модел', HouseImage: 'Снимка', Factory: 'Фабрика',
    Case: 'Проект', CaseImage: 'Снимка на проект', Review: 'Отзив', Lead: 'Лийд',
  },
  en: {
    Customer: 'Customer', Purchase: 'Purchase', PurchaseFile: 'Document',
    House: 'Model', HouseImage: 'Image', Factory: 'Factory',
    Case: 'Case', CaseImage: 'Case image', Review: 'Review', Lead: 'Lead',
  },
}

// The redaction markers the server writes. Rendered as words rather than passed through, so
// a reader is never left wondering whether "(set)" is the literal value somebody typed.
const REDACTED = new Set(['(set)', '(cleared)', '(changed)'])

/** Shared label helpers, so the page and the trail cannot disagree about wording. */
export function auditText(lang) {
  const t = TEXT[lang] ?? TEXT.bg
  const entities = ENTITY_LABELS[lang] ?? ENTITY_LABELS.bg
  return {
    entity: (type) => entities[type] ?? type,
    action: (a) => t.actions[a] ?? a,
  }
}

function formatWhen(iso, lang) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// A person's name from their UPN. "maria@nvc-home4you.eu" is a lot of pixels to say Maria in
// a list where every row carries one, and the full address stays in the title attribute.
function shortActor(upn, t) {
  if (!upn) return t.system
  const at = upn.indexOf('@')
  return at > 0 ? upn.slice(0, at) : upn
}

function Value({ text, t }) {
  if (text === null || text === undefined || text === '') {
    return <em className="adm-audit-empty">{t.empty}</em>
  }
  if (REDACTED.has(text)) {
    const word = text === '(set)' ? t.set : text === '(cleared)' ? t.cleared : t.changed
    return <em className="adm-audit-redacted" title={t.redactedNote}>{word}</em>
  }
  return <span className="adm-audit-value">{text}</span>
}

function Entry({ entry, lang, showEntity }) {
  const t = TEXT[lang] ?? TEXT.bg
  const labels = auditText(lang)
  const changes = entry.changes ?? []

  return (
    <li className={`adm-audit-entry adm-audit-${entry.action}`}>
      <div className="adm-audit-head">
        <span className="adm-audit-who" title={entry.actorUpn || t.system}>
          {shortActor(entry.actorUpn, t)}
        </span>
        <span className={`adm-badge adm-audit-action-${entry.action}`}>
          {labels.action(entry.action)}
        </span>

        {showEntity ? (
          <span className="adm-audit-what">
            {labels.entity(entry.entityType)}
            {entry.summary ? <strong> {entry.summary}</strong> : <span className="adm-muted"> #{entry.entityId}</span>}
          </span>
        ) : null}

        <time className="adm-small adm-muted" dateTime={entry.occurredAt}>
          {formatWhen(entry.occurredAt, lang)}
        </time>
      </div>

      {changes.length === 0 ? (
        <p className="adm-small adm-muted adm-audit-nochanges">{t.noChanges}</p>
      ) : (
        <ul className="adm-audit-changes">
          {changes.map((c, i) => (
            <li key={`${c.field}-${i}`}>
              <span className="adm-audit-field">{c.field}</span>
              {/* A creation has no "from" and a deletion has no "to"; printing "(empty) to X"
                  on every new record is noise that buries the edits that matter. */}
              {entry.action === 'created' ? (
                <> <Value text={c.to} t={t} /></>
              ) : entry.action === 'deleted' ? (
                <> <Value text={c.from} t={t} /></>
              ) : (
                <>
                  {' '}<span className="adm-muted adm-small">{t.from}</span> <Value text={c.from} t={t} />
                  {' '}<span className="adm-muted adm-small">{t.to}</span> <Value text={c.to} t={t} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function AuditTrail({ entries, lang = 'bg', showEntity = false }) {
  const t = TEXT[lang] ?? TEXT.bg

  if (!entries || entries.length === 0) {
    return <p className="adm-small adm-muted">{t.historyEmpty}</p>
  }

  return (
    <ol className="adm-audit-list">
      {entries.map((entry) => (
        <Entry key={entry.id} entry={entry} lang={lang} showEntity={showEntity} />
      ))}
    </ol>
  )
}
