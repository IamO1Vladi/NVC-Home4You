import { describe, it, expect } from 'vitest'
import { catFromItemCategory, resolveCatParam, slugify, FILTER_IDS } from './galleryUtils'

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
