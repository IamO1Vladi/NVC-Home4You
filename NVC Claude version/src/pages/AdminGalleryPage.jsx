import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import RichTextEditor from '../admin/RichTextEditor.jsx'
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
    saving: 'Запазване…',
    saved: 'Запазено',
    cancel: 'Откажи',
    sections: { basics: 'Основни данни', content: 'Съдържание по езици' },
    priceOnRequest: 'По запитване',
    publishedHint: 'Вижда се в галерията',
    draftHint: 'Скрит от посетителите',
    descPlaceholder: 'Опишете модела — размери, включено оборудване, срок за изработка…',
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
    // Creating a model and adding photos cannot be one step: the photo has to be attached to
    // a model that already exists. Saying so beats an empty space where the uploader will be.
    photosAfterSave: 'Снимките се добавят веднага след като запазите модела — ще останете на този екран.',
    savedAddPhotos: 'Моделът е запазен. Сега можете да добавите снимки.',
    discard: 'Има незапазени промени. Да ги отхвърля ли?',
    close: 'Затвори',
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
    saving: 'Saving…',
    saved: 'Saved',
    cancel: 'Cancel',
    sections: { basics: 'Basics', content: 'Content by language' },
    priceOnRequest: 'On request',
    publishedHint: 'Visible in the gallery',
    draftHint: 'Hidden from visitors',
    descPlaceholder: 'Describe the model — dimensions, what is included, lead time…',
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
    photosAfterSave: 'Photos can be added as soon as you save the model — you will stay on this screen.',
    savedAddPhotos: 'Model saved. You can add photos now.',
    discard: 'You have unsaved changes. Discard them?',
    close: 'Close',
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

