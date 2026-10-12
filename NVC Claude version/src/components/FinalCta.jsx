// The closing contact card: a question, two buttons, the phone and email as real links and
// the hours and address underneath. It was written inline at the foot of the home page and
// moved here unchanged so the product pages end on the same card; the home page's markup is
// byte-for-byte what it was (HomePage.test.jsx and the prerender diff both read it).
//
// The words come from home.finalCta and the phone and email from home.localBusiness, the
// object LocalBusinessJSONLD publishes, so the card and the schema cannot disagree. A page
// that passes nothing gets its locale's home copy; a product page usually overrides only the
// title ("Shall we talk about your container?") and keeps everything else.
//
// One contact block per page: a page that ends on this card does not also carry ContactBand.
import React from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import { getHomeContent } from '../content/home/index.js'

function Phone() {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" /></svg>
}
function Mail() {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
}
function Pin() {
  return <svg className="hp-ico hp-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
}

/**
 * @param locale     picks the home copy when `content`/`business` are not passed
 * @param content    a home.finalCta-shaped object {title, desc, primaryCta, secondaryCta, phone, email, where}
 * @param business   a home.localBusiness-shaped object {telephone, email}
 * @param id         the section id; "final-cta" by default, as the home page has always had
 * @param titleId    the heading id the section is labelled by
 * @param title/desc override just those two lines of `content`
 * @param onPrimary/onSecondary override the offer and question forms the buttons open
 */
export default function FinalCta({
  locale = 'en',
  content,
  business,
  id = 'final-cta',
  titleId = 'hp-final-title',
  title,
  desc,
  onPrimary,
  onSecondary,
}) {
  const { openOffer, openQuestion } = useModalActions()
  const home = content && business ? null : getHomeContent(locale)?.home
  const copy = content || home?.finalCta || {}
  const biz = business || home?.localBusiness || {}

  const telephone = biz.telephone || String(copy.phone || '').replace(/\s+/g, '')
  const email = biz.email || copy.email

  return (
    <section id={id} aria-labelledby={titleId}>
      <div className="hp-container">
        <div className="hp-card hp-contact">
          <h2 id={titleId}>{title || copy.title}</h2>
          <p className="hp-sub">{desc || copy.desc}</p>
          <div className="hp-cta-row">
            <button type="button" className="hp-btn" onClick={onPrimary || openOffer}>{copy.primaryCta}</button>
            <button type="button" className="hp-btn ghost" onClick={onSecondary || openQuestion}>{copy.secondaryCta}</button>
          </div>
          <div className="hp-pills">
            <a className="hp-pill" href={`tel:${telephone}`}><Phone />{copy.phone}</a>
            <a className="hp-pill" href={`mailto:${email}`}><Mail />{email}</a>
          </div>
          {copy.where ? <p className="hp-where"><Pin />{copy.where}</p> : null}
        </div>
      </div>
    </section>
  )
}
