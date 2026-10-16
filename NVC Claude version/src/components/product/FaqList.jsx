// A page's questions: plain <details>, a hairline between them, the whole question tappable
// (ProductPage.css .pp-faq), and the FAQPage markup for the ones this page marks up. The
// delivery, partner, internal doors and interiors pages print their questions with it, and the
// FAQ hub draws its items the same way, so the five look alike.
//
// Each question is <details id="q-{id}">: a link to #q-{id} opens it and brings it into view,
// on load and whenever the hash changes (useQuestionHash). The answer is always in the DOM,
// collapsed rather than unmounted, because the FAQPage markup asserts it is on the page.
import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FAQJSONLD } from '../StructuredData.jsx'
import { markedUp, questionFromHash } from '../../lib/questions.js'

const reducedMotion = () => Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * Opens and scrolls to the question the URL's #q-{id} names, if it is one of `ids`: on load,
 * and again whenever the hash changes. `reveal(id)` runs first, so a page that can hide a
 * question (the hub's search and topics) can show it again; the scroll waits for that render.
 * A jump on load, as the browser's own would be; a smooth scroll for a later in-page link,
 * unless the visitor asked for reduced motion.
 */
export function useQuestionHash(ids, reveal) {
  const { hash } = useLocation()
  const [wanted, setWanted] = useState(null)
  const firstHash = useRef(hash)
  const known = (ids || []).join(' ')

  useEffect(() => {
    const id = questionFromHash(hash)
    if (!id || !known.split(' ').includes(id)) return
    reveal?.(id)
    setWanted({ id, smooth: hash !== firstHash.current })
    // reveal is the page's own setter wrapper; a new one each render must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, known])

  useEffect(() => {
    if (!wanted) return
    const el = document.getElementById(`q-${wanted.id}`)
    if (el) {
      el.open = true
      el.scrollIntoView?.({ block: 'start', behavior: wanted.smooth && !reducedMotion() ? 'smooth' : 'auto' })
    }
    setWanted(null)
  }, [wanted])
}

/** One question: the summary, the answer as a paragraph, and a link under it if it has one. */
export function FaqItem({ item, hidden, renderLink }) {
  return (
    <details id={item.id ? `q-${item.id}` : undefined} className="pp-faq-item" hidden={hidden || undefined}>
      <summary>{item.question}</summary>
      <p>{item.answer}</p>
      {item.link && renderLink ? <p className="pp-faq-more">{renderLink(item.link)}</p> : null}
    </details>
  )
}

/**
 * @param items  [{ id, question, answer, markup }] from pageQuestions() (lib/questions.js)
 */
export default function FaqList({ items = [] }) {
  const list = (items || []).filter((item) => item && item.question && item.answer)
  useQuestionHash(list.map((item) => item.id).filter(Boolean))
  const markup = markedUp(list)

  return (
    <>
      <div className="pp-faq">
        {list.map((item) => <FaqItem key={item.id || item.question} item={item} />)}
      </div>
      {markup.length ? <FAQJSONLD questions={markup} /> : null}
    </>
  )
}
