import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import BoxHouseConfiguratorPage from './BoxHouseConfiguratorPage.jsx'
import bg from '../content/bg/boxConfigurator.js'
import el from '../content/el/boxConfigurator.js'
import en from '../content/en/boxConfigurator.js'
import { encodeConfig } from '../lib/configShare.js'
import { CONFIG_PREFILL_KEY } from '../lib/configPrefill.js'

// The configurator's own words in Greek (ROADMAP #11).
//
// The page reads every label as `t.labels?.x || (isBg ? bg : en)`, so a key the Greek
// content forgot never fails anything: /el just quietly shows the English branch, and
// the summary copies it into the PDF, the clipboard and the offer the customer sends us.
// The audit found 30 such keys and a dozen strings with no content key at all. These
// tests pin the fix from both ends: the content files hold every key the page asks for,
// and a Greek render of every step (desktop and phone) carries none of that English.
//
// Option NAMES come from the shared catalogue and are not this page's copy, so nothing
// here asserts on them — only on the page's labels, hints, toasts and attributes.

const CONTENT = { bg, en, el }
const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/BoxHouseConfiguratorPage.jsx'), 'utf8')

// A balcony 58 with heating, upgraded windows, sockets, appliances and an on-request
// vanity: between them they switch on nearly every conditional string on the page.
const RICH = {
  model: '58', variant: 'balcony', plan: 'B2', terrace: 'long-58', heating: true,
  windowType: 'ws-65', windowSize: '1200',
  windows: [
    { id: 'w1', x: 10, y: 10, kind: 'standard' },
    { id: 'w2', x: 20, y: 20, kind: 'gz-panorama' },
    { id: 'w3', x: 30, y: 30, kind: 'gz-sliding' },
  ],
  sockets: [{ id: 's1', x: 40, y: 40, description: 'tv' }, { id: 's2', x: 50, y: 50, description: '' }],
  windowNotes: 'wn', socketNotes: 'sn', applianceNotes: 'an',
  interiorPanelMode: 'uv', vanity: 'bv-05', insideDoorCount: 5, insideDoorStyle: 'vr-02',
  appliances: [
    { id: 'app-hob', kind: 'hob', slot: 'k3' },
    { id: 'app-oven', kind: 'oven', slot: 'k3' },
    { id: 'app-fridge', kind: 'fridge', slot: 'k5' },
    { id: 'app-washer', kind: 'washer', slot: 'bath' },
  ],
}
// The other half: no heating, so the vinyl / herringbone toggles show.
const PLAIN = {
  model: '37', variant: 'standard', plan: 'A1', heating: false,
  interiorPanelMode: 'coloured', floorFamily: 'herringbone',
  windows: [{ id: 'w1', x: 10, y: 10, kind: 'gz-panorama' }],
}

// What a Greek visitor met on this page before #11 — the audit's list.
const ENGLISH_LEAKS = [
  'Configuration link copied to clipboard.', 'Link shared.', 'Could not create the share link.',
  'Bathroom UV panels', 'Included with the bathroom fit-out.', 'Wall UV panels', 'Bathroom door',
  'Bathroom furniture', 'Kitchen sink', 'Kitchen cabinet colour', 'Profile colour', 'Glazing type',
  'Terrace', 'Armoured door', 'Opening type', 'Pick a type, then click the plan to place it.',
  'Standard window', 'None', 'price on request', 'Quoted separately', 'per window', 'per door',
  'needs', 'Show all', 'Open full screen', 'Done', 'Reset to layout', 'Copy link', 'Yes', 'No',
  'panoramic', 'Question about the following box house configuration:',
  'Interior panel pricing now scales', 'Vinyl', 'Herringbone',
  'Carbon Crystal becomes the only floor family', 'Carbon Crystal remains the only floor option',
  'Send your configuration and get a personalised quote', 'Show standard specification', 'Step',
  'Configurator steps', 'Remove appliance', "what's it for?", 'Remove socket',
  'deck', 'browser', 'Generated on',
]

let clipboard
let popup

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T09:05:00Z'))
  window.sessionStorage.clear()
  window.localStorage.clear()
  clipboard = { texts: [], fail: false }
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn(async (text) => {
        if (clipboard.fail) throw new Error('denied')
        clipboard.texts.push(text)
      }),
    },
  })
  // The short-link API is unreachable, so sharing falls back to the #cfg= link.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  popup = { html: '', blocked: false }
  vi.spyOn(window, 'open').mockImplementation(() => (popup.blocked ? null : {
    document: { open() {}, write(html) { popup.html += html }, close() {} },
    focus() {},
  }))
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete Element.prototype.scrollIntoView
  delete navigator.clipboard
  window.location.hash = ''
})

