// Builds the web media for the delivery page's "from the port to your plot" section from the
// owner's own delivery footage: four short, silent, looping 4:5 clips (H.264 MP4, 640 x 800),
// a WebP poster for each, and the crane-lift photo as WebP in three crops.
//
// WHY IT LOOKS LIKE THIS: there is no ffmpeg on the build machine, so everything is done in
// headless Chrome (the bundled one Puppeteer ships, which decodes the iPhone HEVC .MOV files):
//   1. every output frame (30 fps) is rendered by seeking the source <video> to the exact time,
//      drawing the crop into a 640 x 800 canvas and keeping it as an ImageBitmap. The last
//      `fade` seconds are dissolved into the frames just before `in`, so the last frame flows
//      into the first (a short double exposure instead of a jump cut; fade: 0 = hard cut);
//   2. the frames are encoded with WebCodecs' VideoEncoder (H.264 High, constant quantizer,
//      one key frame at frame 0, no B-frames) and written in Node as a plain MP4 (moov first,
//      one mdat, every frame exactly 1/30 s, no audio). Each clip takes the lowest (sharpest)
//      quantizer that fits its size budget; the key frame gets a slightly lower one so the
//      loop point is not a soft frame. (MediaRecorder was used before: its rate control made
//      frame 0 visibly blocky, a blip at every loop, and real-time recording dropped frames.)
//   3. each MP4 is verified in Chrome: it loads, its duration is finite, it is 640 x 800,
//      it autoplays muted + playsInline with no user gesture, it loops through at least two
//      wraps, and no frame is black (every frame checked by seeking, plus live playback).
//      Box structure (codec, profile, tracks, no audio) is checked in Node.
//
// RUN (from this project; the sources are the owner's and are never copied into the repo):
//
//   node scripts/delivery/clips.mjs --photo <path/to/2.jpg> [--src C:/Users/kiril/Downloads]
//        [--out public/delivery] [--only port,yard] [--review <sheet.jpg>] [--verify-only]
//
// --src     folder holding IMG_4468.MOV ... (default C:/Users/kiril/Downloads)
// --photo   the crane-lift photo (1500 x 2000); without it the photo crops are skipped
// --only    rebuild only these clip ids (port, yard, truck, plot) — "photo" for the photo
// Budgets (kB = 1000 B): each clip <= 545 kB by default (a clip may set maxKB, or pin a qp),
//           never over 590; each poster <= 69 kB; the four clips <= 2200 kB together
// --review  also write a contact sheet (poster, encoded mid / mid-dissolve / last / first
//           frames per clip, and the photo crops)
// --verify-only  skip encoding, just verify what is in --out
// Exit code 1 if any check or budget fails. Takes about two minutes.
//
// To change a cut, edit the table below. in / out / poster are seconds in the source file
// (in must be >= fade, the dissolve borrows the frames before it); crop is [x, y, w, h] in
// source pixels of the 1080 x 1920 portrait frame and must be 4:5; blur.track is
// [t, centreX, centreY] key points in source pixels, interpolated linearly.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer'

