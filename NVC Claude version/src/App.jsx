import React, { useState, useCallback, lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LazyMotion, domAnimation } from 'framer-motion'
import Header from './components/Header.jsx'
import Modal from './components/Modal.jsx'
import MobileDock from './components/MobileDock.jsx'
import ContactDock from './components/ContactDock.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ModalActionsProvider } from './context/ModalActions.jsx'
import { I18nProvider, useI18n } from './i18n/I18nContext.jsx'
import { paths, getLocaleFromPath, getLocalizedPath, getPageKeyByPath } from './routes/paths.js'
import { getHomeContent } from './content/home/index.js'
import SEO from './components/SEO.jsx'
import { getRouteSeo } from './seo/routeMeta.js'
import { readConfiguratorPrefill } from './lib/configPrefill.js'
import { trackEvent } from './lib/analytics.js'
import { submitInBackground } from './lib/backgroundSubmit.js'
import SubmitStatus from './components/SubmitStatus.jsx'

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

const BgPricesRoute = lazy(() => import('./routes/bg/BgPricesRoute.jsx'))
const EnPricesRoute = lazy(() => import('./routes/en/EnPricesRoute.jsx'))
const ElPricesRoute = lazy(() => import('./routes/el/ElPricesRoute.jsx'))

const EnPrivacyRoute = lazy(() => import('./routes/en/EnPrivacyRoute.jsx'))
const BgPrivacyRoute = lazy(() => import('./routes/bg/BgPrivacyRoute.jsx'))
const ElPrivacyRoute = lazy(() => import('./routes/el/ElPrivacyRoute.jsx'))

const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))

// The customer's order tracking page. Unlisted and noindex: the code in the URL is the
// only credential, so it is not in the sitemap and not linked from anywhere on the site.
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage.jsx'))

