import { describe, it, expect } from 'vitest'
import { compareCataloguePrices } from './catalogueCompare.js'

const item = (id, price) => ({ id, price })

describe('compareCataloguePrices', () => {
  it('passes when every shared id has the same price', () => {
    const result = compareCataloguePrices([item(4, 25500), item(9, 26500)], [item(4, 25500), item(9, 26500)])

    expect(result).toEqual({ differences: [], ambiguous: [], compared: 2, localCount: 2 })
  })

  it('reports a price that differs, which is what the check is for', () => {
    // 2026-08-15: a dev machine reading Quickbase said 25,500 where live SQL said 26,500.
    const result = compareCataloguePrices([item(9, 25500)], [item(9, 26500)])

    expect(result.differences).toEqual([{ id: '9', local: 25500, live: 26500 }])
  })

  it('compares nothing for an id only one side has', () => {
    const result = compareCataloguePrices([item(4, 1), item(100016, 9)], [item(4, 1), item(17, 9)])

    expect(result.differences).toEqual([])
    expect(result.compared).toBe(1)
  })

  it('sets aside an id live serves twice instead of comparing an arbitrary copy (#35)', () => {
    // The first release after #35: local serves the Space house as 100015, live still
    // serves it and the 73 m² house both as 15, the Space house last.
    const local = [item(9, 26500), item(15, 28000), item(100015, 55000)]
    const live = [item(9, 26500), item(15, 28000), item(15, 55000)]

    const result = compareCataloguePrices(local, live)

    expect(result.differences).toEqual([])
    expect(result.ambiguous).toEqual(['15'])
    expect(result.compared).toBe(1)
  })

  it('sets aside an id the local catalogue serves twice as well', () => {
    const result = compareCataloguePrices([item(15, 28000), item(15, 55000)], [item(15, 28000)])

    expect(result.differences).toEqual([])
    expect(result.ambiguous).toEqual(['15'])
  })

  it('still catches a real difference next to a set-aside id', () => {
    const local = [item(9, 25500), item(15, 28000), item(100015, 55000)]
    const live = [item(9, 26500), item(15, 28000), item(15, 55000)]

    expect(compareCataloguePrices(local, live).differences).toEqual([{ id: '9', local: 25500, live: 26500 }])
  })

  it('counts an empty local catalogue so the caller can refuse it', () => {
    expect(compareCataloguePrices([], [item(4, 1)]).localCount).toBe(0)
    expect(compareCataloguePrices(undefined, undefined).localCount).toBe(0)
  })
})
