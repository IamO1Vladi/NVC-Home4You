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
//   Terminal 1:  cd "NVC Claude version"; npm run build
//                cd ..\api-dotnet; dotnet run -p:SkipSpaBuild=true   (with the env below)
//   Terminal 2:  cd "NVC Claude version"; npm run prerender
//
// The app needs SQL_CONNECTION_STRING, BLOB_CONNECTION_STRING and the three
// DATA_SOURCE_{GALLERY,CASES,REVIEWS}=sql flags — the full recipe is in HANDOFF.md,
// "Prerendering — read before every release".
//
// The output is deliberately written OUTSIDE wwwroot. Anything in the web root is served by
// the static-file middleware, which would publish every snapshot a second time at
// /prerendered/... — a duplicate of each page, at a URL nothing canonicals away.
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { compareCataloguePrices } from '../src/lib/catalogueCompare.js'
import { paths } from '../src/routes/paths.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = resolve(root, '../api-dotnet/prerendered')

const BASE = process.env.PRERENDER_BASE || 'http://localhost:5178'

// Long enough for the gallery and cases pages to finish their API call, short enough that a
// hung request cannot stall a release.
const NAV_TIMEOUT = Number(process.env.PRERENDER_TIMEOUT || 20000)

// How long a page may wait on its own API calls (gallery, prices, reviews, cases). Serverless
// Azure SQL takes 30-60s to resume from auto-pause, and the app retries through it.
const DATA_TIMEOUT = Number(process.env.PRERENDER_DATA_TIMEOUT || 60000)

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
 *
 * And not while a data call is still open. Stability alone was not enough either, and on
 * 2026-10-03 it failed the same quiet way: networkidle2 tolerates two open connections, so it
 * fires while ONE slow API call is pending, and a loading message is perfectly stable. The
 * first pages of that run hit cold endpoints and froze „Зареждане на цените…" into /bg/ceni,
 * the same for the gallery and cases, and the home pages lost their reviews section, all
 * counted as successes. `pending` holds the page's open /api/ calls. Sampling only counts
 * once there are none, up to DATA_TIMEOUT. The caller treats calls still open as a failure.
 */
