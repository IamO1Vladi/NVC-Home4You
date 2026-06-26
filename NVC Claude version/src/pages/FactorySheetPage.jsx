import React from 'react'
import SEO from '../components/SEO.jsx'
import '../style/FactorySheet.css'

// ---------------------------------------------------------------------------
// Internal factory order sheet.
// Hidden tool (not linked, not in the sitemap, noindex) for preparing the
// configuration we hand to the factory: upload a floor plan, drop window and
// electrical-contact markers on it, transcribe what the client chose in the
// public configurator, then print / save as PDF.
//
// The password is a light gate to keep casual visitors out. Because this is a
// static front-end, the value ships in the JS bundle — it is NOT real security.
// Change it by setting VITE_INTERNAL_PASSWORD at build time, or edit the
// fallback below.
// ---------------------------------------------------------------------------
const PASSWORD = import.meta.env.VITE_INTERNAL_PASSWORD || 'nvc-factory-2025'
const UNLOCK_KEY = 'nvc_factory_unlock_v1'
const STORAGE_KEY = 'nvc_factory_sheet_v1'

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

const L = {
  bg: {
    htmlLang: 'bg',
    appTitle: 'Фабрична поръчка',
    appSubtitle: 'Вътрешен лист за конфигурация към фабриката',
    print: 'Принтирай / PDF',
    reset: 'Изчисти всичко',
    resetConfirm: 'Да изчистя ли целия лист? Това не може да се върне.',
    // gate
    gateTitle: 'Вътрешен достъп',
    gateHint: 'Въведете паролата, за да отворите листа за фабрична поръчка.',
    gatePlaceholder: 'Парола',
    gateButton: 'Вход',
    gateError: 'Грешна парола.',
    logout: 'Изход',
    saveFile: 'Запази файл',
    openFile: 'Отвори файл',
    importConfirm: 'Това ще замени текущия лист. Да продължа ли?',
    importError: 'Файлът не може да се прочете.',
    // order details
    detailsTitle: 'Данни за поръчката',
    client: 'Клиент',
    project: 'Проект / Модел',
    reference: 'Референтен №',
    date: 'Дата',
    // plan
    planTitle: 'План на къщата',
    planUpload: 'Качете изображение на плана',
    planHint: 'JPG или PNG. След качване кликнете върху плана, за да добавяте маркери.',
    planReplace: 'Смени изображението',
    planRemove: 'Премахни плана',
    modeWindow: 'Добавяй прозорци',
    modeContact: 'Добавяй контакти',
    modeHint: 'Изберете режим, после кликнете върху плана. Кликнете маркер, за да го изберете.',
    noPlan: 'Все още няма качен план.',
    // windows
    windowsTitle: 'Прозорци',
    windowsEmpty: 'Няма добавени прозорци. Изберете „Добавяй прозорци“ и кликнете върху плана.',
    windowType: 'Тип / размер',
    windowTypePh: 'напр. 1200×950, панорамен…',
    note: 'Бележка',
    notePh: 'по избор',
    remove: 'Премахни',
    // contacts
    contactsTitle: 'Контакти (ел. инсталация)',
    contactsEmpty: 'Няма добавени контакти. Изберете „Добавяй контакти“ и кликнете върху плана.',
    contactPurpose: 'За какво е',
    contactPurposePh: 'напр. кухня, ТВ стена…',
    contactType: 'Тип',
    contactTypePh: 'напр. двоен контакт…',
    // specs
    specsTitle: 'Избор от конфигуратора',
    specsHint: 'Тук впишете какво е избрал клиентът. Можете да поставите копираното обобщение от конфигуратора и да натиснете „Внеси“.',
    importPlaceholder: 'Поставете тук копираното обобщение от конфигуратора (Етикет: Стойност на всеки ред)…',
    importButton: 'Внеси от обобщение',
    specLabel: 'Параметър',
    specValue: 'Стойност',
    addRow: 'Добави ред',
    // notes
    notesTitle: 'Общи бележки',
    notesPh: 'Допълнителни инструкции към фабриката…',
    // print sheet
    sheetTitle: 'Лист за фабрична поръчка',
    printWindows: 'Прозорци',
    printContacts: 'Контакти',
    printPlan: 'План с маркери',
    printSpecs: 'Конфигурация',
    printNotes: 'Бележки',
    generatedOn: 'Генерирано на',
    legendWindows: 'Прозорци (синьо-зелено)',
    legendContacts: 'Контакти (тъмно)',
    printBlocked: 'Браузърът блокира прозореца за печат. Разрешете изскачащите прозорци.',
    windowShort: 'П',
    contactShort: 'К',
    windowTypes: ['1000×950 (стандартен)', '1200×950', '1400×950', 'Панорамен / френски', 'Фиксиран', 'Двукрилен', 'По поръчка'],
    contactPurposes: ['Кухня', 'ТВ стена', 'Баня', 'Тераса / външен', 'Климатик', 'Бойлер', 'Осветление', 'Пералня', 'Хладилник', 'Интернет / мрежа'],
    contactTypes: ['Единичен контакт', 'Двоен контакт', 'Троен контакт', 'USB контакт', 'Мрежов (RJ45)', 'ТВ извод', 'Ключ осветление', 'Кабелен извод'],
    specSeed: ['Модел', 'Вариант', 'Разпределение', 'Дограма', 'Тип прозорец', 'Външна врата', 'Външни панели', 'Цвят декинг', 'Вътрешни панели', 'Подова настилка', 'Кухненски плот', 'Баня', 'Кухня', 'Вътрешни врати', 'Брой вътрешни врати', 'Отопление', 'Размер прозорци', 'Обща стойност'],
  },
  en: {
    htmlLang: 'en',
    appTitle: 'Factory order',
    appSubtitle: 'Internal configuration sheet for the factory',
    print: 'Print / PDF',
    reset: 'Clear everything',
    resetConfirm: 'Clear the whole sheet? This cannot be undone.',
    gateTitle: 'Internal access',
    gateHint: 'Enter the password to open the factory order sheet.',
    gatePlaceholder: 'Password',
    gateButton: 'Enter',
    gateError: 'Wrong password.',
    logout: 'Log out',
    saveFile: 'Save file',
    openFile: 'Open file',
    importConfirm: 'This will replace the current sheet. Continue?',
    importError: 'Could not read this file.',
    detailsTitle: 'Order details',
    client: 'Client',
    project: 'Project / Model',
    reference: 'Reference no.',
    date: 'Date',
    planTitle: 'House plan',
    planUpload: 'Upload a plan image',
    planHint: 'JPG or PNG. After uploading, click the plan to drop markers.',
    planReplace: 'Replace image',
    planRemove: 'Remove plan',
    modeWindow: 'Add windows',
    modeContact: 'Add contacts',
    modeHint: 'Pick a mode, then click the plan. Click a marker to select it.',
    noPlan: 'No plan uploaded yet.',
    windowsTitle: 'Windows',
    windowsEmpty: 'No windows yet. Choose “Add windows” and click the plan.',
    windowType: 'Type / size',
    windowTypePh: 'e.g. 1200×950, panoramic…',
    note: 'Note',
    notePh: 'optional',
    remove: 'Remove',
    contactsTitle: 'Contacts (electrical)',
    contactsEmpty: 'No contacts yet. Choose “Add contacts” and click the plan.',
    contactPurpose: 'What it is for',
    contactPurposePh: 'e.g. kitchen, TV wall…',
    contactType: 'Type',
    contactTypePh: 'e.g. double socket…',
    specsTitle: 'Configurator selections',
    specsHint: 'Enter what the client chose. You can paste the copied configurator summary and press “Import”.',
    importPlaceholder: 'Paste the copied configurator summary here (Label: Value per line)…',
    importButton: 'Import from summary',
    specLabel: 'Parameter',
    specValue: 'Value',
    addRow: 'Add row',
    notesTitle: 'General notes',
    notesPh: 'Extra instructions for the factory…',
    sheetTitle: 'Factory order sheet',
    printWindows: 'Windows',
    printContacts: 'Contacts',
    printPlan: 'Plan with markers',
    printSpecs: 'Configuration',
    printNotes: 'Notes',
    generatedOn: 'Generated on',
    legendWindows: 'Windows (teal)',
    legendContacts: 'Contacts (dark)',
    printBlocked: 'The browser blocked the print window. Allow pop-ups.',
    windowShort: 'W',
    contactShort: 'C',
    windowTypes: ['1000×950 (standard)', '1200×950', '1400×950', 'Panoramic / French', 'Fixed', 'Double', 'Custom'],
    contactPurposes: ['Kitchen', 'TV wall', 'Bathroom', 'Terrace / exterior', 'Air conditioner', 'Boiler', 'Lighting', 'Washing machine', 'Fridge', 'Internet / network'],
    contactTypes: ['Single socket', 'Double socket', 'Triple socket', 'USB socket', 'Network (RJ45)', 'TV outlet', 'Light switch', 'Cable outlet'],
    specSeed: ['Model', 'Variant', 'Layout', 'Window frame', 'Window style', 'Exterior door', 'Outside panels', 'Decking colour', 'Interior panels', 'Floor finish', 'Kitchen bench', 'Bathroom', 'Kitchen', 'Inside doors', 'Inside door count', 'Heating', 'Window size', 'Known total'],
  },
}

