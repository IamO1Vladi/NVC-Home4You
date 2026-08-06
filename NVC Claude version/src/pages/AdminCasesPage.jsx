import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, adminSend, adminDelete, adminUpload, UnauthorizedError } from '../admin/adminApi.js'

// Case study management. Mirrors the gallery page, with the extra pieces cases have: a
// company logo and a cover image alongside the photo carousel, and the derived labels the
// public page builds from country/city and buyer/company.

const TEXT = {
  bg: {
    title: 'Проекти',
    subtitle: 'Реализирани проекти, снимки и отзиви на клиенти.',
    add: 'Нов проект',
    edit: 'Редактирай',
    remove: 'Изтрий',
    save: 'Запази',
    cancel: 'Откажи',
    published: 'Публикуван',
    draft: 'Чернова',
    featured: 'Акцент',
    empty: 'Няма добавени проекти.',
    fields: {
      companyName: 'Фирма', companySector: 'Сектор',
      buyerName: 'Клиент', buyerRole: 'Длъжност',
      country: 'Държава', city: 'Град', category: 'Категория',
      productName: 'Продукт', productVariant: 'Вариант',
      unitsQty: 'Брой', year: 'Година', deliveredAt: 'Дата на доставка',
      scope: 'Обхват', result: 'Резултат', quote: 'Цитат', rating: 'Оценка',
      isPublished: 'Публикуван на сайта', featured: 'Показвай като акцент',
    },
    preview: 'Как ще се покаже',
    previewLocation: 'Локация', previewBuyer: 'Клиент', previewProduct: 'Продукт',
    images: 'Снимки', logo: 'Лого на фирмата', cover: 'Основна снимка',
    uploadHint: 'Плъзнете снимка или изберете файл. Автоматично се преобразува в WebP.',
    uploading: 'Качване…', deleteImage: 'Премахни', clear: 'Изчисти',
    moveLeft: 'Наляво', moveRight: 'Надясно',
    confirmDelete: 'Да изтрия ли този проект? Действието е необратимо.',
    required: 'Задължително', saveError: 'Промяната не беше запазена.', noImages: 'Няма снимки.',
    attributionHint: 'Попълнете фирма или клиент.',
  },
  en: {
    title: 'Cases',
    subtitle: 'Delivered projects, photos and customer quotes.',
    add: 'New case',
    edit: 'Edit',
    remove: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    published: 'Published',
    draft: 'Draft',
    featured: 'Featured',
    empty: 'No cases yet.',
    fields: {
      companyName: 'Company', companySector: 'Sector',
      buyerName: 'Buyer', buyerRole: 'Role',
      country: 'Country', city: 'City', category: 'Category',
      productName: 'Product', productVariant: 'Variant',
      unitsQty: 'Units', year: 'Year', deliveredAt: 'Delivered at',
      scope: 'Scope', result: 'Result', quote: 'Quote', rating: 'Rating',
      isPublished: 'Live on the site', featured: 'Show as featured',
    },
    preview: 'How this will appear',
    previewLocation: 'Location', previewBuyer: 'Attributed to', previewProduct: 'Product',
    images: 'Photos', logo: 'Company logo', cover: 'Cover image',
    uploadHint: 'Drop a photo or choose a file. Converted to WebP automatically.',
    uploading: 'Uploading…', deleteImage: 'Remove', clear: 'Clear',
    moveLeft: 'Move left', moveRight: 'Move right',
    confirmDelete: 'Delete this case? This cannot be undone.',
    required: 'Required', saveError: 'That change was not saved.', noImages: 'No photos yet.',
    attributionHint: 'Fill in a company or a buyer.',
  },
}

const EMPTY = {
  companyName: '', companySector: '', buyerName: '', buyerRole: '',
  country: '', city: '', categoryKey: '',
  productName: '', productVariant: '', unitsQty: '', year: '', deliveredAt: '',
  scope: '', result: '', publicQuote: '', ratingSnapshot: '',
  isPublished: true, featured: false,
}

