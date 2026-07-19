import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CONFIG_PREFILL_KEY, readConfiguratorPrefill, writeConfiguratorPrefill } from './configPrefill.js'

const CONFIG_PATH = '/bg/konfigurator-box-kyshti'

const sample = {
  source: 'box-configurator',
  sourcePath: CONFIG_PATH,
  modelId: '37',
  offerText: 'Box house configuration\nModel: 37 m2',
  questionText: 'Question about the following configuration:\nModel: 37 m2',
  updatedAt: 1234567890,
}

describe('configPrefill', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('round-trips the prefill when the pathname matches', () => {
    writeConfiguratorPrefill(sample)
    const read = readConfiguratorPrefill(CONFIG_PATH)
    expect(read).toEqual(sample)
    expect(read.offerText).toContain('Model: 37 m2')
  })

  it('returns null when the modal opens on a different page', () => {
    writeConfiguratorPrefill(sample)
    expect(readConfiguratorPrefill('/bg/')).toBeNull()
    expect(readConfiguratorPrefill('/en/box-house-configurator')).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(readConfiguratorPrefill(CONFIG_PATH)).toBeNull()
  })

  it('returns null on corrupted stored JSON', () => {
    window.sessionStorage.setItem(CONFIG_PREFILL_KEY, '{not json')
    expect(readConfiguratorPrefill(CONFIG_PATH)).toBeNull()
  })

  it('does not throw when sessionStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => writeConfiguratorPrefill(sample)).not.toThrow()
    spy.mockRestore()
  })
})
