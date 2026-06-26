import React from 'react'

/**
 * Renders the Privacy & Cookie Policy from the locale content object.
 * The "Cookie settings" button re-opens the global consent banner via a custom
 * window event that ConsentBanner listens for (the banner lives outside the router).
 */
export default function PrivacyPage({ content }) {
  const year = new Date().getFullYear()
  const sections = (content && content.sections) || []

  const openConsent = () => {
    if (typeof window === 'undefined') return
    // Clear the stored choice so the banner treats this as a fresh decision, then
    // signal the (already-mounted) ConsentBanner to re-open.
    try {
      localStorage.removeItem('consent.choice')
    } catch (e) {
      /* ignore storage errors (private mode etc.) */
    }
    window.dispatchEvent(new Event('nvc:open-consent'))
  }

  return (
    <main className="arx">
      <section>
        <div className="container" style={{ maxWidth: 880 }}>
          <article className="card p-6" style={{ marginTop: 24 }}>
            <header style={{ marginBottom: 16 }}>
              <h1 className="grad-text" style={{ margin: 0 }}>{content.title}</h1>
              {content.updated && (
                <p style={{ opacity: 0.7, marginTop: 8 }}>{content.updated}</p>
              )}
            </header>

            {content.intro && (
              <p style={{ opacity: 0.92, lineHeight: 1.7 }}>{content.intro}</p>
            )}

            {/* Table of contents */}
            {sections.length > 0 && (
              <nav aria-label={content.tocTitle} style={{ margin: '20px 0' }}>
                {content.tocTitle && (
                  <div className="mb-2"><strong>{content.tocTitle}</strong></div>
                )}
                <ul style={{ display: 'grid', gap: 6, paddingLeft: 18, margin: 0 }}>
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} style={{ opacity: 0.9 }}>{s.h}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {/* Cookie settings callout */}
            {content.manageCookies && (
              <div
                className="card p-4"
                style={{
                  margin: '8px 0 24px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ maxWidth: '60ch' }}>
                  {content.manageCookies.heading && (
                    <div className="mb-2"><strong>{content.manageCookies.heading}</strong></div>
                  )}
                  <span style={{ opacity: 0.88 }}>{content.manageCookies.text}</span>
                </div>
                <button type="button" className="btn" onClick={openConsent}>
                  {content.manageCookies.button}
                </button>
              </div>
            )}

            {/* Sections */}
            {sections.map((s) => (
              <section
                key={s.id}
                id={s.id}
                style={{ scrollMarginTop: 90, marginTop: 24 }}
              >
                <h2 style={{ fontSize: '1.25rem', marginBottom: 10 }}>{s.h}</h2>

                {Array.isArray(s.p) &&
                  s.p.map((para, i) => (
                    <p key={i} style={{ opacity: 0.92, lineHeight: 1.7 }}>{para}</p>
                  ))}

                {s.listLead && <p style={{ opacity: 0.92, lineHeight: 1.7 }}>{s.listLead}</p>}

                {Array.isArray(s.list) && (
                  <ul style={{ display: 'grid', gap: 8, paddingLeft: 20, lineHeight: 1.6 }}>
                    {s.list.map((item, i) => (
                      <li key={i} style={{ opacity: 0.9 }}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>

          <footer
            style={{
              borderTop: '1px solid #ffffff1a',
              color: '#cbd5e1',
              textAlign: 'center',
              padding: '18px 0',
              marginTop: 24,
            }}
          >
            © <span>{year}</span> NVC Home4You
          </footer>
        </div>
      </section>
    </main>
  )
}
