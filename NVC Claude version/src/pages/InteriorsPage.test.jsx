import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import InteriorsPage, { faqItems } from './InteriorsPage.jsx'
import { STAFF_LINES, WORKS, composeProject, projectLabels } from '../components/interiors/InteriorsEnquiry.jsx'
import bgContent from '../content/bg/interiors.js'
import enContent from '../content/en/interiors.js'
import elContent from '../content/el/interiors.js'
import { INTERIORS_MEDIA_PATHS, INTERIORS_PHOTOS } from '../content/shared/interiorsMedia.js'
import { _resetSubmissions } from '../lib/backgroundSubmit.js'
import { paths } from '../routes/paths.js'
import { getRouteSeo } from '../seo/routeMeta.js'

// The interiors page, rebuilt 2026-10-15 from the owner's answers of that day. What these pin:
// no price and no duration anywhere, in any language (the price comes after the free site
// visit; the old "до 1 седмица" scorer is gone); the eight works the owner named, in every
// language and in the form; the area, "from Sofia to Petrich" and no town list; the enquiry
// is the ordinary offer with origin 'interiors' and a summary in the page's language (the
// server mails it back to the visitor; staff read its Bulgarian origin line); every
// picture and clip is the owner's own (interiorsMedia.js), the old stock kitchen pair never.

const CONTENT = { bg: bgContent, en: enContent, el: elContent }
const LOCALES = ['bg', 'en', 'el']
const SITE = 'https://nvc-home4you.eu'
const PUBLIC = path.resolve(__dirname, '../../public')

/** Every [dotted path, string] in a content object. */
function strings(value, at = '') {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}

// A price in any of the three languages, and a length of time: a number with a unit of time,
// or a unit of time standing alone where a scorer once printed "1–2 седмици".
const PRICE = /€|\bEUR\b|\bлв\b|\bBGN\b|евро|\beuros?\b|ευρώ/i
const DURATION = /\d\s*(?:\+\s*)?(?:дн|ден|седмиц|месец|месеца|час|работни|days?|weeks?|months?|hours?|ημέρ|μέρ|εβδομάδ|μήν|ώρ)|седмиц|\bweeks?\b|εβδομάδ/i
// Words of the old scorer, in its three languages.
const SCORER = /сложност|complexity|πολυπλοκότητα|ориентировъчен срок|estimated timeline|εκτιμώμενο χρονοδιάγραμμα/i

let ioCallbacks = []
class FakeObserver {
  constructor(callback) { this.callback = callback; ioCallbacks.push(this) }
  observe(target) { this.callback([{ isIntersecting: true, intersectionRatio: 1, target }]) }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  _resetSubmissions()
  window.localStorage.clear()
  window.dataLayer = []
  ioCallbacks = []
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete window.dataLayer
})

