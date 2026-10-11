// The home page, in the order the redesign settled: hero, the contact band, the three
// priced models, what we build, the catalogues, reviews, the six steps, three reasons and
// the contact card. The glide carousel and the phone quote dock are gone from the page
// (GlideServices.jsx and its content survive for the test that renders it).
//
// Photos: the hero slides and the three model photos come from the admin's slots through
// useHomePhotos, merged over the content defaults after first paint; every failure path
// shows the defaults, so the prerender never sees a broken hero.
//
// Facts printed here (phone, email, address, hours) all come from the content files and
// the same localBusiness object feeds the JSON-LD, so page and schema cannot disagree.
import React from 'react'
import '../style/HomePage.css'
import Hero from '../components/Hero.jsx'
import ContactBand from '../components/ContactBand.jsx'
import ConfiguratorStrip from '../components/ConfiguratorStrip.jsx'
import ServiceTiles from '../components/ServiceTiles.jsx'
import Catalogues from '../components/Catalogues.jsx'
import Testimonials from '../components/Testimonials.jsx'
import Steps from '../components/Steps.jsx'
import WhyUs from '../components/WhyUs.jsx'
import { LocalBusinessJSONLD } from '../components/StructuredData.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { useHomePhotos } from '../lib/homePhotos.js'

function Phone() {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" /></svg>
}
function Mail() {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
}
function Pin() {
  return <svg className="hp-ico hp-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
}

export default function HomePage({ locale = 'en', bundle }) {
  const { openOffer, openQuestion } = useModalActions()
  const content = bundle?.home
  const defaults = content?.hero?.showcase?.slides
  const photos = useHomePhotos(defaults)

  if (!content) return null

  const business = content.localBusiness || {}
  const finalCta = content.finalCta || {}
  const telephone = business.telephone || String(finalCta.phone || '').replace(/\s+/g, '')
  const email = business.email || finalCta.email

  return (
    <main className="hp">
      <Hero locale={locale} content={content.hero} slides={photos.slides} onOpenOffer={openOffer} />
      <ContactBand content={content.band} phone={finalCta.phone} email={email} telephone={telephone} />
      <ConfiguratorStrip locale={locale} content={content.strip} photos={photos.models} />
      <ServiceTiles locale={locale} content={content.serviceTiles} />
      <Catalogues locale={locale} content={content.catalogues} />
      <Testimonials locale={locale} content={content.testimonials} />
      <Steps content={content.steps} />
      <WhyUs content={content.whyUs} />

      <section id="final-cta" aria-labelledby="hp-final-title">
        <div className="hp-container">
          <div className="hp-card hp-contact">
            <h2 id="hp-final-title">{finalCta.title}</h2>
            <p className="hp-sub">{finalCta.desc}</p>
            <div className="hp-cta-row">
              <button type="button" className="hp-btn" onClick={openOffer}>{finalCta.primaryCta}</button>
              <button type="button" className="hp-btn ghost" onClick={openQuestion}>{finalCta.secondaryCta}</button>
            </div>
            <div className="hp-pills">
              <a className="hp-pill" href={`tel:${telephone}`}><Phone />{finalCta.phone}</a>
              <a className="hp-pill" href={`mailto:${email}`}><Mail />{email}</a>
            </div>
            {finalCta.where ? <p className="hp-where"><Pin />{finalCta.where}</p> : null}
          </div>
        </div>
      </section>

      <LocalBusinessJSONLD
        url={business.url}
        email={business.email}
        telephone={business.telephone}
        address={business.address}
        hours={business.hours}
      />
    </main>
  )
}
