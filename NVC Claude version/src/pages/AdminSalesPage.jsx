import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'

// Sales out of containers — the sell side of the procurement ledger.
//
// Every money figure past the price box is SERVER-COMPUTED and read off the DTO: amount,
// the sale's own expenses, COGS from the landed cost of the exact container line the goods
// came off, and both profits. The page adds nothing up — the same rule as the procurement
// screen, for the same reason: a second copy of the arithmetic is how two screens start
// disagreeing about one sale.
//
// The one thing this screen enforces that Quickbase never did: you cannot sell more than a
// line still holds. The form says how many are left BEFORE anyone types, and the server
// refuses an oversell with the same number.

const TEXT = {
  bg: {
    title: 'Продажби',
    subtitle: 'Какво е продадено от контейнерите — приход, себестойност и печалба.',
    add: 'Нова продажба',
    empty: 'Още няма продажби.',
    emptyHint: 'Запишете първата — редът се избира от стоката в контейнерите.',
    soldAt: 'Дата', lot: 'Ред от контейнер', qty: 'Брой', unitPrice: 'Единична цена (EUR)',
    customer: 'Клиент', noCustomer: '— без клиент —',
    paymentFees: 'Такси плащане (EUR)', transport: 'Транспорт БГ (EUR)',
    installation: 'Монтаж (EUR)', otherCosts: 'Други разходи (EUR)',
    notes: 'Бележки',
    amount: 'Сума', expenses: 'Разходи по продажбата', cogs: 'Себестойност',
    gross: 'Брутна печалба', net: 'Нетна печалба',
    noCogs: 'без курс на контейнера — няма себестойност',
    available: (n) => `${n} налични`,
    total: 'Общо приход', profit: 'Обща нетна печалба',
    entries: (n) => `${n} ${n === 1 ? 'продажба' : 'продажби'}`,
    edit: 'Редактирай', remove: 'Изтрий',
    save: 'Запази', cancel: 'Откажи', close: 'Затвори',
    editTitle: 'Продажба', newTitle: 'Нова продажба',
    confirmDelete: 'Да изтрия ли тази продажба? Бройката се връща в наличността.',
    saveError: 'Промяната не беше запазена.',
    updated: 'Запазено',
  },
  en: {
    title: 'Sales',
    subtitle: 'What sold out of the containers — revenue, cost of goods, profit.',
    add: 'New sale',
    empty: 'No sales yet.',
    emptyHint: 'Record the first one — the line comes from the goods in the containers.',
    soldAt: 'Date', lot: 'Container line', qty: 'Qty', unitPrice: 'Unit price (EUR)',
    customer: 'Customer', noCustomer: '— no customer —',
    paymentFees: 'Payment fees (EUR)', transport: 'BG transport (EUR)',
    installation: 'Installation (EUR)', otherCosts: 'Other costs (EUR)',
    notes: 'Notes',
    amount: 'Amount', expenses: 'Sale expenses', cogs: 'COGS',
    gross: 'Gross profit', net: 'Net profit',
    noCogs: 'container has no FX rate — no COGS',
    available: (n) => `${n} available`,
    total: 'Total revenue', profit: 'Total net profit',
    entries: (n) => `${n} ${n === 1 ? 'sale' : 'sales'}`,
    edit: 'Edit', remove: 'Delete',
    save: 'Save', cancel: 'Cancel', close: 'Close',
    editTitle: 'Sale', newTitle: 'New sale',
    confirmDelete: 'Delete this sale? The units go back into stock.',
    saveError: 'That change was not saved.',
    updated: 'Saved',
  },
}

