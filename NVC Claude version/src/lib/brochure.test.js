import { readdirSync, readFileSync, statSync } from 'node:fs'
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

// Guards the six product brochures — served from Blob behind /api/brochures/{slug}.pdf
// since stage 4 of #16, linked by four pages in three languages.
//
// Nothing here is about rendering. It is about the brochures being FINDABLE and correctly
// ADDRESSED: named as slugs in the content files, spelled one way, reachable through one
// helper, and carrying the visitor's language — because the API falls back to Bulgarian
// so quietly that a dropped ?lang= would serve Bulgarian to every Greek visitor forever
// without one error anywhere.

const CONTENT = {
  bg: { interiors: bgInteriors, modularBuilds: bgModularBuilds, modularHouses: bgModularHouses, steelHouses: bgSteelHouses },
  el: { interiors: elInteriors, modularBuilds: elModularBuilds, modularHouses: elModularHouses, steelHouses: elSteelHouses },
  en: { interiors: enInteriors, modularBuilds: enModularBuilds, modularHouses: enModularHouses, steelHouses: enSteelHouses },
}
const LOCALES = Object.keys(CONTENT)

// The six slugs the site is wired for. The AUTHORITY is PublicDocumentSlugs.Wired in the
// API — the write paths refuse to strand these — and PublicDocumentTests pins that the
// importer covers exactly the same set. This copy exists because the SPA cannot read a C#
// constant; if the two ever disagree, a linked slug 404s on the public site, which the
// resolves-and-covers tests below turn into a red test instead.
const WIRED = [
  'modular-builds', 'standard-containers', 'villa-office',
  'sloped-roof', 'space-capsules', 'box-house',
]

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
 * Every brochure reference the site holds, for one language, read the way the pages read
 * it. Reaching into the content shapes by hand rather than searching for a `brochureSlug`
 * key is deliberate: if a page stops using one of these fields, or a translator drops one,
 * the access below yields undefined and the tests fail. A generic walk would just find one
 * fewer.
 */
function referencesFor(locale) {
  const { interiors, modularBuilds, modularHouses, steelHouses } = CONTENT[locale]
  const at = (where, node) => ({ where, slug: node.brochureSlug, page: node.brochurePage })
  return [
    at('modularHouses.quick', modularHouses.quick),
    at('modularHouses.models.house', modularHouses.models.house),
    at('modularHouses.models.expandable', modularHouses.models.expandable),
    ...modularBuilds.products.map((product) => at(`modularBuilds.products.${product.key}`, product)),
    at('steelHouses', steelHouses),
    at('interiors.hero.quick', interiors.hero.quick),
  ]
}

/** Where each reference must land — the slug and page are locale-invariant, ?lang= is not. */
const EXPECTED = {
  'modularHouses.quick': ['modular-builds', 2],
  'modularHouses.models.house': ['space-capsules', 1],
  'modularHouses.models.expandable': ['box-house', 1],
  'modularBuilds.products.standard': ['standard-containers', 1],
  'modularBuilds.products.villa': ['villa-office', 1],
  'modularBuilds.products.retail': ['sloped-roof', 1],
  steelHouses: ['modular-builds', 3],
  'interiors.hero.quick': ['modular-builds', 4],
}

describe('brochureUrl', () => {
  it('is written for a site served from the root', () => {
    // The hrefs pinned below start at '/', which only holds while the app is mounted there.
    // If the base ever moves, this fails first and explains the twenty that follow.
    expect(import.meta.env.BASE_URL).toBe('/')
  })

  it('addresses the API route, with the language in the query', () => {
    expect(brochureUrl('villa-office', 1, 'el')).toBe('/api/brochures/villa-office.pdf?lang=el#page=1')
    expect(brochureUrl('modular-builds', 3, 'bg')).toBe('/api/brochures/modular-builds.pdf?lang=bg#page=3')
  })

  it('carries the page anchor through unchanged', () => {
    expect(brochureUrl('modular-builds', 4, 'en')).toBe('/api/brochures/modular-builds.pdf?lang=en#page=4')
  })

  it('opens at page one when no page is named', () => {
    // Every link on the site carries an anchor today, and the default keeps it that way for
    // the next one — a brochure with no `#page` would open wherever the reader last left it.
    expect(brochureUrl('villa-office', undefined, 'bg')).toBe('/api/brochures/villa-office.pdf?lang=bg#page=1')
  })

  it('omits the query rather than writing lang=undefined when the language is dropped', () => {
    // The API then serves the Bulgarian edition — a working page, and a silently wrong one
    // for two of three locales. That is why the href tests below pin ?lang= into every
    // rendered link: this fallback existing is not permission to lean on it.
    expect(brochureUrl('villa-office')).toBe('/api/brochures/villa-office.pdf#page=1')
  })
})

