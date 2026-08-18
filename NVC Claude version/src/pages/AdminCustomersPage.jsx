import React from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import RecordHistory from '../admin/RecordHistory.jsx'
import {
  adminGet, adminSend, adminDelete, adminUpload, UnauthorizedError,
} from '../admin/adminApi.js'
import { resolveModel, modelsFor } from '../admin/modelPicker.js'

// People who have actually bought, and what they bought.
//
// Distinct from Leads for the same reason Leads is distinct from Inquiries: a lead is a
// conversation that may go nowhere, a customer is a party to a completed sale. This screen
// is where the money and the paperwork live.
//
// ONE FORM, ONE SAVE. A customer and their purchases go up in a single request, because the
// alternative is a person recorded with their identity but not their deposit whenever the
// second call fails. Invoices are the exception and upload separately — a file needs a saved
// purchase to belong to, which is why those controls stay disabled until there is one.
//
// HANDLE WITH CARE. Rows here carry ЕГН and ЕИК. The list deliberately does not fetch or
// show a personal id, search deliberately cannot look one up (it would put it in a URL), and
// the invoices are served through an authenticated endpoint rather than a public image path.

const TEXT = {
  bg: {
    title: 'Клиенти',
    subtitle: 'Клиентите, които са купили, с фабриката, цената и фактурите.',
    add: 'Нов клиент',
    search: 'Търсене по име, телефон, имейл или ЕИК',
    searchHint: 'Търсенето обхваща име, телефон, имейл и ЕИК. По ЕГН не се търси.',
    empty: 'Още няма клиенти.',
    emptyHint: 'Добавете първия клиент или го създайте от спечелен лийд.',
    noMatch: 'Няма клиенти по това търсене.',

    type: 'Вид клиент',
    person: 'Физическо лице', company: 'Юридическо лице',
    eik: 'ЕИК', egn: 'ЕГН / идентификационен номер',
    egnHint: 'За чуждестранни клиенти въведете номера на документа и попълнете държавата.',
    name: 'Име', companyName: 'Наименование на фирмата',
    phone: 'Телефон', email: 'Имейл', address: 'Адрес', country: 'Държава',
    notes: 'Бележки',
    fromLead: 'От лийд',

    purchases: 'Покупки',
    addPurchase: '+ Добави покупка',
    removePurchase: 'Премахни покупката',
    purchase: (n) => `Покупка ${n}`,
    factory: 'Фабрика', noFactory: '— не е избрана —',
    category: 'Какво е купил', noCategory: '— не е избрано —',
    model: 'Модел / описание',
    modelHint: 'Изберете модел от списъка или опишете свободно.',
    modelLinked: (title) => `свързан модел: ${title}`,
    modelFree: 'свободен текст — без връзка с модел от галерията',
    customBuildHint: 'Модулните къщи са проект по поръчка — няма модел от галерията.',
    purchasedAt: 'Дата на покупка',
    currency: 'Валута',

    payment: 'Плащане',
    deposit: 'Платено капаро', finalPrice: 'Крайна цена', leftToPay: 'Остава за плащане',
    leftToPayHint: 'Изчислява се: крайна цена минус капаро.',
    noPrice: '—',
    wagonHint: 'Фургоните се плащат наведнъж, затова тук няма капаро и фактури.',

    prepaidInvoice: 'Проформа фактура', finalInvoice: 'Финална фактура',
    upload: 'Прикачи', uploading: 'Качване…',
    saveFirst: 'Запазете клиента, за да прикачите файлове.',
    removeFile: 'Премахни',

    edit: 'Отвори', remove: 'Изтрий',
    save: 'Запази', cancel: 'Откажи', close: 'Затвори',
    newTitle: 'Нов клиент',
    confirmDelete: (name) => `Да изтрия ли „${name}“ и всичките му покупки?`,
    duplicate: (name) => `Същият идентификатор вече е записан за „${name}“. Проверете дали не е един и същ клиент.`,
    saved: 'Запазено',
    saveError: 'Промяната не беше запазена.',
    uploadError: 'Файлът не беше качен.',
    mixedCurrency: 'смесени валути',
    total: 'Общо',
    categories: {
      prefab: 'Сглобяема къща', wagon: 'Фургон', modular: 'Модулна къща', garage: 'Гараж',
      container: 'Контейнер', interiors: 'Интериор', logistics: 'Транспорт',
      materials: 'Материали', other: 'Друго',
    },
  },
  en: {
    title: 'Customers',
    subtitle: 'The people who bought, with the factory, the price and the invoices.',
    add: 'New customer',
    search: 'Search by name, phone, email or ЕИК',
    searchHint: 'Search covers name, phone, email and ЕИК. An ЕГН is not searchable.',
    empty: 'No customers yet.',
    emptyHint: 'Add the first one, or create it from a won lead.',
    noMatch: 'No customers match that search.',

    type: 'Customer type',
    person: 'Person', company: 'Company',
    eik: 'ЕИК', egn: 'ЕГН / identity number',
    egnHint: 'For a foreign customer, enter the document number and fill in the country.',
    name: 'Name', companyName: 'Registered name',
    phone: 'Phone', email: 'Email', address: 'Address', country: 'Country',
    notes: 'Notes',
    fromLead: 'From lead',

    purchases: 'Purchases',
    addPurchase: '+ Add a purchase',
    removePurchase: 'Remove this purchase',
    purchase: (n) => `Purchase ${n}`,
    factory: 'Factory', noFactory: '— none chosen —',
    category: 'What they bought', noCategory: '— none chosen —',
    model: 'Model / description',
    modelHint: 'Pick a model from the list, or describe it.',
    modelLinked: (title) => `linked model: ${title}`,
    modelFree: 'free text — not linked to a gallery model',
    customBuildHint: 'Modular houses are custom builds — there is no catalogue model.',
    purchasedAt: 'Purchase date',
    currency: 'Currency',

    payment: 'Payment',
    deposit: 'Deposit paid', finalPrice: 'Final price', leftToPay: 'Left to pay',
    leftToPayHint: 'Worked out as the final price less the deposit.',
    noPrice: '—',
    wagonHint: 'Wagons are paid in one go, so there is no deposit or invoice here.',

    prepaidInvoice: 'Prepaid invoice', finalInvoice: 'Final invoice',
    upload: 'Attach', uploading: 'Uploading…',
    saveFirst: 'Save the customer to attach files.',
    removeFile: 'Remove',

    edit: 'Open', remove: 'Delete',
    save: 'Save', cancel: 'Cancel', close: 'Close',
    newTitle: 'New customer',
    confirmDelete: (name) => `Delete “${name}” and all their purchases?`,
    duplicate: (name) => `That identifier is already recorded for “${name}”. Check it is not the same customer.`,
    saved: 'Saved',
    saveError: 'That change was not saved.',
    uploadError: 'The file was not uploaded.',
    mixedCurrency: 'mixed currencies',
    total: 'Total',
    categories: {
      prefab: 'Prefab house', wagon: 'Wagon / site cabin', modular: 'Modular house', garage: 'Garage',
      container: 'Container', interiors: 'Interiors', logistics: 'Logistics',
      materials: 'Materials', other: 'Other',
    },
  },
}