export default function AdminCasesPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang]

  const [state, setState] = React.useState('loading')
  const [cases, setCases] = React.useState([])
  const [categories, setCategories] = React.useState([])
  const [editing, setEditing] = React.useState(null)
  const [form, setForm] = React.useState(EMPTY)
  const [errors, setErrors] = React.useState([])
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      const [list, cats] = await Promise.all([
        adminGet('/api/admin/cases'),
        adminGet('/api/admin/cases/categories'),
      ])
      setCases(list ?? [])
      setCategories(cats ?? [])
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  function startEdit(item) {
    setForm({
      companyName: item.companyName ?? '',
      companySector: item.companySector ?? '',
      buyerName: item.buyerName ?? '',
      buyerRole: item.buyerRole ?? '',
      country: item.country ?? '',
      city: item.city ?? '',
      categoryKey: item.categoryKey ?? '',
      productName: item.productName ?? '',
      productVariant: item.productVariant ?? '',
      unitsQty: item.unitsQty ?? '',
      year: item.year ?? '',
      // <input type="date"> needs a bare yyyy-mm-dd, not a full offset timestamp.
      deliveredAt: item.deliveredAt ? String(item.deliveredAt).slice(0, 10) : '',
      scope: item.scope ?? '',
      result: item.result ?? '',
      publicQuote: item.publicQuote ?? '',
      ratingSnapshot: item.ratingSnapshot ?? '',
      isPublished: item.isPublished,
      featured: item.featured,
    })
    setErrors([])
    setEditing(item.id)
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErrors([])

    const payload = {
      ...form,
      unitsQty: form.unitsQty === '' ? null : Number(form.unitsQty),
      year: form.year === '' ? null : Number(form.year),
      ratingSnapshot: form.ratingSnapshot === '' ? null : Number(form.ratingSnapshot),
      deliveredAt: form.deliveredAt === '' ? null : form.deliveredAt,
    }

    try {
      if (editing === 'new') await adminSend('/api/admin/cases', 'POST', payload)
      else await adminSend(`/api/admin/cases/${editing}`, 'PUT', payload)

      setEditing(null)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setErrors([err.message || t.saveError])
    } finally {
      setBusy(false)
    }
  }

  async function remove(item) {
    if (!window.confirm(t.confirmDelete)) return
    try {
      await adminDelete(`/api/admin/cases/${item.id}`)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setErrors([err.message || t.saveError])
    }
  }

  const editingCase = typeof editing === 'number' ? cases.find((c) => c.id === editing) : null

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="cases"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
      actions={
        <button type="button" className="btn" onClick={() => { setForm(EMPTY); setErrors([]); setEditing('new') }}>
          {t.add}
        </button>
      }
    >
      {errors.length > 0 ? <div className="adm-alert">{errors.join(' ')}</div> : null}

      {editing !== null ? (
        <CaseForm
          t={t}
          form={form}
          setForm={setForm}
          categories={categories}
          busy={busy}
          preview={editingCase}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {editingCase ? (
        <CaseImages t={t} item={editingCase} onChanged={load} onUnauthorized={() => setState('unauthorized')} />
      ) : null}

      {cases.length === 0 ? (
        <p className="adm-muted">{t.empty}</p>
      ) : (
        <ul className="adm-list">
          {cases.map((item) => (
            <li key={item.id} className="adm-card adm-row">
              <div className="adm-thumb">
                {item.coverImageUrl || item.images[0]
                  ? <img src={item.coverImageUrl || item.images[0].url} alt="" loading="lazy" />
                  : <span className="adm-thumb-empty" />}
              </div>
              <div className="adm-row-main">
                <strong>{item.companyName || item.buyerName || '—'}</strong>
                <span className="adm-muted">
                  {[item.categoryKey, item.previewLocation, item.previewProduct].filter(Boolean).join(' · ')}
                  {` · ${item.images.length} 📷`}
                </span>
              </div>
              {item.featured ? <span className="adm-badge">{t.featured}</span> : null}
              <span className={item.isPublished ? 'adm-badge is-live' : 'adm-badge'}>
                {item.isPublished ? t.published : t.draft}
              </span>
              <div className="adm-row-actions">
                <button type="button" className="btn btn-sm" onClick={() => startEdit(item)}>{t.edit}</button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(item)}>{t.remove}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  )
}

function CaseForm({ t, form, setForm, categories, busy, preview, onSubmit, onCancel }) {
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const needsAttribution = !form.companyName.trim() && !form.buyerName.trim()

  return (
    <form className="adm-card adm-form" onSubmit={onSubmit}>
      <div className="adm-grid">
        <label>
          {t.fields.companyName}
          <input value={form.companyName} onChange={set('companyName')} />
        </label>
        <label>
          {t.fields.buyerName}
          <input value={form.buyerName} onChange={set('buyerName')} />
        </label>
        <label>{t.fields.companySector}<input value={form.companySector} onChange={set('companySector')} /></label>
        <label>{t.fields.buyerRole}<input value={form.buyerRole} onChange={set('buyerRole')} /></label>

        <label>{t.fields.country}<input value={form.country} onChange={set('country')} /></label>
        <label>{t.fields.city}<input value={form.city} onChange={set('city')} /></label>

        <label>
          {t.fields.category}
          <select value={form.categoryKey} onChange={set('categoryKey')}>
            <option value="">—</option>
            {categories.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
        <label>{t.fields.productName}<input value={form.productName} onChange={set('productName')} /></label>
        <label>{t.fields.productVariant}<input value={form.productVariant} onChange={set('productVariant')} /></label>

        <label>{t.fields.unitsQty}<input type="number" min="0" value={form.unitsQty} onChange={set('unitsQty')} /></label>
        <label>{t.fields.year}<input type="number" min="1900" max="2200" value={form.year} onChange={set('year')} /></label>
        <label>{t.fields.deliveredAt}<input type="date" value={form.deliveredAt} onChange={set('deliveredAt')} /></label>
        <label>
          {t.fields.rating}
          <input type="number" min="0" max="5" step="0.1" value={form.ratingSnapshot} onChange={set('ratingSnapshot')} />
        </label>

        <label className="adm-check">
          <input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} />
          {t.fields.isPublished}
        </label>
        <label className="adm-check">
          <input type="checkbox" checked={form.featured} onChange={set('featured')} />
          {t.fields.featured}
        </label>
      </div>

      {needsAttribution ? <div className="adm-alert">{t.attributionHint}</div> : null}

      <label>{t.fields.scope}<textarea rows={3} value={form.scope} onChange={set('scope')} /></label>
      <label>{t.fields.result}<textarea rows={3} value={form.result} onChange={set('result')} /></label>
      <label>{t.fields.quote}<textarea rows={3} value={form.publicQuote} onChange={set('publicQuote')} /></label>

      {/* The derived labels, shown read-only. They are computed rather than stored, so this
          is the only way an editor can see what the page will actually render. */}
      {preview ? (
        <div className="adm-preview">
          <strong>{t.preview}</strong>
          <span>{t.previewLocation}: {preview.previewLocation || '—'}</span>
          <span>{t.previewBuyer}: {preview.previewBuyerLabel || '—'}</span>
          <span>{t.previewProduct}: {preview.previewProduct || '—'}</span>
        </div>
      ) : null}

      <div className="adm-form-actions">
        <button type="submit" className="btn" disabled={busy || needsAttribution}>{t.save}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t.cancel}</button>
      </div>
    </form>
  )
}

function CaseImages({ t, item, onChanged, onUnauthorized }) {
  const [uploading, setUploading] = React.useState('')
  const [error, setError] = React.useState('')

  async function upload(files, slot) {
    if (!files || files.length === 0) return
    setUploading(slot)
    setError('')
    try {
      for (const file of Array.from(files)) {
        await adminUpload(`/api/admin/cases/${item.id}/images`, file, { slot })
        // Logo and cover are single slots: a second file would just overwrite the first.
        if (slot !== 'gallery') break
      }
      await onChanged()
    } catch (err) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return }
      setError(err.message)
    } finally {
      setUploading('')
    }
  }

  async function clearSlot(slot) {
    try {
      await adminDelete(`/api/admin/cases/${item.id}/images/slot/${slot}`)
      await onChanged()
    } catch (err) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return }
      setError(err.message)
    }
  }

  async function removeImage(imageId) {
    try {
      await adminDelete(`/api/admin/cases/${item.id}/images/${imageId}`)
      await onChanged()
    } catch (err) {
      if (err instanceof UnauthorizedError) { onUnauthorized(); return }
      setError(err.message)
    }
  }

  async function move(index, delta) {
    const ids = item.images.map((i) => i.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return

    const next = [...ids]
    ;[next[index], next[target]] = [next[target], next[index]]

    try {
      await adminSend(`/api/admin/cases/${item.id}/images/order`, 'POST', { imageIds: next })
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

      <div className="adm-slots">
        <Slot t={t} label={t.logo} url={item.companyLogoUrl} busy={uploading === 'logo'}
              onPick={(files) => upload(files, 'logo')} onClear={() => clearSlot('logo')} />
        <Slot t={t} label={t.cover} url={item.coverImageUrl} busy={uploading === 'cover'}
              onPick={(files) => upload(files, 'cover')} onClear={() => clearSlot('cover')} />
      </div>

      <div
        className="adm-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files, 'gallery') }}
      >
        <p className="adm-muted">{t.uploadHint}</p>
        <input type="file" accept="image/*" multiple
               onChange={(e) => upload(e.target.files, 'gallery')} disabled={uploading === 'gallery'} />
        {uploading === 'gallery' ? <p className="adm-muted">{t.uploading}</p> : null}
      </div>

      {item.images.length === 0 ? (
        <p className="adm-muted">{t.noImages}</p>
      ) : (
        <ul className="adm-images">
          {item.images.map((image, index) => (
            <li key={image.id}>
              <img src={image.url} alt={image.altText ?? ''} loading="lazy" />
              <div className="adm-img-actions">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t.moveLeft}>←</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === item.images.length - 1} aria-label={t.moveRight}>→</button>
                <button type="button" className="btn-danger" onClick={() => removeImage(image.id)}>{t.deleteImage}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Slot({ t, label, url, busy, onPick, onClear }) {
  return (
    <div className="adm-slot">
      <strong>{label}</strong>
      {url ? <img src={url} alt="" loading="lazy" /> : <span className="adm-thumb-empty" />}
      <input type="file" accept="image/*" onChange={(e) => onPick(e.target.files)} disabled={busy} />
      {url ? <button type="button" className="btn btn-sm" onClick={onClear}>{t.clear}</button> : null}
      {busy ? <p className="adm-muted">{t.uploading}</p> : null}
    </div>
  )
}
