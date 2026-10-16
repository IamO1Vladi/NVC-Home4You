import React from 'react'
import { Link } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminUpload, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'
import { cdnImage } from '../lib/img.js'
import { slotPair } from '../lib/homePhotos.js'
import { HERO_KIND, INTERIORS_PAIR_SLOTS, MODEL_KIND, PHOTO_SLOTS, PHOTO_SLOT_GROUPS, pairPartnerOf, photoSlotOf } from '../lib/photoSlotNames.js'
import {
  PANEL_ORDER,
  PHOTO_SLOT_GROUP_HEADINGS,
  PHOTO_SLOT_GROUP_NOTES,
  PHOTO_SLOT_PANEL,
  PHOTO_SLOT_ROW_HEADINGS,
  fitWarning,
  photoSlotRowOf,
} from '../lib/photoSlotDefaults.js'

// "Снимки на сайта" (/admin/home-photos): every place on the public site whose photo the owner
// can change without a developer, grouped by the page it is on. It began (2026-10-11) as the
// home page's five hero slides and three model cards, took the product pages' main photos the
// next day and the delivery and partner pages' on 2026-10-15; on 2026-10-16 the owner asked to
// change "most photos" from here, and About (main photo, team, factory floor), Interiors, the
// internal doors and the home page's four tiles followed — twenty-nine slots. On 2026-10-17
// ("add the images for the other pages as well") the Partner page's steps, the Interiors
// before/after pairs and the steel page's five stages did — forty-one in all. The list of
// slots, their order and their groups are photoSlotNames.js; what the panel says about each
// one and what the site shows while it is empty are photoSlotDefaults.js.
//
// Each page's section opens with one line saying where the page's OTHER photos are changed
// (the gallery's in "Галерия", the delivered house's in "Проекти", with a link), or that they
// are not changed from the admin. A before/after pair is one row of its own, its two halves
// side by side, with the rule the page keeps (a pair changes only when BOTH are uploaded) and
// what the site shows now; a half uploaded alone says so on its card and in its notice.
//
// The slots are fixed rather than a free list for the same reason the brochures are
// (AdminDocumentsPage): the public page shows its default in every empty position — the photo
// the site shipped with, a team member's initials, or for the steel page deliberately no photo
// at all — so this screen has to show where a photo BELONGS, and what the site shows while it
// is empty, not only what has been uploaded. So every card shows either the owner's photo or
// the default, marked "По подразбиране".
//
// A slot can be filled two ways: a new upload (re-encoded to WebP like every gallery image) or
// a picture already in the gallery, picked from a dialog. The second one copies the image key,
// not a reference, so deleting the gallery model later does not empty the place. Every write
// re-reads the list rather than patching local state, which is what keeps the thumbnails honest
// about what the site is actually showing — quietly, without emptying the screen, so the owner
// stays where he was on a long page. A write's result (or refusal) shows on the card it was for,
// not at the top of the page he may be far below. The public read is cached for two minutes
// (HomePhotosController), so the panel promises "до 2 минути", never "веднага".

// The API's own refusal (ImageProcessor.HeifRefusal, same words), said here before the upload
// is even tried: the server cannot decode HEIC, and a PC's file picker lets one through.
const HEIF_BG = 'Снимката е във формат HEIC/HEIF (така iPhone пази снимките) и сайтът не може да я прочете. Запазете я като JPEG, PNG или WebP и я качете отново. Или я качете направо от телефона — тогава iPhone сам я превръща в JPEG.'
const HEIF_EN = 'The photo is in HEIC/HEIF format (how an iPhone keeps its photos) and the site cannot read it. Save it as JPEG, PNG or WebP and upload it again. Or upload it straight from the phone — the iPhone then turns it into a JPEG itself.'

// The API's limit (AdminHomePhotosController, 25 MB), checked here first: a bigger file would
// travel for nothing and come back as a bare status code (413, or IIS's 404.13 above ~28.6 MB).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

// The API's sentences the owner can actually meet from this screen, in the panel's language.
// Anything else is shown as the server said it.
const SERVER_BG = {
  'That file is too large (max 25 MB).': 'Снимката е над 25 MB. Намалете я — например като я изпратите на себе си по Viber, който я смалява — и я качете отново.',
  'That file could not be read as an image.': 'Файлът не можа да се прочете като снимка. Качете JPEG, PNG или WebP.',
  'No file was uploaded.': 'Не стигна файл до сървъра. Опитайте пак.',
  'Image storage is not configured.': 'Сървърът няма настроено място за снимките, затова нищо не е запазено. Това е за разработчика.',
  'That image is not in the gallery.': 'Тази снимка вече не е в галерията. Изберете друга.',
}

