import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminUpload, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'

// The home page photos screen: five hero slides, the three model cards, and (since
// 2026-10-12, at the owner's request) the main photo of each product page — each a fixed
// slot the owner can fill or empty, and the hero slides also reorder. The slots are fixed
// rather than a free list for the same reason the brochures are (AdminDocumentsPage): the
// public page shows its default in every empty position — the photo the site shipped with,
// or for the steel page deliberately no photo at all — so this screen has to show where a
// photo BELONGS, and what the site shows while it is empty, not only what has been
// uploaded. The product pages live here rather than on a screen of their own because they
// are the same table, the same verbs and the same public read.
//
// A slot can be filled two ways: a new upload (re-encoded to WebP like every gallery
// image) or a picture already in the gallery, picked from a dialog. The second one copies
// the image key, not a reference, so deleting the gallery model later does not empty the
// hero. Every write re-reads the list rather than patching local state, which is what
// keeps the thumbnails honest about what the site is actually showing.

const HERO = ['hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5']
const MODELS = [
  { name: 'model-37', label: '37 m²' },
  { name: 'model-58', label: '58 m²' },
  { name: 'model-73', label: '73 m²' },
]
// In menu order. Their labels and their empty-slot defaults are words, so they live in TEXT.
const PAGES = ['page-modular-builds', 'page-modular-houses', 'page-steel-houses']

const TEXT = {
  bg: {
    title: 'Начална страница',
    subtitle: 'Снимките в началото на сайта, на трите модела и на продуктовите страници. Промяната се вижда на сайта веднага.',
    heroHeading: 'Снимки в началото',
    heroHint: 'Показват се една след друга в реда отляво надясно. Празно място показва снимката по подразбиране.',
    modelsHeading: 'Снимки на трите модела',
    modelsHint: 'Снимката на картата на модела в началната страница. Празно място показва снимката от каталога.',
    pagesHeading: 'Продуктови страници',
    pagesHint: 'Главната снимка на всяка продуктова страница. Под всяко място пише какво показва страницата, докато то е празно.',
    pages: {
      'page-modular-builds': { label: 'Контейнерни модули', empty: 'Празно: снимка на контейнер от галерията.' },
      'page-modular-houses': { label: 'Модулни къщи', empty: 'Празно: снимката на къщата в Паралия Кариани (58 м²) от „Казуси и отзиви“.' },
      'page-steel-houses': { label: 'Сглобяеми къщи по проект', empty: 'Празно: страницата е без снимка.', thumb: 'Без снимка' },
    },
    pageSaved: (label) => `Готово — снимката на „${label}“ е на сайта.`,
    pageCleared: (label) => `Снимката на „${label}“ е премахната — страницата се връща към вида по подразбиране.`,
    defaultThumb: 'По подразбиране',
    photo: (n) => `Снимка ${n}`,
    replace: 'Замени', fromGallery: 'От галерията', moveLeft: 'Наляво', moveRight: 'Надясно',
    clear: 'Изчисти', uploading: 'Качване…', working: 'Момент…',
    alt: 'Описание на снимката (по избор)',
    altHint: 'Чете се от екранните четци и се показва, ако снимката не се зареди. На трите продуктови страници се използва само в българския сайт; английският и гръцкият имат свое общо описание.',
    pickTitle: 'Избери снимка от галерията',
    pickSubtitle: 'Натиснете снимка, за да я сложите в избраното място.',
    pickFor: (label) => `За: ${label}`,
    close: 'Затвори',
    noGallery: 'В галерията няма снимки.',
    galleryError: 'Галерията не можа да се зареди.',
    uploadError: 'Снимката не беше качена.',
    saveError: 'Промяната не беше запазена.',
    saved: (label) => `Готово — „${label}“ е на сайта.`,
    cleared: (label) => `„${label}“ е изчистена — сайтът показва снимката по подразбиране.`,
    swapped: 'Редът е сменен.',
    altSaved: 'Описанието е запазено.',
    updatedBy: 'от',
  },
  en: {
    title: 'Home page',
    subtitle: 'The photos at the top of the site, on the three model cards and on the product pages. Changes show on the site immediately.',
    heroHeading: 'Photos at the top',
    heroHint: 'Shown one after another, left to right. An empty slot shows the default photo.',
    modelsHeading: 'Photos of the three models',
    modelsHint: 'The photo on the model card on the home page. An empty slot shows the catalogue photo.',
    pagesHeading: 'Product pages',
    pagesHint: 'The main photo of each product page. Under each slot: what the page shows while it is empty.',
    pages: {
      'page-modular-builds': { label: 'Container units', empty: 'Empty: a container photo from the gallery.' },
      'page-modular-houses': { label: 'Modular houses', empty: 'Empty: the Paralia Kariani house (58 m²) from Cases & Reviews.' },
      'page-steel-houses': { label: 'Steel-frame prefab houses to your plan', empty: 'Empty: the page has no photo.', thumb: 'No photo' },
    },
    pageSaved: (label) => `Done — the photo for “${label}” is live.`,
    pageCleared: (label) => `The photo for “${label}” is removed — the page is back to its default.`,
    defaultThumb: 'Default',
    photo: (n) => `Photo ${n}`,
    replace: 'Replace', fromGallery: 'From the gallery', moveLeft: 'Move left', moveRight: 'Move right',
    clear: 'Clear', uploading: 'Uploading…', working: 'One moment…',
    alt: 'Photo description (optional)',
    altHint: 'Read by screen readers and shown if the photo fails to load. On the three product pages it is used on the Bulgarian site only; the English and Greek sites use a general description of their own.',
    pickTitle: 'Pick a photo from the gallery',
    pickSubtitle: 'Press a photo to put it in the chosen slot.',
    pickFor: (label) => `For: ${label}`,
    close: 'Close',
    noGallery: 'The gallery has no photos.',
    galleryError: 'The gallery could not be loaded.',
    uploadError: 'The photo was not uploaded.',
    saveError: 'The change was not saved.',
    saved: (label) => `Done — “${label}” is live.`,
    cleared: (label) => `“${label}” is cleared — the site shows the default photo.`,
    swapped: 'The order has changed.',
    altSaved: 'The description is saved.',
    updatedBy: 'by',
  },
}

