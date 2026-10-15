// The partner page hero's drawing: the order's journey, factory → sea, rail or air → a warehouse,
// as one line drawing with a camera that follows it (option B, chosen by the owner's team on
// 2026-10-15; the prototype was partner-anim/line). SVG, CSS and this file, no library, no photo.
//
// THE FIRST RENDER IS THE POSTER. The world below is one string; bake() runs the same render()
// the animation runs, on plain records instead of elements, and writes that frame's transforms
// into the markup. So the server, the prerendered snapshot (whose browser never starts the
// engine) and the first client paint show the opening frame with every label, no waiting states.
// The engine starts in an effect and plays only while the drawing is on screen, the tab is
// visible and nobody pressed pause; on a phone or a touch screen it draws at 30fps. Reduced
// motion: three still panels (baked the same way), which are in the server markup too, and CSS
// (the media query) picks stage or panels, so nothing jumps when the script arrives; the script
// only stops the engine and redraws the panels when a switch is pressed. The transport moves to
// the next one each loop until the visitor picks one. The narrow layout is a container query
// (PartnerJourney.css), so the first paint is already the right one.
//
// Every word is the content's `journey` block. The colours are the --hp-* tokens
// (PartnerJourney.css), so data-theme light and dark both hold.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import '../../style/PartnerJourney.css'

const T = 13.6
const ACT = [0, 3.4, 8.8]
const END = [3.4, 8.8, 13.6]
const SB = [1.6, 5.6, 12.4]
const WW = 1240
export const MODES = ['sea', 'rail', 'air']
const GY = 220, PICK = 290, TX = 780, KX = 1122, WX = 1010, DX = 1004
const LX = { sea: 410, rail: 366, air: 400 }, EX = { sea: 610, rail: 600, air: 590 }
const LY = { sea: 196, rail: 204, air: 200 }, UX = { sea: 610, rail: 600, air: 705 }, UY = { sea: 196, rail: 204, air: 220 }
const VB = '0 16 450 246'

const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const ez = (v) => { v = cl(v); return v < 0.5 ? 2 * v * v : 1 - Math.pow(2 - 2 * v, 2) / 2 }
const sg = (t, a, b) => ez((t - a) / (b - a))
const lp = (a, b, u) => a + (b - a) * u

/* ---- the world, as markup. data-k names what moves, data-m / data-a what belongs to one
   transport or one arrival, data-d "start duration" a line that draws itself in. ---- */
const K = (k) => ` data-k="${k}"`
const P = (c, d, dd, x) => `<path class="${c}"${dd ? ` data-d="${dd}"` : ''}${x || ''} d="${d}"/>`
const C = (c, x, y, r, dd, a) => `<circle class="${c}" cx="${x}" cy="${y}" r="${r}"${dd ? ` data-d="${dd}"` : ''}${a || ''}/>`
const G = (s, x) => `<g${x || ''}>${s}</g>`
const at = (x, y, s) => `<g transform="translate(${x} ${y})">${s}</g>`
function wave(x0, x1, y, a, p) {
  const h = p / 2
  let s = `M${x0} ${y}q${p / 4} ${-a} ${h} 0`
  for (let x = x0 + h; x < x1 - h; x += h) s += `t${h} 0`
  return s
}
const puffs = (p, r) => [0, 1, 2].map((j) => C('mu', 0, 0, r, '', K(p + j))).join('')

let sl = '', po = '', rw = '', lat = 'M250 214'
for (let i = 286; i < 700; i += 12) sl += `M${i} 222v4`
for (let i = 430; i < 700; i += 84) po += `M${i} 220V162M${i - 4} 166h8`
for (let i = 336; i < 690; i += 38) rw += `M${i} 230h18`
for (let i = 0; i < 10; i++) lat += `L${i % 2 ? 244 : 256} ${214 - 14 * i}`
const CLOUD = 'M-26 0H26A9 9 0 0 0 17-14A13 13 0 0 0-6-19A11 11 0 0 0-26 0Z'
const UNIT = '<rect class="ac cf" x="-34" y="-28" width="68" height="28" rx="2"/>' + P('ac th', 'M-20-28V0M20-28V0') + P('ac th ds', 'M-34-14H34')
const CRATES = '<rect class="ac cf" x="-24" y="-22" width="22" height="22" rx="1.5"/><rect class="ac cf" x="2" y="-22" width="22" height="22" rx="1.5"/>' + P('ac th', 'M-24-11H-2M2-11H24')

