// src/pages/FAQPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { m } from 'framer-motion'

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

// One question and its answer.
//
// THE ANSWER IS ALWAYS IN THE DOM, collapsed with height rather than unmounted. It used to
// be `{open && <answer>}`, which meant a closed answer did not exist in the HTML at all —
// and this page ships FAQPage structured data declaring all six answers. Google requires
// content asserted in FAQPage markup to be present on the page, so the schema was claiming
// text no crawler could find: markup ignored at best, a manual action at worst. It also left
// the whole FAQ page prerendering to ~540 characters.
//
// Collapsed-behind-an-accordion is explicitly fine — Google indexes content in expandable
// sections. Absent from the HTML is not.
function QAItem({ q, a, tag, hidden = false }) {
  const [open, setOpen] = useState(false)
  const answerId = React.useId()

  return (
    <div className={'faqp-item' + (open ? ' open' : '') + (hidden ? ' is-filtered' : '')}>
      <button
        type="button"
        className="faqp-q"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={answerId}
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

      {/* Rendered whether or not it is open; only its height changes. aria-hidden keeps a
          screen reader from reading every collapsed answer, which is safe here because the
          answers are plain strings with nothing focusable in them. */}
      <m.div
        id={answerId}
        className="faqp-a"
        aria-hidden={!open}
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ overflow: 'hidden' }}
      >
        <div className="faqp-a-inner">{a}</div>
      </m.div>
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

  // EVERY question is rendered, every time; the tab and the search box only decide which are
  // shown. Filtering the array instead meant the page loaded on its first tab with two of
  // the six questions in the DOM — while the FAQPage markup below declared all six. Schema
  // has to describe content the page actually contains, and hiding the rest with CSS is the
  // accepted way to do that: Google indexes content behind tabs and accordions.
  const list = useMemo(() => {
    const all = groups.flatMap((group, index) => {
      const arr = Array.isArray(group?.items) ? group.items : []
      return arr.map((item) => ({ ...item, _group: String(index), _tag: group?.title || '' }))
    })

    const ql = query.trim().toLowerCase()

    return all.map((item) => ({
      ...item,
      _visible: (tab === ALL_KEY || item._group === tab)
        && (!ql || `${item.q || ''} ${item.a || ''}`.toLowerCase().includes(ql)),
    }))
  }, [groups, tab, query])

  const visibleCount = list.filter((item) => item._visible).length

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
              {visibleCount === 0 && (
                <div style={{ opacity: 0.75, paddingTop: 8 }}>{content.noResultsText}</div>
              )}

              {list.map((item, i) => (
                <QAItem
                  // Keyed on the question rather than the tab, so switching tabs hides and
                  // shows the same elements instead of remounting them — which would reset
                  // every answer somebody had opened.
                  key={`${item.q || 'q'}-${i}`}
                  q={item.q}
                  a={item.a}
                  tag={tab === ALL_KEY ? item._tag : ''}
                  hidden={!item._visible}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
