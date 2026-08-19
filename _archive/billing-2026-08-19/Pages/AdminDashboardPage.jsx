import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, UnauthorizedError } from '../admin/adminApi.js'

// The reporting screen — what ROADMAP #21 was building towards all along.
//
// READ-ONLY BY DESIGN: not one number on this page can be typed. Everything arrives
// computed from the server (revenue and COGS from the sales ledger, opex from the expense
// rows, stock from bought-minus-sold, targets from Цели), because the whole point of the
// exercise was one copy of every fact. A dashboard you can edit is a spreadsheet.
//
// Honesty rules, same as everywhere: a period containing one sale whose container has no
// FX rate shows COGS and profit as dashes — "profit except the goods we couldn't price" is
// not a number. The per-model table shows which rows are whole.

const TEXT = {
  bg: {
    title: 'Табло',
    subtitle: 'Приход, себестойност, разходи и наличност — срещу целите.',
    periodMonth: 'Месец', periodCycle: 'Цикъл', periodYear: 'Година',
    year: 'Година', month: 'Месец', cycle: 'Цикъл',
    revenue: 'Приход', cogs: 'Себестойност', gross: 'Брутна печалба',
    saleExpenses: 'Разходи по продажби', opex: 'Оперативни разходи', net: 'Нетен резултат',
    unitsSold: 'Продадени бройки',
    unknownCogs: 'Има продажби без курс на контейнера — себестойността е неизвестна.',
    stock: 'Наличност',
    stockLine: (units, value) => `${units} бр. на стойност €${value}`,
    stockUnpriced: (n) => ` (+${n} бр. без курс, неостойностени)`,
    targets: 'Цели за периода',
    noTargets: 'Няма зададени цели за този период — задайте ги в „Цели“.',
    ofTarget: 'от целта',
    overCap: 'НАД тавана',
    underCap: 'под тавана',
    unknown: 'неизвестно',
    byModel: 'По модел',
    model: 'Модел', qty: 'Бр.', margin: 'Печалба',
    byMonth: 'По месеци',
    opexByCategory: 'Разходи по категория',
    cycleCosts: 'Стойност на цикъла (доставки)',
    landed: 'Обща доставна стойност', trueCost: 'Реална стойност (с невъзстановимо ДДС)',
    suggested: 'Препоръчан приход при пълна продажба',
    withoutRate: (n) => `${n} контейнера без курс — извън сумите`,
    monthNames: ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
      'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
    metrics: {
      revenue: 'Приход', 'gross-margin': 'Брутен марж', 'net-result': 'Нетен резултат',
      'opex-cap': 'Таван на разходите', 'units-sold': 'Продадени бройки',
    },
    categories: {
      'site-hosting': 'Сайт хостинг', 'microsoft-365': 'Microsoft 365', warehouse: 'Склад',
      'sample-rent': 'Мостра наем', printing: 'Принтиране', travel: 'Пътуване',
      ads: 'Реклама', 'company-phone': 'Служебен телефон', accountant: 'Счетоводител',
      bank: 'Банка', 'unloading-crew': 'Разтоварване и работници', notary: 'Нотариус',
      materials: 'Материали', 'package-fee': 'Такса по пакетна програма', crane: 'Кран',
      'work-software': 'Работни програми', 'claude-ai': 'Claude AI', vat: 'ДДС',
      'social-security': 'Осигуровки',
      'draw-vladi': 'Влади', 'draw-ceco': 'Цецо', 'draw-niki': 'Ники',
      other: 'Друго', uncategorised: 'Без категория',
    },
  },
  en: {
    title: 'Dashboard',
    subtitle: 'Revenue, cost, expenses and stock — against the targets.',
    periodMonth: 'Month', periodCycle: 'Cycle', periodYear: 'Year',
    year: 'Year', month: 'Month', cycle: 'Cycle',
    revenue: 'Revenue', cogs: 'COGS', gross: 'Gross profit',
    saleExpenses: 'Sale expenses', opex: 'Operating expenses', net: 'Net result',
    unitsSold: 'Units sold',
    unknownCogs: 'Some sales sit on containers with no FX rate — COGS is unknown.',
    stock: 'Stock on hand',
    stockLine: (units, value) => `${units} units worth €${value}`,
    stockUnpriced: (n) => ` (+${n} units unpriced, no rate)`,
    targets: 'Targets for the period',
    noTargets: 'No targets set for this period — set them in Targets.',
    ofTarget: 'of target',
    overCap: 'OVER the cap',
    underCap: 'under the cap',
    unknown: 'unknown',
    byModel: 'By model',
    model: 'Model', qty: 'Qty', margin: 'Profit',
    byMonth: 'By month',
    opexByCategory: 'Expenses by category',
    cycleCosts: 'Cycle procurement value',
    landed: 'Landed value', trueCost: 'True cost (incl. unrecoverable VAT)',
    suggested: 'Suggested revenue at full sell-through',
    withoutRate: (n) => `${n} container(s) without a rate — excluded from the sums`,
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'],
    metrics: {
      revenue: 'Revenue', 'gross-margin': 'Gross margin', 'net-result': 'Net result',
      'opex-cap': 'Opex cap', 'units-sold': 'Units sold',
    },
    categories: {
      'site-hosting': 'Site hosting', 'microsoft-365': 'Microsoft 365', warehouse: 'Warehouse',
      'sample-rent': 'Sample rent', printing: 'Printing', travel: 'Travel',
      ads: 'Ads', 'company-phone': 'Company phone', accountant: 'Accountant',
      bank: 'Bank', 'unloading-crew': 'Unloading & crew', notary: 'Notary',
      materials: 'Materials', 'package-fee': 'Package fee', crane: 'Crane',
      'work-software': 'Work software', 'claude-ai': 'Claude AI', vat: 'VAT',
      'social-security': 'Social security',
      'draw-vladi': 'Vladi (draw)', 'draw-ceco': 'Ceco (draw)', 'draw-niki': 'Niki (draw)',
      other: 'Other', uncategorised: 'Uncategorised',
    },
  },
}