async function settle(page, pending, { interval = 300, stableFor = 2, cap = 15 } = {}) {
  const deadline = Date.now() + DATA_TIMEOUT
  let previous = -1
  let stable = 0

  for (let i = 0; i < cap; i++) {
    await new Promise((r) => setTimeout(r, interval))

    if (pending.size > 0) {
      if (Date.now() > deadline) return
      stable = 0
      i--
      continue
    }

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

/**
 * A data call the page renders from: the app's own /api/, minus /api/img. Images are not data,
 * and since #9 a failed image retries in a loop (ROADMAP #33), so waiting on them could
 * never end. The stability sampling covers them as before.
 */
function isDataCall(url) {
  try {
    const u = new URL(url)
    return u.origin === new URL(BASE).origin
      && u.pathname.startsWith('/api/')
      && !u.pathname.startsWith('/api/img')
  } catch {
    return false
  }
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
    return Array.isArray(body) ? body : (body?.items ?? [])
  }

  // The local read is not optional. An app that cannot serve its own catalogue (a wrong SQL
  // string, the firewall) renders error states that still clear MIN_TEXT on the header and
  // footer alone, and would be written as good snapshots.
  let local
  try {
    local = await read(BASE)
  } catch (err) {
    return { ok: false, reason: `the local app could not serve /api/gallery (${err.message})` }
  }

  let live
  try {
    live = await read('https://nvc-home4you.eu')
  } catch (err) {
    // Cannot reach the live site: warn, do not block. A release from a train should still
    // be possible, and the operator has been told what was not verified.
    return { ok: true, warning: `could not compare against the live catalogue (${err.message})` }
  }

  // Matched by id, minus any id either side serves twice — see catalogueCompare.js.
  const { differences, ambiguous, compared, localCount } = compareCataloguePrices(local, live)

  if (localCount === 0) return { ok: false, reason: 'the local catalogue came back empty' }
  if (differences.length) {
    const lines = differences.map((d) => `  item ${d.id}: local ${d.local} vs live ${d.live}`)
    return { ok: false, reason: `local and live catalogue prices disagree:\n${lines.join('\n')}` }
  }
  return {
    ok: true,
    compared,
    warning: ambiguous.length
      ? `not compared: id ${ambiguous.join(', ')} is served for more than one item. Expected from live on the release that ships #35 (it serves the Space house and the 73 m² house both as 15); anywhere else it is a bug.`
      : undefined,
  }
}

const routes = routeList()

if (!(await isUp())) {
  console.error(`\nPrerender: nothing is listening on ${BASE}.`)
  console.error('Start the API first (full recipe: HANDOFF.md, "Prerendering"), then re-run.\n')
  console.error('  Terminal 1, from the repo root:')
  console.error('    cd api-dotnet')
  console.error("    $env:SQL_CONNECTION_STRING = '...'; $env:BLOB_CONNECTION_STRING = '...'   # not needed on the main device")
  console.error("    $env:DATA_SOURCE_GALLERY = 'sql'; $env:DATA_SOURCE_CASES = 'sql'; $env:DATA_SOURCE_REVIEWS = 'sql'")
  console.error('    dotnet run -p:SkipSpaBuild=true')
  console.error('  Terminal 2, from the repo root:')
  console.error('    cd "NVC Claude version"; npm run prerender\n')
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
  console.error('Start the app with the production store settings (PowerShell; the flags are ignored')
  console.error('without the SQL string, and the images 404 without the Blob one):')
  console.error("  $env:SQL_CONNECTION_STRING = '...'; $env:BLOB_CONNECTION_STRING = '...'")
  console.error("  $env:DATA_SOURCE_GALLERY = 'sql'; $env:DATA_SOURCE_CASES = 'sql'; $env:DATA_SOURCE_REVIEWS = 'sql'")
  console.error('  dotnet run -p:SkipSpaBuild=true\n')
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

  // The page's open data calls, for settle(). A request leaves on finishing or failing,
  // whatever its status: an error page is still a page that has stopped waiting.
  const pending = new Set()
  page.on('request', (req) => { if (isDataCall(req.url())) pending.add(req) })
  page.on('requestfinished', (req) => pending.delete(req))
  page.on('requestfailed', (req) => pending.delete(req))

  for (const route of routes) {
    const url = `${BASE}${route}`
    try {
      pending.clear()
      await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT })
      await settle(page, pending)

      if (pending.size > 0) {
        const open = [...pending].map((req) => new URL(req.url()).pathname)
        results.push({ route, status: 'api', detail: `still waiting after ${DATA_TIMEOUT / 1000}s on ${open.join(', ')}` })
        continue
      }

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

// A run where nothing rendered means the app was up and broken, and that should stop a deploy.
if (ok.length === 0) {
  console.error('\nPrerender: not a single route rendered. Refusing to report success.')
  process.exit(1)
}

// A partial run fails too, because nothing downstream notices one. The folder was cleared
// above, so the routes that did not render have NO snapshot. The freshness guard checks only
// that the snapshots which do exist point at real assets, so a publish ships the gap without
// a word and those pages go out client-rendered. On 2026-09-30 a run without the Blob string
// went 45/52, home page included — and in that case the 45 that did render are bad too,
// because they carry placeholder art instead of the real images. Fix the cause and re-run;
// publishing a partial run should only ever be a decision.
if (bad.length > 0) {
  console.error(`\nPrerender: PARTIAL — ${bad.length} of ${routes.length} routes have no snapshot (listed above).`)
  console.error('Do not publish this run. The usual causes:')
  console.error('  - a missing BLOB_CONNECTION_STRING: images 404 and the page never settles. The')
  console.error('    snapshots that DID render then carry placeholder images, so they are bad too.')
  console.error('  - an API call that never answered: status API, and the call is named.')
  console.error('Fix the cause and re-run.')
  process.exit(1)
}
