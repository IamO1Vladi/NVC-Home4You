import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import ModularHousesPage from './ModularHousesPage.jsx'
import PricesPage from './PricesPage.jsx'
import bgContent from '../content/bg/modularHouses.js'
import enContent from '../content/en/modularHouses.js'
import elContent from '../content/el/modularHouses.js'
import { paths } from '../routes/paths.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'
import { forgetHomePhotos } from '../lib/homePhotos.js'

// The Box houses page and the prices page once staff move the capsule into its own "capsule"
// gallery category (state B of the owner's two new sections, 2026-10-17), with two steel-frame
// projects ("prefab") in the gallery too, one priced and one not.
//
// Today's state (A, the capsule under "modular") is what ModularHousesPage.test.jsx and
// PricesPage.test.jsx serve. Here the same live rows are served with only the capsule's
// category changed, and both pages must read exactly as they do today: the capsule's wide card,
// its comparison row and its Product markup on the Box houses page; its row on the prices page,
// arriving ready. A steel-frame project is priced per project, so it is on neither page.
// galleryUtils caches the first list for the visit, which is why this state has a file of its own.

const CONTENT = { bg: bgContent, en: enContent, el: elContent }

const item = (id, category, price, title, titleBg, titleEl) => ({
  id, category, price, currency: 'EUR', title, titleBg, titleEl,
  description: `<p>${title}</p>`, descriptionBg: `<p>${titleBg}</p>`, descriptionEl: `<p>${titleEl}</p>`,
  coverUrl: `/api/img/gallery/${id}/cover.webp`, images: [`/api/img/gallery/${id}/cover.webp`], catalogId: null,
})

const GALLERY_B = [
  item(13, 'wagon', 4300, 'Container House – 6000mm*3000mm', 'Жилищен фургон - 6000мм*3000мм', 'Σπίτι τύπου Container – 6000 mm × 3000 mm'),
  item(4, 'modular', 25500, 'Expandable house - 58m² with balcony and a double roof', 'Разгъваема къща – 58 м² с веранда и двоен покрив', 'Αναπτυσσόμενη κατοικία — 58 m² με βεράντα και διπλή στέγη'),
  item(15, 'modular', 28000, 'Expandable house - 73m² with balcony and a double roof', 'Разгъваема къща – 73 м² с веранда и двоен покрив', 'Αναπτυσσόμενη κατοικία — 73 m² με βεράντα και διπλή στέγη'),
  item(10, 'modular', 14000, 'Expandable House – 37 m²', 'Разгъваема Къща – 37 м²', 'Αναπτυσσόμενη κατοικία – 37 m²'),
  item(11, 'modular', 16700, 'Expandable House – 37 m² with balcony and a double roof', 'Разгъваема къща – 37 м² с веранда и двоен покрив', 'Αναπτυσσόμενη κατοικία – 37 m² με βεράντα και διπλή στέγη'),
  item(5, 'modular', 23000, 'Expandable House – 58 m²', 'Разгъваема Къща – 58 м²', 'Αναπτυσσόμενη κατοικία — 58 m²'),
  item(9, 'modular', 26500, 'Expandable House – 73 m²', 'Разгъваема Къща – 73 м²', 'Αναπτυσσόμενη κατοικία — 73 m²'),
  item(16, 'modular', 17800, 'Panoramic Box House – 37 m²', 'Панорамна Бокс къща – 37 м²', 'Πανοραμικό Box House – 37 m²'),
  item(17, 'modular', 32700, 'Two-storey expandable house - 74m²', 'Двуетажна разгъваема къща - 74м²', 'Διώροφη αναπτυσσόμενη κατοικία — 74 m²'),
  // The only change from today's rows: the capsule's category.
  item(100015, 'capsule', 55000, 'Space house', 'Космическа къща - капсула', 'Φουτουριστική κατοικία-κάψουλα'),
  item(100016, 'modular', 10500, 'Expandable House – 18 m²', 'Разгъваема Къща – 18 м²', 'Αναπτυσσόμενη κατοικία – 18 m²'),
  // Two steel-frame projects already built, one priced, one not.
  item(100020, 'prefab', 42000, 'Steel-frame house – Bansko', 'Къща на метална конструкция – Банско', 'Μεταλλικό σπίτι – Μπάνσκο'),
  { ...item(100021, 'prefab', null, 'Steel-frame house – Plovdiv', 'Къща на метална конструкция – Пловдив', 'Μεταλλικό σπίτι – Πλόβντιβ'), price: undefined },
]

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

