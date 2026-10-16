// Builds web media from what the owner sent on 2026-10-17: two photos inside our factory in
// China, two short phone videos panning over the rock-wool panels there, and a photo of a
// container delivered to a buyer's lakeside plot. Every cut is recorded in the tables below.
//
// Same method as scripts/interiors/clips.mjs and scripts/delivery/clips.mjs (read the delivery
// header for the why): no ffmpeg, so it all runs in headless Chrome. Every output frame (30 fps)
// is rendered by seeking the source video and drawing its crop into a 640 x 800 canvas;
// WebCodecs encodes H.264 High at a constant quantizer (one key frame, no B-frames) and Node
// writes a plain progressive MP4 with no audio. Each clip is then verified in Chrome (loads,
// finite duration, 640 x 800, muted autoplay without a gesture, loops at least twice, no black
// frame) and its box structure is checked in Node. Photos are redrawn through a canvas, which
// drops every EXIF field (GPS included); each WebP's RIFF chunks are then read back in Node
// (size as recorded, no EXIF or XMP chunk).
//
// One difference from the earlier clip scripts: a clip here is a list of SEGMENTS, so it can
// join two takes. Each segment plays `from` -> `to` in its own source (to < from plays it
// backwards); consecutive segments overlap by `fade` seconds and dissolve, and the last one
// dissolves into the first, so the loop has no jump cut. A single segment [in - fade, out]
// gives exactly the loop the interiors script makes from in / out / fade.
//
// RUN (from this project; the sources are the owner's and are never copied into the repo):
//
//   node scripts/media/owner-2026-10-17.mjs [--src "C:/Users/kiril/Downloads/iCloud Photos"]
//        [--out public] [--only factory-pan,photos] [--review <sheet.jpg>] [--verify-only]
//
// --out      the public folder; each clip and photo names its own subfolder (factory/, delivered/)
// --only     rebuild only these clip ids, or "photos" for the photos
// Budgets (kB = 1000 B): each clip <= 590 kB (target 560), each poster <= 69 kB; each photo
//            output has its own budget below (the interiors ones for 1200 / 600 wide)
// Exit code 1 if any check or budget fails.
//
// NOT USED: IMG_3034.JPG and IMG_3035.JPG (square 1024 px, look upscaled or retouched; the
// owner was asked for the originals).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer'

// Clip sources: IMG_3340.MP4 (2.9 s) and IMG_3341.MP4 (3.43 s), 720 x 1280, 30 fps, hand-held
// pans across the factory hall. Crops are [x, y, w, h] in source pixels and must be 4:5.
export const CLIPS = [
  {
    // The factory hall: one continuous sweep to the left past the stacked rock-wool panels.
    // IMG_3341 pans left; from 1.72 s it is the empty pan (the worker with the pallet jack —
    // masked, but a person — has left the crop: his glove and the jack's handle are below the
    // crop's bottom edge from 1.7 s, gone from the frame by 1.9 s) to its last frame, ending on
    // the close rock-wool stack. IMG_3340 pans right; a woman walks in from the right at 1.4 s
    // (an elbow at the edge) and her face is clear from about 1.6 s, so only 0–1.32 s is used,
    // and it is played BACKWARDS so it pans left too (static stacks, nothing gives the
    // direction away). Each take alone would be a ~1.2 s loop; together they make 2.43 s.
    // Full-width crops; IMG_3340's sits 80 px higher so the window line is at about the same
    // height through the dissolves.
    id: 'factory-pan', dir: 'factory', fade: 0.3,
    segments: [
      { src: 'IMG_3341.MP4', from: 1.72, to: 3.42, crop: [0, 180, 720, 900] },
      { src: 'IMG_3340.MP4', from: 1.32, to: 0.0, crop: [0, 100, 720, 900] },
    ],
    // The close rock-wool stack beside the panel stacks on their blue pallets.
    poster: { src: 'IMG_3341.MP4', t: 2.85, crop: [0, 180, 720, 900] },
  },
]