const fmt = (n) => (n === null || n === undefined ? '—'
  : `€${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`)

export default function AdminDashboardPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const now = new Date()
  const [state, setState] = React.useState('loading')
  const [data, setData] = React.useState(null)
  const [cycles, setCycles] = React.useState([])
  const [pick, setPick] = React.useState({
    period: 'month', year: String(now.getFullYear()), month: String(now.getMonth() + 1), cycleId: '',
  })

  const load = React.useCallback(async (p = pick) => {
    setState('loading')
    try {
      const params = new URLSearchParams({ period: p.period })
      if (p.period === 'cycle') {
        // No cycle chosen yet: wait for one rather than asking the server for nothing.
        if (!p.cycleId) { setData(null); setState('ready'); return }
        params.set('cycleId', p.cycleId)
      } else {
        params.set('year', p.year)
        if (p.period === 'month') params.set('month', p.month)
      }
      const [dash, cycleRows] = await Promise.all([
        adminGet(`/api/admin/dashboard?${params}`),
        adminGet('/api/admin/buy-cycles').catch(() => []),
      ])
      setData(dash)
      setCycles(Array.isArray(cycleRows) ? cycleRows : [])
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [pick])

  React.useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const change = (patch) => {
    const next = { ...pick, ...patch }
    setPick(next)
    load(next)
  }

  const label = (key) => t.categories[key] ?? key

  // Percent-of-target, colored by what "good" means for the metric: opex-cap is a
  // ceiling, everything else is a floor.
  const targetLine = (c) => {
    if (c.actualValue === null || c.actualValue === undefined) {
      return { text: t.unknown, good: null }
    }
    const isCap = c.metricKey === 'opex-cap'
    if (c.targetValue === 0) {
      return isCap
        ? { text: c.actualValue <= 0 ? t.underCap : t.overCap, good: c.actualValue <= 0 }
        : { text: `${fmt(c.actualValue)}`, good: c.actualValue >= 0 }
    }
    const pct = Math.round((c.actualValue / c.targetValue) * 100)
    return isCap
      ? { text: `${pct}% — ${c.actualValue <= c.targetValue ? t.underCap : t.overCap}`, good: c.actualValue <= c.targetValue }
      : { text: `${pct}% ${t.ofTarget}`, good: c.actualValue >= c.targetValue }
  }

  const d = data

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="dashboard"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => load()}
    >
      {/* Period picker */}
      <section className="adm-card">
        <div className="adm-newdeal-grid">
          <label>
            <span className="adm-small">{t.periodMonth} / {t.periodCycle} / {t.periodYear}</span>
            <select value={pick.period} onChange={(e) => change({ period: e.target.value })}>
              <option value="month">{t.periodMonth}</option>
              <option value="cycle">{t.periodCycle}</option>
              <option value="year">{t.periodYear}</option>
            </select>
          </label>
          {pick.period !== 'cycle' ? (
            <label>
              <span className="adm-small">{t.year}</span>
              <input type="number" min="2000" max="2100" step="1" value={pick.year}
                     onChange={(e) => change({ year: e.target.value })} />
            </label>
          ) : null}
          {pick.period === 'month' ? (
            <label>
              <span className="adm-small">{t.month}</span>
              <select value={pick.month} onChange={(e) => change({ month: e.target.value })}>
                {t.monthNames.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
              </select>
            </label>
          ) : null}
          {pick.period === 'cycle' ? (
            <label>
              <span className="adm-small">{t.cycle}</span>
              <select value={pick.cycleId} onChange={(e) => change({ cycleId: e.target.value })}>
                <option value="" />
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {d ? (
        <>
          {/* The headline figures. COGS-null poisons profit on purpose — the note says why. */}
          {d.cogsEur === null || d.cogsEur === undefined ? (
            <div className="adm-note" style={{ marginTop: '1rem' }}>{t.unknownCogs}</div>
          ) : null}

          <section className="adm-card" style={{ marginTop: '1rem' }}>
            <div className="adm-newdeal-grid">
              <div><span className="adm-small adm-muted">{t.revenue}</span><p><strong>{fmt(d.revenueEur)}</strong></p></div>
              <div><span className="adm-small adm-muted">{t.cogs}</span><p><strong>{fmt(d.cogsEur)}</strong></p></div>
              <div><span className="adm-small adm-muted">{t.gross}</span><p><strong>{fmt(d.grossProfitEur)}</strong></p></div>
              <div><span className="adm-small adm-muted">{t.saleExpenses}</span><p><strong>{fmt(d.saleExpensesEur)}</strong></p></div>
              <div><span className="adm-small adm-muted">{t.opex}</span><p><strong>{fmt(d.opexEur)}</strong></p></div>
              <div><span className="adm-small adm-muted">{t.net}</span><p><strong>{fmt(d.netResultEur)}</strong></p></div>
              <div><span className="adm-small adm-muted">{t.unitsSold}</span><p><strong>{d.unitsSold}</strong></p></div>
              <div>
                <span className="adm-small adm-muted">{t.stock}</span>
                <p><strong>{t.stockLine(d.stock.unitsOnHand, Number(d.stock.valueEur).toLocaleString('en-US', { maximumFractionDigits: 0 }))}</strong>
                  {d.stock.unpricedUnits > 0 ? <span className="adm-muted">{t.stockUnpriced(d.stock.unpricedUnits)}</span> : null}
                </p>
              </div>
            </div>
          </section>

          {/* Targets */}
          <section className="adm-card" style={{ marginTop: '1rem' }}>
            <h3>{t.targets}</h3>
            {d.targets.length === 0 ? (
              <p className="adm-muted adm-small">{t.noTargets}</p>
            ) : (
              <ul className="adm-list">
                {d.targets.map((c) => {
                  const line = targetLine(c)
                  return (
                    <li key={c.metricKey} className="adm-row">
                      <div className="adm-row-main">
                        <strong>{t.metrics[c.metricKey] ?? c.metricKey}</strong>
                        <span className="adm-small adm-muted">
                          {c.metricKey === 'units-sold'
                            ? `${c.actualValue ?? '—'} / ${c.targetValue}`
                            : `${fmt(c.actualValue)} / ${fmt(c.targetValue)}`}
                          {' · '}
                          <span className={line.good === null ? '' : line.good ? 'adm-ok' : 'adm-danger'}>
                            <strong>{line.text}</strong>
                          </span>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Cycle procurement totals */}
          {d.cycleCosts ? (
            <section className="adm-card" style={{ marginTop: '1rem' }}>
              <h3>{t.cycleCosts}</h3>
              <div className="adm-newdeal-grid">
                <div><span className="adm-small adm-muted">{t.landed}</span><p><strong>{fmt(d.cycleCosts.landedBaseEur)}</strong></p></div>
                <div><span className="adm-small adm-muted">{t.trueCost}</span><p><strong>{fmt(d.cycleCosts.trueCostEur)}</strong></p></div>
                <div><span className="adm-small adm-muted">{t.suggested}</span><p><strong>{fmt(d.cycleCosts.suggestedRevenueEur)}</strong></p></div>
              </div>
              {d.cycleCosts.shipmentsWithoutRate > 0 ? (
                <p className="adm-small adm-muted">{t.withoutRate(d.cycleCosts.shipmentsWithoutRate)}</p>
              ) : null}
            </section>
          ) : null}

          {/* Per-model margin */}
          {d.byModel.length > 0 ? (
            <section className="adm-card" style={{ marginTop: '1rem' }}>
              <h3>{t.byModel}</h3>
              <ul className="adm-list">
                {d.byModel.map((r) => (
                  <li key={r.productModelName} className="adm-row">
                    <div className="adm-row-main">
                      <strong>{r.productModelName}</strong>
                      <span className="adm-small adm-muted">
                        {r.qtySold} {t.qty.toLowerCase()} · {t.revenue}: {fmt(r.revenueEur)}
                        {' · '}{t.cogs}: {fmt(r.cogsEur)}
                        {' · '}{t.margin}: <strong>{fmt(r.grossProfitEur)}</strong>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Month series for cycle/year views */}
          {d.byMonth.length > 0 ? (
            <section className="adm-card" style={{ marginTop: '1rem' }}>
              <h3>{t.byMonth}</h3>
              <ul className="adm-list">
                {d.byMonth.map((m) => (
                  <li key={m.key} className="adm-row">
                    <div className="adm-row-main">
                      <strong>{m.key}</strong>
                      <span className="adm-small adm-muted">
                        {t.revenue}: {fmt(m.revenueEur)} · {t.opex}: {fmt(m.opexEur)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Opex breakdown */}
          {d.opexByCategory.length > 0 ? (
            <section className="adm-card" style={{ marginTop: '1rem' }}>
              <h3>{t.opexByCategory}</h3>
              <ul className="adm-list">
                {d.opexByCategory.map((r) => (
                  <li key={r.key} className="adm-row">
                    <div className="adm-row-main">
                      <strong>{label(r.key)}</strong>
                      <span className="adm-small adm-muted">{fmt(r.total)} · {r.count}×</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  )
}