beforeEach(() => {
  forgetHomePhotos()
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/api/gallery')) return json({ items: GALLERY_B })
    if (u.includes('/api/cases-page')) return json({ cases: [], reviews: [] })
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const flat = (s) => String(s).replace(/\s/g, ' ')

function renderWith(path, page, onRequestModel = () => {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}} onRequestModel={onRequestModel}>
        {page}
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

const ldLists = (container) => [...container.querySelectorAll('script[type="application/ld+json"]')]
  .map((s) => JSON.parse(s.textContent))
  .filter((d) => d['@type'] === 'ItemList')

describe('the Box houses page, the capsule moved to its own category', () => {
  it.each(['bg', 'en', 'el'])('keeps the capsule\'s wide card, its comparison row and its markup (%s)', async (locale) => {
    const c = CONTENT[locale]
    const asked = []
    const { container } = renderWith(paths.modularHouses[locale], <ModularHousesPage locale={locale} content={c} />, (m) => asked.push(m))
    await waitFor(() => expect(container.querySelector('#item-100016')).not.toBeNull())

    const capsule = container.querySelector('#item-100015')
    expect(capsule).not.toBeNull()
    expect(capsule.classList.contains('pp-unit--wide')).toBe(true)
    expect(flat(capsule.textContent)).toContain(flat(euro(55000, locale)))
    expect(capsule.textContent).toContain(c.capsule.basis)
    for (const line of c.capsule.lines) expect(capsule.textContent).toContain(line)

    const table = flat(container.querySelector('table.pp-spec').textContent)
    expect(table).toContain(flat(c.compare.capsulePrice.replace('{price}', euro(55000, locale))))
    expect(table).toContain(flat(c.compare.boxPrice.replace('{price}', euro(10500, locale))))

    // The hero's "from" is still the 18 m² house; the steel-frame projects are not on this page.
    expect(flat(container.textContent)).toContain(flat(euro(10500, locale)))
    expect(container.querySelector('#item-100020')).toBeNull()
    expect(container.querySelector('#item-100021')).toBeNull()

    const [list] = ldLists(container)
    const offers = list.itemListElement.map((e) => e.item.offers)
    expect(offers.map((o) => o.price).sort((a, b) => a - b))
      .toEqual([10500, 14000, 16700, 17800, 23000, 25500, 26500, 28000, 32700, 55000])
    expect(offers.every((o) => o.availability === 'https://schema.org/MadeToOrder')).toBe(true)

    // One product, one category: the capsule is named as its gallery page names it now that
    // it is filed under "capsule" (GalleryProductJSONLD), the houses as before.
    const products = list.itemListElement.map((e) => e.item)
    const capsuleProduct = products.find((p) => p.offers.price === 55000)
    expect(capsuleProduct.category).toBe(c.capsule.schemaCategory)
    expect(products.filter((p) => p !== capsuleProduct).every((p) => p.category === c.schemaCategory)).toBe(true)

    // Its button still asks about the capsule itself.
    capsule.querySelector('button.hp-btn').click()
    expect(asked.map((m) => m.id)).toEqual([100015])
  })
})

describe('the prices page, the capsule moved to its own category', () => {
  it.each(['bg', 'en', 'el'])('keeps the capsule\'s row in the Box section, arriving ready (%s)', async (locale) => {
    const t = getPricesCopy(locale)
    const { container } = renderWith(paths.prices[locale], <PricesPage locale={locale} />)
    await waitFor(() => expect(container.querySelector('#item-100015')).not.toBeNull())

    const card = container.querySelector('#item-100015')
    expect(card.closest('#prices-box')).not.toBeNull()
    expect(card.querySelector('.prices-breakdown div:nth-child(2) dd').textContent).toBe(t.arrivesReady)
    expect(card.querySelector('.prices-card-total strong').textContent).toBe(euro(55000, locale))

    const row = [...container.querySelectorAll('#prices-box .prices-table tbody tr')]
      .find((tr) => /Space house|капсула|κάψουλα/.test(tr.querySelector('.prices-model-name').textContent))
    expect([...row.querySelectorAll('td')].map((td) => td.textContent))
      .toEqual([euro(55000, locale), t.arrivesReady, t.arrivesReady, euro(55000, locale)])

    // The finished "from" is the 18 m² house with its assembly, as today.
    expect(container.querySelector('.prices-from-value').textContent).toBe(euro(10500 + 1200, locale))

    // A steel-frame project is priced per project: no row, no card.
    expect(container.querySelector('#item-100020')).toBeNull()
    expect(container.querySelector('#item-100021')).toBeNull()

    const [list] = ldLists(container)
    const capsuleOffer = list.itemListElement.map((e) => e.item).find((p) => p.url.endsWith('#item-100015'))
    expect(capsuleOffer.offers).toMatchObject({ price: 55000, availability: 'https://schema.org/MadeToOrder' })
    expect(list.itemListElement.some((e) => e.item.url.endsWith('#item-100020'))).toBe(false)
  })
})
