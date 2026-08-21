import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { brochureUrl } from './brochure.js'

import bgInteriors from '../content/bg/interiors.js'
import elInteriors from '../content/el/interiors.js'
import enInteriors from '../content/en/interiors.js'
import bgModularBuilds from '../content/bg/modularBuilds.js'
import elModularBuilds from '../content/el/modularBuilds.js'
import enModularBuilds from '../content/en/modularBuilds.js'
import bgModularHouses from '../content/bg/modularHouses.js'
import elModularHouses from '../content/el/modularHouses.js'
import enModularHouses from '../content/en/modularHouses.js'
import bgSteelHouses from '../content/bg/steelHouses.js'
import elSteelHouses from '../content/el/steelHouses.js'
import enSteelHouses from '../content/en/steelHouses.js'

// Guards the six product brochures — 22.7 MB of PDF that four pages in three languages link.
//
// Nothing here is about rendering. It is about the brochures being FINDABLE: named as data in
// the content files, spelled one way, and reachable through one helper. Before this file
// existed two of the six were hard-coded hrefs in ModularHousesPage — the two biggest, 19 MB
// between them — so anyone migrating the brochures by walking the content directory would have
// moved four and quietly left the other two pointing at a folder that was being deleted.

const CONTENT = {
  bg: { interiors: bgInteriors, modularBuilds: bgModularBuilds, modularHouses: bgModularHouses, steelHouses: bgSteelHouses },
  el: { interiors: elInteriors, modularBuilds: elModularBuilds, modularHouses: elModularHouses, steelHouses: elSteelHouses },
  en: { interiors: enInteriors, modularBuilds: enModularBuilds, modularHouses: enModularHouses, steelHouses: enSteelHouses },
}
const LOCALES = Object.keys(CONTENT)

/** Every .js/.jsx file under `dir`, so a check can be made against the source text itself. */
function jsFilesIn(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...jsFilesIn(full))
    else if (/\.jsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Every brochure reference the site holds, for one language, read the way the pages read it.
 *
 * Reaching into the content shapes by hand rather than searching for a `brochureFile` key is
 * deliberate: if a page stops using one of these fields, or a translator drops one, the access
 * below yields undefined and the tests fail. A generic walk would just find one fewer.
 */
function referencesFor(locale) {
  const { interiors, modularBuilds, modularHouses, steelHouses } = CONTENT[locale]
  const at = (where, node) => ({ where, file: node.brochureFile, page: node.brochurePage })
  return [
    at('modularHouses.quick', modularHouses.quick),
    at('modularHouses.models.house', modularHouses.models.house),
    at('modularHouses.models.expandable', modularHouses.models.expandable),
    ...modularBuilds.products.map((product) => at(`modularBuilds.products.${product.key}`, product)),
    at('steelHouses', steelHouses),
    at('interiors.hero.quick', interiors.hero.quick),
  ]
}

const CAPSULES = '%D0%9A%D0%BE%D1%81%D0%BC%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%20%D0%9A%D0%B0%D0%BF%D1%81%D1%83%D0%BB%D0%B8.pdf'
const BOX = '%D0%A0%D0%B0%D0%B7%D0%B3%D1%8A%D0%B2%D0%B0%D0%B5%D0%BC%D0%B8%20%E2%80%9C%D0%91%D0%BE%D0%BA%D1%81%E2%80%9D%20%D0%9A%D1%8A%D1%89%D0%B0.pdf'
const CONTAINERS = '%D0%A1%D1%82%D0%B0%D0%BD%D0%B4%D0%B0%D1%80%D1%82%D0%BD%D0%B8%20%D0%BA%D0%BE%D0%BD%D1%82%D0%B5%D0%B9%D0%BD%D0%B5%D1%80%D0%B8.pdf'
const VILLA = '%D0%92%D0%B8%D0%BB%D0%B0-%D0%9E%D1%84%D0%B8%D1%81.pdf'
const SLOPED = '%D0%A1%D0%BA%D0%BE%D1%81%D0%B5%D0%BD%20%D0%BF%D0%BE%D0%BA%D1%80%D0%B8%D0%B2.pdf'

/** Where each reference must land, keyed the way `referencesFor` names it. */
const EXPECTED_HREFS = {
  'modularHouses.quick': '/modular-builds/modular-builds.pdf#page=2',
  'modularHouses.models.house': `/modular-builds/${CAPSULES}#page=1`,
  'modularHouses.models.expandable': `/modular-builds/${BOX}#page=1`,
  'modularBuilds.products.standard': `/modular-builds/${CONTAINERS}#page=1`,
  'modularBuilds.products.villa': `/modular-builds/${VILLA}#page=1`,
  'modularBuilds.products.retail': `/modular-builds/${SLOPED}#page=1`,
  steelHouses: '/modular-builds/modular-builds.pdf#page=3',
  'interiors.hero.quick': '/modular-builds/modular-builds.pdf#page=4',
}

describe('brochureUrl', () => {
  it('is written for a site served from the root', () => {
    // The hrefs pinned below start at '/', which only holds while the app is mounted there.
    // If the base ever moves, this fails first and explains the twenty that follow.
    expect(import.meta.env.BASE_URL).toBe('/')
  })

  it('percent-encodes the Cyrillic, the spaces and the typographic quotes', () => {
    expect(brochureUrl('Разгъваеми “Бокс” Къща.pdf')).toBe(`/modular-builds/${BOX}#page=1`)
    expect(brochureUrl('Скосен покрив.pdf')).toBe(`/modular-builds/${SLOPED}#page=1`)
  })

  it('leaves an ASCII name alone', () => {
    expect(brochureUrl('modular-builds.pdf')).toBe('/modular-builds/modular-builds.pdf#page=1')
  })

  it('carries the page anchor through unchanged', () => {
    expect(brochureUrl('modular-builds.pdf', 4)).toBe('/modular-builds/modular-builds.pdf#page=4')
  })

  it('opens at page one when no page is named', () => {
    // Every link on the site carries an anchor today, and the default keeps it that way for
    // the next one — a brochure with no `#page` would open wherever the reader last left it.
    expect(brochureUrl('Вила-Офис.pdf')).toBe(`/modular-builds/${VILLA}#page=1`)
  })
})

describe('the brochures the content files name', () => {
  it('is the same set of eight references in every language', () => {
    const bg = referencesFor('bg')
    for (const locale of LOCALES) {
      const refs = referencesFor(locale)
      expect(refs.map((r) => r.where), locale).toEqual(bg.map((r) => r.where))
      // The PDFs themselves are not translated — one file, linked from all three languages.
      expect(refs.map((r) => `${r.file}#${r.page}`), locale).toEqual(bg.map((r) => `${r.file}#${r.page}`))
    }
  })

  it('resolves to the eight hrefs the site published before this refactor', () => {
    for (const locale of LOCALES) {
      for (const ref of referencesFor(locale)) {
        expect(brochureUrl(ref.file, ref.page), `${locale} ${ref.where}`)
          .toBe(EXPECTED_HREFS[ref.where])
      }
    }
  })

  it('covers all six PDFs in the folder', () => {
    // The count is the point. Four of six were reachable from the content directory before;
    // if a seventh brochure is dropped in and never linked, or a linked one is renamed away,
    // this is the test that notices.
    const linked = new Set(referencesFor('bg').map((r) => r.file))
    const onDisk = readdirSync(resolve(process.cwd(), 'public/modular-builds'))
      .filter((name) => name.toLowerCase().endsWith('.pdf'))

    expect([...linked].sort()).toEqual([...onDisk].sort())
  })

  it('names a file that actually exists', () => {
    for (const locale of LOCALES) {
      for (const ref of referencesFor(locale)) {
        const path = resolve(process.cwd(), 'public/modular-builds', ref.file)
        expect(existsSync(path), `${locale} ${ref.where} -> ${ref.file}`).toBe(true)
      }
    }
  })

  it('names every brochure with the same key, so one grep finds all eight', () => {
    // The convention that makes the next migration safe is the KEY as much as the value.
    // Two of the eight used to live in a nested `brochure: { file, page }`, so searching the
    // content directory for brochureFile returned six — the same 'found four of six' trap
    // this stage exists to close, moved out of the pages and into the key names. Stage 4
    // adds a slug beside the file name, and it should be one mechanical pass, not two.
    const stray = []
    for (const file of jsFilesIn(resolve(process.cwd(), 'src/content'))) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/\.pdf['"`]/i.test(line) && !/^\s*brochureFile:/.test(line)) {
          stray.push(`${file.replace(process.cwd(), '')}:${i + 1} ${line.trim()}`)
        }
      })
    }

    expect(stray, `A brochure named under any other key is one a grep will miss:\n  ${stray.join('\n  ')}`)
      .toEqual([])
  })

  it('stores a bare file name, never a path', () => {
    // The one convention. steelHouses.js and interiors.js used to store
    // 'modular-builds/modular-builds.pdf' while modularBuilds.js stored the bare name, which
    // is why there were two URL helpers to begin with — a prefixed value cannot survive
    // encodeURIComponent, because the slash comes out as %2F and the link 404s.
    for (const locale of LOCALES) {
      for (const ref of referencesFor(locale)) {
        expect(ref.file, `${locale} ${ref.where}`).not.toMatch(/[/\\]/)
        expect(ref.page, `${locale} ${ref.where}`).toBeTypeOf('number')
      }
    }
  })
})