// Photos. Each output is { w, h, maxKB } and the crop must have the same proportions (0.5%).
export const PHOTOS = [
  {
    // THE factory photo, the default of the "factory-floor" slot (today
    // public/partner/factory-floor.webp, 1200 x 891): About's factory card (16:9, 21:9 from
    // 900 px, centred) and the partner page's process step 2 (800:671, 50% 62%). The steel
    // hall itself — columns, X-bracing, the windows — over the wrapped profiles and panel
    // stacks; IMG_2993 in landscape is mostly the dark board stack in front. Same 1200:891 as
    // today, so the page's width/height stay true. x from 64 drops two soft-drink bottles on
    // the panel stack at the left edge; the windows and the stacks sit in the middle band,
    // which is what a 21:9 crop keeps.
    id: 'factory-hall', src: 'IMG_2992.JPEG', srcSize: [1536, 2048], dir: 'factory',
    crop: [64, 354, 1472, 1092.96],
    outputs: [{ w: 1200, h: 891, maxKB: 240 }, { w: 600, h: 446, maxKB: 75 }],
  },
  // (A 4:5 crop of IMG_2993, the view down the hall, was made and dropped: no page used it.)
  {
    // Made for home hero slide 5 (full-bleed 16:10), which did not take it: the container sits
    // at the photo's left edge, under the hero's fade, so slide 5 kept the crane lift. It is
    // the containers page's share picture instead. A container delivered to a buyer's lakeside plot, a wooden terrace
    // frame being built beside it, the lake and the mountains behind. The container is at the
    // photo's left edge, so the crop starts at x 0 to keep all of it; the satellite dish (with
    // the A1 mark) and the pole on the right stay outside. The source is 1600 x 900: the
    // 1600-wide output is the 1440 x 900 crop scaled up 1.11x.
    id: 'container-lakeside-16x10', src: 'IMG_3008.JPG', srcSize: [1600, 900], dir: 'delivered',
    crop: [0, 0, 1440, 900],
    outputs: [{ w: 1600, h: 1000, maxKB: 280 }, { w: 800, h: 500, maxKB: 90 }],
  },
  {
    // The containers page hero (ProductHero: 4:3 from 900 px, 2:1 on a tablet, 16:10 on a
    // phone, centred): the container whole on the left and the terrace frame to the posts;
    // 1:1 at 1200.
    id: 'container-lakeside-4x3', src: 'IMG_3008.JPG', srcSize: [1600, 900], dir: 'delivered',
    crop: [0, 0, 1200, 900],
    outputs: [{ w: 1200, h: 900, maxKB: 240 }, { w: 800, h: 600, maxKB: 110 }],
  },
]

const W = 640, H = 800, FPS = 30, MAX_CLIP_KB = 590, MAX_POSTER_KB = 69, TARGET_KB = 560
const CODEC = 'avc1.640028'
const QP_MIN = 22, QP_MAX = 44, KEY_QP_OFFSET = 2

const here = path.dirname(fileURLToPath(import.meta.url))
const args = parseArgs(process.argv.slice(2))
const srcDir = args.src || 'C:/Users/kiril/Downloads/iCloud Photos'
const outRoot = path.resolve(args.out || path.join(here, '..', '..', 'public'))
const only = args.only ? String(args.only).split(',') : null

for (const c of CLIPS) {
  if (Math.abs(c.fade * FPS - Math.round(c.fade * FPS)) > 1e-6) throw new Error(`${c.id}: fade must be whole frames`)
  for (const s of [...c.segments, c.poster]) if (Math.abs(s.crop[2] * 5 - s.crop[3] * 4) > 1e-6) throw new Error(`${c.id}: crop ${s.crop} is not 4:5`)
}
for (const p of PHOTOS) {
  for (const o of p.outputs) {
    const off = Math.abs((p.crop[2] / p.crop[3]) / (o.w / o.h) - 1)
    if (off > 0.005) throw new Error(`${p.id}: crop ${p.crop} does not fit ${o.w} x ${o.h} (${(off * 100).toFixed(2)}%)`)
  }
}

