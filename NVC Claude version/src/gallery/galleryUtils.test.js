import { describe, it, expect } from 'vitest'
import { catFromItemCategory, resolveCatParam, FILTER_IDS } from './galleryUtils'

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
