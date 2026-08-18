import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'
import '../style/FactorySheet.css'

// The factory order sheets, inside the panel.
//
// This is the /internal/factory-sheet tool moved to where it always belonged. What changed:
// the gate is the same Entra sign-in as everything else instead of a password that shipped
// in the JS bundle, and a sheet is a ROW instead of one browser's localStorage — so it
// survives a cleared cache, opens on a colleague's machine, and shows up in the audit log.
// What deliberately did NOT change: the form, the plan markers and the printed page, which
// worked and which the factory already knows how to read.
//
// The old tool's data is not abandoned: sheets saved as .json files still open here, and a
// sheet sitting in THIS browser's localStorage (same origin, so it is readable) is offered
// as a one-time import.

const LEGACY_STORAGE_KEY = 'nvc_factory_sheet_v1'

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function multilineHtml(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br/>')
}

// The sheet's own bilingual strings — separate from the panel chrome's, because the LANG OF
// THE SHEET decides the labels on the printed page the factory receives, while the panel's
// language is just whoever is signed in.
const L = {
  bg: {
    htmlLang: 'bg',
    appSubtitle: 'Вътрешен лист за конфигурация към фабриката',
    detailsTitle: 'Данни за поръчката',
    client: 'Клиент', project: 'Проект / Модел', reference: 'Референтен №', date: 'Дата',
    planTitle: 'План на къщата',
    planUpload: 'Качете изображение на плана',
    planHint: 'JPG или PNG. След качване кликнете върху плана, за да добавяте маркери.',
    planReplace: 'Смени изображението', planRemove: 'Премахни плана',
    modeWindow: 'Добавяй прозорци', modeContact: 'Добавяй контакти',
    modeHint: 'Изберете режим, после кликнете върху плана. Кликнете маркер, за да го изберете.',
    windowsTitle: 'Прозорци',
    windowsEmpty: 'Няма добавени прозорци. Изберете „Добавяй прозорци“ и кликнете върху плана.',
    windowType: 'Тип / размер', windowTypePh: 'напр. 1200×950, панорамен…',
    note: 'Бележка', notePh: 'по избор', remove: 'Премахни',
    contactsTitle: 'Контакти (ел. инсталация)',
    contactsEmpty: 'Няма добавени контакти. Изберете „Добавяй контакти“ и кликнете върху плана.',
    contactPurpose: 'За какво е', contactPurposePh: 'напр. кухня, ТВ стена…',
    contactType: 'Тип', contactTypePh: 'напр. двоен контакт…',
    specsTitle: 'Избор от конфигуратора',
    specsHint: 'Тук впишете какво е избрал клиентът. Можете да поставите копираното обобщение от конфигуратора и да натиснете „Внеси“.',
    importPlaceholder: 'Поставете тук копираното обобщение от конфигуратора (Етикет: Стойност на всеки ред)…',
    importButton: 'Внеси от обобщение',
    specLabel: 'Параметър', specValue: 'Стойност', addRow: 'Добави ред',
    notesTitle: 'Общи бележки', notesPh: 'Допълнителни инструкции към фабриката…',
    sheetTitle: 'Лист за фабрична поръчка',
    printWindows: 'Прозорци', printContacts: 'Контакти', printPlan: 'План с маркери',
    printSpecs: 'Конфигурация', printNotes: 'Бележки', generatedOn: 'Генерирано на',
    legendWindows: 'Прозорци (синьо-зелено)', legendContacts: 'Контакти (тъмно)',
    printBlocked: 'Браузърът блокира прозореца за печат. Разрешете изскачащите прозорци.',
    windowShort: 'П', contactShort: 'К',
    windowTypes: ['1000×950 (стандартен)', '1200×950', '1400×950', 'Панорамен / френски', 'Фиксиран', 'Двукрилен', 'По поръчка'],
    contactPurposes: ['Кухня', 'ТВ стена', 'Баня', 'Тераса / външен', 'Климатик', 'Бойлер', 'Осветление', 'Пералня', 'Хладилник', 'Интернет / мрежа'],
    contactTypes: ['Единичен контакт', 'Двоен контакт', 'Троен контакт', 'USB контакт', 'Мрежов (RJ45)', 'ТВ извод', 'Ключ осветление', 'Кабелен извод'],
    specSeed: ['Модел', 'Вариант', 'Разпределение', 'Дограма', 'Тип прозорец', 'Външна врата', 'Външни панели', 'Цвят декинг', 'Вътрешни панели', 'Подова настилка', 'Кухненски плот', 'Баня', 'Кухня', 'Вътрешни врати', 'Брой вътрешни врати', 'Отопление', 'Размер прозорци', 'Обща стойност'],
  },
  en: {
    htmlLang: 'en',
    appSubtitle: 'Internal configuration sheet for the factory',
    detailsTitle: 'Order details',
    client: 'Client', project: 'Project / Model', reference: 'Reference no.', date: 'Date',
    planTitle: 'House plan',
    planUpload: 'Upload a plan image',
    planHint: 'JPG or PNG. After uploading, click the plan to drop markers.',
    planReplace: 'Replace image', planRemove: 'Remove plan',
    modeWindow: 'Add windows', modeContact: 'Add contacts',
    modeHint: 'Pick a mode, then click the plan. Click a marker to select it.',
    windowsTitle: 'Windows',
    windowsEmpty: 'No windows yet. Choose “Add windows” and click the plan.',
    windowType: 'Type / size', windowTypePh: 'e.g. 1200×950, panoramic…',
    note: 'Note', notePh: 'optional', remove: 'Remove',
    contactsTitle: 'Contacts (electrical)',
    contactsEmpty: 'No contacts yet. Choose “Add contacts” and click the plan.',
    contactPurpose: 'What it is for', contactPurposePh: 'e.g. kitchen, TV wall…',
    contactType: 'Type', contactTypePh: 'e.g. double socket…',
    specsTitle: 'Configurator selections',
    specsHint: 'Enter what the client chose. You can paste the copied configurator summary and press “Import”.',
    importPlaceholder: 'Paste the copied configurator summary here (Label: Value per line)…',
    importButton: 'Import from summary',
    specLabel: 'Parameter', specValue: 'Value', addRow: 'Add row',
    notesTitle: 'General notes', notesPh: 'Extra instructions for the factory…',
    sheetTitle: 'Factory order sheet',
    printWindows: 'Windows', printContacts: 'Contacts', printPlan: 'Plan with markers',
    printSpecs: 'Configuration', printNotes: 'Notes', generatedOn: 'Generated on',
    legendWindows: 'Windows (teal)', legendContacts: 'Contacts (dark)',
    printBlocked: 'The browser blocked the print window. Allow pop-ups.',
    windowShort: 'W', contactShort: 'C',
    windowTypes: ['1000×950 (standard)', '1200×950', '1400×950', 'Panoramic / French', 'Fixed', 'Double', 'Custom'],
    contactPurposes: ['Kitchen', 'TV wall', 'Bathroom', 'Terrace / exterior', 'Air conditioner', 'Boiler', 'Lighting', 'Washing machine', 'Fridge', 'Internet / network'],
    contactTypes: ['Single socket', 'Double socket', 'Triple socket', 'USB socket', 'Network (RJ45)', 'TV outlet', 'Light switch', 'Cable outlet'],
    specSeed: ['Model', 'Variant', 'Layout', 'Window frame', 'Window style', 'Exterior door', 'Outside panels', 'Decking colour', 'Interior panels', 'Floor finish', 'Kitchen bench', 'Bathroom', 'Kitchen', 'Inside doors', 'Inside door count', 'Heating', 'Window size', 'Known total'],
  },
}

