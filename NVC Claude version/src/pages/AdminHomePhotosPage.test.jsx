import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminHomePhotosPage from './AdminHomePhotosPage.jsx'
import { INTERIORS_PAIR_SLOTS, PHOTO_SLOTS, PHOTO_SLOT_GROUPS, PHOTO_SLOT_NAMES, photoSlotOf } from '../lib/photoSlotNames.js'
import { PANEL_ORDER, PHOTO_SLOT_GROUP_HEADINGS, PHOTO_SLOT_PANEL } from '../lib/photoSlotDefaults.js'

// "Снимки на сайта". What is pinned here: every slot of the registry renders under its page's
// heading, with its label, BEFORE anything has been uploaded (a screen that only lists what
// exists cannot show where a photo belongs), each empty one showing the picture the site shows
// in its place; the hero cards name the page each slide links to and are the only ones with
// arrows; the team, the factory, Interiors and the doors have no gallery picker and the
// decorative slots and model cards no description box; each verb hits the address and body the
// API binds — FormData with `file`, `{ imageKey }` for a gallery pick, `{ a, b }` for a swap,
// DELETE to clear; a HEIC or a file over 25 MB never leaves the browser; a refused upload shows
// the server's sentence (in Bulgarian where it is one the owner can meet) on its own card without
// taking the slots away; the re-read after a write never empties the screen and focus comes back
// to the card; a name the screen does not know still shows; and an expired session asks for
// sign-in instead of looking broken. Since 2026-10-17 (forty-one slots): the steel and Partner
// steps are rows of their own (Partner's step 2 points at the factory photo in About's section);
// each before/after pair is one row whose words say what the site shows, a half uploaded alone
// says it is waiting for the other, and the notices of a pair say what the SITE does; and every
// page's section says where its other photos are changed, linking the Gallery and Cases screens.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/home-photos']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const NAMES = [...PHOTO_SLOT_NAMES]
const label = (name, lang = 'bg') => PHOTO_SLOT_PANEL[name].label[lang]

// The admin list's "index", as HomePhotoService.PanelIndexOf gives it.
const indexOf = (name) => {
  const slot = photoSlotOf(name)
  if (!slot) return name
  if (slot.kind === 'hero') return name.slice('hero-'.length)
  return slot.modelKey ?? slot.pageKey ?? name
}

const emptySlot = (name) => ({
  name,
  kind: photoSlotOf(name)?.kind ?? 'photo',
  index: indexOf(name),
  imageKey: null, url: null, alt: null, updatedAt: null, updatedByUpn: null,
})

const filledSlot = (name, alt = '') => ({
  ...emptySlot(name),
  imageKey: `home/${NAMES.indexOf(name) + 1}/${name}.webp`,
  url: `/api/img/home/${NAMES.indexOf(name) + 1}/${name}.webp`,
  alt,
  updatedAt: '2026-10-16T09:00:00Z',
  updatedByUpn: 'maria@nvc-home4you.eu',
})

const EMPTY = { slots: NAMES.map(emptySlot), names: NAMES }

const FILLED_NAMES = {
  'hero-1': 'Front porch',
  'hero-2': 'Front porch',
  'page-steel-houses': 'Къща в Петрич',
  'about-hero': 'Екипът пред склада',
  'about-team-radina-ivanova': '',
  'model-58': '',
}

// The twelve of 2026-10-17.
const PHASE_2 = NAMES.slice(29)

// The gallery picker is off where a house photo would make the page's words untrue.
const UNPICKABLE = [
  ...NAMES.filter((n) => n.startsWith('about-team-')),
  'factory-floor', 'interiors-kitchen', 'interiors-hero', 'interiors-works', 'doors-hero',
  ...PHASE_2,
]

const FILLED = {
  slots: NAMES.map((name) => (name in FILLED_NAMES ? filledSlot(name, FILLED_NAMES[name]) : emptySlot(name))),
  names: NAMES,
}

const HOUSES = [
  {
    id: 8, title: 'Villa-Office 58', titleBg: 'Вила-Офис 58', isPublished: true,
    images: [
      { id: 21, imageKey: 'gallery/8/7cfe-front.webp', url: '/api/img/gallery/8/7cfe-front.webp', sortOrder: 0, altText: null },
      { id: 22, imageKey: 'gallery/8/8aa1-side.webp', url: '/api/img/gallery/8/8aa1-side.webp', sortOrder: 1, altText: null },
    ],
  },
  { id: 9, title: 'Empty model', titleBg: 'Празен модел', isPublished: true, images: [] },
]

let calls = []
let listAnswer = () => json(FILLED)
let uploadAnswer = () => json(FILLED.slots[1])

