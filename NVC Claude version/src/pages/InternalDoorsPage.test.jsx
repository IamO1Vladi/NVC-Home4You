import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import InternalDoorsPage, { FEATURE_ORDER, faqItems } from './InternalDoorsPage.jsx'
import bgContent from '../content/bg/internalDoors.js'
import enContent from '../content/en/internalDoors.js'
import elContent from '../content/el/internalDoors.js'
import BgInternalDoorsRoute from '../routes/bg/BgInternalDoorsRoute.jsx'
import EnInternalDoorsRoute from '../routes/en/EnInternalDoorsRoute.jsx'
import ElInternalDoorsRoute from '../routes/el/ElInternalDoorsRoute.jsx'
import { paths } from '../routes/paths.js'
import { getRouteSeo } from '../seo/routeMeta.js'
import {
  DOORS_COVER,
  DOOR_FEATURES,
  DOOR_FINISHES,
  DOOR_HANDLES,
  DOOR_TRIMS,
  DOOR_TYPES,
  SLIDING_DOORS,
} from '../content/shared/doorsCatalogue.js'
import {
  BUILDER_TYPES,
  FRAME_WIDTHS_MM,
  STANDARD_FINISHES,
  TYPE_ORDER,
  doorMessage,
  initialSelection,
  modelLabel,
  quantityOf,
} from '../components/doors/doorOptions.js'
import { _resetSubmissions } from '../lib/backgroundSubmit.js'
import { HOME_PHOTOS_SEED_ID, fetchHomePhotos, forgetHomePhotos } from '../lib/homePhotos.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { clearRep, saveRep } from '../lib/repAttribution.js'

// The internal doors page as rebuilt on 2026-10-15: the catalogue of a SEPARATE product, read
// from the owner's catalogue (content/shared/doorsCatalogue.js), with the old page's confirmed
// facts kept where the two differ (frames 70–180 mm, three standard colours per type). What
// these pin, in every language:
// - every option the builder offers comes from the catalogue data (types, models, the 25 WPC
//   colours, the handles, the trims), except the owner's frame widths, which are exactly his;
// - a standard colour shows its own catalogue photo; any other colour is shown as its sample
//   beside an unchanged photo (never a recolour), and the preview is never hidden;
// - no price anywhere, no lock option, no old stock render or hardware path, and those files gone;
// - the builder's message, the form's /api/offer body with origin 'doors', the rep, the honeypot;
// - the FAQ markup is the printed FAQ; the head comes from routeMeta.js.

const CONTENT = { bg: bgContent, en: enContent, el: elContent }
const ROUTES = { bg: BgInternalDoorsRoute, en: EnInternalDoorsRoute, el: ElInternalDoorsRoute }
const LOCALES = ['bg', 'en', 'el']
const SITE = 'https://nvc-home4you.eu'
const PUBLIC = path.resolve(__dirname, '../../public')
const OLD_ASSETS = /internal-doors\/(?!catalogue\/)|clear\.webp|kit\.webp|\/hardware\/(frame|handle|trim|lock)-/
const PRICE = /€|\bEUR\b|\bBGN\b|лв\.?(\s|$)|евро|\beuro\b|ευρώ|\d+\s?(лв|€)/i

const posted = () => fetch.mock.calls.filter(([url]) => String(url).endsWith('/api/offer'))
const bodyOf = (call) => JSON.parse(call[1].body)

beforeEach(() => {
  _resetSubmissions()
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  // The photo body is kept for the visit; each test starts as a first visit (no admin
  // photo carried over from the test before).
  forgetHomePhotos()
})