const fileUrl = (p) => pathToFileURL(path.resolve(p)).href

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nvc-owner-media-'))
fs.writeFileSync(path.join(tmp, 'blank.html'), '<!doctype html><meta charset="utf-8"><body></body>')
const browser = await puppeteer.launch({ headless: true, args: ['--allow-file-access-from-files'] })
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()) })
await page.goto(fileUrl(path.join(tmp, 'blank.html')))
await page.evaluate(PAGE_HELPERS)

const report = [], photoReport = []
try {
  for (const clip of CLIPS) {
    if (only && !only.includes(clip.id)) continue
    const dir = path.join(outRoot, clip.dir)
    fs.mkdirSync(dir, { recursive: true })
    const mp4 = path.join(dir, `clip-${clip.id}.mp4`)
    const webp = path.join(dir, `clip-${clip.id}.webp`)
    if (!args['verify-only']) {
      const withUrl = (s) => {
        const src = path.join(srcDir, s.src)
        if (!fs.existsSync(src)) throw new Error(`missing source ${src}`)
        return { ...s, url: fileUrl(src) }
      }
      const res = await page.evaluate((c) => window.__render(c), {
        ...clip, segments: clip.segments.map(withUrl), poster: withUrl(clip.poster), W, H, FPS, maxPosterKB: MAX_POSTER_KB,
      })
      fs.writeFileSync(webp, Buffer.from(res.poster, 'base64'))
      const target = Math.min(clip.maxKB || TARGET_KB, MAX_CLIP_KB)
      let chosen = null
      for (let qp = clip.qp ?? QP_MIN; qp <= (clip.qp ?? QP_MAX); qp++) {
        const e = await page.evaluate((o) => window.__encodeQP(o), { codec: CODEC, W, H, FPS, qp, keyQp: Math.max(0, qp - KEY_QP_OFFSET) })
        const buf = muxProgressive(e, FPS, W, H)
        chosen = { buf, qp, frames: e.sizes.length }
        if (buf.length / 1000 <= target) break
      }
      await page.evaluate(() => window.__release())
      if (chosen.frames !== res.frames) throw new Error(`${clip.id}: encoded ${chosen.frames} frames, rendered ${res.frames}`)
      fs.writeFileSync(mp4, chosen.buf)
      console.log(`${clip.id}: ${res.frames} frames (${res.plan}), ${(chosen.buf.length / 1000).toFixed(0)} kB at qp ${chosen.qp}, poster q${res.posterQ} ${(fs.statSync(webp).size / 1000).toFixed(0)} kB`)
    }
    const v = await page.evaluate((u) => window.__verify(u), fileUrl(mp4))
    const box = inspectMp4(fs.readFileSync(mp4))
    const poster = inspectWebp(fs.readFileSync(webp))
    const strip = args.review ? await page.evaluate((u) => window.__strip(u, 3), fileUrl(mp4)) : []
    const { mid, seam, last, first, ...vr } = v
    report.push({
      id: clip.id, file: path.relative(outRoot, mp4).replace(/\\/g, '/'), kb: +(fs.statSync(mp4).size / 1000).toFixed(1),
      poster: path.relative(outRoot, webp).replace(/\\/g, '/'), posterKB: +(fs.statSync(webp).size / 1000).toFixed(1),
      posterSize: `${poster.w}x${poster.h}`, posterMeta: poster.metadata, ...box, ...vr, frames: { mid, seam, last, first }, strip,
    })
  }

  if (!only || only.includes('photos')) {
    for (const p of PHOTOS) {
      const dir = path.join(outRoot, p.dir)
      fs.mkdirSync(dir, { recursive: true })
      if (!args['verify-only']) {
        const src = path.join(srcDir, p.src)
        if (!fs.existsSync(src)) throw new Error(`missing source ${src}`)
        const res = await page.evaluate((o) => window.__photo(o), { ...p, url: fileUrl(src) })
        if (res.natural[0] !== p.srcSize[0] || res.natural[1] !== p.srcSize[1]) throw new Error(`${p.id}: source is ${res.natural.join('x')}, expected ${p.srcSize.join('x')}`)
        for (const o of res.outputs) fs.writeFileSync(path.join(dir, `${p.id}-${o.w}.webp`), Buffer.from(o.data, 'base64'))
        res.outputs.forEach((o) => { o.data = undefined })
        p.q = Object.fromEntries(res.outputs.map((o) => [o.w, o.q]))
      }
      for (const o of p.outputs) {
        const name = `${p.id}-${o.w}.webp`
        const f = path.join(dir, name)
        const info = inspectWebp(fs.readFileSync(f))
        const kb = +(fs.statSync(f).size / 1000).toFixed(1)
        photoReport.push({
          file: `${p.dir}/${name}`, size: `${info.w}x${info.h}`, q: p.q ? p.q[o.w] : undefined, kb, maxKB: o.maxKB, chunks: info.chunks,
          ok: info.w === o.w && info.h === o.h && !info.metadata && kb <= o.maxKB,
        })
      }
    }
  }

  if (args.review) await writeReview(args.review)
} finally {
  await browser.close()
  fs.rmSync(tmp, { recursive: true, force: true })
}

