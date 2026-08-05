import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, adminSend, adminDelete, adminUpload, UnauthorizedError } from '../admin/adminApi.js'

// Gallery management. Once Quickbase is retired this is the only way to edit the catalogue,
// so it covers every field the business actually changes — prices, all three translations,
// category, publish state, ordering and photos — not just the convenient ones.

const TEXT = {
  bg: {
    title: 'Галерия',
    subtitle: 'Модели, цени и снимки. Промените се виждат на сайта веднага след запис.',
    add: 'Нов модел',
    edit: 'Редактирай',
    remove: 'Изтрий',
    save: 'Запази',
    cancel: 'Откажи',
    published: 'Публикуван',
    draft: 'Чернова',
    empty: 'Няма добавени модели.',
    fields: {
      title: 'Заглавие (EN)', titleBg: 'Заглавие (BG)', titleEl: 'Заглавие (EL)',
      description: 'Описание (EN)', descriptionBg: 'Описание (BG)', descriptionEl: 'Описание (EL)',
      price: 'Цена', currency: 'Валута', category: 'Категория', catalogId: 'Facebook каталог ID',
      isPublished: 'Публикуван на сайта',
    },
    categories: {
      prefab: 'Сглобяема къща', wagon: 'Фургон', modular: 'Модулна къща', garage: 'Гараж',
    },
    images: 'Снимки',
    uploadHint: 'Плъзнете снимка тук или изберете файл. Автоматично се преобразува в WebP.',
    uploading: 'Качване…',
    deleteImage: 'Премахни',
    moveLeft: 'Наляво',
    moveRight: 'Надясно',
    confirmDelete: 'Да изтрия ли този модел? Действието е необратимо.',
    required: 'Задължително',
    saveError: 'Промяната не беше запазена.',
    noImages: 'Няма снимки.',
    cover: 'Корица',
  },
  en: {
    title: 'Gallery',
    subtitle: 'Models, prices and photos. Changes appear on the site as soon as you save.',
    add: 'New model',
    edit: 'Edit',
    remove: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    published: 'Published',
    draft: 'Draft',
    empty: 'No models yet.',
    fields: {
      title: 'Title (EN)', titleBg: 'Title (BG)', titleEl: 'Title (EL)',
      description: 'Description (EN)', descriptionBg: 'Description (BG)', descriptionEl: 'Description (EL)',
      price: 'Price', currency: 'Currency', category: 'Category', catalogId: 'Facebook catalogue ID',
      isPublished: 'Live on the site',
    },
    categories: {
      prefab: 'Prefab house', wagon: 'Wagon / site cabin', modular: 'Modular house', garage: 'Garage',
    },
    images: 'Photos',
    uploadHint: 'Drop a photo here or choose a file. Converted to WebP automatically.',
    uploading: 'Uploading…',
    deleteImage: 'Remove',
    moveLeft: 'Move left',
    moveRight: 'Move right',
    confirmDelete: 'Delete this model? This cannot be undone.',
    required: 'Required',
    saveError: 'That change was not saved.',
    noImages: 'No photos yet.',
    cover: 'Cover',
  },
}

const EMPTY = {
  title: '', titleBg: '', titleEl: '',
  description: '', descriptionBg: '', descriptionEl: '',
  price: '', currency: 'EUR', categoryKey: '', catalogId: '', isPublished: true,
}