const W = '<g' + K('w') + '><g' + K('cam') + '>'
  // far layer, slower than the world (parallax)
  + '<g' + K('far') + '><g' + K('fc') + '>' + [[150, 58], [430, 104], [660, 84], [890, 96], [1150, 70]].map(([x, y]) => at(x, y, P('mu', CLOUD))).join('') + '</g>'
  + G(P('mu', 'M356 214Q376 203 396 211Q408 206 422 214M480 214Q512 198 542 209Q556 203 574 214M620 214Q636 207 652 214'), K('fm0') + ' data-m="sea"')
  + G(P('mu', 'M300 210Q340 192 390 204T490 196T590 206T690 200'), K('fm1') + ' data-m="rail"')
  + '</g>'
  // the destination: mountains (Pirin) for ours, trees for yours
  + P('mu', 'M850 204L892 178L916 190L962 150L994 172L1024 156L1062 122L1100 156L1126 146L1172 174L1204 160L1240 178', '9 1.2', ' data-a="ours"')
  + G(P('mu', 'M892 220V198M892 198a10 13 0 1 1 .1 0M916 220V204M916 204a7 9 0 1 1 .1 0', '9.2 .8'), ' data-a="yours"')
  // ground and road
  + P('ln', 'M0 220H280') + P('ln', 'M700 220H1240') + P('mu rd', 'M716 230H1240')
  + G(P('ln', 'M280 220H330V234M700 220V234') + G(P('mu', wave(340, 692, 225, 3, 26)), K('wv0')), ' data-m="sea"')
  + G(P('ln', 'M280 220H700') + P('mu', sl) + P('mu', po) + P('mu th', 'M410 169H690'), ' data-m="rail"')
  + G(P('ln', 'M280 220H700') + P('mu', rw) + G(P('mu', CLOUD), K('nc0')) + G(P('mu', CLOUD), K('nc1')), ' data-m="air"')
  // the factory
  + P('ln f', 'M16 220V150L66 122V150L116 122V150L166 122V150L216 122V220Z')
  + P('mu', 'M66 128V150M116 128V150M166 128V150M216 128V150M28 164h24v13h-24zM70 164h24v13h-24zM112 164h24v13h-24zM16 196H146')
  + P('ln pf', 'M150 220V176H208V220Z') + P('mu', 'M150 183H208') + '<rect class="mu ds" x="158" y="194" width="42" height="26" rx="1.5"/>'
  + P('ln f', 'M28 143V96H42V135Z') + G(puffs('s', 5))
  // the warehouse, drawn in for the third act
  + P('ln f', 'M946 220V164L1010 132L1074 164V220Z', '8.8 .9') + P('ln', 'M934 170L1010 126L1086 170', '9.1 .6')
  + P('ln pf', 'M984 220V182H1036V220Z', '9.3 .5') + P('mu', 'M984 191H1036M984 199H1036M984 207H1036M960 176h14v10h-14zM1046 176h14v10h-14z', '9.5 .5')
  // the factory's tower crane
  + '<g' + K('crn') + '>' + P('ln', 'M244 220V70M256 220V70M232 220H268') + P('mu', lat) + P('ln', 'M190 70H452M244 70L250 42L256 70') + P('mu', 'M250 42L452 70M250 42L190 70')
  + '<rect class="ln f" x="194" y="70" width="20" height="13" rx="1"/><rect class="ln f" x="256" y="72" width="12" height="11" rx="1"/>'
  + G('<rect class="ln f" x="-7" y="0" width="14" height="5"/>', K('trl')) + '<line class="ln bt"' + K('cb') + ' x2="0" y2="1"/>' + P('ln', 'M0 0V6M-6 6H6', '', K('hk')) + '</g>'
  // the ship, the train, the plane
  + G(P('mu', 'M-84 22h-24M-92 27h-42M-78 16h-14', '', K('wk'))
    + P('ln f', 'M-80 0H84L72 24H-70Z') + P('mu', 'M-76 10H80') + P('mu f', 'M38 0V-14H74V0ZM38-14V-28H74V-14ZM56-28V0')
    + P('ln f', 'M-74 0V-30H-48V0Z') + P('mu', 'M-70-22H-52M-70-14H-52') + P('ln f', 'M-66-30V-40H-56V-30Z') + P('ln', 'M80 0V-14'), K('sea') + ' data-m="sea"')
  + G(P('ln f', 'M-38 0H38V6H-38Z') + P('ln', 'M-38 3H-45M38 3H44')
    + P('ln f', 'M44 8V-16L52-24H100L108-16V8Z') + P('mu', 'M52-17h8v6h-8zM92-17h8v6h-8zM66-10H86') + P('ln', 'M66-24L74-32L82-24M74-32V-35M68-35H80')
    + [-28, -16, 16, 28, 58, 74, 94].map((x) => C('ln f', x, 11, 5)).join(''), K('rail') + ' data-m="rail"')
  + G(P('mu', 'M-86-31h-50M-80-22h-34', '', K('ctr'))
    + P('ln f', 'M-82 0L-73-29L-84-55H-71L-47-29H48Q79-29 83-9Q83 0 72 0Z') + P('mu', 'M56-22Q69-21 75-13H56Z') + P('mu', 'M-26-26H26V-3H-26Z')
    + P('ln f', 'M-16 2h34a5.5 5.5 0 0 1 0 11h-34a5.5 5.5 0 0 1 0-11Z') + P('ln', 'M-58 0V9M60 0V9') + C('ln f', -58, 13, 4) + C('ln f', 60, 13, 4), K('air') + ' data-m="air"')
  + G(G(P('mu', wave(346, 688, 235, 2.2, 32)), K('wv1')) + G(puffs('k', 4)), ' data-m="sea"')
  // the truck with its own crane
  + G(P('ln', 'M-40 0V-34') + P('ln f', 'M-40 0H38V6H-40Z') + P('ln', 'M-40 9H44') + P('ln f', 'M44 12V-26H62L74-10V12Z') + P('mu', 'M49-21H60L67-10H49Z')
    + C('ln f', -24, 13, 7) + C('ln f', -8, 13, 7) + C('ln f', 60, 13, 7), K('trk'))
  // the cargo: a unit, or by air smaller crates
  + G(G(UNIT, K('u')) + G(CRATES, K('c')), K('cgo'))
  + G('<line class="bo bt" x2="1"/><line class="bi bt" x2="1"/>', K('bm')) + '<line class="ln bt"' + K('cb2') + ' x2="0" y2="1"/>'
  // delivered
  + G(C('sg pf', 0, 0, 15, '11.1 .3') + P('sg', 'M-6.5 .5L-2 5L6.5-4.5', '11.3 .25'), K('bdg'))
  + '</g></g>'