const TEXT = {
  bg: {
    title: 'Снимки на сайта',
    subtitle: 'Снимките по страниците на сайта, които можете да смените оттук. Празно място показва вида си по подразбиране (отбелязан „По подразбиране“). Промените се виждат на сайта до 2 минути.',
    formats: 'Качвайте JPEG, PNG или WebP. Снимка, качена направо от телефона, става; под всяко място пише каква снимка му отива.',
    jump: 'Страници',
    heroHeading: 'Снимки в началото',
    heroHint: 'Показват се една след друга, отляво надясно. Всяко място води към своята страница, каквато и снимка да е в него; стрелките разменят само снимките.',
    modelsHeading: 'Снимки на трите модела',
    modelsHint: 'Снимката на картата на модела в цените. Празно място показва снимката от каталога.',
    tilesHeading: 'Плочки „Какво правим“',
    tilesHint: 'Четирите плочки под цените, всяка води към своята страница.',
    steelStepsHint: 'Картините под петте стъпки. Където няма ваша снимка, стои визуализация на една примерна къща; качвайте само снимки от ваши истински проекти, по една за етап.',
    partnerStepsHint: 'Подписът под всяка снимка назовава мястото, затова снимката трябва да е оттам.',
    partnerStepTwo: 'Стъпка 2 показва снимката на фабриката от „За нас“ и се сменя там:',
    pairHint: 'Показва се, когато и двете снимки са качени. Дотогава страницата показва двете снимки по подразбиране.',
    pairNone: 'Сега на сайта: двете снимки по подразбиране.',
    pairOne: (have, missing) => `Качена е само „${have}“ — на сайта още са двете снимки по подразбиране. Качете и „${missing}“.`,
    pairBoth: 'Сега на сайта: вашите две снимки.',
    pairWaiting: (missing) => `Още не е на сайта: чака „${missing}“.`,
    otherHeading: 'Други',
    otherHint: 'Места, които сървърът познава, а този екран още не.',
    offline: 'Сървърът още не познава това място. Ще може да се сменя след следващото обновяване на сайта.',
    defaultThumb: 'По подразбиране',
    noPhoto: 'Без снимка',
    upload: 'Качи снимка', fromGallery: 'От галерията', moveLeft: 'Наляво', moveRight: 'Надясно',
    reset: 'Върни снимката по подразбиране', remove: 'Премахни снимката',
    uploading: 'Качване…', working: 'Момент…',
    alt: 'Описание на снимката (по избор)',
    altHint: 'Чете се от екранните четци и се показва, ако снимката не се зареди. Използва се само в българския сайт; английският и гръцкият имат свое общо описание.',
    pickTitle: 'Избери снимка от галерията',
    pickSubtitle: 'Натиснете снимка, за да я сложите в избраното място.',
    pickFor: (label) => `За: ${label}`,
    close: 'Затвори',
    noGallery: 'В галерията няма снимки.',
    galleryError: 'Галерията не можа да се зареди.',
    saveError: 'Промяната не беше запазена.',
    network: 'Няма връзка със сървъра — промяната не е запазена. Проверете интернета и опитайте пак.',
    reloadError: 'Промяната е запазена, но списъкът не се обнови. Презаредете страницата.',
    tooLarge: (mb) => `${mb ? `Снимката е ${mb} MB, а най-много може 25 MB.` : 'Снимката е над 25 MB.'} Намалете я — например като я изпратите на себе си по Viber, който я смалява — и я качете отново.`,
    heif: HEIF_BG,
    saved: (label) => `Готово — снимката за „${label}“ е запазена. На сайта се вижда до 2 минути.`,
    savedPairWaiting: (label, missing) => `Готово — снимката за „${label}“ е запазена. На сайта ще се покаже, когато качите и „${missing}“.`,
    cleared: (label) => `Снимката за „${label}“ е махната. До 2 минути мястото на сайта се връща към вида си по подразбиране.`,
    clearedPairLive: (label) => `Снимката за „${label}“ е махната. До 2 минути и двете снимки на двойката на сайта се връщат към тези по подразбиране.`,
    clearedPairIdle: (label) => `Снимката за „${label}“ е махната. На сайта нищо не се променя: там и досега бяха снимките по подразбиране.`,
    swapped: 'Редът е сменен. На сайта се вижда до 2 минути.',
    altSaved: 'Описанието е запазено.',
    updatedBy: 'от',
  },
  en: {
    title: 'Site photos',
    subtitle: 'The photos on the site’s pages that you can change here. An empty place shows its default (marked “Default”). Changes show on the site within 2 minutes.',
    formats: 'Upload JPEG, PNG or WebP. A photo uploaded straight from the phone is fine; each place says what kind of photo suits it.',
    jump: 'Pages',
    heroHeading: 'Photos at the top',
    heroHint: 'Shown one after another, left to right. Each place links to its own page whatever photo is in it; the arrows move only the photos.',
    modelsHeading: 'Photos of the three models',
    modelsHint: 'The photo on the model card in the prices. An empty place shows the catalogue photo.',
    tilesHeading: '“What we do” tiles',
    tilesHint: 'The four tiles under the prices, each linking to its page.',
    steelStepsHint: 'The pictures under the five steps. Where there is no photo of yours, a render of one example house shows; upload only photos of real projects of yours, one per stage.',
    partnerStepsHint: 'The caption under each photo names the place, so the photo has to be from there.',
    partnerStepTwo: 'Step 2 shows the factory photo from “About us” and is changed there:',
    pairHint: 'Shown once both photos are uploaded. Until then the page shows both default photos.',
    pairNone: 'On the site now: both default photos.',
    pairOne: (have, missing) => `Only “${have}” is uploaded — the site still shows both default photos. Upload “${missing}” too.`,
    pairBoth: 'On the site now: your two photos.',
    pairWaiting: (missing) => `Not on the site yet: waiting for “${missing}”.`,
    otherHeading: 'Other',
    otherHint: 'Places the server knows and this screen does not yet.',
    offline: 'The server does not know this place yet. It can be changed after the next site update.',
    defaultThumb: 'Default',
    noPhoto: 'No photo',
    upload: 'Upload a photo', fromGallery: 'From the gallery', moveLeft: 'Move left', moveRight: 'Move right',
    reset: 'Back to the default photo', remove: 'Remove the photo',
    uploading: 'Uploading…', working: 'One moment…',
    alt: 'Photo description (optional)',
    altHint: 'Read by screen readers and shown if the photo fails to load. Used on the Bulgarian site only; the English and Greek sites use a general description of their own.',
    pickTitle: 'Pick a photo from the gallery',
    pickSubtitle: 'Press a photo to put it in the chosen place.',
    pickFor: (label) => `For: ${label}`,
    close: 'Close',
    noGallery: 'The gallery has no photos.',
    galleryError: 'The gallery could not be loaded.',
    saveError: 'The change was not saved.',
    network: 'No connection to the server — the change is not saved. Check the internet and try again.',
    reloadError: 'The change is saved, but the list did not refresh. Reload the page.',
    tooLarge: (mb) => `${mb ? `The photo is ${mb} MB; the most is 25 MB.` : 'The photo is over 25 MB.'} Make it smaller — for example by sending it to yourself on Viber, which shrinks it — and upload it again.`,
    heif: HEIF_EN,
    saved: (label) => `Done — the photo for “${label}” is saved. It shows on the site within 2 minutes.`,
    savedPairWaiting: (label, missing) => `Done — the photo for “${label}” is saved. It shows on the site once you upload “${missing}” too.`,
    cleared: (label) => `The photo for “${label}” has been removed. Within 2 minutes the place on the site is back to its default.`,
    clearedPairLive: (label) => `The photo for “${label}” has been removed. Within 2 minutes both photos of the pair on the site are back to the defaults.`,
    clearedPairIdle: (label) => `The photo for “${label}” has been removed. Nothing changes on the site: it was showing the default photos already.`,
    swapped: 'The order has changed. It shows on the site within 2 minutes.',
    altSaved: 'The description is saved.',
    updatedBy: 'by',
  },
}

