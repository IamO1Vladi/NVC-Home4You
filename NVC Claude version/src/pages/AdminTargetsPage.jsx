import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'

// The targets the dashboard will measure against.
//
// One form, and it UPSERTS: there is exactly one target per metric per period, so saving a
// number for a slot that already has one replaces it — which is the job. A screen that
// answered "a target already exists" would hand the person a dead end on the page whose
// whole purpose is revising numbers, and the way out of a dead end is usually a duplicate
// row somewhere it does not collide.
//
// The three period shapes ask for different fields, and the form only shows the ones the
// chosen shape uses — a stray month on a cycle target would occupy a slot no report reads,
// so the field is not there to be filled.

const TEXT = {
  bg: {
    title: 'Цели',
    subtitle: 'Какво сме си поставили — по месец, цикъл или година.',
    setTarget: 'Задай цел',
    periodType: 'Период', year: 'Година', month: 'Месец', cycle: 'Цикъл',
    metric: 'Показател', value: 'Стойност (EUR)', notes: 'Бележки',
    saveBtn: 'Запази',
    replaced: 'Целта беше обновена — за този период и показател вече имаше стойност.',
    created: 'Целта е записана.',
    empty: 'Още няма зададени цели.',
    emptyHint: 'Задайте първата — таблото ще мери спрямо нея.',
    period: 'Период',
    remove: 'Изтрий',
    confirmDelete: 'Да изтрия ли тази цел?',
    saveError: 'Промяната не беше запазена.',
    periodTypes: { month: 'Месец', cycle: 'Цикъл', year: 'Година' },
    metrics: {
      revenue: 'Приходи', 'gross-margin': 'Брутен марж', 'net-result': 'Нетен резултат',
      'opex-cap': 'Таван на разходите', 'units-sold': 'Продадени бройки',
    },
    monthNames: ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
      'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
    unitsSuffix: 'бр.',
  },
  en: {
    title: 'Targets',
    subtitle: 'What we set out to do — per month, cycle or year.',
    setTarget: 'Set a target',
    periodType: 'Period', year: 'Year', month: 'Month', cycle: 'Cycle',
    metric: 'Metric', value: 'Value (EUR)', notes: 'Notes',
    saveBtn: 'Save',
    replaced: 'Updated — that period and metric already had a value.',
    created: 'Target recorded.',
    empty: 'No targets yet.',
    emptyHint: 'Set the first one — the dashboard measures against it.',
    period: 'Period',
    remove: 'Delete',
    confirmDelete: 'Delete this target?',
    saveError: 'That change was not saved.',
    periodTypes: { month: 'Month', cycle: 'Cycle', year: 'Year' },
    metrics: {
      revenue: 'Revenue', 'gross-margin': 'Gross margin', 'net-result': 'Net result',
      'opex-cap': 'Opex cap', 'units-sold': 'Units sold',
    },
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'],
    unitsSuffix: 'units',
  },
}

const fmt = (n, metric) => {
  const s = Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return metric === 'units-sold' ? s : `€${s}`
}

const emptyDraft = () => ({
  periodType: 'month',
  year: String(new Date().getFullYear()),
  month: String(new Date().getMonth() + 1),
  buyCycleId: '',
  metricKey: 'revenue',
  targetValue: '',
  notes: '',
})