function renderPage(locale, { config = RICH, mobile = false } = {}) {
  window.location.hash = `#cfg=${encodeConfig(config)}`
  if (mobile) vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  const { container } = render(
    <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
      <BoxHouseConfiguratorPage content={CONTENT[locale]} />
    </ModalActionsProvider>,
  )
  return container
}

/** Every text node and every assistive attribute currently in the page. */
function strings(root) {
  const out = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const value = walker.currentNode.nodeValue.trim()
    if (value) out.push(value)
  }
  root.querySelectorAll('[aria-label],[placeholder],[title]').forEach((node) => {
    for (const attr of ['aria-label', 'placeholder', 'title']) {
      if (node.hasAttribute(attr)) out.push(node.getAttribute(attr))
    }
  })
  return out
}

/** Visits every step — on a phone every accordion and full-screen editor too. */
function everyStepStrings(container, mobile) {
  const seen = []
  const tabs = () => container.querySelectorAll(mobile ? '.bhc-mstepper-seg' : '.bhc-rail-step')
  container.querySelectorAll('.bhc-mobile-disclosure-btn').forEach((btn) => fireEvent.click(btn))
  for (let step = 0; step < tabs().length; step++) {
    fireEvent.click(tabs()[step])
    seen.push(...strings(container))
    if (mobile) {
      const count = container.querySelectorAll('.bhc-msection-head').length
      for (let i = 0; i < count; i++) {
        const head = container.querySelectorAll('.bhc-msection-head')[i]
        if (head.getAttribute('aria-expanded') !== 'true') fireEvent.click(head)
        seen.push(...strings(container))
        const editor = container.querySelector('.bhc-msection.is-open .bhc-plan-open-btn')
        if (editor) {
          fireEvent.click(editor)
          seen.push(...strings(container))
          fireEvent.click(container.querySelector('.bhc-plan-modal-foot .btn'))
        }
      }
    }
    container.querySelectorAll('.bhc-show-all').forEach((btn) => fireEvent.click(btn))
    seen.push(...strings(container))
  }
  return seen
}

const leaksIn = (texts) => ENGLISH_LEAKS.filter((phrase) => {
  const rx = new RegExp(`(?<![A-Za-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`)
  return texts.some((text) => rx.test(text))
})

/** Runs the summary step's four buttons and reports what each one produced. */
async function summaryOutputs(container, mobile) {
  const tabs = container.querySelectorAll(mobile ? '.bhc-mstepper-seg' : '.bhc-rail-step')
  fireEvent.click(tabs[tabs.length - 1])
  const button = (i) => container.querySelectorAll(mobile ? '.bhc-mobile-action-grid button' : '.bhc-summary-actions button')[i]
  const status = () => container.querySelector(mobile ? '.bhc-mnav-status' : '.bhc-status')?.textContent || ''
  const out = {}
  await act(async () => { fireEvent.click(button(0)) })
  out.pdfOpened = status()
  out.pdf = popup.html
  await act(async () => { fireEvent.click(button(1)) })
  out.copied = status()
  out.clipboard = clipboard.texts[0]
  await act(async () => { fireEvent.click(button(2)) })
  out.linkCopied = status()
  clipboard.fail = true
  await act(async () => { fireEvent.click(button(2)) })
  out.linkFailed = status()
  popup.blocked = true
  await act(async () => { fireEvent.click(button(0)) })
  out.pdfBlocked = status()
  out.prefill = JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY))
  return out
}