describe('the brochures the content files name', () => {
  it('is the same set of eight references in every language', () => {
    const bg = referencesFor('bg')
    for (const locale of LOCALES) {
      const refs = referencesFor(locale)
      expect(refs.map((r) => r.where), locale).toEqual(bg.map((r) => r.where))
      // The slug and page are shared across languages — the LANGUAGE is the URL's query,
      // decided by the page, never a third thing for a translator to keep in sync.
      expect(refs.map((r) => `${r.slug}#${r.page}`), locale).toEqual(bg.map((r) => `${r.slug}#${r.page}`))
    }
  })

  it('lands every reference on the slug and page the old static links carried', () => {
    for (const locale of LOCALES) {
      for (const ref of referencesFor(locale)) {
        expect([ref.slug, ref.page], `${locale} ${ref.where}`).toEqual(EXPECTED[ref.where])
      }
    }
  })

  it('resolves one brochure to three distinct hrefs across the three languages', () => {
    // THE stage-4 assertion, the one the static path could never make because it had no
    // language in it. If any page ever drops the locale argument, its three languages
    // collapse onto one href and this fails naming the reference.
    for (const ref of referencesFor('bg')) {
      const hrefs = LOCALES.map((locale) => brochureUrl(ref.slug, ref.page, locale))
      expect(new Set(hrefs).size, `${ref.where} -> ${hrefs.join(' | ')}`).toBe(LOCALES.length)
    }
  })

  it('links every wired slug and nothing else', () => {
    // Two lists, one from the site's side and one from the API's. A slug linked here that
    // the API does not serve is a 404 on a marketing page; a wired slug nothing links is
    // an API promise nobody needs any more. Either way this is the test that says so.
    const linked = new Set(referencesFor('bg').map((r) => r.slug))
    expect([...linked].sort()).toEqual([...WIRED].sort())
  })

  it('stores a slug in slug shape, never a file name and never a path', () => {
    // The Cyrillic file names — spaces, typographic quotes — are exactly what the slug
    // exists to keep out of URLs. Mirrors PublicDocumentSlugs.IsValidSlug.
    for (const locale of LOCALES) {
      for (const ref of referencesFor(locale)) {
        expect(ref.slug, `${locale} ${ref.where}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        expect(ref.page, `${locale} ${ref.where}`).toBeTypeOf('number')
      }
    }
  })

  it('keeps PDF file names out of the content directory altogether', () => {
    // Before stage 4 the one allowed key was brochureFile; now the content files speak
    // only slugs, so ANY .pdf string in them is a stray reference the migration missed or
    // a regression toward hard-coded names.
    const stray = []
    for (const file of jsFilesIn(resolve(process.cwd(), 'src/content'))) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/\.pdf['"`]/i.test(line)) {
          stray.push(`${file.replace(process.cwd(), '')}:${i + 1} ${line.trim()}`)
        }
      })
    }

    expect(stray, `A PDF named in a content file is one the slug migration missed:\n  ${stray.join('\n  ')}`)
      .toEqual([])
  })
})

describe('no page names a brochure itself', () => {
  // The regression stage 1 existed to prevent, still guarded after stage 4: a hard-coded
  // href renders perfectly and is only invisible to whoever goes looking for brochures in
  // the content directory.
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

  it('leaves every PDF reference out of the pages', () => {
    const offenders = []
    for (const { file, code } of sources) {
      for (const match of code.matchAll(/(['"`])([^'"`\n]*\.pdf)\1/gi)) {
        offenders.push(`${file.replace(process.cwd(), '')} -> ${match[2]}`)
      }
    }

    expect(
      offenders,
      `A brochure named in a page is a brochure the next migration will miss. Name its slug ` +
        `in src/content/{bg,el,en}/ and link it with brochureUrl():\n  ${offenders.join('\n  ')}`,
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

  it('hands the helper a locale at every call site', () => {
    // The API's bg fallback makes a dropped locale argument invisible at runtime — the
    // page works, in the wrong language, forever. So the argument count is checked in
    // source: every brochureUrl( call must carry three arguments.
    const offenders = []
    for (const { file, code } of sources) {
      for (const match of code.matchAll(/brochureUrl\(([^)]*)\)/g)) {
        const args = match[1].split(',').length
        if (args < 3) offenders.push(`${file.replace(process.cwd(), '')} -> brochureUrl(${match[1].trim()})`)
      }
    }

    expect(offenders, `A brochureUrl call without a locale serves Bulgarian to everyone:\n  ${offenders.join('\n  ')}`)
      .toEqual([])
  })
})