// The panel chrome's strings — the list, the buttons, the states.
const TEXT = {
  bg: {
    title: 'Фабрични поръчки',
    subtitle: 'Листовете, които подаваме към фабриката — с плана, маркерите и избора на клиента.',
    add: '+ Нов лист',
    empty: 'Още няма листове.',
    open: 'Отвори',
    back: '← Всички листове',
    save: 'Запази', saved: 'Запазено', saving: 'Запазване…',
    unsaved: 'Незапазени промени',
    print: 'Принтирай / PDF',
    delete: 'Изтрий',
    deleteConfirm: (name) => `Да изтрия ли листа „${name}“? Записът остава в одита, но листът изчезва.`,
    saveError: 'Листът не беше запазен.',
    loadError: 'Листът не можа да се зареди.',
    sheetLang: 'Език на листа',
    saveFile: 'Запази файл', openFile: 'Отвори файл',
    importConfirm: 'Това ще замени текущия лист. Да продължа ли?',
    importError: 'Файлът не може да се прочете.',
    untitled: '(без име)',
    colWho: 'Последно от',
    colWhen: 'Дата',
    windows: 'прозорци', contacts: 'контакти', plan: 'план',
    legacyBanner: 'В този браузър има лист от стария инструмент.',
    legacyImport: 'Внеси го като нов лист',
    legacyImported: 'Внесен. Прегледайте го и натиснете „Запази“.',
    leaveConfirm: 'Има незапазени промени. Да изляза ли без запазване?',
  },
  en: {
    title: 'Factory orders',
    subtitle: 'The sheets we hand the factory — plan, markers and the client’s choices.',
    add: '+ New sheet',
    empty: 'No sheets yet.',
    open: 'Open',
    back: '← All sheets',
    save: 'Save', saved: 'Saved', saving: 'Saving…',
    unsaved: 'Unsaved changes',
    print: 'Print / PDF',
    delete: 'Delete',
    deleteConfirm: (name) => `Delete the sheet “${name}”? The audit log keeps the record; the sheet goes.`,
    saveError: 'The sheet was not saved.',
    loadError: 'The sheet could not be loaded.',
    sheetLang: 'Sheet language',
    saveFile: 'Save file', openFile: 'Open file',
    importConfirm: 'This will replace the current sheet. Continue?',
    importError: 'Could not read this file.',
    untitled: '(untitled)',
    colWho: 'Last by',
    colWhen: 'Date',
    windows: 'windows', contacts: 'contacts', plan: 'plan',
    legacyBanner: 'This browser holds a sheet from the old internal tool.',
    legacyImport: 'Import it as a new sheet',
    legacyImported: 'Imported. Review it and press “Save”.',
    leaveConfirm: 'There are unsaved changes. Leave without saving?',
  },
}