// The brochures' picker: a visually hidden input the button beside it operates, so the
// keyboard gets one stop per action and picking the same file twice still fires (the
// input clears itself before the handler runs). Images only, one at a time — a slot holds
// exactly one photo.
function ReplaceButton({ label, busyLabel, isBusy, disabled, name, onPick }) {
  const picker = React.useRef(null)
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        className="visually-hidden"
        aria-label={name}
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
      <button
        type="button"
        className="btn ghost adm-btn-sm"
        disabled={disabled}
        onClick={() => picker.current?.click()}
      >
        {isBusy ? busyLabel : label}
      </button>
    </>
  )
}

export default function AdminHomePhotosPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [slots, setSlots] = React.useState([])
  const [alts, setAlts] = React.useState({})
  const [state, setState] = React.useState('loading')
  const [busy, setBusy] = React.useState(null)       // the slot name of the running write
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  // The gallery dialog: which slot it is picking for, and the houses once fetched.
  const [pickFor, setPickFor] = React.useState(null)
  const [houses, setHouses] = React.useState(null)
  const [galleryError, setGalleryError] = React.useState('')

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      const data = await adminGet('/api/admin/home-photos')
      const list = Array.isArray(data?.slots) ? data.slots : []
      setSlots(list)
      setAlts(Object.fromEntries(list.map((s) => [s.name, s.alt ?? ''])))
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  const bySlot = React.useMemo(() => {
    const map = new Map()
    for (const s of slots) map.set(s.name, s)
    return map
  }, [slots])

  const labelOf = (name) => {
    const model = MODELS.find((m) => m.name === name)
    if (model) return model.label
    if (t.pages[name]) return t.pages[name].label
    return t.photo(HERO.indexOf(name) + 1)
  }

  // A page slot is named after its page, so "„Модулни къщи“ е на сайта" would announce the
  // page, not the photo; its notices say "the photo for …" instead.
  const savedNotice = (name) => (t.pages[name] ? t.pageSaved(labelOf(name)) : t.saved(labelOf(name)))
  const clearedNotice = (name) => (t.pages[name] ? t.pageCleared(labelOf(name)) : t.cleared(labelOf(name)))

  // Every write goes through here: one busy key, the server's sentence on refusal, a
  // re-read on success, and an expired session turned into the sign-in card.
  async function write(name, action, successNotice) {
    setBusy(name)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(successNotice)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(null)
    }
  }

  function replace(name, file) {
    if (!file) return
    write(name, () => adminUpload(`/api/admin/home-photos/${name}/file`, file), savedNotice(name))
  }

  function clear(name) {
    write(name, () => adminDelete(`/api/admin/home-photos/${name}`), clearedNotice(name))
  }

  function swap(name, delta) {
    const index = HERO.indexOf(name)
    const other = HERO[index + delta]
    if (!other) return
    write(name, () => adminSend('/api/admin/home-photos/swap', 'POST', { a: name, b: other }), t.swapped)
  }

  function saveAlt(name) {
    const current = bySlot.get(name)?.alt ?? ''
    const next = (alts[name] ?? '').trim()
    if (next === current) return
    write(name, () => adminSend(`/api/admin/home-photos/${name}/alt`, 'POST', { alt: next }), t.altSaved)
  }

  async function openGallery(name) {
    setPickFor(name)
    setGalleryError('')
    if (houses !== null) return
    try {
      const list = await adminGet('/api/admin/gallery')
      setHouses(Array.isArray(list) ? list : [])
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setGalleryError(err?.message || t.galleryError)
    }
  }

  function pick(imageKey) {
    const name = pickFor
    setPickFor(null)
    if (!name) return
    write(name, () => adminSend(`/api/admin/home-photos/${name}/pick`, 'POST', { imageKey }), savedNotice(name))
  }

  // `empty` says what the site shows while the slot is empty, for the slots where the
  // section's hint cannot say it once for all of them; `thumb` replaces "Default" in the
  // empty box where the default is no photo at all.
  const renderSlot = (name, label, { index = null, total = 0, empty = null, thumb = null } = {}) => {
    const slot = bySlot.get(name)
    const isBusy = busy === name
    const altId = `adm-hp-alt-${name}`
    return (
      <li key={name} className="adm-card adm-hp-slot">
        <div className="adm-hp-slot-head">
          <strong>{label}</strong>
          {slot?.url && slot?.updatedByUpn ? (
            <span className="adm-small adm-muted adm-hp-by">{t.updatedBy} {slot.updatedByUpn}</span>
          ) : null}
        </div>

        {slot?.url ? (
          <img className="adm-hp-img" src={slot.url} alt={slot.alt || ''} loading="lazy" />
        ) : (
          <div className="adm-hp-empty"><span>{thumb || t.defaultThumb}</span></div>
        )}
        {empty ? <span className="adm-small adm-muted">{empty}</span> : null}

        <div className="adm-hp-actions">
          <ReplaceButton
            label={t.replace}
            busyLabel={t.uploading}
            isBusy={isBusy}
            disabled={busy !== null}
            name={`${t.replace} — ${label}`}
            onPick={(file) => replace(name, file)}
          />
          <button
            type="button"
            className="btn ghost adm-btn-sm"
            disabled={busy !== null}
            onClick={() => openGallery(name)}
          >
            {t.fromGallery}
          </button>
          {index !== null ? (
            <>
              <button
                type="button"
                className="btn ghost adm-btn-sm adm-hp-arrow"
                aria-label={`${t.moveLeft} — ${label}`}
                title={t.moveLeft}
                disabled={busy !== null || index === 0}
                onClick={() => swap(name, -1)}
              >
                ←
              </button>
              <button
                type="button"
                className="btn ghost adm-btn-sm adm-hp-arrow"
                aria-label={`${t.moveRight} — ${label}`}
                title={t.moveRight}
                disabled={busy !== null || index === total - 1}
                onClick={() => swap(name, 1)}
              >
                →
              </button>
            </>
          ) : null}
          {slot?.url ? (
            <button
              type="button"
              className="btn btn-danger adm-btn-sm"
              aria-label={`${t.clear} — ${label}`}
              disabled={busy !== null}
              onClick={() => clear(name)}
            >
              {t.clear}
            </button>
          ) : null}
        </div>

        {slot?.url ? (
          <div className="adm-hp-alt">
            <label htmlFor={altId} className="adm-small">{t.alt}</label>
            <input
              id={altId}
              type="text"
              maxLength={400}
              value={alts[name] ?? ''}
              disabled={busy !== null}
              onChange={(e) => setAlts((prev) => ({ ...prev, [name]: e.target.value }))}
              onBlur={() => saveAlt(name)}
              aria-describedby={`${altId}-hint`}
            />
            <span id={`${altId}-hint`} className="adm-small adm-muted">{t.altHint}</span>
          </div>
        ) : null}
      </li>
    )
  }

  const pickLabel = pickFor ? labelOf(pickFor) : ''
  const houseTitle = (h) => (lang === 'bg' ? h.titleBg || h.title : h.title || h.titleBg) || `#${h.id}`

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="homePhotos"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
    >
      {error ? <div className="adm-alert" role="alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      <section className="adm-hp-section">
        <h2>{t.heroHeading}</h2>
        <p className="adm-small adm-muted">{t.heroHint}</p>
        <ul className="adm-hp-row adm-hp-row-hero">
          {HERO.map((name, index) => renderSlot(name, labelOf(name), { index, total: HERO.length }))}
        </ul>
      </section>

      <section className="adm-hp-section">
        <h2>{t.modelsHeading}</h2>
        <p className="adm-small adm-muted">{t.modelsHint}</p>
        <ul className="adm-hp-row adm-hp-row-models">
          {MODELS.map((m) => renderSlot(m.name, m.label))}
        </ul>
      </section>

      <section className="adm-hp-section">
        <h2>{t.pagesHeading}</h2>
        <p className="adm-small adm-muted">{t.pagesHint}</p>
        <ul className="adm-hp-row adm-hp-row-models">
          {PAGES.map((name) => renderSlot(name, labelOf(name), { empty: t.pages[name].empty, thumb: t.pages[name].thumb }))}
        </ul>
      </section>

      <AdminModal
        open={pickFor !== null}
        title={t.pickTitle}
        subtitle={`${t.pickSubtitle} ${t.pickFor(pickLabel)}`}
        onClose={() => setPickFor(null)}
        closeLabel={t.close}
      >
        {galleryError ? <div className="adm-alert" role="alert">{galleryError}</div> : null}
        {houses === null && !galleryError ? (
          <p className="adm-muted">{t.working}</p>
        ) : null}
        {houses !== null && houses.every((h) => !(h.images?.length > 0)) ? (
          <p className="adm-muted">{t.noGallery}</p>
        ) : null}
        {(houses ?? []).filter((h) => h.images?.length > 0).map((h) => (
          <section key={h.id} className="adm-hp-house">
            <h3>{houseTitle(h)}</h3>
            <ul className="adm-hp-pick-grid">
              {h.images.map((image, i) => (
                <li key={image.id ?? image.imageKey}>
                  <button
                    type="button"
                    className="adm-hp-pick"
                    aria-label={`${houseTitle(h)} — ${i + 1}`}
                    onClick={() => pick(image.imageKey)}
                  >
                    <img src={image.url} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </AdminModal>
    </AdminShell>
  )
}