function renderPage(locale = 'bg', { onOpenOffer = () => {}, onOpenQuestion = () => {} } = {}) {
  return render(
    <MemoryRouter>
      <ModalActionsProvider onOpenOffer={onOpenOffer} onOpenQuestion={onOpenQuestion}>
        <InteriorsPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

describe('no price and no duration', () => {
  it.each(LOCALES)('%s: the content names neither, nor any figure at all', (locale) => {
    const hits = strings(CONTENT[locale]).filter(([, text]) => PRICE.test(text) || DURATION.test(text) || SCORER.test(text) || /\d/.test(text))
    expect(hits).toEqual([])
  })

  it.each(LOCALES)('%s: the rendered page shows none, outside the shared closing card', (locale) => {
    const { container } = renderPage(locale)
    const main = container.querySelector('main').cloneNode(true)
    // The closing card's phone, email and opening hours are the site's (home.finalCta), and
    // the step numbers are ProcessSteps' own.
    main.querySelectorAll('#final-cta, .pp-step-n, script').forEach((el) => el.remove())
    const text = main.textContent
    expect(text).not.toMatch(PRICE)
    expect(text).not.toMatch(DURATION)
    expect(text).not.toMatch(SCORER)
    expect(text).not.toMatch(/\d/)
  })

  it.each(LOCALES)('%s: the search snippet names neither, and stays whole on a results page', (locale) => {
    const seo = getRouteSeo(paths.interiors[locale], locale)
    expect(seo.title.length).toBeLessThanOrEqual(70)
    expect(seo.title).toMatch(/\| NVC Home4You$/)
    expect(seo.description.length).toBeLessThanOrEqual(160)
    expect(`${seo.title} ${seo.description}`).not.toMatch(PRICE)
    expect(`${seo.title} ${seo.description}`).not.toMatch(DURATION)
    expect(`${seo.title} ${seo.description}`.replace('Home4You', '')).not.toMatch(/\d/)
    if (locale !== 'bg') expect(`${seo.title} ${seo.description} ${seo.imageAlt}`).not.toMatch(/\p{Script=Cyrillic}/u)
  })

  it('the old scorer, its brochure link and its tabs are gone', () => {
    const { container } = renderPage('bg')
    expect(container.querySelector('[role="tablist"], [role="slider"], input[type="range"]')).toBeNull()
    expect(container.querySelector('a[href*="/api/brochures/"]')).toBeNull()
    for (const locale of LOCALES) {
      const c = CONTENT[locale]
      for (const key of ['calculator', 'tabs', 'bath', 'kitchen', 'why', 'beforeAfterLabels', 'seo']) expect(c[key]).toBeUndefined()
    }
  })
})

describe('what we do', () => {
  it.each(LOCALES)('%s: the eight works the owner named, in the form\'s order', (locale) => {
    expect(CONTENT[locale].works.items.map((item) => item.key)).toEqual(WORKS)
    const { container } = renderPage(locale)
    const cards = [...container.querySelectorAll('#raboti .ir-work')]
    expect(cards.map((li) => li.dataset.work)).toEqual(WORKS)
    expect(cards.map((li) => li.querySelector('h3').textContent)).toEqual(CONTENT[locale].works.items.map((item) => item.title))
  })

  it('the Bulgarian names', () => {
    expect(bgContent.works.items.map((item) => item.title)).toEqual([
      'Къртене и демонтаж', 'ВиК', 'Електро', 'Плочки', 'Гипсокартон', 'Боядисване', 'Подови настилки', 'Монтаж на кухня',
    ])
  })

  it.each(LOCALES)('%s: materials ours or yours', (locale) => {
    const { container } = renderPage(locale)
    expect([...container.querySelectorAll('.ir-material')].map((li) => li.dataset.materials)).toEqual(['ours', 'yours'])
  })

  it.each(LOCALES)('%s: five steps, from the enquiry to the handover with the warranty, and no stage', (locale) => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    const { container } = renderPage(locale)
    const steps = [...container.querySelectorAll('#kak-rabotim .pp-step')]
    expect(steps).toHaveLength(5)
    expect(steps.map((li) => li.querySelector('.pp-step-title').textContent)).toEqual(CONTENT[locale].process.steps.map((s) => s.title))
    // No pictures, so no stage and no title buttons, even on a wide screen.
    expect(container.querySelector('#kak-rabotim .pp-stage, #kak-rabotim .pp-step-btn')).toBeNull()
  })
})

describe('the area: from Sofia to Petrich', () => {
  const PLACE = { bg: ['София', 'Петрич'], en: ['Sofia', 'Petrich'], el: ['Σόφια', 'Πέτριτς'] }
  // Towns between the two that a list would name; the owner gave the two ends only.
  const OTHERS = /Благоевград|Сандански|Кюстендил|Перник|Дупница|Симитли|Кресна|Разлог|Банско|Blagoevgrad|Sandanski|Kyustendil|Pernik|Dupnitsa|Μπλαγκόεβγκραντ|Σαντάνσκι/

  it.each(LOCALES)('%s: named in the hero, the area section and the questions, and no other town', (locale) => {
    const c = CONTENT[locale]
    const [from, to] = PLACE[locale]
    for (const text of [c.hero.eyebrow, c.hero.lead, c.area.place, c.area.text, c.faq.items[2].a]) {
      expect(text).toContain(from)
      expect(text).toContain(to)
    }
    expect(strings(c).filter(([, text]) => OTHERS.test(text))).toEqual([])
    const { container } = renderPage(locale)
    const area = container.querySelector('#rayon')
    expect(within(area).getByRole('img', { name: c.area.mapLabel })).toBeTruthy()
    expect(area.textContent).toContain(c.area.place)
  })

  it('the warranty is "по договора", never a number of years', () => {
    for (const locale of LOCALES) {
      const warranty = CONTENT[locale].area.terms.find((t) => t.key === 'warranty')
      expect(warranty.text).not.toMatch(/\d/)
    }
    expect(bgContent.area.terms.find((t) => t.key === 'warranty').text).toBe('По договора')
  })
})

describe('the enquiry form', () => {
  const f = bgContent.form
  const posted = () => fetch.mock.calls.filter(([url]) => String(url).endsWith('/api/offer'))
  const bodyOf = (call) => JSON.parse(call[1].body)
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const field = (label) => new RegExp(`^${escape(label)}( \\*)?( \\(.*\\))?$`)
  const type = (label, value) => fireEvent.change(screen.getByLabelText(field(label)), { target: { value } })
  const form = () => document.getElementById('zapitvane')

  it('posts the ordinary offer with origin "interiors" and a Bulgarian summary', async () => {
    renderPage('bg')
    const scope = within(form())
    fireEvent.click(scope.getByLabelText('Баня'))
    fireEvent.click(scope.getByLabelText('Къртене и демонтаж'))
    fireEvent.click(scope.getByLabelText('Плочки'))
    fireEvent.click(scope.getByLabelText(f.materials.options.ours))
    type(f.town.label, '  Благоевград ')
    type(f.timing.label, 'asap')
    type(f.name.label, ' Иван Петров ')
    type(f.phone.label, '0888 123 456')
    type(f.email.label, 'ivan@example.bg')
    type(f.message.label, ' Банята е 2 на 3 метра. ')
    fireEvent.click(scope.getByRole('button', { name: f.submit }))

    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(bodyOf(posted()[0])).toEqual({
      name: 'Иван Петров',
      email: 'ivan@example.bg',
      phone: '0888 123 456',
      project: [
        'Услуга: Баня',
        'Работи: Къртене и демонтаж, Плочки',
        'Материали: от NVC',
        'Населено място: Благоевград',
        'Кога: Възможно най-скоро',
        '',
        'Банята е 2 на 3 метра.',
      ].join('\n'),
      modelId: '',
      locale: 'bg',
      rep: '',
      website: '',
      origin: 'interiors',
    })
  })

  it('writes the summary in the page\'s language, since the visitor gets a copy of it', async () => {
    renderPage('el')
    const g = elContent.form
    const scope = within(form())
    fireEvent.click(scope.getByLabelText(g.service.options.kitchen))
    fireEvent.click(scope.getByLabelText(elContent.works.items.find((w) => w.key === 'kitchenFitting').title))
    fireEvent.change(scope.getByLabelText(new RegExp(`^${g.town.label}`)), { target: { value: 'Петрич' } })
    fireEvent.change(scope.getByLabelText(new RegExp(`^${g.name.label}`)), { target: { value: 'Νίκος' } })
    fireEvent.change(scope.getByLabelText(new RegExp(`^${g.phone.label}`)), { target: { value: '+30 69 1234 5678' } })
    fireEvent.change(scope.getByLabelText(new RegExp(`^${g.email.label}`)), { target: { value: 'nikos@example.gr' } })
    fireEvent.click(scope.getByRole('button', { name: g.submit }))

    await waitFor(() => expect(posted()).toHaveLength(1))
    const body = bodyOf(posted()[0])
    expect(body.locale).toBe('el')
    expect(body.origin).toBe('interiors')
    const kitchenFitting = elContent.works.items.find((w) => w.key === 'kitchenFitting').title
    expect(body.project).toBe([
      `${g.summary.service}: ${g.service.options.kitchen}`,
      `${g.summary.works}: ${kitchenFitting}`,
      `${g.summary.town}: Петрич`,
    ].join('\n'))
    expect(body.project).not.toMatch(/[а-яА-Я]{3,}:/)
  })

  it('the English summary uses the form\'s own words; the Bulgarian one is the staff lines', () => {
    const e = enContent.form
    const works = Object.fromEntries(enContent.works.items.map((w) => [w.key, w.title]))
    const labels = projectLabels('en', e, works)
    expect(composeProject({ service: 'bathroom', works: ['tiling'], materials: 'ours', timing: 'asap' }, { town: 'Sofia', message: 'Hi' }, labels))
      .toBe(`Renovating: ${e.service.options.bathroom}\nWork needed: ${works.tiling}\nMaterials: ${e.materials.options.ours}\nTown: Sofia\nWhen: ${e.timing.options.asap}\n\nHi`)
    const bgWorks = Object.fromEntries(bgContent.works.items.map((w) => [w.key, w.title]))
    expect(projectLabels('bg', bgContent.form, bgWorks)).toBe(STAFF_LINES)
    for (const c of [enContent, elContent]) {
      for (const key of ['service', 'works', 'materials', 'town', 'timing']) expect(c.form.summary[key]).toBeTruthy()
    }
  })

  it('marks the radios, not the group, when no service is chosen', () => {
    renderPage('bg')
    const scope = within(form())
    fireEvent.click(scope.getByRole('button', { name: f.submit }))
    const radio = scope.getByLabelText('Баня')
    expect(radio.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(radio.getAttribute('aria-describedby')).textContent).toBe(f.service.error)
    expect(radio.closest('fieldset').hasAttribute('aria-invalid')).toBe(false)
  })

  it('sends nothing until the service, the town, name, phone and email are given', async () => {
    renderPage('bg')
    const scope = within(form())
    fireEvent.click(scope.getByRole('button', { name: f.submit }))
    expect(scope.getByRole('alert').textContent).toBe(f.invalid)
    for (const text of [f.service.error, f.town.error, f.name.error, f.phone.error, f.email.error]) {
      expect(scope.getByText(text)).toBeTruthy()
    }
    type(f.email.label, 'not-an-email')
    fireEvent.click(scope.getByRole('button', { name: f.submit }))
    await new Promise((r) => setTimeout(r, 20))
    expect(posted()).toHaveLength(0)
  })

  it('leaves out every line nobody answered', () => {
    expect(composeProject({ service: 'other', works: [], materials: '', timing: '' }, { town: 'Перник', message: '' }))
      .toBe('Услуга: Друго\nНаселено място: Перник')
    expect(composeProject({ service: 'nope', works: ['tiling', 'bogus'], materials: 'yours', timing: 'later' }, { town: ' ' }))
      .toBe('Работи: Плочки\nМатериали: осигурява клиентът\nКога: По-нататък')
  })

  it.each(LOCALES)('%s: the closing card\'s first button takes the visitor to the page\'s own form', (locale) => {
    const onOpenOffer = vi.fn()
    const scrolled = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrolled
    renderPage(locale, { onOpenOffer })
    const card = document.getElementById('final-cta')
    expect(within(card).queryByRole('button', { name: /Заяви оферта/ })).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: CONTENT[locale].hero.primary }))
    expect(onOpenOffer).not.toHaveBeenCalled()
    expect(scrolled).toHaveBeenCalled()
    expect(document.activeElement).toBe(document.getElementById('zapitvane-title'))
    delete window.HTMLElement.prototype.scrollIntoView
  })
})

