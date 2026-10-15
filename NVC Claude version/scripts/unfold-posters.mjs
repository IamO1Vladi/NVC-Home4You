// Renders the poster stills of the unfolding Box house (UnfoldHouse.jsx) from the 3D scene
// itself, so the poster -- which is what the prerendered page, a browser without WebGL and
// every visitor before the 3D arrives see -- is always the same house as the 3D.
//
// WHEN TO RUN IT: after a change to src/components/planner/unfoldScene.js or unfoldModel.js,
// and after a new catalogue edition (the house's sizes are read from the catalogue at run
// time, so the 3D follows a new edition on its own; the posters are files and do not).
//
// HOW: start the dev server (npm run dev, port 5174 by default), then from this project:
//
//   node scripts/unfold-posters.mjs [outDir] [baseUrl]
//
// outDir defaults to public/planner, baseUrl to http://localhost:5174. It writes twelve
// files, unfold-<37|58|73>[-roof][-dark].webp at 1600 × 1000 with a transparent background
// (the card's paper colour shows through): the finished base house (T = 5) and the house
// with its roof and veranda (T = 7), in the light and the dark theme. Rendering runs on
// swiftshader, so no GPU is needed; it takes a minute or so.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(process.argv[2] || path.join(here, '..', 'public', 'planner'))
const baseUrl = (process.argv[3] || 'http://localhost:5174').replace(/\/$/, '')
fs.mkdirSync(outDir, { recursive: true })

const jobs = []
for (const model of ['37', '58', '73']) {
  for (const roof of [false, true]) {
    for (const dark of [false, true]) {
      jobs.push({ model, T: roof ? 7 : 5, dark, name: `unfold-${model}${roof ? '-roof' : ''}${dark ? '-dark' : ''}.webp` })
    }
  }
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage()
  // The desktop layout (above 640px), whose framing the posters are cropped for on phones.
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('[pageerror]', e.message))
  // Any page of the site will do: it only has to serve the dev server's modules.
  await page.goto(`${baseUrl}/en/floor-planner`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.evaluate(() => {
    const host = document.createElement('div')
    host.id = 'uh-poster-host'
    host.style.cssText = 'position:fixed;left:0;top:0;width:1600px;height:1000px;z-index:2147483647'
    document.body.appendChild(host)
  })
  for (const job of jobs) {
    const data = await page.evaluate(async ({ model, T, dark }) => {
      const m = await import('/src/components/planner/unfoldScene.js')
      window.__uhPoster?.dispose()
      // preserveDrawingBuffer: the canvas is read back after the frame is drawn
      window.__uhPoster = m.createUnfoldScene(document.getElementById('uh-poster-host'), {
        modelKey: model,
        dark,
        T,
        preserveDrawingBuffer: true,
      })
      window.__uhPoster.setPose(T)
      window.__uhPoster.render()
      return window.__uhPoster.canvas.toDataURL('image/webp', 0.86)
    }, job)
    const buf = Buffer.from(data.split(',')[1], 'base64')
    fs.writeFileSync(path.join(outDir, job.name), buf)
    console.log(job.name, `${Math.round(buf.length / 1024)} KB`)
  }
} finally {
  await browser.close()
}
