import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { Link, MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import FAQPage, { matches, normalize } from './FAQPage.jsx'
import FAQ_SOURCE from './FAQPage.jsx?raw'
import BgFaqRoute from '../routes/bg/BgFaqRoute.jsx'
import EnFaqRoute from '../routes/en/EnFaqRoute.jsx'
import ElFaqRoute from '../routes/el/ElFaqRoute.jsx'
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
import { paths } from '../routes/paths.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { WAGON_ASSEMBLY_GROSS, getPriceRows } from '../content/shared/prices.js'
import { getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'
import { getHomeContent } from '../content/home/index.js'
import { euro } from '../lib/euro.js'
import { HUB_TOPICS, hubPath, hubSections } from '../lib/faqHub.js'
import { getRouteSeo } from '../seo/routeMeta.js'

// The FAQ hub as rebuilt on 2026-10-16. What these pin, in every language:
// - one H1, one H2 per topic in the hub's order, each topic ending with a link to its page;
// - EVERY answer in the DOM, own and gathered, in <details id="q-{id}">; the search and the topic
//   chips hide with the hidden attribute and never remove a node;
// - the chips are toggle buttons (aria-pressed), "all" first, no tabs; the count is polite;
// - #q-{id} opens its question and scrolls to it, and clears a search or a topic that hides it;
// - the FAQPage markup is the hub's own questions and nothing it gathers;
// - none of the old unbacked answers (staged payments, financing partners, finish packages,
//   "declarations, duties and compliance"; financing is back as the owner gave it on 2026-10-17),
//   one factory and no suppliers, nothing about utility connections, heating or the new office;
// - the three product pages' questions gathered under their topics (2026-10-17), unmarked here;
// - every figure read from its module (warranty.js, partnerTerms.js, company.js and insulation.js are mocked
//   to other numbers here, so a figure typed into the copy would show), no {placeholder} left;
// - the crane and the lead time are the delivery page's answers, the warranty is asked once;
// - the head from routeMeta.js with all three hreflangs, and breadcrumbs.

const YEARS = vi.hoisted(() => ({ structure: 17, panels: 9, joinery: 8, sanitary: 5 }))
vi.mock('../content/shared/warranty.js', () => ({ WARRANTY_YEARS: YEARS }))
const TERMS = vi.hoisted(() => ({ container: 7, box: 4 }))
vi.mock('../content/shared/partnerTerms.js', () => ({ PARTNER_MIN_UNITS: TERMS }))
const FIRM = vi.hoisted(() => ({ homesDelivered: 93, vatID: 'BG000000042', foundingYear: 2019 }))
// The owner's payment terms and financing of 2026-10-17, mocked to other figures and another bank.
const PAY = vi.hoisted(() => ({ atOrderPercent: 70, afterDeliveryPercent: 30 }))
const FUND = vi.hoisted(() => ({ upToEuro: 42000, bank: { bg: 'Тестова банка', en: 'Test Bank', el: 'Τράπεζα Δοκιμής' } }))
vi.mock('../content/shared/company.js', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, COMPANY: { ...real.COMPANY, ...FIRM }, PAYMENT_TERMS: PAY, FINANCING: FUND }
})
const ROOF = vi.hoisted(() => ({ boxRoofRockWoolMm: 65 }))
vi.mock('../content/shared/insulation.js', () => ({ INSULATION: ROOF }))

const LOCALES = ['bg', 'en', 'el']
const SITE = 'https://nvc-home4you.eu'
const CONTENT = { bg: bgFaq, en: enFaq, el: elFaq }
// The seven pages the hub gathers from, as the routes pass them.
const PAGES = {
  bg: { delivery: bgDelivery, partner: bgPartner, doors: bgDoors, interiors: bgInteriors, modularBuilds: bgModularBuilds, modularHouses: bgModularHouses, steelHouses: bgSteelHouses },
  en: { delivery: enDelivery, partner: enPartner, doors: enDoors, interiors: enInteriors, modularBuilds: enModularBuilds, modularHouses: enModularHouses, steelHouses: enSteelHouses },
  el: { delivery: elDelivery, partner: elPartner, doors: elDoors, interiors: elInteriors, modularBuilds: elModularBuilds, modularHouses: elModularHouses, steelHouses: elSteelHouses },
}
const ROUTES = { bg: BgFaqRoute, en: EnFaqRoute, el: ElFaqRoute }
const { container: CONTAINER, box: BOX } = DELIVERY_RATES.products

