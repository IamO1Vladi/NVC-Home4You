import { describe, it, expect } from 'vitest'
import { catFromItemCategory, resolveCatParam, resolveIndexFilter, resolvePageParam, slugify, FILTER_IDS, INDEX_FILTER_IDS, PAGE_SIZE, getCategoryLabels, formatGalleryPrice, htmlToText, blockText, offerAvailability, getCurrency } from './galleryUtils'
import elGallery from '../content/el/gallery.js'
import enGallery from '../content/en/gallery.js'
import bgGallery from '../content/bg/gallery.js'

// The gallery filter is the one place where bad category data fails silently: a house whose
// category resolves to nothing simply stops appearing under every filter, with no error
// anywhere. Nobody notices until a customer cannot find a model.
//
// The SQL migration changes what the API sends here — a stable key ("prefab") instead of the
// Bulgarian display label Quickbase stored ("Сглобяема къща"). These tests pin both forms
// working, so the cutover cannot break the page and the labels stay presentation-only.
describe('gallery category filtering', () => {
  describe('stable keys (what the SQL read path sends)', () => {
    it.each(FILTER_IDS)('maps the key %s to itself', (id) => {
      expect(catFromItemCategory(id)).toEqual([id])
    })

    it('accepts a key regardless of casing or padding', () => {
      expect(catFromItemCategory('  Prefab  ')).toEqual(['prefab'])
    })
  })

  describe('Bulgarian labels (what Quickbase sends today)', () => {
    // Must keep working: these are live until DATA_SOURCE_GALLERY flips, and must keep
    // working after a rollback too.
    it.each([
      ['Сглобяема къща', 'prefab'],
      ['Фургон', 'wagon'],
      ['Модулна къща', 'modular'],
      ['Гараж', 'garage'],
    ])('maps %s to %s', (label, expected) => {
      expect(catFromItemCategory(label)).toEqual([expected])
    })
  })

  describe('English labels', () => {
    it.each([
      ['Prefab house', 'prefab'],
      ['Wagon / site cabin', 'wagon'],
      ['Modular house', 'modular'],
      ['Garage', 'garage'],
    ])('maps %s to %s', (label, expected) => {
      expect(catFromItemCategory(label)).toEqual([expected])
    })
  })

  it('yields no codes for an unrecognised category', () => {
    // This is the silent failure the stable key exists to prevent: the house renders, but
    // belongs to no filter. Pinned so the behaviour is at least known and deliberate.
    expect(catFromItemCategory('Something else')).toEqual([])
    expect(catFromItemCategory('')).toEqual([])
    expect(catFromItemCategory(null)).toEqual([])
  })

  it('handles a house in several categories', () => {
    expect(catFromItemCategory('prefab, garage')).toEqual(['prefab', 'garage'])
    expect(catFromItemCategory(['Фургон', 'modular'])).toEqual(['wagon', 'modular'])
  })

  it('does not double-count a category repeated in both forms', () => {
    // A half-migrated row could carry the key and the label at once.
    expect(catFromItemCategory('prefab, Сглобяема къща')).toEqual(['prefab'])
  })

  describe('the ?cat= URL parameter', () => {
    it.each(FILTER_IDS)('accepts the stable key %s', (id) => {
      expect(resolveCatParam(id)).toBe(id)
    })

    it('still accepts a label, so existing shared links keep working', () => {
      expect(resolveCatParam('Гараж')).toBe('garage')
      expect(resolveCatParam('Modular house')).toBe('modular')
    })

    it('falls back to all for anything unknown or empty', () => {
      expect(resolveCatParam('nonsense')).toBe('all')
      expect(resolveCatParam('')).toBe('all')
      expect(resolveCatParam(undefined)).toBe('all')
    })
  })

  // The index offers two of the four (the owner, 2026-10-17: "Сглобяема къща" and "Гараж" always
  // opened empty). The other two still resolve above, for the item page and the admin.
  describe('the filters the index offers', () => {
    it('are the two product lines, containers first', () => {
      expect(INDEX_FILTER_IDS).toEqual(['wagon', 'modular'])
      for (const id of INDEX_FILTER_IDS) expect(FILTER_IDS).toContain(id)
    })

    it('take a ?cat= of theirs, by key or by an old label', () => {
      expect(resolveIndexFilter('wagon')).toBe('wagon')
      expect(resolveIndexFilter('Модулна къща')).toBe('modular')
      expect(resolveIndexFilter('Wagon / site cabin')).toBe('wagon')
    })

    it('show all for a category they no longer offer, or anything unknown', () => {
      for (const v of ['prefab', 'garage', 'Гараж', 'Сглобяема къща', 'Garage', 'nonsense', '', undefined, null]) {
        expect(resolveIndexFilter(v)).toBe('all')
      }
    })

    it('have a label in every locale', () => {
      for (const content of [elGallery, enGallery, bgGallery]) {
        expect(Object.keys(content.filters.shown)).toEqual(INDEX_FILTER_IDS)
        for (const id of INDEX_FILTER_IDS) expect(content.filters.shown[id]).toBeTruthy()
      }
    })
  })

  describe('the index page number', () => {
    it('holds every model on one page up to 24', () => {
      expect(PAGE_SIZE).toBe(24)
    })

    it('reads ?page= and keeps it inside the pages there are', () => {
      expect(resolvePageParam('2', 3)).toBe(2)
      expect(resolvePageParam('9', 3)).toBe(3)
      expect(resolvePageParam('0', 3)).toBe(1)
      expect(resolvePageParam('-4', 3)).toBe(1)
      expect(resolvePageParam('abc', 3)).toBe(1)
      expect(resolvePageParam(null, 1)).toBe(1)
      expect(resolvePageParam('2', 0)).toBe(1)
    })
  })

  it('the filter ids match the keys the API will send', () => {
    // Guards the contract from the other side: if someone adds a filter here without adding
    // the key to HouseCategories (or vice versa), this is where it surfaces.
    expect(FILTER_IDS).toEqual(['prefab', 'wagon', 'modular', 'garage'])
  })
})

