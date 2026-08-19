import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'

// Orders: where staff move an order along, and the report the owner asked for — customer,
// model, deposit, final price, left to pay, factory — in one row each (ROADMAP #27).
//
// ONE SCREEN FOR BOTH JOBS on purpose. A report nobody works from goes stale, and a status
// board with no money on it gets cross-checked against a spreadsheet. The same row answers
// "where is it?" and "what do they still owe?", so neither can drift from the other.
//
// The money here is READ-ONLY: deposits and prices are edited on the customer's own sheet,
// where the invoices live. What this screen writes is the order's progress — status, the
// two expected dates, and what the carrier last said.

const TEXT = {
  bg: {
    title: 'Поръчки',
    subtitle: 'Докъде е стигнала всяка поръчка, и какво остава да се плати.',
    all: 'Всички',
    empty: 'Няма поръчки за този филтър.',
    emptyHint: 'Поръчките се създават като продажби при клиента.',
    customer: 'Клиент', model: 'Модел', factory: 'Фабрика',
    deposit: 'Капаро', finalPrice: 'Крайна цена', leftToPay: 'Остава',
    qty: 'бр.',
    status: 'Статус',
    expectedAtHarbor: 'Очаквано на пристанище', expectedReady: 'Очаквана готовност',
    carrier: 'Превозвач', trackingRef: 'Номер за проследяване',
    carrierNote: 'Последно от превозвача', carrierAsOf: 'към',
    carrierHint: 'Въвежда се на ръка. Датата се записва автоматично, когато промените текста.',
    track: 'Проследяване', trackLink: 'Линк за клиента',
    createLink: 'Създай линк', revokeLink: 'Премахни линка', copy: 'Копирай',
    copied: 'Копирано',
    noLink: 'Още няма линк за този клиент.',
    linkHint: 'Само този линк отваря страницата. Тя показва статус и дати — никога цени или данни на клиента.',
    edit: 'Редактирай', save: 'Запази', cancel: 'Откажи', close: 'Затвори',
    editTitle: 'Поръчка',
    confirmRevoke: 'Да премахна ли линка? Клиентът повече няма да вижда страницата.',
    saveError: 'Промяната не беше запазена.',
    updated: 'Запазено',
    statuses: {
      placed: 'Приета', fabricating: 'В производство', scheduled: 'Насрочена за товарене',
      travelling: 'Пътува', 'at-harbor': 'На пристанище', ready: 'Готова за доставка',
      delivered: 'Доставена', cancelled: 'Отказана',
    },
  },
  en: {
    title: 'Orders',
    subtitle: 'How far each order has got, and what is still owed.',
    all: 'All',
    empty: 'No orders for this filter.',
    emptyHint: 'Orders are created as purchases on a customer.',
    customer: 'Customer', model: 'Model', factory: 'Factory',
    deposit: 'Deposit', finalPrice: 'Final price', leftToPay: 'Left to pay',
    qty: 'pcs',
    status: 'Status',
    expectedAtHarbor: 'Expected at harbour', expectedReady: 'Expected ready',
    carrier: 'Carrier', trackingRef: 'Tracking number',
    carrierNote: 'Carrier’s last word', carrierAsOf: 'as of',
    carrierHint: 'Entered by hand. The date stamps itself whenever you change the text.',
    track: 'Tracking', trackLink: 'Customer link',
    createLink: 'Create link', revokeLink: 'Revoke link', copy: 'Copy',
    copied: 'Copied',
    noLink: 'No link for this customer yet.',
    linkHint: 'Only this link opens the page. It shows status and dates — never prices or customer data.',
    edit: 'Edit', save: 'Save', cancel: 'Cancel', close: 'Close',
    editTitle: 'Order',
    confirmRevoke: 'Revoke the link? The customer will stop seeing the page.',
    saveError: 'That change was not saved.',
    updated: 'Saved',
    statuses: {
      placed: 'Placed', fabricating: 'In production', scheduled: 'Scheduled for shipment',
      travelling: 'Travelling', 'at-harbor': 'At harbour', ready: 'Ready for delivery',
      delivered: 'Delivered', cancelled: 'Cancelled',
    },
  },
}