// iOS converts a HEIC to JPEG when the picker is told these types; a PC's picker can still
// hand one over ("All files"), which isHeif catches by its name or type.
const ACCEPT = 'image/jpeg,image/png,image/webp'
const isHeif = (file) => /\.hei[cf]$/i.test(file?.name || '') || /^image\/hei[cf]/i.test(file?.type || '')

// The decoded size of a picked photo, for the fit warning; null when the browser cannot tell.
async function imageSize(file) {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return size
  } catch {
    return null
  }
}

// The picture the site shows in an empty slot, as a thumbnail: an /api/img photo through the
// resizer, a /public file as it is (or its smaller sibling).
function defaultThumbSrc(image) {
  if (!image?.url) return null
  if (image.thumb) return image.thumb
  return image.url.startsWith('/api/img/') ? cdnImage(image.url, { width: 320 }) : image.url
}

// The brochures' picker: a visually hidden input the button beside it operates, so the
// keyboard gets one stop per action and picking the same file twice still fires (the
// input clears itself before the handler runs). One image at a time — a slot holds one photo.
// The button carries the slot's name ("Качи снимка — Екип: …"): twenty-nine buttons all called
// "Качи снимка" would be indistinguishable in a screen reader's list. The input is hidden from
// it, being only the button's machinery.
function UploadButton({ label, busyLabel, isBusy, disabled, name, onPick }) {
  const picker = React.useRef(null)
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        className="visually-hidden"
        aria-hidden="true"
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
        aria-label={name}
        disabled={disabled}
        onClick={() => picker.current?.click()}
      >
        {isBusy ? busyLabel : label}
      </button>
    </>
  )
}