/* ---- one frame. The same code moves the live elements and the poster's records. ---- */
function scene(list, get, svg) {
  const s = { svg, k: {}, ms: [], as: [], dr: [], m: 0, a: 0, ok: 0, kk: 0, uz: 0 }
  for (const e of list) {
    const k = get(e, 'data-k'), m = get(e, 'data-m'), a = get(e, 'data-a'), d = get(e, 'data-d')
    if (k) s.k[k] = e
    if (m) s.ms.push([e, m])
    if (a) s.as.push([e, a])
    if (d && svg) {
      const p = d.split(' ')
      s.dr.push({ e, s: +p[0], d: +p[1], f: /\b(f|pf)\b/.test(get(e, 'class')), n: 0, v: -1 })
    }
  }
  return s
}
function tf(e, v) { if (e.__t !== v) { e.__t = v; if (e.setAttribute) e.setAttribute('transform', v) } }
function op(e, v) { v = Math.round(v * 100) / 100; if (e.__o !== v) { e.__o = v; if (e.style) e.style.opacity = v } }
function sh(e, on) { if (e.__s !== on) { e.__s = on; if (e.style) e.style.display = on ? '' : 'none' } }
function measure(sc) {
  if (sc.ok || !sc.svg.getBoundingClientRect().width) return
  for (const [e] of sc.ms.concat(sc.as)) { e.style.display = ''; e.__s = undefined }
  for (const d of sc.dr) {
    try { d.n = Math.ceil(d.e.getTotalLength()) + 1 } catch { d.n = 0 }
    d.e.style.strokeDasharray = `${d.n} ${d.n + 9}`
    d.v = -1
  }
  sc.m = sc.a = 0
  sc.ok = 1
}
const AL = (u) => 72 * (sg(u, 0.1, 0.42) - sg(u, 0.6, 0.94))
function veh(m, t) {
  const u = sg(t, 3.7, 7.3), o = { u, x: lp(LX[m], EX[m], u), y: 0, alt: 0, r: 0 }
  if (m === 'air') {
    o.alt = AL(u)
    o.r = Math.max(-12, Math.min(3, -Math.atan2(AL(u + 0.004) - AL(u - 0.004), 0.008 * (EX.air - LX.air)) * 20))
  } else if (m === 'sea') { o.y = Math.sin(t * 1.9) * 1.2; o.r = Math.sin(t * 1.3) * 0.8 }
  return o
}
// The camera: centre x, centre y, zoom (the viewBox is 450 wide, its centre 225/139).
function camAt(m, t, V) {
  const A = sg(t, 3.4, 4.3), B = sg(t, 7.2, 8), Q = sg(t, 8.8, 9.9)
  let x = lp(225, V.x + (m === 'rail' ? 30 : 0), A), y = lp(139, 159 - V.alt * 0.6, A), z = lp(1, 1.45, A)
  x = lp(x, (EX[m] + TX) / 2, B); y = lp(y, 139, B); z = lp(z, 1, B)
  x = lp(x, 1040, Q); y = lp(y, 146, Q); z = lp(z, 1.12, Q)
  const hw = 225 / z
  return [Math.max(hw, Math.min(WW - hw, x)), y, z]
}

