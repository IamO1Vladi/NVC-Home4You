// /bg/chesto-zadavani-vyprosi, „Често задавани въпроси": the site's questions in one place,
// rebuilt 2026-10-16 on the product pages' system (<main class="hp pp fq">: HomePage.css,
// ProductPage.css, then Faq.css for the search and the topic chips). It replaces the old dark
// glass page (framer-motion, ARIA tabs with no tab panels, a separate <select> on phones, three
// answers nothing backed and no link to any other page).
//
// EACH ANSWER IS WRITTEN ONCE; THE HUB GATHERS. Its own questions are content/{locale}/faq.js,
// filled by lib/faqHub.js from the modules. The delivery, partner, internal doors and interiors
// pages' questions are shown here in their pages' words and figures (lib/questions.js), so a
// figure changed in deliveryRates.js changes the page and the hub together. Only the hub's own
// questions are its FAQPage markup; a gathered one is marked up on its own page, once.
//
// EVERY ANSWER IS ALWAYS IN THE DOM. The search and the topic chips only set the `hidden`
// attribute on what they leave out; nothing is unmounted. The FAQPage markup declares every
// one of the hub's questions, and Google requires content asserted in FAQPage markup to be on
// the page: collapsed (a closed <details>) or hidden by a filter is indexed, absent from the
// HTML is not. The old page learned this twice (an answer rendered only when open, and a tab
// that filtered the array), and the prerendered page had about 540 characters.
//
// #q-{id} opens that question and brings it into view, on load and on a hash change, clearing
// a search or a topic that hides it (useQuestionHash). The topic chips are one row of toggle
// buttons at every width, "all" first; on a phone the row scrolls sideways inside itself.
//
// Sections, in order: the hero (no photo); the search, the topics and the count; one section
// per topic, each ending with a link to its page; the other pages; the closing card. The head,
// the breadcrumbs and nothing else are the route's.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/Faq.css'
import ProductHero from '../components/product/ProductHero.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import FinalCta from '../components/FinalCta.jsx'
import { FaqItem, useQuestionHash } from '../components/product/FaqList.jsx'
import { FAQJSONLD } from '../components/StructuredData.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { fill, markedUp } from '../lib/questions.js'
import { hubFigures, hubPath, hubSections } from '../lib/faqHub.js'

export const ALL = 'all'
// How long the count waits after the last keystroke before it changes (and is read out).
const SETTLE_MS = 600

/** Lower case, without accents or the Greek tonos, so "εγγυηση" finds "εγγύηση". */
export const normalize = (text) => String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** True when every word of the query is in the question or its answer. */
export function matches(item, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = normalize(`${item.question} ${item.answer}`)
  return words.every((word) => text.includes(word))
}

const PLURAL_LOCALES = { bg: 'bg', en: 'en', el: 'el' }
const countText = (forms, n, locale) => fill(
  new Intl.PluralRules(PLURAL_LOCALES[locale] || 'en').select(n) === 'one' ? forms.one : forms.other,
  { n },
)

function SearchIcon() {
  return <svg className="fq-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
}
function ClearIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
}

/**
 * @param locale   'bg' | 'en' | 'el'
 * @param content  content/{locale}/faq.js
 * @param pages    { delivery, partner, doors, interiors }: those pages' content in the locale,
 *                 whose questions the hub gathers (the route imports them, not the pages)
 */