function seedSpecs(lang) {
  return L[lang].specSeed.map((label, i) => ({ id: `s-${i}`, label, value: '' }))
}

function todayIso() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

function freshConfig(lang) {
  return {
    client: '',
    project: '',
    reference: '',
    date: todayIso(),
    planImage: '',
    planName: '',
    windows: [],
    contacts: [],
    specs: seedSpecs(lang),
    notes: '',
  }
}

function loadState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function persistState(lang, config) {
  if (typeof window === 'undefined') return
  const payload = { lang, config }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Most likely the plan data URL blew the quota — keep the text, drop the image.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, config: { ...config, planImage: '' } }))
    } catch {
      // give up silently
    }
  }
}

function PasswordGate({ lang, onUnlock }) {
  const t = L[lang]
  const [value, setValue] = React.useState('')
  const [error, setError] = React.useState(false)

  function submit(e) {
    e.preventDefault()
    if (value === PASSWORD) {
      try { window.sessionStorage.setItem(UNLOCK_KEY, '1') } catch { /* ignore */ }
      onUnlock()
    } else {
      setError(true)
    }
  }

  return (
    <div className="fs-gate">
      <form className="fs-gate-card" onSubmit={submit}>
        <div className="fs-gate-title">{t.gateTitle}</div>
        <p className="fs-gate-hint">{t.gateHint}</p>
        <input
          type="password"
          autoFocus
          value={value}
          placeholder={t.gatePlaceholder}
          onChange={(e) => { setValue(e.target.value); setError(false) }}
        />
        {error ? <div className="fs-gate-error">{t.gateError}</div> : null}
        <button type="submit" className="fs-btn fs-btn-primary">{t.gateButton}</button>
      </form>
    </div>
  )
}

