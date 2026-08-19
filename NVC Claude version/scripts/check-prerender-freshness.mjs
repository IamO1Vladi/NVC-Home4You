// Refuses a publish whose prerendered snapshots point at a bundle that no longer exists.
//
// THIS EXISTS BECAUSE IT HAPPENED. On 2026-08-18 a publish shipped the previous day's
// snapshots together with a freshly built SPA. The publish rebuilds the bundle, Vite hashes
// it by content, so the hash changed — and every prerendered page's <script src> pointed at
// a file that was no longer there. The server answered those requests with the HTML
// fallback, the browser refused it ("disallowed MIME type"), React never booted, and the
// whole public site rendered as dead HTML: no cookie banner, no modals, no theme, no
// language switch. The admin panel was fine, because it is not prerendered.
//
// Nothing failed. The build succeeded, the publish succeeded, and the site was broken —
// which is exactly the class of failure a checklist item cannot prevent, because the step
// that was skipped is the one that would have caught it.
//
// So the check is mechanical and runs inside the publish: every /assets/ file referenced by
// a snapshot must exist in wwwroot. If one does not, the publish stops with the command to
// fix it.
//
// A missing prerendered/ folder is NOT an error — publishing without snapshots is a
// supported, working, client-rendered site (see StagePrerenderedForPublish). The failure
// mode this guards is subtler: snapshots that exist and LIE.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const apiRoot = resolve(here, '../../api-dotnet')
const snapshotDir = join(apiRoot, 'prerendered')
const wwwroot = join(apiRoot, 'wwwroot')

function htmlFilesIn(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...htmlFilesIn(full))
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

if (!existsSync(snapshotDir)) {
  console.log('Prerender check: no prerendered/ folder — nothing to verify.')
  process.exit(0)
}

const snapshots = htmlFilesIn(snapshotDir)
if (snapshots.length === 0) {
  console.log('Prerender check: prerendered/ is empty — nothing to verify.')
  process.exit(0)
}

// Every asset any snapshot asks for, and which snapshot asked.
const wanted = new Map()
for (const file of snapshots) {
  const html = readFileSync(file, 'utf8')
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)) {
    const asset = match[1]
    if (!wanted.has(asset)) wanted.set(asset, file)
  }
}

const missing = []
for (const [asset, firstSeenIn] of wanted) {
  // The reference is site-absolute; on disk it hangs off wwwroot.
  if (!existsSync(join(wwwroot, asset.replace(/^\//, '')))) {
    missing.push({ asset, firstSeenIn: firstSeenIn.replace(apiRoot, 'api-dotnet') })
  }
}

if (missing.length > 0) {
  console.error('')
  console.error('  PRERENDERED PAGES ARE STALE — PUBLISH STOPPED')
  console.error('')
  console.error(`  ${snapshots.length} snapshot(s) reference ${missing.length} asset(s) that this build did not produce.`)
  console.error('  Shipping them would serve every public page with a <script> pointing at a file')
  console.error('  that does not exist: React never boots, and the site renders as dead HTML.')
  console.error('')
  for (const { asset, firstSeenIn } of missing.slice(0, 5)) {
    console.error(`    ${asset}`)
    console.error(`      wanted by ${firstSeenIn}`)
  }
  if (missing.length > 5) console.error(`    …and ${missing.length - 5} more`)
  console.error('')
  console.error('  Fix: re-run the prerender against a local app, then publish again.')
  console.error('  See HANDOFF.md, "Prerendering — read before every release". In short:')
  console.error('')
  console.error('    cd "NVC Claude version"; npm run build')
  console.error('    cd ..\\api-dotnet')
  console.error("    $env:DATA_SOURCE_GALLERY = 'sql'; $env:DATA_SOURCE_CASES = 'sql'; $env:DATA_SOURCE_REVIEWS = 'sql'")
  console.error('    dotnet run -p:SkipSpaBuild=true')
  console.error('    # in a second terminal:')
  console.error('    cd "NVC Claude version"; npm run prerender')
  console.error('')
  process.exit(1)
}

console.log(`Prerender check: ${snapshots.length} snapshot(s), ${wanted.size} asset reference(s), all present.`)