const fmt = (n) => (n === null || n === undefined ? '—'
  : `€${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)

const today = () => new Date().toISOString().slice(0, 10)

const emptySale = () => ({
  purchaseLotId: '', customerId: '', soldAt: today(), quantity: '', unitSalePrice: '',
  paymentFees: '', transportCost: '', installationCost: '', otherCosts: '', notes: '',
})

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

export default function AdminSalesPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [state, setState] = React.useState('loading')
  const [rows, setRows] = React.useState([])
  const [lotOptions, setLotOptions] = React.useState([])
  const [customers, setCustomers] = React.useState([])
  const [editing, setEditing] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      const [sales, options, customerRows] = await Promise.all([
        adminGet('/api/admin/sales'),
        adminGet('/api/admin/sales/lot-options').catch(() => []),
        adminGet('/api/admin/customers').catch(() => []),
      ])
      setRows(Array.isArray(sales) ? sales : [])
      setLotOptions(Array.isArray(options) ? options : [])
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
        purchaseLotId: Number(fields.purchaseLotId),
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
      // The oversell 409 arrives here with "only N left" — surfaced verbatim, because the
      // number is the answer the person needs.
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

  const lotLabel = (o) =>
    `${o.productModelName}${o.shipmentReference ? ` — ${o.shipmentReference}` : ''} (${t.available(o.qtyOnHand)})`

  const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.saleAmountEur) || 0), 0)
  // A dash the moment ANY sale lacks a COGS: summing the rest and calling it the total
  // would present a number nobody computed. Revenue has no such gap — prices are known.
  const totalNet = rows.some((r) => r.netProfitEur === null || r.netProfitEur === undefined)
    ? null
    : rows.reduce((sum, r) => sum + (Number(r.netProfitEur) || 0), 0)

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
              <span className="adm-small adm-muted">{t.profit}</span>
              <p><strong>{totalNet === null ? '—' : fmt(totalNet)}</strong></p>
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
                <strong>{row.productModelName}</strong>
                <span className="adm-small adm-muted">
                  {row.soldAt} · {row.quantity} × {fmt(row.unitSalePrice)} = <strong>{fmt(row.saleAmountEur)}</strong>
                  {row.shipmentReference ? <> · {row.shipmentReference}</> : null}
                  {row.customerName ? <> · {row.customerName}</> : null}
                </span>
                <span className="adm-small adm-muted">
                  {row.cogsEur !== null && row.cogsEur !== undefined
                    ? <>{t.cogs}: {fmt(row.cogsEur)} · {t.net}: <strong>{fmt(row.netProfitEur)}</strong></>
                    : <>{t.noCogs}</>}
                  {row.saleExpensesEur > 0 ? <> · {t.expenses}: {fmt(row.saleExpensesEur)}</> : null}
                </span>
              </div>
              <div className="adm-row-actions">
                <button
                  type="button"
                  className="adm-linkbtn"
                  onClick={() => {
                    setEditing({
                      id: row.id, purchaseLotId: String(row.purchaseLotId),
                      customerId: row.customerId ?? '', soldAt: row.soldAt,
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
              disabled={busy || !editing?.purchaseLotId || !(Number(editing?.quantity) >= 1) || !editing?.soldAt}
            >
              {t.save}
            </button>
          </>
        )}
      >
        {editing ? (
          <div className="adm-sheet">
            <div className="adm-newdeal-grid">
              <label>
                <span className="adm-small">{t.lot}</span>
                {/* Availability rides on the option text, so "how many are left?" is
                    answered before anyone types a quantity. */}
                <select value={editing.purchaseLotId} onChange={set('purchaseLotId')}>
                  <option value="" />
                  {lotOptions.map((o) => (
                    <option key={o.purchaseLotId} value={o.purchaseLotId}>{lotLabel(o)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="adm-small">{t.soldAt}</span>
                <input type="date" value={editing.soldAt} onChange={set('soldAt')} />
              </label>
              <label>
                <span className="adm-small">{t.qty}</span>
                <input type="number" min="1" step="1" value={editing.quantity} onChange={set('quantity')} />
              </label>
              <label>
                <span className="adm-small">{t.unitPrice}</span>
                <input type="number" min="0" step="0.01" value={editing.unitSalePrice} onChange={set('unitSalePrice')} />
              </label>
              <label>
                <span className="adm-small">{t.customer}</span>
                <select value={editing.customerId} onChange={set('customerId')}>
                  <option value="">{t.noCustomer}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
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
