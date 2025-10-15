import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'

function Segmented({ options, value, onChange }){
  return (
    <div className="segmented" role="tablist" aria-label="FAQ categories">
      {options.map((opt)=>{
        const active = opt === value
        return (
          <button key={opt} className={'seg-btn' + (active ? ' active' : '')} role="tab" aria-selected={active} onClick={()=>onChange(opt)}>{opt}</button>
        )
      })}
    </div>
  )
}

function QAItem({ q, a }){
  const [open, setOpen] = useState(false)
  return (
    <div className={'faqp-item' + (open?' open':'')}>
      <button className="faqp-q" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
        <span>{q}</span>
        <motion.span aria-hidden="true" initial={false} animate={{ rotate: open ? 180 : 0 }} transition={{ duration:.2 }} className="chev">⌄</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="faqp-a" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="faqp-a-inner">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQPro(){
  const { t } = useI18n()
  const groups = t('faq.groups')
  const options = useMemo(()=> groups.map(g=>g.title), [groups])
  const [tab, setTab] = useState(options[0])
  const [query, setQuery] = useState('')

  const list = useMemo(()=>{
    const group = groups.find(g=>g.title === tab) || groups[0]
    let items = group.items
    if(query.trim()){
      const ql = query.toLowerCase()
      items = items.filter(x => (x.q + ' ' + x.a).toLowerCase().includes(ql))
    }
    return items
  }, [groups, tab, query])

  return (
    <section>
      <div className="container">
        <h1 style={{fontSize:'clamp(28px,4vw,40px)',margin:0}}>{t('faq.heading')}</h1>

        <div className="card p-6 mt-6">
          <div className="faqp-top">
            <Segmented options={options} value={tab} onChange={setTab} />
            <div className="faqp-search">
              <input type="search" placeholder={t('faq.search') || 'Search questions...'} value={query} onChange={(e)=>setQuery(e.target.value)} aria-label="Search FAQ" />
            </div>
          </div>

          <div className="faqp-list">
            {list.length === 0 && <div className="muted">{t('faq.noResults') || 'No results'}</div>}
            {list.map(item => <QAItem key={item.q} q={item.q} a={item.a} />)}
          </div>
        </div>
      </div>
    </section>
  )
}