// Staff admin panel. Entra ID protects the API it calls; this is only the UI, so a
// signed-out visitor reaching it sees a sign-in prompt and no data.
const AdminHomePage = lazy(() => import('./pages/AdminHomePage.jsx'))
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage.jsx'))
const AdminReviewsPage = lazy(() => import('./pages/AdminReviewsPage.jsx'))
const AdminInquiriesPage = lazy(() => import('./pages/AdminInquiriesPage.jsx'))
const AdminPipelinePage = lazy(() => import('./pages/AdminPipelinePage.jsx'))
const AdminCustomersPage = lazy(() => import('./pages/AdminCustomersPage.jsx'))
const AdminFactoriesPage = lazy(() => import('./pages/AdminFactoriesPage.jsx'))
const AdminGalleryPage = lazy(() => import('./pages/AdminGalleryPage.jsx'))
const AdminCasesPage = lazy(() => import('./pages/AdminCasesPage.jsx'))
const AdminAuditPage = lazy(() => import('./pages/AdminAuditPage.jsx'))
const AdminFactorySheetsPage = lazy(() => import('./pages/AdminFactorySheetsPage.jsx'))
const AdminDocumentsPage = lazy(() => import('./pages/AdminDocumentsPage.jsx'))

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

  // Internal tools render full-screen without the marketing header/footer/widgets.
  const isInternal = location.pathname.startsWith('/internal/') || location.pathname.startsWith('/admin')

  // The configurator and the floor planner are hands-on tools with their own fixed
  // corner controls, so the floating chat launcher covers them instead of helping.
  const toolPageKey = getPageKeyByPath(location.pathname)
  const isBuilderTool = toolPageKey === 'boxConfigurator' || toolPageKey === 'planner'

  const [offerOpen, setOfferOpen] = useState(false)
  const [questionOpen, setQuestionOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState(null)
  const [offerPrefillData, setOfferPrefillData] = useState(null)
  const [questionPrefillData, setQuestionPrefillData] = useState(null)

  // The configurator stores its summary in sessionStorage right before calling
  // openOffer/openQuestion; prefill the modal message with it (configurator page only).
  // The full object is kept so submit handlers can attach model/total to analytics.
  const openOfferModal = useCallback(() => {
    setOfferPrefillData(readConfiguratorPrefill(window.location.pathname))
    setOfferOpen(true)
  }, [])

  const openQuestionModal = useCallback(() => {
    setQuestionPrefillData(readConfiguratorPrefill(window.location.pathname))
    setQuestionOpen(true)
  }, [])

  // selectedModel is only ever set (from a gallery model's "request a quote"), so without
  // this it stuck for the whole session: a visitor who looked at one house and later
  // enquired from the configurator or the doors page sent that stale house id as the
  // offer's Related Houses/Wagon, and sales saw the wrong product on the lead.
  // A model reference belongs to the enquiry it was picked for and nothing after it.
  useEffect(() => {
    setSelectedModel(null)
  }, [location.pathname])

  const offerPrefill = offerPrefillData?.offerText || ''
  const questionPrefill = questionPrefillData?.questionText || ''

  const trackRequestQuote = useCallback((payload) => {
    if (typeof window === 'undefined') return
    const leadValue = Number(payload.leadValue) || 0
    // Push the API catalogue id (contentId), not the Quickbase model id, to stay consistent
    // with the Meta Pixel. Empty when the item has no catalogue id.
    trackEvent('request_quote_success', {
      form_type: 'offer',
      content_id: payload.catalogId || '',
      lead_source: payload.leadSource || 'site',
      model_label: payload.modelLabel || '',
      ...(leadValue ? { lead_value: leadValue, currency: 'EUR' } : {}),
    })

   if (typeof window.fbq === 'function') {
    const metaPayload = {
      content_name: 'Request quote',
      content_category: 'Offer form',
      form_type: 'offer',
    }

    // Only the API catalogue id (contentId) may reach Meta — never the Quickbase model id.
    const contentId = payload.catalogId
    if (contentId) {
      metaPayload.content_ids = [String(contentId)]
      metaPayload.content_type = 'product'
    }
    if (leadValue) {
      metaPayload.value = leadValue
      metaPayload.currency = 'EUR'
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

  // Fire-and-forget (owner, 2026-08-18): the modal closes the moment Send is pressed and
  // the request runs in the background with retries, reported by the top-right banner. A
  // visitor staring at a button that appears to do nothing presses it again — which is how
  // one enquiry used to arrive five times.
  const submitOffer = useCallback((e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      phone: fd.get('phone') || '',
      project: fd.get('project') || '',
      modelId: fd.get('modelId') || '',
      locale: currentLocale,
    }
    if (!payload.name || !payload.email) return

    // Captured NOW: closing the modal resets the prefill state, and the analytics context
    // belongs to the enquiry as it was made, not to whatever the page looks like when the
    // request finally lands.
    const analytics = {
      catalogId: selectedModel?.catalogId || '',
      leadSource: offerPrefillData?.source || 'site',
      modelLabel: offerPrefillData?.modelLabel || '',
      leadValue: offerPrefillData?.knownTotal || 0,
    }

    setOfferOpen(false)
    submitInBackground({
      url: API_BASE + '/api/offer',
      payload,
      labels: {
        sending: ui.common.banner.sending,
        retrying: ui.common.banner.retrying,
        success: ui.common.toast.offerSuccess,
        error: ui.common.toast.offerError,
        retry: ui.common.banner.retry,
        close: ui.common.close,
      },
      // Analytics only on a CONFIRMED send: a tracked lead must be one the server has.
      onSuccess: () => trackRequestQuote({ ...payload, ...analytics }),
    })
  }, [trackRequestQuote, selectedModel, offerPrefillData, currentLocale, ui.common])

  const submitQuestion = useCallback((e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      question: fd.get('question') || '',
      locale: currentLocale,
    }
    if (!payload.name || !payload.email) return

    const analytics = {
      lead_source: questionPrefillData?.source || 'site',
      model_label: questionPrefillData?.modelLabel || '',
    }

    setQuestionOpen(false)
    submitInBackground({
      url: API_BASE + '/api/question',
      payload,
      labels: {
        sending: ui.common.banner.sending,
        retrying: ui.common.banner.retrying,
        success: ui.common.toast.questionSuccess,
        error: ui.common.toast.questionError,
        retry: ui.common.banner.retry,
        close: ui.common.close,
      },
      onSuccess: () => {
        // The Meta event used to fire before the response came back, counting contacts
        // that never reached us. Success-only now, like everything else tracked here.
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
          window.fbq('track', 'Contact', {
            content_name: 'Question form',
            content_category: 'Contact form',
          })
        }
        trackEvent('ask_question_success', { form_type: 'question', ...analytics })
      },
    })
  }, [questionPrefillData, currentLocale, ui.common])

  const homeRedirect = paths.home[currentLocale] || paths.home.en
  const modularBuildsRedirect = paths.modularBuilds[currentLocale] || paths.modularBuilds.en
  const modularHousesRedirect = paths.modularHouses[currentLocale] || paths.modularHouses.en
  const faqRedirect = paths.faq[currentLocale] || paths.faq.en
  const aboutRedirect = paths.about[currentLocale] || paths.about.en
  const steelHousesRedirect = paths.steelHouses[currentLocale] || paths.steelHouses.en
  const galleryRedirect = paths.gallery[currentLocale] || paths.gallery.en

  return (
    <div>
      <ModalActionsProvider onOpenOffer={openOfferModal} onOpenQuestion={openQuestionModal}>
        <LocalePathGate>
          {(() => {
            const routeSeo = getRouteSeo(location.pathname, currentLocale)
            return routeSeo ? <SEO {...routeSeo} /> : null
          })()}
          {!isInternal && <Header locale={currentLocale} content={ui.header} onLanguageChange={handleLanguageChange} onOpenOffer={openOfferModal} />}

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
        openOfferModal()
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
        openOfferModal()
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
        openOfferModal()
      }}
    />
  }