const CURRENCIES = ['EUR', 'BGN']

// What the panel falls back to if /categories cannot be reached. The endpoint exists so the
// two cannot drift, but a page that will not render because one request hiccuped is worse
// than a page working from a slightly stale list.
const FALLBACK_CATEGORIES = {
  all: ['prefab', 'wagon', 'modular', 'garage', 'container', 'interiors', 'logistics', 'materials', 'other'],
  withGalleryModels: ['prefab', 'wagon', 'garage'],
  stagedPayment: ['prefab', 'modular', 'garage', 'container', 'interiors', 'logistics', 'materials', 'other'],
}

const emptyPurchase = () => ({
  id: 0, factoryId: 0, categoryKey: '', houseId: 0, customModel: '', modelText: '',
  depositPaid: '', finalPrice: '', currency: 'EUR', purchasedAt: '', notes: '', files: [],
})

const emptyCustomer = () => ({
  id: null, type: 'person', eik: '', personalId: '', name: '',
  phone: '', email: '', address: '', country: '', notes: '', leadId: null, leadName: '',
  purchases: [],
})

// '' means "not filled in", which is a different fact from 0 — a purchase with no agreed
// price must not report one. Number('') is 0, which is exactly the bug this avoids.
const numberOrNull = (value) =>
  value === '' || value === null || value === undefined ? null : Number(value)