function renderPage(locale = 'bg') {
  return render(
    <MemoryRouter initialEntries={[paths.doors[locale]]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        <InternalDoorsPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

const builderOf = (container) => container.querySelector('#izbor')
const radiosNamed = (root, suffix) => [...root.querySelectorAll('input[type="radio"]')].filter((r) => r.name.endsWith(`-${suffix}`))
const stageImg = (container) => container.querySelector('.idp-stage > img')

describe('the builder offers only what the catalogue (or the owner) lists', () => {
  it('the four door types, all of them the catalogue\'s, in the old page\'s order', () => {
    const { container } = renderPage('bg')
    const types = radiosNamed(builderOf(container), 'type').map((r) => r.value)
    expect(types).toEqual(TYPE_ORDER)
    expect([...types].sort()).toEqual(DOOR_TYPES.map((t) => t.key).sort())
  })

  it('the 25 WPC colours, the 15 handles and the 14 trims, codes as the catalogue prints them', () => {
    const { container } = renderPage('bg')
    const b = builderOf(container)
    const finishes = radiosNamed(b, 'finish').map((r) => r.value)
    expect(finishes.filter((v) => v.startsWith('wpc:')).map((v) => v.slice(4))).toEqual(DOOR_FINISHES.map((f) => f.code))
    expect(radiosNamed(b, 'handle').map((r) => r.value)).toEqual(['', ...DOOR_HANDLES.map((h) => h.code)])
    expect(radiosNamed(b, 'trim').map((r) => r.value)).toEqual(['', ...DOOR_TRIMS.map((t) => t.code)])
  })

  it('the frames are the owner\'s 70–180 mm, not the catalogue\'s BT codes', () => {
    expect(FRAME_WIDTHS_MM).toEqual([70, 90, 100, 120, 140, 160, 180])
    const { container } = renderPage('bg')
    expect(radiosNamed(builderOf(container), 'frame').map((r) => r.value)).toEqual(['', ...FRAME_WIDTHS_MM.map(String)])
    expect(builderOf(container).textContent).not.toMatch(/BT(100|140|180|220|250|270|300)\b/)
  })

  it('three standard colours per type, each tied to a real catalogue photo of that type', () => {
    for (const type of BUILDER_TYPES) {
      const std = STANDARD_FINISHES[type.key]
      expect(std).toHaveLength(3)
      for (const f of std) {
        expect(type.photos[f.photo]).toBeTruthy()
        for (const locale of LOCALES) expect(CONTENT[locale].colors[f.key]).toBeTruthy()
      }
    }
  })

  it('the models of a type with more photos than colours are its catalogue photos', () => {
    const { container } = renderPage('bg')
    const b = builderOf(container)
    fireEvent.click(radiosNamed(b, 'type').find((r) => r.value === 'metal-lines'))
    const metal = DOOR_TYPES.find((t) => t.key === 'metal-lines')
    const models = radiosNamed(b, 'model')
    expect(models).toHaveLength(metal.photos.length)
    expect(models.map((r) => r.closest('label').querySelector('img').getAttribute('src'))).toEqual(metal.photos.map((p) => p.src))
  })

  it('every image on the page is the catalogue\'s and exists on disk', () => {
    const { container } = renderPage('bg')
    const srcs = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(srcs.length).toBeGreaterThan(50)
    for (const src of srcs) {
      expect(src).toMatch(/^\/internal-doors\/catalogue\//)
      expect(fs.existsSync(path.join(PUBLIC, src))).toBe(true)
    }
  })
})

describe('the preview', () => {
  it('shows the photo of a standard colour, always visible, with the photo\'s colour in its caption', () => {
    const { container } = renderPage('bg')
    const b = builderOf(container)
    const decor = DOOR_TYPES.find((t) => t.key === 'decor-lines')
    expect(stageImg(container).getAttribute('src')).toBe(decor.photos[0].src)
    fireEvent.click(radiosNamed(b, 'finish').find((r) => r.value === 'std:sage'))
    const img = stageImg(container)
    expect(img.getAttribute('src')).toBe(decor.photos[2].src)
    // The old visualiser's bug: an opacity tied to onLoad left the photo invisible.
    expect(img.getAttribute('style')).toBeNull()
    expect(img.className).toBe('')
    expect(container.querySelector('.idp-stage-cap').textContent).toContain(decor.photos[2].colour.bg)
    // The live region is always there (so a change is announced); with nothing to explain it is empty.
    expect(container.querySelector('.idp-stage-note').textContent).toBe('')
  })

  it.each(LOCALES)('%s: a standard colour\'s photo carries the chip\'s name in the caption, the alt text and the type card', (locale) => {
    const c = CONTENT[locale]
    const { container } = renderPage(locale)
    const b = builderOf(container)
    for (const type of BUILDER_TYPES) {
      fireEvent.click(radiosNamed(b, 'type').find((r) => r.value === type.key))
      for (const f of STANDARD_FINISHES[type.key]) {
        fireEvent.click(radiosNamed(b, 'finish').find((r) => r.value === `std:${f.key}`))
        const name = c.colors[f.key]
        expect(container.querySelector('.idp-stage-cap').textContent).toBe(c.builder.photoCaption.replace('{colour}', name))
        expect(stageImg(container).getAttribute('alt')).toBe(`${c.range.types[type.key].name}, ${name}`)
        expect(container.querySelector('.idp-stage-note').textContent).toBe('')
        // The catalogue data names the photo the same way.
        expect(type.photos[f.photo].colour[locale]).toBe(name)
      }
    }
    // Glass "Черно" was "Тъмносиво" under the same photo, "Опушен" was "Сиво-кафяво".
    const glass = container.querySelector('#idp-type-glass').closest('.idp-type')
    const models = [...glass.querySelectorAll('.idp-models img')].map((img) => img.getAttribute('alt'))
    expect(models).toContain(`${c.range.types.glass.name}, ${c.colors.black}`)
  })

  it('a WPC colour is a sample beside the unchanged photo, and the note says which colour the photo is', () => {
    const { container } = renderPage('en')
    const b = builderOf(container)
    const before = stageImg(container).getAttribute('src')
    fireEvent.click(radiosNamed(b, 'finish').find((r) => r.value === 'wpc:BJX-17'))
    expect(stageImg(container).getAttribute('src')).toBe(before)
    const sample = container.querySelector('.idp-stage-sample img')
    expect(sample.getAttribute('src')).toBe(DOOR_FINISHES.find((f) => f.code === 'BJX-17').src)
    expect(container.querySelector('.idp-stage-note').textContent).toContain('BJX-17')
    // The wider range stays open while one of its colours is chosen.
    expect(container.querySelector('.idp-steps details.idp-more').open).toBe(true)
  })

  it('choosing a model that is a standard colour\'s photo chooses that colour too', () => {
    const { container } = renderPage('bg')
    const b = builderOf(container)
    fireEvent.click(radiosNamed(b, 'type').find((r) => r.value === 'metal-lines'))
    fireEvent.click(radiosNamed(b, 'model')[4])
    expect(radiosNamed(b, 'finish').find((r) => r.checked).value).toBe('std:oak')
    fireEvent.click(radiosNamed(b, 'model')[0])
    // No standard colour is that photo: the colour stays and the note explains the photo.
    expect(radiosNamed(b, 'finish').find((r) => r.checked).value).toBe('std:oak')
    expect(container.querySelector('.idp-stage-note')).not.toBeNull()
  })
})

describe('no price, no lock, no stock render', () => {
  it.each(LOCALES)('%s: the content and the page name no price', (locale) => {
    expect(JSON.stringify(CONTENT[locale])).not.toMatch(PRICE)
    const { container } = renderPage(locale)
    expect(container.textContent).not.toMatch(PRICE)
  })

  it('offers no lock (the old "Брава" pictures were hinges), though the set includes one', () => {
    const { container } = renderPage('bg')
    expect(radiosNamed(container, 'lock')).toHaveLength(0)
    expect(builderOf(container).textContent).not.toMatch(/Брава/)
    expect(bgContent.features.set.parts).toContain('Брава')
  })

  it('references none of the old renders or hardware images, and they are gone from public/', () => {
    const sources = [
      'pages/InternalDoorsPage.jsx',
      'components/doors/DoorBuilder.jsx',
      'components/doors/DoorsEnquiry.jsx',
      'components/doors/doorOptions.js',
      'style/InternalDoors.css',
      'content/bg/internalDoors.js',
      'content/en/internalDoors.js',
      'content/el/internalDoors.js',
    ].map((f) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8'))
    for (const text of sources) expect(text).not.toMatch(/internal-doors\/(clear|kit|decor-lines-|wallpaper-|metal-lines-|glass-|hardware)/)
    const { container } = renderPage('bg')
    for (const img of container.querySelectorAll('img')) expect(img.getAttribute('src')).not.toMatch(OLD_ASSETS)
    expect(fs.readdirSync(path.join(PUBLIC, 'internal-doors'))).toEqual(['catalogue'])
  })
})

describe('the builder writes the enquiry', () => {
  it('asks for the number of doors first', () => {
    const { container } = renderPage('bg')
    fireEvent.submit(builderOf(container).querySelector('form'))
    expect(screen.getByRole('alert').textContent).toBe(bgContent.builder.qtyError)
    expect(container.querySelector('#zapitvane textarea').value).toBe('')
  })

  it('puts the whole choice into the form\'s message', () => {
    const { container } = renderPage('bg')
    const b = builderOf(container)
    fireEvent.click(radiosNamed(b, 'type').find((r) => r.value === 'glass'))
    fireEvent.click(radiosNamed(b, 'finish').find((r) => r.value === 'wpc:BJX-21'))
    fireEvent.click(radiosNamed(b, 'frame').find((r) => r.value === '120'))
    fireEvent.click(radiosNamed(b, 'handle').find((r) => r.value === 'BSL-7'))
    fireEvent.click(radiosNamed(b, 'trim').find((r) => r.value === 'BT6040'))
    fireEvent.change(within(b).getByLabelText(/Брой врати/), { target: { value: '12' } })
    fireEvent.change(within(b).getByLabelText(/Населено място/), { target: { value: 'Петрич' } })
    fireEvent.click(within(b).getByLabelText(bgContent.builder.fittingYes))
    fireEvent.submit(b.querySelector('form'))

    const message = container.querySelector('#zapitvane textarea').value
    expect(message).toContain('Тип: Врати със стъкло')
    expect(message).toContain('Цвят: BJX-21 (гама WPC, по заявка)')
    expect(message).toContain('Каса: 120 мм')
    expect(message).toContain('Дръжка: BSL-7')
    expect(message).toContain('Перваз: BT6040 (60 × 40 мм)')
    expect(message.split('\n')[0]).toBe('Тип: Врати със стъкло')
    expect(message).toContain('Брой: 12')
    expect(message).toContain('Монтаж: Да, с монтаж')
    expect(message).toContain('Населено място: Петрич')
    expect(message).toContain('Модел от каталога: Модел 2 · Топло бяло, стъкло по цялата височина (стр. 8 от каталога)')
    expect(container.querySelector('.idp-filled')).not.toBeNull()
  })

  it.each(LOCALES)('%s: every catalogue model has a label of its own, with its colour and its catalogue page', (locale) => {
    const c = CONTENT[locale]
    for (const type of BUILDER_TYPES) {
      const labels = type.photos.map((_, i) => modelLabel(type, i, locale, c))
      expect(new Set(labels).size).toBe(labels.length)
      labels.forEach((label, i) => expect(label).toContain(c.builder.pageRef.replace('{p}', type.photos[i].page)))
    }
  })

  it('writes the trims\' sizes with the language\'s decimal mark', () => {
    const decimal = DOOR_TRIMS.find((t) => !Number.isInteger(t.heightMm) || !Number.isInteger(t.widthMm))
    expect(decimal).toBeTruthy()
    const sel = { ...initialSelection(), qty: '1', trim: decimal.code }
    const [w, h] = [decimal.widthMm, decimal.heightMm].map((n) => String(n))
    const comma = (x) => x.replace('.', ',')
    expect(doorMessage(sel, 'bg', bgContent)).toContain(`(${comma(w)} × ${comma(h)} мм)`)
    expect(doorMessage(sel, 'el', elContent)).toContain(`(${comma(w)} × ${comma(h)} mm)`)
    expect(doorMessage(sel, 'en', enContent)).toContain(`(${w} × ${h} mm)`)
    const { container } = renderPage('bg')
    const tile = radiosNamed(builderOf(container), 'trim').find((r) => r.value === decimal.code).closest('label')
    expect(tile.querySelector('.idp-opt-meta').textContent).toBe(`${comma(w)} × ${comma(h)} мм`)
  })

  it('says "your choice is in the message" only about the builder\'s text, and not after it is sent', async () => {
    const { container } = renderPage('bg')
    const b = builderOf(container)
    fireEvent.change(within(b).getByLabelText(/Брой врати/), { target: { value: '2' } })
    fireEvent.submit(b.querySelector('form'))
    expect(container.querySelector('.idp-filled')).not.toBeNull()
    const form = container.querySelector('#zapitvane form')
    fireEvent.change(form.querySelector('input[name="name"]'), { target: { value: 'Иван' } })
    fireEvent.change(form.querySelector('input[name="email"]'), { target: { value: 'ivan@example.bg' } })
    fireEvent.submit(form)
    await waitFor(() => expect(posted()).toHaveLength(1))
    fireEvent.change(form.querySelector('textarea'), { target: { value: 'Още 3 врати' } })
    expect(container.querySelector('.idp-filled')).toBeNull()
    // A sliding-door style starts the message, but it is not the builder's choice.
    fireEvent.click(container.querySelectorAll('.idp-style')[0])
    expect(container.querySelector('#zapitvane textarea').value).toContain(bgContent.message.sliding)
    expect(container.querySelector('.idp-filled')).toBeNull()
  })

  it('doorMessage names the lines of a decorative-lines door and "no preference" where nothing was picked', () => {
    const sel = { ...initialSelection(), qty: '3', variant: 'wide' }
    const text = doorMessage(sel, 'en', enContent)
    // No heading of its own: the server writes "Запитване за врати" above it.
    expect(text.split('\n')).toEqual([
      'Type: Doors with decorative lines',
      'Lines: Wide decorative lines',
      'Colour: White (standard)',
      'Frame: no preference',
      'Handle: no preference',
      'Trim: no preference',
      'Quantity: 3',
    ])
  })

  it('a quantity is a whole number of at least one', () => {
    expect(quantityOf('12')).toBe(12)
    expect(quantityOf(' 1 ')).toBe(1)
    for (const bad of ['', '0', '-2', '1.5', 'abc', '123456']) expect(quantityOf(bad)).toBeNull()
  })

  it('a sliding-door style fills the message with that style', () => {
    const { container } = renderPage('en')
    fireEvent.click(container.querySelectorAll('.idp-style')[2])
    const message = container.querySelector('#zapitvane textarea').value
    expect(message).toBe(`${enContent.message.sliding}\nCatalogue style: 3 · ${SLIDING_DOORS.styles[2].look.en} (catalogue p. 20)`)
  })
})

describe('the doors enquiry form', () => {
  function send(locale, { name = 'Νίκος', email = 'nikos@example.com', phone = '' } = {}) {
    const view = renderPage(locale)
    const form = view.container.querySelector('#zapitvane form')
    fireEvent.change(form.querySelector('input[name="name"]'), { target: { value: name } })
    fireEvent.change(form.querySelector('input[name="email"]'), { target: { value: email } })
    fireEvent.change(form.querySelector('input[name="phone"]'), { target: { value: phone } })
    fireEvent.change(form.querySelector('textarea'), { target: { value: 'Δέκα πόρτες' } })
    fireEvent.submit(form)
    return view
  }

  it.each(LOCALES)('%s: posts the ordinary offer with origin "doors" and the visitor\'s language', async (locale) => {
    send(locale, { phone: '+30 690 000 0000' })
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(bodyOf(posted()[0])).toEqual({
      name: 'Νίκος',
      email: 'nikos@example.com',
      phone: '+30 690 000 0000',
      project: 'Δέκα πόρτες',
      modelId: '',
      locale,
      rep: '',
      website: '',
      origin: 'doors',
    })
  })

  it('carries the representative the visitor arrived through', async () => {
    saveRep('dtodorov')
    try {
      send('bg')
      await waitFor(() => expect(posted()).toHaveLength(1))
      expect(bodyOf(posted()[0])).toMatchObject({ rep: 'dtodorov', origin: 'doors' })
    } finally {
      clearRep()
    }
  })

  it('sends nothing without a name or a valid email, and says which', () => {
    const { container } = send('bg', { name: ' ', email: 'not-an-email' })
    expect(posted()).toHaveLength(0)
    expect(container.querySelector('#zapitvane').textContent).toContain(bgContent.form.nameError)
    expect(container.querySelector('#zapitvane').textContent).toContain(bgContent.form.emailError)
  })

  it('renders the honeypot out of reach and sends what a bot puts in it', async () => {
    const { container } = renderPage('bg')
    const form = container.querySelector('#zapitvane form')
    const trap = form.querySelector('input[name="website"]')
    expect(trap.tabIndex).toBe(-1)
    expect(trap.closest('[aria-hidden="true"]').style.display).not.toBe('none')
    fireEvent.change(trap, { target: { value: 'http://spam.example' } })
    fireEvent.change(form.querySelector('input[name="name"]'), { target: { value: 'Bot' } })
    fireEvent.change(form.querySelector('input[name="email"]'), { target: { value: 'bot@example.com' } })
    fireEvent.submit(form)
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(bodyOf(posted()[0])).toMatchObject({ website: 'http://spam.example' })
  })

  it('clears the form once the enquiry is handed over', async () => {
    const { container } = send('bg')
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(container.querySelector('#zapitvane textarea').value).toBe('')
    expect(container.querySelector('#zapitvane input[name="name"]').value).toBe('')
  })
})

describe('the page', () => {
  it.each(LOCALES)('%s: one H1, the catalogue cover, every feature, the four types and the sections in order', (locale) => {
    const c = CONTENT[locale]
    const { container } = renderPage(locale)
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe(c.hero.title)
    expect(container.querySelector('.pp-hero-media img').getAttribute('src')).toBe(DOORS_COVER.src)
    expect([...container.querySelectorAll('.idp-feature')].map((li) => li.dataset.feature)).toEqual(FEATURE_ORDER)
    for (const f of DOOR_FEATURES) expect(FEATURE_ORDER).toContain(f.key)
    expect(container.querySelectorAll('.idp-type')).toHaveLength(4)
    const ids = [...container.querySelectorAll('main section[id]')].map((s) => s.id)
    expect(ids).toEqual(['idp-features', 'idp-range', 'izbor', 'idp-sliding', 'idp-panels', 'idp-order', 'zapitvane', 'idp-faq', 'idp-siblings', 'final-cta'])
    // No heading level skipped.
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]))
    levels.forEach((level, i) => { if (i) expect(level - levels[i - 1]).toBeLessThanOrEqual(1) })
  })

  it.each(LOCALES)('%s: the FAQ markup is exactly the printed questions', (locale) => {
    const { container } = renderPage(locale)
    const data = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const faq = data.find((d) => d['@type'] === 'FAQPage')
    const printed = [...container.querySelectorAll('#idp-faq summary')].map((s) => s.textContent)
    expect(faq.mainEntity.map((q) => q.name)).toEqual(printed)
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(faqItems(CONTENT[locale]).map((q) => q.answer))
  })

  it.each(LOCALES)('%s: the closing card speaks of doors, not the home page\'s 24-hour line', (locale) => {
    const { container } = renderPage(locale)
    const card = container.querySelector('#final-cta')
    expect(card.querySelector('h2').textContent).toBe(CONTENT[locale].finalTitle)
    expect(card.querySelector('.hp-sub').textContent).toBe(CONTENT[locale].finalDesc)
    expect(card.textContent).not.toMatch(/24/)
  })

  it.each(LOCALES)('%s: links to interiors, containers and partners', (locale) => {
    const { container } = renderPage(locale)
    const hrefs = [...container.querySelectorAll('#idp-siblings a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([paths.interiors[locale], paths.modularBuilds[locale], paths.partner[locale]])
  })

  it('the three languages carry the same keys', () => {
    const shape = (value) => (Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
        : typeof value)
    expect(shape(enContent)).toEqual(shape(bgContent))
    expect(shape(elContent)).toEqual(shape(bgContent))
  })
})

// The hero's photo is the doors-hero slot the owner can fill in "Снимки на сайта" (since
// 2026-10-16), for a photo of doors his team has fitted. Empty, the hero is the catalogue's cover
// with its chip, as before; filled, the owner's photo through the resizer, without the chip
// (it is not the catalogue's), with his description on the Bulgarian page and the content's
// general words otherwise, falling back to the cover if it fails to load.
describe('the hero\'s photo from the panel', () => {
  const ADMIN = { url: '/api/img/home/25/fitted.webp', alt: 'Врати, монтирани в къща в Петрич' }
  const withSlots = (slots) => ({ hero: [], models: {}, pages: {}, slots })
  const answer = (body) => vi.fn((url) => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(String(url).includes('/api/home/photos') ? body : {}),
  }))
  const heroImg = (container) => container.querySelector('.pp-hero-media img')
  const chip = (container) => container.querySelector('.pp-hero-chip')
  const photosCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes('/api/home/photos'))

  function expectCover(container, locale) {
    const hero = heroImg(container)
    expect(hero.getAttribute('src')).toBe(DOORS_COVER.src)
    // A /public file: no resizer, so no srcset, as before.
    expect(hero.hasAttribute('srcset')).toBe(false)
    expect(hero.getAttribute('alt')).toBe(DOORS_COVER.alt[locale])
    expect(hero.style.objectPosition).toBe('30% 50%')
    expect(chip(container).textContent).toBe(CONTENT[locale].hero.chip)
  }

  it.each(LOCALES)('%s: empty, the catalogue\'s cover and its chip, whatever the API answers', async (locale) => {
    for (const body of [{}, withSlots({}), { hero: [], models: {}, pages: {} }]) {
      vi.stubGlobal('fetch', answer(body))
      const { container, unmount } = renderPage(locale)
      expectCover(container, locale)
      await waitFor(() => expect(photosCalls()).toHaveLength(1))
      await act(async () => {})
      expectCover(container, locale)
      unmount()
      forgetHomePhotos()
    }
  })

  it.each(LOCALES)('%s: filled, the owner\'s photo through the resizer, and no "from our catalogue" chip', async (locale) => {
    vi.stubGlobal('fetch', answer(withSlots({ 'doors-hero': ADMIN })))
    const { container } = renderPage(locale)
    await waitFor(() => expect(heroImg(container).getAttribute('src')).toContain(ADMIN.url))
    const hero = heroImg(container)
    expect(hero.getAttribute('src')).toBe(cdnImage(ADMIN.url, { width: 800 }))
    expect(hero.getAttribute('srcset')).toBe(cdnSrcSet(ADMIN.url, [480, 640, 800, 1200, 1600]))
    expect(hero.getAttribute('alt')).toBe(locale === 'bg' ? ADMIN.alt : CONTENT[locale].hero.adminAlt)
    // The cover's crop hint does not apply to the owner's photo — not even as an empty style="".
    expect(hero.style.objectPosition).toBe('')
    expect(hero.hasAttribute('style')).toBe(false)
    expect(chip(container)).toBeNull()
    expect(container.querySelector('main').textContent).not.toContain(CONTENT[locale].hero.chip)
  })

  it('a blank description gives the general words; a failed photo falls back to the cover', async () => {
    vi.stubGlobal('fetch', answer(withSlots({ 'doors-hero': { ...ADMIN, alt: '' } })))
    const { container } = renderPage('bg')
    await waitFor(() => expect(heroImg(container).getAttribute('src')).toContain(ADMIN.url))
    const hero = heroImg(container)
    expect(hero.getAttribute('alt')).toBe(bgContent.hero.adminAlt)
    // One retry of the owner's photo, then the cover.
    fireEvent.error(hero)
    fireEvent.error(hero)
    expect(hero.getAttribute('src')).toBe(DOORS_COVER.src)
    expect(hero.hasAttribute('srcset')).toBe(false)
    expect(hero.dataset.imgFallback).toBe(DOORS_COVER.src)
  })

  it('opens on the owner\'s photo from the first render once an answer is kept', async () => {
    // What the snapshot's <head> copy gives a fresh load; an earlier answer stands in for it.
    vi.stubGlobal('fetch', answer(withSlots({ 'doors-hero': ADMIN })))
    await fetchHomePhotos()
    expect(document.getElementById(HOME_PHOTOS_SEED_ID)).not.toBeNull()

    const { container } = renderPage('bg')
    expect(heroImg(container).getAttribute('src')).toBe(cdnImage(ADMIN.url, { width: 800 }))
    expect(chip(container)).toBeNull()
  })

  it.each(LOCALES)('%s: the general words are there and are not the cover\'s', (locale) => {
    expect(CONTENT[locale].hero.adminAlt).toBeTruthy()
    expect(CONTENT[locale].hero.adminAlt).not.toBe(DOORS_COVER.alt[locale])
  })
})

describe('the routes', () => {
  it.each(LOCALES)('%s: the head from routeMeta.js with the catalogue cover', (locale) => {
    const seo = getRouteSeo(paths.doors[locale], locale)
    expect(seo.title.length).toBeLessThanOrEqual(70)
    expect(seo.description.length).toBeLessThanOrEqual(160)
    expect(`${seo.title} ${seo.description}`).not.toMatch(PRICE)
    expect(seo.canonical).toBe(`${SITE}${paths.doors[locale]}`)
    expect(seo.hreflangs.map((h) => h.hrefLang)).toEqual(['bg', 'en', 'el', 'x-default'])
    expect(seo.image).toBe(`${SITE}${DOORS_COVER.src}`)
    expect(seo.imageAlt).toBe(DOORS_COVER.alt[locale])
  })

  it.each(LOCALES)('%s: breadcrumbs from the content', async (locale) => {
    const Route = ROUTES[locale]
    const { container } = render(
      <HelmetProvider context={{}}>
        <MemoryRouter initialEntries={[paths.doors[locale]]}>
          <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
            <Route />
          </ModalActionsProvider>
        </MemoryRouter>
      </HelmetProvider>,
    )
    await waitFor(() => expect(container.querySelector('h1')).not.toBeNull())
    const data = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual([CONTENT[locale].home, CONTENT[locale].breadcrumb])
    expect(crumbs.itemListElement[1].item).toBe(`${SITE}${paths.doors[locale]}`)
  })
})
