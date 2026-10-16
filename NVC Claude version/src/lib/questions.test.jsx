import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import FaqList from '../components/product/FaqList.jsx'
import { GATHERED_PAGES, deliveryFigures, fill, markedUp, pageQuestions, partnerFigures, questionFromHash } from './questions.js'
import { HUB_TOPICS, hubQuestions, hubSections } from './faqHub.js'
import { PRODUCT_PAGES, productQuestions } from './productQuestions.js'
import { euro } from './euro.js'
import bgFaq from '../content/bg/faq.js'
import enFaq from '../content/en/faq.js'
import elFaq from '../content/el/faq.js'
import bgDelivery from '../content/bg/delivery.js'
import enDelivery from '../content/en/delivery.js'
import elDelivery from '../content/el/delivery.js'
import bgPartner from '../content/bg/partner.js'
import enPartner from '../content/en/partner.js'
import elPartner from '../content/el/partner.js'
import bgDoors from '../content/bg/internalDoors.js'
import enDoors from '../content/en/internalDoors.js'
import elDoors from '../content/el/internalDoors.js'
import bgInteriors from '../content/bg/interiors.js'
import enInteriors from '../content/en/interiors.js'
import elInteriors from '../content/el/interiors.js'
import bgModularBuilds from '../content/bg/modularBuilds.js'
import enModularBuilds from '../content/en/modularBuilds.js'
import elModularBuilds from '../content/el/modularBuilds.js'
import bgModularHouses from '../content/bg/modularHouses.js'
import enModularHouses from '../content/en/modularHouses.js'
import elModularHouses from '../content/el/modularHouses.js'
import bgSteelHouses from '../content/bg/steelHouses.js'
import enSteelHouses from '../content/en/steelHouses.js'
import elSteelHouses from '../content/el/steelHouses.js'

// One question, marked up once (2026-10-16). The FAQ hub gathers the delivery, partner, internal
// doors and interiors pages' questions instead of copying them, and every question is FAQPage
// markup on exactly one URL per language: its own page, or the hub for the hub's own (and for
// the partner page's warranty and customs questions, which the hub answers too; the partner
// page's lead time is the delivery page's). What these pin: that, the stable ids the #q- links
// use (the same in all three languages), that the hub fills a gathered answer exactly as its
// page does, and that FaqList draws what it marks up and opens #q- links.

const LOCALES = ['bg', 'en', 'el']
const HUB = { bg: bgFaq, en: enFaq, el: elFaq }
const PAGES = {
  bg: { delivery: bgDelivery, partner: bgPartner, doors: bgDoors, interiors: bgInteriors },
  en: { delivery: enDelivery, partner: enPartner, doors: enDoors, interiors: enInteriors },
  el: { delivery: elDelivery, partner: elPartner, doors: elDoors, interiors: elInteriors },
}
// The three product pages (2026-10-17), whose questions lib/productQuestions.js fills.
const PRODUCTS = {
  bg: { modularBuilds: bgModularBuilds, modularHouses: bgModularHouses, steelHouses: bgSteelHouses },
  en: { modularBuilds: enModularBuilds, modularHouses: enModularHouses, steelHouses: enSteelHouses },
  el: { modularBuilds: elModularBuilds, modularHouses: elModularHouses, steelHouses: elSteelHouses },
}
// A product page's questions as the page draws them, the doors page's container question included.
const productList = (page, locale) => productQuestions(page, PRODUCTS[locale][page], locale, { doors: PAGES[locale].doors })

/** [where, id, question] for every question marked up in one language, hub included. */
function markedUpEverywhere(locale) {
  return [
    ...hubQuestions(HUB[locale], locale).filter((q) => q.markup).map((q) => ['faq', q.id, q.question]),
    ...GATHERED_PAGES.flatMap((page) => pageQuestions(page, PAGES[locale][page], locale)
      .filter((q) => q.markup)
      .map((q) => [page, q.id, q.question])),
    ...PRODUCT_PAGES.flatMap((page) => productList(page, locale)
      .filter((q) => q.markup)
      .map((q) => [page, q.id, q.question])),
  ]
}

const repeated = (values) => values.filter((v, i) => values.indexOf(v) !== i)

afterEach(() => {
  cleanup()
  delete Element.prototype.scrollIntoView
  vi.unstubAllGlobals()
})

