// Snapshots every static route as real HTML, so crawlers get content instead of an empty div.
//
// THE PROBLEM THIS SOLVES. The site is a client-rendered SPA: `<div id="root">` is empty in
// the HTTP response for every URL, and all the copy appears only after React runs. The
// server-side head injection (generate-seo-manifest.mjs + Program.cs) fixed the <head>, but
// the <body> was still nothing. Measured against the Bulgarian competitors on 2026-08-14:
// kosedom.com served 19,392 characters of crawlable text, karmod.bg 16,045, idealmod.bg
// 11,555, prefabex.bg 4,819 — and nvc-home4you.eu served 0. Google renders JavaScript on a
// deferred second pass with no guaranteed budget; Bing, the social scrapers and the AI
// crawlers largely do not.
//
// HOW. Drive a headless browser over the ALREADY-BUILT, ALREADY-RUNNING app and keep what
// it renders. That fidelity is the point: the snapshot IS the real page, so it cannot drift
// from what a visitor sees the way a hand-written server-rendered approximation would — and
// serving a crawler something different from the user is precisely what gets a site
// penalised.
//
// WHY IT IS NOT PART OF `npm run build`. It needs the .NET app up and listening, which a
// developer running a plain build does not have. Kept as its own step so an ordinary build
// never fails for want of a server, and so this stays a deliberate release action.
//
//   Terminal 1:  cd api-dotnet && dotnet run
//   Terminal 2:  cd "NVC Claude version" && npm run build && npm run prerender
//
// The output is deliberately written OUTSIDE wwwroot. Anything in the web root is served by
// the static-file middleware, which would publish every snapshot a second time at
// /prerendered/... — a duplicate of each page, at a URL nothing canonicals away.
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { paths } from '../src/routes/paths.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = resolve(root, '../api-dotnet/prerendered')

const BASE = process.env.PRERENDER_BASE || 'http://localhost:5178'

// Long enough for the gallery and cases pages to finish their API call, short enough that a
// hung request cannot stall a release.
const NAV_TIMEOUT = Number(process.env.PRERENDER_TIMEOUT || 20000)

// Below this, a "successful" render almost certainly captured a spinner or an error state.
// Writing that would replace an empty div with a page that says "Loading…" to Google, which
// is worse than leaving it empty.
const MIN_TEXT = 200

/**
 * Waits until the page stops changing, rather than trusting "the network went quiet".
 *
 * networkidle2 is not enough here and the failure is quiet: the first run captured the
 * Bulgarian gallery with 24 card nodes where English and Greek had 108, because the grid
 * renders from an API call that had not landed when the network briefly went idle. A
 * snapshot taken a moment early is not an obvious error — it is a page that looks fine and
 * is missing most of its content, frozen into a file and served to crawlers until the next
 * release.
 *
 * So: sample the rendered text until two consecutive reads agree, then accept it.
 */
async function settle(page, { interval = 300, stableFor = 2, cap = 15 } = {}) {
  let previous = -1
  let stable = 0

  for (let i = 0; i < cap; i++) {
    await new Promise((r) => setTimeout(r, interval))

    const size = await page.evaluate(
      () => (document.getElementById('root')?.innerText || '').length
      + document.querySelectorAll('#root *').length
    )

    if (size === previous) {
      if (++stable >= stableFor) return
    } else {
      stable = 0
      previous = size
    }
  }
}

/**
 * Removes the head tags that would otherwise be frozen into the snapshot twice.
 *
 * Two layers write metadata. The server splices a block between the <!--SEO-START/END-->
 * markers before the response leaves; react-helmet-async then writes its own, marked
 * `data-rh`, once React mounts. In a normal request that is harmless — helmet's tags never
 * reach the HTTP response, so a crawler only ever sees the server's. Freezing the rendered
 * DOM captures BOTH, and the file ships with two <link rel="canonical"> and two of every
 * og: tag. Identical values today, but Google discards conflicting canonicals outright, and
 * the two layers are already known to disagree on some titles.
 *
 * Helmet's copy wins, because it is what a visitor actually ends up with — matching it is
 * what keeps the static file honest about the rendered page.
 *
 * <title> is the exception and must not be touched: helmet retitles the EXISTING element
 * rather than adding a tagged one, so there is only ever one, and it already holds helmet's
 * text. Dropping it as a "server tag" would ship pages with no title at all.
 */
