import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'

export default function Steps(){
  const { t } = useI18n()
  const STEPS = t('steps.labels')
  const [active, setActive] = useState(0)
  const pct = useMemo(()=> Math.round(((active+1)/STEPS.length)*100), [active, STEPS.length])

  return (
    <section>
      <div className="container">
        <div className="card p-6">
          <div className="between">
            <h2 style={{margin:0, fontSize:'clamp(22px,3.5vw,28px)'}}>{t('steps.heading')}</h2>
            <div style={{fontSize:14, opacity:.8}}>{t('steps.progress')}: <strong aria-live="polite">{pct}%</strong></div>
          </div>
          <div className="progress mt-3" aria-hidden="true">
            <motion.div initial={{width: '16%'}} animate={{width: pct + '%'}} transition={{type:'spring', stiffness:250, damping:30}}/>
          </div>

          <div className="steps-grid mt-6">
            {STEPS.map((s, i)=>(
              <motion.button key={s.t} className={'step' + (i===active ? ' active' : '')} onClick={()=>setActive(i)} whileTap={{scale:.99}} layout>
                <span className="bubble">{i+1}</span>
                <strong>{s.t}</strong>
                <div style={{opacity:.85, marginTop:6}}>{s.d}</div>
              </motion.button>
            ))}
          </div>

          <div className="card p-6 mt-6" aria-live="polite">
            <div style={{fontSize:12, letterSpacing:'.12em', opacity:.7, textTransform:'uppercase'}}>
              Step <span>{active+1}</span> of <span>{STEPS.length}</span>
            </div>
            <div className="mt-2" style={{fontSize:20, fontWeight:700}}>
              <span className="grad-text">{STEPS[active].t}</span>
            </div>
            <p className="mt-2" style={{opacity:.9}}>
              {STEPS[active].d} We outline responsibilities, milestones, and decision points.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