// The Save button lives in the dialog's footer, outside the <form>, so it reaches the form
// by id rather than by being nested in it.
const FORM_ID = 'adm-house-form'

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
  const [editing, setEditing] = React.useState(null) // null | 'new' | house id
  const [form, setForm] = React.useState(EMPTY)
  const [errors, setErrors] = React.useState([])
  const [busy, setBusy] = React.useState(false)
  // Set when a brand-new model has just been saved, so the dialog can say why photos have
  // suddenly appeared instead of the form simply closing.
  const [justCreated, setJustCreated] = React.useState(false)
  // What the form looked like when it opened, to tell an accidental Escape from a real one.
  const pristine = React.useRef(EMPTY)

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      const [list, cats] = await Promise.all([
        adminGet('/api/admin/gallery'),
        adminGet('/api/admin/gallery/categories'),
      ])
      setHouses(list ?? [])
      setCategories(cats ?? [])
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  function startNew() {
    setForm(EMPTY)
    pristine.current = EMPTY
    setErrors([])
    setJustCreated(false)
    setEditing('new')
  }

  // Escape, the backdrop and the ✕ all land here rather than closing outright — losing a
  // half-written model to a stray key press is exactly the kind of thing this audience
  // will not mention and will quietly stop trusting the panel over.
  function requestClose() {
    const dirty = JSON.stringify(form) !== JSON.stringify(pristine.current)
    if (dirty && !window.confirm(t.discard)) return
    setEditing(null)
    setJustCreated(false)
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
    pristine.current = {
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
    }
    setErrors([])
    setJustCreated(false)
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
      const isNew = editing === 'new'
      const saved = isNew
        ? await adminSend('/api/admin/gallery', 'POST', payload)
        : await adminSend(`/api/admin/gallery/${editing}`, 'PUT', payload)

      pristine.current = form
      await load()

      // A photo has to attach to a model that already exists, so creating one cannot also
      // upload its pictures. Rather than close and make someone find the row they just made
      // and press Edit, the dialog stays open on the saved model — where the uploader now is.
      if (isNew && saved?.id != null) {
        setEditing(saved.id)
        setJustCreated(true)
      } else {
        setEditing(null)
      }
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
      actions={<button type="button" className="btn" onClick={startNew}>{t.add}</button>}
    >
      {/* Errors from deleting a row belong on the page; errors from the editor belong in
          the dialog, which is covering the page at the time. */}
      {errors.length > 0 && editing === null ? <div className="adm-alert">{errors.join(' ')}</div> : null}

      <AdminModal
        open={editing !== null}
        title={editing === 'new' ? t.add : t.edit}
        subtitle={form.titleBg || form.title || undefined}
        closeLabel={t.close}
        onClose={requestClose}
        footer={
          <div className="adm-form-actions">
            <button type="submit" form={FORM_ID} className="btn" disabled={busy}>
              {busy ? t.saving : t.save}
            </button>
            <button type="button" className="btn btn-ghost" onClick={requestClose}>{t.cancel}</button>
          </div>
        }
      >
        {errors.length > 0 ? <div className="adm-alert">{errors.join(' ')}</div> : null}
        {justCreated ? <div className="adm-note">{t.savedAddPhotos}</div> : null}

        <HouseForm
          formId={FORM_ID}
          t={t}
          lang={lang}
          form={form}
          setForm={setForm}
          categories={categories}
          onSubmit={save}
        />

        {editingHouse ? (
          <ImageManager
            t={t}
            house={editingHouse}
            onChanged={load}
            onUnauthorized={() => setState('unauthorized')}
          />
        ) : (
          <section className="adm-modal-section">
            <h3>{t.images}</h3>
            <p className="adm-hint">{t.photosAfterSave}</p>
          </section>
        )}
      </AdminModal>

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

function HouseForm({ formId, t, lang, form, setForm, categories, onSubmit }) {
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const setHtml = (key) => (html) => setForm((prev) => ({ ...prev, [key]: html }))

  // Three languages × title and description is a lot of boxes. Tabbing by language keeps one
  // language's fields together, which is how they are actually written and proofread.
  const [tab, setTab] = React.useState('bg')

  return (
    <form id={formId} className="adm-form" onSubmit={onSubmit}>
      <section className="adm-fieldset">
        <h3>{t.sections.basics}</h3>
        <div className="adm-grid">
          <label>
            <span className="adm-label">{t.fields.category} <em className="adm-req">{t.required}</em></span>
            {/* Options come from the API, not a local list: an unrecognised category makes a
                house vanish from every gallery filter with no error, so the two must not drift. */}
            <select value={form.categoryKey} onChange={set('categoryKey')} required>
              <option value="">—</option>
              {categories.map((key) => (
                <option key={key} value={key}>{t.categories[key] ?? key}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="adm-label">{t.fields.price}</span>
            <div className="adm-input-row">
              <input type="number" step="0.01" min="0" value={form.price} onChange={set('price')}
                     placeholder={t.priceOnRequest} />
              <input className="adm-currency" value={form.currency} onChange={set('currency')} aria-label={t.fields.currency} />
            </div>
          </label>

          <label>
            <span className="adm-label">{t.fields.catalogId}</span>
            <input value={form.catalogId} onChange={set('catalogId')} />
          </label>

          <label className="adm-switch">
            <input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} />
            <span>
              <strong>{t.fields.isPublished}</strong>
              <em>{form.isPublished ? t.publishedHint : t.draftHint}</em>
            </span>
          </label>
        </div>
      </section>

      <section className="adm-fieldset">
        <h3>{t.sections.content}</h3>

        <div className="adm-langtabs" role="tablist" aria-label={t.sections.content}>
          {['bg', 'en', 'el'].map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={tab === code}
              className={tab === code ? 'is-active' : ''}
              onClick={() => setTab(code)}
            >
              {code.toUpperCase()}
              {code === 'bg' && form.titleBg ? ' ✓' : null}
              {code === 'en' && form.title ? ' ✓' : null}
              {code === 'el' && form.titleEl ? ' ✓' : null}
            </button>
          ))}
        </div>

        {tab === 'bg' ? (
          <LangFields
            t={t} lang={lang}
            titleLabel={t.fields.titleBg} title={form.titleBg} onTitle={set('titleBg')}
            descLabel={t.fields.descriptionBg} desc={form.descriptionBg} onDesc={setHtml('descriptionBg')}
          />
        ) : null}

        {tab === 'en' ? (
          <LangFields
            t={t} lang={lang} required
            titleLabel={t.fields.title} title={form.title} onTitle={set('title')}
            descLabel={t.fields.description} desc={form.description} onDesc={setHtml('description')}
          />
        ) : null}

        {tab === 'el' ? (
          <LangFields
            t={t} lang={lang}
            titleLabel={t.fields.titleEl} title={form.titleEl} onTitle={set('titleEl')}
            descLabel={t.fields.descriptionEl} desc={form.descriptionEl} onDesc={setHtml('descriptionEl')}
          />
        ) : null}
      </section>

    </form>
  )
}

function LangFields({ t, lang, required, titleLabel, title, onTitle, descLabel, desc, onDesc }) {
  return (
    <div className="adm-langpane">
      <label>
        <span className="adm-label">{titleLabel} {required ? <em className="adm-req">{t.required}</em> : null}</span>
        <input value={title} onChange={onTitle} required={required} />
      </label>
      <div className="adm-field">
        <span className="adm-label">{descLabel}</span>
        <RichTextEditor value={desc} onChange={onDesc} lang={lang} placeholder={t.descPlaceholder} />
      </div>
    </div>
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
    <section className="adm-modal-section">
      <h3>{t.images}</h3>
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