describe('questions across the FAQ hub and the four pages', () => {
  it.each(LOCALES)('%s: a question id is marked up at most once, and so is a question\'s wording on the hub', (locale) => {
    const marked = markedUpEverywhere(locale)
    expect(repeated(marked.map(([, id]) => id))).toEqual([])
    // Nor is one wording marked up twice under two ids (the partner page's "how long does it
    // take?" was the delivery page's, word for word).
    expect(repeated(marked.map(([, , q]) => q))).toEqual([])
    // None of the hub's own questions is also marked up, in the same words, on a page.
    const hub = new Set(marked.filter(([where]) => where === 'faq').map(([, , q]) => q))
    expect(marked.filter(([where, , q]) => where !== 'faq' && hub.has(q))).toEqual([])
    // Every page marks up something; the hub marks up all of its own.
    for (const page of [...GATHERED_PAGES, ...PRODUCT_PAGES]) expect(marked.some(([where]) => where === page), page).toBe(true)
    expect(marked.filter(([where]) => where === 'faq')).toHaveLength(HUB[locale].items.length)
  })

  it.each(LOCALES)('%s: the warranty is shown on the partner page and marked up on the hub only', (locale) => {
    const partner = pageQuestions('partner', PAGES[locale].partner, locale)
    const warranty = partner.find((q) => q.id === 'warranty')
    expect(warranty).toBeDefined()
    expect(warranty.markup).toBe(false)
    expect(markedUp(partner).map((q) => q.question)).not.toContain(warranty.question)
    expect(markedUp(partner)).toHaveLength(partner.length - 3)
    expect(markedUpEverywhere(locale).filter(([, id]) => id === 'warranty')).toEqual([
      ['faq', 'warranty', HUB[locale].items.find((item) => item.id === 'warranty').q],
    ])
    // Only the partner page hands questions to another page: the warranty and customs to the
    // hub, which answers both itself, and its lead time to the delivery page, which marks up
    // the same answer.
    const HANDED = [['partner-customs', 'faq'], ['partner-lead-time', 'delivery'], ['warranty', 'faq']]
    for (const page of GATHERED_PAGES) {
      const handed = PAGES[locale][page].faq.items.filter((item) => item.markup)
      expect(handed.map((item) => [item.id, item.markup]), page).toEqual(page === 'partner' ? HANDED : [])
    }
    // And each goes to a page that does mark up that answer.
    const marked = markedUpEverywhere(locale)
    expect(marked.some(([where, id]) => where === 'faq' && id === 'customs')).toBe(true)
    expect(marked.some(([where, id]) => where === 'delivery' && id === 'delivery-lead-time')).toBe(true)
  })

  it('every question has a stable ASCII id, unique on its page and the same in all three languages', () => {
    const ID = /^[a-z0-9][a-z0-9-]*$/
    for (const [name, of] of [['faq', (l) => HUB[l].items], ...GATHERED_PAGES.map((page) => [page, (l) => PAGES[l][page].faq.items])]) {
      const ids = Object.fromEntries(LOCALES.map((l) => [l, of(l).map((item) => item.id)]))
      for (const id of ids.bg) expect(id, `${name}: ${id}`).toMatch(ID)
      expect(repeated(ids.bg), name).toEqual([])
      expect(ids.en, name).toEqual(ids.bg)
      expect(ids.el, name).toEqual(ids.bg)
    }
    // And across all five, an id names one question (the warranty, shared on purpose, aside).
    const all = [...HUB.bg.items, ...GATHERED_PAGES.flatMap((page) => PAGES.bg[page].faq.items)].map((item) => item.id)
    expect(repeated(all)).toEqual(['warranty'])
    // The hub's topics name only the hub's topics.
    for (const locale of LOCALES) {
      const topics = new Set(HUB_TOPICS.map((t) => t.key))
      for (const item of HUB[locale].items) expect(topics.has(item.topic), `${locale} ${item.id}`).toBe(true)
      expect(Object.keys(HUB[locale].topics).sort()).toEqual([...topics].sort())
    }
  })

  it.each(LOCALES)('%s: the hub fills a gathered answer exactly as its page does, and leaves no {placeholder}', (locale) => {
    const shown = hubSections(locale, HUB[locale], PAGES[locale]).flatMap((s) => s.items)
    for (const page of GATHERED_PAGES) {
      for (const q of pageQuestions(page, PAGES[locale][page], locale)) {
        // Gathered from this page (the warranty is the hub's own answer, not the partner page's).
        const onHub = shown.find((item) => item.id === q.id && item.from === page)
        if (!onHub) continue
        expect(onHub.answer, q.id).toBe(q.answer)
        expect(onHub.question, q.id).toBe(q.question)
      }
    }
    for (const item of shown) {
      expect(`${item.question} ${item.answer}`, item.id).not.toMatch(/\{\w+\}/)
    }
  })

  it('reads the figures from the modules, as the pages did', () => {
    const d = deliveryFigures('bg')
    expect(Object.keys(d).sort()).toEqual(['boxCrane', 'boxRate', 'containerCrane', 'containerRate', 'days', 'months', 'nights', 'production', 'travel'])
    const p = partnerFigures('en')
    expect(Object.keys(p)).toEqual(expect.arrayContaining(['containerMin', 'boxMin', 'structureYears', 'sanitaryYears']))
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}')
    expect(questionFromHash('#q-delivery-crane')).toBe('delivery-crane')
    for (const hash of ['', '#', '#q-', '#warranty', '#q-Bad', '#q-a b']) expect(questionFromHash(hash), hash).toBeNull()
  })
})