export default function AdminGalleryPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang]

  const [state, setState] = React.useState('loading')
  const [houses, setHouses] = React.useState([])
  const [categories, setCategories] = React.useState([])
  const [me, setMe] = React.useState(null)
  const [editing, setEditing] = React.useState(null) // null | 'new' | house id
  const [form, setForm] = React.useState(EMPTY)
  const [errors, setErrors] = React.useState([])
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      const [list, cats, who] = await Promise.all([
        adminGet('/api/admin/gallery'),
        adminGet('/api/admin/gallery/categories'),
        adminGet('/api/admin/me').catch(() => null),
      ])
      setHouses(list ?? [])
      setCategories(cats ?? [])
      setMe(who)
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  function startNew() {
    setForm(EMPTY)
    setErrors([])
    setEditing('new')
  }

  function startEdit(house) {
    setForm({
      title: house.title ?? '',
      titleBg: house.titleBg ?? '',
      titleEl: house.titleEl ?? '',
      description: house.description ?? '',
      descriptionBg: house.descriptionBg ?? '',
      descriptionEl: house.descriptionEl ?? '',
      price: house.price ?? '',
      currency: house.currency ?? 'EUR',
      categoryKey: house.categoryKey ?? '',
      catalogId: house.catalogId ?? '',
      isPublished: house.isPublished,
    })
    setErrors([])
    setEditing(house.id)
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErrors([])

    const payload = {
      ...form,
      // An empty price field means "price on request", not zero.
      price: form.price === '' || form.price === null ? null : Number(form.price),
    }

    try {
      if (editing === 'new') await adminSend('/api/admin/gallery', 'POST', payload)
      else await adminSend(`/api/admin/gallery/${editing}`, 'PUT', payload)

      setEditing(null)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setErrors([err.message || t.saveError])
    } finally {
      setBusy(false)
    }
  }

  async function remove(house) {
    if (!window.confirm(t.confirmDelete)) return
    try {
      await adminDelete(`/api/admin/gallery/${house.id}`)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setErrors([err.message || t.saveError])
    }
  }

  const editingHouse = typeof editing === 'number' ? houses.find((h) => h.id === editing) : null

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="gallery"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
      me={me}
      actions={<button type="button" className="btn" onClick={startNew}>{t.add}</button>}
    >
      {errors.length > 0 ? <div className="adm-alert">{errors.join(' ')}</div> : null}

      {editing !== null ? (
        <HouseForm
          t={t}
          form={form}
          setForm={setForm}
          categories={categories}
          busy={busy}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {editingHouse ? (
        <ImageManager
          t={t}
          house={editingHouse}
          onChanged={load}
          onUnauthorized={() => setState('unauthorized')}
        />
      ) : null}

      {houses.length === 0 ? (
        <p className="adm-muted">{t.empty}</p>
      ) : (
        <ul className="adm-list">
          {houses.map((house) => (
            <li key={house.id} className="adm-card adm-row">
              <div className="adm-thumb">
                {house.images[0]
                  ? <img src={house.images[0].url} alt="" loading="lazy" />
                  : <span className="adm-thumb-empty" />}
              </div>
              <div className="adm-row-main">
                <strong>{house.title || '—'}</strong>
                <span className="adm-muted">
                  {t.categories[house.categoryKey] ?? house.categoryKey}
                  {house.price != null ? ` · ${house.price} ${house.currency}` : ''}
                  {` · ${house.images.length} 📷`}
                </span>
              </div>
              <span className={house.isPublished ? 'adm-badge is-live' : 'adm-badge'}>
                {house.isPublished ? t.published : t.draft}
              </span>
              <div className="adm-row-actions">
                <button type="button" className="btn btn-sm" onClick={() => startEdit(house)}>{t.edit}</button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(house)}>{t.remove}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  )
}

function HouseForm({ t, form, setForm, categories, busy, onSubmit, onCancel }) {
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <form className="adm-card adm-form" onSubmit={onSubmit}>
      <div className="adm-grid">
        <label>
          {t.fields.title} <span className="adm-req">{t.required}</span>
          <input value={form.title} onChange={set('title')} required />
        </label>
        <label>
          {t.fields.category} <span className="adm-req">{t.required}</span>
          {/* Options come from the API, not a local list: an unrecognised category makes a
              house vanish from every gallery filter with no error, so the two must not drift. */}
          <select value={form.categoryKey} onChange={set('categoryKey')} required>
            <option value="">—</option>
            {categories.map((key) => (
              <option key={key} value={key}>{t.categories[key] ?? key}</option>
            ))}
          </select>
        </label>

        <label>{t.fields.titleBg}<input value={form.titleBg} onChange={set('titleBg')} /></label>
        <label>{t.fields.titleEl}<input value={form.titleEl} onChange={set('titleEl')} /></label>

        <label>
          {t.fields.price}
          <input type="number" step="0.01" min="0" value={form.price} onChange={set('price')} />
        </label>
        <label>{t.fields.currency}<input value={form.currency} onChange={set('currency')} /></label>

        <label>{t.fields.catalogId}<input value={form.catalogId} onChange={set('catalogId')} /></label>
        <label className="adm-check">
          <input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} />
          {t.fields.isPublished}
        </label>
      </div>

      <label>{t.fields.description}<textarea rows={4} value={form.description} onChange={set('description')} /></label>
      <label>{t.fields.descriptionBg}<textarea rows={4} value={form.descriptionBg} onChange={set('descriptionBg')} /></label>
      <label>{t.fields.descriptionEl}<textarea rows={4} value={form.descriptionEl} onChange={set('descriptionEl')} /></label>

      <div className="adm-form-actions">
        <button type="submit" className="btn" disabled={busy}>{t.save}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t.cancel}</button>
      </div>
    </form>
  )
}

function ImageManager({ t, house, onChanged, onUnauthorized }) {
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState('')
  const inputRef = React.useRef(null)

  async function upload(files) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')
    try {
      // Sequential rather than parallel: each upload is re-encoded server-side, and a dozen
      // at once from a phone would just queue behind each other anyway while making the
      // failure harder to attribute.
      for (const file of Array.from(files)) {
        await adminUpload(`/api/admin/gallery/${house.id}/images`, file)
      }
      await onChanged()
    } catch (err) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return }
      setError(err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removeImage(imageId) {
    try {
      await adminDelete(`/api/admin/gallery/${house.id}/images/${imageId}`)
      await onChanged()
    } catch (err) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return }
      setError(err.message)
    }
  }

  async function move(index, delta) {
    const ids = house.images.map((i) => i.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return

    const next = [...ids]
    ;[next[index], next[target]] = [next[target], next[index]]

    try {
      await adminSend(`/api/admin/gallery/${house.id}/images/order`, 'POST', { imageIds: next })
      await onChanged()
    } catch (err) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return }
      setError(err.message)
    }
  }

  return (
    <section className="adm-card">
      <h2>{t.images}</h2>
      {error ? <div className="adm-alert">{error}</div> : null}

      <div
        className="adm-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files) }}
      >
        <p className="adm-muted">{t.uploadHint}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => upload(e.target.files)}
          disabled={uploading}
        />
        {uploading ? <p className="adm-muted">{t.uploading}</p> : null}
      </div>

      {house.images.length === 0 ? (
        <p className="adm-muted">{t.noImages}</p>
      ) : (
        <ul className="adm-images">
          {house.images.map((image, index) => (
            <li key={image.id}>
              <img src={image.url} alt={image.altText ?? ''} loading="lazy" />
              {/* The first image is what the gallery card shows, so it is worth labelling
                  rather than leaving the editor to infer it from position. */}
              {index === 0 ? <span className="adm-badge is-live">{t.cover}</span> : null}
              <div className="adm-img-actions">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t.moveLeft}>←</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === house.images.length - 1} aria-label={t.moveRight}>→</button>
                <button type="button" className="btn-danger" onClick={() => removeImage(image.id)}>{t.deleteImage}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
