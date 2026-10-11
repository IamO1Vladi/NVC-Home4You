// The strip under the hero that answers "where are you and how do I reach you": the
// address with a map link, the phone as a tel: link with the hours, the email as a
// mailto: link. All static text from the content files, so it prerenders, and the same
// phone and email the final card and the JSON-LD print.
import React from 'react'

function Pin() {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
}
function Phone() {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" /></svg>
}
function Mail() {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
}

export default function ContactBand({ content, phone, email, telephone }) {
  if (!content) return null
  const tel = telephone || String(phone || '').replace(/\s+/g, '')

  return (
    <div className="hp-band" id="contact-band">
      <div className="hp-container hp-band-grid">
        <div className="hp-band-item">
          <Pin />
          <div>
            <strong>{content.visitTitle}: {content.address}</strong>
            {content.mapsHref ? (
              <span><a href={content.mapsHref} target="_blank" rel="noopener noreferrer">{content.mapsLabel}</a></span>
            ) : null}
          </div>
        </div>
        <div className="hp-band-item">
          <Phone />
          <div>
            <strong>{content.callTitle}: <a href={`tel:${tel}`}>{phone}</a></strong>
            <span>{content.hours}</span>
          </div>
        </div>
        <div className="hp-band-item">
          <Mail />
          <div>
            <strong>{content.writeTitle}: <a href={`mailto:${email}`}>{email}</a></strong>
            <span>{content.replyNote}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
