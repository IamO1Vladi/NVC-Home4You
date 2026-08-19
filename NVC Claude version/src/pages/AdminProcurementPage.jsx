import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'

// The buy side: cycles, the containers inside them, and what each container held.
//
// One screen for the whole workflow, because that is how the work arrives: a container is
// ordered inside a cycle, its costs trickle in over weeks, and the question being asked of
// this page is always "what did that container really cost us?" — which needs the cycle's
// coefficients, the shipment's crossing costs and its lots on screen together.
//
// Everything money-shaped on this page is COMPUTED BY THE SERVER and read from the DTO.
// The page adds nothing up itself — LandedCost owns the arithmetic, and a second copy here
// is how a panel and a report start disagreeing about one container. That is also why every
// lot edit swallows a whole fresh shipment from the response: freight is shared across the
// lines, so touching one line moves the landed cost of every other.
//
// Amounts on the buy side are USD as paid; the euro figures appear only where the server
// computed them with the shipment's own captured rate, and a missing rate shows as a dash
// rather than as an invented number.

const TEXT = {
  bg: {
    title: 'Доставки',
    subtitle: 'Цикли на закупуване, контейнери и какво е пътувало във всеки.',
    addCycle: 'Нов цикъл',
    emptyCycles: 'Още няма цикли на закупуване.',
    emptyCyclesHint: 'Създайте първия — контейнерите се записват вътре в цикъл.',
    cycleOpen: 'Отворен', cycleClosed: 'Затворен',
    markup: 'Коефициент', borderVat: 'ДДС граница',
    noCoefficients: 'без коефициенти — контейнерите няма да получат препоръчана цена',
    shipmentsIn: (n) => `${n} ${n === 1 ? 'контейнер' : 'контейнера'}`,
    label: 'Име', startDate: 'Начало', endDate: 'Край', notes: 'Бележки',
    closedHint: 'Затвореният цикъл не се предлага при нов контейнер, но всичко в него остава.',
    editCycle: 'Цикъл', newCycle: 'Нов цикъл',
    cycleDeleteConfirm: (label) => `Да изтрия ли цикъла „${label}“?`,
    cycleInUse: 'В този цикъл има контейнери или цели. Затворете го вместо да го триете.',
    shipments: 'Контейнери',
    addShipment: 'Нов контейнер',
    emptyShipments: 'В този цикъл още няма контейнери.',
    pickCycle: 'Изберете цикъл, за да видите контейнерите му.',
    reference: 'Референция / контейнер №', factory: 'Фабрика', noFactory: '— без фабрика —',
    status: { draft: 'чернова', ordered: 'поръчан', 'in-transit': 'пътува', arrived: 'пристигнал' },
    freight: 'Транспорт', customs: 'Мито', importVat: 'Платено ДДС на границата',
    otherCosts: 'Други разходи', otherCostsNote: 'Какви други разходи',
    orderedAt: 'Поръчан', departedAt: 'Отпътувал', arrivedAt: 'Пристигнал',
    rate: 'Курс USD→EUR', rateSource: 'Източник на курса', rateAt: 'Курс от дата',
    goods: 'Стока', crossing: 'Превоз и граница', landedBase: 'Обща стойност',
    suggested: 'Препоръчана цена',
    missing: 'За пълна калкулация липсва:',
    missingNames: {
      FreightCost: 'транспортът', CustomsDuty: 'митото',
      UsdToEurRate: 'курсът', MarkupCoefficient: 'коефициентът на цикъла',
    },
    lots: 'Стока в контейнера',
    lotModel: 'Модел', lotQty: 'Брой', lotUnitCost: 'Единична цена (USD)',
    lotLanded: 'Реална цена/бр.',
    lotStock: (sold, onHand) => `продадени ${sold} · налични ${onHand}`,
    addLot: 'Добави ред',
    saveFirst: 'Запазете контейнера, за да добавяте стока.',
    emptyLots: 'Още няма редове.',
    unitCostHint: 'Празно = текущата фабрична цена на модела.',
    perUnit: '/бр.',
    editShipment: 'Контейнер', newShipment: 'Нов контейнер',
    shipmentDeleteConfirm: (ref) => `Да изтрия ли контейнера${ref ? ` „${ref}“` : ''} и редовете му?`,
    lotDeleteConfirm: 'Да премахна ли този ред?',
    edit: 'Редактирай', remove: 'Изтрий',
    save: 'Запази', cancel: 'Откажи', close: 'Затвори',
    saveError: 'Промяната не беше запазена.',
    updated: 'Запазено',
    vatPercentHint: 'Дроб, не процент: 0.20 означава 20%.',
  },
  en: {
    title: 'Procurement',
    subtitle: 'Buying cycles, containers, and what travelled in each one.',
    addCycle: 'New cycle',
    emptyCycles: 'No buying cycles yet.',
    emptyCyclesHint: 'Create the first one — containers are recorded inside a cycle.',
    cycleOpen: 'Open', cycleClosed: 'Closed',
    markup: 'Markup', borderVat: 'Border VAT',
    noCoefficients: 'no coefficients — containers will get no suggested price',
    shipmentsIn: (n) => `${n} ${n === 1 ? 'container' : 'containers'}`,
    label: 'Label', startDate: 'Start', endDate: 'End', notes: 'Notes',
    closedHint: 'A closed cycle is not offered on a new container, but keeps everything in it.',
    editCycle: 'Cycle', newCycle: 'New cycle',
    cycleDeleteConfirm: (label) => `Delete the cycle “${label}”?`,
    cycleInUse: 'This cycle has containers or targets in it. Close it instead of deleting it.',
    shipments: 'Containers',
    addShipment: 'New container',
    emptyShipments: 'No containers in this cycle yet.',
    pickCycle: 'Pick a cycle to see its containers.',
    reference: 'Reference / container no.', factory: 'Factory', noFactory: '— no factory —',
    status: { draft: 'draft', ordered: 'ordered', 'in-transit': 'in transit', arrived: 'arrived' },
    freight: 'Freight', customs: 'Customs duty', importVat: 'Import VAT paid at the border',
    otherCosts: 'Other costs', otherCostsNote: 'What the other costs were',
    orderedAt: 'Ordered', departedAt: 'Departed', arrivedAt: 'Arrived',
    rate: 'USD→EUR rate', rateSource: 'Rate source', rateAt: 'Rate as of',
    goods: 'Goods', crossing: 'Freight & border', landedBase: 'Landed value',
    suggested: 'Suggested price',
    missing: 'Still missing for a full costing:',
    missingNames: {
      FreightCost: 'the freight', CustomsDuty: 'the customs duty',
      UsdToEurRate: 'the exchange rate', MarkupCoefficient: 'the cycle’s markup',
    },
    lots: 'Goods in the container',
    lotModel: 'Model', lotQty: 'Qty', lotUnitCost: 'Unit cost (USD)',
    lotLanded: 'True cost/unit',
    lotStock: (sold, onHand) => `sold ${sold} · on hand ${onHand}`,
    addLot: 'Add line',
    saveFirst: 'Save the container first, then add its goods.',
    emptyLots: 'No lines yet.',
    unitCostHint: 'Blank = the model’s current factory price.',
    perUnit: '/unit',
    editShipment: 'Container', newShipment: 'New container',
    shipmentDeleteConfirm: (ref) => `Delete the container${ref ? ` “${ref}”` : ''} and its lines?`,
    lotDeleteConfirm: 'Remove this line?',
    edit: 'Edit', remove: 'Delete',
    save: 'Save', cancel: 'Cancel', close: 'Close',
    saveError: 'That change was not saved.',
    updated: 'Saved',
    vatPercentHint: 'A fraction, not a percent: 0.20 means 20%.',
  },
}