async function dedupeHead(page) {
  return page.evaluate(() => {
    const keyOf = (el) => {
      if (el.tagName === 'TITLE') return 'title'
      const base = el.getAttribute('rel') || el.getAttribute('name') || el.getAttribute('property')
      if (!base) return null
      // Alternates are only distinguishable by their language.
      const lang = el.getAttribute('hreflang')
      return lang ? `${base}:${lang}` : base
    }

    const head = document.head
    const managedByHelmet = new Set()
    for (const el of head.querySelectorAll('[data-rh]')) {
      const key = keyOf(el)
      if (key) managedByHelmet.add(key)
    }

    let removed = 0
    for (const el of [...head.children]) {
      if (el.hasAttribute('data-rh')) continue
      const key = keyOf(el)
      if (key && key !== 'title' && managedByHelmet.has(key)) {
        el.remove()
        removed++
      }
    }
    return removed
  })
}

/** Every static route, plus the bare domain. Same source of truth as the SEO manifest. */
function routeList() {
  const out = new Set(['/'])
  for (const localized of Object.values(paths)) {
    for (const path of Object.values(localized)) {
      if (typeof path === 'string' && path.startsWith('/')) out.add(path)
    }
  }
  return [...out].sort()
}

/** "/bg/modulni-kysthi" -> "<outDir>/bg/modulni-kysthi.html"; "/" -> "<outDir>/_root.html" */
function fileFor(route) {
  if (route === '/') return join(outDir, '_root.html')
  return join(outDir, `${route.replace(/^\//, '')}.html`)
}

