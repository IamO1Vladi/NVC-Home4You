// The home page, in the order the redesign settled: hero, the contact band, the three
// priced models, what we build, the catalogues, reviews, the six steps, three reasons and
// the contact card (FinalCta, which the product pages end on too). The glide carousel and
// the phone quote dock are gone from the page (GlideServices.jsx and its content survive
// for the test that renders it).
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
import FinalCta from '../components/FinalCta.jsx'
import { LocalBusinessJSONLD } from '../components/StructuredData.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { useHomePhotos } from '../lib/homePhotos.js'

export default function HomePage({ locale = 'en', bundle }) {
  const { openOffer } = useModalActions()
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

      <FinalCta content={finalCta} business={business} />

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
