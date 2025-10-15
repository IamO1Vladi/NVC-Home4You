import React from 'react'
import { useInView } from 'framer-motion'
import useCountUp from '../hooks/useCountUp.js'
import { useI18n } from '../i18n/I18nContext.jsx'

export default function Stats(){
  const { dict, t } = useI18n()
  const hostRef = React.useRef(null)
  const inView = useInView(hostRef, { once:true, amount: 0.4 })

  return (
    <section aria-labelledby="stats-title">
      <div className="container">
        <h2 id="stats-title" style={{margin:0,fontSize:'clamp(22px,3.5vw,28px)'}}>{t('home.statsH')}</h2>
        <div className="grid cols-2 md-cols-3 mt-6" ref={hostRef}>
          {dict.home?.stats?.map(([label, value])=>{
            const numRef = React.createRef()
            useCountUp(numRef, value, inView, { duration: 1.2 })
            return (
              <div className="card p-6 stat-card" key={label}>
                <div className="stat-number" ref={numRef} aria-hidden="true">0</div>
                <div className="stat-label">{label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
