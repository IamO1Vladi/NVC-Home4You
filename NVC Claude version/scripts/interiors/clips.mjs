// Builds the web media for the interiors page from the owner's own renovation jobs (photos and
// phone videos of an apartment kitchen fit-out and two bathrooms): short, silent, looping 4:5
// clips (H.264 MP4, 640 x 800) with a WebP poster each, and the photos as WebP in two widths.
//
// Same method as scripts/delivery/clips.mjs (read its header for the why): no ffmpeg, so it all
// runs in headless Chrome. Every output frame (30 fps) is rendered by seeking the source video,
// drawn with its crop (and, here, a small roll correction that follows the hand-held camera)
// into a 640 x 800 canvas; the last `fade` seconds dissolve into the frames just before `in`
// so the loop has no jump cut; WebCodecs encodes H.264 High at a constant quantizer (one key
// frame, no B-frames) and Node writes a plain progressive MP4 with no audio. Each clip is then
// verified in Chrome (loads, finite duration, 640 x 800, muted autoplay without a gesture,
// loops at least twice, no black frame) and its box structure is checked in Node. Photos are
// redrawn through a canvas, which also drops every EXIF field (GPS included).
//
// RUN (from this project; the sources are the owner's and are never copied into the repo):
//
//   node scripts/interiors/clips.mjs [--src "C:/Users/kiril/Downloads/iCloud Photos"]
//        [--out public/interiors] [--only bath-black,photos] [--review <sheet.jpg>] [--verify-only]
//
// --only     rebuild only these clip ids, or "photos" for the photos
// Budgets (kB = 1000 B): each clip <= 590 kB (target 560), each poster <= 69 kB,
//            each 1200-wide photo <= 240 kB, each 600-wide photo <= 75 kB
// Exit code 1 if any check or budget fails.
//
// To change a cut, edit the tables below. in / out / poster are seconds in the source file
// (in must be >= fade); crop is [x, y, w, h] in source pixels and must be 4:5 for a clip;
// rot is [t, degrees] key points (positive turns the picture clockwise), interpolated linearly,
// applied about the crop's centre — the crop must stay inside the frame after turning; pan is
// [t, dy] key points that move a clip's crop down by dy source pixels (a slow virtual tilt).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer'

export const CLIPS = [
  {
    // The black-marble bathroom, finished: the wood vanity and basin under the window, then a
    // pan right onto the black shower set on the wood-look tiles. 1.5–4.9 s skips the close
    // toilet at the start. Held level enough (the slant of the walls is the wide lens looking
    // up, not roll), so no rot; the crop follows the phone's tilt (pan) so the basin stays
    // whole under the window and the shower head is not cut off at the end.
    id: 'bath-black', src: 'IMG_8742.MP4', in: 1.5, out: 4.9, fade: 0.3, poster: 2.4,
    crop: [0, 0, 720, 900],
    pan: [[1.5, 150], [2.4, 230], [3.4, 150], [4.0, 100], [4.9, 100]],
  },
  {
    // The white-marble bathroom: the lit niches in the wood-look column, then the glass screen
    // and the chrome shower set. The phone is held rolled clockwise by about 6 degrees, easing
    // to 4.5 by the end; rot turns it back (the 600 x 750 crop leaves room for the turn).
    id: 'bath-white', src: 'IMG_8739.MP4', in: 1.0, out: 4.3, fade: 0.3, poster: 1.4,
    crop: [60, 170, 600, 750],
    rot: [[1.0, -6.5], [2.2, -6], [3.0, -5], [4.3, -4.5]],
  },
]

// Photos: iPhone JPEGs, 1536 x 2048. Each gets a 1200-wide and a 600-wide WebP.
export const PHOTOS = [
  // Black marble + wood-look tiles: the wood vanity, the basin, the black shower set. The
  // wrapped toilet at the bottom right is cropped out.
  { id: 'bath-black', src: 'IMG_8578.JPEG', crop: [0, 40, 1384, 1730], rot: 0 },
  // The finished kitchen from across the room: fridge, tall unit, white wall cabinets, the dark
  // base run with the washing machine and oven. The tools on the floor are cropped out.
  { id: 'kitchen', src: 'IMG_8590.JPEG', crop: [0, 530, 1536, 960], rot: 0 },
  // The same kitchen along its full length, by the windows ("after").
  { id: 'kitchen-run', src: 'IMG_8591.JPEG', crop: [190, 280, 1346, 1682], rot: 0 },
  // The same run mid-fit: doors going on, packaging on the floor ("before").
  { id: 'kitchen-progress', src: 'IMG_8588.JPEG', crop: [60, 160, 1476, 1845], rot: 0 },
  // Fitting the cabinets: wall units open, the ladder up, the counter being finished.
  { id: 'kitchen-fitting', src: 'IMG_8586.JPEG', crop: [40, 128, 1496, 1870], rot: 0 },
]
const PHOTO_SIZES = [{ w: 1200, maxKB: 240 }, { w: 600, maxKB: 75 }]

