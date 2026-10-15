import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CONFIG_PREFILL_KEY, enquiryPrefill, readConfiguratorPrefill, writeConfiguratorPrefill } from './configPrefill.js'

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

describe('enquiryPrefill', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('carries a page\'s own lead source when nothing is saved for the page', () => {
    expect(enquiryPrefill('/bg/za-nas', { source: 'about-page' })).toEqual({ source: 'about-page' })
  })

  it('treats a click event, nothing, or a blank source as no source', () => {
    expect(enquiryPrefill('/bg/za-nas', { nativeEvent: {}, target: {}, source: 'x' })).toBeNull()
    expect(enquiryPrefill('/bg/za-nas', { target: {} })).toBeNull()
    expect(enquiryPrefill('/bg/za-nas')).toBeNull()
    expect(enquiryPrefill('/bg/za-nas', { source: '  ' })).toBeNull()
    expect(enquiryPrefill('/bg/za-nas', { source: 7 })).toBeNull()
  })

  it('keeps the configurator\'s saved prefill over a passed source', () => {
    writeConfiguratorPrefill(sample)
    expect(enquiryPrefill(CONFIG_PATH, { source: 'about-page' })).toEqual(sample)
  })
})
