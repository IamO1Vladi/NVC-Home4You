import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import bgGallery from '../content/bg/gallery.js'
import enGallery from '../content/en/gallery.js'
import elGallery from '../content/el/gallery.js'
import { euro } from '../lib/euro.js'

// The gallery index, rebuilt 2026-10-17 (GalleryIndexPage.jsx). Until then it covered every
// photo with a grey label, showed no price on a wide screen, offered two filters that always
// opened empty ("Сглобяема къща", "Гараж"), drew its filters as ARIA tabs with no panels, and put
// 4 of the 16 models behind a page-2 <button> that no crawler follows. These pin the new page:
// two filters and "all" as toggle buttons, a ?cat= it does not offer showing everything, every
// card with its photo, its price and its link, every model on one page (real ?page=N links only
// past 24), and an ItemList of exactly the cards on show.
//
// The list comes from /api/gallery through useLocalizedGalleryItems, which caches the first
// answer for the visit; the hook is swapped for one that reads `mock`, so each test sets its own
// list, or a loading or failed one. Everything else in galleryUtils is the real thing.

const mock = vi.hoisted(() => ({ raw: [], loading: false, error: null }))

vi.mock('../gallery/galleryUtils.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useLocalizedGalleryItems: (locale, basePath) => ({
      items: mock.raw.map((item) => actual.toLocalizedItem(item, locale, basePath)),
      loading: mock.loading,
      error: mock.error,
    }),
  }
})

const { default: GalleryIndexPage } = await import('./GalleryIndexPage.jsx')

// The 16 models /api/gallery served on 2026-10-17: six containers (wagon), nine Box houses and
// the capsule (modular).
const item = (id, category, price, titleBg, title, titleEl) => ({
  id,
  category,
  price,
  currency: 'EUR',
  titleBg,
  title,
  titleEl,
  description: '<p>Описание</p>',
  coverUrl: `/api/img/gallery/${id}/cover.webp`,
  images: [`/api/img/gallery/${id}/cover.webp`],
})

const LIVE = [
  item(13, 'wagon', 4300, 'Жилищен фургон - 6000мм*3000мм', 'Container House – 6000mm*3000mm', 'Σπίτι τύπου Container – 6000 mm × 3000 mm'),
  item(6, 'wagon', 4800, 'Жилищен фургон - 7000мм*3000мм', 'Container House – 7000mm*3000mm', 'Σπίτι τύπου Container – 7000mm*3000mm'),
  item(8, 'wagon', 6500, 'Контейнерна къща – 8000*3000мм с двускатен покрив', 'Container House – 8000*3000mm with pitched roof', 'Σπίτι τύπου Container – 8000 × 3000 mm με δίρριχτη στέγη'),
  item(14, 'wagon', 5200, 'Жилищен фургон с декоративен панел - 6000мм*3000мм', 'Container house with cladding - 6000mm*3000mm', 'Σπίτι τύπου Container με επένδυση – 6000 × 3000 mm'),
  item(7, 'wagon', 5600, 'Жилищен фургон с декоративен панел - 7000мм*3000мм', 'Container house with cladding - 7000mm*3000mm', 'Σπίτι τύπου Container με επένδυση – 7000 × 3000 mm'),
  item(4, 'modular', 25500, 'Разгъваема Къща - 58m² с веранда и двоен покрив', 'Expandable house - 58m² with balcony and a double roof', 'Αναπτυσσόμενη κατοικία – 58 m² με μπαλκόνι και διπλή στέγη'),
  item(15, 'modular', 28000, 'Разгъваема Къща - 73m² с веранда и двоен покрив', 'Expandable house - 73m² with balcony and a double roof', 'Αναπτυσσόμενη κατοικία – 73 m² με μπαλκόνι και διπλή στέγη'),
  item(10, 'modular', 14000, 'Разгъваема Къща – 37 м²', 'Expandable House – 37 m²', 'Αναπτυσσόμενη κατοικία – 37 m²'),
  item(11, 'modular', 16700, 'Разгъваема къща – 37 м² с веранда и двоен покрив', 'Expandable House – 37 m² with balcony and a double roof', 'Αναπτυσσόμενη κατοικία – 37 m² με μπαλκόνι και διπλή στέγη'),
  item(5, 'modular', 23000, 'Разгъваема Къща – 58 м²', 'Expandable House – 58 m²', 'Αναπτυσσόμενη κατοικία — 58 m²'),
  item(9, 'modular', 26500, 'Разгъваема Къща – 73 м²', 'Expandable House – 73 m²', 'Αναπτυσσόμενη κατοικία — 73 m²'),
  item(16, 'modular', 17800, 'Панорамна Бокс къща – 37 м²', 'Panoramic Box House – 37 m²', 'Πανοραμικό Box House – 37 m²'),
  item(12, 'wagon', 4950, 'Панорамен офис контейнер -  6000*3000мм', 'Panoramic Office Container - 6000*3000mm', 'Πανοραμικό Office Container – 6000 × 3000 mm'),
  item(17, 'modular', 32700, 'Двуетажна разгъваема къща - 74м²', 'Two-storey expandable house - 74m²', 'Διώροφη αναπτυσσόμενη κατοικία — 74 m²'),
  item(100015, 'modular', 55000, 'Космическа къща - капсула', 'Space house', 'Φουτουριστική κατοικία-κάψουλα'),
  item(100016, 'modular', 10500, 'Разгъваема Къща – 18 м²', 'Expandable House – 18 m²', 'Αναπτυσσόμενη κατοικία – 18 m²'),
]