export default function AdminTargetsPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [state, setState] = React.useState('loading')
  const [rows, setRows] = React.useState([])
  const [keys, setKeys] = React.useState({ periodTypes: [], metrics: [] })
  const [cycles, setCycles] = React.useState([])
  const [draft, setDraft] = React.useState(emptyDraft())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      const [targetRows, keyLists, cycleRows] = await Promise.all([
        adminGet('/api/admin/targets'),
        adminGet('/api/admin/targets/keys').catch(() => ({ periodTypes: [], metrics: [] })),
        adminGet('/api/admin/buy-cycles').catch(() => []),
      ])
      setRows(targetRows ?? [])
      setKeys(keyLists ?? { periodTypes: [], metrics: [] })
      setCycles(cycleRows ?? [])
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
      // Only the fields the chosen period shape uses are sent with values; the server
      // blanks strays anyway, but sending clean input keeps the validation messages about
      // the person's actual mistake rather than a leftover field they cannot see.
      const isMonth = draft.periodType === 'month'
      const isCycle = draft.periodType === 'cycle'
      const result = await adminSend('/api/admin/targets', 'PUT', {
        periodType: draft.periodType,
        year: isCycle ? null : Number(draft.year),
        month: isMonth ? Number(draft.month) : null,
        buyCycleId: isCycle ? Number(draft.buyCycleId) : null,
        metricKey: draft.metricKey,
        targetValue: Number(draft.targetValue),
        notes: draft.notes || null,
      })
      setDraft((d) => ({ ...d, targetValue: '', notes: '' }))
      setNotice(result?.created ? t.created : t.replaced)
      await load()
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
      await adminDelete(`/api/admin/targets/${row.id}`)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }))

  const periodLabel = (row) => {
    if (row.periodType === 'month' && row.year && row.month) {
      return `${t.monthNames[row.month - 1]} ${row.year}`
    }
    if (row.periodType === 'year') return String(row.year ?? '—')
    return row.buyCycleLabel ?? '—'
  }

  const canSave = draft.metricKey
    && Number(draft.targetValue) >= 0
    && draft.targetValue !== ''
    && (draft.periodType === 'cycle' ? draft.buyCycleId !== '' : draft.year !== '')

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="targets"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
    >
      {error ? <div className="adm-alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      <section className="adm-card">
        <h2>{t.setTarget}</h2>
        <div className="adm-newdeal-grid">
          <label>
            <span className="adm-small">{t.periodType}</span>
            <select value={draft.periodType} onChange={set('periodType')}>
              {(keys.periodTypes.length ? keys.periodTypes : ['month', 'cycle', 'year']).map((key) => (
                <option key={key} value={key}>{t.periodTypes[key] ?? key}</option>
              ))}
            </select>
          </label>

          {draft.periodType !== 'cycle' ? (
            <label>
              <span className="adm-small">{t.year}</span>
              <input type="number" min="2000" max="2100" step="1" value={draft.year} onChange={set('year')} />
            </label>
          ) : null}

          {draft.periodType === 'month' ? (
            <label>
              <span className="adm-small">{t.month}</span>
              <select value={draft.month} onChange={set('month')}>
                {t.monthNames.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {draft.periodType === 'cycle' ? (
            <label>
              <span className="adm-small">{t.cycle}</span>
              <select value={draft.buyCycleId} onChange={set('buyCycleId')}>
                <option value="" />
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          ) : null}

          <label>
            <span className="adm-small">{t.metric}</span>
            <select value={draft.metricKey} onChange={set('metricKey')}>
              {(keys.metrics.length ? keys.metrics : ['revenue']).map((key) => (
                <option key={key} value={key}>{t.metrics[key] ?? key}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="adm-small">{t.value}</span>
            <input type="number" min="0" step="0.01" value={draft.targetValue} onChange={set('targetValue')} />
          </label>
        </div>

        <div className="adm-form-actions">
          <button type="button" className="btn" onClick={save} disabled={busy || !canSave}>
            {t.saveBtn}
          </button>
        </div>
      </section>

      <section className="adm-card" style={{ marginTop: '1rem' }}>
        {rows.length === 0 ? (
          <div className="adm-center adm-errbox">
            <p><strong>{t.empty}</strong></p>
            <p className="adm-muted adm-small">{t.emptyHint}</p>
          </div>
        ) : (
          <ul className="adm-list">
            {rows.map((row) => (
              <li key={row.id} className="adm-row">
                <div className="adm-row-main">
                  <strong>{periodLabel(row)}</strong>
                  <span className="adm-small adm-muted">
                    {t.metrics[row.metricKey] ?? row.metricKey}
                    {' — '}
                    <strong>{fmt(row.targetValue, row.metricKey)}</strong>
                    {row.metricKey === 'units-sold' ? ` ${t.unitsSuffix}` : ''}
                    {row.notes ? <> · {row.notes}</> : null}
                  </span>
                </div>
                <div className="adm-row-actions">
                  <button type="button" className="adm-linkbtn adm-danger" onClick={() => remove(row)}>
                    {t.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  )
}
