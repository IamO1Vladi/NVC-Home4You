import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import AboutPage, { ABOUT_LEAD_SOURCE, ABOUT_PHOTO, FACTORY_PHOTO } from './AboutPage.jsx'
import { FACTORY_CLIP } from '../content/shared/aboutMedia.js'
import bgContent from '../content/bg/about.js'
import enContent from '../content/en/about.js'
import elContent from '../content/el/about.js'
import BgAboutRoute from '../routes/bg/BgAboutRoute.jsx'
import EnAboutRoute from '../routes/en/EnAboutRoute.jsx'
import ElAboutRoute from '../routes/el/ElAboutRoute.jsx'
import { paths } from '../routes/paths.js'
import { LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'
import { getRouteSeo } from '../seo/routeMeta.js'
import { ORGANIZATION_ID } from '../components/StructuredData.jsx'
import { HOME_PHOTOS_SEED_ID, fetchHomePhotos, forgetHomePhotos } from '../lib/homePhotos.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { COMPANY, TEAM_PHOTOS } from '../content/shared/company.js'
import bgHome from '../content/bg/home.js'
import enHome from '../content/en/home.js'
import elHome from '../content/el/home.js'
import bgPrivacy from '../content/bg/privacy.js'
import enPrivacy from '../content/en/privacy.js'
import elPrivacy from '../content/el/privacy.js'

// The About page as rebuilt on 2026-10-15, with the owner's answers of the same day. What these
// pin, in every language:
// - the sections in their order, one H1 naming the brand, no skipped heading level;
// - none of the old false or unbacked figures ("40+ suppliers", "6 countries", "8 weeks", the
//   "2019"/"2022" years, the renovation-first story);
// - the owner's timeline (2021 logistics, 2024 containers, 2025 Box houses, 2026 steel-frame
//   houses), the six people of the team, the company's VAT number from shared/company.js, the
//   documents, the factory quality check and visits by appointment;
// - the home page's hero and the privacy page agreeing with the About page;
// - every figure from its module (LEAD_TIMES, WARRANTY_YEARS) or the live reviews, none typed
//   in the content, and the review tile hidden rather than zero when the reviews do not answer;
// - the homes count from shared/company.js, as the home page states it, and the opening hours
//   from the home content's contact band, as the footer prints them (owner, 2026-10-16);
// - one factory, ours, in China; no suppliers;
// - only the owner's own photos (the crane lift, the delivery clips, the factory hall and its
//   loop, the case); the factory loop first in the journey's clips (owner's media, 2026-10-17);
// - links to Cases, FAQ, Gallery, Delivery and Prices, and the lead source on both buttons;
// - the route's head from routeMeta.js, its breadcrumbs and AboutPage markup.

const CONTENT = { bg: bgContent, en: enContent, el: elContent }
const ROUTES = { bg: BgAboutRoute, en: EnAboutRoute, el: ElAboutRoute }
const LOCALES = ['bg', 'en', 'el']
const SITE = 'https://nvc-home4you.eu'
// Factories in the plural, in the three languages (a word boundary does not see Greek letters, hence the lookahead).
const PLURAL_FACTORY = /фабрики|factories|εργοστάσια(?![\p{L}])/iu

const CASE = {
  id: '2',
  rating: 5,
  year: '2026',
  quote: 'The house looks great. I am now renting it out and have everything perfectly working.',
  images: ['/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp'],
}
// Figures no module holds, so only the feed can print them.
const REVIEWS = {
  averageRating: 4.73,
  totalCount: 17,
  items: [{ id: 1, name: 'Мария', rating: 5, comment: 'Много сме доволни.', product: 'modularHouses' }],
}

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
let feed = { reviews: true, cases: true }
let caseBody = CASE
let reviewsBody = REVIEWS
// The /api/home/photos answer; null answers 503, as every other unknown call does.
let photosBody = null

class FakeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  feed = { reviews: true, cases: true }
  caseBody = CASE
  reviewsBody = REVIEWS
  photosBody = null
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.stubGlobal('matchMedia', (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/api/cases-page') && feed.cases) return json({ cases: [caseBody], reviews: [] })
    if (u.includes('/api/reviews/featured') && feed.reviews) return json(reviewsBody)
    if (u.includes('/api/home/photos') && photosBody) return json(photosBody)
    return Promise.resolve({ ok: false, status: 503 })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  // The photo body is kept for the visit; each test starts as a first visit (no admin
  // photo carried over from the test before).
  forgetHomePhotos()
})

function renderPage(locale = 'bg', actions = {}) {
  return render(
    <MemoryRouter initialEntries={[paths.about[locale]]}>
      <ModalActionsProvider onOpenOffer={actions.offer || (() => {})} onOpenQuestion={actions.question || (() => {})}>
        <AboutPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

/** Rendered with both feeds answered: the case card and the reviews are on the page. */
async function ready(locale, actions) {
  const view = renderPage(locale, actions)
  await waitFor(() => expect(view.container.querySelector('[data-fact="reviews"]')).not.toBeNull())
  await waitFor(() => expect(view.container.querySelector('.ab-proof')).not.toBeNull())
  await waitFor(() => expect(view.container.querySelector('.testimonials')).not.toBeNull())
  return view
}

// Spaces of every kind read as one; the word joiners that hold "3–4" together read as nothing.
const flat = (s) => String(s ?? '').replace(/⁠/g, '').replace(/\s/g, ' ')
const mainText = (container) => flat(container.querySelector('main').textContent)

/** Every [dotted path, string] in a value. */
function strings(value, at = '') {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}

describe('AboutPage', () => {
  it.each(LOCALES)('%s: the sections in order, one H1 with the brand, no skipped heading level', async (locale) => {
    const { container } = await ready(locale)
    const ids = ['ab-hero-title', 'ab-facts-title', 'ab-who-title', 'ab-team-title', 'ab-journey-title', 'ab-writing-title', 'warranty-title', 'ab-siblings-title', 'hp-final-title']
    const order = [...container.querySelectorAll('h1, h2')].map((h) => h.id)
    for (const id of ids) expect(order.indexOf(id), id).toBeGreaterThanOrEqual(0)
    expect(ids.map((id) => order.indexOf(id))).toEqual([...ids.map((id) => order.indexOf(id))].sort((a, b) => a - b))
    // The reviews come between the warranty and the next pages.
    const reviews = container.querySelector('.testimonials')
    expect(container.querySelector('#warranty').compareDocumentPosition(reviews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(reviews.compareDocumentPosition(container.querySelector('#ab-siblings')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const h1 = container.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toContain('NVC Home4You')
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]))
    levels.forEach((level, i) => { if (i) expect(level - levels[i - 1]).toBeLessThanOrEqual(1) })
  })

  it.each(LOCALES)('%s: none of the old figures or years, no renovation-first story', async (locale) => {
    const { container } = await ready(locale)
    const text = mainText(container)
    expect(text).not.toMatch(/40\+/)
    expect(text).not.toMatch(/\b6\s*(държави|countries|χώρες)/i)
    expect(text).not.toMatch(/\b8\s*(седмици|weeks|εβδομάδες)/i)
    expect(text).not.toMatch(/Обслужвани държави|Countries served|Χώρες που εξυπηρετούμε/i)
    expect(text).not.toMatch(/Средно време|lead time|Μέσος χρόνος/i)
    for (const year of ['2019', '2022']) expect(text).not.toContain(year)
    // The old story began with interior renovations; the business began in logistics.
    expect(text).not.toMatch(/Започнахме с интериорни|started out in interior|Ξεκινήσαμε με ανακαινίσεις/i)
    expect(text).not.toMatch(/ЕИК|EIK|ΕΙΚ|БУЛСТАТ/i)
  })

  it.each(LOCALES)('%s: the owner\'s timeline, 2021 to 2026, starting the year the company was founded', async (locale) => {
    const { container } = await ready(locale)
    const steps = [...container.querySelectorAll('#who .ab-timeline > li')]
    expect(steps.map((li) => li.dataset.year)).toEqual(['2021', '2024', '2025', '2026'])
    expect(steps[0].dataset.year).toBe(String(COMPANY.foundingYear))
    const read = steps.map((li) => flat(li.textContent))
    expect(read[0]).toMatch({ bg: /логисти/i, en: /logistics/i, el: /εφοδιαστικ|μεταφορ/i }[locale])
    expect(read[1]).toMatch({ bg: /контейнери/i, en: /containers/i, el: /κοντέινερ/i }[locale])
    expect(read[2]).toMatch({ bg: /Бокс къщи/, en: /Box houses/, el: /σπίτια Box/i }[locale])
    expect(read[3]).toMatch({ bg: /стоманен/i, en: /steel/i, el: /μεταλλικ/i }[locale])
    for (const li of steps) expect(li.querySelector('h3')).not.toBeNull()
    // Today's renovations, by our own builders, link to the interiors page.
    const who = container.querySelector('#who')
    expect(flat(who.textContent)).toMatch({ bg: /от София до Петрич/, en: /from Sofia to Petrich/, el: /από τη Σόφια έως το Πέτριτς/ }[locale])
    expect([...who.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))).toContain(paths.interiors[locale])
  })

  it.each(LOCALES)('%s: the company, its VAT number and visits by appointment', async (locale) => {
    const { container } = await ready(locale)
    const term = (key) => flat(container.querySelector(`#who [data-term="${key}"]`)?.textContent)
    expect(term('company')).toContain(COMPANY.name)
    expect(term('company')).toContain(COMPANY.vatID)
    expect(term('company')).toMatch(/ДДС номер|VAT number|αριθμός ΦΠΑ/)
    expect(term('visits')).toMatch({ bg: /само след предварителна уговорка/, en: /by prior appointment only/, el: /μόνο κατόπιν ραντεβού/ }[locale])
    // The number is read from shared/company.js, never typed in the content.
    for (const t of CONTENT[locale].story.terms) expect(t.text, t.key).not.toContain(COMPANY.vatID)
  })

  it.each(LOCALES)('%s: the six people, by name and role, with no contact details of their own', async (locale) => {
    const { container } = await ready(locale)
    const team = container.querySelector('#team')
    const cards = [...team.querySelectorAll('[data-person]')]
    expect(cards.map((li) => li.dataset.person)).toEqual([
      'vladimir-vladimirov', 'tsvetelin-bonin', 'nikolay-lekov', 'radina-ivanova', 'vasil-vasilev', 'ivan-vasilev',
    ])
    const names = {
      bg: ['Владимир Владимиров', 'Цветелин Бонин', 'Николай Леков', 'Радина Иванова', 'Васил Василев', 'Иван Василев'],
      en: ['Vladimir Vladimirov', 'Tsvetelin Bonin', 'Nikolay Lekov', 'Radina Ivanova', 'Vasil Vasilev', 'Ivan Vasilev'],
      el: ['Βλαντιμίρ Βλαντιμίροφ', 'Τσβετελίν Μπονίν', 'Νικολάι Λέκοφ', 'Ραντίνα Ιβάνοβα', 'Βασίλ Βασίλεφ', 'Ιβάν Βασίλεφ'],
    }[locale]
    expect(cards.map((li) => li.querySelector('h3').textContent)).toEqual(names)
    // The three directors share one title, each with an area; the two builders share theirs.
    const roles = cards.map((li) => li.querySelector('.ab-person-role').textContent)
    expect(new Set(roles.slice(0, 3)).size).toBe(1)
    expect(roles[4]).toBe(roles[5])
    expect(cards.slice(0, 3).every((li) => li.querySelector('.ab-person-area')?.textContent)).toBe(true)
    // The three directors have photos (2026-10-15); the rest keep their initials. Either is
    // decorative, hidden from screen readers: the name is the heading right beside it.
    const photos = cards.slice(0, 3).map((li) => li.querySelector('img.ab-avatar'))
    photos.forEach((img, i) => {
      expect(img.getAttribute('src')).toBe(`/${TEAM_PHOTOS[cards[i].dataset.person]}`)
      expect(img.getAttribute('alt')).toBe('')
    })
    const monograms = cards.slice(3).map((li) => li.querySelector('.ab-monogram'))
    expect(monograms[0].textContent).toBe(names[3].split(' ').map((w) => w[0]).join(''))
    for (const m of monograms) expect(m.getAttribute('aria-hidden')).toBe('true')
    // No personal phones or emails.
    expect(team.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull()
    expect(team.textContent).not.toMatch(/@|\+359/)
  })

  it('shows a person\'s photo once TEAM_PHOTOS lists it, and the initials again if it fails', async () => {
    TEAM_PHOTOS['radina-ivanova'] = 'about/team/radina-ivanova.webp'
    try {
      const { container } = renderPage('bg')
      const card = container.querySelector('[data-person="radina-ivanova"]')
      const img = card.querySelector('img.ab-avatar')
      expect(img.getAttribute('src')).toBe('/about/team/radina-ivanova.webp')
      expect(img.getAttribute('alt')).toBe('')
      expect(card.querySelector('.ab-monogram')).toBeNull()
      expect(container.querySelector('[data-person="ivan-vasilev"] img')).toBeNull()
      fireEvent.error(img)
      expect(card.querySelector('img')).toBeNull()
      expect(card.querySelector('.ab-monogram').textContent).toBe('РИ')
    } finally {
      delete TEAM_PHOTOS['radina-ivanova']
    }
  })

  it.each(LOCALES)('%s: every buyer gets the documents, and the factory checks quality before shipping', async (locale) => {
    const { container } = await ready(locale)
    const term = (key) => flat(container.querySelector(`#in-writing [data-term="${key}"]`)?.textContent)
    expect(term('documents')).toMatch(/\bCE\b/)
    expect(term('documents')).toMatch({ bg: /списък на материалите и чертежите/, en: /list of materials and the drawings/, el: /κατάλογο των υλικών και τα σχέδια/ }[locale])
    expect(term('qc')).toMatch({ bg: /проверяваме качеството/, en: /check its quality at our factory/, el: /ελέγχουμε την ποιότητά της/ }[locale])
    const keys = [...container.querySelectorAll('#in-writing [data-term]')].map((el) => el.dataset.term)
    expect(keys).toEqual(['contract', 'documents', 'qc', 'customs', 'insurance', 'unloading', 'prices'])
  })

  it.each(LOCALES)('%s: the home page and the privacy page agree: 2021, and the VAT number', (locale) => {
    const home = JSON.stringify({ bg: bgHome, en: enHome, el: elHome }[locale])
    expect(home).toContain(String(COMPANY.foundingYear))
    expect(home).not.toMatch(/Строим домове от 2022|since 2022|από το 2022/)
    // The company's age, not "homes on the market since": 2021 was logistics.
    expect(home).not.toMatch(/На пазара от|Στην αγορά από/)
    expect(home).toContain({ bg: 'Фирма от 2021 г.', en: 'In business since 2021', el: 'Εταιρεία από το 2021' }[locale])
    const privacy = JSON.stringify({ bg: bgPrivacy, en: enPrivacy, el: elPrivacy }[locale])
    expect(privacy).toContain(COMPANY.vatID)
    expect(privacy).not.toMatch(/да бъде попълнен|to be completed by|θα συμπληρωθεί/)
  })

  it.each(LOCALES)('%s: one factory, ours, in China, and no suppliers', async (locale) => {
    const { container } = await ready(locale)
    const text = mainText(container)
    expect(text).toContain({ bg: 'нашата фабрика в Китай', en: 'our factory in China', el: 'εργοστάσιό μας στην Κίνα' }[locale])
    expect(text).not.toMatch(PLURAL_FACTORY)
    expect(text).not.toMatch(/доставчи|supplier|προμηθευτ/i)
    // And in the content file, pending questions included.
    const all = strings(CONTENT[locale]).map(([, s]) => s).join('\n')
    expect(all).not.toMatch(PLURAL_FACTORY)
    expect(all).not.toMatch(/доставчи|supplier|προμηθευτ/i)
  })

  it.each(LOCALES)('%s: every figure from its module or the reviews feed, no placeholder left', async (locale) => {
    const { container } = await ready(locale)
    const tile = (key) => flat(container.querySelector(`[data-fact="${key}"]`)?.textContent)
    expect(tile('homes')).toContain(String(COMPANY.homesDelivered))
    expect(tile('container')).toContain(String(LEAD_TIMES.containerInStockDays))
    expect(tile('production')).toContain(String(LEAD_TIMES.boxProductionDays))
    expect(tile('toAddress')).toContain(String(LEAD_TIMES.boxToAddressMonths))
    expect(tile('warranty')).toContain(String(WARRANTY_YEARS.structure))
    // The 15 years are the structure's: the tile says so.
    expect(tile('warranty')).toMatch(/конструкц|structure|σκελετ/i)
    expect(tile('reviews')).toContain('4.7')
    expect(tile('reviews')).toContain('17')
    expect(mainText(container)).not.toMatch(/\{\w+\}/)
    // The warranty table carries every year from the module.
    const rows = [...container.querySelectorAll('[data-warranty]')].map((row) => row.dataset.warranty)
    expect(rows).toEqual(Object.keys(WARRANTY_YEARS))
  })

  it.each(LOCALES)('%s: types no figure in the facts it prints', (locale) => {
    for (const [at, text] of strings(CONTENT[locale].facts.tiles)) {
      // "out of 5" is the rating scale, not a figure of ours.
      const bare = text.replace(/\{\w+\}/g, '').replace(/(от|out of|από) 5/g, '')
      expect(bare, at).not.toMatch(/\d/)
    }
    for (const row of CONTENT[locale].warranty.rows) expect(row.text).toMatch(/^\{years\}\D*$/)
  })

  it('hides the review tile, never a zero, when the reviews do not answer', async () => {
    feed.reviews = false
    const { container } = renderPage('bg')
    await waitFor(() => expect(container.querySelector('.ab-proof')).not.toBeNull())
    expect(container.querySelector('[data-fact="reviews"]')).toBeNull()
    expect(container.querySelectorAll('[data-fact]')).toHaveLength(5)
    expect(container.querySelector('.testimonials')).toBeNull()
    expect(mainText(container)).not.toMatch(/\b0\.0\b|— от/)
  })

  it('hides the review tile when the feed has a single review ("1 verified reviews")', async () => {
    reviewsBody = { ...REVIEWS, totalCount: 1 }
    const { container } = renderPage('bg')
    await waitFor(() => expect(container.querySelector('.testimonials')).not.toBeNull())
    expect(container.querySelector('[data-fact="reviews"]')).toBeNull()
    expect(container.querySelectorAll('[data-fact]')).toHaveLength(5)
  })

  it.each(LOCALES)('%s: the case line carries the year of the published case, not a typed one', async (locale) => {
    caseBody = { ...CASE, year: '2031' }
    const { container } = renderPage(locale)
    await waitFor(() => expect(container.querySelector('.ab-proof')).not.toBeNull())
    const line = flat(container.querySelector('.ab-proof .cs-review-name').textContent)
    expect(line).toMatch(/· 2031$/)
    expect(CONTENT[locale].proof.case.line).not.toMatch(/20\d\d/)
  })

  it.each(LOCALES)('%s: claims no more than the owner gave: no "in writing" heading, no yard named, Box assembly priced apart', async (locale) => {
    const { container } = await ready(locale)
    expect(flat(container.querySelector('#ab-writing-title').textContent)).not.toMatch(/черно на бяло|in writing|γραπτώς/i)
    const term = (key) => flat(container.querySelector(`[data-term="${key}"]`).textContent)
    expect(term('unloading')).not.toMatch(/Марикостиново|Marikostinovo|Μαρικοστίνοβο/)
    expect(term('prices')).toMatch({ bg: /Бокс къщите са с ДДС, а монтажът е отделно/, en: /assembly priced separately/, el: /συναρμολόγηση τιμολογείται χωριστά/ }[locale])
  })

  it('leaves out the case card when the case is not published', async () => {
    feed.cases = false
    const { container } = renderPage('bg')
    await waitFor(() => expect(container.querySelector('[data-fact="reviews"]')).not.toBeNull())
    expect(container.querySelector('.ab-proof')).toBeNull()
    expect(mainText(container)).not.toContain('Паралия Кариани')
  })

  it.each(LOCALES)('%s: the homes count and the hours the owner confirmed, each from one place', async (locale) => {
    const { container } = await ready(locale)
    const home = { bg: bgHome, en: enHome, el: elHome }[locale].home
    // The figure is read from shared/company.js, and the home page states the same number.
    expect(home.hero.facts.join(' ')).toContain(String(COMPANY.homesDelivered))
    expect(home.stats.items[0].value).toBe(COMPANY.homesDelivered)
    expect(JSON.stringify(CONTENT[locale].facts)).not.toContain(String(COMPANY.homesDelivered))
    expect(Object.keys(CONTENT[locale])).not.toContain('pending')
    // The hours are the footer's, from the home content's contact band, never typed here.
    const hours = flat(container.querySelector('#who [data-term="hours"] dd').textContent)
    expect(hours).toBe(flat(home.band.hours))
    expect(JSON.stringify(CONTENT[locale].story)).not.toMatch(/\d{2}:\d{2}/)
  })

  it.each(LOCALES)('%s: only the owner\'s own photos', async (locale) => {
    const { container } = await ready(locale)
    const srcs = [...container.querySelectorAll('main img')].map((img) => img.getAttribute('src'))
    expect(srcs.length).toBeGreaterThanOrEqual(6)
    for (const src of srcs) expect(src).toMatch(/^\/(delivery\/|factory\/(factory-hall-1200|clip-factory-pan)\.webp$|api\/img\/cases\/|about\/team\/)/)
    expect(srcs).toContain(ABOUT_PHOTO.url)
    expect(srcs).toContain(FACTORY_PHOTO.url)
    expect(srcs).toContain(FACTORY_CLIP.poster)
    expect(srcs).not.toContain('/partner/factory-floor.webp')
    for (const img of container.querySelectorAll('main img')) {
      // Clip posters and team avatars are decorative (the clip's caption and the person's name sit beside them).
      if (!img.closest('.dl-clip-media') && !img.classList.contains('ab-avatar')) expect(img.getAttribute('alt'), img.getAttribute('src')).toBeTruthy()
    }
  })

  it.each(LOCALES)('%s: links on to Cases, FAQ, Gallery, Delivery, Prices, Interiors, Partner and Doors', async (locale) => {
    const { container } = await ready(locale)
    const hrefs = [...container.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href'))
    for (const key of ['cases', 'faq', 'gallery', 'delivery', 'prices', 'interiors', 'partner', 'doors']) expect(hrefs, key).toContain(paths[key][locale])
    expect(hrefs.some((h) => h.startsWith('tel:'))).toBe(true)
    expect(hrefs.some((h) => h.startsWith('mailto:'))).toBe(true)
    // The four cards, then partner and doors (2026-10-16).
    const siblings = within(container.querySelector('#ab-siblings'))
    expect(siblings.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(
      ['cases', 'faq', 'gallery', 'delivery', 'partner', 'doors'].map((key) => paths[key][locale]),
    )
  })

  it.each(LOCALES)('%s: the timeline links 2024, 2025 and 2026 to the containers, Box and steel pages', async (locale) => {
    const { container } = await ready(locale)
    const step = (year) => container.querySelector(`.ab-step[data-year="${year}"]`)
    expect(step('2021').querySelector('a')).toBeNull()
    for (const [year, key] of [['2024', 'modularBuilds'], ['2025', 'modularHouses'], ['2026', 'steelHouses']]) {
      const link = within(step(year)).getByRole('link')
      expect(link).toHaveAttribute('href', paths[key][locale])
      expect(link).toHaveTextContent(CONTENT[locale].story.timeline.find((s) => s.year === year).link)
    }
  })

  it.each(LOCALES)('%s: the delivered case links to its own card on the cases page', async (locale) => {
    const { container } = await ready(locale)
    const link = within(container).getByRole('link', { name: CONTENT[locale].proof.more })
    expect(link).toHaveAttribute('href', `${paths.cases[locale]}#case-${CONTENT[locale].proof.case.id}`)
  })

  it('opens the offer and the question forms with the page\'s lead source', async () => {
    const offer = vi.fn()
    const question = vi.fn()
    const { container } = await ready('bg', { offer, question })
    const hero = within(container.querySelector('.pp-hero'))
    fireEvent.click(hero.getByRole('button', { name: bgContent.hero.offer }))
    const closing = within(container.querySelector('#final-cta'))
    fireEvent.click(closing.getAllByRole('button')[0])
    fireEvent.click(closing.getAllByRole('button')[1])
    expect(offer).toHaveBeenCalledTimes(2)
    expect(offer).toHaveBeenNthCalledWith(1, { source: ABOUT_LEAD_SOURCE, origin: 'about' })
    expect(offer).toHaveBeenNthCalledWith(2, { source: ABOUT_LEAD_SOURCE, origin: 'about' })
    expect(question).toHaveBeenCalledWith({ source: ABOUT_LEAD_SOURCE })
    expect(ABOUT_LEAD_SOURCE).toBe('about-page')
  })

  it('does not animate on load and bakes in no date', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'AboutPage.jsx'), 'utf8')
    expect(source).not.toMatch(/from ['"]framer-motion['"]/)
    expect(source).not.toMatch(/new Date\(|getFullYear\(/)
  })

  it('the three languages carry the same shape', () => {
    const shape = (value) => (Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
        : typeof value)
    expect(shape(enContent)).toEqual(shape(bgContent))
    expect(shape(elContent)).toEqual(shape(bgContent))
  })
})

// The page's photos the owner can change in "Снимки на сайта" (since 2026-10-16): the hero
// (about-hero), the factory floor (factory-floor) and one per person (about-team-<slug>). An
// empty slot draws exactly what the page drew before; a filled one shows the owner's photo
// through the resizer, with his description on the Bulgarian page and the content's general
// words otherwise, and falls back to today's picture if it fails to load.
describe('the About page\'s photo slots', () => {
  const HERO = { url: '/api/img/home/14/base.webp', alt: 'Нашата база в Марикостиново' }
  const FLOOR = { url: '/api/img/home/21/floor.webp', alt: 'Цехът отблизо' }
  const VLADIMIR = { url: '/api/img/home/15/vladimir.webp', alt: 'не се чете' }
  const RADINA = { url: '/api/img/home/18/radina.webp', alt: '' }
  const withSlots = (slots) => ({ hero: [], models: {}, pages: {}, slots })

  const heroImg = (container) => container.querySelector('.pp-hero-media img')
  const floorImg = (container) => container.querySelector('.ab-factory img')
  const person = (container, slug) => container.querySelector(`[data-person="${slug}"]`)
  const photosCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes('/api/home/photos'))

  /** What the page drew before the slots, piece by piece. */
  it.each(LOCALES)('%s: the journey opens on the factory loop, then the four delivery clips', async (locale) => {
    const c = CONTENT[locale]
    const { container } = await ready(locale)
    const clips = [...container.querySelectorAll('#journey .dl-clip')]
    expect(c.journey.clips.map((clip) => clip.id)).toEqual(['factory', 'port', 'yard', 'truck', 'plot'])
    expect(clips.map((li) => li.querySelector('h3').textContent)).toEqual(c.journey.clips.map((clip) => clip.title))
    // The factory's own files; the others stay the delivery page's.
    expect(clips[0].querySelector('img').getAttribute('src')).toBe(FACTORY_CLIP.poster)
    expect(clips[0].querySelector('img').getAttribute('alt')).toBe('')
    expect(clips.slice(1).map((li) => li.querySelector('img').getAttribute('src'))).toEqual(
      ['port', 'yard', 'truck', 'plot'].map((id) => `/delivery/journey-${id}.webp`),
    )
    // One row of five on a wide screen.
    expect(container.querySelector('#journey .dl-clips').style.getPropertyValue('--dl-clip-count')).toBe('5')
    // One factory, ours, in China.
    expect(c.journey.clips[0].text).not.toMatch(PLURAL_FACTORY)
    expect(c.journey.clips[0].text).toMatch(/нашата фабрика в Китай|our factory in China|εργοστασίου μας στην Κίνα/)
  })

  function expectToday(container, locale) {
    const c = CONTENT[locale]
    const hero = heroImg(container)
    expect(hero.getAttribute('src')).toBe(ABOUT_PHOTO.url)
    expect(hero.getAttribute('srcset')).toBe(ABOUT_PHOTO.srcSet)
    expect(hero.getAttribute('alt')).toBe(c.hero.photoAlt)
    expect(hero.hasAttribute('style')).toBe(false)
    expect(container.querySelector('.pp-hero-chip')).toBeNull()
    // The factory figure: its 600 and 1200 px files (a phone takes the small one), no style or
    // handler of its own.
    const floor = floorImg(container)
    expect([...floor.attributes].map((a) => `${a.name}=${a.value}`).sort()).toEqual([
      `alt=${c.journey.factory.alt}`, 'decoding=async', 'height=891', 'loading=lazy',
      'sizes=(max-width: 719px) 100vw, (max-width: 899px) 50vw, 780px', `src=${FACTORY_PHOTO.url}`,
      `srcset=${FACTORY_PHOTO.small} 600w, ${FACTORY_PHOTO.url} 1200w`, 'width=1200',
    ])
    for (const slug of ['vladimir-vladimirov', 'tsvetelin-bonin', 'nikolay-lekov']) {
      const img = person(container, slug).querySelector('img.ab-avatar')
      expect([...img.attributes].map((a) => `${a.name}=${a.value}`).sort()).toEqual([
        'alt=', 'class=ab-avatar', 'decoding=async', 'height=160', 'loading=lazy', `src=/${TEAM_PHOTOS[slug]}`, 'width=160',
      ])
    }
    for (const slug of ['radina-ivanova', 'vasil-vasilev', 'ivan-vasilev']) {
      expect(person(container, slug).querySelector('img')).toBeNull()
      expect(person(container, slug).querySelector('.ab-monogram')).not.toBeNull()
    }
  }

  it.each(LOCALES)('%s: with every slot empty the page is exactly as before, whatever the API answers', async (locale) => {
    for (const body of [null, {}, withSlots({}), { hero: [], models: {}, pages: {} }]) {
      photosBody = body
      const { container, unmount } = renderPage(locale)
      expectToday(container, locale)
      await waitFor(() => expect(photosCalls().length).toBeGreaterThan(0))
      await act(async () => {})
      expectToday(container, locale)
      // No error handler was added to the factory figure either: a failed load stays as it was.
      fireEvent.error(floorImg(container))
      fireEvent.error(floorImg(container))
      expect(floorImg(container).getAttribute('src')).toBe(FACTORY_PHOTO.url)
      expect(Object.keys(floorImg(container).dataset)).toEqual([])
      unmount()
      forgetHomePhotos()
      fetch.mockClear()
    }
  })

  it.each(LOCALES)('%s: the owner\'s hero and factory photos, through the resizer, with the right words', async (locale) => {
    const c = CONTENT[locale]
    photosBody = withSlots({ 'about-hero': HERO, 'factory-floor': FLOOR })
    const { container } = await ready(locale)
    await waitFor(() => expect(heroImg(container).getAttribute('src')).toContain(HERO.url))

    const hero = heroImg(container)
    expect(hero.getAttribute('src')).toBe(cdnImage(HERO.url, { width: 800 }))
    expect(hero.getAttribute('srcset')).toBe(cdnSrcSet(HERO.url, [480, 640, 800, 1200, 1600]))
    expect(hero.getAttribute('srcset')).not.toContain('crane-lift')
    // The owner types Bulgarian; the other languages get the page's general words.
    expect(hero.getAttribute('alt')).toBe(locale === 'bg' ? HERO.alt : c.hero.adminAlt)
    expect(hero.hasAttribute('style')).toBe(false)

    const floor = floorImg(container)
    expect(floor.getAttribute('src')).toBe(cdnImage(FLOOR.url, { width: 1200 }))
    expect(floor.getAttribute('srcset')).toBe(cdnSrcSet(FLOOR.url, [480, 640, 800, 1200, 1600]))
    expect(floor.getAttribute('sizes')).toBe('(max-width: 719px) 100vw, (max-width: 899px) 50vw, 780px')
    expect(floor.getAttribute('alt')).toBe(locale === 'bg' ? FLOOR.alt : c.journey.factory.adminAlt)
    expect(floor.getAttribute('width')).toBe('1200')
    expect(floor.getAttribute('height')).toBe('891')
    expect(floor.style.objectPosition).toBe('50% 50%')

    // Still only the owner's own photos: his uploads are under /api/img/home/.
    for (const img of container.querySelectorAll('main img')) {
      expect(img.getAttribute('src')).toMatch(/^\/(delivery\/|factory\/(factory-hall-1200|clip-factory-pan)\.webp$|api\/img\/cases\/|api\/img\/home\/|about\/team\/)/)
    }
  })

  it('a blank description in the panel gives the page\'s general words, never the crane\'s', async () => {
    photosBody = withSlots({ 'about-hero': { ...HERO, alt: '  ' }, 'factory-floor': { ...FLOOR, alt: '' } })
    const { container } = renderPage('bg')
    await waitFor(() => expect(heroImg(container).getAttribute('src')).toContain(HERO.url))
    expect(heroImg(container).getAttribute('alt')).toBe(bgContent.hero.adminAlt)
    expect(floorImg(container).getAttribute('alt')).toBe(bgContent.journey.factory.adminAlt)
  })

  it('falls back to the crane and the factory floor if the owner\'s photos fail to load', async () => {
    photosBody = withSlots({ 'about-hero': HERO, 'factory-floor': FLOOR })
    const { container } = renderPage('bg')
    await waitFor(() => expect(floorImg(container).getAttribute('src')).toContain(FLOOR.url))
    for (const [img, fallback] of [[heroImg(container), ABOUT_PHOTO.url], [floorImg(container), FACTORY_PHOTO.url]]) {
      // One retry of the owner's photo, then today's.
      fireEvent.error(img)
      fireEvent.error(img)
      expect(img.getAttribute('src')).toBe(fallback)
      expect(img.hasAttribute('srcset')).toBe(false)
      expect(img.dataset.imgFallback).toBe(fallback)
    }
  })

  it.each(LOCALES)('%s: a person\'s photo from the panel first, then the file, then the initials; always decorative', async (locale) => {
    photosBody = withSlots({ 'about-team-vladimir-vladimirov': VLADIMIR, 'about-team-radina-ivanova': RADINA })
    const { container } = renderPage(locale)
    await waitFor(() => expect(person(container, 'radina-ivanova').querySelector('img')).not.toBeNull())

    const vladimir = person(container, 'vladimir-vladimirov').querySelector('img.ab-avatar')
    expect(vladimir.getAttribute('src')).toBe(cdnImage(VLADIMIR.url, { width: 160 }))
    expect(vladimir.getAttribute('src')).toContain('?w=160')
    expect(vladimir.getAttribute('srcset')).toBe(cdnSrcSet(VLADIMIR.url, [160, 240, 320]))
    expect(vladimir.getAttribute('sizes')).toBe('72px')
    expect(vladimir.getAttribute('alt')).toBe('')
    // An upright phone portrait keeps the head in the circle.
    expect(vladimir.style.objectPosition).toBe('50% 30%')
    fireEvent.error(vladimir)
    const file = person(container, 'vladimir-vladimirov').querySelector('img.ab-avatar')
    expect(file.getAttribute('src')).toBe(`/${TEAM_PHOTOS['vladimir-vladimirov']}`)
    expect(file.hasAttribute('srcset')).toBe(false)
    expect(file.hasAttribute('style')).toBe(false)
    fireEvent.error(file)
    expect(person(container, 'vladimir-vladimirov').querySelector('img')).toBeNull()
    expect(person(container, 'vladimir-vladimirov').querySelector('.ab-monogram')).not.toBeNull()

    // Radina has no file: her photo, then her initials.
    const radina = person(container, 'radina-ivanova').querySelector('img.ab-avatar')
    expect(radina.getAttribute('src')).toBe(cdnImage(RADINA.url, { width: 160 }))
    expect(radina.getAttribute('alt')).toBe('')
    expect(person(container, 'radina-ivanova').querySelector('.ab-monogram')).toBeNull()
    fireEvent.error(radina)
    expect(person(container, 'radina-ivanova').querySelector('img')).toBeNull()
    expect(person(container, 'radina-ivanova').querySelector('.ab-monogram').getAttribute('aria-hidden')).toBe('true')

    // The others as before.
    expect(person(container, 'tsvetelin-bonin').querySelector('img').getAttribute('src')).toBe(`/${TEAM_PHOTOS['tsvetelin-bonin']}`)
    expect(person(container, 'ivan-vasilev').querySelector('img')).toBeNull()
  })

  it('a new photo for a person starts afresh, even after the last one failed', async () => {
    photosBody = withSlots({ 'about-team-radina-ivanova': RADINA })
    const { container } = renderPage('bg')
    await waitFor(() => expect(person(container, 'radina-ivanova').querySelector('img')).not.toBeNull())
    fireEvent.error(person(container, 'radina-ivanova').querySelector('img'))
    expect(person(container, 'radina-ivanova').querySelector('.ab-monogram')).not.toBeNull()

    // The owner uploads another; the next answer brings it.
    photosBody = withSlots({ 'about-team-radina-ivanova': { url: '/api/img/home/18/radina-2.webp', alt: '' } })
    await act(async () => { await fetchHomePhotos() })
    await waitFor(() => expect(person(container, 'radina-ivanova').querySelector('img')?.getAttribute('src')).toContain('radina-2.webp'))
  })

  it('opens on the owner\'s photos from the first render once an answer is kept', async () => {
    // What the snapshot's <head> copy gives a fresh load (homePhotos.test.js reads that path);
    // here an earlier answer on the same visit stands in for it.
    photosBody = withSlots({ 'about-hero': HERO, 'factory-floor': FLOOR, 'about-team-radina-ivanova': RADINA })
    await fetchHomePhotos()
    expect(document.getElementById(HOME_PHOTOS_SEED_ID)).not.toBeNull()

    const { container } = renderPage('bg')
    // No waiting: the very first render has them, so nothing swaps from the default.
    expect(heroImg(container).getAttribute('src')).toBe(cdnImage(HERO.url, { width: 800 }))
    expect(floorImg(container).getAttribute('src')).toBe(cdnImage(FLOOR.url, { width: 1200 }))
    expect(person(container, 'radina-ivanova').querySelector('img').getAttribute('src')).toBe(cdnImage(RADINA.url, { width: 160 }))
  })

  it.each(LOCALES)('%s: the general words for the owner\'s photos are there and describe no default photo', (locale) => {
    const c = CONTENT[locale]
    expect(c.hero.adminAlt).toBeTruthy()
    expect(c.hero.adminAlt).not.toBe(c.hero.photoAlt)
    expect(c.journey.factory.adminAlt).toBeTruthy()
    expect(c.journey.factory.adminAlt).not.toBe(c.journey.factory.alt)
  })
})

describe('the About routes', () => {
  function renderRoute(locale) {
    const Route = ROUTES[locale]
    const helmet = {}
    const view = render(
      <HelmetProvider context={helmet}>
        <MemoryRouter initialEntries={[paths.about[locale]]}>
          <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
            <Route />
          </ModalActionsProvider>
        </MemoryRouter>
      </HelmetProvider>,
    )
    return view
  }

  it.each(LOCALES)('%s: the head from routeMeta.js, without the old "team" promise', (locale) => {
    const seo = getRouteSeo(paths.about[locale], locale)
    expect(seo.title.length).toBeLessThanOrEqual(70)
    expect(seo.description.length).toBeGreaterThanOrEqual(130)
    expect(seo.description.length).toBeLessThanOrEqual(160)
    expect(seo.description).toContain(String(WARRANTY_YEARS.structure))
    expect(`${seo.title} ${seo.description}`).not.toMatch(/екип|майсторство|team|craftsmanship|ομάδα|μαστοριά|20(19|21|22)|\b87\b/i)
    expect(seo.canonical).toBe(`${SITE}${paths.about[locale]}`)
    expect(Object.fromEntries(seo.hreflangs.map((h) => [h.hrefLang, h.href]))).toEqual({
      bg: `${SITE}${paths.about.bg}`,
      en: `${SITE}${paths.about.en}`,
      el: `${SITE}${paths.about.el}`,
      'x-default': `${SITE}${paths.about.en}`,
    })
    expect(seo.image).toBe(`${SITE}${ABOUT_PHOTO.url}`)
    expect(seo.imageAlt).toBe(CONTENT[locale].hero.photoAlt)
  })

  it.each(LOCALES)('%s: breadcrumbs and an AboutPage of the site\'s Organization, with its VAT number and no unconfirmed field', async (locale) => {
    const { container } = renderRoute(locale)
    await waitFor(() => expect(container.querySelector('h1')).not.toBeNull())
    const data = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual([CONTENT[locale].home, CONTENT[locale].breadcrumb])
    expect(crumbs.itemListElement[1].item).toBe(`${SITE}${paths.about[locale]}`)
    const about = data.find((d) => d['@type'] === 'AboutPage')
    expect(about.url).toBe(`${SITE}${paths.about[locale]}`)
    expect(about.inLanguage).toBe(locale)
    expect(about.mainEntity['@id']).toBe(ORGANIZATION_ID)
    expect(about.primaryImageOfPage.url).toBe(`${SITE}${ABOUT_PHOTO.url}`)
    expect(about.mainEntity).toMatchObject({
      legalName: COMPANY.legalName,
      vatID: COMPANY.vatID,
      foundingDate: String(COMPANY.foundingYear),
    })
    const raw = JSON.stringify(about)
    for (const field of ['taxID', 'numberOfEmployees', 'aggregateRating', 'openingHours']) {
      expect(raw).not.toContain(field)
    }
  })

  it('keeps the crane as the markup\'s main picture when the owner has set his own hero', async () => {
    photosBody = { hero: [], models: {}, pages: {}, slots: { 'about-hero': { url: '/api/img/home/14/base.webp', alt: '' } } }
    const { container } = renderRoute('bg')
    await waitFor(() => expect(container.querySelector('.pp-hero-media img')?.getAttribute('src')).toContain('/api/img/home/14/'))
    const data = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    expect(data.find((d) => d['@type'] === 'AboutPage').primaryImageOfPage.url).toBe(`${SITE}${ABOUT_PHOTO.url}`)
    expect(getRouteSeo(paths.about.bg, 'bg').image).toBe(`${SITE}${ABOUT_PHOTO.url}`)
  })

  it('index.html\'s Organization carries the same legal name, VAT number and founding year', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8')
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
    const organization = blocks.find((block) => block['@type'] === 'Organization')
    expect(organization['@id']).toBe(ORGANIZATION_ID)
    expect(organization).toMatchObject({
      legalName: COMPANY.legalName,
      vatID: COMPANY.vatID,
      foundingDate: String(COMPANY.foundingYear),
    })
  })
})