let failed = false
for (const r of report) {
  const ok = r.loaded && Number.isFinite(r.duration) && r.width === W && r.height === H && r.autoplayed && r.wraps >= 2 && r.blackFrames === 0 && r.scanBlack === 0 && r.scanned === r.samples && !r.hasAudio && r.kb <= MAX_CLIP_KB && r.posterKB <= MAX_POSTER_KB && r.posterSize === `${W}x${H}` && !r.posterMeta
  failed ||= !ok
  const { frames, strip, ...rest } = r
  console.log(JSON.stringify({ ok, ...rest }))
}
for (const p of photoReport) { failed ||= !p.ok; console.log(JSON.stringify(p)) }
if (failed) process.exitCode = 1

// ---------------------------------------------------------------------------------------------

async function writeReview(out) {
  const img = (f) => `data:image/webp;base64,${fs.readFileSync(f).toString('base64')}`
  const rows = report.map((r) => `<div class=row><b>${r.id}</b>
    <figure><img src="${img(path.join(outRoot, r.poster))}"><figcaption>poster</figcaption></figure>
    <figure><img src="${r.frames.first}"><figcaption>encoded first</figcaption></figure>
    <figure><img src="${r.frames.mid}"><figcaption>encoded mid</figcaption></figure>
    <figure><img src="${r.frames.seam}"><figcaption>loop dissolve</figcaption></figure>
    <figure><img src="${r.frames.last}"><figcaption>encoded last</figcaption></figure></div>
    <div class=row><b>every 3rd frame</b>${r.strip.map((s) => `<figure><img class=st src="${s.img}"><figcaption>${s.i}</figcaption></figure>`).join('')}</div>`).join('')
  const photos = PHOTOS.map((p) => {
    const small = p.outputs.at(-1)
    return `<figure><img class=ph src="${img(path.join(outRoot, p.dir, `${p.id}-${small.w}.webp`))}"><figcaption>${p.dir}/${p.id}-${small.w}.webp</figcaption></figure>`
  }).join('')
  const html = `<!doctype html><style>body{margin:0;background:#1d1d1d;color:#eee;font:13px sans-serif}
    .row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px;padding:6px}.row b{width:90px}
    figure{margin:0}img{height:300px;display:block}.st{height:150px}.ph{height:340px}figcaption{padding:2px 0}</style>
    ${rows}<div class=row><b>photos</b>${photos}</div>`
  const p = path.join(tmp, 'review.html')
  fs.writeFileSync(p, html)
  const pg = await browser.newPage()
  await pg.setViewport({ width: 1600, height: 400 })
  await pg.goto(fileUrl(p))
  await pg.screenshot({ path: out, type: 'jpeg', quality: 82, fullPage: true })
  await pg.close()
  console.log('review sheet', out)
}

