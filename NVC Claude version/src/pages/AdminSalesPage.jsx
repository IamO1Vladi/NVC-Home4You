import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'

// Sales to customers.
//
// This screen used to sit on top of the procurement ledger: every sale named the container
// line its goods came off, and showed cost of goods and margin computed from that line's
// landed cost. The buy side was archived on 2026-08-19 (_archive/billing-2026-08-19/) and
// the owner kept sales "only to be used with the customer table nothing else for now" — so
// what is left is what the sale brought in, and what selling it cost.
//
// NO MARGIN COLUMN, deliberately. Cost of goods came from the container line; without one
// there is no cost basis, and a margin figure without a cost basis is a guess wearing a
// number's clothes. "Нето" here is revenue minus the sale's OWN costs, which is a different
// and honest thing — the label says so.
//
// Everything is EUR: sales are made in the reporting currency, so there is no rate anywhere
// on this page.

const TEXT = {
  bg: {
    title: 'Продажби',
    subtitle: 'Какво е продадено, на кого, и какво е струвала самата продажба.',
    add: 'Нова продажба',
    empty: 'Още няма продажби.',
    emptyHint: 'Запишете първата — избира се клиент и се описва какво е продадено.',
    customer: 'Клиент', pickCustomer: '— изберете клиент —',
    description: 'Какво е продадено',
    descriptionHint: 'Свободен текст: модел, брой, каквото го описва.',
    soldAt: 'Дата', qty: 'Брой', unitPrice: 'Единична цена (EUR)',
    unitPriceHint: 'Цената, на която е продаден 1 брой.',
    paymentFees: 'Такси плащане (EUR)', transport: 'Транспорт (EUR)',
    installation: 'Монтаж (EUR)', otherCosts: 'Други разходи (EUR)',
    notes: 'Бележки',
    amount: 'Сума', expenses: 'Разходи по продажбата', net: 'Нето след разходите',
    netHint: 'Приход минус разходите по самата продажба. Не е печалба — себестойността на стоката не се води тук.',
    total: 'Общо приход', totalNet: 'Общо нето',
    entries: (n) => `${n} ${n === 1 ? 'продажба' : 'продажби'}`,
    noCustomer: 'без свързан клиент',
    edit: 'Редактирай', remove: 'Изтрий',
    save: 'Запази', cancel: 'Откажи', close: 'Затвори',
    editTitle: 'Продажба', newTitle: 'Нова продажба',
    confirmDelete: 'Да изтрия ли тази продажба?',
    saveError: 'Промяната не беше запазена.',
    updated: 'Запазено',
    secWhat: 'Какво и на кого', secCosts: 'Разходи по продажбата (EUR)',
  },
  en: {
    title: 'Sales',
    subtitle: 'What sold, to whom, and what the sale itself cost.',
    add: 'New sale',
    empty: 'No sales yet.',
    emptyHint: 'Record the first one — pick a customer and describe what sold.',
    customer: 'Customer', pickCustomer: '— pick a customer —',
    description: 'What sold',
    descriptionHint: 'Free text: model, size, whatever describes it.',
    soldAt: 'Date', qty: 'Qty', unitPrice: 'Unit price (EUR)',
    unitPriceHint: 'What ONE unit sold for.',
    paymentFees: 'Payment fees (EUR)', transport: 'Transport (EUR)',
    installation: 'Installation (EUR)', otherCosts: 'Other costs (EUR)',
    notes: 'Notes',
    amount: 'Amount', expenses: 'Sale expenses', net: 'Net after expenses',
    netHint: 'Revenue less the costs of the sale itself. Not profit — the cost of the goods is not tracked here.',
    total: 'Total revenue', totalNet: 'Total net',
    entries: (n) => `${n} ${n === 1 ? 'sale' : 'sales'}`,
    noCustomer: 'no linked customer',
    edit: 'Edit', remove: 'Delete',
    save: 'Save', cancel: 'Cancel', close: 'Close',
    editTitle: 'Sale', newTitle: 'New sale',
    confirmDelete: 'Delete this sale?',
    saveError: 'That change was not saved.',
    updated: 'Saved',
    secWhat: 'What and to whom', secCosts: 'Costs of the sale (EUR)',
  },
}

