import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'
import SEO from './SEO.jsx'

const ALL_KEY = '__all__'

function Segmented({ options, value, onChange, ariaLabel }){
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            className={'seg-btn' + (active ? ' active' : '')}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function FilterSelect({ options, value, onChange, label }){
  return (
    <div className="faqp-selectWrap">
      <label className="visually-hidden" htmlFor="faqCategorySelect">{label}</label>
      <select
        id="faqCategorySelect"
        className="faqp-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function QAItem({ q, a, tag }){
  const [open, setOpen] = useState(false)

  return (
    <div className={'faqp-item' + (open ? ' open' : '')}>
      <button
        type="button"
        className="faqp-q"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="faqp-qwrap">
          {tag ? <span className="faqp-tag">{tag}</span> : null}
          <span className="faqp-qtext">{q}</span>
        </span>

        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="chev"
        >
          ⌄
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="faqp-a"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="faqp-a-inner">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQPro(){
  const { t, lang } = useI18n()
  const isBg = String(lang).toLowerCase().startsWith('bg')

  const rawGroups = t('faq.groups')
  const groups = Array.isArray(rawGroups) ? rawGroups : []

  const allLabel = isBg ? 'Всички' : 'All'

  // Build stable option keys so we don’t rely on translated titles for state.
  const options = useMemo(() => {
    const out = [{ key: ALL_KEY, label: allLabel }]
    for (let i = 0; i < groups.length; i++) {
      out.push({ key: String(i), label: groups[i]?.title || `${isBg ? 'Категория' : 'Category'} ${i + 1}` })
    }
    return out
  }, [groups, allLabel, isBg])

  // Keep the existing “first category selected” behavior by default.
  const [tab, setTab] = useState(() => (groups.length ? '0' : ALL_KEY))
  const [query, setQuery] = useState('')

  useEffect(() => {
    // If language/groups change, ensure tab still exists.
    const keys = new Set(options.map(o => o.key))
    setTab(prev => (keys.has(prev) ? prev : (groups.length ? '0' : ALL_KEY)))
  }, [options, groups.length])

  const list = useMemo(() => {
    let items = []

    if (tab === ALL_KEY) {
      // Flatten all groups and attach the group title as a tag
      items = groups.flatMap((g) => {
        const arr = Array.isArray(g?.items) ? g.items : []
        return arr.map((it) => ({ ...it, _tag: g?.title || '' }))
      })
    } else {
      const idx = Number(tab)
      const g = groups[idx] || groups[0]
      const arr = Array.isArray(g?.items) ? g.items : []
      items = arr.map((it) => ({ ...it, _tag: '' }))
    }

    if (query.trim()) {
      const ql = query.toLowerCase()
      items = items.filter((x) => (`${x.q || ''} ${x.a || ''}`).toLowerCase().includes(ql))
    }

    return items
  }, [groups, tab, query])

  const searchPlaceholder =
    (typeof t('faq.search') === 'string' && t('faq.search')) ||
    (isBg ? 'Търсене…' : 'Search…')

  const noResultsText =
    (typeof t('faq.noResults') === 'string' && t('faq.noResults')) ||
    (isBg ? 'Няма резултати.' : 'No results.')

  return (
    <main className="arx">
      <SEO
        title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
        description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
        image="../../public/logo3"
        url="https://nvc-home4you.eu/faq"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/faq' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/faq' },
        ]}
      />

      <section>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(28px,4vw,40px)', margin: 0 }}>{t('faq.heading')}</h1>

          <div className="card p-6 mt-6">
            <div className="faqp-top">
              {/* Desktop */}
              <Segmented
                options={options}
                value={tab}
                onChange={setTab}
                ariaLabel={isBg ? 'Категории ЧЗВ' : 'FAQ categories'}
              />

              {/* Mobile (CSS shows this only on small screens) */}
              <FilterSelect
                options={options}
                value={tab}
                onChange={setTab}
                label={isBg ? 'Категория' : 'Category'}
              />

              <div className="faqp-search">
                <input
                  type="search"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={isBg ? 'Търси в ЧЗВ' : 'Search FAQ'}
                />
              </div>
            </div>

            <div className="faqp-list">
              {list.length === 0 && <div style={{ opacity: 0.75, paddingTop: 8 }}>{noResultsText}</div>}

              {list.map((item, i) => (
                <QAItem
                  key={`${item.q || 'q'}-${tab}-${i}`}
                  q={item.q}
                  a={item.a}
                  // Show category tag only in "All" mode (and CSS hides it on mobile)
                  tag={tab === ALL_KEY ? item._tag : ''}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