// The frame a slot's thumbnail is drawn in: the page's own crop (photoSlotDefaults `aspect`),
// so the panel shows roughly what the site shows rather than one 4:3 cut for everything.
const frameOf = (panel) => (panel?.aspect ? { aspectRatio: panel.aspect.replace(':', ' / ') } : undefined)

// What an empty slot shows: the default photo with its badge, a team member's initials, or
// (the steel page) nothing. A team member is drawn round, as the About page draws them.
function EmptyThumb({ panel, t, round }) {
  const src = panel?.emptyKind === 'image' ? defaultThumbSrc(panel.defaultImage) : null
  const frame = round ? undefined : frameOf(panel)
  const shape = round ? ' adm-hp-img--round' : ''
  if (src) {
    return (
      <div className="adm-hp-default">
        <img className={`adm-hp-img${shape}`} style={frame} src={src} alt="" loading="lazy" decoding="async" />
        <span className="adm-badge adm-hp-badge">{t.defaultThumb}</span>
      </div>
    )
  }
  if (panel?.emptyKind === 'monogram') {
    return (
      <div className="adm-hp-default">
        <div className={`adm-hp-empty${shape}`} style={frame}>
          <span className="adm-hp-monogram" aria-hidden="true">{panel.monogram}</span>
        </div>
        <span className="adm-badge adm-hp-badge">{t.defaultThumb}</span>
      </div>
    )
  }
  return <div className="adm-hp-empty" style={frame}><span>{panel?.emptyKind === 'none' ? t.noPhoto : t.defaultThumb}</span></div>
}

// A name the API lists and this screen does not: shown under "Други" with the plain controls.
const strangerSlot = (name) => ({ name, kind: 'other', group: 'other', decorative: false, pickable: true, retired: false })

