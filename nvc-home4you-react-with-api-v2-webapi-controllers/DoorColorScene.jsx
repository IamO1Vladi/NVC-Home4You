import React, { useEffect, useMemo, useRef, useState } from 'react'
import './DoorColorScene.css'

/**
 * DoorColorScene
 * - Renders a background "scene" image
 * - Recolours ONLY the masked pixels (door area) using a Canvas pipeline
 * - Includes an in-image swatch pill like your examples
 *
 * Assets expected (example):
 *  public/internal-doors/scene.png
 *  public/internal-doors/scene-door-mask.png  (white = recolour, black = keep)
 *
 * Notes:
 * - This implementation uses a "multiply" tint blend that works best when the door in the scene is neutral/white.
 */
export default function DoorColorScene({
  baseSrc,
  maskSrc,
  options,
  defaultKey,
  strength = 0.95,
  pillPosition = 'bottom-right', // 'top-right' | 'bottom-right'
  ariaLabel = 'Door colour selector',
}) {
  const canvasRef = useRef(null)
  const [activeKey, setActiveKey] = useState(defaultKey ?? options?.[0]?.key)
  const active = useMemo(() => options.find(o => o.key === activeKey) ?? options?.[0], [options, activeKey])

  // keyboard left/right to switch colours
  const onKeyDown = (e) => {
    if (!options?.length) return
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const idx = Math.max(0, options.findIndex(o => o.key === activeKey))
    const next = e.key === 'ArrowRight'
      ? options[(idx + 1) % options.length]
      : options[(idx - 1 + options.length) % options.length]
    setActiveKey(next.key)
  }

  useEffect(() => {
    let cancelled = false

    async function render() {
      const canvas = canvasRef.current
      if (!canvas || !active) return

      try {
        const [baseImg, maskImg] = await Promise.all([loadImage(baseSrc), loadImage(maskSrc)])
        if (cancelled) return

        const w = baseImg.naturalWidth || baseImg.width
        const h = baseImg.naturalHeight || baseImg.height
        canvas.width = w
        canvas.height = h

        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return

        // draw base
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(baseImg, 0, 0, w, h)
        const baseImageData = ctx.getImageData(0, 0, w, h)

        // draw mask to offscreen
        const off = document.createElement('canvas')
        off.width = w
        off.height = h
        const offCtx = off.getContext('2d', { willReadFrequently: true })
        if (!offCtx) return
        offCtx.clearRect(0, 0, w, h)
        offCtx.drawImage(maskImg, 0, 0, w, h)
        const maskData = offCtx.getImageData(0, 0, w, h).data

        const { r: tr, g: tg, b: tb } = hexToRgb(active.color)
        const s = clamp(strength, 0, 1)

        const data = baseImageData.data
        // mask is grayscale; use red channel
        for (let i = 0; i < data.length; i += 4) {
          const m = maskData[i] / 255
          if (m <= 0) continue

          const a = m * s

          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // Multiply tint (keeps shading best when base is light/neutral)
          const mr = (r * tr) / 255
          const mg = (g * tg) / 255
          const mb = (b * tb) / 255

          data[i] = r * (1 - a) + mr * a
          data[i + 1] = g * (1 - a) + mg * a
          data[i + 2] = b * (1 - a) + mb * a
          // alpha unchanged
        }

        ctx.putImageData(baseImageData, 0, 0)
      } catch {
        // ignore (missing asset, etc.)
      }
    }

    render()
    return () => { cancelled = true }
  }, [baseSrc, maskSrc, active?.key, active?.color, strength])

  const pillClass = pillPosition === 'top-right' ? 'dcs-pill top-right' : 'dcs-pill bottom-right'

  return (
    <div className="dcs-wrap">
      <canvas ref={canvasRef} className="dcs-canvas" />
      <div
        className={pillClass}
        role="radiogroup"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={'dcs-swatch' + (opt.key === activeKey ? ' is-active' : '')}
            role="radio"
            aria-checked={opt.key === activeKey}
            title={opt.label}
            onClick={() => setActiveKey(opt.key)}
          >
            <span className="dcs-dot" style={{ background: opt.swatch }} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load: ' + src))
    img.src = src
  })
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function hexToRgb(hex) {
  const h = (hex || '').trim().replace('#', '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return { r, g, b }
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return { r, g, b }
  }
  // fallback neutral grey
  return { r: 128, g: 128, b: 128 }
}