// RIFF walk of a WebP: canvas size and the chunk list (a canvas-made WebP has no EXIF / XMP).
function inspectWebp(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return { w: 0, h: 0, chunks: '', metadata: true }
  const chunks = []
  let o = 12, w, h
  while (o + 8 <= buf.length) {
    const t = buf.toString('latin1', o, o + 4), n = buf.readUInt32LE(o + 4), d = o + 8
    chunks.push(t.trim())
    if (t === 'VP8X') { w = 1 + buf.readUIntLE(d + 4, 3); h = 1 + buf.readUIntLE(d + 7, 3) }
    else if (t === 'VP8 ' && w === undefined) { w = buf.readUInt16LE(d + 6) & 0x3fff; h = buf.readUInt16LE(d + 8) & 0x3fff }
    else if (t === 'VP8L' && w === undefined) { const b = buf.readUInt32LE(d + 1); w = (b & 0x3fff) + 1; h = ((b >>> 14) & 0x3fff) + 1 }
    o = d + n + (n & 1)
  }
  return { w, h, chunks: chunks.join(','), metadata: chunks.includes('EXIF') || chunks.includes('XMP') }
}

// WebCodecs samples (AVC, decode order = presentation order) -> progressive MP4 (ftyp, moov,
// mdat), every sample 1/fps. Same as scripts/delivery/clips.mjs.
function muxProgressive(e, fps, width, height) {
  const data = Buffer.from(e.data, 'base64'), avcC = Buffer.from(e.desc, 'base64')
  const sizes = e.sizes, n = sizes.length
  if (!n || !e.keys[0]) throw new Error('mux: first sample is not a key frame')
  if (sizes.reduce((s, x) => s + x, 0) !== data.length) throw new Error('mux: sample sizes do not add up')
  const timescale = fps * 1000, dur = 1000
  const box = (t, ...parts) => { const body = Buffer.concat(parts.map((x) => (Buffer.isBuffer(x) ? x : Buffer.from(x)))); const h = Buffer.alloc(8); h.writeUInt32BE(8 + body.length); h.write(t, 4, 'latin1'); return Buffer.concat([h, body]) }
  const full = (t, vf, ...parts) => { const h = Buffer.alloc(4); h.writeUInt32BE(vf); return box(t, h, ...parts) }
  const ints = (...v) => { const b = Buffer.alloc(v.length * 4); v.forEach((x, i) => b.writeUInt32BE(x >>> 0, i * 4)); return b }
  const u16 = (...v) => { const b = Buffer.alloc(v.length * 2); v.forEach((x, i) => b.writeUInt16BE(x & 0xffff, i * 2)); return b }
  const matrix = ints(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)
  const total = n * dur
  const mvhd = full('mvhd', 0, ints(0, 0, timescale, total, 0x10000), Buffer.from([1, 0, 0, 0]), Buffer.alloc(8), matrix, Buffer.alloc(24), ints(2))
  const tkhd = full('tkhd', 3, ints(0, 0, 1, 0, total), Buffer.alloc(8), Buffer.alloc(8), matrix, ints(width << 16, height << 16))
  const mdhd = full('mdhd', 0, ints(0, 0, timescale, total), Buffer.from([0x55, 0xc4, 0, 0]))
  const hdlr = full('hdlr', 0, ints(0), Buffer.from('vide', 'latin1'), Buffer.alloc(12), Buffer.from('VideoHandler\0', 'latin1'))
  const vmhd = full('vmhd', 1, Buffer.alloc(8))
  const dinf = box('dinf', full('dref', 0, ints(1), full('url ', 1)))
  const avc1 = box('avc1', Buffer.alloc(6), u16(1), Buffer.alloc(16), u16(width, height), ints(0x480000, 0x480000, 0), u16(1), Buffer.alloc(32), u16(0x18, 0xffff), box('avcC', avcC))
  const stsd = full('stsd', 0, ints(1), avc1)
  const stts = full('stts', 0, ints(1, n, dur))
  const syncs = e.keys.map((k, i) => (k ? i + 1 : 0)).filter(Boolean)
  const stss = full('stss', 0, ints(syncs.length, ...syncs))
  const stsc = full('stsc', 0, ints(1, 1, n, 1))
  const stsz = full('stsz', 0, ints(0, n, ...sizes))
  const ftyp = box('ftyp', Buffer.from('isom', 'latin1'), ints(0x200), Buffer.from('isomiso2avc1mp41', 'latin1'))
  const build = (chunkOff) => box('moov', mvhd, box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', vmhd, dinf, box('stbl', stsd, stts, stss, stsc, stsz, full('stco', 0, ints(1, chunkOff)))))))
  const moovLen = build(0).length
  const mdatHdr = Buffer.alloc(8); mdatHdr.writeUInt32BE(8 + data.length); mdatHdr.write('mdat', 4, 'latin1')
  return Buffer.concat([ftyp, build(ftyp.length + moovLen + 8), mdatHdr, data])
}

// Minimal ISO-BMFF walk: codec, profile/level, track handlers, fragmented or not.
function inspectMp4(buf) {
  const boxes = []
  const walk = (start, end, depth, pathName) => {
    let o = start
    while (o + 8 <= end) {
      let size = buf.readUInt32BE(o)
      const type = buf.toString('latin1', o + 4, o + 8)
      let hdr = 8
      if (size === 1) { size = Number(buf.readBigUInt64BE(o + 8)); hdr = 16 }
      if (size === 0) size = end - o
      if (size < hdr) break
      boxes.push({ type, depth, o, size, path: pathName + '/' + type })
      const containers = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'mvex', 'moof', 'traf', 'edts', 'dinf']
      if (containers.includes(type)) walk(o + hdr, o + size, depth + 1, pathName + '/' + type)
      if (type === 'stsd') walk(o + hdr + 8, o + size, depth + 1, pathName + '/' + type)
      if (type === 'avc1') walk(o + hdr + 78, o + size, depth + 1, pathName + '/' + type)
      o += size
    }
  }
  walk(0, buf.length, 0, '')
  const handlers = boxes.filter((b) => b.type === 'hdlr').map((b) => buf.toString('latin1', b.o + 16, b.o + 20))
  const avcC = boxes.find((b) => b.type === 'avcC')
  const codec = boxes.find((b) => b.path.endsWith('stsd/avc1')) ? 'avc1' : '?'
  const profile = avcC ? `avc1.${buf.subarray(avcC.o + 9, avcC.o + 12).toString('hex')}` : null
  return {
    codec: profile || codec,
    topLevel: boxes.filter((b) => b.depth === 0).map((b) => b.type).filter((t, i, a) => a.indexOf(t) === i).join(','),
    fragmented: boxes.some((b) => b.type === 'moof'),
    samples: (() => { const b = boxes.find((x) => x.type === 'stsz'); return b ? buf.readUInt32BE(b.o + 16) : null })(),
    keyframes: (() => { const b = boxes.find((x) => x.type === 'stss'); return b ? buf.readUInt32BE(b.o + 12) : null })(),
    hasAudio: handlers.includes('soun'),
    tracks: handlers.join(','),
  }
}