export default function AdminHomePhotosPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [slots, setSlots] = React.useState([])
  const [names, setNames] = React.useState([])
  const [alts, setAlts] = React.useState({})
  const [state, setState] = React.useState('loading')
  const [busy, setBusy] = React.useState(null)       // the slot name of the running write
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [warning, setWarning] = React.useState('')
  // The slot the last write (or refusal) was for: its card shows the messages.
  const [lastSlot, setLastSlot] = React.useState(null)
  // Where keyboard focus goes back to once a write is over: every button is disabled while one
  // runs, and a browser drops the focus of a button it disables onto <body>.
  const focusBack = React.useRef(null)

  // The gallery dialog: which slot it is picking for, and the houses once fetched.
  const [pickFor, setPickFor] = React.useState(null)
  const [houses, setHouses] = React.useState(null)
  const [galleryError, setGalleryError] = React.useState('')

  // `quiet` (after a write) re-reads without the loading screen, which would empty the page and
  // throw the owner back to its top. It answers whether the list could be read.
  const load = React.useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState('loading')
    try {
      const data = await adminGet('/api/admin/home-photos')
      const list = Array.isArray(data?.slots) ? data.slots : []
      setSlots(list)
      setNames(Array.isArray(data?.names) ? data.names : list.map((s) => s.name))
      setAlts(Object.fromEntries(list.map((s) => [s.name, s.alt ?? ''])))
      setState('ready')
      return true
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return true }
      if (quiet) return false
      setState('error')
      return true
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  React.useEffect(() => {
    const back = focusBack.current
    if (busy !== null || !back) return
    focusBack.current = null
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const usable = (el) => Boolean(el?.isConnected) && !el.disabled
    let target = usable(back.el) ? back.el : null
    if (!target) {
      const card = [...document.querySelectorAll('li[data-slot]')].find((li) => li.dataset.slot === back.name)
      const buttons = card ? [...card.querySelectorAll('.adm-hp-actions button')].filter((b) => !b.disabled) : []
      target = buttons.find((b) => back.label && b.getAttribute('aria-label') === back.label) || buttons[0] || null
    }
    target?.focus?.({ preventScroll: true })
  }, [busy])

  const bySlot = React.useMemo(() => {
    const map = new Map()
    for (const s of slots) map.set(s.name, s)
    return map
  }, [slots])

  const known = React.useMemo(() => new Set(names), [names])
  // Top to bottom as each page shows them; a slot missing from PANEL_ORDER goes last.
  const shown = React.useMemo(() => {
    const rank = (name) => (PANEL_ORDER.includes(name) ? PANEL_ORDER.indexOf(name) : PANEL_ORDER.length)
    return PHOTO_SLOTS.filter((s) => !s.retired).sort((a, b) => rank(a.name) - rank(b.name))
  }, [])
  const strangers = React.useMemo(() => names.filter((n) => !photoSlotOf(n)).map(strangerSlot), [names])
  const heroNames = React.useMemo(() => shown.filter((s) => s.kind === HERO_KIND).map((s) => s.name), [shown])

  const labelOf = (name) => PHOTO_SLOT_PANEL[name]?.label?.[lang] || PHOTO_SLOT_PANEL[name]?.label?.bg || name
  // The name a notice uses: the label, or a shorter one where the label quotes something itself.
  const noticeNameOf = (name) => PHOTO_SLOT_PANEL[name]?.short?.[lang] || labelOf(name)

  // What the public read would hold for each slot as the list stands, so a pair's state is
  // worked out by the same rule the Interiors page follows (slotPair).
  const filledPhotos = React.useMemo(
    () => Object.fromEntries(slots.map((s) => [s.name, s.url ? { url: s.url, alt: s.alt ?? '' } : null])),
    [slots],
  )
  const isFilled = (name) => Boolean(filledPhotos[name])

  // A pair half's notices say what the SITE does, which depends on the other half: saved while
  // the other is empty, the pair is still the defaults; removed while the other is filled, the
  // whole pair goes back to the defaults; removed while the other is empty, nothing changes.
  const savedNotice = (name) => {
    const other = pairPartnerOf(name)
    return other && !isFilled(other) ? t.savedPairWaiting(noticeNameOf(name), noticeNameOf(other)) : t.saved(noticeNameOf(name))
  }
  const clearedNotice = (name) => {
    const other = pairPartnerOf(name)
    if (!other) return t.cleared(noticeNameOf(name))
    return isFilled(other) ? t.clearedPairLive(noticeNameOf(name)) : t.clearedPairIdle(noticeNameOf(name))
  }

  // A failed write in words the owner can act on: no answer at all (a status-less error) is the
  // connection; an upload refused for its size before the API saw it is the size; a sentence of
  // the API's that the owner can meet here is said in Bulgarian; anything else as the API said it.
  const messageOf = (err, upload) => {
    if (err?.status === undefined) return t.network
    if (upload && (err.status === 413 || (err.status === 404 && /^Request failed/.test(err.message || '')))) return t.tooLarge(null)
    return (lang !== 'en' && SERVER_BG[err?.message]) || err?.message || t.saveError
  }

  // Where focus goes back to after the write for `name`: the element given (or the focused one),
  // else the card's button with this label, else the card's first usable button.
  const remember = (name, { el = document.activeElement, label } = {}) => {
    focusBack.current = { name, el: el && el !== document.body ? el : null, label: label ?? el?.getAttribute?.('aria-label') ?? null }
  }

  // A refusal before anything is sent (a HEIC, a file over the limit), shown on its card.
  const refuse = (name, message) => {
    setLastSlot(name)
    setNotice('')
    setWarning('')
    setError(message)
  }

  // Every write goes through here: one busy key, the server's sentence on refusal, a quiet
  // re-read on success, and an expired session turned into the sign-in card.
  async function write(name, action, successNotice, { fit = '', upload = false } = {}) {
    setBusy(name)
    setLastSlot(name)
    setError('')
    setNotice('')
    setWarning(fit)
    try {
      await action()
      setNotice(successNotice)
      if (!(await load({ quiet: true }))) setError(t.reloadError)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(messageOf(err, upload))
    } finally {
      setBusy(null)
    }
  }

  async function upload(name, file) {
    if (!file) return
    if (isHeif(file)) { refuse(name, t.heif); return }
    if (file.size > MAX_UPLOAD_BYTES) { refuse(name, t.tooLarge(Math.ceil(file.size / (1024 * 1024)))); return }
    remember(name)
    // Held busy while the photo is measured, so no second write starts in between.
    setBusy(name)
    const size = await imageSize(file)
    const fit = size ? fitWarning(name, size, lang) : ''
    write(name, () => adminUpload(`/api/admin/home-photos/${name}/file`, file), savedNotice(name), { fit, upload: true })
  }

  function clear(name) {
    remember(name)
    write(name, () => adminDelete(`/api/admin/home-photos/${name}`), clearedNotice(name))
  }

  function swap(name, delta) {
    const index = heroNames.indexOf(name)
    const other = heroNames[index + delta]
    if (index === -1 || !other) return
    remember(name)
    write(name, () => adminSend('/api/admin/home-photos/swap', 'POST', { a: name, b: other }), t.swapped)
  }

  // On blur: focus is on its way to `next` (the element the owner moved to), which is where it
  // goes back to; moved nowhere (a click on the page), it is left alone.
  function saveAlt(name, next) {
    const current = bySlot.get(name)?.alt ?? ''
    const value = (alts[name] ?? '').trim()
    if (value === current) return
    if (next) remember(name, { el: next })
    write(name, () => adminSend(`/api/admin/home-photos/${name}/alt`, 'POST', { alt: value }), t.altSaved)
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
      setGalleryError((err?.status !== undefined && err?.message) || t.galleryError)
    }
  }

  function pick(imageKey) {
    const name = pickFor
    setPickFor(null)
    if (!name) return
    // The dialog's button is gone once it closes: back to the card's "От галерията".
    remember(name, { el: null, label: `${t.fromGallery} — ${labelOf(name)}` })
    write(name, () => adminSend(`/api/admin/home-photos/${name}/pick`, 'POST', { imageKey }), savedNotice(name))
  }

  // The messages of the last write, on the card it was for (or at the top, for none).
  const messages = (
    <>
      {error ? <div className="adm-alert" role="alert">{error}</div> : null}
      {warning ? <div className="adm-hp-warn">{warning}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}
    </>
  )

  const renderSlot = (slot) => {
    const { name } = slot
    const panel = PHOTO_SLOT_PANEL[name]
    const label = labelOf(name)
    const row = bySlot.get(name)
    const filled = Boolean(row?.url)
    // A slot this screen knows and the server does not (an older API): shown, not usable.
    const offline = !known.has(name)
    const locked = busy !== null || offline
    const isBusy = busy === name
    const altId = `adm-hp-alt-${name}`
    const heroIndex = slot.kind === HERO_KIND ? heroNames.indexOf(name) : -1
    const clearLabel = panel && panel.emptyKind !== 'image' ? t.remove : t.reset
    // The owner's photo as the page crops it: round for a team member, at the slot's crop
    // position; whole where the page shows it whole; else in the page's frame.
    const round = Boolean(slot.teamSlug)
    const photoStyle = {
      ...(round ? {} : panel?.crops === false ? { aspectRatio: 'auto' } : frameOf(panel)),
      ...(slot.adminPosition ? { objectPosition: slot.adminPosition } : {}),
    }
    // The model cards' alt is the model's size, whatever the photo (ConfiguratorStrip), so a
    // description typed here would go nowhere.
    const describes = filled && !slot.decorative && slot.kind !== MODEL_KIND
    // A pair half that is uploaded while its other half is not: the card shows the owner's
    // photo, the site still the default pair, and the card says so.
    const partner = pairPartnerOf(name)
    const waitingFor = filled && partner && !isFilled(partner) ? noticeNameOf(partner) : ''

    return (
      <li key={name} className="adm-card adm-hp-slot" data-slot={name}>
        <div className="adm-hp-slot-head">
          <strong>{label}</strong>
          {filled && row?.updatedByUpn ? (
            <span className="adm-small adm-muted adm-hp-by">{t.updatedBy} {row.updatedByUpn}</span>
          ) : null}
        </div>

        {filled ? (
          <img
            className={`adm-hp-img${round ? ' adm-hp-img--round' : ''}`}
            style={photoStyle}
            src={cdnImage(row.url, { width: 320 })}
            alt={row.alt || ''}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <EmptyThumb panel={panel} t={t} round={round} />
        )}
        {panel?.hint ? <span className="adm-small adm-muted adm-hp-hint">{panel.hint[lang] || panel.hint.bg}</span> : null}
        {!filled && panel?.empty ? <span className="adm-small adm-muted">{panel.empty[lang] || panel.empty.bg}</span> : null}
        {waitingFor ? <span className="adm-small adm-hp-waiting">{t.pairWaiting(waitingFor)}</span> : null}
        {offline ? <span className="adm-small adm-hp-offline">{t.offline}</span> : null}

        <div className="adm-hp-actions">
          <UploadButton
            label={t.upload}
            busyLabel={t.uploading}
            isBusy={isBusy}
            disabled={locked}
            name={`${t.upload} — ${label}`}
            onPick={(file) => upload(name, file)}
          />
          {slot.pickable ? (
            <button
              type="button"
              className="btn ghost adm-btn-sm"
              aria-label={`${t.fromGallery} — ${label}`}
              disabled={locked}
              onClick={() => openGallery(name)}
            >
              {t.fromGallery}
            </button>
          ) : null}
          {heroIndex !== -1 ? (
            // One unit, so the two arrows never wrap apart in the narrow five-across row.
            <span className="adm-hp-arrows">
              <button
                type="button"
                className="btn ghost adm-btn-sm adm-hp-arrow"
                aria-label={`${t.moveLeft} — ${label}`}
                title={t.moveLeft}
                disabled={locked || heroIndex === 0}
                onClick={() => swap(name, -1)}
              >
                ←
              </button>
              <button
                type="button"
                className="btn ghost adm-btn-sm adm-hp-arrow"
                aria-label={`${t.moveRight} — ${label}`}
                title={t.moveRight}
                disabled={locked || heroIndex === heroNames.length - 1}
                onClick={() => swap(name, 1)}
              >
                →
              </button>
            </span>
          ) : null}
          {filled ? (
            <button
              type="button"
              className="btn btn-danger adm-btn-sm"
              aria-label={`${clearLabel} — ${label}`}
              disabled={locked}
              onClick={() => clear(name)}
            >
              {clearLabel}
            </button>
          ) : null}
        </div>

        {lastSlot === name ? messages : null}

        {describes ? (
          <div className="adm-hp-alt">
            <label htmlFor={altId} className="adm-small">{t.alt}</label>
            <input
              id={altId}
              type="text"
              maxLength={400}
              value={alts[name] ?? ''}
              disabled={locked}
              onChange={(e) => setAlts((prev) => ({ ...prev, [name]: e.target.value }))}
              onBlur={(e) => saveAlt(name, e.relatedTarget)}
              aria-describedby={`${altId}-hint`}
            />
            <span id={`${altId}-hint`} className="adm-small adm-muted">{t.altHint}</span>
          </div>
        ) : null}
      </li>
    )
  }

  // Scrolls to one slot's card and puts the focus on its first button: the Partner steps'
  // pointer to the factory photo, which lives in About's section.
  const jumpToSlot = (name) => {
    const target = [...document.querySelectorAll('li[data-slot]')].find((li) => li.dataset.slot === name)
    if (!target) return
    target.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    target.querySelector('.adm-hp-actions button:not(:disabled)')?.focus?.({ preventScroll: true })
  }

  const rowHeadingOf = (key) => PHOTO_SLOT_ROW_HEADINGS[key]?.[lang] || PHOTO_SLOT_ROW_HEADINGS[key]?.bg
  // What the site shows for a pair now, by the page's rule: both photos only once both are in.
  const pairStateOf = (pairKey) => {
    const names = INTERIORS_PAIR_SLOTS[pairKey]
    if (!names) return ''
    if (slotPair(filledPhotos, names).filled) return t.pairBoth
    const [have, missing] = isFilled(names.before) ? [names.before, names.after] : [names.after, names.before]
    return isFilled(have) ? t.pairOne(noticeNameOf(have), noticeNameOf(missing)) : t.pairNone
  }

  // Each row of a section: its sub-heading, its hint and its grid (photoSlotRowOf names it).
  const rowFor = (key, slotsInRow) => {
    const base = { key, slots: slotsInRow }
    if (key === 'hero') return { ...base, heading: t.heroHeading, hint: t.heroHint, className: 'adm-hp-row-hero' }
    if (key === 'models') return { ...base, heading: t.modelsHeading, hint: t.modelsHint, className: 'adm-hp-row-models' }
    if (key === 'tiles') return { ...base, heading: t.tilesHeading, hint: t.tilesHint, className: 'adm-hp-row-tiles' }
    if (key === 'steel-steps') return { ...base, heading: rowHeadingOf(key), hint: t.steelStepsHint, className: 'adm-hp-row-steps' }
    if (key === 'partner-steps') {
      return {
        ...base,
        heading: rowHeadingOf(key),
        className: 'adm-hp-row-models',
        hint: (
          <>
            {t.partnerStepsHint} {t.partnerStepTwo}{' '}
            <button type="button" className="adm-linkbtn adm-hp-inline" onClick={() => jumpToSlot('factory-floor')}>
              {labelOf('factory-floor')}
            </button>
          </>
        ),
      }
    }
    if (key.startsWith('pair-')) {
      const pairKey = key.slice('pair-'.length)
      return { ...base, heading: rowHeadingOf(key), hint: t.pairHint, state: pairStateOf(pairKey), className: 'adm-hp-row-pair', boxed: true }
    }
    return { ...base, className: 'adm-hp-row-models' }
  }

  // One section per page, in rows (photoSlotRowOf) in the order the page shows them: the home
  // page's slides, model cards and tiles; a page's main photos, then its numbered steps; each
  // before/after pair on its own, its two halves together.
  const groups = PHOTO_SLOT_GROUPS.map((group) => {
    const inGroup = shown.filter((s) => s.group === group)
    const byRow = new Map()
    for (const s of inGroup) {
      const key = photoSlotRowOf(s)
      if (!byRow.has(key)) byRow.set(key, [])
      byRow.get(key).push(s)
    }
    const rows = [...byRow].map(([key, slotsInRow]) => rowFor(key, slotsInRow))
    const heading = PHOTO_SLOT_GROUP_HEADINGS[group]?.[lang] || PHOTO_SLOT_GROUP_HEADINGS[group]?.bg || group
    const note = PHOTO_SLOT_GROUP_NOTES[group]?.[lang] || PHOTO_SLOT_GROUP_NOTES[group]?.bg || null
    return { key: group, heading, note, rows: rows.filter((r) => r.slots.length) }
  }).filter((g) => g.rows.length)

  if (strangers.length) {
    groups.push({
      key: 'other',
      heading: t.otherHeading,
      rows: [{ key: 'other', hint: t.otherHint, className: 'adm-hp-row-models', slots: strangers }],
    })
  }

  // Scrolls to the section (its scroll-margin clears the sticky top bar) and takes the focus
  // there too, so the keyboard carries on from the section and not from the row of buttons.
  const jumpTo = (key) => {
    document.getElementById(`adm-hp-group-${key}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    document.getElementById(`adm-hp-group-${key}-title`)?.focus?.({ preventScroll: true })
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
      onRetry={() => load()}
    >
      {lastSlot === null ? messages : null}
      {/* Always in the page, so a screen reader hears each result wherever its card is. */}
      <div className="visually-hidden" role="status" aria-live="polite">{[notice, warning].filter(Boolean).join(' ')}</div>

      <p className="adm-small adm-muted adm-hp-formats">{t.formats}</p>
      <nav className="adm-hp-jump" aria-label={t.jump}>
        {groups.map((g) => (
          <button key={g.key} type="button" onClick={() => jumpTo(g.key)}>{g.heading}</button>
        ))}
      </nav>

      {groups.map((g) => (
        <section key={g.key} id={`adm-hp-group-${g.key}`} className="adm-hp-section" aria-labelledby={`adm-hp-group-${g.key}-title`}>
          <h2 id={`adm-hp-group-${g.key}-title`} tabIndex={-1}>{g.heading}</h2>
          {g.note ? (
            <p className="adm-small adm-muted adm-hp-elsewhere" data-note={g.key}>
              {g.note.map((part, i) => (typeof part === 'string'
                ? <React.Fragment key={i}>{part}</React.Fragment>
                : <Link key={i} to={part.to}>{part.label}</Link>))}
            </p>
          ) : null}
          {g.rows.map((row) => (
            <div key={row.key} className={`adm-hp-sub${row.boxed ? ' adm-hp-pair' : ''}`} data-row={row.key}>
              {row.heading ? <h3>{row.heading}</h3> : null}
              {row.hint ? <p className="adm-small adm-muted">{row.hint}</p> : null}
              {row.state ? <p className="adm-small adm-hp-pair-state">{row.state}</p> : null}
              <ul className={`adm-hp-row ${row.className}`}>
                {row.slots.map(renderSlot)}
              </ul>
            </div>
          ))}
        </section>
      ))}

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
                    <img src={cdnImage(image.url, { width: 240 })} alt="" loading="lazy" decoding="async" />
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