export default function FAQPage({ locale = 'bg', content, pages }) {
  const { openQuestion } = useModalActions()
  const c = content
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState(ALL)
  const inputRef = useRef(null)

  const sections = useMemo(() => (c ? hubSections(locale, c, pages || {}) : []), [locale, c, pages])
  // Once per language, not per keystroke: it reads the configurator catalogue.
  const v = useMemo(() => hubFigures(locale), [locale])
  const items = useMemo(() => sections.flatMap((section) => section.items), [sections])
  const ids = useMemo(() => items.map((item) => item.id), [items])
  const sectionOf = useMemo(() => new Map(sections.flatMap((s) => s.items.map((item) => [item.id, s.key]))), [sections])

  // A #q- link to a question the search or the topic hides shows it again first.
  const filters = useRef({ query, topic })
  filters.current = { query, topic }
  const reveal = useCallback((id) => {
    const item = items.find((entry) => entry.id === id)
    const { query: q, topic: t } = filters.current
    if (t !== ALL && t !== sectionOf.get(id)) setTopic(ALL)
    if (item && !matches(item, q)) setQuery('')
  }, [items, sectionOf])
  useQuestionHash(ids, reveal)

  const view = useMemo(() => sections.map((section) => {
    const inTopic = topic === ALL || topic === section.key
    const rows = section.items.map((item) => ({ item, visible: inTopic && matches(item, query) }))
    return { ...section, rows, count: rows.filter((row) => row.visible).length }
  }), [sections, topic, query])
  const total = view.reduce((n, section) => n + section.count, 0)

  // The count under the chips is also what a screen reader hears: polite, and only once the
  // typing pauses, rather than a number per keystroke.
  // With nothing found it says "0 questions"; the card under it explains and offers a way out.
  const message = c ? countText(c.count, total, locale) : ''
  const [said, setSaid] = useState(message)
  useEffect(() => {
    const timer = setTimeout(() => setSaid(message), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [message])

  if (!c) return null

  const markup = markedUp(items)
  const clear = () => {
    setQuery('')
    inputRef.current?.focus()
  }
  // The button removes itself; the focus goes to the search field, not to <body> (from where
  // the next Tab would skip every question).
  const showAll = () => {
    setQuery('')
    setTopic(ALL)
    inputRef.current?.focus()
  }
  // On a phone the chips are one row that scrolls sideways; a chip reached with Tab is brought
  // whole into it, focus ring included, rather than left cut off at the edge.
  const chipInView = (e) => e.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  const renderLink = (link) => (link.to ? <Link to={link.to}>{link.label}</Link> : null)

  const siblings = [
    { to: hubPath(locale, 'delivery'), ...c.siblings.delivery },
    { to: hubPath(locale, 'prices'), ...c.siblings.prices },
    { to: hubPath(locale, 'partner'), label: c.siblings.partner.label, desc: fill(c.siblings.partner.desc, v) },
    { to: hubPath(locale, 'about'), ...c.siblings.about },
  ]

  return (
    <main className="hp pp fq">
      <ProductHero titleId="fq-hero-title" eyebrow={c.hero.eyebrow} title={c.hero.h1} lead={c.hero.lead} />

      <div className="fq-tools">
        <div className="hp-container">
          <div className="fq-search" role="search">
            <label className="fq-label" htmlFor="fq-query">{c.search.label}</label>
            <div className="fq-field">
              <SearchIcon />
              <input
                ref={inputRef}
                id="fq-query"
                className="fq-input"
                type="search"
                value={query}
                placeholder={c.search.placeholder}
                autoComplete="off"
                spellCheck="false"
                enterKeyHint="search"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery('') } }}
              />
              {query ? (
                <button type="button" className="fq-clear" aria-label={c.search.clear} onClick={clear}>
                  <ClearIcon />
                </button>
              ) : null}
            </div>
          </div>

          <div className="fq-chips" role="group" aria-label={c.topicsLabel}>
            <button type="button" className="fq-chip" aria-pressed={topic === ALL} onClick={() => setTopic(ALL)} onFocus={chipInView}>{c.all}</button>
            {/* A toggle: pressing the pressed topic again lets it go, back to all of them. */}
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                className="fq-chip"
                aria-pressed={topic === section.key}
                onClick={() => setTopic(topic === section.key ? ALL : section.key)}
                onFocus={chipInView}
              >
                {section.label}
              </button>
            ))}
          </div>

          <p className="fq-count" aria-live="polite" aria-atomic="true">{said}</p>
        </div>
      </div>

      <div className="fq-list">
        <div className="hp-container">
          {view.map((section) => (
            <section
              key={section.key}
              id={`t-${section.key}`}
              className="fq-topic"
              aria-labelledby={`fq-t-${section.key}`}
              hidden={!section.count || undefined}
            >
              <h2 id={`fq-t-${section.key}`}>{section.label}</h2>
              <div className="pp-faq">
                {section.rows.map(({ item, visible }) => (
                  <FaqItem key={item.id} item={item} hidden={!visible} renderLink={renderLink} />
                ))}
              </div>
              {section.link ? (
                <p className="pp-links fq-topic-link"><Link to={section.link.to}>{section.link.label}</Link></p>
              ) : null}
            </section>
          ))}

          {total === 0 ? (
            <div className="hp-card fq-empty">
              <p>{c.empty.text}</p>
              <div className="hp-cta-row">
                <button type="button" className="hp-btn" onClick={showAll}>{c.empty.reset}</button>
                <button type="button" className="hp-btn ghost" onClick={openQuestion}>{c.empty.ask}</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {markup.length ? <FAQJSONLD questions={markup} /> : null}

      <SiblingLinks id="fq-siblings" heading={c.siblings.heading} go={c.siblings.go} items={siblings} />

      <FinalCta locale={locale} title={c.finalTitle} />
    </main>
  )
}
