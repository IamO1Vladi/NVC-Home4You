import React, { useEffect, useState } from 'react'
import Lightbox from './Lightbox.jsx'
import { useI18n } from '../i18n/I18nContext.jsx'

export default function Gallery({ onRequestModel }){
  const { lang } = useI18n?.() || { lang: 'en' }
  const isBg = String(lang).toLowerCase().startsWith('bg')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [si, setSi] = useState(0)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    async function load(){
      try{
        const base = import.meta.env.VITE_API_BASE || ''
        const res = await fetch(base + '/api/gallery')  // ← single fetch
        if(!res.ok) throw new Error('Failed to load gallery')
        const json = await res.json()
        setItems(json.items || [])
      }catch(e){ setError(e.message) } finally { setLoading(false) }
    }
    load()
  }, []) // ← not dependent on lang

  function openLightbox(i, imageIndex=0){ setSi(i); setIdx(imageIndex); setOpen(true) }

  return (
    <section>
      <div className="container">
        <h1 style={{fontSize:'clamp(28px,4vw,40px)',margin:0}}>Gallery</h1>
        <p className="mt-2" style={{opacity:.85}}>Browse product types. Click to open a detail view with more photos.</p>

        {loading && (<div className="grid cols-2 md-cols-3 mt-6">{[...Array(6)].map((_,i)=>(<div key={i} className="tile" style={{height:230, background:'#ffffff12'}}/>))}</div>)}
        {error && <div className="mt-6" style={{opacity:.8}}>Couldn’t load gallery. Please try again later.</div>}

        {!loading && !error && (
          <div className="grid cols-2 md-cols-3 mt-6">
            {items.map((s, i) => {
              const title = isBg && s.titleBg ? s.titleBg : s.title
              const desc  = isBg && s.descriptionBg ? s.descriptionBg : s.description
              return (
                <button key={s.id || s.title} className="tile" onClick={()=>openLightbox(i,0)}>
                  <img alt="" src={s.coverUrl} loading="lazy" decoding="async" />
                  <div className="p-6">
                    <div style={{fontWeight:700}}>{title}</div>
                    <div style={{opacity:.7, fontSize:14}}>{s.price ? `${s.price} ${s.currency||''}` : 'Open to view images'}</div>
                    {/* If you show snippets, use `desc` here */}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {open && items[si] && (() => {
        const s = items[si]
        const title = isBg && s.titleBg ? s.titleBg : s.title
        const desc  = isBg && s.descriptionBg ? s.descriptionBg : s.description
        return (
          <Lightbox
            modelId={s.id}
            title={title}
            images={s.images}
            price={s.price}
            currency={s.currency || 'EUR'}
            desc={desc}
            index={idx}
            onClose={()=>setOpen(false)}
            onRequest={(payload)=> onRequestModel?.(payload)}
          />
        )
      })()}
    </section>
  )
}