const fmt = (n) => (n === null || n === undefined ? '—'
  : `€${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)

const today = () => {
  // LOCAL date, not toISOString's UTC one: at 01:30 in Bulgaria the UTC date is still
  // yesterday, which files the sale into last month. Same correction as AdminFactorySheetsPage.
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const emptySale = () => ({
  customerId: '', description: '', soldAt: today(), quantity: '', unitSalePrice: '',
  paymentFees: '', transportCost: '', installationCost: '', otherCosts: '', notes: '',
})

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

export default function AdminSalesPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [state, setState] = React.useState('loading')
  const [rows, setRows] = React.useState([])
  const [customers, setCustomers] = React.useState([])
  const [editing, setEditing] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      const [sales, customerRows] = await Promise.all([
        adminGet('/api/admin/sales'),
        adminGet('/api/admin/customers').catch(() => []),
      ])
      setRows(Array.isArray(sales) ? sales : [])
      setCustomers(Array.isArray(customerRows) ? customerRows : [])
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  async function save() {
    setBusy(true)
    setError('')
    try {
      const { id, ...fields } = editing
      const body = {
        ...fields,
        customerId: fields.customerId === '' ? null : Number(fields.customerId),
        quantity: Number(fields.quantity),
        unitSalePrice: fields.unitSalePrice === '' ? 0 : Number(fields.unitSalePrice),
        paymentFees: num(fields.paymentFees),
        transportCost: num(fields.transportCost),
        installationCost: num(fields.installationCost),
        otherCosts: num(fields.otherCosts),
      }
      const result = id
        ? await adminSend(`/api/admin/sales/${id}`, 'PUT', body)
        : await adminSend('/api/admin/sales', 'POST', body)

      if (result?.ok) {
        setEditing(null)
        setNotice(t.updated)
        await load()
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  async function remove(row) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.confirmDelete)) return
    setError('')
    try {
      await adminDelete(`/api/admin/sales/${row.id}`)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  const set = (field) => (e) => setEditing((f) => ({ ...f, [field]: e.target.value }))

  const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.saleAmountEur) || 0), 0)
  const totalNet = rows.reduce((sum, r) => sum + (Number(r.netEur) || 0), 0)

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="sales"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
      actions={(
        <button type="button" className="btn" onClick={() => { setEditing(emptySale()); setError('') }}>
          {t.add}
        </button>
      )}
    >
      {error ? <div className="adm-alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      {rows.length > 0 ? (
        <section className="adm-card">
          <div className="adm-newdeal-grid">
            <div>
              <span className="adm-small adm-muted">{t.total}</span>
              <p><strong>{fmt(totalRevenue)}</strong> <span className="adm-muted adm-small">· {t.entries(rows.length)}</span></p>
            </div>
            <div>
              <span className="adm-small adm-muted">{t.totalNet}</span>
              <p><strong>{fmt(totalNet)}</strong></p>
              <span className="adm-small adm-muted">{t.netHint}</span>
            </div>
          </div>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div className="adm-card adm-center adm-errbox">
          <p><strong>{t.empty}</strong></p>
          <p className="adm-muted adm-small">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="adm-list">
          {rows.map((row) => (
            <li key={row.id} className="adm-row">
              <div className="adm-row-main">
                <strong>{row.customerName || row.description || `#${row.id}`}</strong>
                <span className="adm-small adm-muted">
                  {row.soldAt} · {row.quantity} × {fmt(row.unitSalePrice)} = <strong>{fmt(row.saleAmountEur)}</strong>
                  {row.description && row.customerName ? <> · {row.description}</> : null}
                  {/* The imported rows have no customer link — their Quickbase customer
                      name is in the notes, waiting for someone who knows the deal. */}
                  {!row.customerName ? <> · <em>{t.noCustomer}</em></> : null}
                </span>
                {row.saleExpensesEur > 0 ? (
                  <span className="adm-small adm-muted">
                    {t.expenses}: {fmt(row.saleExpensesEur)} · {t.net}: <strong>{fmt(row.netEur)}</strong>
                  </span>
                ) : null}
              </div>
              <div className="adm-row-actions">
                <button
                  type="button"
                  className="adm-linkbtn"
                  onClick={() => {
                    setEditing({
                      id: row.id, customerId: row.customerId ?? '',
                      description: row.description ?? '', soldAt: row.soldAt,
                      quantity: String(row.quantity), unitSalePrice: String(row.unitSalePrice),
                      paymentFees: row.paymentFees ?? '', transportCost: row.transportCost ?? '',
                      installationCost: row.installationCost ?? '', otherCosts: row.otherCosts ?? '',
                      notes: row.notes ?? '',
                    })
                    setError('')
                  }}
                >
                  {t.edit}
                </button>
                <button type="button" className="adm-linkbtn adm-danger" onClick={() => remove(row)}>
                  {t.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={editing !== null}
        title={editing?.id ? t.editTitle : t.newTitle}
        subtitle=""
        closeLabel={t.close}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>{t.cancel}</button>
            <button
              type="button"
              className="btn"
              onClick={save}
              disabled={busy || !editing?.customerId || !(Number(editing?.quantity) >= 1) || !editing?.soldAt}
            >
              {t.save}
            </button>
          </>
        )}
      >
        {editing ? (
          <div className="adm-sheet">
            <section>
              <h3>{t.secWhat}</h3>
              <div className="adm-newdeal-grid">
                <label>
                  <span className="adm-small">{t.customer}</span>
                  <select value={editing.customerId} onChange={set('customerId')}>
                    <option value="">{t.pickCustomer}</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="adm-small">{t.soldAt}</span>
                  <input type="date" value={editing.soldAt} onChange={set('soldAt')} />
                </label>
                <label>
                  <span className="adm-small">{t.description}</span>
                  <input type="text" value={editing.description} onChange={set('description')} />
                  <span className="adm-small adm-muted">{t.descriptionHint}</span>
                </label>
                <label>
                  <span className="adm-small">{t.qty}</span>
                  <input type="number" min="1" step="1" value={editing.quantity} onChange={set('quantity')} />
                </label>
                <label>
                  <span className="adm-small">{t.unitPrice}</span>
                  <input type="number" min="0" step="0.01" value={editing.unitSalePrice} onChange={set('unitSalePrice')} />
                  <span className="adm-small adm-muted">{t.unitPriceHint}</span>
                </label>
              </div>
            </section>

            <section>
              <h3>{t.secCosts}</h3>
              <div className="adm-newdeal-grid">
                <label>
                  <span className="adm-small">{t.paymentFees}</span>
                  <input type="number" min="0" step="0.01" value={editing.paymentFees} onChange={set('paymentFees')} />
                </label>
                <label>
                  <span className="adm-small">{t.transport}</span>
                  <input type="number" min="0" step="0.01" value={editing.transportCost} onChange={set('transportCost')} />
                </label>
                <label>
                  <span className="adm-small">{t.installation}</span>
                  <input type="number" min="0" step="0.01" value={editing.installationCost} onChange={set('installationCost')} />
                </label>
                <label>
                  <span className="adm-small">{t.otherCosts}</span>
                  <input type="number" min="0" step="0.01" value={editing.otherCosts} onChange={set('otherCosts')} />
                </label>
              </div>
            </section>

            <label className="adm-sheet-notes">
              <span className="adm-small">{t.notes}</span>
              <textarea rows={3} value={editing.notes ?? ''} onChange={set('notes')} />
            </label>
          </div>
        ) : null}
      </AdminModal>
    </AdminShell>
  )
}
