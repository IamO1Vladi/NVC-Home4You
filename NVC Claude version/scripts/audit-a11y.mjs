// Accessibility sweep for ROADMAP #10 — axe-core over every public route, desktop and
// phone, against a locally running app.
//
//   cd api-dotnet && DATA_SOURCE_GALLERY=sql ... dotnet run     (any data source works —
//   cd "NVC Claude version" && node scripts/audit-a11y.mjs       this audits markup, not prices)
//
// The EU Accessibility Act has applied since June 2025, and this is the measurable half of
// complying with it: WCAG failures a machine can prove. What a machine cannot prove —
// whether the tab order makes sense, whether the configurator is operable by keyboard —
// still needs a human; this script is for finding and then KEEPING OUT the mechanical
// failures, which is why check-a11y (the same sweep, exit code 1 on violations) is meant
// to run before a release once the site is clean.
//
// Two viewports, because the phone nav is a different component tree with its own bugs,
// and 'serious'/'critical' as the bar because that is axe's own line for "this locks
// somebody out" as opposed to "this could read better".

import { writeFileSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import puppeteer from 'puppeteer'
import { paths } from '../src/routes/paths.js'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const BASE = process.env.AUDIT_BASE || 'http://localhost:5178'
const OUT = resolve(here, '..', 'a11y-report.json')

function routeList() {
  const out = new Set(['/'])
  for (const localized of Object.values(paths)) {
    for (const path of Object.values(localized)) {
      if (typeof path === 'string' && path.startsWith('/')) out.add(path)
    }
  }
  return [...out].sort()
}

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

const routes = routeList()

try {
  await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(4000) })
} catch {
  console.error(`\nNothing is listening on ${BASE}. Start the API first.\n`)
  process.exit(1)
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const findings = []
let pagesAudited = 0

try {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage()
    await page.setViewport({ width: viewport.width, height: viewport.height })
    // The live SPA, not the stored snapshot — a stale snapshot would audit last week's markup.
    await page.setExtraHTTPHeaders({ 'X-Prerender-Bypass': '1' })

    for (const route of routes) {
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 30000 })
        // The cookie banner sits over every page on first load. It is PART of the audit
        // (it must itself be accessible), so it is left in place.
        await page.evaluate(axeSource)
        const result = await page.evaluate(async () =>
          await window.axe.run(document, {
            resultTypes: ['violations'],
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
          }))

        pagesAudited++
        for (const violation of result.violations) {
          findings.push({
            route,
            viewport: viewport.name,
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.slice(0, 5).map((n) => n.target.join(' ')),
            nodeCount: violation.nodes.length,
          })
        }
        process.stdout.write(`${viewport.name.padEnd(8)} ${route.padEnd(36)} ${result.violations.length ? result.violations.map(v => `${v.id}(${v.nodes.length})`).join(' ') : 'clean'}\n`)
      } catch (err) {
        findings.push({ route, viewport: viewport.name, id: 'AUDIT-ERROR', impact: 'critical', help: String(err?.message || err), nodes: [], nodeCount: 0 })
        process.stdout.write(`${viewport.name.padEnd(8)} ${route.padEnd(36)} ERROR ${err?.message}\n`)
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
}

// The summary that decides what gets fixed first: rule × how many pages it touches.
const byRule = new Map()
for (const f of findings) {
  const entry = byRule.get(f.id) || { id: f.id, impact: f.impact, help: f.help, pages: new Set(), nodes: 0 }
  entry.pages.add(`${f.viewport}:${f.route}`)
  entry.nodes += f.nodeCount
  byRule.set(f.id, entry)
}

console.log(`\n${pagesAudited} page-loads audited across ${routes.length} routes × ${VIEWPORTS.length} viewports.\n`)
const ranked = [...byRule.values()].sort((a, b) => b.pages.size - a.pages.size)
for (const r of ranked) {
  console.log(`${(r.impact || '?').padEnd(9)} ${r.id.padEnd(32)} ${String(r.pages.size).padStart(3)} page-views, ${String(r.nodes).padStart(4)} nodes — ${r.help}`)
}
if (ranked.length === 0) console.log('No violations. The mechanical half of #10 holds.')

writeFileSync(OUT, JSON.stringify(findings, null, 2))
console.log(`\nDetail -> ${OUT}`)

const gate = findings.filter((f) => f.impact === 'serious' || f.impact === 'critical')
if (process.argv.includes('--check') && gate.length > 0) {
  console.error(`\n${gate.length} serious/critical finding(s) — failing the check.`)
  process.exit(1)
}
