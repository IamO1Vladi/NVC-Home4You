import React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO.jsx'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { paths } from '../routes/paths.js'
import { isValidRepSlug, saveRep } from '../lib/repAttribution.js'

// The landing page behind a representative's link, /r/{slug} (ROADMAP #38).
//
// A representative puts ONE link in a video. Whoever follows it lands here, and from here
// every enquiry they send — the offer form this page opens, the configurator it links to,
// anything else on the site for the next month — is attributed to that representative,
// because the page remembers the slug (repAttribution) and the forms send it along.
//
// That is the whole job, so the page is deliberately short: one sentence, two ways in.
// It renders inside the site's own header and footer, because the visitor is a customer
// and this has to look like the site the video was about, not like a tool that escaped.
//
// An unknown slug renders exactly the same page and stores nothing: a visitor with a
// mistyped link still gets to ask for an offer, and nobody learns from the page which
// slugs exist. The server resolves the slug on every enquiry anyway.
//
// NOINDEX and not in paths.js, so the URL stays out of the prerender, the SEO manifest and
// the sitemap: a representative's page in a search result would attribute strangers to him.

const COPY = {
  bg: {
    eyebrow: 'NVC Home4You',
    title: 'Поискайте оферта за вашата модулна къща',
    lead: 'Попълнете формата и наш консултант ще се свърже с вас. Или сглобете дома си сами в конфигуратора и поискайте оферта оттам.',
    offer: 'Поискай оферта',
    configurator: 'Отвори конфигуратора',
    note: 'Без ангажимент. Отговаряме в рамките на един работен ден.',
  },
  en: {
    eyebrow: 'NVC Home4You',
    title: 'Request an offer for your modular home',
    lead: 'Fill in the form and one of our consultants will contact you. Or assemble your home yourself in the configurator and request an offer from there.',
    offer: 'Request an offer',
    configurator: 'Open the configurator',
    note: 'No commitment. We reply within one working day.',
  },
  el: {
    eyebrow: 'NVC Home4You',
    title: 'Ζητήστε προσφορά για το δομικό σας σπίτι',
    lead: 'Συμπληρώστε τη φόρμα και ένας σύμβουλός μας θα επικοινωνήσει μαζί σας. Ή συνθέστε μόνοι σας το σπίτι σας στον διαμορφωτή και ζητήστε προσφορά από εκεί.',
    offer: 'Ζητήστε προσφορά',
    configurator: 'Ανοίξτε τον διαμορφωτή',
    note: 'Χωρίς δέσμευση. Απαντάμε εντός μίας εργάσιμης ημέρας.',
  },
}

const langKeyOf = (lang) => {
  const l = String(lang || '').toLowerCase()
  if (l.startsWith('bg')) return 'bg'
  if (l.startsWith('el')) return 'el'
  return 'en'
}

// A language this page can speak, or null, so "?lang=fr" falls through to the site's own
// guess instead of deciding it (same as OrderTrackingPage).
const spokenLang = (value) => {
  const l = String(value || '').trim().toLowerCase().split(/[-_]/)[0]
  return ['bg', 'el', 'en'].includes(l) ? l : null
}

export default function RepresentativePage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const { lang, setLang } = useI18n()
  const { openOffer } = useModalActions()

  // Remembered on arrival, before the visitor does anything: the point of the link is that
  // the enquiry can come later, from any page, and still carry the slug.
  React.useEffect(() => {
    if (isValidRepSlug(slug)) saveRep(slug)
  }, [slug])

  // WHICH LANGUAGE. The URL has no locale prefix, so the site's own guess (the last
  // language used on this device, else the browser's) is what a bare link gets. A
  // representative who knows his audience adds ?lang=bg|en|el, applied ONCE as the site
  // language so the header, the footer and the offer form follow it; after that the
  // header's own switch still works rather than being overruled.
  const urlLang = spokenLang(searchParams.get('lang'))
  React.useEffect(() => {
    if (urlLang) setLang(urlLang)
  }, [urlLang, setLang])

  const locale = langKeyOf(urlLang || lang)
  const t = COPY[locale] || COPY.en
  const configuratorPath = paths.boxConfigurator[locale] || paths.boxConfigurator.en

  return (
    <main>
      <SEO
        title={`${t.title} | NVC Home4You`}
        description={t.lead}
        locale={locale}
        noindex
      />
      <section className="hero">
        <div className="container" style={{ maxWidth: 760 }}>
          <div
            className="card"
            style={{ marginTop: 24, textAlign: 'center', padding: 'clamp(28px, 6vw, 56px) clamp(20px, 5vw, 48px)' }}
          >
            <p
              className="grad-text"
              style={{ margin: '0 0 10px', fontSize: '.8rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}
            >
              {t.eyebrow}
            </p>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.1 }}>{t.title}</h1>
            <p style={{ color: 'var(--muted)', maxWidth: '52ch', margin: '16px auto 0' }}>{t.lead}</p>

            <div className="row mt-6" style={{ justifyContent: 'center' }}>
              <button className="btn" type="button" onClick={openOffer}>{t.offer}</button>
              <Link className="btn ghost" to={configuratorPath}>{t.configurator}</Link>
            </div>

            <p className="mt-5" style={{ margin: '20px 0 0', opacity: 0.7, fontSize: '.92rem' }}>{t.note}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
