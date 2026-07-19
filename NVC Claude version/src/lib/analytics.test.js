import { describe, it, expect, beforeEach } from 'vitest'
import { trackEvent } from './analytics.js'

describe('trackEvent', () => {
  beforeEach(() => {
    delete window.dataLayer
  })

  it('creates the dataLayer when missing and pushes the event', () => {
    trackEvent('configurator_start', { model_label: '37 m²' })
    expect(window.dataLayer).toHaveLength(1)
    expect(window.dataLayer[0]).toEqual({ event: 'configurator_start', model_label: '37 m²' })
  })

  it('appends to an existing dataLayer', () => {
    window.dataLayer = [{ event: 'page_view' }]
    trackEvent('configurator_step', { step_index: 2, step_key: 'layout' })
    expect(window.dataLayer).toHaveLength(2)
    expect(window.dataLayer[1].step_key).toBe('layout')
  })

  it('works without params', () => {
    trackEvent('configurator_pdf_export')
    expect(window.dataLayer[0]).toEqual({ event: 'configurator_pdf_export' })
  })
})
