import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CONFIG_SAVE_KEY,
  CONFIG_SAVE_TTL_MS,
  saveConfig,
  loadSavedConfig,
  clearSavedConfig,
} from './configPersistence.js'

const sampleConfig = {
  model: '37',
  variant: 'standard',
  windows: [{ x: 0.5, y: 0.5 }],
  kitchenExtras: { furnace: true, washingMachine: false },
}

describe('configPersistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('round-trips the saved config and step index', () => {
    saveConfig(sampleConfig, 3)
    const saved = loadSavedConfig()
    expect(saved.config).toEqual(sampleConfig)
    expect(saved.stepIndex).toBe(3)
    expect(typeof saved.updatedAt).toBe('number')
  })

  it('defaults a non-integer step index to 0', () => {
    saveConfig(sampleConfig, undefined)
    expect(loadSavedConfig().stepIndex).toBe(0)
  })

  it('returns null when nothing is stored', () => {
    expect(loadSavedConfig()).toBeNull()
  })

  it('returns null on corrupted stored JSON', () => {
    window.localStorage.setItem(CONFIG_SAVE_KEY, '{not json')
    expect(loadSavedConfig()).toBeNull()
  })

  it('returns null when the stored config is not an object', () => {
    window.localStorage.setItem(
      CONFIG_SAVE_KEY,
      JSON.stringify({ config: 'nope', stepIndex: 0, updatedAt: Date.now() })
    )
    expect(loadSavedConfig()).toBeNull()
  })

  it('ignores a saved config older than the TTL', () => {
    const stale = {
      config: sampleConfig,
      stepIndex: 2,
      updatedAt: Date.now() - CONFIG_SAVE_TTL_MS - 1000,
    }
    window.localStorage.setItem(CONFIG_SAVE_KEY, JSON.stringify(stale))
    expect(loadSavedConfig()).toBeNull()
  })

  it('clears the saved config', () => {
    saveConfig(sampleConfig, 1)
    clearSavedConfig()
    expect(loadSavedConfig()).toBeNull()
  })

  it('does not throw when localStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => saveConfig(sampleConfig, 0)).not.toThrow()
    spy.mockRestore()
  })
})