export const CLIPS = [
  {
    // Port: the reach-stacker carries the wrapped, folded house among the sea containers.
    // The camera tracks it smoothly the whole way; 0.6–4.2 s keeps the red machine coming in.
    // Longest clip, so it may take a little more than the default 545 kB (one qp step sharper).
    id: 'port', src: 'IMG_4468.MOV', in: 0.6, out: 4.2, fade: 0.3, poster: 2.5, maxKB: 580,
    crop: [0, 180, 1080, 1350],
  },
  {
    // Yard: the folded unit being pulled out of the 40 ft sea container by the yellow crane.
    // A slow, even pan; 0.5–3.3 s is all of it after the first wobble. The crane-hire phone
    // number on the crane cab (left) is blurred while it is in the crop (it leaves at ~2.3 s).
    id: 'yard', src: 'IMG_4578.MOV', in: 0.5, out: 3.3, fade: 0.3, poster: 1.9,
    crop: [120, 180, 960, 1200],
    blur: { size: [92, 50], radius: 7, track: [[0, 445, 732], [0.4, 418, 761], [0.8, 391, 790], [1.2, 346, 822], [1.6, 288, 858], [2.0, 217, 885], [2.4, 140, 912], [2.8, 60, 940], [3.4, -60, 980]] },
  },
  {
    // Truck: the long module lifted off the flatbed at the yard. 0.4–3.7 s keeps the truck,
    // the worker and the whole lift in view before the camera drifts right onto bare concrete.
    id: 'truck', src: 'IMG_4497.MOV', in: 0.4, out: 3.7, fade: 0.3, poster: 1.0,
    crop: [0, 0, 1080, 1350],
  },
  {
    // Plot: the truck-mounted crane holding the unit over the galvanised ground screws. The
    // steadiest shot of all six (IMG_4472 is closer but swings away after 3 s and shows a
    // second crane-hire number on the boom). Before 1.2 s the camera is still moving (motion
    // blur, the near screw not yet in frame); 1.2–3.95 s is a slow, even drift.
    id: 'plot', src: 'IMG_4474.MOV', in: 1.2, out: 3.95, fade: 0.3, poster: 2.0,
    crop: [0, 320, 1080, 1350],
  },
]

export const PHOTO = {
  // The phone number painted on the crane cab (third-party contact) is lightly blurred.
  blur: { rect: [1378, 942, 104, 44], radius: 7 },
  outputs: [
    { name: 'crane-lift-1500.webp', crop: [0, 170, 1500, 1125], w: 1500, h: 1125, maxKB: 260 },
    { name: 'crane-lift-800.webp', crop: [0, 170, 1500, 1125], w: 800, h: 600, maxKB: 90 },
    { name: 'crane-lift-portrait.webp', crop: [400, 150, 1100, 1375], w: 800, h: 1000, maxKB: 140 },
  ],
}

// Budgets in kB of 1000 bytes, with a little headroom under the 600 / 70 / 2200 kB brief.
const W = 640, H = 800, FPS = 30, MAX_CLIP_KB = 590, MAX_POSTER_KB = 69, MAX_TOTAL_KB = 2200
const TARGET_KB = 545 // 4 x 545 stays under the 2200 total
const CODEC = 'avc1.640028' // asked for; the encoder writes its own level (3.1) into the avcC
const QP_MIN = 22, QP_MAX = 44, KEY_QP_OFFSET = 2 // H.264 quantizer search range; key frame = qp - 2

const here = path.dirname(fileURLToPath(import.meta.url))
const args = parseArgs(process.argv.slice(2))
const srcDir = args.src || 'C:/Users/kiril/Downloads'
const outDir = path.resolve(args.out || path.join(here, '..', '..', 'public', 'delivery'))
const only = args.only ? String(args.only).split(',') : null
fs.mkdirSync(outDir, { recursive: true })

const fileUrl = (p) => pathToFileURL(path.resolve(p)).href

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nvc-clips-'))
fs.writeFileSync(path.join(tmp, 'blank.html'), '<!doctype html><meta charset="utf-8"><body></body>')
// No autoplay override: the verification must see the real "muted autoplay" policy.
const browser = await puppeteer.launch({ headless: true, args: ['--allow-file-access-from-files'] })
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()) })
await page.goto(fileUrl(path.join(tmp, 'blank.html')))
await page.evaluate(PAGE_HELPERS)

