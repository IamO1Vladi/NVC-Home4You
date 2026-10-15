import { describe, expect, it } from 'vitest'
import {
  BASE_STAGE_COUNT,
  ROOF_STAGE_COUNT,
  UNFOLD_MODEL_KEYS,
  captionValues,
  createUnfoldPlayer,
  fillText,
  lastT,
  poseAt,
  stageIndex,
  unfoldDims,
  unfoldGeometry,
} from './unfoldModel.js'
import { UNFOLD_CONTENT, unfoldText } from './unfoldContent.js'
import { getBoxConfiguratorCatalog } from '../../content/shared/boxConfiguratorCatalog.js'

describe('unfoldDims', () => {
  it('reads every size from the configurator catalogue', () => {
    const { models } = getBoxConfiguratorCatalog('en')
    for (const key of UNFOLD_MODEL_KEYS) {
      const model = models.find((m) => m.key === key)
      const [l, w, h] = model.dimensionsOpen.split('x').map((v) => Number(v) / 1000)
      const dims = unfoldDims(key)
      expect([dims.length, dims.width, dims.height]).toEqual([l, w, h])
      expect(dims.foldedWidth).toBe(Number(model.dimensionsFolded.split('x')[1]) / 1000)
      expect(dims.area).toBe(model.area)
    }
  })

  it('gives the three Box houses their catalogue lengths', () => {
    expect(UNFOLD_MODEL_KEYS.map((k) => unfoldDims(k).length)).toEqual([5.9, 9, 11.8])
    expect(unfoldDims('37').width).toBe(6.26)
  })

  it('takes the standard short-side deck for the veranda', () => {
    const { terrace } = unfoldDims('58')
    expect(terrace.depth).toBe(2)
    expect(terrace.widthMm).toBe(6230)
  })
})

describe('unfoldGeometry', () => {
  for (const key of UNFOLD_MODEL_KEYS) {
    it(`folds the ${key} m² house without any panel cutting another`, () => {
      const g = unfoldGeometry(unfoldDims(key))
      for (const check of g.checks) expect(check, check.name).toMatchObject({ ok: true })
    })

    it(`folds the ${key} m² house to the catalogue's transport width and opens to its full width`, () => {
      const dims = unfoldDims(key)
      const g = unfoldGeometry(dims)
      expect(2 * g.Zh).toBeCloseTo(dims.foldedWidth, 9)
      expect(2 * (g.Pz + g.Wf + g.tw / 2)).toBeCloseTo(dims.width, 9)
    })
  }

  it('stands the veranda posts on the deck and under the eaves beam', () => {
    const g = unfoldGeometry(unfoldDims('37'))
    expect(g.roofFrame.postX).toBeGreaterThan(g.deck.x0)
    expect(g.roofFrame.postX + g.roofFrame.postSize / 2).toBeLessThanOrEqual(g.deck.x1)
    expect(g.roofFrame.postZ[0] + g.roofFrame.postSize / 2).toBeLessThanOrEqual(g.deck.halfWidth)
    // the roof panels rest on the beams at the wall line and rise to the ridge
    expect(g.roofFrame.eaveY).toBeGreaterThan(g.H)
    expect(g.roofFrame.ridgeUnder).toBeGreaterThan(g.roofFrame.eaveY)
  })
})

describe('poseAt', () => {
  it('is the folded box at 0, the finished house at 5 and the roofed house at 7', () => {
    expect(Object.values(poseAt(0)).every((v) => v === 0)).toBe(true)
    const done = poseAt(5)
    expect([done.roof, done.floor, done.wall, done.end, done.finish]).toEqual([1, 1, 1, 1, 1])
    // the standard terrace (and its step) is in the base price, so the finished house has it
    expect([done.deck, done.stepIn]).toEqual([1, 1])
    expect([done.roofFrame, done.rail, done.figure]).toEqual([0, 0, 0])
    expect(Object.values(poseAt(7)).every((v) => v === 1)).toBe(true)
  })

  it('unfolds in order: roof, floor, walls, ends', () => {
    for (let t = 0; t <= 5; t += 0.01) {
      const p = poseAt(t)
      if (p.floor > 0) expect(p.roof).toBe(1)
      if (p.wall > 0) expect(p.floor).toBe(1)
      if (p.end > 0) expect(p.wall).toBe(1)
    }
  })

  it('never lets one part of the veranda pass through another', () => {
    const { roofFrame, Y0 } = unfoldGeometry(unfoldDims('37'))
    for (let t = 4; t <= 7; t += 0.002) {
      const p = poseAt(t)
      if (p.deck > 0) expect(p.finish).toBe(1) // the deck slides out of the finished house
      if (p.rail > 0) expect(p.deck).toBe(1) // railings stand on a finished deck
      if (p.stepIn > 0) expect(p.deck).toBe(1)
      // the person is out of the way before the posts come anywhere near head height
      if (p.figure < 1) expect(Y0 + (1 - p.roofFrame) * roofFrame.drop).toBeGreaterThan(1.8)
    }
  })
})

describe('stageIndex', () => {
  it('counts a stage from the moment its motion begins', () => {
    expect(stageIndex(0)).toBe(0)
    expect(stageIndex(0.04)).toBe(0)
    expect(stageIndex(0.3)).toBe(1)
    expect(stageIndex(lastT('base'), BASE_STAGE_COUNT)).toBe(BASE_STAGE_COUNT - 1)
    expect(stageIndex(lastT('roof'), ROOF_STAGE_COUNT)).toBe(ROOF_STAGE_COUNT - 1)
    // the base timeline never reports a roof stage
    expect(stageIndex(6.5, BASE_STAGE_COUNT)).toBe(BASE_STAGE_COUNT - 1)
  })
})

