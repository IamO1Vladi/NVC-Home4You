// The unfolding Box house in three.js: a warm architectural-model look (paper ground, soft
// studio light, wood-panel facades, graphite frame) built from boxes and painted canvas
// textures, so there is nothing to download but the library itself. This module is only
// ever reached through a dynamic import, which keeps three.js in a chunk of its own that
// the planner page asks for once the house scrolls into view.
//
// It draws on demand: the player calls setPose() and render() while something moves, a
// mouse drag or a resize asks for one frame, and an idle house costs nothing. All the
// numbers come from unfoldModel.js; this file only decides how they look.
//
// The poster stills in public/planner/ are rendered from this scene by
// scripts/unfold-posters.mjs; after a change here (or a new catalogue edition) run it.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { unfoldDims, unfoldGeometry, poseAt, clamp01 } from './unfoldModel.js'

const PAL = {
  graphite: '#2A2D31',
  frameEdge: '#23262A',
  wood: '#9E6A45',
  woodLight: '#A87350',
  woodMid: '#98643F',
  woodDark: '#7A4C2E',
  roof: '#E6E0D6',
  roofLine: '#CFC7BA',
  // the underside of a wing floor is what the folded box shows below its hanging roof, so
  // it is the same light panel as the roof (the catalogue's first frame is one even face)
  under: '#DDD6CB',
  underRib: '#D0C8BC',
  interior: '#F1EBE1',
  oak: '#D6B48A',
  pitched: '#3B3532',
  pitchedSeam: '#2C2725',
  soffit: '#ECE6DC',
  deck: '#8A5B3D',
  deckLight: '#966545',
  deckDark: '#6E452C',
}

const THEMES = {
  light: { exposure: 1.05, hemiGround: 0xd9cfc0, hemi: 1.15, key: 2.4, fill: 0.55, shadow: 0x3b2a1a, shadowOpacity: 0.2, contact: 'rgba(90,64,40,0.16)', figure: 0xede7dd, glow: 0.03 },
  dark: { exposure: 0.92, hemiGround: 0x3a332c, hemi: 0.9, key: 2.1, fill: 0.35, shadow: 0x000000, shadowOpacity: 0.5, contact: 'rgba(0,0,0,0.55)', figure: 0xcfc6b8, glow: 0.3 },
}

const PPM = 170 // texture pixels per metre
const BASE_AZ = THREE.MathUtils.degToRad(46) // camera azimuth, from +z towards +x
const BASE_EL = THREE.MathUtils.degToRad(24)

/**
 * Builds the scene into `host` (an empty positioned element) and returns its controls.
 * Throws when WebGL is unavailable; the caller keeps the poster then.
 */