// The product pages' questions (Stage 2, 2026-10-17): homed and marked up on their own pages,
// shown by the hub under its product topics without markup, each with an id of its own.
describe('the product pages\' questions', () => {
  const ID = /^[a-z0-9][a-z0-9-]*$/
  const TOPIC = { modularBuilds: 'containers', modularHouses: 'box', steelHouses: 'steel' }

  it('every product question has a stable ASCII id, the same in all three languages, and no other page\'s', () => {
    const others = new Set([...HUB.bg.items, ...GATHERED_PAGES.flatMap((page) => PAGES.bg[page].faq.items)].map((item) => item.id))
    const seen = []
    for (const page of PRODUCT_PAGES) {
      const ids = Object.fromEntries(LOCALES.map((l) => [l, PRODUCTS[l][page].faq.items.map((item) => item.id)]))
      expect(ids.en, page).toEqual(ids.bg)
      expect(ids.el, page).toEqual(ids.bg)
      for (const item of PRODUCTS.bg[page].faq.items) {
        expect(item.id, `${page}: ${item.id}`).toMatch(ID)
        // Only a question `from` another page carries that page's id.
        if (item.from) expect(PAGES.bg[item.from].faq.items.map((i) => i.id), item.id).toContain(item.id)
        else {
          expect(others.has(item.id), item.id).toBe(false)
          seen.push(item.id)
        }
      }
    }
    expect(repeated(seen)).toEqual([])
    // The ones that moved from the hub to their pages are gone from the hub.
    for (const id of ['container-kitchen', 'container-assembly', 'container-sizes', 'box-price', 'box-appliances', 'box-assembly', 'box-layouts', 'steel-price', 'steel-delivery']) {
      expect(seen, id).toContain(id)
      for (const locale of LOCALES) expect(HUB[locale].items.map((item) => item.id), `${locale} ${id}`).not.toContain(id)
    }
  })

  it.each(LOCALES)('%s: with the real figures, the owner\'s answers read as he gave them', (locale) => {
    const get = (page, id) => productList(page, locale).find((q) => q.id === id).answer.replace(/\s/g, ' ')
    // Two of our workers, on site, in 3–4 days; the 18 m² house's assembly 1,000 without VAT.
    expect(get('modularHouses', 'box-assembly-crew')).toMatch({ bg: /двама/, en: /two/, el: /δύο/ }[locale])
    expect(get('modularHouses', 'box-assembly-crew')).toContain('3–4')
    expect(get('modularHouses', 'box-assembly-18')).toContain(euro(1000, locale).replace(/\s/g, ' '))
    expect(get('modularHouses', 'box-assembly-18')).toContain(euro(1200, locale).replace(/\s/g, ' '))
    // A made-to-order container in 3–4 months; a steel house's architectural project 1,000 €.
    expect(get('modularBuilds', 'container-made-to-order')).toContain('3–4')
    expect(get('steelHouses', 'steel-project')).toContain(euro(1000, locale).replace(/\s/g, ' '))
    // ONE factory, ours, in China.
    expect(get('steelHouses', 'steel-factory')).toContain({ bg: 'нашата фабрика в Китай', en: 'our factory in China', el: 'εργοστάσιό μας στην Κίνα' }[locale])
  })

  it.each(LOCALES)('%s: the containers page shows the doors page\'s container question in its words, marked up on the doors page only', (locale) => {
    const theirs = pageQuestions('doors', PAGES[locale].doors, locale).find((q) => q.id === 'doors-for-containers')
    const shownHere = productList('modularBuilds', locale).find((q) => q.id === 'doors-for-containers')
    expect(theirs.markup).toBe(true)
    expect(shownHere).toMatchObject({ question: theirs.question, answer: theirs.answer, markup: false, ref: 'doors' })
    // Without the doors page's words it is left out, never drawn empty.
    expect(productQuestions('modularBuilds', PRODUCTS[locale].modularBuilds, locale).map((q) => q.id)).not.toContain('doors-for-containers')
  })

  it.each(LOCALES)('%s: the hub shows every product question under its topic, as its page fills it, unmarked, with no {placeholder}', (locale) => {
    const sections = hubSections(locale, HUB[locale], { ...PAGES[locale], ...PRODUCTS[locale] })
    for (const page of PRODUCT_PAGES) {
      const section = sections.find((s) => s.key === TOPIC[page])
      const own = productList(page, locale).filter((q) => !q.ref)
      expect(own.length, page).toBeGreaterThan(0)
      // The page's own questions first, in the page's order.
      expect(section.items.slice(0, own.length).map((q) => q.id)).toEqual(own.map((q) => q.id))
      for (const q of own) {
        const onHub = section.items.find((item) => item.id === q.id)
        expect(onHub, q.id).toMatchObject({ question: q.question, answer: q.answer, markup: false, from: page })
        expect(q.markup, q.id).toBe(true)
        expect(`${q.question} ${q.answer}`, q.id).not.toMatch(/\{\w+\}/)
      }
    }
    // The doors question sits with the containers once, from the doors page.
    const containers = sections.find((s) => s.key === 'containers').items
    expect(containers.filter((q) => q.id === 'doors-for-containers').map((q) => q.from)).toEqual(['doors'])
  })
})