function PlanCanvas({ image, windows, contacts, mode, selectedId, onAdd, onSelect }) {
  function handleClick(event) {
    if (!image || !mode) return
    const rect = event.currentTarget.getBoundingClientRect()
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

export default function FactorySheetPage() {
  const saved = React.useMemo(loadState, [])
  const [lang, setLang] = React.useState(saved?.lang === 'en' ? 'en' : 'bg')
  const [unlocked, setUnlocked] = React.useState(() => {
    if (typeof window === 'undefined') return false
    try { return window.sessionStorage.getItem(UNLOCK_KEY) === '1' } catch { return false }
  })
  const [config, setConfig] = React.useState(() => saved?.config || freshConfig(saved?.lang === 'en' ? 'en' : 'bg'))
  const [mode, setMode] = React.useState('window')
  const [selectedId, setSelectedId] = React.useState(null)
  const [importText, setImportText] = React.useState('')
  const fileRef = React.useRef(null)
  const jsonRef = React.useRef(null)

  const t = L[lang]

  React.useEffect(() => {
    persistState(lang, config)
  }, [lang, config])

  // When the user flips language and nothing has been typed into the spec rows
  // yet, re-seed the template labels in the new language.
  function switchLang(next) {
    setLang(next)
    setConfig((prev) => {
      const untouched = prev.specs.every((row) => !row.value && L.bg.specSeed.concat(L.en.specSeed).includes(row.label))
      if (!untouched) return prev
      return { ...prev, specs: seedSpecs(next) }
    })
  }

  function update(patch) {
    setConfig((prev) => ({ ...prev, ...patch }))
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update({ planImage: String(reader.result || ''), planName: file.name })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function addMarker(point) {
    const id = `${mode}-${Date.now()}`
    if (mode === 'window') {
      setConfig((prev) => ({ ...prev, windows: [...prev.windows, { id, x: point.x, y: point.y, type: '', note: '' }] }))
    } else {
      setConfig((prev) => ({ ...prev, contacts: [...prev.contacts, { id, x: point.x, y: point.y, purpose: '', ctype: '', note: '' }] }))
    }
    setSelectedId(id)
  }

  function updateWindow(id, patch) {
    setConfig((prev) => ({ ...prev, windows: prev.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) }))
  }
  function removeWindow(id) {
    setConfig((prev) => ({ ...prev, windows: prev.windows.filter((w) => w.id !== id) }))
  }
  function updateContact(id, patch) {
    setConfig((prev) => ({ ...prev, contacts: prev.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  }
  function removeContact(id) {
    setConfig((prev) => ({ ...prev, contacts: prev.contacts.filter((c) => c.id !== id) }))
  }

  function updateSpec(id, patch) {
    setConfig((prev) => ({ ...prev, specs: prev.specs.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  }
  function addSpecRow() {
    setConfig((prev) => ({ ...prev, specs: [...prev.specs, { id: `s-${Date.now()}`, label: '', value: '' }] }))
  }
  function removeSpec(id) {
    setConfig((prev) => ({ ...prev, specs: prev.specs.filter((s) => s.id !== id) }))
  }

  function importSummary() {
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean)
    const rows = []
    lines.forEach((line, i) => {
      const idx = line.indexOf(':')
      if (idx > 0) {
        rows.push({ id: `imp-${Date.now()}-${i}`, label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() })
      } else {
        rows.push({ id: `imp-${Date.now()}-${i}`, label: '', value: line })
      }
    })
    if (rows.length) {
      update({ specs: rows })
      setImportText('')
    }
  }

  // Save the whole sheet (including the plan image) to a portable .json file the
  // colleague can open and keep editing.
  function exportFile() {
    const payload = { app: 'nvc-factory-sheet', version: 1, savedAt: new Date().toISOString(), lang, config }
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

  function normalizeMarkers(arr, prefix) {
    if (!Array.isArray(arr)) return []
    return arr.map((m, i) => ({ ...m, id: m?.id || `${prefix}-${Date.now()}-${i}`, x: Number(m?.x) || 0, y: Number(m?.y) || 0 }))
  }

  function normalizeConfig(raw) {
    const base = freshConfig(lang)
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

  function importFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const hasContent = config.windows.length || config.contacts.length || config.planImage ||
      config.notes || config.client || config.project || config.reference || config.specs.some((s) => s.value)
    if (hasContent && !window.confirm(t.importConfirm)) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''))
        const data = parsed && typeof parsed === 'object' && parsed.config ? parsed : { config: parsed }
        setConfig(normalizeConfig(data.config))
        if (data.lang === 'en' || data.lang === 'bg') setLang(data.lang)
        setSelectedId(null)
        setImportText('')
      } catch {
        window.alert(t.importError)
      }
    }
    reader.readAsText(file)
  }

  function resetAll() {
    if (!window.confirm(t.resetConfirm)) return
    setConfig(freshConfig(lang))
    setSelectedId(null)
    setImportText('')
  }

  function logout() {
    try { window.sessionStorage.removeItem(UNLOCK_KEY) } catch { /* ignore */ }
    setUnlocked(false)
  }

  function printSheet() {
    const popup = window.open('', 'nvc-factory-sheet-print', 'width=1120,height=1500')
    if (!popup) {
      window.alert(t.printBlocked)
      return
    }
    try { popup.opener = null } catch { /* ignore */ }

    const detailRows = [
      [t.client, config.client],
      [t.project, config.project],
      [t.reference, config.reference],
      [t.date, config.date],
    ].filter(([, v]) => v)

    const windowDots = config.windows
      .map((w, i) => `<span class="dot dot-win" style="left:${w.x}%;top:${w.y}%">${i + 1}</span>`)
      .join('')
    const contactDots = config.contacts
      .map((c, i) => `<span class="dot dot-con" style="left:${c.x}%;top:${c.y}%">${i + 1}</span>`)
      .join('')

    const windowList = config.windows.length
      ? config.windows.map((w, i) => `<li><b>${t.windowShort}${i + 1}</b> ${escapeHtml(w.type || '—')}${w.note ? ` <span class="muted">· ${escapeHtml(w.note)}</span>` : ''}</li>`).join('')
      : `<li class="muted">—</li>`
    const contactList = config.contacts.length
      ? config.contacts.map((c, i) => `<li><b>${t.contactShort}${i + 1}</b> ${escapeHtml(c.purpose || '—')}${c.ctype ? ` <span class="muted">(${escapeHtml(c.ctype)})</span>` : ''}${c.note ? ` <span class="muted">· ${escapeHtml(c.note)}</span>` : ''}</li>`).join('')
      : `<li class="muted">—</li>`

    const specRows = config.specs
      .filter((s) => s.label || s.value)
      .map((s) => `<div class="row"><div class="k">${escapeHtml(s.label || '—')}</div><div class="v">${escapeHtml(s.value || '—')}</div></div>`)
      .join('')

    const detailChips = detailRows
      .map(([k, v]) => `<span class="chip"><span class="chip-k">${escapeHtml(k)}</span>${escapeHtml(v)}</span>`)
      .join('')

    popup.document.open()
    popup.document.write(`<!doctype html>
<html lang="${escapeHtml(t.htmlLang)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t.sheetTitle)}${config.reference ? ` · ${escapeHtml(config.reference)}` : ''}</title>
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
        <h1 class="title">${escapeHtml(t.sheetTitle)}</h1>
        <p class="sub">${escapeHtml(t.appSubtitle)}</p>
      </div>
    </div>
    ${detailChips ? `<div class="chips">${detailChips}</div>` : ''}

    ${config.planImage ? `
    <h2>${escapeHtml(t.printPlan)}</h2>
    <div class="plan-shell">
      <div class="plan-canvas">
        <img src="${config.planImage}" alt="" />
        ${windowDots}
        ${contactDots}
      </div>
    </div>
    <div class="legend">
      <span><span class="key" style="background:#0d9488"></span>${escapeHtml(t.legendWindows)}</span>
      <span><span class="key" style="background:#1f2937"></span>${escapeHtml(t.legendContacts)}</span>
    </div>` : ''}

    <div class="cols">
      <div>
        <h2>${escapeHtml(t.printWindows)} (${config.windows.length})</h2>
        <ul class="list">${windowList}</ul>
      </div>
      <div>
        <h2>${escapeHtml(t.printContacts)} (${config.contacts.length})</h2>
        <ul class="list">${contactList}</ul>
      </div>
    </div>

    ${specRows ? `<h2>${escapeHtml(t.printSpecs)}</h2>${specRows}` : ''}

    ${config.notes ? `<h2>${escapeHtml(t.printNotes)}</h2><div class="notes">${multilineHtml(config.notes)}</div>` : ''}

    <div class="foot">${escapeHtml(`${t.generatedOn}: ${new Date().toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB')}`)}</div>
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

  return (
    <div className="fs-root">
      <SEO title="NVC · Factory order sheet" noindex locale={lang} />

      {!unlocked ? (
        <PasswordGate lang={lang} onUnlock={() => setUnlocked(true)} />
      ) : (
        <>
          <datalist id="fs-window-types">{t.windowTypes.map((o) => <option key={o} value={o} />)}</datalist>
          <datalist id="fs-contact-purposes">{t.contactPurposes.map((o) => <option key={o} value={o} />)}</datalist>
          <datalist id="fs-contact-types">{t.contactTypes.map((o) => <option key={o} value={o} />)}</datalist>
          <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={importFile} />

          <header className="fs-topbar">
            <div className="fs-topbar-title">
              <strong>{t.appTitle}</strong>
              <span>{t.appSubtitle}</span>
            </div>
            <div className="fs-topbar-actions">
              <div className="fs-lang">
                <button type="button" className={lang === 'bg' ? 'is-active' : ''} onClick={() => switchLang('bg')}>BG</button>
                <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => switchLang('en')}>EN</button>
              </div>
              <button type="button" className="fs-btn" onClick={() => jsonRef.current?.click()}>{t.openFile}</button>
              <button type="button" className="fs-btn" onClick={exportFile}>{t.saveFile}</button>
              <button type="button" className="fs-btn" onClick={resetAll}>{t.reset}</button>
              <button type="button" className="fs-btn fs-btn-primary" onClick={printSheet}>{t.print}</button>
              <button type="button" className="fs-btn fs-btn-ghost" onClick={logout}>{t.logout}</button>
            </div>
          </header>

          <main className="fs-main">
            {/* Order details */}
            <section className="fs-section">
              <h2 className="fs-section-title">{t.detailsTitle}</h2>
              <div className="fs-grid-4">
                <label className="fs-field"><span>{t.client}</span><input value={config.client} onChange={(e) => update({ client: e.target.value })} /></label>
                <label className="fs-field"><span>{t.project}</span><input value={config.project} onChange={(e) => update({ project: e.target.value })} /></label>
                <label className="fs-field"><span>{t.reference}</span><input value={config.reference} onChange={(e) => update({ reference: e.target.value })} /></label>
                <label className="fs-field"><span>{t.date}</span><input type="date" value={config.date} onChange={(e) => update({ date: e.target.value })} /></label>
              </div>
            </section>

            {/* Plan + markers */}
            <section className="fs-section">
              <h2 className="fs-section-title">{t.planTitle}</h2>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

              {!config.planImage ? (
                <button type="button" className="fs-dropzone" onClick={() => fileRef.current?.click()}>
                  <span className="fs-dropzone-icon">⬆</span>
                  <strong>{t.planUpload}</strong>
                  <span className="fs-muted">{t.planHint}</span>
                </button>
              ) : (
                <>
                  <div className="fs-plan-toolbar">
                    <div className="fs-mode">
                      <button type="button" className={mode === 'window' ? 'is-active is-win' : ''} onClick={() => setMode('window')}>{t.modeWindow}</button>
                      <button type="button" className={mode === 'contact' ? 'is-active is-con' : ''} onClick={() => setMode('contact')}>{t.modeContact}</button>
                    </div>
                    <div className="fs-plan-toolbar-right">
                      <button type="button" className="fs-btn fs-btn-sm" onClick={() => fileRef.current?.click()}>{t.planReplace}</button>
                      <button type="button" className="fs-btn fs-btn-sm fs-btn-ghost" onClick={() => update({ planImage: '', planName: '' })}>{t.planRemove}</button>
                    </div>
                  </div>
                  <p className="fs-muted fs-mode-hint">{t.modeHint}</p>
                  <PlanCanvas
                    image={config.planImage}
                    windows={config.windows}
                    contacts={config.contacts}
                    mode={mode}
                    selectedId={selectedId}
                    onAdd={addMarker}
                    onSelect={setSelectedId}
                  />
                </>
              )}
            </section>

            <div className="fs-grid-2">
              {/* Windows */}
              <section className="fs-section">
                <h2 className="fs-section-title">{t.windowsTitle} <span className="fs-count fs-count-win">{config.windows.length}</span></h2>
                {config.windows.length === 0 ? (
                  <p className="fs-muted">{t.windowsEmpty}</p>
                ) : (
                  <div className="fs-marker-list">
                    {config.windows.map((w, i) => (
                      <div key={w.id} className={['fs-marker-row', selectedId === w.id && 'is-selected'].filter(Boolean).join(' ')} onMouseEnter={() => setSelectedId(w.id)}>
                        <span className="fs-marker-num fs-num-win">{i + 1}</span>
                        <div className="fs-marker-fields">
                          <input list="fs-window-types" placeholder={t.windowTypePh} value={w.type} onChange={(e) => updateWindow(w.id, { type: e.target.value })} />
                          <input placeholder={t.notePh} value={w.note} onChange={(e) => updateWindow(w.id, { note: e.target.value })} />
                        </div>
                        <button type="button" className="fs-remove" title={t.remove} onClick={() => removeWindow(w.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Contacts */}
              <section className="fs-section">
                <h2 className="fs-section-title">{t.contactsTitle} <span className="fs-count fs-count-con">{config.contacts.length}</span></h2>
                {config.contacts.length === 0 ? (
                  <p className="fs-muted">{t.contactsEmpty}</p>
                ) : (
                  <div className="fs-marker-list">
                    {config.contacts.map((c, i) => (
                      <div key={c.id} className={['fs-marker-row', selectedId === c.id && 'is-selected'].filter(Boolean).join(' ')} onMouseEnter={() => setSelectedId(c.id)}>
                        <span className="fs-marker-num fs-num-con">{i + 1}</span>
                        <div className="fs-marker-fields">
                          <input list="fs-contact-purposes" placeholder={t.contactPurposePh} value={c.purpose} onChange={(e) => updateContact(c.id, { purpose: e.target.value })} />
                          <input list="fs-contact-types" placeholder={t.contactTypePh} value={c.ctype} onChange={(e) => updateContact(c.id, { ctype: e.target.value })} />
                          <input placeholder={t.notePh} value={c.note} onChange={(e) => updateContact(c.id, { note: e.target.value })} />
                        </div>
                        <button type="button" className="fs-remove" title={t.remove} onClick={() => removeContact(c.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Configurator selections */}
            <section className="fs-section">
              <h2 className="fs-section-title">{t.specsTitle}</h2>
              <p className="fs-muted">{t.specsHint}</p>
              <div className="fs-import">
                <textarea rows="3" placeholder={t.importPlaceholder} value={importText} onChange={(e) => setImportText(e.target.value)} />
                <button type="button" className="fs-btn fs-btn-sm" onClick={importSummary} disabled={!importText.trim()}>{t.importButton}</button>
              </div>
              <div className="fs-spec-head">
                <span>{t.specLabel}</span>
                <span>{t.specValue}</span>
                <span />
              </div>
              <div className="fs-spec-list">
                {config.specs.map((s) => (
                  <div key={s.id} className="fs-spec-row">
                    <input value={s.label} onChange={(e) => updateSpec(s.id, { label: e.target.value })} />
                    <input value={s.value} onChange={(e) => updateSpec(s.id, { value: e.target.value })} />
                    <button type="button" className="fs-remove" title={t.remove} onClick={() => removeSpec(s.id)}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="fs-btn fs-btn-sm fs-add" onClick={addSpecRow}>+ {t.addRow}</button>
            </section>

            {/* Notes */}
            <section className="fs-section">
              <h2 className="fs-section-title">{t.notesTitle}</h2>
              <textarea className="fs-notes" rows="4" placeholder={t.notesPh} value={config.notes} onChange={(e) => update({ notes: e.target.value })} />
            </section>
          </main>
        </>
      )}
    </div>
  )
}