const report = []
try {
  for (const clip of CLIPS) {
    if (only && !only.includes(clip.id)) continue
    const mp4 = path.join(outDir, `journey-${clip.id}.mp4`)
    const webp = path.join(outDir, `journey-${clip.id}.webp`)
    if (!args['verify-only']) {
      const src = path.join(srcDir, clip.src)
      if (!fs.existsSync(src)) throw new Error(`missing source ${src}`)
      const res = await page.evaluate((c) => window.__render(c), { ...clip, url: fileUrl(src), W, H, FPS, maxPosterKB: MAX_POSTER_KB })
      fs.writeFileSync(webp, Buffer.from(res.poster, 'base64'))
      // Lowest quantizer (best quality) that fits; a clip may pin its own qp instead.
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
      console.log(`${clip.id}: ${res.frames} frames, ${(chosen.buf.length / 1000).toFixed(0)} kB at qp ${chosen.qp} (key ${Math.max(0, chosen.qp - KEY_QP_OFFSET)}), poster q${res.posterQ} ${(fs.statSync(webp).size / 1000).toFixed(0)} kB`)
    }
    const v = await page.evaluate((u) => window.__verify(u), fileUrl(mp4))
    const box = inspectMp4(fs.readFileSync(mp4))
    report.push({ id: clip.id, src: clip.src, in: clip.in, out: clip.out, file: path.basename(mp4), kb: +(fs.statSync(mp4).size / 1000).toFixed(1), posterKB: +(fs.statSync(webp).size / 1000).toFixed(1), ...box, ...v, mid: undefined, seam: undefined, last: undefined, first: undefined })
    report.at(-1).frames = { mid: v.mid, seam: v.seam, last: v.last, first: v.first }
  }

  if (args.photo && (!only || only.includes('photo')) && !args['verify-only']) {
    const res = await page.evaluate((p) => window.__photo(p), { ...PHOTO, url: fileUrl(args.photo) })
    for (const o of res) {
      fs.writeFileSync(path.join(outDir, o.name), Buffer.from(o.data, 'base64'))
      console.log(`${o.name}: ${o.w}x${o.h} q${o.q} ${(o.bytes / 1000).toFixed(0)} kB`)
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
const total = report.reduce((s, r) => s + r.kb, 0)
console.log(`total clips ${total.toFixed(0)} kB (budget ${MAX_TOTAL_KB})`)
if (failed || (report.length === CLIPS.length && total > MAX_TOTAL_KB)) process.exitCode = 1

// ---------------------------------------------------------------------------------------------

async function writeReview(out) {
  const files = fs.readdirSync(outDir)
  const img = (f) => `data:image/webp;base64,${fs.readFileSync(path.join(outDir, f)).toString('base64')}`
  const rows = report.map((r) => `<div class=row><b>${r.id}</b>
    <figure><img src="${img(`journey-${r.id}.webp`)}"><figcaption>poster</figcaption></figure>
    <figure><img src="${r.frames.mid}"><figcaption>encoded mid</figcaption></figure>
    <figure><img src="${r.frames.seam}"><figcaption>mid loop dissolve</figcaption></figure>
    <figure><img src="${r.frames.last}"><figcaption>encoded last</figcaption></figure>
    <figure><img src="${r.frames.first}"><figcaption>encoded first</figcaption></figure></div>`).join('')
  const photos = files.filter((f) => f.startsWith('crane-lift')).map((f) => `<figure><img class=ph src="${img(f)}"><figcaption>${f}</figcaption></figure>`).join('')
  const html = `<!doctype html><style>body{margin:0;background:#1d1d1d;color:#eee;font:13px sans-serif}
    .row{display:flex;align-items:flex-start;gap:6px;padding:6px}.row b{width:44px}
    figure{margin:0}img{height:300px;display:block}.ph{height:300px}figcaption{padding:2px 0}</style>
    ${rows}<div class=row><b>photo</b>${photos}</div>`
  const p = path.join(tmp, 'review.html')
  fs.writeFileSync(p, html)
  const pg = await browser.newPage()
  await pg.setViewport({ width: 1240, height: 400 })
  await pg.goto(fileUrl(p))
  await pg.screenshot({ path: out, type: 'jpeg', quality: 82, fullPage: true })
  await pg.close()
  console.log('review sheet', out)
}

// WebCodecs samples (AVC format, decode order = presentation order) -> progressive MP4
// (ftyp, moov, mdat). The encoder's own avcC goes into the avc1 sample entry untouched;
// every sample gets duration 1/fps.
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
  // VisualSampleEntry: 6 reserved, data_reference_index, 16 pre-defined/reserved, size,
  // 72 dpi x 2, reserved, frame_count, 32-byte compressor name, depth 24, pre_defined -1.
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
  const codec = boxes.find((b) => b.path.endsWith('stsd/avc1')) ? 'avc1' : (boxes.find((b) => b.depth >= 6 && b.path.includes('stsd/'))?.type || '?')
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

// Runs inside the page: defines window.__encode, window.__verify, window.__photo.
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
  const lerpTrack = (track, t) => {
    let i = 0
    while (i < track.length - 2 && t > track[i + 1][0]) i++
    const [t0, x0, y0] = track[i], [t1, x1, y1] = track[i + 1]
    const k = (t - t0) / (t1 - t0)
    return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]
  }

  // Draw source time t (crop, scale, optional moving blur) into ctx at the given alpha.
  function drawAt(ctx, v, c, t, alpha) {
    const [sx, sy, sw, sh] = c.crop
    ctx.globalAlpha = alpha
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.W, c.H)
    if (c.blur) {
      const s = c.W / sw
      const [cx, cy] = lerpTrack(c.blur.track, t)
      const [bw, bh] = c.blur.size
      softBlur(ctx, (g) => g.drawImage(v, sx, sy, sw, sh, 0, 0, c.W, c.H), (cx - bw / 2 - sx) * s, (cy - bh / 2 - sy) * s, bw * s, bh * s, c.blur.radius * s, 4)
    }
    ctx.globalAlpha = 1
  }

  // Blur one rectangle of what draw() paints, with a feathered edge rather than a hard box.
  function softBlur(ctx, draw, x, y, w, h, radius, feather) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height
    const t = document.createElement('canvas'); t.width = cw; t.height = ch
    const tg = t.getContext('2d')
    tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high'
    tg.filter = `blur(${radius}px)`; draw(tg); tg.filter = 'none'
    const m = document.createElement('canvas'); m.width = cw; m.height = ch
    const mg = m.getContext('2d'); mg.filter = `blur(${feather}px)`; mg.fillStyle = '#000'; mg.fillRect(x, y, w, h)
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(m, 0, 0)
    ctx.drawImage(t, 0, 0)
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
      drawAt(g, A, c, t, 1)
      const intoFade = t - (c.out - c.fade)
      if (c.fade > 0 && intoFade > 0) {
        // Dissolve towards the frames just before IN, so frame n-1 flows into frame 0.
        const tb = t - D
        await seek(B, tb + 0.001)
        const a = intoFade / c.fade
        drawAt(g, B, c, tb, a * a * (3 - 2 * a))
      }
      frames.push(await createImageBitmap(cv))
    }
    // Poster: the chosen frame, same crop and blur.
    await seek(A, c.poster + 0.001)
    g.clearRect(0, 0, c.W, c.H); drawAt(g, A, c, c.poster, 1)
    let q = 0.86, poster
    for (; q >= 0.4; q -= 0.04) { poster = await toBlob(cv, 'image/webp', q); if (poster.size <= c.maxPosterKB * 1000) break }
    A.removeAttribute('src'); B.removeAttribute('src'); A.load(); B.load()
    window.__frames = frames
    return { frames: n, poster: await blobB64(poster), posterQ: +q.toFixed(2) }
  }

  // Encode the rendered frames at a constant quantizer: one key frame (frame 0, at keyQp),
  // the rest P-frames. Returns the samples in decode order plus the encoder's avcC.
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
    // No B-frames: output order must be presentation order.
    if (ts.some((t, i) => i && t <= ts[i - 1])) throw new Error('encoder reordered frames (B-frames)')
    const blob = new Blob(parts)
    return { data: await blobB64(blob), sizes: parts.map((p) => p.length), keys, desc: await blobB64(new Blob([desc])) }
  }

  window.__release = () => { (window.__frames || []).forEach((f) => f.close()); window.__frames = null }

  // Load like the page will (muted, playsInline, loop, no gesture), play two loops and look
  // at every presented frame: count wraps and near-black frames.
  window.__verify = async (url) => {
    const r = { loaded: false }
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.loop = true; v.preload = 'auto'; v.src = url
    document.body.appendChild(v)
    const ok = await new Promise((res) => { v.onloadeddata = () => res(true); v.onerror = () => res(false); setTimeout(() => res(false), 15000) })
    if (!ok) return { ...r, error: v.error && v.error.code }
    r.loaded = true; r.duration = +v.duration.toFixed(3); r.width = v.videoWidth; r.height = v.videoHeight
    r.canPlayType = v.canPlayType('video/mp4; codecs="avc1.640028"')
    const small = document.createElement('canvas'); small.width = 32; small.height = 40
    const sg = small.getContext('2d', { willReadFrequently: true })
    const luma = () => { sg.drawImage(v, 0, 0, 32, 40); const d = sg.getImageData(0, 0, 32, 40).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; return s / (d.length / 4) }
    const grab = async (t) => { await seek(v, t); const c = document.createElement('canvas'); c.width = 240; c.height = 300; c.getContext('2d').drawImage(v, 0, 0, 240, 300); return { img: c.toDataURL('image/jpeg', 0.85), luma: luma() } }
    const first = await grab(0), mid = await grab(v.duration / 2), seam = await grab(v.duration - 0.15), last = await grab(v.duration - 0.02)
    r.firstLuma = +first.luma.toFixed(1); r.lastLuma = +last.luma.toFixed(1)
    // Every frame by seeking (playback in headless Chrome skips frames): none may be black.
    r.scanned = 0; r.scanBlack = 0
    for (let i = 0; i < Math.round(v.duration * 30); i++) { await seek(v, (i + 0.5) / 30); r.scanned++; if (luma() < 16) r.scanBlack++ }
    await seek(v, 0)
    let wraps = 0, prev = -1, black = 0, presented = 0, minL = 255
    const cb = (now, m) => {
      presented++
      if (m.mediaTime < prev) wraps++
      prev = m.mediaTime
      const L = luma(); if (L < 16) black++; if (L < minL) minL = L
      v.requestVideoFrameCallback(cb)
    }
    v.requestVideoFrameCallback(cb)
    try { await v.play(); r.autoplayed = true } catch (e) { r.autoplayed = false; r.playError = String(e) }
    await sleep(v.duration * 2300 + 400)
    v.pause()
    Object.assign(r, { wraps, presented, blackFrames: black, minLuma: +minL.toFixed(1), mid: mid.img, seam: seam.img, last: last.img, first: first.img })
    v.remove()
    return r
  }

  window.__photo = async (p) => {
    const img = new Image(); img.src = p.url; await img.decode()
    const base = document.createElement('canvas'); base.width = img.naturalWidth; base.height = img.naturalHeight
    const bg = base.getContext('2d'); bg.drawImage(img, 0, 0)
    const [bx, by, bw, bh] = p.blur.rect
    softBlur(bg, (g) => g.drawImage(img, 0, 0), bx, by, bw, bh, p.blur.radius, 5)
    const out = []
    for (const o of p.outputs) {
      const c = document.createElement('canvas'); c.width = o.w; c.height = o.h
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
      const [sx, sy, sw, sh] = o.crop
      g.drawImage(base, sx, sy, sw, sh, 0, 0, o.w, o.h)
      let q = 0.84, b
      for (; q >= 0.4; q -= 0.04) { b = await toBlob(c, 'image/webp', q); if (b.size <= o.maxKB * 1000) break }
      out.push({ name: o.name, w: o.w, h: o.h, q: +q.toFixed(2), bytes: b.size, data: await blobB64(b) })
    }
    return out
  }
}
