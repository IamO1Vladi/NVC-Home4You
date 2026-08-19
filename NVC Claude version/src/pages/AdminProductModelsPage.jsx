import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'

// The catalogue at factory cost — what we PAY for a model, next to what we SELL it for.
//
// The one rule this screen keeps visible: cost lives here, retail lives on the gallery row,
// and the two meet through the house link. A model that is a catalogue house shows both
// prices side by side, and the retail one is read-only ON PURPOSE — it is the gallery's
// number, edited in the gallery, and a second editable copy here is the 73 m² incident.
//
// Everything is USD on this page except the retail column, which is whatever the gallery
// says (EUR in practice). The factory price is a REFERENCE for prefilling new container
// lines; editing it never touches what past containers cost.

const TEXT = {
  bg: {
    title: 'Доставни цени',
    subtitle: 'Моделите, които купуваме, и какво ни струват от фабриката.',
    add: 'Нов модел',
    empty: 'Още няма модели.',
    emptyHint: 'Добавете първия — след това се избира при редовете на контейнер.',
    name: 'Име', category: 'Категория', house: 'Модел от галерията',
    noHouse: '— не е от галерията —',
    factoryPrice: 'Фабрична цена (USD)', retail: 'Продажна цена',
    retailHint: 'От галерията, само за четене. Редактира се в „Галерия“.',
    active: 'Активен', inactive: 'Неактивен',
    activeHint: 'Неактивните не се предлагат по нови редове, но остават по старите.',
    lots: (n) => `${n} ${n === 1 ? 'ред по контейнери' : 'реда по контейнери'}`,
    noLots: 'няма редове по контейнери',
    notes: 'Бележки',
    edit: 'Редактирай', remove: 'Изтрий',
    save: 'Запази', cancel: 'Откажи', close: 'Затвори',
    editTitle: 'Модел', newTitle: 'Нов модел',
    confirmDelete: (name) => `Да изтрия ли „${name}“?`,
    inUse: 'По този модел има редове в контейнери. Направете го неактивен вместо да го триете.',
    duplicateHouse: 'Вече има модел, свързан със същата къща от галерията. Проверете дали не дублирате.',
    saveError: 'Промяната не беше запазена.',
    updated: 'Запазено',
    categories: {
      prefab: 'Сглобяема къща', wagon: 'Фургон', modular: 'Модулна къща', garage: 'Гараж',
      container: 'Контейнер', interiors: 'Интериор', logistics: 'Транспорт',
      materials: 'Материали', other: 'Друго',
    },
    noCategory: '— без категория —',
  },
  en: {
    title: 'Cost prices',
    subtitle: 'The models we buy, and what the factory charges us for each.',
    add: 'New model',
    empty: 'No models yet.',
    emptyHint: 'Add the first one — it is then offered on a container’s lines.',
    name: 'Name', category: 'Category', house: 'Gallery model',
    noHouse: '— not a gallery model —',
    factoryPrice: 'Factory price (USD)', retail: 'Retail price',
    retailHint: 'Read from the gallery, read-only. Edited in Gallery.',
    active: 'Active', inactive: 'Inactive',
    activeHint: 'Inactive ones are not offered on new lines but stay on the old ones.',
    lots: (n) => `${n} container ${n === 1 ? 'line' : 'lines'}`,
    noLots: 'no container lines',
    notes: 'Notes',
    edit: 'Edit', remove: 'Delete',
    save: 'Save', cancel: 'Cancel', close: 'Close',
    editTitle: 'Model', newTitle: 'New model',
    confirmDelete: (name) => `Delete “${name}”?`,
    inUse: 'Containers carry lines with this model. Make it inactive rather than deleting it.',
    duplicateHouse: 'Another model already links to that gallery house. Check you are not duplicating it.',
    saveError: 'That change was not saved.',
    updated: 'Saved',
    categories: {
      prefab: 'Prefab house', wagon: 'Wagon / site cabin', modular: 'Modular house', garage: 'Garage',
      container: 'Container', interiors: 'Interiors', logistics: 'Logistics',
      materials: 'Materials', other: 'Other',
    },
    noCategory: '— no category —',
  },
}

const fmt = (n, cur = 'USD') => {
  if (n === null || n === undefined) return '—'
  const s = Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return cur === 'EUR' ? `€${s}` : `$${s}`
}

const emptyModel = () => ({
  name: '', categoryKey: '', houseId: '', factoryPrice: '', isActive: true, notes: '',
})