export function createUnfoldScene(host, {
  modelKey = '37',
  dark = false,
  T = 0,
  preserveDrawingBuffer = false, // only the poster script reads the canvas back
  // Shares of the picture's height that the caption (top) and the play bar (bottom) cover
  // where they lie over it. UnfoldHouse.css lays them over the picture above 640 px and
  // stacks them around it below, hence the same breakpoint here.
  overlayInsets = { top: 0.15, bottom: 0.14 },
  overlayQuery = '(min-width: 641px)',
  onDragStart,
} = {}) {
  const small = Math.min(host.clientWidth || 0, window.innerWidth || 0) < 640
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const canvas = renderer.domElement
  canvas.className = 'uh-canvas'
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment(renderer)
  const envTex = pmrem.fromScene(room, 0.04).texture
  scene.environment = envTex
  room.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.() })

  const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 200)
  const target = new THREE.Vector3(0, 0.95, 0)

  const hemi = new THREE.HemisphereLight(0xfff4e6, 0xd9cfc0, 1.15)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4)
  key.position.set(-6.5, 11, 9)
  key.castShadow = true
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048)
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.025
  key.shadow.radius = 4
  scene.add(key)
  scene.add(key.target)
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55)
  fill.position.set(9, 5, -4)
  scene.add(fill)

  // Ground: a shadow catcher on transparent paper, plus a soft contact patch under the house.
  const groundMat = new THREE.ShadowMaterial({ color: 0x3b2a1a, opacity: 0.2 })
  // The shadows fade out towards the edge of a box on the ground (centre x, z and half
  // sizes, set by frame()), so a shadow never ends in the hard line of the canvas edge
  // cutting it off -- which a narrow phone picture otherwise does on the right.
  const groundFade = { value: new THREE.Vector4(0, 0, 40, 40) }
  // GLSL directives must start a line, hence the template literals with their own newlines.
  groundMat.onBeforeCompile = (shader) => {
    shader.uniforms.uGroundFade = groundFade
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec2 vGroundXZ;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`)
    // a rounded rectangle: full strength over the inner 80 %, gone at the box's edge
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec4 uGroundFade;
varying vec2 vGroundXZ;`)
      .replace('#include <tonemapping_fragment>', `vec2 fadeQ = abs(vGroundXZ - uGroundFade.xy) / uGroundFade.zw;
gl_FragColor.a *= 1.0 - smoothstep(0.0, 1.0, length(max(fadeQ - 0.8, 0.0)) / 0.2);
#include <tonemapping_fragment>`)
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const contactCanvas = document.createElement('canvas')
  contactCanvas.width = contactCanvas.height = 256
  const contactTex = new THREE.CanvasTexture(contactCanvas)
  contactTex.colorSpace = THREE.SRGBColorSpace
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, toneMapped: false }),
  )
  contact.rotation.x = -Math.PI / 2
  contact.position.y = 0.002
  contact.renderOrder = -1
  scene.add(contact)

  const maxAniso = renderer.capabilities.getMaxAnisotropy()

  // Everything made for one house, so a model switch (or unmount) can free it all.
  let owned = { geometries: new Set(), materials: new Set(), textures: new Set() }
  const keep = (kind, thing) => { owned[kind].add(thing); return thing }

  // A deterministic random, so the wood grain is the same on every visit (and in the poster).
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

  function canvasTex(wm, hm, draw) {
    const w = Math.max(2, Math.min(2048, Math.round(wm * PPM)))
    const h = Math.max(2, Math.min(2048, Math.round(hm * PPM)))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')
    const sx = w / wm
    const sy = h / hm
    // helpers in metres, origin bottom-left
    const R = (u, v, du, dv, col) => { g.fillStyle = col; g.fillRect(u * sx, (hm - v - dv) * sy, du * sx, dv * sy) }
    draw(g, { sx, sy, wm, hm, R })
    const t = keep('textures', new THREE.CanvasTexture(cv))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = maxAniso
    return t
  }

  function paintWood(g, { R, wm, hm, sx, sy }) {
    R(0, 0, wm, hm, PAL.wood)
    const plank = 0.3
    for (let v = 0, i = 0; v < hm; v += plank, i++) {
      R(0, v, wm, plank, i % 3 === 0 ? PAL.woodLight : i % 3 === 1 ? PAL.wood : PAL.woodMid)
      g.globalAlpha = 0.1
      for (let k = 0; k < 14; k++) {
        const yy = (hm - v - rnd() * plank) * sy
        g.strokeStyle = rnd() > 0.5 ? PAL.woodDark : '#C98C5C'
        g.lineWidth = 1 + rnd() * 1.5
        g.beginPath()
        g.moveTo(0, yy)
        for (let x = 0; x <= wm * sx; x += 40) g.lineTo(x, yy + Math.sin(x * 0.01 + k) * 2.5)
        g.stroke()
      }
      g.globalAlpha = 1
      R(0, v, wm, 0.012, 'rgba(60,30,12,0.55)')
      R(0, v + 0.012, wm, 0.006, 'rgba(255,220,180,0.18)')
    }
  }
  const paintBorder = (R, wm, hm, b, col) => {
    R(0, 0, wm, b, col); R(0, hm - b, wm, b, col); R(0, 0, b, hm, col); R(wm - b, 0, b, hm, col)
  }
  function paintWindow(R, win, outer) {
    const f = 0.06
    R(win.u - f, win.v - f, win.w + 2 * f, win.h + 2 * f, PAL.frameEdge)
    R(win.u, win.v, win.w, win.h, outer ? '#26323D' : '#5D6A75')
    if (win.mullion) R(win.u + win.w / 2 - 0.025, win.v, 0.05, win.h, PAL.frameEdge)
    if (win.split) for (const s of win.split) R(win.u + s * win.w - 0.025, win.v, 0.05, win.h, PAL.frameEdge)
  }

  // Shared, theme-independent materials.
  const frameMat = new THREE.MeshStandardMaterial({ color: PAL.graphite, roughness: 0.55, metalness: 0.35, envMapIntensity: 0.6 })
  const glassMap = (() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 256
    const g = cv.getContext('2d')
    const base = g.createLinearGradient(0, 0, 0, 256)
    base.addColorStop(0, '#41566C'); base.addColorStop(1, '#17212C')
    g.fillStyle = base; g.fillRect(0, 0, 256, 256)
    const streak = (x0, w, a) => {
      const gr = g.createLinearGradient(x0, 0, x0 + w, 0)
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(235,242,250,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.save(); g.translate(128, 128); g.rotate(-0.55); g.translate(-128, -128)
      g.fillStyle = gr; g.fillRect(x0, -200, w, 700); g.restore()
    }
    streak(30, 90, 0.16); streak(150, 30, 0.1)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping
    return t
  })()
  const glassMat = new THREE.MeshStandardMaterial({
    map: glassMap, roughness: 0.12, metalness: 0, envMapIntensity: 0.55,
    emissive: new THREE.Color(0xffc27a), emissiveIntensity: 0,
  })
  const figureMat = new THREE.MeshStandardMaterial({ color: 0xede7dd, roughness: 0.9, envMapIntensity: 0.4 })
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x8b8f94, roughness: 0.7, metalness: 0.4, envMapIntensity: 0.6 })

  const std = (map, rough = 0.85, env = 0.35) =>
    keep('materials', new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0, envMapIntensity: env }))

  const roofTop = (wm, hm) => std(canvasTex(wm, hm, (g, { R }) => {
    R(0, 0, wm, hm, PAL.roof)
    for (let u = 0.6; u < wm; u += 0.6) R(u - 0.01, 0, 0.02, hm, PAL.roofLine)
    paintBorder(R, wm, hm, 0.05, PAL.frameEdge)
  }), 0.9, 0.3)
  const plainTex = (wm, hm, col, border = 0.04) => std(canvasTex(wm, hm, (g, { R }) => {
    R(0, 0, wm, hm, col)
    if (border) paintBorder(R, wm, hm, border, PAL.frameEdge)
  }))
  const oakTex = (wm, hm) => std(canvasTex(wm, hm, (g, { R }) => {
    R(0, 0, wm, hm, PAL.oak)
    for (let v = 0, i = 0; v < hm; v += 0.19, i++) {
      R(0, v, wm, 0.19, i % 2 ? '#D9B98F' : '#CFAA7E')
      R(0, v, wm, 0.006, 'rgba(90,60,30,0.35)')
      for (let u = (i * 0.37) % 1.2; u < wm; u += 1.2) R(u, v, 0.006, 0.19, 'rgba(90,60,30,0.3)')
    }
    paintBorder(R, wm, hm, 0.035, PAL.frameEdge)
  }), 0.75, 0.3)
  // light ribbed sheet: reads as one even side on the folded box and as the catalogue's
  // ribbed underside once the roof has opened
  const underTex = (wm, hm) => std(canvasTex(wm, hm, (g, { R }) => {
    R(0, 0, wm, hm, PAL.under)
    for (let u = 0.3; u < wm; u += 0.3) R(u - 0.012, 0, 0.024, hm, PAL.underRib)
    paintBorder(R, wm, hm, 0.03, PAL.frameEdge)
  }), 0.85, 0.35)
  const facade = (wm, hm, windows) => std(canvasTex(wm, hm, (g, ctx) => {
    paintWood(g, ctx)
    for (const w of windows) paintWindow(ctx.R, w, true)
    paintBorder(ctx.R, wm, hm, 0.06, PAL.frameEdge)
  }), 0.7, 0.35)
  const interior = (wm, hm, windows) => std(canvasTex(wm, hm, (g, { R }) => {
    R(0, 0, wm, hm, PAL.interior)
    for (const w of windows) paintWindow(R, w, false)
    paintBorder(R, wm, hm, 0.04, PAL.frameEdge)
  }), 0.95, 0.25)
  const mirrorWins = (wins, wm) => wins.map((w) => ({ ...w, u: wm - w.u - w.w }))

  // BoxGeometry faces are px, nx, py, ny, pz, nz. Faces sharing a material are regrouped so
  // they cost one draw call; a face with no material of its own is graphite frame.
  function panel(w, h, d, mats, offset) {
    const geo = keep('geometries', new THREE.BoxGeometry(w, h, d))
    geo.translate(offset[0], offset[1], offset[2])
    let material = frameMat
    if (mats.some(Boolean)) {
      const per = Array.from({ length: 6 }, (_, i) => mats[i] || frameMat)
      material = [...new Set(per)]
      const src = geo.index.array
      const idx = []
      geo.clearGroups()
      material.forEach((mat, mi) => {
        const start = idx.length
        per.forEach((pm, face) => { if (pm === mat) for (let k = 0; k < 6; k++) idx.push(src[face * 6 + k]) })
        geo.addGroup(start, idx.length - start, mi)
      })
      geo.setIndex(idx)
    }
    const m = new THREE.Mesh(geo, material)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }

  // Glass planes laid over the painted windows of one box face, merged into one mesh.
  function panesOf(w) {
    const cuts = w.mullion ? [0.5] : (w.split || [])
    const edges = [0, ...cuts, 1]
    const out = []
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i] * w.w + (i ? 0.025 : 0)
      const b = edges[i + 1] * w.w - (i < edges.length - 2 ? 0.025 : 0)
      out.push({ u: w.u + a, v: w.v, w: b - a, h: w.h })
    }
    return out
  }
  function glassOn(parent, box, offset, face, wins) {
    const [W, Hh, D] = box
    const geos = []
    for (const p of wins.flatMap(panesOf)) {
      const geo = new THREE.PlaneGeometry(p.w, p.h)
      const pos = geo.attributes.position
      const uv = geo.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.u + p.w / 2 + pos.getX(i)) / 2.2, (p.v + p.h / 2 + pos.getY(i)) / 2.2)
      const o = new THREE.Object3D()
      const cu = p.u + p.w / 2
      const y = -Hh / 2 + p.v + p.h / 2 + offset[1]
      if (face === 'pz') o.position.set(-W / 2 + cu + offset[0], y, D / 2 + 0.003 + offset[2])
      if (face === 'nz') { o.position.set(W / 2 - cu + offset[0], y, -D / 2 - 0.003 + offset[2]); o.rotation.y = Math.PI }
      if (face === 'px') { o.position.set(W / 2 + 0.003 + offset[0], y, D / 2 - cu + offset[2]); o.rotation.y = Math.PI / 2 }
      if (face === 'nx') { o.position.set(-W / 2 - 0.003 + offset[0], y, -D / 2 + cu + offset[2]); o.rotation.y = -Math.PI / 2 }
      o.updateMatrix()
      geos.push(geo.applyMatrix4(o.matrix))
    }
    const merged = keep('geometries', mergeGeometries(geos))
    geos.forEach((g) => g.dispose())
    const m = new THREE.Mesh(merged, glassMat)
    m.receiveShadow = true
    parent.add(m)
  }

  // A box whose top and bottom slope across z (y rises by `slope` per metre of z), so a
  // roof panel or rafter has vertical ends and two panels meet exactly at the ridge.
  function slopedBox(lengthX, heightY, runZ, slope, mats) {
    const geo = keep('geometries', new THREE.BoxGeometry(lengthX, heightY, runZ))
    geo.translate(0, heightY / 2, runZ / 2) // y 0..h, z 0..run
    geo.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, slope, 0, 0, 0, 1, 0, 0, 0, 0, 1))
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, mats || frameMat)
    m.castShadow = true
    m.receiveShadow = true
    m.userData.sloped = { lengthX, heightY, runZ, slope } // for the collision check
    return m
  }

  let G = null // the geometry numbers for the current model
  let parts = null // the pivots and groups setPose moves
  let house = null

  function buildHouse(dims) {
    G = unfoldGeometry(dims)
    const { L, H, tf, tr, tw, te, Y0, roofUnder, ext, Zh, Pz, c, Wf, Wr, Hwt, We, He, post, notchW, notchH, sillTop } = G
    house = new THREE.Group()
    scene.add(house)

    // Core: floor deck, hinge sills, corner posts, roof slab, glazed front, closed back.
    const core = new THREE.Group()
    house.add(core)
    core.add(panel(L, tf, 2 * c, [null, null, oakTex(L, 2 * c), null, null, null], [0, tf / 2, 0]))
    for (const s of [1, -1]) core.add(panel(L, sillTop, te + tw, [], [0, sillTop / 2, s * (c + (te + tw) / 2)]))
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      core.add(panel(post, roofUnder - Y0, post, [], [sx * (L / 2 - post / 2), Y0 + (roofUnder - Y0) / 2, sz * (c - post / 2)]))
    }
    const rw = 2 * (Zh - tr)
    core.add(panel(L, tr, rw, [null, null, roofTop(L, rw), plainTex(L, rw, PAL.interior, 0.03), null, null], [0, H - tr / 2, 0]))
    const ew = 2 * (c - post)
    const eh = roofUnder - Y0
    const doorWins = [{ u: 0.05, v: 0.06, w: ew - 0.1, h: eh - 0.3, split: [0.25, 0.5, 0.75] }]
    const frontBox = [0.06, eh, ew]
    const frontOff = [L / 2 - 0.05, Y0 + eh / 2, 0]
    const frontOuter = std(canvasTex(ew, eh, (g, { R }) => {
      R(0, 0, ew, eh, PAL.frameEdge)
      paintWindow(R, doorWins[0], true)
      R(ew / 2 - 0.18, 0.95, 0.04, 0.22, '#9AA3AA')
      R(ew / 2 + 0.14, 0.95, 0.04, 0.22, '#9AA3AA')
    }), 0.5, 0.6)
    core.add(panel(...frontBox, [frontOuter, interior(ew, eh, mirrorWins(doorWins, ew)), null, null, null, null], frontOff))
    glassOn(core, frontBox, frontOff, 'px', doorWins)
    const backWins = [{ u: ew / 2 - 0.3, v: 1.35, w: 0.6, h: 0.55 }]
    const backBox = [0.06, eh, ew]
    const backOff = [-L / 2 + 0.05, Y0 + eh / 2, 0]
    core.add(panel(...backBox, [interior(ew, eh, mirrorWins(backWins, ew)), facade(ew, eh, backWins), null, null, null, null], backOff))
    glassOn(core, backBox, backOff, 'nx', backWins)

    // Wing windows: one per three metres or so, evenly spaced along the longer houses.
    const count = Math.max(2, Math.round(L / 3))
    const wingWins = Array.from({ length: count }, (_, i) => ({
      u: (L * (i + 0.5)) / count - 0.6, v: 0.85 + ext, w: 1.2, h: 1.15, mullion: true,
    }))
    const endWins = [{ u: We / 2 - 0.55, v: 0.85 + ext, w: 1.1, h: 1.15, mullion: true }]

    // The two wings are one build, the second turned half a circle.
    const wings = []
    const wallFacade = facade(L, Hwt, wingWins)
    const wallInside = interior(L, Hwt, mirrorWins(wingWins, L))
    const endFacade = facade(We, He, endWins)
    const endInside = interior(We, He, mirrorWins(endWins, We))
    const wingRoofTop = roofTop(L, Wr)
    const wingRoofUnder = plainTex(L, Wr, PAL.interior, 0.03)
    const wingFloorUnder = underTex(L, Wf)
    const wingFloorTop = oakTex(L, Wf - notchW)
    for (const rotY of [0, Math.PI]) {
      const g = new THREE.Group()
      g.rotation.y = rotY
      house.add(g)
      // roof: hinged at its top inner corner; folded, it hangs down outside the box
      const roofPivot = new THREE.Group()
      roofPivot.position.set(0, H, Zh)
      g.add(roofPivot)
      roofPivot.add(panel(L, tr, Wr, [null, null, wingRoofTop, wingRoofUnder, null, null], [0, -tr / 2, Wr / 2]))
      // floor: hinged at its top inner corner; folded, it stands up beside the core. Its
      // outer top edge is rebated so the folded wall and end walls clear it as they rise.
      const floorPivot = new THREE.Group()
      floorPivot.position.set(0, Y0, Pz)
      g.add(floorPivot)
      floorPivot.add(panel(L, tf - notchH, Wf, [null, null, null, wingFloorUnder, null, null], [0, -tf + (tf - notchH) / 2, Wf / 2]))
      floorPivot.add(panel(L, notchH, Wf - notchW, [null, null, wingFloorTop, null, null, null], [0, -notchH / 2, (Wf - notchW) / 2]))
      // outer wall: hinged at the floor's outer edge; folded, it lies on the floor
      const wallPivot = new THREE.Group()
      wallPivot.position.set(0, ext, Wf)
      floorPivot.add(wallPivot)
      const wallBox = [L, Hwt, tw]
      const wallOff = [0, Hwt / 2 - ext, 0]
      wallPivot.add(panel(...wallBox, [null, null, null, null, wallFacade, wallInside], wallOff))
      glassOn(wallPivot, wallBox, wallOff, 'pz', wingWins)
      // end walls: folded flat against the wall's inner face; each swings on a hinge at its
      // outer corner whose knuckle slides out by te as it turns, so it never cuts the wall
      const ends = []
      for (const s of [1, -1]) {
        const p = new THREE.Group()
        p.position.set((s * L) / 2, 0, -tw / 2 - te)
        p.userData = { z0: -tw / 2 - te, sign: s }
        wallPivot.add(p)
        const box = [We, He, te]
        const off = [(-s * We) / 2, He / 2 - ext, te / 2]
        p.add(panel(...box, [null, null, null, null, endInside, endFacade], off))
        glassOn(p, box, off, 'nz', mirrorWins(endWins, We))
        ends.push(p)
      }
      wings.push({ roofPivot, floorPivot, wallPivot, ends })
    }

    // The step at the front edge of the terrace (the base house has its standard deck too).
    const makeStep = () => {
      const group = new THREE.Group()
      const tread = new THREE.Mesh(keep('geometries', new THREE.BoxGeometry(0.34, 0.07, 1.25)), [frameMat, frameMat, treadMat, frameMat, frameMat, frameMat])
      tread.position.set(0.17, 0.095, 0)
      const legs = new THREE.Mesh(keep('geometries', new THREE.BoxGeometry(0.3, 0.06, 1.15)), frameMat)
      legs.position.set(0.17, 0.03, 0)
      for (const m of [tread, legs]) { m.castShadow = true; m.receiveShadow = true; group.add(m) }
      return group
    }
    const roofFrame = buildRoofFrame(dims)
    house.add(roofFrame)
    const { deck, rails } = buildDeck(dims)
    house.add(deck, rails)
    const deckStep = makeStep()
    deckStep.position.x = G.deck.x1 + 0.03
    house.add(deckStep)

    parts = { wings, deckStep, roofFrame, deck, rails }

    // The shadow camera must cover the longest house with its veranda.
    const reach = Math.max(8, L / 2 + dims.terrace.depth + 3.5)
    Object.assign(key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 50 })
    key.shadow.camera.updateProjectionMatrix()
  }

  // The pitched roof: eaves beams and trusses on the flat roof, two sloped panels over the
  // house and the veranda, and the veranda posts, all lowered together as one frame.
  function buildRoofFrame(dims) {
    const { L, H, HALF, roofFrame: F } = G
    const group = new THREE.Group()
    const tan = Math.tan(F.pitch)
    const lengthX = F.x1 - F.x0
    const midX = (F.x0 + F.x1) / 2
    const vThick = F.thickness / Math.cos(F.pitch)
    const slopeRun = F.run / Math.cos(F.pitch)
    const pitchedTop = std(canvasTex(lengthX, slopeRun, (g, { R }) => {
      R(0, 0, lengthX, slopeRun, PAL.pitched)
      for (let u = 0.5; u < lengthX; u += 0.5) R(u - 0.012, 0, 0.024, slopeRun, PAL.pitchedSeam)
    }), 0.6, 0.45)
    const soffit = plainTex(lengthX, slopeRun, PAL.soffit, 0)
    // two panels, each starting at the ridge (z = 0) and falling outwards
    for (const side of [1, -1]) {
      const mats = [frameMat, frameMat, pitchedTop, soffit, frameMat, frameMat]
      const slab = slopedBox(lengthX, vThick, F.run, -tan, mats)
      slab.position.set(midX, F.ridgeUnder, 0)
      if (side === -1) slab.rotation.y = Math.PI
      group.add(slab)
    }
    // eaves beams along both long edges, resting on the flat roof and on the posts
    const beamW = 0.1
    for (const s of [1, -1]) {
      group.add(panel(F.x1 - 0.1 - (F.x0 + 0.1), F.beam, beamW, [], [(F.x0 + F.x1) / 2, H + F.beam / 2, s * (HALF - 0.01 - beamW / 2)]))
    }
    // trusses: at the back of the house, at its glazed end and at the veranda's outer edge
    const trussXs = [-L / 2 + 0.06, L / 2 - 0.06, F.postX]
    for (const x of trussXs) {
      group.add(panel(0.08, F.beam, 2 * (HALF - 0.01), [], [x, H + F.beam / 2, 0]))
      // rafters under the panels, from the tie beam's top up to the ridge
      const rafterDepth = 0.1
      const zEnd = HALF - rafterDepth / tan // where the rafter's underside meets the tie beam
      for (const side of [1, -1]) {
        const rafter = slopedBox(0.07, rafterDepth, zEnd, -tan)
        rafter.position.set(x, F.ridgeUnder - rafterDepth, 0)
        if (side === -1) rafter.rotation.y = Math.PI
        group.add(rafter)
      }
      // king post from the tie beam to the ridge
      // (it stops where the rafters' undersides start, half its width out from the ridge)
      const kingH = F.ridgeUnder - rafterDepth - 0.035 * tan - 0.002 - (H + F.beam)
      group.add(panel(0.07, kingH, 0.07, [], [x, H + F.beam + kingH / 2, 0]))
    }
    // The posts run from the ground to the eaves: they land on the ground as the frame comes
    // down and pass through the deck, which is already there (it comes with the base house);
    // they sit inside its footprint, so nothing shows where they meet.
    for (const z of F.postZ) for (const s of [1, -1]) {
      group.add(panel(F.postSize, H, F.postSize, [], [F.postX, H / 2, s * z]))
    }
    return group
  }

  // The veranda: a decked platform flush with the house floor, grown out from the glazed
  // end, and railings that rise out of it on three sides with the entrance left open.
  function buildDeck(dims) {
    const { Y0, roofFrame: F, deck: D } = G
    const depth = D.x1 - D.x0
    const w = 2 * D.halfWidth
    const deckTop = std(canvasTex(depth, w, (g, { R }) => {
      R(0, 0, depth, w, PAL.deck)
      // boards run along the house face, as in the catalogue photographs
      for (let u = 0, i = 0; u < depth; u += 0.14, i++) {
        R(u, 0, 0.14, w, i % 3 === 0 ? PAL.deckLight : i % 3 === 1 ? PAL.deck : PAL.deckDark)
        R(u, 0, 0.01, w, 'rgba(40,20,8,0.5)')
      }
      paintBorder(R, depth, w, 0.04, PAL.frameEdge)
    }), 0.8, 0.3)
    const deck = new THREE.Group()
    deck.position.x = D.x0
    deck.add(panel(depth, Y0, w, [null, null, deckTop, null, null, null], [depth / 2, Y0 / 2, 0]))

    // Railings are one merged mesh: top rail, bottom rail and balusters every 11 cm.
    const geos = []
    const box = (sx, sy, sz, x, y, z) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); geos.push(g) }
    const h = D.railHeight
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      box(alongX ? len : 0.04, 0.05, alongX ? 0.04 : len, cx, h - 0.025, cz)
      box(alongX ? len : 0.03, 0.03, alongX ? 0.03 : len, cx, 0.1, cz)
      const n = Math.max(1, Math.floor(len / 0.11))
      for (let i = 1; i < n; i++) {
        const k = i / n
        box(0.02, h - 0.05, 0.02, x0 + (x1 - x0) * k, (h - 0.05) / 2, z0 + (z1 - z0) * k)
      }
    }
    const zOut = F.postZ[0]
    const zIn = F.postZ[1]
    const half = F.postSize / 2
    for (const s of [1, -1]) {
      run(D.x0 + 0.05, s * zOut, F.postX - half, s * zOut) // side, from the house to the corner post
      run(F.postX, s * (zIn + half), F.postX, s * (zOut - half)) // front, corner post to entrance post
    }
    const railGeo = keep('geometries', mergeGeometries(geos))
    geos.forEach((g) => g.dispose())
    const railMesh = new THREE.Mesh(railGeo, frameMat)
    railMesh.castShadow = true
    railMesh.receiveShadow = true
    const rails = new THREE.Group()
    rails.position.y = Y0 // grows upward out of the deck surface
    rails.add(railMesh)
    return { deck, rails }
  }

  // The scale figure, an architectural-model person of about 1.75 m.
  const figure = new THREE.Group()
  {
    const legGeo = new THREE.CapsuleGeometry(0.065, 0.72, 4, 10)
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, figureMat)
      leg.position.set(0, 0.065 + 0.36, s * 0.09)
      figure.add(leg)
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 6, 14), figureMat)
    torso.position.y = 0.99
    torso.scale.set(0.62, 1, 1)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), figureMat)
    head.position.y = 1.6
    figure.add(torso, head)
    figure.traverse((m) => { if (m.isMesh) m.castShadow = true })
    figure.rotation.y = 0.5
  }
  scene.add(figure)

  // ---- pose ---------------------------------------------------------------------------
  let currentT = T
  function setPose(t) {
    currentT = t
    const p = poseAt(t)
    const { te } = G
    for (const w of parts.wings) {
      w.roofPivot.rotation.x = (Math.PI / 2) * (1 - p.roof)
      w.floorPivot.rotation.x = (-Math.PI / 2) * (1 - p.floor)
      w.wallPivot.rotation.x = (-Math.PI / 2) * (1 - p.wall)
      for (const e of w.ends) {
        const a = (Math.PI / 2) * p.end
        e.rotation.y = -e.userData.sign * a
        e.position.z = e.userData.z0 + te * (1 - Math.cos(a))
      }
    }
    glassMat.emissiveIntensity = p.finish * theme.glow

    // the roof frame comes down from above and lands on the flat roof
    parts.roofFrame.visible = p.roofFrame > 0.001
    const lift = parts.roofFrame.visible ? (1 - p.roofFrame) * G.roofFrame.drop : 0
    parts.roofFrame.position.y = lift
    // the deck grows out of the glazed end, its step settles in from above; with the roof,
    // the railings grow out of the deck
    parts.deck.visible = p.deck > 0.001
    parts.deck.scale.x = Math.max(0.001, p.deck)
    parts.rails.visible = p.rail > 0.001
    parts.rails.scale.y = Math.max(0.001, p.rail)
    parts.deckStep.visible = p.stepIn > 0.001
    parts.deckStep.position.y = (1 - p.stepIn) * 0.35
    parts.deckStep.scale.setScalar(Math.max(0.001, p.stepIn))

    // the person steps out of the veranda's way before the roof comes down
    const f = p.figure
    figure.position.set(
      G.figureBase.x + (G.figureRoof.x - G.figureBase.x) * f, 0,
      G.figureBase.z + (G.figureRoof.z - G.figureBase.z) * f)

    // the contact shadow follows the footprint
    const width = 2 * G.Zh + (2 * G.HALF - 2 * G.Zh) * p.floor
    const deckReach = (G.deck.x1 - G.deck.x0) * p.deck
    contact.scale.set(G.L + 3.2 + deckReach, width + 2.6, 1)
    contact.position.x = deckReach / 2

    frame(Math.max(p.figure, p.roofFrame), lift)
  }

  // ---- camera ---------------------------------------------------------------------------
  const overlaid = typeof window.matchMedia === 'function' ? window.matchMedia(overlayQuery) : null
  const insets = () => (overlaid?.matches ? overlayInsets : { top: 0.03, bottom: 0.03 })
  let azimuth = BASE_AZ
  let elevation = BASE_EL
  let dist = 20
  let userTurned = false
  // The box the camera must hold, set by frame() and fitted by placeCamera().
  const box = { xMin: 0, xMax: 0, yMax: 0, zMin: 0, zMax: 0 }
  // How far a shadow falls along x and along z for each metre of height above the ground,
  // from the key light's direction (it shines from -x, +z and above, towards the origin).
  const shadowPerM = { x: -key.position.x / key.position.y, z: -key.position.z / key.position.y }
  function frame(roofShare, lift = 0) {
    // The house, the figure and (as they arrive) the roof and veranda. The box is the
    // finished house's from the first stage on, so the camera holds still while the box
    // unfolds inside it, and only eases out as the roof comes -- holding the roof frame in
    // view while it is still up in the air (lift) and settling as it lands.
    const r = clamp01(roofShare)
    const fx = G.figureBase.x + (G.figureRoof.x - G.figureBase.x) * r
    const fz = G.figureBase.z + (G.figureRoof.z - G.figureBase.z) * r
    box.xMin = -G.L / 2 - 0.3
    box.xMax = fx + 0.3
    box.yMax = G.H + (G.roofFrame.ridgeTop + lift - G.H) * r
    const zHalf = Math.max(G.HALF + 0.25, Math.abs(fz) + 0.3)
    box.zMin = -zHalf
    box.zMax = zHalf
    // Where the shadows fall: past the glazed end (the far end of the roof, once it is
    // on) and off the long side away from the light, and the person's beyond their feet.
    const endX = r > 0 ? G.roofFrame.x1 : G.L / 2
    const shadowXMax = Math.max(endX + shadowPerM.x * box.yMax, fx + shadowPerM.x * 1.75) + 0.3
    const shadowZMin = Math.min(-G.HALF + shadowPerM.z * G.H, fz + shadowPerM.z * 1.75) - 0.3
    // On a phone the picture is narrow and the camera fits the box tightly, so the box
    // takes in half of the shadows past the glazed end and off the long side (all of them
    // would shrink the house too far), and the fade below ends them softly inside the
    // picture. A wide picture has room to spare round the box and keeps its framing; its
    // fade box is simply all the shadow.
    const narrow = !overlaid?.matches
    if (narrow) {
      box.xMax = Math.max(box.xMax, box.xMax + (shadowXMax - box.xMax) * 0.5)
      box.zMin = Math.min(box.zMin, -G.HALF + shadowPerM.z * G.H * 0.5 - 0.3)
    }
    const fade = narrow
      ? { x0: box.xMin, x1: box.xMax, z0: box.zMin, z1: box.zMax }
      : { x0: box.xMin, x1: Math.max(box.xMax, shadowXMax) + 0.4, z0: Math.min(box.zMin, shadowZMin) - 0.4, z1: box.zMax }
    groundFade.value.set((fade.x0 + fade.x1) / 2, (fade.z0 + fade.z1) / 2, (fade.x1 - fade.x0) / 2, (fade.z1 - fade.z0) / 2)
    target.set((box.xMin + box.xMax) / 2, box.yMax * 0.42, (box.zMin + box.zMax) / 2)
    placeCamera()
  }
  const toCamera = new THREE.Vector3()
  const right = new THREE.Vector3()
  const upward = new THREE.Vector3()
  const corner = new THREE.Vector3()
  function placeCamera() {
    toCamera.set(Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth))
    right.set(0, 1, 0).cross(toCamera).normalize()
    upward.copy(toCamera).cross(right)
    // The nearest distance at which every corner of the box is inside the part of the
    // picture the overlays leave free.
    const { top, bottom } = insets()
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (1 - top - bottom)
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect * 0.96
    let need = 0
    for (const x of [box.xMin, box.xMax]) for (const y of [0, box.yMax]) for (const z of [box.zMin, box.zMax]) {
      corner.set(x, y, z).sub(target)
      const depth = corner.dot(toCamera)
      need = Math.max(need, depth + Math.abs(corner.dot(right)) / tanH, depth + Math.abs(corner.dot(upward)) / tanV)
    }
    dist = need * 1.01
    camera.position.copy(target).addScaledVector(toCamera, dist)
    camera.lookAt(target)
  }
  /** A slow drift round the house while it plays, unless the visitor has turned it. */
  function drift(dt) {
    if (userTurned || !dt) return
    azimuth += dt * THREE.MathUtils.degToRad(1.6)
    placeCamera()
  }

  // ---- theme ----------------------------------------------------------------------------
  let theme = THEMES.light
  function setTheme(isDark) {
    theme = isDark ? THEMES.dark : THEMES.light
    renderer.toneMappingExposure = theme.exposure
    hemi.groundColor.setHex(theme.hemiGround)
    hemi.intensity = theme.hemi
    key.intensity = theme.key
    fill.intensity = theme.fill
    groundMat.color.setHex(theme.shadow)
    groundMat.opacity = theme.shadowOpacity
    figureMat.color.setHex(theme.figure)
    const g = contactCanvas.getContext('2d')
    g.clearRect(0, 0, 256, 256)
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grd.addColorStop(0, theme.contact)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
    contactTex.needsUpdate = true
    if (parts) setPose(currentT)
    requestRender()
  }

  // ---- size, drawing ----------------------------------------------------------------------
  function resize() {
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // shift the picture so the house sits in the middle of the free band
    const { top, bottom } = insets()
    camera.setViewOffset(w, h, 0, -h * ((top - bottom) / 2), w, h)
    camera.updateProjectionMatrix()
    setPose(currentT)
    requestRender()
  }

  function render() {
    renderer.render(scene, camera)
  }
  let queued = 0
  function requestRender() {
    if (queued) return
    queued = requestAnimationFrame(() => { queued = 0; render() })
  }

  // ---- mouse orbit --------------------------------------------------------------------------
  // Only a mouse turns the house. A finger on the canvas scrolls the page as anywhere else,
  // so touch-action stays at its default and touch pointers are never captured.
  let drag = null
  function onPointerDown(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag = { x: e.clientX, y: e.clientY, az: azimuth, el: elevation }
    canvas.setPointerCapture?.(e.pointerId)
    canvas.classList.add('is-dragging')
    if (!userTurned) onDragStart?.()
    userTurned = true
  }
  function onPointerMove(e) {
    if (!drag) return
    azimuth = drag.az - (e.clientX - drag.x) * 0.006
    elevation = Math.min(THREE.MathUtils.degToRad(52), Math.max(THREE.MathUtils.degToRad(6), drag.el + (e.clientY - drag.y) * 0.004))
    placeCamera()
    requestRender()
  }
  function onPointerUp(e) {
    if (!drag) return
    drag = null
    canvas.releasePointerCapture?.(e.pointerId)
    canvas.classList.remove('is-dragging')
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null
  resizeObserver?.observe(host)

  function disposeHouse() {
    if (house) scene.remove(house)
    owned.geometries.forEach((g) => g.dispose())
    owned.materials.forEach((m) => m.dispose())
    owned.textures.forEach((t) => t.dispose())
    owned = { geometries: new Set(), materials: new Set(), textures: new Set() }
    house = null
    parts = null
  }

  function setModel(nextKey) {
    disposeHouse()
    seed = 7
    buildHouse(unfoldDims(nextKey))
    setPose(currentT)
    requestRender()
  }

  buildHouse(unfoldDims(modelKey))
  setTheme(dark)
  resize()

  return {
    canvas,
    setPose,
    setModel,
    setTheme,
    drift,
    render,
    requestRender,
    /** Back to the starting viewpoint (a new model or a replay). */
    resetView() { azimuth = BASE_AZ; elevation = BASE_EL; userTurned = false; placeCamera() },
    // for the poster script and the collision check, never used by the page
    debug: { scene, camera, renderer, get house() { return house }, get parts() { return parts } },
    dispose() {
      if (queued) cancelAnimationFrame(queued)
      resizeObserver?.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      disposeHouse()
      scene.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.() })
      for (const m of [frameMat, glassMat, figureMat, treadMat, groundMat, contact.material]) m.dispose()
      for (const t of [glassMap, contactTex, envTex]) t.dispose()
      pmrem.dispose()
      key.shadow.map?.dispose?.()
      renderer.dispose()
      renderer.forceContextLoss?.()
      canvas.remove()
    },
  }
}
