import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, adminUpload, UnauthorizedError } from '../admin/adminApi.js'

// The brochures screen (ROADMAP #16): six documents the public site links, three language
// slots each, and Replace as the only verb. In the owner's words: "these are our current
// catalogues, however we update them from time to time" — which is replacement, not
// authoring. So there is no add, no delete and no retire here; the API refuses the
// dangerous ones anyway, but this screen does not even ask.
//
// The public URL of every slot never changes — replacing writes new bytes behind the same
// address — which is what makes this button safe to press on a document that four pages
// and twelve prerendered snapshots hard-code.

const TEXT = {
  bg: {
    title: 'Брошури',
    subtitle: 'Каталозите, които сайтът показва. Замяната е веднага — адресът не се променя.',
    empty: 'Няма данни. Ако това е нова инсталация, шестте брошури още не са пренесени (import-brochures).',
    replace: 'Замени', upload: 'Качи', uploading: 'Качване…',
    emptyBg: 'Не е качена.',
    emptySlot: 'Няма превод — показва се българското издание.',
    view: 'Преглед',
    pages: 'Показва се на',
    uploadedBy: 'от',
    uploadError: 'Файлът не беше качен.',
    saved: (name) => `Готово — „${name}“ е на сайта.`,
    onlyPdf: 'Брошурите са PDF файлове.',
    langNames: { bg: 'Български', en: 'Английски', el: 'Гръцки' },
    docs: {
      'modular-builds': 'Модулни сгради — общ каталог',
      'standard-containers': 'Стандартни контейнери',
      'villa-office': 'Вила-Офис',
      'sloped-roof': 'Скосен покрив',
      'space-capsules': 'Космически Капсули',
      'box-house': 'Разгъваеми „Бокс“ къща',
    },
    pageNames: {
      'modular-builds': 'Модулни сгради · Стоманени къщи · Интериори',
      'standard-containers': 'Модулни сгради',
      'villa-office': 'Модулни сгради',
      'sloped-roof': 'Модулни сгради',
      'space-capsules': 'Модулни къщи',
      'box-house': 'Модулни къщи',
    },
  },
  en: {
    title: 'Brochures',
    subtitle: 'The catalogues the public site serves. Replacing is instant — the address never changes.',
    empty: 'No data. On a fresh install the six brochures have not been imported yet (import-brochures).',
    replace: 'Replace', upload: 'Upload', uploading: 'Uploading…',
    emptyBg: 'Not uploaded.',
    emptySlot: 'No translation — the Bulgarian edition is served.',
    view: 'View',
    pages: 'Shown on',
    uploadedBy: 'by',
    uploadError: 'The file was not uploaded.',
    saved: (name) => `Done — “${name}” is live.`,
    onlyPdf: 'Brochures are PDF files.',
    langNames: { bg: 'Bulgarian', en: 'English', el: 'Greek' },
    docs: {
      'modular-builds': 'Modular builds — general catalogue',
      'standard-containers': 'Standard containers',
      'villa-office': 'Villa-Office',
      'sloped-roof': 'Sloped roof',
      'space-capsules': 'Space Capsules',
      'box-house': 'Foldable “Box” house',
    },
    pageNames: {
      'modular-builds': 'Modular builds · Steel houses · Interiors',
      'standard-containers': 'Modular builds',
      'villa-office': 'Modular builds',
      'sloped-roof': 'Modular builds',
      'space-capsules': 'Modular houses',
      'box-house': 'Modular houses',
    },
  },
}

// The same picker pattern as the purchase documents: a visually hidden input the button
// beside it operates, so keyboard users get one stop per action and picking the same file
// twice still fires (the input clears itself before the handler runs).
function ReplaceButton({ label, busyLabel, isBusy, disabled, name, onPick }) {
  const picker = React.useRef(null)
  return (
    <>
      {/* accept is the MIME type alone: a literal ".pdf" here would trip the stage-1
          guard test that keeps brochure file names out of page components — and the
          guard's rule matters more than the marginal picker it would help. */}
      <input
        ref={picker}
        type="file"
        accept="application/pdf"
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
        className="btn ghost adm-btn-sm adm-doc-replace"
        disabled={disabled}
        onClick={() => picker.current?.click()}
      >
        {isBusy ? busyLabel : label}
      </button>
    </>
  )
}