function parseArgs(a) {
  const o = {}
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue
    const k = a[i].slice(2)
    if (a[i + 1] === undefined || a[i + 1].startsWith('--')) o[k] = true
    else o[k] = a[++i]
  }
  return o
}

// Runs inside the page: defines window.__render, __encodeQP, __release, __verify, __strip, __photo.
function PAGE_HELPERS() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const blobB64 = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b) })
  const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q))
  const load = (url) => new Promise((res, rej) => {
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
    v.onloadeddata = () => res(v); v.onerror = () => rej(new Error(`cannot load ${url} (${v.error && v.error.code})`))
  })
  const seek = (v, t) => new Promise((r) => {
    t = Math.max(0, Math.min(v.duration - 0.001, t))
    v.addEventListener('seeked', r, { once: true }); v.currentTime = t
  })
  const smooth = (a) => a * a * (3 - 2 * a)

  function drawCrop(ctx, src, crop, ow, oh, alpha = 1) {
    const [sx, sy, sw, sh] = crop
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, ow, oh)
    ctx.restore()
  }

  // Segments laid end to end, each overlapping the next by nf frames (the last overlaps the
  // first, wrapping round), N frames in all. Output frame s shows timeline frame (s + nf) mod N,
  // so frame 0 is a clean frame of the first segment and the wrap dissolve ends the file, as
  // in the interiors clips. In an overlap the later segment is drawn over the earlier one.
  window.__render = async (c) => {
    const nf = Math.round(c.fade * c.FPS)
    const segs = []
    for (const s of c.segments) {
      const n = Math.round(Math.abs(s.to - s.from) * c.FPS)
      const dir = s.to < s.from ? -1 : 1
      segs.push({ ...s, n, dir, els: [await load(s.url), await load(s.url)] })
    }
    let o = 0
    for (const s of segs) { s.start = o; o += s.n - nf }
    const N = o
    const k = segs.length
    if (segs.some((s) => s.n < 2 * nf + 1)) throw new Error('a segment is shorter than two fades')
    const cv = document.createElement('canvas'); cv.width = c.W; cv.height = c.H
    const g = cv.getContext('2d')
    const frames = []
    const srcTime = (s, local) => s.from + s.dir * (local / c.FPS)
    for (let i = 0; i < N; i++) {
      const u = (i + nf) % N
      const parts = []
      segs.forEach((s, j) => {
        const local = u - s.start
        if (local >= 0 && local < s.n) parts.push({ s, local, start: s.start })
        if (j === k - 1) { const wl = u + N - s.start; if (wl >= 0 && wl < s.n) parts.push({ s, local: wl, start: s.start - N }) }
      })
      parts.sort((a, b) => a.start - b.start)
      if (parts.length < 1 || parts.length > 2) throw new Error(`frame ${i}: ${parts.length} segments`)
      g.clearRect(0, 0, c.W, c.H)
      for (let p = 0; p < parts.length; p++) {
        const { s, local } = parts[p]
        const el = s.els[p]
        await seek(el, srcTime(s, local) + 0.001)
        // The incoming segment fades in over its first nf frames.
        const alpha = p === 0 ? 1 : smooth((local + 1) / (nf + 1))
        drawCrop(g, el, s.crop, c.W, c.H, alpha)
      }
      frames.push(await createImageBitmap(cv))
    }
    const P = await load(c.poster.url)
    await seek(P, c.poster.t + 0.001)
    g.clearRect(0, 0, c.W, c.H); drawCrop(g, P, c.poster.crop, c.W, c.H)
    let q = 0.86, poster
    for (; q >= 0.4; q -= 0.04) { poster = await toBlob(cv, 'image/webp', q); if (poster.size <= c.maxPosterKB * 1000) break }
    for (const s of segs) for (const el of s.els) { el.removeAttribute('src'); el.load() }
    P.removeAttribute('src'); P.load()
    window.__frames = frames
    const plan = segs.map((s) => `${s.src} ${s.from}->${s.to} s, ${s.n} frames`).join(' + ') + `, ${nf}-frame dissolves`
    return { frames: N, poster: await blobB64(poster), posterQ: +q.toFixed(2), plan }
  }

  window.__encodeQP = async (o) => {
    const cfg = { codec: o.codec, width: o.W, height: o.H, framerate: o.FPS, bitrateMode: 'quantizer', latencyMode: 'quality', avc: { format: 'avc' } }
    if (!(await VideoEncoder.isConfigSupported(cfg)).supported) throw new Error('this Chrome has no constant-quantizer H.264 encoder')
    const parts = [], keys = [], ts = []
    let desc = null, err = null
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description) desc = new Uint8Array(meta.decoderConfig.description)
        const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); parts.push(d); keys.push(chunk.type === 'key'); ts.push(chunk.timestamp)
      },
      error: (e) => { err = e },
    })
    enc.configure(cfg)
    const us = 1e6 / o.FPS
    window.__frames.forEach((bmp, i) => {
      const f = new VideoFrame(bmp, { timestamp: Math.round(i * us), duration: Math.round(us) })
      enc.encode(f, { keyFrame: i === 0, avc: { quantizer: i === 0 ? o.keyQp : o.qp } }); f.close()
    })
    await enc.flush(); enc.close()
    if (err) throw err
    if (!desc) throw new Error('encoder gave no avcC')
    if (ts.some((t, i) => i && t <= ts[i - 1])) throw new Error('encoder reordered frames (B-frames)')
    return { data: await blobB64(new Blob(parts)), sizes: parts.map((p) => p.length), keys, desc: await blobB64(new Blob([desc])) }
  }

  window.__release = () => { (window.__frames || []).forEach((f) => f.close()); window.__frames = null }

  window.__verify = async (url) => {
    const r = { loaded: false }
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.loop = true; v.preload = 'auto'; v.src = url
    document.body.appendChild(v)
    const ok = await new Promise((res) => { v.onloadeddata = () => res(true); v.onerror = () => res(false); setTimeout(() => res(false), 15000) })
    if (!ok) return { ...r, error: v.error && v.error.code }
    r.loaded = true; r.duration = +v.duration.toFixed(3); r.width = v.videoWidth; r.height = v.videoHeight
    const small = document.createElement('canvas'); small.width = 32; small.height = 40
    const sg = small.getContext('2d', { willReadFrequently: true })
    const luma = () => { sg.drawImage(v, 0, 0, 32, 40); const d = sg.getImageData(0, 0, 32, 40).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; return s / (d.length / 4) }
    const grab = async (t) => { await seek(v, t); const c = document.createElement('canvas'); c.width = 240; c.height = 300; c.getContext('2d').drawImage(v, 0, 0, 240, 300); return { img: c.toDataURL('image/jpeg', 0.85), luma: luma() } }
    const first = await grab(0), mid = await grab(v.duration / 2), seam = await grab(v.duration - 0.15), last = await grab(v.duration - 0.02)
    r.scanned = 0; r.scanBlack = 0
    for (let i = 0; i < Math.round(v.duration * 30); i++) { await seek(v, (i + 0.5) / 30); r.scanned++; if (luma() < 16) r.scanBlack++ }
    await seek(v, 0)
    let wraps = 0, prev = -1, black = 0, presented = 0
    const cb = (now, m) => {
      presented++
      if (m.mediaTime < prev) wraps++
      prev = m.mediaTime
      if (luma() < 16) black++
      v.requestVideoFrameCallback(cb)
    }
    v.requestVideoFrameCallback(cb)
    try { await v.play(); r.autoplayed = true } catch (e) { r.autoplayed = false; r.playError = String(e) }
    await sleep(v.duration * 2300 + 400)
    v.pause()
    Object.assign(r, { wraps, presented, blackFrames: black, mid: mid.img, seam: seam.img, last: last.img, first: first.img })
    v.remove()
    return r
  }

  // Every `every`-th frame of the encoded clip, small, for the review sheet (to see that no
  // frame, the dissolves included, shows a person).
  window.__strip = async (url, every) => {
    const v = await load(url)
    const out = []
    const n = Math.round(v.duration * 30)
    for (let i = 0; i < n; i += every) {
      await seek(v, (i + 0.5) / 30)
      const c = document.createElement('canvas'); c.width = 120; c.height = 150
      c.getContext('2d').drawImage(v, 0, 0, 120, 150)
      out.push({ i, img: c.toDataURL('image/jpeg', 0.8) })
    }
    v.removeAttribute('src'); v.load()
    return out
  }

  // One photo -> its crop at each output size, WebP at the best quality in budget.
  window.__photo = async (p) => {
    const img = new Image(); img.src = p.url; await img.decode()
    const outputs = []
    for (const s of p.outputs) {
      const c = document.createElement('canvas'); c.width = s.w; c.height = s.h
      drawCrop(c.getContext('2d'), img, p.crop, s.w, s.h)
      let q = 0.86, b
      for (; q >= 0.4; q -= 0.04) { b = await toBlob(c, 'image/webp', q); if (b.size <= s.maxKB * 1000) break }
      outputs.push({ w: s.w, h: s.h, q: +q.toFixed(2), bytes: b.size, data: await blobB64(b) })
    }
    return { natural: [img.naturalWidth, img.naturalHeight], outputs }
  }
}