function render(sc, t, m, a, cam, fin) {
  const k = sc.k, V = veh(m, t), air = m === 'air', H = air ? 22 : 28
  const lx = LX[m], ly = LY[m], ex = UX[m], ey = UY[m]
  let f
  if (sc.m !== m || sc.a !== a) {
    sc.m = m; sc.a = a
    for (const [e, v] of sc.ms) sh(e, v === m)
    for (const [e, v] of sc.as) sh(e, v === a)
  }
  for (const d of sc.dr) {
    const p = sg(t, d.s, d.s + d.d), v = Math.round(d.n * (1 - p) * 10) / 10
    if (v !== d.v) { d.v = v; d.e.style.strokeDashoffset = v; if (d.f) d.e.style.fillOpacity = Math.round(p * 20) / 20 }
  }
  // the camera, and a stroke that stays about 2px whatever the zoom
  const c = cam ? camAt(m, t, V) : [0, 0, 1], z = Math.round(c[2] * 20) / 20
  if (sc.svg) {
    if (!sc.kk) { const w = sc.svg.getBoundingClientRect().width; if (w) sc.kk = 450 / w }
    if (sc.uz !== z) { sc.uz = z; sc.svg.style.setProperty('--u', ((sc.kk || 0.8) / z).toFixed(3)) }
  }
  tf(k.cam, cam ? `translate(225 139) scale(${c[2].toFixed(3)}) translate(${(-c[0]).toFixed(1)} ${(-c[1]).toFixed(1)})` : '')
  tf(k.far, cam ? `translate(${((c[0] - 225) * 0.62).toFixed(1)} 0)` : '')
  tf(k.fc, `translate(${(t * 3).toFixed(1)} 0)`)
  const env = cam ? sg(t, 3.3, 4.1) * (1 - sg(t, 7.3, 8.1)) : 1
  op(k.fm0, env); op(k.fm1, env)
  op(k.w, (fin ? sg(t, 0, 0.35) : 1) * (1 - sg(t, T - 0.5, T)))
  // smoke, waves, clouds
  ;[k.s0, k.s1, k.s2].forEach((e, j) => {
    const p = (t * 0.42 + j / 3) % 1
    tf(e, `translate(${(35 + p * 12).toFixed(1)} ${(90 - p * 34).toFixed(1)}) scale(${(0.5 + p).toFixed(2)})`)
    op(e, Math.sin(p * Math.PI) * 0.9)
  })
  tf(k.wv0, `translate(${(Math.sin(t * 1.2) * 5).toFixed(1)} 0)`)
  tf(k.wv1, `translate(${(-Math.sin(t * 1.2 + 1) * 6).toFixed(1)} 0)`)
  tf(k.nc0, `translate(${(470 + t * 4).toFixed(1)} 112)`)
  tf(k.nc1, `translate(${(640 - t * 3).toFixed(1)} 78)`)
  // the vehicle
  const ve = k[m], vo = 1 - sg(t, 8.9, 9.3)
  if (m === 'sea') tf(ve, `translate(${V.x.toFixed(1)} ${(196 + V.y).toFixed(2)}) rotate(${V.r.toFixed(2)} 0 10)`)
  else if (m === 'rail') tf(ve, `translate(${V.x.toFixed(1)} 204)`)
  else tf(ve, `translate(${V.x.toFixed(1)} ${(203 - V.alt).toFixed(1)}) rotate(${V.r.toFixed(2)} -40 8)`)
  op(ve, vo)
  const mv = Math.sin(Math.PI * V.u)
  op(k.wk, mv); op(k.ctr, (V.alt / 72) * 0.9)
  ;[k.k0, k.k1, k.k2].forEach((e, j) => {
    const p = (t * 0.55 + j / 3) % 1
    tf(e, `translate(${(V.x - 61 - p * 22).toFixed(1)} ${(155 + V.y - p * 26).toFixed(1)}) scale(${(0.5 + p).toFixed(2)})`)
    op(e, Math.sin(p * Math.PI) * 0.8 * (0.35 + 0.65 * mv) * vo)
  })
  // the cargo
  const kx = t < 9.05 ? TX : lp(TX, KX, sg(t, 9.05, 10))
  let cx = PICK, cy = GY, co = 1, rr = 0
  if (t < 0.75) { /* waits on the ground */ }
  else if (t < 1.2) cy = lp(GY, 112, sg(t, 0.75, 1.2))
  else if (t < 2) { cx = lp(PICK, lx, sg(t, 1.2, 2)); cy = 112 }
  else if (t < 2.5) { cx = lx; cy = lp(112, ly, sg(t, 2, 2.5)) }
  else if (t < 7.95) {
    if (air) {
      cx = t < 2.8 ? lx : t < 7.45 ? V.x : ex
      cy = t < 7.45 ? ly - V.alt : ey
      co = t < 2.8 ? 1 - sg(t, 2.5, 2.8) : t < 7.45 ? 0 : sg(t, 7.45, 7.75)
    } else { cx = V.x; cy = ly + V.y; rr = V.r }
  } else if (t < 8.2) { cx = ex; cy = lp(ey, ey - 40, sg(t, 7.95, 8.2)) }
  else if (t < 8.7) { f = sg(t, 8.2, 8.7); cx = lp(ex, TX, f); cy = lp(ey - 40, 160, f) }
  else if (t < 8.9) { cx = TX; cy = lp(160, 200, sg(t, 8.7, 8.9)) }
  else if (t < 10.2) { cx = kx; cy = 200 }
  else if (t < 10.4) { cx = KX; cy = lp(200, 160, sg(t, 10.2, 10.4)) }
  else if (t < 10.9) { cx = lp(KX, DX, sg(t, 10.4, 10.9)); cy = 160 }
  else if (t < 11.1) { cx = DX; cy = lp(160, GY, sg(t, 10.9, 11.1)) }
  else { cx = DX; cy = GY }
  sh(k.u, !air); sh(k.c, air)
  tf(k.cgo, `translate(${cx.toFixed(1)} ${cy.toFixed(2)})${rr ? ` rotate(${rr.toFixed(2)} 0 10)` : ''}`)
  op(k.cgo, co)
  // the factory's crane
  const tx = t < 1.2 ? PICK : t < 2 ? cx : t < 2.9 ? lx : lp(lx, PICK, sg(t, 2.9, 3.6))
  let L = 25
  if (t >= 0.25 && t < 0.75) L = lp(25, GY - H - 81, sg(t, 0.25, 0.7))
  else if (t >= 0.75 && t < 2.5) L = cy - H - 81
  else if (t >= 2.5 && t < 2.9) L = lp(ly - H - 81, 25, sg(t, 2.5, 2.9))
  const ho = cam ? 1 - sg(t, 3.3, 3.8) : 1
  op(k.cb, ho); op(k.hk, ho); op(k.crn, cam ? 1 - sg(t, 3.9, 4.5) : 1)
  tf(k.trl, `translate(${tx.toFixed(1)} 70)`)
  tf(k.cb, `translate(${tx.toFixed(1)} 75) scale(1 ${Math.max(L, 0.1).toFixed(1)})`)
  tf(k.hk, `translate(${tx.toFixed(1)} ${(75 + L).toFixed(1)})`)
  // the truck and its crane
  const px = kx - 40, py = 166, rx = px + 66
  let bx = rx, by = py, c2 = 0
  tf(k.trk, `translate(${kx.toFixed(1)} 200)`)
  if (t >= 7.6 && t < 7.95) { f = sg(t, 7.6, 7.95); bx = lp(rx, ex, f); by = lp(py, ey - H - 16, f); c2 = f }
  else if ((t >= 7.95 && t < 8.9) || (t >= 10.2 && t < 11.1)) { bx = cx; by = cy - H - 16; c2 = 1 }
  else if (t >= 8.9 && t < 9.05) { f = sg(t, 8.9, 9.05); bx = lp(TX, rx, f); by = lp(200 - H - 16, py, f); c2 = 1 - f }
  else if (t >= 10 && t < 10.2) { f = sg(t, 10, 10.2); bx = lp(rx, KX, f); by = lp(py, 200 - H - 16, f); c2 = f }
  else if (t >= 11.1 && t < 11.3) { f = sg(t, 11.1, 11.3); bx = lp(DX, rx, f); by = lp(GY - H - 16, py, f); c2 = 1 - f }
  const bl = Math.hypot(bx - px, by - py), ba = Math.atan2(by - py, bx - px) * 57.2958
  tf(k.bm, `translate(${px.toFixed(1)} ${py}) rotate(${ba.toFixed(2)}) scale(${bl.toFixed(1)} 1)`)
  tf(k.cb2, `translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(1 16)`)
  op(k.cb2, c2)
  // the payoff: the seal pops on the gable and holds
  f = sg(t, 11.1, 11.45)
  tf(k.bdg, `translate(${WX} 152) scale(${(0.7 + 0.3 * f + Math.sin(f * Math.PI) * 0.14).toFixed(3)})`)
}

