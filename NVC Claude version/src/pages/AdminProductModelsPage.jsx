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
    pickOne: '— изберете —',
    noHousesInCategory: 'В галерията няма модели от тази категория.',
    nameHint: 'Свободно име — тази категория няма каталожни модели в галерията.',
    freeName: '— свободно име (не е в галерията) —',
    factoryPrice: 'Фабрична цена (USD)', retail: 'Продажна цена',
    retailHint: 'От галерията, само за четене. Редактира се в „Галерия“.',
    active: 'Активен', inactive: 'Неактивен',
    activeHint: 'Неактивните не се предлагат по нови редове, но остават по старите.',
    lots: (n) => `${n} ${n === 1 ? 'ред по контейнери' : 'реда по контейнери'}`,
    noLots: 'няма редове по контейнери',
    stock: (bought, sold, onHand) => `купени ${bought} · продадени ${sold} · налични ${onHand}`,
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
    pickOne: '— pick one —',
    noHousesInCategory: 'The gallery lists no models in this category.',
    nameHint: 'Free-text name — this category has no catalogue models in the gallery.',
    freeName: '— free name (not in the gallery) —',
    factoryPrice: 'Factory price (USD)', retail: 'Retail price',
    retailHint: 'Read from the gallery, read-only. Edited in Gallery.',
    active: 'Active', inactive: 'Inactive',
    activeHint: 'Inactive ones are not offered on new lines but stay on the old ones.',
    lots: (n) => `${n} container ${n === 1 ? 'line' : 'lines'}`,
    noLots: 'no container lines',
    stock: (bought, sold, onHand) => `bought ${bought} · sold ${sold} · on hand ${onHand}`,
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
        houseId: fields.houseId === '' || fields.houseId === 'free' ? null : Number(fields.houseId),
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

  // The categories whose cost models ARE gallery rows. Mirrors the server's
  // PurchaseCategories.WithGalleryModels, and modular is deliberately absent from it on
  // both sides: the gallery lists modular houses, but what actually gets built is a custom
  // project every time — the owner's rule, restated 2026-08-19 for this screen.
  const GALLERY_CATEGORIES = ['prefab', 'wagon', 'garage']
  const usesGallery = GALLERY_CATEGORIES.includes(editing?.categoryKey)
  const housesInCategory = houses.filter((h) => h.categoryKey === editing?.categoryKey)

  // Category drives the whole form: picking one that has gallery models swaps the free
  // name box for the gallery dropdown, and the NAME IS the chosen model's title — one
  // identity, not two boxes that can disagree. The house link resets on every category
  // change so a prefab's id can never survive into a wagon.
  const setCategory = (e) => {
    const categoryKey = e.target.value
    setEditing((f) => ({
      ...f,
      categoryKey,
      houseId: '',
      name: GALLERY_CATEGORIES.includes(categoryKey) ? '' : f.name,
    }))
  }

  const setHouse = (e) => {
    const houseId = e.target.value
    if (houseId === 'free') {
      // The escape hatch: a gallery-category model the gallery does not list. The name
      // becomes typable; the house link stays empty.
      setEditing((f) => ({ ...f, houseId: 'free', name: f.name }))
      return
    }
    const house = houses.find((h) => String(h.id) === houseId)
    setEditing((f) => ({ ...f, houseId, name: house?.title ?? '' }))
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

              {/* Stock, straight off the server: bought − sold. The number the yard asks. */}
              {row.purchasedQty > 0 ? (
                <p className="adm-small">
                  <strong>{t.stock(row.purchasedQty, row.soldQty, row.onHandQty)}</strong>
                </p>
              ) : null}

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
                <span className="adm-small">{t.category}</span>
                <select value={editing.categoryKey} onChange={setCategory}>
                  <option value="">{t.noCategory}</option>
                  {categories.map((key) => (
                    <option key={key} value={key}>{t.categories[key] ?? key}</option>
                  ))}
                </select>
              </label>

              {usesGallery ? (
                <label>
                  <span className="adm-small">{t.house}</span>
                  {/* Filtered to the chosen category, and the selection IS the name — an
                      exact id link, so a plain select rather than the leads combobox: a
                      typo'd near-match would be a wrong foreign key the margin report
                      cannot detect. The free-name option is the review's escape hatch:
                      a prefab from a second factory that the gallery does not list is a
                      real thing to buy, and without it such a model could not be created
                      — nor the imported, unlinked ones ever re-linked deliberately. */}
                  <select value={editing.houseId === '' && editing.name ? 'free' : editing.houseId} onChange={setHouse}>
                    <option value="">{t.pickOne}</option>
                    {housesInCategory.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
                    <option value="free">{t.freeName}</option>
                  </select>
                  {housesInCategory.length === 0 ? (
                    <span className="adm-small adm-muted">{t.noHousesInCategory}</span>
                  ) : null}
                </label>
              ) : (
                <label>
                  <span className="adm-small">{t.name}</span>
                  <input type="text" value={editing.name} onChange={set('name')} />
                  <span className="adm-small adm-muted">{t.nameHint}</span>
                </label>
              )}

              {/* The free-name box for a gallery category, when chosen above. */}
              {usesGallery && (editing.houseId === '' && editing.name !== '' || editing.houseId === 'free') ? (
                <label>
                  <span className="adm-small">{t.name}</span>
                  <input type="text" value={editing.name} onChange={set('name')} />
                </label>
              ) : null}

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
