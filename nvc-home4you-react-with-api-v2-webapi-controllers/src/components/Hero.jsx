import React from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'

export default function Hero({ onOpenOffer, onOpenQuestion }){
  const { t } = useI18n()
  const title = t('hero.title')

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <motion.h1 style={{fontSize:'clamp(32px,5vw,56px)',lineHeight:1.05,margin:0}}
              initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{duration:.5}}>
              <span dangerouslySetInnerHTML={{__html: title.replace('<g>', '<span class=\'grad-text\'>').replace('</g>', '</span>')}} />
            </motion.h1>
            <motion.p className="mt-5" style={{maxWidth:640,color:'var(--muted)'}}
              initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:.05, duration:.5}}>
              {t('hero.lead')}
            </motion.p>
            <motion.ul className="mt-5" style={{color:'var(--text)'}} initial="hidden" animate="show"
              variants={{hidden:{opacity:0,y:8}, show:{opacity:1,y:0, transition:{staggerChildren:.06}}}}>
              {t('hero.bullets').map((s,i)=>(
                <motion.li key={i} variants={{hidden:{opacity:0,y:4}, show:{opacity:1,y:0}}}>✔️ {s}</motion.li>
              ))}
            </motion.ul>
            <div className="row mt-6">
              <motion.button className="btn" onClick={onOpenOffer} whileTap={{scale:.98}}>{t('nav.getOffer')}</motion.button>
              <motion.button className="btn ghost" onClick={onOpenQuestion} whileTap={{scale:.98}}>{t('nav.askQuestion')}</motion.button>
            </div>
            <div className="mt-4" style={{opacity:.7}}>{t('brand.motto')}</div>
          </div>
          <div>
            <div className="hero-visual">
              <div><motion.div className="hero-orb" aria-hidden="true" initial={{opacity:0, scale:1.02}} animate={{opacity:1, scale:1}} transition={{duration:.6, ease:[0.2,0.8,0.2,1]}}/></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
