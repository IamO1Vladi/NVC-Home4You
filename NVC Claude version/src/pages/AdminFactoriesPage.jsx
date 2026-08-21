import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminDelete, UnauthorizedError } from '../admin/adminApi.js'
import { adminSave, keepsTheEditorOpen } from '../admin/adminSave.js'

// The supplier directory: the factories we have bought houses and materials from.
//
// A small screen on purpose. Its whole job is that "which factory built this?" has ONE
// spelling per factory, so the question can be asked across a year of sales instead of
// being five different strings typed into five customer records.
//
// Deleting is deliberately hard and deactivating is deliberately easy. A supplier we have
// stopped using still has to name itself on the purchases it already made, so the useful
// action is almost always "make it stop appearing on new sales", not "remove it".

const TEXT = {
  bg: {
    title: 'Фабрики',
    subtitle: 'Доставчиците, от които сме купували. Избират се при въвеждане на продажба.',
    add: 'Нова фабрика',
    empty: 'Още няма въведени фабрики.',
    emptyHint: 'Добавете първата — след това ще се появява в падащото меню при клиентите.',
    name: 'Име', country: 'Държава', city: 'Град', address: 'Адрес',
    contactName: 'Лице за контакт', contactPhone: 'Телефон', contactEmail: 'Имейл',
    website: 'Сайт', notes: 'Бележки',
    active: 'Активна', inactive: 'Неактивна',
    activeHint: 'Неактивните не се предлагат при нова продажба, но остават по старите.',
    purchases: (n) => `${n} ${n === 1 ? 'продажба' : 'продажби'}`,
    noPurchases: 'няма продажби',
    edit: 'Редактирай', remove: 'Изтрий',
    save: 'Запази', saving: 'Запазване…', cancel: 'Откажи', close: 'Затвори',
    editTitle: 'Фабрика', newTitle: 'Нова фабрика',
    confirmDelete: (name) => `Да изтрия ли „${name}“?`,
    inUse: 'Тази фабрика е посочена по съществуващи продажби. Направете я неактивна вместо да я триете.',
    duplicate: (name) => `Вече има фабрика с името „${name}“. Проверете дали не е същата.`,
    saveError: 'Промяната не беше запазена.',
  },
  en: {
    title: 'Factories',
    subtitle: 'The suppliers we have bought from. Picked when a sale is recorded.',
    add: 'New factory',
    empty: 'No factories yet.',
    emptyHint: 'Add the first one — it then appears in the dropdown on a customer.',
    name: 'Name', country: 'Country', city: 'City', address: 'Address',
    contactName: 'Contact', contactPhone: 'Phone', contactEmail: 'Email',
    website: 'Website', notes: 'Notes',
    active: 'Active', inactive: 'Inactive',
    activeHint: 'Inactive ones are not offered on a new sale but stay on the old ones.',
    purchases: (n) => `${n} ${n === 1 ? 'purchase' : 'purchases'}`,
    noPurchases: 'no purchases',
    edit: 'Edit', remove: 'Delete',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel', close: 'Close',
    editTitle: 'Factory', newTitle: 'New factory',
    confirmDelete: (name) => `Delete “${name}”?`,
    inUse: 'This factory is named by existing purchases. Make it inactive rather than deleting it.',
    duplicate: (name) => `There is already a factory called “${name}”. Check it is not the same one.`,
    saveError: 'That change was not saved.',
  },
}

// In the order somebody would read them off a business card.
const FIELDS = [
  ['name', 'name'], ['country', 'country'], ['city', 'city'], ['address', 'address'],
  ['contactName', 'contactName'], ['contactPhone', 'contactPhone'],
  ['contactEmail', 'contactEmail'], ['website', 'website'],
]

const emptyFactory = () => ({
  name: '', country: '', city: '', address: '',
  contactName: '', contactPhone: '', contactEmail: '', website: '',
  notes: '', isActive: true,
})

