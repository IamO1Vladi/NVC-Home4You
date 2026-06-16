import React, { useState, useCallback, lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LazyMotion, domAnimation } from 'framer-motion'
import Header from './components/Header.jsx'
import Modal from './components/Modal.jsx'
import MobileDock from './components/MobileDock.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ModalActionsProvider } from './context/ModalActions.jsx'
import { I18nProvider, useI18n } from './i18n/I18nContext.jsx'
import ServicesPage from './pages/ServicesPage.jsx'
import { paths, getLocaleFromPath, getLocalizedPath } from './routes/paths.js'
import { getHomeContent } from './content/home/index.js'
import SEO from './components/SEO.jsx'
import { getRouteSeo } from './seo/routeMeta.js'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const BgHomeRoute = lazy(() => import('./routes/bg/BgHomeRoute.jsx'))
const EnHomeRoute = lazy(() => import('./routes/en/EnHomeRoute.jsx'))

const BgModularHousesRoute = lazy(() => import('./routes/bg/BgModularHousesRoute.jsx'))
const EnModularHousesRoute = lazy(() => import('./routes/en/EnModularHousesRoute.jsx'))

const EnAboutRoute = lazy(() => import('./routes/en/EnAboutRoute.jsx'))
const BgAboutRoute = lazy(() => import('./routes/bg/BgAboutRoute.jsx'))

const EnModularBuildsRoute = lazy(() => import('./routes/en/EnModularBuildsRoute.jsx'))
const BgModularBuildsRoute = lazy(() => import('./routes/bg/BgModularBuildsRoute.jsx'))

const EnFaqRoute = lazy(() => import('./routes/en/EnFaqRoute.jsx'))
const BgFaqRoute = lazy(() => import('./routes/bg/BgFaqRoute.jsx'))
const EnSteelHousesRoute = lazy(() => import('./routes/en/EnSteelHousesRoute.jsx'))
const BgSteelHousesRoute = lazy(() => import('./routes/bg/BgSteelHousesRoute.jsx'))

const EnDeliveryRoute= lazy(()=> import('./routes/en/EnDeliveryRoute.jsx'))
const BgDeliveryRoute= lazy(()=> import('./routes/bg/BgDeliveryRoute.jsx'))

const EnInteriorsRoute= lazy(()=> import('./routes/en/EnInteriorsRoute.jsx'))
const BgInteriorsRoute= lazy(()=> import('./routes/bg/BgInteriorsRoute.jsx'))

const EnInternalDoorsRoute= lazy(()=> import('./routes/en/EnInternalDoorsRoute.jsx'))
const BgInternalDoorsRoute= lazy(()=> import('./routes/bg/BgInternalDoorsRoute.jsx'))

const EnParthnerRoute= lazy(()=> import('./routes/en/EnPartnerRoute.jsx'))
const BgParthnerRoute= lazy(()=> import('./routes/bg/BgPartnerRoute.jsx'))

const EnLogisticsRoute = lazy(()=> import('./routes/en/EnLogisticsRoute.jsx'))
const BgLogisticsRoute = lazy(()=> import('./routes/bg/BgLogisticsRoute.jsx'))

const EnPlannerRoute = lazy(()=> import('./routes/en/EnFloorPlannerRoute.jsx'))
const BgPlannerRoute = lazy(()=> import('./routes/bg/BgFloorPlannerRoute.jsx'))

const EnCasesRoute = lazy(()=> import('./routes/en/EnCasesRoute.jsx'))
const BgCasesRoute = lazy(()=> import('./routes/bg/BgCasesRoute.jsx'))

const BgGalleryRoute = lazy(() => import('./routes/bg/BgGalleryRoute.jsx'))
const EnGalleryRoute = lazy(() => import('./routes/en/EnGalleryRoute.jsx'))

const EnBoxHouseConfiguratorRoute = lazy(()=> import('./routes/en/EnBoxHouseConfiguratorRoute.jsx'))
const BgBoxHouseConfiguratorRoute = lazy(()=> import('./routes/bg/BgBoxHouseConfiguratorRoute.jsx'))