const openQuestion = vi.fn()
let scrolled = []

beforeEach(() => {
  scrolled = []
  openQuestion.mockReset()
  // jsdom has no scrolling: record which element was asked to come into view.
  Element.prototype.scrollIntoView = vi.fn(function scrollIntoView(options) { scrolled.push({ id: this.id, options }) })
})

afterEach(() => {
  cleanup()
  delete Element.prototype.scrollIntoView
  vi.unstubAllGlobals()
})

function renderPage(locale = 'bg', entry = paths.faq[locale], extra = null) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={openQuestion}>
        <FAQPage locale={locale} content={CONTENT[locale]} pages={PAGES[locale]} />
        {extra}
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

// Spaces of every kind read as one; the word joiners that hold "3–4" together read as nothing.
const flat = (s) => String(s ?? '').replace(/⁠/g, '').replace(/\s/g, ' ')
const questions = (container) => [...container.querySelectorAll('details.pp-faq-item')]
const isShown = (el) => !el.hidden && !el.closest('[hidden]')
const visible = (container) => questions(container).filter(isShown)
const asItem = (d) => ({ question: d.querySelector('summary').textContent, answer: d.querySelector('p').textContent })
const jsonLd = (container) => [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
const hubItems = (locale) => hubSections(locale, CONTENT[locale], PAGES[locale]).flatMap((s) => s.items)
// Each page's own questions: an item `from` another page (the containers page's doors question)
// is that page's, counted there.
const pageIds = (locale) => Object.values(PAGES[locale]).flatMap((page) => page.faq.items.filter((item) => !item.from).map((item) => item.id))
const answerOf = (container, id) => flat(container.querySelector(`#q-${id} > p`).textContent)

describe('FAQPage, the hub', () => {
  it.each(LOCALES)('%s: one H1, an H2 per topic in the hub\'s order, every answer in the DOM', (locale) => {
    const c = CONTENT[locale]
    const { container } = renderPage(locale)
    const main = container.querySelector('main')

    expect(main.querySelectorAll('h1')).toHaveLength(1)
    expect(main.querySelector('h1').textContent).toBe(c.hero.h1)
    const h2s = [...main.querySelectorAll('.fq-topic > h2')].map((h) => h.textContent)
    expect(h2s).toEqual(HUB_TOPICS.map((topic) => c.topics[topic.key].label))

    const items = hubItems(locale)
    const shown = questions(container)
    expect(shown.map((d) => d.id)).toEqual(items.map((item) => `q-${item.id}`))
    expect(new Set(shown.map((d) => d.id)).size).toBe(shown.length)
    expect(shown.map(asItem)).toEqual(items.map(({ question, answer }) => ({ question, answer })))
    // Every one of its own, and every question of the four pages except the one it answers itself
    // (the warranty) and the two a topic leaves out as answered above (HUB_TOPICS omit).
    const own = c.items.map((item) => item.id)
    const omitted = HUB_TOPICS.flatMap((topic) => topic.omit || [])
    expect(omitted).toEqual(['partner-lead-time', 'partner-customs'])
    expect(items.filter((item) => item.markup).map((item) => item.id).sort()).toEqual([...own].sort())
    expect(items.filter((item) => !item.markup).map((item) => item.id).sort())
      .toEqual(pageIds(locale).filter((id) => !own.includes(id) && !omitted.includes(id)).sort())
    // All shown, all closed.
    expect(visible(container)).toHaveLength(shown.length)
    expect(shown.filter((d) => d.open)).toEqual([])

    expect(main.textContent).not.toMatch(/\{\w+\}/)
    expect(container.querySelector('#hp-final-title').textContent).toBe(c.finalTitle)
  })

  it.each(LOCALES)('%s: each topic ends with a link to its page, the product questions with one to theirs', (locale) => {
    const c = CONTENT[locale]
    const { container } = renderPage(locale)
    const topics = [...container.querySelectorAll('.fq-topic')]
    for (const topic of topics) expect(topic.lastElementChild.matches('.fq-topic-link'), topic.id).toBe(true)
    expect(topics.map((t) => t.querySelector('.fq-topic-link a').getAttribute('href')))
      .toEqual(HUB_TOPICS.map((topic) => hubPath(locale, topic.page, topic.hash)))
    expect(topics.map((t) => t.querySelector('.fq-topic-link a').textContent)).toEqual(HUB_TOPICS.map((topic) => c.topics[topic.key].link))

    const PRODUCT = { 'container-kitchen': 'modularBuilds', 'container-assembly': 'modularBuilds', 'container-sizes': 'modularBuilds', 'box-price': 'modularHouses', 'steel-price': 'steelHouses', 'steel-delivery': 'steelHouses' }
    for (const [id, page] of Object.entries(PRODUCT)) {
      const href = container.querySelector(`#q-${id} .pp-faq-more a`)?.getAttribute('href') || ''
      expect(href.split('#')[0], id).toBe(paths[page][locale])
    }
    for (const id of ['box-appliances', 'box-assembly', 'box-layouts']) {
      expect(container.querySelector(`#q-${id} .pp-faq-more a`), id).not.toBeNull()
    }

    const siblings = [...container.querySelectorAll('#fq-siblings a')].map((a) => a.getAttribute('href'))
    expect(siblings).toEqual(['delivery', 'prices', 'partner', 'about'].map((key) => paths[key][locale]))
  })

  it('the search hides what does not match and keeps every question in the DOM', () => {
    const { container, getByRole } = renderPage('bg')
    const all = questions(container).length
    const input = container.querySelector('#fq-query')
    expect(container.querySelector('label[for="fq-query"]').textContent).toBe(bgFaq.search.label)
    expect(input.getAttribute('type')).toBe('search')

    fireEvent.change(input, { target: { value: 'кран' } })
    const after = questions(container)
    expect(after).toHaveLength(all)
    const shown = after.filter(isShown)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(all)
    for (const d of after) expect(isShown(d), d.id).toBe(matches(asItem(d), 'кран'))
    // A topic with nothing left is hidden, its heading with it; the answers are still there.
    const empty = [...container.querySelectorAll('.fq-topic')].filter((t) => t.hidden)
    expect(empty.length).toBeGreaterThan(0)
    for (const topic of empty) expect(topic.querySelectorAll('details p').length).toBeGreaterThan(0)

    fireEvent.click(getByRole('button', { name: bgFaq.search.clear }))
    expect(input.value).toBe('')
    expect(visible(container)).toHaveLength(all)

    fireEvent.change(input, { target: { value: 'гаранция' } })
    expect(visible(container).length).toBeLessThan(all)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('')
    expect(visible(container)).toHaveLength(all)
  })

  it('finds every word of the query, in the question or the answer, whatever the case and the accents', () => {
    expect(normalize('Εγγύηση ΓΕΡΑΝΟΣ')).toBe('εγγυηση γερανος')
    expect(matches({ question: 'Колко струва кранът?', answer: 'Около 550 €' }, 'КРАН 550')).toBe(true)
    expect(matches({ question: 'Колко струва кранът?', answer: 'Около 550 €' }, 'кран врата')).toBe(false)

    const { container } = renderPage('el')
    fireEvent.change(container.querySelector('#fq-query'), { target: { value: 'εγγυηση' } })
    expect(isShown(container.querySelector('#q-warranty'))).toBe(true)
    expect(isShown(container.querySelector('#q-delivery-both-ways'))).toBe(false)
  })

  it('with nothing found, says 0 questions politely and offers the way back and a question', async () => {
    const { container, getByRole } = renderPage('bg')
    const count = container.querySelector('.fq-count')
    expect(count.getAttribute('aria-live')).toBe('polite')
    expect(count.textContent).toBe(`${questions(container).length} въпроса`)
    expect(container.querySelector('.fq-empty')).toBeNull()

    fireEvent.change(container.querySelector('#fq-query'), { target: { value: 'хеликоптер' } })
    expect(visible(container)).toEqual([])
    expect(questions(container).length).toBeGreaterThan(0)
    expect(container.querySelector('.fq-empty').textContent).toContain(bgFaq.empty.text)
    // The count changes once the typing settles, not per keystroke.
    expect(count.textContent).not.toBe('0 въпроса')
    await waitFor(() => expect(count.textContent).toBe('0 въпроса'), { timeout: 2000 })

    fireEvent.click(getByRole('button', { name: bgFaq.empty.ask }))
    expect(openQuestion).toHaveBeenCalled()
    fireEvent.click(getByRole('button', { name: bgFaq.empty.reset }))
    expect(visible(container)).toHaveLength(questions(container).length)
    expect(container.querySelector('.fq-empty')).toBeNull()
    // The button is gone; the focus is in the search field, not dropped to <body>.
    expect(document.activeElement).toBe(container.querySelector('#fq-query'))
  })

  it.each(LOCALES)('%s: the topics are toggle buttons, "all" first, and a topic hides the others without removing them', (locale) => {
    const c = CONTENT[locale]
    const { container } = renderPage(locale)
    const group = container.querySelector('.fq-chips')
    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('aria-label')).toBe(c.topicsLabel)
    expect(container.querySelector('[role="tab"], [role="tablist"], [role="tabpanel"], select')).toBeNull()
    const chips = [...group.querySelectorAll('button')]
    expect(chips.map((b) => b.textContent)).toEqual([c.all, ...HUB_TOPICS.map((topic) => c.topics[topic.key].label)])
    expect(chips.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', ...HUB_TOPICS.map(() => 'false')])

    const all = questions(container).length
    const containers = chips[1 + HUB_TOPICS.findIndex((topic) => topic.key === 'containers')]
    fireEvent.click(containers)
    expect(containers.getAttribute('aria-pressed')).toBe('true')
    expect(chips[0].getAttribute('aria-pressed')).toBe('false')
    const shownTopics = [...container.querySelectorAll('.fq-topic')].filter((t) => !t.hidden).map((t) => t.id)
    expect(shownTopics).toEqual(['t-containers'])
    expect(visible(container).map((d) => d.id)).toEqual([...container.querySelectorAll('#t-containers details')].map((d) => d.id))
    expect(questions(container)).toHaveLength(all)

    // A toggle: the pressed topic pressed again lets go, back to all.
    fireEvent.click(containers)
    expect(chips.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', ...HUB_TOPICS.map(() => 'false')])
    expect(visible(container)).toHaveLength(all)

    fireEvent.click(containers)
    fireEvent.click(chips[0])
    expect(containers.getAttribute('aria-pressed')).toBe('false')
    expect(visible(container)).toHaveLength(all)

    // A chip reached with Tab is brought whole into the row that scrolls sideways on a phone.
    scrolled = []
    fireEvent.focus(containers)
    expect(scrolled).toEqual([{ id: '', options: { block: 'nearest', inline: 'nearest' } }])
  })

  it.each(LOCALES)('%s: #q-{id} on load opens that question and brings it into view', (locale) => {
    const { container } = renderPage(locale, `${paths.faq[locale]}#q-delivery-crane`)
    const target = container.querySelector('#q-delivery-crane')
    expect(target.open).toBe(true)
    expect(scrolled.map((s) => s.id)).toContain('q-delivery-crane')
    expect(questions(container).filter((d) => d.open)).toEqual([target])
  })

  it('a #q- link to a question the search or the topic hides shows it again first', () => {
    const { container, getByText } = renderPage('bg', paths.faq.bg, <Link to="#q-warranty">към гаранцията</Link>)
    const input = container.querySelector('#fq-query')
    fireEvent.change(input, { target: { value: 'кран' } })
    expect(isShown(container.querySelector('#q-warranty'))).toBe(false)

    fireEvent.click(getByText('към гаранцията'))
    expect(input.value).toBe('')
    const target = container.querySelector('#q-warranty')
    expect(isShown(target)).toBe(true)
    expect(target.open).toBe(true)
    expect(scrolled.map((s) => s.id)).toContain('q-warranty')
  })

  it('a #q- link keeps a search that does not hide its question', () => {
    const { container, getByText } = renderPage('bg', paths.faq.bg, <Link to="#q-delivery-crane">към крана</Link>)
    const input = container.querySelector('#fq-query')
    fireEvent.change(input, { target: { value: 'кран' } })
    fireEvent.click(getByText('към крана'))
    expect(input.value).toBe('кран')
    expect(container.querySelector('#q-delivery-crane').open).toBe(true)
  })

  it.each(LOCALES)('%s: the FAQPage markup is the hub\'s own questions, and none it gathers', (locale) => {
    const c = CONTENT[locale]
    const { container } = renderPage(locale)
    const blocks = jsonLd(container).filter((b) => b['@type'] === 'FAQPage')
    expect(blocks).toHaveLength(1)
    const marked = blocks[0].mainEntity.map((e) => ({ question: e.name, answer: e.acceptedAnswer.text }))
    const own = new Set(c.items.map((item) => item.q))
    expect(marked).toHaveLength(c.items.length)
    for (const entry of marked) expect(own.has(entry.question), entry.question).toBe(true)
    // Each one exactly as the page shows it.
    const shown = questions(container).map(asItem)
    for (const entry of marked) expect(shown).toContainEqual(entry)
    // Nothing gathered: those are marked up on their own pages.
    const gathered = new Set(hubItems(locale).filter((item) => !item.markup).map((item) => item.question))
    expect(marked.filter((entry) => gathered.has(entry.question))).toEqual([])
  })

  it.each(LOCALES)('%s: none of the unbacked answers, one factory and no suppliers, nothing about utility connections', (locale) => {
    const { container } = renderPage(locale)
    const text = container.querySelector('main').textContent
    // Financing came back on 2026-10-17 with the owner's answer (up to an amount, through one
    // bank, both from company.js); staged payments, finish packages and "duties and compliance"
    // stay gone, and the payment answer is the owner's two shares.
    const UNBACKED = {
      // "пакети" as a word: the glazing units, „стъклопакети", are fine.
      bg: /по етапи|финансиращи партньори|партньори за финансиране|(?<!\p{L})пакети|индивидуални решения|декларации|такси и съответствие/iu,
      en: /milestone|financing partners|finish packs?|curated|declarations|duties|compliance/i,
      el: /οροσήμων|συνεργάτες χρηματοδότησης|πακέτα|διασαφήσεις|δασμούς|συμμόρφωση/i,
    }[locale]
    expect(text).not.toMatch(UNBACKED)
    const FINANCE_WORD = { bg: /финансиране/, en: /financ/, el: /χρηματοδότ/ }[locale]
    expect(questions(container).filter((d) => FINANCE_WORD.test(d.textContent)).map((d) => d.id)).toEqual(['q-financing'])
    expect(answerOf(container, 'financing')).toContain(FUND.bank[locale])
    // Nothing about heating or air conditioning: the owner did not answer it.
    expect(text).not.toMatch(/отоплен|климатик|heating|air.?condition|θέρμανσ|κλιματισ/i)
    // The new office opens in February: not before it opens.
    expect(text).not.toMatch(/Драгичево|Dragichevo|Ντραγκίτσεβο|Драгичев/i)
    const PLURAL = { bg: /фабрики|доставчи/i, en: /factories|supplier/i, el: /εργοστάσια(?![\p{L}])|εργοστασίων|προμηθευτ/iu }[locale]
    expect(text).not.toMatch(PLURAL)
    const ONE = { bg: 'нашата фабрика в Китай', en: 'our factory in China', el: 'εργοστάσιό μας στην Κίνα' }[locale]
    expect(answerOf(container, 'factory')).toContain(ONE)
    // The owner (2026-10-12, and 2026-10-17 for containers too): never say who connects a Box
    // house or a container to the utilities. The warranty's "leaks from external connections" is
    // a warranty term, not a connection anyone makes. Every answer the hub shows, own and
    // gathered from the product pages.
    const UTILITIES = /свързва|свързване|канализац|водопровод|connect|sewer|σύνδεση|συνδέεται|αποχέτευ|ύδρευ/i
    const productIds = ['modularBuilds', 'modularHouses', 'steelHouses'].flatMap((page) => PAGES[locale][page].faq.items.filter((i) => !i.from).map((i) => i.id))
    for (const id of [...CONTENT[locale].items.map((i) => i.id).filter((id) => id !== 'warranty'), ...productIds]) {
      expect(answerOf(container, id), id).not.toMatch(UTILITIES)
    }
  })

  it.each(LOCALES)('%s: every figure is its module\'s, none typed', (locale) => {
    const { container } = renderPage(locale)
    const money = (value) => flat(euro(value, locale))

    // warranty.js (mocked to 17, 9, 8, 5): every year, and none of the real ones typed.
    const warranty = answerOf(container, 'warranty')
    for (const years of Object.values(YEARS)) expect(warranty).toMatch(new RegExp(`(?<!\\d)${years}(?!\\d)`))
    expect(warranty).not.toMatch(/(?<!\d)(15|6|2)(?!\d)/)

    // company.js (mocked): the year we started, the homes, the VAT number.
    const company = answerOf(container, 'company')
    for (const value of Object.values(FIRM)) expect(company).toContain(String(value))
    expect(company).not.toMatch(/87|BG113592898|2021/)

    // The opening hours, as the footer prints them.
    expect(answerOf(container, 'visits')).toContain(flat(getHomeContent(locale).home.band.hours))

    // prices.js: the container's assembly share and the cheapest Box house assembly.
    expect(answerOf(container, 'container-assembly')).toContain(money(WAGON_ASSEMBLY_GROSS))
    const assemblyFrom = Math.min(...getPriceRows(locale).map((row) => row.standard.assemblyNet))
    expect(answerOf(container, 'prices-vat')).toContain(money(assemblyFrom))

    // company.js (mocked): the payment shares and the financing, amount and bank.
    const payment = answerOf(container, 'payment')
    expect(payment).toContain(`${PAY.atOrderPercent}%`)
    expect(payment).toContain(`${PAY.afterDeliveryPercent}%`)
    expect(payment).not.toMatch(/(?<!\d)(60|40)(?!\d)/)
    const financing = answerOf(container, 'financing')
    expect(financing).toContain(money(FUND.upToEuro))
    expect(financing).toContain(FUND.bank[locale])
    expect(financing).not.toMatch(/50[\s.,]?000|UniCredit|УниКредит/)
    // insulation.js (mocked): the Box houses' roof.
    const insulation = answerOf(container, 'insulation')
    expect(insulation).toMatch(new RegExp(`(?<!\\d)${ROOF.boxRoofRockWoolMm}(?!\\d)`))
    expect(insulation).not.toMatch(/(?<!\d)50(?!\d)/)

    // The configurator catalogue: bathrooms, kitchens, the standard terrace, the layouts.
    const catalogue = getBoxConfiguratorCatalog(locale)
    const box = answerOf(container, 'box-price')
    expect(box).toContain(`${catalogue.bathroomOptions.length} `)
    expect(box).toContain(`${catalogue.kitchenOptions.filter((k) => !k.price).length} `)
    expect(box).toContain(`${catalogue.kitchenOptions.filter((k) => k.price > 0).length} `)
    expect(box).toContain('6230 × 2000')
    const layouts = catalogue.models.reduce((n, model) => n + model.plans.length, 0)
    expect(answerOf(container, 'box-layouts')).toContain(`${layouts} `)
    for (const model of catalogue.models) expect(answerOf(container, 'box-layouts')).toContain(String(model.area))

    // deliveryRates.js: the crane, in the hub's Box assembly answer and the delivery page's.
    expect(answerOf(container, 'box-assembly')).toContain(money(BOX.crane.about))
    expect(answerOf(container, 'delivery-crane')).toContain(money(CONTAINER.crane.about))
    expect(answerOf(container, 'delivery-without-crane')).toContain(money(CONTAINER.noCrane.travelMax))
    expect(answerOf(container, 'delivery-lead-time')).toContain(flat(LEAD_TIMES.boxToAddressMonths))

    // pricesCopy.js: the foundation tip, worded once.
    expect(answerOf(container, 'foundation')).toContain(flat(getPricesCopy(locale).foundationNote))

    // partnerTerms.js (mocked to 7 and 4) in the partner card under the topics.
    const partnerCard = flat(container.querySelector(`#fq-siblings a[href="${paths.partner[locale]}"]`).textContent)
    expect(partnerCard).toContain(`${TERMS.container}`)
    expect(partnerCard).toContain(`${TERMS.box}`)
    expect(partnerCard).not.toMatch(/(?<!\d)(6|3)(?!\d)/)

    // And the copy itself types none of them: no digit at all in the hub's own answers.
    const own = CONTENT[locale].items.map((item) => item.a).join(' ')
    expect(own).not.toMatch(/\d/)
  })

  it.each(LOCALES)('%s: each question answered once: the crane and the lead time are the delivery page\'s, the warranty is asked once', (locale) => {
    const c = CONTENT[locale]
    const items = hubItems(locale)
    for (const id of ['delivery-crane', 'delivery-without-crane', 'delivery-lead-time']) {
      expect(items.find((item) => item.id === id).from, id).toBe('delivery')
    }
    // The delivery topic opens with the delivery page's six, in its order.
    const delivery = hubSections(locale, c, PAGES[locale]).find((s) => s.key === 'delivery')
    expect(delivery.items.slice(0, 6).map((item) => item.id)).toEqual(PAGES[locale].delivery.faq.items.map((item) => item.id))
    // The hub writes no crane price or lead time of its own beyond the Box assembly's crane.
    const own = c.items.filter((item) => item.id !== 'box-assembly').map((item) => item.a).join(' ')
    expect(own).not.toMatch(/\{(containerCrane|days|production|months|nights|travel)\}/)

    const { container } = renderPage(locale)
    const warrantyQuestion = PAGES[locale].partner.faq.items.find((item) => item.id === 'warranty').q
    const asked = questions(container).filter((d) => [warrantyQuestion, c.items.find((i) => i.id === 'warranty').q].includes(asItem(d).question))
    expect(asked.map((d) => d.id)).toEqual(['q-warranty'])
    expect(asked[0].closest('.fq-topic').id).toBe('t-warranty')
    // The doors page's container question sits with the containers, once.
    const doorsForContainers = container.querySelectorAll('#q-doors-for-containers')
    expect(doorsForContainers).toHaveLength(1)
    expect(doorsForContainers[0].closest('.fq-topic').id).toBe('t-containers')
    // The renovation's warranty says it is the renovation's.
    const RENOVATION = { bg: /ремонта/, en: /renovation/, el: /ανακαίνιση/ }[locale]
    expect(asItem(container.querySelector('#q-renovation-warranty')).question).toMatch(RENOVATION)
  })

  it('is built on the site\'s parts: no framer-motion, no tabs, no inline styles', () => {
    expect(FAQ_SOURCE).not.toMatch(/from ['"]framer-motion['"]/)
    expect(FAQ_SOURCE).not.toMatch(/role="tab|role=\{?'tab/)
    expect(FAQ_SOURCE).not.toMatch(/style=\{\{/)
    for (const c of Object.values(CONTENT)) expect(c.seo).toBeUndefined()
  })
})

describe('the FAQ routes', () => {
  function renderRoute(locale) {
    const Route = ROUTES[locale]
    return render(
      <HelmetProvider context={{}}>
        <MemoryRouter initialEntries={[paths.faq[locale]]}>
          <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
            <Route />
          </ModalActionsProvider>
        </MemoryRouter>
      </HelmetProvider>,
    )
  }

  it.each(LOCALES)('%s: the head from routeMeta.js, with all three languages, naming only what is answered', (locale) => {
    const seo = getRouteSeo(paths.faq[locale], locale)
    expect(seo.canonical).toBe(`${SITE}${paths.faq[locale]}`)
    expect(Object.fromEntries(seo.hreflangs.map((h) => [h.hrefLang, h.href]))).toEqual({
      bg: `${SITE}${paths.faq.bg}`,
      en: `${SITE}${paths.faq.en}`,
      el: `${SITE}${paths.faq.el}`,
      'x-default': `${SITE}${paths.faq.en}`,
    })
    expect(seo.title.length).toBeLessThanOrEqual(70)
    expect(seo.description.length).toBeGreaterThanOrEqual(130)
    expect(seo.description.length).toBeLessThanOrEqual(160)
    // The old one promised logistics, payments and customisation, which the page does not answer.
    expect(seo.description).not.toMatch(/логистик|плащан|персонализ|logistic|payment|customi|εφοδιαστ|πληρωμ|εξατομ|\d/i)
    // The titles name the two lines most answers are about (release A shipped a bare 'FAQ | brand').
    const TITLE = {
      bg: 'Често задавани въпроси за контейнери и Бокс къщи | NVC Home4You',
      en: 'FAQ About Containers and Box Houses | NVC Home4You',
      el: 'Συχνές ερωτήσεις για κοντέινερ και σπίτια Box | NVC Home4You',
    }
    expect(seo.title).toBe(TITLE[locale])
  })

  it.each(LOCALES)('%s: breadcrumbs, and one FAQPage block', async (locale) => {
    const { container } = renderRoute(locale)
    await waitFor(() => expect(container.querySelector('h1')).not.toBeNull())
    const data = jsonLd(container)
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual([CONTENT[locale].home, CONTENT[locale].breadcrumb])
    expect(crumbs.itemListElement[0].item).toBe(`${SITE}/${locale}`)
    expect(crumbs.itemListElement[1].item).toBe(`${SITE}${paths.faq[locale]}`)
    expect(data.filter((d) => d['@type'] === 'FAQPage')).toHaveLength(1)
    expect(within(container.querySelector('main')).getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(HUB_TOPICS.length)
  })
})