beforeEach(() => {
  calls = []
  listAnswer = () => json(FILLED)
  uploadAnswer = () => json(FILLED.slots[1])
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const u = String(url)
    const method = options.method || 'GET'
    calls.push({ url: u, method, body: options.body })

    if (u.endsWith('/api/admin/home-photos') && method === 'GET') return listAnswer()
    if (u.includes('/api/admin/home-photos/') && u.endsWith('/file') && method === 'POST') return uploadAnswer()
    if (u.endsWith('/api/admin/home-photos/swap') && method === 'POST') return json({ ok: true })
    if (u.includes('/api/admin/home-photos/') && u.endsWith('/pick') && method === 'POST') return json(FILLED.slots[2])
    if (u.includes('/api/admin/home-photos/') && u.endsWith('/alt') && method === 'POST') return json(FILLED.slots[0])
    if (u.includes('/api/admin/home-photos/') && method === 'DELETE') return json(null, 204)
    if (u.endsWith('/api/admin/gallery') && method === 'GET') return json(HOUSES)
    // The shell's own identity check and badges — not what these tests are about.
    return json({})
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const card = (text) => screen.getByText(text, { selector: 'strong' }).closest('li')
// The hidden file input the card's "Качи снимка — …" button operates.
const fileInput = (text) => card(text).querySelector('input[type=file]')
const section = (heading) => screen.getByRole('heading', { level: 2, name: heading }).closest('section')
const ready = () => screen.findByText(label('hero-1'), { selector: 'strong' })
const posts = () => calls.filter((c) => c.method === 'POST')

describe('AdminHomePhotosPage', () => {
  it('is "Снимки на сайта", and promises "до 2 минути", never "веднага"', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    expect(screen.getByRole('heading', { level: 1, name: 'Снимки на сайта' })).toBeInTheDocument()
    expect(screen.getByText(/Промените се виждат на сайта до 2 минути/)).toBeInTheDocument()
    expect(screen.queryByText(/веднага/)).not.toBeInTheDocument()
  })

  it('renders every slot under its page, in page order, before any photo has been uploaded', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual([
      'Начална страница', 'Продуктови страници', 'Доставка', 'Партньори', 'За нас', 'Вътрешни ремонти', 'Интериорни врати',
    ])
    for (const group of PHOTO_SLOT_GROUPS) {
      const slotsOnScreen = [...section(PHOTO_SLOT_GROUP_HEADINGS[group].bg).querySelectorAll('li[data-slot]')].map((li) => li.dataset.slot)
      expect(slotsOnScreen.sort(), group).toEqual(PHOTO_SLOTS.filter((s) => s.group === group).map((s) => s.name).sort())
    }
    // Top to bottom as each page shows them, which is not always the API's order.
    expect([...document.querySelectorAll('li[data-slot]')].map((li) => li.dataset.slot)).toEqual(PANEL_ORDER)
    for (const name of NAMES) expect(card(label(name)), name).toBeInTheDocument()
    expect(NAMES).toHaveLength(41)
    expect(document.querySelectorAll('li[data-slot]')).toHaveLength(41)

    // Each empty slot shows what the site shows there, marked as the default; the steel page's
    // default is no photo, so its box says that instead.
    expect(screen.getAllByText('По подразбиране')).toHaveLength(NAMES.length - 1)
    expect(within(card(label('page-steel-houses'))).getByText('Без снимка')).toBeInTheDocument()

    // Every slot can take an upload, each button naming its place; all but the team, the
    // factory, Interiors and the doors can take a gallery photo too.
    expect(screen.getAllByRole('button', { name: /^Качи снимка — / })).toHaveLength(NAMES.length)
    expect(within(card(label('hero-3'))).getByRole('button', { name: `Качи снимка — ${label('hero-3')}` })).toBeInTheDocument()
    expect(UNPICKABLE).toHaveLength(23)
    expect(screen.getAllByRole('button', { name: /^От галерията — / })).toHaveLength(NAMES.length - UNPICKABLE.length)
    for (const name of UNPICKABLE) {
      expect(within(card(label(name))).queryByRole('button', { name: /От галерията/ }), name).not.toBeInTheDocument()
    }
    // Nothing to clear yet.
    expect(screen.queryByRole('button', { name: /Върни снимката по подразбиране|Премахни снимката/ })).not.toBeInTheDocument()
  })

  it("shows an empty slot's default: the page's photo through the resizer, a /public file as it is, or the initials", async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const tile = card('Плочка „Вътрешни ремонти“').querySelector('img')
    expect(tile.getAttribute('src')).toBe('/api/img/content/bvk4n834b-rce-eg-vb.webp?w=320')
    expect(within(card('Плочка „Вътрешни ремонти“')).getByText('По подразбиране')).toBeInTheDocument()

    expect(card('За нас — главна снимка').querySelector('img').getAttribute('src')).toBe('/delivery/crane-lift-800.webp')
    expect(card('Врати — главна снимка').querySelector('img').getAttribute('src')).toBe('/internal-doors/catalogue/rooms/cover.webp')
    expect(card('Екип: Владимир Владимиров').querySelector('img').getAttribute('src')).toBe('/about/team/vladimir-vladimirov.webp')

    // Radina has no photo yet: the page draws her initials, and so does the panel.
    const radina = card('Екип: Радина Иванова')
    expect(radina.querySelector('img')).toBeNull()
    expect(within(radina).getByText('РИ')).toBeInTheDocument()
    expect(within(radina).getByText('По подразбиране')).toBeInTheDocument()

    // Each place says what kind of photo suits it.
    expect(within(radina).getByText(/квадратна, лицето в средата/i)).toBeInTheDocument()
    expect(within(card(label('hero-1'))).getByText(/16:10/)).toBeInTheDocument()
  })

  it('names on every hero card the page its slide links to, and gives arrows to the hero slides only', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    expect(card('Снимка 5 · води към „Доставка и монтаж“')).toBeInTheDocument()
    expect(card('Снимка 2 · води към „Модулни къщи“')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Наляво — / })).toHaveLength(5)
    expect(screen.getAllByRole('button', { name: /^Надясно — / })).toHaveLength(5)
    for (const group of PHOTO_SLOT_GROUPS.filter((g) => g !== 'home')) {
      expect(within(section(PHOTO_SLOT_GROUP_HEADINGS[group].bg)).queryByRole('button', { name: /Наляво|Надясно/ })).not.toBeInTheDocument()
    }
    expect(within(card('Плочка „Модулни къщи“')).queryByRole('button', { name: /Наляво|Надясно/ })).not.toBeInTheDocument()
  })

  it("uploading a team photo posts the file to that person's slot", async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const file = new File(['RIFF'], 'radina.webp', { type: 'image/webp' })
    await userEvent.upload(fileInput('Екип: Радина Иванова'), file)

    await waitFor(() => {
      const post = posts()[0]
      expect(post).toBeTruthy()
      expect(post.url).toContain('/api/admin/home-photos/about-team-radina-ivanova/file')
      expect(post.body).toBeInstanceOf(FormData)
      expect(post.body.get('file')).toBe(file)
    })
    // The list is re-read after the write rather than patched locally.
    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/admin/home-photos')).length).toBeGreaterThan(1)
    })
    // On the card it was for, where the owner is looking — not at the top of a long page.
    expect(await within(card('Екип: Радина Иванова')).findByText('Готово — снимката за „Екип: Радина Иванова“ е запазена. На сайта се вижда до 2 минути.')).toBeInTheDocument()
    // And told to a screen reader, wherever the card is.
    expect(screen.getByRole('status')).toHaveTextContent('Готово — снимката за „Екип: Радина Иванова“ е запазена.')
  })

  it('re-reads the list after a write without emptying the screen', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    let release
    listAnswer = () => new Promise((resolve) => { release = () => resolve(json(FILLED)) })
    await userEvent.upload(fileInput('Екип: Радина Иванова'), new File(['RIFF'], 'r.webp', { type: 'image/webp' }))

    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/admin/home-photos'))).toHaveLength(2))
    // Mid re-read: every card still there, no loading screen.
    expect(document.querySelectorAll('li[data-slot]')).toHaveLength(NAMES.length)
    expect(screen.queryByText('Зареждане…')).not.toBeInTheDocument()

    release()
    expect(await within(card('Екип: Радина Иванова')).findByText(/^Готово — /)).toBeInTheDocument()
    expect(document.querySelectorAll('li[data-slot]')).toHaveLength(NAMES.length)
  })

  it('says so, without losing the slots, when the change is saved but the list cannot be re-read', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    listAnswer = () => json({ errors: ['boom'] }, 500)
    await userEvent.upload(fileInput('Екип: Радина Иванова'), new File(['RIFF'], 'r.webp', { type: 'image/webp' }))

    const radina = card('Екип: Радина Иванова')
    expect(await within(radina).findByRole('alert')).toHaveTextContent('Промяната е запазена, но списъкът не се обнови. Презаредете страницата.')
    expect(within(radina).getByText(/^Готово — /)).toBeInTheDocument()
    expect(document.querySelectorAll('li[data-slot]')).toHaveLength(NAMES.length)
  })

  it('uploading into a hero slot posts to that slot', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const file = new File(['RIFF'], 'porch.webp', { type: 'image/webp' })
    await userEvent.upload(fileInput(label('hero-2')), file)

    await waitFor(() => expect(posts()[0]?.url).toContain('/api/admin/home-photos/hero-2/file'))
    expect(fileInput(label('hero-2'))).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    // The notice names the slide plainly: the card's label already quotes the page it links to.
    expect(await within(card(label('hero-2'))).findByText('Готово — снимката за „Снимка 2 в началото“ е запазена. На сайта се вижда до 2 минути.')).toBeInTheDocument()
  })

  it('refuses a HEIC in the browser, in words the owner can act on, and sends nothing', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const user = userEvent.setup({ applyAccept: false })
    await user.upload(fileInput('За нас — главна снимка'), new File(['ftyp'], 'IMG_0001.HEIC', { type: '' }))

    const alert = await within(card('За нас — главна снимка')).findByRole('alert')
    expect(alert).toHaveTextContent('HEIC/HEIF')
    expect(alert).toHaveTextContent('Запазете я като JPEG, PNG или WebP')
    expect(alert).toHaveTextContent('качете направо от телефона')
    expect(posts()).toHaveLength(0)
  })

  it('refuses a file over 25 MB in the browser, saying its size, and sends nothing', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const big = new File(['x'], 'IMG_0002.JPG', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 30 * 1024 * 1024 })
    await userEvent.upload(fileInput('Врати — главна снимка'), big)

    const alert = await within(card('Врати — главна снимка')).findByRole('alert')
    expect(alert).toHaveTextContent('Снимката е 30 MB, а най-много може 25 MB.')
    expect(posts()).toHaveLength(0)
  })

  it('says a failed upload in Bulgarian: no connection, or a file the server found too large', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    uploadAnswer = () => Promise.reject(new TypeError('Failed to fetch'))
    await userEvent.upload(fileInput('58 m²'), new File(['x'], 'a.webp', { type: 'image/webp' }))
    expect(await within(card('58 m²')).findByRole('alert')).toHaveTextContent('Няма връзка със сървъра — промяната не е запазена.')
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()

    // IIS's own 413 (or 404.13) carries no sentence of the API's: only the status.
    uploadAnswer = () => Promise.resolve({ ok: false, status: 413, json: () => Promise.reject(new Error('not json')), text: () => Promise.resolve('') })
    await userEvent.upload(fileInput('58 m²'), new File(['x'], 'b.webp', { type: 'image/webp' }))
    await waitFor(() => expect(within(card('58 m²')).getByRole('alert')).toHaveTextContent('Снимката е над 25 MB.'))
  })

  it('warns, without refusing, about a photo that does not suit its place', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 900, height: 1200, close: vi.fn() }))
    render(<AdminHomePhotosPage />)
    await ready()

    await userEvent.upload(fileInput('Врати — главна снимка'), new File(['x'], 'door.jpg', { type: 'image/jpeg' }))

    await waitFor(() => expect(posts()[0]?.url).toContain('/api/admin/home-photos/doors-hero/file'))
    const warning = await within(card('Врати — главна снимка')).findByText(/900 px/)
    expect(warning).toHaveTextContent('вертикална, а мястото е хоризонтално')
    expect(screen.getByRole('status')).toHaveTextContent('900 px')
  })

  it('picking from the gallery dialog posts the image key to the chosen slot', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const hero3 = label('hero-3')
    await userEvent.click(within(card(hero3)).getByRole('button', { name: `От галерията — ${hero3}` }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Избери снимка от галерията' })).toBeInTheDocument()
    // Houses with photos are listed by their Bulgarian title; the one without photos is not.
    expect(await within(dialog).findByRole('heading', { name: 'Вила-Офис 58' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Празен модел')).not.toBeInTheDocument()
    // Thumbnails through the resizer, not the full originals.
    expect(within(dialog).getByRole('button', { name: 'Вила-Офис 58 — 1' }).querySelector('img').getAttribute('src'))
      .toBe('/api/img/gallery/8/7cfe-front.webp?w=240')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Вила-Офис 58 — 2' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/pick'))
      expect(post).toBeTruthy()
      expect(post.url).toContain('/api/admin/home-photos/hero-3/pick')
      expect(JSON.parse(post.body)).toEqual({ imageKey: 'gallery/8/8aa1-side.webp' })
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it("a refused upload shows the server's sentence, in Bulgarian, on its card, and keeps the slots on screen", async () => {
    uploadAnswer = () => json({ errors: ['That file could not be read as an image.'] }, 400)
    render(<AdminHomePhotosPage />)
    await ready()

    const file = new File(['x'], 'notes.webp', { type: 'image/webp' })
    await userEvent.upload(fileInput('58 m²'), file)

    expect(await within(card('58 m²')).findByRole('alert')).toHaveTextContent('Файлът не можа да се прочете като снимка. Качете JPEG, PNG или WebP.')
    // Still every slot behind the alert — a refused upload is not a broken page.
    expect(card(label('hero-5'))).toBeInTheDocument()
    expect(card('73 m²')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Качи снимка — / })).toHaveLength(NAMES.length)
  })

  it("shows a sentence of the API's it has no words for as the API said it", async () => {
    uploadAnswer = () => json({ errors: ['Something new went wrong.'] }, 400)
    render(<AdminHomePhotosPage />)
    await ready()

    await userEvent.upload(fileInput('58 m²'), new File(['x'], 'n.webp', { type: 'image/webp' }))
    expect(await within(card('58 m²')).findByRole('alert')).toHaveTextContent('Something new went wrong.')
  })

  it('moving a hero photo left swaps it with its left neighbour', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const [one, two] = [label('hero-1'), label('hero-2')]
    // The first slot has nowhere to go; the second one does.
    expect(within(card(one)).getByRole('button', { name: `Наляво — ${one}` })).toBeDisabled()
    expect(within(card(label('hero-5'))).getByRole('button', { name: `Надясно — ${label('hero-5')}` })).toBeDisabled()
    await userEvent.click(within(card(two)).getByRole('button', { name: `Наляво — ${two}` }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/swap'))
      expect(post).toBeTruthy()
      expect(JSON.parse(post.body)).toEqual({ a: 'hero-2', b: 'hero-1' })
    })
    expect(await within(card(two)).findByText(/Редът е сменен\./)).toBeInTheDocument()
    // The arrow the owner pressed has the focus back once the buttons are enabled again.
    await waitFor(() => expect(document.activeElement).toHaveAttribute('aria-label', `Наляво — ${two}`))
  })

  it('offers to restore the default where there is one, and to remove the photo where the default is initials or nothing', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const clears = screen.getAllByRole('button', { name: /^(Върни снимката по подразбиране|Премахни снимката) — / })
    expect(clears).toHaveLength(Object.keys(FILLED_NAMES).length)
    expect(within(card(label('hero-1'))).getByRole('button', { name: /^Върни снимката по подразбиране — / })).toBeInTheDocument()
    expect(within(card('За нас — главна снимка')).getByRole('button', { name: /^Върни снимката по подразбиране — / })).toBeInTheDocument()
    expect(within(card('Сглобяеми къщи по проект')).getByRole('button', { name: /^Премахни снимката — / })).toBeInTheDocument()

    // After the clear the server lists Radina's slot empty, so the button pressed is gone.
    listAnswer = () => json({
      ...FILLED,
      slots: FILLED.slots.map((s) => (s.name === 'about-team-radina-ivanova' ? emptySlot(s.name) : s)),
    })
    await userEvent.click(within(card('Екип: Радина Иванова')).getByRole('button', { name: 'Премахни снимката — Екип: Радина Иванова' }))

    await waitFor(() => {
      const del = calls.find((c) => c.method === 'DELETE')
      expect(del).toBeTruthy()
      expect(del.url).toMatch(/\/api\/admin\/home-photos\/about-team-radina-ivanova$/)
    })
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1)
    expect(await within(card('Екип: Радина Иванова')).findByText(/До 2 минути мястото на сайта се връща към вида си по подразбиране/)).toBeInTheDocument()
    // Focus lands on the same card's first button, not on <body> at the top of the page.
    await waitFor(() => expect(document.activeElement).toHaveAttribute('aria-label', 'Качи снимка — Екип: Радина Иванова'))
  })

  it("shows a filled slot's photo through the resizer, and asks for a description only where the page uses one", async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const about = card('За нас — главна снимка')
    expect(about.querySelector('img').getAttribute('src')).toBe(`/api/img/home/${NAMES.indexOf('about-hero') + 1}/about-hero.webp?w=320`)
    expect(within(about).getByText(/от maria@nvc-home4you\.eu/)).toBeInTheDocument()

    // About's main photo and the steel page's photo have words on the page; the hero slides and
    // the team are decorative (alt=""), so they have no box.
    const input = within(about).getByLabelText('Описание на снимката (по избор)')
    expect(input).toHaveValue('Екипът пред склада')
    const hint = document.getElementById(input.getAttribute('aria-describedby'))
    expect(hint).toHaveTextContent('Използва се само в българския сайт')
    expect(within(card('Сглобяеми къщи по проект')).getByLabelText('Описание на снимката (по избор)')).toBeInTheDocument()
    expect(within(card(label('hero-1'))).queryByLabelText('Описание на снимката (по избор)')).not.toBeInTheDocument()
    expect(within(card('Екип: Радина Иванова')).queryByLabelText('Описание на снимката (по избор)')).not.toBeInTheDocument()
    // A model card's alt is the model's size whatever the photo, so it asks for none either.
    expect(card('58 m²').querySelector('img').getAttribute('src')).toContain('/api/img/home/7/model-58.webp')
    expect(within(card('58 m²')).queryByLabelText('Описание на снимката (по избор)')).not.toBeInTheDocument()
    // The team member's photo is drawn round, as the About page draws it.
    expect(card('Екип: Радина Иванова').querySelector('img')).toHaveClass('adm-hp-img--round')

    await userEvent.clear(input)
    await userEvent.type(input, 'Нашият екип')
    input.blur()
    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/about-hero/alt'))
      expect(post).toBeTruthy()
      expect(JSON.parse(post.body)).toEqual({ alt: 'Нашият екип' })
    })
  })

  it('lists the three product pages in their own group, each saying what it shows while empty', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    // The three main photos in one row; the steel page's five steps in a row of their own.
    const products = section('Продуктови страници')
    const mainRow = products.querySelector('[data-row="main"]')
    expect([...mainRow.querySelectorAll('li[data-slot]')].map((li) => li.dataset.slot)).toEqual(['page-modular-builds', 'page-modular-houses', 'page-steel-houses'])
    expect(within(products).getAllByRole('listitem')).toHaveLength(8)
    expect(within(card('Контейнерни модули')).getByText('Празно: контейнер, доставен на парцела на клиент.')).toBeInTheDocument()
    expect(within(card('Модулни къщи')).getByText(/Паралия Кариани \(58 м²\)/)).toBeInTheDocument()
    expect(within(card('Сглобяеми къщи по проект')).getByText('Празно: страницата е без снимка.')).toBeInTheDocument()
    expect(within(card('Доставка и монтаж')).getByText('Празно: кран вдига модул от камиона.')).toBeInTheDocument()
    expect(within(card('Партньори — снимка')).getByText('Празно: кран вдига модул от камиона (снимката на доставката).')).toBeInTheDocument()
  })

  it('jumps to a page section from the row of page buttons', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const nav = screen.getByRole('navigation', { name: 'Страници' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Интериорни врати' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(section('Интериорни врати'))
    // The keyboard carries on from the section, not from the row of buttons.
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Интериорни врати' }))
  })

  it('shows a name the screen does not know under "Други", and a slot the server does not know yet as not usable', async () => {
    const withoutTile = NAMES.filter((n) => n !== 'home-tile-interiors')
    listAnswer = () => json({
      slots: [...withoutTile.map(emptySlot), emptySlot('steel-step-6')],
      names: [...withoutTile, 'steel-step-6'],
    })
    render(<AdminHomePhotosPage />)
    await ready()

    const other = section('Други')
    expect(within(other).getByText('steel-step-6', { selector: 'strong' })).toBeInTheDocument()

    const tile = card('Плочка „Вътрешни ремонти“')
    expect(within(tile).getByText(/Сървърът още не познава това място/)).toBeInTheDocument()
    expect(within(tile).getByRole('button', { name: 'Качи снимка — Плочка „Вътрешни ремонти“' })).toBeDisabled()
    expect(within(tile).getByRole('button', { name: /От галерията/ })).toBeDisabled()
  })

  it('shows the English words when the panel is in English', async () => {
    window.localStorage.setItem('nvc_admin_lang_v1', 'en')
    try {
      listAnswer = () => json(EMPTY)
      render(<AdminHomePhotosPage />)
      expect(await screen.findByRole('heading', { level: 2, name: 'Product pages' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Site photos' })).toBeInTheDocument()
      for (const name of ['page-modular-builds', 'about-hero', 'doors-hero', 'hero-5', 'about-team-radina-ivanova']) {
        expect(screen.getByText(label(name, 'en'), { selector: 'strong' })).toBeInTheDocument()
      }
      expect(within(card('Steel-frame prefab houses to your plan')).getByText('No photo')).toBeInTheDocument()
    } finally {
      window.localStorage.removeItem('nvc_admin_lang_v1')
    }
  })

  it('asks for sign-in rather than looking broken when the session has expired', async () => {
    listAnswer = () => json({}, 401)
    render(<AdminHomePhotosPage />)

    expect(await screen.findByRole('heading', { name: 'Необходим е вход' })).toBeInTheDocument()
  })
})

// 2026-10-17: the Partner steps, the Interiors pairs, the steel steps, and on every page's section
// the line saying where its other photos are changed.
describe('AdminHomePhotosPage — the steps, the pairs and the other photos', () => {
  const rowOf = (group, key) => section(PHOTO_SLOT_GROUP_HEADINGS[group].bg).querySelector(`[data-row="${key}"]`)
  const slotsIn = (el) => [...el.querySelectorAll('li[data-slot]')].map((li) => li.dataset.slot)
  // A list with only these slots filled.
  const withFilled = (...names) => ({ slots: NAMES.map((n) => (names.includes(n) ? filledSlot(n, '') : emptySlot(n))), names: NAMES })

  it('draws the steel steps and the Partner steps as rows of their own, under the headings the pages give them', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const steel = rowOf('products', 'steel-steps')
    expect(within(steel).getByRole('heading', { level: 3, name: 'Сглобяеми къщи по проект — стъпките „Как протича проектът“' })).toBeInTheDocument()
    expect(slotsIn(steel)).toEqual(['steel-step-1', 'steel-step-2', 'steel-step-3', 'steel-step-4', 'steel-step-5'])
    expect(within(steel).getByText(/Където няма ваша снимка, стои визуализация на една примерна къща/)).toBeInTheDocument()
    // Each says, while empty, that the page shows a render there.
    expect(within(card(label('steel-step-3'))).getByText('Празно: визуализация (не снимка) на примерната къща на този етап.')).toBeInTheDocument()

    const partner = rowOf('partner', 'partner-steps')
    expect(within(partner).getByRole('heading', { level: 3, name: 'Стъпките „Как работим“' })).toBeInTheDocument()
    expect(slotsIn(partner)).toEqual(['partner-step-yard', 'partner-step-port', 'partner-step-plot'])
    expect(card('Стъпка 4 · „Доставка“')).toBeInTheDocument()
    expect(within(card('Стъпка 1 · „Запитване“')).getByText(/„Нашата база в Марикостиново“ — снимката трябва да показва точно това място/)).toBeInTheDocument()
    // Step 2 has no card here: it is the factory photo, changed in About's section.
    expect(within(section('Партньори')).queryByText(/^Стъпка 2 · /, { selector: 'strong' })).not.toBeInTheDocument()
    expect(within(partner).getByText(/Стъпка 2 показва снимката на фабриката от „За нас“ и се сменя там/)).toBeInTheDocument()
    await userEvent.click(within(partner).getByRole('button', { name: 'Фабриката в Китай' }))
    expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(card('Фабриката в Китай'))
    expect(document.activeElement).toHaveAttribute('aria-label', 'Качи снимка — Фабриката в Китай')
  })

  it("shows each step's and each half's default: the page's picture, through the resizer where it is an /api/img one", async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const src = (text) => card(text).querySelector('img').getAttribute('src')
    expect(src('Стъпка 1 · „Запитване“')).toBe('/delivery/journey-yard.webp')
    expect(src(label('steel-step-3'))).toBe('/api/img/content/bvk4n834b-rw-eg-vb.jpg?w=320')
    expect(src('Баня — „Преди“')).toBe('/api/img/content/bvk4n834b-rc2-eg-vb.webp?w=320')
    expect(src('Кухня — „Готово“')).toBe('/interiors/kitchen-run-600.webp')
    for (const name of PHASE_2) expect(within(card(label(name))).getByText('По подразбиране'), name).toBeInTheDocument()
  })

  it('shows each pair as one row, its two halves together, with the rule and what the site shows now', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const bathroom = rowOf('interiors', 'pair-bathroom')
    const kitchen = rowOf('interiors', 'pair-kitchen')
    expect(bathroom).toHaveClass('adm-hp-pair')
    expect(slotsIn(bathroom)).toEqual(['interiors-bathroom-before', 'interiors-bathroom-after'])
    expect(slotsIn(kitchen)).toEqual(['interiors-kitchen-before', 'interiors-kitchen-after'])
    expect(within(bathroom).getByRole('heading', { level: 3, name: 'Преди и след — Баня' })).toBeInTheDocument()
    expect(within(kitchen).getByRole('heading', { level: 3, name: 'Преди и след — Кухня' })).toBeInTheDocument()
    for (const row of [bathroom, kitchen]) {
      expect(within(row).getByText('Показва се, когато и двете снимки са качени. Дотогава страницата показва двете снимки по подразбиране.')).toBeInTheDocument()
      expect(within(row).getByText('Сега на сайта: двете снимки по подразбиране.')).toBeInTheDocument()
    }
    // The three photos of phase 1 stay in the section's first row.
    expect(slotsIn(rowOf('interiors', 'main'))).toEqual(['interiors-hero', 'interiors-works', 'interiors-kitchen'])
  })

  it('says, for a pair with one half uploaded, that the site still shows the defaults, on the row and on the card', async () => {
    listAnswer = () => json(withFilled('interiors-bathroom-before', 'interiors-kitchen-before', 'interiors-kitchen-after'))
    render(<AdminHomePhotosPage />)
    await ready()

    const bathroom = rowOf('interiors', 'pair-bathroom')
    expect(within(bathroom).getByText('Качена е само „Баня — преди“ — на сайта още са двете снимки по подразбиране. Качете и „Баня — след“.')).toBeInTheDocument()
    expect(within(card('Баня — „Преди“')).getByText('Още не е на сайта: чака „Баня — след“.')).toBeInTheDocument()
    expect(within(card('Баня — „След“')).queryByText(/Още не е на сайта/)).not.toBeInTheDocument()
    // Both kitchen halves are in: the pair is live.
    const kitchen = rowOf('interiors', 'pair-kitchen')
    expect(within(kitchen).getByText('Сега на сайта: вашите две снимки.')).toBeInTheDocument()
    expect(within(kitchen).queryByText(/Още не е на сайта/)).not.toBeInTheDocument()
    // A filled half asks for its description; no half offers the gallery.
    expect(within(card('Баня — „Преди“')).getByLabelText('Описание на снимката (по избор)')).toBeInTheDocument()
    for (const name of Object.values(INTERIORS_PAIR_SLOTS).flatMap((p) => [p.before, p.after])) {
      expect(within(card(label(name))).queryByRole('button', { name: /От галерията/ }), name).not.toBeInTheDocument()
    }
  })

  it('tells the truth after a pair upload or removal: waiting for the other half, live, or no change', async () => {
    listAnswer = () => json(withFilled('interiors-kitchen-before', 'interiors-kitchen-after'))
    render(<AdminHomePhotosPage />)
    await ready()

    // The bathroom's "before" alone: saved, and shown once its "after" is in too.
    await userEvent.upload(fileInput('Баня — „Преди“'), new File(['RIFF'], 'b.webp', { type: 'image/webp' }))
    await waitFor(() => expect(posts()[0]?.url).toContain('/api/admin/home-photos/interiors-bathroom-before/file'))
    expect(await within(card('Баня — „Преди“')).findByText('Готово — снимката за „Баня — преди“ е запазена. На сайта ще се покаже, когато качите и „Баня — след“.')).toBeInTheDocument()

    // Removing a kitchen half while the other is in: the whole pair goes back.
    await userEvent.click(within(card('Кухня — „Готово“')).getByRole('button', { name: 'Върни снимката по подразбиране — Кухня — „Готово“' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'DELETE')?.url).toMatch(/\/interiors-kitchen-after$/))
    expect(await within(card('Кухня — „Готово“')).findByText('Снимката за „Кухня — готово“ е махната. До 2 минути и двете снимки на двойката на сайта се връщат към тези по подразбиране.')).toBeInTheDocument()
  })

  it('says nothing changes on the site when the only uploaded half of a pair is removed, and the usual words once both are in', async () => {
    listAnswer = () => json(withFilled('interiors-bathroom-before'))
    render(<AdminHomePhotosPage />)
    await ready()

    await userEvent.upload(fileInput('Баня — „След“'), new File(['RIFF'], 'a.webp', { type: 'image/webp' }))
    expect(await within(card('Баня — „След“')).findByText('Готово — снимката за „Баня — след“ е запазена. На сайта се вижда до 2 минути.')).toBeInTheDocument()

    await userEvent.click(within(card('Баня — „Преди“')).getByRole('button', { name: 'Върни снимката по подразбиране — Баня — „Преди“' }))
    expect(await within(card('Баня — „Преди“')).findByText('Снимката за „Баня — преди“ е махната. На сайта нищо не се променя: там и досега бяха снимките по подразбиране.')).toBeInTheDocument()
  })

  it('names a step in its notices by its page and number', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    await userEvent.upload(fileInput(label('steel-step-4')), new File(['RIFF'], 's.webp', { type: 'image/webp' }))
    await waitFor(() => expect(posts()[0]?.url).toContain('/api/admin/home-photos/steel-step-4/file'))
    expect(await within(card(label('steel-step-4'))).findByText('Готово — снимката за „Сглобяеми къщи, стъпка 4“ е запазена. На сайта се вижда до 2 минути.')).toBeInTheDocument()
  })

  it("says under every page's heading where its other photos are changed, linking the Gallery and Cases screens", async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const note = (group) => section(PHOTO_SLOT_GROUP_HEADINGS[group].bg).querySelector(`[data-note="${group}"]`)
    const links = (group) => within(note(group)).queryAllByRole('link').map((a) => `${a.textContent} ${a.getAttribute('href')}`)
    for (const group of PHOTO_SLOT_GROUPS) expect(note(group), group).not.toBeNull()

    expect(note('home')).toHaveTextContent('Снимките на страниците „Галерия“ и „Цени“ се сменят в Галерия, а тези на „Казуси и отзиви“ — в Проекти.')
    expect(links('home')).toEqual(['Галерия /admin/gallery', 'Проекти /admin/cases'])
    expect(note('products')).toHaveTextContent('Останалите снимки на моделите се сменят в Галерия; тези от къщата в Паралия Кариани са от проекта ѝ в Проекти и там могат само да се премахнат.')
    expect(links('products')).toEqual(['Галерия /admin/gallery', 'Проекти /admin/cases'])
    for (const group of ['delivery', 'partner', 'about']) {
      expect(note(group), group).toHaveTextContent('Снимката на къщата в Паралия Кариани е от проекта ѝ в Проекти — там може само да се премахне; друга на нейно място се слага при обновяване на сайта.')
      expect(links(group), group).toEqual(['Проекти /admin/cases'])
    }
    expect(note('interiors')).toHaveTextContent(/^Видеата на страницата не се сменят оттук/)
    expect(links('interiors')).toEqual([])
    expect(note('doors')).toHaveTextContent('Снимките и чертежите на вратите са от каталога NVC-1 и не се сменят оттук.')
    expect(links('doors')).toEqual([])
    // The note sits under the section's heading, before its first row.
    const products = section('Продуктови страници')
    expect(products.querySelector('h2').nextElementSibling).toBe(note('products'))
  })

  it('shows the new rows and notes in English when the panel is in English', async () => {
    window.localStorage.setItem('nvc_admin_lang_v1', 'en')
    try {
      listAnswer = () => json(withFilled('interiors-bathroom-after'))
      render(<AdminHomePhotosPage />)
      expect(await screen.findByRole('heading', { level: 3, name: 'Before and after — Bathroom' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3, name: 'The steps “How we work”' })).toBeInTheDocument()
      expect(screen.getByText('Bathroom — “Before”', { selector: 'strong' })).toBeInTheDocument()
      expect(screen.getByText('Only “Bathroom — after” is uploaded — the site still shows both default photos. Upload “Bathroom — before” too.')).toBeInTheDocument()
      expect(within(section('Product pages')).getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/admin/gallery')
      expect(within(section('Product pages')).getByRole('link', { name: 'Cases' })).toHaveAttribute('href', '/admin/cases')
    } finally {
      window.localStorage.removeItem('nvc_admin_lang_v1')
    }
  })
})
