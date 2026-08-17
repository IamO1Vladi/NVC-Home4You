import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { paths } from '../routes/paths.js'

// Guards the URLs the site says about itself.
//
// These fail in the worst way available: silently, and only in Google's index. A canonical
// pointing at a path the router does not register tells Google "the real version of this
// page is over there", and over there is a 404 — so the page that exists stops being
// indexed and nothing in the app looks broken. That is not hypothetical: content/el/partner.js
// carried '/el/partner' (the English slug) while the Greek route is '/el/ginete-synergatis',
// so the Greek partner page canonicalised itself onto a dead URL. Caught 2026-08-14, by a
// prerender pass rather than by anything in the app.
//
// paths.js is the single source of truth. Anything that hard-codes an absolute site URL has
// to agree with it.

const SITE = 'https://nvc-home4you.eu'
const here = resolve(__dirname, '..')

/** Every path paths.js registers, plus the locale roots and the bare domain. */
function registeredPaths() {
  const out = new Set(['/'])
  for (const localized of Object.values(paths)) {
    for (const path of Object.values(localized)) {
      if (typeof path === 'string' && path.startsWith('/')) out.add(path)
    }
  }
  return out
}

/** Walks a directory for .js/.jsx files. */
function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.jsx?$/.test(entry) && !/\.test\.jsx?$/.test(entry)) out.push(full)
  }
  return out
}

const registered = registeredPaths()

// Gallery product URLs are generated from database rows at runtime, so they are legitimately
// absent from paths.js. Nothing else should be.
const isGalleryDetail = (path) =>
  /^\/(?:bg\/galeriq|en\/gallery|el\/gkaleri)\/.+/.test(path)

describe('self-referential SEO URLs', () => {
  const files = [...sourceFiles(join(here, 'content')), ...sourceFiles(join(here, 'routes'))]

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('every hard-coded site URL resolves to a registered route', () => {
    const broken = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/'(https:\/\/nvc-home4you\.eu[^']*)'/g)) {
        const url = match[1]

        // Anchors and query strings address a spot on a page, not a different page.
        const path = url.replace(SITE, '').split(/[#?]/)[0].replace(/\/$/, '') || '/'

        // Assets are files, not routes.
        if (/\.(?:jpg|jpeg|png|webp|svg|ico|pdf|xml|txt|json)$/i.test(path)) continue
        if (path.startsWith('/api/') || path.startsWith('/og/') || path.startsWith('/c/')) continue
        if (isGalleryDetail(path)) continue

        if (!registered.has(path)) {
          broken.push(`${file.replace(here, 'src')} -> ${url}`)
        }
      }
    }

    expect(broken, `URLs that are not registered routes:\n  ${broken.join('\n  ')}`).toEqual([])
  })

  it('every locale of a page has a distinct path', () => {
    // Two locales sharing a path is how a translated page ends up canonicalising onto its
    // own English version — the same failure as above, arrived at differently.
    for (const [pageKey, localized] of Object.entries(paths)) {
      const values = Object.values(localized).filter((p) => typeof p === 'string')
      expect(new Set(values).size, `${pageKey} reuses a path across locales: ${values.join(', ')}`)
        .toBe(values.length)
    }
  })

  it('every registered path is locale-prefixed', () => {
    // Every page is /{locale}/slug. `services` used to be an allowed exception here — its
    // paths were bare (/uslugi, /services, /ypiresies) — and it was removed on 2026-08-17
    // along with the page, so there is no exception list any more. Keep it that way: a bare
    // path is now a failure, not a special case to add a name to.
    for (const [pageKey, localized] of Object.entries(paths)) {
      for (const [locale, path] of Object.entries(localized)) {
        if (typeof path !== 'string') continue
        expect(path, `${pageKey}.${locale}`).toMatch(/^\/(bg|en|el)(\/|$)/)
      }
    }
  })

  // The gap that let a soft 404 reach the sitemap.
  //
  // The check above and `registeredPaths()` both read paths.js, so they can only prove that
  // paths.js agrees with itself. Nothing compared it against the routes App.jsx actually
  // registers — and /uslugi sat in paths.js for months with no <Route> for it, which meant
  // the sitemap advertised a URL that rendered the "Page not found" body under an HTTP 200.
  // Invisible to every test here, and to anyone browsing the site, because nothing linked
  // to it.
  //
  // Matching source text is crude, but the alternative is rendering the router and crawling
  // it, and this catches the failure that actually happened.
  //
  // A route is registered either of two ways, and both count. Most use the paths.js constant
  // (`path={paths.faq.el}`), but the three gallery routes are literal wildcards
  // (`path="/bg/galeriq/*"`) because they carry a slug — and React Router matches the bare
  // path against a trailing `/*` too, so those are genuinely routed.
  it('every path in paths.js has a route registered in App.jsx', () => {
    const appSource = readFileSync(join(here, 'App.jsx'), 'utf8')

    const byConstant = new Set(
      [...appSource.matchAll(/paths\.(\w+)\.(bg|en|el)/g)].map((m) => `${m[1]}.${m[2]}`),
    )
    const byLiteral = new Set(
      [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1].replace(/\/\*$/, '')),
    )

    const unrouted = []
    for (const [pageKey, localized] of Object.entries(paths)) {
      for (const [locale, path] of Object.entries(localized)) {
        if (typeof path !== 'string') continue
        if (byConstant.has(`${pageKey}.${locale}`) || byLiteral.has(path)) continue
        unrouted.push(`${pageKey}.${locale} (${path})`)
      }
    }

    expect(
      unrouted,
      `paths.js registers these with no route in App.jsx, so the sitemap advertises URLs ` +
        `that render the 404 body under a 200:\n  ${unrouted.join('\n  ')}`,
    ).toEqual([])
  })
})