const ElHomeRoute = lazy(() => import('./routes/el/ElHomeRoute.jsx'))
const ElModularHousesRoute = lazy(() => import('./routes/el/ElModularHousesRoute.jsx'))
const ElModularBuildsRoute = lazy(() => import('./routes/el/ElModularBuildsRoute.jsx'))
const ElAboutRoute = lazy(() => import('./routes/el/ElAboutRoute.jsx'))
const ElFaqRoute = lazy(() => import('./routes/el/ElFaqRoute.jsx'))
const ElSteelHousesRoute = lazy(() => import('./routes/el/ElSteelHousesRoute.jsx'))
const ElDeliveryRoute = lazy(() => import('./routes/el/ElDeliveryRoute.jsx'))
const ElInteriorsRoute = lazy(() => import('./routes/el/ElInteriorsRoute.jsx'))
const ElInternalDoorsRoute = lazy(() => import('./routes/el/ElInternalDoorsRoute.jsx'))
const ElPartnerRoute = lazy(() => import('./routes/el/ElPartnerRoute.jsx'))
const ElLogisticsRoute = lazy(() => import('./routes/el/ElLogisticsRoute.jsx'))
const ElPlannerRoute = lazy(() => import('./routes/el/ElFloorPlannerRoute.jsx'))
const ElCasesRoute = lazy(() => import('./routes/el/ElCasesRoute.jsx'))
const ElGalleryRoute = lazy(() => import('./routes/el/ElGalleryRoute.jsx'))
const ElBoxHouseConfiguratorRoute = lazy(() => import('./routes/el/ElBoxHouseConfiguratorRoute.jsx'))