// "" in a number box means "not known yet", which the API stores as null. Number('') is 0,
// and zero freight is a claim — see Shipment.FreightCost — so the difference matters.
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

const fmt = (n, currency) => {
  if (n === null || n === undefined) return '—'
  const s = Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return currency === 'EUR' ? `€${s}` : `$${s}`
}

const emptyCycle = () => ({
  label: '', startDate: '', endDate: '',
  markupCoefficient: '', borderVatRate: '', isClosed: false, notes: '',
})

const emptyShipment = (cycleId) => ({
  buyCycleId: cycleId, reference: '', factoryId: '',
  freightCost: '', customsDuty: '', importVatPaid: '', otherCosts: '', otherCostsNote: '',
  orderedAt: '', departedAt: '', arrivedAt: '',
  usdToEurRate: '', rateSource: '', rateAt: '', notes: '',
})

export default function AdminProcurementPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [state, setState] = React.useState('loading')
  const [cycles, setCycles] = React.useState([])
  const [factories, setFactories] = React.useState([])
  const [models, setModels] = React.useState([])
  const [selectedCycle, setSelectedCycle] = React.useState(null)
  const [shipments, setShipments] = React.useState([])
  const [shipmentsBusy, setShipmentsBusy] = React.useState(false)

  const [editingCycle, setEditingCycle] = React.useState(null)
  const [editingShipment, setEditingShipment] = React.useState(null) // header fields being edited
  const [openShipment, setOpenShipment] = React.useState(null)       // the DTO the modal shows
  const [newLot, setNewLot] = React.useState({ productModelId: '', quantity: '', unitCost: '' })
  // The id of the line being corrected, or null when the form below the list is adding a
  // new one. One form does both jobs — the fields are the same three, and a second form
  // in the modal would just be the first one with a different heading.
  const [editingLotId, setEditingLotId] = React.useState(null)

  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      // Models and factories feed the dropdowns; both tolerate failure so a broken
      // reference list degrades to a dropdown with fewer options, not a dead page.
      const [cycleRows, factoryRows, modelRows] = await Promise.all([
        adminGet('/api/admin/buy-cycles'),
        adminGet('/api/admin/factories').catch(() => []),
        adminGet('/api/admin/product-models').catch(() => []),
      ])
      setCycles(cycleRows ?? [])
      setFactories((factoryRows ?? []).filter((f) => f.isActive))
      setModels((modelRows ?? []).filter((m) => m.isActive))
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  const showShipments = React.useCallback(async (cycleId) => {
    setSelectedCycle(cycleId)
    setShipmentsBusy(true)
    try {
      setShipments(await adminGet(`/api/admin/shipments?cycleId=${cycleId}`) ?? [])
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setShipmentsBusy(false)
    }
  }, [t.saveError])

  // --- Cycles -------------------------------------------------------------------------

  async function openNewCycle() {
    setError('')
    const draft = emptyCycle()
    // The server's own default — the previous cycle's coefficients — shown in the form
    // rather than applied silently, so the person creating the cycle sees the numbers it
    // will price with and can disagree on the spot.
    try {
      const defaults = await adminGet('/api/admin/buy-cycles/defaults')
      if (defaults?.markupCoefficient != null) draft.markupCoefficient = String(defaults.markupCoefficient)
      if (defaults?.borderVatRate != null) draft.borderVatRate = String(defaults.borderVatRate)
    } catch { /* an empty box is the fallback, not a failure */ }
    setEditingCycle(draft)
  }

  async function saveCycle() {
    setBusy(true)
    setError('')
    try {
      const { id, ...fields } = editingCycle
      const body = {
        ...fields,
        markupCoefficient: num(fields.markupCoefficient),
        borderVatRate: num(fields.borderVatRate),
      }
      const result = id
        ? await adminSend(`/api/admin/buy-cycles/${id}`, 'PUT', body)
        : await adminSend('/api/admin/buy-cycles', 'POST', body)

      setEditingCycle(null)
      setNotice(t.updated)
      await load()
      if (result?.cycle?.id && selectedCycle === result.cycle.id) await showShipments(result.cycle.id)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  async function removeCycle(cycle) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.cycleDeleteConfirm(cycle.label))) return
    setError('')
    try {
      await adminDelete(`/api/admin/buy-cycles/${cycle.id}`)
      if (selectedCycle === cycle.id) { setSelectedCycle(null); setShipments([]) }
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(t.cycleInUse)
    }
  }

  // --- Shipments ----------------------------------------------------------------------

  async function saveShipment() {
    setBusy(true)
    setError('')
    try {
      const { id, ...fields } = editingShipment
      const body = {
        ...fields,
        buyCycleId: Number(fields.buyCycleId),
        factoryId: fields.factoryId === '' ? null : Number(fields.factoryId),
        freightCost: num(fields.freightCost),
        customsDuty: num(fields.customsDuty),
        importVatPaid: num(fields.importVatPaid),
        otherCosts: num(fields.otherCosts),
        usdToEurRate: num(fields.usdToEurRate),
      }
      const result = id
        ? await adminSend(`/api/admin/shipments/${id}`, 'PUT', body)
        : await adminSend('/api/admin/shipments', 'POST', body)

      setEditingShipment(null)
      // Straight into the container view: the next thing after saving the header is
      // entering what was inside it, and closing the modal in between loses the thread.
      setOpenShipment(result?.shipment ?? null)
      setNotice(t.updated)
      if (selectedCycle) await showShipments(selectedCycle)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  async function removeShipment(shipment) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.shipmentDeleteConfirm(shipment.reference))) return
    setError('')
    try {
      await adminDelete(`/api/admin/shipments/${shipment.id}`)
      setOpenShipment(null)
      if (selectedCycle) await showShipments(selectedCycle)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  // --- Lots ---------------------------------------------------------------------------
  //
  // Every lot call returns the whole shipment recosted, and the whole shipment is what
  // lands in state. Updating just the touched row would leave every other row's landed
  // cost stale — freight is shared, so they all moved.

  async function lotCall(promise) {
    setBusy(true)
    setError('')
    try {
      const result = await promise
      setOpenShipment(result?.shipment ?? null)
      if (selectedCycle) await showShipments(selectedCycle)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  const saveLot = () => {
    const body = {
      productModelId: Number(newLot.productModelId),
      quantity: Number(newLot.quantity),
      // On ADD, 0 asks the server to prefill from the model's current factory price — the
      // one moment that price is read; from then on the lot keeps its own snapshot. On an
      // EDIT the field arrives prefilled with the lot's own cost, so a blank is a person
      // deliberately zeroing it (a sample, a warranty item), not a request to re-prefill.
      unitCost: newLot.unitCost === '' ? 0 : Number(newLot.unitCost),
    }
    const request = editingLotId
      ? adminSend(`/api/admin/shipments/lots/${editingLotId}`, 'PUT', body)
      : adminSend(`/api/admin/shipments/${openShipment.id}/lots`, 'POST', body)

    lotCall(request.then((r) => {
      setNewLot({ productModelId: '', quantity: '', unitCost: '' })
      setEditingLotId(null)
      return r
    }))
  }

  const startLotEdit = (lot) => {
    setEditingLotId(lot.id)
    setNewLot({
      productModelId: String(lot.productModelId),
      quantity: String(lot.quantity),
      unitCost: String(lot.unitCost),
    })
  }

  const cancelLotEdit = () => {
    setEditingLotId(null)
    setNewLot({ productModelId: '', quantity: '', unitCost: '' })
  }

  const removeLot = (lot) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.lotDeleteConfirm)) return
    lotCall(adminDelete(`/api/admin/shipments/lots/${lot.id}`))
  }

  const setCycleField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setEditingCycle((f) => ({ ...f, [field]: value }))
  }
  const setShipmentField = (field) => (e) =>
    setEditingShipment((f) => ({ ...f, [field]: e.target.value }))

  const selected = cycles.find((c) => c.id === selectedCycle)

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="procurement"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
      actions={(
        <button type="button" className="btn" onClick={openNewCycle}>{t.addCycle}</button>
      )}
    >
      {error ? <div className="adm-alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      {cycles.length === 0 ? (
        <div className="adm-card adm-center adm-errbox">
          <p><strong>{t.emptyCycles}</strong></p>
          <p className="adm-muted adm-small">{t.emptyCyclesHint}</p>
        </div>
      ) : (
        <ul className="adm-grid adm-factory-grid">
          {cycles.map((cycle) => (
            <li
              key={cycle.id}
              className={`adm-card adm-factory${cycle.isClosed ? ' is-off' : ''}${cycle.id === selectedCycle ? ' adm-shadow-lift' : ''}`}
            >
              <div className="adm-factory-head">
                <h2>{cycle.label}</h2>
                <span className={`adm-badge ${cycle.isClosed ? 'adm-stage-lost' : 'adm-stage-won'}`}>
                  {cycle.isClosed ? t.cycleClosed : t.cycleOpen}
                </span>
              </div>

              <p className="adm-small adm-muted">
                {[cycle.startDate, cycle.endDate].filter(Boolean).join(' → ') || '—'}
              </p>

              <p className="adm-small">
                {cycle.markupCoefficient != null
                  ? <>{t.markup}: ×{cycle.markupCoefficient} · {t.borderVat}: {cycle.borderVatRate ?? '—'}</>
                  : <span className="adm-muted">{t.noCoefficients}</span>}
              </p>

              <p className="adm-small adm-muted">{t.shipmentsIn(cycle.shipmentCount)}</p>

              <div className="adm-factory-actions">
                <button type="button" className="adm-linkbtn" onClick={() => showShipments(cycle.id)}>
                  {t.shipments}
                </button>
                <button type="button" className="adm-linkbtn" onClick={() => { setEditingCycle({ ...cycle, markupCoefficient: cycle.markupCoefficient ?? '', borderVatRate: cycle.borderVatRate ?? '', startDate: cycle.startDate ?? '', endDate: cycle.endDate ?? '', notes: cycle.notes ?? '' }); setError('') }}>
                  {t.edit}
                </button>
                {cycle.shipmentCount === 0 ? (
                  <button type="button" className="adm-linkbtn adm-danger" onClick={() => removeCycle(cycle)}>
                    {t.remove}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* The selected cycle's containers. A section rather than a page: the cycle's own
          coefficients are what price these, so they belong in the same view. */}
      {selected ? (
        <section className="adm-card" style={{ marginTop: '1rem' }}>
          <div className="adm-factory-head">
            <h2>{t.shipments} — {selected.label}</h2>
            <button
              type="button"
              className="btn"
              onClick={() => { setEditingShipment(emptyShipment(selected.id)); setError('') }}
            >
              {t.addShipment}
            </button>
          </div>

          {shipmentsBusy ? <p className="adm-muted adm-small">…</p> : null}

          {!shipmentsBusy && shipments.length === 0 ? (
            <p className="adm-muted">{t.emptyShipments}</p>
          ) : (
            <ul className="adm-list">
              {shipments.map((s) => (
                <li key={s.id} className="adm-row">
                  <div className="adm-row-main">
                    <strong>{s.reference || `#${s.id}`}</strong>
                    <span className={`adm-badge adm-stage-${s.status === 'arrived' ? 'won' : 'open'}`}>
                      {t.status[s.status] ?? s.status}
                    </span>
                    <span className="adm-small adm-muted">
                      {s.factoryName || '—'} · {s.unitCount}× · {t.landedBase}: {fmt(s.landedBaseUsd)}
                      {s.landedBaseEur != null ? ` (${fmt(s.landedBaseEur, 'EUR')})` : ''}
                      {s.suggestedPriceUsd != null ? ` · ${t.suggested}: ${fmt(s.suggestedPriceUsd)}` : ''}
                    </span>
                  </div>
                  <div className="adm-row-actions">
                    <button type="button" className="adm-linkbtn" onClick={() => { setOpenShipment(s); cancelLotEdit(); setError('') }}>
                      {t.edit}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : cycles.length > 0 ? (
        <p className="adm-muted adm-small" style={{ marginTop: '1rem' }}>{t.pickCycle}</p>
      ) : null}

      {/* --- Cycle editor ------------------------------------------------------------- */}
      <AdminModal
        open={editingCycle !== null}
        title={editingCycle?.id ? t.editCycle : t.newCycle}
        subtitle={editingCycle?.id ? editingCycle.label : ''}
        closeLabel={t.close}
        onClose={() => setEditingCycle(null)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => setEditingCycle(null)}>{t.cancel}</button>
            <button type="button" className="btn" onClick={saveCycle} disabled={busy || !editingCycle?.label?.trim()}>
              {t.save}
            </button>
          </>
        )}
      >
        {editingCycle ? (
          <div className="adm-sheet">
            <div className="adm-newdeal-grid">
              <label>
                <span className="adm-small">{t.label}</span>
                <input type="text" value={editingCycle.label} onChange={setCycleField('label')} />
              </label>
              <label>
                <span className="adm-small">{t.startDate}</span>
                <input type="date" value={editingCycle.startDate ?? ''} onChange={setCycleField('startDate')} />
              </label>
              <label>
                <span className="adm-small">{t.endDate}</span>
                <input type="date" value={editingCycle.endDate ?? ''} onChange={setCycleField('endDate')} />
              </label>
              <label>
                <span className="adm-small">{t.markup}</span>
                <input type="number" step="0.0001" value={editingCycle.markupCoefficient} onChange={setCycleField('markupCoefficient')} />
              </label>
              <label>
                <span className="adm-small">{t.borderVat}</span>
                <input type="number" step="0.0001" value={editingCycle.borderVatRate} onChange={setCycleField('borderVatRate')} />
                <span className="adm-small adm-muted">{t.vatPercentHint}</span>
              </label>
            </div>

            <label className="adm-sheet-notes">
              <span className="adm-small">{t.notes}</span>
              <textarea rows={3} value={editingCycle.notes ?? ''} onChange={setCycleField('notes')} />
            </label>

            <label className="adm-check">
              <input type="checkbox" checked={!!editingCycle.isClosed} onChange={setCycleField('isClosed')} />
              <span>
                {t.cycleClosed}
                <span className="adm-small adm-muted adm-check-hint">{t.closedHint}</span>
              </span>
            </label>
          </div>
        ) : null}
      </AdminModal>

      {/* --- Shipment header editor ---------------------------------------------------- */}
      <AdminModal
        open={editingShipment !== null}
        title={editingShipment?.id ? t.editShipment : t.newShipment}
        subtitle={editingShipment?.reference || ''}
        closeLabel={t.close}
        onClose={() => setEditingShipment(null)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => setEditingShipment(null)}>{t.cancel}</button>
            <button type="button" className="btn" onClick={saveShipment} disabled={busy}>{t.save}</button>
          </>
        )}
      >
        {editingShipment ? (
          <div className="adm-sheet">
            <div className="adm-newdeal-grid">
              <label>
                <span className="adm-small">{t.reference}</span>
                <input type="text" value={editingShipment.reference ?? ''} onChange={setShipmentField('reference')} />
              </label>
              <label>
                <span className="adm-small">{t.factory}</span>
                <select value={editingShipment.factoryId ?? ''} onChange={setShipmentField('factoryId')}>
                  <option value="">{t.noFactory}</option>
                  {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <label>
                <span className="adm-small">{t.freight} (USD)</span>
                <input type="number" step="0.01" value={editingShipment.freightCost} onChange={setShipmentField('freightCost')} />
              </label>
              <label>
                <span className="adm-small">{t.customs} (USD)</span>
                <input type="number" step="0.01" value={editingShipment.customsDuty} onChange={setShipmentField('customsDuty')} />
              </label>
              <label>
                <span className="adm-small">{t.importVat} (USD)</span>
                <input type="number" step="0.01" value={editingShipment.importVatPaid} onChange={setShipmentField('importVatPaid')} />
              </label>
              <label>
                <span className="adm-small">{t.otherCosts} (USD)</span>
                <input type="number" step="0.01" value={editingShipment.otherCosts} onChange={setShipmentField('otherCosts')} />
              </label>
              <label>
                <span className="adm-small">{t.otherCostsNote}</span>
                <input type="text" value={editingShipment.otherCostsNote ?? ''} onChange={setShipmentField('otherCostsNote')} />
              </label>
              <label>
                <span className="adm-small">{t.orderedAt}</span>
                <input type="date" value={editingShipment.orderedAt ?? ''} onChange={setShipmentField('orderedAt')} />
              </label>
              <label>
                <span className="adm-small">{t.departedAt}</span>
                <input type="date" value={editingShipment.departedAt ?? ''} onChange={setShipmentField('departedAt')} />
              </label>
              <label>
                <span className="adm-small">{t.arrivedAt}</span>
                <input type="date" value={editingShipment.arrivedAt ?? ''} onChange={setShipmentField('arrivedAt')} />
              </label>
              <label>
                <span className="adm-small">{t.rate}</span>
                <input type="number" step="0.000001" value={editingShipment.usdToEurRate} onChange={setShipmentField('usdToEurRate')} />
              </label>
              <label>
                <span className="adm-small">{t.rateSource}</span>
                <input type="text" value={editingShipment.rateSource ?? ''} onChange={setShipmentField('rateSource')} />
              </label>
              <label>
                <span className="adm-small">{t.rateAt}</span>
                <input type="date" value={editingShipment.rateAt ?? ''} onChange={setShipmentField('rateAt')} />
              </label>
            </div>

            <label className="adm-sheet-notes">
              <span className="adm-small">{t.notes}</span>
              <textarea rows={3} value={editingShipment.notes ?? ''} onChange={setShipmentField('notes')} />
            </label>
          </div>
        ) : null}
      </AdminModal>

      {/* --- Container view: figures and lots ------------------------------------------ */}
      <AdminModal
        open={openShipment !== null}
        title={t.editShipment}
        subtitle={openShipment ? `${openShipment.reference || `#${openShipment.id}`} · ${openShipment.buyCycleLabel}` : ''}
        closeLabel={t.close}
        onClose={() => { setOpenShipment(null); cancelLotEdit() }}
        footer={(
          <>
            <button
              type="button"
              className="adm-linkbtn adm-danger"
              onClick={() => removeShipment(openShipment)}
            >
              {t.remove}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                // Reopen the header form prefilled from the DTO. The strings the inputs
                // want are exactly what the DTO carries (yyyy-MM-dd dates, numbers).
                const s = openShipment
                setOpenShipment(null)
                setEditingShipment({
                  id: s.id, buyCycleId: s.buyCycleId, reference: s.reference ?? '',
                  factoryId: s.factoryId ?? '', freightCost: s.freightCost ?? '',
                  customsDuty: s.customsDuty ?? '', importVatPaid: s.importVatPaid ?? '',
                  otherCosts: s.otherCosts ?? '', otherCostsNote: s.otherCostsNote ?? '',
                  orderedAt: s.orderedAt ?? '', departedAt: s.departedAt ?? '',
                  arrivedAt: s.arrivedAt ?? '', usdToEurRate: s.usdToEurRate ?? '',
                  rateSource: s.rateSource ?? '', rateAt: s.rateAt ?? '', notes: s.notes ?? '',
                })
              }}
            >
              {t.edit}
            </button>
            <button type="button" className="btn" onClick={() => { setOpenShipment(null); cancelLotEdit() }}>{t.close}</button>
          </>
        )}
      >
        {openShipment ? (
          <div className="adm-sheet">
            {/* The figures, straight off the DTO. Server-computed — see the header comment. */}
            <div className="adm-newdeal-grid">
              <div>
                <span className="adm-small adm-muted">{t.goods}</span>
                <p><strong>{fmt(openShipment.goodsCostUsd)}</strong></p>
              </div>
              <div>
                <span className="adm-small adm-muted">{t.crossing}</span>
                <p><strong>{fmt(openShipment.crossingCostUsd)}</strong></p>
              </div>
              <div>
                <span className="adm-small adm-muted">{t.landedBase}</span>
                <p>
                  <strong>{fmt(openShipment.landedBaseUsd)}</strong>
                  {openShipment.landedBaseEur != null
                    ? <span className="adm-muted"> · {fmt(openShipment.landedBaseEur, 'EUR')}</span>
                    : null}
                </p>
              </div>
              <div>
                <span className="adm-small adm-muted">{t.suggested}</span>
                <p>
                  <strong>{fmt(openShipment.suggestedPriceUsd)}</strong>
                  {openShipment.suggestedPriceEur != null
                    ? <span className="adm-muted"> · {fmt(openShipment.suggestedPriceEur, 'EUR')}</span>
                    : null}
                </p>
              </div>
            </div>

            {/* "This cost $0" and "nobody has typed the freight yet" must not look alike. */}
            {openShipment.missingForCosting?.length > 0 ? (
              <p className="adm-note adm-small">
                {t.missing}{' '}
                {openShipment.missingForCosting.map((k) => t.missingNames[k] ?? k).join(', ')}
              </p>
            ) : null}

            <h3>{t.lots}</h3>

            {openShipment.lots.length === 0 ? (
              <p className="adm-muted adm-small">{t.emptyLots}</p>
            ) : (
              <ul className="adm-list">
                {openShipment.lots.map((lot) => (
                  <li key={lot.id} className="adm-row">
                    <div className="adm-row-main">
                      <strong>{lot.productModelName}</strong>
                      <span className="adm-small adm-muted">
                        {lot.quantity} × {fmt(lot.unitCost)} = {fmt(lot.lineTotalUsd)}
                        {lot.unitLandedCostUsd != null
                          ? <> · {t.lotLanded}: {fmt(lot.unitLandedCostUsd)}{lot.unitLandedCostEur != null ? ` (${fmt(lot.unitLandedCostEur, 'EUR')})` : ''}</>
                          : null}
                        {/* Stock per line, from the server — sold draws it down, phase 2. */}
                        {lot.qtySold > 0 ? <> · {t.lotStock(lot.qtySold, lot.qtyOnHand)}</> : null}
                      </span>
                    </div>
                    <div className="adm-row-actions">
                      <button type="button" className="adm-linkbtn" onClick={() => startLotEdit(lot)}>
                        {t.edit}
                      </button>
                      <button type="button" className="adm-linkbtn adm-danger" onClick={() => removeLot(lot)}>
                        {t.remove}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="adm-newdeal-grid">
              <label>
                <span className="adm-small">{t.lotModel}</span>
                <select
                  value={newLot.productModelId}
                  onChange={(e) => setNewLot((l) => ({ ...l, productModelId: e.target.value }))}
                >
                  <option value="" />
                  {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label>
                <span className="adm-small">{t.lotQty}</span>
                <input
                  type="number" min="1" step="1" value={newLot.quantity}
                  onChange={(e) => setNewLot((l) => ({ ...l, quantity: e.target.value }))}
                />
              </label>
              <label>
                <span className="adm-small">{t.lotUnitCost}</span>
                <input
                  type="number" min="0" step="0.01" value={newLot.unitCost}
                  onChange={(e) => setNewLot((l) => ({ ...l, unitCost: e.target.value }))}
                />
                <span className="adm-small adm-muted">{t.unitCostHint}</span>
              </label>
            </div>
            <div className="adm-form-actions">
              {editingLotId ? (
                <button type="button" className="btn ghost" onClick={cancelLotEdit}>{t.cancel}</button>
              ) : null}
              <button
                type="button"
                className="btn"
                onClick={saveLot}
                disabled={busy || !newLot.productModelId || !(Number(newLot.quantity) >= 1)}
              >
                {editingLotId ? t.save : t.addLot}
              </button>
            </div>
          </div>
        ) : null}
      </AdminModal>
    </AdminShell>
  )
}