describe('captions', () => {
  it('fills the catalogue numbers in the visitor\'s notation', () => {
    const bg = captionValues(unfoldDims('37'), 'bg')
    expect(bg).toMatchObject({
      area: '37',
      length: '5,90',
      width: '6,26',
      foldedWidth: '2,26',
      terrace: '6230\u00a0×\u00a02000',
      // the roof-and-veranda house's veranda: the open width by the deck's depth
      veranda: '6260\u00a0×\u00a02000',
    })
    expect(captionValues(unfoldDims('73'), 'en')).toMatchObject({ length: '11.80', width: '6.26' })
    expect(fillText('{area} m² · {missing}', { area: '58' })).toBe('58 m² · {missing}')
  })

  it('has every stage in all three languages', () => {
    for (const locale of ['bg', 'en', 'el']) {
      const text = UNFOLD_CONTENT[locale]
      expect(text.stages).toHaveLength(ROOF_STAGE_COUNT)
      for (const stage of text.stages) {
        expect(stage.label.trim()).not.toBe('')
        expect(stage.note.trim()).not.toBe('')
      }
      expect(Object.keys(text).sort()).toEqual(Object.keys(UNFOLD_CONTENT.bg).sort())
    }
  })

  it('does not promise connecting power or water on the finished house', () => {
    for (const locale of ['bg', 'en', 'el']) {
      const finished = UNFOLD_CONTENT[locale].stages[BASE_STAGE_COUNT - 1]
      expect(`${finished.label} ${finished.note}`).not.toMatch(/ток|вода|изводи|power|water|electric|ρεύμα|νερ|ηλεκτρ/i)
    }
  })

  it('types no price into the copy', () => {
    const all = JSON.stringify(UNFOLD_CONTENT)
    expect(all).not.toMatch(/€|EUR|лв/)
  })

  it('lets the page override single strings and stages', () => {
    const text = unfoldText('en', { eyebrow: 'Unfolding', stages: [{ label: 'On the truck' }] })
    expect(text.eyebrow).toBe('Unfolding')
    expect(text.stages[0]).toEqual({ label: 'On the truck', note: UNFOLD_CONTENT.en.stages[0].note })
    expect(text.stages[1]).toEqual(UNFOLD_CONTENT.en.stages[1])
    expect(text.variants).toEqual(UNFOLD_CONTENT.en.variants)
  })
})

describe('createUnfoldPlayer', () => {
  // A hand-cranked clock: each crank() runs the queued frame 100 ms later.
  function rig(options = {}) {
    let queued = null
    let time = 0
    const frames = []
    const states = []
    const player = createUnfoldPlayer({
      secondsPerStage: 1,
      requestFrame: (cb) => { queued = cb; return 1 },
      cancelFrame: () => { queued = null },
      now: () => time,
      onFrame: (T) => frames.push(T),
      onState: (s) => states.push(s),
      ...options,
    })
    const crank = (n = 1) => {
      for (let i = 0; i < n && queued; i++) { const cb = queued; queued = null; time += 100; cb(time) }
    }
    return { player, crank, frames, states, pending: () => !!queued }
  }

  it('starts where it is told and plays to the end, then stops asking for frames', () => {
    const { player, crank, pending } = rig({ initialT: 5, maxT: 5 })
    expect(player.T).toBe(5)
    player.play() // at the end: from the start
    expect(player.T).toBe(0)
    crank(200)
    expect(player.T).toBe(5)
    expect(player.playing).toBe(false)
    expect(pending()).toBe(false)
  })

  it('waits out a hold before moving', () => {
    const { player, crank } = rig()
    player.play(0.5)
    crank(4)
    expect(player.T).toBe(0)
    crank(10)
    expect(player.T).toBeGreaterThan(0)
  })

  it('pauses, seeks and glides', () => {
    const { player, crank } = rig({ maxT: 5 })
    player.play()
    crank(12)
    player.pause()
    const at = player.T
    crank(5)
    expect(player.T).toBe(at)
    player.seek(3)
    expect(player.T).toBe(3)
    player.goTo(1)
    crank(100)
    expect(player.T).toBeCloseTo(1, 6)
  })

  it('jumps instead of gliding for reduced motion', () => {
    const { player } = rig({ maxT: 5, reducedMotion: true })
    player.goTo(2)
    expect(player.T).toBe(2)
  })

  it('plays on into the roof stages, and glides back when they are taken away', () => {
    const { player, crank } = rig({ maxT: 5, initialT: 5 })
    player.playTo(7)
    crank(100)
    expect(player.T).toBe(7)
    player.setMax(5)
    crank(100)
    expect(player.T).toBeCloseTo(5, 6)
  })

  it('asks for no frames while suspended and picks up again', () => {
    const { player, crank, pending } = rig({ maxT: 5 })
    player.play()
    player.setSuspended(true)
    expect(pending()).toBe(false)
    player.setSuspended(false)
    expect(pending()).toBe(true)
    crank(3)
    expect(player.T).toBeGreaterThan(0)
    player.dispose()
    expect(pending()).toBe(false)
  })
})
