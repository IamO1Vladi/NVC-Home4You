// The WebGL half of UnfoldHouse, loaded with React.lazy so three.js (imported by
// unfoldScene.js) lands in a chunk of its own that only the planner page asks for, and
// only once the house is about to scroll into view. It creates the scene once, hands its
// controls up to UnfoldHouse (which drives every frame) and frees all of it on unmount.
import React, { useEffect, useRef } from 'react'
import { createUnfoldScene } from './unfoldScene.js'

export default function UnfoldCanvas({ modelKey, dark, T, label, onReady, onFail, onDragStart }) {
  const hostRef = useRef(null)
  // The first values only: later changes reach the scene through the controls it hands up.
  const initial = useRef({ modelKey, dark, T, onReady, onFail, onDragStart })

  useEffect(() => {
    const { modelKey: key, dark: isDark, T: t, onReady: ready, onFail: fail, onDragStart: dragStart } = initial.current
    let scene = null
    try {
      scene = createUnfoldScene(hostRef.current, { modelKey: key, dark: isDark, T: t, onDragStart: dragStart })
    } catch (error) {
      // no WebGL context (old device, disabled GPU): the poster stays
      fail?.(error)
      return undefined
    }
    ready?.(scene)
    return () => {
      ready?.(null)
      scene.dispose()
    }
  }, [])

  return <div ref={hostRef} className="uh-canvas-host" role="img" aria-label={label} />
}
