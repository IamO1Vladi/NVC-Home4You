import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'

// Operating expenses — the non-container half of what the business spends.
//
// A quick-add form at the top rather than behind a button, because this screen's whole job
// is that a receipt gets typed in the moment it exists. Every hurdle between "I paid for
// fuel" and a saved row is a receipt that never gets entered, and a month that quietly
// looks cheaper than it was.
//
// Everything here is EUR — expenses are incurred in the reporting currency, so unlike the
// procurement screens there is no rate and no second column.

const TEXT = {
  bg: {
    title: 'Разходи',
    subtitle: 'Оперативните разходи — заплати, наем, гориво, реклама.',
    quickAdd: 'Нов разход',
    spentAt: 'Дата', category: 'Категория', amount: 'Сума (EUR)', vat: 'ДДС (EUR)',
    description: 'Описание',
    addBtn: 'Запиши',
    filters: 'Филтри',
    from: 'От', to: 'До', allCategories: 'Всички категории',
    empty: 'Няма разходи за избрания период.',
    total: 'Общо', entries: (n) => `${n} ${n === 1 ? 'запис' : 'записа'}`,
    byCategory: 'По категория', byMonth: 'По месец',
    uncategorised: 'Без категория',
    submittedBy: 'Въвел', notes: 'Бележки',
    edit: 'Редактирай', remove: 'Изтрий',
    save: 'Запази', cancel: 'Откажи', close: 'Затвори',
    editTitle: 'Разход',
    confirmDelete: 'Да изтрия ли този разход?',
    saveError: 'Промяната не беше запазена.',
    updated: 'Запазено',
    // The live list from Quickbase, one label per key — see ExpenseCategories.cs, which
    // owns the key set. The three names are how the firm tracks personal draws.
    categories: {
      'site-hosting': 'Сайт хостинг', 'microsoft-365': 'Microsoft 365', warehouse: 'Склад',
      'sample-rent': 'Мостра наем', printing: 'Принтиране', travel: 'Пътуване',
      ads: 'Реклама', 'company-phone': 'Служебен телефон', accountant: 'Счетоводител',
      bank: 'Банка', 'unloading-crew': 'Разтоварване и работници', notary: 'Нотариус',
      materials: 'Материали', 'package-fee': 'Такса по пакетна програма', crane: 'Кран',
      'work-software': 'Работни програми', 'claude-ai': 'Claude AI', vat: 'ДДС',
      'social-security': 'Осигуровки',
      'draw-vladi': 'Влади', 'draw-ceco': 'Цецо', 'draw-niki': 'Ники',
      other: 'Друго',
    },
  },
  en: {
    title: 'Expenses',
    subtitle: 'Operating costs — salaries, rent, fuel, marketing.',
    quickAdd: 'New expense',
    spentAt: 'Date', category: 'Category', amount: 'Amount (EUR)', vat: 'VAT (EUR)',
    description: 'Description',
    addBtn: 'Record',
    filters: 'Filters',
    from: 'From', to: 'To', allCategories: 'All categories',
    empty: 'No expenses in the chosen window.',
    total: 'Total', entries: (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`,
    byCategory: 'By category', byMonth: 'By month',
    uncategorised: 'Uncategorised',
    submittedBy: 'Entered by', notes: 'Notes',
    edit: 'Edit', remove: 'Delete',
    save: 'Save', cancel: 'Cancel', close: 'Close',
    editTitle: 'Expense',
    confirmDelete: 'Delete this expense?',
    saveError: 'That change was not saved.',
    updated: 'Saved',
    categories: {
      'site-hosting': 'Site hosting', 'microsoft-365': 'Microsoft 365', warehouse: 'Warehouse',
      'sample-rent': 'Sample rent', printing: 'Printing', travel: 'Travel',
      ads: 'Ads', 'company-phone': 'Company phone', accountant: 'Accountant',
      bank: 'Bank', 'unloading-crew': 'Unloading & crew', notary: 'Notary',
      materials: 'Materials', 'package-fee': 'Package fee', crane: 'Crane',
      'work-software': 'Work software', 'claude-ai': 'Claude AI', vat: 'VAT',
      'social-security': 'Social security',
      'draw-vladi': 'Vladi (draw)', 'draw-ceco': 'Ceco (draw)', 'draw-niki': 'Niki (draw)',
      other: 'Other',
    },
  },
}

const fmt = (n) => (n === null || n === undefined ? '—'
  : `€${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

const today = () => new Date().toISOString().slice(0, 10)

const emptyExpense = () => ({
  spentAt: today(), categoryKey: '', amount: '', vatAmount: '', description: '',
})

export default function AdminExpensesPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [state, setState] = React.useState('loading')
  const [rows, setRows] = React.useState([])
  const [categories, setCategories] = React.useState([])
  const [rollup, setRollup] = React.useState(null)
  const [filters, setFilters] = React.useState({ from: '', to: '', category: '' })
  const [draft, setDraft] = React.useState(emptyExpense())
  const [editing, setEditing] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const query = React.useCallback((f) => {
    const params = new URLSearchParams()
    if (f.from) params.set('from', f.from)
    if (f.to) params.set('to', f.to)
    if (f.category) params.set('category', f.category)
    const s = params.toString()
    return s ? `?${s}` : ''
  }, [])

  const fetchData = React.useCallback(async (f) => {
    const [list, keys, sums] = await Promise.all([
      adminGet(`/api/admin/operating-expenses${query(f)}`),
      adminGet('/api/admin/operating-expenses/categories').catch(() => []),
      // The rollup ignores the category filter on purpose: it is the breakdown that
      // ANSWERS "which category is eating the month", so filtering it by category
      // would leave it agreeing with the list and saying nothing.
      adminGet(`/api/admin/operating-expenses/rollup${query({ ...f, category: '' })}`).catch(() => null),
    ])
    setRows(list ?? [])
    setCategories(keys ?? [])
    setRollup(sums)
  }, [query])

  const load = React.useCallback(async (f = filters) => {
    setState('loading')
    try {
      await fetchData(f)
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [filters, fetchData])

  // After a save: the list and the sums move, but the page does NOT pass back through the
  // loading state. Receipts are entered in batches, and tearing the form down between two
  // receipts from the same fuel stop is exactly the friction this screen exists to remove.
  const refresh = React.useCallback(async (f = filters) => {
    try {
      await fetchData(f)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || '')
    }
  }, [filters, fetchData])

  React.useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = (patch) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    load(next)
  }

  async function saveDraft() {
    setBusy(true)
    setError('')
    try {
      await adminSend('/api/admin/operating-expenses', 'POST', {
        ...draft,
        categoryKey: draft.categoryKey || null,
        amount: Number(draft.amount),
        vatAmount: draft.vatAmount === '' ? null : Number(draft.vatAmount),
      })
      // The date and category survive the save on purpose: receipts get entered in
      // batches, and a fuel receipt is usually followed by another from the same day.
      setDraft((d) => ({ ...d, amount: '', vatAmount: '', description: '' }))
      setNotice(t.updated)
      await refresh()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  async function saveEditing() {
    setBusy(true)
    setError('')
    try {
      const { id, ...fields } = editing
      await adminSend(`/api/admin/operating-expenses/${id}`, 'PUT', {
        ...fields,
        categoryKey: fields.categoryKey || null,
        amount: Number(fields.amount),
        vatAmount: fields.vatAmount === '' ? null : Number(fields.vatAmount),
      })
      setEditing(null)
      setNotice(t.updated)
      await refresh()
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
      await adminDelete(`/api/admin/operating-expenses/${row.id}`)
      await refresh()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  const setDraftField = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }))
  const setEditingField = (field) => (e) => setEditing((f) => ({ ...f, [field]: e.target.value }))

  const label = (key) => (key ? (t.categories[key] ?? key) : t.uncategorised)
  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="expenses"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => load()}
    >
      {error ? <div className="adm-alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      {/* Quick add — always open, first thing on the page. */}
      <section className="adm-card">
        <h2>{t.quickAdd}</h2>
        <div className="adm-newdeal-grid">
          <label>
            <span className="adm-small">{t.spentAt}</span>
            <input type="date" value={draft.spentAt} onChange={setDraftField('spentAt')} />
          </label>
          <label>
            <span className="adm-small">{t.category}</span>
            <select value={draft.categoryKey} onChange={setDraftField('categoryKey')}>
              <option value="">{t.uncategorised}</option>
              {categories.map((key) => <option key={key} value={key}>{label(key)}</option>)}
            </select>
          </label>
          <label>
            <span className="adm-small">{t.amount}</span>
            <input type="number" min="0" step="0.01" value={draft.amount} onChange={setDraftField('amount')} />
          </label>
          <label>
            <span className="adm-small">{t.vat}</span>
            <input type="number" min="0" step="0.01" value={draft.vatAmount} onChange={setDraftField('vatAmount')} />
          </label>
          <label>
            <span className="adm-small">{t.description}</span>
            <input type="text" value={draft.description} onChange={setDraftField('description')} />
          </label>
        </div>
        <div className="adm-form-actions">
          <button
            type="button"
            className="btn"
            onClick={saveDraft}
            disabled={busy || !draft.spentAt || !(Number(draft.amount) > 0)}
          >
            {t.addBtn}
          </button>
        </div>
      </section>

      {/* The breakdowns the dashboard will grow from: category and month, side by side. */}
      {rollup ? (
        <section className="adm-card" style={{ marginTop: '1rem' }}>
          <div className="adm-newdeal-grid">
            <div>
              <h3>{t.byCategory}</h3>
              {(rollup.byCategory ?? []).map((r) => (
                <p key={r.key} className="adm-small">
                  {r.key === 'uncategorised' ? t.uncategorised : label(r.key)}
                  {' — '}<strong>{fmt(r.total)}</strong>
                  <span className="adm-muted"> · {t.entries(r.count)}</span>
                </p>
              ))}
            </div>
            <div>
              <h3>{t.byMonth}</h3>
              {(rollup.byMonth ?? []).map((r) => (
                <p key={r.key} className="adm-small">
                  {r.key} — <strong>{fmt(r.total)}</strong>
                  <span className="adm-muted"> · {t.entries(r.count)}</span>
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Filters + list */}
      <section className="adm-card" style={{ marginTop: '1rem' }}>
        <div className="adm-newdeal-grid">
          <label>
            <span className="adm-small">{t.from}</span>
            <input type="date" value={filters.from} onChange={(e) => applyFilters({ from: e.target.value })} />
          </label>
          <label>
            <span className="adm-small">{t.to}</span>
            <input type="date" value={filters.to} onChange={(e) => applyFilters({ to: e.target.value })} />
          </label>
          <label>
            <span className="adm-small">{t.category}</span>
            <select value={filters.category} onChange={(e) => applyFilters({ category: e.target.value })}>
              <option value="">{t.allCategories}</option>
              {categories.map((key) => <option key={key} value={key}>{label(key)}</option>)}
            </select>
          </label>
          <div>
            <span className="adm-small adm-muted">{t.total}</span>
            <p><strong>{fmt(total)}</strong> <span className="adm-muted adm-small">· {t.entries(rows.length)}</span></p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="adm-muted">{t.empty}</p>
        ) : (
          <ul className="adm-list">
            {rows.map((row) => (
              <li key={row.id} className="adm-row">
                <div className="adm-row-main">
                  <strong>{fmt(row.amount)}</strong>
                  <span className="adm-small adm-muted">
                    {row.spentAt} · {label(row.categoryKey)}
                    {row.description ? <> · {row.description}</> : null}
                    {row.submittedByUpn ? <> · {t.submittedBy}: {row.submittedByUpn.split('@')[0]}</> : null}
                  </span>
                </div>
                <div className="adm-row-actions">
                  <button
                    type="button"
                    className="adm-linkbtn"
                    onClick={() => {
                      setEditing({
                        id: row.id, spentAt: row.spentAt, categoryKey: row.categoryKey ?? '',
                        amount: row.amount, vatAmount: row.vatAmount ?? '',
                        description: row.description ?? '', notes: row.notes ?? '',
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
      </section>

      <AdminModal
        open={editing !== null}
        title={t.editTitle}
        subtitle={editing ? `${editing.spentAt} · ${fmt(editing.amount)}` : ''}
        closeLabel={t.close}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>{t.cancel}</button>
            <button
              type="button"
              className="btn"
              onClick={saveEditing}
              disabled={busy || !editing?.spentAt || !(Number(editing?.amount) > 0)}
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
                <span className="adm-small">{t.spentAt}</span>
                <input type="date" value={editing.spentAt} onChange={setEditingField('spentAt')} />
              </label>
              <label>
                <span className="adm-small">{t.category}</span>
                <select value={editing.categoryKey} onChange={setEditingField('categoryKey')}>
                  <option value="">{t.uncategorised}</option>
                  {categories.map((key) => <option key={key} value={key}>{label(key)}</option>)}
                </select>
              </label>
              <label>
                <span className="adm-small">{t.amount}</span>
                <input type="number" min="0" step="0.01" value={editing.amount} onChange={setEditingField('amount')} />
              </label>
              <label>
                <span className="adm-small">{t.vat}</span>
                <input type="number" min="0" step="0.01" value={editing.vatAmount} onChange={setEditingField('vatAmount')} />
              </label>
              <label>
                <span className="adm-small">{t.description}</span>
                <input type="text" value={editing.description} onChange={setEditingField('description')} />
              </label>
            </div>

            <label className="adm-sheet-notes">
              <span className="adm-small">{t.notes}</span>
              <textarea rows={3} value={editing.notes ?? ''} onChange={setEditingField('notes')} />
            </label>
          </div>
        ) : null}
      </AdminModal>
    </AdminShell>
  )
}