const WAGONS = LIVE.filter((i) => i.category === 'wagon').length
const BOXES = LIVE.filter((i) => i.category === 'modular').length

const LOCALES = {
  bg: { content: bgGallery, path: '/bg/galeriq', base: 'https://nvc-home4you.eu/bg/galeriq' },
  en: { content: enGallery, path: '/en/gallery', base: 'https://nvc-home4you.eu/en/gallery' },
  el: { content: elGallery, path: '/el/gkaleri', base: 'https://nvc-home4you.eu/el/gkaleri' },
}

let location
function LocationSpy() {
  location = useLocation()
  return null
}

function renderIndex(locale = 'bg', query = '') {
  const { content, path, base } = LOCALES[locale]
  return render(
    <MemoryRouter initialEntries={[`${path}${query}`]}>
      <Routes>
        <Route
          path={path}
          element={(
            <>
              <GalleryIndexPage locale={locale} content={content} basePath={base} />
              <LocationSpy />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

const cards = (container) => [...container.querySelectorAll('.gl-card:not(.gl-card--skel)')]
const chips = (content) => within(screen.getByRole('group', { name: content.filtersAria })).getAllByRole('button')
const cardTitled = (container, start) => cards(container).find((card) => card.querySelector('.gl-link').textContent.startsWith(start))

function itemList(container) {
  return [...container.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => JSON.parse(script.textContent))
    .find((data) => data['@type'] === 'ItemList') || null
}

beforeEach(() => {
  mock.raw = LIVE
  mock.loading = false
  mock.error = null
})

describe('the gallery index head', () => {
  it.each(Object.keys(LOCALES))('%s: the eyebrow, the H1 it always had, unstyled inline, and a true lead', (locale) => {
    const { content } = LOCALES[locale]
    const { container } = renderIndex(locale)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(content.heading)
    expect(h1).not.toHaveAttribute('style')
    expect(container.querySelector('.hp-eyebrow')).toHaveTextContent(content.eyebrow)
    expect(container.querySelector('.hp-lead')).toHaveTextContent(content.lead)
  })

  it('does not call every model available: the Box houses are made to order', () => {
    expect(bgGallery.lead).not.toMatch(/наличн/i)
    expect(bgGallery.lead).toMatch(/по поръчка/)
    expect(enGallery.lead).toMatch(/made to order/)
    expect(elGallery.lead).toMatch(/κατά παραγγελία/)
  })
})

describe('the gallery index filters', () => {
  it.each([
    ['bg', ['Всички', 'Контейнери', 'Бокс къщи']],
    ['en', ['All', 'Containers', 'Box houses']],
    ['el', ['Όλα', 'Κοντέινερ', 'Σπίτια Box']],
  ])('%s: all and the two product lines, in the site\'s words, as toggle buttons', (locale, labels) => {
    const { content } = LOCALES[locale]
    const { container } = renderIndex(locale)

    const buttons = chips(content)
    expect(buttons.map((b) => b.textContent)).toEqual(labels)
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    // Toggle buttons, not tabs: there are no tab panels for tabs to control.
    expect(container.querySelector('[role="tab"], [role="tablist"], [role="tabpanel"]')).toBeNull()
  })

  it.each(Object.keys(LOCALES))('%s: the prefab and garage filters are gone', (locale) => {
    const { content } = LOCALES[locale]
    renderIndex(locale)

    const labels = chips(content).map((b) => b.textContent)
    expect(labels).not.toContain(content.filters.categories.prefab)
    expect(labels).not.toContain(content.filters.categories.garage)
    expect(labels).toHaveLength(3)
  })

  it('a filter shows only its line, keeps it in the URL, and lets go when pressed again', () => {
    const { container } = renderIndex('bg')
    const [all, containers, box] = chips(bgGallery)

    fireEvent.click(containers)
    expect(cards(container)).toHaveLength(WAGONS)
    expect(containers).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveAttribute('aria-pressed', 'false')
    expect(location.search).toBe('?cat=wagon')
    expect(container.querySelector('.gl-count')).toHaveTextContent(`${WAGONS} модела`)

    fireEvent.click(box)
    expect(cards(container)).toHaveLength(BOXES)
    expect(location.search).toBe('?cat=modular')

    fireEvent.click(box)
    expect(cards(container)).toHaveLength(LIVE.length)
    expect(all).toHaveAttribute('aria-pressed', 'true')
    expect(location.search).toBe('')
  })

  it.each(['?cat=prefab', '?cat=garage', '?cat=Гараж', '?cat=Сглобяема къща', '?cat=capsule', '?cat=Космически капсули', '?cat=nonsense', '?cat='])(
    'a ?cat= the index does not offer (%s) shows every model',
    (query) => {
      const { container } = renderIndex('bg', query)
      expect(cards(container)).toHaveLength(LIVE.length)
      expect(chips(bgGallery)[0]).toHaveAttribute('aria-pressed', 'true')
    },
  )

  it('the product pages\' links still land filtered (?cat=wagon, ?cat=modular)', () => {
    const first = renderIndex('bg', '?cat=wagon')
    expect(cards(first.container)).toHaveLength(WAGONS)
    expect(chips(bgGallery)[1]).toHaveAttribute('aria-pressed', 'true')
    first.unmount()

    const second = renderIndex('en', '?cat=modular')
    expect(cards(second.container)).toHaveLength(BOXES)
    expect(chips(enGallery)[2]).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('the gallery index cards', () => {
  it.each(Object.keys(LOCALES))('%s: every card has its photo uncovered, its name linking to its page, and its price', (locale) => {
    const { content, path } = LOCALES[locale]
    const { container } = renderIndex(locale)

    const shown = cards(container)
    expect(shown).toHaveLength(LIVE.length)
    for (const card of shown) {
      // The photo is the card's own first child, with nothing laid over it.
      const photo = card.querySelector('img.gl-photo')
      expect(photo.parentElement).toBe(card)
      expect(card.firstElementChild).toBe(photo)

      const link = within(card).getByRole('link')
      expect(link.closest('h2')).not.toBeNull()
      expect(decodeURIComponent(link.getAttribute('href'))).toMatch(new RegExp(`^${path}/.+`))
      expect(photo).toHaveAttribute('alt', link.textContent)

      expect(card.querySelector('.gl-price').textContent).toMatch(/\d/)
      expect(card.querySelector('.gl-basis').textContent.trim()).not.toBe('')
      expect(card.querySelector('.gl-go')).toHaveTextContent(content.card.more)
    }
    // None of the old overlay is left.
    expect(container.querySelector('.gcard, .gcard-info, .gcard-glare')).toBeNull()
  })

  it('prints the price as the prices table does, with what it includes', () => {
    const { container } = renderIndex('bg')

    const container6x3 = cardTitled(container, 'Жилищен фургон – 6000мм')
    expect(container6x3.querySelector('.gl-price').textContent).toBe(euro(4300, 'bg'))
    expect(container6x3.querySelector('.gl-basis')).toHaveTextContent(bgGallery.card.basis.wagon)

    const box37 = cardTitled(container, 'Разгъваема Къща – 37 м²')
    expect(box37.querySelector('.gl-price').textContent).toBe(euro(14000, 'bg'))
    expect(box37.querySelector('.gl-basis')).toHaveTextContent(bgGallery.card.basis.box)

    // The capsule has no assembly to add (the owner, 2026-10-17): its card does not say "without
    // assembly", which would read as an extra to pay.
    const capsule = cardTitled(container, 'Космическа къща')
    expect(capsule.querySelector('.gl-basis').textContent).not.toBe(bgGallery.card.basis.box)
    expect(capsule.querySelector('.gl-basis').textContent.startsWith(bgGallery.card.basis.vat)).toBe(true)
  })

  it('formats the price in the page\'s language', () => {
    const en = renderIndex('en')
    const enCard = cardTitled(en.container, 'Container House – 6000mm')
    expect(enCard.querySelector('.gl-price').textContent).toBe('€4,300')
    expect(enCard.querySelector('.gl-basis')).toHaveTextContent(enGallery.card.basis.wagon)
    en.unmount()

    const el = renderIndex('el')
    const elCard = cardTitled(el.container, 'Αναπτυσσόμενη κατοικία – 37 m²')
    expect(elCard.querySelector('.gl-price').textContent.replace(/\s/g, ' ')).toBe('14.000 €')
    expect(elCard.querySelector('.gl-basis')).toHaveTextContent(elGallery.card.basis.box)
  })

  it('a model with no price says the price is on request rather than showing none', () => {
    mock.raw = [{ ...LIVE[0], price: null }]
    const { container } = renderIndex('bg')

    const [card] = cards(container)
    expect(card.querySelector('.gl-price')).toBeNull()
    expect(card.querySelector('.gl-basis')).toHaveTextContent(bgGallery.detail.priceOnRequest)
  })
})

describe('every model on one page', () => {
  it('holds all 16 models, with no pager and no button but the filters', () => {
    const { container } = renderIndex('bg')

    expect(cards(container)).toHaveLength(16)
    expect(screen.queryByRole('navigation', { name: bgGallery.pagination.paginationAria })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('past 24 models pages with real ?page=N links, not buttons', () => {
    mock.raw = Array.from({ length: 30 }, (_, i) => item(i + 1, i % 2 ? 'wagon' : 'modular', 5000 + i, `Модел ${i + 1}`, `Model ${i + 1}`, `Μοντέλο ${i + 1}`))
    const first = renderIndex('bg')

    expect(cards(first.container)).toHaveLength(24)
    const nav = screen.getByRole('navigation', { name: bgGallery.pagination.paginationAria })
    expect(within(nav).queryAllByRole('button')).toHaveLength(0)
    expect(within(nav).getByRole('link', { name: 'Страница 2' })).toHaveAttribute('href', '/bg/galeriq?page=2')
    expect(within(nav).getByRole('link', { name: 'Страница 1' })).toHaveAttribute('aria-current', 'page')
    expect(itemList(first.container).itemListElement).toHaveLength(24)
    first.unmount()

    const second = renderIndex('bg', '?page=2')
    expect(cards(second.container)).toHaveLength(6)
    const nav2 = screen.getByRole('navigation', { name: bgGallery.pagination.paginationAria })
    expect(within(nav2).getByRole('link', { name: 'Страница 2' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav2).getByRole('link', { name: 'Страница 1' })).toHaveAttribute('href', '/bg/galeriq')
    expect(itemList(second.container).itemListElement).toHaveLength(6)
  })

  it('an old ?p=2 link or a page past the end shows the first page', () => {
    const old = renderIndex('bg', '?p=2')
    expect(cards(old.container)).toHaveLength(16)
    old.unmount()

    const far = renderIndex('bg', '?page=9')
    expect(cards(far.container)).toHaveLength(16)
  })
})

describe('the ItemList markup', () => {
  it('lists exactly the cards on show, in their order, under the bare gallery URL', () => {
    const { container } = renderIndex('bg')

    let list = itemList(container)
    expect(list.url).toBe('https://nvc-home4you.eu/bg/galeriq')
    expect(list.itemListElement).toHaveLength(cards(container).length)
    const hrefs = cards(container).map((card) => decodeURIComponent(card.querySelector('.gl-link').getAttribute('href')))
    expect(list.itemListElement.map((entry) => decodeURIComponent(entry.url))).toEqual(hrefs.map((href) => `https://nvc-home4you.eu${href}`))

    fireEvent.click(chips(bgGallery)[1])
    list = itemList(container)
    expect(cards(container)).toHaveLength(WAGONS)
    expect(list.itemListElement).toHaveLength(WAGONS)
  })

  it('keeps a model with no photo in the list, as it keeps its card', () => {
    mock.raw = [{ ...LIVE[0], coverUrl: '', images: [] }, LIVE[1]]
    const { container } = renderIndex('bg')

    expect(cards(container)).toHaveLength(2)
    const list = itemList(container)
    expect(list.itemListElement).toHaveLength(2)
    expect(list.itemListElement[0].item.image).toBeUndefined()
  })
})

describe('loading, empty and error', () => {
  it('while loading: placeholders in the cards\' shape, the filters already in place, no markup yet', () => {
    mock.raw = []
    mock.loading = true
    const { container } = renderIndex('bg')

    const grid = container.querySelector('.gl-grid')
    expect(grid).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.gl-card--skel')).toHaveLength(8)
    expect(container.querySelectorAll('.gl-card--skel .gl-photo')).toHaveLength(8)
    expect(screen.getByRole('status')).toHaveTextContent(bgGallery.loading)
    expect(chips(bgGallery)).toHaveLength(3)
    expect(itemList(container)).toBeNull()
  })

  it('when the list fails: says so, in place of the filters and the grid', () => {
    mock.raw = []
    mock.error = new Error('Failed to load gallery')
    const { container } = renderIndex('bg')

    expect(screen.getByRole('alert')).toHaveTextContent(bgGallery.error)
    expect(screen.queryByRole('group', { name: bgGallery.filtersAria })).toBeNull()
    expect(container.querySelector('.gl-grid')).toBeNull()
    // And it is not a dead end: a button loads the page again.
    expect(within(screen.getByRole('alert')).getByRole('button', { name: bgGallery.retry })).toBeInTheDocument()
  })

  it('names the retry button in every language', () => {
    for (const content of [bgGallery, enGallery, elGallery]) expect(content.retry?.trim()).toBeTruthy()
  })

  it('with no models at all: says there are none', () => {
    mock.raw = []
    const { container } = renderIndex('en')

    expect(container.querySelector('.gl-state')).toHaveTextContent(enGallery.empty.all)
    expect(container.querySelector('.gl-grid')).toBeNull()
  })

  // A filter is drawn only while its line has a model (2026-10-17), so a ?cat= for a line with
  // none is one the index does not offer, and shows every model rather than an empty page.
  it('with no model in the filter asked for: shows all of them, and no chip for it', () => {
    mock.raw = LIVE.filter((i) => i.category === 'wagon')
    const { container } = renderIndex('bg', '?cat=modular')

    expect(container.querySelector('.gl-state')).toBeNull()
    expect(cards(container)).toHaveLength(WAGONS)
    expect(chips(bgGallery).map((b) => b.textContent)).toEqual(['Всички', 'Контейнери'])
    expect(chips(bgGallery)[0]).toHaveAttribute('aria-pressed', 'true')
  })
})

// The owner's two new sections (2026-10-17): "Космически капсули" and "Сглобяеми къщи". Today
// (state A) the capsule is filed under modular and no steel-frame project is in the gallery, so
// neither chip shows; once staff move the capsule (state B) its chip appears after the Box
// houses, and once they add a project, the steel-frame houses' chip comes last.
const CAPSULE = LIVE.find((i) => i.id === 100015)
const STATE_B = LIVE.map((i) => (i.id === 100015 ? { ...i, category: 'capsule' } : i))
const PROJECT = item(100020, 'prefab', 42000, 'Къща на метална конструкция – Банско', 'Steel-frame house – Bansko', 'Μεταλλικό σπίτι – Μπάνσκο')
const PROJECT_NO_PRICE = { ...item(100021, 'prefab', null, 'Къща на метална конструкция – Пловдив', 'Steel-frame house – Plovdiv', 'Μεταλλικό σπίτι – Πλόβντιβ'), price: undefined }

// The ItemList entry for the card whose name starts so.
const listed = (container, start) => itemList(container).itemListElement.find((entry) => entry.item.name.startsWith(start))

describe('the space capsules and the steel-frame houses', () => {
  it('today, with the capsule under modular: no capsule chip, and the capsule among the Box houses', () => {
    const { container } = renderIndex('bg', '?cat=modular')
    expect(chips(bgGallery).map((b) => b.textContent)).toEqual(['Всички', 'Контейнери', 'Бокс къщи'])
    expect(cards(container)).toHaveLength(BOXES)
    expect(cardTitled(container, 'Космическа къща')).toBeTruthy()
  })

  it.each([
    ['bg', ['Всички', 'Контейнери', 'Бокс къщи', 'Космически капсули']],
    ['en', ['All', 'Containers', 'Box houses', 'Space capsules']],
    ['el', ['Όλα', 'Κοντέινερ', 'Σπίτια Box', 'Κάψουλες χώρου']],
  ])('%s: once the capsule is moved, its chip comes after the Box houses and holds it alone', (locale, labels) => {
    mock.raw = STATE_B
    const { content } = LOCALES[locale]
    const { container } = renderIndex(locale)

    const buttons = chips(content)
    expect(buttons.map((b) => b.textContent)).toEqual(labels)
    expect(cards(container)).toHaveLength(LIVE.length)

    fireEvent.click(buttons[3])
    expect(location.search).toBe('?cat=capsule')
    expect(cards(container)).toHaveLength(1)
    expect(buttons[3]).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(buttons[2])
    expect(location.search).toBe('?cat=modular')
    expect(cards(container)).toHaveLength(BOXES - 1)
  })

  it('a link to ?cat=capsule lands on it once the capsule is moved', () => {
    mock.raw = STATE_B
    const { container } = renderIndex('bg', '?cat=capsule')
    expect(cards(container)).toHaveLength(1)
    expect(chips(bgGallery)[3]).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([['under modular', LIVE], ['moved', STATE_B]])('the capsule\'s card says it arrives ready, %s, and its offer is made to order', (_, raw) => {
    mock.raw = raw
    const { container } = renderIndex('bg')
    const capsule = cardTitled(container, 'Космическа къща')
    expect(capsule.querySelector('.gl-price').textContent).toBe(euro(CAPSULE.price, 'bg'))
    expect(capsule.querySelector('.gl-basis')).toHaveTextContent(bgGallery.card.basis.ready)
    expect(listed(container, 'Космическа къща').item.offers.availability).toBe('https://schema.org/MadeToOrder')
  })

  it.each([
    ['bg', 'Сглобяеми къщи'],
    ['en', 'Steel-frame houses'],
    ['el', 'Μεταλλικά σπίτια'],
  ])('%s: a steel-frame project brings its chip, last, and its card names its price as this project\'s', (locale, label) => {
    mock.raw = [...STATE_B, PROJECT, PROJECT_NO_PRICE]
    const { content } = LOCALES[locale]
    const { container } = renderIndex(locale)

    const buttons = chips(content)
    expect(buttons).toHaveLength(5)
    expect(buttons[4]).toHaveTextContent(label)
    fireEvent.click(buttons[4])
    expect(location.search).toBe('?cat=prefab')
    const shown = cards(container)
    expect(shown).toHaveLength(2)

    const [priced, unpriced] = shown
    expect(priced.querySelector('.gl-price').textContent).toBe(euro(42000, locale))
    expect(priced.querySelector('.gl-basis')).toHaveTextContent(content.card.basis.project)
    // No price: priced per project, not "on request".
    expect(unpriced.querySelector('.gl-price')).toBeNull()
    expect(unpriced.querySelector('.gl-basis')).toHaveTextContent(content.card.basis.projectOnRequest)
    expect(unpriced.querySelector('.gl-basis')).not.toHaveTextContent(content.detail.priceOnRequest)
  })

  it('a steel-frame project carries no offer in the markup: it is priced per project', () => {
    mock.raw = [PROJECT]
    const { container } = renderIndex('bg')
    expect(listed(container, 'Къща на метална конструкция').item.offers).toBeUndefined()
  })

  it('a garage model brings no chip: garage stays internal', () => {
    mock.raw = [...LIVE, item(30, 'garage', 9000, 'Гараж', 'Garage', 'Γκαράζ')]
    renderIndex('bg')
    expect(chips(bgGallery).map((b) => b.textContent)).toEqual(['Всички', 'Контейнери', 'Бокс къщи'])
  })

  it('while loading: the two lines the gallery always has, so the row does not jump', () => {
    mock.raw = []
    mock.loading = true
    renderIndex('bg', '?cat=capsule')
    expect(chips(bgGallery).map((b) => b.textContent)).toEqual(['Всички', 'Контейнери', 'Бокс къщи'])
  })
})
