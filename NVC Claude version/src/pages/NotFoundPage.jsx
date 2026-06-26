import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO from '../components/SEO.jsx'
import { paths, getLocaleFromPath } from '../routes/paths.js'

// Small inline dictionary — a 404 page needs only a handful of strings, so we keep
// them here rather than spinning up three content files.
const COPY = {
  en: {
    code: '404',
    title: 'Page not found',
    lead: "Sorry, the page you are looking for doesn’t exist or has been moved.",
    home: 'Go to homepage',
    helpful: 'Helpful links',
    links: [
      { key: 'gallery', label: 'Gallery' },
      { key: 'modularHouses', label: 'Modular houses' },
      { key: 'faq', label: 'FAQ' },
      { key: 'about', label: 'About us' },
    ],
  },
  bg: {
    code: '404',
    title: 'Страницата не е намерена',
    lead: 'Съжаляваме, страницата, която търсите, не съществува или е преместена.',
    home: 'Към началната страница',
    helpful: 'Полезни връзки',
    links: [
      { key: 'gallery', label: 'Галерия' },
      { key: 'modularHouses', label: 'Модулни къщи' },
      { key: 'faq', label: 'Често задавани въпроси' },
      { key: 'about', label: 'За нас' },
    ],
  },
  el: {
    code: '404',
    title: 'Η σελίδα δεν βρέθηκε',
    lead: 'Λυπούμαστε, η σελίδα που αναζητάτε δεν υπάρχει ή έχει μετακινηθεί.',
    home: 'Στην αρχική σελίδα',
    helpful: 'Χρήσιμοι σύνδεσμοι',
    links: [
      { key: 'gallery', label: 'Γκαλερί' },
      { key: 'modularHouses', label: 'Δομικά σπίτια' },
      { key: 'faq', label: 'Συχνές ερωτήσεις' },
      { key: 'about', label: 'Σχετικά με εμάς' },
    ],
  },
}

export default function NotFoundPage() {
  const location = useLocation()
  const locale = getLocaleFromPath(location.pathname) || 'en'
  const t = COPY[locale] || COPY.en
  const homePath = paths.home[locale] || paths.home.en

  return (
    <main className="arx">
      {/* noindex so search engines drop these URLs and don't treat the SPA shell as a
          soft 404. The .NET fallback also returns a real HTTP 404 status for unknown paths. */}
      <SEO
        title={`${t.title} | NVC Home4You`}
        description={t.lead}
        locale={locale}
        noindex
      />
      <section>
        <div className="container" style={{ maxWidth: 720 }}>
          <div
            className="card p-6"
            style={{ marginTop: 48, textAlign: 'center' }}
          >
            <div
              className="grad-text"
              style={{ fontSize: 'clamp(56px, 12vw, 96px)', fontWeight: 800, lineHeight: 1 }}
              aria-hidden="true"
            >
              {t.code}
            </div>
            <h1 style={{ marginTop: 8 }}>{t.title}</h1>
            <p style={{ opacity: 0.88, maxWidth: '52ch', margin: '8px auto 20px' }}>{t.lead}</p>

            <Link className="btn" to={homePath}>{t.home}</Link>

            <div style={{ marginTop: 28 }}>
              <div className="mb-2" style={{ opacity: 0.75 }}>{t.helpful}</div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  justifyContent: 'center',
                }}
              >
                {t.links.map((l) => {
                  const to = paths[l.key]?.[locale] || paths[l.key]?.en
                  if (!to) return null
                  return (
                    <Link key={l.key} to={to} className="btn ghost">{l.label}</Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