export default function AdminProductModelsPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [rows, setRows] = React.useState([])
  const [categories, setCategories] = React.useState([])
  const [houses, setHouses] = React.useState([])
  const [state, setState] = React.useState('loading')
  const [editing, setEditing] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      // The key list comes from the API rather than a copy here — the same list the sales
      // side uses, served once, so "what we bought" and "what we sold" group identically.
      const [modelRows, keys, galleryRows] = await Promise.all([
        adminGet('/api/admin/product-models'),
        adminGet('/api/admin/product-models/categories').catch(() => []),
        adminGet('/api/admin/gallery').catch(() => []),
      ])
      setRows(modelRows ?? [])
      setCategories(keys ?? [])
      setHouses(galleryRows ?? [])
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
        categoryKey: fields.categoryKey || null,
        houseId: fields.houseId === '' ? null : Number(fields.houseId),
        factoryPrice: fields.factoryPrice === '' ? null : Number(fields.factoryPrice),
      }
      const result = id
        ? await adminSend(`/api/admin/product-models/${id}`, 'PUT', body)
        : await adminSend('/api/admin/product-models', 'POST', body)

      setEditing(null)
      // Two cost rows for one house are legitimate — the same model from two factories —
      // so this warns rather than blocks, exactly like a duplicate factory name.
      setNotice(result?.duplicateHouseLink ? t.duplicateHouse : t.updated)
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
    if (!window.confirm(t.confirmDelete(row.name))) return
    setError('')
    try {
      await adminDelete(`/api/admin/product-models/${row.id}`)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(t.inUse)
    }
  }

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setEditing((f) => ({ ...f, [field]: value }))
  }

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="models"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
      actions={(
        <button type="button" className="btn" onClick={() => { setEditing(emptyModel()); setError('') }}>
          {t.add}
        </button>
      )}
    >
      {error ? <div className="adm-alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      {rows.length === 0 ? (
        <div className="adm-card adm-center adm-errbox">
          <p><strong>{t.empty}</strong></p>
          <p className="adm-muted adm-small">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="adm-grid adm-factory-grid">
          {rows.map((row) => (
            <li key={row.id} className={`adm-card adm-factory${row.isActive ? '' : ' is-off'}`}>
              <div className="adm-factory-head">
                <h2>{row.name}</h2>
                <span className={`adm-badge ${row.isActive ? 'adm-stage-won' : 'adm-stage-lost'}`}>
                  {row.isActive ? t.active : t.inactive}
                </span>
              </div>

              <p className="adm-small adm-muted">
                {row.categoryKey ? (t.categories[row.categoryKey] ?? row.categoryKey) : '—'}
                {row.houseTitle ? <> · {row.houseTitle}</> : null}
              </p>

              {/* Both sides of the price where there are both. Retail comes through the
                  gallery link — it is not a column on this table, which is the point. */}
              <p className="adm-small">
                {t.factoryPrice}: <strong>{fmt(row.factoryPrice)}</strong>
                {row.retailPrice != null
                  ? <> · {t.retail}: <strong>{fmt(row.retailPrice, row.retailCurrency || 'EUR')}</strong></>
                  : null}
              </p>

              <p className="adm-small adm-muted">
                {row.lotCount > 0 ? t.lots(row.lotCount) : t.noLots}
              </p>

              <div className="adm-factory-actions">
                <button
                  type="button"
                  className="adm-linkbtn"
                  onClick={() => {
                    setEditing({
                      id: row.id, name: row.name, categoryKey: row.categoryKey ?? '',
                      houseId: row.houseId ?? '', factoryPrice: row.factoryPrice ?? '',
                      isActive: row.isActive, notes: row.notes ?? '',
                    })
                    setError('')
                  }}
                >
                  {t.edit}
                </button>
                {row.lotCount === 0 ? (
                  <button type="button" className="adm-linkbtn adm-danger" onClick={() => remove(row)}>
                    {t.remove}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={editing !== null}
        title={editing?.id ? t.editTitle : t.newTitle}
        subtitle={editing?.id ? editing.name : ''}
        closeLabel={t.close}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>{t.cancel}</button>
            <button type="button" className="btn" onClick={save} disabled={busy || !editing?.name?.trim()}>
              {t.save}
            </button>
          </>
        )}
      >
        {editing ? (
          <div className="adm-sheet">
            <div className="adm-newdeal-grid">
              <label>
                <span className="adm-small">{t.name}</span>
                <input type="text" value={editing.name} onChange={set('name')} />
              </label>
              <label>
                <span className="adm-small">{t.category}</span>
                <select value={editing.categoryKey} onChange={set('categoryKey')}>
                  <option value="">{t.noCategory}</option>
                  {categories.map((key) => (
                    <option key={key} value={key}>{t.categories[key] ?? key}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="adm-small">{t.house}</span>
                {/* An exact id link, so a plain select rather than the leads combobox:
                    a model either IS a gallery house or it is not, and a typo'd near-match
                    would be a wrong foreign key the margin report cannot detect. */}
                <select value={editing.houseId} onChange={set('houseId')}>
                  <option value="">{t.noHouse}</option>
                  {houses.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
                </select>
              </label>
              <label>
                <span className="adm-small">{t.factoryPrice}</span>
                <input type="number" min="0" step="0.01" value={editing.factoryPrice} onChange={set('factoryPrice')} />
              </label>
            </div>

            <label className="adm-sheet-notes">
              <span className="adm-small">{t.notes}</span>
              <textarea rows={3} value={editing.notes ?? ''} onChange={set('notes')} />
            </label>

            <label className="adm-check">
              <input type="checkbox" checked={editing.isActive} onChange={set('isActive')} />
              <span>
                {t.active}
                <span className="adm-small adm-muted adm-check-hint">{t.activeHint}</span>
              </span>
            </label>
          </div>
        ) : null}
      </AdminModal>
    </AdminShell>
  )
}