/* ---- a frame as markup, for the poster and the reduced-motion panels: no DOM needed. The
   lines that draw themselves in are left drawn (they are off camera at the poster's moment). */
const TAG = /<(\w+)([^>]*?)(\/?)>/g
const attr = (r, n) => (r.at.match(new RegExp(` ${n}="([^"]*)"`)) || [])[1]
export function bake(t, m, a, cam) {
  const recs = []
  W.replace(TAG, (x, n, at) => { recs.push({ at }); return x })
  render(scene(recs, attr, null), t, m, a, cam, false)
  let i = 0
  return W.replace(TAG, (x, n, at, end) => {
    const r = recs[i++]
    const style = (r.__o != null && r.__o !== 1 ? `opacity:${r.__o};` : '') + (r.__s === false ? 'display:none' : '')
    if (!r.__t && !style) return x
    return `<${n}${at}${r.__t ? ` transform="${r.__t}"` : ''}${style ? ` style="${style}"` : ''}${end}>`
  })
}
let poster
const posterHtml = () => poster || (poster = { __html: bake(0, 'sea', 'yours', true) })

const actOf = (t) => (t < ACT[1] ? 0 : t < ACT[2] ? 1 : 2)
const keyOf = (i, mode, arr) => (i === 0 ? 'factory' : i === 1 ? mode : arr)
const r1 = (v) => +v.toFixed(1)
// The panels: the opening, the transport close up, the warehouse (two side by side and the
// third, wide, under them, at every width).
function crops(mode) {
  const c = camAt(mode, SB[1], veh(mode, SB[1])), w = 450 / c[2], h = 246 / c[2]
  return [[0, 16, 450, 246], [c[0] - w / 2, c[1] - 123 / c[2], w, h], [704, 92, 536, 149]]
}
const bakePanels = (mode, arr) => crops(mode).map((vb, i) => ({ vb: vb.map(r1).join(' '), html: { __html: bake(SB[i], mode, arr, false) } }))
let firstPanels
const panelsAt = (mode, arr) => (mode === 'sea' && arr === 'yours'
  ? firstPanels || (firstPanels = bakePanels('sea', 'yours'))
  : bakePanels(mode, arr))