// "16.5 MB", not "17301504". The number matters here because a Canva export that skipped
// the compression step announces itself by it.
export function formatSize(bytes, lang = 'bg') {
  if (!bytes || bytes <= 0) return ''
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10
  return `${mb.toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB')} MB`
}

export default function AdminDocumentsPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [docs, setDocs] = React.useState([])
  const [wired, setWired] = React.useState([])
  const [langs, setLangs] = React.useState(['bg', 'en', 'el'])
  const [state, setState] = React.useState('loading')
  const [busy, setBusy] = React.useState(null)       // "slug/lang" of the running upload
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      const data = await adminGet('/api/admin/documents')
      setDocs(data?.documents ?? [])
      setWired(data?.wired ?? [])
      setLangs(data?.langs?.length ? data.langs : ['bg', 'en', 'el'])
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  // The wired six always render, slots and all, even before the import has run — a screen
  // that only shows what has been uploaded cannot show where an upload belongs. Anything
  // non-wired that exists in the table renders after them.
  const slugs = React.useMemo(() => {
    const extra = [...new Set(docs.map((d) => d.slug))].filter((s) => !wired.includes(s))
    return [...wired, ...extra]
  }, [docs, wired])

  const bySlot = React.useMemo(() => {
    const map = new Map()
    for (const d of docs) map.set(`${d.slug}/${d.lang}`, d)
    return map
  }, [docs])

  async function replace(slug, slotLang, file) {
    if (!file) return
    if (!/\.pdf$/i.test(file.name)) { setError(t.onlyPdf); setNotice(''); return }

    const key = `${slug}/${slotLang}`
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await adminUpload(`/api/admin/documents/${slug}/${slotLang}/file`, file)
      setNotice(t.saved(file.name))
      await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.uploadError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="documents"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
    >
      {error ? <div className="adm-alert" role="alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      {slugs.length === 0 ? (
        <div className="adm-card adm-center adm-errbox">
          <p className="adm-muted">{t.empty}</p>
        </div>
      ) : (
        <ul className="adm-grid adm-doc-grid">
          {slugs.map((slug) => (
            <li key={slug} className="adm-card adm-doc">
              <div className="adm-doc-head">
                <h2>{t.docs[slug] ?? slug}</h2>
                {t.pageNames[slug] ? (
                  <p className="adm-small adm-muted">{t.pages}: {t.pageNames[slug]}</p>
                ) : null}
              </div>

              <div className="adm-doc-slots">
                {langs.map((slotLang) => {
                  const doc = bySlot.get(`${slug}/${slotLang}`)
                  const key = `${slug}/${slotLang}`
                  const isBusy = busy === key
                  return (
                    <div key={slotLang} className={`adm-doc-slot${doc?.isActive ? '' : ' is-off'}`}>
                      <span className="adm-small adm-doc-lang">{t.langNames[slotLang] ?? slotLang}</span>

                      {doc ? (
                        <>
                          {/* The live address, so what just got uploaded can be checked in
                              one click — this link serves what a visitor would get. */}
                          <a
                            className="adm-doc-file"
                            href={`/api/brochures/${slug}.pdf?lang=${slotLang}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t.view}
                          >
                            {doc.fileName}
                          </a>
                          <span className="adm-small adm-muted">
                            {formatSize(doc.sizeBytes, lang)}
                            {doc.updatedByUpn ? <> · {t.uploadedBy} {doc.updatedByUpn}</> : null}
                          </span>
                        </>
                      ) : (
                        <span className="adm-small adm-muted">
                          {slotLang === 'bg' ? t.emptyBg : t.emptySlot}
                        </span>
                      )}

                      <ReplaceButton
                        label={doc ? t.replace : t.upload}
                        busyLabel={t.uploading}
                        isBusy={isBusy}
                        disabled={busy !== null}
                        name={`${t.docs[slug] ?? slug} — ${t.langNames[slotLang] ?? slotLang}`}
                        onPick={(file) => replace(slug, slotLang, file)}
                      />
                    </div>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  )
}