async function isUp() {
  try {
    const res = await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(4000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Refuses to snapshot an app that is reading different data from the one being replaced.
 *
 * THE FAILURE THIS EXISTS FOR, found 2026-08-15. Prerendering runs against a LOCAL app, and
 * the data source is per-environment: production sets DATA_SOURCE_GALLERY=sql, while a
 * dev machine with the flag unset silently falls back to Quickbase. A price corrected in the
 * admin panel therefore read €26,500 on the live site and €25,500 locally — and the
 * snapshots, taken locally, would have been published on top of the correct data. Prices
 * frozen into HTML from the wrong store, with a completely successful-looking release.
 *
 * The catalogue is the same data whichever code is deployed, so comparing it against the
 * live site is a valid check: a mismatch means the local app is pointed somewhere else.
 * Skipped with PRERENDER_SKIP_DATA_CHECK=1 for the genuine cases — no network, or a
 * deliberate content change that has not shipped yet.
 */
async function dataSourcesAgree() {
  if (process.env.PRERENDER_SKIP_DATA_CHECK === '1') return { ok: true, skipped: true }

  const read = async (base) => {
    const res = await fetch(`${base}/api/gallery`, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`${base} -> HTTP ${res.status}`)
    const body = await res.json()
    const items = Array.isArray(body) ? body : (body?.items ?? [])
    return new Map(items.filter((i) => i?.id != null).map((i) => [String(i.id), Number(i.price) || 0]))
  }

  let local
  let live
  try {
    ;[local, live] = await Promise.all([read(BASE), read('https://nvc-home4you.eu')])
  } catch (err) {
    // Cannot reach the live site: warn, do not block. A release from a train should still
    // be possible, and the operator has been told what was not verified.
    return { ok: true, warning: `could not compare against the live catalogue (${err.message})` }
  }

  const differences = []
  for (const [id, price] of live) {
    if (local.has(id) && local.get(id) !== price) {
      differences.push(`  item ${id}: local ${local.get(id)} vs live ${price}`)
    }
  }

  if (local.size === 0) return { ok: false, reason: 'the local catalogue came back empty' }
  return differences.length
    ? { ok: false, reason: `local and live catalogue prices disagree:\n${differences.join('\n')}` }
    : { ok: true, compared: local.size }
}

const routes = routeList()

if (!(await isUp())) {
  console.error(`\nPrerender: nothing is listening on ${BASE}.`)
  console.error('Start the API first, then re-run:\n')
  console.error('  cd api-dotnet && dotnet run')
  console.error('  cd "NVC Claude version" && npm run prerender\n')
  console.error(`Set PRERENDER_BASE to point somewhere else.`)
  process.exit(1)
}

const dataCheck = await dataSourcesAgree()
if (!dataCheck.ok) {
  console.error(`\nPrerender: refusing to run — ${dataCheck.reason}\n`)
  console.error('The local app is reading a different store from the one production serves.')
  console.error('DATA_SOURCE_* flags are per-environment; production sets DATA_SOURCE_GALLERY=sql,')
  console.error('and a machine with it unset falls back to Quickbase. Snapshots taken now would')
  console.error('publish prices from the wrong store.\n')
  console.error('Start the app with the production flags, e.g.:')
  console.error('  DATA_SOURCE_HOUSES=sql dotnet run\n')
  console.error('Set PRERENDER_SKIP_DATA_CHECK=1 only if you know why they differ.\n')
  process.exit(1)
}
if (dataCheck.warning) console.warn(`Prerender: ${dataCheck.warning}`)
if (dataCheck.compared) console.log(`Prerender: catalogue matches live (${dataCheck.compared} items).`)

console.log(`Prerender: ${routes.length} routes from ${BASE}`)

// Cleared first, so a route deleted from paths.js does not leave a stale snapshot behind
// that the server would happily keep serving.
//
// The CONTENTS go, not the directory itself. Removing the folder fails with EBUSY the
// moment anything holds a handle on it — the running app, an open editor, a shell sitting
// in it — and that is the normal state during a release, since prerendering requires the
// app to be up.
mkdirSync(outDir, { recursive: true })
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true })
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const results = []

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  // A real UA string. Some code paths branch on mobile/bot detection, and we want the
  // snapshot to be the ordinary desktop page.
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/125.0.0.0 Safari/537.36 NVCPrerender/1.0'
  )

  // Tells the server to serve the live SPA shell rather than the snapshot it already has.
  //
  // Without this the generator reads back its own previous output and saves it again: every
  // run reports success, the character counts look right, and the files quietly stop
  // tracking the code. It cost a confusing half hour the first time — a URL fixed in source
  // stayed broken in the output across two full rebuilds.
  await page.setExtraHTTPHeaders({ 'X-Prerender-Bypass': '1' })

  for (const route of routes) {
    const url = `${BASE}${route}`
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT })
      await settle(page)
      await dedupeHead(page)

      const { text, html, title } = await page.evaluate(() => ({
        text: (document.getElementById('root')?.innerText || '').trim(),
        html: document.documentElement.outerHTML,
        title: document.title,
      }))

      if (text.length < MIN_TEXT) {
        results.push({ route, status: 'thin', chars: text.length })
        continue
      }

      const file = fileFor(route)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, `<!doctype html>\n${html}`, 'utf8')

      results.push({ route, status: 'ok', chars: text.length, title })
    } catch (err) {
      results.push({ route, status: 'error', detail: err.message.split('\n')[0] })
    }
  }
} finally {
  await browser.close()
}

const ok = results.filter((r) => r.status === 'ok')
const bad = results.filter((r) => r.status !== 'ok')

for (const r of ok) {
  console.log(`  ${String(r.chars).padStart(6)} chars  ${r.route}`)
}
for (const r of bad) {
  console.warn(`  ${r.status.toUpperCase().padStart(6)}        ${r.route}  ${r.detail || `${r.chars} chars`}`)
}

const total = ok.reduce((n, r) => n + r.chars, 0)
console.log(`\nPrerender -> ${outDir}`)
console.log(`Done: ${ok.length}/${routes.length} routes, ${total.toLocaleString('en-US')} characters of crawlable text.`)

// A partial run is still a large improvement, so this does not fail the release — but a run
// where nothing rendered means the app was up and broken, and that should stop a deploy.
if (ok.length === 0) {
  console.error('\nPrerender: not a single route rendered. Refusing to report success.')
  process.exit(1)
}
