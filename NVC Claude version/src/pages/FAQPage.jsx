// src/pages/FAQPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'

const ALL_KEY = '__all__'

function Segmented({ options, value, onChange, ariaLabel }) {
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
        )}
      )}
    </div>
  )
}

function FilterSelect({ options, value, onChange, label }) {
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

function QAItem({ q, a, tag }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={'faqp-item' + (open ? ' open' : '')}>
      <button
        type="button"
        className="faqp-q"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="faqp-qwrap">
          {tag ? <span className="faqp-tag">{tag}</span> : null}
          <span className="faqp-qtext">{q}</span>
        </span>

        <m.span
          aria-hidden="true"
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="chev"
        >
          ⌄
        </m.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            className="faqp-a"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="faqp-a-inner">{a}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQPage({ content }) {
  const groups = Array.isArray(content?.groups) ? content.groups : []

  const options = useMemo(() => {
    const allLabel = content?.allLabel || 'All'
    const prefix = content?.categoryFallbackPrefix || 'Category'
    const out = [{ key: ALL_KEY, label: allLabel }]

    for (let i = 0; i < groups.length; i += 1) {
      out.push({
        key: String(i),
        label: groups[i]?.title || `${prefix} ${i + 1}`,
      })
    }

    return out
  }, [groups, content?.allLabel, content?.categoryFallbackPrefix])

  const [tab, setTab] = useState(() => (groups.length ? '0' : ALL_KEY))
  const [query, setQuery] = useState('')

  useEffect(() => {
    const keys = new Set(options.map((o) => o.key))
    setTab((prev) => (keys.has(prev) ? prev : (groups.length ? '0' : ALL_KEY)))
  }, [options, groups.length])

  const list = useMemo(() => {
    let items = []

    if (tab === ALL_KEY) {
      items = groups.flatMap((group) => {
        const arr = Array.isArray(group?.items) ? group.items : []
        return arr.map((item) => ({ ...item, _tag: group?.title || '' }))
      })
    } else {
      const idx = Number(tab)
      const group = groups[idx] || groups[0]
      const arr = Array.isArray(group?.items) ? group.items : []
      items = arr.map((item) => ({ ...item, _tag: '' }))
    }

    if (query.trim()) {
      const ql = query.toLowerCase()
      items = items.filter((item) => `${item.q || ''} ${item.a || ''}`.toLowerCase().includes(ql))
    }

    return items
  }, [groups, tab, query])

  return (
    <main className="arx">
      <section>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(28px,4vw,40px)', margin: 0 }}>{content.heading}</h1>

          <div className="card p-6 mt-6">
            <div className="faqp-top">
              <Segmented
                options={options}
                value={tab}
                onChange={setTab}
                ariaLabel={content.categoriesAria}
              />

              <FilterSelect
                options={options}
                value={tab}
                onChange={setTab}
                label={content.categoryLabel}
              />

              <div className="faqp-search">
                <input
                  type="search"
                  placeholder={content.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={content.searchAria}
                />
              </div>
            </div>

            <div className="faqp-list">
              {list.length === 0 && (
                <div style={{ opacity: 0.75, paddingTop: 8 }}>{content.noResultsText}</div>
              )}

              {list.map((item, i) => (
                <QAItem
                  key={`${item.q || 'q'}-${tab}-${i}`}
                  q={item.q}
                  a={item.a}
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