describe('only the owner\'s own pictures', () => {
  const urlsOf = (container) => {
    const out = []
    container.querySelectorAll('img').forEach((img) => {
      out.push(img.getAttribute('src'))
      for (const part of String(img.getAttribute('srcset') || '').split(',')) {
        const url = part.trim().split(/\s+/)[0]
        if (url) out.push(url)
      }
    })
    container.querySelectorAll('video').forEach((v) => out.push(v.getAttribute('poster')))
    container.querySelectorAll('video source').forEach((s) => out.push(s.getAttribute('src')))
    return out.filter(Boolean).map((url) => url.replace(/\?.*$/, ''))
  }

  it.each(LOCALES)('%s: every picture and clip on the page is listed in interiorsMedia.js', (locale) => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    // jsdom has no media playback.
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const { container } = renderPage(locale)
    // The clips' <video> came up (the observer said they were on screen).
    expect(container.querySelectorAll('video source')).toHaveLength(2)
    const urls = urlsOf(container)
    expect(urls.length).toBeGreaterThan(10)
    expect(urls.filter((url) => !INTERIORS_MEDIA_PATHS.includes(url))).toEqual([])
    // The old kitchen pair, an empty room and a North-American kitchen, never.
    expect(urls.join(' ')).not.toMatch(/rc3|rcz/)
  })

  it('every static file exists, and the hero is the black-marble bathroom', () => {
    for (const url of INTERIORS_MEDIA_PATHS.filter((u) => u.startsWith('/interiors/'))) {
      expect(fs.existsSync(path.join(PUBLIC, url)), url).toBe(true)
    }
    const { container } = renderPage('bg')
    const hero = container.querySelector('.pp-hero-media img')
    expect(hero.getAttribute('src')).toBe(INTERIORS_PHOTOS.bathBlack.large)
    expect(hero.getAttribute('alt')).toBe(bgContent.hero.photoAlt)
  })

  it.each(LOCALES)('%s: every picture has its words, and the share card is the hero\'s photo', (locale) => {
    const { container } = renderPage(locale)
    for (const img of container.querySelectorAll('.ir-pair img, .ir-tile--wide img, .ir-works-photo img, .pp-hero-media img')) {
      expect(img.getAttribute('alt')).toBeTruthy()
    }
    const seo = getRouteSeo(paths.interiors[locale], locale)
    expect(seo.image).toBe(`${SITE}${INTERIORS_PHOTOS.bathBlack.large}`)
    expect(seo.imageAlt).toBe(CONTENT[locale].hero.photoAlt)
    expect(seo.canonical).toBe(`${SITE}${paths.interiors[locale]}`)
    expect(seo.hreflangs.map((h) => h.hrefLang)).toEqual(['bg', 'en', 'el', 'x-default'])
  })
})