describe('FaqList', () => {
  let scrolled
  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = vi.fn(function scrollIntoView(options) { scrolled.push({ id: this.id, options }) })
  })

  function renderList(page, locale, entry = '/x', extra = null) {
    const items = pageQuestions(page, PAGES[locale][page], locale)
    const view = render(
      <MemoryRouter initialEntries={[entry]}>
        <FaqList items={items} />
        {extra}
      </MemoryRouter>,
    )
    return { ...view, items }
  }

  it.each(GATHERED_PAGES.flatMap((page) => LOCALES.map((locale) => [page, locale])))('%s (%s): draws every question as <details id="q-{id}"> and marks up only its own', (page, locale) => {
    const { container, items } = renderList(page, locale)
    const details = [...container.querySelectorAll('details.pp-faq-item')]
    expect(details.map((d) => d.id)).toEqual(items.map((q) => `q-${q.id}`))
    expect(details.map((d) => [d.querySelector('summary').textContent, d.querySelector('p').textContent]))
      .toEqual(items.map((q) => [q.question, q.answer]))
    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    expect(blocks).toHaveLength(1)
    const marked = blocks[0].mainEntity.map((e) => [e.name, e.acceptedAnswer.text])
    // The markup is a subset of what is drawn: every question but one marked up elsewhere.
    expect(marked).toEqual(markedUp(items).map((q) => [q.question, q.answer]))
    for (const entry of marked) expect(details.map((d) => [d.querySelector('summary').textContent, d.querySelector('p').textContent])).toContainEqual(entry)
  })

  it('opens and scrolls to #q-{id} on load, with a jump', () => {
    const { container } = renderList('delivery', 'bg', '/bg/dostavka-do-vratata#q-delivery-lead-time')
    expect(container.querySelector('#q-delivery-lead-time').open).toBe(true)
    expect(scrolled).toEqual([{ id: 'q-delivery-lead-time', options: { block: 'start', behavior: 'auto' } }])
  })

  it('a later #q- link opens its question and scrolls smoothly, or jumps for reduced motion', () => {
    const links = (
      <>
        <Link to="#q-doors-set">set</Link>
        <Link to="#q-doors-colours">colours</Link>
      </>
    )
    vi.stubGlobal('matchMedia', (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    const { container, getByText } = renderList('doors', 'en', '/en/internal-doors', links)
    expect(scrolled).toEqual([])
    fireEvent.click(getByText('set'))
    expect(container.querySelector('#q-doors-set').open).toBe(true)
    expect(scrolled.at(-1)).toEqual({ id: 'q-doors-set', options: { block: 'start', behavior: 'smooth' } })

    vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }))
    fireEvent.click(getByText('colours'))
    expect(container.querySelector('#q-doors-colours').open).toBe(true)
    expect(scrolled.at(-1)).toEqual({ id: 'q-doors-colours', options: { block: 'start', behavior: 'auto' } })
  })

  it('ignores a hash that is not one of its questions', () => {
    const { container } = renderList('interiors', 'el', '/el/esoterikoi-xoroi#q-delivery-crane')
    expect([...container.querySelectorAll('details[open]')]).toEqual([])
    expect(scrolled).toEqual([])
  })
})