describe('configurator copy files', () => {
  const reads = [...pageSource.matchAll(/t\.(labels|actions|hints|pdf)\?\.(\w+)/g)].map(([, section, key]) => ({ section, key }))

  it('Greek supplies every key the page reads, so no English fallback is ever taken on /el', () => {
    expect(reads.length).toBeGreaterThan(100)
    const missing = reads.filter(({ section, key }) => !(key in (el.page[section] || {})))
    expect(missing).toEqual([])
  })

  it('keys read without an inline fallback exist in all three languages', () => {
    const bare = [...pageSource.matchAll(/^\s+\w+: t\.labels\?\.(\w+),\s*$/gm)].map((m) => m[1])
    expect(bare).toContain('questionIntro')
    for (const locale of ['bg', 'en', 'el']) {
      const missing = bare.filter((key) => !CONTENT[locale].page.labels[key])
      expect({ locale, missing }).toEqual({ locale, missing: [] })
    }
  })

  it('no Greek label is a copy of the English one', () => {
    const copies = []
    for (const section of ['labels', 'actions', 'hints', 'pdf']) {
      for (const [key, value] of Object.entries(el.page[section] || {})) {
        if (en.page[section]?.[key] === value) copies.push(`${section}.${key}`)
      }
    }
    expect(copies).toEqual([])
  })

  it('the Greek copy has no Cyrillic, no mixed-script words and no stray English', () => {
    const values = []
    const walk = (value, keyName) => {
      if (typeof value === 'string') { if (keyName !== 'key') values.push(value) }
      else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k))
    }
    walk(el.page)
    // Brands, units, material codes and the email loanword stay in Latin script.
    const allowed = new Set(['Box', 'NVC', 'PDF', 'UV', 'PU', 'EPS', 'Carbon', 'Crystal', 'mm', 'email', 'you', 'example', 'com'])
    const problems = []
    for (const value of values) {
      if (/[Ѐ-ӿ]/.test(value)) problems.push(`Cyrillic: ${value}`)
      const text = value.replace(/\{\w+\}/g, '')
      for (const word of text.split(/[^\p{L}]+/u)) {
        if (/[A-Za-z]/.test(word) && /[Ͱ-Ͽἀ-῿]/.test(word)) problems.push(`mixed: ${word}`)
      }
      for (const [word] of text.matchAll(/[A-Za-z]+/g)) {
        if (!allowed.has(word)) problems.push(`English "${word}": ${value}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('the standard window size reads the same 1100×950 the page prices', () => {
    expect(pageSource).toContain("'1000': '1100×950'")
    expect(el.page.labels.windowSize1000.startsWith('1100×950')).toBe(true)
  })
})

describe.each([false, true])('a Greek visitor (mobile: %s)', (mobile) => {
  it.each([['rich', RICH], ['plain', PLAIN]])('meets no English label on any step (%s configuration)', (_, config) => {
    const container = renderPage('el', { config, mobile })
    expect(leaksIn(everyStepStrings(container, mobile))).toEqual([])
  })

  it('gets Greek toasts, PDF, clipboard text and offer/question prefill', async () => {
    const container = renderPage('el', { mobile })
    const out = await summaryOutputs(container, mobile)

    expect(out.linkCopied).toBe('Ο σύνδεσμος της διαμόρφωσης αντιγράφηκε στο πρόχειρο.')
    expect(out.linkFailed).toBe('Δεν ήταν δυνατή η δημιουργία συνδέσμου κοινοποίησης.')
    expect(out.pdfBlocked).toBe('Το πρόγραμμα περιήγησης απέκλεισε το παράθυρο PDF. Παρακαλούμε επιτρέψτε τα αναδυόμενα παράθυρα για αυτόν τον ιστότοπο.')

    expect(out.clipboard).toMatch(/^Κάτω μόνωση \+ ζωνική θέρμανση: Ναι \(.+\)$/m)
    expect(out.clipboard).toMatch(/^Ανοίγματα παραθύρων: 3 \(πανοραμικά: 2\)/m)
    expect(out.clipboard).toContain('Χρώμα προφίλ: ')
    expect(out.clipboard).toContain('Χρώμα δαπέδου βεράντας: ')
    expect(out.prefill.questionText.startsWith('Ερώτηση σχετικά με την παρακάτω διαμόρφωση Box σπιτιού:\n\n')).toBe(true)
    expect(out.prefill.offerText.startsWith(out.clipboard)).toBe(true)

    expect(out.pdf).toContain('<html lang="el">')
    for (const label of ['Τύπος κουφωμάτων', 'Βεράντα', 'UV πάνελ μπάνιου', 'Πόρτα μπάνιου', 'Έπιπλο μπάνιου',
      'Νεροχύτης κουζίνας', 'Με χωριστή προσφορά', 'τιμή κατόπιν αιτήματος', 'Στάνταρ παράθυρο']) {
      expect(out.pdf).toContain(label)
    }
    expect(leaksIn([out.pdf.slice(out.pdf.indexOf('<body>'), out.pdf.indexOf('<script>')), out.clipboard, out.prefill.questionText])).toEqual([])
  })
})

describe('the PDF footer date follows the page language', () => {
  it.each([['bg', 'bg-BG', 'Генерирано на'], ['en', 'en-GB', 'Generated on'], ['el', 'el-GR', 'Δημιουργήθηκε στις']])('%s → %s', async (locale, tag, label) => {
    const container = renderPage(locale)
    const out = await summaryOutputs(container, false)
    expect(out.pdf).toContain(`${label}: ${new Date().toLocaleString(tag)}`)
  })
})

// The strings that moved out of the page into content keep their exact bg/en wording.
describe.each([
  ['bg', {
    step: 'Стъпка 1 / 6', aria: 'Configurator steps', yes: /^Да \(.+\)$/, windows: '3 (2 panoramic)',
    placeholder: 'Контакт 1 — за какво ще се ползва?', removeSocket: 'Премахни контакт', removeAppliance: 'Премахни уред',
    disclosure: 'Покажи стандартното изпълнение', heatingNote: 'При избрано отопление Carbon Crystal остава единствената подова опция.',
    question: 'Въпрос за следната конфигурация на Бокс къща:\n\n',
    offerHint: 'Изпратете конфигурацията и получете персонализирана оферта за вашата Бокс къща.',
  }],
  ['en', {
    step: 'Step 1 / 6', aria: 'Configurator steps', yes: /^Yes \(.+\)$/, windows: '3 (2 panoramic)',
    placeholder: "Socket 1 — what's it for?", removeSocket: 'Remove socket', removeAppliance: 'Remove appliance',
    disclosure: 'Show standard specification', heatingNote: 'With heating selected, Carbon Crystal remains the only floor option.',
    question: 'Question about the following box house configuration:\n\n',
    offerHint: 'Send your configuration and get a personalised quote for your Box house.',
  }],
  ['el', {
    step: 'Βήμα 1 / 6', aria: 'Βήματα διαμορφωτή', yes: /^Ναι \(.+\)$/, windows: '3 (πανοραμικά: 2)',
    placeholder: 'Πρίζα 1 — για τι θα χρησιμοποιηθεί;', removeSocket: 'Αφαίρεση πρίζας', removeAppliance: 'Αφαίρεση συσκευής',
    disclosure: 'Εμφάνιση στάνταρ προδιαγραφών', heatingNote: 'Με επιλεγμένη θέρμανση, το Carbon Crystal παραμένει η μόνη επιλογή δαπέδου.',
    question: 'Ερώτηση σχετικά με την παρακάτω διαμόρφωση Box σπιτιού:\n\n',
    offerHint: 'Στείλτε τη διαμόρφωσή σας και λάβετε εξατομικευμένη προσφορά για το Box σπίτι σας.',
  }],
])('%s wording of the strings that moved into content', (locale, want) => {
  const summaryValues = (container) => [...container.querySelectorAll('.bhc-summary-row')]
    .map((row) => row.lastChild.textContent)

  it('desktop: rail, summary rows, sockets, appliances and offer hint', () => {
    const container = renderPage(locale)
    const rail = container.querySelector('.bhc-rail')
    expect(rail.getAttribute('aria-label')).toBe(want.aria)
    const tabs = container.querySelectorAll('.bhc-rail-step')

    fireEvent.click(tabs[3])
    expect(container.querySelector('[aria-label="' + want.removeAppliance + '"]')).not.toBeNull()

    fireEvent.click(tabs[4])
    expect(container.querySelector('.bhc-socket-desc-input').getAttribute('placeholder')).toBe(want.placeholder)
    expect(container.querySelector('.bhc-socket-row .bhc-window-remove-btn').getAttribute('aria-label')).toBe(want.removeSocket)

    fireEvent.click(tabs[5])
    const values = summaryValues(container)
    expect(values.filter((value) => want.yes.test(value))).toHaveLength(1)
    expect(values).toContain(want.windows)
    expect(container.querySelector('.bhc-offer-hint').textContent).toBe(want.offerHint)
    expect(JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY)).questionText.startsWith(want.question)).toBe(true)
  })

  it('phone: step counter, stepper label, standard-spec disclosure and heating note', () => {
    const container = renderPage(locale, { mobile: true })
    expect(container.querySelector('.bhc-mstepper-count').textContent).toBe(want.step)
    expect(container.querySelector('.bhc-mstepper-track').getAttribute('aria-label')).toBe(want.aria)
    expect(container.querySelector('.bhc-mobile-disclosure-summary').textContent).toBe(want.disclosure)

    fireEvent.click(container.querySelectorAll('.bhc-mstepper-seg')[3])
    expect(container.querySelector('.bhc-mstepper-count').textContent).toBe(want.step.replace('1 /', '4 /'))
    fireEvent.click([...container.querySelectorAll('.bhc-msection-head')].find((head) => head.closest('[data-section-id="floor"]')))
    expect(container.querySelector('[data-section-id="floor"] .bhc-small-note').textContent).toBe(want.heatingNote)
  })
})
