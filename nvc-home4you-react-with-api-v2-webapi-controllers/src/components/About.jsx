import React, { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'
import RouteChips from './RouteChips.jsx'

export default function About(){
  const ref = useRef(null)
  const inView = useInView(ref, {amount:0.3, once:true})
  const [year] = useState(()=> new Date().getFullYear())
  const { t, dict } = useI18n()

  return (
    <section>
      <div className="container">
        <div className="card p-6">
          <h1 style={{fontSize:'clamp(28px,4vw,40px)',margin:0}}>{t('about.heading')}</h1>
          <p className="mt-3" style={{opacity:.9, maxWidth:900}}>{t('about.missionP')}</p>
        </div>

        <div className="grid cols-2 md-cols-3 mt-6">
          <div className="card p-6" style={{gridColumn:'span 2'}}>
            <h3 className="grad-text" style={{margin:0, marginBottom:8}}>{t('about.missionH')}</h3>
            <p style={{opacity:.9}}>{t('about.missionP')}</p>
            <ul style={{opacity:.9, paddingLeft:18}}>
              <li>Factory-level QA before shipping</li>
              <li>Door-to-door logistics with EU compliance</li>
              <li>Aftercare for warranties, parts, and upgrades</li>
            </ul>
          </div>
          <aside className="card p-6">
            <h4 className="grad-text" style={{margin:0, marginBottom:8}}>{t('about.principlesH')}</h4>
            <ul style={{opacity:.9, paddingLeft:0, listStyle:'none'}}>
              {dict.about.principles.map((p)=>(<li key={p} className="mt-2">✅ {p}</li>))}
            </ul>
          </aside>
        </div>

        <div className="grid cols-2 md-cols-3 mt-6">
          <div className="card p-6 center"><div style={{fontSize:36,fontWeight:800}} className="grad-text">40+</div><div style={{opacity:.8}}>Vetted suppliers</div></div>
          <div className="card p-6 center"><div style={{fontSize:36,fontWeight:800}} className="grad-text">6</div><div style={{opacity:.8}}>Countries served</div></div>
          <div className="card p-6 center"><div style={{fontSize:36,fontWeight:800}} className="grad-text">8</div><div style={{opacity:.8}}>Avg. weeks lead time</div></div>
        </div>

      

        <div className="mt-8">
          <h3 style={{margin:0, marginBottom:8}}>Logistics Routes (illustrative)</h3>
          <div className="grid md-cols-3 mt-6">
            <div className="card p-6">
              <div style={{fontWeight:700, marginBottom:8}}><span className="grad-text">{t('routes.grp1.title')}</span></div>
              <RouteChips nodes={[
                { flag:'🇬🇷', title:'Greece', sub:'Start hub' },
                { flag:'🇧🇬', title:'Bulgaria', sub:'Staging & customs' },
                { flag:'🇧🇬', title:'All around Bulgaria', sub:'Final delivery across BG' }
              ]} />
            </div>
            <div className="card p-6">
              <div style={{fontWeight:700, marginBottom:8}}><span className="grad-text">{t('routes.grp2.title')}</span></div>
              <RouteChips nodes={[
                { flag:'🇬🇷', title:'Greece', sub:'Start hub' },
                { flag:'🇲🇰', title:'Macedonia', sub:'Direct route' }
              ]} />
            </div>
            <div className="card p-6">
              <div style={{fontWeight:700, marginBottom:8}}><span className="grad-text">{t('routes.grp3.title')}</span></div>
              <RouteChips nodes={[
                { flag:'🇬🇷', title:'Greece', sub:'Start hub' },
                { flag:'🇧🇬', title:'Bulgaria', sub:'Transit / staging' },
                { flag:'🇲🇰', title:'Macedonia', sub:'Delivery' }
              ]} />
            </div>
            <div className="card p-6">
              <div style={{fontWeight:700, marginBottom:8}}><span className="grad-text">{t('routes.grp4.title')}</span></div>
              <RouteChips nodes={[
                { flag:'🇬🇷', title:'Greece', sub:'Start hub' },
                { flag:'🇧🇬', title:'Bulgaria', sub:'Transit / staging' },
                { flag:'🇷🇸', title:'Serbia', sub:'Delivery' }
              ]} />
            </div>
            <div className="card p-6">
              <div style={{fontWeight:700, marginBottom:8}}><span className="grad-text">{t('routes.grp5.title')}</span></div>
              <RouteChips nodes={[
                { flag:'🇬🇷', title:'Greece', sub:'Start hub' },
                { flag:'🇧🇬', title:'Bulgaria', sub:'Transit / staging' },
                { flag:'🇷🇴', title:'Romania', sub:'Delivery' }
              ]} />
            </div>
          </div>
        </div>

        <div className="mt-8">
          
        <h3 style={{margin:0, marginBottom:8}}>{t('about.timelineH')}</h3>
        <div className="timeline-rail">
          {dict.about.timeline.map((r) => (
            <div className="time-card" key={r.y}>
              <div className="time-year">{r.y}</div>
              <div className="time-title grad-text">{r.h}</div>
              <div className="time-desc">{r.p}</div>
            </div>
          ))}
        </div>

          
        </div>

        <footer style={{borderTop:'1px solid #ffffff1a',color:'#cbd5e1',textAlign:'center',padding:'18px 0', marginTop:24}}>
          © <span>{year}</span> NVC Home4You — {t('brand.motto')}
        </footer>
      </div>
    </section>
  )
}