const moneyText = (value, currency) =>
  value === null || value === undefined
    ? null
    : `${Number(value).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} ${currency || ''}`.trim()

export default function AdminCustomersPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [rows, setRows] = React.useState([])
  const [search, setSearch] = React.useState('')
  const [state, setState] = React.useState('loading')
  const [editing, setEditing] = React.useState(null)
  const [factories, setFactories] = React.useState([])
  const [houses, setHouses] = React.useState([])
  const [categories, setCategories] = React.useState(FALLBACK_CATEGORIES)
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async (term) => {
    setState('loading')
    try {
      const query = term ? `?q=${encodeURIComponent(term)}` : ''
      setRows(await adminGet(`/api/admin/customers${query}`) ?? [])
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load('') }, [load])

  // ?customer={id} opens that customer's editor on arrival. It is how "Make customer" on
  // the pipeline lands here with the right card already open — without it, converting a
  // lead would end on a list where the person you just created has to be found by hand.
  const [params] = useSearchParams()
  React.useEffect(() => {
    const id = Number(params.get('customer'))
    if (id > 0) open(id)
    // Mount-only on purpose: the param is an entry point, not live state to track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The form's vocabulary. Each tolerates failure on its own, because losing the factory
  // list should not take the whole page with it.
  React.useEffect(() => {
    let alive = true
    adminGet('/api/admin/factories')
      .then((list) => { if (alive) setFactories(Array.isArray(list) ? list : []) })
      .catch(() => { /* the dropdown is empty; everything else still works */ })
    adminGet('/api/admin/gallery')
      .then((list) => { if (alive) setHouses(Array.isArray(list) ? list : []) })
      .catch(() => { /* the model box falls back to free text */ })
    adminGet('/api/admin/customers/categories')
      .then((res) => { if (alive && res?.all) setCategories(res) })
      .catch(() => { /* FALLBACK_CATEGORIES */ })
    return () => { alive = false }
  }, [])

  // Only the active suppliers, plus whichever one this purchase already names. A dropdown
  // that silently drops the stored value rewrites the record the moment anyone saves.
  const factoryOptions = (currentId) =>
    factories.filter((f) => f.isActive || f.id === currentId)

  async function open(id) {
    setError('')
    try {
      const customer = await adminGet(`/api/admin/customers/${id}`)
      setEditing({
        ...customer,
        eik: customer.eik ?? '',
        personalId: customer.personalId ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        country: customer.country ?? '',
        notes: customer.notes ?? '',
        purchases: (customer.purchases ?? []).map((p) => ({
          ...p,
          factoryId: p.factoryId ?? 0,
          categoryKey: p.categoryKey ?? '',
          houseId: p.houseId ?? 0,
          customModel: p.customModel ?? '',
          // The linked model wins when there is one: it is the more precise of the two and
          // the one the box can link straight back up on save.
          modelText: p.houseTitle || p.customModel || '',
          depositPaid: p.depositPaid ?? '',
          finalPrice: p.finalPrice ?? '',
          purchasedAt: p.purchasedAt ?? '',
          notes: p.notes ?? '',
          files: p.files ?? [],
        })),
      })
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  async function save() {
    setBusy('save')
    setError('')
    try {
      const body = {
        type: editing.type,
        eik: editing.type === 'company' ? editing.eik : null,
        personalId: editing.type === 'person' ? editing.personalId : null,
        name: editing.name,
        phone: editing.phone,
        email: editing.email,
        address: editing.address,
        country: editing.country,
        notes: editing.notes,
        leadId: editing.leadId,
        // modelText and files are display state; houseId, customModel and the file rows are
        // what the server stores. Stripped rather than sent and ignored, so the request says
        // what it means.
        purchases: editing.purchases.map((p) => ({
          id: p.id,
          factoryId: p.factoryId || null,
          categoryKey: p.categoryKey || null,
          houseId: p.houseId || null,
          customModel: p.customModel || null,
          depositPaid: numberOrNull(p.depositPaid),
          finalPrice: numberOrNull(p.finalPrice),
          currency: p.currency,
          purchasedAt: p.purchasedAt || null,
          notes: p.notes || null,
        })),
      }

      const result = editing.id
        ? await adminSend(`/api/admin/customers/${editing.id}`, 'PUT', body)
        : await adminSend('/api/admin/customers', 'POST', body)

      // Reopened rather than closed, so the purchases that were just created come back with
      // ids and their invoice slots become usable without a second trip through the list.
      if (result?.customer?.id) await open(result.customer.id)

      setNotice(result?.duplicateOf ? t.duplicate(result.duplicateOf) : t.saved)
      await load(search)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy('')
    }
  }

  async function remove(row) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.confirmDelete(row.name))) return

    setError('')
    try {
      await adminDelete(`/api/admin/customers/${row.id}`)
      await load(search)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  async function uploadFile(purchaseId, kind, file) {
    setBusy(`file-${purchaseId}-${kind}`)
    setError('')
    try {
      await adminUpload(`/api/admin/customers/purchases/${purchaseId}/files`, file, { kind })
      await open(editing.id)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.uploadError)
    } finally {
      setBusy('')
    }
  }

  async function removeFile(fileId) {
    setError('')
    try {
      await adminDelete(`/api/admin/customers/files/${fileId}`)
      await open(editing.id)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  const setField = (field) => (e) =>
    setEditing((c) => ({ ...c, [field]: e.target.value }))

  const patchPurchase = (index, patch) =>
    setEditing((c) => ({
      ...c,
      purchases: c.purchases.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }))

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="customers"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => load(search)}
      actions={(
        <button type="button" className="btn" onClick={() => { setEditing(emptyCustomer()); setError('') }}>
          {t.add}
        </button>
      )}
    >
      <form
        className="adm-search"
        onSubmit={(e) => { e.preventDefault(); load(search) }}
        role="search"
      >
        <label className="visually-hidden" htmlFor="customerSearch">{t.search}</label>
        <input
          id="customerSearch"
          type="search"
          placeholder={t.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="adm-small adm-muted">{t.searchHint}</p>
      </form>

      {error ? <div className="adm-alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      {rows.length === 0 ? (
        <div className="adm-card adm-center adm-errbox">
          <p><strong>{search ? t.noMatch : t.empty}</strong></p>
          {search ? null : <p className="adm-muted adm-small">{t.emptyHint}</p>}
        </div>
      ) : (
        <ul className="adm-customer-list">
          {rows.map((row) => (
            <li key={row.id} className="adm-card adm-customer">
              <div className="adm-customer-main">
                <h2>
                  <button type="button" className="adm-linkbtn adm-customer-name" onClick={() => open(row.id)}>
                    {row.name}
                  </button>
                </h2>
                <p className="adm-small adm-muted">
                  <span className="adm-badge">{row.type === 'company' ? t.company : t.person}</span>
                  {row.eik ? <> · {t.eik} {row.eik}</> : null}
                  {row.phone ? <> · <a href={`tel:${row.phone.replace(/\s+/g, '')}`}>{row.phone}</a></> : null}
                  {row.email ? <> · <a href={`mailto:${row.email}`}>{row.email}</a></> : null}
                </p>
                {row.modelLabel ? <p className="adm-small">{row.modelLabel}</p> : null}
              </div>

              <div className="adm-customer-money">
                {/* Totals only when every purchase is in one currency — see the server. A
                    sum across currencies is wrong in a way nobody spots. */}
                {row.purchaseCount > 0 && !row.currency ? (
                  <span className="adm-small adm-muted">{t.mixedCurrency}</span>
                ) : null}
                {moneyText(row.totalFinalPrice, row.currency) ? (
                  <span className="adm-small">
                    {t.total}: <strong>{moneyText(row.totalFinalPrice, row.currency)}</strong>
                  </span>
                ) : null}
                {row.totalLeftToPay ? (
                  <span className="adm-small adm-owing">
                    {t.leftToPay}: <strong>{moneyText(row.totalLeftToPay, row.currency)}</strong>
                  </span>
                ) : null}
              </div>

              <div className="adm-customer-actions">
                <button type="button" className="adm-linkbtn" onClick={() => open(row.id)}>{t.edit}</button>
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
        title={editing?.name || t.newTitle}
        subtitle={editing?.leadName ? `${t.fromLead}: ${editing.leadName}` : ''}
        closeLabel={t.close}
        onClose={() => { setEditing(null); setNotice('') }}
        footer={(
          <>
            {/* "Who changed this deposit?" is asked here, looking at the customer, so it is
                answered here. Only on a saved record: one being created has no past.
                Left of the cancel/save pair because it reads rather than writes. */}
            <RecordHistory
              entityType="Customer"
              entityId={editing?.id}
              lang={lang}
              label={editing?.name}
            />
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>{t.cancel}</button>
            <button
              type="button"
              className="btn"
              onClick={save}
              disabled={busy !== '' || !editing?.name?.trim()}
            >
              {t.save}
            </button>
          </>
        )}
      >
        {editing ? (
          <div className="adm-sheet">
            <section>
              {/* Radios rather than a dropdown. It is a two-way choice that changes which
                  identifier field appears below it, so both options being visible is the
                  difference between "why did that box change?" and an obvious cause. */}
              <fieldset className="adm-typepick">
                <legend className="adm-small">{t.type}</legend>
                {[['person', t.person], ['company', t.company]].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="customerType"
                      value={value}
                      checked={editing.type === value}
                      onChange={() => setEditing((c) => ({ ...c, type: value }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>

              <div className="adm-newdeal-grid">
                <label>
                  <span className="adm-small">
                    {editing.type === 'company' ? t.companyName : t.name}
                  </span>
                  <input type="text" value={editing.name} onChange={setField('name')} />
                </label>

                {/* One identifier, decided by the type. Showing both would mean two boxes,
                    one of which is always wrong for this customer. */}
                {editing.type === 'company' ? (
                  <label>
                    <span className="adm-small">{t.eik}</span>
                    <input type="text" inputMode="numeric" value={editing.eik} onChange={setField('eik')} />
                  </label>
                ) : (
                  <label>
                    <span className="adm-small">{t.egn}</span>
                    <input type="text" value={editing.personalId} onChange={setField('personalId')} />
                    <span className="adm-small adm-muted">{t.egnHint}</span>
                  </label>
                )}

                <label>
                  <span className="adm-small">{t.phone}</span>
                  <input type="tel" value={editing.phone} onChange={setField('phone')} />
                </label>
                <label>
                  <span className="adm-small">{t.email}</span>
                  <input type="email" value={editing.email} onChange={setField('email')} />
                </label>
                <label>
                  <span className="adm-small">{t.address}</span>
                  <input type="text" value={editing.address} onChange={setField('address')} />
                </label>
                <label>
                  <span className="adm-small">{t.country}</span>
                  <input type="text" value={editing.country} onChange={setField('country')} />
                </label>
              </div>

              <label className="adm-sheet-notes">
                <span className="adm-small">{t.notes}</span>
                <textarea rows={3} value={editing.notes} onChange={setField('notes')} />
              </label>
            </section>

            <section>
              <h3 className="adm-sheet-head">{t.purchases}</h3>

              {editing.purchases.map((purchase, index) => (
                <PurchaseCard
                  key={purchase.id || `new-${index}`}
                  t={t}
                  index={index}
                  purchase={purchase}
                  factories={factoryOptions(purchase.factoryId)}
                  houses={houses}
                  categories={categories}
                  busy={busy}
                  onPatch={(patch) => patchPurchase(index, patch)}
                  onRemove={() => setEditing((c) => ({
                    ...c,
                    purchases: c.purchases.filter((_, i) => i !== index),
                  }))}
                  onUpload={uploadFile}
                  onRemoveFile={removeFile}
                />
              ))}

              <button
                type="button"
                className="btn ghost adm-btn-sm"
                onClick={() => setEditing((c) => ({ ...c, purchases: [...c.purchases, emptyPurchase()] }))}
              >
                {t.addPurchase}
              </button>
            </section>
          </div>
        ) : null}
      </AdminModal>
    </AdminShell>
  )
}

// One purchase: what it was, who built it, what was paid, and the paperwork.
function PurchaseCard({
  t, index, purchase, factories, houses, categories, busy, onPatch, onRemove, onUpload, onRemoveFile,
}) {
  const listId = `purchaseModels-${index}`
  const models = modelsFor(houses, purchase.categoryKey, categories.withGalleryModels)

  const deposit = numberOrNull(purchase.depositPaid)
  const finalPrice = numberOrNull(purchase.finalPrice)

  // Recomputed here as the numbers are typed rather than read back from the server, so the
  // figure on screen is always the one the two boxes above it imply. It is never stored —
  // a stored copy is a second version of a fact that can disagree with the first.
  const leftToPay = finalPrice === null ? null : finalPrice - (deposit ?? 0)

  // Wagons are paid in one go, so the payment block is noise on the category that produces
  // the most rows.
  //
  // Two things this must not do. It must not treat a category nobody has chosen yet as a
  // wagon — a brand-new purchase would open with its payment fields missing and a note
  // about wagons on it. And it must not hide a block that is already holding a value:
  // hiding a filled-in field is how data goes missing without anyone touching it.
  const hasMoney = deposit !== null || finalPrice !== null || purchase.files.length > 0
  const paidInOneGo = purchase.categoryKey && !categories.stagedPayment.includes(purchase.categoryKey)
  const tracksPayment = !paidInOneGo || hasMoney

  const isCustomBuild = purchase.categoryKey
    && !categories.withGalleryModels.includes(purchase.categoryKey)

  return (
    <div className="adm-purchase">
      <div className="adm-purchase-head">
        <h4>{t.purchase(index + 1)}</h4>
        <button type="button" className="adm-linkbtn adm-danger" onClick={onRemove}>
          {t.removePurchase}
        </button>
      </div>

      <div className="adm-newdeal-grid">
        <label>
          <span className="adm-small">{t.factory}</span>
          <select
            value={purchase.factoryId}
            onChange={(e) => onPatch({ factoryId: Number(e.target.value) })}
          >
            <option value={0}>{t.noFactory}</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}{f.isActive ? '' : ' ·'}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="adm-small">{t.category}</span>
          <select
            value={purchase.categoryKey}
            onChange={(e) => onPatch({
              categoryKey: e.target.value,
              // A model belongs to a category, so the text is re-resolved against the new
              // one rather than left as a mismatch nobody notices.
              ...resolveModel(purchase.modelText, e.target.value, models),
            })}
          >
            <option value="">{t.noCategory}</option>
            {categories.all.map((key) => (
              <option key={key} value={key}>{t.categories[key] ?? key}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="adm-small">{t.purchasedAt}</span>
          <input
            type="date"
            value={purchase.purchasedAt}
            onChange={(e) => onPatch({ purchasedAt: e.target.value })}
          />
        </label>

        {/* One box, suggestions where we have them — the same control as the leads sheet,
            for the same reason. A modular house has no catalogue row to suggest, so the
            list is empty and it behaves as the free-text description it has to be. */}
        <label className="adm-span-2">
          <span className="adm-small">{t.model}</span>
          <input
            type="text"
            list={listId}
            title={t.modelHint}
            value={purchase.modelText}
            onChange={(e) => onPatch(resolveModel(e.target.value, purchase.categoryKey, models))}
          />
          <datalist id={listId}>
            {models.map((h) => <option key={h.id} value={h.title} />)}
          </datalist>
          <span className="adm-small adm-muted adm-model-state">
            {purchase.houseId > 0
              ? `✓ ${t.modelLinked(purchase.modelText)}`
              : (isCustomBuild ? t.customBuildHint : (purchase.modelText.trim() ? t.modelFree : ' '))}
          </span>
        </label>
      </div>

      {tracksPayment ? (
        <div className="adm-purchase-money">
          <h5 className="adm-small">{t.payment}</h5>
          <div className="adm-newdeal-grid">
            <label>
              <span className="adm-small">{t.deposit}</span>
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={purchase.depositPaid}
                onChange={(e) => onPatch({ depositPaid: e.target.value })}
              />
            </label>
            <label>
              <span className="adm-small">{t.finalPrice}</span>
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={purchase.finalPrice}
                onChange={(e) => onPatch({ finalPrice: e.target.value })}
              />
            </label>
            <label>
              <span className="adm-small">{t.currency}</span>
              <select value={purchase.currency} onChange={(e) => onPatch({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            {/* Read-only, because it is arithmetic rather than a fact anyone can assert.
                A box people can type into is a box that ends up disagreeing with the two
                numbers above it. */}
            <label>
              <span className="adm-small">{t.leftToPay}</span>
              <output className="adm-readout" title={t.leftToPayHint}>
                {leftToPay === null ? t.noPrice : moneyText(leftToPay, purchase.currency)}
              </output>
            </label>
          </div>

          <div className="adm-invoices">
            {[['prepaid-invoice', t.prepaidInvoice], ['final-invoice', t.finalInvoice]].map(([kind, label]) => (
              <InvoiceSlot
                key={kind}
                t={t}
                kind={kind}
                label={label}
                purchaseId={purchase.id}
                files={purchase.files.filter((f) => f.kind === kind)}
                busy={busy === `file-${purchase.id}-${kind}`}
                onUpload={onUpload}
                onRemoveFile={onRemoveFile}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="adm-small adm-muted">{t.wagonHint}</p>
      )}

      <label className="adm-sheet-notes">
        <span className="adm-small">{t.notes}</span>
        <textarea rows={2} value={purchase.notes} onChange={(e) => onPatch({ notes: e.target.value })} />
      </label>
    </div>
  )
}

// One document slot. Files are listed rather than replaced: a reissued invoice is a real
// thing, and silently overwriting the first one loses the version that was actually sent.
function InvoiceSlot({ t, kind, label, purchaseId, files, busy, onUpload, onRemoveFile }) {
  const picker = React.useRef(null)
  const saved = purchaseId > 0

  return (
    <div className="adm-invoice-slot">
      <span className="adm-small">{label}</span>

      <ul className="adm-attach-list">
        {files.map((file) => (
          <li key={file.id} className="adm-attach-chip">
            {/* Through the authenticated endpoint by row id — the blob key never reaches
                the browser, so an invoice cannot be found by guessing a path. */}
            <a className="adm-attach-name" href={file.downloadUrl} download>{file.fileName}</a>
            <button
              type="button"
              className="adm-attach-x"
              aria-label={`${t.removeFile}: ${file.fileName}`}
              onClick={() => onRemoveFile(file.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <input
        ref={picker}
        type="file"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared BEFORE the handler runs, so picking the same file twice still fires a
          // change event — otherwise the second attempt silently does nothing.
          e.target.value = ''
          if (file) onUpload(purchaseId, kind, file)
        }}
      />

      <button
        type="button"
        className="btn ghost adm-btn-sm"
        // A file needs a saved purchase to belong to. Disabled with a reason rather than
        // absent, so the control does not appear to be missing.
        disabled={!saved || busy}
        title={saved ? undefined : t.saveFirst}
        onClick={() => picker.current?.click()}
      >
        {busy ? t.uploading : t.upload}
      </button>

      {saved ? null : <span className="adm-small adm-muted">{t.saveFirst}</span>}
    </div>
  )
}