function seedSpecs(sheetLang) {
  return L[sheetLang].specSeed.map((label, i) => ({ id: `s-${i}`, label, value: '' }))
}

function todayIso() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

function freshConfig(sheetLang) {
  return {
    client: '', project: '', reference: '', date: todayIso(),
    planImage: '', planName: '',
    windows: [], contacts: [], specs: seedSpecs(sheetLang), notes: '',
  }
}

function parseArray(json) {
  try {
    const parsed = JSON.parse(json || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeMarkers(arr, prefix) {
  if (!Array.isArray(arr)) return []
  return arr.map((m, i) => ({
    ...m, id: m?.id || `${prefix}-${Date.now()}-${i}`, x: Number(m?.x) || 0, y: Number(m?.y) || 0,
  }))
}

function normalizeConfig(raw, sheetLang) {
  const base = freshConfig(sheetLang)
  if (!raw || typeof raw !== 'object') return base
  const specs = (Array.isArray(raw.specs) && raw.specs.length ? raw.specs : base.specs)
    .map((s, i) => ({ id: s?.id || `s-${Date.now()}-${i}`, label: s?.label || '', value: s?.value || '' }))
  return {
    ...base,
    ...raw,
    windows: normalizeMarkers(raw.windows, 'window'),
    contacts: normalizeMarkers(raw.contacts, 'contact'),
    specs,
  }
}

/** Server row -> editor draft. The arrays travel as JSON strings; the editor works on values. */
function fromServer(dto) {
  return {
    id: dto.id,
    sheetLang: dto.lang === 'en' ? 'en' : 'bg',
    config: normalizeConfig({
      client: dto.client || '',
      project: dto.project || '',
      reference: dto.reference || '',
      date: dto.sheetDate || '',
      planImage: dto.planImage || '',
      planName: dto.planName || '',
      windows: parseArray(dto.windowsJson),
      contacts: parseArray(dto.contactsJson),
      specs: parseArray(dto.specsJson),
      notes: dto.notes || '',
    }, dto.lang === 'en' ? 'en' : 'bg'),
  }
}

function toServer(draft) {
  const { config } = draft
  return {
    client: config.client, project: config.project, reference: config.reference,
    sheetDate: config.date || null,
    lang: draft.sheetLang,
    planImage: config.planImage || null,
    planName: config.planName || null,
    windowsJson: JSON.stringify(config.windows),
    contactsJson: JSON.stringify(config.contacts),
    specsJson: JSON.stringify(config.specs),
    notes: config.notes || null,
  }
}

/**
 * Shrinks a plan image before it is stored.
 *
 * localStorage tolerated multi-megabyte data URLs because it had to (and silently dropped
 * the image when the quota broke); a database should not. 1600px is comfortably beyond what
 * an A4 print or a screen needs for a floor plan, and JPEG at 0.82 lands a typical plan
 * around a quarter megabyte. Painted on white first, because plans exported as transparent
 * PNGs would otherwise come out black.
 */
function downscaleImage(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = String(reader.result || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function PlanCanvas({ image, windows, contacts, mode, selectedId, onAdd, onSelect }) {
  function handleClick(event) {
    if (!image || !mode) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    onAdd({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  return (
    <div className={['fs-canvas', mode && 'is-armed'].filter(Boolean).join(' ')} onClick={handleClick}>
      <img src={image} alt="" />
      {windows.map((w, i) => (
        <span
          key={w.id}
          className={['fs-dot', 'fs-dot-win', selectedId === w.id && 'is-selected'].filter(Boolean).join(' ')}
          style={{ left: `${w.x}%`, top: `${w.y}%` }}
          onClick={(e) => { e.stopPropagation(); onSelect(w.id) }}
          title={w.type || ''}
        >
          {i + 1}
        </span>
      ))}
      {contacts.map((c, i) => (
        <span
          key={c.id}
          className={['fs-dot', 'fs-dot-con', selectedId === c.id && 'is-selected'].filter(Boolean).join(' ')}
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
          onClick={(e) => { e.stopPropagation(); onSelect(c.id) }}
          title={c.purpose || ''}
        >
          {i + 1}
        </span>
      ))}
    </div>
  )
}

export default function AdminFactorySheetsPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [rows, setRows] = React.useState([])
  const [state, setState] = React.useState('loading')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  // null = list view; { id, sheetLang, config } = editor view. id null = a new sheet.
  const [draft, setDraft] = React.useState(null)
  const [dirty, setDirty] = React.useState(false)
  const [mode, setMode] = React.useState('window')
  const [selectedId, setSelectedId] = React.useState(null)
  const [importText, setImportText] = React.useState('')

  const fileRef = React.useRef(null)
  const jsonRef = React.useRef(null)

  // The old tool's sheet, if this browser still holds one. Same origin, so the key is
  // readable from here — that is the entire migration path for unsaved work.
  const [legacy, setLegacy] = React.useState(() => {
    try { return window.localStorage.getItem(LEGACY_STORAGE_KEY) } catch { return null }
  })

  const st = draft ? L[draft.sheetLang] : L.bg

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      setRows(await adminGet('/api/admin/factory-sheets') ?? [])
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  function patchConfig(patch) {
    setDraft((d) => ({ ...d, config: { ...d.config, ...patch } }))
    setDirty(true)
  }

  async function openSheet(id) {
    setError('')
    try {
      const dto = await adminGet(`/api/admin/factory-sheets/${id}`)
      setDraft(fromServer(dto))
      setDirty(false)
      setSelectedId(null)
      setImportText('')
      setNotice('')
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(t.loadError)
    }
  }

  function newSheet() {
    const sheetLang = lang === 'en' ? 'en' : 'bg'
    setDraft({ id: null, sheetLang, config: freshConfig(sheetLang) })
    setDirty(false)
    setSelectedId(null)
    setImportText('')
    setNotice('')
    setError('')
  }

  function backToList() {
    if (dirty && !window.confirm(t.leaveConfirm)) return
    setDraft(null)
    setDirty(false)
    setError('')
    load()
  }

  async function save() {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const body = toServer(draft)
      const result = draft.id
        ? await adminSend(`/api/admin/factory-sheets/${draft.id}`, 'PUT', body)
        : await adminSend('/api/admin/factory-sheets', 'POST', body)

      if (result?.sheet) setDraft(fromServer(result.sheet))
      setDirty(false)
      setNotice(t.saved)

      // The sheet is on the server now, so the localStorage copy has done its job. Removed
      // only AFTER a successful save — a failed one must leave the browser copy alone,
      // because it may still be the only copy in existence.
      if (legacy) {
        try { window.localStorage.removeItem(LEGACY_STORAGE_KEY) } catch { /* ignore */ }
        setLegacy(null)
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  async function removeSheet() {
    if (!draft?.id) return
    const name = draft.config.reference || draft.config.client || draft.config.project || t.untitled
    if (!window.confirm(t.deleteConfirm(name))) return
    setBusy(true)
    try {
      await adminDelete(`/api/admin/factory-sheets/${draft.id}`)
      setDraft(null)
      setDirty(false)
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  function importLegacy() {
    try {
      const parsed = JSON.parse(legacy || 'null')
      if (!parsed) return
      const sheetLang = parsed.lang === 'en' ? 'en' : 'bg'
      setDraft({ id: null, sheetLang, config: normalizeConfig(parsed.config, sheetLang) })
      setDirty(true)
      setNotice(t.legacyImported)
      setError('')
    } catch {
      setError(t.importError)
    }
  }

  async function handlePlanFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await downscaleImage(file)
      patchConfig({ planImage: dataUrl, planName: file.name })
    } catch {
      setError(t.importError)
    }
  }

  function addMarker(point) {
    const id = `${mode}-${Date.now()}`
    if (mode === 'window') {
      patchConfig({ windows: [...draft.config.windows, { id, x: point.x, y: point.y, type: '', note: '' }] })
    } else {
      patchConfig({ contacts: [...draft.config.contacts, { id, x: point.x, y: point.y, purpose: '', ctype: '', note: '' }] })
    }
    setSelectedId(id)
  }

  const updateWindow = (id, patch) =>
    patchConfig({ windows: draft.config.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) })
  const removeWindow = (id) =>
    patchConfig({ windows: draft.config.windows.filter((w) => w.id !== id) })
  const updateContact = (id, patch) =>
    patchConfig({ contacts: draft.config.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const removeContact = (id) =>
    patchConfig({ contacts: draft.config.contacts.filter((c) => c.id !== id) })
  const updateSpec = (id, patch) =>
    patchConfig({ specs: draft.config.specs.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const addSpecRow = () =>
    patchConfig({ specs: [...draft.config.specs, { id: `s-${Date.now()}`, label: '', value: '' }] })
  const removeSpec = (id) =>
    patchConfig({ specs: draft.config.specs.filter((s) => s.id !== id) })

  function importSummary() {
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean)
    const specs = lines.map((line, i) => {
      const idx = line.indexOf(':')
      return idx > 0
        ? { id: `imp-${Date.now()}-${i}`, label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
        : { id: `imp-${Date.now()}-${i}`, label: '', value: line }
    })
    if (specs.length) {
      patchConfig({ specs })
      setImportText('')
    }
  }

  function switchSheetLang(next) {
    setDraft((d) => {
      const untouched = d.config.specs.every(
        (row) => !row.value && L.bg.specSeed.concat(L.en.specSeed).includes(row.label))
      return {
        ...d,
        sheetLang: next,
        config: untouched ? { ...d.config, specs: seedSpecs(next) } : d.config,
      }
    })
    setDirty(true)
  }

  // Portable .json save/open, kept from the old tool: sheets already live as emailed files,
  // and those files must keep opening here or the history they hold is stranded.
  function exportFile() {
    const { config } = draft
    const payload = { app: 'nvc-factory-sheet', version: 1, savedAt: new Date().toISOString(), lang: draft.sheetLang, config }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const base = String(config.reference || config.client || config.project || 'factory-sheet')
      .trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'factory-sheet'
    const a = document.createElement('a')
    a.href = url
    a.download = `${base}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function importFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (dirty && !window.confirm(t.importConfirm)) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''))
        const data = parsed && typeof parsed === 'object' && parsed.config ? parsed : { config: parsed }
        const sheetLang = data.lang === 'en' || data.lang === 'bg' ? data.lang : draft.sheetLang
        setDraft((d) => ({ ...d, sheetLang, config: normalizeConfig(data.config, sheetLang) }))
        setDirty(true)
        setSelectedId(null)
        setImportText('')
      } catch {
        window.alert(t.importError)
      }
    }
    reader.readAsText(file)
  }

  // The printed page — byte-for-byte the artefact the old tool produced, because the factory
  // already knows how to read it.
  function printSheet() {
    const { config } = draft
    const pt = L[draft.sheetLang]
    const popup = window.open('', 'nvc-factory-sheet-print', 'width=1120,height=1500')
    if (!popup) {
      window.alert(pt.printBlocked)
      return
    }
    try { popup.opener = null } catch { /* ignore */ }

    const detailRows = [
      [pt.client, config.client], [pt.project, config.project],
      [pt.reference, config.reference], [pt.date, config.date],
    ].filter(([, v]) => v)

    const windowDots = config.windows
      .map((w, i) => `<span class="dot dot-win" style="left:${w.x}%;top:${w.y}%">${i + 1}</span>`).join('')
    const contactDots = config.contacts
      .map((c, i) => `<span class="dot dot-con" style="left:${c.x}%;top:${c.y}%">${i + 1}</span>`).join('')

    const windowList = config.windows.length
      ? config.windows.map((w, i) => `<li><b>${pt.windowShort}${i + 1}</b> ${escapeHtml(w.type || '—')}${w.note ? ` <span class="muted">· ${escapeHtml(w.note)}</span>` : ''}</li>`).join('')
      : '<li class="muted">—</li>'
    const contactList = config.contacts.length
      ? config.contacts.map((c, i) => `<li><b>${pt.contactShort}${i + 1}</b> ${escapeHtml(c.purpose || '—')}${c.ctype ? ` <span class="muted">(${escapeHtml(c.ctype)})</span>` : ''}${c.note ? ` <span class="muted">· ${escapeHtml(c.note)}</span>` : ''}</li>`).join('')
      : '<li class="muted">—</li>'

    const specRows = config.specs
      .filter((s) => s.label || s.value)
      .map((s) => `<div class="row"><div class="k">${escapeHtml(s.label || '—')}</div><div class="v">${escapeHtml(s.value || '—')}</div></div>`)
      .join('')

    const detailChips = detailRows
      .map(([k, v]) => `<span class="chip"><span class="chip-k">${escapeHtml(k)}</span>${escapeHtml(v)}</span>`)
      .join('')

    popup.document.open()
    popup.document.write(`<!doctype html>
<html lang="${escapeHtml(pt.htmlLang)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(pt.sheetTitle)}${config.reference ? ` · ${escapeHtml(config.reference)}` : ''}</title>
  <style>
    @page{size:A4;margin:12mm}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;padding:20px;font-family:Inter,Arial,sans-serif;color:#111827;background:#f8fafc}
    .sheet{max-width:1040px;margin:0 auto;background:#fff;border:1px solid #d1d5db;border-radius:18px;padding:24px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:16px}
    .title{font-size:26px;font-weight:900;margin:0}
    .sub{color:#4b5563;margin:6px 0 0;font-size:13px}
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin:0}
    .chip{display:inline-flex;gap:6px;align-items:center;border:1px solid #d1d5db;border-radius:999px;padding:6px 12px;font-weight:700;font-size:12px;background:#f8fafc}
    .chip-k{color:#6b7280;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
    h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#374151;margin:22px 0 10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
    .plan-shell{display:flex;justify-content:center}
    .plan-canvas{position:relative;width:100%;max-width:780px;border:1px solid #d1d5db;border-radius:12px;overflow:hidden;background:#fff}
    .plan-canvas img{width:100%;height:auto;display:block}
    .dot{position:absolute;transform:translate(-50%,-50%);min-width:24px;height:24px;padding:0 7px;border-radius:999px;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:900;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.25)}
    .dot-win{background:#0d9488}
    .dot-con{background:#1f2937}
    .legend{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0 0;font-size:12px;font-weight:700;color:#374151}
    .legend span{display:inline-flex;align-items:center;gap:6px}
    .key{width:14px;height:14px;border-radius:50%;display:inline-block}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    ul.list{margin:0;padding-left:18px;line-height:1.7;font-size:13px}
    ul.list b{display:inline-block;min-width:30px;color:#111827}
    .muted{color:#6b7280}
    .row{display:grid;grid-template-columns:240px 1fr;gap:12px;padding:7px 0;border-top:1px solid #eef2f7}
    .row:first-child{border-top:0}
    .k{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:800}
    .v{font-weight:700}
    .notes{margin-top:8px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;line-height:1.55;font-size:13px;white-space:pre-wrap}
    .foot{margin-top:20px;color:#6b7280;font-size:12px}
    @media print{body{padding:0;background:#fff}.sheet{border:none;border-radius:0;max-width:none}.plan-canvas,.cols,.row,.notes{break-inside:avoid}}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div>
        <h1 class="title">${escapeHtml(pt.sheetTitle)}</h1>
        <p class="sub">${escapeHtml(pt.appSubtitle)}</p>
      </div>
    </div>
    ${detailChips ? `<div class="chips">${detailChips}</div>` : ''}

    ${config.planImage ? `
    <h2>${escapeHtml(pt.printPlan)}</h2>
    <div class="plan-shell">
      <div class="plan-canvas">
        <img src="${config.planImage}" alt="" />
        ${windowDots}
        ${contactDots}
      </div>
    </div>
    <div class="legend">
      <span><span class="key" style="background:#0d9488"></span>${escapeHtml(pt.legendWindows)}</span>
      <span><span class="key" style="background:#1f2937"></span>${escapeHtml(pt.legendContacts)}</span>
    </div>` : ''}

    <div class="cols">
      <div>
        <h2>${escapeHtml(pt.printWindows)} (${config.windows.length})</h2>
        <ul class="list">${windowList}</ul>
      </div>
      <div>
        <h2>${escapeHtml(pt.printContacts)} (${config.contacts.length})</h2>
        <ul class="list">${contactList}</ul>
      </div>
    </div>

    ${specRows ? `<h2>${escapeHtml(pt.printSpecs)}</h2>${specRows}` : ''}

    ${config.notes ? `<h2>${escapeHtml(pt.printNotes)}</h2><div class="notes">${multilineHtml(config.notes)}</div>` : ''}

    <div class="foot">${escapeHtml(`${pt.generatedOn}: ${new Date().toLocaleString(draft.sheetLang === 'bg' ? 'bg-BG' : 'en-GB')}`)}</div>
  </div>
  <script>
    window.addEventListener('load', function () {
      var go = function () { window.focus(); window.print(); };
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function(){ setTimeout(go, 180); }); }
      else { setTimeout(go, 180); }
    });
    window.addEventListener('afterprint', function () { setTimeout(function(){ window.close(); }, 120); });
  </script>
</body>
</html>`)
    popup.document.close()
  }

  function sheetName(row) {
    return row.reference || row.client || row.project || t.untitled
  }

  function formatWhen(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="factorySheets"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
    >
      {error ? <div className="adm-alert" role="alert">{error}</div> : null}
      {notice ? <p className="adm-small adm-saved" role="status">{notice}</p> : null}

      {!draft ? (
        <>
          {legacy ? (
            <div className="adm-legacy-banner">
              <span>{t.legacyBanner}</span>
              <button type="button" className="btn" onClick={importLegacy}>{t.legacyImport}</button>
            </div>
          ) : null}

          <div className="adm-pipeline-toolbar">
            <button type="button" className="btn" onClick={newSheet}>{t.add}</button>
          </div>

          {rows.length === 0 && state === 'ready' ? (
            <div className="adm-empty"><p>{t.empty}</p></div>
          ) : (
            <ul className="adm-sheets-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <button type="button" className="adm-sheet-row" onClick={() => openSheet(row.id)}>
                    <strong className="adm-sheet-name">{sheetName(row)}</strong>
                    <span className="adm-small adm-muted">
                      {[row.client, row.project].filter((v) => v && v !== sheetName(row)).join(' · ')}
                    </span>
                    <span className="adm-small adm-muted adm-sheet-meta">
                      {row.sheetDate ? `${t.colWhen}: ${row.sheetDate}` : null}
                      {row.hasPlan ? ` · ${t.plan}` : null}
                      {` · ${row.windowCount} ${t.windows} · ${row.contactCount} ${t.contacts}`}
                      {row.updatedByUpn ? ` · ${t.colWho}: ${row.updatedByUpn.split('@')[0]}` : null}
                      {row.updatedAt ? ` · ${formatWhen(row.updatedAt)}` : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="fs-root fs-embedded">
          <datalist id="fs-window-types">{st.windowTypes.map((o) => <option key={o} value={o} />)}</datalist>
          <datalist id="fs-contact-purposes">{st.contactPurposes.map((o) => <option key={o} value={o} />)}</datalist>
          <datalist id="fs-contact-types">{st.contactTypes.map((o) => <option key={o} value={o} />)}</datalist>
          <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePlanFile} />

          <header className="fs-topbar">
            <div className="fs-topbar-title">
              <button type="button" className="adm-linkbtn" onClick={backToList}>{t.back}</button>
              {dirty ? <span className="fs-dirty">{t.unsaved}</span> : null}
            </div>
            <div className="fs-topbar-actions">
              <div className="fs-lang" title={t.sheetLang}>
                <button type="button" className={draft.sheetLang === 'bg' ? 'is-active' : ''} onClick={() => switchSheetLang('bg')}>BG</button>
                <button type="button" className={draft.sheetLang === 'en' ? 'is-active' : ''} onClick={() => switchSheetLang('en')}>EN</button>
              </div>
              <button type="button" className="fs-btn" onClick={() => jsonRef.current?.click()}>{t.openFile}</button>
              <button type="button" className="fs-btn" onClick={exportFile}>{t.saveFile}</button>
              {draft.id ? (
                <button type="button" className="fs-btn fs-btn-ghost" onClick={removeSheet} disabled={busy}>{t.delete}</button>
              ) : null}
              <button type="button" className="fs-btn" onClick={printSheet}>{t.print}</button>
              <button type="button" className="fs-btn fs-btn-primary" onClick={save} disabled={busy || !dirty}>
                {busy ? t.saving : t.save}
              </button>
            </div>
          </header>

          <main className="fs-main">
            <section className="fs-section">
              <h2 className="fs-section-title">{st.detailsTitle}</h2>
              <div className="fs-grid-4">
                <label className="fs-field"><span>{st.client}</span><input value={draft.config.client} onChange={(e) => patchConfig({ client: e.target.value })} /></label>
                <label className="fs-field"><span>{st.project}</span><input value={draft.config.project} onChange={(e) => patchConfig({ project: e.target.value })} /></label>
                <label className="fs-field"><span>{st.reference}</span><input value={draft.config.reference} onChange={(e) => patchConfig({ reference: e.target.value })} /></label>
                <label className="fs-field"><span>{st.date}</span><input type="date" value={draft.config.date} onChange={(e) => patchConfig({ date: e.target.value })} /></label>
              </div>
            </section>

            <section className="fs-section">
              <h2 className="fs-section-title">{st.planTitle}</h2>
              {!draft.config.planImage ? (
                <button type="button" className="fs-dropzone" onClick={() => fileRef.current?.click()}>
                  <span className="fs-dropzone-icon">⬆</span>
                  <strong>{st.planUpload}</strong>
                  <span className="fs-muted">{st.planHint}</span>
                </button>
              ) : (
                <>
                  <div className="fs-plan-toolbar">
                    <div className="fs-mode">
                      <button type="button" className={mode === 'window' ? 'is-active is-win' : ''} onClick={() => setMode('window')}>{st.modeWindow}</button>
                      <button type="button" className={mode === 'contact' ? 'is-active is-con' : ''} onClick={() => setMode('contact')}>{st.modeContact}</button>
                    </div>
                    <div className="fs-plan-toolbar-right">
                      <button type="button" className="fs-btn fs-btn-sm" onClick={() => fileRef.current?.click()}>{st.planReplace}</button>
                      <button type="button" className="fs-btn fs-btn-sm fs-btn-ghost" onClick={() => patchConfig({ planImage: '', planName: '' })}>{st.planRemove}</button>
                    </div>
                  </div>
                  <p className="fs-muted fs-mode-hint">{st.modeHint}</p>
                  <PlanCanvas
                    image={draft.config.planImage}
                    windows={draft.config.windows}
                    contacts={draft.config.contacts}
                    mode={mode}
                    selectedId={selectedId}
                    onAdd={addMarker}
                    onSelect={setSelectedId}
                  />
                </>
              )}
            </section>

            <div className="fs-grid-2">
              <section className="fs-section">
                <h2 className="fs-section-title">{st.windowsTitle} <span className="fs-count fs-count-win">{draft.config.windows.length}</span></h2>
                {draft.config.windows.length === 0 ? (
                  <p className="fs-muted">{st.windowsEmpty}</p>
                ) : (
                  <div className="fs-marker-list">
                    {draft.config.windows.map((w, i) => (
                      <div key={w.id} className={['fs-marker-row', selectedId === w.id && 'is-selected'].filter(Boolean).join(' ')} onMouseEnter={() => setSelectedId(w.id)}>
                        <span className="fs-marker-num fs-num-win">{i + 1}</span>
                        <div className="fs-marker-fields">
                          <input list="fs-window-types" placeholder={st.windowTypePh} value={w.type} onChange={(e) => updateWindow(w.id, { type: e.target.value })} />
                          <input placeholder={st.notePh} value={w.note} onChange={(e) => updateWindow(w.id, { note: e.target.value })} />
                        </div>
                        <button type="button" className="fs-remove" title={st.remove} onClick={() => removeWindow(w.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="fs-section">
                <h2 className="fs-section-title">{st.contactsTitle} <span className="fs-count fs-count-con">{draft.config.contacts.length}</span></h2>
                {draft.config.contacts.length === 0 ? (
                  <p className="fs-muted">{st.contactsEmpty}</p>
                ) : (
                  <div className="fs-marker-list">
                    {draft.config.contacts.map((c, i) => (
                      <div key={c.id} className={['fs-marker-row', selectedId === c.id && 'is-selected'].filter(Boolean).join(' ')} onMouseEnter={() => setSelectedId(c.id)}>
                        <span className="fs-marker-num fs-num-con">{i + 1}</span>
                        <div className="fs-marker-fields">
                          <input list="fs-contact-purposes" placeholder={st.contactPurposePh} value={c.purpose} onChange={(e) => updateContact(c.id, { purpose: e.target.value })} />
                          <input list="fs-contact-types" placeholder={st.contactTypePh} value={c.ctype} onChange={(e) => updateContact(c.id, { ctype: e.target.value })} />
                          <input placeholder={st.notePh} value={c.note} onChange={(e) => updateContact(c.id, { note: e.target.value })} />
                        </div>
                        <button type="button" className="fs-remove" title={st.remove} onClick={() => removeContact(c.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="fs-section">
              <h2 className="fs-section-title">{st.specsTitle}</h2>
              <p className="fs-muted">{st.specsHint}</p>
              <div className="fs-import">
                <textarea rows="3" placeholder={st.importPlaceholder} value={importText} onChange={(e) => setImportText(e.target.value)} />
                <button type="button" className="fs-btn fs-btn-sm" onClick={importSummary} disabled={!importText.trim()}>{st.importButton}</button>
              </div>
              <div className="fs-spec-head">
                <span>{st.specLabel}</span>
                <span>{st.specValue}</span>
                <span />
              </div>
              <div className="fs-spec-list">
                {draft.config.specs.map((s) => (
                  <div key={s.id} className="fs-spec-row">
                    <input value={s.label} onChange={(e) => updateSpec(s.id, { label: e.target.value })} />
                    <input value={s.value} onChange={(e) => updateSpec(s.id, { value: e.target.value })} />
                    <button type="button" className="fs-remove" title={st.remove} onClick={() => removeSpec(s.id)}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="fs-btn fs-btn-sm fs-add" onClick={addSpecRow}>+ {st.addRow}</button>
            </section>

            <section className="fs-section">
              <h2 className="fs-section-title">{st.notesTitle}</h2>
              <textarea className="fs-notes" rows="4" placeholder={st.notesPh} value={draft.config.notes} onChange={(e) => patchConfig({ notes: e.target.value })} />
            </section>
          </main>
        </div>
      )}
    </AdminShell>
  )
}