describe('questions, links and the closing card', () => {
  it.each(LOCALES)('%s: the FAQ markup is the questions shown', (locale) => {
    const { container } = renderPage(locale)
    const shown = [...container.querySelectorAll('#vaprosi summary')].map((s) => s.textContent)
    expect(shown).toEqual(CONTENT[locale].faq.items.map((item) => item.q))
    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const faq = blocks.find((b) => b['@type'] === 'FAQPage')
    expect(faq.mainEntity.map((q) => q.name)).toEqual(shown)
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(faqItems(CONTENT[locale]).map((q) => q.answer))
  })

  it.each(LOCALES)('%s: links to the doors, About and the containers pages', (locale) => {
    const { container } = renderPage(locale)
    const hrefs = [...container.querySelectorAll('#ir-siblings a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([paths.doors[locale], paths.about[locale], paths.modularBuilds[locale]])
  })

  it.each(LOCALES)('%s: one H1, the hero\'s, carrying the search head term', (locale) => {
    const { container } = renderPage(locale)
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    const head = { bg: 'ремонт на баня', en: 'renovation', el: 'ανακαίνιση' }[locale]
    expect(h1s[0].textContent.toLowerCase()).toContain(head)
    expect(getRouteSeo(paths.interiors[locale], locale).title.toLowerCase()).toContain(head)
  })
})