export default function AdminFactoriesPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [rows, setRows] = React.useState([])
  const [state, setState] = React.useState('loading')
  const [editing, setEditing] = React.useState(null)   // null = closed; {id|null, ...fields}
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      setRows(await adminGet('/api/admin/factories') ?? [])
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  // Re-reads the directory WITHOUT dropping it back to the spinner, the way the orders board
  // does. It is what a save landing late has to use: the shell renders nothing at all while
  // the page says 'loading', so reloading through load() would destroy and rebuild whatever
  // editor is open at that moment, taking the cursor out of it.
  const refresh = React.useCallback(async () => {
    setRows(await adminGet('/api/admin/factories') ?? [])
  }, [])

  // The ✕, Escape, the backdrop and Откажи. Refused while a save is running, because
  // `editing` is the only copy of what was typed and a refusal arriving after it is gone has
  // no form left to land in. Clears the error on the way out, so a reason about an edit
  // nobody is making any more does not end up on the directory behind it.
  const closeEditor = () => {
    if (busy) return
    setEditing(null)
    setError('')
  }

  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { id, ...body } = editing
      const answer = await adminSave({
        url: id ? `/api/admin/factories/${id}` : '/api/admin/factories',
        method: id ? 'PUT' : 'POST',
        body,
        lang,
        subject: body.name,
        // Only reached when the save had to fall back to the retries — which only an EDIT
        // can do, since a create is not safe to send twice. The row exists by then and the
        // directory on screen does not know it.
        onLateSuccess: refresh,
      })

      // Refused, or lost with nobody able to say whether the row was written. Either way the
      // dialog keeps everything typed and wears the reason — see adminSave.js for why these
      // are the cases the panel does not hand to the background.
      if (keepsTheEditorOpen(answer)) { setError(answer.message || t.saveError); return }

      setEditing(null)
      // A warning, not a failure — two suppliers can share a name across countries, so the
      // row is saved either way and the person decides whether it was a mistake. Only an
      // immediate save can raise it: the flag arrives in the response body, and a save that
      // went to the retries has nobody left holding one.
      if (answer.result?.duplicateName) setNotice(t.duplicate(body.name))
      if (answer.outcome === 'saved') await load()
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
      await adminDelete(`/api/admin/factories/${row.id}`)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      // The server refuses when purchases point at it, and the right answer is the one the
      // person actually wants — deactivate — rather than the raw constraint.
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
      active="factories"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
      actions={(
        <button type="button" className="btn" onClick={() => { setEditing(emptyFactory()); setError('') }}>
          {t.add}
        </button>
      )}
    >
      {/* A refused save keeps the dialog open, and the dialog is covering this line — so a
          failure from the editor is shown inside it and only deleting reports out here. */}
      {error && editing === null ? <div className="adm-alert">{error}</div> : null}
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
                {[row.city, row.country].filter(Boolean).join(', ') || '—'}
              </p>

              {row.contactName || row.contactPhone || row.contactEmail ? (
                <p className="adm-small">
                  {row.contactName ? <>{row.contactName}</> : null}
                  {row.contactPhone ? <> · <a href={`tel:${row.contactPhone.replace(/\s+/g, '')}`}>{row.contactPhone}</a></> : null}
                  {row.contactEmail ? <> · <a href={`mailto:${row.contactEmail}`}>{row.contactEmail}</a></> : null}
                </p>
              ) : null}

              <p className="adm-small adm-muted">
                {row.purchaseCount > 0 ? t.purchases(row.purchaseCount) : t.noPurchases}
              </p>

              <div className="adm-factory-actions">
                <button type="button" className="adm-linkbtn" onClick={() => { setEditing({ ...row }); setError('') }}>
                  {t.edit}
                </button>
                {/* Offered only when nothing points at it. A delete that is always there and
                    usually refused teaches people to ignore the refusal. */}
                {row.purchaseCount === 0 ? (
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
        onClose={closeEditor}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={closeEditor} disabled={busy}>{t.cancel}</button>
            <button type="button" className="btn" onClick={save} disabled={busy || !editing?.name?.trim()}>
              {busy ? t.saving : t.save}
            </button>
          </>
        )}
      >
        {editing ? (
          <div className="adm-sheet">
            {error ? <div className="adm-alert" role="alert">{error}</div> : null}
            <div className="adm-newdeal-grid">
              {FIELDS.map(([field, label]) => (
                <label key={field}>
                  <span className="adm-small">{t[label]}</span>
                  <input type="text" value={editing[field] ?? ''} onChange={set(field)} />
                </label>
              ))}
            </div>

            <label className="adm-sheet-notes">
              <span className="adm-small">{t.notes}</span>
              <textarea rows={4} value={editing.notes ?? ''} onChange={set('notes')} />
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