/>
              <Route path={paths.faq.en} element={<EnFaqRoute />} />
              <Route path={paths.faq.bg} element={<BgFaqRoute />} />
              <Route path={paths.about.en} element={<EnAboutRoute />} />
              <Route path={paths.about.bg} element={<BgAboutRoute />} />

              <Route path={paths.privacy.en} element={<EnPrivacyRoute />} />
              <Route path={paths.privacy.bg} element={<BgPrivacyRoute />} />
              <Route path={paths.privacy.el} element={<ElPrivacyRoute />} />

              {/* Hidden internal tool: factory order sheet (unlisted, noindex, password-gated). */}
              {/* The old internal tool, retired 2026-08-18. The redirect keeps every
                  bookmark working, and the admin page offers to import the sheet still
                  sitting in this browser's localStorage (same origin, so it can). */}
              <Route path="/order/:reference" element={<OrderTrackingPage />} />
              <Route path="/internal/factory-sheet" element={<Navigate to="/admin/factory-sheets" replace />} />

              {/* Staff admin panel (unlisted, noindex). The API enforces Entra sign-in.
                  /admin is the menu: it used to drop straight into the review queue, which
                  left the other sections reachable only by typing their URL. */}
              <Route path="/admin" element={<AdminHomePage />} />
              <Route path="/admin/orders" element={<AdminOrdersPage />} />
              <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
              {/* /admin/leads used to BE this queue, so a bookmark pointing here means
                  "the enquiries", not the pipeline that now carries the name. Redirect
                  rather than reuse: sending someone to a page that looks similar and holds
                  different records is worse than moving them. */}
              <Route path="/admin/leads" element={<Navigate to="/admin/inquiries" replace />} />
              {/* Prices. Targets the highest-intent query in the market; every competitor
                  ranks for it and we had no page at all. */}
              <Route path={paths.prices.bg} element={<BgPricesRoute />} />
              <Route path={paths.prices.en} element={<EnPricesRoute />} />
              <Route path={paths.prices.el} element={<ElPricesRoute />} />

              <Route path="/admin/pipeline" element={<AdminPipelinePage />} />
              {/* After the pipeline, because that is the journey: an inquiry arrives, it
                  becomes a lead, the lead buys something, and the factory that built it is
                  the reference table the purchase points at. */}
              <Route path="/admin/customers" element={<AdminCustomersPage />} />
              <Route path="/admin/factories" element={<AdminFactoriesPage />} />
              <Route path="/admin/reviews" element={<AdminReviewsPage />} />
              <Route path="/admin/gallery" element={<AdminGalleryPage />} />
              <Route path="/admin/cases" element={<AdminCasesPage />} />
              <Route path="/admin/documents" element={<AdminDocumentsPage />} />
              <Route path="/admin/audit" element={<AdminAuditPage />} />
              <Route path="/admin/factory-sheets" element={<AdminFactorySheetsPage />} />

              {/* Catch-all: unknown URLs render a localized 404 (noindex) instead of a
                  blank soft-404. The .NET fallback returns a real HTTP 404 status too. */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>

          {!isInternal && <SiteFooter locale={currentLocale} />}

          <Modal open={offerOpen} onClose={() => { setOfferOpen(false); setSelectedModel(null) }} title={ui.forms.offer.title} closeLabel={ui.common.close}>
            <form className="grid" style={{ gap: 10 }} onSubmit={submitOffer}>
              <input name="name" required placeholder={ui.forms.offer.fields.name} autoComplete="name" />
              <input name="email" type="email" required placeholder={ui.forms.offer.fields.email} autoComplete="email" />
              <input name="phone" placeholder={ui.forms.offer.fields.phone} autoComplete="tel" />
              {/* Keyed by prefill: forces a remount so defaultValue re-applies even when the
                  exit animation kept the previous modal DOM alive across a quick reopen. */}
              <textarea key={offerPrefill || 'blank'} name="project" rows={offerPrefill ? 8 : 4} required placeholder={ui.forms.offer.fields.project} defaultValue={offerPrefill} />
              <input type="hidden" name="modelId" value={selectedModel?.id || ''} />
              <button className="btn" type="submit">{ui.forms.offer.submit}</button>
            </form>
          </Modal>

          <Modal open={questionOpen} onClose={() => setQuestionOpen(false)} title={ui.forms.question.title} closeLabel={ui.common.close}>
            <form className="grid" style={{ gap: 10 }} onSubmit={submitQuestion}>
              <input name="name" required placeholder={ui.forms.question.fields.name} autoComplete="name" />
              <input name="email" type="email" required placeholder={ui.forms.question.fields.email} autoComplete="email" />
              <textarea key={questionPrefill || 'blank'} name="question" rows={questionPrefill ? 8 : 4} required placeholder={ui.forms.question.fields.question} defaultValue={questionPrefill} />
              <button className="btn" type="submit">{ui.forms.question.submit}</button>
            </form>
          </Modal>

          {!isInternal && !isBuilderTool && <ContactDock labels={{ contact: ui.common.contactLabel, whatsapp: ui.common.whatsAppChatLabel, viber: ui.common.viberChatLabel }} />}

          {!isInternal && <MobileDock content={ui.home.mobileDock} />}
          <SubmitStatus />
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