// The other half of a coupling that had no test on this side.
//
// GallerySlugs.cs in api-dotnet carries the same rule, and its comment says the two must stay
// byte-identical — the sitemap and the per-product SEO tags are generated from the C# copy
// while this one is what the SPA router matches against, so a drift means every product page
// 404s while the sitemap keeps advertising it. Until now that was asserted only by a comment
// and a C# test claiming to mirror a file it cannot see.
//
// EVERY EXPECTATION BELOW IS DUPLICATED VERBATIM in GallerySeoTests.cs. That duplication is
// the mechanism: identical inputs and identical expected strings in both suites means a
// change to either implementation alone turns one of them red.
describe('slugify — parity with GallerySlugs.Slugify in api-dotnet', () => {
  it.each([
    ['Container House – 6000mm*3000mm', 'container-house-6000mm-3000mm'],
    ['  Spaced   Out  ', 'spaced-out'],
    ['Nova 60', 'nova-60'],
    ['', 'model'],
    ['!!!', 'model'],
  ])('slugifies %j', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('strips quotes rather than turning them into separators', () => {
    expect(slugify('John’s Cabin')).toBe('johns-cabin')
  })

  // NFKC, not NFKD (changed 2026-08-17). NFKD decomposed an accented character into a base
  // letter plus a combining mark, and the non-alphanumeric pass turned that mark into a
  // hyphen — splitting the keyword in half in every Bulgarian and Greek slug.
  it.each([
    ['Контейнерна къща', 'контейнерна-къща'],
    ['Панорамен офис контейнер', 'панорамен-офис-контейнер'],
    ['Σπίτι τύπου Container', 'σπίτι-τύπου-container'],
    ['Αναπτυσσόμενη κατοικία', 'αναπτυσσόμενη-κατοικία'],
    ['Διώροφη κατοικία', 'διώροφη-κατοικία'],
  ])('keeps the accented letters in %j', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  // The compatibility folding is the part NFKC KEEPS — "m²" still becomes "m2". Every
  // "…-37-m2" slug depends on it, and these are the URLs that did NOT move.
  it.each([
    ['Expandable House – 37 m²', 'expandable-house-37-m2'],
    ['Two-storey expandable house - 74m²', 'two-storey-expandable-house-74m2'],
    ['Жилищен фургон 6000мм 3000мм', 'жилищен-фургон-6000мм-3000мм'],
  ])('still folds compatibility characters in %j', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  // There is deliberately no legacy slugify in the browser: stale URLs are 301'd server-side
  // before the SPA boots, and the SPA only ever builds links from current slugs. This pins
  // the consequence — the old broken form must NOT be what this produces.
  it('no longer produces the old hyphen-split form', () => {
    expect(slugify('Контейнерна къща')).not.toBe('контеи-нерна-къща')
    expect(slugify('Σπίτι τύπου Container')).not.toBe('σπι-τι-τυ-που-container')
  })
})

// The category kicker and the Product JSON-LD used to print the API's key as it came, so
// every product page — in every language — said "MODULAR" (Greek audit, #11).
describe('category labels', () => {
  const el = elGallery.filters.categories

  it("names a key with the page locale's filter label", () => {
    expect(getCategoryLabels('modular', el)).toEqual(['Δομικό σπίτι'])
    expect(getCategoryLabels('wagon', el)).toEqual(['Βαγονέτο / Καμπίνα εργοταξίου'])
    expect(getCategoryLabels('modular', enGallery.filters.categories)).toEqual(['Modular house'])
    expect(getCategoryLabels('modular', bgGallery.filters.categories)).toEqual(['Модулна къща'])
  })

  it('names a stored label in the page language too', () => {
    // The Quickbase read path sends the Bulgarian label rather than the key.
    expect(getCategoryLabels('Модулна къща', el)).toEqual(['Δομικό σπίτι'])
  })

  it('has a label for every filter id in every locale', () => {
    for (const content of [elGallery, enGallery, bgGallery]) {
      for (const id of FILTER_IDS) expect(content.filters.categories[id]).toBeTruthy()
    }
  })

  it('yields nothing rather than the raw value when nothing resolves', () => {
    expect(getCategoryLabels('MODULAR-XL', el)).toEqual([])
    expect(getCategoryLabels('modular', undefined)).toEqual([])
    expect(getCategoryLabels(null, el)).toEqual([])
  })
})

// toLocaleString() with no locale used the browser's format, and the prerender runs in an
// English one: /el shipped "€14,840", which a Greek reader can take for 14.84 euros.
describe('formatGalleryPrice', () => {
  // Intl separates with no-break spaces; compare on plain ones.
  const plain = (s) => s.replace(/\s/g, ' ')

  it('formats a Greek price the Greek way', () => {
    expect(plain(formatGalleryPrice(14840, 'EUR', 'el'))).toBe('14.840 €')
  })

  it('keeps English exactly as the page printed it before', () => {
    expect(formatGalleryPrice(14840, 'EUR', 'en')).toBe('€14,840')
    expect(formatGalleryPrice(14840.5, 'EUR', 'en')).toBe('€14,840.5')
    expect(formatGalleryPrice(14840, 'BGN', 'en')).toBe('14,840 BGN')
  })

  it('formats Bulgarian as bg-BG, like the rest of the Bulgarian site', () => {
    expect(plain(formatGalleryPrice(14840, 'EUR', 'bg'))).toBe('14 840 €')
  })
})

// The gallery's rich text as the admin editor writes it (one live item's opening, 2026-10-16).
// textContent alone glued it into "ОписаниеЦената включва сглобяване и ДДСРазмери: 6 × 3 м", and
// that is what the gallery cards, the item pages' meta descriptions and their Product markup
// published.
const RICH = '<p><strong>Описание</strong></p><p>Цената включва сглобяване и ДДС<br><br><strong>Размери:</strong> 6 × 3 м</p><h3>Спецификации</h3><p>Душ трей</p>'

describe('the rich text as plain text', () => {
  it('htmlToText keeps a space between blocks', () => {
    expect(htmlToText(RICH)).toBe('Описание Цената включва сглобяване и ДДС Размери: 6 × 3 м Спецификации Душ трей')
  })

  it('blockText reads it as sentences', () => {
    expect(blockText(RICH)).toBe('Описание. Цената включва сглобяване и ДДС. Размери: 6 × 3 м. Спецификации. Душ трей')
  })

  it('leaves inline markup inside a block alone', () => {
    expect(htmlToText('<p>A <strong>steel</strong> frame</p>')).toBe('A steel frame')
    expect(htmlToText('')).toBe('')
  })
})

describe('the offer a model publishes', () => {
  // The owner: the six gallery containers are stock models (2026-10-12); a Box house takes up to
  // 40 days to make and about 3–4 months to reach the buyer (2026-10-15). Every offer used to say
  // InStock.
  it('a container is in stock, a Box house (and the capsule, filed with them) made to order', () => {
    expect(offerAvailability({ category: 'wagon' })).toBe('https://schema.org/InStock')
    expect(offerAvailability({ category: 'modular' })).toBe('https://schema.org/MadeToOrder')
    expect(offerAvailability({ category: 'Модулна къща' })).toBe('https://schema.org/MadeToOrder')
  })

  it('is priced in euro when the API names no currency, in every language', () => {
    for (const locale of ['bg', 'en', 'el']) expect(getCurrency({ price: 4300 }, locale)).toBe('EUR')
    expect(getCurrency({ currency: 'EUR' }, 'bg')).toBe('EUR')
  })
})