const money = (n, currency = 'EUR') => {
  if (n === null || n === undefined) return '—'
  const s = Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return currency === 'EUR' ? `€${s}` : `${s} ${currency}`
}

export default function AdminOrdersPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [state, setState] = React.useState('loading')
  const [rows, setRows] = React.useState([])
  const [statuses, setStatuses] = React.useState([])
  const [filter, setFilter] = React.useState('')
  const [editing, setEditing] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async (status = filter) => {
    setState('loading')
    try {
      const [orders, keys] = await Promise.all([
        adminGet(`/api/admin/orders${status ? `?status=${status}` : ''}`),
        adminGet('/api/admin/orders/statuses').catch(() => null),
      ])
      setRows(Array.isArray(orders) ? orders : [])
      if (keys?.all) setStatuses(keys.all)
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [filter])

  React.useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilter = (status) => { setFilter(status); load(status) }

  // The order fields live on the purchase, so the save goes through the customer's purchase
  // endpoint — one writer for one row, rather than a second one that could disagree.
  async function save() {
    setBusy(true)
    setError('')
    try {
      await adminSend(`/api/admin/customers/${editing.customerId}/purchases/${editing.purchaseId}`, 'PUT', {
        id: editing.purchaseId,
        status: editing.status,
        expectedAtHarbor: editing.expectedAtHarbor || null,
        expectedReadyAt: editing.expectedReadyAt || null,
        carrierName: editing.carrierName || null,
        trackingReference: editing.trackingReference || null,
        carrierNote: editing.carrierNote || null,
      })
      setEditing(null)
      setNotice(t.updated)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  async function createLink(row) {
    setError('')
    try {
      const result = await adminSend(`/api/admin/orders/${row.purchaseId}/reference`, 'POST')
      if (result?.reference) {
        setNotice(t.updated)
        await load()
        setEditing((e) => (e && e.purchaseId === row.purchaseId
          ? { ...e, publicReference: result.reference } : e))
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  async function revokeLink(row) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.confirmRevoke)) return
    setError('')
    try {
      await adminDelete(`/api/admin/orders/${row.purchaseId}/reference`)
      await load()
      setEditing((e) => (e && e.purchaseId === row.purchaseId ? { ...e, publicReference: null } : e))
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  const set = (field) => (e) => setEditing((f) => ({ ...f, [field]: e.target.value }))

  const label = (key) => t.statuses[key] ?? key
  const linkFor = (ref) => `${window.location.origin}/order/${ref}`

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="orders"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => load()}
    >
      {error ? <div className="adm-alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      {/* Status filter */}
      <section className="adm-card">
        <div className="adm-lead-toolbar">
          <button
            type="button"
            className={filter === '' ? 'adm-chip is-active' : 'adm-chip'}
            onClick={() => applyFilter('')}
          >
            {t.all}
          </button>
          {statuses.map((key) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'adm-chip is-active' : 'adm-chip'}
              onClick={() => applyFilter(key)}
            >
              {label(key)}
            </button>
          ))}
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="adm-card adm-center adm-errbox" style={{ marginTop: '1rem' }}>
          <p><strong>{t.empty}</strong></p>
          <p className="adm-muted adm-small">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="adm-list" style={{ marginTop: '1rem' }}>
          {rows.map((row) => (
            <li key={row.purchaseId} className="adm-row">
              <div className="adm-row-main">
                <strong>{row.customerName}</strong>
                {/* The report line, in the owner's own order: model, deposit, final,
                    left to pay, factory. */}
                <span className="adm-small adm-muted">
                  {row.model || '—'}
                  {row.quantity > 1 ? ` × ${row.quantity} ${t.qty}` : ''}
                  {' · '}{t.deposit}: {money(row.depositPaid, row.currency)}
                  {' · '}{t.finalPrice}: {money(row.finalPrice, row.currency)}
                  {' · '}{t.leftToPay}: <strong>{money(row.leftToPay, row.currency)}</strong>
                  {row.factoryName ? <> · {t.factory}: {row.factoryName}</> : null}
                </span>
                <span className="adm-small">
                  <span className="adm-badge adm-stage-open">{label(row.status)}</span>
                  {row.expectedReadyAt ? <> · {t.expectedReady}: {row.expectedReadyAt}</> : null}
                  {row.publicReference ? <> · <span className="adm-ok">{t.trackLink} ✓</span></> : null}
                </span>
              </div>
              <div className="adm-row-actions">
                <button
                  type="button"
                  className="adm-linkbtn"
                  onClick={() => { setEditing({ ...row }); setError('') }}
                >
                  {t.edit}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={editing !== null}
        title={t.editTitle}
        subtitle={editing ? `${editing.customerName}${editing.model ? ` · ${editing.model}` : ''}` : ''}
        closeLabel={t.close}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>{t.cancel}</button>
            <button type="button" className="btn" onClick={save} disabled={busy}>{t.save}</button>
          </>
        )}
      >
        {editing ? (
          <div className="adm-sheet">
            <section>
              <h3>{t.status}</h3>
              <div className="adm-newdeal-grid">
                <label>
                  <span className="adm-small">{t.status}</span>
                  <select value={editing.status} onChange={set('status')}>
                    {statuses.map((key) => <option key={key} value={key}>{label(key)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="adm-small">{t.expectedAtHarbor}</span>
                  <input type="date" value={editing.expectedAtHarbor ?? ''} onChange={set('expectedAtHarbor')} />
                </label>
                <label>
                  <span className="adm-small">{t.expectedReady}</span>
                  <input type="date" value={editing.expectedReadyAt ?? ''} onChange={set('expectedReadyAt')} />
                </label>
              </div>
            </section>

            <section>
              <h3>{t.carrier}</h3>
              <div className="adm-newdeal-grid">
                <label>
                  <span className="adm-small">{t.carrier}</span>
                  <input type="text" value={editing.carrierName ?? ''} onChange={set('carrierName')} />
                </label>
                <label>
                  <span className="adm-small">{t.trackingRef}</span>
                  <input type="text" value={editing.trackingReference ?? ''} onChange={set('trackingReference')} />
                </label>
              </div>
              <label className="adm-sheet-notes">
                <span className="adm-small">{t.carrierNote}</span>
                <textarea rows={2} value={editing.carrierNote ?? ''} onChange={set('carrierNote')} />
                <span className="adm-small adm-muted">
                  {t.carrierHint}
                  {editing.carrierCheckedAt
                    ? ` (${t.carrierAsOf} ${new Date(editing.carrierCheckedAt).toLocaleDateString()})`
                    : ''}
                </span>
              </label>
            </section>

            <section>
              <h3>{t.track}</h3>
              {editing.publicReference ? (
                <>
                  <p className="adm-small">
                    <code>{linkFor(editing.publicReference)}</code>
                  </p>
                  <div className="adm-form-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        navigator.clipboard?.writeText(linkFor(editing.publicReference))
                        setNotice(t.copied)
                      }}
                    >
                      {t.copy}
                    </button>
                    <button
                      type="button"
                      className="adm-linkbtn adm-danger"
                      onClick={() => revokeLink(editing)}
                    >
                      {t.revokeLink}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="adm-muted adm-small">{t.noLink}</p>
                  <div className="adm-form-actions">
                    <button type="button" className="btn" onClick={() => createLink(editing)}>
                      {t.createLink}
                    </button>
                  </div>
                </>
              )}
              <p className="adm-small adm-muted">{t.linkHint}</p>
            </section>
          </div>
        ) : null}
      </AdminModal>
    </AdminShell>
  )
}
