import React, { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Steps from './components/Steps.jsx'
import WhyUs from './components/WhyUs.jsx'
import Gallery from './components/Gallery.jsx'
import FAQ from './components/FAQPro.jsx'
import About from './components/About.jsx'
import Modal from './components/Modal.jsx'
import MobileDock from './components/MobileDock.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ModalActionsProvider } from './context/ModalActions.jsx'
import { I18nProvider, useI18n } from './i18n/I18nContext.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || '' // vite proxy handles '' in dev

function Home({ onOpenOffer, onOpenQuestion }){
  const { t } = useI18n()
  return (
    <main>
      <Hero onOpenOffer={onOpenOffer} onOpenQuestion={onOpenQuestion} />
      <Steps />
      <WhyUs />
      <section>
        <div className="container">
          <div className="mt-10 card p-10 center">
            <h2 style={{margin:0,fontSize:'clamp(22px,3.5vw,28px)'}}>{t('cta.title')}</h2>
            <p className="mt-3" style={{opacity:.85}}>{t('cta.desc')}</p>
            <div className="row center mt-6" style={{justifyContent:'center'}}>
              <button className="btn" onClick={onOpenOffer}>{t('nav.getOffer')}</button>
              <button className="btn ghost" onClick={onOpenQuestion}>{t('nav.askQuestion')}</button>
            </div>
            <div className="mt-6" style={{opacity:.8}}>
              <div>📞 +359 88 123 4567</div>
              <div>✉️ contact@nvc-home4you.com</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function Services(){
  const { t, dict } = useI18n()
  return (
    <main>
      <section>
        <div className="container">
          <h1 style={{fontSize:'clamp(28px,4vw,40px)',margin:0}}>{t('services.heading')}</h1>
          <p className="mt-2" style={{opacity:.85}}>{t('services.sub')}</p>
          <div className="grid cols-2 md-cols-3 mt-6">
            {dict.services.categories.map((cat) => (
              <div className="card p-6" key={cat.h}>
                <div className="mb-2" style={{fontWeight:700}}><span className="grad-text">{cat.h}</span></div>
                <ul style={{margin:0,paddingLeft:18,opacity:.9}}>
                  {cat.items.map(([title, desc]) => (
                    <li className="mt-2" key={title}><strong>{title}</strong> — {desc}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function _App(){
  const { t } = useI18n()

  // SINGLE declarations (no duplicates)
  const [offerOpen, setOfferOpen] = useState(false)
  const [questionOpen, setQuestionOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState(null)
  const [toast, setToast] = useState({ show:false, kind:'success', text:'' })
  const showToast = (kind, text) => { setToast({ show:true, kind, text }); setTimeout(()=>setToast(t=>({...t, show:false})), 2600); } // hook this up from Gallery when needed

  // ---- handlers live in the SAME component that renders the forms ----
  const submitOffer = useCallback(async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      phone: fd.get('phone') || '',
      project: fd.get('project') || '',
      modelId: fd.get('modelId') || '' // can be blank from Home/Hero
    }
    if (!payload.name || !payload.email) return // extra guard; HTML5 'required' also helps
    const res = await fetch(API_BASE + '/api/offer', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    if(!res.ok){ console.error(await res.text()); showToast('error','Failed to submit offer'); return }
    showToast('success','Your request has been sent!'); setOfferOpen(false);
  }, [])

  const submitQuestion = useCallback(async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      question: fd.get('question') || ''
    }
    if (!payload.name || !payload.email) return
    const res = await fetch(API_BASE + '/api/question', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    if(!res.ok){ console.error(await res.text()); showToast('error','Failed to submit question'); return }
    showToast('success','Your question has been sent!'); setQuestionOpen(false);
  }, [])
  // -------------------------------------------------------------------

  return (
    <div>
      <ModalActionsProvider onOpenOffer={()=>setOfferOpen(true)} onOpenQuestion={()=>setQuestionOpen(true)}>
        <Header onOpenOffer={()=>setOfferOpen(true)} onOpenQuestion={()=>setQuestionOpen(true)} />

        <Routes>
          <Route path="/" element={<Home onOpenOffer={()=>setOfferOpen(true)} onOpenQuestion={()=>setQuestionOpen(true)} />} />
          <Route path="/services" element={<Services />} />
         <Route path="/gallery" element={
    <Gallery onRequestModel={(m) => {
      // normalize: accept id, modelId or modelID from API/lightbox
      const id = String(m?.id ?? m?.modelId ?? m?.modelID ?? '');
      const title = m?.title ?? m?.name ?? '';
      if (id) setSelectedModel({ id, title });
      setOfferOpen(true);
    }} />
  }
/>
          <Route path="/faq" element={<FAQ />} />
          <Route path="/about" element={<About />} />
        </Routes>

        {/* Offer modal */}
        <Modal open={offerOpen} onClose={()=>setOfferOpen(false)} title={t('forms.offer')}>
          <form className="grid" style={{gap:10}} onSubmit={submitOffer}>
            <input name="name" required placeholder={t('forms.name')} autoComplete="name" />
            <input name="email" type="email" required placeholder={t('forms.email')} autoComplete="email" />
            <input name="phone" placeholder={t('forms.phone')} autoComplete="tel" />
            <textarea name="project" rows="4" required placeholder={t('forms.project')} />
            <input type="hidden" name="modelId" value={selectedModel?.id || ''} />
            <button className="btn" type="submit">{t('forms.submit')}</button>
          </form>
        </Modal>

        {/* Question modal */}
        <Modal open={questionOpen} onClose={()=>setQuestionOpen(false)} title={t('forms.question')}>
          <form className="grid" style={{gap:10}} onSubmit={submitQuestion}>
            <input name="name" required placeholder={t('forms.name')} autoComplete="name" />
            <input name="email" type="email" required placeholder={t('forms.email')} autoComplete="email" />
            <textarea name="question" rows="4" required placeholder={t('forms.question')} />
            <button className="btn" type="submit">{t('forms.send')}</button>
          </form>
        </Modal>

        <MobileDock />
        {toast.show && (
          <div style={{
            position:'fixed', right:16, top:16, zIndex:9999, maxWidth:340,
            background: toast.kind==='success' ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#dc2626,#ef4444)',
            color:'#fff', borderRadius:12, padding:'12px 14px', boxShadow:'0 10px 30px rgba(0,0,0,.2)'
          }}>
            <div style={{fontWeight:700, marginBottom:4}}>{toast.kind==='success' ? 'Success' : 'Error'}</div>
            <div style={{opacity:.95}}>{toast.text}</div>
          </div>
        )}
      </ModalActionsProvider>
    </div>
  )
}

export default function App(){
  return (
    <ThemeProvider>
      <I18nProvider>
        <_App />
      </I18nProvider>
    </ThemeProvider>
  )
}