function LocalePathGate({ children }) {
  const location = useLocation()
  const { lang, setLang } = useI18n()
  const pathLocale = getLocaleFromPath(location.pathname)

  useEffect(() => {
    if (pathLocale && pathLocale !== lang) {
      setLang(pathLocale)
    }
    document.documentElement.lang = pathLocale || lang || 'en'
  }, [pathLocale, lang, setLang])

  return children
}

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { lang, setLang } = useI18n()
  const langPrefix = String(lang).toLowerCase().slice(0, 2)
  const fallbackLocale = langPrefix === 'bg' ? 'bg' : langPrefix === 'el' ? 'el' : 'en'
  const currentLocale = getLocaleFromPath(location.pathname) || fallbackLocale
  const ui = getHomeContent(currentLocale)

  const [offerOpen, setOfferOpen] = useState(false)
  const [questionOpen, setQuestionOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState(null)
  const [toast, setToast] = useState({ show: false, kind: 'success', text: '' })

  const showToast = useCallback((kind, text) => {
    setToast({ show: true, kind, text })
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 2600)
  }, [])

  const trackRequestQuote = useCallback((payload) => {
    if (typeof window === 'undefined') return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'request_quote_success',
      form_type: 'offer',
      model_id: payload.modelId || '',
    })

   if (typeof window.fbq === 'function') {
    const metaPayload = {
      content_name: 'Request quote',
      content_category: 'Offer form',
      form_type: 'offer',
    }

    const contentId = payload.catalogId || payload.modelId
    if (contentId) {
      metaPayload.content_ids = [String(contentId)]
      metaPayload.content_type = 'product'
    }

    window.fbq('track', 'Lead', metaPayload)
  }
  }, [])

  const handleLanguageChange = useCallback((nextLocale) => {
    const localized = getLocalizedPath(location.pathname, nextLocale)
    const finalPath = `${localized}${location.search || ''}${location.hash || ''}`
    setLang(nextLocale)
    if (finalPath !== `${location.pathname}${location.search || ''}${location.hash || ''}`) {
      navigate(finalPath)
    }
  }, [location.pathname, location.search, location.hash, navigate, setLang])

  const submitOffer = useCallback(async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      phone: fd.get('phone') || '',
      project: fd.get('project') || '',
      modelId: fd.get('modelId') || '',
    }
    if (!payload.name || !payload.email) return

    const res = await fetch(API_BASE + '/api/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error(await res.text())
      showToast('error', ui.common.toast.offerError)
      return
    }

    trackRequestQuote({ ...payload, catalogId: selectedModel?.catalogId || '' })
    showToast('success', ui.common.toast.offerSuccess)
    setOfferOpen(false)
  }, [showToast, trackRequestQuote, selectedModel, ui.common.toast.offerError, ui.common.toast.offerSuccess])

  const submitQuestion = useCallback(async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      question: fd.get('question') || '',
    }
    if (!payload.name || !payload.email) return

    const res = await fetch(API_BASE + '/api/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
  window.fbq('track', 'Contact', {
    content_name: 'Question form',
    content_category: 'Contact form',
  })
}

    if (!res.ok) {
      console.error(await res.text())
      showToast('error', ui.common.toast.questionError)
      return
    }

    showToast('success', ui.common.toast.questionSuccess)
    setQuestionOpen(false)
  }, [showToast, ui.common.toast.questionError, ui.common.toast.questionSuccess])

  const homeRedirect = paths.home[currentLocale] || paths.home.en
  const modularBuildsRedirect = paths.modularBuilds[currentLocale] || paths.modularBuilds.en
  const modularHousesRedirect = paths.modularHouses[currentLocale] || paths.modularHouses.en
  const faqRedirect = paths.faq[currentLocale] || paths.faq.en
  const aboutRedirect = paths.about[currentLocale] || paths.about.en
  const steelHousesRedirect = paths.steelHouses[currentLocale] || paths.steelHouses.en
  const galleryRedirect = paths.gallery[currentLocale] || paths.gallery.en

  return (
    <div>
      <ModalActionsProvider onOpenOffer={() => setOfferOpen(true)} onOpenQuestion={() => setQuestionOpen(true)}>
        <LocalePathGate>
          {(() => {
            const routeSeo = getRouteSeo(location.pathname, currentLocale)
            return routeSeo ? <SEO {...routeSeo} /> : null
          })()}
          <Header locale={currentLocale} content={ui.header} onLanguageChange={handleLanguageChange} onOpenOffer={() => setOfferOpen(true)} />

          <Suspense fallback={<div className="page-loading" />}>
            <Routes>
              <Route path="/" element={<Navigate to={homeRedirect} replace />} />
              <Route path={paths.home.bg} element={<BgHomeRoute />} />
              <Route path={paths.home.en} element={<EnHomeRoute />} />

              <Route path="/modular-builds" element={<Navigate to={modularBuildsRedirect} replace />} />
              <Route path="/modular-houses" element={<Navigate to={modularHousesRedirect} replace />} />
              <Route path="/faq" element={<Navigate to={faqRedirect} replace />} />
              <Route path="/about" element={<Navigate to={aboutRedirect} replace />} />
              <Route path="/steel-houses" element={<Navigate to={steelHousesRedirect} replace />} />

              <Route path={paths.services.en} element={<ServicesPage content={ui.servicesPage} />} />
              <Route path={paths.modularBuilds.en} element={<EnModularBuildsRoute />} />
              <Route path={paths.modularBuilds.bg} element={<BgModularBuildsRoute />} />
              <Route path={paths.modularHouses.bg} element={<BgModularHousesRoute />} />
              <Route path={paths.modularHouses.en} element={<EnModularHousesRoute />} />
              <Route path={paths.steelHouses.en} element={<EnSteelHousesRoute />} />
              <Route path={paths.steelHouses.bg} element={<BgSteelHousesRoute />} />

              <Route path={paths.interiors.en} element={<EnInteriorsRoute />} />
              <Route path={paths.interiors.bg} element={<BgInteriorsRoute />} />
              <Route path={paths.delivery.en} element={<EnDeliveryRoute />} />
              <Route path={paths.delivery.bg} element={<BgDeliveryRoute />} />
              <Route path={paths.logistics.en} element={<EnLogisticsRoute />} />
              <Route path={paths.logistics.bg} element={<BgLogisticsRoute />} />
              <Route path={paths.partner.en} element={<EnParthnerRoute />} />
              <Route path={paths.partner.bg} element={<BgParthnerRoute />} />
              <Route path={paths.planner.en} element={<EnPlannerRoute />} />
              <Route path={paths.planner.bg} element={<BgPlannerRoute />} />
              <Route path={paths.doors.en} element={<EnInternalDoorsRoute />} />
              <Route path={paths.doors.bg} element={<BgInternalDoorsRoute />} />
              <Route path={paths.cases.en} element={<EnCasesRoute />} />
              <Route path={paths.cases.bg} element={<BgCasesRoute />} />
              <Route path={paths.boxConfigurator.en} element={<EnBoxHouseConfiguratorRoute />} />
              <Route path={paths.boxConfigurator.bg} element={<BgBoxHouseConfiguratorRoute />} />

              <Route path={paths.home.el} element={<ElHomeRoute />} />
              <Route path={paths.modularBuilds.el} element={<ElModularBuildsRoute />} />
              <Route path={paths.modularHouses.el} element={<ElModularHousesRoute />} />
              <Route path={paths.steelHouses.el} element={<ElSteelHousesRoute />} />
              <Route path={paths.interiors.el} element={<ElInteriorsRoute />} />
              <Route path={paths.delivery.el} element={<ElDeliveryRoute />} />
              <Route path={paths.logistics.el} element={<ElLogisticsRoute />} />
              <Route path={paths.partner.el} element={<ElPartnerRoute />} />
              <Route path={paths.planner.el} element={<ElPlannerRoute />} />
              <Route path={paths.doors.el} element={<ElInternalDoorsRoute />} />
              <Route path={paths.cases.el} element={<ElCasesRoute />} />
              <Route path={paths.boxConfigurator.el} element={<ElBoxHouseConfiguratorRoute />} />
              <Route path={paths.services.el} element={<ServicesPage content={ui.servicesPage} />} />
              <Route path={paths.faq.el} element={<ElFaqRoute />} />
              <Route path={paths.about.el} element={<ElAboutRoute />} />
              <Route path="/gallery" element={<Navigate to={galleryRedirect} replace />} />
<Route
  path="/bg/galeriq/*"
  element={
    <BgGalleryRoute
      onRequestModel={(m) => {
        const id = String(m?.id ?? m?.modelId ?? m?.modelID ?? '')
        const title = m?.title ?? m?.name ?? ''
        const catalogId = m?.catalogId ? String(m.catalogId) : ''
        if (id) setSelectedModel({ id, title, catalogId })
        setOfferOpen(true)
      }}
    />
  }
/>
<Route
  path="/en/gallery/*"
  element={
    <EnGalleryRoute
      onRequestModel={(m) => {
        const id = String(m?.id ?? m?.modelId ?? m?.modelID ?? '')
        const title = m?.title ?? m?.name ?? ''
        const catalogId = m?.catalogId ? String(m.catalogId) : ''
        if (id) setSelectedModel({ id, title, catalogId })
        setOfferOpen(true)
      }}
    />
  }
/>
<Route
  path="/el/gkaleri/*"
  element={
    <ElGalleryRoute
      onRequestModel={(m) => {
        const id = String(m?.id ?? m?.modelId ?? m?.modelID ?? '')
        const title = m?.title ?? m?.name ?? ''
        const catalogId = m?.catalogId ? String(m.catalogId) : ''
        if (id) setSelectedModel({ id, title, catalogId })
        setOfferOpen(true)
      }}
    />
  }
/>
              <Route path={paths.faq.en} element={<EnFaqRoute />} />
              <Route path={paths.faq.bg} element={<BgFaqRoute />} />
              <Route path={paths.about.en} element={<EnAboutRoute />} />
              <Route path={paths.about.bg} element={<BgAboutRoute />} />
            </Routes>
          </Suspense>

          <Modal open={offerOpen} onClose={() => setOfferOpen(false)} title={ui.forms.offer.title} closeLabel={ui.common.close}>
            <form className="grid" style={{ gap: 10 }} onSubmit={submitOffer}>
              <input name="name" required placeholder={ui.forms.offer.fields.name} autoComplete="name" />
              <input name="email" type="email" required placeholder={ui.forms.offer.fields.email} autoComplete="email" />
              <input name="phone" placeholder={ui.forms.offer.fields.phone} autoComplete="tel" />
              <textarea name="project" rows="4" required placeholder={ui.forms.offer.fields.project} />
              <input type="hidden" name="modelId" value={selectedModel?.id || ''} />
              <button className="btn" type="submit">{ui.forms.offer.submit}</button>
            </form>
          </Modal>

          <Modal open={questionOpen} onClose={() => setQuestionOpen(false)} title={ui.forms.question.title} closeLabel={ui.common.close}>
            <form className="grid" style={{ gap: 10 }} onSubmit={submitQuestion}>
              <input name="name" required placeholder={ui.forms.question.fields.name} autoComplete="name" />
              <input name="email" type="email" required placeholder={ui.forms.question.fields.email} autoComplete="email" />
              <textarea name="question" rows="4" required placeholder={ui.forms.question.fields.question} />
              <button className="btn" type="submit">{ui.forms.question.submit}</button>
            </form>
          </Modal>

          <a href="viber://chat?number=%2B359892456245" className="viber-bubble" aria-label={ui.common.viberChatLabel}>NVC</a>

          <MobileDock content={ui.home.mobileDock} />
          {toast.show && (
            <div
              style={{
                position: 'fixed',
                right: 16,
                top: 16,
                zIndex: 9999,
                maxWidth: 340,
                background: toast.kind === 'success'
                  ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                  : 'linear-gradient(135deg,#dc2626,#ef4444)',
                color: '#fff',
                borderRadius: 12,
                padding: '12px 14px',
                boxShadow: '0 10px 30px rgba(0,0,0,.2)',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{toast.kind === 'success' ? ui.common.toast.successTitle : ui.common.toast.errorTitle}</div>
              <div style={{ opacity: 0.95 }}>{toast.text}</div>
            </div>
          )}
        </LocalePathGate>
      </ModalActionsProvider>
    </div>
  )
}

export default function App() {
  return (
    <LazyMotion features={domAnimation}>
      <ThemeProvider>
        <I18nProvider>
          <AppShell />
        </I18nProvider>
      </ThemeProvider>
    </LazyMotion>
  )
}