// A still panel's stroke: about 2px at the width it is drawn.
function storyStroke(root) {
  root?.querySelectorAll('.pj-sb svg').forEach((s) => {
    const w = s.getBoundingClientRect().width, vb = s.viewBox?.baseVal
    if (w && vb?.width) s.style.setProperty('--u', (vb.width / w).toFixed(3))
  })
}

const PAUSE = <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1" width="3" height="10" rx="1" /><rect x="7" y="1" width="3" height="10" rx="1" /></svg>
const PLAY = <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L3.9.7a.6.6 0 0 0-.9.5z" /></svg>

export default function PartnerJourney({ content: j }) {
  const [mode, setMode] = useState('sea')
  const [arr, setArr] = useState('yours')
  const [paused, setPaused] = useState(false)
  const [still, setStill] = useState(false)
  const [act, setAct] = useState(0)
  const [cap, setCap] = useState({ a: 0, k: 'factory', out: false })
  const rootRef = useRef(null)
  const svgRef = useRef(null)
  const fills = useRef([])
  const live = useRef({ mode: 'sea', arr: 'yours', picked: false, paused: false, still: false })
  const engine = useRef(null)

  useEffect(() => {
    const root = rootRef.current, svg = svgRef.current
    // The prerender's browser keeps the poster: the snapshot is the opening frame.
    if (!root || !svg || /NVCPrerender/.test(window.navigator?.userAgent || '')) return undefined
    const S = live.current
    const sc = scene(svg.querySelectorAll('[data-k],[data-m],[data-a],[data-d]'), (e, n) => e.getAttribute(n), svg)
    const E = { t: 0, n: 0, act: 0, lb: 'factory', vis: typeof window.IntersectionObserver !== 'function' }
    let raf = 0, last = 0, ct = 0, drawn = 0
    // a phone or a touch screen: 30 frames a second, time still real (the line drawing hides it)
    const slow = !!window.matchMedia?.('(max-width:767px), (pointer:coarse)')?.matches
    const active = () => E.vis && !S.paused && !S.still && !document.hidden
    const frame = () => {
      if (S.still) return
      measure(sc)
      render(sc, E.t, S.mode, S.arr, true, E.n > 0)
      fills.current.forEach((el, i) => {
        const v = Math.round(cl((E.t - ACT[i]) / (END[i] - ACT[i])) * 400) / 400
        if (el && el.__v !== v) { el.__v = v; el.style.transform = `scaleX(${v})` }
      })
      const a = actOf(E.t), lb = keyOf(a, S.mode, S.arr)
      if (a !== E.act || lb !== E.lb) {
        E.act = a; E.lb = lb
        setAct(a)
        setCap((p) => ({ ...p, out: true }))
        clearTimeout(ct)
        ct = setTimeout(() => setCap({ a, k: lb, out: false }), E.vis && !S.paused ? 180 : 0)
      }
    }
    const tick = (ts) => {
      raf = 0
      if (!active()) { last = 0; return }
      E.t += last ? Math.min(0.1, (ts - last) / 1000) : 0
      last = ts
      if (E.t >= T) {
        E.t -= T; E.n++
        if (!S.picked) { S.mode = MODES[(MODES.indexOf(S.mode) + 1) % 3]; setMode(S.mode) }
      }
      if (slow && ts - drawn < 32) { raf = requestAnimationFrame(tick); return }
      drawn = ts
      frame()
      raf = requestAnimationFrame(tick)
    }
    const kick = () => { if (!raf && active()) { last = 0; raf = requestAnimationFrame(tick) } }
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onMotion = () => {
      const was = S.still
      S.still = !!mq?.matches
      setStill(S.still)
      if (!S.still) { if (was) E.act = -1; frame() }
      kick()
    }
    engine.current = {
      kick,
      seek(t) { E.t = Math.max(0, Math.min(T - 0.001, t)); frame() },
      changed(from) { if (E.t >= from) E.t = from; E.act = -1; frame() },
    }
    const io = typeof window.IntersectionObserver === 'function'
      ? new window.IntersectionObserver((es) => { E.vis = es[es.length - 1].isIntersecting; kick() }, { threshold: 0.2 })
      : null
    io?.observe(root)
    const ro = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver((es) => {
        const w = es[0].contentRect.width
        if (!w) return
        sc.kk = 0; sc.uz = 0
        frame()
        storyStroke(root)
      })
      : null
    ro?.observe(root)
    if (mq?.addEventListener) mq.addEventListener('change', onMotion)
    else mq?.addListener?.(onMotion)
    document.addEventListener('visibilitychange', kick)
    onMotion()
    return () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      clearTimeout(ct)
      io?.disconnect()
      ro?.disconnect()
      if (mq?.removeEventListener) mq.removeEventListener('change', onMotion)
      else mq?.removeListener?.(onMotion)
      document.removeEventListener('visibilitychange', kick)
      engine.current = null
    }
  }, [])

  // Always in the markup (CSS shows them only with reduced motion); redrawn for a switch only
  // while they are what the visitor sees.
  const pm = still ? mode : 'sea', pa = still ? arr : 'yours'
  const panels = useMemo(() => panelsAt(pm, pa), [pm, pa])
  useEffect(() => { if (still) storyStroke(rootRef.current) }, [still, panels])

  if (!j) return null

  const pickMode = (m) => { live.current.mode = m; live.current.picked = true; setMode(m); engine.current?.changed(ACT[1]) }
  const pickArr = (v) => { live.current.arr = v; setArr(v); engine.current?.changed(ACT[2]) }
  const togglePause = () => {
    const p = !live.current.paused
    live.current.paused = p
    setPaused(p)
    engine.current?.kick()
  }
  const goStep = (i) => engine.current?.seek([0.4, ACT[1] + 0.05, ACT[2] + 0.05][i])

  return (
    <div ref={rootRef} className={`pj${still ? ' is-still' : ''}`}>
      <div className="pj-stage">
        <svg ref={svgRef} className="pj-svg" viewBox={VB} role="img" aria-label={j.summary} dangerouslySetInnerHTML={posterHtml()} />
        <p className={`pj-cap${cap.out ? ' is-out' : ''}`} aria-hidden="true">
          <span className="pj-k">{cap.a + 1} / 3</span>
          <span className="pj-n">{j.captions[cap.k]}</span>
        </p>
      </div>
      <div className="pj-sb" role="group" aria-label={j.storyboard}>
        {panels.map((p, i) => (
          <figure key={i}>
            <svg viewBox={p.vb} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={p.html} />
            <figcaption><b>{i + 1}</b><span>{j.captions[keyOf(i, pm, pa)]}</span></figcaption>
          </figure>
        ))}
      </div>
      <div className="pj-steps">
        {j.steps.map((name, i) => (
          <button
            key={name}
            type="button"
            className="pj-step"
            aria-label={j.stepLabel.replace('{n}', i + 1).replace('{name}', name)}
            aria-current={act === i ? 'step' : undefined}
            onClick={() => goStep(i)}
          >
            <i><i ref={(el) => { fills.current[i] = el }} /></i>
            <span><b>{i + 1}</b>{name}</span>
          </button>
        ))}
      </div>
      <div className="pj-ctl">
        <div className="pj-seg" role="group" aria-label={j.transport}>
          {MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => pickMode(m)}>{j.modes[m]}</button>
          ))}
        </div>
        <div className="pj-seg" role="group" aria-label={j.arrival}>
          <button type="button" aria-pressed={arr === 'yours'} onClick={() => pickArr('yours')}>{j.places.yours}</button>
          <button type="button" aria-pressed={arr === 'ours'} onClick={() => pickArr('ours')}>
            {j.places.ours}<span className="pj-long">{j.places.oursWhere}</span>
          </button>
        </div>
        <button type="button" className="pj-pp" aria-label={paused ? j.play : j.pause} onClick={togglePause}>{paused ? PLAY : PAUSE}</button>
      </div>
    </div>
  )
}