describe('no page names a brochure itself', () => {
  // The regression this whole stage exists to prevent, and the reason it is checked against
  // the source text rather than the rendered output: a hard-coded href renders perfectly.
  // It is only invisible to whoever goes looking for brochures in the content directory.
  const roots = ['src/pages', 'src/components', 'src/routes'].map((d) => resolve(process.cwd(), d))

  // Block comments are dropped first: AdminCustomersPage explains a filename clash in prose,
  // and that sentence is documentation, not a link.
  const sources = roots
    .flatMap(jsFilesIn)
    .filter((file) => !/\.test\.jsx?$/.test(file))
    .map((file) => ({ file, code: readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }))

  it('finds the pages to check', () => {
    expect(sources.length).toBeGreaterThan(20)
  })

  it('leaves every PDF file name in the content files', () => {
    const offenders = []
    for (const { file, code } of sources) {
      for (const match of code.matchAll(/(['"`])([^'"`\n]*\.pdf)\1/gi)) {
        offenders.push(`${file.replace(process.cwd(), '')} -> ${match[2]}`)
      }
    }

    expect(
      offenders,
      `A brochure named in a page is a brochure the next migration will miss. Move it into ` +
        `src/content/{bg,el,en}/ and link it with brochureUrl():\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('builds every brochure href with the shared helper', () => {
    // Two helpers that disagreed is how one PDF ended up with two spellings on one site.
    const offenders = []
    for (const { file, code } of sources) {
      if (/(?:function|const)\s+brochureUrl\b/.test(code)) {
        offenders.push(`${file.replace(process.cwd(), '')} declares its own brochureUrl`)
      }
      if (/\bbrochureUrl\s*\(/.test(code) && !/from\s+'[^']*lib\/brochure\.js'/.test(code)) {
        offenders.push(`${file.replace(process.cwd(), '')} calls brochureUrl without importing it`)
      }
    }

    expect(offenders, offenders.join('\n  ')).toEqual([])
  })
})
