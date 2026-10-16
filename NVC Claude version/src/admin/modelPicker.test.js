import { describe, expect, it } from 'vitest'
import { WITH_GALLERY_MODELS_FALLBACK, modelsFor, resolveModel } from './modelPicker.js'

// The leads and customer sheets fall back to this list when /api/admin/customers/categories has
// not answered. It must be the server's (PurchaseCategories.WithGalleryModels in api-dotnet):
// since 2026-10-17 the capsule has its own gallery category, and prefab holds the steel-frame
// projects already built, so both can be linked to a gallery model. Garage cannot.

const HOUSES = [
  { id: 13, title: 'Container House – 6000mm*3000mm', categoryKey: 'wagon' },
  { id: 10, title: 'Expandable House – 37 m²', categoryKey: 'modular' },
  { id: 100015, title: 'Space house', categoryKey: 'capsule' },
  { id: 100020, title: 'Steel-frame house – Bansko', categoryKey: 'prefab' },
]

describe('the gallery categories a sale or a lead can link a model in', () => {
  it('are the server\'s, in its order', () => {
    expect(WITH_GALLERY_MODELS_FALLBACK).toEqual(['wagon', 'modular', 'capsule', 'prefab'])
    expect(WITH_GALLERY_MODELS_FALLBACK).not.toContain('garage')
  })

  it('suggest the capsule under capsule and a steel-frame project under prefab', () => {
    expect(modelsFor(HOUSES, 'capsule', WITH_GALLERY_MODELS_FALLBACK).map((h) => h.id)).toEqual([100015])
    expect(modelsFor(HOUSES, 'prefab', WITH_GALLERY_MODELS_FALLBACK).map((h) => h.id)).toEqual([100020])
    expect(modelsFor(HOUSES, 'garage', WITH_GALLERY_MODELS_FALLBACK)).toEqual([])
  })

  it('link the capsule by its title under its own category', () => {
    expect(resolveModel('Space house', 'capsule', HOUSES)).toEqual({ modelText: 'Space house', houseId: 100015, customModel: '' })
  })
})
