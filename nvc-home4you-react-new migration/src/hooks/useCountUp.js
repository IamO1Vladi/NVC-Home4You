import { useEffect } from 'react'
import { animate } from 'framer-motion'

export default function useCountUp(ref, to=100, inView=false, options={}){
  useEffect(()=>{
    if(!ref?.current || !inView) return
    const controls = animate(0, to, {
      duration: options.duration ?? 1.2,
      ease: options.ease ?? [0.2,0.8,0.2,1],
      onUpdate: v => { ref.current.textContent = Math.round(v).toLocaleString() }
    })
    return () => controls.stop()
  }, [ref, to, inView, options.duration])
}