const W = 640, H = 800, FPS = 30, MAX_CLIP_KB = 590, MAX_POSTER_KB = 69, TARGET_KB = 560
const CODEC = 'avc1.640028'
const QP_MIN = 22, QP_MAX = 44, KEY_QP_OFFSET = 2

const here = path.dirname(fileURLToPath(import.meta.url))
const args = parseArgs(process.argv.slice(2))
const srcDir = args.src || 'C:/Users/kiril/Downloads/iCloud Photos'
const outDir = path.resolve(args.out || path.join(here, '..', '..', 'public', 'interiors'))
const only = args.only ? String(args.only).split(',') : null
fs.mkdirSync(outDir, { recursive: true })

const fileUrl = (p) => pathToFileURL(path.resolve(p)).href

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nvc-interiors-'))
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
    const mp4 = path.join(outDir, `clip-${clip.id}.mp4`)
    const webp = path.join(outDir, `clip-${clip.id}.webp`)
    if (!args['verify-only']) {
      const src = path.join(srcDir, clip.src)
      if (!fs.existsSync(src)) throw new Error(`missing source ${src}`)
      const res = await page.evaluate((c) => window.__render(c), { ...clip, url: fileUrl(src), W, H, FPS, maxPosterKB: MAX_POSTER_KB })
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
      console.log(`${clip.id}: ${res.frames} frames, ${(chosen.buf.length / 1000).toFixed(0)} kB at qp ${chosen.qp}, poster q${res.posterQ} ${(fs.statSync(webp).size / 1000).toFixed(0)} kB`)
    }
    const v = await page.evaluate((u) => window.__verify(u), fileUrl(mp4))
    const box = inspectMp4(fs.readFileSync(mp4))
    const { mid, seam, last, first, ...vr } = v
    report.push({ id: clip.id, src: clip.src, in: clip.in, out: clip.out, file: path.basename(mp4), kb: +(fs.statSync(mp4).size / 1000).toFixed(1), posterKB: +(fs.statSync(webp).size / 1000).toFixed(1), ...box, ...vr, frames: { mid, seam, last, first } })
  }

  if ((!only || only.includes('photos')) && !args['verify-only']) {
    for (const p of PHOTOS) {
      const src = path.join(srcDir, p.src)
      if (!fs.existsSync(src)) throw new Error(`missing source ${src}`)
      const res = await page.evaluate((o) => window.__photo(o), { ...p, url: fileUrl(src), sizes: PHOTO_SIZES })
      for (const o of res) {
        const name = `${p.id}-${o.w}.webp`
        fs.writeFileSync(path.join(outDir, name), Buffer.from(o.data, 'base64'))
        photoReport.push({ name, w: o.w, h: o.h, q: o.q, kb: +(o.bytes / 1000).toFixed(1), ok: o.bytes <= o.maxKB * 1000 })
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
  const ok = r.loaded && Number.isFinite(r.duration) && r.width === W && r.height === H && r.autoplayed && r.wraps >= 2 && r.blackFrames === 0 && r.scanBlack === 0 && r.scanned === r.samples && !r.hasAudio && r.kb <= MAX_CLIP_KB && r.posterKB <= MAX_POSTER_KB
  failed ||= !ok
  const { frames, ...rest } = r
  console.log(JSON.stringify({ ok, ...rest }))
}
for (const p of photoReport) { failed ||= !p.ok; console.log(JSON.stringify(p)) }
if (failed) process.exitCode = 1

// ---------------------------------------------------------------------------------------------

async function writeReview(out) {
  const files = fs.readdirSync(outDir)
  const img = (f) => `data:image/webp;base64,${fs.readFileSync(path.join(outDir, f)).toString('base64')}`
  const rows = report.map((r) => `<div class=row><b>${r.id}</b>
    <figure><img src="${img(`clip-${r.id}.webp`)}"><figcaption>poster</figcaption></figure>
    <figure><img src="${r.frames.first}"><figcaption>encoded first</figcaption></figure>
    <figure><img src="${r.frames.mid}"><figcaption>encoded mid</figcaption></figure>
    <figure><img src="${r.frames.seam}"><figcaption>mid loop dissolve</figcaption></figure>
    <figure><img src="${r.frames.last}"><figcaption>encoded last</figcaption></figure></div>`).join('')
  const photos = files.filter((f) => f.endsWith('-600.webp')).map((f) => `<figure><img class=ph src="${img(f)}"><figcaption>${f}</figcaption></figure>`).join('')
  const html = `<!doctype html><style>body{margin:0;background:#1d1d1d;color:#eee;font:13px sans-serif}
    .row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px;padding:6px}.row b{width:70px}
    figure{margin:0}img{height:300px;display:block}.ph{height:340px}figcaption{padding:2px 0}</style>
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

// Runs inside the page: defines window.__render, __encodeQP, __release, __verify, __photo.
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
  const lerp = (track, t) => {
    if (!track || !track.length) return 0
    if (track.length === 1 || t <= track[0][0]) return track[0][1]
    let i = 0
    while (i < track.length - 2 && t > track[i + 1][0]) i++
    const [t0, a0] = track[i], [t1, a1] = track[i + 1]
    const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)))
    return a0 + (a1 - a0) * k
  }

  // A clip's crop at source time t: the crop moved down by the `pan` track (source pixels).
  const cropAt = (c, t) => [c.crop[0], c.crop[1] + lerp(c.pan, t), c.crop[2], c.crop[3]]

  // Draw the crop [sx, sy, sw, sh] of src into a ow x oh context, turned by deg (clockwise)
  // about the crop's centre.
  function drawCrop(ctx, src, crop, ow, oh, deg, alpha = 1) {
    const [sx, sy, sw, sh] = crop
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.translate(ow / 2, oh / 2)
    ctx.scale(ow / sw, oh / sh)
    ctx.rotate((deg * Math.PI) / 180)
    ctx.drawImage(src, -(sx + sw / 2), -(sy + sh / 2))
    ctx.restore()
  }

  window.__render = async (c) => {
    const A = await load(c.url), B = await load(c.url)
    const cv = document.createElement('canvas'); cv.width = c.W; cv.height = c.H
    const g = cv.getContext('2d')
    const D = c.out - c.in
    const n = Math.round(D * c.FPS)
    const frames = []
    for (let i = 0; i < n; i++) {
      const t = c.in + i / c.FPS
      await seek(A, t + 0.001)
      g.clearRect(0, 0, c.W, c.H)
      drawCrop(g, A, cropAt(c, t), c.W, c.H, lerp(c.rot, t))
      const intoFade = t - (c.out - c.fade)
      if (c.fade > 0 && intoFade > 0) {
        const tb = t - D
        await seek(B, tb + 0.001)
        const a = intoFade / c.fade
        drawCrop(g, B, cropAt(c, tb), c.W, c.H, lerp(c.rot, tb), a * a * (3 - 2 * a))
      }
      frames.push(await createImageBitmap(cv))
    }
    await seek(A, c.poster + 0.001)
    g.clearRect(0, 0, c.W, c.H); drawCrop(g, A, cropAt(c, c.poster), c.W, c.H, lerp(c.rot, c.poster))
    let q = 0.86, poster
    for (; q >= 0.4; q -= 0.04) { poster = await toBlob(cv, 'image/webp', q); if (poster.size <= c.maxPosterKB * 1000) break }
    A.removeAttribute('src'); B.removeAttribute('src'); A.load(); B.load()
    window.__frames = frames
    return { frames: n, poster: await blobB64(poster), posterQ: +q.toFixed(2) }
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

  // One photo -> the crop (turned by rot) at each width, WebP at the best quality in budget.
  window.__photo = async (p) => {
    const img = new Image(); img.src = p.url; await img.decode()
    const [, , sw, sh] = p.crop
    const out = []
    for (const s of p.sizes) {
      const w = s.w, h = Math.round((s.w * sh) / sw)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      drawCrop(c.getContext('2d'), img, p.crop, w, h, p.rot || 0)
      let q = 0.9, b
      for (; q >= 0.4; q -= 0.04) { b = await toBlob(c, 'image/webp', q); if (b.size <= s.maxKB * 1000) break }
      out.push({ w, h, q: +q.toFixed(2), bytes: b.size, maxKB: s.maxKB, data: await blobB64(b) })
    }
    return out
  }
}
